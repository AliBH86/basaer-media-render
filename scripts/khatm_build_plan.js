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

const ROTATION = [7, 2, 6, 9, 3, 97, 5, 4, 10]; // approved reciters (data/reciters.json), Alafasy first
const STYLES = ['gradient', 'stars', 'rays', 'mist', 'lattice'];
const T_MIN = 25000, T_LO = 45000, T_HI = 75000, CAP = 90000;
const BISMILLAH_GAP = 450;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function getJson(url, tries = 4) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'basaer-khatm-plan' } }, (res) => {
      const c = []; res.on('data', (d) => c.push(d));
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(c).toString('utf8'))); } catch (e) { reject(new Error(url)); } });
    }).on('error', reject);
  }).catch(async (e) => { if (tries > 1) { await sleep(3000); return getJson(url, tries - 1); } throw e; });
}
const sajdahKeys = new Set(scan.sajdah.map((x) => x.key));

// Cost of a passage of d ms: 0 inside 45-75 s, growing outside; impossible over the cap.
function cost(d, mustAllowShort) {
  if (d > CAP) return Infinity;
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
  let rot = 0;
  for (const ch of chapters) {
    let chosen = null;
    for (let k = 0; k < ROTATION.length; k++) {
      const rid = ROTATION[(rot + k) % ROTATION.length];
      const s = cov.reciters[rid].surahs[ch.id];
      if (s && s.ok) { chosen = rid; rot = (rot + k + 1) % ROTATION.length; break; }
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
    const rid = assignment[ch.id];
    const s = cov.reciters[rid].surahs[ch.id];
    const dur = Object.fromEntries(s.durations); // verse_key -> ms
    const n = ch.verses;
    const bism = ![1, 9].includes(ch.id);
    const bismMs = bism ? (cov.reciters[rid].surahs[1].durations[0][1] + BISMILLAH_GAP) : 0;
    const d = (a) => dur[`${ch.id}:${a}`];
    // Long ayahs (alone over the cap) become their own split entries.
    const isLong = (a) => d(a) + (a === 1 ? bismMs : 0) > CAP;
    // DP over ayahs: best[i] = min cost to cover ayahs 1..i.
    const best = new Array(n + 1).fill(Infinity); const prev = new Array(n + 1).fill(-1);
    best[0] = 0;
    const surahTotal = Object.values(dur).reduce((x, y) => x + y, 0) + bismMs;
    for (let i = 1; i <= n; i++) {
      if (isLong(i)) { best[i] = best[i - 1]; prev[i] = -(i - 1) - 1; continue; } // split ayah: handled separately
      let sum = 0;
      for (let j = i; j >= 1; j--) {
        if (isLong(j)) break;
        sum += d(j) + (j === 1 ? bismMs : 0);
        if (sum > CAP) break;
        // a short passage is only acceptable when it cannot be helped (whole short surah, or squeezed by split ayahs)
        const boundedByLongOrEnds = (j === 1 || isLong(j - 1)) && (i === n || isLong(i + 1));
        const c = best[j - 1] + cost(sum, surahTotal < T_MIN || boundedByLongOrEnds);
        if (c < best[i]) { best[i] = c; prev[i] = j - 1; }
      }
    }
    // backtrack
    const segs = [];
    for (let i = n; i > 0;) {
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
        const waqf = (w) => /[ۖ-ۜ]/.test(words[w - 1].text_uthmani);
        // DP over word boundaries: parts [p..q], cost by duration, small penalty when not ending at a waqf sign.
        const partDur = (p, q) => (en(q) ?? t.timestamp_to) - (st(p) ?? t.timestamp_from) + (a === 1 && p === 1 ? bismMs : 0);
        const B = new Array(W + 1).fill(Infinity); const P = new Array(W + 1).fill(-1); B[0] = 0;
        for (let q = 1; q <= W; q++) {
          for (let p = q; p >= 1; p--) {
            const dd = partDur(p, q);
            if (dd > CAP) break;
            const endPenalty = q === W ? 0 : (waqf(q) ? 0 : 400); // prefer waqf; a plain word boundary only if no waqf fits
            const c = B[p - 1] + cost(dd, true) + endPenalty;
            if (c < B[q]) { B[q] = c; P[q] = p - 1; }
          }
        }
        const parts = [];
        for (let q = W; q > 0; q = P[q]) parts.push([P[q] + 1, q]);
        parts.reverse();
        const nonWaqf = parts.slice(0, -1).filter(([, q]) => !waqf(q)).length;
        const english = String(v.translations[0].text).replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '').trim();
        splitAyahs.push({ key, reciterId: rid, totalSec: Math.round(d(a) / 1000), parts: parts.map(([p, q]) => [p, q, Math.round(partDur(p, q) / 1000)]), nonWaqfCuts: nonWaqf, englishChars: english.length, maxPartArabicChars: Math.max(...parts.map(([p, q]) => words.slice(p - 1, q).map((w) => w.text_uthmani).join(' ').length)) });
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
  plan.forEach((e, i) => { e.day = i + 1; e.style = STYLES[i % STYLES.length]; });

  const secs = plan.map((e) => e.estSec);
  const total = secs.reduce((x, y) => x + y, 0);
  const sorted = [...plan].sort((a, b) => a.estSec - b.estSec);
  const RN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'render_repo', 'data', 'reciters.json'), 'utf8'));
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
    under25Exceptions: exceptions,
  };
  const out = {
    _comment: 'Khatm series plan (built ' + new Date().toISOString().slice(0, 10) + '). References and estimated durations only; no Quran text, translation or audio is stored. Text, translation and audio are fetched fresh from the Quran.com API at render time. Durations come from the API timing data of the assigned reciter and are estimates (the renderer trims silence at both ends).',
    rules: { perDay: 1, targetSec: [45, 75], minSec: 25, capSec: 90, oneReciterPerSurah: true, splitAt: 'waqf signs (plain word boundary only when no waqf fits)' },
    reciterBySurah: assignment,
    summary,
    splitAyahs,
    plan,
  };
  fs.writeFileSync(path.join(__dirname, '..', 'render_repo', 'data', 'khatm_plan.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(summary, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
