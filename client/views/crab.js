// Crab Island (#26): the island in its shallow lagoon, the sunken ruins tree,
// the three hostile crabs and the critter, possessed crabs (a hero look),
// Anti-magic Shell and the frost nova the crabs arrive in.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerTheme, registerMapBuilder } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { seaMaterial } from './tides.js';

registerTheme(
  'crab_isle',
  { sky: '#8ac0e0', fog: '#a0cce0', floor: ['#e0c890', 25, {}], sun: '#fff4e0', hemi: ['#e8f4ff', '#6a5a3a'], sunI: 2.6 },
  {
    floor: { tex: 'tex_dirt.webp', tint: '#fff0c8', color: '#e0c890', units: 6 },
    edge: { tex: 'tex_dirt.webp', tint: '#c8b088', color: '#a89060', units: 5 },
    outer: { tex: 'tex_dirt.webp', tint: '#a89878', color: '#8a7a5a', units: 8 },
    edgeWidth: 1.2,
  },
);

// Unlit glow materials, one per colour, so models share them.
const glowCache = new Map();
const glow = (c) => glowCache.get(c) || glowCache.set(c, M.glowMat(c)).get(c);

// Looks by type: shell colour, size, claw size, spikes, barnacles.
const LOOKS = {
  shore: { shell: '#d8602a', tint: '#ffb080', s: 0.8, claw: 1, spikes: 0 },
  limb: { shell: '#9a2a24', tint: '#ff8a70', s: 1.0, claw: 1.35, spikes: 6 },
  behemoth: { shell: '#46586a', tint: '#a8c0d8', s: 1.55, claw: 1.25, spikes: 10, barnacles: true },
  critter: { shell: '#c8a070', tint: '#ffe0b0', s: 0.4, claw: 0.8, spikes: 0 },
};

