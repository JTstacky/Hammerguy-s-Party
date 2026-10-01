// Two jungle-troll player units: The Unseen's Witch Doctor (odoc), a blue
// troll in a painted ritual mask with a skull staff, and Death Trap's Forest
// Troll (nftr), a green troll with a red mohawk and a throwing axe. Both are
// lanky, hunched, long-armed, with tusks and long ears. Face +X; about 2.3 tall.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin } from '../../engine/client/render/registry.js';
import { knob } from './walkgrid-art.js';

const { mesh, blob, tube, cloth, mat } = M;

function troll(color, { skin, hair, loin }) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const bone = M.boneMat();
  const team = mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  const eye = mat('#fff0a0', { emissive: '#c08000', emissiveIntensity: 0.8 });
  const lump = (p, m, x, y, z, a, b, c, seed = 1, detail = 2) => {
    const o = mesh(blob(a, b, c, { seed, amt: 0.05, detail }), m, x, y, z);
    p.add(o);
    return o;
  };
  // Digitigrade legs: knee forward, ankle back, a two-toed foot.
  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(-0.02, 0.86, 0.15 * s);
    hip.add(mesh(tube([[0, 0, 0], [0.14, -0.4, 0.02 * s], [-0.04, -0.72, 0.02 * s], [0, -0.82, 0.02 * s]], 0.1, 0.05, 8, 7), skin));
    for (const dz of [-0.04, 0.04]) hip.add(mesh(tube([[0, -0.82, 0.02 * s + dz], [0.16, -0.84, 0.02 * s + dz * 1.4]], 0.05, 0.02, 3, 6), skin));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  body.add(legL, legR);
  // Hips and loincloth (front and back panels in team colour).
  lump(body, loin, 0, 0.9, 0, 0.17, 0.12, 0.22, 51, 1);
  const front = mesh(cloth(0.26, 0.42, 0.04), team, 0.15, 0.72, 0);
  front.rotation.y = Math.PI;
  body.add(front, mesh(cloth(0.3, 0.46, 0.05, 0.08), team, -0.15, 0.72, 0));
  // Hunched torso leaning forward.
  const chest = lump(body, skin, 0.08, 1.28, 0, 0.2, 0.32, 0.27, 52);
  chest.rotation.z = -0.45;
  lump(body, skin, 0.03, 1.02, 0, 0.15, 0.17, 0.2, 53, 1);
  // Head jutting forward: long nose, tusks, long swept ears.
  const head = new THREE.Group();
  head.position.set(0.32, 1.58, 0);
  body.add(head);
  lump(head, skin, 0, 0, 0, 0.15, 0.14, 0.13, 54);
  lump(head, skin, 0.13, -0.08, 0, 0.11, 0.07, 0.1, 55, 1);
  const nose = mesh(M.scaled(M.G.cone, 0.045, 0.16, 0.04), skin, 0.2, 0.0, 0);
  nose.rotation.z = -Math.PI / 2 - 0.4;
  head.add(nose);
  for (const s of [1, -1]) {
    head.add(mesh(tube([[0.15, -0.1, 0.07 * s], [0.22, -0.06, 0.1 * s], [0.22, 0.04, 0.08 * s]], 0.03, 0.004, 4, 5), bone));
    head.add(mesh(tube([[-0.02, 0.04, 0.11 * s], [-0.12, 0.1, 0.26 * s], [-0.22, 0.12, 0.38 * s]], 0.05, 0.004, 5, 5), skin));
    head.add(mesh(knob(0.022, 6), eye, 0.12, 0.04, 0.06 * s));
  }
  // Hair: a swept-back mane / mohawk.
  for (let i = 0; hair && i < 5; i++) {
    const a = (i - 2) * 0.05;
    head.add(mesh(tube([[0.06 - i * 0.05, 0.12, a], [-0.05 - i * 0.07, 0.3 - i * 0.03, a * 1.5], [-0.2 - i * 0.07, 0.25 - i * 0.06, a * 2]], 0.05, 0.008, 5, 5), hair));
  }
  // Long arms; the left hangs, the right (staff) carries the weapon.
  const armL = new THREE.Group();
  armL.position.set(0.12, 1.4, 0.26);
  armL.add(mesh(tube([[0, 0, 0], [0.06, -0.3, 0.06], [0.2, -0.55, 0.04]], 0.075, 0.055, 6, 7), skin));
  lump(armL, skin, 0.23, -0.6, 0.04, 0.07, 0.08, 0.06, 56, 1);
  body.add(armL);
  const armR = new THREE.Group();
  armR.position.set(0.12, 1.4, -0.26);
  armR.add(mesh(tube([[0, 0, 0], [0.08, -0.28, -0.06], [0.28, -0.42, -0.06]], 0.075, 0.055, 6, 7), skin));
  lump(armR, skin, 0.31, -0.44, -0.06, 0.07, 0.08, 0.06, 57, 1);
  body.add(armR);
  // Team shoulder guard read from above.
  for (const s of [1, -1]) {
    const p = mesh(new THREE.SphereGeometry(0.13, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), team, 0.1, 1.45, 0.24 * s);
    p.rotation.x = 0.45 * s;
    body.add(p);
  }
  g.userData = { body, legL, legR, staff: armR, kind: 'hero' };
  return { g, body, head, armR, team, bone, lump };
}

