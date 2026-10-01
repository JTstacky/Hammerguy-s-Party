// Ultima-X #78: armoured warships, long-range artillery and the wreck burst.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { registerSkin, registerView, registerMapBuilder } from '../../engine/client/render/registry.js';

function warship(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const wood = M.triMat('tex_wood.webp', '#56351e', '#a47b4e', 0.65);
  const iron = M.plateMat('#4f5b68');
  const brass = M.goldMat();
  const team = M.mat(color, { side: THREE.DoubleSide });
  const canvas = M.mat('#e7d8b4', { side: THREE.DoubleSide });
  body.add(M.mesh(M.blob(2.2, 0.48, 0.78, { seed: 100, amt: 0.06 }), wood, 0, 0.36, 0));
  body.add(M.mesh(M.blob(2.0, 0.14, 0.7, { seed: 101, amt: 0.04 }), iron, 0, 0.74, 0));
  for (const s of [-1, 1]) {
    body.add(M.mesh(M.tube([[-2.0, 0.52, s * 0.6], [-1.1, 0.62, s * 0.8], [1.2, 0.62, s * 0.8], [2.2, 0.4, 0]], 0.085, 0.04, 26, 8), brass));
    body.add(M.mesh(M.tube([[-1.9, 0.42, s * 0.74], [0, 0.42, s * 0.83], [1.8, 0.42, s * 0.58]], 0.065, 0.05, 24, 6), team));
    for (const x of [-1.1, -0.4, 0.4, 1.15]) {
      const cannon = M.mesh(M.tube([[x, 0.57, s * 0.55], [x, 0.61, s * 1.02]], 0.11, 0.08, 4, 10), iron);
      body.add(cannon);
    }
  }
  // Two raised castles and a forward long gun make the bow unmistakable.
  body.add(M.mesh(M.blob(0.65, 0.45, 0.63, { seed: 31, amt: 0.04 }), wood, -1.45, 0.95, 0));
  body.add(M.mesh(M.blob(0.5, 0.27, 0.56, { seed: 32, amt: 0.04 }), iron, 1.4, 0.9, 0));
  body.add(M.mesh(M.tube([[1.35, 1.1, 0], [2.35, 1.08, 0], [2.72, 1.05, 0]], 0.13, 0.09, 8, 12), iron));
  body.add(M.mesh(M.tube([[2.25, 0.54, 0], [2.88, 0.77, 0]], 0.07, 0.02), brass));
  // Masts, billowing square sails, pennants and simple rigging.
  for (const [x, h, w] of [[-0.55, 3.1, 1.6], [0.95, 2.5, 1.25]]) {
    body.add(M.mesh(M.tube([[x, 0.7, 0], [x, h + 0.7, 0]], 0.08, 0.035, 4, 9), wood));
    for (const y of [h * 0.46, h * 0.73]) {
      body.add(M.mesh(M.tube([[x, y + 0.7, -w / 2], [x, y + 0.7, w / 2]], 0.035, 0.035, 4, 6), wood));
      const sail = M.mesh(M.cloth(w * 0.93, 0.65, 0.25, 0.06), canvas, x + 0.13, y + 0.32, 0);
      body.add(sail);
    }
    const flag = M.mesh(M.cloth(0.4, 0.2, 0.06, 0.04), team, x - 0.22, h + 0.83, 0);
    flag.rotation.z = Math.PI / 2;
    body.add(flag);
  }
  body.add(M.mesh(M.tube([[-1.85, 0.9, 0], [-0.55, 3.7, 0], [0.95, 3.2, 0], [2.55, 0.9, 0]], 0.012, 0.012, 14, 4), iron));
  g.add(body);
  g.userData = { body, kind: 'ship', tick(dt, v, snap, world) {
    body.position.y = Math.sin(world.time * 1.7 + v.id) * 0.04;
    body.rotation.x = Math.sin(world.time * 1.3 + v.id) * 0.035;
    const moved = Math.hypot(v.x - (v.lastWakeX ?? v.x), v.z - (v.lastWakeZ ?? v.z));
    v.lastWakeX = v.x;
    v.lastWakeZ = v.z;
    v.wakeAcc = (v.wakeAcc || 0) + (moved > 0.01 ? dt * 18 : 0);
    while (v.wakeAcc >= 1) {
      v.wakeAcc--;
      world.fx.trail(v.x - Math.cos(v.f) * 2, 0.1, v.z - Math.sin(v.f) * 2, '#e5f6ff', 0.5, 1, 0.2);
    }
  } };
  return g;
}
registerSkin('uxwarship', warship);

registerView('uxshell', {
  make(e, world, v) {
    const g = new THREE.Group();
    const ball = M.mesh(M.scaled(M.G.sphere, e.b ? 0.35 : 0.19), e.b ? M.glowMat('#ff984a') : M.plateMat('#23252c'));
    g.add(ball);
    v.parts = { ball };
    v.sparkAcc = 0;
    return g;
  },
  update(v, a, b, k, dt, world) {
    const p = a.p + (b.p - a.p) * k;
    v.obj.position.y = 0.8 + Math.sin(Math.min(1, p) * Math.PI) * (b.b ? 4 : 2.2);
    v.sparkAcc += dt * (b.b ? 28 : 10);
    while (v.sparkAcc >= 1) {
      v.sparkAcc--;
      world.fx.trail(v.x, v.obj.position.y, v.z, b.b ? '#ffb05a' : '#ffe1a0', 0.22, 0.35, 0.05);
    }
  },
});

registerMapBuilder('uxnaval', (map, world) => {
  const scene = new THREE.Group();
  const wood = M.triMat('tex_wood.webp', '#4b3a2b', '#8f7960', 0.7);
  const rock = M.triMat('tex_boulder.webp', '#747c82', '#abaeaa', 0.6);
  for (const s of [-1, 1]) {
    const x = s * (map.floor.w / 2 - 1.8);
    const z = -s * (map.floor.h / 2 - 1.7);
    scene.add(M.mesh(M.blob(2.3, 0.32, 1.6, { seed: s * 22, amt: 0.14 }), rock, x, 0.1, z));
    for (let i = 0; i < 5; i++) {
      const plank = M.mesh(M.blob(1.1, 0.09, 0.13, { seed: i + s * 7, amt: 0.09 }), wood, x + i * 0.3 - 0.7, 0.31, z + i * 0.15 - 0.4);
      plank.rotation.y = 0.3 + i * 0.24;
      scene.add(plank);
    }
  }
  bakeStatic(scene);
  world.mapGroup.add(scene);
});
