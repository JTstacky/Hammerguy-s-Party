// The Skeleton Sonata (#16): a blighted graveyard square at midnight, ghoul
// corpses that burst into skeleton warriors under a lightning strike, the
// skeleton swarm itself, and the priests' Dispel Magic.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerEvent, registerTheme, registerMapBuilder, registerSkin } from '../../engine/client/render/registry.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { play } from '../../engine/client/audio.js';
import { emit, dispelEffect, skyBolt, swingPhase, ball, glowMat } from './dispel-fx.js';
import { priest } from './cleanup.js';

// The players are human priests (`hmpr`), their stoles in team colour.
registerSkin('humanpriest', (color) => priest(color));

registerTheme(
  'sonata',
  { sky: '#0c1022', fog: '#140f26', floor: ['#3a2a44', 35, {}], sun: '#a8b0ff', hemi: ['#6a60b0', '#140c18'], sunI: 1.5 },
  {
    floor: { tex: 'tex_cleanup_blight.webp', tint: '#d8c8e8', color: '#3a2a44', units: 7 },
    edge: { tex: 'tex_cleanup_blight.webp', tint: '#6a6078', color: '#3a3040', units: 5 },
    outer: { tex: 'tex_nightgrass.webp', tint: '#7a7890', color: '#1c2028' },
    edgeWidth: 1.2,
  },
);

// -------------------------------------------------------------- models

// Bakes a list of [geometry, material, matrix] into one mesh per material, so
// a crowd of skeletons costs a handful of draw calls each.
function bake(parts) {
  const byMat = new Map();
  for (const [geo, mat, m4] of parts) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (m4) g.applyMatrix4(m4);
    if (!byMat.has(mat)) byMat.set(mat, []);
    byMat.get(mat).push(g);
  }
  return [...byMat].map(([mat, gs]) => [mergeGeometries(gs), mat]);
}

const T = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));

