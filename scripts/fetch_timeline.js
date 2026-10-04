// Fetches surah/verse/audio-timing data from the Quran.com API and builds a timeline for a Reel.
//
// Two modes:
//  - EXPLICIT (ayahEnd given): exactly ayahStart..ayahEnd, nothing more. Used for the approved Reel list.
//    Duration > 40 s is flagged (soft cap), duration > 45 s fails the render (hard cap).
//  - AUTO (no ayahEnd): consecutive ayahs from ayahStart, extended ayah-by-ayah until the audio is
//    ~15 s, stopping at the 45 s hard cap or at the end of the surah.
//
// The Arabic words come from the API's own word list (the same words the audio timing refers to),
// NOT from splitting the verse text on spaces: waqf signs and the hizb marker are separate tokens in
// the plain text but part of a word in the API's word list, so splitting would shift every highlight
// after the first stop-sign.
//
// Usage: node fetch_timeline.js <surah> <ayahStart> <reciterId> <outFile> [ayahEnd]
const https = require('https');
const fs = require('fs');

const REPLACEMENT_CHAR = String.fromCharCode(0xFFFD);
// Translation resource id: ONE config value (n8n Config.TRANSLATION_ID -> workflow input -> env). 20 = Saheeh International.
const TRANSLATION_ID = Number(process.env.TRANSLATION_ID) || 20;
// Approved surah display-name overrides (data/surah_names.json, section 'approved' only).
const SURAH_NAMES = JSON.parse(fs.readFileSync(require('path').join(__dirname, '..', 'data', 'surah_names.json'), 'utf8')).approved;
const HIZB_MARKER = String.fromCharCode(0x06DE);
// The per-word texts of the API carry two small tajweed marks (U+06ED, U+06E2) that the verse-level text does not
// have. The Reel shows the verse-level form (identical to the Daily Post and the captions), so they are removed
// from the display words; the guard proves that the result equals the verse text.
const WORD_ANNOTATIONS = String.fromCharCode(0x06ED, 0x06E2);

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      // Collect raw Buffers and decode once at the end. Appending chunks to a string decoded each
      // chunk separately, so a 2-byte Arabic character split across a chunk boundary became two
      // U+FFFD replacement chars (seen as a broken "Allah" in 112:1 - the fatha was corrupted).
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) return reject(new Error(`${url} -> HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        if (data.includes(REPLACEMENT_CHAR)) return reject(new Error(`${url} -> response contains U+FFFD (corrupted text) - refusing to render`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// API word timings in recitation order. Reciters sometimes go back a few words and recite them again (waqf and
// ibtida'); those repeats are kept so the highlight follows the voice. An entry far ahead of everything recited so far
// is a data error (e.g. a "word 118" among words 30-40 of 2:282, Al-Shatri) and is dropped.
function cleanSegments(segments, wordCount = Infinity) {
  const segs = (segments || []).filter((s) => Array.isArray(s) && s.length >= 3 && s[0] >= 1 && s[0] <= wordCount).sort((a, b) => a[1] - b[1]);
  const out = [];
  let maxSeen = 0;
  for (const s of segs) {
    if (s[0] > maxSeen + 3) continue;
    out.push(s);
    maxSeen = Math.max(maxSeen, s[0]);
  }
  return out;
}
// A split part (words ws..we): from the first time word ws is recited until the reciter moves past word we.
function partInterval(segs, ws, we) {
  let i0 = segs.findIndex((s) => s[0] === ws);
  if (i0 < 0) i0 = segs.findIndex((s) => s[0] >= ws);
  if (i0 < 0) return null;
  let i1 = segs.findIndex((s, i) => i > i0 && s[0] > we);
  if (i1 < 0) i1 = segs.length;
  const inside = segs.slice(i0, i1);
  return { startMs: inside[0][1], endMs: inside[inside.length - 1][2], prevEndMs: i0 > 0 ? segs[i0 - 1][2] : null, nextStartMs: i1 < segs.length ? segs[i1][1] : null, inside };
}

// Footnote markers and any other HTML removed; same normalisation as scripts/verify_text.js.
function cleanTranslation(text) {
  return text.replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '').trim();
}

// One display word per API word. The hizb marker is hidden (display only; the guard applies the same rule).
function wordsFromApi(verse) {
  return verse.words
    .filter(w => w.char_type_name === 'word')
    .map(w => [...w.text_uthmani].filter(c => c !== HIZB_MARKER && !WORD_ANNOTATIONS.includes(c)).join('').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

async function main() {
  const [surah, ayahStartArg, reciterId, outFile, ayahEndArg] = process.argv.slice(2);
  const ayahStart = parseInt(ayahStartArg, 10);
  const explicitEnd = ayahEndArg && String(ayahEndArg).trim() !== '' ? parseInt(ayahEndArg, 10) : null;
  const MIN_TARGET_MS = 15000;
  // Khatm series (2026-10-04): longer passages (target 45-75 s, hard cap 90 s) via env; curated Reels keep 40/45 s.
  const SOFT_CAP_MS = Number(process.env.SOFT_CAP_SEC || 40) * 1000;
  const MAX_CAP_MS = Number(process.env.MAX_CAP_SEC || 45) * 1000;
  // Khatm split ayahs: WORD_START..WORD_END (1-based, inclusive) of a single ayah. Only valid with ayahEnd = ayahStart.
  const WORD_START = process.env.WORD_START ? parseInt(process.env.WORD_START, 10) : null;
  const WORD_END = process.env.WORD_END ? parseInt(process.env.WORD_END, 10) : null;

  const chapterInfo = await getJson(`https://api.quran.com/api/v4/chapters/${surah}?language=en`);
  const audioInfo = await getJson(`https://api.qurancdn.com/api/qdc/audio/reciters/${reciterId}/audio_files?chapter=${surah}&segments=true`);
  const verseTimings = audioInfo.audio_files[0].verse_timings;
  const audioUrl = audioInfo.audio_files[0].audio_url;
  const totalAyahs = chapterInfo.chapter.verses_count;
  const timingOf = (n) => verseTimings.find(v => v.verse_key === `${surah}:${n}`);

  const includedAyahs = [];
  let accumulatedMs = 0;
  let stoppedBySurahEnd = false;

  if (explicitEnd !== null) {
    if (!(explicitEnd >= ayahStart && explicitEnd <= totalAyahs)) {
      throw new Error(`ayahEnd ${explicitEnd} is not valid for surah ${surah} (ayahStart ${ayahStart}, ${totalAyahs} ayahs)`);
    }
    for (let n = ayahStart; n <= explicitEnd; n++) {
      const timing = timingOf(n);
      if (!timing) throw new Error(`no audio timing for ${surah}:${n} (reciter ${reciterId})`);
      includedAyahs.push({ number: n, timing });
    }
    accumulatedMs = includedAyahs[includedAyahs.length - 1].timing.timestamp_to - includedAyahs[0].timing.timestamp_from;
    if (WORD_START !== null && includedAyahs.length === 1) {
      // Duration of the word range only (the clip is cut to it further down).
      const iv = partInterval(cleanSegments(includedAyahs[0].timing.segments), WORD_START, WORD_END || Infinity);
      if (iv) accumulatedMs = iv.endMs - iv.startMs;
    }
    if (accumulatedMs > MAX_CAP_MS) {
      throw new Error(`passage ${surah}:${ayahStart}-${explicitEnd} is ${(accumulatedMs / 1000).toFixed(1)} s with reciter ${reciterId}: over the ${MAX_CAP_MS / 1000} s hard cap`);
    }
  } else {
    // Walk forward from ayahStart, accumulating ayahs until we hit the target duration,
    // the hard cap, or the end of the surah.
    let ayahNum = ayahStart;
    while (ayahNum <= totalAyahs) {
      const timing = timingOf(ayahNum);
      if (!timing) break;
      accumulatedMs = timing.timestamp_to - timingOf(ayahStart).timestamp_from;
      includedAyahs.push({ number: ayahNum, timing });
      ayahNum++;
      if (accumulatedMs >= MIN_TARGET_MS) break;
      if (accumulatedMs >= MAX_CAP_MS) break;
    }
    stoppedBySurahEnd = ayahNum > totalAyahs && accumulatedMs < MIN_TARGET_MS;
  }
  const softCapExceeded = accumulatedMs > SOFT_CAP_MS;
  if (softCapExceeded) console.warn(`WARNING: ${(accumulatedMs / 1000).toFixed(1)} s is over the ${SOFT_CAP_MS / 1000} s soft cap (hard cap ${MAX_CAP_MS / 1000} s)`);

  // Text, words and translation for exactly the included ayahs (same endpoint family the guard re-checks).
  const verseMap = {};
  for (const a of includedAyahs) {
    const key = `${surah}:${a.number}`;
    const r = await getJson(`https://api.quran.com/api/v4/verses/by_key/${key}?language=en&words=true&word_fields=text_uthmani&fields=text_uthmani&translations=${TRANSLATION_ID}`);
    verseMap[key] = r.verse;
  }

  const firstTiming = includedAyahs[0].timing;
  const lastTiming = includedAyahs[includedAyahs.length - 1].timing;

  // Lead-in: pull 200ms of audio from BEFORE the first word if available in the source.
  const REQUESTED_LEAD_IN_MS = 200;
  // Split ayah (Khatm): cut at the first/last word of the range. The lead-in never reaches back into the previous word.
  const partial = WORD_START !== null && includedAyahs.length === 1;
  const firstSegs = cleanSegments(firstTiming.segments);
  let firstWordStartMs = firstSegs[0][1]; // [wordNum, startMs, endMs]
  let leadInRoomMs = firstWordStartMs;
  let clipEndMs = lastTiming.timestamp_to;
  let partIv = null;
  if (partial) {
    partIv = partInterval(firstSegs, WORD_START, WORD_END || Infinity);
    if (!partIv) throw new Error(`no word timings for ${surah}:${ayahStart} words ${WORD_START}-${WORD_END}`);
    firstWordStartMs = partIv.startMs;
    leadInRoomMs = partIv.prevEndMs !== null ? Math.max(0, partIv.startMs - partIv.prevEndMs) : firstWordStartMs;
    if (partIv.nextStartMs !== null) clipEndMs = partIv.endMs; // the last part keeps the ayah's natural end
  }
  const availableLeadInMs = Math.min(REQUESTED_LEAD_IN_MS, leadInRoomMs);
  const clipStartMs = firstWordStartMs - availableLeadInMs;
  const needsFadeIn = availableLeadInMs < REQUESTED_LEAD_IN_MS;
  // 15 ms is enough to avoid a click when the clip starts at the very beginning of the source file (which starts in
  // silence); the old 80 ms softened the first letter by up to ~19 dB.
  const fadeInMs = needsFadeIn ? 15 : 0;

  const ayahs = includedAyahs.map(({ number, timing }) => {
    const key = `${surah}:${number}`;
    const verse = verseMap[key];
    const arabicWords = wordsFromApi(verse);
    const translation = cleanTranslation(verse.translations[0].text);
    // Segments are [wordNumber(1-based), startMs, endMs]. Some reciters also time the end-of-ayah marker as an
    // extra "word"; it is not drawn, so its segment is dropped.
    // Word range shown and timed: the whole ayah, or WORD_START..WORD_END for a split ayah (0-based inclusive).
    const from = partial ? WORD_START - 1 : 0;
    const to = partial ? Math.min((WORD_END || arabicWords.length), arabicWords.length) - 1 : arabicWords.length - 1;
    // Recitation order, repeats kept, impossible jumps dropped (see cleanSegments). For a split part only the words
    // recited inside its interval are timed.
    const segsC = cleanSegments(timing.segments, arabicWords.length);
    const inClip = partial ? partIv.inside : segsC;
    const timed = new Map(); // first occurrence per word, used to place a word that has no timing at all
    segsC.forEach(seg => { if (!timed.has(seg[0] - 1)) timed.set(seg[0] - 1, { startMs: seg[1], endMs: seg[2] }); });
    // A few ayahs have one word without a timing in the API (e.g. Alafasy 2:214). Fill it from its neighbours:
    // it gets the gap between the previous word's end and the next word's start (or an equal share of the
    // neighbours when they touch), so every word is highlighted in order. Only timings are filled; text never.
    const filled = [];
    for (let i = from; i <= to; i++) {
      if (timed.has(i)) continue;
      let p = i - 1; while (p >= 0 && !timed.has(p)) p--;
      let n = i + 1; while (n < arabicWords.length && !timed.has(n)) n++;
      const prevEnd = p >= 0 ? timed.get(p).endMs : timing.timestamp_from;
      const nextStart = n < arabicWords.length ? timed.get(n).startMs : timing.timestamp_to;
      const missing = n - p - 1;
      let a = prevEnd, b = nextStart;
      if (b - a < 150 * missing) { // neighbours touch: borrow time from them
        const left = p >= 0 ? timed.get(p) : null, right = n < arabicWords.length ? timed.get(n) : null;
        a = left ? left.startMs + (left.endMs - left.startMs) / 2 : a;
        b = right ? right.startMs + (right.endMs - right.startMs) / 2 : b;
        if (left) left.endMs = a;
        if (right) right.startMs = b;
      }
      const step = (b - a) / missing;
      for (let k = 0; k < missing; k++) timed.set(p + 1 + k, { startMs: Math.round(a + k * step), endMs: Math.round(a + (k + 1) * step) });
      filled.push(`${key} word ${i + 1}`);
    }
    if (filled.length) console.warn(`NOTE: word timing filled from neighbours: ${filled.join(', ')}`);
    // Every recitation of a shown word (repeats included), plus the filled ones, in time order; no two overlap.
    const filledIdx = new Set(filled.map((f) => Number(f.split(' word ')[1]) - 1));
    const list = inClip
      .filter((s) => s[0] - 1 >= from && s[0] - 1 <= to)
      .map((s) => ({ wordIndex: s[0] - 1, startMs: s[1], endMs: s[2] }));
    for (const i of filledIdx) if (i >= from && i <= to) list.push({ wordIndex: i, ...timed.get(i) });
    list.sort((x, y) => x.startMs - y.startMs);
    for (let k = 1; k < list.length; k++) if (list[k].startMs < list[k - 1].endMs) list[k - 1].endMs = list[k].startMs;
    const wordTimings = list.filter((t) => t.endMs > t.startMs).map((t) => ({ wordIndex: t.wordIndex, startMs: t.startMs - clipStartMs, endMs: t.endMs - clipStartMs }));
    return {
      number,
      arabicWords,
      translation,
      ayahStartMs: timing.timestamp_from - clipStartMs,
      ayahEndMs: timing.timestamp_to - clipStartMs,
      wordTimings,
      ...(partial ? { wordRange: [from, to] } : {}),
      ...(filled.length ? { filledTimings: filled } : {}),
    };
  });

  // Bismillah (Khatm, BISMILLAH=auto; checked 2026-10-04): the chapter files of the approved reciters start directly
  // with ayah 1 (the first word is timed from ~0 ms and has its normal length), so they do NOT contain the Bismillah.
  // For a surah's first Reel (not Al-Fatiha, where it IS ayah 1, and not At-Tawbah, which has none) the SAME reciter's
  // Bismillah is taken from his Al-Fatiha file (1:1) with its own word timings and placed before ayah 1. The text is
  // the API's 1:1 text, fetched fresh. If the reciter has no timed 1:1, no Bismillah is shown or played.
  let bismillah = null;
  if (process.env.BISMILLAH === 'auto' && ayahStart === 1 && !partial && ![1, 9].includes(parseInt(surah, 10))) {
    const fat = await getJson(`https://api.qurancdn.com/api/qdc/audio/reciters/${reciterId}/audio_files?chapter=1&segments=true`);
    const f1 = fat.audio_files && fat.audio_files[0];
    const t11 = f1 && f1.verse_timings.find((v) => v.verse_key === '1:1');
    const segs11 = t11 ? t11.segments.filter((s) => Array.isArray(s) && s.length >= 3) : [];
    const b = (await getJson(`https://api.quran.com/api/v4/verses/by_key/1:1?language=en&words=true&word_fields=text_uthmani&fields=text_uthmani&translations=${TRANSLATION_ID}`)).verse;
    const words = wordsFromApi(b);
    if (f1 && f1.audio_url && segs11.length >= words.length) {
      bismillah = {
        audioUrl: f1.audio_url,
        fromMs: segs11[0][1], toMs: t11.timestamp_to, // absolute in the Al-Fatiha file
        words,
        wordTimingsAbs: segs11.slice(0, words.length).map((s) => ({ wordIndex: s[0] - 1, startMs: s[1], endMs: s[2] })),
      };
    } else {
      console.warn(`NOTE: reciter ${reciterId} has no fully timed 1:1 - no Bismillah will be shown`);
    }
  }

  const timeline = {
    bismillah,
    partEndsMidAyah: !!(partial && partIv && partIv.nextStartMs !== null),
    surah: parseInt(surah, 10),
    surahNameArabic: (SURAH_NAMES[String(parseInt(surah, 10))] || {}).ar || chapterInfo.chapter.name_arabic,
    surahNameEnglish: (SURAH_NAMES[String(parseInt(surah, 10))] || {}).en || chapterInfo.chapter.name_simple,
    translationId: TRANSLATION_ID,
    reciterId: parseInt(reciterId, 10),
    audioUrl,
    explicitRange: explicitEnd !== null,
    ayahStart,
    ayahEnd: includedAyahs[includedAyahs.length - 1].number,
    clipStartSec: clipStartMs / 1000,
    clipEndSec: clipEndMs / 1000,
    durationSec: (clipEndMs - clipStartMs) / 1000,
    softCapExceeded,
    requestedLeadInMs: REQUESTED_LEAD_IN_MS,
    availableLeadInMs,
    fadeInMs,
    stoppedBySurahEnd,
    ayahs,
  };

  fs.writeFileSync(outFile, JSON.stringify(timeline, null, 2));
  console.log(`Timeline: surah ${surah} ayahs ${ayahStart}-${timeline.ayahEnd} (${explicitEnd !== null ? 'explicit range' : 'auto range'}), duration ${timeline.durationSec.toFixed(3)}s, lead-in ${availableLeadInMs}ms (requested ${REQUESTED_LEAD_IN_MS}ms), fade-in ${fadeInMs}ms`);
}

main().catch(e => { console.error(e); process.exit(1); });
