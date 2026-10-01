// Uther Party #41 Ancient Punisher: a glade under a racing day/night clock,
// Dark Rangers (hero skin), the Ancient Protector that roots and uproots, the
// item sacks, and the lighting that follows the time of day.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerTheme, registerMapBuilder } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { bakeView, bakeScenery, clothMat, blobShadow, itemSack, pine, emit, glow, disposeOwn } from './d-kit.js';

registerTheme('ancient',
  { sky: '#88aacc', fog: '#9fb8c8', floor: ['#4f7a34', 40, { blades: true }], sun: '#fff2d8', hemi: ['#cfe6ff', '#3a4a20'] },
  {
    floor: { tex: 'tex_grass.webp', tint: '#c8dcb0', color: '#4f7a34', units: 8 },
    edge: { tex: 'tex_dirt.webp', tint: '#a89c84', color: '#6a5a40', units: 5 },
    outer: { tex: 'tex_nightgrass.webp', tint: '#a0b0a0', color: '#2a4028', units: 11 },
    edgeWidth: 1.1,
  });

registerMapBuilder('ancient', (map, world) => {
  const scen = new THREE.Group(); // static scenery, merged per material
  const H = map.half;
  // The four standing stones.
  for (const [x, y] of map.stones) {
    const g = new THREE.Group();
    g.add(M.mesh(M.blob(0.75, 1.3, 0.6, { seed: Math.floor(Math.abs(x * 7 + y * 3)) + 1, amt: 0.1 }), M.triMat('tex_boulder.webp', '#77746e', '#c0c4b8', 0.9), 0, 1.0, 0));
    g.add(M.mesh(M.blob(0.5, 0.25, 0.45, { seed: 7, amt: 0.2, freq: 4 }), M.triMat('tex_needles.webp', '#3b5a30', '#b8d0a0', 1.8), 0.1, 2.15, 0));
    g.position.set(x, 0, y);
    g.rotation.y = Math.random() * 6;
    scen.add(g);
  }
  // Ashenvale forest round the glade; rocks in the cut corners.
  const needles = M.texMat('tex_needles.webp', '#2f5a2a', '#9ac090', 1, { roughness: 0.95 });
  for (let a = -H - 2; a <= H + 2; a += 2) {
    for (const off of [2, 4.4]) {
      for (const [x, z] of [[a, -H - off], [a, H + off], [-H - off, a], [H + off, a]]) {
        const t = pine(0.95 + Math.random() * 0.5, needles);
        t.position.set(x + (Math.random() - 0.5) * 1.2, 0, z + (Math.random() - 0.5) * 1.2);
        scen.add(t);
      }
    }
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const r = M.rock(0.6 + Math.random() * 0.4);
      r.position.set(sx * (H - 0.7 - Math.random()), 0, sy * (H - 0.7 - Math.random()));
      scen.add(r);
    }
  }
  world.mapGroup.add(bakeScenery(scen));
});

// ------------------------------------------------------------ dark ranger

