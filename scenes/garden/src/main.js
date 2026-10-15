// Basaer scene library: one 6 s take of a portrait paper-cut lightbox (background only: the Basaer text layer, voice
// and wave are laid on top by the render repo, so nothing here draws text). ?take=1..4 picks the framing and move.
import * as THREE from 'three';
import { Pipe } from './post.js';
import { build, DUR } from './scene.js';

const Q = new URLSearchParams(location.search), SSAA = +(Q.get('ssaa') || 2), TAKE = +(Q.get('take') || 1);
const W = 1080, H = 1920;
window.DUR = DUR;
window.EV = [];

// Built after the load event: painting the sheets and compiling shaders takes a while, and a top-level await would
// hold the page's load event past the capture tools' page-load timeout. READY waits 180 s.
(async () => {
  await new Promise((r) => (document.readyState === 'complete' ? setTimeout(r, 0) : addEventListener('load', () => setTimeout(r, 0), { once: true })));
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(SSAA); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const pipe = new Pipe(renderer, W, H, SSAA);
  const shot = await build(TAKE);
  window.render = async (t) => {
    shot.update(t);
    pipe.shot(shot.S.scene, shot.S.cam, shot.post(t), pipe.rtA);
    pipe.final({ ...shot.grade(t), mixB: 0, time: t });
  };
  await window.render(0);   // warm-up: the first draw compiles every shader and builds the shadow maps
  window.READY = true;
})();
