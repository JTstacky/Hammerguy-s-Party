// Uther Party #12 Dark Forest: a Northrend clearing at midnight. Druids of the
// Talon and their storm crow form (hero skins), abominations and gargoyles,
// the mass-teleport rune at the centre where the hunters appear, and the
// clearing's pines.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerTheme, registerMapBuilder } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { skinTick, bakeView, bakeScenery, emit, blobShadow, groundGlow, featherMat, featherTri, fleshMat, stoneMat, clothMat, pine, now, glow, ownMat, disposeOwn } from './d-kit.js';

const CROW_ALT = 240 / 54; // flying height 240

registerTheme('darkforest',
  { sky: '#04070f', fog: '#070c18', floor: ['#3a3c4c', 30, {}], sun: '#8aa4ff', hemi: ['#34427a', '#06070c'], sunI: 0.95 },
  {
    floor: { tex: 'tex_boulder.webp', tint: '#8a90a8', color: '#3c3e4c', units: 5 },
    edge: { tex: 'tex_snow.webp', tint: '#7a86a4', color: '#6a7488', units: 6 },
    outer: { tex: 'tex_snow.webp', tint: '#6a7694', color: '#5a6478', units: 9 },
    edgeWidth: 1.6,
  });

// Northrend pines: dark blue-green needles with snow on the boughs.
registerMapBuilder('darkforest', (map, world) => {
  const scen = new THREE.Group(); // static scenery, merged per material
  const needles = M.texMat('tex_needles.webp', '#1f3a30', '#6f9088', 1, { roughness: 0.95 });
  const add = (x, z, s, snow = true) => {
    const t = pine(s, needles, snow);
    t.position.set(x, 0, z);
    scen.add(t);
  };
  for (const [x, y] of map.trees) add(x, y, 0.95 + Math.random() * 0.25);
  // The tree walls: a dense double row just outside the clearing, then forest.
  const H = map.hw;
  const ring = (off, step, jit, s0, s1) => {
    for (let a = -H - off; a <= H + off; a += step) {
      for (const [x, z] of [[a, -H - off], [a, H + off], [-H - off, a], [H + off, a]]) add(x + (Math.random() - 0.5) * jit, z + (Math.random() - 0.5) * jit, s0 + Math.random() * (s1 - s0));
    }
  };
  ring(1.7, 2.1, 0.4, 0.85, 1.1);
  ring(3.3, 2.4, 1.0, 1.1, 1.5);
  ring(6, 3, 1.5, 1.2, 1.6);
  // Snowy rocks here and there along the walls.
  for (let i = 0; i < 16; i++) {
    const r = M.rock(0.4 + Math.random() * 0.5);
    const side = Math.floor(Math.random() * 4);
    const a = (Math.random() - 0.5) * 2 * H;
    const o = H + 0.3 + Math.random() * 0.6;
    const [x, z] = [[a, -o], [a, o], [-o, a], [o, a]][side];
    r.position.set(x, 0, z);
    scen.add(r);
  }
  world.mapGroup.add(bakeScenery(scen));
  // Moonlight glints: a cold point light over the clearing.
  const moon = new THREE.PointLight('#8aa0ff', 14, 40, 1.4);
  moon.position.set(0, 12, 0);
  world.mapGroup.add(moon);
});

// ------------------------------------------------------------ druid of the talon

