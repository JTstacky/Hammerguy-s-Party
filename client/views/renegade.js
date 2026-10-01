// The Renegade Wizard (`nwzg`, the BanditMage model): the player unit of
// Horse Race, drawn at the map's 60%. A hooded man in a long violet robe
// with gold trim and a grey beard, a team-coloured sash and mantle, holding
// a gnarled staff with a glowing orb.

import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin } from '../../engine/client/render/registry.js';

const { mesh, blob, tube, lathe, cloth, mat, G, scaled } = M;

export function renegade(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(0.9);
  g.add(body);
  const robe = M.texMat('tex_leather.webp', '#6a3c9a', '#c8a0f0', 1, { roughness: 0.9, side: THREE.DoubleSide });
  const gold = M.goldMat();
  const team = mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  const skin = mat('#e0b090', { roughness: 0.7 });
  const beard = mat('#d8d4cc', { roughness: 0.9 });
  const boot = M.leatherMat('#806048');
  const wood = M.texMat('tex_wood.webp', '#6a4628', '#b08858');
  const orbMat = mat('#80e0ff', { emissive: '#40c0ff', emissiveIntensity: 1.4, roughness: 0.2 });

  // Boots that show under the hem when it strides.
  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(0, 0.45, 0.1 * s);
    hip.add(mesh(tube([[0, 0, 0], [0.01, -0.22, 0], [0, -0.4, 0]], 0.07, 0.06, 4, 8), boot));
    hip.add(mesh(blob(0.11, 0.05, 0.065, { seed: 70 + s, detail: 1 }), boot, 0.05, -0.42, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);

  const gown = mesh(lathe([[0.36, 0.1], [0.33, 0.3], [0.26, 0.7], [0.24, 0.95], [0.27, 1.1], [0.16, 1.22], [0.08, 1.26]], 18), robe);
  gown.scale.z = 1.1;
  const trim = mesh(new THREE.TorusGeometry(0.355, 0.03, 6, 22).rotateX(Math.PI / 2), gold, 0, 0.11, 0);
  trim.scale.z = 1.1;
  const sash = mesh(new THREE.TorusGeometry(0.255, 0.045, 6, 22).rotateX(Math.PI / 2), team, 0, 0.78, 0);
  sash.scale.z = 1.1;
  const tail = mesh(cloth(0.1, 0.4, 0.02), team, 0.22, 0.6, 0.12);
  tail.rotation.y = Math.PI;
  const mantle = mesh(new THREE.SphereGeometry(0.3, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), team, 0, 1.08, 0);
  mantle.scale.set(1, 0.7, 1.15);
  // Head under a pointed hood, the beard spilling out.
  const face = mesh(scaled(G.sphere, 0.13), skin, 0.06, 1.36, 0);
  const hood = mesh(lathe([[0.18, 1.24], [0.19, 1.38], [0.15, 1.5], [0.08, 1.62], [0.01, 1.7]], 16), robe, -0.03, 0, 0);
  hood.rotation.z = 0.15;
  const brim = mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 18), gold, 0.11, 1.39, 0);
  brim.rotation.y = Math.PI / 2;
  const whiskers = mesh(lathe([[0.1, 1.3], [0.08, 1.18], [0.01, 1.04]], 10), beard, 0.12, 0, 0);
  const eyes = [1, -1].map((s) => mesh(scaled(G.sphere, 0.02), mat('#80e0ff', { emissive: '#40c0ff', emissiveIntensity: 1 }), 0.18, 1.38, 0.045 * s));
  const armL = mesh(tube([[0, 1.1, 0.24], [0.1, 0.9, 0.3], [0.22, 0.8, 0.2]], 0.08, 0.07, 6, 8), robe);
  const handL = mesh(scaled(G.sphere, 0.055), skin, 0.24, 0.79, 0.19);

  // The staff (raised by a cast) with a glowing orb in a twist of wood.
  const staff = new THREE.Group();
  staff.position.set(0.2, 0.85, -0.3);
  staff.add(mesh(tube([[0, -0.8, 0], [0.02, 0, 0.01], [-0.01, 0.6, 0], [0.04, 0.75, 0.03]], 0.03, 0.022, 10, 6), wood));
  staff.add(mesh(tube([[-0.06, 0.62, 0], [-0.08, 0.76, 0.04], [0, 0.88, 0], [0.08, 0.76, -0.04]], 0.018, 0.01, 10, 5), wood));
  const orb = mesh(scaled(G.sphere, 0.08), orbMat, 0, 0.76, 0);
  staff.add(orb);
  const armR = mesh(tube([[0, 1.1, -0.24], [0.08, 0.95, -0.32], [0.18, 0.86, -0.3]], 0.08, 0.07, 6, 8), robe);

  body.add(legL, legR, gown, trim, sash, tail, mantle, face, hood, brim, whiskers, ...eyes, armL, handL, armR, staff);
  g.userData = { body, legL, legR, staff, kind: 'hero' };
  return g;
}

registerSkin('renegade', (color) => renegade(color));
