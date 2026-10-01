// Uther Party #29 Sleepy Time: a moonlit glade, Mountain Giants (hero skin)
// and the wandering Rock Golems they taunt into beating them to sleep.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerTheme, registerMapBuilder } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { bakeView, bakeScenery, blobShadow, clothMat, stoneMat, pine, emit, glow } from './d-kit.js';

registerTheme('sleepy',
  { sky: '#0a1226', fog: '#0e1830', floor: ['#3e5a3a', 30, { blades: true }], sun: '#a8bcff', hemi: ['#6070b0', '#101810'], sunI: 1.5 },
  {
    floor: { tex: 'tex_grass.webp', tint: '#7a988c', color: '#3e5a3a', units: 8 },
    edge: { tex: 'tex_dirt.webp', tint: '#8a8ca0', color: '#40404c', units: 5 },
    outer: { tex: 'tex_nightgrass.webp', tint: '#8890a8', color: '#1c3028', units: 11 },
    edgeWidth: 1.2,
  });

// The octagon's edge: rocks along the cut corners, pines beyond.
registerMapBuilder('sleepy', (map, world) => {
  const scen = new THREE.Group(); // static scenery, merged per material
  const H = map.half;
  const C = map.cut;
  const needles = M.texMat('tex_needles.webp', '#26402c', '#88a890', 1, { roughness: 0.95 });
  // Corner cliffs: a heap of boulders filling each cut-off corner.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const x = sx * (C - H + (H - (C - H)) * t);
      const y = sy * (H - (H - (C - H)) * t);
      const r = M.rock(0.7 + Math.random() * 0.5);
      r.position.set(x + sx * 0.5, 0, y + sy * 0.5);
      scen.add(r);
    }
  }
  // Pines round the outside.
  for (let a = -H - 1; a <= H + 1; a += 2.2) {
    for (const [x, z] of [[a, -H - 2.2], [a, H + 2.2], [-H - 2.2, a], [H + 2.2, a]]) {
      if (Math.abs(x) + Math.abs(z) > C + 3) continue;
      const t = pine(0.9 + Math.random() * 0.5, needles);
      t.position.set(x + (Math.random() - 0.5), 0, z + (Math.random() - 0.5));
      scen.add(t);
    }
  }
  for (let a = -H - 4; a <= H + 4; a += 3) {
    for (const [x, z] of [[a, -H - 5], [a, H + 5], [-H - 5, a], [H + 5, a]]) {
      const t = pine(1.1 + Math.random() * 0.5, needles);
      t.position.set(x + (Math.random() - 0.5) * 1.5, 0, z + (Math.random() - 0.5) * 1.5);
      scen.add(t);
    }
  }
  world.mapGroup.add(bakeScenery(scen));
  // Fireflies' glow: a warm lantern light on the glade.
  const light = new THREE.PointLight('#ffd8a0', 8, 30, 1.6);
  light.position.set(0, 8, 0);
  world.mapGroup.add(light);
});

// ------------------------------------------------------------ mountain giant