function druid(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = M.mat('#8a6cb0', { roughness: 0.6 });
  const robe = featherMat('#d8c8f0');
  const team = clothMat(color);
  const teamDark = clothMat(color, 0.55);
  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(0, 0.62, 0.12 * s);
    hip.add(M.mesh(M.tube([[0, 0, 0], [0.03, -0.3, 0], [0, -0.55, 0]], 0.09, 0.06, 6, 10), skin));
    // Talon feet.
    for (const a of [-0.35, 0, 0.35]) hip.add(M.mesh(M.tube([[0, -0.58, 0], [0.12, -0.6, a * 0.2], [0.2, -0.62, a * 0.35]], 0.03, 0.01, 4, 6), M.mat('#3a3440', { roughness: 0.4 })));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  // A feathered robe, split at the front.
  const skirt = M.mesh(M.lathe([[0.3, 0.3], [0.28, 0.5], [0.24, 0.75], [0.22, 0.9]], 20), robe);
  const torso = M.mesh(M.lathe([[0.2, 0.85], [0.25, 0.98], [0.27, 1.12], [0.22, 1.26], [0.1, 1.34]], 20), robe);
  torso.scale.z = 1.15;
  const sash = M.mesh(M.cloth(0.26, 0.7, 0.05), team, 0.25, 0.72, 0);
  sash.rotation.y = Math.PI;
  const belt = M.mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 24).rotateX(Math.PI / 2), teamDark, 0, 0.88, 0);
  belt.scale.z = 1.15;
  // Feather mantle over the shoulders and a feather cloak behind.
  const mantle = M.mesh(M.blob(0.3, 0.14, 0.38, { seed: 12, amt: 0.14, freq: 4 }), featherTri('#b8a8d8'), -0.02, 1.25, 0);
  const cloak = M.mesh(M.cloth(0.6, 1.05, 0.22, 0.28), M.texMat('tex_darkforest_feathers.webp', '#1c1a26', '#8878a8', 2, { roughness: 0.6, side: THREE.DoubleSide }), -0.22, 0.8, 0);
  // Head: long night elf ears and a raven-skull mask with a beak.
  const head = new THREE.Group();
  head.position.set(0.04, 1.44, 0);
  head.add(M.mesh(M.blob(0.14, 0.15, 0.13, { seed: 13 }), skin));
  for (const s of [1, -1]) head.add(M.mesh(M.tube([[0, 0.02, 0.1 * s], [-0.08, 0.1, 0.2 * s], [-0.2, 0.2, 0.26 * s]], 0.035, 0.005, 6, 6), skin));
  head.add(M.mesh(M.blob(0.16, 0.12, 0.14, { seed: 14, amt: 0.06 }), M.boneMat(), 0.04, 0.07, 0));
  head.add(M.mesh(M.scaled(M.G.cone, 0.06, 0.3, 0.05).rotateZ(-Math.PI / 2), M.mat('#3a3440', { roughness: 0.4 }), 0.28, 0.04, 0));
  for (const s of [1, -1]) head.add(M.mesh(M.scaled(M.G.sphere, 0.03), glow('#bfe8ff'), 0.15, 0.08, 0.06 * s));
  // A crest of feathers standing up behind the mask.
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.22;
    head.add(M.mesh(M.tube([[-0.05, 0.12, 0], [-0.14, 0.32, a * 0.4], [-0.3, 0.42, a * 0.8]], 0.035, 0.008, 6, 6), featherMat('#6a5a90')));
  }
  // Staff with a crescent moon.
  const staff = new THREE.Group();
  staff.position.set(0.2, 0.85, -0.38);
  staff.add(M.mesh(M.tube([[0, -0.8, 0], [0.03, 0.1, 0], [0, 0.95, 0]], 0.035, 0.028, 8, 8), M.barkMat()));
  const moon = M.mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 20, Math.PI * 1.3), glow('#bfe8ff'), 0, 1.08, 0);
  moon.rotation.z = -0.6;
  staff.add(moon);
  staff.add(M.mesh(M.scaled(M.G.sphere, 0.05), glow('#bfe8ff'), 0, 1.02, 0));
  const armR = M.mesh(M.tube([[0, 1.18, -0.3], [0.1, 0.98, -0.36], [0.2, 0.86, -0.38]], 0.06, 0.05, 6, 8), skin);
  const armL = M.mesh(M.tube([[0, 1.18, 0.3], [0.05, 0.95, 0.36], [0.12, 0.78, 0.3]], 0.06, 0.05, 6, 8), skin);
  body.add(legL, legR, skirt, torso, sash, belt, mantle, cloak, head, staff, armR, armL);
  body.scale.setScalar(1.45);
  g.userData = { body, staff, legL, legR, kind: 'hero' };
  return g;
}

// ------------------------------------------------------------ storm crow

