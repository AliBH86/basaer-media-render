// S3 «Sunburst dawn» (Art Deco): warm navy lacquer, engraved gold lines on the centre axis, a stepped arch crowning the
// header area, a sun rising behind stepped terraces in the lower third, rays drawing themselves up and fading before the
// text band. Hope, dua, a new beginning. Background only (no text). ?take=1..4, 6 s each, already moving at t = 0.
// Canvas2D, deterministic in t. Frame budget: text band y 290-1320 px stays calm (rays fade, only faint sparkles).
import * as D from './engine/deco.js';

const Q = new URLSearchParams(location.search), TAKE = +(Q.get('take') || 1);
const W = 1080, H = 1920, CX = W / 2, DUR = 6;
const NAVY0 = '#070d24', NAVY1 = '#0f1c46', NAVY2 = '#1b2558', SUN = '#ffcf7a';
window.DUR = DUR; window.EV = [];
const g = document.getElementById('c').getContext('2d');
const { seg, ss, eio, lerp, mulberry, TAU } = D;

// stars: four-point sparkles, most above the header, a few faint ones low in the band
const R = mulberry(12), STARS = [];
for (let i = 0; i < 46; i++) { const top = i < 30; STARS.push({ x: 90 + R() * 900, y: top ? 40 + R() * 230 : 300 + R() * 900, r: top ? 7 + R() * 12 : 4 + R() * 6, ph: R() * TAU, sp: .6 + R() * 1.4, a: top ? .7 + R() * .3 : .18 + R() * .18 }); }

// the stepped terraces in front of the sun (setbacks, no domes or towers): [halfWidth, topY]
const TERR = [[540, 1792], [430, 1752], [300, 1716], [190, 1690]];
function terraces(sheen) {
  for (let i = 0; i < TERR.length; i++) {
    const [hw, y] = TERR[i], pts = [[CX - hw, H + 4], [CX - hw, y], [CX + hw, y], [CX + hw, H + 4]];
    D.airbrush(g, pts, { base: D.mix(NAVY0, '#1d2a5e', .25 + i * .18), dir: -Math.PI / 2, rim: 2.2, rimColor: D.C.gold2 });
    D.gline(g, [[CX - hw, H + 4], [CX - hw, y], [CX + hw, y], [CX + hw, H + 4]], { w: 2.2, sheen });
  }
}
function sunDisc(cy, k) {
  D.glow(g, CX, cy, 520, '#ffb85c', .32 * k);
  const gr = g.createRadialGradient(CX - 30, cy - 40, 10, CX, cy, 175);
  gr.addColorStop(0, '#fff4d8'); gr.addColorStop(.55, SUN); gr.addColorStop(1, '#e89a4a');
  g.save(); g.globalAlpha = k; g.fillStyle = gr; g.beginPath(); g.arc(CX, cy, 175, 0, TAU); g.fill(); g.restore();
  D.gline(g, D.arcPts(CX, cy, 192, Math.PI, TAU, 64), { w: 2.4, sheen: .5 });
  D.gline(g, D.arcPts(CX, cy, 214, Math.PI, TAU, 64), { w: 1.4, sheen: .6 });
}
// rays from the sun centre, fading out before the text band (masked by a vertical fade)
function rays(cy, part, rot, sheen) {
  const tmp = rays.c || (rays.c = Object.assign(document.createElement('canvas'), { width: W, height: H })), t = tmp.getContext('2d');
  t.clearRect(0, 0, W, H);
  D.sunburst(t, CX, cy, { rays: 34, r0: 240, r1: 900, a0: Math.PI * 1.06, a1: Math.PI * 1.94, rot, part, mode: 'both', w: 5, sheen, colorA: 'rgba(201,162,75,.07)' });
  t.globalCompositeOperation = 'destination-in';
  const f = t.createLinearGradient(0, 1050, 0, 1520); f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,1)');
  t.fillStyle = f; t.fillRect(0, 0, W, H); t.globalCompositeOperation = 'source-over';
  g.drawImage(tmp, 0, 0);
}

function frieze(p, sheen) {
  const y = 262, a = D.eio(p);
  for (const s of [-1, 1]) {                                                          // margin rules, drawn upward
    const x = CX + s * 498, top = lerp(H, y, a);
    D.gline(g, [[x, H], [x, top]], { w: 2.2, sheen, glow: .35 }); D.gline(g, [[x - s * 12, H], [x - s * 12, lerp(H, y + 12, a)]], { w: 1.2, sheen });
  }
  const half = 498 * a;                                                               // the frieze rules open from the axis
  D.gline(g, [[CX - half, y], [CX + half, y]], { w: 2.4, sheen, glow: .35 }); D.gline(g, [[CX - half * .97, y - 12], [CX + half * .97, y - 12]], { w: 1.2, sheen });
  D.fan(g, CX, y - 12, 150, { open: a, ribs: 11, fill: '#6a5020' });
  D.sunburst(g, CX, y - 12, { rays: 22, r0: 158, r1: 158 + 70 * a, a0: Math.PI * 1.02, a1: Math.PI * 1.98, mode: 'lines', w: 2, sheen, alpha: .8 });
}

window.render = async (t) => {
  const u = t / DUR;
  // ground: lacquer navy with a warm lift at the horizon
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, NAVY0); bg.addColorStop(.45, NAVY1); bg.addColorStop(.78, NAVY2); bg.addColorStop(.9, '#3a2d5a'); bg.addColorStop(1, '#1a1838');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);

  // per-take motion (all continuous over the 6 s)
  const rayPart = TAKE === 1 ? lerp(.3, 1, eio(seg(u, 0, .85))) : 1;
  const archPart = TAKE === 2 ? lerp(.2, 1, eio(seg(u, 0, .9))) : 1;
  const sunY = TAKE === 3 ? lerp(1785, 1700, eio(u)) : 1712;
  const sheen = TAKE === 4 ? lerp(-.2, 1.2, u) : .4 + .08 * Math.sin(t * .7);
  const rot = (TAKE === 3 ? .05 : .02) * Math.sin(t * .35);
  const zoom = TAKE === 3 ? lerp(1, 1.05, eio(u)) : TAKE === 4 ? 1 + .012 * Math.sin(t * .6) : 1;

  g.save(); g.translate(CX, H); g.scale(zoom, zoom); g.translate(-CX, -H);
  // stars (twinkle)
  for (const s of STARS) { const k = s.a * (.55 + .45 * Math.sin(s.ph + t * s.sp * 2)); D.sparkle(g, s.x, s.y, s.r * (.85 + .15 * Math.sin(s.ph + t)), { alpha: k, rot: .2 * Math.sin(s.ph + t * .3) }); }
  // a Deco frieze above the header (gold rules, an opening fan) and double rules down the outer margins only
  frieze(archPart, sheen);
  rays(sunY, rayPart, rot, sheen);
  sunDisc(sunY, 1);
  terraces(sheen);
  g.restore();
  D.vignette(g, W, H, .42);
};
window.READY = true;
