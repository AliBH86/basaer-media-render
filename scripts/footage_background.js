// FOOTAGE BACKGROUND (owner-approved 2026-10-10): real-footage background for render_reel.js (style 'footage') from the
// approved clip library data/footage_library.json (owner-picked Pexels clips, checked frame by frame: no people, no writing
// or calligraphy, no logos; stored on Cloudinary already 1080x1920 and brand-graded). Cuts land on ayah starts (and the
// Bismillah -> first ayah join); any piece longer than MAX_SHOT is split so no shot overstays. The mood runs night -> dusk ->
// day -> dusk -> night, opens and ends on a mosque at night, and never repeats a clip inside a Reel; FOOTAGE_SEED (set by
// render_reel.js from the passage) moves the starting point so consecutive Reels open on different clips. A navy scrim is
// baked in behind the text area so footage never fights the Arabic. Any failure here makes render_reel.js fall back to the
// procedural 'mist' background, so a Reel is always produced.
//
// Usage: FOOTAGE_SEED=<n> CHROME_BIN=... node scripts/footage_background.js <timeline.json> <out.mp4>
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const [, , tlPath, outPath] = process.argv;
// FOOTAGE_STYLE=energetic (owner, 2026-10-13: "more energetic, our reels feel cold"): short shots with a steady push-in,
// a warmer and brighter grade, a lighter scrim and quick white-flash cuts. Unset = the calm approved look.
const ENERGETIC = process.env.FOOTAGE_STYLE === 'energetic';
// FOOTAGE_STYLE=warm (Quran Reels sample, 2026-10-13): the calm identity kept (soft fades, same scrim), with a warmer
// grade, a slow push-in and ~5 s shots instead of 6.5 s.
const WARM = process.env.FOOTAGE_STYLE === 'warm';
const W = 1080, H = 1920, FPS = 30, XF = ENERGETIC ? 0.35 : 0.6, MAX_SHOT = Number(process.env.FOOTAGE_MAX_SHOT) || (ENERGETIC ? 3.4 : WARM ? 5 : 6.5); // FOOTAGE_MAX_SHOT: calmer, longer shots for a slow item
const CHROME = process.env.CHROME_BIN || 'google-chrome';
const cfg = { scrim: 1.15 };
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