let SKEL = null;
function skeletonParts() {
  if (SKEL) return SKEL;
  const bone = M.triMat('tex_plate.webp', '#e8e0cc', '#fff8e8', 3, { roughness: 0.55, metalness: 0, emissive: '#2c2820' });
  const rust = M.texMat('tex_plate.webp', '#6a5242', '#a88a72', 1, { metalness: 0.45, roughness: 0.55 });
  const dark = M.mat('#120c0a');
  const steel = M.texMat('tex_plate.webp', '#8a8680', '#c8c0b8', 1, { metalness: 0.7, roughness: 0.35 });
  const eye = glowMat('#9affc8');
  const body = [];
  body.push([M.blob(0.14, 0.08, 0.17, { seed: 121 }), bone, T(0, 0.86, 0)]);
  body.push([M.tube([[-0.02, 0.86, 0], [-0.05, 1.1, 0], [-0.02, 1.36, 0]], 0.045, 0.035, 8, 6), bone]);
  for (let i = 0; i < 4; i++) {
    const r = 0.17 - Math.abs(i - 1.3) * 0.02;
    body.push([new THREE.TorusGeometry(r, 0.022, 6, 18, Math.PI * 1.55), bone, T(0.01, 1.07 + i * 0.075, 0, Math.PI / 2, 0, Math.PI * 0.225 + Math.PI, 1)]);
  }
  body.push([M.scaled(M.G.box, 0.03, 0.22, 0.05), bone, T(0.15, 1.16, 0, 0, 0, -0.15)]);
  body.push([M.blob(0.12, 0.05, 0.3, { seed: 122 }), bone, T(-0.02, 1.37, 0)]);
  // Skull under a rusty half-helm, sunken eye sockets with a cold glow.
  body.push([M.blob(0.13, 0.14, 0.12, { seed: 123, amt: 0.06 }), bone, T(0.02, 1.57, 0)]);
  body.push([M.blob(0.08, 0.045, 0.09, { seed: 124 }), bone, T(0.08, 1.44, 0)]);
  body.push([M.lathe([[0.15, 1.56], [0.155, 1.62], [0.12, 1.71], [0.05, 1.75], [0.001, 1.76]], 14), rust, T(-0.01, 0, 0)]);
  body.push([M.scaled(M.G.box, 0.05, 0.1, 0.02), rust, T(0.15, 1.56, 0)]);
  for (const s of [1, -1]) {
    body.push([ball(0.045, 0.04, 0.04), dark, T(0.12, 1.57, 0.055 * s)]);
    body.push([ball(0.022), eye, T(0.145, 1.57, 0.055 * s)]);
  }
  // Shield arm (left) with a battered round shield held forward.
  body.push([M.tube([[0, 1.36, -0.22], [0.07, 1.14, -0.28], [0.24, 1.1, -0.24]], 0.03, 0.025, 6, 6), bone]);
  body.push([M.lathe([[0.001, 0.03], [0.3, 0.02], [0.32, 0], [0.3, -0.02], [0.001, -0.02]], 18), rust, T(0.3, 1.1, -0.22, 0, 0, -Math.PI / 2)]);
  body.push([ball(0.06), rust, T(0.34, 1.1, -0.22)]);
  const bodyMeshes = bake(body);

  const leg = [];
  leg.push([M.tube([[0, 0, 0], [0.04, -0.4, 0], [0, -0.78, 0]], 0.035, 0.028, 8, 6), bone]);
  leg.push([ball(0.05), bone, T(0.03, -0.4, 0)]);
  leg.push([M.blob(0.1, 0.035, 0.05, { seed: 125 }), bone, T(0.05, -0.8, 0)]);
  const legMeshes = bake(leg);

  // Sword arm (right), pivoting at the shoulder; a notched, rusty blade.
  const sh = new THREE.Shape();
  sh.moveTo(-0.035, 0);
  sh.lineTo(-0.035, 0.6);
  sh.lineTo(0, 0.72);
  sh.lineTo(0.035, 0.6);
  sh.lineTo(0.03, 0.4);
  sh.lineTo(0.02, 0.36);
  sh.lineTo(0.035, 0.3);
  sh.lineTo(0.035, 0);
  const blade = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 });
  blade.translate(0, 0, -0.006);
  const arm = [];
  arm.push([M.tube([[0, 0, 0], [0.05, -0.24, 0.04], [0.24, -0.28, 0.02]], 0.03, 0.025, 6, 6), bone]);
  arm.push([blade, steel, T(0.26, -0.26, 0.02, Math.PI / 2, 0, -1.1)]);
  arm.push([M.scaled(M.G.box, 0.03, 0.03, 0.2), rust, T(0.27, -0.27, 0.02)]);
  arm.push([M.tube([[0.22, -0.3, 0.02], [0.28, -0.26, 0.02]], 0.02, 0.02, 2, 6), dark]);
  const armMeshes = bake(arm);
  SKEL = { bodyMeshes, legMeshes, armMeshes, bone };
  return SKEL;
}

function skeleton() {
  const P = skeletonParts();
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  P.bodyMeshes.forEach(([geo, mat], i) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = i === 0;
    body.add(m);
  });
  const legs = [1, -1].map((s) => {
    const hip = new THREE.Group();
    hip.position.set(0, 0.84, 0.09 * s);
    for (const [geo, mat] of P.legMeshes) hip.add(new THREE.Mesh(geo, mat));
    body.add(hip);
    return hip;
  });
  const arm = new THREE.Group();
  arm.position.set(0, 1.36, 0.22);
  for (const [geo, mat] of P.armMeshes) arm.add(new THREE.Mesh(geo, mat));
  body.add(arm);
  body.scale.setScalar(1.25);
  g.userData = { body, legs, arm };
  return g;
}