export function witchDoctor(color) {
  const skin = mat('#6c9ae0', { roughness: 0.7 });
  const t = troll(color, { skin, hair: null, loin: M.leatherMat('#d8b088') });
  const { g, head, armR, team, bone, lump } = t;
  // The ritual mask: a long painted wooden face over the troll's own.
  const wood = mat('#c86a2a', { roughness: 0.6 });
  const paint = mat('#f4f0e0', { roughness: 0.6 });
  const mask = lump(head, wood, 0.17, 0.02, 0, 0.06, 0.21, 0.15, 58);
  mask.rotation.z = 0.15;
  for (const s of [1, -1]) head.add(mesh(knob(0.03, 6), mat('#101010'), 0.22, 0.07, 0.06 * s));
  head.add(mesh(tube([[0.22, 0.17, 0], [0.235, -0.1, 0]], 0.022, 0.015, 3, 5), paint));
  head.add(mesh(tube([[0.22, -0.14, -0.08], [0.23, -0.17, 0], [0.22, -0.14, 0.08]], 0.018, 0.018, 4, 5), paint));
  // Feathered headdress in team colour.
  for (let i = 0; i < 4; i++) {
    const a = (i - 1.5) * 0.35;
    head.add(mesh(tube([[0.05, 0.15, 0], [0.02 + Math.cos(a) * 0.02, 0.38, Math.sin(a) * 0.14], [-0.08, 0.5, Math.sin(a) * 0.22]], 0.04, 0.006, 5, 5), team));
  }
  // Skull staff in the right hand.
  const staff = new THREE.Group();
  staff.position.set(0.3, -0.44, -0.06);
  armR.add(staff);
  const haft = M.barkMat();
  staff.add(mesh(tube([[0, -0.6, 0], [0.02, 0.2, 0], [-0.02, 0.7, 0], [0.03, 0.85, 0]], 0.03, 0.025, 6, 6), haft));
  lump(staff, bone, 0.05, 0.95, 0, 0.1, 0.1, 0.09, 59, 1);
  lump(staff, bone, 0.11, 0.9, 0, 0.06, 0.05, 0.07, 60, 1);
  for (const s of [1, -1]) staff.add(mesh(knob(0.025, 6), mat('#40ff90', { emissive: '#20c060', emissiveIntensity: 1.2 }), 0.13, 0.97, 0.04 * s));
  for (const s of [1, -1]) staff.add(mesh(tube([[0, 0.8, 0.03 * s], [-0.03, 0.6, 0.1 * s], [-0.02, 0.45, 0.12 * s]], 0.035, 0.005, 4, 5), team));
  // Shrunken-head fetish at the belt.
  lump(t.body, mat('#6a5a3a', { roughness: 0.8 }), 0.05, 0.86, 0.23, 0.06, 0.07, 0.06, 61, 1);
  return g;
}

export function forestTroll(color) {
  const skin = mat('#7ec060', { roughness: 0.7 });
  const t = troll(color, { skin, hair: mat('#e8402a', { roughness: 0.75 }), loin: M.leatherMat('#c89870') });
  const { g, armR, team, lump } = t;
  // Throwing axe in the right hand, more axes across the back.
  const haft = M.barkMat();
  const steel = M.silverMat();
  const axe = new THREE.Group();
  axe.position.set(0.3, -0.44, -0.06);
  armR.add(axe);
  axe.add(mesh(tube([[0, -0.2, 0], [0.02, 0.2, 0], [0, 0.45, 0]], 0.03, 0.025, 4, 6), haft));
  const blade = mesh(M.axeBlade(0.26, 0.3), steel, 0.02, 0.4, 0);
  axe.add(blade);
  for (const s of [1, -1]) {
    const b = new THREE.Group();
    b.position.set(-0.22, 1.3, 0.08 * s);
    b.rotation.x = 0.6 * s;
    b.add(mesh(tube([[0, -0.2, 0], [0, 0.25, 0]], 0.025, 0.025, 2, 5), haft));
    const bl = mesh(M.axeBlade(0.18, 0.22), steel, 0, 0.2, 0);
    bl.rotation.y = Math.PI;
    b.add(bl);
    t.body.add(b);
  }
  // Leather bandolier and a team headband.
  t.body.add(mesh(tube([[0.2, 1.45, 0.22], [0.25, 1.2, 0], [0.18, 0.95, -0.2]], 0.035, 0.035, 6, 5), M.leatherMat('#a07850')));
  const band = mesh(new THREE.TorusGeometry(0.14, 0.03, 5, 14), team, 0, 0.06, 0);
  band.rotation.x = Math.PI / 2;
  band.rotation.y = 0.3;
  t.head.add(band);
  lump(t.body, team, -0.16, 1.32, 0, 0.12, 0.08, 0.2, 62, 1);
  return g;
}

registerSkin('witchdoctor', witchDoctor);
registerSkin('foresttroll', forestTroll);
