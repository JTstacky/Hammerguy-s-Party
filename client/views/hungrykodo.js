// Hungry Hungry Kodos (#13): the player Kodo Beast skin, pigs, children,
// the Regurgitate bolt, the four gates and the walled square.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { cliffField, cliffMaterial, dressWalls, emit } from './lib-f-cliffs.js';
import { skinMat } from './lib-f-units.js';

// ------------------------------------------------------------ kodo

// The WC3 Kodo Beast (okod) at hero-skin budget: the shared kodo's shape
// with lighter blobs, the war drum, and the owner's colour on the saddle
// blanket and banners. Legs, jaw and stun stars are posed in tick().
function hkodo(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const hide = M.hideMat();
  const dark = M.mat('#4a3424', { roughness: 0.9 });
  const bone = M.boneMat();
  const team = M.mat(color, { roughness: 0.75, emissive: color, emissiveIntensity: 0.1 });
  const B = (sx, sy, sz, seed, amt = 0.1) => M.blob(sx, sy, sz, { seed, amt, detail: 2 });
  body.add(M.mesh(B(1.35, 0.9, 0.85, 3, 0.08), hide, 0, 1.2, 0));
  body.add(M.mesh(B(0.75, 0.55, 0.7, 5), hide, 0.45, 1.65, 0));
  const belly = M.mesh(B(0.9, 0.55, 0.7, 6, 0.06), hide, 0, 0.85, 0);
  body.add(belly);
  const head = new THREE.Group();
  head.position.set(1.45, 1.1, 0);
  head.add(M.mesh(B(0.6, 0.5, 0.52, 7), hide));
  head.add(M.mesh(B(0.4, 0.3, 0.36, 11), hide, 0.45, -0.18, 0));
  head.add(M.mesh(M.scaled(M.G.sphere, 0.2, 0.08, 0.22), M.mat('#6a1a18', { roughness: 0.5 }), 0.4, -0.33, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.scaled(M.G.sphere, 0.07), M.mat('#120c08', { roughness: 0.2 }), 0.33, 0.1, 0.3 * s));
    head.add(M.mesh(B(0.14, 0.05, 0.1, 17), dark, 0.27, 0.19, 0.28 * s));
    head.add(M.mesh(M.tube([[0.1, 0.25, 0.3 * s], [0.1, 0.5, 0.58 * s], [0.35, 0.68, 0.66 * s], [0.6, 0.6, 0.48 * s]], 0.1, 0.012, 10, 8), bone));
    const ear = M.mesh(B(0.2, 0.06, 0.13, 19), hide, -0.15, 0.22, 0.5 * s);
    ear.rotation.x = 0.6 * s;
    head.add(ear);
  }
  const jaw = new THREE.Group();
  jaw.position.set(0.15, -0.35, 0);
  jaw.add(M.mesh(B(0.38, 0.14, 0.3, 13), hide, 0.2, -0.06, 0));
  for (const s of [1, -1]) jaw.add(M.mesh(M.tube([[0.35, -0.08, 0.18 * s], [0.47, 0.1, 0.24 * s], [0.5, 0.25, 0.2 * s]], 0.045, 0.01, 6, 6), bone));
  head.add(jaw);
  body.add(head);
  const hip = (x, z) => {
    const h = new THREE.Group();
    h.position.set(x, 1.0, z);
    h.add(M.mesh(M.tube([[0, 0.1, 0], [0.04, -0.45, 0], [0, -0.9, 0]], 0.26, 0.19, 5, 10), hide));
    h.add(M.mesh(B(0.24, 0.1, 0.24, 23), dark, 0.06, -0.92, 0));
    body.add(h);
    return h;
  };
  const legL = hip(0.75, 0.45);
  const legR = hip(0.75, -0.45);
  const rearL = hip(-0.8, 0.45);
  const rearR = hip(-0.8, -0.45);
  const tail = new THREE.Group();
  tail.position.set(-1.3, 1.35, 0);
  tail.add(M.mesh(M.tube([[0, 0, 0], [-0.3, -0.25, 0], [-0.42, -0.65, 0]], 0.09, 0.03, 6, 6), hide));
  tail.add(M.mesh(B(0.1, 0.16, 0.1, 29), dark, -0.43, -0.75, 0));
  body.add(tail);
  // Harness: the owner's blanket, a girth strap, the war drum and banners.
  body.add(M.mesh(M.blob(0.75, 0.13, 0.85, { seed: 31, amt: 0.04, detail: 2 }), team, -0.1, 2.0, 0));
  const girth = M.mesh(new THREE.TorusGeometry(0.95, 0.05, 5, 22), M.leatherMat(), -0.1, 1.2, 0);
  girth.rotation.y = Math.PI / 2;
  girth.scale.set(1, 0.95, 0.9);
  body.add(girth);
  body.add(M.mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.45, 16), M.leatherMat(), -0.35, 2.32, 0));
  body.add(M.mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.02, 16), M.mat('#d8c4a0'), -0.35, 2.56, 0));
  for (const s of [1, -1]) {
    body.add(M.mesh(M.tube([[-0.7, 1.9, 0.3 * s], [-0.72, 2.6, 0.32 * s], [-0.74, 3.1, 0.34 * s]], 0.025, 0.02, 3, 5), M.mat('#4a3020')));
    const flag = M.mesh(M.cloth(0.3, 0.5, 0.02, 0.08), M.mat(color, { roughness: 0.75, side: THREE.DoubleSide }), -0.74, 2.8, 0.34 * s);
    flag.rotation.y = Math.PI / 2;
    body.add(flag);
  }
  // Stun: little stars wheeling over the head.
  const stars = new THREE.Group();
  stars.position.set(1.5, 2.2, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    stars.add(M.mesh(new THREE.OctahedronGeometry(0.1), M.glowMat('#ffe860'), Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4));
  }
  stars.visible = false;
  body.add(stars);
  body.scale.setScalar(0.55);
  g.userData = {
    body,
    legL,
    legR,
    anim: [head, jaw, rearL, rearR, tail, stars, belly],
    kind: 'hero',
    tick(dt, v, b, world) {
      // Diagonal gait: each rear leg moves with the opposite front leg.
      rearL.rotation.z = legR.rotation.z;
      rearR.rotation.z = legL.rotation.z;
      const t = world.time + v.id;
      tail.rotation.x = Math.sin(t * 2) * 0.25;
      const full = b.fx?.includes('full');
      const stun = b.fx?.includes('stun');
      // Chewing while digesting, a swollen belly, stars when stunned.
      jaw.rotation.z = full ? -Math.abs(Math.sin(t * 7)) * 0.35 : (b.fx?.includes('casting') ? -0.5 : 0);
      belly.scale.setScalar(full ? 1.15 : 1);
      head.rotation.z = stun ? Math.sin(t * 6) * 0.12 : 0;
      stars.visible = !!stun && !b.dead;
      if (stars.visible) stars.rotation.y = t * 5;
    },
  };
  return g;
}
registerSkin('hkodo', hkodo);

