// The Polymorph Ring (#9): the Sorceress skin, the Ancient Sasquatches (and
// the sheep they turn into), the mass-teleport mark in the centre and the
// octagonal stone room.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerTheme, registerMapBuilder } from '../../engine/client/render/registry.js';
import { cliffField, cliffMaterial, circleOfPower, emit } from './lib-f-cliffs.js';
import { skinMat } from './lib-f-units.js';

// ------------------------------------------------------------ sorceress

// The WC3 Sorceress: a hovering human mage in a white robe with a deep
// team-coloured mantle, golden hair, a tall staff with a glowing orb.
function sorceress(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const robe = M.mat('#eceaf4', { roughness: 0.7 });
  const team = M.mat(color, { roughness: 0.55, emissive: color, emissiveIntensity: 0.12 });
  const gold = M.goldMat();
  // Robe: a long bell that hovers clear of the ground.
  const skirt = new THREE.Group();
  skirt.position.y = 0.95;
  skirt.add(M.mesh(M.lathe([[0.001, 0], [0.24, 0], [0.3, -0.35], [0.42, -0.75], [0.36, -0.8], [0.001, -0.78]], 14), robe));
  body.add(skirt);
  body.add(M.mesh(M.lathe([[0.001, 0.9], [0.24, 0.92], [0.26, 1.15], [0.2, 1.38], [0.12, 1.45], [0.001, 1.46]], 14), robe));
  // Team-coloured mantle over the shoulders and a hem band.
  body.add(M.mesh(M.lathe([[0.001, 1.25], [0.3, 1.25], [0.31, 1.33], [0.2, 1.44], [0.001, 1.46]], 14), team));
  body.add(M.mesh(new THREE.TorusGeometry(0.4, 0.035, 5, 18).rotateX(Math.PI / 2), team, 0, 0.2, 0));
  body.add(M.mesh(new THREE.TorusGeometry(0.25, 0.03, 5, 16).rotateX(Math.PI / 2), gold, 0, 0.95, 0));
  const back = M.mesh(M.cloth(0.5, 0.95, 0.12, 0.2), M.mat(color, { roughness: 0.6, side: THREE.DoubleSide }), -0.22, 0.92, 0);
  body.add(back);
  // Head and long golden hair.
  body.add(M.mesh(M.scaled(M.G.sphere, 0.13, 0.15, 0.13), skinMat(), 0.03, 1.6, 0));
  const hair = M.mat('#f0c860', { roughness: 0.55 });
  body.add(M.mesh(M.blob(0.15, 0.13, 0.15, { seed: 91, amt: 0.08, detail: 1 }), hair, -0.03, 1.66, 0));
  body.add(M.mesh(M.tube([[-0.06, 1.66, 0], [-0.16, 1.5, 0], [-0.2, 1.3, 0]], 0.12, 0.05, 5, 8), hair));
  body.add(M.mesh(new THREE.TorusGeometry(0.135, 0.018, 4, 14).rotateX(Math.PI / 2), gold, 0.0, 1.7, 0));
  body.add(M.mesh(M.scaled(M.G.sphere, 0.04), M.glowMat('#7fd0ff'), 0.13, 1.72, 0));
  // Arms.
  const armL = new THREE.Group();
  armL.position.set(0.02, 1.38, 0.24);
  armL.add(M.mesh(M.tube([[0, 0, 0], [0.12, -0.18, 0.04], [0.25, -0.28, 0.02]], 0.07, 0.05, 4, 6), robe));
  armL.add(M.mesh(M.scaled(M.G.sphere, 0.05), skinMat(), 0.27, -0.29, 0.02));
  body.add(armL);
  // The staff, held in the right hand.
  const staff = new THREE.Group();
  staff.position.set(0.18, 1.1, -0.28);
  staff.add(M.mesh(M.tube([[0, -0.95, 0], [0.02, 0, 0], [0, 0.7, 0]], 0.03, 0.025, 4, 6), M.barkMat()));
  staff.add(M.mesh(M.lathe([[0.001, 0.62], [0.08, 0.68], [0.05, 0.76]], 8), gold));
  const orb = M.mesh(M.scaled(M.G.sphere, 0.1), M.glowMat('#8fd8ff'), 0, 0.82, 0);
  staff.add(orb);
  body.add(staff);
  body.add(M.mesh(M.tube([[0.02, 1.38, -0.24], [0.1, 1.24, -0.28], [0.18, 1.12, -0.28]], 0.07, 0.05, 4, 6), robe));
  body.scale.setScalar(1.4);
  g.userData = {
    body,
    staff,
    anim: [skirt, back, armL, orb],
    kind: 'hero',
    // Hover (sorceresses never touch the ground) and let the robe sway.
    tick(dt, v, b, world) {
      const t = world.time + (v.id % 7);
      if (!b.dead) body.position.y = 0.12 + Math.sin(t * 2.2) * 0.05;
      skirt.rotation.z = b.mv ? 0.12 : Math.sin(t * 1.5) * 0.03;
      back.rotation.z = b.mv ? -0.25 : -0.05 + Math.sin(t * 1.7) * 0.04;
      armL.rotation.z = b.fx?.includes('casting') ? 0.9 : 0;
      orb.scale.setScalar(1 + Math.sin(t * 5) * 0.15);
    },
  };
  return g;
}
registerSkin('sorceress', sorceress);

