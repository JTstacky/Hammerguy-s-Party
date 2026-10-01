// Horse Race (#24): eight fenced lanes down a dirt track, hitching posts
// behind the start line, a checkered finish line under a banner, and the
// burst of a Speed Boost. The finish circles are 'cop' entities.

import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { groundStrip } from './race-kit.js';

let checker = null;
function checkerTexture() {
  if (checker) return checker;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    g.fillStyle = (x + y) % 2 ? '#f4efe4' : '#1c1a18';
    g.fillRect(x * 8, y * 8, 8, 8);
  }
  checker = new THREE.CanvasTexture(c);
  checker.colorSpace = THREE.SRGBColorSpace;
  checker.wrapS = checker.wrapT = THREE.RepeatWrapping;
  checker.magFilter = THREE.NearestFilter;
  return checker;
}

// A rail fence along z from x0 to x1: posts every `step` and two rails.
function fence(group, x0, x1, z, { step = 2.2, h = 0.62 } = {}) {
  const wood = M.texMat('tex_wood.webp', '#7a5a38', '#e8d0b0');
  const n = Math.floor((x1 - x0) / step) + 1;
  const post = new THREE.InstancedMesh(M.lathe([[0.07, 0], [0.07, h], [0.05, h + 0.06], [0.01, h + 0.08]], 8), wood, n);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    dummy.position.set(x0 + i * step, 0, z);
    dummy.rotation.set(0, Math.random() * 3, (Math.random() - 0.5) * 0.06);
    dummy.updateMatrix();
    post.setMatrixAt(i, dummy.matrix);
  }
  post.castShadow = true;
  post.receiveShadow = true;
  group.add(post);
  for (const y of [h * 0.45, h * 0.88]) {
    const rail = M.mesh(new THREE.CylinderGeometry(0.035, 0.035, x1 - x0, 6).rotateZ(Math.PI / 2), wood, (x0 + x1) / 2, y, z);
    group.add(rail);
  }
}

registerMapBuilder('horserace', (map, world) => {
  const H = map.hr;
  const G = world.mapGroup;
  const zs = H.walls;
  const top = Math.min(...zs);
  const bottom = Math.max(...zs);
  const laneW = Math.abs(zs[1] - zs[0]);
  // The track: packed dirt over the grass.
  G.add(groundStrip(H.x0 - 0.5, top - laneW - 0.6, H.x1 + 3, bottom + 0.6, { tint: '#c8b494', opacity: 0.92, units: 6 }));
  // Rail fences where the map's line-of-sight blockers wall off the lanes.
  for (const z of zs) fence(G, H.x0, H.x1, z);
  // Start line and hitching posts.
  const chalk = new THREE.Mesh(new THREE.PlaneGeometry(0.18, bottom - top + laneW).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f0ece0', transparent: true, opacity: 0.85, depthWrite: false }));
  chalk.position.set(H.start + 0.8, 0.03, (top - laneW + bottom) / 2);
  G.add(chalk);
  for (const z of H.lanes) {
    const p = new THREE.Group();
    p.add(M.mesh(M.lathe([[0.1, 0], [0.09, 0.9], [0.13, 0.95], [0.01, 1.0]], 10), M.texMat('tex_wood.webp', '#6a4a2a', '#d8c0a0'), 0, 0, 0));
    const ring = M.mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 16), M.mat('#3a3a3c', { metalness: 0.6 }), 0.1, 0.8, 0);
    ring.rotation.y = Math.PI / 2;
    p.add(ring);
    p.add(M.mesh(M.tube([[0.1, 0.72, 0], [0.25, 0.3, 0.1], [0.2, 0.02, 0.25]], 0.02, 0.02, 8, 5), M.leatherMat()));
    p.position.set(H.posts, 0, z);
    G.add(p);
  }
  // The finish: a checkered line and a banner on two poles across the track.
  const fx = H.finish;
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.9, bottom - top + laneW + 0.4).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.9, transparent: true, opacity: 0.92, depthWrite: false }));
  line.material.map = checkerTexture().clone();
  line.material.map.repeat.set(1, (bottom - top + laneW) / 0.9);
  line.material.map.needsUpdate = true;
  line.position.set(fx, 0.035, (top - laneW + bottom) / 2);
  G.add(line);
  const pole = (z) => {
    const p = M.mesh(M.tube([[0, 0, 0], [0, 2.5, 0], [0, 5, 0]], 0.1, 0.08, 4, 8), M.texMat('tex_wood.webp', '#6a4a2a', '#d8c0a0'), fx, 0, z);
    G.add(p);
    G.add(M.mesh(M.scaled(M.G.sphere, 0.16), M.goldMat(), fx, 5.05, z));
  };
  const z0 = top - laneW - 0.4;
  const z1 = bottom + 0.4;
  pole(z0);
  pole(z1);
  const banner = M.mesh(M.cloth(z1 - z0 - 0.4, 1.0, 0.0, 0.15), M.mat('#b01c1c', { side: THREE.DoubleSide, roughness: 0.8 }), fx, 4.3, (z0 + z1) / 2);
  G.add(banner);
  const trim = M.mesh(new THREE.CylinderGeometry(0.05, 0.05, z1 - z0, 8).rotateX(Math.PI / 2), M.goldMat(), fx, 4.82, (z0 + z1) / 2);
  G.add(trim);
  // Pennants hanging off the trim.
  for (let z = z0 + 0.8; z < z1 - 0.5; z += 1.3) {
    const pen = M.mesh(M.scaled(M.G.cone, 0.22, 0.45, 0.02).rotateZ(Math.PI), M.mat(Math.round(z * 3) % 2 ? '#e8c030' : '#f4efe4', { side: THREE.DoubleSide }), fx, 3.55, z);
    pen.rotation.y = Math.PI / 2;
    G.add(pen);
  }
});

registerEvent('hrboost', (e, world) => {
  const fx = world.fx;
  fx.dustCloud(e.x - 0.6, e.y, 0.7, '#b8a07a', 8);
  fx.burst(e.x, 1.0, e.y, '#ffe27a', { n: 22, speed: 5, size: 0.5, life: 0.4, up: 0.3 });
  fx.ring(e.x, e.y, 1.3, '#ffe27a', 0.35);
  for (let i = 0; i < 8; i++) fx.trail(e.x - i * 0.25, 0.8 + Math.random() * 0.6, e.y + (Math.random() - 0.5) * 0.6, '#fff2b0', 0.4, 0.4, 0.05);
  play('thrust');
});
