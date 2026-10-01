// Destruction's Dance (#35): orc blademasters and their blink.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin, registerEvent, registerMapBuilder, registerTheme } from '../../engine/client/render/registry.js';
import { pose, pivot, limb } from './e-common.js';
import { play } from '../../engine/client/audio.js';

// A long, slightly curved katana with a wrapped hilt and a round guard.
function katana() {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push([Math.sin(t * 0.5) * 0.12, 0.12 + t * 1.15, 0]);
  }
  const blade = M.mesh(M.tube(pts, 0.035, 0.012, 16, 6), M.silverMat());
  blade.scale.z = 0.35;
  g.add(blade);
  g.add(M.mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.025, 16), M.goldMat(), 0, 0.1, 0));
  g.add(M.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 8), M.leatherMat('#6a1a18'), 0, -0.08, 0));
  return g;
}

// Blademaster: a lean green orc with a black topknot, a red war mask, bare
// arms bound in wraps, a sash and baggy trousers, a small team banner on his
// back and a long katana. Faces +X.
function blademaster(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = M.mat('#5f8a3a', { roughness: 0.65 });
  const cloth = M.texMat('tex_leather.webp', '#5a2a1a', '#c86a50', 1, { side: THREE.DoubleSide });
  const wrap = M.mat('#d8ccb0', { roughness: 0.9 });
  const hair = M.mat('#141010', { roughness: 0.5 });
  const mask = M.mat('#a01818', { roughness: 0.45, metalness: 0.2 });
  const team = M.mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  const leg = (s) => {
    const hip = pivot(0, 0.8, 0.12 * s);
    hip.add(limb([0, 0, 0], [0.06, -0.38, 0.02 * s], 0.12, 0.1, cloth));
    hip.add(limb([0.06, -0.36, 0.02 * s], [0.0, -0.72, 0], 0.08, 0.06, wrap));
    hip.add(M.mesh(M.scaled(M.G.sphere, 0.1, 0.05, 0.07), M.leatherMat('#3a2a1a'), 0.05, -0.76, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  const hips = M.mesh(M.blob(0.2, 0.14, 0.22, { seed: 101 }), cloth, 0, 0.85, 0);
  const sash = M.mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 20).rotateX(Math.PI / 2), M.mat('#1a1a1a'), 0, 0.95, 0);
  const tails = M.mesh(M.cloth(0.14, 0.4, 0.02, 0.1), M.mat('#1a1a1a', { side: THREE.DoubleSide }), -0.18, 0.78, 0.08);
  const torso = M.mesh(M.lathe([[0.17, 0.95], [0.2, 1.1], [0.27, 1.32], [0.27, 1.46], [0.16, 1.56], [0.07, 1.6]], 18), skin);
  torso.scale.set(0.85, 1, 1.18);
  // A diagonal chest strap for the banner.
  const strap = M.mesh(new THREE.TorusGeometry(0.26, 0.025, 6, 24), M.leatherMat('#4a2a1a'), 0, 1.3, 0);
  strap.rotation.set(Math.PI / 2, 0.7, 0);
  strap.scale.set(0.9, 1.2, 1);
  const head = pivot(0.08, 1.74, 0);
  head.add(M.mesh(M.blob(0.13, 0.14, 0.12, { seed: 102 }), skin, 0, 0, 0));
  head.add(M.mesh(M.blob(0.1, 0.1, 0.12, { seed: 103, amt: 0.05 }), mask, 0.07, 0.0, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.scaled(M.G.sphere, 0.022, 0.012, 0.02), M.glowMat('#ffe060'), 0.155, 0.03, 0.045 * s));
    head.add(M.mesh(M.tube([[0.12, -0.08, 0.05 * s], [0.18, -0.02, 0.07 * s], [0.17, 0.04, 0.06 * s]], 0.018, 0.004, 6, 5), M.boneMat()));
  }
  head.add(M.mesh(M.blob(0.1, 0.06, 0.1, { seed: 104 }), hair, -0.03, 0.12, 0));
  head.add(M.mesh(M.tube([[-0.04, 0.16, 0], [-0.1, 0.3, 0], [-0.24, 0.32, 0], [-0.34, 0.2, 0]], 0.05, 0.02, 12, 8), hair));
  const paulds = [1, -1].map((s) => M.mesh(M.blob(0.1, 0.06, 0.1, { seed: 105 }), M.mat('#3a3a3c', { metalness: 0.5, roughness: 0.4 }), 0, 1.5, 0.3 * s));
  const arm = (s) => {
    const a = pivot(0, 1.46, 0.32 * s);
    a.add(limb([0, 0, 0], [0.06, -0.3, 0.04 * s], 0.075, 0.065, skin));
    a.add(limb([0.06, -0.28, 0.04 * s], [0.2, -0.52, 0.02 * s], 0.065, 0.055, wrap));
    a.add(M.mesh(M.scaled(M.G.sphere, 0.06), skin, 0.22, -0.55, 0.02 * s));
    return a;
  };
  const armL = arm(1);
  const armR = arm(-1);
  const sword = katana();
  sword.position.set(0.22, -0.55, 0.02);
  sword.rotation.set(0, 0, -1.2);
  armR.add(sword);
  // Back banner on a pole.
  const pole = M.mesh(M.tube([[-0.2, 1.0, 0], [-0.24, 1.8, 0], [-0.26, 2.35, 0]], 0.02, 0.018), M.texMat('tex_wood.webp', '#4a2a1a', '#a07a58', 1));
  const banner = M.mesh(M.cloth(0.26, 0.5, 0.02, 0.06), team, -0.25, 2.05, 0.14);
  banner.rotation.y = Math.PI / 2;
  body.add(legL, legR, hips, sash, tails, torso, strap, head, ...paulds, armL, armR, pole, banner);
  body.scale.setScalar(1.35);
  const staff = new THREE.Object3D();
  body.add(staff);
  const tick = pose((dt, t) => {
    // Wind up overhead, then cut across.
    const k = Math.min(1.6, Math.max(0, -staff.rotation.x));
    armR.rotation.z = k * 1.5;
    armR.rotation.x = -k * 0.6;
    sword.rotation.z = -1.2 + k * 0.4;
    armL.rotation.z = k * 0.4;
    banner.rotation.x = Math.sin(t * 3) * 0.08;
  });
  g.userData = { body, legL, legR, staff, kind: 'hero', anim: [armL, armR, sword, banner], tick };
  return g;
}