// A crab: a broad textured carapace, eyes on stalks, two pincers (one bigger),
// four legs a side. Faces +X. `team` marks a possessed crab in the owner's colour.
export function crabModel(type, team = null) {
  const L = LOOKS[type] || LOOKS.shore;
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shell = M.triMat('tex_hide.webp', L.shell, L.tint, 1.4, { roughness: 0.45 });
  const under = M.triMat('tex_hide.webp', '#e8c8a0', '#fff0dc', 1.4, { roughness: 0.6 });
  const dark = M.mat('#2a1a14', { roughness: 0.4 });
  body.add(M.mesh(M.blob(0.62, 0.3, 0.78, { seed: 401, amt: 0.06, freq: 2.6 }), shell, 0, 0.55, 0));
  body.add(M.mesh(M.blob(0.55, 0.16, 0.66, { seed: 402, amt: 0.04 }), under, 0, 0.38, 0));
  // Ridges round the shell edge.
  for (let i = 0; i < 7; i++) {
    const a = -1.2 + (i / 6) * 2.4;
    const sp = M.mesh(M.scaled(M.G.cone, 0.07, 0.18, 0.07), shell, Math.cos(a) * 0.58, 0.55, Math.sin(a) * 0.72);
    sp.rotation.set(Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3);
    body.add(sp);
  }
  for (let i = 0; i < L.spikes; i++) {
    const a = (i / L.spikes) * Math.PI * 2;
    const sp = M.mesh(M.scaled(M.G.cone, 0.06, 0.28, 0.06), M.boneMat(), Math.cos(a) * 0.3 - 0.05, 0.8, Math.sin(a) * 0.35);
    sp.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    body.add(sp);
  }
  if (L.barnacles) {
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.45;
      body.add(M.mesh(M.lathe([[0.07, 0], [0.06, 0.06], [0.03, 0.08], [0.001, 0.06]], 7), M.mat('#d8d0c0', { roughness: 0.8 }), Math.cos(a) * r - 0.1, 0.8, Math.sin(a) * r));
    }
  }
  // Eye stalks.
  for (const s of [1, -1]) {
    body.add(M.mesh(M.tube([[0.45, 0.62, 0.12 * s], [0.55, 0.85, 0.15 * s]], 0.03, 0.025, 4, 5), shell));
    body.add(M.mesh(M.scaled(M.G.sphere, 0.06), dark, 0.56, 0.88, 0.15 * s));
  }
  // Claws: an arm and a two-part pincer; the right one is the big one.
  const claws = [];
  for (const s of [1, -1]) {
    const big = s < 0 ? L.claw * 1.15 : L.claw;
    const arm = new THREE.Group();
    arm.position.set(0.45, 0.5, 0.45 * s);
    arm.add(M.mesh(M.tube([[0, 0, 0], [0.25, 0.08, 0.2 * s], [0.5, 0.12, 0.22 * s]], 0.07, 0.06, 8, 8), shell));
    const pincer = new THREE.Group();
    pincer.position.set(0.55, 0.12, 0.22 * s);
    pincer.scale.setScalar(big);
    pincer.add(M.mesh(M.blob(0.2, 0.12, 0.12, { seed: 403 }), shell, 0.12, 0, 0));
    const fixed = M.mesh(M.tube([[0.25, 0.02, 0], [0.42, 0.05, 0.02 * s], [0.52, 0.0, 0]], 0.055, 0.012, 8, 6), shell);
    const jaw = new THREE.Group();
    jaw.position.set(0.25, -0.03, 0);
    jaw.add(M.mesh(M.tube([[0, 0, 0], [0.17, -0.06, 0.02 * s], [0.25, -0.02, 0]], 0.045, 0.01, 8, 6), shell));
    pincer.add(fixed, jaw);
    if (team) pincer.add(M.mesh(M.scaled(M.G.sphere, 0.07), glow(team), 0.12, 0.1, 0));
    arm.add(pincer);
    body.add(arm);
    claws.push({ arm, jaw });
  }
  const legs = [];
  for (const s of [1, -1]) {
    for (let i = 0; i < 4; i++) {
      const x = 0.25 - i * 0.2;
      const hip = new THREE.Group();
      hip.position.set(x, 0.45, 0.5 * s);
      hip.add(M.mesh(M.tube([[0, 0, 0], [-0.05 * i, 0.22, 0.35 * s], [-0.1 * i, -0.4, 0.62 * s]], 0.045, 0.015, 10, 6), shell));
      body.add(hip);
      legs.push(hip);
    }
  }
  if (team) {
    const ring = M.mesh(new THREE.TorusGeometry(0.4, 0.035, 6, 24).rotateX(Math.PI / 2), glow(team), -0.05, 0.84, 0);
    body.add(ring);
  }
  body.scale.setScalar(L.s * 1.15);
  // legL / legR: the hero view swings these while a possessed crab walks.
  // Every part the animation moves is listed (arms, jaws, legs), so the
  // engine can merge the rest per material.
  g.userData = { body, claws, arms: claws.map((c) => c.arm), jaws: claws.map((c) => c.jaw), legs, legL: legs[1], legR: legs[5] };
  return g;
}

for (const t of Object.keys(LOOKS)) registerSkin(`crab_${t}`, (color) => crabModel(t, color));

// A low-poly sphere for a skin's small parts (eyes, studs, knuckles).
const LOW_SPHERE = new THREE.SphereGeometry(1, 10, 8);

