// Ultima-X #75: an eight-tile stone room filled by colourful multiplying sludge.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { registerView, registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';

const neutral = '#745b39';
const palette = ['#fa5157', '#467dff', '#24dd70', '#b569fb', '#ffe452', '#ff9037', '#20dde2', '#e569c7'];

function sludge(color) {
  const g = new THREE.Group();
  const core = new THREE.Group();
  const skin = M.triMat('tex_hide.webp', color, '#dddddd', 0.7);
  const dark = M.mat('#252525', { roughness: 0.6 });
  const eye = M.glowMat('#fbffe1');
  core.add(M.mesh(M.blob(0.58, 0.38, 0.58, { seed: 74, amt: 0.12 }), skin, 0, 0.39, 0));
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7;
    core.add(M.mesh(M.blob(0.16, 0.17 + i % 3 * 0.05, 0.16, { seed: i + 24, amt: 0.15 }),
      skin, Math.cos(a) * 0.43, 0.3, Math.sin(a) * 0.43));
  }
  for (const z of [-0.19, 0.19]) {
    core.add(M.mesh(M.scaled(M.G.sphere, 0.14, 0.17, 0.12), dark, 0.34, 0.58, z));
    core.add(M.mesh(M.scaled(M.G.sphere, 0.082, 0.095, 0.025), eye, 0.45, 0.6, z));
  }
  g.add(core);
  g.userData.core = core;
  return g;
}

registerView('uxsludge', {
  make(e, world, v) {
    const color = e.o == null ? neutral : palette[(e.o - 1) % palette.length];
    const g = sludge(color);
    v.parts = g.userData;
    v.phase = e.id * 0.37;
    return g;
  },
  update(v, a, b, k, dt, world) {
    const pulse = Math.sin(world.time * 3 + v.phase);
    v.parts.core.scale.y = 0.96 + pulse * 0.06;
    v.parts.core.position.y = pulse * 0.02;
  },
});

registerEvent('uxninesplit', (e, world) => {
  world.fx.glow(e.x, 0.45, e.y, '#9be85b', 0.55, 0.35);
  world.fx.debrisBurst(e.x, e.y, 8, 2.5);
});

registerMapBuilder('uxninewall', (map, world) => {
  const h = map.floor.w / 2;
  const scene = new THREE.Group();
  const rock = M.triMat('tex_boulder.webp', '#77777c', '#a3a39c', 0.65);
  const top = M.texMat('tex_stone.webp', '#77777c', '#c2c0b4', 2);
  for (let side = 0; side < 4; side++) {
    for (let i = -5; i <= 5; i++) {
      const p = i * h / 5;
      const x = side < 2 ? p : (side === 2 ? -h : h);
      const z = side < 2 ? (side === 0 ? -h : h) : p;
      const block = M.mesh(M.blob(0.95, 0.8, 0.85, { seed: 100 + i + side * 11, amt: 0.11 }), rock, x, 0.4, z);
      scene.add(block);
      scene.add(M.mesh(M.blob(0.8, 0.17, 0.75, { seed: i + 31, amt: 0.06 }), top, x, 1.13, z));
    }
  }
  bakeStatic(scene);
  world.mapGroup.add(scene);
});
