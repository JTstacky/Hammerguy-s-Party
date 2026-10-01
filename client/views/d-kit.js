// Shared bits for the batch-D views (Dark Forest, Sleepy Time, The Plague,
// The Sheep Shearers, Doggy Hell, Ancient Punisher): per-frame animation hooks
// for hero skins, particle-rate helpers, a soft blob shadow, the WC3 item sack
// and a few materials.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { FX_DENSITY } from '../../engine/client/device.js';

export const now = () => performance.now() / 1000;

// Hero skin animation (docs/PORTING.md, engine rules): the skin's extra moving
// parts go in userData.anim and are posed from userData.tick, which the
// renderer runs every frame; bakeModel merges everything else per material.
// `fn(t)` gets the time in seconds and must allocate nothing.
export function skinTick(model, anim, fn) {
  model.userData.anim = anim;
  model.userData.tick = () => fn(now());
  return model;
}

// Map scenery animation (maps get no tick): a tiny invisible mesh whose
// onBeforeRender runs `fn(t)` once per frame.
const hookGeo = new THREE.PlaneGeometry(0.001, 0.001);
hookGeo.userData.shared = true;
const hookMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
hookMat.userData.shared = true;
export function mapAnimate(group, fn) {
  const hook = new THREE.Mesh(hookGeo, hookMat);
  hook.frustumCulled = false;
  hook.onBeforeRender = () => fn(now());
  group.add(hook);
  return group;
}

// The renderer's batching (engine/client/render/batch.js) when this build has
// it: views with many copies merge their static parts per material, and map
// scenery merges into a few draw calls. Without it these are no-ops.
const batch = Object.values(import.meta.glob('../../engine/client/render/batch.js', { eager: true }))[0] || {};
export function bakeView(root) {
  return batch.bakeModel ? batch.bakeModel(root) : root;
}
// `group` must hold only static, opaque meshes and sit at the origin.
export function bakeScenery(group) {
  if (batch.bakeStatic) batch.bakeStatic(group);
  return group;
}

// Cached unlit glow materials (eyes, runes).
const glows = new Map();
export function glow(color) {
  if (!glows.has(color)) {
    const m = M.glowMat(color);
    m.userData.shared = true;
    glows.set(color, m);
  }
  return glows.get(color);
}

// Materials a view made for itself (animated opacity); freed in its remove().
export function ownMat(m) {
  m.userData.own = true;
  return m;
}
export function disposeOwn(obj) {
  obj.traverse((o) => {
    if (o.material?.userData?.own) o.material.dispose();
  });
}

// Fixed-rate particle emission: how many particles `rate` per second owes this
// frame, carrying the fraction over.
export function emit(v, key, rate, dt) {
  const acc = (v.emitD ??= {});
  acc[key] = (acc[key] || 0) + rate * FX_DENSITY * dt;
  const n = Math.floor(acc[key]);
  acc[key] -= n;
  return n;
}

export const lerp = (a, b, k) => a + (b - a) * k;

// A soft round shadow on the ground (for flyers and big creatures at night).
// Its material is shared per opacity; views that fade it pass own = true.
let shadowTex = null;
const shadowMats = new Map();
function shadowMat(opacity, own) {
  const make = () => {
    const m = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity, depthWrite: false });
    if (own) m.userData.own = true;
    else m.userData.shared = true;
    return m;
  };
  if (own) return make();
  if (!shadowMats.has(opacity)) shadowMats.set(opacity, make());
  return shadowMats.get(opacity);
}
export function blobShadow(r = 1, opacity = 0.45, own = false) {
  if (!shadowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(0.6, 'rgba(0,0,0,0.6)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
    shadowTex.userData.shared = true;
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * r, 2 * r).rotateX(-Math.PI / 2), shadowMat(opacity, own));
  m.position.y = 0.04;
  m.renderOrder = 1;
  return m;
}

