// Effects shared by this batch's views (Kaboom Room, Clean-up Crew, Treant
// Valley, Skeleton Sonata, Spike Pit, Salamander Sizzle): WC3's Dispel Magic,
// a lightning strike from the sky, ground telegraph rings, fire-wisp flames
// and a fixed-rate emitter.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fxTexture } from '../../engine/client/render/effects.js';
import { FX_DENSITY } from '../../engine/client/device.js';
import { play } from '../../engine/client/audio.js';
import { registerTheme } from '../../engine/client/render/registry.js';

// An underground dungeon: dressed stone floor, dark earth beyond, warm torchlight
// (the Kaboom Room, the Spike Pit, the Salamander Sizzle).
registerTheme(
  'undercroft',
  { sky: '#16120e', fog: '#1c1712', floor: ['#6a6058', 35, { tiles: true }], sun: '#ffe2c0', hemi: ['#c8b8a0', '#241c14'], sunI: 2.0 },
  {
    floor: { tex: 'tex_stone.webp', tint: '#b0a494', color: '#6a6058', units: 6 },
    edge: { tex: 'tex_dirt.webp', tint: '#7a6a58', color: '#4a3c30', units: 5 },
    outer: { tex: 'tex_dirt.webp', tint: '#4a4644', color: '#3a3028', units: 9 },
    edgeWidth: 1.3,
  },
);

// Fixed-rate particle emission: how many particles `rate` per second owes this
// frame, carrying the fraction over (frame-rate independent).
export function emit(v, key, rate, dt) {
  const acc = (v.emit ??= {});
  acc[key] = (acc[key] || 0) + rate * FX_DENSITY * dt;
  const n = Math.floor(acc[key]);
  acc[key] -= n;
  return n;
}

const rnd = (a, b) => a + Math.random() * (b - a);
let flareTex = null;
const flare = () => (flareTex ??= fxTexture('fx_flare.webp'));
let purgeTex = null;
const swirl = () => (purgeTex ??= fxTexture('fx_purge.webp'));
const disc = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);

