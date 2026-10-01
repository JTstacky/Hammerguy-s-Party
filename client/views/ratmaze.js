// The Rat Maze (#2): the rat contestants, spiders, the cheese, the Circles
// of Power and the maze walls (a cliff heightfield from the server's grid).
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerMapBuilder } from '../../engine/client/render/registry.js';
import { cliffField, cliffMaterial, dressWalls, circleOfPower, emit } from './lib-f-cliffs.js';

// ------------------------------------------------------------ rat

const ratFur = () => M.triMat('tex_fur.webp', '#8a7a6a', '#e0d0c0', 2.0);
const belly = () => M.triMat('tex_fur.webp', '#b8a898', '#fff4e8', 2.4);
const pink = () => M.mat('#d89090', { roughness: 0.6 });

// A brown rat: a furry pear-shaped body, a pointed snout with whiskers,
// pink ears and a long tail; the owner's colour on a little collar.
export function ratModel(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const fur = ratFur();
  const k = 1.25; // well above WC3 scale so a rat reads from the RTS camera
  const B = (sx, sy, sz, seed) => M.blob(sx * k, sy * k, sz * k, { seed, amt: 0.06, detail: 2 });
  body.add(M.mesh(B(0.42, 0.26, 0.27, 201), fur, -0.05, 0.3 * k, 0));
  body.add(M.mesh(B(0.24, 0.2, 0.2, 202), fur, 0.3 * k, 0.34 * k, 0));
  // A paler belly and muzzle, like the WC3 rat.
  body.add(M.mesh(B(0.3, 0.12, 0.2, 203), belly(), 0.0, 0.18 * k, 0));
  body.add(M.mesh(M.scaled(M.G.cone, 0.12 * k, 0.3 * k, 0.12 * k).rotateZ(-Math.PI / 2), fur, 0.56 * k, 0.31 * k, 0));
  body.add(M.mesh(M.scaled(M.G.sphere, 0.04 * k), pink(), 0.72 * k, 0.31 * k, 0));
  const eye = M.mat('#0a0606', { roughness: 0.15 });
  const whisker = M.mat('#f0e8d8');
  for (const s of [1, -1]) {
    body.add(M.mesh(M.scaled(M.G.sphere, 0.04 * k), eye, 0.43 * k, 0.42 * k, 0.1 * k * s));
    const ear = M.mesh(M.scaled(M.G.sphere, 0.11 * k, 0.12 * k, 0.035 * k), pink(), 0.27 * k, 0.53 * k, 0.12 * k * s);
    ear.rotation.x = 0.4 * s;
    body.add(ear);
    for (const w of [-1, 1]) body.add(M.mesh(M.tube([[0.64 * k, 0.3 * k, 0.03 * s * k], [0.7 * k, (0.3 + 0.02 * w) * k, 0.14 * s * k], [0.74 * k, (0.29 + 0.04 * w) * k, 0.24 * s * k]], 0.006, 0.003, 3, 3), whisker));
  }
  // The owner's colour on a fat collar and a little saddle-cloth, so rats
  // in a crowd are told apart.
  const team = M.mat(color, { roughness: 0.55, emissive: color, emissiveIntensity: 0.15 });
  const collar = M.mesh(new THREE.TorusGeometry(0.17 * k, 0.05 * k, 6, 16), team, 0.2 * k, 0.35 * k, 0);
  collar.rotation.y = Math.PI / 2;
  collar.rotation.x = 0.2;
  body.add(collar);
  body.add(M.mesh(M.blob(0.22 * k, 0.05 * k, 0.24 * k, { seed: 204, amt: 0.03, detail: 1 }), team, -0.08 * k, 0.53 * k, 0));
  const tail = new THREE.Group();
  tail.position.set(-0.4 * k, 0.28 * k, 0);
  tail.add(M.mesh(M.tube([[0, 0, 0], [-0.3 * k, -0.12 * k, 0.05], [-0.55 * k, -0.18 * k, -0.08], [-0.8 * k, -0.14 * k, 0.04]], 0.05 * k, 0.012, 12, 6), pink()));
  body.add(tail);
  const leg = (x, s) => {
    const hip = new THREE.Group();
    hip.position.set(x * k, 0.2 * k, 0.14 * k * s);
    hip.add(M.mesh(M.tube([[0, 0, 0], [0.02, -0.1 * k, 0], [0.05 * k, -0.19 * k, 0]], 0.045 * k, 0.028 * k, 3, 6), fur));
    hip.add(M.mesh(M.scaled(M.G.sphere, 0.045 * k, 0.022 * k, 0.04 * k), pink(), 0.07 * k, -0.19 * k, 0));
    body.add(hip);
    return hip;
  };
  const legL = leg(0.28, 1);
  const legR = leg(0.28, -1);
  const rearL = leg(-0.25, 1);
  const rearR = leg(-0.25, -1);
  g.userData = {
    body, legL, legR, kind: 'hero',
    anim: [tail, rearL, rearR],
    // Rear legs move against the front pair; the tail swishes.
    tick(dt, v, b, world) {
      rearL.rotation.z = -legL.rotation.z;
      rearR.rotation.z = -legR.rotation.z;
      tail.rotation.y = Math.sin(world.time * (b.mv ? 9 : 2.5)) * (b.mv ? 0.35 : 0.15);
    },
  };
  return g;
}

