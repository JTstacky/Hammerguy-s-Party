// The Clean-up Crew (#5): the blight (a ragged violet stain that shrinks as
// priests dispel it and spreads where ghouls fall), the four human priests,
// and the players' Ghoul skin.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { fxTexture } from '../../engine/client/render/effects.js';
import { registerView, registerEvent, registerSkin } from '../../engine/client/render/registry.js';
import { dispelEffect, telegraph, emit, ball, glowMat, bakeParts } from './dispel-fx.js';

// Painted robe cloth: cream linen with soft vertical folds and a woven grain.
let robeMaterial = null;
function robeMat() {
  if (robeMaterial) return robeMaterial;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const u = x / 256;
      const fold = 0.82 + 0.18 * Math.sin(u * Math.PI * 2 * 7 + Math.sin(y / 40) * 0.8) * Math.sin(u * Math.PI * 2 * 3 + 1.3);
      const weave = ((x + y) % 4 < 2 ? 0.98 : 1.02) * (0.96 + Math.random() * 0.08);
      const k = fold * weave;
      const i = (y * 256 + x) * 4;
      img.data[i] = Math.min(255, 240 * k);
      img.data[i + 1] = Math.min(255, 232 * k);
      img.data[i + 2] = Math.min(255, 212 * k);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  robeMaterial = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0 });
  return robeMaterial;
}

// A human priest (`hmpr`): white robes with gold trim and a stole in team
// colour, a hood over a bearded face, and a staff crowned with a glowing
// crystal held forward. The Clean-up Crew's priests belong to Player 12, whose
// colour is brown; as the players' unit in the Skeleton Sonata the stole takes
// their colour.
export function priest(color = '#7a4a1c') {
  const { mesh, lathe, tube, mat } = M;
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const robe = robeMat();
  const robeDark = mat('#c8c0ae', { roughness: 0.9, side: THREE.DoubleSide });
  const team = mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  const gold = M.goldMat();
  const skin = mat('#e8c098', { roughness: 0.7 });
  body.add(mesh(lathe([[0.5, 0], [0.47, 0.12], [0.36, 0.55], [0.28, 0.9], [0.3, 1.1], [0.26, 1.24], [0.14, 1.32], [0.01, 1.34]], 18), robe));
  body.add(mesh(new THREE.TorusGeometry(0.44, 0.03, 6, 24).rotateX(Math.PI / 2), gold, 0, 0.2, 0));
  // The stole hangs down the front.
  const stole = mesh(M.cloth(0.2, 0.9, 0.04), team, 0.3, 0.72, 0);
  stole.rotation.y = Math.PI;
  body.add(stole);
  body.add(mesh(new THREE.TorusGeometry(0.29, 0.03, 6, 20).rotateX(Math.PI / 2), gold, 0, 0.9, 0));
  body.add(mesh(M.cloth(0.62, 1.05, 0.2, 0.18), robeDark, -0.22, 0.75, 0));
  // Head: face, beard, hood with a gold rim.
  body.add(mesh(ball(0.15), skin, 0.06, 1.46, 0));
  body.add(mesh(M.blob(0.1, 0.12, 0.12, { seed: 101, detail: 2 }), mat('#9a8a7a'), 0.14, 1.36, 0));
  body.add(mesh(lathe([[0.2, 1.3], [0.22, 1.45], [0.19, 1.6], [0.1, 1.72], [0.01, 1.76]], 16), robe, -0.04, 0, 0));
  const hoodRim = mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 18), gold, 0.13, 1.5, 0);
  hoodRim.rotation.y = Math.PI / 2;
  body.add(hoodRim);
  for (const s of [1, -1]) {
    body.add(mesh(tube([[0, 1.18, 0.26 * s], [0.12, 0.95, 0.32 * s], [0.28, 0.82, 0.24 * s]], 0.09, 0.11, 8, 8), robe));
    body.add(mesh(ball(0.065), skin, 0.3, 0.8, 0.23 * s));
  }
  // The staff, held out in front.
  const staff = new THREE.Group();
  staff.position.set(0.32, 0.8, -0.25);
  staff.add(mesh(tube([[0, -0.8, 0], [0.01, 0.2, 0], [0, 1.05, 0]], 0.035, 0.03, 6, 8), M.texMat('tex_wood.webp', '#6a4a2a', '#c8a888')));
  staff.add(mesh(lathe([[0.02, 0.95], [0.08, 1.02], [0.06, 1.1], [0.1, 1.2], [0.01, 1.22]], 10), gold));
  const crystal = mesh(new THREE.OctahedronGeometry(0.11, 0), glowMat('#bfe8ff'), 0, 1.33, 0);
  crystal.scale.y = 1.6;
  staff.add(crystal);
  body.add(staff);
  body.scale.setScalar(1.35);
  g.userData = { body, staff, crystal, kind: 'hero' };
  return g;
}

