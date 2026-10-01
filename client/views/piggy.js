// The Piggy (`npig`): the player unit of Quillboar Mile. A round pink pig on
// four trotters: a big snout, floppy ears, a curly tail. Team colour on a
// ribbon round its neck, tied in a bow.

import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin } from '../../engine/client/render/registry.js';

const { mesh, blob, tube, mat, G, scaled } = M;

export function piggy(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(1.25);
  g.add(body);
  const pink = mat('#f2a8a8', { roughness: 0.55 });
  const pinkDark = mat('#d87c84', { roughness: 0.6 });
  const hoof = mat('#4a3228', { roughness: 0.5 });
  const eye = mat('#140c0a', { roughness: 0.15 });
  const team = mat(color, { roughness: 0.6, side: THREE.DoubleSide });

  // Trotters: fore legs are legL/legR, hind legs follow them in tick().
  const leg = (x, s) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.3, 0.13 * s);
    hip.add(mesh(tube([[0, 0.02, 0], [0.01, -0.12, 0], [0, -0.24, 0]], 0.06, 0.045, 4, 8), pink));
    hip.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.06, 10), hoof, 0, -0.27, 0));
    return hip;
  };
  const legL = leg(0.22, 1);
  const legR = leg(0.22, -1);
  const hindL = leg(-0.24, 1);
  const hindR = leg(-0.24, -1);

  // A round barrel body and a heavy head.
  const barrel = mesh(blob(0.42, 0.26, 0.27, { seed: 21, amt: 0.03 }), pink, -0.02, 0.44, 0);
  const rump = mesh(blob(0.22, 0.22, 0.24, { seed: 22, amt: 0.03, detail: 2 }), pink, -0.26, 0.44, 0);
  const head = new THREE.Group();
  head.position.set(0.4, 0.52, 0);
  head.add(mesh(blob(0.19, 0.18, 0.18, { seed: 23, amt: 0.03, detail: 2 }), pink, 0, 0, 0));
  const snout = mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.12, 16).rotateZ(Math.PI / 2), pink, 0.2, -0.04, 0);
  const disc = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 16).rotateZ(Math.PI / 2), pinkDark, 0.265, -0.04, 0);
  head.add(snout, disc);
  for (const s of [1, -1]) {
    head.add(mesh(scaled(G.sphere, 0.018, 0.028, 0.018), eye, 0.278, -0.04, 0.032 * s)); // nostril
    head.add(mesh(scaled(G.sphere, 0.03), eye, 0.14, 0.07, 0.09 * s));
    const ear = mesh(blob(0.09, 0.02, 0.07, { seed: 24, amt: 0.05, detail: 1 }), pinkDark, 0.02, 0.17, 0.11 * s);
    ear.rotation.set(-0.7 * s, 0, -0.6);
    head.add(ear);
  }
  // Team ribbon round the neck with a bow on top.
  const ribbon = mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 22), team, 0.24, 0.5, 0);
  ribbon.rotation.y = Math.PI / 2;
  ribbon.rotation.x = 0.25;
  ribbon.scale.set(1, 1.1, 1);
  const bow = new THREE.Group();
  bow.position.set(0.21, 0.72, 0);
  for (const s of [1, -1]) {
    const loop = mesh(blob(0.07, 0.04, 0.035, { seed: 25, detail: 1 }), team, 0, 0, 0.07 * s);
    loop.rotation.x = 0.4 * s;
    bow.add(loop);
  }
  bow.add(mesh(scaled(G.sphere, 0.03), team));
  // Curly tail.
  const tail = mesh(tube([[-0.46, 0.5, 0], [-0.54, 0.56, 0.03], [-0.52, 0.64, -0.03], [-0.47, 0.6, 0.02], [-0.5, 0.56, 0.05]], 0.022, 0.012, 14, 6), pinkDark);

  body.add(legL, legR, hindL, hindR, barrel, rump, head, ribbon, bow, tail);
  g.userData = {
    body, legL, legR, anim: [hindL, hindR, head], kind: 'hero',
    tick(dt, v, b) {
      // Diagonal pairs: the hind legs mirror the opposite fore leg.
      hindL.rotation.z = legR.rotation.z;
      hindR.rotation.z = legL.rotation.z;
      head.rotation.z = b.mv && !b.dead ? Math.sin((v.walk ?? 0) * 2) * 0.05 : 0;
    },
  };
  return g;
}

registerSkin('piggy', (color) => piggy(color));
