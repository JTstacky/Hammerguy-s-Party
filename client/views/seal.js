// The Seal (`nsea`): the player unit of Stop and Go. A plump grey seal lying
// on its belly, head raised: dark wet eyes, a whiskered muzzle, fore flippers
// it humps along on and a forked tail fan. Team colour on a collar with a
// brass tag, so a crowd of seals can be told apart.

import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin } from '../../engine/client/render/registry.js';

const { mesh, blob, tube, mat, G, scaled } = M;

export function seal(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(1.3);
  g.add(body);
  const hide = M.triMat('tex_hide.webp', '#7e8794', '#bcc4ce', 3, { roughness: 0.4 });
  const belly = mat('#d8d4c8', { roughness: 0.5 });
  const dark = mat('#4a4f58', { roughness: 0.45 });
  const eye = mat('#0a0a0c', { roughness: 0.08, metalness: 0.2 });
  const shine = mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 });
  const team = mat(color, { roughness: 0.6 });
  const brass = M.goldMat();
  const whisker = mat('#f4f0e6', { roughness: 0.6 });

  // The long body lies on the ground and rises toward the chest.
  const trunk = mesh(blob(0.5, 0.2, 0.26, { seed: 7, amt: 0.04, detail: 3 }), hide, -0.08, 0.2, 0);
  trunk.rotation.z = 0.12;
  const chest = mesh(blob(0.24, 0.24, 0.22, { seed: 8, amt: 0.04, detail: 2 }), hide, 0.26, 0.3, 0);
  const under = mesh(blob(0.42, 0.1, 0.2, { seed: 9, amt: 0.03, detail: 2 }), belly, 0.02, 0.1, 0);
  // Darker dapples along the back.
  const spots = [[-0.3, 0.36, 0.08, 0.06], [-0.05, 0.38, -0.1, 0.05], [0.15, 0.44, 0.06, 0.045], [-0.45, 0.3, -0.06, 0.05]].map(([x, y, z, r]) => mesh(blob(r, r * 0.35, r, { seed: 11, detail: 1 }), dark, x, y, z));

  // The head (the part a cast lifts).
  const head = new THREE.Group();
  head.position.set(0.4, 0.48, 0);
  head.add(mesh(blob(0.15, 0.14, 0.14, { seed: 12, amt: 0.03, detail: 2 }), hide, 0, 0, 0));
  head.add(mesh(blob(0.09, 0.07, 0.09, { seed: 13, amt: 0.03, detail: 2 }), belly, 0.13, -0.04, 0)); // muzzle
  head.add(mesh(scaled(G.sphere, 0.03, 0.022, 0.035), eye, 0.215, -0.01, 0)); // nose
  for (const s of [1, -1]) {
    head.add(mesh(scaled(G.sphere, 0.042), eye, 0.1, 0.05, 0.08 * s));
    head.add(mesh(scaled(G.sphere, 0.012), shine, 0.135, 0.07, 0.085 * s));
    for (const k of [-1, 0, 1]) head.add(mesh(tube([[0.17, -0.04, 0.05 * s], [0.2, -0.04 + k * 0.02, 0.13 * s], [0.2, -0.06 + k * 0.035, 0.2 * s]], 0.005, 0.002, 4, 3), whisker));
  }
  // Collar and tag.
  const collar = mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 22), team, 0.3, 0.38, 0);
  collar.rotation.y = Math.PI / 2;
  collar.rotation.x = 0;
  collar.rotation.z = 0.5;
  const tag = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.015, 12).rotateZ(Math.PI / 2), brass, 0.42, 0.24, 0);

  // Fore flippers, swung by the walk cycle.
  const flipper = (s) => {
    const f = new THREE.Group();
    f.position.set(0.24, 0.2, 0.18 * s);
    const p = mesh(blob(0.14, 0.03, 0.07, { seed: 14, amt: 0.05, detail: 2 }), hide, 0.04, -0.12, 0.06 * s);
    p.rotation.set(0.5 * s, 0.4 * s, -0.3);
    f.add(p);
    return f;
  };
  const legL = flipper(1);
  const legR = flipper(-1);
  // Tail fan: two hind flippers, wagged by tick() while it moves.
  const tail = new THREE.Group();
  tail.position.set(-0.55, 0.14, 0);
  for (const s of [1, -1]) {
    const p = mesh(blob(0.13, 0.025, 0.07, { seed: 15, amt: 0.05, detail: 2 }), dark, -0.1, -0.03, 0.06 * s);
    p.rotation.y = 0.45 * s;
    tail.add(p);
  }

  body.add(trunk, chest, under, ...spots, head, collar, tag, legL, legR, tail);
  g.userData = {
    body, legL, legR, anim: [head, tail], kind: 'hero',
    tick(dt, v, b, w) {
      const mv = b.mv && !b.dead;
      const t = w?.time ?? performance.now() / 1000;
      tail.rotation.y = mv ? Math.sin(v.walk ?? 0) * 0.4 : Math.sin(t * 1.7) * 0.08;
      head.rotation.z = (v.raise || 0) * 0.5 + (mv ? 0 : Math.sin(t * 0.9) * 0.05);
    },
  };
  return g;
}

registerSkin('seal', (color) => seal(color));
