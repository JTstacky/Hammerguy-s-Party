// The abandoned DotA joke: a miniature two-sided lane with peons caught
// between a red Sentinel grove and a sickly green Scourge crypt.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerMapBuilder } from '../../engine/client/render/registry.js';
import { bakeStatic } from '../../engine/client/render/batch.js';

const bark = M.barkMat('#69422f');
const leaf = M.triMat('tex_needles.webp', '#4d672e', '#859c52', 1);
const red = M.mat('#e75d4e');
const green = M.mat('#72df57');
const bone = M.boneMat();
const stone = M.triMat('tex_stone.webp', '#484f5c', '#8c9a9a', 1);

function treant() {
  const g = new THREE.Group();
  g.add(M.mesh(M.tube([[0, 0, 0], [0, 0.9, 0], [0.1, 1.55, 0]], 0.22, 0.14), bark));
  for (const s of [-1, 1]) {
    g.add(M.mesh(M.tube([[0, 1.1, 0], [0.3, 1.3, s * 0.35], [0.45, 1.05, s * 0.5]], 0.13, 0.055), bark));
    g.add(M.mesh(M.blob(0.42, 0.43, 0.34, { seed: 808 + s }), leaf, 0.16, 1.8, s * 0.34));
    g.add(M.mesh(M.scaled(M.G.sphere, 0.06), red, 0.23, 1.3, s * 0.13));
  }
  g.add(M.mesh(M.blob(0.5, 0.35, 0.5, { seed: 810 }), leaf, 0, 1.9, 0));
  return g;
}

function cultist() {
  const g = new THREE.Group();
  const robe = M.leatherMat('#3b4253');
  g.add(M.mesh(M.lathe([[0.28, 0.1], [0.36, 0.38], [0.22, 1.14], [0.13, 1.42]], 10), robe));
  g.add(M.mesh(M.blob(0.23, 0.3, 0.25, { seed: 811 }), robe, 0.02, 1.46, 0));
  g.add(M.mesh(M.scaled(M.G.sphere, 0.13), green, 0.17, 1.48, 0));
  for (const s of [-1, 1]) {
    g.add(M.mesh(M.tube([[0, 1.18, s * 0.24], [0.18, 0.81, s * 0.3]], 0.08, 0.05), bone));
    g.add(M.mesh(M.tube([[-0.09, 0.4, s * 0.18], [0.04, 0.07, s * 0.19]], 0.09, 0.06), robe));
  }
  g.add(M.mesh(M.tube([[0.12, 0.1, -0.38], [0.13, 1.8, -0.38]], 0.04, 0.03), bark));
  g.add(M.mesh(M.scaled(M.G.sphere, 0.13), green, 0.13, 1.84, -0.38));
  return g;
}

function treeOfLife() {
  const g = M.tree(1.65);
  g.add(M.mesh(M.scaled(M.G.sphere, 0.34), red, 0.4, 2.25, 0));
  return g;
}

function crypt() {
  const g = new THREE.Group();
  g.add(M.mesh(M.lathe([[1.2, 0], [1.35, 0.25], [1.0, 0.5], [0.9, 2.05], [0.5, 2.3]], 8), stone));
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const x = Math.cos(a), z = Math.sin(a);
    g.add(M.mesh(M.tube([[x, 0.4, z], [x * 1.12, 2.4, z * 1.12], [x * 0.72, 2.9, z * 0.72]], 0.15, 0.02), bone));
  }
  g.add(M.mesh(M.scaled(M.G.sphere, 0.3), green, 0, 2.55, 0));
  return g;
}

for (const [kind, make] of [
  ['ux6tree', treeOfLife],
  ['ux6treant', treant],
  ['ux6archer', () => {
    const g = cultist();
    g.add(M.mesh(M.tube([[0.32, 0.45, -0.1], [0.45, 1.0, -0.4], [0.25, 1.65, -0.1]], 0.035, 0.025), red));
    return g;
  }],
  ['ux6crypt', crypt],
  ['ux6cultist', cultist],
]) registerView(kind, { make });

registerMapBuilder('ux6defenselane', (map, world) => {
  const g = new THREE.Group();
  const rail = M.barkMat('#4c3326');
  const dead = M.triMat('tex_rock.webp', '#4e4850', '#726d68', 1);
  const path = new THREE.Shape();
  path.moveTo(-12, -2.35);
  for (let i = -11; i <= 12; i++) path.lineTo(i, -2.35 + 0.13 * Math.sin(i * 2.1));
  for (let i = 12; i >= -12; i--) path.lineTo(i, 2.35 + 0.13 * Math.sin(i * 1.7));
  path.closePath();
  const track = M.mesh(new THREE.ShapeGeometry(path), M.triMat('tex_dirt.webp', '#665046', '#9d8363', 1));
  track.rotation.x = -Math.PI / 2;
  track.position.y = 0.025;
  g.add(track);
  for (const side of [-1, 1]) {
    for (let i = -7; i <= 7; i++) {
      const x = i * 1.45;
      const z = side * (2.35 + 0.16 * Math.sin(i * 2.1));
      g.add(M.mesh(M.blob(0.6, 0.25, 0.5, { seed: 820 + i * side }), dead, x, 0.03, z));
      if (i % 2 === 0) {
        g.add(M.mesh(M.tube([[x, 0, z], [x, 0.65, z]], 0.08, 0.07), rail));
      }
    }
  }
  bakeStatic(g);
  world.mapGroup.add(g);
});