function wing(len, span, seed, mat) {
  // A tapering feathered wing lying along +Z from the shoulder, with primaries at the tip.
  const w = new THREE.Group();
  w.add(M.mesh(M.blob(0.26, 0.05, span * 0.5, { seed, amt: 0.1 }), mat, 0, 0, span * 0.45));
  for (let i = 0; i < 5; i++) {
    const z = span * (0.55 + i * 0.1);
    const f = M.mesh(M.blob(len * (0.55 - i * 0.05), 0.025, 0.07, { seed: seed + i, amt: 0.05 }), mat, -len * 0.25 - i * 0.04, 0, z);
    f.rotation.y = -0.25 - i * 0.12;
    w.add(f);
  }
  return w;
}

function crow(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shadow = blobShadow(1.3, 0.4);
  g.add(shadow);
  const fly = new THREE.Group();
  body.add(fly);
  const plume = featherTri('#c8c0e0');
  const flat = featherMat('#b8b0d8');
  fly.add(M.mesh(M.blob(0.62, 0.36, 0.38, { seed: 21, amt: 0.07 }), plume, 0, 0, 0));
  fly.add(M.mesh(M.blob(0.3, 0.26, 0.26, { seed: 22, amt: 0.06 }), plume, 0.62, 0.14, 0));
  fly.add(M.mesh(M.scaled(M.G.cone, 0.09, 0.42, 0.08).rotateZ(-Math.PI / 2), M.mat('#3a3844', { roughness: 0.35, metalness: 0.2 }), 1.0, 0.1, 0));
  for (const s of [1, -1]) fly.add(M.mesh(M.scaled(M.G.sphere, 0.045), glow('#ffd060'), 0.78, 0.22, 0.13 * s));
  // Team-coloured band round the neck.
  fly.add(M.mesh(new THREE.TorusGeometry(0.24, 0.04, 8, 20).rotateY(Math.PI / 2), clothMat(color), 0.42, 0.08, 0));
  // Fanned tail.
  const tail = M.mesh(M.cloth(0.5, 0.7, 0.12, 0), M.texMat('tex_darkforest_feathers.webp', '#1c1a26', '#b8b0d8', 2, { roughness: 0.6, side: THREE.DoubleSide }), -0.8, 0, 0);
  tail.rotation.z = -Math.PI / 2 + 0.15;
  fly.add(tail);
  // Tucked talons.
  for (const s of [1, -1]) fly.add(M.mesh(M.tube([[0.05, -0.3, 0.1 * s], [0.0, -0.45, 0.12 * s], [-0.1, -0.5, 0.1 * s]], 0.04, 0.015, 4, 6), M.mat('#3a3440', { roughness: 0.4 })));
  const wings = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.1, 0.12, 0.25 * s);
    const w = wing(1.1, 1.5, 30 + (s > 0 ? 0 : 7), plume);
    if (s < 0) w.scale.z = -1;
    pivot.add(w);
    fly.add(pivot);
    wings.push({ pivot, s });
  }
  const born = now();
  // Wing beats and the climb to flying height (about 1 s after the morph).
  skinTick(g, [fly, ...wings.map((w) => w.pivot), shadow], (t) => {
    const k = Math.min(1, (t - born) / 1.0);
    const dead = body.rotation.z > 0.01;
    const alt = dead ? Math.max(0.3, CROW_ALT * (1 - body.rotation.z / (Math.PI / 2))) : 0.8 + (CROW_ALT - 0.8) * k * k * (3 - 2 * k);
    fly.position.y = alt + (dead ? 0 : Math.sin(t * 2.2) * 0.12);
    const beat = dead ? 0.2 : Math.sin(t * 7) * 0.7 + 0.1;
    for (const { pivot, s } of wings) pivot.rotation.x = -s * beat;
    shadow.scale.setScalar(1 - Math.min(0.5, alt / 12));
  });
  body.scale.setScalar(1.25);
  Object.assign(g.userData, { body, kind: 'hero' });
  return g;
}

registerSkin('druid', druid);
registerSkin('crow', crow);

// ------------------------------------------------------------ abomination

