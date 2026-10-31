// BUILD FOOTAGE POOL (2026-10-31). Downloads every approved clip in data/footage_pool.json from its source
// (Pixabay via PIXABAY_API_KEY, Coverr via COVERR_API_KEY), grades + crops it to a vertical 1080x1920 library
// clip (same grade as the old cinematic import), and writes it into data/footage/<id>-vertical.mp4 so it is
// COMMITTED to the repo. footage_background.js then reads these local files and never fetches footage from
// Cloudinary — which is what caused the bandwidth overage. Runs on GitHub Actions (ffmpeg + the two keys live there).
//
// A tag-based safety filter parks any clip whose tags suggest people / writing / logos / vehicles / buildings
// (the hard content rule). Parked clips are listed in data/footage/parked.json for a human to look at; they are
// NOT written to the library.
//
// Usage: node scripts/build_footage_pool.js            (skips clips already present)
//        node scripts/build_footage_pool.js --force    (rebuild every clip)
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'footage');
fs.mkdirSync(OUT, { recursive: true });
const FORCE = process.argv.includes('--force');
const W = 1080, H = 1920, MAXLEN = 15;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const sh = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'], shell: '/bin/bash' }).toString();

// the hard content rule: never a face, writing/calligraphy, logo, or identifiable building. safesearch is only a filter,
// so park anything whose tags hint at people, text, brands, vehicles or buildings for a human to check before use.
const RISKY = /\b(people|person|man|men|woman|women|girl|boy|child|children|kid|kids|baby|crowd|face|portrait|model|wedding|dance|dancing|yoga|worship|pray(?:er|ing)?|text|word|writing|calligraphy|sign|signage|logo|brand|billboard|poster|flag|car|cars|truck|traffic|bus|train|boat|ship|bike|bicycle|city|street|town|building|house|church|mosque|temple|skyline|crowd)\b/i;

const grade = (raw, out, cx = 0.5) =>
  sh(`ffmpeg -nostdin -loglevel error -y -t ${MAXLEN} -i "${raw}" -an ` +
     `-vf "scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H}:x='(iw-${W})*${cx}':y='(ih-${H})/2',` +
     `eq=saturation=0.88:contrast=1.08,colorbalance=rs=-0.08:gs=-0.02:bs=0.10:rm=-0.02:bm=0.03:rh=0.10:gh=0.06:bh=-0.08,vignette=PI/5,fps=30,format=yuv420p,setsar=1" ` +
     `-c:v libx264 -preset slow -crf 20 -movflags +faststart "${out}"`);

async function pixabayUrl(id) {
  const r = await fetch(`https://pixabay.com/api/videos/?key=${process.env.PIXABAY_API_KEY}&id=${id}`, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`pixabay api ${r.status}`);
  const j = await r.json();
  const h = (j.hits || [])[0];
  if (!h) throw new Error('pixabay: id not found');
  const v = h.videos || {};
  const pick = (v.large && v.large.url) ? v.large : (v.medium || v.small);
  if (!pick || !pick.url) throw new Error('pixabay: no file url');
  return pick.url;
}
async function coverrUrl(id) {
  const H2 = { Authorization: `Bearer ${process.env.COVERR_API_KEY}` };
  const r = await fetch(`https://api.coverr.co/videos/${id}?urls=true`, { headers: H2 });
  if (!r.ok) throw new Error(`coverr api ${r.status}`);
  const v = await r.json();
  const src = v.urls && (v.urls.mp4_download || v.urls.mp4);
  if (!src) throw new Error('coverr: no file url');
  fetch(`https://api.coverr.co/videos/${id}/stats/downloads`, { method: 'PATCH', headers: H2 }).catch(() => {});
  return src;
}

(async () => {
  const pool = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'footage_pool.json'), 'utf8'));
  const done = [], parked = [], failed = [];
  for (const c of pool.clips) {
    const id = String(c.id);
    const localId = c.source === 'coverr' ? `coverr-${id}` : id;        // keep ids unambiguous across sources
    const out = path.join(OUT, `${localId}-vertical.mp4`);
    if (RISKY.test(String(c.what || ''))) { parked.push({ id: localId, pool: c.pool, why: 'risky tags', what: c.what }); continue; }
    if (!FORCE && fs.existsSync(out) && fs.statSync(out).size > 50000) { done.push({ id: localId, pool: c.pool, cached: true }); continue; }
    const raw = path.join(OUT, `${localId}.src`);
    try {
      const url = c.source === 'coverr' ? await coverrUrl(id) : await pixabayUrl(id);
      sh(`curl -sSL --fail -A "${UA}" -o "${raw}" "${url}"`);
      if (fs.statSync(raw).size < 50000) throw new Error('download too small');
      grade(raw, out, c.cropX ?? 0.5);
      if (!fs.existsSync(out) || fs.statSync(out).size < 50000) throw new Error('grade produced nothing');
      done.push({ id: localId, pool: c.pool, source: c.source });
      console.log(`OK   ${localId} [${c.pool}]`);
    } catch (e) {
      failed.push({ id: localId, pool: c.pool, error: String(e.message).split(/\r?\n/)[0] });
      console.log(`FAIL ${localId}: ${String(e.message).split(/\r?\n/)[0]}`);
    } finally { fs.rmSync(raw, { force: true }); }
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ built: new Date().toISOString(), done, parked, failed }, null, 1));
  fs.writeFileSync(path.join(ROOT, 'data', 'footage', 'parked.json'), JSON.stringify(parked, null, 1));
  console.log(`\nfootage pool: ${done.length} ready, ${parked.length} parked (risky tags), ${failed.length} failed`);
  if (!done.length) process.exitCode = 1;
})();
