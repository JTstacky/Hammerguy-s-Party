// Stampede's Orc Grunt (ogru). Geometry is shared; each hero owns its pivots.
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
  const skin = mat('#65b52e', { roughness: 0.7 });
  const lip = mat('#3e7d22', { roughness: 0.8 });
  const leather = mat('#a96630', { roughness: 0.9, side: THREE.DoubleSide });
  const iron = mat('#65788b', { metalness: 0.55, roughness: 0.42 });
  const steel = mat('#dce6ed', { metalness: 0.65, roughness: 0.3 });
  const ivory = mat('#fff0c7', { roughness: 0.5 });
  const black = mat('#20222a', { roughness: 0.85 });
  const eye = mat('#ffcf42', { emissive: '#6b3100', roughness: 0.5 });
  const team = mat('#ffffff', { roughness: 0.85, side: THREE.DoubleSide });
  const round = (p, m, x, y, z, a, b, c, detail = 2) => {
    const o = mesh(blob(a, b, c, { amt: 0.035, seed: 73, detail }), m, x, y, z);
    p.add(o);
    return o;
  };
  // Short sturdy legs, broad boots, and shin bindings under a leather skirt.
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.name = s > 0 ? 'legL' : 'legR';
    leg.position.set(0, 0.57, s * 0.19);
    leg.add(mesh(tube([[0, 0, 0], [0.04, -0.23, s * 0.015], [0, -0.4, s * 0.03]], 0.125, 0.085, 6, 8), skin));
    leg.add(mesh(new THREE.CylinderGeometry(0.105, 0.115, 0.18, 10), leather, 0, -0.35, s * 0.03));
    round(leg, black, 0.065, -0.49, s * 0.03, 0.18, 0.075, 0.12);
    leg.add(mesh(new THREE.CylinderGeometry(0.116, 0.117, 0.035, 10), steel, 0, -0.29, s * 0.03));
    body.add(leg);
  }
  round(body, skin, -0.025, 0.96, 0, 0.255, 0.34, 0.345, 3);
  round(body, skin, -0.05, 1.16, 0, 0.245, 0.18, 0.42);
  for (const s of [-1, 1]) round(body, skin, 0.19, 1.09, s * 0.145, 0.11, 0.14, 0.18);
  // Wide belt and separated leather tassets make the skirt read from above.
  const belt = mesh(new THREE.CylinderGeometry(0.245, 0.25, 0.12, 16), leather, 0, 0.68, 0);
  belt.scale.z = 1.3;
  body.add(belt);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const strip = mesh(cloth(0.15, 0.27, 0.025, 0.035), leather, Math.cos(a) * 0.245, 0.51, Math.sin(a) * 0.31);
    strip.rotation.y = -a;
    body.add(strip);
  }
  const loin = mesh(cloth(0.27, 0.36, 0.03, -0.035), team, 0.27, 0.49, 0);
  loin.rotation.y = Math.PI;
  body.add(loin, mesh(new THREE.BoxGeometry(0.045, 0.09, 0.14), steel, 0.26, 0.68, 0));
  const harness = mesh(tube([[-0.08, 1.31, -0.26], [0.23, 1.16, -0.12], [0.26, 0.98, 0.09], [0.16, 0.75, 0.22]], 0.047, 0.047, 10, 6), leather);
  body.add(harness);
  round(body, steel, 0.275, 1.04, 0.025, 0.018, 0.055, 0.05, 1);

  // Large angular metal pauldrons, bright team rims and three ivory spikes.
  for (const s of [-1, 1]) {
    const pad = new THREE.Group();
    pad.position.set(-0.035, 1.21, s * 0.385);
    pad.rotation.x = s * 0.4;
    round(pad, team, 0, 0, 0, 0.255, 0.105, 0.235);
    round(pad, iron, 0, 0.055, 0, 0.235, 0.12, 0.21);
    for (const [x, z, h] of [[-0.12, -0.055, 0.2], [0.025, 0.025, 0.26], [0.12, 0.08, 0.19]]) {
      pad.add(mesh(tube([[x, 0.13, z * s], [x - 0.025, 0.2, z * s * 1.4], [x - 0.05, 0.13 + h, z * s * 2]], 0.057, 0.002, 4, 6), steel));
    }
    body.add(pad);
  }
  // Axe arm is part of the cast pivot, keeping the hand on the haft.
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(0.015, 1.15, s * 0.39);
    if (s < 0) arm.name = 'staff';
    arm.add(mesh(tube([[0, 0, 0], [0.06, -0.2, s * 0.09], [0.24, -0.39, s * 0.055]], 0.145, 0.095, 8, 10), skin));
    round(arm, skin, 0.035, -0.13, s * 0.055, 0.14, 0.18, 0.145);
    const cuff = mesh(new THREE.CylinderGeometry(0.109, 0.115, 0.16, 10), iron, 0.18, -0.32, s * 0.07);
    cuff.rotation.z = 0.65;
    arm.add(cuff);
    round(arm, skin, 0.265, -0.41, s * 0.05, 0.105, 0.105, 0.11);
    if (s < 0) {
      const axe = new THREE.Group();
      axe.position.set(0.29, -0.4, -0.06);
      axe.rotation.z = -0.18;
      axe.add(mesh(new THREE.CylinderGeometry(0.035, 0.042, 1.12, 10), leather, 0, 0.15, 0));
      axe.add(mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.29, 10), team, 0, -0.12, 0));
      axe.add(mesh(M.axeBlade(0.43, 0.61), steel, 0, 0.59, 0));
      axe.add(mesh(M.axeBlade(0.28, 0.41), iron, 0, 0.59, 0.035));
      axe.add(mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.2, 10), iron, 0, 0.59, 0));
      round(axe, steel, 0, -0.425, 0, 0.06, 0.055, 0.06, 1);
      arm.add(axe);
    }
    body.add(arm);
  }
  // Forward-set, upturned face: heavy brow, huge underbite, exposed tusks.
  const head = new THREE.Group();
  head.position.set(0.16, 1.43, 0);
  head.rotation.z = 0.12;
  round(head, skin, 0, 0, 0, 0.195, 0.185, 0.195);
  round(head, lip, 0.125, -0.11, 0, 0.15, 0.095, 0.17);
  round(head, skin, 0.14, -0.145, 0, 0.15, 0.07, 0.175);
  round(head, skin, 0.19, 0.005, 0, 0.07, 0.07, 0.07);
  for (const s of [-1, 1]) {
    round(head, black, 0.164, 0.054, s * 0.09, 0.045, 0.031, 0.05, 1);
    round(head, eye, 0.193, 0.057, s * 0.09, 0.016, 0.018, 0.03, 1);
    const brow = round(head, skin, 0.167, 0.092, s * 0.09, 0.054, 0.035, 0.075, 1);
    brow.rotation.x = s * 0.23;
    head.add(mesh(tube([[0.225, -0.14, s * 0.115], [0.29, -0.035, s * 0.14], [0.275, 0.06, s * 0.135]], 0.035, 0.002, 7, 7), ivory));
    head.add(mesh(tube([[-0.02, 0.015, s * 0.15], [-0.07, 0.05, s * 0.245], [-0.09, 0.12, s * 0.3]], 0.065, 0.001, 4, 7), skin));
  }
  round(head, black, -0.07, 0.15, 0, 0.13, 0.075, 0.095);
  head.add(mesh(tube([[-0.07, 0.16, 0], [-0.13, 0.3, 0], [-0.25, 0.29, 0]], 0.07, 0.025, 6, 8), black));
  head.add(mesh(new THREE.CylinderGeometry(0.061, 0.07, 0.045, 10), leather, -0.1, 0.225, 0));
  body.add(head);
  g.traverse((o) => { if (o.material === team) o.name = 'team'; });
  return g;
}

export function grunt(color) {
  template ??= makeTemplate();
  const g = template.clone(true);
  const team = mat(color, { roughness: 0.85, side: THREE.DoubleSide });
  g.traverse((o) => { if (o.isMesh && o.name === 'team') o.material = team; });
  g.userData = { body: g.getObjectByName('body'), staff: g.getObjectByName('staff'), legL: g.getObjectByName('legL'), legR: g.getObjectByName('legR'), kind: 'hero' };
  return g;
}

registerSkin('grunt', grunt);
