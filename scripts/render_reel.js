// Orchestrates a full multi-ayah Reel render: timeline fetch, audio trim, background,
// word-synced text overlays (with auto-fit Arabic sizing), composite, mux.
//
// Usage: node render_reel.js <surah> <ayahStart> <reciterId> <style> <outDir> [ayahEnd]
//   ayahEnd (optional): render exactly ayahStart..ayahEnd. Without it the passage is auto-extended to ~15 s.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { amiriQuranBase64, montserratBase64 } = require('./font_data');

const REPO_ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_BIN || 'google-chrome';
const W = 1080, H = 1920, FPS = 30;
const TOTAL_BUDGET_SEC = Number(process.env.TOTAL_BUDGET_SEC || 180); // Khatm Reels (up to 90 s) get a larger budget via env
// Khatm series (2026-10-04): long ayahs are shown in pages of at most PAGE_MAX_WORDS words, Arabic only.
const KHATM = process.env.KHATM === '1';
const PAGE_MAX_WORDS = 18;
const SAJDAH = String.fromCharCode(0x06E9);
const BG_BUDGET_SEC = 60;
const FALLBACK_STYLE = 'mist';

// Safe-zone-derived layout (1080x1920 canvas; top 270px / bottom 670px / sides 65px
// kept clear per Meta's current Reels guidance).
const SAFE_X = 65, SAFE_W = W - 2 * SAFE_X; // 65..1015, 950 wide
const ARABIC_MAX_WIDTH = Math.round(W * 0.8); // 864px, ~80% of canvas width

function sh(cmd) {
  console.log('+ ' + cmd);
  execSync(cmd, { stdio: 'inherit', shell: '/bin/bash' });
}

