// KHATM SERIES - builds the full sequential plan (data/khatm_plan.json) from the coverage scan (coverage.json).
// The plan holds REFERENCES and DURATIONS only (no Quran text, translation or audio), so it is not QF content to
// re-sync: text, translation and audio are fetched fresh at render time.
//
// Rules (user, 2026-10-04): 1 Reel/day; target 45-75 s, minimum 25 s, hard cap 90 s; consecutive ayahs within ONE
// surah (never across surahs); an ayah longer than the cap is split at waqf signs; ONE reciter per surah, rotating
// across surahs, only reciters with chapter audio AND word timing for the WHOLE surah.
const https = require('https');
const fs = require('fs');
const path = require('path');
const cov = require(process.env.KHATM_COVERAGE || './coverage.json');
const scan = require(process.env.KHATM_SCAN || './scan_translation.json');

// Approved reciters (data/reciters.json), Alafasy first. KHATM_ROTATION overrides (e.g. only reciters who pause at ayah ends).
const ROTATION = (process.env.KHATM_ROTATION || '7,2,6,9,3,97,5,4,10').split(',').map(Number);
const STYLES = ['gradient', 'stars', 'rays', 'mist', 'lattice'];
const T_MIN = 25000, T_LO = 45000, T_HI = 75000, CAP = 90000, CAP_SINGLE = 95000;
const BISMILLAH_GAP = 450;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A surah is usable when its audio and ayah timings are complete; a few words without their own timing are accepted
// (re-plan 2026-10-10): the renderer fills them from the neighbouring words, so the highlight still moves in order.
const usable = (s) => !!(s && s.durations && (s.problems || []).every((p) => /words timed$/.test(p)));
// RE-PLAN FROM A POINT (owner, 2026-10-10: new reciters from Khatm Part 7). KHATM_PREFIX_PLAN = the current plan file:
// its first KHATM_PREFIX_DAYS entries (already published) are kept exactly; the surah of KHATM_RESUME (e.g. 2:20) continues
// from that ayah with the FIRST reciter of ROTATION (so that surah has two reciters: before and after the change), and
// every later surah follows ROTATION.
const PREFIX = process.env.KHATM_PREFIX_PLAN ? JSON.parse(fs.readFileSync(process.env.KHATM_PREFIX_PLAN, 'utf8')) : null;
const PREFIX_DAYS = Number(process.env.KHATM_PREFIX_DAYS || 0);
const [RESUME_S, RESUME_A] = (process.env.KHATM_RESUME || '0:0').split(':').map(Number);
const OUT_FILE = process.env.KHATM_PLAN_OUT || path.join(__dirname, '..', 'render_repo', 'data', 'khatm_plan.json');
const RECITERS_FILE = process.env.KHATM_RECITERS_JSON || path.join(__dirname, '..', 'render_repo', 'data', 'reciters.json');
function getJson(url, tries = 4) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'basaer-khatm-plan' } }, (res) => {
      const c = []; res.on('data', (d) => c.push(d));
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(c).toString('utf8'))); } catch (e) { reject(new Error(url)); } });
    }).on('error', reject);
  }).catch(async (e) => { if (tries > 1) { await sleep(3000); return getJson(url, tries - 1); } throw e; });
}
const sajdahKeys = new Set(scan.sajdah.map((x) => x.key));
// Real pauses inside long ayahs, measured in the audio on GitHub (scripts/khatm_split_pauses.js): "key@rid" -> {q: [dB, ms]}
const PAUSES = {};
const LOG_DIR = process.env.KHATM_LOGS || __dirname;
for (const f of fs.readdirSync(LOG_DIR).filter((x) => /^research_log.*\.txt$/.test(x))) {
  for (const line of fs.readFileSync(path.join(LOG_DIR, f), 'utf8').split(/\r?\n/)) {
    const m = line.match(/(\d+:\d+) \(reciter (\d+)\): boundaries at least 24 dB quieter than the peak \(60 ms\): (.*)$/);
    if (!m) continue;
    const b = {};
    if (m[3].trim() !== 'none') for (const tok of m[3].trim().split(/\s+/)) { const t = tok.match(/^(\d+):(-?\d+)dB\/(\d+)ms$/); if (t) b[t[1]] = [Number(t[2]), Number(t[3])]; }
    PAUSES[m[1] + '@' + m[2]] = b;
  }
}
// Pause at every ayah end, measured for the assigned reciter (scripts/khatm_ayah_end_pauses.js): surah -> {k: [depthDb, ms]}
const AYAH_ENDS = {};
for (const f of fs.readdirSync(LOG_DIR).filter((x) => /^ayah_end_pauses_.*\.json$/.test(x))) {
  for (const [s, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(LOG_DIR, f), 'utf8')))) AYAH_ENDS[s] = v;
}
const END_PEN = 600; // a Reel that ends (and the next one that starts) where the reciter runs on without a pause
const ayahEndPauses = (s, k, rid) => {
  const v = AYAH_ENDS[s];
  if (!v || v.reciterId !== rid || !v.ends[k]) return true; // not measured: no penalty
  return v.ends[k][0] <= -24 || v.ends[k][1] >= 80;
};
const goodPause = (key, rid, q) => { const b = PAUSES[key + '@' + rid]; const v = b && b[q]; return !!(v && v[0] <= -30 && v[1] >= 60); };
const measured = (key, rid) => !!PAUSES[key + '@' + rid];