function abomination() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  g.add(blobShadow(1.4, 0.4));
  const flesh = fleshMat('#d8ffc0');
  const pale = fleshMat('#f0ffe0');
  const dark = M.mat('#3a2a24', { roughness: 0.8 });
  const steel = M.mat('#8a9098', { metalness: 0.7, roughness: 0.35 });
  const legs = [];
  for (const s of [1, -1]) {
    const hip = new THREE.Group();
    hip.position.set(-0.1, 0.75, 0.38 * s);
    hip.add(M.mesh(M.tube([[0, 0, 0], [0.06, -0.35, 0.03 * s], [0, -0.7, 0]], 0.22, 0.17, 6, 10), flesh));
    hip.add(M.mesh(M.blob(0.22, 0.1, 0.2, { seed: 40 }), dark, 0.06, -0.72, 0));
    legs.push(hip);
    body.add(hip);
  }
  // The gut and chest, stitched together, with a hole showing the innards.
  body.add(M.mesh(M.blob(0.85, 0.72, 0.8, { seed: 41, amt: 0.07 }), flesh, 0.05, 1.3, 0));
  body.add(M.mesh(M.blob(0.62, 0.5, 0.72, { seed: 42, amt: 0.08 }), pale, 0.1, 1.95, 0));
  body.add(M.mesh(M.blob(0.3, 0.26, 0.25, { seed: 43 }), M.mat('#8a2020', { roughness: 0.35 }), 0.62, 1.15, 0.28));
  for (let i = 0; i < 3; i++) body.add(M.mesh(M.tube([[0.66, 1.2 - i * 0.1, 0.1 + i * 0.1], [0.82, 0.95 - i * 0.05, 0.2 + i * 0.08], [0.72, 0.75, 0.3]], 0.05, 0.04, 6, 6), M.mat('#b04040', { roughness: 0.3 })));
  // Stitches.
  for (const [a, b] of [[[0.5, 1.8, -0.5], [0.8, 1.2, -0.2]], [[0.0, 2.3, 0.4], [0.5, 1.6, 0.6]]]) {
    body.add(M.mesh(M.tube([a, [(a[0] + b[0]) / 2 + 0.08, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], b], 0.02, 0.02, 8, 5), dark));
  }
  // A small hooded head sunk into the shoulders, with glowing eyes.
  const head = new THREE.Group();
  head.position.set(0.55, 2.3, 0);
  head.add(M.mesh(M.blob(0.22, 0.2, 0.2, { seed: 44 }), pale));
  head.add(M.mesh(M.lathe([[0.25, -0.05], [0.26, 0.1], [0.2, 0.25], [0.01, 0.3]], 14), M.leatherMat('#6a5a50'), -0.05, 0, 0));
  for (const s of [1, -1]) head.add(M.mesh(M.scaled(M.G.sphere, 0.04), glow('#e0ff60'), 0.19, 0.03, 0.07 * s));
  head.add(M.mesh(M.scaled(M.G.box, 0.05, 0.03, 0.14), M.mat('#1a0e0c'), 0.2, -0.08, 0));
  body.add(head);
  // Cleaver arm (swings) and hook arm, plus a stubby third arm on the back.
  const arm = (s) => {
    const a = new THREE.Group();
    a.position.set(0.2, 2.05, 0.72 * s);
    a.add(M.mesh(M.tube([[0, 0, 0], [0.25, -0.4, 0.15 * s], [0.5, -0.75, 0.08 * s]], 0.18, 0.13, 8, 10), flesh));
    a.add(M.mesh(M.blob(0.15, 0.15, 0.15, { seed: 45 }), pale, 0.52, -0.8, 0.08 * s));
    body.add(a);
    return a;
  };
  const armR = arm(-1);
  const cleaver = new THREE.Group();
  cleaver.position.set(0.55, -0.85, -0.08);
  cleaver.add(M.mesh(M.tube([[0, -0.1, 0], [0, 0.25, 0]], 0.04, 0.04, 2, 6), M.mat('#4a3020')));
  const blade = M.mesh(M.axeBlade(0.7, 0.8), steel, 0.02, 0.45, 0);
  blade.scale.set(1, 1, 1.4);
  cleaver.add(blade);
  cleaver.rotation.z = -0.5;
  armR.add(cleaver);
  const armL = arm(1);
  armL.add(M.mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 16, Math.PI * 1.4), steel, 0.6, -1.1, 0.1));
  for (let i = 0; i < 4; i++) {
    const link = M.mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12), steel, 0.55, -0.9 - i * 0.02, 0.1 - i * 0.1);
    link.rotation.y = i % 2 ? Math.PI / 2 : 0;
    armL.add(link);
  }
  body.add(M.mesh(M.tube([[-0.4, 2.1, 0.2], [-0.7, 1.9, 0.35], [-0.8, 1.6, 0.4]], 0.09, 0.06, 6, 8), flesh));
  body.scale.setScalar(1.1);
  g.userData = { body, legs, armR };
  return g;
}

