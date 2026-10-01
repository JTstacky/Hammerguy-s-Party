// Quillboar Mile (#33): the Quillboar Hunters crouched in their side strips,
// the quills they throw, and the quills left quivering in the ground when
// they miss.

import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';
import { groundStrip } from './race-kit.js';

// A quill: a long bone spine banded near its dark point, with a tuft of
// bristle at the back. Points +X.
export function quill(len = 1.1) {
  const g = new THREE.Group();
  g.add(M.mesh(M.tube([[-len * 0.5, 0, 0], [0, 0, 0], [len * 0.5, 0, 0]], 0.035, 0.008, 6, 6), M.boneMat()));
  g.add(M.mesh(M.scaled(M.G.cone, 0.03, 0.16, 0.03).rotateZ(-Math.PI / 2), M.mat('#2a1a14'), len * 0.52, 0, 0));
  for (const x of [len * 0.1, len * 0.2]) g.add(M.mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.04, 8).rotateZ(Math.PI / 2), M.mat('#6a2a1a'), x, 0, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const b = M.mesh(M.scaled(M.G.cone, 0.02, 0.18, 0.02).rotateZ(Math.PI / 2), M.mat('#3a2418'), -len * 0.46, Math.cos(a) * 0.04, Math.sin(a) * 0.04);
    g.add(b);
  }
  return g;
}

// A Quillboar Hunter: a hunched boar-man in brown bristle, a long snout with
// up-curved tusks and red eyes, a crest of quills down his back, and a quill
// ready in his throwing hand. Faces +X.
export function quillboar() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const fur = M.furMat('#b07850');
  const hide = M.triMat('tex_hide.webp', '#8a5a3a', '#c89070', 1.4);
  const dark = M.mat('#2a1a14', { roughness: 0.6 });
  const lean = new THREE.Group();
  lean.rotation.z = -0.25;
  body.add(lean);
  // Legs: bent, bristly, on black hooves.
  for (const s of [1, -1]) {
    body.add(M.mesh(M.tube([[0, 0.72, 0.2 * s], [0.14, 0.45, 0.24 * s], [-0.04, 0.14, 0.22 * s]], 0.13, 0.08, 8, 10), hide));
    body.add(M.mesh(M.blob(0.11, 0.08, 0.09, { seed: 30 }), dark, 0.0, 0.07, 0.22 * s));
  }
  lean.add(M.mesh(M.blob(0.42, 0.44, 0.4, { seed: 31, amt: 0.08 }), fur, 0, 1.05, 0));
  lean.add(M.mesh(M.blob(0.3, 0.26, 0.32, { seed: 32 }), hide, 0.15, 0.9, 0));
  lean.add(M.mesh(new THREE.TorusGeometry(0.4, 0.035, 6, 20), M.leatherMat(), 0, 0.78, 0).rotateX(Math.PI / 2));
  const loin = M.mesh(M.cloth(0.3, 0.35, 0.03, 0.05), M.mat('#5a3a22', { side: THREE.DoubleSide }), 0.36, 0.62, 0);
  loin.rotation.y = Math.PI;
  lean.add(loin);
  // Head.
  const head = new THREE.Group();
  head.position.set(0.38, 1.45, 0);
  head.add(M.mesh(M.blob(0.22, 0.2, 0.2, { seed: 33 }), fur, 0, 0, 0));
  head.add(M.mesh(M.blob(0.24, 0.12, 0.13, { seed: 34 }), hide, 0.25, -0.06, 0));
  head.add(M.mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.05, 14).rotateZ(Math.PI / 2), M.mat('#c06a6a'), 0.48, -0.06, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.tube([[0.35, -0.12, 0.07 * s], [0.43, -0.05, 0.13 * s], [0.42, 0.1, 0.14 * s]], 0.03, 0.006, 8, 6), M.boneMat()));
    head.add(M.mesh(M.scaled(M.G.sphere, 0.03), M.glowMat('#ff4a2a'), 0.18, 0.07, 0.12 * s));
    const ear = M.mesh(M.blob(0.08, 0.04, 0.06, { seed: 35 }), hide, -0.05, 0.18, 0.15 * s);
    ear.rotation.x = 0.6 * s;
    head.add(ear);
  }
  lean.add(head);
  // The crest: rows of quills fanning back off the shoulders and spine.
  const bone = M.boneMat();
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const side = (i % 3) - 1;
    const x0 = 0.18 - t * 0.55;
    const y0 = 1.35 - t * 0.35;
    const len = 0.45 + Math.sin(t * Math.PI) * 0.25;
    lean.add(M.mesh(M.tube([[x0, y0, side * 0.12], [x0 - len * 0.5, y0 + len * 0.5, side * 0.28], [x0 - len, y0 + len * 0.7, side * 0.42]], 0.035, 0.005, 6, 6), bone));
  }
  // Arms: the left braced on the knee, the right cocked with a quill.
  lean.add(M.mesh(M.tube([[0.05, 1.25, -0.36], [0.3, 0.95, -0.4], [0.45, 0.8, -0.3]], 0.09, 0.07, 8, 8), hide));
  const arm = new THREE.Group();
  arm.position.set(0.02, 1.28, 0.36);
  arm.add(M.mesh(M.tube([[0, 0, 0], [-0.12, 0.25, 0.08], [-0.05, 0.55, 0.06]], 0.09, 0.07, 8, 8), hide));
  const held = quill(0.95);
  held.position.set(-0.05, 0.6, 0.06);
  held.rotation.z = 0.5;
  arm.add(held);
  lean.add(arm);
  g.userData = { body, lean, arm, held, head };
  return g;
}