// The Banshee (`uban`), the player unit before it possesses a crab: a pale,
// faintly glowing spirit woman hovering above the sand, hooded, her white
// hair and tattered robe streaming behind her, arms reaching forward as she
// wails. A gem on her brow, her sash and a front panel carry the team colour.
// Faces +X. `float` bobs her up and down; the two robe tatters are the "legs"
// the walk swings, her right arm the "staff" the cast raises.
export function banshee(color) {
  const { mesh, tube, lathe, cloth, mat, G, scaled } = M;
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(1.35);
  g.add(body);
  const float = new THREE.Group();
  float.position.y = 0.3;
  body.add(float);
  const robe = mat('#e2eaf6', { roughness: 0.55, emissive: '#5a78a8', emissiveIntensity: 0.5, side: THREE.DoubleSide });
  const robeDim = mat('#b4c6e0', { roughness: 0.6, emissive: '#3a5888', emissiveIntensity: 0.5, side: THREE.DoubleSide });
  const face = mat('#eef2fa', { roughness: 0.4, emissive: '#6a88b8', emissiveIntensity: 0.4 });
  const hair = mat('#f4f8ff', { roughness: 0.5, emissive: '#7890c0', emissiveIntensity: 0.55 });
  const mouth = mat('#1c2840', { roughness: 0.6 });
  const veil = mat('#c8dcff', { transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, emissive: '#6a90d0', emissiveIntensity: 0.8 });
  const team = mat(color, { roughness: 0.7, side: THREE.DoubleSide });

  // Tatters of the robe's hem, hanging from the waist and trailing back.
  const tatter = (s) => {
    const t = new THREE.Group();
    t.position.set(-0.02, 0.42, 0.1 * s);
    t.add(mesh(cloth(0.2, 0.62, 0.05, 0.28), robeDim, 0, -0.31, 0));
    return t;
  };
  const legL = tatter(1);
  const legR = tatter(-1);
  const skirt = mesh(lathe([[0.13, 0.6], [0.18, 0.46], [0.23, 0.28], [0.25, 0.14]], 18), robe);
  skirt.scale.z = 1.15;
  const wisp = mesh(cloth(0.36, 0.9, 0.08, 0.55), veil, -0.12, 0.1, 0);
  const torso = mesh(lathe([[0.12, 0.56], [0.15, 0.68], [0.18, 0.86], [0.16, 0.98], [0.1, 1.06], [0.045, 1.1]], 18), robe);
  torso.scale.z = 1.2;
  const sash = mesh(new THREE.TorusGeometry(0.14, 0.03, 6, 20).rotateX(Math.PI / 2), team, 0, 0.6, 0);
  sash.scale.z = 1.2;
  const panel = mesh(cloth(0.13, 0.42, 0.02, -0.06), team, 0.19, 0.38, 0);
  panel.rotation.y = Math.PI;
  // Arms: thin, in flared sleeves, reaching forward; pale hands.
  const arm = (s, lift) => {
    const a = new THREE.Group();
    a.position.set(0, 1.0, 0.16 * s);
    a.add(mesh(tube([[0, 0, 0], [0.16, -0.12 + lift, 0.1 * s], [0.34, -0.1 + lift * 1.6, 0.12 * s]], 0.045, 0.1, 8, 8), robeDim));
    a.add(mesh(tube([[0.3, -0.1 + lift * 1.5, 0.12 * s], [0.44, -0.08 + lift * 1.8, 0.11 * s]], 0.03, 0.022, 4, 6), face));
    a.add(mesh(scaled(LOW_SPHERE, 0.045, 0.03, 0.04), face, 0.47, -0.08 + lift * 1.8, 0.11 * s));
    return a;
  };
  const armL = arm(1, 0.02);
  const armR = arm(-1, 0.08);
  // Head in a deep hood open at the front; a gaunt face with glowing eyes
  // and a wailing mouth; long hair streaming out behind.
  const head = new THREE.Group();
  head.position.set(0.04, 1.2, 0);
  head.add(mesh(scaled(LOW_SPHERE, 0.1, 0.125, 0.09), face, 0.02, 0, 0));
  for (const s of [1, -1]) head.add(mesh(scaled(LOW_SPHERE, 0.022, 0.016, 0.022), glow('#a8f0ff'), 0.1, 0.02, 0.034 * s));
  head.add(mesh(scaled(LOW_SPHERE, 0.026, 0.04, 0.03), mouth, 0.1, -0.06, 0));
  head.add(mesh(scaled(LOW_SPHERE, 0.022), glow(color), 0.1, 0.09, 0));
  const hood = mesh(new THREE.SphereGeometry(0.16, 18, 10, Math.PI + 0.85, Math.PI * 2 - 1.7, 0, Math.PI * 0.72), robeDim, 0, 0.02, 0);
  hood.scale.set(1.05, 1.15, 1);
  head.add(hood);
  head.add(mesh(tube([[-0.08, 0.1, 0], [-0.24, 0, 0], [-0.34, -0.2, 0], [-0.4, -0.4, 0]], 0.09, 0.02, 10, 8), robeDim));
  for (const z of [-0.07, 0, 0.07]) head.add(mesh(tube([[-0.05, -0.02, z], [-0.26, -0.12, z * 1.8], [-0.44, -0.34, z * 1.4], [-0.6, -0.5, z * 2]], 0.035, 0.008, 12, 6), hair));

  float.add(legL, legR, skirt, wisp, torso, sash, panel, armL, armR, head);
  g.userData = {
    body, anim: [float], staff: armR, legL, legR, kind: 'hero',
    // Hovering: a slow bob (the engine calls this each frame).
    tick(dt, v, b, world) {
      float.position.y = 0.3 + Math.sin(world.time * 2.2 + (v.id || 0)) * 0.06;
    },
  };
  return g;
}