// ------------------------------------------------------------ gargoyle

function batWing(mat) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.lineTo(0.15, 1.7);
  sh.quadraticCurveTo(-0.05, 1.45, -0.3, 1.5);
  sh.quadraticCurveTo(-0.35, 1.15, -0.6, 1.1);
  sh.quadraticCurveTo(-0.55, 0.75, -0.8, 0.62);
  sh.quadraticCurveTo(-0.45, 0.3, -0.4, 0);
  sh.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 2, curveSegments: 10 });
  geo.rotateX(Math.PI / 2); // lie flat, span along +Z
  const w = new THREE.Group();
  w.add(M.mesh(geo, mat));
  // Finger bones along the membrane.
  const bone = M.mat('#4a4e5a', { roughness: 0.6 });
  for (const [x, z] of [[0.15, 1.7], [-0.3, 1.5], [-0.6, 1.1], [-0.8, 0.62]]) w.add(M.mesh(M.tube([[0, 0.02, 0], [x * 0.5, 0.05, z * 0.5], [x, 0.02, z]], 0.035, 0.012, 6, 6), bone));
  return w;
}

function gargoyle() {
  const g = new THREE.Group();
  const shadow = blobShadow(1.1, 0.35);
  g.add(shadow);
  const body = new THREE.Group();
  g.add(body);
  const fly = new THREE.Group();
  body.add(fly);
  const stone = stoneMat('#dce4ff');
  const membrane = M.mat('#4a4658', { roughness: 0.7, side: THREE.DoubleSide });
  fly.add(M.mesh(M.blob(0.42, 0.34, 0.3, { seed: 50 }), stone, 0, 0, 0));
  fly.add(M.mesh(M.blob(0.3, 0.26, 0.34, { seed: 51 }), stone, 0.28, 0.22, 0));
  const head = new THREE.Group();
  head.position.set(0.6, 0.3, 0);
  head.add(M.mesh(M.blob(0.2, 0.17, 0.17, { seed: 52 }), stone));
  head.add(M.mesh(M.blob(0.15, 0.08, 0.12, { seed: 53 }), stone, 0.14, -0.08, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.tube([[0, 0.1, 0.1 * s], [-0.1, 0.3, 0.18 * s], [-0.3, 0.38, 0.14 * s]], 0.05, 0.008, 8, 6), M.boneMat()));
    head.add(M.mesh(M.scaled(M.G.sphere, 0.035), glow('#ff4030'), 0.15, 0.05, 0.07 * s));
  }
  fly.add(head);
  fly.add(M.mesh(M.tube([[-0.35, -0.05, 0], [-0.8, -0.2, 0], [-1.1, -0.1, 0.1], [-1.3, -0.2, 0]], 0.08, 0.015, 12, 6), stone));
  for (const s of [1, -1]) {
    fly.add(M.mesh(M.tube([[0.2, -0.2, 0.18 * s], [0.35, -0.45, 0.2 * s], [0.5, -0.5, 0.18 * s]], 0.06, 0.03, 6, 6), stone));
    fly.add(M.mesh(M.tube([[-0.2, -0.2, 0.15 * s], [-0.25, -0.5, 0.18 * s], [-0.1, -0.62, 0.16 * s]], 0.07, 0.03, 6, 6), stone));
  }
  const wings = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.15, 0.25, 0.2 * s);
    const w = batWing(membrane);
    if (s < 0) w.scale.z = -1;
    pivot.add(w);
    fly.add(pivot);
    wings.push({ pivot, s });
  }
  fly.position.y = 3.6;
  body.scale.setScalar(1.3);
  g.userData = { body, fly, wings, shadow, anim: wings.map((w) => w.pivot) };
  return g;
}

// ------------------------------------------------------------ views

