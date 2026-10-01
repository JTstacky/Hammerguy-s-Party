// Minotaur Maze's Skink (nskk): a quick little lizard with splayed legs, a
// long whipping tail and a team-coloured spiny crest down its back. Bright
// scales so it reads among the maze walls. Faces +X; about 1.4 long.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin } from '../../engine/client/render/registry.js';
import { creatureTick, knob } from './walkgrid-art.js';

const { mesh, blob, tube, mat } = M;

export function skink(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const scales = M.triMat('tex_hide.webp', '#d08a34', '#ffc070', 2.2, { roughness: 0.55 });
  const belly = mat('#fff0c0', { roughness: 0.6 });
  const dark = mat('#1a1a12', { roughness: 0.3 });
  const eye = mat('#ffe060', { emissive: '#7a5a00', emissiveIntensity: 0.6, roughness: 0.3 });
  const claw = M.boneMat();
  const team = mat(color, { roughness: 0.7, side: THREE.DoubleSide });
  body.add(mesh(blob(0.42, 0.17, 0.2, { seed: 31, amt: 0.05, detail: 2 }), scales, 0, 0.36, 0));
  body.add(mesh(blob(0.36, 0.08, 0.15, { seed: 32, amt: 0.04, detail: 1 }), belly, 0.02, 0.27, 0));
  const head = new THREE.Group();
  head.position.set(0.42, 0.42, 0);
  head.add(mesh(blob(0.17, 0.11, 0.13, { seed: 33, amt: 0.05, detail: 2 }), scales, 0.06, 0, 0));
  head.add(mesh(blob(0.12, 0.05, 0.1, { seed: 34, amt: 0.04, detail: 1 }), belly, 0.1, -0.06, 0));
  for (const s of [1, -1]) {
    head.add(mesh(knob(0.04, 8), eye, 0.1, 0.06, 0.08 * s));
    head.add(mesh(knob(0.02, 6), dark, 0.135, 0.065, 0.1 * s));
    // Frilled cheek spines in team colour.
    head.add(mesh(tube([[-0.04, 0.02, 0.1 * s], [-0.12, 0.08, 0.2 * s]], 0.035, 0.003, 2, 5), team));
  }
  body.add(head);
  // Tail: two jointed sections so it can whip side to side.
  const tail = new THREE.Group();
  tail.position.set(-0.38, 0.37, 0);
  tail.add(mesh(tube([[0, 0, 0], [-0.25, -0.04, 0], [-0.45, -0.12, 0]], 0.13, 0.07, 6, 7), scales));
  const tip = new THREE.Group();
  tip.position.set(-0.45, -0.12, 0);
  tip.add(mesh(tube([[0, 0, 0], [-0.25, -0.08, 0], [-0.45, -0.1, 0]], 0.07, 0.01, 6, 6), scales));
  tail.add(tip);
  body.add(tail);
  // The crest: a row of spines along the spine and onto the tail.
  for (let i = 0; i < 6; i++) {
    const x = 0.3 - i * 0.13;
    const h = 0.17 - Math.abs(i - 2) * 0.025;
    const sp = mesh(M.scaled(M.G.cone, 0.05, h, 0.03), team, x, 0.5 + h * 0.4 - (i > 3 ? 0.02 : 0), 0);
    sp.rotation.z = 0.35;
    body.add(sp);
  }
  for (let i = 0; i < 2; i++) {
    const sp = mesh(M.scaled(M.G.cone, 0.04, 0.1, 0.025), team, -0.12 - i * 0.18, 0.11 - i * 0.04, 0);
    sp.rotation.z = 0.4;
    tail.add(sp);
  }
  // Splayed legs: thigh out to the side, shin down to a clawed foot.
  const legs = [];
  for (const [x, s, ph] of [[0.24, 1, 0], [0.24, -1, Math.PI], [-0.24, 1, Math.PI], [-0.24, -1, 0]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.33, 0.14 * s);
    hip.userData.phase = ph;
    hip.add(mesh(tube([[0, 0, 0], [0.02, 0.02, 0.18 * s], [0.06, -0.26, 0.24 * s]], 0.07, 0.04, 6, 6), scales));
    for (let k = -1; k <= 1; k++) hip.add(mesh(tube([[0.06, -0.3, 0.24 * s], [0.15, -0.32, (0.24 + k * 0.05) * s]], 0.022, 0.006, 2, 4), claw));
    legs.push(hip);
    body.add(hip);
  }
  g.userData = {
    body,
    anim: [...legs, tail, tip, head],
    kind: 'hero',
    tick: creatureTick({
      body,
      legs,
      amp: 0.7,
      rate: 1.3,
      extra: (dt, v, b, moving, world) => {
        // A lizard's S-wiggle when running, a lazy sway when not.
        const w = moving ? (v.walk || 0) * 1.3 : (world?.time || 0) * 1.5 + v.id;
        const a = moving ? 0.35 : 0.12;
        tail.rotation.y = Math.sin(w) * a;
        tip.rotation.y = Math.sin(w - 1) * a * 1.2;
        head.rotation.y = -Math.sin(w) * a * 0.4;
      },
    }),
  };
  return g;
}

registerSkin('skink', skink);
