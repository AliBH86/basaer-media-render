// Fetches surah/verse/audio-timing data from the Quran.com API and builds a timeline
// for a multi-ayah Reel: consecutive ayahs from one surah, starting at ayahStart,
// extended ayah-by-ayah until total audio is ~15-30s (hard cap 45s), or until the
// surah runs out of ayahs (whichever comes first).
//
// Usage: node fetch_timeline.js <surah> <ayahStart> <reciterId> <outFile>
const https = require('https');
const fs = require('fs');

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
        if (res.statusCode !== 200) return reject(new Error(`${url} -> HTTP ${res.statusCode}: ${data.slice(0,200)}`));
        if (data.includes('�')) return reject(new Error(`${url} -> response contains U+FFFD (corrupted text) - refusing to render`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function stripFootnotes(text) {
  return text.replace(/<sup[^>]*>.*?<\/sup>/g, '').trim();
}

async function main() {
  const [surah, ayahStartArg, reciterId, outFile] = process.argv.slice(2);
  const ayahStart = parseInt(ayahStartArg, 10);
  const MIN_TARGET_MS = 15000;
  const MAX_CAP_MS = 45000;

  const chapterInfo = await getJson(`https://api.quran.com/api/v4/chapters/${surah}?language=en`);
  const audioInfo = await getJson(`https://api.qurancdn.com/api/qdc/audio/reciters/${reciterId}/audio_files?chapter=${surah}&segments=true`);
  const verseTimings = audioInfo.audio_files[0].verse_timings;
  const audioUrl = audioInfo.audio_files[0].audio_url;
  const totalAyahs = chapterInfo.chapter.verses_count;

  // Walk forward from ayahStart, accumulating ayahs until we hit the target duration,
  // the hard cap, or the end of the surah.
  const includedAyahs = [];
  let ayahNum = ayahStart;
  let accumulatedMs = 0;
  while (ayahNum <= totalAyahs) {
    const timing = verseTimings.find(v => v.verse_key === `${surah}:${ayahNum}`);
    if (!timing) break;
    const wouldBeMs = timing.timestamp_to - verseTimings.find(v => v.verse_key === `${surah}:${ayahStart}`).timestamp_from;
    includedAyahs.push({ number: ayahNum, timing });
    accumulatedMs = wouldBeMs;
    ayahNum++;
    if (accumulatedMs >= MIN_TARGET_MS) break;
    if (accumulatedMs >= MAX_CAP_MS) break;
  }
  const stoppedBySurahEnd = ayahNum > totalAyahs && accumulatedMs < MIN_TARGET_MS;

  // Fetch text + translation for the included ayahs.
  const verseKeys = includedAyahs.map(a => `${surah}:${a.number}`);
  const versesResp = await getJson(
    `https://api.quran.com/api/v4/verses/by_chapter/${surah}?language=en&words=false&fields=text_uthmani&translations=20&per_page=${totalAyahs}`
  );
  const verseMap = {};
  versesResp.verses.forEach(v => { verseMap[v.verse_key] = v; });

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
    const arabicWords = verse.text_uthmani.trim().split(/\s+/);
    const translation = stripFootnotes(verse.translations[0].text);
    const wordTimings = timing.segments.map(seg => ({
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
    clipStartSec: clipStartMs / 1000,
    clipEndSec: clipEndMs / 1000,
    durationSec: (clipEndMs - clipStartMs) / 1000,
    requestedLeadInMs: REQUESTED_LEAD_IN_MS,
    availableLeadInMs,
    fadeInMs,
    stoppedBySurahEnd,
    ayahs,
  };

  fs.writeFileSync(outFile, JSON.stringify(timeline, null, 2));
  console.log(`Timeline: surah ${surah} ayahs ${ayahStart}-${ayahNum - 1}, duration ${timeline.durationSec.toFixed(3)}s, lead-in ${availableLeadInMs}ms (requested ${REQUESTED_LEAD_IN_MS}ms), fade-in ${fadeInMs}ms`);
}

main().catch(e => { console.error(e); process.exit(1); });
