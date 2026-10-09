// TEST ONLY (cinematic background exploration, 2026-10-09). Not used by any production workflow.
// Imports hand-picked Pexels clips (page links chosen by the owner) straight onto the runner: fetches each file the
// same way the site's Download button does, makes a 4-frame review sheet, and uploads a vertical 1080x1920 version
// (brand grade, max 15 s) plus the sheet to Cloudinary under cinematic-test/pexels/. Nothing reaches the owner's PC.
// A clip is only "approved" after its sheet has been checked by eye (no people, writing, logos, identifiable buildings).
//
// Usage: node scripts/test_cinematic_import.js <outDir>   (reads test/cinematic.json -> import: [{ url, cropX? }])
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const outDir = path.resolve(process.argv[2] || 'out/import');
fs.mkdirSync(outDir, { recursive: true });
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test', 'cinematic.json'), 'utf8'));
const W = 1080, H = 1920, MAXLEN = 15;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const sh = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'], shell: '/bin/bash' }).toString();
const up = (file, kind, id) => JSON.parse(sh(`curl -sS -X POST "https://api.cloudinary.com/v1_1/b72gfdzx/${kind}/upload" -F "file=@${file}" -F "upload_preset=ml_default" -F "public_id=cinematic-test/pexels/${id}"`));

const results = [];
for (const item of cfg.import || []) {
  const m = /-(\d+)\/?$/.exec(item.url.trim());
  if (!m) { results.push({ url: item.url, error: 'no video id in the link' }); continue; }
  const id = m[1], raw = path.join(outDir, `${id}.mp4`);
  try {
    const code = sh(`curl -sSL -A "${UA}" -o "${raw}" -w "%{http_code} %{content_type}" "https://www.pexels.com/download/video/${id}/"`).trim();
    const isVideo = / video\//.test(code) && fs.statSync(raw).size > 100000;
    if (!isVideo) { results.push({ id, error: `download refused (${code})` }); console.log(`${id}: download refused (${code})`); continue; }
    const probe = JSON.parse(sh(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height:format=duration -of json "${raw}"`));
    const dur = Number(probe.format.duration), { width, height } = probe.streams[0];
    // review sheet: 4 frames across the whole clip
    const sel = [0.1, 0.35, 0.6, 0.85].map((f) => `-ss ${(dur * f).toFixed(2)} -i "${raw}"`).join(' ');
    const sheet = path.join(outDir, `${id}-sheet.jpg`);
    sh(`ffmpeg -nostdin -loglevel error -y ${sel} -filter_complex "[0:v]scale=-2:300[a];[1:v]scale=-2:300[b];[2:v]scale=-2:300[c];[3:v]scale=-2:300[d];[a][b][c][d]hstack=4" -frames:v 1 "${sheet}"`);
    // vertical, graded library version (the same grade as the cinematic test Reel)
    const cx = item.cropX ?? 0.5, vert = path.join(outDir, `${id}-vertical.mp4`);
    sh(`ffmpeg -nostdin -loglevel error -y -t ${Math.min(MAXLEN, dur).toFixed(2)} -i "${raw}" -an -vf "scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H}:x='(iw-${W})*${cx}':y='(ih-${H})/2',` +
      `eq=saturation=0.88:contrast=1.08,colorbalance=rs=-0.08:gs=-0.02:bs=0.10:rm=-0.02:bm=0.03:rh=0.10:gh=0.06:bh=-0.08,vignette=PI/5,fps=30,format=yuv420p,setsar=1" ` +
      `-c:v libx264 -preset slow -crf 20 -movflags +faststart "${vert}"`);
    const s = up(sheet, 'image', `${id}-sheet`), v = up(vert, 'video', `${id}-vertical`);
    const r = { id, page: item.url, source: `${width}x${height}`, durationSec: +dur.toFixed(2), sheet: s.secure_url, vertical: v.secure_url };
    results.push(r);
    console.log(`IMPORTED ${JSON.stringify(r)}`);
  } catch (e) {
    results.push({ id, error: e.message.split('\n')[0] });
    console.log(`${id}: failed (${e.message.split('\n')[0]})`);
  } finally { fs.rmSync(raw, { force: true }); }
}
fs.writeFileSync(path.join(outDir, 'imported.json'), JSON.stringify(results, null, 1));
if (!results.some((r) => r.vertical)) process.exitCode = 1;
