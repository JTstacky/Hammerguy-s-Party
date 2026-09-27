// Visuals for Uther Party 4.0 #52 "Sea Combat" (server/minigames/up/52-sea.js):
// the open sea of Tides of Darkness (painted, scrolling water with shallows in
// the NE and SW corners and surf along a sandy shore), the Human Battleship
// (the heroes' 'battleship' skin), its lobbed cannon shells, muzzle flashes,
// water spouts, hits and sinking wrecks, plus wakes and a gentle roll.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as M from '../../engine/client/render/models.js';
import { fxTexture } from '../../engine/client/render/effects.js';
import { registerView, registerEvent, registerSkin, registerTheme, registerMapBuilder } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';

// ------------------------------------------------------------ theme & water

const GRASS = { tex: 'tex_grass.webp', tint: '#a4b48c', color: '#46663a', units: 11 };
registerTheme(
  'sea',
  { sky: '#86aacb', fog: '#94b4cc', floor: ['#c8b080', 30, {}], sun: '#fff2dc', hemi: ['#d8ecff', '#2c4454'], sunI: 2.3 },
  { floor: GRASS, edge: GRASS, outer: GRASS, edgeWidth: 1.8 },
);

// WC3 north is up on screen; the shallows lie in the NE and SW corners.
const SHALLOWS = [
  [11.5, -11.5],
  [-12.5, 12],
];

// Build the coastline once, including all noise and shallow-water distances.
// R = signed distance (positive water), G = surf breakup, B = NE/SW shoals.
// The coast is an OUTWARD offset of the server rectangle, including its
// corners: neither the beach nor the water discard can enter navigable sea.
function coastNoise(x, z) {
  const hash = (a, b) => { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); };
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (1 - v) * ((1 - u) * hash(ix, iz) + u * hash(ix + 1, iz)) + v * ((1 - u) * hash(ix, iz + 1) + u * hash(ix + 1, iz + 1));
}

export function coastDistance(x, z, hw, hh) {
  const qx = Math.abs(x) - hw, qz = Math.abs(z) - hh;
  const rect = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
  const coves = coastNoise(x * 0.19 + 4, z * 0.19 + 9);
  const ripples = coastNoise(x * 0.83, z * 0.83);
  return 0.7 + 3.1 * coves + 0.35 * ripples - rect;
}

function coastline(hw, hh) {
  const res = 384;
  const extent = new THREE.Vector2(hw + 8, hh + 8);
  const data = new Uint8Array(res * res * 4);
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const x = ((i + 0.5) / res * 2 - 1) * extent.x;
    const z = ((j + 0.5) / res * 2 - 1) * extent.y;
    const d = coastDistance(x, z, hw, hh);
    const rag = coastNoise(x * 1.8, z * 1.8);
    let shoal = 0;
    for (const [sx, sz] of SHALLOWS) shoal = Math.max(shoal, 1 - smooth(2, 8, Math.hypot(x - sx, z - sz) + rag));
    const o = (j * res + i) * 4;
    data[o] = Math.round(Math.max(0, Math.min(1, (d + 8) / 16)) * 255);
    data[o + 1] = Math.round(rag * 255);
    data[o + 2] = Math.round(shoal * 255);
    data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, res, res);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return { tex, extent };
}

