// The Murloc Tiderunner (`nmrl`): the player unit of Roadkill Challenge. A
// hunched green fishman with a huge head and gaping mouth, bulging yellow
// eyes, an orange fin crest, a pale belly, stubby legs on webbed feet and
// long webbed hands. Team colour on the loincloth, the headband and the
// shell necklace's cord.

import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin } from '../../engine/client/render/registry.js';

const { mesh, blob, tube, lathe, cloth, mat, G, scaled } = M;

export function murloc(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(1.35);
  g.add(body);
  const skin = M.triMat('tex_hide.webp', '#4f9a6a', '#bff0c8', 2.2, { roughness: 0.55 });
  const belly = mat('#d8e6b0', { roughness: 0.6 });
  const fin = mat('#f08a3a', { roughness: 0.55, side: THREE.DoubleSide });
  const finDark = mat('#c0502a', { roughness: 0.6 });
  const team = mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  const eyeW = mat('#ffe070', { roughness: 0.3, emissive: '#3a2a00' });
  const pupil = mat('#101010', { roughness: 0.2 });
  const mouth = mat('#5a1420', { roughness: 0.6 });
  const tooth = M.boneMat();
  const d2 = { detail: 2 };

  // Stubby legs on broad webbed feet.
  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(-0.05, 0.42, 0.15 * s);
    hip.add(mesh(tube([[0, 0, 0], [0.06, -0.2, 0.02 * s], [0.02, -0.36, 0.02 * s]], 0.1, 0.07, 5, 8), skin));
    hip.add(mesh(blob(0.16, 0.04, 0.1, { seed: 20 + s, amt: 0.1, detail: 2 }), skin, 0.1, -0.4, 0.02 * s));
    for (const t of [-1, 0, 1]) hip.add(mesh(scaled(G.cone, 0.02, 0.07, 0.02).rotateZ(-Math.PI / 2), finDark, 0.25, -0.41, 0.02 * s + t * 0.05));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);

  // A pear-shaped body leaning forward, the belly pale.
  const torso = mesh(blob(0.3, 0.36, 0.28, { seed: 3, amt: 0.06, ...d2 }), skin, 0.0, 0.72, 0);
  torso.rotation.z = -0.3;
  const tum = mesh(blob(0.2, 0.26, 0.22, { seed: 4, amt: 0.04, ...d2 }), belly, 0.12, 0.66, 0);
  // Loincloth and a cord of shells round the neck.
  const loin = mesh(lathe([[0.2, 0.52], [0.24, 0.44], [0.27, 0.32]], 16), team);
  loin.scale.z = 1.1;
  const flap = mesh(cloth(0.18, 0.26, 0.02, -0.02), team, 0.25, 0.38, 0);
  flap.rotation.y = Math.PI;
  const cord = mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 20).rotateX(Math.PI / 2), team, 0.12, 0.98, 0);
  cord.rotation.z = -0.35;
  const shells = [];
  for (let i = -2; i <= 2; i++) shells.push(mesh(blob(0.035, 0.03, 0.025, { seed: 30 + i, detail: 1 }), mat('#f0e0c8'), 0.3, 0.92 - Math.abs(i) * 0.02, i * 0.07));

  // The head: most of the murloc. A wide dome, a huge mouth, bulging eyes on top.
  const head = new THREE.Group();
  head.position.set(0.24, 1.08, 0);
  head.add(mesh(blob(0.3, 0.26, 0.3, { seed: 5, amt: 0.05, ...d2 }), skin, 0, 0.05, 0));
  head.add(mesh(blob(0.24, 0.1, 0.26, { seed: 6, amt: 0.04, ...d2 }), belly, 0.08, -0.14, 0)); // lower jaw
  const gape = mesh(scaled(G.sphere, 0.2, 0.06, 0.22), mouth, 0.14, -0.06, 0);
  head.add(gape);
  for (let i = 0; i < 6; i++) {
    const z = -0.15 + i * 0.06;
    head.add(mesh(scaled(G.cone, 0.018, 0.06, 0.018).rotateZ(Math.PI), tooth, 0.28 - Math.abs(z) * 0.4, -0.02, z));
  }
  for (const s of [1, -1]) {
    head.add(mesh(scaled(G.sphere, 0.085), eyeW, 0.14, 0.2, 0.13 * s));
    head.add(mesh(scaled(G.sphere, 0.04), pupil, 0.21, 0.21, 0.14 * s));
    // Gill fins at the sides of the head.
    const gill = mesh(cloth(0.18, 0.16, 0.04, 0.04), fin, -0.04, 0.02, 0.27 * s);
    gill.rotation.set(0.9 * s, 0, 0.3);
    head.add(gill);
  }
  // The crest: a tall fin down the back of the head, on bony rays.
  const crest = mesh(cloth(0.36, 0.3, 0.0, 0.12), fin, -0.08, 0.34, 0);
  crest.rotation.y = Math.PI / 2;
  head.add(crest);
  for (let i = 0; i < 4; i++) head.add(mesh(tube([[0.08 - i * 0.1, 0.2, 0], [0.04 - i * 0.12, 0.4, 0], [-0.02 - i * 0.14, 0.5 - i * 0.03, 0]], 0.018, 0.006, 5, 5), finDark));
  const band = mesh(new THREE.TorusGeometry(0.27, 0.03, 6, 22).rotateX(Math.PI / 2), team, -0.02, 0.12, 0);
  band.rotation.z = 0.25;
  head.add(band);

  // Long arms with webbed claws; the right one is what a cast raises.
  const arm = (s) => {
    const a = new THREE.Group();
    a.position.set(0.05, 0.9, 0.3 * s);
    a.add(mesh(tube([[0, 0, 0], [0.12, -0.22, 0.08 * s], [0.26, -0.36, 0.06 * s]], 0.07, 0.055, 6, 8), skin));
    a.add(mesh(blob(0.08, 0.04, 0.08, { seed: 40, detail: 1 }), skin, 0.3, -0.38, 0.06 * s));
    for (const t of [-1, 0, 1]) a.add(mesh(scaled(G.cone, 0.018, 0.08, 0.018).rotateZ(-Math.PI / 2), finDark, 0.38, -0.38, 0.06 * s + t * 0.04));
    // A fin on the forearm.
    const f = mesh(cloth(0.14, 0.12, 0.02, 0.05), fin, 0.1, -0.12, 0.13 * s);
    f.rotation.x = 1.2 * s;
    a.add(f);
    return a;
  };
  const armL = arm(1);
  const armR = arm(-1);
  // A little fin tail.
  const tail = mesh(cloth(0.16, 0.14, 0.02, 0.1), fin, -0.3, 0.52, 0);
  tail.rotation.y = Math.PI / 2;

  body.add(legL, legR, torso, tum, loin, flap, cord, ...shells, head, armL, armR, tail);
  g.userData = { body, staff: armR, legL, legR, kind: 'hero' };
  return g;
}

registerSkin('murloc', (color) => murloc(color));
