// Blinky the Bear (#27): the polar bears ("Envious Earls") that patrol the
// lanes, and the Blink effect. The cliffs between the lanes come from the
// 'upmaze' builder.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerEvent, registerSkin } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { bakeModel, creatureTick } from './walkgrid-art.js';

// A polar bear on all fours: a heavy shaggy body with a shoulder hump, a long
// head with a black nose, small round ears, and thick legs with dark claws.
// Faces +X.
// The fur texture is brown, so the polar bears are plain white; Blinky wears it.
export function polarBear(fur = M.mat('#f6f4ee', { roughness: 0.9 }), furShade = M.mat('#d4d0c8', { roughness: 0.9 })) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const dark = M.mat('#161412', { roughness: 0.35 });
  body.add(M.mesh(M.blob(0.95, 0.55, 0.55, { seed: 61, amt: 0.08, detail: 2 }), fur, -0.1, 0.95, 0));
  body.add(M.mesh(M.blob(0.5, 0.45, 0.5, { seed: 62, amt: 0.1, detail: 2 }), fur, 0.45, 1.12, 0));
  body.add(M.mesh(M.blob(0.55, 0.42, 0.5, { seed: 63, amt: 0.08, detail: 2 }), furShade, -0.7, 0.92, 0));
  const head = new THREE.Group();
  head.position.set(1.0, 1.05, 0);
  head.add(M.mesh(M.blob(0.3, 0.26, 0.26, { seed: 64, detail: 2 }), fur, 0, 0, 0));
  head.add(M.mesh(M.blob(0.26, 0.15, 0.15, { seed: 65, detail: 2 }), fur, 0.28, -0.07, 0));
  head.add(M.mesh(M.scaled(M.G.sphere, 0.07, 0.055, 0.075), dark, 0.53, -0.04, 0));
  head.add(M.mesh(M.scaled(M.G.sphere, 0.1, 0.03, 0.08), M.mat('#3a1818', { roughness: 0.4 }), 0.4, -0.17, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.scaled(M.G.sphere, 0.035), dark, 0.2, 0.08, 0.14 * s));
    head.add(M.mesh(M.blob(0.07, 0.08, 0.05, { seed: 66, detail: 2 }), furShade, -0.08, 0.24, 0.17 * s));
  }
  body.add(head);
  const legs = [];
  for (const [x, z] of [[0.55, 0.3], [0.55, -0.3], [-0.65, 0.3], [-0.65, -0.3]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.85, z);
    hip.add(M.mesh(M.tube([[0, 0.1, 0], [0.04, -0.35, 0], [0.02, -0.75, 0]], 0.2, 0.15, 6, 10), fur));
    const paw = M.mesh(M.blob(0.17, 0.08, 0.15, { seed: 67, detail: 2 }), furShade, 0.07, -0.78, 0);
    hip.add(paw);
    for (let i = -1; i <= 1; i++) hip.add(M.mesh(M.scaled(M.G.cone, 0.02, 0.07, 0.02).rotateZ(-Math.PI / 2), dark, 0.25, -0.82, i * 0.06));
    hip.userData.phase = legs.length === 0 || legs.length === 3 ? 0 : Math.PI;
    legs.push(hip);
    body.add(hip);
  }
  body.add(M.mesh(M.blob(0.1, 0.09, 0.1, { seed: 68, detail: 2 }), fur, -1.05, 1.05, 0));
  body.scale.setScalar(1.0);
  g.userData = { body, head, legs };
  return g;
}

registerView('polarbear', {
  make(e, world, v) {
    const g = bakeModel(polarBear());
    v.parts = g.userData;
    return g;
  },
  update(v, a, b, k, dt) {
    const P = v.parts;
    const moving = !!b.mv;
    v.walk = (v.walk || 0) + dt * (moving ? 10 : 0);
    P.body.position.y = moving ? Math.abs(Math.sin(v.walk)) * 0.06 : 0;
    P.legs.forEach((l, i) => (l.rotation.z = moving ? Math.sin(v.walk + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.5 : 0));
    // The swipe: rear up a little and lunge with the head and a forepaw.
    if (v.castT > 0) v.castT -= dt;
    v.raise = Math.max(0, Math.min(1, (v.raise || 0) + dt * (b.sw ? 4 : -4)));
    const lunge = v.castT > 0 ? Math.sin((v.castT / 0.3) * Math.PI) : 0;
    P.body.rotation.z = v.raise * 0.25 - lunge * 0.2;
    P.head.position.x = 1.0 + lunge * 0.2;
    P.legs[0].rotation.z += -v.raise * 1.0 + lunge * 1.4;
  },
});

// WC3's Blink: a violet burst where you vanish and where you appear.
registerEvent('blink', (e, world) => {
  for (const [x, z, n] of [[e.x1, e.y1, 26], [e.x2, e.y2, 34]]) {
    world.fx.burst(x, 1, z, '#b890ff', { n, speed: 3.5, size: 0.55, life: 0.5 });
    world.fx.glow(x, 1, z, '#9a6aff', 2.2, 0.35);
    world.fx.ring(x, z, 1.1, '#c8a8ff', 0.35);
  }
  play('teleport');
});

// Blinky himself (ngzc): a brown grizzly of the polar bears' build, in a
// team-coloured collar and saddle blanket. The four legs swing from tick.
export function grizzly(color) {
  const g = polarBear(M.furMat('#f0b878'), M.furMat('#c08850'));
  const { body, head, legs } = g.userData;
  const team = M.mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  const collar = M.mesh(new THREE.TorusGeometry(0.3, 0.07, 6, 16), team, 0.78, 1.05, 0);
  collar.rotation.y = Math.PI / 2;
  collar.rotation.x = 0.2;
  collar.scale.set(1, 1.1, 1);
  body.add(collar);
  body.add(M.mesh(M.scaled(M.G.sphere, 0.07, 0.07, 0.04), M.goldMat(), 0.95, 0.82, 0));
  // A team blanket draped over the hump reads from the RTS camera.
  for (const s of [1, -1]) {
    const c = M.mesh(M.cloth(0.7, 0.42, 0.04), team, -0.05, 1.18, 0.3 * s);
    c.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    c.rotation.x = -0.45 * s;
    body.add(c);
  }
  body.add(M.mesh(M.blob(0.42, 0.06, 0.36, { seed: 70, amt: 0.03, detail: 1 }), team, -0.05, 1.47, 0));
  g.userData = {
    body,
    anim: [...legs, head],
    kind: 'hero',
    tick: creatureTick({ body, legs, amp: 0.5, rate: 0.85, extra: (dt, v, b, moving) => (head.rotation.z = moving ? Math.sin(v.walk * 0.85) * 0.06 : 0) }),
  };
  return g;
}

registerSkin('grizzly', grizzly);
