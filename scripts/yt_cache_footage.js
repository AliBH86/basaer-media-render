// YouTube 16:9 footage cache (2026-10-21): fetches the landscape original of each approved Coverr nature clip ONCE through
// the official Coverr API (download reported back, as their terms ask), stores a 1920x1080 copy on Cloudinary
// youtube-test/footage/<id>.mp4 and a 6-frame contact sheet, so every wide frame can be checked by eye before a clip is used
// in a full-surah video (the clips were approved as vertical centre crops). Clips already cached are only re-sheeted.
// Stops cleanly at Coverr's query limit and reports what is left.
//
// Usage: COVERR_API_KEY=... node scripts/yt_cache_footage.js <outDir>
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(process.argv[2] || 'out');
fs.mkdirSync(OUT, { recursive: true });
const sh = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'], shell: '/bin/bash', maxBuffer: 1 << 26 }).toString();
const lib = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'footage_library.json'), 'utf8'));
const NOT_NATURE = new Set(['mosqueN', 'mosqueD', 'skyN']);
const ids = lib.clips.filter((c) => /^coverr-/.test(c.id) && !NOT_NATURE.has(c.pool)).map((c) => c.id);
const key = process.env.COVERR_API_KEY;

(async () => {
  const report = { cached: [], fetched: [], failed: [], left: [] };
  let stop = false;
  for (const id of ids) {
    if (stop) { report.left.push(id); continue; }
    const url = `https://res.cloudinary.com/b72gfdzx/video/upload/youtube-test/footage/${id}.mp4`;
    const file = path.join(OUT, `${id}.mp4`);
    try {
      if (sh(`curl -s -o /dev/null -w "%{http_code}" "${url}"`).trim() === '200') {
        report.cached.push(id);
      } else {
        const cid = id.replace(/^coverr-/, '');
        const res = await fetch(`https://api.coverr.co/videos/${cid}?urls=true`, { headers: { Authorization: `Bearer ${key}` } });
        if (res.status === 403 || res.status === 429) { stop = true; report.left.push(id); console.log(`Coverr limit reached at ${id}: ${res.status}`); continue; }
        if (!res.ok) throw new Error(`Coverr ${cid}: HTTP ${res.status}`);
        const v = await res.json();
        const src = v.urls && (v.urls.mp4_download || v.urls.mp4);
        if (!src) throw new Error('no file url');
        const orig = path.join(OUT, `${id}-orig.mp4`);
        sh(`curl -sSL --fail -o "${orig}" "${src}"`);
        await fetch(`https://api.coverr.co/videos/${cid}/stats/downloads`, { method: 'PATCH', headers: { Authorization: `Bearer ${key}` } }).catch(() => {});
        sh(`ffmpeg -nostdin -loglevel error -y -i "${orig}" -an -vf "scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080" -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p "${file}"`);
        fs.unlinkSync(orig);
        sh(`node "${path.join(__dirname, 'upload_cloudinary.js')}" "${file}" "youtube-test/footage/${id}" video`);
        report.fetched.push(id);
      }
      // contact sheet of the wide frame (6 frames across the clip) for the eye check
      if (!fs.existsSync(file)) sh(`curl -sSfL -o "${file}" "${url}"`);
      const d = Number(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${file}"`).trim()) || 6;
      const sheet = path.join(OUT, `sheet-${id}.jpg`);
      sh(`ffmpeg -nostdin -loglevel error -y -i "${file}" -vf "fps=6/${d.toFixed(2)},scale=400:-2,tile=6x1" -frames:v 1 "${sheet}"`);
      fs.unlinkSync(file);
    } catch (e) {
      console.log(`FAILED ${id}: ${e.message}`);
      report.failed.push(id);
    }
  }
  fs.writeFileSync(path.join(OUT, 'cache_report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})();
