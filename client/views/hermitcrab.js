// Troubled Waters' Hermit Crab (nhmc): a red crab hauling a spiral shell
// with team-coloured bands, one big claw (the staff) and a small one,
// eyestalks and three walking legs a side. Faces +X; about 1.1 tall.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin } from '../../engine/client/render/registry.js';
import { creatureTick, knob } from './walkgrid-art.js';

const { mesh, blob, tube, mat } = M;

function claw(shellMat, tipMat, s, k) {
  const g = new THREE.Group();
  g.add(mesh(tube([[0, 0, 0], [0.1 * k, -0.02, 0.06 * s * k], [0.2 * k, 0.02, 0.05 * s * k]], 0.05 * k, 0.045 * k, 4, 6), shellMat));
  g.add(mesh(blob(0.14 * k, 0.09 * k, 0.08 * k, { seed: 41, amt: 0.05, detail: 1 }), shellMat, 0.3 * k, 0.03, 0.05 * s * k));
  // Fixed finger and the movable one, both dark-tipped.
  g.add(mesh(tube([[0.4 * k, 0.04, 0.05 * s * k], [0.55 * k, 0.02, 0.04 * s * k]], 0.045 * k, 0.012 * k, 3, 5), tipMat));
  g.add(mesh(tube([[0.38 * k, 0.1, 0.05 * s * k], [0.52 * k, 0.12, 0.04 * s * k], [0.56 * k, 0.07, 0.04 * s * k]], 0.035 * k, 0.01 * k, 3, 5), tipMat));
  return g;
}

export function hermitCrab(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const red = mat('#e0582c', { roughness: 0.45 });
  const redDark = mat('#9a2c18', { roughness: 0.5 });
  const shellMat = M.triMat('tex_boulder.webp', '#e8d0a8', '#fff0d8', 1.4, { roughness: 0.5 });
  const shellIn = mat('#f8c8b0', { roughness: 0.4 });
  const dark = mat('#141414', { roughness: 0.25 });
  const team = mat(color, { roughness: 0.6 });

  // The shell: whorls winding up and back to the apex.
  const shell = new THREE.Group();
  shell.position.set(-0.18, 0.5, 0);
  shell.rotation.z = 0.35;
  body.add(shell);
  const whorls = [[0, 0, 0, 0.42], [-0.12, 0.28, 0.06, 0.29], [-0.18, 0.48, 0.02, 0.19], [-0.2, 0.62, -0.02, 0.11]];
  whorls.forEach(([x, y, z, r], i) => shell.add(mesh(blob(r, r * 0.85, r * 0.95, { seed: 43 + i, amt: 0.05, detail: i < 2 ? 2 : 1 }), shellMat, x, y, z)));
  // Team bands spiralling round the shell.
  for (const [r, y, w] of [[0.4, -0.06, 0.05], [0.4, 0.14, 0.04], [0.27, 0.32, 0.035]]) {
    const band = mesh(new THREE.TorusGeometry(r, w, 6, 20), team, y > 0.2 ? -0.12 : 0, y, 0);
    band.rotation.x = Math.PI / 2;
    band.rotation.y = 0.25;
    band.scale.set(1, 1, 0.9);
    shell.add(band);
  }
  shell.add(mesh(M.scaled(M.G.cone, 0.04, 0.12, 0.04), shellMat, -0.21, 0.74, -0.02));
  // The shell's mouth, where the crab comes out.
  const lip = mesh(new THREE.TorusGeometry(0.24, 0.05, 6, 16), shellIn, 0.3, -0.12, 0);
  lip.rotation.y = Math.PI / 2;
  shell.add(lip);

  // The crab's front: carapace, mouthparts, eyestalks.
  body.add(mesh(blob(0.22, 0.15, 0.24, { seed: 47, amt: 0.05, detail: 2 }), red, 0.2, 0.32, 0));
  body.add(mesh(blob(0.08, 0.06, 0.12, { seed: 48, amt: 0.05, detail: 1 }), redDark, 0.38, 0.27, 0));
  const eyes = new THREE.Group();
  eyes.position.set(0.32, 0.42, 0);
  for (const s of [1, -1]) {
    eyes.add(mesh(tube([[0, 0, 0.06 * s], [0.03, 0.15, 0.09 * s]], 0.022, 0.018, 3, 5), red));
    eyes.add(mesh(knob(0.04, 8), dark, 0.035, 0.17, 0.09 * s));
  }
  body.add(eyes);
  // Big claw on the right (the "staff"), small one on the left.
  const big = claw(red, redDark, -1, 1.3);
  big.position.set(0.3, 0.3, -0.2);
  body.add(big);
  const small = claw(red, redDark, 1, 0.8);
  small.position.set(0.32, 0.28, 0.18);
  body.add(small);
  // Three walking legs a side, arched out from under the shell.
  const legs = [];
  for (let i = 0; i < 3; i++) {
    for (const s of [1, -1]) {
      const hip = new THREE.Group();
      hip.position.set(0.18 - i * 0.12, 0.28, 0.15 * s);
      hip.userData.phase = (i % 2 ? Math.PI : 0) + (s > 0 ? 0 : Math.PI);
      hip.add(mesh(tube([[0, 0, 0], [0.04, 0.12, 0.22 * s], [0.08, -0.12, 0.38 * s], [0.1, -0.28, 0.42 * s]], 0.04, 0.012, 6, 5), i === 2 ? redDark : red));
      legs.push(hip);
      body.add(hip);
    }
  }
  g.userData = {
    body,
    staff: big,
    anim: [...legs, eyes, small, shell],
    kind: 'hero',
    tick: creatureTick({
      body,
      legs,
      amp: 0.45,
      rate: 1.5,
      extra: (dt, v, b, moving, world) => {
        const t = (world?.time || 0) + v.id;
        eyes.rotation.x = Math.sin(t * 1.7) * 0.15;
        small.rotation.y = Math.sin(t * 2.3) * 0.15;
        // The shell sways as it is hauled along.
        shell.rotation.x = moving ? Math.sin((v.walk || 0) * 1.5) * 0.08 : 0;
      },
    }),
  };
  return g;
}

registerSkin('hermitcrab', hermitCrab);