function seaMaterial(coast, time) {
  const u = {
    tWater: { value: null }, uOn: { value: 0 },
    tCoast: { value: coast.tex }, uExtent: { value: coast.extent }, time,
  };
  fxTexture('tex_sea_water.webp', (t) => { u.tWater.value = t; u.uOn.value = 1; }, { repeat: true });
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.28, metalness: 0.12 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSea;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSea = (modelMatrix * vec4(position, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vSea;
        uniform sampler2D tWater, tCoast;
        uniform float uOn, time;
        uniform vec2 uExtent;`)
      .replace('#include <map_fragment>', `
        vec2 p = vSea;
        vec3 coast = texture2D(tCoast, p / (2.0 * uExtent) + 0.5).rgb;
        float d = coast.r * 16.0 - 8.0;
        if (d < 0.0) discard;
        float rag = coast.g;
        vec3 c = vec3(0.03, 0.12, 0.2);
        if (uOn > 0.5) {
          vec3 a = texture2D(tWater, p * 0.045 + vec2(time * 0.010, time * 0.006)).rgb;
          vec3 b = texture2D(tWater, vec2(p.y, -p.x) * 0.034 + vec2(-time * 0.007, time * 0.011)).rgb;
          c = mix(a, b, 0.45) * 0.72;
        }
        float shallow = max(coast.b * 0.85, (1.0 - smoothstep(0.0, 3.8, d)) * 0.8);
        c = mix(c, c * vec3(1.3, 1.85, 1.65) + vec3(0.05, 0.13, 0.1), shallow);
        float wave = 0.28 + 0.17 * sin(time * 1.4 + (p.x + p.y) * 0.7);
        float surf = 1.0 - smoothstep(0.045, 0.24, abs(d - wave - rag * 0.22));
        c = mix(c, vec3(0.74, 0.87, 0.82), surf * smoothstep(0.18, 0.75, rag) * 0.65);
        diffuseColor.rgb = c;`);
  };
  mat.customProgramCacheKey = () => 'seaCoastWater';
  return mat;
}

function beachMaterial(coast) {
  const mat = new THREE.MeshStandardMaterial({ color: '#d9c79b', roughness: 1, metalness: 0, transparent: true, depthWrite: false });
  const u = { tCoast: { value: coast.tex }, uExtent: { value: coast.extent }, tSand: { value: null }, sandOn: { value: 0 } };
  fxTexture('tex_dirt.webp', (t) => { u.tSand.value = t; u.sandOn.value = 1; }, { repeat: true });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBeach;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBeach = (modelMatrix * vec4(position, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vBeach;
        uniform sampler2D tCoast, tSand;
        uniform vec2 uExtent;
        uniform float sandOn;`)
      .replace('#include <map_fragment>', `
        vec3 coast = texture2D(tCoast, vBeach / (2.0 * uExtent) + 0.5).rgb;
        float inland = 8.0 - coast.r * 16.0;
        // A narrow damp rim gives way to pale sand, then feathered grass.
        float fade = 1.0 - smoothstep(1.0, 3.0 + coast.g * 1.2, inland);
        if (fade < 0.01 || inland < -0.2) discard;
        vec3 sand = vec3(0.7);
        if (sandOn > 0.5) {
          vec3 tile = texture2D(tSand, vBeach * 0.18).rgb;
          sand = vec3(0.6 + dot(tile, vec3(0.299, 0.587, 0.114)) * 0.4);
        }
        diffuseColor.rgb *= sand * mix(vec3(0.56, 0.65, 0.63), vec3(1.0), smoothstep(0.0, 0.85, inland));
        diffuseColor.a *= fade;`);
  };
  mat.customProgramCacheKey = () => 'seaCoastBeach';
  return mat;
}

registerMapBuilder('sea', (map, world) => {
  const hw = map.floor.w / 2, hh = map.floor.h / 2;
  const coast = coastline(hw, hh);
  const holder = { uniforms: { time: { value: 0 } } };
  world.liquids.push(holder);
  const geo = new THREE.PlaneGeometry(coast.extent.x * 2, coast.extent.y * 2).rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geo, seaMaterial(coast, holder.uniforms.time));
  water.position.y = 0.05;
  water.receiveShadow = true;
  const beach = new THREE.Mesh(geo, beachMaterial(coast));
  beach.position.y = 0.035;
  beach.receiveShadow = true;
  world.mapGroup.add(water, beach);
});

// ------------------------------------------------------------ battleship

