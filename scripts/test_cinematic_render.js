// TEST ONLY (cinematic background exploration, 2026-10-09). Not used by any production workflow.
// Builds one test Reel: Coverr footage graded to the brand navy/gold, a navy scrim behind the text, and the
// UNCHANGED production text layer (buildOverlayHtml is read from render_reel.js, not copied) and recitation on top.
// Shots and cut points come from test/cinematic.json; cuts land on word starts of the recitation.
//
// Usage: COVERR_API_KEY=... CHROME_BIN=... node scripts/test_cinematic_render.js <outDir>
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const KEY = process.env.COVERR_API_KEY, CHROME = process.env.CHROME_BIN || 'google-chrome';
if (!KEY) { console.error('COVERR_API_KEY is not set'); process.exit(1); }
const outDir = path.resolve(process.argv[2] || 'out/render');
fs.mkdirSync(outDir, { recursive: true });
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test', 'cinematic.json'), 'utf8'));
const { surah, ayah, reciterId, shots } = cfg.render;
const RUN = process.env.GITHUB_RUN_ID || String(Date.now());
const W = 1080, H = 1920, FPS = 30, XF = 0.5;
const sh = (cmd) => { console.log('+ ' + cmd.slice(0, 300)); return execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'], shell: '/bin/bash' }).toString(); };
const ff = (args) => sh(`ffmpeg -nostdin -loglevel error -y ${args}`);

// The production text layer, taken from render_reel.js itself.
const src = fs.readFileSync(path.join(__dirname, 'render_reel.js'), 'utf8');
const a = src.indexOf('const W = 1080'), f0 = src.indexOf('function buildOverlayHtml(');
const m = /\r?\n\}\r?\n/.exec(src.slice(f0));
if (a < 0 || f0 < 0 || !m) { console.error('render_reel.js layout changed: buildOverlayHtml not found'); process.exit(1); }
const fonts = require('./font_data');
const buildOverlayHtml = new Function('amiriQuranBase64', 'montserratBase64', 'execSync', 'process',
  src.slice(a, f0 + m.index + m[0].length) + '\nreturn buildOverlayHtml;')(fonts.amiriQuranBase64, fonts.montserratBase64, () => {}, process);
let profile = null;
function shot(html, png) { // same headless-Chrome screenshot as production's renderOverlayPng
  const htmlPath = png.replace(/\.png$/, '.html');
  fs.writeFileSync(htmlPath, html);
  if (!profile) profile = fs.mkdtempSync('/tmp/chrome-profile-');
  sh(`"${CHROME}" --headless --disable-gpu --disable-software-rasterizer --hide-scrollbars --default-background-color=00000000 --window-size=${W},${H} --user-data-dir="${profile}" --virtual-time-budget=1200 --screenshot="${png}" "file://${htmlPath}" 2>&1 | tail -1`);
}