function ranger(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = M.mat('#b8a8c8', { roughness: 0.55 });
  const armor = M.leatherMat('#6a5a78');
  const team = clothMat(color);
  const teamDark = clothMat(color, 0.45);
  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(0, 0.62, 0.1 * s);
    hip.add(M.mesh(M.tube([[0, 0, 0], [0.03, -0.3, 0], [0, -0.56, 0]], 0.075, 0.05, 6, 8), armor));
    hip.add(M.mesh(M.blob(0.11, 0.05, 0.06, { seed: 3 }), M.mat('#2a2230'), 0.05, -0.58, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  const torso = M.mesh(M.lathe([[0.17, 0.6], [0.2, 0.75], [0.22, 0.95], [0.2, 1.1], [0.12, 1.24], [0.06, 1.28]], 18), armor);
  torso.scale.z = 1.1;
  const belt = M.mesh(new THREE.TorusGeometry(0.19, 0.03, 6, 20).rotateX(Math.PI / 2), M.mat('#c0c4cc', { metalness: 0.7, roughness: 0.3 }), 0, 0.72, 0);
  // Hooded cloak in team colour.
  const cloak = M.mesh(M.cloth(0.6, 1.15, 0.24, 0.3), teamDark, -0.2, 0.72, 0);
  const mantle = M.mesh(M.blob(0.22, 0.1, 0.3, { seed: 4 }), team, -0.02, 1.2, 0);
  const head = new THREE.Group();
  head.position.set(0.03, 1.38, 0);
  head.add(M.mesh(M.blob(0.11, 0.13, 0.1, { seed: 5 }), skin));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.tube([[0, 0.02, 0.08 * s], [-0.06, 0.08, 0.16 * s], [-0.14, 0.14, 0.2 * s]], 0.025, 0.004, 6, 6), skin));
    head.add(M.mesh(M.scaled(M.G.sphere, 0.022), glow('#ff4060'), 0.1, 0.02, 0.045 * s));
  }
  // Hood.
  head.add(M.mesh(M.lathe([[0.15, -0.1], [0.17, 0.04], [0.15, 0.15], [0.08, 0.24], [0.01, 0.26]], 16), clothMat(color, 0.7), -0.03, 0, 0));
  // Silver hair spilling from the hood.
  head.add(M.mesh(M.tube([[-0.1, 0.05, 0], [-0.2, -0.1, 0], [-0.22, -0.3, 0]], 0.07, 0.02, 6, 6), M.mat('#dcdce8', { roughness: 0.5 })));
  // A longbow slung across the back.
  const bow = M.mesh(M.tube([[-0.18, 0.4, 0.25], [-0.26, 0.95, 0], [-0.18, 1.5, -0.25]], 0.025, 0.02, 12, 6), M.mat('#2a1a24', { roughness: 0.4 }));
  const armL = M.mesh(M.tube([[0, 1.15, 0.24], [0.06, 0.95, 0.28], [0.1, 0.78, 0.24]], 0.05, 0.04, 6, 8), armor);
  const armR = new THREE.Group();
  armR.add(M.mesh(M.tube([[0, 1.15, -0.24], [0.08, 0.95, -0.28], [0.14, 0.8, -0.24]], 0.05, 0.04, 6, 8), armor));
  body.add(legL, legR, torso, belt, cloak, mantle, head, bow, armL, armR);
  body.scale.setScalar(1.35);
  g.userData = { body, staff: armR, legL, legR, kind: 'hero' };
  return g;
}

registerSkin('ranger', ranger);

// ------------------------------------------------------------ the ancient

