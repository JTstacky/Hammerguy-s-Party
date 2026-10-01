// The Death Trap (#48): the spike field. The server sends one 'spikefield'
// entity with a string of 0/1 (standing or down) per spike; the spike spots
// come with the map (map.spikes). Standing spikes burst out of the ground
// with their birth animation and sink back when they drop. The pillars come
// from the 'upmaze' builder.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerEvent } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { bakeStatic } from './walkgrid-art.js';

// A spike barrier: crossed logs bristling with sharpened stakes, iron-shod
// and stained at the tips, filling the 128 u lane.
function spikeBarrier(seed) {
  const g = new THREE.Group();
  const wood = M.texMat('tex_wood.webp', '#b09068', '#fff4e0');
  const bark = M.barkMat();
  const iron = M.mat('#c8ccd4', { metalness: 0.7, roughness: 0.35 });
  const blood = M.mat('#5a0c0a', { roughness: 0.35 });
  const rope = M.mat('#8a7450', { roughness: 0.9 });
  for (const a of [0.6, -0.6]) {
    const log = M.mesh(M.tube([[-0.95, 0.2, 0], [0, 0.26, 0], [0.95, 0.2, 0]], 0.13, 0.12, 4, 10), bark);
    log.rotation.y = a + seed * 0.2;
    g.add(log);
  }
  g.add(M.mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 14).rotateX(Math.PI / 2), rope, 0, 0.26, 0));
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed;
    const lean = 0.35 + ((i * 37 + seed * 11) % 5) * 0.06;
    const len = 1.05 + ((i * 53) % 4) * 0.12;
    const bx = Math.cos(a) * 0.35;
    const bz = Math.sin(a) * 0.35;
    const tx = bx + Math.cos(a) * Math.sin(lean) * len;
    const tz = bz + Math.sin(a) * Math.sin(lean) * len;
    const ty = Math.cos(lean) * len;
    g.add(M.mesh(M.tube([[bx * 0.6, -0.2, bz * 0.6], [(bx + tx) / 2, ty * 0.5, (bz + tz) / 2], [tx, ty, tz]], 0.07, 0.012, 6, 8), wood));
    const tip = M.mesh(M.scaled(M.G.cone, 0.035, 0.18, 0.035), i % 3 ? iron : blood, tx, ty + 0.02, tz);
    tip.lookAt(tx + (tx - bx), ty + ty, tz + (tz - bz));
    tip.rotateX(Math.PI / 2);
    g.add(tip);
  }
  // The centre stake, tallest.
  g.add(M.mesh(M.tube([[0, -0.2, 0], [0.02, 0.8, 0], [0, 1.55, 0]], 0.09, 0.012, 6, 8), wood));
  g.add(M.mesh(M.scaled(M.G.cone, 0.04, 0.2, 0.04), blood, 0, 1.6, 0));
  return g;
}

// The pit each spike rises from: a dark, trampled patch with a few clods.
function spikePit() {
  const g = new THREE.Group();
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#1a120c', transparent: true, opacity: 0.55, depthWrite: false }));
  hole.position.y = 0.03;
  g.add(hole);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    g.add(M.mesh(M.blob(0.1, 0.06, 0.09, { seed: i + 40, amt: 0.25, freq: 3, detail: 1 }), M.hideMat(), Math.cos(a) * 0.8, 0.03, Math.sin(a) * 0.8));
  }
  return g;
}

registerView('spikefield', {
  // One instanced mesh per material for all 40 spikes (a handful of draw
  // calls), each instance raised or sunk on its own; the pits are merged.
  make(e, world, v) {
    const g = new THREE.Group();
    const spots = world.map?.spikes || [];
    const pits = new THREE.Group();
    for (const [x, z] of spots) {
      const pit = spikePit();
      pit.position.set(x, 0, z);
      pits.add(pit);
    }
    g.add(bakeStatic(pits));
    const proto = bakeStatic(spikeBarrier(0));
    v.inst = proto.children.map((m) => {
      const im = new THREE.InstancedMesh(m.geometry, m.material, Math.max(1, spots.length));
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      g.add(im);
      return im;
    });
    v.spikes = spots.map(([x, z], i) => ({ x, z, rot: i * 1.3, up: 1, h: 1 }));
    v.dummy = new THREE.Object3D();
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.obj.position.set(0, 0, 0);
    v.obj.rotation.y = 0;
    const mask = b.up || '';
    const d = v.dummy;
    v.spikes.forEach((s, i) => {
      const up = mask[i] === '1';
      if (up !== !!s.up) {
        s.up = up;
        world.fx.dustCloud(s.x, s.z, 0.7, '#7a6448', up ? 7 : 4);
        if (up) world.fx.debrisBurst(s.x, s.z, 5, 3);
      }
      // Birth: out of the ground in 0.2 s with an overshoot. Death: sinks in 0.4 s.
      s.h = up ? Math.min(1, s.h + dt / 0.2) : Math.max(0, s.h - dt / 0.4);
      const y = up ? -1.9 * (1 - s.h) + Math.sin(s.h * Math.PI) * 0.12 : -1.9 * (1 - s.h);
      d.position.set(s.x, y, s.z);
      d.rotation.set(0, s.rot, 0);
      d.scale.setScalar(s.h > 0.001 ? 1 : 0.0001);
      d.updateMatrix();
      for (const im of v.inst) im.setMatrixAt(i, d.matrix);
    });
    for (const im of v.inst) im.instanceMatrix.needsUpdate = true;
  },
});

// Impaled: blood and splinters.
registerEvent('spiked', (e, world) => {
  world.fx.burst(e.x, 0.9, e.y, '#8a0c0a', { n: 30, speed: 4, size: 0.5, life: 0.6, additive: false, grav: 10 });
  world.fx.debrisBurst(e.x, e.y, 6, 3);
  world.fx.dustCloud(e.x, e.y, 0.6, '#6a5a4a', 5);
  play('death');
});