// ------------------------------------------------------------ sasquatch

// An Ancient Sasquatch: a hulking white-grey ape with a dark face, long
// arms and knuckles to the ground.
function sasquatch() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const fur = M.triMat('tex_fur.webp', '#a8b0b8', '#f0f4ff', 1.6);
  const face = M.mat('#4a3c40', { roughness: 0.8 });
  body.add(M.mesh(M.blob(0.75, 0.85, 0.8, { seed: 141, amt: 0.1, detail: 2 }), fur, -0.05, 1.45, 0));
  body.add(M.mesh(M.blob(0.55, 0.5, 0.75, { seed: 142, amt: 0.1, detail: 2 }), fur, 0.25, 1.95, 0));
  const head = new THREE.Group();
  head.position.set(0.6, 2.05, 0);
  head.add(M.mesh(M.blob(0.32, 0.3, 0.3, { seed: 143, amt: 0.08, detail: 2 }), fur));
  head.add(M.mesh(M.blob(0.2, 0.17, 0.22, { seed: 144, amt: 0.05, detail: 1 }), face, 0.2, -0.06, 0));
  for (const s of [1, -1]) head.add(M.mesh(M.scaled(M.G.sphere, 0.04), M.glowMat('#ffd040'), 0.3, 0.06, 0.09 * s));
  body.add(head);
  const arms = [];
  for (const s of [1, -1]) {
    const sh = new THREE.Group();
    sh.position.set(0.3, 1.95, 0.7 * s);
    sh.add(M.mesh(M.tube([[0, 0, 0], [0.15, -0.6, 0.12 * s], [0.25, -1.3, 0.05 * s]], 0.28, 0.2, 6, 8), fur));
    sh.add(M.mesh(M.blob(0.22, 0.17, 0.2, { seed: 145, detail: 1 }), face, 0.28, -1.42, 0.05 * s));
    body.add(sh);
    arms.push(sh);
  }
  const legs = [];
  for (const s of [1, -1]) {
    const hip = new THREE.Group();
    hip.position.set(-0.2, 0.95, 0.35 * s);
    hip.add(M.mesh(M.tube([[0, 0, 0], [0.08, -0.45, 0], [0, -0.85, 0]], 0.28, 0.2, 5, 8), fur));
    hip.add(M.mesh(M.blob(0.25, 0.1, 0.18, { seed: 146, detail: 1 }), face, 0.1, -0.9, 0));
    body.add(hip);
    legs.push(hip);
  }
  body.scale.setScalar(0.8);
  return { g, body, head, arms, legs };
}

function sheep() {
  const g = new THREE.Group();
  const wool = M.mat('#f4f2ec', { roughness: 0.95 });
  const dark = M.mat('#2a2420', { roughness: 0.8 });
  g.add(M.mesh(M.blob(0.5, 0.38, 0.38, { seed: 151, amt: 0.14, detail: 2 }), wool, 0, 0.7, 0));
  g.add(M.mesh(M.blob(0.18, 0.15, 0.13, { seed: 152, detail: 1 }), dark, 0.52, 0.82, 0));
  for (const s of [1, -1]) {
    g.add(M.mesh(M.scaled(M.G.sphere, 0.1, 0.04, 0.06), dark, 0.42, 0.88, 0.15 * s));
    for (const x of [0.25, -0.25]) g.add(M.mesh(M.tube([[x, 0.4, 0.18 * s], [x, 0.0, 0.18 * s]], 0.05, 0.045, 2, 6), dark));
  }
  return g;
}

