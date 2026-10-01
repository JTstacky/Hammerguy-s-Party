// Walls for the grid arenas of Covert Kitty, Blinky the Bear, Minotaur Maze,
// The Unseen and The Death Trap: the server sends its pathing grid
// (map.maze = { cell, x0, y0, rows, style, h }) and the 'upmaze' map builder
// turns the blocked cells into scenery:
//  - 'stone': low fieldstone walls (Minotaur Maze's "Short Wall" doodads)
//  - 'pillar': tall ruined stone blocks (The Death Trap)
//  - 'cliff': raised rocky ground with grass on top and water in '~' cells (Blinky)
//  - 'trees': Summer Tree Walls, a pine per cell (Covert Kitty)
//  - 'rocks': boulder piles (The Unseen's blockers)
// The rugged blocks are one merged mesh per style: boxes subdivided and
// pushed about by smooth world-space noise, so neighbouring cells join into
// one continuous wall, shaded smooth and textured triplanar.

import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as M from '../../engine/client/render/models.js';
import { registerMapBuilder, registerView } from '../../engine/client/render/registry.js';
import { fxTexture } from '../../engine/client/render/effects.js';

// Smooth 3D noise in [-1, 1] from a few fixed sine waves (deterministic).
const WAVES = [
  [0.71, 0.13, 0.69, 1.7, 0.3],
  [-0.42, 0.81, 0.4, 2.3, 1.1],
  [0.2, -0.55, 0.81, 3.1, 2.2],
  [0.93, 0.3, -0.2, 4.3, 0.7],
  [-0.6, -0.2, -0.77, 5.9, 2.9],
  [0.1, 0.95, 0.3, 7.7, 1.9],
];
export function noise3(x, y, z) {
  let n = 0;
  let a = 0;
  WAVES.forEach(([dx, dy, dz, f, p], i) => {
    const w = 1 / (1 + i * 0.6);
    n += Math.sin((x * dx + y * dy + z * dz) * f + p) * w;
    a += w;
  });
  return n / a;
}

// Animation for hero skins that are not two-legged (the engine swings
// userData.legL/legR and bobs userData.body; skins with more legs animate
// themselves in userData.tick). Each leg group swings about its hip at its
// userData.phase; on death the body rolls onto its side instead of pitching
// over.
export function creatureTick({ body, legs = [], amp = 0.5, rate = 1, extra = null }) {
  return (dt, v, b, world) => {
    const moving = !!b.mv && !b.dead;
    const w = (v.walk || 0) * rate;
    for (const l of legs) l.rotation.z = moving ? Math.sin(w + (l.userData.phase || 0)) * amp : l.rotation.z * Math.max(0, 1 - dt * 10);
    if (b.dead) {
      body.rotation.z = 0;
      body.rotation.x = Math.min(Math.PI / 2, (v.deadT || 0) * 4);
    } else body.rotation.x = 0;
    extra?.(dt, v, b, moving, world);
  };
}

// A cheap sphere for eyes, noses and knobs.
export const knob = (r, seg = 8) => new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2));

// Small low-poly decorations (the engine's rock and bush are too dense to
// scatter by the hundred): a boulder and a tuft of moss or reeds.
export function lowRock(s, seed = 1, mat = M.boulderMat()) {
  return M.mesh(M.blob(s, s * 0.6, s * 0.85, { seed, amt: 0.2, freq: 3.4, detail: 2 }), mat, 0, s * 0.2, 0);
}

export function tuft(s, seed = 1) {
  const g = new THREE.Group();
  const needles = M.triMat('tex_needles.webp', '#3b6e30', '#b8d0a0', 1.6, { roughness: 0.95 });
  for (let i = 0; i < 3; i++) {
    const a = seed * 2.1 + i * 2.1;
    const k = s * (0.7 + 0.15 * i);
    g.add(M.mesh(M.blob(k, k * 0.7, k, { seed: seed + i, amt: 0.18, freq: 3, detail: 1 }), needles, Math.cos(a) * s * 0.35, k * 0.5, Math.sin(a) * s * 0.35));
  }
  return g;
}

// Merges every mesh under `root` that shares a material into one mesh (in
// root space), so hundreds of wall stones and tufts cost a few draw calls.
// Meshes under a node with userData.dynamic are left alone.
export function bakeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const drop = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.dynamic) return;
    const g = plainGeo(o.geometry).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(g);
    drop.push(o);
  });
  for (const o of drop) o.parent?.remove(o);
  for (const [material, geos] of buckets) {
    const merged = mergeGeometries(sameIndexing(geos), false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const m = new THREE.Mesh(merged, material);
    m.castShadow = !material.transparent;
    m.receiveShadow = true;
    root.add(m);
  }
  return root;
}