// A dead ghoul: grey-green flesh sprawled on its back, ribs showing.
function ghoulCorpse() {
  const g = new THREE.Group();
  const flesh = M.triMat('tex_hide.webp', '#6a7a5a', '#a8b890', 1.6);
  const bone = M.boneMat();
  const blood = M.mat('#2a0a12', { roughness: 0.3, transparent: true, opacity: 0.7 });
  const pool = M.mesh(M.blob(0.7, 0.015, 0.45, { seed: 131, amt: 0.3, freq: 3 }), blood, -0.1, 0.02, 0);
  pool.castShadow = false;
  g.add(pool);
  // Sprawled face up: a gaunt torso with its ribs showing, head thrown back.
  g.add(M.mesh(M.blob(0.34, 0.1, 0.2, { seed: 132 }), flesh, 0, 0.1, 0));
  for (let i = 0; i < 4; i++) {
    const rib = M.mesh(new THREE.TorusGeometry(0.16, 0.016, 5, 12, Math.PI), bone, 0.06 + i * 0.07, 0.1, 0);
    rib.rotation.y = Math.PI / 2;
    g.add(rib);
  }
  g.add(M.mesh(M.blob(0.14, 0.1, 0.12, { seed: 133 }), flesh, 0.46, 0.1, 0.02));
  g.add(M.mesh(M.blob(0.07, 0.04, 0.08, { seed: 134 }), flesh, 0.6, 0.06, 0.02));
  for (const s of [1, -1]) g.add(M.mesh(ball(0.028), M.mat('#0a0604'), 0.54, 0.16, 0.05 * s));
  for (const [pts, r] of [
    [[[0.25, 0.08, 0.18], [0.35, 0.05, 0.45], [0.62, 0.04, 0.55]], 0.045],
    [[[0.25, 0.08, -0.18], [0.1, 0.05, -0.45], [0.25, 0.04, -0.7]], 0.045],
    [[[-0.3, 0.08, 0.1], [-0.65, 0.05, 0.22], [-0.95, 0.04, 0.2]], 0.06],
    [[[-0.3, 0.08, -0.1], [-0.6, 0.05, -0.3], [-0.92, 0.04, -0.28]], 0.06],
  ]) g.add(M.mesh(M.tube(pts, r, r * 0.7, 6, 6), flesh));
  for (const [x, z] of [[0.66, 0.56], [0.28, -0.72]]) for (let f = 0; f < 3; f++) g.add(M.mesh(M.tube([[x, 0.04, z], [x + 0.1, 0.03, z + (f - 1) * 0.05]], 0.012, 0.006, 2, 4), bone));
  g.scale.setScalar(1.25);
  return g;
}

function deadTree(s) {
  const g = new THREE.Group();
  const bark = M.texMat('tex_bark.webp', '#3a3030', '#8a8090', 1);
  g.add(M.mesh(M.tube([[0, 0, 0], [0.1, 1.2 * s, 0.05], [-0.05, 2.4 * s, 0], [0.1, 3.2 * s, 0.1]], 0.24 * s, 0.05 * s, 10, 8), bark));
  const n = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const y = (1.3 + Math.random() * 1.6) * s;
    const l = (0.8 + Math.random() * 0.8) * s;
    g.add(M.mesh(M.tube([[0, y, 0], [Math.cos(a) * l * 0.5, y + 0.35 * s, Math.sin(a) * l * 0.5], [Math.cos(a) * l, y + 0.4 * s + Math.random() * 0.5, Math.sin(a) * l]], 0.08 * s, 0.01, 6, 6), bark));
  }
  g.rotation.y = Math.random() * 6;
  return g;
}

function headstone() {
  const g = new THREE.Group();
  const stone = M.texMat('tex_stone.webp', '#6a6878', '#a8a6b8', 0.4);
  if (Math.random() < 0.5) {
    const slab = M.mesh(new RoundedBoxGeometry(0.2, 0.9, 0.6, 3, 0.08), stone, 0, 0.4, 0);
    g.add(slab);
    g.add(M.mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), stone, 0, 0.85, 0));
  } else {
    g.add(M.mesh(new RoundedBoxGeometry(0.16, 1.1, 0.16, 2, 0.04), stone, 0, 0.5, 0));
    g.add(M.mesh(new RoundedBoxGeometry(0.16, 0.16, 0.6, 2, 0.04), stone, 0, 0.78, 0));
  }
  g.add(M.mesh(M.blob(0.45, 0.08, 0.35, { seed: 141 }), M.mat('#3a3030'), 0.4, 0.02, 0));
  g.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * 6, (Math.random() - 0.5) * 0.25);
  return g;
}