registerSkin('blademaster', blademaster);

// Blink: a flash of violet light where he left and where he lands, with a
// fading streak of sparks between them.
registerEvent('blink', (e, world) => {
  for (const [x, z] of [[e.x1, e.y1], [e.x2, e.y2]]) {
    world.fx.burst(x, 1.2, z, '#c090ff', { n: 18, speed: 3, size: 0.5, life: 0.45 });
    world.fx.glow(x, 1.2, z, '#b080ff', 2.2, 0.3);
    world.fx.ring(x, z, 1.1, '#d0a8ff', 0.35);
  }
  const d = Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
  for (let i = 0; i < d; i += 0.5) {
    const k = i / d;
    world.fx.trail(e.x1 + (e.x2 - e.x1) * k, 1.1, e.y1 + (e.y2 - e.y1) * k, '#a070ff', 0.35, 0.3, 0.2);
  }
  play('teleport');
});

registerTheme(
  'dance',
  { sky: '#b09070', fog: '#b8987a', floor: ['#9a7050', 40, {}], sun: '#ffe2b8', hemi: ['#ffe8cc', '#4a3a28'] },
  { floor: { tex: 'tex_dirt.webp', tint: '#c0a48c', color: '#9a6a48', units: 7 }, edge: { tex: 'tex_stone.webp', tint: '#b0a090', color: '#7a6a5a', units: 5 }, outer: { tex: 'tex_grass.webp', tint: '#b0a878', color: '#6a6a3a' }, edgeWidth: 0.9 },
);

// Braziers at the corners of the ring.
registerMapBuilder('dance', (map, world) => {
  const hw = map.floor.w / 2 + 0.6;
  for (const [x, z] of [[hw, hw], [-hw, hw], [hw, -hw], [-hw, -hw]]) {
    const t = M.torch();
    t.position.set(x, 0, z);
    world.mapGroup.add(t);
    world.animated.push({ type: 'torch', obj: t });
  }
});
