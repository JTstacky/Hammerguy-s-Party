// Ultima-X #77: bumper launches on a cold lake with iceberg islands.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { registerSkin, registerMapBuilder, registerTheme, registerView } from '../../engine/client/render/registry.js';

const grass = { tex: 'tex_nightgrass.webp', tint: '#697883', color: '#344452', units: 11 };
registerTheme('uxtitanicsea',
  { sky: '#182739', fog: '#263648', floor: ['#586a76', 30, {}], sun: '#aec4e2',
    hemi: ['#839ab8', '#1a2835'], sunI: 0.9 },
  { floor: grass, edge: grass, outer: grass, edgeWidth: 1.8 });

registerView('uxrain', {
  make(e, world, v) { v.rainAcc = 0; return new THREE.Group(); },
  update(v, a, b, k, dt, world) {
    v.rainAcc += dt * 55;
    while (v.rainAcc >= 1) {
      v.rainAcc--;
      const x = world.focus.x + (Math.random() - 0.5) * 23;
      const z = world.focus.z + (Math.random() - 0.5) * 20;
      world.fx.trail(x, 3.7 + Math.random() * 2, z, '#b7d6ee', 0.025, 0.23, 0.08);
    }
  },
});

function bumperBoat(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const hull = M.triMat('tex_wood.webp', '#5a3c25', '#9b6840', 0.7);
  const trim = M.mat(color);
  const iron = M.plateMat('#444b54');
  const foam = M.mat('#efe7bd');
  body.add(M.mesh(M.blob(1.55, 0.37, 0.92, { seed: 97, amt: 0.06 }), hull, 0, 0.38, 0));
  body.add(M.mesh(M.blob(1.3, 0.2, 0.84, { seed: 98, amt: 0.04 }), trim, 0, 0.68, 0));
  // The inflated collision bumper wraps the hull and has a strong team stripe.
  for (const s of [-1, 1]) {
    body.add(M.mesh(M.tube([[-1.25, 0.33, s * 0.83], [-0.6, 0.3, s * 0.99], [0.65, 0.3, s * 0.99], [1.4, 0.36, s * 0.65]], 0.17, 0.14, 22, 8), foam));
    body.add(M.mesh(M.tube([[-1.1, 0.34, s * 0.88], [0, 0.34, s * 1.04], [1.32, 0.38, s * 0.73]], 0.052, 0.05, 20, 6), trim));
  }
  body.add(M.mesh(M.blob(0.45, 0.38, 0.55, { seed: 5 }), iron, -0.4, 0.92, 0));
  body.add(M.mesh(M.scaled(M.G.sphere, 0.29, 0.25, 0.3), M.glowMat('#a9dafa'), -0.42, 1.18, 0));
  body.add(M.mesh(M.tube([[-0.5, 0.84, 0], [-0.8, 1.35, 0], [-0.9, 1.6, 0]], 0.06, 0.02), iron));
  const flag = M.mesh(M.cloth(0.5, 0.3, 0.09, 0.1), trim, -1.05, 1.5, 0);
  flag.rotation.z = Math.PI / 2;
  body.add(flag);
  g.add(body);
  g.userData = { body, kind: 'ship', tick(dt, v, snap, world) {
    body.rotation.x = Math.sin(world.time * 2 + v.id) * 0.045;
    body.position.y = Math.sin(world.time * 2.5 + v.id) * 0.035;
    const moved = Math.hypot(v.x - (v.lastWakeX ?? v.x), v.z - (v.lastWakeZ ?? v.z));
    v.lastWakeX = v.x;
    v.lastWakeZ = v.z;
    v.wakeAcc = (v.wakeAcc || 0) + (moved > 0.01 ? dt * 15 : 0);
    while (v.wakeAcc >= 1) {
      v.wakeAcc--;
      world.fx.trail(v.x - Math.cos(v.f) * 1.2, 0.1, v.z - Math.sin(v.f) * 1.2, '#d6f4ff', 0.4, 0.8, 0.2);
    }
  } };
  return g;
}
registerSkin('uxbumperboat', bumperBoat);

registerMapBuilder('uxtitanic', (map, world) => {
  const scene = new THREE.Group();
  const ice = M.triMat('tex_ice.webp', '#8da9bb', '#d9edfa', 0.7);
  const rock = M.triMat('tex_boulder.webp', '#4b5361', '#838c96', 0.5);
  const islands = [[-8, -9, 2.3], [7, -9, 1.6], [10, -4, 1.1], [-8, 7, 3.1], [8, 8, 1.6]];
  for (const [x, z, r] of islands) {
    scene.add(M.mesh(M.blob(r, 0.45, r * 0.9, { seed: x * 5, amt: 0.17 }), rock, x, 0.1, z));
    scene.add(M.mesh(M.blob(r * 0.83, 1.1, r * 0.72, { seed: z * 11, amt: 0.25 }), ice, x, 0.8, z));
    scene.add(M.mesh(M.blob(r * 0.42, 0.8, r * 0.4, { seed: z * 3, amt: 0.2 }), ice, x - 0.2, 1.55, z + 0.15));
  }
  const hw = map.floor.w / 2, hh = map.floor.h / 2;
  for (let i = -15; i <= 15; i++) {
    for (const s of [-1, 1]) {
      scene.add(M.mesh(M.blob(0.8, 0.7, 1.1, { seed: i + s * 23, amt: 0.16 }), rock, i * hw / 15, 0.25, s * (hh + 0.4)));
      scene.add(M.mesh(M.blob(1.1, 0.7, 0.8, { seed: i + s * 37, amt: 0.16 }), rock, s * (hw + 0.4), 0.25, i * hh / 15));
    }
  }
  bakeStatic(scene);
  world.mapGroup.add(scene);
});
