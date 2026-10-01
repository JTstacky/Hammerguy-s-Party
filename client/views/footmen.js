// Flight of the Footmen (#45): the cliff plateau in the middle of the track,
// the human Guard and Cannon Towers on it, their arrows and shells, and the
// shield a footman raises when he Defends.

import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { fxTexture } from '../../engine/client/render/effects.js';
import { registerView, registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { play } from '../../engine/client/audio.js';
import { cliffBlock, cliffMat, rubble, emit } from './race-kit.js';

export const PLATEAU_H = 1.9;
const TOWER_TOP = 3.4; // where arrows and shells leave a tower, above the plateau

const stoneMat = () => M.texMat('tex_stone.webp', '#9a968c', '#e0dcd2', 0.7);
const slateMat = () => M.texMat('tex_wood.webp', '#4a6ab0', '#a8c0f4', 1, { roughness: 0.6 });

// A human Guard Tower: a round stone tower tapering up to a timber lookout
// with arrow slits, under a steep blue slate roof with a gold finial and a
// pennant. Built round +Y.
export function guardTower() {
  const g = new THREE.Group();
  const stone = stoneMat();
  const wood = M.texMat('tex_wood.webp', '#6a4a2a', '#e8d0b0');
  const gold = M.goldMat();
  g.add(M.mesh(M.lathe([[0.95, 0], [0.95, 0.25], [0.78, 0.4], [0.62, 1.6], [0.6, 2.3], [0.72, 2.4], [0.72, 2.5], [0.01, 2.5]], 20), stone));
  for (const y of [0.4, 2.42]) {
    const band = M.mesh(new THREE.TorusGeometry(y < 1 ? 0.79 : 0.73, 0.04, 6, 24), wood, 0, y, 0);
    band.rotation.x = Math.PI / 2;
    g.add(band);
  }
  // The lookout: a timber drum with dark slits, and posts at the eaves.
  g.add(M.mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.7, 20, 1, true), wood, 0, 2.85, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(M.mesh(M.scaled(M.G.box, 0.05, 0.28, 0.08), M.mat('#140e0a'), Math.cos(a) * 0.665, 2.85, Math.sin(a) * 0.665).rotateY(-a));
    g.add(M.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.78, 8), wood, Math.cos(a + 0.5) * 0.7, 2.85, Math.sin(a + 0.5) * 0.7));
  }
  g.add(M.mesh(M.lathe([[0.95, 3.15], [0.85, 3.3], [0.4, 3.95], [0.12, 4.35], [0.01, 4.45]], 20), slateMat()));
  g.add(M.mesh(M.scaled(M.G.sphere, 0.1), gold, 0, 4.48, 0));
  g.add(M.mesh(M.tube([[0, 4.45, 0], [0, 4.8, 0], [0, 5.1, 0]], 0.025, 0.02, 3, 6), M.mat('#3a3a3c')));
  const flag = M.mesh(M.cloth(0.5, 0.3, 0.02, 0.1), M.mat('#2a54c8', { side: THREE.DoubleSide }), 0.25, 4.95, 0);
  flag.rotation.y = Math.PI / 2;
  g.add(flag);
  g.userData = { flag };
  return g;
}

// A Cannon Tower: a broad stone drum with crenellations, and a black iron
// cannon on a wooden carriage that turns to aim. Built round +Y.
export function cannonTower() {
  const g = new THREE.Group();
  const stone = stoneMat();
  const iron = M.mat('#1e1e22', { metalness: 0.7, roughness: 0.35 });
  const gold = M.goldMat();
  g.add(M.mesh(M.lathe([[1.1, 0], [1.1, 0.3], [0.92, 0.45], [0.84, 2.1], [0.98, 2.25], [0.98, 2.45], [0.01, 2.45]], 24), stone));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(M.mesh(M.blob(0.16, 0.16, 0.13, { seed: 40 + i, amt: 0.05 }), stone, Math.cos(a) * 0.9, 2.6, Math.sin(a) * 0.9));
  }
  const gun = new THREE.Group();
  gun.position.y = 2.6;
  const wood = M.texMat('tex_wood.webp', '#5a3a22', '#d0b898');
  gun.add(M.mesh(M.scaled(M.G.box, 0.7, 0.2, 0.5), wood, 0, 0.1, 0));
  for (const s of [1, -1]) gun.add(M.mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 14).rotateX(Math.PI / 2), wood, -0.05, 0.1, 0.28 * s));
  const barrel = new THREE.Group();
  barrel.position.set(0.05, 0.35, 0);
  barrel.add(M.mesh(M.lathe([[0.2, -0.45], [0.23, -0.4], [0.19, 0], [0.15, 0.55], [0.18, 0.62], [0.13, 0.66], [0.1, 0.62]], 16), iron));
  barrel.add(M.mesh(M.scaled(M.G.sphere, 0.13), iron, 0, -0.5, 0));
  for (const y of [-0.3, 0.2]) {
    const band = M.mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16), gold, 0, y, 0);
    band.rotation.x = Math.PI / 2;
    barrel.add(band);
  }
  barrel.rotation.z = -Math.PI / 2 + 0.35; // along +X, raised
  gun.add(barrel);
  g.add(gun);
  g.userData = { gun, barrel };
  return g;
}

