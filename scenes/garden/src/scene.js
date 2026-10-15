// S2 «The courtyard garden»: a Gulf courtyard at blue hour in a portrait lightbox; an arcade with warm-lit openings,
// palms behind the wall, a water channel catching gold glints, specks of light drifting down. Mercy, rest, reward.
// Units: metres, y up. Layers from z -.135 (sky) to 0 (front). Each take is 6 s and already moving at t = 0.
// Frame budget (render repo text layer): subject in the lower third, calm sky through the text band (y 290-1320 px).
import * as THREE from 'three';
import { sheet, skyPanel } from './paper.js';
import { stage, aim } from './stage.js';
import { seg, ss, eio, lerp, mulberry, vnoise, TAU } from './lib.js';

export const DUR = 6;
// a soft round sprite for points (square points look like pixels)
function dotTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }

const LW = .56, LH = .96;
const WALL_TOP = -.095, FLOOR = -.24;              // arcade top and the courtyard floor line behind the water

function cut(x, fn) { x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000'; fn(); x.fill(); x.restore(); }
// pointed arch (architecture only), closed path
function arch(x, cx, y0, w, hs, ha) {
  const l = cx - w / 2, r = cx + w / 2, s = y0 + hs, top = s + ha;
  x.beginPath(); x.moveTo(l, y0); x.lineTo(l, s); x.quadraticCurveTo(l, s + ha * .72, cx, top); x.quadraticCurveTo(r, s + ha * .72, r, s); x.lineTo(r, y0); x.closePath();
}
const ARCHES = [-.2, -.1, 0, .1, .2].map((cx) => [cx, FLOOR + .002, .052, .07, .03]);
function palm(x, cx, by, h, lean, seed, fronds = 11) {
  const R = mulberry(seed), tx = cx + lean, ty = by + h;
  x.beginPath(); x.moveTo(cx - .005, by); x.quadraticCurveTo(cx + lean * .4, by + h * .5, tx - .002, ty); x.lineTo(tx + .002, ty);
  x.quadraticCurveTo(cx + lean * .4 + .005, by + h * .5, cx + .005, by); x.closePath(); x.fill();
  for (let i = 0; i < fronds; i++) {
    const a = -.25 + (i / (fronds - 1)) * (Math.PI + .5) + (R() - .5) * .2, L = .045 + R() * .03, ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * .55 - L * .3;
    x.beginPath(); x.moveTo(tx, ty); x.quadraticCurveTo(tx + Math.cos(a) * L * .5, ty + Math.sin(a) * L * .5 + .006, ex, ey);
    x.quadraticCurveTo(tx + Math.cos(a) * L * .5, ty + Math.sin(a) * L * .5 - .001, tx, ty - .003); x.fill();
  }
}
// a hanging frond entering from a top corner: a curved rib with leaflets on both sides
function frond(x, x0, y0, x1, y1, bend, n, len) {
  const P = (u) => [lerp(x0, x1, u) + Math.sin(u * Math.PI) * bend, lerp(y0, y1, u) - Math.sin(u * Math.PI) * bend * .3];
  x.lineWidth = .0025; x.beginPath(); for (let i = 0; i <= 20; i++) { const [px, py] = P(i / 20); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
  for (let i = 1; i < n; i++) {
    const u = i / n, [px, py] = P(u), [qx, qy] = P(Math.min(1, u + .02)), a = Math.atan2(qy - py, qx - px), L = len * (1 - u * .6);
    for (const s of [-1, 1]) {
      const b = a + s * 1.15 + .35, ex = px + Math.cos(b) * L, ey = py + Math.sin(b) * L - L * .35;
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(b) * L * .5, py + Math.sin(b) * L * .5 + .002, ex, ey); x.lineTo(px + .0012, py - .0012); x.fill();
    }
  }
}

export async function build(take = 1) {
  const S = stage({ light: [0, -.15, -.12], lightR: .21, lightCol: '#ffc878', key: 1.05, amb: .32, ambCol: '#8193c6',
    keyCol: '#dfe4ff', keyPos: [.04, .34, .3], keyTarget: [0, -.12, -.09], keyAngle: .9, fov: 34 });
  S.cam.aspect = 9 / 16; S.cam.updateProjectionMatrix();
  const { U } = S;

  // blue-hour sky, warmer and lighter toward the horizon above the arcade
  S.add(skyPanel({ w: LW, h: LH * 1.4, y: .19, z: -.135, stops: [[0, '#081230'], [.4, '#0f2148'], [.62, '#1b3266'], [.71, '#4a4f86'], [.76, '#2b3c70'], [1, '#0c1838']], stars: 60, starMinY: .05, seed: 4 }));

  // palms rising behind the wall
  const palms = S.add(sheet({ U, w: LW, h: LH, z: -.12, trans: .7, draw: (x) => {
    x.fillStyle = '#34497f'; palm(x, -.17, -.2, .17, -.015, 3); palm(x, -.12, -.2, .12, .02, 5, 9); palm(x, .15, -.2, .19, .012, 7); palm(x, .21, -.2, .11, -.01, 9, 9);
  } }));
  // the arcade wall: five pointed openings, warm light inside them
  const glowArches = (g) => { g.fillStyle = '#fff'; ARCHES.forEach((a) => { arch(g, ...a); g.fill(); }); };
  const wall = S.add(sheet({ U, w: LW, h: LH, z: -.105, trans: .26, glow: 1.6, glowCol: '#ffbe6c', draw: (x) => {
    x.fillStyle = '#3d5089'; x.fillRect(-LW / 2, -LH / 2, LW, WALL_TOP + LH / 2);
    x.fillStyle = '#4a5e98'; x.fillRect(-LW / 2, WALL_TOP, LW, .004);                               // parapet lip
    x.fillRect(-LW / 2, WALL_TOP + .004, LW, .005);                                               // a smooth parapet band
    x.fillStyle = '#e8b56a'; ARCHES.forEach((a) => { arch(x, ...a); x.fill(); });                // lit openings (warm paper)
    x.fillStyle = '#c9934d'; ARCHES.forEach(([cx]) => x.fillRect(cx - .026, FLOOR + .002, .052, .012));   // a lit floor inside
  }, glowDraw: (g) => { g.fillStyle = '#000'; g.fillRect(-LW / 2, -LH / 2, LW, LH); glowArches(g); } }));
  // the courtyard floor and the water channel running toward the middle arch
  const water = (x, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(-.075, -LH / 2); x.lineTo(-.012, FLOOR - .004); x.lineTo(.012, FLOOR - .004); x.lineTo(.075, -LH / 2); x.closePath(); x.fill(); };
  const floor = S.add(sheet({ U, w: LW, h: LH, z: -.085, trans: .2, glow: 1.3, glowCol: '#ffd18a', draw: (x) => {
    x.fillStyle = '#22325f'; x.fillRect(-LW / 2, -LH / 2, LW, FLOOR + LH / 2);
    water(x, '#6f86bd');
  }, glowDraw: (g) => {
    g.fillStyle = '#000'; g.fillRect(-LW / 2, -LH / 2, LW, LH);
    const R = mulberry(17); g.fillStyle = '#fff';
    for (let i = 0; i < 60; i++) { const v = R(), y = lerp(FLOOR - .01, -.42, v * v), hw = lerp(.012, .07, v * v) * .8, x0 = (R() - .5) * 2 * hw, w = .004 + R() * .016 * (.4 + v); g.globalAlpha = .35 + R() * .5; g.fillRect(x0 - w / 2, y, w, .0012 + v * .0016); }
    g.globalAlpha = 1;
  } }));
  // near: two planter walls framing the water, low shrubs
  const near = S.add(sheet({ U, w: LW, h: LH, z: -.05, trans: .06, draw: (x) => {
    x.fillStyle = '#18244f';
    for (const s of [-1, 1]) {
      x.beginPath(); x.moveTo(s * LW / 2, -LH / 2); x.lineTo(s * .1, -LH / 2); x.lineTo(s * .1, -.3); x.lineTo(s * LW / 2, -.27); x.closePath(); x.fill();
      const R = mulberry(s > 0 ? 31 : 33);
      for (let i = 0; i < 9; i++) { const cx = s * (.14 + R() * .12), r = .016 + R() * .02; x.beginPath(); x.arc(cx, -.285 + R() * .012, r, 0, TAU); x.fill(); }
    }
  } }));
  // front: palm fronds hanging in from the top corners (frame the header) and a dark lip at the bottom
  const front = S.add(sheet({ U, w: LW, h: LH * 1.25, y: .06, z: -.02, trans: .05, draw: (x) => {
    x.fillStyle = x.strokeStyle = '#0a1028';
    frond(x, -.29, .44, -.06, .3, .03, 18, .05); frond(x, -.29, .36, -.1, .22, .02, 14, .04);
    frond(x, .29, .45, .05, .32, -.03, 18, .05); frond(x, .29, .38, .12, .25, -.02, 13, .04);
    x.fillRect(-LW / 2, -.6, LW, .26);
  } }));
  const layers = [palms, wall, floor, near, front];
  layers.forEach((m) => { m.userData.trans0 = m.material.userData.u.uTrans.value; });

  // specks of light drifting down through the whole stack (deterministic in t)
  const R = mulberry(77), N = 190, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), P = [];
  for (let i = 0; i < N; i++) P.push({ x: (R() - .5) * LW * .9, y0: R(), z: lerp(-.125, -.03, R()), sp: .012 + R() * .02, sw: R() * TAU, a: .35 + R() * .65 });
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const specks = new THREE.Points(pg, new THREE.PointsMaterial({ map: dotTex(), size: 13.2, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  S.add(specks);

  const CAM = {
    1: (u) => [0, .03, 1.0, 0, .03, -.09],                                                                 // frontal, locked
    2: (u) => [0, -.012, .86, 0, -.012, -.09],                                                               // rack focus front → far
    3: (u) => { const y = lerp(-.015, .06, eio(u)); return [0, y, .9, 0, y, -.09]; },                        // tilt up: water → sky
    4: (u) => { const e = eio(u); return [0, lerp(-.01, .035, e), lerp(.8, 1.02, e), 0, lerp(-.01, .035, e), -.09]; },   // dolly out
  }[take] || ((u) => [0, .03, 1.0, 0, .03, -.09]);
  let focusZ = -.105;

  return {
    S,
    update(t) {
      const u = t / DUR;
      U.uLit.value = 1;
      layers.forEach((m) => { m.material.userData.u.uTrans.value = m.userData.trans0; });
      wall.material.userData.u.uGlowLit.value = 1.35 * (1 + .05 * Math.sin(t * 5.7) * Math.sin(t * 2.3));
      floor.material.userData.u.uGlowLit.value = .55 + .45 * vnoise(t * 2.2) ;       // water shimmer
      const top = .5, bot = -.42, span = top - bot;
      P.forEach((p, i) => {
        const y = top - ((p.y0 * span + p.sp * (t + 3)) % span), x = p.x + Math.sin(p.sw + t * .8 + y * 9) * .006;
        pos.set([x, y, p.z], i * 3);
        const k = p.a * (.7 + .3 * Math.sin(p.sw * 3 + t * 2.1));
        col.set([k, k * .86, k * .6], i * 3);
      });
      pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true;
      aim(S.cam, CAM(u), t, { hand: .0007 });
      focusZ = take === 2 ? lerp(-.03, -.105, ss(seg(u, .15, .85))) : -.1;
    },
    post() { return { focus: S.cam.position.z - focusZ, aper: take === 2 ? 22 : 16, maxCoc: 14, bloom: { strength: .42, radius: .6, threshold: 1.1 } }; },
    grade() { return { expo: 1.07, vig: .4, sat: 1.06, contrast: .1, lift: [.006, .004, .016] }; },
  };
}
