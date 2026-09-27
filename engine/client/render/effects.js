// Visual effects: a pooled GPU particle system, expanding shockwave rings,
// lightning bolts and WC3-style floating text.

import * as THREE from 'three';
import { LITE, FX_DENSITY } from '../device.js';

const MAX_PARTICLES = 6000;

const vert = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 color;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float scale;
  void main() {
    vAlpha = alpha;
    vColor = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * scale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const frag = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * (0.6 + a), a * vAlpha);
  }
`;

export class Particles {
  constructor(scene, blending) {
    this.pos = new Float32Array(MAX_PARTICLES * 3);
    this.col = new Float32Array(MAX_PARTICLES * 3);
    this.size = new Float32Array(MAX_PARTICLES);
    this.alpha = new Float32Array(MAX_PARTICLES);
    this.vel = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);
    this.maxLife = new Float32Array(MAX_PARTICLES);
    this.size0 = new Float32Array(MAX_PARTICLES);
    this.grav = new Float32Array(MAX_PARTICLES);
    this.drag = new Float32Array(MAX_PARTICLES);
    initPool(this, MAX_PARTICLES);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { scale: { value: 400 } },
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
    this.geo = geo;
    resetPool(this);
  }

  spawn(x, y, z, vx, vy, vz, color, size, life, grav = 0, drag = 0) {
    const i = spawnSlot(this);
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = color.r;
    this.col[i * 3 + 1] = color.g;
    this.col[i * 3 + 2] = color.b;
    this.size[i] = this.size0[i] = size;
    this.life[i] = this.maxLife[i] = life;
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.alpha[i] = 1;
  }

  update(dt) {
    for (let i = 0; i < this.count; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        removeParticle(this, i--);
        continue;
      }
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const dr = 1 - this.drag[i] * dt;
      this.vel[i * 3] *= dr;
      this.vel[i * 3 + 2] *= dr;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = k;
      this.size[i] = this.size0[i] * (0.4 + 0.6 * k);
    }
    uploadLive(this, ['position', 'color', 'size', 'alpha']);
  }
}

// ---------------------------------------------------------------------------
// Textured sprite particles, like WC3's particle emitters: each particle is a
// camera-facing sprite from a texture atlas, optionally playing a flipbook,
// spinning, growing and fading. Modes:
//   'add'  texture colour x tint, additive (fire, explosions: art on black)
//   'mask' texture luminance is the alpha, colour is the tint (smoke, dust)
//   'rgba' texture colour and alpha (debris)

const spriteVert = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute float rot;
  attribute float frame;
  attribute vec3 color;
  varying float vAlpha;
  varying float vRot;
  varying float vFrame;
  varying vec3 vColor;
  uniform float scale;
  void main() {
    vAlpha = alpha;
    vRot = rot;
    vFrame = frame;
    vColor = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * scale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const spriteFrag = /* glsl */ `
  uniform sampler2D map;
  uniform vec2 grid;
  uniform int mode;
  varying float vAlpha;
  varying float vRot;
  varying float vFrame;
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vRot), s = sin(vRot);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) discard;
    float col = mod(vFrame, grid.x);
    float row = floor(vFrame / grid.x);
    vec2 uv = vec2((col + p.x) / grid.x, 1.0 - (row + p.y) / grid.y);
    vec4 t = texture2D(map, uv);
    if (mode == 0) gl_FragColor = vec4(t.rgb * vColor, vAlpha);
    else if (mode == 1) gl_FragColor = vec4(vColor, t.r * vAlpha);
    else gl_FragColor = vec4(t.rgb * vColor, t.a * vAlpha);
  }
