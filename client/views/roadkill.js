// Roadkill Challenge (#7): the dwarven Siege Engines patrolling their lanes,
// the dirt roads they wear into the grass, the rocky ridge that splits the
// course, and the Circle of Power at the finish.

import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerMapBuilder } from '../../engine/client/render/registry.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { circleOfPower, animateCircle, cliffBlock, cliffMat, groundStrip, rubble, emit, lerpAngle } from './race-kit.js';

// A dwarven Siege Engine (WC3's steam tank): an iron-plated hull on two
// clanking tracks, a riveted ram plate in front, a boiler and smokestack at
// the back, and a helmeted dwarf peering out of the hatch. Faces +X.
export function siegeEngine() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const iron = M.texMat('tex_plate.webp', '#6a6e76', '#9ca2ac', 1, { metalness: 0.55, roughness: 0.45 });
  const darkIron = M.mat('#2c2c30', { metalness: 0.6, roughness: 0.5 });
  const wood = M.texMat('tex_wood.webp', '#6a4a2a', '#e0c8a8');
  const gold = M.goldMat();
  // Tracks: a closed belt round five road wheels on each side.
  const wheels = [];
  for (const s of [1, -1]) {
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 1.15, 0.42 + Math.sin(a) * 0.36, 0));
    }
    const belt = M.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 48, 0.1, 8, true), darkIron, 0, 0, 0.62 * s);
    belt.scale.set(1, 1, 2.2);
    body.add(belt);
    body.add(M.mesh(M.scaled(M.G.box, 2.1, 0.5, 0.2), darkIron, 0, 0.42, 0.62 * s));
    for (let i = 0; i < 5; i++) {
      const w = new THREE.Group();
      w.position.set(-0.84 + i * 0.42, 0.34, 0.62 * s + 0.12 * s);
      w.add(M.mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16).rotateX(Math.PI / 2), iron));
      w.add(M.mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 10).rotateX(Math.PI / 2), gold, 0, 0, 0.02 * s));
      body.add(w);
      wheels.push(w);
    }
  }
  // Hull: a rounded iron tub with wooden side boards and a rivet line.
  const hull = M.mesh(M.lathe([[0.62, 0], [0.68, 0.1], [0.7, 0.35], [0.62, 0.6], [0.4, 0.72], [0.01, 0.76]], 24), iron, -0.05, 0.62, 0);
  hull.scale.set(1.65, 1, 1.05);
  body.add(hull);
  for (const s of [1, -1]) {
    const board = M.mesh(M.scaled(M.G.box, 1.9, 0.32, 0.05), wood, -0.05, 0.86, 0.72 * s);
    board.rotation.x = 0.12 * s;
    body.add(board);
    for (let i = 0; i < 7; i++) body.add(M.mesh(M.scaled(M.G.sphere, 0.035), gold, -0.9 + i * 0.28, 1.04, 0.73 * s));
  }
  // The ram: a wedge of riveted plate sloping forward, with a gold boss.
  const ram = M.mesh(M.lathe([[0.01, -0.4], [0.3, -0.3], [0.42, 0], [0.3, 0.3], [0.01, 0.4]], 4), iron, 1.2, 0.72, 0);
  ram.rotation.set(0, 0, -Math.PI / 2);
  ram.scale.set(1.35, 0.55, 1.9);
  body.add(ram);
  body.add(M.mesh(M.scaled(M.G.sphere, 0.13), gold, 1.43, 0.72, 0));
  // Boiler, smokestack and a pressure gauge at the back.
  const boiler = M.mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.7, 20).rotateZ(Math.PI / 2), M.mat('#7a4a2a', { metalness: 0.6, roughness: 0.4 }), -1.05, 1.02, 0);
  body.add(boiler);
  for (const x of [-1.3, -0.8]) {
    const band = M.mesh(new THREE.TorusGeometry(0.355, 0.03, 6, 20), gold, x, 1.02, 0);
    band.rotation.y = Math.PI / 2;
    body.add(band);
  }
  const stack = M.mesh(M.lathe([[0.1, 0], [0.09, 0.5], [0.16, 0.62], [0.17, 0.7], [0.13, 0.7]], 14), darkIron, -1.15, 1.25, 0.18);
  body.add(stack);
  // The dwarf: a round helmet with a nose guard and a big red beard.
  const dwarf = new THREE.Group();
  dwarf.position.set(0.25, 1.28, 0);
  dwarf.add(M.mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.12, 20), darkIron, 0, -0.02, 0));
  dwarf.add(M.mesh(M.scaled(M.G.sphere, 0.17), M.mat('#e0b090'), 0.02, 0.14, 0));
  dwarf.add(M.mesh(M.blob(0.12, 0.15, 0.14, { seed: 31 }), M.mat('#b0441e', { roughness: 0.9 }), 0.12, 0.04, 0));
  const helm = M.mesh(new THREE.SphereGeometry(0.19, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), iron, 0, 0.18, 0);
  dwarf.add(helm);
  dwarf.add(M.mesh(M.scaled(M.G.box, 0.03, 0.14, 0.04), gold, 0.18, 0.18, 0));
  for (const s of [1, -1]) dwarf.add(M.mesh(M.tube([[0, 0.28, 0.12 * s], [0.02, 0.4, 0.2 * s], [-0.05, 0.48, 0.24 * s]], 0.04, 0.01, 6, 6), M.boneMat()));
  body.add(dwarf);
  g.userData = { body, wheels, stack, kind: 'siege' };
  return g;
}

