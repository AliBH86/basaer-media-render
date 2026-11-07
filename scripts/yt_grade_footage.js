// YouTube 16:9 footage: makes each approved clip in data/youtube_footage.json a ready-to-use 14 s shot on R2, from the Coverr
// original (the download is reported back, as their terms ask): slowed down, brand grade (navy shadows, warm highlights, soft
// vignette) and a 0.8 s fade from/to black at both ends. Full-surah videos only string these shots together, which keeps long
// surahs fast. A clip already on R2 is skipped, so a run can be repeated; it stops cleanly at Coverr's query limit.
//
// Usage: COVERR_API_KEY=... node scripts/yt_grade_footage.js <outDir> <shardIndex> <shardCount>
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { putObject } = require('./upload_r2');
const { objectExists } = require('./r2_download');

const OUT = path.resolve(process.argv[2] || 'out');
const shard = Number(process.argv[3] || 0), shards = Number(process.argv[4] || 1);
const IDS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'youtube_footage.json'), 'utf8')).clips.filter((_, i) => i % shards === shard);
const SHOT = 14, SLOW = 1.6, FADE = 0.8, FPS = 30;
fs.mkdirSync(OUT, { recursive: true });
const sh = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'], shell: '/bin/bash', maxBuffer: 1 << 26 }).toString();
const auth = { Authorization: `Bearer ${process.env.COVERR_API_KEY}` };

(async () => {
  const done = [], failed = [];
  for (const id of IDS) {
    const objectKey = `basaer/youtube/footage-graded/${id}.mp4`;
    try {
      if (await objectExists(objectKey)) { done.push(id); console.log(`${id}: already on R2`); continue; }
      const cid = id.replace(/^coverr-/, '');
      const res = await fetch(`https://api.coverr.co/videos/${cid}?urls=true`, { headers: auth });
      if (!res.ok) throw new Error(`Coverr ${cid}: HTTP ${res.status}`);
      const v = await res.json();
      const url = v.urls && (v.urls.mp4_download || v.urls.mp4);
      if (!url) throw new Error('Coverr: no file url');
      const orig = path.join(OUT, `${id}-orig.mp4`), src = path.join(OUT, `${id}-src.mp4`), dst = path.join(OUT, `${id}.mp4`);
      sh(`curl -sSL --fail -o "${orig}" "${url}"`);
      await fetch(`https://api.coverr.co/videos/${cid}/stats/downloads`, { method: 'PATCH', headers: auth }).catch(() => {});
      sh(`ffmpeg -nostdin -loglevel error -y -i "${orig}" -an -vf "scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080" -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p "${src}"`);
      sh(`ffmpeg -nostdin -loglevel error -y -stream_loop -1 -i "${src}" -t ${(SHOT / SLOW + 0.5).toFixed(2)} -an -vf "setpts=${SLOW}*PTS,fps=${FPS},scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,eq=saturation=0.88:brightness=-0.03:contrast=1.04,colorbalance=bs=0.08:bm=0.03:rh=0.05:gh=0.02,vignette=PI/4.5,fade=t=in:st=0:d=${FADE},fade=t=out:st=${SHOT - FADE}:d=${FADE}" -t ${SHOT} -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r ${FPS} -g 60 "${dst}"`);
      await putObject(dst, objectKey, 'video/mp4');
      console.log(`${id}: ${(fs.statSync(dst).size / 1048576).toFixed(1)} MB`);
      for (const f of [orig, src, dst]) fs.rmSync(f, { force: true });
      done.push(id);
    } catch (e) {
      console.log(`FAILED ${id}: ${e.message.split('\n')[0]}`);
      failed.push(id);
    }
  }
  console.log(JSON.stringify({ done: done.length, failed }, null, 1));
  if (failed.length) process.exitCode = 1;
})();
