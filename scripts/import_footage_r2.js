// Rebuilds the approved footage library (data/footage_library.json) on R2 after the Cloudinary copies became unavailable.
// Same source clips, trims, crops and grade as the original import (scripts/test_cinematic_import.js on test/cinematic);
// data/footage_import.json holds each clip's recorded settings. A clip already on R2 is skipped, so a run can be repeated.
// Usage: node scripts/import_footage_r2.js <shardIndex> <shardCount>
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { putObject } = require('./upload_r2');

const shard = Number(process.argv[2] || 0), shards = Number(process.argv[3] || 1);
const lib = require('../data/footage_library.json');
const params = require('../data/footage_import.json');
const W = 1080, H = 1920, MAXLEN = 15;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const sh = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'], shell: '/bin/bash' }).toString();
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'footage-'));

async function coverrFile(id, raw) {
  const auth = { Authorization: `Bearer ${process.env.COVERR_API_KEY}` };
  const v = await (await fetch(`https://api.coverr.co/videos/${id}?urls=true`, { headers: auth })).json();
  const src = v.urls && (v.urls.mp4_download || v.urls.mp4);
  if (!src) throw new Error('Coverr: no file url');
  sh(`curl -sSL --fail -o "${raw}" "${src}"`);
  await fetch(`https://api.coverr.co/videos/${id}/stats/downloads`, { method: 'PATCH', headers: auth }).catch(() => {});
}

(async () => {
  const done = [], failed = [];
  const clips = lib.clips.filter((_, i) => i % shards === shard);
  for (const clip of clips) {
    const name = clip.id, item = params[name];
    const objectKey = `basaer/footage/${name}-vertical.mp4`;
    const publicUrl = `${process.env.R2_BASAER_PUBLIC_BASE.replace(/\/$/, '')}/${objectKey}`;
    try {
      const head = await fetch(publicUrl, { method: 'HEAD' });
      if (head.ok) { done.push(name); console.log(`${name}: already on R2`); continue; }
      if (!item) throw new Error('no recorded import settings');
      const raw = path.join(work, `${name}.mp4`), vert = path.join(work, `${name}-vertical.mp4`);
      if (item.coverr) await coverrFile(item.coverr, raw);
      else {
        const id = /(\d+)\/?$/.exec(item.url.trim())[1];
        const code = sh(`curl -sSL -A "${UA}" -o "${raw}" -w "%{http_code} %{content_type}" "https://www.pexels.com/download/video/${id}/"`).trim();
        if (!/ video\//.test(code) || fs.statSync(raw).size < 100000) throw new Error(`download refused (${code})`);
      }
      const full = Number(JSON.parse(sh(`ffprobe -v error -show_entries format=duration -of json "${raw}"`)).format.duration);
      const from = item.from || 0, dur = Math.min(item.to ?? full, full) - from, cx = item.cropX ?? 0.5;
      sh(`ffmpeg -nostdin -loglevel error -y -ss ${from} -t ${Math.min(MAXLEN, dur).toFixed(2)} -i "${raw}" -an -vf "scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H}:x='(iw-${W})*${cx}':y='(ih-${H})/2',` +
        `eq=saturation=0.88:contrast=1.08,colorbalance=rs=-0.08:gs=-0.02:bs=0.10:rm=-0.02:bm=0.03:rh=0.10:gh=0.06:bh=-0.08,vignette=PI/5,fps=30,format=yuv420p,setsar=1" ` +
        `-c:v libx264 -preset slow -crf 20 -movflags +faststart "${vert}"`);
      await putObject(vert, objectKey, 'video/mp4');
      done.push(name);
      console.log(`${name}: imported, ${(fs.statSync(vert).size / 1048576).toFixed(1)} MB`);
      fs.rmSync(raw, { force: true }); fs.rmSync(vert, { force: true });
    } catch (e) {
      failed.push(`${name}: ${e.message.split('\n')[0]}`);
      console.log(`${name}: FAILED ${e.message.split('\n')[0]}`);
    }
  }
  console.log(`shard ${shard}: done ${done.length}, failed ${failed.length}`);
  failed.forEach((f) => console.log(`MISSING ${f}`));
  if (!done.length) process.exitCode = 1;
})();
