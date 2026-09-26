// Built-in views and events every game can use (registered through
// registry.js, so games can add more the same way):
//  - 'missile': an attack missile from Minigame.attack (m: 'arrow' | 'axe' |
//    'bolt' | 'rock' | 'fire'), flying toward its target.
//  - events 'swing' (a hero's attack wind-up) and 'hit' (an attack landing).

import * as THREE from 'three';
import * as M from './models.js';
import { registerView, registerEvent } from './registry.js';
import { play } from '../audio.js';

function arrow() {
  const g = new THREE.Group();
  g.add(M.mesh(M.tube([[-0.45, 0, 0], [0, 0, 0], [0.4, 0, 0]], 0.02, 0.02, 2, 6), M.mat('#6b4a2a')));
  g.add(M.mesh(M.scaled(M.G.cone, 0.05, 0.14, 0.05).rotateZ(-Math.PI / 2), M.mat('#c8ccd4', { metalness: 0.7, roughness: 0.3 }), 0.45, 0, 0));
  for (const s of [1, -1]) {
    const fl = M.mesh(M.scaled(M.G.box, 0.14, 0.01, 0.06), M.mat('#e8e0d0'), -0.38, 0, 0.03 * s);
    g.add(fl);
  }
  return g;
}

const MISSILES = {
  arrow,
  axe: () => {
    const g = new THREE.Group();
    g.add(M.mesh(M.tube([[0, -0.25, 0], [0, 0.2, 0]], 0.025, 0.025, 2, 6), M.mat('#4a3020')));
    g.add(M.mesh(M.axeBlade(0.25, 0.3), M.mat('#9aa0a8', { metalness: 0.7, roughness: 0.35 }), 0, 0.12, 0));
    g.userData.spin = true;
    return g;
  },
  bolt: (c = '#9fe0ff') => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), M.glowMat(c)));
    return g;
  },
  rock: () => {
    const g = new THREE.Group();
    g.add(M.mesh(M.blob(0.22, 0.2, 0.2, { seed: 3 }), M.boulderMat()));
    return g;
  },
  fire: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), M.glowMat('#ffb040')));
    g.userData.flame = true;
    return g;
  },
};

registerView('missile', {
  make(e, world, v) {
    const obj = (MISSILES[e.m] || arrow)();
    obj.position.y = 1;
    v.parts = { spin: obj.userData.spin, flame: obj.userData.flame };
    return obj;
  },
  update(v, a, b, k, dt, world) {
    v.obj.position.y = 1;
    if (v.parts.spin) v.obj.rotation.z += dt * 18;
    if (v.parts.flame) world.fx.flame(v.x, 1, v.z, 0.5, 0.3, 0.05);
  },
});

registerEvent('swing', (e, world) => {
  const v = world.views.get(e.u);
  if (v) v.castT = 0.3;
});

registerEvent('hit', (e, world) => {
  world.fx.sparks(e.x, 1, e.y, 6, 3, '#ffe0b0');
  play('hit');
});