function giant(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const rock = stoneMat('#b8b8a4');
  const mossy = M.triMat('tex_needles.webp', '#3b5a30', '#b8d0a0', 1.8, { roughness: 0.95 });
  const bark = M.barkMat();
  const team = clothMat(color);
  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(-0.05, 1.0, 0.36 * s);
    hip.add(M.mesh(M.tube([[0, 0.1, 0], [0.08, -0.45, 0.02 * s], [0, -0.95, 0]], 0.26, 0.22, 6, 10), bark));
    hip.add(M.mesh(M.blob(0.2, 0.18, 0.2, { seed: 60 + s }), rock, 0.12, -0.45, 0));
    hip.add(M.mesh(M.blob(0.32, 0.14, 0.28, { seed: 62 }), rock, 0.1, -0.98, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  // A hunched rocky body with moss growing on the back.
  const torso = new THREE.Group();
  torso.rotation.z = -0.22;
  torso.add(M.mesh(M.blob(0.62, 0.7, 0.78, { seed: 63, amt: 0.08 }), rock, 0, 1.75, 0));
  torso.add(M.mesh(M.blob(0.5, 0.45, 0.6, { seed: 64, amt: 0.1 }), rock, 0.12, 1.2, 0));
  torso.add(M.mesh(M.blob(0.32, 0.16, 0.42, { seed: 65, amt: 0.2, freq: 4 }), mossy, -0.42, 2.2, 0.1));
  for (const s of [1, -1]) torso.add(M.mesh(M.blob(0.3, 0.26, 0.3, { seed: 66 }), rock, -0.05, 2.25, 0.62 * s));
  for (const s of [1, -1]) torso.add(M.mesh(M.blob(0.16, 0.1, 0.16, { seed: 67, amt: 0.25, freq: 5 }), mossy, -0.1, 2.48, 0.6 * s));
  // Loincloth and a strap in team colour.
  const loin = M.mesh(M.cloth(0.5, 0.55, 0.08, 0.05), team, 0.45, 0.95, 0);
  loin.rotation.y = Math.PI;
  torso.add(loin);
  const strap = M.mesh(new THREE.TorusGeometry(0.72, 0.06, 6, 28), clothMat(color, 0.7), 0.02, 1.75, 0);
  strap.rotation.set(0, Math.PI / 2, 0.7);
  torso.add(strap);
  // Head: a small craggy face under a heavy brow, with a moss beard.
  const head = new THREE.Group();
  head.position.set(0.62, 2.45, 0);
  head.add(M.mesh(M.blob(0.25, 0.24, 0.24, { seed: 67 }), rock));
  head.add(M.mesh(M.blob(0.2, 0.08, 0.26, { seed: 68 }), rock, 0.1, 0.12, 0));
  head.add(M.mesh(M.blob(0.16, 0.22, 0.2, { seed: 69, amt: 0.2, freq: 5 }), mossy, 0.14, -0.2, 0));
  for (const s of [1, -1]) head.add(M.mesh(M.scaled(M.G.sphere, 0.045), glow('#b8ff90'), 0.22, 0.05, 0.09 * s));
  torso.add(head);
  // Long arms hanging to the knees, with boulder fists.
  const arms = [];
  for (const s of [1, -1]) {
    const a = new THREE.Group();
    a.position.set(0.15, 2.2, 0.8 * s);
    a.add(M.mesh(M.blob(0.3, 0.28, 0.3, { seed: 70 }), rock, 0, 0, 0));
    a.add(M.mesh(M.tube([[0, 0, 0], [0.18, -0.6, 0.1 * s], [0.3, -1.25, 0.05 * s]], 0.2, 0.17, 8, 10), bark));
    a.add(M.mesh(M.blob(0.3, 0.28, 0.28, { seed: 71 }), rock, 0.32, -1.38, 0.05 * s));
    arms.push(a);
    torso.add(a);
  }
  body.add(legL, legR, torso);
  body.scale.setScalar(1.25);
  g.userData = { body, legL, legR, staff: arms[1], kind: 'hero' };
  return g;
}

registerSkin('giant', giant);

// ------------------------------------------------------------ rock golem

function rockGolem() {
  const g = new THREE.Group();
  g.add(blobShadow(1.0, 0.35));
  const body = new THREE.Group();
  g.add(body);
  const rock = stoneMat('#c8bca8');
  const dark = stoneMat('#8a8478');
  const rune = glow('#ffb040');
  const legs = [];
  for (const s of [1, -1]) {
    const hip = new THREE.Group();
    hip.position.set(0, 0.62, 0.28 * s);
    hip.add(M.mesh(M.blob(0.2, 0.3, 0.2, { seed: 80 + s }), rock, 0, -0.25, 0));
    hip.add(M.mesh(M.blob(0.26, 0.14, 0.24, { seed: 82 }), rock, 0.06, -0.52, 0));
    legs.push(hip);
    body.add(hip);
  }
  body.add(M.mesh(M.blob(0.5, 0.42, 0.55, { seed: 83, amt: 0.12, freq: 3 }), rock, 0, 1.15, 0));
  body.add(M.mesh(M.blob(0.62, 0.36, 0.7, { seed: 84, amt: 0.14, freq: 3 }), rock, -0.05, 1.6, 0));
  // Glowing rune seams on the chest.
  const runes = new THREE.Group();
  runes.add(M.mesh(M.tube([[0.45, 1.75, -0.2], [0.55, 1.55, 0], [0.45, 1.35, 0.2]], 0.03, 0.03, 8, 5), rune));
  runes.add(M.mesh(M.tube([[0.5, 1.4, -0.25], [0.52, 1.2, -0.05]], 0.025, 0.025, 4, 5), rune));
  body.add(runes);
  const head = new THREE.Group();
  head.position.set(0.35, 2.0, 0);
  head.add(M.mesh(M.blob(0.22, 0.2, 0.22, { seed: 85 }), dark));
  // Both eyes in one group: one merged mesh whose material turns red on aggro.
  const eyes = new THREE.Group();
  for (const s of [1, -1]) eyes.add(M.mesh(M.scaled(M.G.sphere, 0.045), glow('#ffb040'), 0.19, 0.03, 0.08 * s));
  head.add(eyes);
  body.add(head);
  const arms = [];
  for (const s of [1, -1]) {
    const a = new THREE.Group();
    a.position.set(0.05, 1.75, 0.72 * s);
    a.add(M.mesh(M.blob(0.3, 0.26, 0.28, { seed: 86 }), rock));
    a.add(M.mesh(M.blob(0.18, 0.34, 0.18, { seed: 87 }), rock, 0.08, -0.45, 0.05 * s));
    a.add(M.mesh(M.blob(0.3, 0.3, 0.3, { seed: 88, amt: 0.15 }), rock, 0.15, -0.9, 0.05 * s));
    arms.push(a);
    body.add(a);
  }
  body.scale.setScalar(1.15);
  g.userData = { body, legs, arms, eyes };
  return g;
}

registerView('rockgolem', {
  make(e, world, v) {
    const o = bakeView(rockGolem());
    v.parts = o.userData;
    return o;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    const moving = !!b.mv;
    v.walk = (v.walk || 0) + dt * (moving ? 8 : 0);
    P.body.position.y = moving ? Math.abs(Math.sin(v.walk)) * 0.07 : 0;
    P.legs.forEach((l, i) => (l.rotation.z = moving ? Math.sin(v.walk + i * Math.PI) * 0.5 : 0));
    // Both fists come down together on the swing.
    v.swingK = Math.max(0, Math.min(1, (v.swingK || 0) + dt * (b.sw ? 2.5 : -4)));
    const lift = v.swingK < 0.75 ? v.swingK * 2.2 : 1.65 - (v.swingK - 0.75) * 12;
    P.arms.forEach((arm, i) => (arm.rotation.z = moving && !b.sw ? Math.sin(v.walk + i * Math.PI) * 0.3 : Math.max(-0.4, lift)));
    if (v.ag !== !!b.ag) {
      v.ag = !!b.ag;
      const m = glow(v.ag ? '#ff4020' : '#ffb040');
      for (const e of P.eyes.children) if (e.isMesh) e.material = m;
    }
    if (b.sw && !v.dusted && v.swingK > 0.9) {
      v.dusted = true;
      world.fx.dustCloud(v.x + Math.cos(v.f) * 1.3, v.z + Math.sin(v.f) * 1.3, 0.5, '#8a8070', 4);
    }
    if (!b.sw) v.dusted = false;
    if (moving && emit(v, 'grit', 4, dt)) world.fx.dustCloud(v.x, v.z, 0.3, '#6a6458', 1);
  },
});

registerEvent('rgswing', () => {});

// Taunt: a red roar ring out to the 450 u radius.
registerEvent('taunt', (e, world) => {
  world.fx.shockwave(e.x, e.y, e.r, '#ff5030', 0.6);
  world.fx.ring(e.x, e.y, e.r, '#ff7040', 0.7);
  world.fx.burst(e.x, 3.2, e.y, '#ff8050', { n: 30, speed: 5, size: 0.6, life: 0.5, up: 0.4 });
  world.fx.text(e.x, 5, e.y, 'Taunt!', '#ff8060', true);
  world.shake = 0.15;
  play('shove');
});