// Soft additive glow disc on the ground.
let glowTex = null;
export function groundGlow(r, color, opacity = 0.5) {
  if (!glowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
    glowTex.userData.shared = true;
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * r, 2 * r).rotateX(-Math.PI / 2), ownMat(new THREE.MeshBasicMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
  m.position.y = 0.05;
  m.renderOrder = 2;
  return m;
}

// Materials.
export const featherMat = (tint = '#ffffff', base = '#1c1a26') => M.texMat('tex_darkforest_feathers.webp', base, tint, 2, { roughness: 0.6 });
export const featherTri = (tint = '#ffffff', base = '#1c1a26') => M.triMat('tex_darkforest_feathers.webp', base, tint, 2.2, { roughness: 0.6 });
export const woolMat = () => M.triMat('tex_sheep_wool.webp', '#e8e2d4', '#ffffff', 1.6, { roughness: 0.95 });
export const fleshMat = (tint) => M.triMat('tex_hide.webp', '#7c8c6c', tint, 1.2, { roughness: 0.7 });
export const stoneMat = (tint = '#b4b2ae') => M.triMat('tex_boulder.webp', '#77746e', tint, 0.9);
export const clothMat = (color, k = 1) => M.mat(new THREE.Color(color).multiplyScalar(k), { roughness: 0.85, side: THREE.DoubleSide });

// WC3's generic item model on the ground: a tied leather sack with a faint
// glow ring under it (both the sticks of Doggy Hell and the cloaks of Ancient
// Punisher look like this until picked up).
export function itemSack(extra) {
  const g = new THREE.Group();
  const sack = M.mesh(M.blob(0.34, 0.3, 0.32, { seed: 91, amt: 0.1 }), M.triMat('tex_hide.webp', '#a88a60', '#ffe0b0', 1.4), 0, 0.3, 0);
  const neck = M.mesh(M.lathe([[0.12, 0.52], [0.07, 0.6], [0.11, 0.7], [0.14, 0.76], [0.01, 0.8]], 14), M.triMat('tex_hide.webp', '#a88a60', '#f0d0a0', 1.4));
  const tie = M.mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 16).rotateX(Math.PI / 2), M.mat('#e0c060', { metalness: 0.6, roughness: 0.4 }), 0, 0.6, 0);
  g.add(sack, neck, tie);
  if (extra) g.add(extra);
  const ring = groundGlow(0.75, '#fff0b0', 0.35);
  g.add(ring);
  g.userData = { ring };
  return g;
}

// A wooden stick (Ironwood Branch).
export function stick(len = 0.9) {
  const g = new THREE.Group();
  const wood = M.barkMat();
  g.add(M.mesh(M.tube([[-len / 2, 0, 0], [-len / 6, 0.03, 0.02], [len / 6, -0.02, -0.01], [len / 2, 0.02, 0]], 0.045, 0.035, 8, 8), wood));
  g.add(M.mesh(M.tube([[0.05, 0.01, 0], [0.16, 0.08, 0.06], [0.22, 0.12, 0.08]], 0.025, 0.01, 4, 6), wood));
  g.add(M.mesh(M.scaled(M.G.sphere, 0.05, 0.035, 0.05), M.mat('#6a8a3a'), 0.23, 0.13, 0.08));
  return g;
}

// Animated lava (Doggy Hell), a variant of the renderer's liquid shader.
export function lavaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
    `,
    fragmentShader: /* glsl */ `
      uniform float time; varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main() {
        vec2 p = vWorld.xz * 0.35;
        float n = fbm(p + vec2(time * 0.07, time * 0.04) + fbm(p * 1.7 - time * 0.05));
        float crust = smoothstep(0.35, 0.62, n);
        vec3 col = mix(vec3(1.0, 0.78, 0.25), vec3(0.95, 0.28, 0.02), smoothstep(0.1, 0.45, n));
        col = mix(col, vec3(0.16, 0.05, 0.03), crust * 0.85);
        gl_FragColor = vec4(col * (1.4 - crust * 0.6), 1.0);
      }
    `,
  });
}

// Registers an animated material with a world frame clock (ShaderMaterials
// with a `time` uniform): the renderer only updates its own liquids, so a
// tiny invisible mesh in the map drives ours.
export function clockMesh(materials) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.001, 0.001), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  m.frustumCulled = false;
  const t0 = now();
  m.onBeforeRender = () => {
    const t = now() - t0;
    for (const mt of materials) mt.uniforms.time.value = t;
  };
  return m;
}

// A Lordaeron/Northrend pine made from the shared tree, with its needles
// swapped for `needles` and optional snow on the tiers.
export function pine(s, needles, snow = false) {
  const t = M.tree(s);
  t.children.forEach((c, i) => {
    if (i === 0) return;
    c.material = needles;
  });
  if (snow) {
    const white = M.mat('#c8d4e8', { roughness: 0.9 });
    for (const c of [...t.children].slice(2)) {
      const cap = c.clone();
      cap.material = white;
      cap.scale.set(0.62, 0.42, 0.62);
      cap.position.y += 0.22 * s;
      t.add(cap);
    }
  }
  return t;
}
