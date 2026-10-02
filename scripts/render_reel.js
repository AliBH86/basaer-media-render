// Orchestrates a full multi-ayah Reel render: timeline fetch, audio trim, background,
// word-synced text overlays (with auto-fit Arabic sizing), composite, mux.
//
// Usage: node render_reel.js <surah> <ayahStart> <reciterId> <style> <outDir>
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { amiriQuranBase64, montserratBase64 } = require('./font_data');

const REPO_ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_BIN || 'google-chrome';
const W = 1080, H = 1920, FPS = 30;
const TOTAL_BUDGET_SEC = 180;
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

function buildOverlayHtml({ surahNameArabic, surahNameEnglish, reciterNameEnglish, surahNumber, ayahNumber, arabicWords, highlightIndex, translation, progressFraction, handle }) {
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
  .reciter { font-family:'Montserrat Local',sans-serif; font-size:32px; color:#F2ECE1; opacity:0.65; margin-top:14px; }
  .content { position:absolute; top:480px; bottom:700px; left:0; width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .arabic { direction:rtl; text-align:center; max-width:${ARABIC_MAX_WIDTH}px; max-height:480px; overflow:hidden; line-height:1.65; text-shadow:0 2px 18px rgba(0,0,0,0.55); }
  .translation { font-family:'Montserrat Local',sans-serif; font-size:46px; color:#F2ECE1; opacity:0.9; text-align:center; margin-top:46px; max-width:860px; line-height:1.4; }
  .handle { position:absolute; top:1190px; width:100%; text-align:center; font-family:'Montserrat Local',sans-serif; font-size:28px; font-weight:600; color:#C9A24B; letter-spacing:1px; }
</style></head>
<body>
  <div class="progress-track"></div>
  <div class="progress-fill"></div>
  <div class="header">
    <div class="surah-ar">سورة ${surahNameArabic}</div>
    <div class="surah-en">SURAH ${surahNameEnglish.toUpperCase()} &middot; ${surahNumber}:${ayahNumber}</div>
    <div class="reciter">${reciterNameEnglish}</div>
  </div>
  <div class="content">
    <div class="arabic" id="arabic">${spans}</div>
    <div class="translation">${translation}</div>
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
    document.fonts.ready.then(() => {
      autofit(document.getElementById('arabic'), ${ARABIC_MAX_WIDTH}, 480, 190, 46);
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

async function main() {
  const [surah, ayahStart, reciterId, style, outDir] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  const workDir = fs.mkdtempSync('/tmp/reel-');

  const t0 = Date.now();

  // 1. Timeline
  const timelinePath = path.join(workDir, 'timeline.json');
  sh(`node "${path.join(REPO_ROOT, 'scripts', 'fetch_timeline.js')}" ${surah} ${ayahStart} ${reciterId} "${timelinePath}"`);
  const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));

  // 2. Reciter English name (from the same API list we verified for the mapping table)
  const RECITER_NAMES = {
    7: "Mishari Rashid al-`Afasy", 2: "AbdulBaset AbdulSamad (Murattal)", 1: "AbdulBaset AbdulSamad (Mujawwad)",
    6: "Mahmoud Khalil Al-Husary", 9: "Mohamed Siddiq al-Minshawi (Murattal)", 3: "Abdur-Rahman as-Sudais",
    97: "Yasser Ad Dussary", 5: "Hani ar-Rifai", 4: "Abu Bakr al-Shatri", 10: "Sa`ud ash-Shuraym",
  };
  const reciterName = RECITER_NAMES[timeline.reciterId] || `Reciter ${timeline.reciterId}`;
  const handle = '@basaer.media.bh';
  const credit = 'Text and recitation: Quran.com / Quran Foundation. Translation: Saheeh International.';

  // 3. Audio: download chapter, trim to [clipStartSec, clipEndSec], optional fade-in
  const chapterPath = path.join(workDir, 'chapter.mp3');
  sh(`curl -sS -L "${timeline.audioUrl}" -o "${chapterPath}"`);
  const audioPath = path.join(workDir, 'audio.m4a');
  const fadeFilter = timeline.fadeInMs > 0 ? `,afade=t=in:st=0:d=${(timeline.fadeInMs / 1000).toFixed(3)}` : '';
  sh(`ffmpeg -y -nostdin -i "${chapterPath}" -ss ${timeline.clipStartSec} -t ${timeline.durationSec} -af "aformat=channel_layouts=stereo${fadeFilter}" -c:a aac -b:a 128k "${audioPath}"`);

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
  timeline.ayahs.forEach(ayah => {
    ayah.wordTimings.forEach(wt => {
      overlaySpecs.push({
        startSec: wt.startMs / 1000,
        endSec: wt.endMs / 1000,
        arabicWords: ayah.arabicWords,
        highlightIndex: wt.wordIndex,
        translation: ayah.translation,
        ayahNumber: ayah.number,
      });
    });
  });

  overlaySpecs.forEach((spec, i) => {
    const html = buildOverlayHtml({
      surahNameArabic: timeline.surahNameArabic,
      surahNameEnglish: timeline.surahNameEnglish,
      reciterNameEnglish: reciterName,
      surahNumber: timeline.surah,
      ayahNumber: spec.ayahNumber,
      arabicWords: spec.arabicWords,
      highlightIndex: spec.highlightIndex,
      translation: spec.translation,
      progressFraction: spec.startSec / timeline.durationSec,
      handle,
    });
    spec.pngPath = path.join(workDir, `overlay_${i}.png`);
    renderOverlayPng(html, spec.pngPath);
  });

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

  fs.writeFileSync(path.join(outDir, 'timeline.json'), JSON.stringify(timeline, null, 2));
  fs.writeFileSync(path.join(outDir, 'render_stats.json'), JSON.stringify({
    elapsedSec: elapsed, requestedStyle: style, actualStyle, ...timeline, reciterName,
  }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
