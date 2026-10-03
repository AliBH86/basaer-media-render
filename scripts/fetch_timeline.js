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
  const SOFT_CAP_MS = 40000;
  const MAX_CAP_MS = 45000;

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
    const r = await getJson(`https://api.quran.com/api/v4/verses/by_key/${key}?language=en&words=true&word_fields=text_uthmani&fields=text_uthmani&translations=20`);
    verseMap[key] = r.verse;
  }

  const firstTiming = includedAyahs[0].timing;
  const lastTiming = includedAyahs[includedAyahs.length - 1].timing;

  // Lead-in: pull 200ms of audio from BEFORE the first word if available in the source.
  const REQUESTED_LEAD_IN_MS = 200;
  const firstWordStartMs = firstTiming.segments[0][1]; // [wordNum, startMs, endMs]
  const availableLeadInMs = Math.min(REQUESTED_LEAD_IN_MS, firstWordStartMs);
  const clipStartMs = firstWordStartMs - availableLeadInMs;
  const clipEndMs = lastTiming.timestamp_to;
  const needsFadeIn = availableLeadInMs < REQUESTED_LEAD_IN_MS;
  const fadeInMs = needsFadeIn ? 80 : 0;

  const ayahs = includedAyahs.map(({ number, timing }) => {
    const key = `${surah}:${number}`;
    const verse = verseMap[key];
    const arabicWords = wordsFromApi(verse);
    const translation = cleanTranslation(verse.translations[0].text);
    // Segments are [wordNumber(1-based), startMs, endMs]. Some reciters also time the end-of-ayah marker as an
    // extra "word"; it is not drawn, so its segment is dropped.
    const wordTimings = timing.segments
      .filter(seg => seg[0] - 1 < arabicWords.length)
      .map(seg => ({
        wordIndex: seg[0] - 1,
        startMs: seg[1] - clipStartMs,
        endMs: seg[2] - clipStartMs,
      }));
    return {
      number,
      arabicWords,
      translation,
      ayahStartMs: timing.timestamp_from - clipStartMs,
      ayahEndMs: timing.timestamp_to - clipStartMs,
      wordTimings,
    };
  });

  const timeline = {
    surah: parseInt(surah, 10),
    surahNameArabic: chapterInfo.chapter.name_arabic,
    surahNameEnglish: chapterInfo.chapter.name_simple,
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