`;

const MODES = { add: 0, mask: 1, rgba: 2 };
const loader = new THREE.TextureLoader();

// A soft round fallback, used until (or if) the sprite art is not available.
function fallbackTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, '#fff');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Loads a texture from client/public/fx/, calling `onLoad(tex)` when it arrives.
// One texture per file and settings, shared by every caller (marked
// userData.shared so map and view teardown never disposes it). onLoad runs
// once the image is in, asynchronously even when it already is.
const fxCache = new Map();
export function fxTexture(file, onLoad, { repeat = false, srgb = true } = {}) {
  const key = `${file}|${repeat}|${srgb}`;
  let e = fxCache.get(key);
  if (!e) {
    e = { tex: null, loaded: false, waiting: [] };
    fxCache.set(key, e);
    e.tex = loader.load(`fx/${file}`, (tex) => {
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 4;
      e.loaded = true;
      for (const fn of e.waiting) fn(tex);
      e.waiting = null;
    }, undefined, () => {});
    e.tex.userData.shared = true;
  }
  if (onLoad) {
    if (e.loaded) queueMicrotask(() => onLoad(e.tex));
    else e.waiting.push(onLoad);
  }
  return e.tex;
}

export class SpriteParticles {
  constructor(scene, { file, cols = 1, rows = 1, mode = 'add', max = 1500, blending }) {
    max = Math.ceil(max * FX_DENSITY);
    this.max = max;
    this.cells = cols * rows;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.rot = new Float32Array(max);
    this.frame = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.frame0 = new Float32Array(max);
    this.anim = new Float32Array(max); // flipbook frames to play over the particle's life (0 = still)
    this.alpha0 = new Float32Array(max);
    this.fadeIn = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    initPool(this, max);
    const geo = new THREE.BufferGeometry();
    const attr = (name, arr, n) => geo.setAttribute(name, new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage));
    attr('position', this.pos, 3);
    attr('color', this.col, 3);
    attr('size', this.size, 1);
    attr('alpha', this.alpha, 1);
    attr('rot', this.rot, 1);
    attr('frame', this.frame, 1);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.material = new THREE.ShaderMaterial({
      vertexShader: spriteVert,
      fragmentShader: spriteFrag,
      uniforms: { scale: { value: 400 }, map: { value: fallbackTexture() }, grid: { value: new THREE.Vector2(1, 1) }, mode: { value: mode === 'rgba' ? MODES.mask : MODES[mode] } },
      transparent: true,
      depthWrite: false,
      blending: blending ?? (mode === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending),
    });
    // Until the atlas loads, every cell samples the whole soft fallback.
    fxTexture(file, (tex) => {
      this.material.uniforms.map.value = tex;
      this.material.uniforms.grid.value.set(cols, rows);
      this.material.uniforms.mode.value = MODES[mode];
    }, { srgb: mode !== 'mask' });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 11;
    scene.add(this.points);
    this.geo = geo;
    resetPool(this);
  }

  // o: {vx, vy, vz, color, size, life, grow (size multiplier at death), spin,
  //     frame (atlas cell, or -1 for random), anim (frames to play), alpha,
  //     fadeIn (fraction of life), grav, drag, rot}
  spawn(x, y, z, o) {
    const i = spawnSlot(this);
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = o.vx || 0;
    this.vel[i * 3 + 1] = o.vy || 0;
    this.vel[i * 3 + 2] = o.vz || 0;
    const c = tmpColor.set(o.color ?? '#ffffff');
    this.col[i * 3] = c.r;
    this.col[i * 3 + 1] = c.g;
    this.col[i * 3 + 2] = c.b;
    this.size[i] = this.size0[i] = o.size ?? 1;
    this.grow[i] = o.grow ?? 1;
    this.life[i] = this.maxLife[i] = o.life ?? 1;
    this.rot[i] = o.rot ?? Math.random() * Math.PI * 2;
    this.spin[i] = o.spin ?? 0;
    this.frame[i] = this.frame0[i] = o.frame == null || o.frame < 0 ? Math.floor(Math.random() * this.cells) : o.frame;
    this.anim[i] = o.anim || 0;
    this.alpha[i] = this.alpha0[i] = o.alpha ?? 1;
    this.fadeIn[i] = o.fadeIn ?? 0;
    this.grav[i] = o.grav || 0;
    this.drag[i] = o.drag || 0;
  }

  update(dt) {
    for (let i = 0; i < this.count; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        removeParticle(this, i--);
        continue;
      }
      const k = Math.max(0, this.life[i] / this.maxLife[i]); // 1 → 0
      const age = 1 - k;
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= dr;
      this.vel[i * 3 + 2] *= dr;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.spin[i]) {
        this.rot[i] += this.spin[i] * dt;
        this.dirty.add('rot');
      }
      const fi = this.fadeIn[i];
      const fade = fi > 0 && age < fi ? age / fi : Math.min(1, k * 1.6);
      this.alpha[i] = this.alpha0[i] * fade;
      this.size[i] = this.size0[i] * (1 + (this.grow[i] - 1) * age);
      if (this.anim[i]) {
        const frame = Math.min(this.cells - 1, this.frame0[i] + Math.floor(age * this.anim[i]));
        if (this.frame[i] !== frame) {
          this.frame[i] = frame;
          this.dirty.add('frame');
        }
      }
    }
    uploadLive(this, ['position', 'color', 'size', 'alpha', 'rot', 'frame']);
  }
}

const tmpColor = new THREE.Color();
const NOTHING = new THREE.Object3D(); // stand-in transient object (never in the scene)
const rnd = (a, b) => a + Math.random() * (b - a);

// All particle arrays share the same dense live prefix, including CPU-only state.
function initPool(sys, max) {
  sys.max = max;
  sys.arrays = Object.values(sys).filter((a) => a instanceof Float32Array);
  sys.dirty = new Set();
}

function spawnSlot(sys) {
  sys.dirty.add('color').add('rot').add('frame');
  return sys.count < sys.max ? sys.count++ : Math.floor(Math.random() * sys.max);
}

function removeParticle(sys, i) {
  const last = --sys.count;
  if (i === last) return;
  for (const a of sys.arrays) {
    const stride = a.length / sys.max;
    a.copyWithin(i * stride, last * stride, (last + 1) * stride);
  }
  sys.dirty.add('color').add('rot').add('frame');
}

function resetPool(sys) {
  sys.count = 0;
  sys.life.fill(0);
  sys.dirty.clear();
  sys.points.visible = false;
  sys.geo.setDrawRange(0, 0);
}

// Empty pools need neither an upload nor a draw, even on the frame they empty.
function uploadLive(sys, attrs) {
  sys.points.visible = sys.count > 0;
  sys.geo.setDrawRange(0, sys.count);
  if (!sys.count) return;
  for (const a of attrs) {
    if ((a === 'color' || a === 'rot' || a === 'frame') && !sys.dirty.has(a)) continue;
    const at = sys.geo.attributes[a];
    at.clearUpdateRanges();
    at.addUpdateRange(0, sys.count * at.itemSize);
    at.needsUpdate = true;
  }
  sys.dirty.clear();
}

export class Effects {
  constructor(scene, overlay, camera) {
    this.scene = scene;
    this.overlay = overlay;
    this.camera = camera;
    this.add = new Particles(scene, THREE.AdditiveBlending);
    this.norm = new Particles(scene, THREE.NormalBlending);
    // WC3-style textured emitters. The fire ball, spark and flare art is shared with Arcane Arena.
    this.sp = {
      smoke: new SpriteParticles(scene, { file: 'fx_dust_mask.png', cols: 2, rows: 2, mode: 'mask', max: 1500 }),
      dust: new SpriteParticles(scene, { file: 'fx_dust_mask.png', cols: 2, rows: 2, mode: 'mask', max: 1200 }),
      debris: new SpriteParticles(scene, { file: 'fx_debris.webp', cols: 2, rows: 2, mode: 'rgba', max: 400 }),
      fire: new SpriteParticles(scene, { file: 'fx_fire_sheet.webp', cols: 4, rows: 4, mode: 'add', max: 800 }),
      flames: new SpriteParticles(scene, { file: 'fx_flames_sheet.webp', cols: 4, rows: 4, mode: 'add', max: 2500 }),
      explosion: new SpriteParticles(scene, { file: 'fx_explosion_sheet.webp', cols: 4, rows: 4, mode: 'add', max: 200 }),
      spark: new SpriteParticles(scene, { file: 'fx_spark.webp', mode: 'add', max: 800 }),
      flare: new SpriteParticles(scene, { file: 'fx_flare.webp', mode: 'add', max: 300 }),
    };
    this.decals = [];
    this.decalGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    this.scorchTex = fxTexture('fx_scorch_mask.png', null, { srgb: false });
    this.shockTex = fxTexture('fx_shockwave.webp');
    this.purgeTex = fxTexture('fx_purge.webp');
    this.transients = [];
    this.texts = [];
    // A fixed pool of point lights, lent to flashes and glowing missiles.
    // Adding or removing a light changes the light count, which makes three.js
    // recompile every lit shader (a hitch mid-fight); idle pool lights just
    // sit at intensity 0. Phones get none.
    this.lightPool = [];
    for (let i = 0; i < (LITE ? 0 : 6); i++) {
      const l = new THREE.PointLight('#ffffff', 0, 1, 2);
      l.userData = { busy: false, follow: null, dy: 0 };
      scene.add(l);
      this.lightPool.push(l);
    }
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 48);
    this.ringGeo.rotateX(-Math.PI / 2);
  }

  setScale(h) {
    this.add.material.uniforms.scale.value = h * 0.6;
    this.norm.material.uniforms.scale.value = h * 0.6;
    for (const s of Object.values(this.sp)) s.material.uniforms.scale.value = h * 0.6;
  }

  // ---- WC3-style emitters (x, z are world coords; y is height)

  // One lick of flame from the fire flipbook, rising.
  flame(x, y, z, size = 1, life = 0.6, spread = 0.2) {
    this.sp.flames.spawn(x + rnd(-spread, spread), y + size * 0.35, z + rnd(-spread, spread), {
      vx: rnd(-0.2, 0.2), vy: rnd(0.8, 1.6) * size, vz: rnd(-0.2, 0.2),
      size: size * rnd(0.8, 1.2), grow: 0.6, life: life * rnd(0.8, 1.2), frame: 0, anim: 16, rot: rnd(-0.25, 0.25), spin: rnd(-0.5, 0.5), fadeIn: 0.1,
    });
  }

  smokePuff(x, y, z, color = '#3a3634', size = 1.4, life = 1.6, alpha = 0.55) {
    this.sp.smoke.spawn(x + rnd(-0.2, 0.2), y, z + rnd(-0.2, 0.2), {
      vx: rnd(-0.3, 0.3), vy: rnd(0.6, 1.2), vz: rnd(-0.3, 0.3),
      color, size: size * rnd(0.7, 1.1), grow: 2.2, life: life * rnd(0.8, 1.2), spin: rnd(-0.6, 0.6), alpha, fadeIn: 0.15, drag: 0.6,
    });
  }

  dustCloud(x, z, r = 1, color = '#9a8266', n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rnd(1, 3) * r;
      this.sp.dust.spawn(x + Math.cos(a) * r * 0.3, rnd(0.2, 0.6), z + Math.sin(a) * r * 0.3, {
        vx: Math.cos(a) * s, vy: rnd(0.4, 1.4), vz: Math.sin(a) * s,
        color, size: r * rnd(1.2, 2), grow: 2, life: rnd(0.9, 1.6), spin: rnd(-0.8, 0.8), alpha: 0.7, fadeIn: 0.1, drag: 2.2,
      });
    }
  }

  debrisBurst(x, z, n = 10, speed = 5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * rnd(0.4, 1);
      this.sp.debris.spawn(x, 0.4, z, { vx: Math.cos(a) * s, vy: rnd(3, 7), vz: Math.sin(a) * s, size: rnd(0.25, 0.55), grow: 0.8, life: rnd(0.7, 1.1), spin: rnd(-10, 10), grav: 16, alpha: 1 });
    }
  }

  sparks(x, y, z, n = 12, speed = 6, color = '#ffd070') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * rnd(0.3, 1);
      this.sp.spark.spawn(x, y, z, { vx: Math.cos(a) * s, vy: rnd(1, 5), vz: Math.sin(a) * s, color, size: rnd(0.3, 0.6), grow: 0.3, life: rnd(0.3, 0.7), grav: 9, drag: 1 });
    }
  }

  glow(x, y, z, color, size = 2, life = 0.3) {
    this.sp.flare.spawn(x, y, z, { color, size, grow: 1.4, life, rot: 0 });
  }

  // A fiery explosion from the flipbook, with smoke, sparks and a scorch mark.
  explosion(x, z, r = 1.5, { fire = true, scorch = true } = {}) {
    if (fire) {
      this.sp.explosion.spawn(x, r * 0.55, z, { size: r * 2.6, grow: 1.25, life: 0.75, frame: 0, anim: 16, rot: rnd(0, 6.28) });
      for (let i = 0; i < 3; i++) this.sp.explosion.spawn(x + rnd(-0.4, 0.4) * r, r * 0.4, z + rnd(-0.4, 0.4) * r, { size: r * 1.4, grow: 1.3, life: rnd(0.5, 0.7), frame: 0, anim: 16 });
      this.sparks(x, 0.6, z, 16, 7);
      this.glow(x, 0.8, z, '#ffb060', r * 3, 0.25);
    }
    for (let i = 0; i < 6; i++) this.smokePuff(x + rnd(-0.5, 0.5) * r, 0.5, z + rnd(-0.5, 0.5) * r, '#2e2a28', r * 1.1, 1.8, 0.5);
    if (scorch) this.scorch(x, z, r * 0.9);
  }

  // A dark burn mark on the ground that fades out after a while.
  scorch(x, z, r = 1, dur = 7) {
    const m = new THREE.Mesh(this.decalGeo, new THREE.MeshBasicMaterial({ color: '#140c08', alphaMap: this.scorchTex, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(x, 0.03, z);
    m.rotation.y = Math.random() * Math.PI * 2;
    m.scale.setScalar(r);
    m.renderOrder = 1;
    this.scene.add(m);
    this.transients.push({ obj: m, t: 0, dur, update: (k) => (m.material.opacity = 0.8 * Math.min(1, (1 - k) * 4)) });
  }

  // A textured shockwave ring expanding on the ground.
  shockwave(x, z, radius, color = '#ffe0b0', dur = 0.45) {
    const m = new THREE.Mesh(this.decalGeo, new THREE.MeshBasicMaterial({ color, map: this.shockTex, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.set(x, 0.1, z);
    m.scale.setScalar(0.1);
    this.scene.add(m);
    this.transients.push({ obj: m, t: 0, dur, update: (k) => { m.scale.setScalar(0.1 + radius * 1.15 * Math.sqrt(k)); m.material.opacity = 1 - k; } });
  }

  // WC3's Purge buff: a swirl that spins over the target for `dur` seconds.
  purgeSwirl(getPos, dur = 2) {
    const m = new THREE.Mesh(this.decalGeo, new THREE.MeshBasicMaterial({ map: this.purgeTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.scene.add(m);
    this.transients.push({ obj: m, t: 0, dur, update: (k) => {
      const p = getPos();
      if (p) m.position.set(p.x, 0.15 + Math.sin(k * 30) * 0.02, p.z);
      m.rotation.y = -k * dur * 6;
      m.scale.setScalar(0.9 + 0.1 * Math.sin(k * 40));
      m.material.opacity = Math.min(1, (1 - k) * 3);
    } });
  }

  // ---- particle helpers (x, z are world coords; y is height)
  burst(x, y, z, color, { n = 20, speed = 4, size = 0.6, life = 0.6, up = 1, grav = 4, additive = true, drag = 1.5 } = {}) {
    const sys = additive ? this.add : this.norm;
    const c = tmpColor.set(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      sys.spawn(x, y, z, Math.cos(a) * s, (Math.random() * 0.8 + 0.2) * up * speed, Math.sin(a) * s, c, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), grav, drag);
    }
  }

  trail(x, y, z, color, size = 0.5, life = 0.35, jitter = 0.15) {
    this.add.spawn(
      x + (Math.random() - 0.5) * jitter, y + (Math.random() - 0.5) * jitter, z + (Math.random() - 0.5) * jitter,
      (Math.random() - 0.5) * 0.6, Math.random() * 0.6, (Math.random() - 0.5) * 0.6,
      tmpColor.set(color), size, life, -0.5, 0,
    );
  }

  smoke(x, y, z, color = '#444', size = 1.2, life = 1.2) {
    this.smokePuff(x, y, z, color, size, life);
  }

  ring(x, z, radius, color, dur = 0.45, y = 0.08) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.scale.setScalar(0.1);
    this.scene.add(m);
    this.transients.push({ obj: m, t: 0, dur, update: (k) => { m.scale.setScalar(0.1 + radius * k); m.material.opacity = 0.9 * (1 - k); } });
  }

  // Lends a pool light (null if all are busy, or on phones). With `follow`,
  // it tracks that object (dy above it) until returned.
  borrowLight(color, intensity, distance, decay = 2, follow = null, dy = 0) {
    const l = this.lightPool.find((p) => !p.userData.busy);
    if (!l) return null;
    l.color.set(color);
    l.intensity = intensity;
    l.distance = distance;
    l.decay = decay;
    Object.assign(l.userData, { busy: true, follow, dy });
    return l;
  }

  returnLight(l) {
    if (!l) return;
    l.intensity = 0;
    Object.assign(l.userData, { busy: false, follow: null });
  }

  flash(x, z, radius, color, dur = 0.3) {
    const light = this.borrowLight(color, 40, radius * 5, 2);
    if (!light) return;
    light.position.set(x, 1.5, z);
    this.transients.push({ obj: NOTHING, t: 0, dur, update: (k) => (light.intensity = 40 * (1 - k)), dispose: () => this.returnLight(light) });
  }

  bolt(x1, z1, x2, z2, color = '#bfe6ff') {
    const pts = [];
    const n = Math.max(4, Math.floor(Math.hypot(x2 - x1, z2 - z1) * 1.5));
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const j = i === 0 || i === n ? 0 : 0.35;
      pts.push(new THREE.Vector3(x1 + (x2 - x1) * k + (Math.random() - 0.5) * j, 1.1 + (Math.random() - 0.5) * j, z1 + (z2 - z1) * k + (Math.random() - 0.5) * j));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const mk = (r, c, o) => new THREE.Mesh(new THREE.TubeGeometry(curve, n * 3, r, 5), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const core = mk(0.05, '#ffffff', 1);
    const glow = mk(0.18, color, 0.6);
    const g = new THREE.Group();
    g.add(core, glow);
    this.scene.add(g);
    this.transients.push({ obj: g, t: 0, dur: 0.3, update: (k) => { core.material.opacity = 1 - k; glow.material.opacity = 0.6 * (1 - k); }, dispose: () => { core.geometry.dispose(); glow.geometry.dispose(); } });
    for (let i = 0; i < 12; i++) {
      const p = pts[Math.floor(Math.random() * pts.length)];
      this.trail(p.x, p.y, p.z, color, 0.4, 0.3, 0.3);
    }
  }

  // Floating text anchored at a world position (WC3's "texttag").
  text(x, y, z, str, color = '#fff', big = false) {
    const el = document.createElement('div');
    el.className = 'ftext' + (big ? ' big' : '');
    el.textContent = str;
    el.style.color = color;
    this.overlay.appendChild(el);
    this.texts.push({ el, pos: new THREE.Vector3(x, y, z), t: 0, dur: 1.2 });
  }

  update(dt, width, height) {
    this.add.update(dt);
    this.norm.update(dt);
    for (const s of Object.values(this.sp)) s.update(dt);
    let live = 0;
    for (const tr of this.transients) {
      tr.t += dt;
      const k = Math.min(1, tr.t / tr.dur);
      tr.update(k);
      if (k >= 1) this.removeTransient(tr);
      else this.transients[live++] = tr;
    }
    this.transients.length = live;
    for (const l of this.lightPool) {
      const f = l.userData.follow;
      if (!f) continue;
      f.getWorldPosition(l.position);
      l.position.y += l.userData.dy;
    }
    const v = new THREE.Vector3();
    live = 0;
    for (const t of this.texts) {
      t.t += dt;
      const k = t.t / t.dur;
      v.copy(t.pos);
      v.y += k * 1.5;
      v.project(this.camera);
      t.el.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * width}px, ${((1 - v.y) / 2) * height}px)`;
      t.el.style.opacity = String(Math.min(1, 2 * (1 - k)));
      if (k >= 1) t.el.remove();
      else this.texts[live++] = t;
    }
    this.texts.length = live;
  }

  removeTransient(tr) {
    this.scene.remove(tr.obj);
    tr.dispose?.();
    tr.obj.traverse((obj) => {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material?.dispose();
    });
  }

  clear() {
    for (const tr of this.transients) this.removeTransient(tr);
    for (const l of this.lightPool) this.returnLight(l);
    this.transients.length = 0;
    for (const t of this.texts) t.el.remove();
    this.texts.length = 0;
    resetPool(this.add);
    resetPool(this.norm);
    for (const s of Object.values(this.sp)) resetPool(s);
  }
}