registerView('sasquatch', {
  unit: true,
  make(e, world, v) {
    const g = new THREE.Group();
    const s = sasquatch();
    const sh = sheep();
    sh.visible = false;
    g.add(s.g, sh);
    v.parts = { ...s, sheep: sh };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const p = v.parts;
    const isSheep = !!b.sh;
    if (isSheep !== v.wasSheep) {
      v.wasSheep = isSheep;
      p.g.visible = !isSheep;
      p.sheep.visible = isSheep;
    }
    const moving = b.mv && !b.dead;
    v.walk = (v.walk || 0) + dt * (moving ? (b.sl ? 4 : 9) : 0);
    if (isSheep) {
      p.sheep.position.y = moving ? Math.abs(Math.sin(v.walk * 1.5)) * 0.12 : 0;
      return;
    }
    p.legs.forEach((l, i) => (l.rotation.z = moving ? Math.sin(v.walk + i * Math.PI) * 0.45 : 0));
    const sw = b.sw ?? -1;
    const strike = sw >= 0 ? Math.min(1, sw) : 0;
    p.arms.forEach((l, i) => (l.rotation.z = moving ? Math.sin(v.walk + i * Math.PI + Math.PI) * 0.4 : 0));
    // Both fists come up and smash down on a swing.
    if (strike > 0) p.arms.forEach((l) => (l.rotation.z = -strike * 1.6 + (strike > 0.85 ? 1.4 : 0)));
    p.body.position.y = moving ? Math.abs(Math.sin(v.walk)) * 0.06 : Math.sin(world.time * 1.3) * 0.02;
    p.head.rotation.y = Math.sin(world.time * 0.7 + v.id) * 0.2;
    if (b.sl && emit(v, 'slow', 6, dt)) world.fx.trail(v.x, 1.2, v.z, '#c03030', 0.4, 0.5, 0.6);
  },
});

// ------------------------------------------------------------ centre

registerView('prcentre', {
  make(e, world, v) {
    const g = circleOfPower('#7fc8ff', 1.6);
    v.parts = g.userData;
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.obj.rotation.y = 0;
    v.parts.rune.rotation.y = world.time * 0.4;
    v.parts.rune.material.opacity = 0.7 + Math.sin(world.time * 2) * 0.2;
    for (let n = emit(v, 'mote', 14, dt); n > 0; n--) {
      const a2 = Math.random() * Math.PI * 2;
      const r = 0.4 + Math.random() * 1.2;
      world.fx.trail(Math.cos(a2) * r, 0.2 + Math.random() * 1.6, Math.sin(a2) * r, '#9fdcff', 0.35, 0.9, 0.05);
    }
  },
});

// ------------------------------------------------------------ spells

registerEvent('prslow', (e, world) => {
  world.fx.bolt(e.x1, e.y1, e.x2, e.y2, '#ff9a9a');
  world.fx.sparks(e.x2, 1.2, e.y2, 12, 3, '#e04040');
  world.fx.ring(e.x2, e.y2, 1.0, '#e04040', 0.5);
});

registerEvent('prinvis', (e, world) => {
  world.fx.burst(e.x, 1.2, e.y, '#d0e8ff', { n: 26, speed: 2.5, size: 0.5, life: 0.7, up: 2 });
});

registerEvent('prpoly', (e, world) => {
  world.fx.burst(e.x, 1.2, e.y, '#ff9af0', { n: 30, speed: 3.5, size: 0.6, life: 0.6 });
  world.fx.smokePuff(e.x, 0.8, e.y, '#f0d8ff', 2, 0.9, 0.5);
  if (e.x1 != null) world.fx.bolt(e.x1, e.y1, e.x, e.y, '#ffb0f8');
});

// ------------------------------------------------------------ arena

// A Lordaeron dungeon floor of worn flagstones.
registerTheme(
  'polyring',
  { sky: '#6a7486', fog: '#7a8496', floor: ['#8e8a80', 35, { tiles: true }], sun: '#fff0dc', hemi: ['#dde8ff', '#404838'] },
  { floor: { tex: 'tex_stone.webp', tint: '#d8d4cc', color: '#8e8a80', units: 4 }, edge: { tex: 'tex_dirt.webp', tint: '#a09888', color: '#7a6040', units: 5 }, outer: { tex: 'tex_dirt.webp', tint: '#8a8070', color: '#5a4a38' }, edgeWidth: 0.8 },
);

registerMapBuilder('polyring', (map, world) => {
  // Cliffs round the room, cutting its corners into an octagon.
  const T = map.half / 20;
  const n = 40;
  const cells = [];
  for (let r = 0; r < n; r++) {
    let row = '';
    for (let c = 0; c < n; c++) {
      const x = (c + 0.5) * T - map.half;
      const y = (r + 0.5) * T - map.half;
      row += Math.abs(x) + Math.abs(y) <= map.oct - T * 0.3 ? '.' : '#';
    }
    cells.push(row);
  }
  const mat = cliffMaterial({ top: 'tex_dirt.webp', topTint: '#9a9080', rockTint: '#a8a094' });
  world.mapGroup.add(cliffField({ cells, T, H: 1.6, ramp: 0.7, margin: 14, res: 0.32, material: mat, lumps: 0.4 }));
  // Torches on the cut corners.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const d = map.oct / Math.SQRT2 + 0.4;
    const t = M.torch();
    t.position.set(Math.cos(a) * (d + 1.2), 1.55, Math.sin(a) * (d + 1.2));
    world.mapGroup.add(t);
    world.animated.push({ type: 'torch', obj: t });
  }
});
