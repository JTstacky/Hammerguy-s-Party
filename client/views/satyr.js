// Wheel of Fire's Satyr Trickster (nsat): curled horns and cloven goat legs.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin } from '../../engine/client/render/registry.js';

const { mesh, blob, tube, cloth, mat } = M;
let template;

function makeTemplate() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.name = 'body';
  body.scale.setScalar(1.45);
  g.add(body);
  const skin = mat('#ba83cb', { roughness: 0.75 });
  const fur = mat('#78649a', { roughness: 0.95 });
  const dark = mat('#332e4a', { roughness: 0.85 });
  const horn = mat('#edd8ad', { roughness: 0.6 });
  const hornBase = mat('#ad8755', { roughness: 0.7 });
  const eye = mat('#c8ff63', { emissive: '#4b6d12', roughness: 0.45 });
  const team = mat('#ffffff', { roughness: 0.85, side: THREE.DoubleSide });
  const gold = mat('#e9b946', { metalness: 0.45, roughness: 0.45 });
  const round = (p, m, x, y, z, a, b, c, detail = 2) => {
    const o = mesh(blob(a, b, c, { amt: 0.04, seed: 82, detail }), m, x, y, z);
    p.add(o);
    return o;
  };
  // The knee comes forward, the hock goes back, then the hoof plants forward.
  // Each complete leg swings about its hip, preserving the zigzag silhouette.
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.name = s > 0 ? 'legL' : 'legR';
    leg.position.set(-0.055, 0.76, s * 0.155);
    round(leg, fur, 0.045, -0.1, s * 0.025, 0.145, 0.22, 0.13);
    leg.add(mesh(tube([[0.1, -0.17, s * 0.03], [-0.11, -0.41, s * 0.045], [-0.12, -0.48, s * 0.045], [0, -0.63, s * 0.045]], 0.09, 0.052, 8, 8), fur));
    round(leg, fur, -0.105, -0.44, s * 0.045, 0.085, 0.09, 0.08, 1);
    for (const dz of [-0.047, 0.047]) {
      const hoof = mesh(new THREE.CylinderGeometry(0.061, 0.078, 0.125, 6), dark, 0.065, -0.69, s * 0.045 + dz);
      hoof.scale.x = 1.65;
      leg.add(hoof);
    }
    // Pointed tufts suggest shaggy fur without a dark texture over the legs.
    for (let i = 0; i < 3; i++) {
      leg.add(mesh(tube([[0.015 - i * 0.035, -0.08 - i * 0.055, s * 0.12], [-0.025 - i * 0.04, -0.25 - i * 0.045, s * 0.15]], 0.05, 0.001, 2, 5), fur));
    }
    body.add(leg);
  }
  round(body, skin, -0.025, 1.025, 0, 0.17, 0.29, 0.24, 3);
  round(body, skin, -0.065, 1.215, 0, 0.19, 0.17, 0.3);
  for (const s of [-1, 1]) round(body, skin, 0.115, 1.16, s * 0.115, 0.07, 0.105, 0.135);
  round(body, skin, 0.11, 0.94, 0, 0.08, 0.16, 0.115);
  const belt = mesh(new THREE.CylinderGeometry(0.185, 0.205, 0.09, 14), hornBase, -0.035, 0.79, 0);
  belt.scale.z = 1.25;
  body.add(belt);
  for (const s of [-1, 1]) {
    const loin = mesh(cloth(0.27, 0.39, 0.035, s * -0.045), team, s * 0.18 - 0.035, 0.585, 0);
    if (s > 0) loin.rotation.y = Math.PI;
    body.add(loin);
  }
  round(body, gold, 0.175, 0.8, 0, 0.025, 0.06, 0.07, 1);
  // Short tufted tail curls out behind the loincloth.
  body.add(mesh(tube([[-0.17, 0.8, 0], [-0.34, 0.8, 0], [-0.44, 0.94, 0.04], [-0.46, 1.02, 0.07]], 0.042, 0.012, 8, 7), skin));
  round(body, fur, -0.46, 1.02, 0.07, 0.07, 0.08, 0.055, 1);
  // Team cloth on the left shoulder stays visible from the overhead camera.
  const mantle = mesh(new THREE.SphereGeometry(0.18, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.48), team, -0.06, 1.235, 0.265);
  mantle.rotation.x = 0.35;
  body.add(mantle);
  const drape = mesh(cloth(0.23, 0.3, 0.055, 0.06), team, -0.2, 1.17, 0.28);
  body.add(drape);
  round(body, gold, 0.075, 1.29, 0.265, 0.035, 0.035, 0.035, 1);

  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(-0.02, 1.22, s * 0.285);
    if (s < 0) arm.name = 'staff';
    arm.add(mesh(tube([[0, 0, 0], [0.055, -0.24, s * 0.12], [0.23, -0.39, s * 0.1]], 0.085, 0.053, 9, 8), skin));
    const band = mesh(new THREE.CylinderGeometry(0.09, 0.087, 0.095, 10), team, 0.025, -0.13, s * 0.075);
    band.rotation.x = -s * 0.4;
    arm.add(band);
    round(arm, fur, 0.155, -0.33, s * 0.115, 0.083, 0.07, 0.08, 1);
    round(arm, skin, 0.25, -0.405, s * 0.09, 0.08, 0.085, 0.095);
    for (const dz of [-0.06, 0, 0.06]) {
      arm.add(mesh(tube([[0.285, -0.42, s * 0.09 + dz], [0.37, -0.44, s * 0.1 + dz * 1.35], [0.395, -0.51, s * 0.1 + dz * 1.35]], 0.024, 0.014, 4, 6), skin));
      arm.add(mesh(tube([[0.395, -0.51, s * 0.1 + dz * 1.35], [0.38, -0.565, s * 0.1 + dz * 1.35]], 0.017, 0.001, 2, 5), horn));
    }
    arm.add(mesh(tube([[0.24, -0.39, s * 0.025], [0.31, -0.35, s * -0.02], [0.35, -0.4, s * -0.025]], 0.03, 0.006, 4, 6), skin));
    body.add(arm);
  }
  // Goat muzzle and slanted eyes face up and out from the hunched shoulders.
  const head = new THREE.Group();
  head.position.set(0.14, 1.43, 0);
  head.rotation.z = 0.16;
  round(head, skin, 0, 0, 0, 0.16, 0.18, 0.15);
  round(head, fur, 0.105, -0.085, 0, 0.12, 0.1, 0.12);
  round(head, skin, 0.185, -0.055, 0, 0.065, 0.06, 0.095);
  round(head, dark, 0.228, -0.027, 0, 0.025, 0.026, 0.065, 1);
  head.add(mesh(tube([[0.1, -0.13, 0], [0.105, -0.23, 0], [0.04, -0.28, 0]], 0.07, 0.001, 5, 7), dark));
  for (const s of [-1, 1]) {
    round(head, dark, 0.12, 0.052, s * 0.09, 0.041, 0.036, 0.049, 1);
    round(head, eye, 0.145, 0.057, s * 0.097, 0.017, 0.018, 0.033, 1);
    const brow = round(head, skin, 0.119, 0.089, s * 0.095, 0.05, 0.025, 0.066, 1);
    brow.rotation.x = s * 0.3;
    head.add(mesh(tube([[-0.02, 0.01, s * 0.12], [-0.005, 0.025, s * 0.24], [0.045, 0.085, s * 0.32]], 0.061, 0.002, 5, 7), skin));
    // Full ram curls: high crown, backward sweep, low hook and forward tip.
    head.add(mesh(tube([[-0.065, 0.105, s * 0.115], [-0.1, 0.255, s * 0.22], [-0.25, 0.265, s * 0.28], [-0.34, 0.13, s * 0.3], [-0.26, 0.005, s * 0.31], [-0.115, 0.035, s * 0.32], [-0.08, 0.125, s * 0.32]], 0.09, 0.005, 20, 9), horn));
    round(head, hornBase, -0.064, 0.12, s * 0.137, 0.085, 0.085, 0.085, 1);
  }
  head.add(mesh(tube([[-0.065, 0.14, 0], [-0.135, 0.225, 0], [-0.2, 0.2, 0]], 0.05, 0.001, 4, 6), dark));
  body.add(head);
  g.traverse((o) => { if (o.material === team) o.name = 'team'; });
  return g;
}

export function satyr(color) {
  template ??= makeTemplate();
  const g = template.clone(true);
  const team = mat(color, { roughness: 0.85, side: THREE.DoubleSide });
  g.traverse((o) => { if (o.isMesh && o.name === 'team') o.material = team; });
  g.userData = { body: g.getObjectByName('body'), staff: g.getObjectByName('staff'), legL: g.getObjectByName('legL'), legR: g.getObjectByName('legR'), kind: 'hero' };
  return g;
}

registerSkin('satyr', satyr);
