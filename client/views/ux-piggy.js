// Round boar-like pig with a long snout, hooves, curled tail, tall ears and
// a broad team-colour racing blanket.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin } from '../../engine/client/render/registry.js';

function pig(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const pink = M.hideMat();
  const dark = M.mat('#9c514d');
  const hoof = M.mat('#4a3d3d');
  const team = M.mat(color, { roughness: 0.86, side: THREE.DoubleSide });
  const leg = (s) => {
    const p = new THREE.Group();
    p.position.set(-0.2, 0.45, s * 0.22);
    p.add(M.mesh(M.tube([[0, 0, 0], [0.06, -0.34, 0]], 0.095, 0.08), pink));
    p.add(M.mesh(M.blob(0.11, 0.07, 0.1, { seed: 631 + s }), hoof, 0.08, -0.4, 0));
    return p;
  };
  const legL = leg(1);
  const legR = leg(-1);
  body.add(legL, legR);
  for (const s of [-1, 1]) body.add(M.mesh(M.tube([[0.33, 0.43, s * 0.2], [0.4, 0.08, s * 0.2]], 0.095, 0.08), pink));
  body.add(M.mesh(M.blob(0.58, 0.42, 0.36, { seed: 633, amt: 0.05 }), pink, 0, 0.65, 0));
  body.add(M.mesh(M.blob(0.34, 0.34, 0.3, { seed: 634 }), pink, 0.42, 0.75, 0));
  body.add(M.mesh(M.tube([[0.57, 0.68, 0], [0.83, 0.62, 0], [1, 0.6, 0]], 0.16, 0.14), pink));
  body.add(M.mesh(M.scaled(M.G.sphere, 0.15, 0.12, 0.18), dark, 1.02, 0.59, 0));
  for (const s of [-1, 1]) {
    body.add(M.mesh(M.scaled(M.G.sphere, 0.05), M.mat('#171217'), 0.66, 0.83, s * 0.22));
    const ear = M.mesh(M.blob(0.1, 0.25, 0.1, { seed: 636 + s }), pink, 0.45, 1.15, s * 0.23);
    ear.rotation.x = s * 0.3;
    body.add(ear);
    body.add(M.mesh(M.scaled(M.G.sphere, 0.025), M.mat('#3e2528'), 1.15, 0.59, s * 0.065));
  }
  body.add(M.mesh(M.tube([[-0.48, 0.76, 0], [-0.7, 0.86, 0.05], [-0.73, 1.01, 0.1], [-0.63, 1.02, 0.1]], 0.04, 0.018), pink));
  const blanket = M.mesh(M.cloth(0.7, 0.62, 0.2, 0.06), team, -0.1, 0.95, 0);
  blanket.rotation.z = Math.PI / 2;
  body.add(blanket);
  body.scale.setScalar(1.15);
  g.userData = { body, legL, legR, kind: 'hero' };
  return g;
}

registerSkin('uxpig', pig);