// ------------------------------------------------------------ food

function pigModel() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const pink = M.mat('#f0a8a0', { roughness: 0.6 });
  const dark = M.mat('#c07070', { roughness: 0.6 });
  body.add(M.mesh(M.blob(0.42, 0.3, 0.3, { seed: 181, amt: 0.05, detail: 2 }), pink, 0, 0.42, 0));
  body.add(M.mesh(M.blob(0.22, 0.2, 0.2, { seed: 182, amt: 0.04, detail: 1 }), pink, 0.42, 0.5, 0));
  body.add(M.mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.08, 10).rotateZ(Math.PI / 2), dark, 0.64, 0.47, 0));
  for (const s of [1, -1]) {
    const ear = M.mesh(M.scaled(M.G.cone, 0.08, 0.14, 0.05), dark, 0.4, 0.7, 0.11 * s);
    ear.rotation.x = 0.4 * s;
    body.add(ear);
    body.add(M.mesh(M.scaled(M.G.sphere, 0.03), M.mat('#140c0c'), 0.58, 0.58, 0.08 * s));
  }
  body.add(M.mesh(M.tube([[-0.42, 0.5, 0], [-0.52, 0.58, 0.05], [-0.5, 0.66, -0.04]], 0.025, 0.015, 6, 4), pink));
  const legs = [];
  for (const [x, z] of [[0.22, 0.14], [-0.22, -0.14], [0.22, -0.14], [-0.22, 0.14]]) {
    const h = new THREE.Group();
    h.position.set(x, 0.25, z);
    h.add(M.mesh(M.tube([[0, 0, 0], [0, -0.25, 0]], 0.07, 0.06, 2, 6), pink));
    body.add(h);
    legs.push(h);
  }
  body.scale.setScalar(1.25);
  return { g, body, legs };
}