// A sail of heavy canvas: stitched panels with a band and a round badge in
// the owner's colour.
const sailCache = new Map();
function sailMat(color) {
  if (sailCache.has(color)) return sailCache.get(color);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e6dac0';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1400; i++) {
    const v = 200 + Math.random() * 40;
    g.fillStyle = `rgba(${v},${v - 12},${v - 36},0.35)`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1);
  }
  g.fillStyle = color;
  g.fillRect(0, 46, 128, 36);
  g.beginPath();
  g.arc(64, 64, 22, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#f4ecd8';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(64, 64, 16, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = 'rgba(90,70,40,0.35)';
  g.lineWidth = 1;
  for (let x = 16; x < 128; x += 16) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 128);
    g.stroke();
  }
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, 'rgba(60,40,20,0.3)');
  grd.addColorStop(0.15, 'rgba(0,0,0,0)');
  grd.addColorStop(0.85, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(60,40,20,0.35)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 });
  sailCache.set(color, m);
  return m;
}

// Hull half-width and depth along the keel (t = 0 at the stern, 1 at the bow).
function hullSection(t, W, D) {
  const w = t < 0.4 ? 0.78 + 0.22 * Math.sin((t / 0.4) * (Math.PI / 2)) : Math.sqrt(Math.max(0, 1 - ((t - 0.4) / 0.6) ** 2.2));
  const d = t < 0.8 ? 1 : 1 - ((t - 0.8) / 0.2) * 0.45;
  return { w: W * w, d: D * d };
}