// The same for a creature: its animated parts (everything referenced from
// userData) keep their transforms and the static meshes under each merge.
export function bakeModel(root) {
  const anim = new Set([root]);
  const note = (v) => {
    if (v?.isObject3D) anim.add(v);
    else if (Array.isArray(v)) v.forEach(note);
  };
  for (const v of Object.values(root.userData)) note(v);
  root.updateMatrixWorld(true);
  const owners = new Map();
  const drop = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || anim.has(o)) return;
    if (o.material.transparent || o.material.blending === THREE.AdditiveBlending) return;
    let owner = o.parent;
    while (!anim.has(owner)) owner = owner.parent;
    const g = plainGeo(o.geometry).applyMatrix4(new THREE.Matrix4().copy(owner.matrixWorld).invert().multiply(o.matrixWorld));
    if (!owners.has(owner)) owners.set(owner, new Map());
    const b = owners.get(owner);
    if (!b.has(o.material)) b.set(o.material, []);
    b.get(o.material).push(g);
    drop.push(o);
  });
  for (const o of drop) {
    for (const c of [...o.children]) o.parent.attach(c);
    o.parent.remove(o);
  }
  for (const [owner, b] of owners) {
    for (const [material, geos] of b) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(sameIndexing(geos), false);
      if (geos.length > 1) for (const g of geos) g.dispose();
      if (!merged) continue;
      const mm = new THREE.Mesh(merged, material);
      mm.castShadow = mm.receiveShadow = true;
      owner.add(mm);
    }
  }
  return root;
}

function plainGeo(src) {
  const g = src.clone();
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.morphAttributes = {};
  return g;
}

function sameIndexing(geos) {
  if (geos.every((g) => g.index)) return geos;
  return geos.map((g) => (g.index ? g.toNonIndexed() : g));
}

// A rugged block standing on the ground at (cx, cz), w x d wide, h high.
// `amt` is how far the noise pushes the surface; the base stays on y = 0.
export function ruggedBlock(cx, cz, w, h, d, { amt = 0.18, seg = 3, top = 0.2 } = {}) {
  let g = new THREE.BoxGeometry(w, h, d, seg, Math.max(2, Math.round(seg * h / Math.max(w, d)) + 1), seg);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const wx = v.x + cx;
    const wy = v.y + h / 2;
    const wz = v.z + cz;
    const ny = (v.y + h / 2) / h; // 0 at the base, 1 at the top
    // Round the top edges: pull the upper rim inwards and down a little.
    const edge = Math.max(Math.abs(v.x) / (w / 2), Math.abs(v.z) / (d / 2));
    let y = wy;
    if (ny > 0.99 && edge > 0.99) y -= top * h * 0.5;
    const n = noise3(wx * 1.3, wy * 1.3, wz * 1.3);
    const n2 = noise3(wz * 3.1 + 7, wy * 3.1, wx * 3.1);
    const push = (n * 0.75 + n2 * 0.25) * amt;
    let px = v.x;
    let pz = v.z;
    if (Math.abs(px) > w / 2 - 1e-4) px += Math.sign(px) * push;
    if (Math.abs(pz) > d / 2 - 1e-4) pz += Math.sign(pz) * push;
    if (ny > 0.99) y += push * 0.8;
    if (ny < 0.01) y = 0;
    pos.setXYZ(i, px + cx, y, pz + cz);
  }
  g.computeVertexNormals();
  return g;
}

// Parses map.maze into blocked cells [c, r, char] with world centres.
export function mazeCells(mz, chars = '#') {
  const out = [];
  mz.rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (!chars.includes(row[c])) continue;
      out.push({ c, r, ch: row[c], x: mz.x0 + (c + 0.5) * mz.cell, z: mz.y0 + (r + 0.5) * mz.cell });
    }
  });
  return out;
}

const blockedAt = (mz, c, r, chars) => r >= 0 && r < mz.rows.length && c >= 0 && c < mz.rows[r].length && chars.includes(mz.rows[r][c]);

// Horizontal runs of blocked cells, so a wall is one long block rather than
// a row of cubes.
function runs(mz, chars) {
  const out = [];
  mz.rows.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!chars.includes(row[c])) {
        c++;
        continue;
      }
      const c0 = c;
      while (c < row.length && chars.includes(row[c])) c++;
      out.push({ r, c0, c1: c - 1 });
    }
  });
  return out;
}