registerView('guardtower', {
  bake: true,
  make(e, world, v) {
    const g = guardTower();
    v.parts = g.userData;
    v.t = Math.random() * 5;
    return g;
  },
  update(v, a, b, k, dt) {
    v.obj.position.y = PLATEAU_H;
    v.obj.rotation.y = 0;
    v.t += dt;
    v.parts.flag.rotation.x = Math.sin(v.t * 3) * 0.15;
  },
});

registerView('cannontower', {
  bake: true,
  make(e, world, v) {
    const g = cannonTower();
    v.parts = g.userData;
    v.aim = e.f ?? 0;
    return g;
  },
  update(v, a, b, k, dt) {
    v.obj.position.y = PLATEAU_H;
    v.obj.rotation.y = 0;
    let d = (b.f ?? 0) - v.aim;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    v.aim += d * Math.min(1, dt * 8);
    v.parts.gun.rotation.y = -v.aim;
    // Recoil when it fires.
    if (b.fire && !v.fired) v.kick = 1;
    v.fired = !!b.fire;
    v.kick = Math.max(0, (v.kick || 0) - dt * 3);
    v.parts.barrel.position.x = 0.05 - v.kick * 0.2;
  },
});

// A guard tower's arrow, dropping from the lookout onto its footman.
registerView('ffarrow', {
  make() {
    const g = new THREE.Group();
    const s = 1.3;
    const arrow = new THREE.Group();
    arrow.add(M.mesh(M.tube([[-0.45 * s, 0, 0], [0, 0, 0], [0.4 * s, 0, 0]], 0.022, 0.02, 2, 6), M.mat('#6b4a2a')));
    arrow.add(M.mesh(M.scaled(M.G.cone, 0.05, 0.15, 0.05).rotateZ(-Math.PI / 2), M.mat('#c8ccd4', { metalness: 0.7, roughness: 0.3 }), 0.47 * s, 0, 0));
    for (const z of [1, -1]) arrow.add(M.mesh(M.scaled(M.G.box, 0.16, 0.01, 0.06), M.mat('#e8e0d0'), -0.4 * s, 0, 0.03 * z));
    g.add(arrow);
    return g;
  },
  update(v, a, b, k) {
    const p = Math.min(1, (a.p ?? 0) + ((b.p ?? 0) - (a.p ?? 0)) * k);
    v.obj.position.y = (PLATEAU_H + TOWER_TOP) * (1 - p) + 1.0 * p;
  },
});

