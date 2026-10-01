// The Knight (`hkni`): the player unit of Push the Ogre. A plate-armoured
// rider on a big bay warhorse: a team-coloured caparison with a gold hem,
// a steel chanfron, a plumed great helm, a kite shield and a longsword.
// The fore legs are legL/legR; the hind legs trot with them in tick().

import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin } from '../../engine/client/render/registry.js';

const { mesh, blob, tube, lathe, cloth, mat, G, scaled } = M;

export function knight(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(1.05);
  g.add(body);
  const coat = M.triMat('tex_hide.webp', '#8a5530', '#e0a878', 2, { roughness: 0.6 });
  const hair = mat('#2a1a10', { roughness: 0.9 });
  const hoof = mat('#30261e', { roughness: 0.6 });
  const steel = M.plateMat();
  const gold = M.goldMat();
  const team = mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  const leather = M.leatherMat('#a07048');
  const dark = mat('#141414');

  // Horse legs: upper leg, cannon, and a hoof, hung from the shoulder/hip.
  const leg = (x, s, back) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.9, 0.17 * s);
    const k = back ? -0.06 : 0.04;
    hip.add(mesh(tube([[0, 0.05, 0], [k, -0.35, 0], [0, -0.78, 0]], 0.1, 0.05, 6, 8), coat));
    hip.add(mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.1, 10), hoof, 0, -0.84, 0));
    hip.add(mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.08, 10), hair, 0, -0.76, 0)); // fetlock
    return hip;
  };
  const legL = leg(0.42, 1, false);
  const legR = leg(0.42, -1, false);
  const hindL = leg(-0.45, 1, true);
  const hindR = leg(-0.45, -1, true);

  // Barrel, chest and haunch, neck and head.
  const barrel = mesh(blob(0.62, 0.3, 0.27, { seed: 61, amt: 0.03, detail: 2 }), coat, 0, 1.05, 0);
  const chest = mesh(blob(0.26, 0.3, 0.25, { seed: 62, amt: 0.03, detail: 2 }), coat, 0.48, 1.1, 0);
  const neck = mesh(tube([[0.5, 1.15, 0], [0.7, 1.45, 0], [0.82, 1.68, 0]], 0.2, 0.12, 8, 10), coat);
  const head = new THREE.Group();
  head.position.set(0.86, 1.68, 0);
  head.rotation.z = -0.6;
  head.add(mesh(blob(0.26, 0.1, 0.1, { seed: 63, amt: 0.03, detail: 2 }), coat, 0.18, 0, 0));
  head.add(mesh(blob(0.2, 0.04, 0.11, { seed: 64, amt: 0.02, detail: 1 }), steel, 0.18, 0.08, 0)); // chanfron
  head.add(mesh(scaled(G.cone, 0.035, 0.18, 0.035), steel, 0.12, 0.17, 0)); // spike
  for (const s of [1, -1]) {
    head.add(mesh(scaled(G.cone, 0.035, 0.12, 0.03), coat, -0.02, 0.12, 0.06 * s));
    head.add(mesh(scaled(G.sphere, 0.025), dark, 0.1, 0.04, 0.09 * s));
  }
  const mane = mesh(tube([[0.42, 1.38, 0], [0.62, 1.62, 0], [0.8, 1.82, 0]], 0.06, 0.04, 8, 6), hair);
  const tail = mesh(tube([[-0.6, 1.15, 0], [-0.78, 0.95, 0], [-0.8, 0.6, 0]], 0.08, 0.03, 8, 6), hair);

  // The caparison: a team skirt round the barrel down to the knees.
  const cap = mesh(new THREE.CylinderGeometry(0.33, 0.38, 0.5, 22, 1, true), team, 0, 0.9, 0);
  cap.scale.set(2.15, 1, 1.0);
  const hem = mesh(new THREE.TorusGeometry(0.38, 0.03, 6, 26).rotateX(Math.PI / 2), gold, 0, 0.65, 0);
  hem.scale.set(2.15, 1, 1.0);
  const capTop = mesh(blob(0.66, 0.08, 0.31, { seed: 65, amt: 0.01, detail: 2 }), team, -0.02, 1.2, 0);
  const saddle = mesh(blob(0.2, 0.07, 0.26, { seed: 66, amt: 0.02, detail: 1 }), leather, -0.02, 1.3, 0);

  // The rider.
  const rider = new THREE.Group();
  rider.position.set(-0.02, 1.32, 0);
  for (const s of [1, -1]) rider.add(mesh(tube([[0.02, 0.05, 0.12 * s], [0.14, -0.1, 0.3 * s], [0.1, -0.42, 0.3 * s]], 0.08, 0.065, 6, 8), steel));
  const torso = mesh(lathe([[0.17, 0], [0.22, 0.12], [0.25, 0.3], [0.23, 0.45], [0.12, 0.55], [0.06, 0.58]], 16), steel);
  torso.scale.set(0.9, 1, 1.15);
  const tabard = mesh(cloth(0.26, 0.5, 0.05), team, 0.24, 0.14, 0);
  tabard.rotation.y = Math.PI;
  const helm = mesh(lathe([[0.13, 0.56], [0.15, 0.66], [0.15, 0.76], [0.1, 0.84], [0.01, 0.86]], 18), steel);
  const visor = mesh(scaled(G.box, 0.03, 0.03, 0.18), dark, 0.145, 0.72, 0);
  const plume = mesh(tube([[0.02, 0.84, 0], [-0.12, 0.98, 0], [-0.3, 0.92, 0], [-0.38, 0.72, 0]], 0.055, 0.015, 10, 6), team);
  rider.add(torso, tabard, helm, visor, plume);
  for (const s of [1, -1]) {
    const p = mesh(new THREE.SphereGeometry(0.13, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold, 0, 0.47, 0.25 * s);
    p.rotation.x = 0.5 * s;
    rider.add(p);
  }
  // Kite shield on the left arm.
  rider.add(mesh(tube([[0, 0.45, 0.28], [0.1, 0.3, 0.36], [0.14, 0.2, 0.36]], 0.07, 0.06, 6, 6), steel));
  const kite = new THREE.Shape();
  kite.moveTo(0, 0.22);
  kite.quadraticCurveTo(0.17, 0.2, 0.16, 0.04);
  kite.quadraticCurveTo(0.12, -0.16, 0, -0.3);
  kite.quadraticCurveTo(-0.12, -0.16, -0.16, 0.04);
  kite.quadraticCurveTo(-0.17, 0.2, 0, 0.22);
  const shieldGeo = new THREE.ExtrudeGeometry(kite, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.015, bevelSegments: 1, curveSegments: 6 });
  const shield = mesh(shieldGeo, team, 0.12, 0.2, 0.4);
  shield.rotation.y = -0.2;
  const boss = mesh(scaled(G.sphere, 0.05, 0.05, 0.03), gold, 0.12, 0.22, 0.44);
  rider.add(shield, boss);
  // The sword arm: the "staff" a cast raises.
  const arm = new THREE.Group();
  arm.position.set(0, 0.45, -0.26);
  arm.add(mesh(tube([[0, 0, 0], [0.1, -0.16, -0.06], [0.22, -0.22, -0.06]], 0.07, 0.06, 6, 8), steel));
  arm.add(mesh(scaled(G.box, 0.05, 0.18, 0.04), leather, 0.24, -0.2, -0.06));
  arm.add(mesh(scaled(G.box, 0.04, 0.03, 0.2), gold, 0.24, -0.1, -0.06));
  arm.add(mesh(tube([[0.24, -0.09, -0.06], [0.3, 0.3, -0.06], [0.34, 0.68, -0.06]], 0.03, 0.012, 4, 4), M.silverMat()));
  arm.rotation.z = -0.5;
  rider.add(arm);

  body.add(legL, legR, hindL, hindR, barrel, chest, neck, head, mane, tail, cap, hem, capTop, saddle, rider);
  g.userData = {
    body, legL, legR, staff: arm, anim: [hindL, hindR, head], kind: 'hero',
    tick(dt, v, b) {
      // A trot: diagonal pairs swing together.
      hindL.rotation.z = legR.rotation.z;
      hindR.rotation.z = legL.rotation.z;
      head.rotation.z = -0.6 + (b.mv && !b.dead ? Math.sin((v.walk ?? 0) * 2) * 0.06 : 0);
    },
  };
  return g;
}

registerSkin('knight', (color) => knight(color));