registerMapBuilder('sonata', (map, world) => {
  const S = map.sonata;
  // Static scenery (corner rock heaps, the graveyard's dead trees and
  // headstones), merged per material at the end.
  const G = new THREE.Group();
  // The ring's corner tiles are cliffs: heaps of rock.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const r = M.rock(0.9 + Math.random() * 0.5);
      r.position.set(sx * (S.corner + (Math.random() - 0.3) * S.tile), 0, sy * (S.corner + (Math.random() - 0.3) * S.tile));
      r.scale.y = 1.4;
      G.add(r);
    }
  }
  // A graveyard all round: dead trees and leaning headstones.
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + Math.random() * 0.1;
    const r = S.walk * 1.2 + 1 + Math.random() * 5;
    const t = deadTree(0.9 + Math.random() * 0.5);
    t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    G.add(t);
  }
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = S.walk * 1.15 + Math.random() * 4;
    const h = headstone();
    h.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    G.add(h);
  }
  bakeStatic(G);
  world.mapGroup.add(G);
});

// -------------------------------------------------------------- views

registerView('sonataskel', {
  make(e, world, v) {
    const g = skeleton();
    v.parts = g.userData;
    v.rise = 0;
    return g;
  },
  update(v, a, b, k, dt) {
    const P = v.parts;
    // Clawing up out of the ground when raised.
    v.rise = Math.min(1, Math.max(0, v.rise + dt * 2.5));
    v.obj.position.y = -1.6 * (1 - v.rise) * (1 - v.rise);
    v.walk = (v.walk || 0) + dt * (b.mv ? 12 : 0);
    const amp = b.mv ? 0.55 : 0;
    P.legs[0].rotation.z = Math.sin(v.walk) * amp;
    P.legs[1].rotation.z = -Math.sin(v.walk) * amp;
    P.body.position.y = b.mv ? Math.abs(Math.sin(v.walk)) * 0.05 : 0;
    const sw = swingPhase(v, dt, 0.6);
    P.arm.rotation.z = (b.mv ? Math.sin(v.walk) * 0.3 : 0) + 1.6 * sw - 0.2;
    P.body.rotation.z = -0.12 * sw;
  },
  // Destroyed (dispelled): the bones clatter apart.
  remove(v, world) {
    if (v.x == null) return;
    world.fx.burst(v.x, 1, v.z, '#e8dcc0', { n: 14, speed: 3, size: 0.3, life: 0.8, up: 1.2, grav: 12, additive: false });
    world.fx.smokePuff(v.x, 0.6, v.z, '#b8b0a0', 0.9, 0.9, 0.4);
  },
});

registerView('gcorpse', {
  make(e, world, v) {
    const g = ghoulCorpse();
    g.position.y = 0;
    return g;
  },
  update(v, a, b, k, dt, world) {
    // Carrion flies and a faint necrotic haze mark where the dead will rise.
    if (emit(v, 'fly', 3, dt)) world.fx.trail(v.x + (Math.random() - 0.5), 0.5 + Math.random() * 0.6, v.z + (Math.random() - 0.5), '#9affb8', 0.18, 0.8, 0.3);
    if (emit(v, 'haze', 1.2, dt)) world.fx.smokePuff(v.x, 0.2, v.z, '#3a5a3a', 1.1, 1.8, 0.25);
  },
});

// Three skeletons rise; the corpse is struck away by lightning.
registerEvent('sonataraise', (e, world) => {
  skyBolt(world, e.x, e.y);
  world.fx.dustCloud(e.x, e.y, 1, '#5a4a5a', 10);
  world.fx.burst(e.x, 0.3, e.y, '#e8dcc0', { n: 16, speed: 3, size: 0.3, life: 0.8, up: 1.4, grav: 10, additive: false });
  play('lightning');
});

registerEvent('sdispel', (e, world) => {
  dispelEffect(world, e.x, e.y, e.r);
  world.fx.glow(e.px, 2.4, e.py, '#cfeeff', 2.5, 0.3);
});