registerView('siegeengine', {
  bake: 'flat', // crowds: one mesh per moving part
  make(e, world, v) {
    const g = siegeEngine();
    g.userData.body.scale.setScalar(1.05);
    v.parts = g.userData;
    v.face = e.f ?? 0;
    return g;
  },
  update(v, a, b, k, dt, world) {
    // Cars reverse instantly on the server; the model swings round quickly.
    v.face = lerpAngle(v.face, b.f ?? 0, Math.min(1, dt * 9));
    v.obj.rotation.y = -v.face;
    const P = v.parts;
    v.roll = (v.roll || 0) + dt * 9;
    for (const w of P.wheels) w.rotation.z = -v.roll;
    P.body.position.y = Math.abs(Math.sin(v.roll * 1.3)) * 0.03;
    P.body.rotation.x = Math.sin(v.roll * 0.7) * 0.015;
    const c = Math.cos(v.face);
    const s = Math.sin(v.face);
    // Coal smoke from the stack, dust from the tracks.
    if (emit(v, 'smoke', 9, dt)) world.fx.smokePuff(v.x - c * 1.2 - s * 0.18, 2.2, v.z - s * 1.2 + c * 0.18, '#2a2624', 0.8, 1.4, 0.45);
    if (emit(v, 'dust', 10, dt)) world.fx.smokePuff(v.x - c * 1.1 + s * 0.7 * (Math.random() < 0.5 ? 1 : -1), 0.2, v.z - s * 1.1, '#9a8a6a', 0.9, 0.8, 0.3);
  },
});

// A Circle of Power marking a finish or a goal. Fields: o (owner: its team
// colour), s (1 live, 2 scored, 0 gone), r (radius). Gold when unowned.
registerView('cop', {
  make(e, world, v) {
    v.t = Math.random() * 5;
    const c = e.o != null ? world.colors[e.o] || '#ffd24a' : '#ffd24a';
    return circleOfPower(c, e.r || 1.25);
  },
  update(v, a, b, k, dt) {
    v.t += dt;
    animateCircle(v.obj, v.t, b.s === 0 ? 0 : b.s === 2 ? 0.35 : 1);
  },
});

registerMapBuilder('roadkill', (map, world) => {
  const R = map.rk;
  // Static scenery, merged per material at the end (hundreds of parts otherwise).
  const G = new THREE.Group();
  // Roads worn by the engines: one strip per lane, the length of its patrol plus the kill reach.
  for (const [y, lo, hi] of R.lanes) G.add(groundStrip(lo - 2.2, y - 1.05, hi + 2.2, y + 1.05, { tint: '#c4ae8c', opacity: 0.85 }));
  // The ridge that splits the course and the two rocky corners.
  const mat = cliffMat('tex_grass.webp', '#9aae84');
  R.blocks.forEach(([x0, y0, x1, y1], i) => {
    const h = i === 0 ? 1.5 : 1.1;
    G.add(cliffBlock(x0 + 0.15, y0 + 0.15, x1 - 0.15, y1 - 0.15, h, { mat, seed: i + 2, rough: 0.28 }));
    rubble(G, x0 + 0.3, y0 + 0.3, x1 - 0.3, y1 - 0.3, { every: 2.4, s: [0.25, 0.55], out: 0.2 });
    // Pines along the ridge top.
    for (let z = y0 + 1; z < y1 - 0.6; z += 1.8 + Math.random()) {
      for (let x = x0 + 1; x < x1 - 0.6; x += 2.2 + Math.random()) {
        const t = M.tree(0.75 + Math.random() * 0.35);
        t.position.set(x + (Math.random() - 0.5) * 0.6, h + 0.1, z + (Math.random() - 0.5) * 0.6);
        G.add(t);
      }
    }
  });
  // The start strip, a worn patch of ground.
  const [[sx0, sy0], [sx1, sy1]] = R.start;
  G.add(groundStrip(Math.min(sx0, sx1), Math.min(sy0, sy1) - 0.4, Math.max(sx0, sx1), Math.max(sy0, sy1) + 0.4, { tint: '#b0a080', opacity: 0.6 }));
  bakeStatic(G);
  world.mapGroup.add(G);
});
