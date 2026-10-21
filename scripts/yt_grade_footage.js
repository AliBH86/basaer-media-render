// YouTube 16:9 footage, graded ONCE (2026-10-21): turns each eye-checked 1920x1080 clip (Cloudinary youtube-test/footage/)
// into a ready-to-use 14 s shot: slowed down, brand grade (navy shadows, warm highlights, soft vignette, same look as the
// approved sample) and a 0.8 s fade from/to black at both ends. Stored as youtube-test/footage-graded/<id>.mp4. Full-surah
// videos then only string these shots together (concat, no re-encode of the footage), which keeps long surahs fast.
//
// Usage: node scripts/yt_grade_footage.js <outDir> <id,id,...>
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(process.argv[2] || 'out');
const IDS = process.argv[3] ? String(process.argv[3]).split(',').map((s) => s.trim()).filter(Boolean) : JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'youtube_footage.json'), 'utf8')).clips;
const SHOT = 14, SLOW = 1.6, FADE = 0.8, FPS = 30;
fs.mkdirSync(OUT, { recursive: true });
const sh = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'], shell: '/bin/bash', maxBuffer: 1 << 26 }).toString();

const done = [], failed = [];
for (const id of IDS) {
  try {
    const src = path.join(OUT, `${id}-src.mp4`), dst = path.join(OUT, `${id}.mp4`);
    sh(`curl -sSfL --retry 3 -o "${src}" "https://res.cloudinary.com/b72gfdzx/video/upload/youtube-test/footage/${id}.mp4"`);
    sh(`ffmpeg -nostdin -loglevel error -y -stream_loop -1 -i "${src}" -t ${(SHOT / SLOW + 0.5).toFixed(2)} -an -vf "setpts=${SLOW}*PTS,fps=${FPS},scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,eq=saturation=0.88:brightness=-0.03:contrast=1.04,colorbalance=bs=0.08:bm=0.03:rh=0.05:gh=0.02,vignette=PI/4.5,fade=t=in:st=0:d=${FADE},fade=t=out:st=${SHOT - FADE}:d=${FADE}" -t ${SHOT} -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r ${FPS} -g 60 "${dst}"`);
    sh(`node "${path.join(__dirname, 'upload_cloudinary.js')}" "${dst}" "youtube-test/footage-graded/${id}" video`);
    fs.unlinkSync(src); fs.unlinkSync(dst);
    done.push(id);
  } catch (e) {
    console.log(`FAILED ${id}: ${e.message}`);
    failed.push(id);
  }
}
console.log(JSON.stringify({ done, failed }, null, 2));
if (failed.length) process.exitCode = 1;