// Cost of a passage of d ms: 0 inside 45-75 s, growing outside; impossible over the cap.
function cost(d, mustAllowShort) {
  if (d > CAP_SINGLE) return Infinity;
  if (d > CAP) return 5000 + ((d - CAP) / 1000) ** 2; // only a single ayah without a pause to cut at
  if (d >= T_LO && d <= T_HI) return 0;
  if (d > T_HI) return ((d - T_HI) / 1000) ** 2;
  if (d >= T_MIN) return ((T_LO - d) / 1000) ** 2;
  return mustAllowShort ? 2000 + ((T_MIN - d) / 1000) ** 2 : 1e6 + ((T_MIN - d) / 1000) ** 2;
}

(async () => {
  const chapters = cov.chapters;
  // 1) Reciter per surah: rotate, skipping reciters without full coverage of that surah.
  const assignment = {};
  const gaps = {};
  const noPauseSurahs = {};
  const longKeys = (ch, rid) => {
    const s = cov.reciters[rid].surahs[ch.id];
    const bismMs = ![1, 9].includes(ch.id) ? cov.reciters[rid].surahs[1].durations[0][1] + BISMILLAH_GAP : 0;
    return s.durations.filter(([k, d]) => d + (k === ch.id + ':1' ? bismMs : 0) > CAP).map(([k]) => k);
  };
  // A long ayah is feasible when its measured pauses allow parts of at most 90 s (cut only at real pauses).
  const pauseCutFeasible = (key, rid) => {
    if (!measured(key, rid)) return false;
    const [ch] = key.split(':').map(Number);
    const total = Object.fromEntries(cov.reciters[rid].surahs[ch].durations)[key];
    const qs = Object.keys(PAUSES[key + '@' + rid]).map(Number).filter((q) => goodPause(key, rid, q)).sort((a, b) => a - b);
    // approximate positions by word share of the ayah duration is not needed: check gaps with the real word timings later;
    // here: there must be at least ceil(total / CAP) - 1 pause cuts.
    return qs.length >= Math.ceil(total / CAP) - 1;
  };
  const longAyahsFeasible = (ch, rid) => longKeys(ch, rid).every((k) => pauseCutFeasible(k, rid));
  const infeasibleCount = (ch, rid) => longKeys(ch, rid).filter((k) => !pauseCutFeasible(k, rid)).length;
  let rot = 0;
  for (const ch of chapters) {
    if (PREFIX && ch.id < RESUME_S) { assignment[ch.id] = Number(PREFIX.reciterBySurah[ch.id]); continue; }
    if (PREFIX && ch.id === RESUME_S) { assignment[ch.id] = ROTATION[0]; rot = 1 % ROTATION.length; continue; }
    let chosen = null;
    for (let k = 0; k < ROTATION.length; k++) {
      const rid = ROTATION[(rot + k) % ROTATION.length];
      const s = cov.reciters[rid].surahs[ch.id];
      if (usable(s) && longAyahsFeasible(ch, rid)) { chosen = rid; rot = (rot + k + 1) % ROTATION.length; break; }
    }
    if (!chosen) {
      // no complete reciter can cut every long ayah at a real pause: the complete reciter with the fewest such ayahs
      const c = ROTATION.filter((rid) => usable(cov.reciters[rid].surahs[ch.id])).map((rid) => [rid, infeasibleCount(ch, rid)]).sort((a, b) => a[1] - b[1])[0];
      if (c) { chosen = c[0]; noPauseSurahs[ch.id] = { reciterId: c[0], ayahsWithoutPauseCut: c[1] }; }
    }
    if (!chosen) {
      // nobody complete: fewest untimed words (renderer fills them from neighbours) - reported as a gap
      const best = ROTATION.map((rid) => [rid, cov.reciters[rid].surahs[ch.id].problems.length]).sort((a, b) => a[1] - b[1])[0];
      chosen = best[0];
      gaps[ch.id] = cov.reciters[chosen].surahs[ch.id].problems;
    }
    assignment[ch.id] = chosen;
  }

  // 2) Passages per surah.
  const plan = [];
  const splitAyahs = [];
  const exceptions = [];
  for (const ch of chapters) {
    if (PREFIX && ch.id < RESUME_S) continue;
    const startA = PREFIX && ch.id === RESUME_S ? RESUME_A : 1;
    const rid = assignment[ch.id];
    const s = cov.reciters[rid].surahs[ch.id];
    const dur = Object.fromEntries(s.durations); // verse_key -> ms
    const n = ch.verses;
    const bism = ![1, 9].includes(ch.id);
    const bismMs = bism ? (cov.reciters[rid].surahs[1].durations[0][1] + BISMILLAH_GAP) : 0;
    const d = (a) => dur[`${ch.id}:${a}`];
    // Long ayahs (alone over the cap) become their own split entries.
    // An ayah over the cap is split - except one of at most 95 s that has no real pause to cut at: it stays whole
    // (up to 5 s over the cap) rather than being cut mid-recitation.
    const isLong = (a) => { const t = d(a) + (a === 1 ? bismMs : 0); return t > CAP && !(t <= CAP_SINGLE && !pauseCutFeasible(`${ch.id}:${a}`, rid)); };
    // DP over ayahs: best[i] = min cost to cover ayahs 1..i.
    const best = new Array(n + 1).fill(Infinity); const prev = new Array(n + 1).fill(-1);
    best[0] = 0;
    for (let i = 1; i < startA; i++) { best[i] = 0; prev[i] = i - 1; } // already published before the re-plan
    const surahTotal = Object.values(dur).reduce((x, y) => x + y, 0) + bismMs;
    for (let i = startA; i <= n; i++) {
      if (isLong(i)) { best[i] = best[i - 1]; prev[i] = -(i - 1) - 1; continue; } // split ayah: handled separately
      let sum = 0;
      for (let j = i; j >= startA; j--) {
        if (isLong(j)) break;
        sum += d(j) + (j === 1 ? bismMs : 0);
        if (sum > CAP && !(j === i && sum <= CAP_SINGLE)) break;
        // a short passage is only acceptable when it cannot be helped (whole short surah, or squeezed by split ayahs)
        const boundedByLongOrEnds = (j === 1 || isLong(j - 1)) && (i === n || isLong(i + 1));
        // prefer ending where the reciter really pauses (the next Reel then also starts after a pause)
        const endPen = i < n && !ayahEndPauses(ch.id, i, rid) ? END_PEN : 0;
        const c = best[j - 1] + cost(sum, surahTotal < T_MIN || boundedByLongOrEnds) + endPen;
        if (c < best[i]) { best[i] = c; prev[i] = j - 1; }
      }
    }
    // backtrack
    const segs = [];
    for (let i = n; i >= startA;) {
      if (prev[i] < 0) { segs.push({ long: i }); i = -prev[i] - 1; continue; }
      segs.push({ from: prev[i] + 1, to: i }); i = prev[i];
    }
    segs.reverse();
    for (const g of segs) {
      if (g.long) {
        // Split at waqf signs using this reciter's word timings for the ayah.
        const a = g.long;
        const key = `${ch.id}:${a}`;
        const v = (await getJson(`https://api.quran.com/api/v4/verses/by_key/${key}?words=true&word_fields=text_uthmani,char_type_name&translations=20`)).verse;
        const words = v.words.filter((w) => w.char_type_name === 'word');
        const af = (await getJson(`https://api.qurancdn.com/api/qdc/audio/reciters/${rid}/audio_files?chapter=${ch.id}&segments=true`)).audio_files[0];
        const t = af.verse_timings.find((x) => x.verse_key === key);
        const segsT = new Map(t.segments.filter((x) => Array.isArray(x) && x.length >= 3).map((x) => [x[0], x]));
        const W = words.length;
        const st = (w) => (segsT.get(w) || [w, null, null])[1];
        const en = (w) => (segsT.get(w) || [w, null, null])[2];
        // Split only after a stop sign; strongest first: U+06D8 (mandatory) / U+06D7 (stop preferred) / U+06DA (permissible)
        // / U+06D6 (continuing preferred). Never after U+06D9 (do not stop) or U+06DC (sakt).
        const STOP_COST = { 'ۘ': 0, 'ۗ': 0, 'ۚ': 60, 'ۖ': 200 };
        const stopCost = (w) => { const m = words[w - 1].text_uthmani.match(/[ۖۗۘۚ]/); return m ? STOP_COST[m[0]] : 2500; };
        const waqf = (w) => stopCost(w) < 2500;
        // DP over word boundaries: parts [p..q], cost by duration, small penalty when not ending at a waqf sign.
        // Same rule as the renderer (scripts/fetch_timeline.js partInterval): recitation order, repeats kept, impossible jumps dropped;
        // a part runs from the first time word p is recited until the reciter moves past word q.
        const cleanSegs = (() => { const ss = t.segments.filter((x) => Array.isArray(x) && x.length >= 3 && x[0] >= 1).sort((x, y) => x[1] - y[1]); const o = []; let mx = 0; for (const x of ss) { if (x[0] > mx + 3) continue; o.push(x); mx = Math.max(mx, x[0]); } return o; })();
        const partDur = (p, q) => {
          let i0 = cleanSegs.findIndex((x) => x[0] === p); if (i0 < 0) i0 = cleanSegs.findIndex((x) => x[0] >= p);
          if (i0 < 0) return Infinity; // no timed word from p on
          let i1 = cleanSegs.findIndex((x, i) => i > i0 && x[0] > q); if (i1 < 0) i1 = cleanSegs.length;
          const endMs = i1 >= cleanSegs.length ? t.timestamp_to : cleanSegs[i1 - 1][2];
          return endMs - cleanSegs[i0][1] + (a === 1 && p === 1 ? bismMs : 0);
        };
        const B = new Array(W + 1).fill(Infinity); const P = new Array(W + 1).fill(-1); B[0] = 0;
        for (let q = 1; q <= W; q++) {
          for (let p = q; p >= 1; p--) {
            const dd = partDur(p, q);
            if (dd > CAP) break;
            // Cut where the reciter really pauses (measured), preferably at a stop sign; a stop sign without a pause or a
            // plain boundary only when nothing else keeps the parts under 90 s (then the renderer fades the cut).
            const endPenalty = q === W ? 0 : (goodPause(key, rid, q) ? (waqf(q) ? 0 : 150) : 1500 + stopCost(q));
            const c = B[p - 1] + cost(dd, true) + endPenalty;
            if (c < B[q]) { B[q] = c; P[q] = p - 1; }
          }
        }
        const parts = [];
        for (let q = W; q > 0; q = P[q]) parts.push([P[q] + 1, q]);
        parts.reverse();
        const nonWaqf = parts.slice(0, -1).filter(([, q]) => !waqf(q)).length;
        const noPause = parts.slice(0, -1).filter(([, q]) => !goodPause(key, rid, q)).length;
        const english = String(v.translations[0].text).replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '').trim();
        splitAyahs.push({ key, reciterId: rid, totalSec: Math.round(d(a) / 1000), parts: parts.map(([p, q]) => [p, q, Math.round(partDur(p, q) / 1000)]), nonWaqfCuts: nonWaqf, cutsWithoutPause: noPause, measured: measured(key, rid), englishChars: english.length, maxPartArabicChars: Math.max(...parts.map(([p, q]) => words.slice(p - 1, q).map((w) => w.text_uthmani).join(' ').length)) });
        parts.forEach(([p, q], k) => plan.push({ surah: ch.id, ayahStart: a, ayahEnd: a, wordStart: p, wordEnd: q, part: k + 1, parts: parts.length, reciterId: rid, estSec: Math.round(partDur(p, q) / 100) / 10, bismillah: bism && a === 1 && k === 0, sajdah: sajdahKeys.has(key) && k === parts.length - 1 }));
        await sleep(150);
      } else {
        let sum = 0; let sj = false;
        for (let a = g.from; a <= g.to; a++) { sum += d(a); if (sajdahKeys.has(`${ch.id}:${a}`)) sj = true; }
        const b = bism && g.from === 1;
        const est = sum + (b ? bismMs : 0);
        const e = { surah: ch.id, ayahStart: g.from, ayahEnd: g.to, reciterId: rid, estSec: Math.round(est / 100) / 10, bismillah: b, sajdah: sj };
        if (est < T_MIN) exceptions.push(`${ch.id}:${g.from}-${g.to} ${e.estSec}s (${surahTotal < T_MIN ? 'the whole surah is shorter than 25 s' : 'between a split ayah / the surah edge and an ayah that would push it over 90 s'})`);
        plan.push(e);
      }
    }
  }
  // 3) Day numbers and background styles (never the same background twice in a row).
  if (PREFIX) plan.unshift(...PREFIX.plan.slice(0, PREFIX_DAYS).map((e) => ({ ...e, keptFromPrefix: true })));
  plan.forEach((e, i) => { e.day = i + 1; e.style = e.keptFromPrefix ? e.style : 'footage'; });

  const secs = plan.map((e) => e.estSec);
  const total = secs.reduce((x, y) => x + y, 0);
  const sorted = [...plan].sort((a, b) => a.estSec - b.estSec);
  const RN = JSON.parse(fs.readFileSync(RECITERS_FILE, 'utf8'));
  const summary = {
    reels: plan.length,
    totalHours: Math.round(total / 360) / 10,
    avgSec: Math.round(total / plan.length),
    shortest: sorted.slice(0, 3).map((e) => `${e.surah}:${e.ayahStart}-${e.ayahEnd} ${e.estSec}s`),
    longest: sorted.slice(-3).map((e) => `${e.surah}:${e.ayahStart}-${e.ayahEnd}${e.parts ? ' part ' + e.part + '/' + e.parts : ''} ${e.estSec}s`),
    within45to75: plan.filter((e) => e.estSec >= 45 && e.estSec <= 75).length,
    between25and45: plan.filter((e) => e.estSec >= 25 && e.estSec < 45).length,
    between75and90: plan.filter((e) => e.estSec > 75).length,
    under25: plan.filter((e) => e.estSec < 25).length,
    splitAyahs: splitAyahs.length,
    splitParts: plan.filter((e) => e.parts).length,
    yearsAt1PerDay: Math.round(plan.length / 365.25 * 10) / 10,
    yearsAt2PerDay: Math.round(plan.length / 2 / 365.25 * 10) / 10,
    reciterSurahCounts: Object.fromEntries(ROTATION.map((r) => [`${r} ${RN[String(r)].en}`, Object.values(assignment).filter((x) => x === r).length])),
    surahsWithoutCompleteReciter: gaps,
    surahsWhereALongAyahCannotBeCutAtAPause: noPauseSurahs,
    splitCutsWithoutPause: splitAyahs.reduce((x, y) => x + y.cutsWithoutPause, 0),
    ayahEndsMeasured: Object.keys(AYAH_ENDS).length + " surahs",
    reelEndsWithoutPause: plan.filter((e) => !e.parts && e.ayahEnd < chapters.find((c) => c.id === e.surah).verses && !ayahEndPauses(e.surah, e.ayahEnd, e.reciterId)).length,
    under25Exceptions: exceptions,
  };
  const out = {
    _comment: 'Khatm series plan (built ' + new Date().toISOString().slice(0, 10) + '). References and estimated durations only; no Quran text, translation or audio is stored. Text, translation and audio are fetched fresh from the Quran.com API at render time. Durations come from the API timing data of the assigned reciter and are estimates (the renderer trims silence at both ends).',
    rules: { perDay: 2, targetSec: [45, 75], minSec: 25, capSec: 90, oneReciterPerSurah: true, reciterChange: PREFIX ? { atDay: PREFIX_DAYS + 1, resume: process.env.KHATM_RESUME, surahWithTwoReciters: RESUME_S, rotation: ROTATION } : null, splitAt: 'waqf signs (plain word boundary only when no waqf fits)' },
    reciterBySurah: assignment,
    summary,
    splitAyahs,
    plan,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(summary, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