async function coverr(p, method = 'GET') {
  const r = await fetch(`https://api.coverr.co${p}`, { method, headers: { Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`Coverr ${method} ${p} -> HTTP ${r.status}`);
  return r.status === 204 ? null : r.json();
}

(async () => {
  // 1. text + timings from the API, through production's own fetcher
  const tlPath = path.join(outDir, 'timeline.json');
  sh(`node "${path.join(__dirname, 'fetch_timeline.js')}" ${surah} ${ayah} ${reciterId} "${tlPath}" ${ayah}`);
  const tl = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
  const rec = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'reciters.json'), 'utf8'))[String(tl.reciterId)];
  const words = tl.ayahs.flatMap((ay) => ay.wordTimings.map((wt) => ({ ay, wt })));
  const TOTAL = tl.durationSec + 0.6;

  // 2. text layer PNGs, one per word, exactly as production builds them
  const overlays = words.map(({ ay, wt }, i) => {
    const png = path.join(outDir, `ov_${i}.png`);
    shot(buildOverlayHtml({
      surahNameArabic: tl.surahNameArabic, surahNameEnglish: tl.surahNameEnglish, reciterNameEnglish: rec.en, reciterNameArabic: rec.ar,
      surahNumber: tl.surah, ayahNumber: ay.number, arabicWords: ay.arabicWords, highlightIndex: wt.wordIndex, translation: ay.translation,
      progressFraction: (wt.startMs / 1000) / tl.durationSec, handle: '@basaer.media.bh',
    }), png);
    return { png, t0: wt.startMs / 1000 };
  });
  // navy scrim behind the text area (header 290 px .. handle 1230 px) so footage never fights the Arabic
  const scrim = path.join(outDir, 'scrim.png');
  shot(`<html><body style="margin:0;width:${W}px;height:${H}px;background:linear-gradient(180deg,
    rgba(11,31,42,0.55) 0px, rgba(11,31,42,0.62) 260px, rgba(11,31,42,0.70) 560px, rgba(11,31,42,0.70) 1180px,
    rgba(11,31,42,0.35) 1420px, rgba(11,31,42,0.15) 1650px, rgba(11,31,42,0.45) 1920px)"></body></html>`, scrim);

  // 3. recitation, the same clip production cuts, 100 ms fade-out, silence to the end
  const audio = path.join(outDir, 'recitation.wav');
  ff(`-ss ${tl.clipStartSec} -t ${tl.durationSec} -i "${tl.audioUrl}" -vn -af "aresample=44100,aformat=channel_layouts=stereo,afade=t=out:st=${(tl.durationSec - 0.1).toFixed(3)}:d=0.1,apad=whole_dur=${TOTAL.toFixed(3)}" "${audio}"`);

  // 4. footage: one segment per shot, cut on word starts, vertical crop with a slow drift, brand grade
  const cuts = [0, ...shots.slice(1).map((s) => words[s.fromWord].wt.startMs / 1000), TOTAL];
  const segs = [];
  for (const [i, s] of shots.entries()) {
    const v = await coverr(`/videos/${s.id}`);
    const raw = path.join(outDir, `raw_${i}.mp4`);
    sh(`curl -sSL --fail -o "${raw}" "${v.urls.mp4_download || v.urls.mp4}"`);
    await coverr(`/videos/${s.id}/stats/downloads`, 'PATCH').catch((e) => console.log('stats ping failed (ignored): ' + e.message));
    const start = i === 0 ? 0 : cuts[i] - XF / 2, end = i === shots.length - 1 ? TOTAL : cuts[i + 1] + XF / 2, len = end - start;
    const cx = s.cropX ?? 0.5, drift = s.drift ?? 40;
    const seg = path.join(outDir, `seg_${i}.mp4`);
    ff(`-ss ${s.at} -t ${len.toFixed(3)} -i "${raw}" -an -vf "scale=-2:${H + 120},` +
      `crop=${W}:${H}:x='min(max(0,(iw-${W})*${cx}+${drift}*(t/${len.toFixed(3)}-0.5)),iw-${W})':y='(ih-${H})/2+30*(t/${len.toFixed(3)})',` +
      `eq=saturation=0.72:contrast=1.06:brightness=-0.04,` +
      `colorbalance=rs=-0.10:gs=-0.03:bs=0.12:rm=-0.04:gm=-0.01:bm=0.05:rh=0.09:gh=0.05:bh=-0.07,` +
      `vignette=PI/4.5,fps=${FPS},format=yuv420p,setsar=1" -c:v libx264 -crf 16 -preset fast "${seg}"`);
    fs.rmSync(raw, { force: true });
    segs.push({ seg, len, title: v.title, id: s.id });
  }
  // cross-dissolves on the cut points
  let chain = '', prev = '[0:v]';
  for (let k = 1; k < segs.length; k++) { const o = k === segs.length - 1 ? '[bg]' : `[x${k}]`; chain += `${prev}[${k}:v]xfade=transition=fade:duration=${XF}:offset=${(cuts[k] - XF / 2).toFixed(3)}${o};`; prev = o; }
  const bg = path.join(outDir, 'bg.mp4');
  ff(`${segs.map((s) => `-i "${s.seg}"`).join(' ')} -filter_complex "${chain.replace(/;$/, '') || '[0:v]copy[bg]'}" -map "[bg]" -t ${TOTAL.toFixed(3)} -c:v libx264 -crf 16 -preset fast "${bg}"`);

  // 5. composite like production: scrim, then each word's text PNG while it is the current word; mux the recitation
  const ins = [`-i "${bg}"`, `-i "${scrim}"`, ...overlays.map((o) => `-i "${o.png}"`), `-i "${audio}"`].join(' ');
  let fc = '[0:v][1:v]overlay[s0];', last = 's0';
  overlays.forEach((o, i) => { const end = i < overlays.length - 1 ? overlays[i + 1].t0 : TOTAL + 1; const out = `s${i + 1}`;
    fc += `[${last}][${i + 2}:v]overlay=enable='between(t,${o.t0.toFixed(3)},${(end - 0.001).toFixed(3)})'[${out}];`; last = out; });
  const reel = path.join(outDir, `cinematic-${RUN}.mp4`);
  ff(`${ins} -filter_complex "${fc.replace(/;$/, '')}" -map "[${last}]" -map ${overlays.length + 2}:a -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -t ${TOTAL.toFixed(3)} -movflags +faststart "${reel}"`);

  // 6. review stills (one per second) and upload both to the test folder
  const tile = path.join(outDir, `stills-${RUN}.jpg`);
  ff(`-i "${reel}" -vf "fps=1,scale=270:480,tile=9x1" -frames:v 1 "${tile}"`);
  for (const [file, kind] of [[reel, 'video'], [tile, 'image']]) {
    const up = JSON.parse(sh(`curl -sS -X POST "https://api.cloudinary.com/v1_1/b72gfdzx/${kind}/upload" -F "file=@${file}" -F "upload_preset=ml_default" -F "public_id=cinematic-test/${path.basename(file).replace(/\.\w+$/, '')}"`));
    console.log(`UPLOADED ${kind} -> ${up.secure_url || JSON.stringify(up.error)}`);
  }
  console.log('SHOTS ' + JSON.stringify(segs.map((s) => ({ id: s.id, title: s.title, len: +s.len.toFixed(2) }))));
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
