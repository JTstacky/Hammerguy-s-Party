// Ultima-X #159: a rattling Meat Wagon runs down fast rabbits in rainy night.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin, registerView } from '../../engine/client/render/registry.js';

function meatWagon(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const wood = M.triMat('tex_wood.webp', '#49301f', '#896544', 0.75);
  const iron = M.plateMat('#3d4247');
  const bone = M.boneMat();
  const trim = M.mat(color);
  body.add(M.mesh(M.blob(1.55, 0.36, 0.72, { seed: 151, amt: 0.06 }), wood, 0, 0.68, 0));
  body.add(M.mesh(M.blob(1.25, 0.42, 0.6, { seed: 152, amt: 0.08 }), iron, -0.15, 1.12, 0));
  for (const s of [-1, 1]) {
    for (const x of [-0.94, 0.9]) {
      const wheel = new THREE.Group();
      wheel.position.set(x, 0.48, s * 0.82);
      wheel.add(M.mesh(new THREE.TorusGeometry(0.43, 0.1, 6, 16), iron));
      wheel.add(M.mesh(M.scaled(M.G.sphere, 0.14), trim));
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        wheel.add(M.mesh(M.tube([[0, 0, 0], [Math.cos(a) * 0.39, Math.sin(a) * 0.39, 0]], 0.025, 0.02, 2, 4), wood));
      }
      body.add(wheel);
    }
    body.add(M.mesh(M.tube([[-1.35, 1.2, s * 0.52], [-1.8, 1.48, s * 0.52], [-2.08, 1.4, s * 0.48]], 0.12, 0.015), bone));
    body.add(M.mesh(M.tube([[1.15, 0.72, s * 0.48], [1.86, 0.72, s * 0.66]], 0.09, 0.05), iron));
  }
  // Tall bone stakes and a glowing plague jar identify the wagon overhead.
  for (const x of [-0.7, 0, 0.65]) {
    body.add(M.mesh(M.tube([[x, 1.25, 0], [x - 0.1, 2.0 + x * 0.25, 0]], 0.075, 0.012), bone));
  }
  body.add(M.mesh(M.blob(0.29, 0.33, 0.29, { seed: 92, amt: 0.08 }), M.glowMat('#9edb45'), 0.1, 1.53, 0));
  body.add(M.mesh(M.tube([[1.38, 0.68, 0], [2.13, 0.76, 0]], 0.13, 0.07), trim));
  g.add(body);
  g.userData = { body, kind: 'vehicle', tick(dt, v, snap, world) {
    body.position.y = Math.sin(world.time * 10 + v.id) * 0.035;
    v.smokeAcc = (v.smokeAcc || 0) + dt * 4;
    while (v.smokeAcc >= 1) {
      v.smokeAcc--;
      world.fx.smokePuff(v.x - 0.8, 1.45, v.z, '#849257', 0.35, 0.7, 0.3);
    }
  } };
  return g;
}
registerSkin('uxmeatwagon', meatWagon);

function rabbit() {
  const g = new THREE.Group();
  const fur = M.furMat('#d6bb90');
  const pale = M.furMat('#f4ead8');
  const eye = M.mat('#1f1718');
  g.add(M.mesh(M.blob(0.31, 0.23, 0.2, { seed: 155, amt: 0.08 }), fur, 0, 0.3, 0));
  g.add(M.mesh(M.blob(0.16, 0.17, 0.17, { seed: 156, amt: 0.04 }), pale, 0.26, 0.38, 0));
  g.add(M.mesh(M.scaled(M.G.sphere, 0.13), pale, -0.3, 0.3, 0));
  for (const s of [-1, 1]) {
    g.add(M.mesh(M.tube([[0.25, 0.5, s * 0.09], [0.17, 0.98, s * 0.13]], 0.072, 0.018), fur));
    g.add(M.mesh(M.scaled(M.G.sphere, 0.025), eye, 0.39, 0.42, s * 0.1));
    g.add(M.mesh(M.blob(0.13, 0.09, 0.11, { seed: s + 36 }), fur, -0.12, 0.13, s * 0.16));
  }
  return g;
}
registerView('uxrabbit', {
  make(e, world, v) { v.phase = e.id * 0.3; return rabbit(); },
  update(v, a, b, k, dt, world) { v.obj.position.y = Math.max(0, Math.sin(world.time * 13 + v.phase)) * 0.1; },
});