function ancientModel() {
  const g = new THREE.Group();
  g.add(blobShadow(3.2, 0.45));
  const body = new THREE.Group();
  g.add(body);
  const bark = M.texMat('tex_bark.webp', '#4a3522', '#c8b8a8', 1);
  const leaves = M.triMat('tex_needles.webp', '#2f5a2a', '#9ad08a', 1.2, { roughness: 0.95 });
  const legs = [];
  for (const s of [1, -1]) {
    const hip = new THREE.Group();
    hip.position.set(0, 1.4, 0.6 * s);
    hip.add(M.mesh(M.tube([[0, 0.2, 0], [0.15, -0.6, 0.15 * s], [0.05, -1.35, 0.2 * s]], 0.36, 0.26, 8, 10), bark));
    for (const a of [-0.8, 0, 0.8]) hip.add(M.mesh(M.tube([[0.05, -1.3, 0.2 * s], [0.4 * Math.cos(a), -1.38, 0.2 * s + 0.4 * Math.sin(a)], [0.75 * Math.cos(a), -1.4, 0.2 * s + 0.7 * Math.sin(a)]], 0.12, 0.03, 6, 6), bark));
    legs.push(hip);
    body.add(hip);
  }
  // Trunk and face.
  const trunk = M.mesh(M.lathe([[0.95, 1.2], [0.85, 1.8], [0.8, 2.6], [0.88, 3.4], [0.95, 4.0], [0.7, 4.5], [0.3, 4.8]], 24), bark);
  trunk.scale.z = 0.9;
  body.add(trunk);
  const eyes = [];
  for (const s of [1, -1]) {
    body.add(M.mesh(M.blob(0.25, 0.1, 0.22, { seed: 9 }), bark, 0.75, 3.6, 0.3 * s));
    const e = M.mesh(M.scaled(M.G.sphere, 0.1, 0.07, 0.1), glow('#e8ff70'), 0.85, 3.45, 0.3 * s);
    eyes.push(e);
    body.add(e);
  }
  body.add(M.mesh(M.scaled(M.G.sphere, 0.28, 0.2, 0.35), M.mat('#140c06'), 0.72, 2.9, 0));
  // Branch arms with twig claws.
  const arms = [];
  for (const s of [1, -1]) {
    const a = new THREE.Group();
    a.position.set(0.1, 3.9, 0.85 * s);
    a.add(M.mesh(M.tube([[0, 0, 0], [0.5, -0.4, 0.4 * s], [1.1, -1.2, 0.5 * s], [1.4, -2.0, 0.35 * s]], 0.25, 0.1, 12, 8), bark));
    for (const f of [-1, 0, 1]) a.add(M.mesh(M.tube([[1.4, -2.0, 0.35 * s], [1.7, -2.2, 0.35 * s + f * 0.2], [1.95, -2.2, 0.35 * s + f * 0.35]], 0.08, 0.015, 6, 6), bark));
    a.add(M.mesh(M.blob(0.45, 0.3, 0.4, { seed: 10 + (s > 0 ? 0 : 1), amt: 0.2, freq: 4 }), leaves, 0.6, -0.3, 0.5 * s));
    arms.push(a);
    body.add(a);
  }
  // A crown of foliage.
  const crown = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    crown.add(M.mesh(M.blob(0.9, 0.6, 0.9, { seed: 20 + i, amt: 0.18, freq: 3.5 }), leaves, Math.cos(a) * 0.8 - 0.3, 5.0 + Math.sin(i * 2.1) * 0.2, Math.sin(a) * 0.8));
  }
  crown.add(M.mesh(M.blob(1.1, 0.8, 1.1, { seed: 30, amt: 0.15, freq: 3 }), leaves, -0.3, 5.6, 0));
  body.add(crown);
  // Roots that spread into the ground while it is rooted.
  const roots = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.2;
    roots.add(M.mesh(M.tube([[0, 0.05, 0], [Math.cos(a) * 1.4, 0.15, Math.sin(a) * 1.4], [Math.cos(a) * 2.8, 0.02, Math.sin(a) * 2.8 + 0.3]], 0.22, 0.04, 10, 6), bark));
  }
  g.add(roots);
  body.scale.setScalar(1.25);
  g.userData = { body, legs, arms, eyes, roots, crown };
  return g;
}

registerView('ancient', {
  make(e, world, v) {
    const o = bakeView(ancientModel());
    v.parts = o.userData;
    return o;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    const rooted = b.m === 'rooted' || b.m === 'rooting';
    // Roots grow out as it roots and pull back in as it uproots.
    const target = rooted ? 1 : 0;
    v.rootK = (v.rootK ?? 1) + (target - (v.rootK ?? 1)) * Math.min(1, dt * (rooted ? 1.5 : 3));
    P.roots.scale.setScalar(0.05 + v.rootK * 0.95);
    P.roots.visible = v.rootK > 0.06;
    P.body.position.y = -v.rootK * 0.5;
    const moving = !!b.mv;
    v.walk = (v.walk || 0) + dt * (moving ? 5 : 0);
    P.legs.forEach((l, i) => (l.rotation.z = moving ? Math.sin(v.walk + i * Math.PI) * 0.35 : 0));
    P.body.rotation.x = moving ? Math.sin(v.walk) * 0.05 : 0;
    // Swing: the right branch arm sweeps down.
    v.swingK = Math.max(0, Math.min(1, (v.swingK || 0) + dt * (b.sw ? 2.5 : -4)));
    P.arms[1].rotation.z = v.swingK < 0.8 ? v.swingK * 1.2 : 0.96 - (v.swingK - 0.8) * 7;
    P.arms[0].rotation.z = rooted ? Math.sin(world.time * 0.8) * 0.05 : moving ? Math.sin(v.walk) * 0.2 : 0;
    P.crown.rotation.y = Math.sin(world.time * 0.6) * 0.04;
    const hunting = b.m === 'hunt' || b.m === 'uproot';
    const eye = glow(hunting ? '#ff5020' : '#e8ff70');
    for (const e of P.eyes) e.material = eye;
    if (moving && emit(v, 'dust', 6, dt)) world.fx.dustCloud(v.x - Math.cos(v.f) * 1.5, v.z - Math.sin(v.f) * 1.5, 0.8, '#7a6a50', 2);
    if (hunting && emit(v, 'leaf', 3, dt)) world.fx.trail(v.x + (Math.random() - 0.5) * 3, 6, v.z + (Math.random() - 0.5) * 3, '#8ad060', 0.35, 1.5, 0.3);
  },
});