function childModel() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shirt = M.mat('#5a8ac8', { roughness: 0.8 });
  const pants = M.mat('#7a5a38', { roughness: 0.85 });
  const legs = [];
  for (const s of [1, -1]) {
    const h = new THREE.Group();
    h.position.set(0, 0.36, 0.08 * s);
    h.add(M.mesh(M.tube([[0, 0, 0], [0, -0.34, 0]], 0.06, 0.055, 2, 6), pants));
    body.add(h);
    legs.push(h);
  }
  body.add(M.mesh(M.lathe([[0.001, 0.32], [0.16, 0.34], [0.16, 0.6], [0.001, 0.68]], 10), shirt));
  body.add(M.mesh(M.scaled(M.G.sphere, 0.15), skinMat(), 0.02, 0.82, 0));
  body.add(M.mesh(M.scaled(M.G.sphere, 0.155, 0.1, 0.155), M.mat('#e8c060', { roughness: 0.8 }), -0.01, 0.89, 0));
  for (const s of [1, -1]) body.add(M.mesh(M.tube([[0, 0.62, 0.17 * s], [0.06, 0.45, 0.2 * s]], 0.05, 0.04, 2, 5), shirt));
  body.scale.setScalar(1.3);
  return { g, body, legs };
}

function foodView(build) {
  return {
    unit: true,
    make(e, world, v) {
      const m = build();
      v.parts = m;
      return m.g;
    },
    update(v, a, b, k, dt) {
      const p = v.parts;
      const moving = !!b.mv;
      v.walk = (v.walk || Math.random() * 6) + dt * (moving ? 14 : 0);
      p.legs.forEach((l, i) => (l.rotation.z = moving ? Math.sin(v.walk + (i % 2) * Math.PI) * 0.6 : 0));
      p.body.position.y = moving ? Math.abs(Math.sin(v.walk)) * 0.05 : 0;
    },
  };
}
registerView('hkpig', foodView(pigModel));
registerView('hkchild', foodView(childModel));

// Regurgitate: a slimy green bolt.
registerView('hkbolt', {
  make() {
    const g = new THREE.Group();
    g.add(M.mesh(M.blob(0.3, 0.22, 0.22, { seed: 191, amt: 0.2, detail: 2 }), M.mat('#80c040', { roughness: 0.25, emissive: '#2a4a10' })));
    g.position.y = 1.4;
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.obj.position.y = 1.4;
    v.obj.rotation.z += dt * 10;
    for (let n = emit(v, 'drip', 30, dt); n > 0; n--) world.fx.trail(v.x, 1.4, v.z, Math.random() < 0.5 ? '#a0e050' : '#608a20', 0.45, 0.4, 0.12);
  },
});

registerEvent('hkbolthit', (e, world) => {
  world.fx.burst(e.x, 1.3, e.y, '#90d040', { n: 24, speed: 4, size: 0.6, life: 0.5, grav: 8, additive: false });
  world.fx.ring(e.x, e.y, 1.3, '#90d040', 0.4);
});
registerEvent('hkgulp', (e, world) => {
  world.fx.burst(e.x, 0.6, e.y, '#c04040', { n: 10, speed: 2.5, size: 0.35, life: 0.4, additive: false });
});
registerEvent('hkheal', (e, world) => {
  world.fx.text(e.x, 2.6, e.y, e.s || '+50', '#40ff60', true);
  world.fx.burst(e.x, 1.2, e.y, '#60ff80', { n: 14, speed: 2, size: 0.4, life: 0.6, up: 2 });
});
registerEvent('hkmana', (e, world) => {
  world.fx.text(e.x, 2.6, e.y, '+100 mana', '#60a0ff', true);
  world.fx.burst(e.x, 1.2, e.y, '#6aa8ff', { n: 14, speed: 2, size: 0.4, life: 0.6, up: 2 });
});

