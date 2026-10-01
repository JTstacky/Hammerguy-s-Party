// Shared visuals for this batch's walled arenas (The Rat Maze, Hot Mortar,
// Hungry Hungry Kodos, Raider Relay, The Polymorph Ring): WC3-style cliffs
// built as one smooth heightfield from the game's pathing grid, so walls read
// as raised rock with grassy tops and ragged edges rather than boxes; plus
// the Circle of Power and a few small shared helpers.

import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { fxTexture } from '../../engine/client/render/effects.js';

const NOISE = /* glsl */ `
  float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float cNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(cHash(i), cHash(i + vec2(1.0, 0.0)), f.x), mix(cHash(i + vec2(0.0, 1.0)), cHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
`;

// Rock on the faces, a ground tile on the tops, chosen per pixel by the
// surface normal (triplanar on the rock so steep faces don't stretch).
const cliffMats = new Map();
export function cliffMaterial({ top = 'tex_grass.webp', topTint = '#c8d4b0', rockTint = '#b8b0a4', rockScale = 0.45, topScale = 0.14 } = {}) {
  const key = [top, topTint, rockTint, rockScale, topScale].join('|');
  if (cliffMats.has(key)) return cliffMats.get(key);
  const u = {
    tRock: { value: null },
    tTop: { value: null },
    uOn: { value: 0 },
    cRock: { value: new THREE.Color(rockTint) },
    cTop: { value: new THREE.Color(topTint) },
    sRock: { value: rockScale },
    sTop: { value: topScale },
  };
  let loaded = 0;
  const done = () => {
    if (++loaded === 2) u.uOn.value = 1;
  };
  fxTexture('tex_boulder.webp', (t) => {
    u.tRock.value = t;
    done();
  }, { repeat: true });
  fxTexture(top, (t) => {
    u.tTop.value = t;
    done();
  }, { repeat: true });
  const m = new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCW; varying vec3 vCN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCW = (modelMatrix * vec4(position, 1.0)).xyz; vCN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vCW; varying vec3 vCN;
        uniform sampler2D tRock, tTop; uniform float uOn, sRock, sTop; uniform vec3 cRock, cTop;
        ${NOISE}`)
      .replace('#include <map_fragment>', `
        if (uOn > 0.5) {
          vec3 n = normalize(vCN);
          vec3 w = pow(abs(n), vec3(4.0));
          w /= (w.x + w.y + w.z);
          vec3 p = vCW * sRock;
          vec3 rock = (texture2D(tRock, p.zy).rgb * w.x + texture2D(tRock, p.xz).rgb * w.y + texture2D(tRock, p.xy).rgb * w.z) * cRock;
          vec3 top = texture2D(tTop, vCW.xz * sTop).rgb * cTop;
          float wob = cNoise(vCW.xz * 1.7) * 0.18;
          float k = smoothstep(0.62 + wob, 0.86 + wob, n.y);
          vec3 c = mix(rock, top, k);
          // Darker toward the foot, as WC3 cliffs are.
          c *= mix(0.62, 1.0, smoothstep(0.0, 0.9, vCW.y));
          diffuseColor.rgb *= c;
        }`);
  };
  m.customProgramCacheKey = () => 'fcliff';
  cliffMats.set(key, m);
  return m;
}

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function fbm(x, y) {
  return vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 7, y * 2.1 + 3) * 0.3 + vnoise(x * 4.3 + 1, y * 4.3 + 9) * 0.15;
}

// A cliff heightfield from a pathing grid.
//   cells: strings, row 0 = north (-z); T: cell size; solid(ch) -> bool
//   H: wall height; ramp: width of the cliff face; margin: cells of high
//   ground drawn round the grid; res: vertex spacing; outside: whether
//   the ground beyond the grid is low (walkable) instead of high.
// Walkable cells stay just under the ground plane; the cliff faces start at
// the cell edges and never lean into a walkable cell.
export function cliffField({ cells, T, cx = 0, cz = 0, solid = (ch) => ch === '#', H = 1.3, ramp = 0.55, margin = 4, res = 0.3, open = null, material = cliffMaterial(), lumps = 0.35, outside = false }) {
  const rows = cells.length;
  const cols = cells[0].length;
  const x0 = cx - (cols * T) / 2;
  const z0 = cz - (rows * T) / 2;
  const walk = (c, r) => {
    if (c < 0 || r < 0 || c >= cols || r >= rows) return outside;
    if (open && open(c, r)) return true;
    return !solid(cells[r][c]);
  };
  const W = (cols + margin * 2) * T;
  const D = (rows + margin * 2) * T;
  const nx = Math.ceil(W / res);
  const nz = Math.ceil(D / res);
  const geo = new THREE.PlaneGeometry(W, D, nx, nz).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const reach = Math.ceil((ramp + 0.5) / T) + 1;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx;
    const z = pos.getZ(i) + cz;
    const c = Math.floor((x - x0) / T);
    const r = Math.floor((z - z0) / T);
    let h;
    if (walk(c, r)) h = -0.08;
    else {
      // Distance to the nearest walkable cell.
      let d = Infinity;
      for (let rr = r - reach; rr <= r + reach; rr++) {
        for (let cc = c - reach; cc <= c + reach; cc++) {
          if (!walk(cc, rr)) continue;
          const bx = x0 + cc * T;
          const bz = z0 + rr * T;
          const px = Math.max(bx, Math.min(x, bx + T));
          const pz = Math.max(bz, Math.min(z, bz + T));
          d = Math.min(d, Math.hypot(px - x, pz - z));
        }
      }
      const n = fbm(x * 0.9, z * 0.9);
      const e = Math.max(0, d - 0.04 - n * 0.22); // ragged, receding edge
      const k = Math.min(1, e / ramp);
      const s = k * k * (3 - 2 * k);
      h = -0.08 + s * (H + 0.08) + (s > 0.98 ? (fbm(x * 0.35 + 5, z * 0.35) - 0.5) * lumps : 0) + s * (n - 0.5) * 0.25;
    }
    pos.setY(i, h);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(cx, 0, cz);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

// Scatters small doodads (bushes, stones, the odd pine) on the wall tops
// so long walls don't look extruded.
export function dressWalls(group, { cells, T, cx = 0, cz = 0, solid = (ch) => ch === '#', H = 1.3, density = 0.25, trees = 0, seed = 1 }) {
  const rows = cells.length;
  const cols = cells[0].length;
  const x0 = cx - (cols * T) / 2;
  const z0 = cz - (rows * T) / 2;
  let s = seed * 7919 + 13;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const isWall = (c, r) => c < 0 || r < 0 || c >= cols || r >= rows || solid(cells[r][c]);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isWall(c, r)) continue;
      // Only deep in a wall (all 8 neighbours wall) is there room on top.
      let inner = true;
      for (let dr = -1; dr <= 1 && inner; dr++) for (let dc = -1; dc <= 1; dc++) if (!isWall(c + dc, r + dr)) inner = false;
      const x = x0 + (c + 0.5) * T + (rnd() - 0.5) * T * 0.5;
      const z = z0 + (r + 0.5) * T + (rnd() - 0.5) * T * 0.5;
      const roll = rnd();
      if (inner && roll < trees) {
        const t = M.tree(0.55 + rnd() * 0.35);
        t.position.set(x, H - 0.1, z);
        group.add(t);
      } else if (roll < density) {
        const b = rnd() < 0.6 ? M.bush(0.45 + rnd() * 0.3) : M.rock(0.25 + rnd() * 0.25);
        b.position.set(x, H - 0.12, z);
        group.add(b);
      }
    }
  }
}

// A WC3 Circle of Power: a flat rune disc glowing in its owner's colour.
let runeTex = null;
function runeTexture() {
  if (runeTex) return runeTex;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.translate(S / 2, S / 2);
  g.strokeStyle = '#ffffff';
  g.fillStyle = '#ffffff';
  g.lineCap = 'round';
  const ring = (r, w, a = 1) => {
    g.globalAlpha = a;
    g.lineWidth = w;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
  };
  ring(118, 7);
  ring(104, 3, 0.8);
  ring(64, 4, 0.9);
  ring(52, 2, 0.6);
  // Runes between the rings.
  for (let i = 0; i < 12; i++) {
    g.save();
    g.rotate((i / 12) * Math.PI * 2);
    g.translate(0, -84);
    g.globalAlpha = 0.95;
    g.lineWidth = 3;
    g.beginPath();
    const k = i % 4;
    if (k === 0) { g.moveTo(-6, -9); g.lineTo(0, 9); g.lineTo(6, -9); }
    else if (k === 1) { g.moveTo(0, -10); g.lineTo(0, 10); g.moveTo(-7, -2); g.lineTo(7, 4); }
    else if (k === 2) { g.moveTo(-7, 8); g.lineTo(-7, -8); g.lineTo(7, 0); g.lineTo(-7, 8); }
    else { g.arc(0, 0, 7, 0.4, Math.PI * 1.6); g.moveTo(0, -10); g.lineTo(0, 10); }
    g.stroke();
    g.restore();
  }
  // A star in the middle.
  g.globalAlpha = 0.9;
  g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 2 * 3;
    g.lineTo(Math.cos(a) * 48, Math.sin(a) * 48);
  }
  g.stroke();
  const glow = g.createRadialGradient(0, 0, 0, 0, 0, 128);
  glow.addColorStop(0, 'rgba(255,255,255,0.35)');
  glow.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.globalAlpha = 1;
  g.fillStyle = glow;
  g.fillRect(-128, -128, 256, 256);
  runeTex = new THREE.CanvasTexture(c);
  runeTex.colorSpace = THREE.SRGBColorSpace;
  return runeTex;
}

export function circleOfPower(color, r = 1.3) {
  const g = new THREE.Group();
  const stone = M.texMat('tex_stone.webp', '#8c8a84', '#d8d4cc', 1);
  const base = M.mesh(M.lathe([[r * 1.02, 0], [r * 1.05, 0.05], [r * 0.98, 0.1], [0.01, 0.1]], 40), stone);
  base.castShadow = false;
  g.add(base);
  const rune = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: runeTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  rune.position.y = 0.12;
  g.add(rune);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const post = M.mesh(M.lathe([[0.09, 0], [0.08, 0.2], [0.05, 0.28], [0.01, 0.34]], 8), stone, Math.cos(a) * r, 0, Math.sin(a) * r);
    g.add(post);
    const gem = M.mesh(M.scaled(M.G.sphere, 0.06), M.glowMat(color), Math.cos(a) * r, 0.36, Math.sin(a) * r);
    g.add(gem);
  }
  g.userData = { rune };
  return g;
}

// A soft dark blob shadow for flyers (WC3 draws one under air units).
let shadowTex = null;
export function blobShadow(r = 1) {
  if (!shadowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)');
    grd.addColorStop(0.6, 'rgba(0,0,0,0.3)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.99, depthWrite: false }));
  m.position.y = 0.04;
  return m;
}

// Frame-rate independent particle emission (the same idea as world.js).
export function emit(v, key, rate, dt) {
  const acc = (v.emitF ??= {});
  acc[key] = (acc[key] || 0) + rate * dt;
  const n = Math.floor(acc[key]);
  acc[key] -= n;
  return n;
}

// The newest snapshot's entity for an id (views read other entities' flags).
export function latestEnt(world, id) {
  const s = world.snaps[world.snaps.length - 1];
  return s?.ents.get(id);
}

export function lerpA(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