registerView('quillboar', {
  make(e, world, v) {
    const g = quillboar();
    g.userData.body.scale.setScalar(1.3);
    v.parts = g.userData;
    v.t = Math.random() * 5;
    return g;
  },
  update(v, a, b, k, dt) {
    const P = v.parts;
    v.t += dt;
    // Wind-up: the throwing arm draws back over the 0.6 s damage point, then snaps forward.
    if (b.w != null) {
      v.cock = b.w;
      v.snap = 0;
    } else if (v.cock != null) {
      v.cock = null;
      v.snap = 0.35;
    }
    if (v.snap > 0) v.snap -= dt;
    const back = v.cock != null ? v.cock : 0;
    const fwd = v.snap > 0 ? v.snap / 0.35 : 0;
    P.arm.rotation.z = 0.9 * back - 1.6 * fwd;
    P.held.visible = !(v.snap > 0.15);
    P.lean.rotation.z = -0.25 - back * 0.15 + fwd * 0.25;
    P.head.rotation.y = Math.sin(v.t * 0.9) * 0.15;
    P.body.position.y = Math.sin(v.t * 2.2) * 0.015;
  },
});

registerView('quill', {
  make(e, world, v) {
    const g = new THREE.Group();
    const q = quill(1.1);
    g.add(q);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false }));
    world.entGroup.add(shadow);
    v.parts = { q, shadow };
    return g;
  },
  update(v, a, b, k) {
    const p = Math.min(1, (a.p ?? 0) + ((b.p ?? 0) - (a.p ?? 0)) * k);
    const y = 1.4 * (1 - p) + 0.55 * p + Math.sin(p * Math.PI) * 0.9;
    v.obj.position.y = y;
    // Pitch along the arc: up on the way out, down on the way in.
    v.parts.q.rotation.z = Math.cos(p * Math.PI) * 0.45 - 0.1;
    const s = v.parts.shadow;
    s.position.set(v.x, 0.04, v.z);
    s.rotation.y = -(b.f ?? 0);
  },
  remove(v, world) {
    world.entGroup.remove(v.parts.shadow);
  },
});

// A quill that missed stays quivering in the dirt for a few seconds.
registerEvent('quillmiss', (e, world) => {
  const q = quill(1.1);
  q.rotation.y = -(e.f ?? 0);
  q.rotation.z = -0.6;
  q.position.set(e.x - Math.cos(e.f ?? 0) * 0.25, 0.25, e.y - Math.sin(e.f ?? 0) * 0.25);
  world.scene.add(q);
  world.fx.dustCloud(e.x, e.y, 0.3, '#9a8266', 4);
  world.fx.transients.push({
    obj: q,
    t: 0,
    dur: 3,
    update: (k) => {
      q.rotation.x = Math.sin(k * 90) * 0.12 * Math.max(0, 1 - k * 6);
      q.position.y = 0.25 - Math.max(0, k - 0.8) * 2;
    },
  });
});

registerMapBuilder('quillboar', (map, world) => {
  const Q = map.qb;
  const G = world.mapGroup;
  const [ya, yb] = Q.sy;
  // The hunters' strips: trampled dirt behind the hedges.
  for (const [x0, x1] of Q.strips) G.add(groundStrip(x0 - 0.3, Math.min(ya, yb) - 0.6, x1 + 0.3, Math.max(ya, yb) + 0.6, { tint: '#b09878', opacity: 0.75 }));
  // A worn path up the corridor.
  G.add(groundStrip(-2.2, Q.finish[1] - 1, 2.2, 18.5, { tint: '#c8b494', opacity: 0.5, units: 6 }));
  // A few bones and skulls from pigs that didn't make it.
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (5 + Math.random() * 2.5);
    const z = ya + Math.random() * (yb - ya);
    const b = M.mesh(M.blob(0.12, 0.08, 0.1, { seed: 70 + i }), M.boneMat(), x, 0.05, z);
    G.add(b);
    G.add(M.mesh(M.tube([[x - 0.25, 0.04, z + 0.2], [x, 0.06, z + 0.25], [x + 0.25, 0.04, z + 0.22]], 0.03, 0.03, 4, 5), M.boneMat()));
  }
});