function buildOverlayHtml({ surahNameArabic, surahNameEnglish, reciterNameEnglish, reciterNameArabic, surahNumber, ayahNumber, arabicWords, highlightIndex, translation, progressFraction, handle, refText, sajdah }) {
  const ref = refText !== undefined ? refText : `${surahNumber}:${ayahNumber}`;
  const spans = arabicWords.map((w, i) => {
    const color = i === highlightIndex ? '#C9A24B' : '#F2ECE1';
    const weight = i === highlightIndex ? '700' : '400';
    return `<span style="color:${color};font-weight:${weight};">${w}</span>`;
  }).join(' ');
  const fillPct = Math.max(0, Math.min(1, progressFraction)) * 100;

  // No on-screen credit line (it's small by nature and the safe zone is tight on a
  // multi-ayah layout) - credit lives in the caption only; see render_reel.js caption
  // generation. Dropping it also frees vertical room for the enlarged reciter name and
  // the per-ayah reference line below.
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  /* Self-hosted, base64-embedded fonts - no network dependency at render time. Google
     Fonts splits Amiri Quran into separate arabic/latin woff2 chunks fetched on demand;
     under repeated headless Chrome invocations in CI, that chunked fetch was flaky
     (different Arabic words randomly rendered as tofu/missing-glyph boxes across runs
     depending on which chunk hadn't finished loading). Embedding the font data directly
     removes the race entirely instead of trying to out-wait it. */
  @font-face {
    font-family: 'Amiri Quran Local';
    src: url(data:font/woff2;base64,${amiriQuranBase64}) format('woff2');
    font-weight: 400 700;
  }
  @font-face {
    font-family: 'Montserrat Local';
    src: url(data:font/woff2;base64,${montserratBase64}) format('woff2');
    font-weight: 100 900;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${W}px; height:${H}px; background:transparent; font-family:'Amiri Quran Local', serif; position:relative; overflow:hidden; }
  .progress-track { position:absolute; top:290px; left:${SAFE_X}px; width:${SAFE_W}px; height:4px; background:rgba(242,236,225,0.18); border-radius:2px; }
  .progress-fill { position:absolute; top:290px; left:${SAFE_X}px; width:${fillPct * SAFE_W / 100}px; height:4px; background:#C9A24B; border-radius:2px; }
  .header { position:absolute; top:324px; width:100%; text-align:center; }
  .surah-ar { font-family:'Amiri Quran Local',serif; font-size:38px; color:#C9A24B; }
  .surah-en { font-family:'Montserrat Local',sans-serif; font-size:23px; color:#F2ECE1; opacity:0.8; margin-top:10px; letter-spacing:1px; }
  .reciter { display:flex; justify-content:center; align-items:baseline; gap:18px; direction:ltr; margin-top:14px; color:#F2ECE1; opacity:0.7; line-height:1.3; }
  .reciter-ar { font-family:'Amiri Quran Local',serif; font-size:34px; direction:rtl; }
  .reciter-sep { font-family:'Montserrat Local',sans-serif; font-size:26px; opacity:0.6; }
  .reciter-en { font-family:'Montserrat Local',sans-serif; font-size:28px; }
  /* Fixed text area 520..1160 px (640 px tall): below the header, above the @handle (1190) and clear of the
     bottom 670 px that Instagram's UI covers. The script below fits Arabic + English TOGETHER into it. */
  /* top 556 (was 520): the first Arabic line's upper marks rise above its box; 36 px keeps them clear of the
     reciter line (seen on 40:9 and 21:88 in the 2026-10-04 QA). The bottom edge stays at 1160 px. */
  .content { position:absolute; top:556px; height:604px; left:0; width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .arabic { direction:rtl; text-align:center; max-width:${ARABIC_MAX_WIDTH}px; max-height:480px; overflow:visible; line-height:1.65; text-shadow:0 2px 18px rgba(0,0,0,0.55); }
  .translation { font-family:'Montserrat Local',sans-serif; font-size:46px; color:#F2ECE1; opacity:0.9; text-align:center; margin-top:70px; max-width:860px; line-height:1.4; }
  .sajdah { margin-top:10px; font-family:'Montserrat Local',sans-serif; font-size:24px; color:#C9A24B; letter-spacing:1px; }
  .sajdah-ar { font-family:'Amiri Quran Local',serif; font-size:30px; }
  .handle { position:absolute; top:1190px; width:100%; text-align:center; font-family:'Montserrat Local',sans-serif; font-size:28px; font-weight:600; color:#C9A24B; letter-spacing:1px; }
</style></head>
<body>
  <div class="progress-track"></div>
  <div class="progress-fill"></div>
  <div class="header">
    <div class="surah-ar">سورة ${surahNameArabic}</div>
    <div class="surah-en">SURAH ${surahNameEnglish.toUpperCase()}${ref ? ' &middot; ' + ref : ''}</div>
    <div class="reciter"><span class="reciter-ar">${reciterNameArabic}</span><span class="reciter-sep">&middot;</span><span class="reciter-en">${reciterNameEnglish}</span></div>${sajdah ? '<div class="sajdah"><span class="sajdah-ar">۩ آية سجدة</span> &middot; Ayah of prostration</div>' : ''}
  </div>
  <div class="content">
    <div class="arabic" id="arabic">${spans}</div>
    <div class="translation" id="translation">${translation}</div>
  </div>
  <div class="handle">${handle}</div>
  <script>
    function fits(el, maxWidth, maxHeight) {
      return el.scrollWidth <= maxWidth && el.scrollHeight <= maxHeight;
    }
    // Binary search instead of a ~70-step linear decrement: far fewer synchronous
    // font-size mutations against the same element. A long linear loop was corrupting
    // Arabic ligature shaping (the 'Allah' glyph and others rendering as tofu boxes) on
    // some words in some renders, even with fonts fully embedded and preloaded - this
    // was never actually a font-loading race, it was shaping breaking under rapid
    // resize. Binary search reduces mutations from ~70 to ~8 and a forced reflow
    // (reading offsetHeight) plus a settle frame after the last mutation lets the
    // shaping engine fully re-run on the final size before the screenshot is taken.
    function autofit(el, maxWidth, maxHeight, maxSize, minSize) {
      let lo = minSize, hi = maxSize, best = minSize;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        el.style.fontSize = mid + 'px';
        void el.offsetHeight; // force synchronous reflow before measuring
        if (fits(el, maxWidth, maxHeight)) { best = mid; lo = mid + 1; }
        else { hi = mid - 1; }
      }
      el.style.fontSize = best + 'px';
      void el.offsetHeight;
    }
    // Fit Arabic and English TOGETHER into the 604 px text area. Order of preference: biggest Arabic that fits
    // its own box, English at 46 px; if the pair is too tall, shrink the English (floor 30 px); only if it is still
    // too tall shrink the Arabic further (floor 46 px). Every step is a binary search (see the note above).
    function fitBoth(ar, tr, avail, gap) {
      const total = () => ar.offsetHeight + gap + tr.offsetHeight;
      const search = (el, lo, hi, ok) => {
        let best = lo;
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2);
          el.style.fontSize = mid + 'px';
          void el.offsetHeight;
          if (ok()) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
        }
        el.style.fontSize = best + 'px';
        void el.offsetHeight;
        return best;
      };
      search(ar, 46, 190, () => ar.scrollWidth <= ${ARABIC_MAX_WIDTH} && ar.scrollHeight <= 480);
      tr.style.fontSize = '46px';
      void tr.offsetHeight;
      if (total() > avail) {
        search(tr, 30, 46, () => total() <= avail);
        if (total() > avail) search(ar, 46, parseInt(ar.style.fontSize, 10), () => total() <= avail);
      }
      document.body.setAttribute('data-fit', 'ar=' + ar.style.fontSize + ' en=' + tr.style.fontSize + ' total=' + total() + '/' + avail);
    }
    document.fonts.ready.then(() => {
      fitBoth(document.getElementById('arabic'), document.getElementById('translation'), 604, document.getElementById('translation').textContent.trim() ? 70 : 0);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.body.setAttribute('data-fonts-ready', '1');
      }));
    });
  </script>
</body></html>`;
}

let chromeUserDataDir = null;

function renderOverlayPng(html, outPath) {
  const htmlPath = outPath.replace(/\.png$/, '.html');
  fs.writeFileSync(htmlPath, html);
  // Fonts are embedded as data: URIs (see font_data.js) so there's no network fetch left
  // to race - document.fonts.ready now resolves against data already in the page. Kept
  // --virtual-time-budget as a small safety margin and the shared --user-data-dir since
  // reusing one Chrome profile across the ~15 invocations is still a bit faster to launch.
  if (!chromeUserDataDir) chromeUserDataDir = fs.mkdtempSync('/tmp/chrome-profile-');
  sh(`"${CHROME}" --headless --disable-gpu --disable-software-rasterizer --hide-scrollbars --default-background-color=00000000 --window-size=${W},${H} --user-data-dir="${chromeUserDataDir}" --virtual-time-budget=1200 --screenshot="${outPath}" "file://${htmlPath}" 2>&1 | tail -3`);
}

// Mean/max volume (dB) of a time window of an audio/video file, via ffmpeg volumedetect.
// Returns null when the window does not exist. Digital silence is reported as -91 dB.
function levelDb(file, startSec, durSec) {
  if (!(startSec >= 0) || !(durSec > 0)) return null;
  let out = '';
  try {
    out = execSync(`ffmpeg -nostdin -hide_banner -ss ${startSec.toFixed(3)} -t ${durSec.toFixed(3)} -i "${file}" -vn -af volumedetect -f null - 2>&1`, { shell: '/bin/bash', encoding: 'utf8' });
  } catch (e) { out = String(e.stdout || ''); }
  const mean = out.match(/mean_volume:\s*(-?[\d.]+|-inf) dB/);
  const max = out.match(/max_volume:\s*(-?[\d.]+|-inf) dB/);
  if (!mean || !max) return null;
  const num = (m) => (m[1] === '-inf' ? -91 : parseFloat(m[1]));
  return { meanDb: num(mean), maxDb: num(max) };
}

// Peak level (dBFS) per 20 ms step over [startSec, startSec + durSec] of an audio/video file. Used to compare the final
// file with the source around the cut: shows whether a fade or cut touches a letter. Steps before time 0 are skipped.
function envelopeDb(file, startSec, durSec, stepMs = 20) {
  const from = Math.max(0, startSec);
  const PRE = Math.min(0.15, from); // decoder warm-up after a seek
  let buf;
  try {
    buf = execSync(`ffmpeg -v error -nostdin -ss ${(from - PRE).toFixed(3)} -t ${(durSec + PRE).toFixed(3)} -i "${file}" -vn -ac 1 -ar 16000 -f s16le -`, { shell: '/bin/bash', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) { return null; }
  const STEP = 16 * stepMs; // samples per step at 16 kHz
  const out = [];
  for (let i = Math.round(PRE * 16000 / STEP) * STEP; i + STEP <= buf.length / 2; i += STEP) {
    let peak = 0;
    for (let j = 0; j < STEP; j++) peak = Math.max(peak, Math.abs(buf.readInt16LE((i + j) * 2)));
    out.push(Math.round(20 * Math.log10(Math.max(peak, 1) / 32768)));
  }
  return out;
}

const round3 = (x) => Math.round(x * 1000) / 1000;

// 3a (start). Mutates the timeline: trims leading silence to ~150 ms before the real voice onset and shifts every
// word timing by the same amount; the first word never starts before the onset. Returns a report for the stats.
function adjustStart(timeline, chapterPath) {
  const STEP = 0.01;
  const apiFirst = timeline.clipStartSec + timeline.availableLeadInMs / 1000; // absolute source time of word 1 (API)
  const from = Math.max(0, apiFirst - 0.4);
  const env = envelopeDb(chapterPath, from, apiFirst + 1.6 - from, 10);
  if (!env || !env.length) return { applied: false, reason: 'could not read the source' };
  const iApi = Math.min(env.length, Math.round((apiFirst - from) / STEP));
  const pre = env.slice(0, iApi);
  const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const floorDb = median(pre.length ? pre : env.slice(0, 5));
  const speechPeakDb = Math.max(...env.slice(iApi)); // loudest point of the recitation in the 1.6 s after the API time
  // Onset = first frame clearly above the room sound AND within 25 dB of the recitation's own peak.
  const thresholdDb = Math.max(floorDb + 12, speechPeakDb - 25, -45);
  const report = { apiFirstWordMs: Math.round((apiFirst - timeline.clipStartSec) * 1000), noiseFloorDb: floorDb, speechPeakDb, thresholdDb };
  const before = env.slice(Math.max(0, iApi - 10), iApi); // the 100 ms before the API's first-word time
  // Continuous recitation = the sound right before the first word is already near speech level (within 20 dB).
  if (before.length && median(before) >= speechPeakDb - 20) return { ...report, applied: false, reason: 'voice already sounding before the first word (continuous recitation): API timing kept' };
  let k = -1;
  for (let i = Math.max(0, iApi - 10); i < env.length - 1; i++) if (env[i] >= thresholdDb && env[i + 1] >= thresholdDb - 6) { k = i; break; }
  if (k < 0) return { ...report, applied: false, reason: 'no voice onset found within 1.6 s of the first word' };
  const onset = from + k * STEP;
  const oldStart = timeline.clipStartSec;
  const newStart = Math.max(oldStart, onset - 0.15);
  const deltaMs = Math.round((newStart - oldStart) * 1000);
  const onsetMs = Math.round((onset - newStart) * 1000);
  for (const a of timeline.ayahs) {
    a.ayahStartMs = Math.max(0, a.ayahStartMs - deltaMs);
    a.ayahEndMs -= deltaMs;
    for (const w of a.wordTimings) { w.startMs = Math.max(0, w.startMs - deltaMs); w.endMs -= deltaMs; }
  }
  const first = timeline.ayahs[0].wordTimings[0];
  const firstWordApiMs = first.startMs;
  if (first.startMs < onsetMs) first.startMs = Math.min(onsetMs, first.endMs - 50);
  timeline.clipStartSec = round3(newStart);
  timeline.durationSec = round3(timeline.clipEndSec - newStart);
  timeline.availableLeadInMs = onsetMs;
  return { ...report, applied: true, voiceOnsetMsInSource: Math.round((onset - oldStart) * 1000), trimmedMs: deltaMs, leadInBeforeOnsetMs: onsetMs, firstWordMsBefore: firstWordApiMs, firstWordMsAfter: first.startMs };
}

// 3a (end). If the voice is still sounding at the API's ayah end, extend by up to 250 ms to the first natural low
// point (25 dB below the recitation level of the last 0.5 s, or below -45 dBFS); fade out 40 ms there, or 100 ms at
// the original end when the source has no low point in reach. Mutates the timeline; returns a report.
function adjustEnd(timeline, chapterPath) {
  const STEP = 0.01;
  const end = timeline.clipEndSec;
  const from = Math.max(timeline.clipStartSec, end - 0.5);
  // Read 600 ms past the end (to see whether the recording itself stops there); search for a low point in the first 250.
  const env = envelopeDb(chapterPath, from, end + 0.6 - from, 10);
  timeline.fadeOutMs = 100;
  if (!env || !env.length) return { extendedMs: 0, fadeOutMs: 100, reason: 'could not read the source' };
  const iEnd = Math.round((end - from) / STEP);
  const speechDb = Math.max(...env.slice(0, iEnd));
  const lowDb = Math.min(speechDb - 25, -30);
  const lowPoint = (db) => db <= lowDb || db <= -45;
  const atEndDb = Math.max(...env.slice(Math.max(0, iEnd - 5), iEnd)); // last 50 ms before the API end
  if (lowPoint(atEndDb)) { timeline.fadeOutMs = 40; return { extendedMs: 0, fadeOutMs: 40, levelAtApiEndDb: atEndDb, reason: 'already quiet at the ayah end' }; }
  let k = -1;
  const iMax = Math.min(env.length, Math.round((end + 0.25 - from) / STEP));
  for (let i = Math.max(0, iEnd - 5); i < iMax; i++) if (lowPoint(env[i])) { k = i; break; }
  if (k < 0) {
    // The recording itself ends inside the window while the voice is still sounding (e.g. the last ayah of a surah,
    // 3:200): keep everything up to the 250 ms limit / the file end, and let the 100 ms fade close it.
    const expected = Math.round((end + 0.6 - from) / STEP);
    if (env.length < expected - 2) {
      const cut = Math.min(end + 0.25, from + env.length * STEP - 0.02);
      const extMs = Math.max(0, Math.round((cut - end) * 1000));
      if (extMs > 0) {
        timeline.clipEndSec = round3(cut);
        timeline.durationSec = round3(cut - timeline.clipStartSec);
        const lastAyah = timeline.ayahs[timeline.ayahs.length - 1];
        lastAyah.ayahEndMs += extMs;
        lastAyah.wordTimings[lastAyah.wordTimings.length - 1].endMs += extMs;
      }
      return { extendedMs: extMs, fadeOutMs: 100, levelAtApiEndDb: atEndDb, speechDb, reason: 'the source recording ends while the voice still sounds: extended to the file end (max 250 ms) with a 100 ms fade' };
    }
    return { extendedMs: 0, fadeOutMs: 100, levelAtApiEndDb: atEndDb, speechDb, reason: 'no natural low point within 250 ms (the next ayah follows without a pause): 100 ms fade at the ayah end' };
  }
  const cut = from + (k + 1) * STEP;
  const extMs = Math.max(0, Math.round((cut - end) * 1000));
  if (extMs > 0) {
    timeline.clipEndSec = round3(cut);
    timeline.durationSec = round3(cut - timeline.clipStartSec);
    const lastAyah = timeline.ayahs[timeline.ayahs.length - 1];
    lastAyah.ayahEndMs += extMs;
    lastAyah.wordTimings[lastAyah.wordTimings.length - 1].endMs += extMs;
  }
  timeline.fadeOutMs = 40;
  return { extendedMs: extMs, fadeOutMs: 40, levelAtApiEndDb: atEndDb, lowPointDb: env[k], speechDb };
}

// Quietest 5 ms frame of the SOURCE audio in [fromSec, toSec]. Among frames within 1.5x of the minimum energy (or
// below about -60 dBFS) the one closest to preferSec wins. Returns { sec, db } or null when nothing can be read.
function quietestPoint(file, fromSec, toSec, preferSec) {
  const from = Math.max(0, fromSec);
  if (!(toSec > from)) return null;
  // Decode from 150 ms earlier and ignore that part: after a seek the MP3 decoder outputs a few milliseconds of
  // false silence (bit-reservoir warm-up) that would otherwise look like the quietest point.
  const PREROLL = Math.min(0.15, from);
  let buf;
  try {
    buf = execSync(`ffmpeg -v error -nostdin -ss ${(from - PREROLL).toFixed(3)} -t ${(toSec - from + PREROLL).toFixed(3)} -i "${file}" -vn -ac 1 -ar 16000 -f s16le -`, { shell: '/bin/bash', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) { return null; }
  const FR = 80; // 5 ms at 16 kHz
  const rms = [];
  for (let i = Math.round(PREROLL * 16000 / FR) * FR; i + FR <= buf.length / 2; i += FR) {
    let s = 0;
    for (let j = 0; j < FR; j++) { const v = buf.readInt16LE((i + j) * 2); s += v * v; }
    rms.push(Math.sqrt(s / FR));
  }
  if (!rms.length) return null;
  const limit = Math.max(Math.min(...rms) * 1.5, 33);
  let best = -1, bestDist = Infinity;
  rms.forEach((r, k) => {
    if (r > limit) return;
    const t = from + (k + 0.5) * 0.005;
    const d = Math.abs(t - preferSec);
    if (d < bestDist) { bestDist = d; best = k; }
  });
  if (best < 0) return null;
  return { sec: from + (best + 0.5) * 0.005, db: Math.round(20 * Math.log10(Math.max(rms[best], 1) / 32768) * 10) / 10 };
}

async function main() {
  const [surah, ayahStart, reciterId, style, outDir, ayahEnd] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  const workDir = fs.mkdtempSync('/tmp/reel-');

  const t0 = Date.now();

  // 1. Timeline
  const timelinePath = path.join(workDir, 'timeline.json');
  sh(`node "${path.join(REPO_ROOT, 'scripts', 'fetch_timeline.js')}" ${surah} ${ayahStart} ${reciterId} "${timelinePath}" ${ayahEnd || ''}`);
  const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));

  // Test-only hook: set by the workflow's `integrityTest` input (never by n8n's normal dispatch). It corrupts
  // one diacritic in the first ayah so the integrity guard below can be proven to block a bad render.
  if (process.env.INTEGRITY_TEST_TAMPER) {
    const fatha = String.fromCharCode(0x064E);
    const words = timeline.ayahs[0].arabicWords;
    const k = words.findIndex((w) => w.includes(fatha));
    if (k >= 0) {
      words[k] = words[k].replace(fatha, '');
      console.log(`INTEGRITY TEST: removed one fatha from word ${k} of ayah ${timeline.ayahs[0].number}`);
    }
  }

  // 2. Reciter display names (Arabic + English), approved by the user; key = Quran.com audio API reciter ID.
  const RECITERS = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'reciters.json'), 'utf8'));
  const reciterInfo = RECITERS[String(timeline.reciterId)];
  if (!reciterInfo) throw new Error(`reciter ${timeline.reciterId} is not in data/reciters.json - refusing to render without an approved name`);
  const reciterName = reciterInfo.en;
  const reciterNameArabic = reciterInfo.ar;
  const handle = '@basaer.media.bh';
  const credit = `Text and recitation: Quran.com / Quran Foundation. Translation: ${process.env.TRANSLATION_NAME || 'Saheeh International'}.`;

  // 3. Audio: download chapter, trim to [clipStartSec, clipEndSec], optional fade-in
  const chapterPath = path.join(workDir, 'chapter.mp3');
  sh(`curl -sS -L "${timeline.audioUrl}" -o "${chapterPath}"`);
  let audioPath = path.join(workDir, 'audio.m4a');

  // 3a. Voice onset and natural end (user, 2026-10-03). Silence trimming only: the recitation itself is never altered.
  //  - Start: the API's first-word time can be early (Minshawi 39:53: gold at 0.2 s, voice at 0.6 s). Find the real
  //    voice onset in the source, trim leading silence to 150 ms before it, shift all word timings by the same amount,
  //    and never start the first highlight before the onset. Skipped when the reciter runs straight in from the
  //    previous ayah (no silence before the first word), where the API time is the only usable boundary.
  //  - End: if the voice is still sounding at the API's ayah end, extend by up to 250 ms to the first natural low
  //    point of the source, then fade out (40 ms at a low point, 100 ms if there is none).
  const onsetInfo = adjustStart(timeline, chapterPath);
  const endInfo = adjustEnd(timeline, chapterPath);
  fs.writeFileSync(timelinePath, JSON.stringify(timeline, null, 2)); // the guard and the stills read this file
  console.log('Voice onset:', JSON.stringify(onsetInfo));
  console.log('Natural end:', JSON.stringify(endInfo));
  // Clean cuts: in recitations that run ayah into ayah (no pause) the cut falls inside sound, which gives a click or
  // the tail of the previous ayah. So the cut is moved to the quietest 5 ms of the SOURCE near the boundary:
  //  - start: inside the lead-in (before the first word); everything before it is muted, 12 ms fade-in
  //  - end: within the last 120 ms of the clip; everything after it is muted, 30 ms fade-out
  // Muting never moves a word, so the word timings stay valid.
  const clipStartAbs = timeline.clipStartSec;
  const clipEndAbs = timeline.clipEndSec;
  const firstWordAbs = clipStartAbs + timeline.availableLeadInMs / 1000;
  let startRel = 0, fadeInSec = timeline.fadeInMs / 1000;
  const audioCut = { start: null, end: null };
  if (timeline.availableLeadInMs >= 100) {
    const q = quietestPoint(chapterPath, firstWordAbs - 0.2, firstWordAbs - 0.01, firstWordAbs - 0.01);
    if (q) { startRel = Math.max(0, q.sec - clipStartAbs); fadeInSec = 0.012; audioCut.start = { cutOffsetMs: Math.round(startRel * 1000), levelDb: q.db }; }
  }
  const endRel = timeline.durationSec; // the end point was chosen by adjustEnd (3a)
  audioCut.end = endInfo;
  const fadeOutSec = timeline.fadeOutMs / 1000;
  // One explicit gain envelope: 0 before startRel, linear fade-in, 1, linear fade-out, 0 after endRel.
  const fi = Math.max(fadeInSec, 0.001);
  const gain = `if(lt(t,${startRel.toFixed(3)}),0,if(lt(t,${(startRel + fi).toFixed(3)}),(t-${startRel.toFixed(3)})/${fi.toFixed(3)},if(gt(t,${endRel.toFixed(3)}),0,if(gt(t,${(endRel - fadeOutSec).toFixed(3)}),(${endRel.toFixed(3)}-t)/${fadeOutSec.toFixed(3)},1))))`;
  console.log('Audio cut points:', JSON.stringify(audioCut));
  // -ss BEFORE -i (input seeking) so the filter clock starts at 0 at the cut; with output-side -ss the filters see the
  // absolute position in the chapter (about 4000 s) and the envelope below would mute everything.
  sh(`ffmpeg -y -nostdin -ss ${timeline.clipStartSec} -t ${timeline.durationSec} -i "${chapterPath}" -vn -map 0:a:0 -af "aformat=channel_layouts=stereo,volume='${gain}':eval=frame" -c:a aac -b:a 128k "${audioPath}"`);
  // Guard: the processed audio must not be silent (a broken filter once produced a silent Reel).
  const processed = levelDb(audioPath, 0, timeline.durationSec);
  console.log('Processed audio level:', JSON.stringify(processed));
  if (!processed || processed.maxDb < -30) throw new Error('Processed audio is silent or far too quiet - refusing to render a Reel without sound');

  // 3b. Bismillah (Khatm, surah start): the SAME reciter's 1:1 from his Al-Fatiha file (fetch_timeline.js explains why),
  // then a short pause, then the passage. Every later timing moves by the Bismillah's length.
  let bismillahInfo = null;
  if (timeline.bismillah) {
    const b = timeline.bismillah;
    const fatPath = path.join(workDir, 'fatiha.mp3');
    sh(`curl -sS -L "${b.audioUrl}" -o "${fatPath}"`);
    const leadMs = Math.min(150, b.fromMs);
    const bStartSec = (b.fromMs - leadMs) / 1000;
    const bDurSec = (b.toMs - b.fromMs + leadMs) / 1000;
    const GAP_SEC = 0.45;
    const bPath = path.join(workDir, 'bismillah.m4a');
    sh(`ffmpeg -y -nostdin -ss ${bStartSec.toFixed(3)} -t ${bDurSec.toFixed(3)} -i "${fatPath}" -vn -map 0:a:0 -af "aresample=44100,aformat=channel_layouts=stereo,afade=t=in:d=0.012,afade=t=out:st=${Math.max(0, bDurSec - 0.06).toFixed(3)}:d=0.06,apad=pad_dur=${GAP_SEC}" -c:a aac -b:a 128k "${bPath}"`);
    const bLen = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${bPath}"`, { shell: '/bin/bash', encoding: 'utf8' }));
    const joined = path.join(workDir, 'audio_joined.m4a');
    sh(`ffmpeg -y -nostdin -i "${bPath}" -i "${audioPath}" -filter_complex "[0:a]aresample=44100,aformat=channel_layouts=stereo[a0];[1:a]aresample=44100,aformat=channel_layouts=stereo[a1];[a0][a1]concat=n=2:v=0:a=1[a]" -map "[a]" -c:a aac -b:a 128k "${joined}"`);
    audioPath = joined;
    const offMs = Math.round(bLen * 1000);
    for (const a of timeline.ayahs) {
      a.ayahStartMs += offMs; a.ayahEndMs += offMs;
      for (const w of a.wordTimings) { w.startMs += offMs; w.endMs += offMs; }
    }
    timeline.durationSec += bLen;
    const base = b.fromMs - leadMs;
    b.wordTimings = b.wordTimingsAbs.map((w) => ({ wordIndex: w.wordIndex, startMs: w.startMs - base, endMs: w.endMs - base }));
    b.durationMs = offMs;
    bismillahInfo = { source: 'reciter ' + timeline.reciterId + ' Al-Fatiha 1:1', clipSec: round3(bDurSec), withPauseSec: round3(bLen) };
    console.log('Bismillah:', JSON.stringify(bismillahInfo));
    fs.writeFileSync(timelinePath, JSON.stringify(timeline, null, 2));
  }

  // 4. Background, with render-budget fallback
  const bgPath = path.join(workDir, 'bg.mp4');
  const bgScript = path.join(REPO_ROOT, 'scripts', 'generate_background.sh');
  let actualStyle = style;
  try {
    sh(`timeout ${BG_BUDGET_SEC} bash "${bgScript}" ${style} ${timeline.durationSec} "${bgPath}"`);
  } catch (e) {
    console.error(`WARNING: style '${style}' exceeded its ${BG_BUDGET_SEC}s render budget or failed. Falling back to '${FALLBACK_STYLE}'.`);
    actualStyle = FALLBACK_STYLE;
    sh(`bash "${bgScript}" ${FALLBACK_STYLE} ${timeline.durationSec} "${bgPath}"`);
  }

  // 5. Overlay PNGs - one per word, across all ayahs
  const overlaySpecs = [];
  // Khatm: an ayah longer than PAGE_MAX_WORDS words is shown in pages (preferably ending on a word with a waqf sign),
  // Arabic only; its full English goes into the caption. Curated Reels (KHATM unset) are unchanged: one page, English shown.
  const WAQF = /[ۖ-ۜ]/;
  const pageRanges = (from, to, words) => {
    const n = to - from + 1;
    if (!KHATM || n <= PAGE_MAX_WORDS) return [[from, to]];
    const target = Math.ceil(n / Math.ceil(n / PAGE_MAX_WORDS));
    const out = [];
    let s = from;
    while (s <= to) {
      let e = Math.min(to, s + target - 1);
      if (e < to) {
        let best = -1;
        for (let k = Math.max(s + 5, e - 4); k <= Math.min(to - 1, e + 3, s + PAGE_MAX_WORDS - 1); k++) {
          if (WAQF.test(words[k]) && (best < 0 || Math.abs(k - e) < Math.abs(best - e))) best = k;
        }
        if (best >= 0) e = best;
        if (to - e < 4) e = to; // never leave a tiny last page
      }
      out.push([s, e]);
      s = e + 1;
    }
    return out;
  };
  if (timeline.bismillah && timeline.bismillah.wordTimings) {
    timeline.bismillah.wordTimings.forEach((wt) => {
      overlaySpecs.push({ startSec: wt.startMs / 1000, endSec: wt.endMs / 1000, arabicWords: timeline.bismillah.words, highlightIndex: wt.wordIndex, translation: '', ayahNumber: 0, refText: '' });
    });
  }
  timeline.ayahs.forEach(ayah => {
    const [from, to] = ayah.wordRange || [0, ayah.arabicWords.length - 1];
    const pages = pageRanges(from, to, ayah.arabicWords);
    const showTranslation = !KHATM || (!ayah.wordRange && pages.length === 1 && (to - from + 1) <= 24 && ayah.translation.length <= 300);
    ayah.pages = pages;
    ayah.showTranslation = showTranslation;
    const sajdah = KHATM && ayah.arabicWords.some((w) => w.includes(SAJDAH));
    const refText = ayah.wordRange && process.env.PART_LABEL ? `${timeline.surah}:${ayah.number} (part ${process.env.PART_LABEL})` : undefined;
    ayah.wordTimings.forEach(wt => {
      const pg = pages.find(([a, b]) => wt.wordIndex >= a && wt.wordIndex <= b);
      overlaySpecs.push({
        startSec: wt.startMs / 1000,
        endSec: wt.endMs / 1000,
        arabicWords: ayah.arabicWords.slice(pg[0], pg[1] + 1),
        highlightIndex: wt.wordIndex - pg[0],
        translation: showTranslation ? ayah.translation : '',
        ayahNumber: ayah.number,
        refText,
        sajdah,
      });
    });
  });
  fs.writeFileSync(timelinePath, JSON.stringify(timeline, null, 2)); // pages + showTranslation, read by the guard
  console.log('Pages:', JSON.stringify(timeline.ayahs.map((a) => ({ ayah: a.number, pages: a.pages, english: a.showTranslation }))));

  overlaySpecs.forEach((spec, i) => {
    const html = buildOverlayHtml({
      surahNameArabic: timeline.surahNameArabic,
      surahNameEnglish: timeline.surahNameEnglish,
      reciterNameEnglish: reciterName,
      reciterNameArabic,
      surahNumber: timeline.surah,
      ayahNumber: spec.ayahNumber,
      arabicWords: spec.arabicWords,
      highlightIndex: spec.highlightIndex,
      translation: spec.translation,
      refText: spec.refText,
      sajdah: spec.sajdah,
      progressFraction: spec.startSec / timeline.durationSec,
      handle,
    });
    spec.html = html;
    spec.pngPath = path.join(workDir, `overlay_${i}.png`);
    // Written now (not drawn yet) so the integrity guard can read back exactly what is about to be drawn.
    fs.writeFileSync(spec.pngPath.replace(/\.png$/, '.html'), html);
  });

  // 5b. ARABIC/ENGLISH INTEGRITY GUARD: compare every overlay's text with a fresh API copy, char by char.
  // Any difference (or U+FFFD / mojibake) fails the render here, before a single frame is drawn.
  // Writes out/integrity_report.json; exit code != 0 aborts the job (the workflow then tells n8n).
  sh(`node "${path.join(REPO_ROOT, 'scripts', 'verify_text.js')}" "${timelinePath}" "${workDir}" "${outDir}"`);

  // 5c. Draw the PNGs.
  overlaySpecs.forEach((spec) => renderOverlayPng(spec.html, spec.pngPath));

  // 6. Build ffmpeg filter_complex dynamically: chain overlays, each gated by enable=between(t,start,end)
  const inputs = [`-i "${bgPath}"`, ...overlaySpecs.map(s => `-i "${s.pngPath}"`), `-i "${audioPath}"`].join(' ');
  let filterLines = [];
  let prev = '0:v';
  overlaySpecs.forEach((spec, i) => {
    const inIdx = i + 1;
    const out = i === overlaySpecs.length - 1 ? 'vout' : `v${i}`;
    const endCond = i === overlaySpecs.length - 1 ? `gte(t,${spec.startSec})` : `between(t,${spec.startSec},${spec.endSec})`;
    filterLines.push(`[${prev}][${inIdx}:v]overlay=enable='${endCond}'[${out}]`);
    prev = out;
  });
  const filterComplex = filterLines.join(';\n');
  const filterScriptPath = path.join(workDir, 'filter.txt');
  fs.writeFileSync(filterScriptPath, filterComplex);

  const audioInputIdx = overlaySpecs.length + 1;
  const outPath = path.join(outDir, `reel_${surah}_${ayahStart}.mp4`);
  sh(`ffmpeg -y -nostdin ${inputs} -filter_complex_script "${filterScriptPath}" -map "[vout]" -map ${audioInputIdx}:a -c:v libx264 -pix_fmt yuv420p -r ${FPS} -c:a aac -b:a 128k -shortest "${outPath}"`);

  const elapsed = (Date.now() - t0) / 1000;
  console.log(`\nTotal render time: ${elapsed.toFixed(1)}s (budget: ${TOTAL_BUDGET_SEC}s)`);
  if (elapsed > TOTAL_BUDGET_SEC) {
    console.error(`FAIL: render exceeded the ${TOTAL_BUDGET_SEC}s total budget.`);
    process.exitCode = 1;
  }
  console.log(`Background style: ${actualStyle}${actualStyle !== style ? ` (requested '${style}', fell back due to budget/failure)` : ''}`);
  console.log(`Lead-in: requested ${timeline.requestedLeadInMs}ms, available ${timeline.availableLeadInMs}ms, fade-in ${timeline.fadeInMs}ms`);
  console.log(`Clip: ${timeline.clipStartSec.toFixed(3)}s to ${timeline.clipEndSec.toFixed(3)}s (duration ${timeline.durationSec.toFixed(3)}s)`);
  console.log(`Ayahs included: ${timeline.ayahs.map(a => a.number).join(', ')}${timeline.stoppedBySurahEnd ? ' (surah ended before reaching 15s target)' : ''}`);
  console.log(`Output: ${outPath}`);

  const ayahRange = timeline.ayahs.length > 1
    ? `${timeline.ayahs[0].number}-${timeline.ayahs[timeline.ayahs.length - 1].number}`
    : `${timeline.ayahs[0].number}`;
  const caption = `Surah ${timeline.surahNameEnglish} (${timeline.surah}:${ayahRange})\n\n${handle}\n\n${credit}`;
  fs.writeFileSync(path.join(outDir, 'caption.txt'), caption);

  // 7. Audio checks (first-letter / last-letter clipping).
  //  - audioLevels: level of the FINAL file at its very start and end. The 80 ms fade-in (used only when the source
  //    has no lead-in) makes the first 80 ms quieter by design.
  //  - sourceLevels: level of the SOURCE recording just outside the cut. If the 100 ms before the cut start / after
  //    the cut end is near-silent, the cut falls in a pause, so no letter is clipped. 'silent' = peak below -40 dB.
  const probe = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${outPath}"`, { shell: '/bin/bash', encoding: 'utf8' });
  const fileDur = parseFloat(probe);
  const audioLevels = {
    first50ms: levelDb(outPath, 0, 0.05), first100ms: levelDb(outPath, 0, 0.1), first250ms: levelDb(outPath, 0, 0.25),
    last300ms: levelDb(outPath, fileDur - 0.3, 0.3), last250ms: levelDb(outPath, fileDur - 0.25, 0.25), last50ms: levelDb(outPath, fileDur - 0.05, 0.05),
  };
  const before = timeline.clipStartSec >= 0.1 ? levelDb(chapterPath, timeline.clipStartSec - 0.1, 0.1) : null;
  const after = levelDb(chapterPath, timeline.clipEndSec, 0.1);
  const sourceLevels = {
    beforeCut100ms: before, afterCut100ms: after,
    startsAtFileBeginning: timeline.clipStartSec < 0.1,
    startCutInSilence: before ? before.maxDb < -40 : null,
    endCutInSilence: after ? after.maxDb < -40 : null,
  };
  const envelope = {
    startFinal: envelopeDb(outPath, 0, 1.2), startSource: envelopeDb(chapterPath, timeline.clipStartSec, 1.2),
    endFinal: envelopeDb(outPath, fileDur - 0.3, 0.3), endSource: envelopeDb(chapterPath, timeline.clipEndSec - 0.3, 0.3),
    // The source for 1.5 s after the (possibly extended) end: shows how long the voice keeps sounding.
    tailSource: envelopeDb(chapterPath, timeline.clipEndSec, 1.5),
    stepMs: 20,
  };
  console.log('Audio envelope (peak dBFS per 20 ms):', JSON.stringify(envelope));
  console.log('Audio levels (final file):', JSON.stringify(audioLevels));
  console.log('Audio levels (source around the cut):', JSON.stringify(sourceLevels));

  const fileBytes = fs.statSync(outPath).size;
  fs.writeFileSync(path.join(outDir, 'timeline.json'), JSON.stringify(timeline, null, 2));
  fs.writeFileSync(path.join(outDir, 'render_stats.json'), JSON.stringify({
    elapsedSec: elapsed, requestedStyle: style, actualStyle, ...timeline, reciterName, reciterNameArabic, fileBytes, fileDurationSec: fileDur, audioLevels, sourceLevels, audioCut, envelope, voiceOnset: onsetInfo, naturalEnd: endInfo, bismillah: bismillahInfo,
  }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