registerSkin('rat', ratModel);

// ------------------------------------------------------------ spider

// A giant spider: a glossy black carapace, a banded abdomen with a red
// hourglass, fangs and eight jointed legs.
function spiderModel() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shell = M.triMat('tex_hide.webp', '#2a2226', '#6a5a60', 1.4, { roughness: 0.45, metalness: 0.1 });
  const dark = M.mat('#1a1416', { roughness: 0.4 });
  const abdomen = M.mesh(M.blob(0.5, 0.4, 0.44, { seed: 211, amt: 0.05 }), shell, -0.5, 0.62, 0);
  body.add(abdomen);
  const mark = M.mesh(M.blob(0.14, 0.05, 0.1, { seed: 212 }), M.mat('#a01818', { roughness: 0.5, emissive: '#300000' }), -0.5, 1.0, 0);
  body.add(mark);
  for (const z of [-0.2, 0, 0.2]) body.add(M.mesh(M.scaled(M.G.sphere, 0.09, 0.03, 0.08), M.mat('#6a5040'), -0.78, 0.8, z));
  body.add(M.mesh(M.blob(0.3, 0.2, 0.26, { seed: 213 }), shell, 0.05, 0.55, 0));
  body.add(M.mesh(M.blob(0.16, 0.13, 0.16, { seed: 214 }), shell, 0.36, 0.52, 0));
  for (const s of [1, -1]) {
    body.add(M.mesh(M.scaled(M.G.sphere, 0.045), M.glowMat('#ff4a3a'), 0.48, 0.6, 0.06 * s));
    body.add(M.mesh(M.scaled(M.G.sphere, 0.03), M.glowMat('#ff4a3a'), 0.46, 0.66, 0.12 * s));
  }
  const fangs = [];
  for (const s of [1, -1]) {
    const f = new THREE.Group();
    f.position.set(0.48, 0.45, 0.07 * s);
    f.add(M.mesh(M.tube([[0, 0, 0], [0.08, -0.08, 0.02 * s], [0.06, -0.18, 0]], 0.035, 0.008, 5, 6), M.boneMat()));
    body.add(f);
    fangs.push(f);
  }
  const legs = [];
  for (let i = 0; i < 4; i++) {
    for (const s of [1, -1]) {
      const hip = new THREE.Group();
      const x = 0.2 - i * 0.14;
      hip.position.set(x, 0.58, 0.18 * s);
      const spread = (i - 1.5) * 0.45;
      hip.rotation.y = spread * s;
      hip.add(M.mesh(M.tube([[0, 0, 0], [0, 0.35, 0.4 * s], [0, 0.2, 0.85 * s], [0, -0.58, 1.05 * s]], 0.055, 0.02, 12, 6), dark));
      body.add(hip);
      legs.push({ hip, i, s, base: hip.rotation.y });
    }
  }
  body.scale.setScalar(0.8);
  g.userData = { body, legs, fangs };
  return g;
}

registerView('spider', {
  unit: true,
  make(e, world, v) {
    const g = spiderModel();
    v.parts = g.userData;
    return g;
  },
  update(v, a, b, k, dt) {
    const p = v.parts;
    const moving = b.mv && !b.dead;
    v.walk = (v.walk || 0) + dt * (moving ? 16 : 0);
    p.legs.forEach((l) => {
      const ph = v.walk + l.i * 1.6 + (l.s > 0 ? 0 : Math.PI);
      l.hip.rotation.y = l.base + (moving ? Math.sin(ph) * 0.3 * l.s : 0);
      l.hip.rotation.x = moving ? Math.max(0, Math.sin(ph)) * 0.25 * l.s : 0;
    });
    p.body.position.y = moving ? Math.abs(Math.sin(v.walk * 2)) * 0.03 : 0;
    // Rear up and strike on a bite.
    const sw = b.sw ?? -1;
    const strike = sw >= 0 ? Math.sin(Math.min(1, sw) * Math.PI) : 0;
    p.body.rotation.z = strike * 0.35;
    p.fangs.forEach((f, i) => (f.rotation.y = (i ? -1 : 1) * strike * 0.6));
  },
});