// The Ghoul (`ugho`): a hunched, emaciated undead with grey-green skin, a
// knobbled spine and ribs showing, a lipless jaw full of fangs, pale yellow
// eyes, and long arms that end in hooked claws. Team colour on the loincloth
// and the rag tied round one arm.
export function ghoul(color) {
  const { mesh, blob, tube, mat } = M;
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(1.3);
  g.add(body);
  const skin = M.triMat('tex_hide.webp', '#8a9a80', '#c8d4b8', 2.2, { roughness: 0.7 });
  const skinDark = mat('#5e6e58', { roughness: 0.75 });
  const bone = mat('#e8dcc0', { roughness: 0.5 });
  const team = mat(color, { roughness: 0.85, side: THREE.DoubleSide });
  const dark = mat('#1a0808', { roughness: 0.4 });
  const eye = glowMat('#e8f070');

  // Bent, digitigrade legs with clawed feet.
  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(-0.08, 0.55, 0.14 * s);
    hip.add(mesh(tube([[0, 0, 0], [0.16, -0.2, 0.02 * s], [0.02, -0.38, 0.02 * s], [0.06, -0.52, 0.02 * s]], 0.08, 0.05, 8, 8), skin));
    hip.add(mesh(blob(0.1, 0.04, 0.07, { seed: 211, detail: 1 }), skinDark, 0.12, -0.53, 0.02 * s));
    for (const z of [-0.04, 0, 0.04]) hip.add(mesh(tube([[0.18, -0.54, (0.02 + z) * s], [0.25, -0.54, (0.02 + z * 1.4) * s]], 0.018, 0.004, 2, 5), bone));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  // Hunched torso: pelvis, a spine curving up and forward, ribs, shoulder blades.
  body.add(mesh(blob(0.18, 0.13, 0.2, { seed: 212, detail: 2 }), skin, -0.06, 0.62, 0));
  const chest = mesh(blob(0.26, 0.2, 0.25, { seed: 213, amt: 0.08, detail: 2 }), skin, 0.12, 0.98, 0);
  chest.rotation.z = -0.6;
  body.add(chest);
  body.add(mesh(tube([[-0.08, 0.66, 0], [0.0, 0.84, 0], [0.1, 1.04, 0], [0.26, 1.14, 0]], 0.1, 0.09, 8, 8), skin));
  for (let i = 0; i < 5; i++) body.add(mesh(ball(0.045, 0.035, 0.04), bone, -0.08 + i * 0.07, 0.9 + i * 0.06 - (i > 2 ? (i - 2) * 0.04 : 0), 0));
  for (let i = 0; i < 3; i++) {
    const rib = mesh(new THREE.TorusGeometry(0.2 - i * 0.02, 0.018, 5, 14, Math.PI * 1.3), bone, 0.2 + i * 0.05, 0.92 - i * 0.07, 0);
    rib.rotation.set(Math.PI / 2, -0.6, Math.PI * 0.85);
    body.add(rib);
  }
  // Team loincloth and rope belt.
  const loin = mesh(M.cloth(0.26, 0.34, 0.03, -0.02), team, 0.12, 0.5, 0);
  loin.rotation.y = Math.PI;
  body.add(loin, mesh(M.cloth(0.26, 0.3, 0.03, 0.05), team, -0.18, 0.52, 0));
  const belt = mesh(new THREE.TorusGeometry(0.17, 0.025, 5, 16).rotateX(Math.PI / 2), mat('#6a5038', { roughness: 0.9 }), -0.03, 0.66, 0);
  belt.scale.z = 1.2;
  body.add(belt);
  // Head thrust forward below the shoulders.
  const head = new THREE.Group();
  head.position.set(0.4, 1.12, 0);
  head.add(mesh(blob(0.15, 0.13, 0.13, { seed: 214, amt: 0.08, detail: 2 }), skin, 0, 0.02, 0));
  head.add(mesh(blob(0.14, 0.05, 0.1, { seed: 215, detail: 1 }), skinDark, 0.06, -0.1, 0));
  head.add(mesh(ball(0.1, 0.03, 0.08), dark, 0.1, -0.05, 0));
  for (const s of [1, -1]) {
    head.add(mesh(ball(0.028), eye, 0.13, 0.05, 0.055 * s));
    for (const x of [0.12, 0.17]) {
      const fang = mesh(new THREE.ConeGeometry(0.014, 0.06, 5), bone, x, -0.05, 0.04 * s);
      fang.rotation.z = Math.PI;
      head.add(fang);
    }
    head.add(mesh(tube([[-0.04, 0.08, 0.1 * s], [-0.12, 0.14, 0.16 * s]], 0.035, 0.005, 3, 5), skin));
  }
  head.add(mesh(ball(0.06, 0.03, 0.08), mat('#2a2420', { roughness: 0.95 }), -0.06, 0.13, 0));
  body.add(head);
  // Long arms reaching forward and down, with three hooked claws each; the
  // right one is the "staff" the attack animation swings.
  const arm = (s) => {
    const a = new THREE.Group();
    a.position.set(0.22, 1.1, 0.22 * s);
    a.add(mesh(tube([[0, 0, 0], [0.1, -0.22, 0.08 * s], [0.3, -0.42, 0.06 * s], [0.46, -0.5, 0.02 * s]], 0.065, 0.045, 10, 8), skin));
    a.add(mesh(ball(0.06, 0.05, 0.06), skinDark, 0.47, -0.5, 0.02 * s));
    for (const z of [-0.05, 0, 0.05]) a.add(mesh(tube([[0.5, -0.5, (0.02 + z) * s], [0.62, -0.52, (0.02 + z * 1.3) * s], [0.66, -0.62, (0.02 + z * 1.5) * s]], 0.022, 0.004, 5, 5), bone));
    if (s > 0) a.add(mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.08, 10), team, 0.14, -0.25, 0.08 * s));
    return a;
  };
  const armL = arm(1);
  const armR = arm(-1);
  body.add(legL, legR, armL, armR);
  g.userData = { body, legL, legR, staff: armR, kind: 'hero' };
  return g;
}