function stoneWalls(mz, world, { chars = '#', h = 1.2, tint = '#d8d2c6', amt = 0.1, inset = 0.02, moss = true } = {}) {
  const s = mz.cell;
  const geos = [];
  for (const run of runs(mz, chars)) {
    const w = (run.c1 - run.c0 + 1) * s + 0.02;
    const cx = mz.x0 + ((run.c0 + run.c1 + 1) / 2) * s;
    const cz = mz.y0 + (run.r + 0.5) * s;
    // A wall run is a little thicker than its cell where it continues up or
    // down, so the joints between runs close up.
    const hh = h * (0.92 + 0.16 * (noise3(cx * 0.7, 0, cz * 0.7) * 0.5 + 0.5));
    geos.push(ruggedBlock(cx, cz, w - inset, hh, s + 0.02 - inset, { amt, seg: Math.max(3, Math.round(w / 0.35)), top: 0.18 }));
  }
  const geo = mergeGeometries(geos);
  const mat = M.triMat('tex_minotaur_wall.webp', '#77716a', tint, 0.55, { roughness: 0.92 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  world.mapGroup.add(mesh);
  // Coping stones along the tops, and moss tufts and rubble at the feet.
  const cap = M.triMat('tex_boulder.webp', '#6f6a62', '#c4beb4', 1.2);
  const cells = mazeCells(mz, chars);
  let k = 0;
  for (const cell of cells) {
    k++;
    const r = noise3(cell.x * 2.1, 1, cell.z * 2.1);
    if (moss && r > 0.35) {
      const b = tuft(0.3 + (r - 0.35) * 0.35, cell.c * 7 + cell.r);
      b.position.set(cell.x + noise3(cell.x, 2, cell.z) * s * 0.3, h * 0.95, cell.z + noise3(cell.z, 3, cell.x) * s * 0.3);
      world.mapGroup.add(b);
    }
    if (k % 3 === 0) {
      const g = M.mesh(M.blob(s * 0.28, s * 0.14, s * 0.24, { seed: k, amt: 0.2, freq: 3, detail: 1 }), cap, cell.x + noise3(k, 0, 1) * s * 0.2, h + 0.02, cell.z + noise3(0, k, 2) * s * 0.2);
      world.mapGroup.add(g);
    }
    // Rubble on open ground next to the wall.
    if (k % 5 === 0) {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (blockedAt(mz, cell.c + dc, cell.r + dr, chars)) continue;
        const px = cell.x + dc * s * 0.62;
        const pz = cell.z + dr * s * 0.62;
        const rk = M.mesh(M.blob(0.12, 0.07, 0.1, { seed: k + dc * 3 + dr * 7, amt: 0.25, freq: 3.5, detail: 1 }), cap, px + dr * noise3(k, 1, 1) * s * 0.3, 0.04, pz + dc * noise3(1, k, 1) * s * 0.3);
        world.mapGroup.add(rk);
        break;
      }
    }
  }
  return mesh;
}

function pillarBlocks(mz, world, { chars = '#', h = 2.6 } = {}) {
  // Group 4-connected blocked cells into blocks and build each as one ruin.
  const seen = new Set();
  const geos = [];
  const topGeos = [];
  const s = mz.cell;
  mz.rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const key = `${c},${r}`;
      if (!chars.includes(row[c]) || seen.has(key)) continue;
      let c1 = c;
      while (blockedAt(mz, c1 + 1, r, chars)) c1++;
      let r1 = r;
      while ([...Array(c1 - c + 1)].every((_, i) => blockedAt(mz, c + i, r1 + 1, chars))) r1++;
      for (let rr = r; rr <= r1; rr++) for (let cc = c; cc <= c1; cc++) seen.add(`${cc},${rr}`);
      const w = (c1 - c + 1) * s;
      const d = (r1 - r + 1) * s;
      const cx = mz.x0 + ((c + c1 + 1) / 2) * s;
      const cz = mz.y0 + ((r + r1 + 1) / 2) * s;
      const hh = h * (0.85 + 0.3 * (noise3(cx, 5, cz) * 0.5 + 0.5));
      geos.push(ruggedBlock(cx, cz, w - 0.05, hh, d - 0.05, { amt: 0.12, seg: 6, top: 0.12 }));
      // A slab of paler capstone on top.
      topGeos.push(ruggedBlock(cx, cz, w * 0.86, 0.22, d * 0.86, { amt: 0.06, seg: 5, top: 0.3 }).translate(0, hh - 0.05, 0));
    }
  });
  const mesh = new THREE.Mesh(mergeGeometries(geos), M.triMat('tex_minotaur_wall.webp', '#6d665c', '#c8bfb2', 0.5, { roughness: 0.92 }));
  const tops = new THREE.Mesh(mergeGeometries(topGeos), M.triMat('tex_stone.webp', '#8a847a', '#d8d2c8', 0.45));
  for (const m of [mesh, tops]) {
    m.castShadow = m.receiveShadow = true;
    world.mapGroup.add(m);
  }
}