// An additive ground decal (a glow, a swirl) that plays for `dur` seconds.
// `update(k, m)` runs every frame with k going 0 → 1.
export function groundDecal(world, x, z, r, { color = '#ffffff', map = flare(), dur = 0.6, y = 0.08, update } = {}) {
  const m = new THREE.Mesh(disc, new THREE.MeshBasicMaterial({ color, map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  m.position.set(x, y, z);
  m.scale.setScalar(r);
  m.renderOrder = 2;
  world.scene.add(m);
  world.fx.transients.push({ obj: m, t: 0, dur, update: (k) => (update ? update(k, m) : (m.material.opacity = 1 - k)) });
  return m;
}

// WC3 Dispel Magic: a flash of pale blue light over the area, a ring of
// arcane wind sweeping out to its edge, sparks and a brief swirl.
export function dispelEffect(world, x, z, r, { blight = false } = {}) {
  const fx = world.fx;
  groundDecal(world, x, z, r * 1.25, { color: '#9fd8ff', dur: 0.7, update: (k, m) => (m.material.opacity = (1 - k) * (1 - k)) });
  groundDecal(world, x, z, r * 0.9, { color: '#e8f6ff', map: swirl(), dur: 0.9, y: 0.1, update: (k, m) => { m.rotation.y = -k * 5; m.scale.setScalar(r * (0.5 + 0.6 * k)); m.material.opacity = 1 - k; } });
  fx.shockwave(x, z, r, '#bfe6ff', 0.5);
  fx.ring(x, z, r, '#9fd8ff', 0.5, 0.12);
  fx.glow(x, 1.2, z, '#cfeeff', r * 1.6, 0.35);
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * r;
    fx.sp.spark.spawn(x + Math.cos(a) * rr, 0.2, z + Math.sin(a) * rr, { vx: 0, vy: rnd(3, 7), vz: 0, color: Math.random() < 0.5 ? '#bfe8ff' : '#ffffff', size: rnd(0.3, 0.6), grow: 0.3, life: rnd(0.5, 0.9), drag: 1.5 });
  }
  if (blight) {
    // The blight boils away in violet smoke.
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * r;
      fx.smokePuff(x + Math.cos(a) * rr, 0.2, z + Math.sin(a) * rr, '#4a2a5a', 1.2, 1.6, 0.45);
    }
  }
  fx.flash(x, z, r, '#9fd8ff', 0.3);
  play('zap');
}

// A telegraph: a ring on the ground that closes in on the spot over `dur` seconds.
export function telegraph(world, x, z, r, color = '#9fd8ff', dur = 0.5) {
  groundDecal(world, x, z, r, { color, dur, update: (k, m) => { m.material.opacity = 0.25 + 0.35 * k; } });
  const ring = new THREE.Mesh(world.fx.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  ring.position.set(x, 0.1, z);
  world.scene.add(ring);
  world.fx.transients.push({ obj: ring, t: 0, dur, update: (k) => { ring.scale.setScalar(r * (1.35 - 0.35 * k)); ring.material.opacity = 0.4 + 0.6 * k; } });
}

// A lightning bolt striking down from the sky onto (x, z).
export function skyBolt(world, x, z, color = '#bfe0ff') {
  const pts = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const j = i === n ? 0 : 0.6 * (1 - k * 0.5);
    pts.push(new THREE.Vector3(x + rnd(-j, j) + (1 - k) * 2, 16 * (1 - k), z + rnd(-j, j) - (1 - k) * 1.5));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const mk = (r, c, o) => new THREE.Mesh(new THREE.TubeGeometry(curve, 48, r, 5), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const core = mk(0.07, '#ffffff', 1);
  const glow = mk(0.3, color, 0.55);
  const g = new THREE.Group();
  g.add(core, glow);
  world.scene.add(g);
  world.fx.transients.push({
    obj: g, t: 0, dur: 0.5,
    update: (k) => { const f = k < 0.15 || (k > 0.3 && k < 0.4) ? 1 : 0.35; core.material.opacity = (1 - k) * f; glow.material.opacity = 0.55 * (1 - k) * f; },
    dispose: () => { core.geometry.dispose(); glow.geometry.dispose(); },
  });
  world.fx.glow(x, 0.6, z, color, 5, 0.4);
  world.fx.sparks(x, 0.4, z, 16, 6, '#dff0ff');
  world.fx.flash(x, z, 4, '#bfe0ff', 0.35);
  world.fx.scorch(x, z, 0.8, 4);
}

// Flames round a burning point (fire wisps, fireballs): a bright core, licks of
// flame and the odd ember. Call every frame with the emitter record `v`.
export function fireball(world, v, x, y, z, dt, size = 1) {
  const fx = world.fx;
  for (let n = emit(v, 'core', 34, dt); n > 0; n--) fx.sp.fire.spawn(x + rnd(-0.12, 0.12) * size, y, z + rnd(-0.12, 0.12) * size, { vx: rnd(-0.3, 0.3), vy: rnd(0.4, 1.1), vz: rnd(-0.3, 0.3), size: size * rnd(1.7, 2.3), grow: 0.55, life: rnd(0.3, 0.45), frame: -1, spin: rnd(-2, 2), fadeIn: 0.05 });
  for (let n = emit(v, 'lick', 34, dt); n > 0; n--) fx.flame(x, y - 0.1 * size, z, size * 1.5, 0.55, 0.25 * size);
  if (emit(v, 'flare', 10, dt)) fx.glow(x, y, z, '#ffb050', size * 2.6, 0.2);
  if (emit(v, 'ember', 8, dt)) fx.sparks(x, y, z, 1, 2, '#ffb040');
  if (emit(v, 'smoke', 5, dt)) fx.smokePuff(x, y + 0.9 * size, z, '#2a2220', 1.1 * size, 1.2, 0.3);
}

// Attack animation progress for a creature view: the built-in 'swing' event
// sets v.castT; this plays a `dur`-second swing from it and returns its
// strength (0 → 1 → 0).
export function swingPhase(v, dt, dur) {
  if (v.castT > 0) {
    v.castT = 0;
    v.atk = 1e-3;
  }
  if (!(v.atk > 0)) return 0;
  v.atk += dt / dur;
  if (v.atk >= 1) {
    v.atk = 0;
    return 0;
  }
  return Math.sin(v.atk * Math.PI);
}

// A soft additive glow disc that follows a view (heat under a fire, a spell ring).
export function glowDisc(color, r, opacity = 0.35) {
  const m = new THREE.Mesh(disc, new THREE.MeshBasicMaterial({ color, map: flare(), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  m.scale.setScalar(r);
  m.position.y = 0.07;
  m.renderOrder = 2;
  return m;
}

// ------------------------------------------------------------ model helpers

// A low-poly ellipsoid (160 triangles) for eyes, knuckles and knobs, so the
// small parts of a model do not cost more than its body.
const BALL = new THREE.SphereGeometry(1, 10, 8);
export function ball(sx, sy = sx, sz = sx) {
  const g = BALL.clone();
  g.scale(sx, sy, sz);
  return g;
}

// Merges a creature model's static meshes per material, keeping every part
// listed in its userData (legs, arms, body...) as its own animated pivot, the
// same way the engine bakes hero models. A crowd of treants then costs a few
// draw calls each instead of forty.
export function bakeParts(root) {
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
    const m = new THREE.Matrix4().copy(owner.matrixWorld).invert().multiply(o.matrixWorld);
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(m);
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
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mm = new THREE.Mesh(merged, material);
      mm.castShadow = true;
      mm.receiveShadow = true;
      owner.add(mm);
    }
  }
  return root;
}

// A cached unlit glow material (eyes, sparks, crystals): one per colour.
const glows = new Map();
export function glowMat(color, opacity = 1) {
  const key = `${color}|${opacity}`;
  if (!glows.has(key)) glows.set(key, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false }));
  return glows.get(key);
}
