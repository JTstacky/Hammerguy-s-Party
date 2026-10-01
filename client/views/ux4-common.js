import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { bakeStatic } from '../../engine/client/render/batch.js';

export function pivot(x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  return g;
}

export function limb(a, b, r0, r1, material) {
  return M.mesh(M.tube([a, b], r0, r1, 8, 8), material);
}

export function oval(sx, sy, sz, material, x, y, z, seed = 4) {
  return M.mesh(M.blob(sx, sy, sz, { seed, amt: 0.035 }), material, x, y, z);
}

export function fence(map, world, halfX, halfY, options = {}) {
  const g = new THREE.Group();
  const stone = M.triMat('tex_boulder.webp', options.stone || '#6f6e73', '#a3a1a0', 0.7);
  const cap = M.plateMat(options.cap || '#756d68');
  const pillarStep = options.step || 2.3;
  const h = options.height || 1.4;
  for (let side = 0; side < 4; side++) {
    const vertical = side >= 2;
    const sign = side % 2 ? 1 : -1;
    const fixed = (vertical ? halfX : halfY) * sign;
    const span = vertical ? halfY : halfX;
    const n = Math.ceil(span * 2 / pillarStep);
    for (let i = 0; i <= n; i++) {
      const p = -span + 2 * span * i / n;
      const x = vertical ? fixed : p;
      const z = vertical ? p : fixed;
      g.add(oval(0.35, h * 0.48, 0.35, stone, x, h * 0.48, z, 30 + i + side * 17));
      g.add(M.mesh(M.scaled(M.G.sphere, 0.37, 0.1, 0.37), cap, x, h, z));
      if (i === n) continue;
      const p2 = -span + 2 * span * (i + 1) / n;
      const center = (p + p2) * 0.5;
      const len = p2 - p;
      const wall = M.mesh(M.scaled(M.G.box, vertical ? 0.18 : len, 0.28, vertical ? len : 0.18), stone,
        vertical ? fixed : center, h * 0.55, vertical ? center : fixed);
      g.add(wall);
    }
  }
  bakeStatic(g);
  world.mapGroup.add(g);
  return g;
}

export function tickSway(dt, v, snap, world) {
  const t = world.time;
  const d = v.obj.userData;
  if (d.legL) d.legL.rotation.z = Math.sin(t * 8 + v.x) * (snap.w ? 0.35 : 0.04);
  if (d.legR) d.legR.rotation.z = -Math.sin(t * 8 + v.x) * (snap.w ? 0.35 : 0.04);
}
