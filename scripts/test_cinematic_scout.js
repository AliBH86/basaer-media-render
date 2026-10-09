// TEST ONLY (cinematic background exploration, 2026-10-09). Not used by any production workflow.
// Searches Coverr for candidate background clips and makes one contact sheet per clip (4 frames, low-res preview),
// uploaded to Cloudinary under cinematic-test/, so every clip can be checked by eye for people, writing, logos and
// recognisable buildings before it is ever used.
//
// Usage: COVERR_API_KEY=... node scripts/test_cinematic_scout.js <outDir> ["query1,query2,..."] [perQuery]
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const KEY = process.env.COVERR_API_KEY;
if (!KEY) { console.error('COVERR_API_KEY is not set'); process.exit(1); }
const [, , outDir = 'out/scout', queryArg, perArg] = process.argv;
const QUERIES = (queryArg || 'mosque sunset,mosque night,islamic architecture,arches,mountains mist,fog mountains,clouds sun rays,sunrise clouds,rain,desert night,stars night sky,twilight sky')
  .split(',').map((q) => q.trim()).filter(Boolean);
const PER_QUERY = Number(perArg) || 6;
const RUN = process.env.GITHUB_RUN_ID || String(Date.now());
fs.mkdirSync(outDir, { recursive: true });

const sh = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'], shell: '/bin/bash' }).toString();
async function api(p) {
  const r = await fetch(`https://api.coverr.co${p}`, { headers: { Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`Coverr ${p.split('?')[0]} -> HTTP ${r.status}`);
  return r.json();
}

(async () => {
  const seen = new Map();
  for (const q of QUERIES) {
    const res = await api(`/videos?query=${encodeURIComponent(q)}&page_size=${PER_QUERY}&urls=true`);
    console.log(`query "${q}": ${res.total} total, taking ${res.hits.length}`);
    for (const v of res.hits) if (!seen.has(v.id)) seen.set(v.id, { ...v, query: q });
  }
  const list = [...seen.values()];
  const candidates = [];
  for (const [i, v] of list.entries()) {
    const n = String(i).padStart(2, '0');
    const prev = v.urls && (v.urls.mp4_preview || v.urls.mp4);
    if (!prev) { console.log(`${n} ${v.id}: no preview url, skipped`); continue; }
    const clip = path.join(outDir, `${n}.mp4`), sheet = path.join(outDir, `${n}.jpg`);
    try {
      sh(`curl -sSL --fail -o "${clip}" "${prev}"`);
      const dur = Number(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${clip}"`)) || 4;
      // 4 frames at 12/37/62/87 % of the clip, side by side
      const sel = [0.12, 0.37, 0.62, 0.87].map((f) => `-ss ${(dur * f).toFixed(2)} -i "${clip}"`).join(' ');
      sh(`ffmpeg -nostdin -loglevel error -y ${sel} -filter_complex "[0:v]scale=-2:300,trim=end_frame=1[a];[1:v]scale=-2:300,trim=end_frame=1[b];[2:v]scale=-2:300,trim=end_frame=1[c];[3:v]scale=-2:300,trim=end_frame=1[d];[a][b][c][d]hstack=4" -frames:v 1 "${sheet}"`);
      const up = JSON.parse(sh(`curl -sS -X POST "https://api.cloudinary.com/v1_1/b72gfdzx/image/upload" -F "file=@${sheet}" -F "upload_preset=ml_default" -F "public_id=cinematic-test/scout-${RUN}-${n}"`));
      candidates.push({ n, id: v.id, title: v.title, query: v.query, tags: v.tags, duration: v.duration, vertical: v.is_vertical, size: `${v.max_width}x${v.max_height}`, sheet: up.secure_url || null });
      console.log(`${n} ${v.id} "${v.title}" ${v.max_width}x${v.max_height} ${v.duration}s -> ${up.secure_url || JSON.stringify(up.error)}`);
    } catch (e) {
      console.log(`${n} ${v.id}: failed (${e.message.split('\n')[0]})`);
    } finally {
      fs.rmSync(clip, { force: true });
    }
  }
  fs.writeFileSync(path.join(outDir, 'candidates.json'), JSON.stringify(candidates, null, 1));
  console.log(`CANDIDATES_JSON ${JSON.stringify(candidates)}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
