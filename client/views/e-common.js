// Helpers shared by the port/E views (Way of the Bow, Tauren Tragedy,
// Masquerade, Abombinations, Nature's Circle, Destruction's Dance).
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerTheme } from '../../engine/client/render/registry.js';

// Hero skins go through bakeModel, which merges every mesh per material
// except the parts userData references, so a skin that poses more than
// legL / legR / staff lists those parts in userData.anim and poses them from
// userData.tick (run by the renderer every frame, see
// engine/client/render/registry.js). pose(fn) makes that tick: fn(dt, seconds).
export const pose = (fn) => (dt) => fn(Math.min(0.1, dt), performance.now() / 1000);

// Scenery that is never baked can pose itself with a "driver": an invisible
// mesh whose onBeforeRender runs every frame the model is drawn.
const tinyGeo = new THREE.BufferGeometry();
tinyGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0.001, 0, 0.001, 0, 0], 3));
const hiddenMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false });
export function driver(parent, fn) {
  const m = new THREE.Mesh(tinyGeo, hiddenMat);
  m.frustumCulled = false;
  m.castShadow = false;
  m.receiveShadow = false;
  let last = performance.now();
  let frame = -1;
  m.onBeforeRender = (renderer) => {
    const f = renderer.info.render.frame;
    if (f === frame) return;
    frame = f;
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    fn(dt, now / 1000);
  };
  parent.add(m);
  return m;
}

// A pivot group at (x, y, z) holding `children`.
export function pivot(x, y, z, ...children) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  for (const c of children) g.add(c);
  return g;
}

// Straight limb/tube between two points (a 3-point tube for a smooth taper).
export function limb(a, b, r0, r1, material, bend = [0, 0, 0]) {
  const mid = [(a[0] + b[0]) / 2 + bend[0], (a[1] + b[1]) / 2 + bend[1], (a[2] + b[2]) / 2 + bend[2]];
  return M.mesh(M.tube([a, mid, b], r0, r1, 8, 10), material);
}

export const skinMat = (color, rough = 0.7) => M.mat(color, { roughness: rough });
export const teamCloth = (color, k = 1) => M.mat(k === 1 ? color : M.darken(color, k), { roughness: 0.85, side: THREE.DoubleSide });
export const clothTex = (tint) => M.texMat('tex_leather.webp', '#6a4a30', tint, 1, { side: THREE.DoubleSide });

// The model's forward walk bob and a gentle idle sway.
export const lerp = (a, b, k) => a + (b - a) * k;

// Decorates the cut corners of an octagonal arena (map.cut, see
// server/minigames/up/e-common.js clampOct) with rocks and trees so the
// walkable octagon reads at a glance.
export function octCorners(world, hw, cut, { trees = true, rockTint } = {}) {
  const L = 2 * hw - cut;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const n = Math.max(3, Math.ceil(cut / 0.9));
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        // Along the cut line from (sx*(L-hw), sy*hw) to (sx*hw, sy*(L-hw)).
        const x = sx * (L - hw + (hw - (L - hw)) * k);
        const y = sy * (hw - (hw - (L - hw)) * k);
        const out = 0.45 + Math.random() * 0.4;
        const r = M.rock(0.55 + Math.random() * 0.5);
        if (rockTint) r.children[0].material = rockTint;
        r.position.set(x + sx * out * 0.7, 0, y + sy * out * 0.7);
        world.mapGroup.add(r);
      }
      // Fill the corner triangle.
      for (let i = 0; i < Math.ceil(cut * cut * 0.25); i++) {
        const a = Math.random();
        const b = Math.random() * (1 - a);
        const x = sx * (hw - cut * a * 0.9 + 0.3);
        const y = sy * (hw - cut * b * 0.9 + 0.3);
        if (Math.abs(x) + Math.abs(y) < L + 0.8) continue;
        const obj = trees && Math.random() < 0.6 ? M.tree(0.8 + Math.random() * 0.4) : M.rock(0.5 + Math.random() * 0.6);
        if (rockTint && !obj.children[1]) obj.children[0].material = rockTint;
        obj.position.set(x, 0, y);
        world.mapGroup.add(obj);
      }
    }
  }
}

// A soft round shadow on the ground (for hovering units).
export function blobShadow(r = 0.8, opacity = 0.35) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity, depthWrite: false }));
  m.position.y = 0.04;
  return m;
}

// A timed effect object in the scene, faded and removed by world.fx.
export function transient(world, obj, dur, update) {
  world.scene.add(obj);
  world.fx.transients.push({
    obj, t: 0, dur, update,
    dispose: () => obj.traverse((o) => {
      if (o.isMesh && o.userData.own) o.material.dispose();
    }),
  });
}

// Stars circling over a stunned unit's head.
export function stunStars(world, x, z, h, t) {
  for (let i = 0; i < 2; i++) {
    const a = t * 6 + i * Math.PI;
    world.fx.trail(x + Math.cos(a) * 0.35, h, z + Math.sin(a) * 0.35, '#ffe680', 0.3, 0.25, 0.02);
  }
}

// A moonlit Lordaeron glade (Way of the Bow and Nature's Circle are played at
// midnight on summer grass): night grass with worn dirt at the edges.
registerTheme(
  'glade',
  { sky: '#0c1428', fog: '#101a30', floor: ['#2c4a3a', 35, { blades: true }], sun: '#a8c0ff', hemi: ['#6078b8', '#101810'], sunI: 1.6 },
  { floor: { tex: 'tex_nightgrass.webp', tint: '#c8d0e8', color: '#2c4a3a', units: 8 }, edge: { tex: 'tex_dirt.webp', tint: '#8a90a8', color: '#3a4050', units: 5 }, outer: { tex: 'tex_nightgrass.webp', tint: '#8890a0', color: '#1c3028' }, edgeWidth: 1.1 },
);