// ------------------------------------------------------------ gates

let gateGeo = null;
registerView('hkgates', {
  make(e, world, v) {
    const g = new THREE.Group();
    const wood = M.texMat('tex_wood.webp', '#6a4428', '#e8d8c8');
    const iron = M.mat('#3a3a3c', { metalness: 0.6, roughness: 0.45 });
    const T = 128 / 54; // one WC3 tile
    const R = 4 * T;
    v.doors = [];
    // N, S, E, W: each gate is two doors hinged at the posts.
    for (const [cx, cz, ang] of [[0, -R, 0], [0, R, Math.PI], [R, 0, -Math.PI / 2], [-R, 0, Math.PI / 2]]) {
      const gate = new THREE.Group();
      gate.position.set(cx, 0, cz);
      gate.rotation.y = ang;
      for (const s of [1, -1]) {
        const hinge = new THREE.Group();
        hinge.position.set(T * s, 0, 0);
        const door = M.mesh(gateGeo ||= M.scaled(M.G.box, T, 1.6, 0.16), wood, -T * 0.5 * s, 0.8, 0);
        hinge.add(door);
        for (const y of [0.35, 1.25]) hinge.add(M.mesh(M.scaled(M.G.box, T * 0.96, 0.1, 0.2), iron, -T * 0.5 * s, y, 0));
        hinge.userData.s = s;
        gate.add(hinge);
        v.doors.push(hinge);
      }
      g.add(gate);
    }
    v.open = 0;
    return g;
  },
  update(v, a, b, k, dt) {
    v.obj.position.set(0, 0, 0);
    v.obj.rotation.y = 0;
    v.open = Math.min(1, Math.max(0, v.open + dt * (b.open ? 0.8 : -2)));
    // The doors swing outward, away from the arena.
    for (const d of v.doors) d.rotation.y = d.userData.s * v.open * 1.5;
  },
});

// ------------------------------------------------------------ arena

registerMapBuilder('hungrykodo', (map, world) => {
  const cells = map.grid;
  const T = map.T;
  const solid = (ch) => ch === '#';
  const mat = cliffMaterial({ top: 'tex_grass.webp', topTint: '#b0b890', rockTint: '#a89c8c' });
  world.mapGroup.add(cliffField({ cells, T, solid, H: 1.7, ramp: 0.45, margin: 6, res: 0.3, material: mat }));
  // Wall-top doodads and the gate posts: static scenery, merged per material.
  const deco = new THREE.Group();
  dressWalls(deco, { cells, T, solid, H: 1.7, density: 0.3, trees: 0.25, seed: 13 });
  // Stone gate posts.
  const stone = M.texMat('tex_stone.webp', '#9a968c', '#e0dcd4', 1);
  const R = 4 * T;
  for (const [cx, cz, ax] of [[0, -R, 1], [0, R, 1], [R, 0, 0], [-R, 0, 0]]) {
    for (const s of [1, -1]) {
      const x = cx + (ax ? T * s * 1.08 : 0);
      const z = cz + (ax ? 0 : T * s * 1.08);
      deco.add(M.mesh(M.scaled(M.G.box, 0.45, 2.1, 0.45), stone, x, 1.05, z));
      deco.add(M.mesh(M.scaled(M.G.box, 0.6, 0.2, 0.6), stone, x, 2.15, z));
    }
  }
  bakeStatic(deco);
  world.mapGroup.add(deco);
});

// A kodo starves (or is finished off by a bolt) and collapses.
registerEvent('hkstarve', (e, world) => {
  world.fx.dustCloud(e.x, e.y, 1.4, '#8a7a60', 10);
  for (let i = 0; i < 3; i++) world.fx.smokePuff(e.x, 0.6, e.y, '#6a5a48', 1.4, 1.4, 0.4);
});
