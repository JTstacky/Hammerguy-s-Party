// Easter Chicken stampede: bobbing white birds with red combs, orange beaks
// and large wings so each missile reads from the fixed camera.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView } from '../../engine/client/render/registry.js';

function chicken() {
  const g = new THREE.Group();
  const white = M.furMat('#eee9d7');
  const red = M.mat('#ec3420');
  const orange = M.mat('#f6a22a');
  const black = M.mat('#16131a');
  g.add(M.mesh(M.blob(0.28, 0.27, 0.22, { seed: 601 }), white, 0, 0.35, 0));
  g.add(M.mesh(M.blob(0.17, 0.19, 0.17, { seed: 602 }), white, 0.21, 0.52, 0));
  g.add(M.mesh(new THREE.ConeGeometry(0.12, 0.24, 6).rotateZ(-Math.PI / 2), orange, 0.43, 0.48, 0));
  for (const s of [-1, 1]) {
    g.add(M.mesh(M.blob(0.2, 0.08, 0.12, { seed: 603 + s }), white, -0.06, 0.4, s * 0.24));
    g.add(M.mesh(M.scaled(M.G.sphere, 0.035), black, 0.33, 0.59, s * 0.11));
    g.add(M.mesh(M.tube([[0, 0.21, s * 0.09], [0.03, 0.05, s * 0.11], [0.14, 0.04, s * 0.14]], 0.025, 0.012), orange));
  }
  for (let i = 0; i < 3; i++) g.add(M.mesh(M.blob(0.06, 0.08, 0.08, { seed: 607 + i }), red, 0.16 - i * 0.08, 0.73 - i * 0.025, 0));
  g.add(M.mesh(M.blob(0.1, 0.07, 0.11, { seed: 611 }), red, 0.3, 0.35, 0));
  g.scale.setScalar(1.1);
  return g;
}

registerView('uxchickenbird', {
  make() { return chicken(); },
  update(v, a, b, k, dt, world) {
    v.obj.position.y = 0.08 + Math.sin(world.time * 13 + v.id) * 0.045;
  },
});