// Blinky's lattice: the walls between the lanes are raised ground with rocky
// sides and grass on top; '~' cells are a sealed pond.
function cliffs(mz, world, { h = 1.5 } = {}) {
  const s = mz.cell;
  const geos = [];
  const topGeos = [];
  for (const run of runs(mz, '#~')) {
    const w = (run.c1 - run.c0 + 1) * s + 0.04;
    const cx = mz.x0 + ((run.c0 + run.c1 + 1) / 2) * s;
    const cz = mz.y0 + (run.r + 0.5) * s;
    geos.push(ruggedBlock(cx, cz, w, h, s + 0.04, { amt: 0.22, seg: Math.max(3, Math.round(w / 0.5)), top: 0.25 }));
    topGeos.push(ruggedBlock(cx, cz, w - 0.35, 0.12, s - 0.3, { amt: 0.05, seg: Math.max(3, Math.round(w / 0.6)), top: 0.5 }).translate(0, h - 0.12, 0));
  }
  const rockMat = M.triMat('tex_boulder.webp', '#6a655c', '#b0a898', 0.55, { roughness: 0.95 });
  const grassMat = M.triMat('tex_grass.webp', '#4f7a34', '#c8d8b0', 0.18, { roughness: 1 });
  const rock = new THREE.Mesh(mergeGeometries(geos), rockMat);
  const top = new THREE.Mesh(mergeGeometries(topGeos), grassMat);
  for (const m of [rock, top]) {
    m.castShadow = m.receiveShadow = true;
    world.mapGroup.add(m);
  }
  // The pond: water set into the cliff top.
  const pond = mazeCells(mz, '~');
  if (pond.length) {
    const xs = pond.map((p) => p.x);
    const zs = pond.map((p) => p.z);
    const x0 = Math.min(...xs) - s * 0.35;
    const x1 = Math.max(...xs) + s * 0.35;
    const z0 = Math.min(...zs) - s * 0.35;
    const z1 = Math.max(...zs) + s * 0.35;
    const water = waterSurface(x1 - x0, z1 - z0, { tile: 3, tint: '#b8d8e0' });
    water.position.set((x0 + x1) / 2, h + 0.03, (z0 + z1) / 2);
    world.mapGroup.add(water);
    for (const p of pond) if (noise3(p.x, 9, p.z) > 0.2) {
      const reed = tuft(0.28, Math.round(p.x * 10));
      reed.position.set(p.x + s * 0.4, h, p.z);
      world.mapGroup.add(reed);
    }
  }
  // Scattered boulders on the tops.
  mazeCells(mz, '#').forEach((cell, i) => {
    if (i % 4) return;
    const r = lowRock(0.25 + (noise3(cell.x, 4, cell.z) * 0.5 + 0.5) * 0.3, i);
    r.position.set(cell.x, h - 0.1, cell.z);
    world.mapGroup.add(r);
  });
}

function treeWalls(mz, world, { chars = '#' } = {}) {
  for (const cell of mazeCells(mz, chars)) {
    const t = M.tree(0.95 + (noise3(cell.x, 6, cell.z) * 0.5 + 0.5) * 0.35);
    t.position.set(cell.x + noise3(cell.x * 3, 1, cell.z) * 0.25, 0, cell.z + noise3(cell.z * 3, 2, cell.x) * 0.25);
    world.mapGroup.add(t);
  }
}

function rockPiles(mz, world, { chars = '#' } = {}) {
  for (const cell of mazeCells(mz, chars)) {
    const g = new THREE.Group();
    const s = mz.cell;
    for (let i = 0; i < 4; i++) {
      const k = 0.35 + (noise3(cell.x + i, i, cell.z) * 0.5 + 0.5) * 0.35;
      const m = M.mesh(M.blob(s * k, s * k * 0.7, s * k * 0.9, { seed: i + 3, amt: 0.2, freq: 3, detail: 2 }), M.boulderMat(), (i % 2 ? 1 : -1) * s * 0.18, s * k * 0.4, (i > 1 ? 1 : -1) * s * 0.16);
      m.rotation.y = i * 1.3;
      g.add(m);
    }
    g.position.set(cell.x, 0, cell.z);
    world.mapGroup.add(g);
  }
}