registerView('dfabom', {
  make(e, world, v) {
    const o = bakeView(abomination());
    v.parts = o.userData;
    return o;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    const moving = !!b.mv;
    v.walk = (v.walk || 0) + dt * (moving ? 7 : 0);
    P.body.position.y = moving ? Math.abs(Math.sin(v.walk)) * 0.08 : 0;
    P.body.rotation.x = moving ? Math.sin(v.walk) * 0.04 : 0;
    P.legs.forEach((l, i) => (l.rotation.z = moving ? Math.sin(v.walk + i * Math.PI) * 0.45 : 0));
    // Cleaver: raised during the wind-up, then chopped down.
    v.swingK = Math.max(0, Math.min(1, (v.swingK || 0) + dt * (b.sw ? 2.2 : -4)));
    P.armR.rotation.z = v.swingK < 0.8 ? v.swingK * 1.6 : 1.28 - (v.swingK - 0.8) * 9;
    if (emit(v, 'drip', moving ? 3 : 1, dt)) world.fx.trail(v.x + Math.cos(v.f) * 0.6, 1.2, v.z + Math.sin(v.f) * 0.6, '#9ad040', 0.25, 0.8, 0.2);
  },
});

registerView('gargoyle', {
  make(e, world, v) {
    const o = bakeView(gargoyle());
    v.parts = o.userData;
    return o;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    const t = world.time + v.id;
    P.fly.position.y = 3.6 + Math.sin(t * 2) * 0.15;
    const beat = Math.sin(t * (b.sw ? 11 : 8)) * 0.75;
    for (const { pivot, s } of P.wings) pivot.rotation.x = -s * beat;
    P.fly.rotation.z = b.sw ? -0.35 : 0.1;
  },
});

// The Mass Teleport "To" effect left burning at the centre.
registerView('dfportal', {
  make(e, world, v) {
    const g = new THREE.Group();
    const rune = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.55, 48).rotateX(-Math.PI / 2), ownMat(new THREE.MeshBasicMaterial({ color: '#6aa0ff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
    rune.position.y = 0.06;
    const inner = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 6).rotateX(-Math.PI / 2), rune.material);
    inner.position.y = 0.07;
    const halo = groundGlow(2.6, '#4060ff', 0.5);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 5, 24, 1, true), ownMat(new THREE.MeshBasicMaterial({ color: '#5080ff', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false })));
    beam.position.y = 2.5;
    const light = new THREE.PointLight('#6a8cff', 10, 12, 1.5);
    light.position.y = 1.2;
    g.add(halo, rune, inner, beam, light);
    v.parts = { rune, inner, beam };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    P.rune.rotation.y += dt * 0.4;
    P.inner.rotation.y -= dt * 0.9;
    P.beam.material.opacity = 0.08 + Math.sin(world.time * 2.5) * 0.03;
    for (let n = emit(v, 'mote', 14, dt); n > 0; n--) {
      const ang = Math.random() * Math.PI * 2;
      const r = 0.4 + Math.random() * 1.1;
      world.fx.trail(Math.cos(ang) * r, 0.2 + Math.random() * 0.6, Math.sin(ang) * r, '#8ab0ff', 0.35, 1.2, 0.05);
    }
  },
  remove(v) {
    disposeOwn(v.obj);
  },
});

registerEvent('dfportal', (e, world) => {
  world.fx.ring(e.x, e.y, 2.4, '#8ab0ff', 0.6);
  world.fx.burst(e.x, 1.2, e.y, '#9ec0ff', { n: 40, speed: 4, size: 0.6, life: 0.8 });
  world.fx.glow(e.x, 1.2, e.y, '#6a90ff', 4, 0.5);
  play('teleport');
});

registerEvent('dfmorph', (e, world) => {
  world.fx.burst(e.x, 1 + (e.air ? 1.5 : 0.5), e.y, '#2a2440', { n: 26, speed: 3, size: 0.5, life: 0.7, additive: false });
  world.fx.burst(e.x, 1.2, e.y, '#9ad8ff', { n: 14, speed: 2.5, size: 0.4, life: 0.5 });
  world.fx.glow(e.x, 1.2, e.y, '#9ad8ff', 2.5, 0.35);
  play('windwalk');
});

registerEvent('dfswing', (e, world) => {
  const v = world.views.get(e.u);
  if (v) play('smack');
});