registerSkin('crab_banshee', (color) => banshee(color));

function animateCrab(parts, t, moving, snapping, dt) {
  parts.legs.forEach((l, i) => (l.rotation.x = moving ? Math.sin(t * 16 + i * 1.7) * 0.35 : Math.sin(t * 2 + i) * 0.03));
  parts.body.position.y = moving ? Math.abs(Math.sin(t * 16)) * 0.03 : 0;
  parts.claws.forEach((c, i) => {
    const snap = snapping ? Math.abs(Math.sin(t * 14 + i)) : 0.15 + Math.sin(t * 1.5 + i) * 0.1;
    c.jaw.rotation.z = -snap * 0.8;
    c.arm.rotation.z = snapping ? Math.sin(t * 10 + i * 2) * 0.35 : 0;
  });
}

registerView('crab_crab', {
  make(e, world, v) {
    const g = crabModel(e.t);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: '#b8ffd0', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    shield.visible = false;
    g.add(shield);
    v.parts = { ...g.userData, shield, s: (LOOKS[e.t] || LOOKS.shore).s };
    return g;
  },
  update(v, a, b, k, dt, world) {
    animateCrab(v.parts, world.time + v.id, !!b.mv, !!b.sw, dt);
    const sh = v.parts.shield;
    sh.visible = !!b.sh;
    if (sh.visible) {
      sh.scale.setScalar(v.parts.s * 1.3 + Math.sin(world.time * 5) * 0.04);
      sh.position.y = 0.5 * v.parts.s;
      sh.material.opacity = 0.18 + Math.sin(world.time * 7) * 0.05;
    }
  },
});

registerEvent('crab_nova', (e, world) => {
  // The Frost Nova the crabs arrive in.
  world.fx.shockwave(e.x, e.y, e.big ? 3.5 : 2.4, '#bfe8ff', 0.55);
  world.fx.burst(e.x, 0.4, e.y, '#d8f4ff', { n: e.big ? 40 : 24, speed: 4, size: 0.5, life: 0.7, up: 0.8 });
  world.fx.glow(e.x, 0.8, e.y, '#9fd8ff', e.big ? 4 : 2.5, 0.4);
  world.fx.burst(e.x, 0.1, e.y, '#e8f6ff', { n: 18, speed: 3, size: 0.5, life: 0.8, up: 2, grav: 10, additive: false });
  play(e.big ? 'bigboom' : 'splash');
});

registerEvent('crab_bite', (e, world) => {
  world.fx.sparks(e.x, 0.8, e.y, 5, 3, '#ffe0c0');
  play('hit');
});

registerEvent('crab_death', (e, world) => {
  world.fx.burst(e.x, 1, e.y, '#c8d8ff', { n: 26, speed: 4, size: 0.6, life: 0.8 });
  world.fx.dustCloud(e.x, e.y, 0.7, '#c8b890', 6);
  play('death');
});

// A crab dies: it flips on its back and sinks into the sand.
registerEvent('crab_die', (e, world) => {
  const c = crabModel(e.t);
  c.position.set(e.x, 0, e.y);
  c.rotation.y = -(e.f || 0);
  world.scene.add(c);
  world.fx.dustCloud(e.x, e.y, 0.6, '#c8b890', 5);
  world.fx.transients.push({ obj: c, t: 0, dur: 2.5, update: (k) => {
    c.userData.body.rotation.x = Math.min(Math.PI, k * 12);
    c.userData.body.position.y = Math.sin(Math.min(1, k * 4) * Math.PI) * 0.5 + 0.2;
    c.position.y = -Math.max(0, k - 0.5) * 1.5;
  } });
  play('squish');
});

// The banshee dives into the crab in a stream of ghostly light.
registerEvent('crab_possess', (e, world) => {
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    world.fx.trail(e.x1 + (e.x2 - e.x1) * t, 1.2 + Math.sin(t * Math.PI) * 1.2, e.y1 + (e.y2 - e.y1) * t, '#c8e0ff', 0.7, 0.6, 0.2);
  }
  world.fx.glow(e.x2, 1, e.y2, '#b0d0ff', 3, 0.5);
  world.fx.ring(e.x2, e.y2, 1.5, '#c8e0ff', 0.5);
  play('drain');
});