// A painted water surface: two layers of the water tile drifting in different
// directions in world space, so it ripples and never shows the repeat.
export function waterSurface(w, d, { tile = 4, tint = '#ffffff', opacity = 1, flow = [0.035, 0.022], seg = 1 } = {}) {
  const u = { tWater: { value: null }, uOn: { value: 0 }, uTime: { value: 0 }, uTile: { value: 1 / tile }, uFlow: { value: new THREE.Vector2(...flow) } };
  const m = new THREE.MeshStandardMaterial({ color: '#2a7a88', roughness: 0.18, metalness: 0.15, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  fxTexture('tex_troubled_water.webp', (t) => {
    u.tWater.value = t;
    u.uOn.value = 1;
    m.color.set(tint);
  }, { repeat: true });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWP; uniform sampler2D tWater; uniform float uOn, uTime, uTile; uniform vec2 uFlow;')
      .replace('#include <map_fragment>', `
        if (uOn > 0.5) {
          vec3 a = texture2D(tWater, vWP * uTile + uFlow * uTime).rgb;
          vec3 b = texture2D(tWater, vWP * uTile * 1.37 - uFlow.yx * uTime * 1.3 + 0.5).rgb;
          diffuseColor.rgb *= mix(a, b, 0.45) * 1.08;
        }`);
  };
  m.customProgramCacheKey = () => 'upwater';
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d, seg, seg).rotateX(-Math.PI / 2), m);
  mesh.receiveShadow = true;
  mesh.userData.dynamic = true;
  mesh.onBeforeRender = () => {
    u.uTime.value = performance.now() / 1000;
  };
  return mesh;
}

// The Circle of Power that marks a race's finish: a ring of carved stone
// set in the ground round a glowing rune disc. `s` scales it (1 = a 128 u
// finish box).
export function circleOfPower(s = 1) {
  const g = new THREE.Group();
  const R = 1.25 * s;
  const stone = M.triMat('tex_stone.webp', '#8a8478', '#d8d0c4', 0.8);
  const rim = M.mesh(new THREE.TorusGeometry(R, 0.14 * Math.sqrt(s), 10, 48).rotateX(Math.PI / 2), stone, 0, 0.04, 0);
  rim.scale.y = 0.5;
  g.add(rim);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const b = M.mesh(M.blob(0.14 * Math.sqrt(s), 0.1, 0.1 * Math.sqrt(s), { seed: i + 5, amt: 0.1, detail: 1 }), stone, Math.cos(a) * R, 0.1, Math.sin(a) * R);
    b.rotation.y = -a;
    g.add(b);
  }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R * 0.95, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd86a', map: fxTexture('fx_flare.webp'), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  disc.position.y = 0.05;
  g.add(disc);
  // Rune ring: short glowing dashes turning slowly.
  const runes = new THREE.Group();
  const runeMat = new THREE.MeshBasicMaterial({ color: '#ffe8a0', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22 * s, 0.07 * s).rotateX(-Math.PI / 2), runeMat);
    m.position.set(Math.cos(a) * R * 0.72, 0.07, Math.sin(a) * R * 0.72);
    m.rotation.y = -a + Math.PI / 2;
    runes.add(m);
  }
  g.add(runes);
  g.userData = { disc, runes };
  return g;
}

registerView('powercircle', {
  make(e, world, v) {
    const g = bakeModel(circleOfPower(e.s || 1));
    v.parts = g.userData;
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.obj.rotation.y = 0;
    v.parts.runes.rotation.y = world.time * 0.3;
    v.parts.disc.material.opacity = 0.45 + Math.sin(world.time * 2.5) * 0.12;
    v.acc = (v.acc || 0) + dt * 6;
    while (v.acc >= 1) {
      v.acc -= 1;
      const a2 = Math.random() * Math.PI * 2;
      const r = Math.random() * 1.1 * (b.s || 1);
      world.fx.trail(v.x + Math.cos(a2) * r, 0.2, v.z + Math.sin(a2) * r, '#ffe48a', 0.3, 0.9, 0.05);
    }
  },
});

registerMapBuilder('upmaze', (map, world) => {
  const mz = map.maze;
  if (!mz) return;
  // Build into a group of our own, then merge it per material.
  const group = new THREE.Group();
  const w = { mapGroup: group };
  switch (mz.style) {
    case 'pillar': pillarBlocks(mz, w, { h: mz.h ?? 2.6 }); break;
    case 'cliff': cliffs(mz, w, { h: mz.h ?? 1.5 }); break;
    case 'trees': treeWalls(mz, w); break;
    case 'rocks': rockPiles(mz, w); break;
    default: stoneWalls(mz, w, { h: mz.h ?? 1.2 });
  }
  world.mapGroup.add(bakeStatic(group));
});