// ------------------------------------------------------------ cheese

function cheeseWedge() {
  const g = new THREE.Group();
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.lineTo(0.55, 0.18);
  sh.lineTo(0.55, -0.18);
  sh.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
  geo.translate(-0.3, 0, -0.14);
  geo.rotateX(Math.PI / 2);
  const cheese = M.mat('#f2c440', { roughness: 0.55, emissive: '#3a2600' });
  const w = M.mesh(geo, cheese, 0, 0.28, 0);
  g.add(w);
  const holeMat = M.mat('#c8901c', { roughness: 0.7 });
  for (const [x, z, r] of [[0.1, 0.05, 0.05], [0.18, -0.06, 0.035], [0.0, -0.02, 0.03]]) g.add(M.mesh(M.scaled(M.G.sphere, r, 0.02, r), holeMat, x, 0.3, z));
  return g;
}

// WC3's "TalkToMe" marker: a golden exclamation mark over the carrier.
function markerModel() {
  const g = new THREE.Group();
  const gold = M.glowMat('#ffd84a');
  g.add(M.mesh(M.lathe([[0.001, 0.2], [0.07, 0.25], [0.09, 0.7], [0.001, 0.72]], 12), gold));
  g.add(M.mesh(M.scaled(M.G.sphere, 0.07), gold, 0, 0.08, 0));
  return g;
}

registerView('cheese', {
  make(e, world, v) {
    const g = new THREE.Group();
    const wedge = cheeseWedge();
    wedge.scale.setScalar(1.3);
    const mark = markerModel();
    mark.position.y = 1.7;
    g.add(wedge, mark);
    v.parts = { wedge, mark };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const p = v.parts;
    const carried = !!b.c;
    v.obj.rotation.y = 0;
    p.wedge.position.y = carried ? 0.95 : 0.1 + Math.sin(world.time * 2.5) * 0.08;
    p.wedge.rotation.y = world.time * (carried ? 0 : 1.2);
    p.wedge.scale.setScalar(carried ? 0.9 : 1.3);
    p.mark.visible = carried;
    p.mark.rotation.y = world.time * 2;
    p.mark.position.y = 1.9 + Math.sin(world.time * 4) * 0.08;
    if (!carried && emit(v, 'glint', 4, dt)) world.fx.trail(v.x + (Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.4, v.z + (Math.random() - 0.5) * 0.6, '#ffe070', 0.35, 0.6, 0.1);
  },
});

registerView('powercircle', {
  make(e, world, v) {
    const g = circleOfPower(world.colors[e.o] || '#ffffff', 1.25);
    v.parts = g.userData;
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.obj.rotation.y = 0;
    v.parts.rune.material.opacity = 0.75 + Math.sin(world.time * 3) * 0.2;
    v.parts.rune.rotation.y = world.time * 0.3;
  },
});

// ------------------------------------------------------------ maze

registerMapBuilder('ratmaze', (map, world) => {
  const cells = map.maze;
  const T = map.T;
  const mat = cliffMaterial({ top: 'tex_grass.webp', topTint: '#a8b890', rockTint: '#a8a094' });
  world.mapGroup.add(cliffField({ cells, T, solid: (ch) => ch === '#', H: 1.25, ramp: 0.5, margin: 10, res: 0.3, material: mat }));
  dressWalls(world.mapGroup, { cells, T, solid: (ch) => ch === '#', H: 1.25, density: 0.22, trees: 0.12, seed: 2 });
  // A ring of pines on the high ground round the maze.
  const half = (cells.length * T) / 2;
  for (let i = 0; i < 60; i++) {
    const side = i % 4;
    const t = (Math.floor(i / 4) / 15) * 2 - 1;
    const out = half + 2.5 + Math.random() * 6;
    const along = t * (half + 4) + (Math.random() - 0.5) * 2;
    const [x, z] = [[along, -out], [out, along], [along, out], [-out, along]][side];
    const tr = M.tree(0.9 + Math.random() * 0.5);
    tr.position.set(x, 1.15, z);
    world.mapGroup.add(tr);
  }
});