registerEvent('crab_shell', (e, world) => {
  world.fx.glow(e.x, 1, e.y, '#b8ffd0', 2.5, 0.4);
  world.fx.ring(e.x, e.y, 1.3, '#b8ffd0', 0.5);
  play('shield');
});

registerEvent('crab_fizzle', (e, world) => world.fx.burst(e.x, 1, e.y, '#c8e0ff', { n: 10, speed: 2, size: 0.4, life: 0.4 }));

// A gnarled, sunken-ruins tree: a twisted trunk, roots in the sand, a sparse
// ragged canopy, broken stones round it and a few shrubs.
function ruinsTree() {
  const g = new THREE.Group();
  const bark = M.barkMat();
  g.add(M.mesh(M.tube([[0, 0, 0], [0.2, 1.2, 0.1], [-0.1, 2.4, -0.1], [0.3, 3.4, 0.2]], 0.55, 0.22, 14, 12), bark));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(M.mesh(M.tube([[0, 0.5, 0], [Math.cos(a) * 0.7, 0.2, Math.sin(a) * 0.7], [Math.cos(a) * 1.3, -0.1, Math.sin(a) * 1.3]], 0.22, 0.05, 8, 8), bark));
  }
  for (const [x, y, z, r] of [[0.9, 3.6, 0.3, 1.1], [-0.6, 3.9, -0.4, 1.0], [0.2, 4.4, 0.4, 0.9], [-0.2, 3.3, 0.9, 0.8]]) {
    g.add(M.mesh(M.tube([[0.2, 3.1, 0], [x * 0.6, y - 0.2, z * 0.6], [x, y, z]], 0.12, 0.05, 6, 6), bark));
    g.add(M.mesh(M.blob(r, r * 0.55, r, { seed: 410 + Math.round(r * 10), amt: 0.25, freq: 3 }), M.triMat('tex_needles.webp', '#3a5a2a', '#a8c088', 1.4, { roughness: 0.95 }), x, y + 0.2, z));
  }
  const stone = M.texMat('tex_stone.webp', '#8a8478', '#d0c8b8');
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    const b = M.mesh(new THREE.BoxGeometry(0.5, 0.3 + Math.random() * 0.5, 0.35), stone, Math.cos(a) * 1.7, 0.15, Math.sin(a) * 1.7);
    b.rotation.set(Math.random() * 0.3, a, Math.random() * 0.3);
    g.add(b);
  }
  for (let i = 0; i < 4; i++) {
    const s = M.bush(0.6 + Math.random() * 0.3);
    const a = (i / 4) * Math.PI * 2 + 1;
    s.position.set(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5);
    g.add(s);
  }
  return g;
}

// The lagoon: shallow turquoise water round the island out to the arena
// edge, deep water beyond; the ruins tree in the middle; rocks and shells.
registerMapBuilder('crab_isle', (map, world) => {
  const G = world.mapGroup;
  const hw = map.hw;
  const mat = seaMaterial({ shallows: [{ x: 0, y: 0, r: hw * 2.1 }], land: [{ x: 0, y: 0, r: map.land * 1.02 }], hw, hh: hw, deep: '#155a80', mid: '#2a8aa8', shallow: '#58c8c0' });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2), mat);
  sea.position.y = 0.1;
  sea.renderOrder = 2;
  G.add(sea);
  world.liquids.push(mat);
  const tree = ruinsTree();
  G.add(tree);
  // Driftwood, shells and rocks on the beach edge; reefs beyond the arena.
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = map.land * (0.8 + Math.random() * 0.15);
    const shell = M.mesh(M.lathe([[0.001, 0], [0.12, 0.02], [0.1, 0.06], [0.001, 0.1]], 10), M.mat(['#f0d8c8', '#e8b0a0', '#f8f0e0'][i % 3], { roughness: 0.5 }), Math.cos(a) * r, 0, Math.sin(a) * r);
    G.add(shell);
  }
  for (let i = 0; i < 50; i++) {
    const side = i % 4;
    const t = Math.random() * 2 - 1;
    const out = 1.2 + Math.random() * 5;
    const [x, z] = [[t * (hw + 3), -hw - out], [t * (hw + 3), hw + out], [-hw - out, t * (hw + 3)], [hw + out, t * (hw + 3)]][side];
    const r = M.rock(0.5 + Math.random() * 1.3);
    r.position.set(x, -0.2, z);
    G.add(r);
  }
});
