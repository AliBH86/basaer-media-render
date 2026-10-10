// TEST BRANCH ONLY (test/cinematic, 2026-10-09). Builds a real-footage background for render_reel.js from the approved
// clip library (already 1080x1920 and brand-graded on Cloudinary, see test/cinematic.json "reel60.shots"). Cuts land on
// ayah starts (and the Bismillah -> first ayah join); any piece longer than MAX_SHOT is split so no shot overstays.
// A navy scrim is baked in behind the text area so footage never fights the Arabic. Called by render_reel.js when
// BG_FOOTAGE is set; production (main) never sets it.
//
// Usage: CHROME_BIN=... node scripts/test_cinematic_bg.js <timeline.json> <out.mp4>
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const [, , tlPath, outPath] = process.argv;
const W = 1080, H = 1920, FPS = 30, XF = 0.6, MAX_SHOT = 6.5;
const CHROME = process.env.CHROME_BIN || 'google-chrome';
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test', 'cinematic.json'), 'utf8')).reel60;
const tl = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'cine-bg-'));
const sh = (cmd) => { console.log('+ ' + cmd.slice(0, 240)); return execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'], shell: '/bin/bash' }).toString(); };
const ff = (args) => sh(`ffmpeg -nostdin -loglevel error -y ${args}`);
const TOTAL = tl.durationSec + 0.5;

// 1. cut points: ayah starts (the first ayah's start is where the Bismillah ends), then split long pieces
const starts = tl.ayahs.map((a) => a.ayahStartMs / 1000).filter((s) => s > 0.5);
const raw = [0, ...starts, TOTAL];
const cuts = [0];
for (let i = 1; i < raw.length; i++) {
  const a = raw[i - 1], b = raw[i], n = Math.ceil((b - a) / MAX_SHOT);
  for (let k = 1; k <= n; k++) cuts.push(+(a + (b - a) * k / n).toFixed(3));
}
const pieces = cuts.slice(0, -1).map((c, i) => ({ start: i === 0 ? 0 : c - XF / 2, end: i === cuts.length - 2 ? TOTAL : cuts[i + 1] + XF / 2 }));
console.log(`footage: ${pieces.length} shots over ${TOTAL.toFixed(2)}s, cuts at ${cuts.slice(1, -1).join(', ')}`);

// 1b. no fixed shot list: pick from the approved library (data/footage_library.json). The mood runs night -> dusk ->
// day -> dusk -> night and always opens on a mosque at night; clips never repeat inside a Reel, and the starting point in
// each pool moves with the Khatm part (FOOTAGE_SEED) so consecutive Reels open on different clips.
if (!cfg.shots) {
  const lib = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'footage_library.json'), 'utf8'));
  const seed = Number(process.env.FOOTAGE_SEED || cfg.seed || 1);
  const ARC = ['mosqueN', 'skyN', 'dusk', 'mosqueN', 'dusk', 'day', 'mosqueD', 'day', 'dusk', 'skyN', 'mosqueN', 'dusk', 'skyN', 'mosqueN'];
  const pools = {};
  for (const c of lib.clips) (pools[c.pool] = pools[c.pool] || []).push(c);
  const used = new Set(), next = {};
  const pick = (pool) => {
    const list = pools[pool] || [];
    for (let k = 0; k < list.length; k++) {
      next[pool] = (next[pool] ?? (seed * 3) % list.length);
      const c = list[(next[pool] + k) % list.length];
      if (!used.has(c.id)) { used.add(c.id); next[pool] = (next[pool] + k + 1) % list.length; return c; }
    }
    return null;
  };
  // the last piece echoes the opening pool so the Reel ends where it began
  const arc = pieces.map((_, i) => (i === pieces.length - 1 && pieces.length > 2 ? 'mosqueN' : ARC[i % ARC.length]));
  cfg.shots = arc.map((pool, i) => {
    const c = pick(pool) || pick('dusk') || pick('skyN') || pick('day') || pick('mosqueD') || pick('mosqueN') || lib.clips[(seed + i) % lib.clips.length];
    return { src: lib.base + c.id + '-vertical.mp4', _what: c.what + ' [' + pool + ']', at: 0.3 + ((seed + i) % 3) };
  });
}
// 2. one segment per piece, taken from the shot list in order (wrapping if the Reel is longer than the list)
const segs = [];
const cache = {};
for (const [i, p] of pieces.entries()) {
  const s = cfg.shots[i % cfg.shots.length], len = p.end - p.start;
  if (!cache[s.src]) { cache[s.src] = path.join(work, `src_${Object.keys(cache).length}.mp4`); sh(`curl -sSL --fail -o "${cache[s.src]}" "${s.src}"`); }
  const src = cache[s.src];
  const full = Number(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${src}"`));
  if (full - (s.at || 0) < len) s.at = Math.max(0, full - len - 0.1);
  const avail = full - (s.at || 0) - 0.05;
  // a clip shorter than its piece is slowed (sky, water and silhouettes read well slower); never sped up
  const slow = Math.max(1, len / avail);
  if (slow > 2.5) throw new Error(`shot ${i} (${s._what}) is too short: ${avail.toFixed(2)}s for ${len.toFixed(2)}s`);
  const drift = (i % 2 ? 1 : -1) * 36;
  const seg = path.join(work, `seg_${i}.mp4`);
  ff(`-ss ${s.at || 0} -i "${src}" -an -vf "setpts=${slow.toFixed(4)}*PTS,scale=-2:${H + 110},` +
    `crop=${W}:${H}:x='(iw-${W})/2+${drift}*(t/${len.toFixed(3)}-0.5)':y='(ih-${H})/2+24*(t/${len.toFixed(3)}-0.5)',fps=${FPS},format=yuv420p,setsar=1" ` +
    `-t ${len.toFixed(3)} -c:v libx264 -crf 17 -preset veryfast "${seg}"`);
  segs.push(seg);
  console.log(`shot ${i}: ${s._what} ${len.toFixed(2)}s${slow > 1 ? ` (slowed x${slow.toFixed(2)})` : ''}`);
}

// 3. scrim behind the text area (same gradient as the 9 s cinematic tests)
const scrimHtml = path.join(work, 'scrim.html'), scrim = path.join(work, 'scrim.png');
const k = cfg.scrim || 1, al = (x) => Math.min(0.92, x * k).toFixed(2);
fs.writeFileSync(scrimHtml, `<html><body style="margin:0;width:${W}px;height:${H}px;background:linear-gradient(180deg,
  rgba(11,31,42,${al(0.20)}) 0px, rgba(11,31,42,${al(0.38)}) 280px, rgba(11,31,42,${al(0.55)}) 560px, rgba(11,31,42,${al(0.55)}) 1180px,
  rgba(11,31,42,${al(0.18)}) 1420px, rgba(11,31,42,0.0) 1650px, rgba(11,31,42,${al(0.35)}) 1920px)"></body></html>`);
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-'));
sh(`"${CHROME}" --headless --disable-gpu --hide-scrollbars --default-background-color=00000000 --window-size=${W},${H} --user-data-dir="${prof}" --screenshot="${scrim}" "file://${scrimHtml}" 2>&1 | tail -1`);

// 4. dissolves on the cuts, scrim on top, exact length
let chain = '', prev = '[0:v]';
for (let j = 1; j < segs.length; j++) { chain += `${prev}[${j}:v]xfade=transition=fade:duration=${XF}:offset=${(cuts[j] - XF / 2).toFixed(3)}[x${j}];`; prev = `[x${j}]`; }
chain += `${prev}[${segs.length}:v]overlay[bg]`;
ff(`${segs.map((s) => `-i "${s}"`).join(' ')} -i "${scrim}" -filter_complex "${chain}" -map "[bg]" -t ${TOTAL.toFixed(3)} -r ${FPS} -c:v libx264 -crf 17 -preset veryfast -pix_fmt yuv420p "${outPath}"`);
console.log(`footage background -> ${outPath}`);