// A cannon shell: an iron ball lobbed from the tower top to where the
// footman stood when it fired, trailing smoke, its shadow on the ground.
registerView('ffshell', {
  make(e, world, v) {
    const g = new THREE.Group();
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0, depthWrite: false }));
    shadow.position.y = 0.05;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffb070', transparent: true, opacity: 0, depthWrite: false }));
    ring.position.y = 0.06;
    ring.scale.setScalar(e.r || 1.8);
    g.add(shadow, ring);
    const ball = M.mesh(new THREE.SphereGeometry(0.2, 14, 10), M.mat('#1a1a1e', { metalness: 0.6, roughness: 0.35 }));
    world.entGroup.add(ball);
    v.parts = { shadow, ring, ball };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const t = Math.min(1, Math.max(0, (a.t ?? 0) + ((b.t ?? 0) - (a.t ?? 0)) * k));
    const P = v.parts;
    v.obj.rotation.y = 0;
    P.shadow.scale.setScalar(0.2 + 0.3 * t);
    P.shadow.material.opacity = 0.45 * t * t;
    P.ring.material.opacity = 0.3 * Math.min(1, t * 1.5);
    const sx = b.sx ?? v.x;
    const sz = b.sy ?? v.z;
    const d = Math.hypot(v.x - sx, v.z - sz);
    const h0 = PLATEAU_H + TOWER_TOP - 0.6;
    const y = h0 * (1 - t) + 4 * t * (1 - t) * Math.max(2, d * 0.35) + 0.2 * t;
    P.ball.visible = v.obj.visible;
    P.ball.position.set(sx + (v.x - sx) * t, y, sz + (v.z - sz) * t);
    if (emit(v, 'smoke', 22, dt)) world.fx.smokePuff(P.ball.position.x, y, P.ball.position.z, '#3a3634', 0.45, 0.6, 0.4);
  },
  remove(v, world) {
    world.entGroup.remove(v.parts.ball);
  },
});

// Defend's gold shimmer round a footman's feet (the footman skin raises its
// own shield; see client/views/footman.js).
registerView('ffshield', {
  make(e, world, v) {
    const g = new THREE.Group();
    const aura = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.05, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: fxTexture('fx_shockwave.webp'), color: '#ffe066', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    aura.position.y = 0.05;
    g.add(aura);
    v.parts = { aura };
    v.t = 0;
    return g;
  },
  update(v, a, b, k, dt) {
    v.t += dt;
    v.parts.aura.material.opacity = 0.35 + Math.sin(v.t * 6) * 0.15;
    v.parts.aura.rotation.y = v.t;
  },
});

registerEvent('ffdefend', (e, world) => {
  world.fx.ring(e.x, e.y, 1.3, e.on ? '#ffe066' : '#9aa0a8', 0.35);
  if (e.on) world.fx.sparks(e.x, 1.1, e.y, 8, 3, '#ffe8a0');
  play(e.on ? 'shield' : 'click');
});

registerEvent('ffcannon', (e, world) => {
  const c = Math.cos(e.f ?? 0);
  const s = Math.sin(e.f ?? 0);
  const x = e.x + c * 0.9;
  const z = e.y + s * 0.9;
  const y = PLATEAU_H + 3.1;
  world.fx.glow(x, y, z, '#ffb060', 2.5, 0.2);
  world.fx.sparks(x, y, z, 8, 4, '#ffd070');
  for (let i = 0; i < 4; i++) world.fx.smokePuff(x, y, z, '#4a4442', 1, 1.2, 0.5);
  play('boom');
});

registerMapBuilder('footmen', (map, world) => {
  const F = map.ff;
  // Static scenery, merged per material at the end (hundreds of parts otherwise).
  const G = new THREE.Group();
  const mat = cliffMat('tex_grass.webp', '#8aa070', 'tex_boulder.webp', '#a8a6b4');
  F.cliffs.forEach(([ax, az, bx, bz], i) => {
    const x0 = Math.min(ax, bx);
    const x1 = Math.max(ax, bx);
    const z0 = Math.min(az, bz);
    const z1 = Math.max(az, bz);
    // The plateau proper runs off the arena's west edge; the spurs are cliff edges.
    G.add(cliffBlock(x0 + 0.25, z0 + 0.25, x1 - 0.25, z1 - 0.25, PLATEAU_H, { mat, seed: 20 + i, rough: 0.3, round: i ? 0.5 : 1.2 }));
    rubble(G, x0 + 0.4, z0 + 0.4, x1 - 0.4, z1 - 0.4, { every: 3, s: [0.25, 0.5], out: 0.15 });
  });
  // A few pines on the wide western end of the plateau.
  const [cx0, , cx1] = F.cliffs[0];
  for (let i = 0; i < 10; i++) {
    const t = M.tree(0.8 + Math.random() * 0.4);
    t.position.set(Math.min(cx0, cx1) + 1 + Math.random() * 6, PLATEAU_H, (Math.random() - 0.5) * 6);
    G.add(t);
  }
  bakeStatic(G);
  world.mapGroup.add(G);
});