registerView('apsack', {
  make(e, world, v) {
    const o = bakeView(itemSack());
    v.parts = o.userData;
    return o;
  },
  update(v, a, b, k, dt, world) {
    v.parts.ring.material.opacity = 0.25 + Math.sin(world.time * 3 + v.id) * 0.1;
  },
  remove(v) {
    disposeOwn(v.obj);
  },
});

// The time of day drives the light: WC3's day and night lighting, one hour per second.
function daylight(h) {
  const d = ((h % 24) + 24) % 24;
  if (d >= 7 && d <= 17) return 1;
  if (d >= 19 || d <= 5) return 0;
  return d < 12 ? (d - 5) / 2 : (19 - d) / 2;
}
const DAY = { sky: new THREE.Color('#88aacc'), fog: new THREE.Color('#9fb8c8'), sun: new THREE.Color('#fff2d8'), hemi: new THREE.Color('#cfe6ff'), ground: new THREE.Color('#3a4a20') };
const NIGHT = { sky: new THREE.Color('#0a1226'), fog: new THREE.Color('#0e1830'), sun: new THREE.Color('#8ea8ff'), hemi: new THREE.Color('#4a5898'), ground: new THREE.Color('#0c1010') };
const tmp = new THREE.Color();

registerView('apclock', {
  make() {
    return new THREE.Group();
  },
  update(v, a, b, k, dt, world) {
    const h = lerpH(a.h ?? b.h, b.h, k);
    const L = daylight(h);
    const mix = (key) => tmp.copy(NIGHT[key]).lerp(DAY[key], L);
    world.scene.background?.copy?.(mix('sky'));
    world.scene.fog?.color.copy(mix('fog'));
    world.sun.color.copy(mix('sun'));
    world.sun.intensity = 1.3 + L * 1.1;
    world.hemi.color.copy(mix('hemi'));
    world.hemi.groundColor.copy(mix('ground'));
    world.hemi.intensity = 0.8 + L * 0.4;
  },
  remove(v, world) {
    world.hemi.intensity = 1.2;
  },
});

function lerpH(a, b, k) {
  return a + (b - a) * k;
}

registerEvent('apuproot', (e, world) => {
  world.fx.dustCloud(e.x, e.y, 2.2, '#7a6a50', 18);
  world.fx.debrisBurst(e.x, e.y, 14, 6);
  world.fx.shockwave(e.x, e.y, 5, '#c8b890', 0.6);
  world.shake = 0.35;
  world.fx.text(e.x, 8, e.y, 'The Ancient awakens!', '#ff9060', true);
  play('bigboom');
});

registerEvent('aproot', (e, world) => {
  world.fx.dustCloud(e.x, e.y, 1.6, '#7a6a50', 10);
  play('kodo');
});

registerEvent('apswing', () => play('smack'));

registerEvent('apsmash', (e, world) => {
  world.fx.dustCloud(e.x, e.y, 1, '#7a6a50', 10);
  world.fx.debrisBurst(e.x, e.y, 8, 5);
  world.shake = 0.25;
  play('squish');
});

registerEvent('apitems', () => play('coin'));

registerEvent('appick', (e, world) => {
  world.fx.burst(e.x, 0.6, e.y, '#fff0b0', { n: 12, speed: 2, size: 0.4, life: 0.4 });
  if (e.to === world.myId) play('buy');
});

registerEvent('apdispel', (e, world) => {
  world.fx.glow(e.x, 1.2, e.y, '#ffffff', 2.5, 0.4);
  world.fx.sparks(e.x, 1.2, e.y, 12, 3, '#e8f4ff');
});
