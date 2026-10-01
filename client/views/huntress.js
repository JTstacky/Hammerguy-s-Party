// Covert Kitty's Huntress (esen): a night elf rider on a nightsaber panther,
// a moon glaive raised in her right hand. Faces +X; about 2.4 tall.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin } from '../../engine/client/render/registry.js';
import { creatureTick, knob } from './walkgrid-art.js';

const { mesh, blob, tube, cloth, mat } = M;

// A three-bladed moon glaive in the XY plane, hub at the origin.
function glaive(steel, grip) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 12), grip));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const p = [];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      const r = 0.08 + t * 0.3;
      const b = a + t * 1.0;
      p.push([Math.cos(b) * r, Math.sin(b) * r, 0]);
    }
    const blade = mesh(tube(p, 0.05, 0.004, 8, 5), steel);
    blade.scale.z = 0.35;
    g.add(blade);
  }
  return g;
}

export function huntress(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const fur = mat('#5e4e98', { roughness: 0.8 });
  const belly = mat('#b4a6e2', { roughness: 0.8 });
  const dark = mat('#1c1430', { roughness: 0.4 });
  const eye = mat('#e8fff0', { emissive: '#7dffc8', emissiveIntensity: 1.2 });
  const skin = mat('#9a7ad8', { roughness: 0.6 });
  const hair = mat('#e4f4ff', { roughness: 0.55 });
  const armor = mat('#4a3a70', { roughness: 0.45, metalness: 0.35 });
  const steel = M.silverMat();
  const leather = M.leatherMat('#c8a0d8');
  const team = mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  const lump = (p, m, x, y, z, a, b, c, seed = 1, detail = 2) => p.add(mesh(blob(a, b, c, { seed, amt: 0.06, detail }), m, x, y, z));

  // --- the nightsaber
  lump(body, fur, 0, 0.82, 0, 0.62, 0.27, 0.26, 11);
  lump(body, fur, 0.42, 0.88, 0, 0.32, 0.3, 0.28, 12);
  lump(body, fur, -0.45, 0.85, 0, 0.3, 0.28, 0.27, 13);
  lump(body, belly, 0.1, 0.66, 0, 0.45, 0.12, 0.2, 14, 1);
  // Pale stripes across the back.
  for (const x of [-0.3, -0.05, 0.2]) body.add(mesh(tube([[x, 0.9, 0.25], [x + 0.05, 1.08, 0], [x, 0.9, -0.25]], 0.035, 0.035, 6, 5), belly));
  const head = new THREE.Group();
  head.position.set(0.82, 1.02, 0);
  lump(head, fur, 0, 0, 0, 0.22, 0.17, 0.18, 15);
  lump(head, belly, 0.18, -0.06, 0, 0.12, 0.08, 0.11, 16, 1);
  head.add(mesh(knob(0.04), dark, 0.29, -0.03, 0));
  for (const s of [1, -1]) {
    const ear = mesh(M.scaled(M.G.cone, 0.06, 0.13, 0.04), fur, -0.06, 0.18, 0.11 * s);
    ear.rotation.x = 0.35 * s;
    head.add(ear);
    head.add(mesh(knob(0.035, 6), eye, 0.15, 0.05, 0.1 * s));
    // Sabre fangs.
    head.add(mesh(tube([[0.2, -0.1, 0.05 * s], [0.22, -0.2, 0.05 * s]], 0.022, 0.002, 2, 5), M.boneMat()));
  }
  body.add(head);
  const tail = new THREE.Group();
  tail.position.set(-0.7, 0.92, 0);
  tail.add(mesh(tube([[0, 0, 0], [-0.3, 0.05, 0], [-0.55, -0.15, 0], [-0.7, 0.05, 0]], 0.07, 0.035, 8, 6), fur));
  body.add(tail);
  const legs = [];
  for (const [x, z, ph] of [[0.45, 0.17, 0], [0.45, -0.17, Math.PI], [-0.45, 0.17, Math.PI], [-0.45, -0.17, 0]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.78, z);
    hip.userData.phase = ph;
    const back = x < 0 ? -0.08 : 0.04;
    hip.add(mesh(tube([[0, 0.05, 0], [back, -0.35, 0], [0.02, -0.7, 0]], 0.13, 0.07, 6, 7), fur));
    lump(hip, fur, 0.07, -0.72, 0, 0.11, 0.06, 0.09, 17, 1);
    legs.push(hip);
    body.add(hip);
  }

  // --- saddle, team saddle-cloth hanging on both flanks
  lump(body, leather, -0.02, 1.1, 0, 0.3, 0.07, 0.24, 18, 1);
  for (const s of [1, -1]) {
    const c = mesh(cloth(0.5, 0.36, 0.02), team, -0.02, 0.98, 0.25 * s);
    c.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    body.add(c);
  }

  // --- the rider
  const rider = new THREE.Group();
  rider.position.set(-0.02, 1.12, 0);
  body.add(rider);
  for (const s of [1, -1]) rider.add(mesh(tube([[0, 0.05, 0.1 * s], [0.18, -0.05, 0.27 * s], [0.12, -0.38, 0.29 * s], [0.2, -0.45, 0.27 * s]], 0.075, 0.05, 6, 7), skin));
  rider.add(mesh(M.lathe([[0.13, 0], [0.16, 0.12], [0.13, 0.3], [0.17, 0.45], [0.19, 0.55], [0.1, 0.62], [0.05, 0.64]], 10), armor));
  // Team pauldrons and a cape read from the overhead camera.
  for (const s of [1, -1]) {
    const p = mesh(new THREE.SphereGeometry(0.11, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), team, 0, 0.56, 0.18 * s);
    p.rotation.x = 0.5 * s;
    rider.add(p);
  }
  rider.add(mesh(cloth(0.36, 0.55, 0.12, 0.15), team, -0.12, 0.38, 0));
  const hd = new THREE.Group();
  hd.position.set(0.02, 0.76, 0);
  rider.add(hd);
  lump(hd, skin, 0, 0, 0, 0.1, 0.12, 0.1, 19, 1);
  hd.add(mesh(new THREE.SphereGeometry(0.115, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), armor, -0.01, 0.02, 0));
  for (const s of [1, -1]) {
    hd.add(mesh(tube([[0, 0.02, 0.08 * s], [-0.05, 0.08, 0.2 * s], [-0.12, 0.16, 0.3 * s]], 0.025, 0.003, 4, 5), skin));
    hd.add(mesh(knob(0.018, 6), eye, 0.09, 0.01, 0.04 * s));
  }
  // Long pale hair streaming back.
  hd.add(mesh(tube([[0, 0.12, 0], [-0.15, 0.08, 0], [-0.28, -0.12, 0], [-0.32, -0.35, 0]], 0.07, 0.02, 8, 7), hair));
  // Left arm holds the reins; the right (staff) raises the glaive.
  rider.add(mesh(tube([[0.02, 0.52, 0.17], [0.15, 0.35, 0.2], [0.32, 0.25, 0.12]], 0.05, 0.04, 5, 6), skin));
  const arm = new THREE.Group();
  arm.position.set(0.02, 0.52, -0.18);
  arm.add(mesh(tube([[0, 0, 0], [0.12, -0.12, -0.08], [0.25, 0.05, -0.1]], 0.05, 0.04, 5, 6), skin));
  const gl = glaive(steel, leather);
  gl.position.set(0.28, 0.12, -0.1);
  gl.rotation.y = 0.3;
  arm.add(gl);
  rider.add(arm);
  g.userData = {
    body,
    staff: arm,
    anim: [...legs, tail, head],
    kind: 'hero',
    tick: creatureTick({
      body,
      legs,
      amp: 0.6,
      rate: 0.9,
      extra: (dt, v, b, moving, world) => {
        tail.rotation.y = Math.sin((world?.time || 0) * 2.2 + v.id) * 0.25;
        tail.rotation.z = moving ? 0.25 : 0;
        head.rotation.z = moving ? -0.08 : 0;
      },
    }),
  };
  return g;
}

registerSkin('huntress', huntress);
