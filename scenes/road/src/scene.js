// S1 «The road to a lit house»: a night desert in a portrait lightbox; a road winds through paper dunes to one warm
// window far away; stars and a full moon burn through the sky. Patience, the journey, arriving.
// Units: metres, y up. Layers from z -.135 (sky) to 0 (front). Each take is 6 s and already moving at t = 0.
// Frame budget (render repo text layer): subject in the lower third, calm sky through the text band (y 290-1320 px).
import * as THREE from 'three';
import { sheet, skyPanel, moon, setMoon } from './paper.js';
import { stage, aim } from './stage.js';
import { seg, ss, eio, lerp, mulberry, vnoise, TAU } from './lib.js';

export const DUR = 6;
// a soft round sprite for points (square points look like pixels)
function dotTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }

const LW = .56, LH = .96;                          // wide sheets so lateral moves never show an edge
const HOUSE = { x: .085, y: -.118, z: -.1 };       // the one lit window: the subject of the scene

function cut(x, fn) { x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000'; fn(); x.fill(); x.restore(); }
// a dune band: a smooth ridge through the given points, filled down to the bottom of the sheet
function ridge(x, pts, col) {
  x.fillStyle = col; x.beginPath(); x.moveTo(-LW / 2, -LH / 2); x.lineTo(-LW / 2, pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; x.quadraticCurveTo(ax + (bx - ax) * .5, Math.max(ay, by) + .006, bx, by); }
  x.lineTo(LW / 2, -LH / 2); x.closePath(); x.fill();
}
// the road: a ribbon that narrows with distance, from (x0, y0, w0) to (x1, y1, w1) along a gentle S
function road(x, x0, y0, w0, x1, y1, w1, bend, col) {
  const N = 24, L = [], R = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, cx = lerp(x0, x1, u) + Math.sin(u * Math.PI * 1.6) * bend, cy = lerp(y0, y1, Math.pow(u, .85)), w = lerp(w0, w1, Math.pow(u, .7)) / 2;
    L.push([cx - w, cy]); R.push([cx + w, cy]);
  }
  x.fillStyle = col; x.beginPath(); x.moveTo(...L[0]); L.forEach((p) => x.lineTo(...p)); R.reverse().forEach((p) => x.lineTo(...p)); x.closePath(); x.fill();
}
// a plain Gulf house: flat roof with a low parapet, one door, the lit window (no domes, no symbols)
function house(x, g) {
  const { x: cx, y: by } = HOUSE, w = .05, h = .026, tw = .011, th = .044, tx = cx - w / 2 + .004;
  const win = [cx - .012, by + .009, .012, .009], door = [cx + .009, by, .007, .015];
  if (x) {
    x.fillStyle = '#1d2a55'; x.fillRect(cx - w / 2, by, w, h); x.fillRect(cx - w / 2 - .002, by + h, w + .004, .0028);   // walls, plain parapet
    x.fillRect(tx, by + h, tw, th - h);                                                   // the wind tower (barjeel)
    x.fillRect(tx - .0015, by + th, tw + .003, .0025);
    x.fillRect(cx + w / 2 - .004, by, .016, h * .62);                                    // a low annexe
    x.fillStyle = '#0f1736'; for (let i = 0; i < 3; i++) x.fillRect(tx + .0018 + i * .0028, by + h + .004, .0012, th - h - .009);   // tower slats
    x.fillStyle = '#ecb866'; x.fillRect(...win); x.fillStyle = '#a57a3e'; x.fillRect(...door);   // warm paper behind the openings
  }
  if (g) { g.fillStyle = '#fff'; g.fillRect(...win); g.globalAlpha = .5; g.fillRect(...door); g.globalAlpha = 1; }
}

