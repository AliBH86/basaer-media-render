// TEST ONLY (2026-10-10): sample of how a Reel looks with Ahmed bin Ali al-Ajmi, whose recitation is not on Quran.com and
// has no word timings. Audio per ayah from alquran.cloud (edition ar.ahmedajamy, the approved fallback source); text,
// words and translation from the Quran.com API through production's fetch_timeline.js. Without word timings the text
// changes per AYAH: the whole ayah is shown while it is recited, with no word-by-word gold highlight.
//
// Usage: CHROME_BIN=... node scripts/test_cinematic_ajmi.js <outDir>   (reads test/cinematic.json -> ajmi: {surah, ayahStart, ayahEnd, seed})
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const outDir = path.resolve(process.argv[2] || 'out/ajmi');
fs.mkdirSync(outDir, { recursive: true });
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test', 'cinematic.json'), 'utf8')).ajmi;
const CHROME = process.env.CHROME_BIN || 'google-chrome';
const RUN = process.env.GITHUB_RUN_ID || String(Date.now());
const W = 1080, H = 1920, GAP = 0.35;
const sh = (cmd) => { console.log('+ ' + cmd.slice(0, 220)); return execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'], shell: '/bin/bash' }).toString(); };
const ff = (a) => sh(`ffmpeg -nostdin -loglevel error -y ${a}`);

const src = fs.readFileSync(path.join(__dirname, 'render_reel.js'), 'utf8');
const a = src.indexOf('const W = 1080'), f0 = src.indexOf('function buildOverlayHtml(');
const m = /\r?\n\}\r?\n/.exec(src.slice(f0));
const fonts = require('./font_data');
const buildOverlayHtml = new Function('amiriQuranBase64', 'montserratBase64', 'execSync', 'process',
  src.slice(a, f0 + m.index + m[0].length) + '\nreturn buildOverlayHtml;')(fonts.amiriQuranBase64, fonts.montserratBase64, () => {}, process);
let prof = null;
const shot = (html, png) => { const h = png.replace(/\.png$/, '.html'); fs.writeFileSync(h, html); if (!prof) prof = fs.mkdtempSync('/tmp/chrome-');
  sh(`"${CHROME}" --headless --disable-gpu --hide-scrollbars --default-background-color=00000000 --window-size=${W},${H} --user-data-dir="${prof}" --virtual-time-budget=1200 --screenshot="${png}" "file://${h}" 2>&1 | tail -1`); };

(async () => {
  // text from Quran.com (production fetcher; its reciter-4 timings are not used)
  const tlPath = path.join(outDir, 'text.json');
  sh(`SOFT_CAP_SEC=75 MAX_CAP_SEC=95 node "${path.join(__dirname, 'fetch_timeline.js')}" ${cfg.surah} ${cfg.ayahStart} 4 "${tlPath}" ${cfg.ayahEnd}`);
  const tl = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
  // audio per ayah from alquran.cloud
  const parts = [];
  let t = 0;
  for (const ay of tl.ayahs) {
    const j = await (await fetch(`https://api.alquran.cloud/v1/ayah/${cfg.surah}:${ay.number}/ar.ahmedajamy`)).json();
    const mp3 = path.join(outDir, `a${ay.number}.mp3`);
    sh(`curl -sSL --fail -o "${mp3}" "${j.data.audio}"`);
    const d = Number(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${mp3}"`));
    parts.push({ ay, mp3, start: t, dur: d });
    t += d + GAP;
  }
  const TOTAL = t + 0.3;
  const audio = path.join(outDir, 'audio.wav');
  ff(`${parts.map((p) => `-i "${p.mp3}"`).join(' ')} -filter_complex "${parts.map((p, i) => `[${i}:a]aresample=44100,aformat=channel_layouts=stereo,apad=pad_dur=${GAP}[a${i}]`).join(';')};${parts.map((_, i) => `[a${i}]`).join('')}concat=n=${parts.length}:v=0:a=1,apad=whole_dur=${TOTAL.toFixed(3)}[out]" -map "[out]" "${audio}"`);
  // background: the approved footage library, cut on ayah starts
  const tlBg = path.join(outDir, 'timeline_bg.json');
  fs.writeFileSync(tlBg, JSON.stringify({ durationSec: TOTAL - 0.5, ayahs: parts.map((p) => ({ ayahStartMs: p.start * 1000 })) }));
  const bg = path.join(outDir, 'bg.mp4');
  fs.writeFileSync(path.join(__dirname, '..', 'test', 'cinematic.json'), JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test', 'cinematic.json'), 'utf8')), reel60: { scrim: 1.15, seed: cfg.seed } }));
  sh(`FOOTAGE_SEED=${cfg.seed} node "${path.join(__dirname, 'test_cinematic_bg.js')}" "${tlBg}" "${bg}"`);
  // text: one overlay per ayah, no word highlight (no timings exist), reciter name from alquran.cloud's edition record
  const ovs = parts.map((p, i) => {
    const png = path.join(outDir, `ov${i}.png`);
    shot(buildOverlayHtml({ surahNameArabic: tl.surahNameArabic, surahNameEnglish: tl.surahNameEnglish, reciterNameEnglish: 'Ahmed bin Ali al-Ajmi', reciterNameArabic: 'أحمد بن علي العجمي',
      surahNumber: tl.surah, ayahNumber: p.ay.number, arabicWords: p.ay.arabicWords, highlightIndex: -1, translation: p.ay.translation,
      progressFraction: p.start / TOTAL, handle: '@basaer.media.bh' }), png);
    return { png, t0: p.start, t1: i < parts.length - 1 ? parts[i + 1].start : TOTAL + 1 };
  });
  let fc = '', last = '0:v';
  ovs.forEach((o, i) => { const out = `v${i}`; fc += `[${last}][${i + 1}:v]overlay=enable='between(t,${o.t0.toFixed(3)},${(o.t1 - 0.001).toFixed(3)})'[${out}];`; last = out; });
  const reel = path.join(outDir, `ajmi-${RUN}.mp4`);
  ff(`-i "${bg}" ${ovs.map((o) => `-i "${o.png}"`).join(' ')} -i "${audio}" -filter_complex "${fc.replace(/;$/, '')}" -map "[${last}]" -map ${ovs.length + 1}:a -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -t ${TOTAL.toFixed(3)} -movflags +faststart "${reel}"`);
  const up = JSON.parse(sh(`curl -sS -X POST "https://api.cloudinary.com/v1_1/b72gfdzx/video/upload" -F "file=@${reel}" -F "upload_preset=ml_default" -F "public_id=cinematic-test/ajmi-${RUN}"`));
  console.log(`UPLOADED video -> ${up.secure_url || JSON.stringify(up.error)}`);
  console.log(`AYAHS ${JSON.stringify(parts.map((p) => ({ ayah: p.ay.number, sec: +p.dur.toFixed(2) })))}`);
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