// 1b. shots from the approved library (see the header).
{
  const lib = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'footage_library.json'), 'utf8'));
  const seed = Number(process.env.FOOTAGE_SEED || 1);
  // FOOTAGE_ARC (series Reels, 2026-10-11): a comma list of pools matching the words of that part; unset = the Khatm arc.
  const ARC = process.env.FOOTAGE_ARC ? process.env.FOOTAGE_ARC.split(',').map((p) => p.trim()).filter(Boolean) : ['mosqueN', 'skyN', 'dusk', 'mosqueN', 'dusk', 'day', 'mosqueD', 'day', 'dusk', 'skyN', 'mosqueN', 'dusk', 'skyN', 'mosqueN'];
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
  // the last piece echoes the opening pool so the Reel ends where it began (unless the arc names a pool for every shot)
  const echo = !process.env.FOOTAGE_ARC || ARC.length < pieces.length;
  const arc = pieces.map((_, i) => (echo && i === pieces.length - 1 && pieces.length > 2 ? (process.env.FOOTAGE_ARC ? ARC[0] : 'mosqueN') : ARC[i % ARC.length]));
  cfg.shots = arc.map((pool, i) => {
    // with FOOTAGE_ARC an emptied pool repeats its own clip rather than borrowing another pool's
    const c = pick(pool) || (process.env.FOOTAGE_ARC && pools[pool] ? pools[pool][0] : null) || pick('dusk') || pick('skyN') || pick('day') || pick('mosqueD') || pick('mosqueN') || lib.clips[(seed + i) % lib.clips.length];
    return { src: lib.base + c.id + '-vertical.mp4', _what: c.what + ' [' + pool + ']', at: 0.3 + ((seed + i) % 3) };
  });
}
// 2. one segment per piece
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
  // energetic: a steady push-in (every third shot pulls out), warmer and brighter; calm: the slow side drift
  const z = i % 3 === 2 ? `(1.16-0.14*t/${len.toFixed(3)})` : `(1.02+0.14*t/${len.toFixed(3)})`;
  const zw = `(1.02+0.08*t/${len.toFixed(3)})`;
  const move = ENERGETIC
    ? `scale=w='trunc(${W}*${z}/2)*2':h=-2:eval=frame,crop=${W}:${H}:(iw-${W})/2:(ih-${H})/2,eq=brightness=0.03:saturation=1.18:contrast=1.06,colorbalance=rs=0.06:gs=0.02:bs=-0.06:rm=0.05:bm=-0.04`
    : WARM
    ? `scale=w='trunc(${W}*${zw}/2)*2':h=-2:eval=frame,crop=${W}:${H}:(iw-${W})/2:(ih-${H})/2,eq=brightness=0.02:saturation=1.1:contrast=1.04,colorbalance=rs=0.05:gs=0.015:bs=-0.05:rm=0.04:bm=-0.03`
    : `scale=-2:${H + 110},crop=${W}:${H}:x='(iw-${W})/2+${drift}*(t/${len.toFixed(3)}-0.5)':y='(ih-${H})/2+24*(t/${len.toFixed(3)}-0.5)'`;
  ff(`-ss ${s.at || 0} -i "${src}" -an -vf "setpts=${slow.toFixed(4)}*PTS,${move},fps=${FPS},format=yuv420p,setsar=1" ` +
    `-t ${len.toFixed(3)} -c:v libx264 -crf 17 -preset veryfast "${seg}"`);
  segs.push(seg);
  console.log(`shot ${i}: ${s._what} ${len.toFixed(2)}s${slow > 1 ? ` (slowed x${slow.toFixed(2)})` : ''}`);
}

// 3. scrim behind the text area (same gradient as the 9 s cinematic tests)
const scrimHtml = path.join(work, 'scrim.html'), scrim = path.join(work, 'scrim.png');
const k = (cfg.scrim || 1) * (ENERGETIC ? 0.72 : 1), al = (x) => Math.min(0.92, x * k).toFixed(2);
fs.writeFileSync(scrimHtml, `<html><body style="margin:0;width:${W}px;height:${H}px;background:linear-gradient(180deg,
  rgba(11,31,42,${al(0.20)}) 0px, rgba(11,31,42,${al(0.38)}) 280px, rgba(11,31,42,${al(0.55)}) 560px, rgba(11,31,42,${al(0.55)}) 1180px,
  rgba(11,31,42,${al(0.18)}) 1420px, rgba(11,31,42,0.0) 1650px, rgba(11,31,42,${al(0.35)}) 1920px)"></body></html>`);
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-'));
sh(`"${CHROME}" --headless --disable-gpu --hide-scrollbars --default-background-color=00000000 --window-size=${W},${H} --user-data-dir="${prof}" --screenshot="${scrim}" "file://${scrimHtml}" 2>&1 | tail -1`);

// 4. dissolves on the cuts, scrim on top, exact length
let chain = '', prev = '[0:v]';
for (let j = 1; j < segs.length; j++) { chain += `${prev}[${j}:v]xfade=transition=${ENERGETIC ? 'fadewhite' : 'fade'}:duration=${XF}:offset=${(cuts[j] - XF / 2).toFixed(3)}[x${j}];`; prev = `[x${j}]`; }
chain += `${prev}[${segs.length}:v]overlay[bg]`;
ff(`${segs.map((s) => `-i "${s}"`).join(' ')} -i "${scrim}" -filter_complex "${chain}" -map "[bg]" -t ${TOTAL.toFixed(3)} -r ${FPS} -c:v libx264 -crf 17 -preset veryfast -pix_fmt yuv420p "${outPath}"`);
console.log(`footage background -> ${outPath}`);