export async function build(take = 1) {
  const S = stage({ light: [HOUSE.x, HOUSE.y + .02, -.12], lightR: .22, lightCol: '#ffc77e', key: 1.15, amb: .32, ambCol: '#7d8fc0',
    keyCol: '#d9e0ff', keyPos: [-.05, .34, .3], keyTarget: [0, -.1, -.09], keyAngle: .9, fov: 34 });
  S.cam.aspect = 9 / 16; S.cam.updateProjectionMatrix();
  const { U } = S;

  // sky: deep navy to a warm horizon haze, cut-hole stars above the text band, a full moon in the top corner
  S.add(skyPanel({ w: LW, h: LH * 1.4, y: .19, z: -.135, stops: [[0, '#05091c'], [.45, '#0b1638'], [.66, '#16255a'], [.73, '#3a3f6e'], [.78, '#0b1638'], [1, '#060a20']], stars: 0 }));
  const moonG = S.add(moon({ x: -.12, y: .325, z: -.13, r: .022, gain: 1.9, halo: 6, haloGain: .32 }));

  // twinkling stars: additive points, brightness driven by t (deterministic)
  const R = mulberry(21), N = 230, pos = new Float32Array(N * 3), seeds = [];
  for (let i = 0; i < N; i++) {
    const px = (R() - .5) * LW, py = -.06 + R() * .56;
    pos.set([px, py, -.1335], i * 3); seeds.push([R() * 40, .4 + R() * .9, .25 + R() * R() * .9]);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const scol = new Float32Array(N * 3); sg.setAttribute('color', new THREE.BufferAttribute(scol, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ map: dotTex(), size: 7.0, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  S.add(stars);

  // far dunes (pale, translucent), with the house standing on the crest
  const far = S.add(sheet({ U, w: LW, h: LH, z: -.115, trans: .85, draw: (x) => ridge(x, [[-.28, -.112], [-.17, -.098], [-.05, -.118], [.05, -.11], [.16, -.124], [.28, -.104]], '#4d6298') }));
  const houseL = S.add(sheet({ U, w: LW, h: LH, z: HOUSE.z, trans: .3, glow: 2.6, glowCol: '#ffbf6a', draw: (x) => {
    house(x); x.fillStyle = '#1d2a55'; ridge(x, [[-.28, -.14], [-.1, -.13], [.04, -.123], [.12, -.12], [.28, -.135]], '#1d2a55');
  }, glowDraw: (g) => { g.fillStyle = '#000'; g.fillRect(-LW / 2, -LH / 2, LW, LH); house(null, g); } }));
  // mid dunes and the far end of the road climbing to the house
  const mid = S.add(sheet({ U, w: LW, h: LH, z: -.08, trans: .45, draw: (x) => {
    ridge(x, [[-.28, -.16], [-.16, -.146], [-.02, -.165], [.1, -.152], [.28, -.17]], '#2b3b6e');
    road(x, .02, -.2, .05, .075, -.152, .006, .02, '#53648f');
  } }));
  // near dunes with the road sweeping through them
  const near = S.add(sheet({ U, w: LW, h: LH, z: -.045, trans: .16, draw: (x) => {
    ridge(x, [[-.28, -.205], [-.18, -.19], [-.06, -.214], [.06, -.198], [.18, -.222], [.28, -.205]], '#151d42');
    road(x, -.04, -.36, .2, .02, -.198, .05, -.035, '#3a4878');
  } }));
  // front: a dark lip of sand and dry grass at the very bottom
  const front = S.add(sheet({ U, w: LW, h: LH, z: -.012, trans: .04, draw: (x) => {
    ridge(x, [[-.28, -.3], [-.12, -.315], [0, -.328], [.13, -.312], [.28, -.296]], '#070b1e');
    const Rg = mulberry(8); x.fillStyle = '#070b1e';
    for (const [cx, n] of [[-.19, 11], [.2, 9], [-.07, 5]]) for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + (Rg() - .5) * 1.2, L = .02 + Rg() * .035, bx = cx + (Rg() - .5) * .03, by = -.312;
      x.beginPath(); x.moveTo(bx - .0025, by); x.quadraticCurveTo(bx + Math.cos(a) * L * .4, by + Math.sin(a) * L * .6, bx + Math.cos(a) * L, by + Math.sin(a) * L); x.lineTo(bx + .0025, by); x.fill();
    }
  } }));
  const layers = [far, houseL, mid, near, front];
  layers.forEach((m) => { m.userData.trans0 = m.material.userData.u.uTrans.value; });

  // the four takes: camera position and target over the 6 s (house kept around 1450 px from the top)
  const CAM = {
    1: (u) => [0, .045, 1.0, .02, .045, -.09],                                                    // wide, locked
    2: (u) => { const x = lerp(-.07, .07, u); return [x, .04, .98, x * .6, .04, -.09]; },         // lateral track, parallax
    3: (u) => { const y = lerp(.115, .025, eio(u)); return [0, y, 1.0, .02, y, -.09]; },            // tilt down: sky to road
    4: (u) => { const e = eio(u); return [lerp(.02, .05, e), lerp(.045, .005, e), lerp(1.0, .74, e), lerp(.03, HOUSE.x * .7, e), lerp(.045, .005, e), -.1]; }, // dolly in on the house
  }[take] || ((u) => [0, .045, 1.0, .02, .045, -.09]);

  return {
    S,
    update(t) {
      const u = t / DUR;
      // the lamp is on from the first frame; the window breathes, the moon's halo too
      U.uLit.value = 1;
      layers.forEach((m) => { m.material.userData.u.uTrans.value = m.userData.trans0; });
      houseL.material.userData.u.uGlowLit.value = 1.6 * (take === 4 ? 1 + .35 * ss(u) : 1) * (1 + .07 * Math.sin(t * 6.3) * Math.sin(t * 2.9));
      setMoon(moonG, .95 + .05 * Math.sin(t * 1.3));
      for (let i = 0; i < N; i++) {
        const [ph, sp, a] = seeds[i], k = a * (.55 + .45 * Math.sin(ph + t * sp * 2.4)) * (.8 + .2 * vnoise(ph + t * .7));
        scol[i * 3] = k; scol[i * 3 + 1] = k * .96; scol[i * 3 + 2] = k * .86;
      }
      sg.attributes.color.needsUpdate = true;
      aim(S.cam, CAM(u), t, { hand: .0007 });
    },
    post() { return { focus: S.cam.position.z - HOUSE.z, aper: 16, maxCoc: 12, bloom: { strength: .4, radius: .6, threshold: 1.1 } }; },
    grade() { return { expo: 1.06, vig: .4, sat: 1.05, contrast: .1 }; },
  };
}