registerSkin('ghoul', ghoul);

registerView('cpriest', {
  make(e, world, v) {
    const g = bakeParts(priest());
    v.parts = g.userData;
    return g;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    v.walk = (v.walk || 0) + dt * (b.mv ? 10 : 0);
    P.body.position.y = b.mv ? Math.abs(Math.sin(v.walk)) * 0.06 : 0;
    P.body.rotation.x = b.mv ? Math.sin(v.walk) * 0.04 : 0;
    // Casting: staff raised high, crystal blazing.
    v.cast = Math.max(0, Math.min(1, (v.cast || 0) + dt * (b.cast ? 6 : -3)));
    P.staff.rotation.z = v.cast * 0.5;
    P.staff.position.y = 0.8 + v.cast * 0.35;
    P.crystal.rotation.y += dt * (2 + v.cast * 10);
    P.crystal.scale.set(1 + v.cast * 0.6, 1.6 + v.cast, 1 + v.cast * 0.6);
    if (b.cast && emit(v, 'glow', 20, dt)) {
      const w = new THREE.Vector3();
      P.crystal.getWorldPosition(w);
      world.fx.trail(w.x, w.y, w.z, '#bfe8ff', 0.6, 0.4, 0.2);
    }
  },
});

// The blight: the painted blight tile, cut out by a mask redrawn whenever the
// list of blight discs grows. Adds are drawn in, dispels erased, in order.
let blightMap = null;
registerView('cleanblight', {
  make(e, world, v) {
    const size = (e.h + 1.5) * 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const mask = new THREE.CanvasTexture(canvas);
    blightMap ??= fxTexture('tex_cleanup_blight.webp', (t) => {
      t.repeat.set(size / 7, size / 7);
      t.needsUpdate = true;
    }, { repeat: true });
    const m = new THREE.MeshStandardMaterial({ color: '#b8a8c8', map: blightMap, alphaMap: mask, transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), m);
    plane.position.y = 0.04;
    plane.receiveShadow = true;
    plane.renderOrder = 1;
    const g = new THREE.Group();
    g.add(plane);
    v.parts = { canvas, mask, size, n: 0 };
    return g;
  },
  update(v, a, b) {
    const p = v.parts;
    if (b.ops.length !== p.n) {
      p.n = b.ops.length;
      drawBlight(p.canvas, b.ops, p.size);
      p.mask.needsUpdate = true;
    }
    v.obj.rotation.y = 0;
    return false;
  },
});

// Blight edges are ragged, as in WC3: each disc is drawn as a lumpy outline.
function drawBlight(canvas, ops, size) {
  const g = canvas.getContext('2d');
  const W = canvas.width;
  const s = W / size;
  g.clearRect(0, 0, W, W);
  g.filter = 'blur(1.5px)';
  ops.forEach(([add, x, y, r], i) => {
    g.globalCompositeOperation = add ? 'source-over' : 'destination-out';
    g.fillStyle = '#ffffff';
    g.beginPath();
    const n = 48;
    for (let j = 0; j <= n; j++) {
      const a = (j / n) * Math.PI * 2;
      const wob = 1 + 0.035 * Math.sin(a * 5 + i * 1.7) + 0.02 * Math.sin(a * 11 + i * 3.1);
      const px = (x + Math.cos(a) * r * wob) * s + W / 2;
      const py = (y + Math.sin(a) * r * wob) * s + W / 2;
      if (j) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.fill();
  });
  g.filter = 'none';
  g.globalCompositeOperation = 'source-over';
}

registerEvent('cleandispelcast', (e, world) => {
  telegraph(world, e.x, e.y, e.r, '#9fd8ff', e.d || 0.5);
});

registerEvent('cleandispel', (e, world) => {
  world.fx.glow(e.px, 2.6, e.py, '#cfeeff', 2.5, 0.3);
  dispelEffect(world, e.x, e.y, e.r, { blight: true });
});

// A fallen ghoul stains the ground: violet rot seeping out.
registerEvent('blightgrow', (e, world) => {
  const fx = world.fx;
  fx.ring(e.x, e.y, e.r, '#8a4ab0', 0.8, 0.1);
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * e.r;
    fx.smokePuff(e.x + Math.cos(a) * rr, 0.2, e.y + Math.sin(a) * rr, '#3a1a4a', 1.2, 2, 0.5);
  }
});