// A smooth hull: rings of a full U-shaped section from the transom to a
// sharp stem, planked along its length.
function hullGeometry(L, W, D, top) {
  const NX = 28;
  const NP = 14;
  const rings = [];
  rings.push({ t: 0, scale: 0 }); // the transom closes the stern
  for (let i = 0; i <= NX; i++) rings.push({ t: i / NX, scale: 1 });
  const pos = [];
  const uv = [];
  for (const r of rings) {
    const { w, d } = hullSection(r.t, W, D);
    const x = -L / 2 + r.t * L;
    for (let j = 0; j <= NP; j++) {
      const phi = (j / NP) * Math.PI;
      const s = Math.sin(phi);
      pos.push(x, top - d * Math.pow(s, 0.6), w * r.scale * Math.cos(phi) * (1 - 0.08 * s));
      uv.push(r.t * 3.2, j / NP);
    }
  }
  const idx = [];
  for (let r = 0; r < rings.length - 1; r++) {
    for (let j = 0; j < NP; j++) {
      const a = r * (NP + 1) + j;
      const b = a + NP + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function deckGeometry(L, W, top) {
  const sh = new THREE.Shape();
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const { w } = hullSection(t, W, 1);
    const x = -L / 2 + t * L;
    if (i) sh.lineTo(x, w * 0.97);
    else sh.moveTo(x, w * 0.97);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    const { w } = hullSection(t, W, 1);
    sh.lineTo(-L / 2 + t * L, -w * 0.97);
  }
  const g = new THREE.ShapeGeometry(sh);
  g.rotateX(-Math.PI / 2);
  g.translate(0, top, 0);
  return g;
}

export function battleship(color) {
  const L = 3.8;
  const W = 0.66;
  const D = 0.85;
  const top = 0.6;
  const g = new THREE.Group();
  const outer = new THREE.Group();
  g.add(outer);
  // The renderer tips 'outer' bow-up when the ship dies; 'body' then slides down inside it.
  const body = new THREE.Group();
  outer.add(body);
  const hull = M.texMat('tex_wood.webp', '#3a2618', '#9a7458');
  const deckWood = M.texMat('tex_wood.webp', '#6a4c34', '#c8a882', 2);
  const trim = M.goldMat();
  const iron = M.mat('#2e2e32', { metalness: 0.7, roughness: 0.4 });
  const spar = M.texMat('tex_wood.webp', '#4a3020', '#a88462');
  const cabin = M.texMat('tex_wood.webp', '#503422', '#b08a66', 2);
  const team = M.mat(color, { roughness: 0.7 });
  body.add(M.mesh(hullGeometry(L, W, D, top), hull));
  body.add(M.mesh(deckGeometry(L, W, top + 0.01), deckWood));
  // Gunwale rails and a painted strake in the owner's colour.
  for (const s of [1, -1]) {
    const rail = [];
    const strake = [];
    for (let i = 0; i <= 16; i++) {
      const t = 0.01 + (i / 16) * 0.95;
      const { w } = hullSection(t, W, D);
      const x = -L / 2 + t * L;
      rail.push([x, top + 0.07, s * w * 0.97]);
      strake.push([x, top - 0.2, s * (w * 0.98 + 0.012)]);
    }
    body.add(M.mesh(M.tube(rail, 0.035, 0.03, 32, 6), trim));
    body.add(M.mesh(M.tube(strake, 0.05, 0.035, 32, 6), team));
    // Three broadside cannons a side.
    for (const x of [-0.75, -0.05, 0.65]) {
      const t = (x + L / 2) / L;
      const { w } = hullSection(t, W, D);
      const gun = M.mesh(M.lathe([[0.075, 0], [0.07, 0.25], [0.055, 0.32], [0.065, 0.36], [0.001, 0.36]], 10), iron, x, top - 0.12, s * (w - 0.02));
      gun.rotation.x = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      body.add(gun);
    }
  }
  // Sterncastle with lit windows and a lantern; a low forecastle.
  const castle = M.mesh(new RoundedBoxGeometry(0.95, 0.55, W * 1.55, 3, 0.07), cabin, -L / 2 + 0.55, top + 0.26, 0);
  body.add(castle);
  body.add(M.mesh(new RoundedBoxGeometry(1.05, 0.08, W * 1.7, 2, 0.03), spar, -L / 2 + 0.55, top + 0.56, 0));
  const rim = M.mesh(new THREE.TorusGeometry(1, 0.025, 5, 4).rotateX(Math.PI / 2).rotateY(Math.PI / 4), trim, -L / 2 + 0.55, top + 0.62, 0);
  rim.scale.set(0.74, 1, W * 1.2);
  body.add(rim);
  for (const z of [-0.28, 0, 0.28]) body.add(M.mesh(M.scaled(M.G.box, 0.02, 0.16, 0.14), M.glowMat('#ffc860'), -L / 2 + 0.07, top + 0.3, z));
  const lantern = M.mesh(M.scaled(M.G.sphere, 0.09), M.glowMat('#ffd890'), -L / 2 - 0.02, top + 0.78, 0);
  body.add(lantern, M.mesh(M.tube([[-L / 2 + 0.1, top + 0.55, 0], [-L / 2 - 0.02, top + 0.7, 0]], 0.02, 0.02, 2, 4), iron));
  body.add(M.mesh(new RoundedBoxGeometry(0.7, 0.3, W * 1.05, 3, 0.06), cabin, L / 2 - 1.05, top + 0.14, 0));
  // Bow chaser: the big gun on the forecastle that fires the shells.
  const gun = new THREE.Group();
  gun.position.set(L / 2 - 1.0, top + 0.36, 0);
  const barrel = M.mesh(M.lathe([[0.12, 0], [0.11, 0.35], [0.085, 0.62], [0.1, 0.68], [0.06, 0.68], [0.06, 0.66], [0.001, 0.66]], 14), iron);
  barrel.rotation.z = -Math.PI / 2;
  barrel.position.x = 0.05;
  gun.add(barrel, M.mesh(M.scaled(M.G.sphere, 0.13), iron, 0.02, 0, 0));
  body.add(gun);
  // Bowsprit and figurehead.
  body.add(M.mesh(M.tube([[L / 2 - 0.3, top + 0.1, 0], [L / 2 + 0.3, top + 0.35, 0], [L / 2 + 0.75, top + 0.52, 0]], 0.05, 0.025, 6, 6), spar));
  body.add(M.mesh(M.blob(0.14, 0.2, 0.1, { seed: 44 }), trim, L / 2 + 0.02, top - 0.05, 0));
  // Two masts with yards and billowing sails.
  const sail = sailMat(color);
  for (const [x, h, sw] of [[-0.05, 2.9, 1.5], [0.95, 2.35, 1.2]]) {
    body.add(M.mesh(M.tube([[x, top, 0], [x, top + h * 0.5, 0], [x, top + h, 0]], 0.075, 0.045, 4, 8), spar));
    for (const [y, span, sh] of [[top + h * 0.9, sw * 0.8, h * 0.28], [top + h * 0.52, sw, h * 0.36]]) {
      body.add(M.mesh(M.tube([[x + 0.06, y, -span / 2], [x + 0.08, y, 0], [x + 0.06, y, span / 2]], 0.035, 0.035, 4, 6), spar));
      const s = M.mesh(M.cloth(span * 0.94, sh, 0.32, 0.05), sail, x + 0.1, y - sh / 2 - 0.02, 0);
      s.castShadow = true;
      body.add(s);
    }
    body.add(M.mesh(M.lathe([[0.001, 0], [0.16, 0.02], [0.17, 0.14], [0.15, 0.16]], 12), spar, x, top + h * 0.72, 0));
    const pennant = M.mesh(M.cloth(0.1, 0.45, 0.02, 0.1), M.mat(color, { side: THREE.DoubleSide }), x - 0.22, top + h + 0.05, 0);
    pennant.rotation.z = Math.PI / 2;
    body.add(pennant);
  }
  // Rigging lines from the mastheads to the bow and stern.
  const rope = M.mat('#3a2a1a');
  body.add(M.mesh(M.tube([[-0.05, top + 2.9, 0], [0.45, top + 2.6, 0], [0.95, top + 2.35, 0]], 0.012, 0.012, 4, 4), rope));
  body.add(M.mesh(M.tube([[0.95, top + 2.35, 0], [1.6, top + 1.4, 0], [L / 2 + 0.7, top + 0.52, 0]], 0.012, 0.012, 6, 4), rope));
  for (const s of [1, -1]) body.add(M.mesh(M.tube([[-0.05, top + 2.6, 0], [-0.3, top + 1.3, s * 0.4], [-0.4, top + 0.08, s * W * 0.95]], 0.012, 0.012, 6, 4), rope));
  g.userData = { body: outer, hull: body, gun, kind: 'ship' };
  return g;
}

// Wakes, spray, recoil, a gentle roll and sinking: each ship animates itself
// every frame (the skin's userData.tick hook).
function shipTick(dt, sv, snap, world) {
  const fx = world.fx;
  const o = sv.obj;
  const { body, hull, gun } = o.userData;
  if (gun?.userData.recoil > 0) {
    gun.userData.recoil = Math.max(0, gun.userData.recoil - dt * 3);
    gun.position.x = 0.9 - Math.sin(gun.userData.recoil * Math.PI) * 0.18;
  }
  if (sv.deadT > 0) {
    hull.position.x = -Math.min(3, Math.max(0, sv.deadT - 0.6) * 1.2);
    if (sv.deadT < 3 && Math.random() < dt * 10) fx.smokePuff(o.position.x, 0.4, o.position.z, '#302a28', 1.3, 1.6, 0.5);
    return;
  }
  body.rotation.x = Math.sin(world.time * 1.3 + sv.id) * 0.04;
  const x = o.position.x;
  const z = o.position.z;
  const px = sv.lastX;
  const pz = sv.lastZ;
  sv.lastX = x;
  sv.lastZ = z;
  if (px == null || dt <= 0) return;
  if (Math.hypot(x - px, z - pz) / dt < 0.5) return;
  const f = -o.rotation.y;
  const cx = Math.cos(f);
  const cz = Math.sin(f);
  sv.wake = (sv.wake || 0) + dt * 26;
  while (sv.wake >= 1) {
    sv.wake -= 1;
    const side = Math.random() < 0.5 ? 1 : -1;
    fx.trail(x - cx * 1.9 - cz * side * 0.3, 0.12, z - cz * 1.9 + cx * side * 0.3, '#dff4ff', 0.55, 1.1, 0.25);
    if (Math.random() < 0.5) fx.trail(x + cx * 1.9 + cz * side * 0.25, 0.2, z + cz * 1.9 - cx * side * 0.25, '#ffffff', 0.4, 0.5, 0.15);
  }
}

registerSkin('battleship', (color) => {
  const g = battleship(color);
  g.userData.tick = shipTick;
  return g;
});

// The server still sends one 'seafx' entity; the ships animate themselves now.
registerView('seafx', {
  make() {
    return new THREE.Group();
  },
});

// ------------------------------------------------------------ shells

registerView('shell', {
  make(e, world, v) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe8c0', transparent: true, opacity: 0, depthWrite: false }));
    ring.scale.setScalar(e.r);
    ring.position.y = 0.09;
    g.add(ring);
    const ball = M.mesh(M.scaled(M.G.sphere, 0.16), M.mat('#1e1e22', { metalness: 0.6, roughness: 0.35 }));
    world.entGroup.add(ball);
    v.parts = { ring, ball };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const t = Math.min(1, Math.max(0, (a.t ?? 0) + ((b.t ?? 0) - (a.t ?? 0)) * k));
    const P = v.parts;
    P.ring.material.opacity = 0.3 * Math.min(1, t * 1.6);
    const sx = b.sx ?? v.x;
    const sz = b.sy ?? v.z;
    const d = Math.hypot(v.x - sx, v.z - sz);
    const apex = Math.max(1.2, d * 0.22);
    const y = 1.0 * (1 - t) + 4 * t * (1 - t) * apex + 0.2 * t;
    P.ball.visible = v.obj.visible;
    P.ball.position.set(sx + (v.x - sx) * t, y, sz + (v.z - sz) * t);
    v.acc = (v.acc || 0) + dt * 22;
    while (v.acc >= 1) {
      v.acc -= 1;
      world.fx.trail(P.ball.position.x, y, P.ball.position.z, '#8a8680', 0.35, 0.45, 0.05);
    }
  },
  remove(v, world) {
    world.entGroup.remove(v.parts.ball);
  },
});

// A water spout where a shell lands, or a fiery hit on a ship.
function spout(fx, x, z, s = 1) {
  fx.burst(x, 0.1, z, '#e8f6ff', { n: Math.round(22 * s), speed: 3.5 * s, size: 0.32, life: 0.9, up: 2.6, grav: 11, additive: false, drag: 0.8 });
  fx.burst(x, 0.1, z, '#7fb8d8', { n: Math.round(14 * s), speed: 5 * s, size: 0.26, life: 0.7, up: 1.2, grav: 12, additive: false });
  for (let i = 0; i < 2; i++) fx.smokePuff(x, 0.5 + i * 0.7, z, '#e6f2f8', 0.55 * s, 0.9, 0.3);
  fx.ring(x, z, 1.6 * s, '#ffffff', 0.7, 0.1);
}

registerEvent('seahit', (e, world) => {
  const fx = world.fx;
  spout(fx, e.x, e.y, e.hit ? 0.8 : 1);
  if (e.hit) {
    fx.explosion(e.x, e.y, 1.1, { scorch: false });
    fx.debrisBurst(e.x, e.y, 8, 5);
    world.shake = Math.max(world.shake || 0, 0.2);
    play('boom');
  } else play('splash');
});

registerEvent('cannon', (e, world) => {
  const fx = world.fx;
  const cx = Math.cos(e.f);
  const cz = Math.sin(e.f);
  fx.glow(e.x, 1.1, e.y, '#ffc070', 2.2, 0.18);
  fx.sparks(e.x, 1.1, e.y, 8, 4, '#ffd080');
  for (let i = 0; i < 3; i++) fx.smokePuff(e.x + cx * i * 0.3, 1.0, e.y + cz * i * 0.3, '#d8d4cc', 0.5 + i * 0.1, 1.0, 0.35);
  const gun = world.views.get(e.u)?.obj.userData.gun;
  if (gun) gun.userData.recoil = 1;
  play('mortar');
});

registerEvent('sink', (e, world) => {
  const fx = world.fx;
  fx.explosion(e.x, e.y, 1.8, { scorch: false });
  spout(fx, e.x, e.y, 1.4);
  fx.debrisBurst(e.x, e.y, 16, 6);
  for (let i = 0; i < 6; i++) fx.smokePuff(e.x + (Math.random() - 0.5) * 2, 0.8, e.y + (Math.random() - 0.5) * 2, '#2a2422', 1.6, 2.2, 0.55);
  world.shake = 0.4;
  play('bigboom');
});
