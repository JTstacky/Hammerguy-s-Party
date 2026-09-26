// Way of the Bow (#6): night elf archers, their arrows, and arrows that miss
// sticking out of the ground.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent } from '../../engine/client/render/registry.js';
import { driver, pivot, limb, transient } from './e-common.js';
import { play } from '../../engine/client/audio.js';

const ELF_SKIN = '#9c86e0';
const ELF_HAIR = '#cfeee8';

// A night elf longbow: two recurved limbs of dark wood with a pale grip and a
// string, standing upright in the XY plane (the string on the -X side).
function longbow(h = 1.25) {
  const g = new THREE.Group();
  const wood = M.mat('#4a2e1c', { roughness: 0.55 });
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8 - 0.5;
    pts.push([0.16 * Math.cos(t * Math.PI) - 0.02 * Math.sin(t * Math.PI * 2) * 0, t * h, 0]);
  }
  // Recurved tips.
  pts[0][0] = 0.02;
  pts[8][0] = 0.02;
  g.add(M.mesh(M.tube(pts, 0.03, 0.03, 16, 8), wood));
  g.add(M.mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.16, 10), M.leatherMat('#e8dcc0'), 0.16, 0, 0));
  for (const s of [1, -1]) g.add(M.mesh(M.scaled(M.G.sphere, 0.03), M.mat('#d8d0ff', { emissive: '#6050c0', emissiveIntensity: 0.8 }), 0.03, (s * h) / 2, 0));
  const string = M.mesh(new THREE.CylinderGeometry(0.005, 0.005, h * 0.98, 4), M.mat('#e8e8e0'), 0.02, 0, 0);
  g.add(string);
  g.userData.string = string;
  return g;
}

// Night elf archer: a slender purple-skinned huntress with long pale hair and
// swept-back ears, a leather bodice and skirt with a team sash, a hooded
// quiver on her back and a longbow in her left hand. Faces +X.
function archer(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = M.mat(ELF_SKIN, { roughness: 0.6 });
  const leather = M.mat('#3e6a4a', { roughness: 0.7 });
  const dark = M.leatherMat('#5a4a38');
  const team = M.mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  const hair = M.mat(ELF_HAIR, { roughness: 0.5 });
  const leg = (s) => {
    const hip = pivot(0, 0.78, 0.09 * s);
    hip.add(limb([0, 0, 0], [0.02, -0.38, 0], 0.075, 0.055, skin));
    hip.add(limb([0.02, -0.36, 0], [0, -0.74, 0], 0.07, 0.05, dark));
    hip.add(M.mesh(M.scaled(M.G.sphere, 0.09, 0.05, 0.065), dark, 0.05, -0.76, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  const skirt = M.mesh(M.lathe([[0.15, 0.98], [0.2, 0.86], [0.27, 0.62], [0.28, 0.6]], 18), M.mat('#4f5c34', { roughness: 0.85, side: THREE.DoubleSide }));
  const torso = M.mesh(M.lathe([[0.14, 0.92], [0.16, 1.05], [0.19, 1.22], [0.18, 1.34], [0.12, 1.42], [0.06, 1.46]], 18), leather);
  torso.scale.set(0.85, 1, 1.1);
  const belt = M.mesh(new THREE.TorusGeometry(0.155, 0.025, 6, 20).rotateX(Math.PI / 2), M.goldMat(), 0, 0.95, 0);
  const sash = M.mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 24), team, 0, 1.18, 0);
  sash.rotation.set(Math.PI / 2, 0.55, 0);
  sash.scale.set(0.85, 1.12, 1);
  const neck = limb([0, 1.42, 0], [0.02, 1.55, 0], 0.05, 0.045, skin);
  const head = M.mesh(M.blob(0.11, 0.13, 0.1, { seed: 5, amt: 0.04 }), skin, 0.03, 1.64, 0);
  const brow = M.mesh(M.scaled(M.G.sphere, 0.05, 0.02, 0.09), M.mat('#6a5aa8'), 0.12, 1.68, 0);
  const eyes = [1, -1].map((s) => M.mesh(M.scaled(M.G.sphere, 0.02, 0.012, 0.025), M.glowMat('#fff4c8'), 0.12, 1.655, 0.04 * s));
  // Long swept-back ears.
  const ears = [1, -1].map((s) => M.mesh(M.tube([[0.0, 1.66, 0.09 * s], [-0.08, 1.72, 0.16 * s], [-0.2, 1.8, 0.2 * s]], 0.03, 0.004, 6, 6), skin));
  // Hair: a crown, and a long tail down the back.
  const crown = M.mesh(M.blob(0.12, 0.1, 0.115, { seed: 7, amt: 0.08 }), hair, -0.02, 1.71, 0);
  const tail = M.mesh(M.tube([[-0.08, 1.72, 0], [-0.2, 1.6, 0], [-0.22, 1.3, 0], [-0.18, 1.02, 0]], 0.07, 0.02, 12, 8), hair);
  // Pauldrons and a short team cape.
  const paulds = [1, -1].map((s) => {
    const p = M.mesh(M.blob(0.09, 0.05, 0.09, { seed: 9 }), dark, 0, 1.38, 0.17 * s);
    p.rotation.x = 0.4 * s;
    return p;
  });
  const cape = M.mesh(M.cloth(0.36, 0.6, 0.12, 0.12), team, -0.16, 1.1, 0);
  // Quiver across the back, fletchings poking out over the shoulder.
  const quiver = pivot(-0.17, 1.12, -0.05);
  quiver.add(M.mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.5, 12), dark));
  for (let i = 0; i < 4; i++) quiver.add(M.mesh(M.scaled(M.G.cone, 0.03, 0.1, 0.012), M.mat('#e8e2d0'), (i % 2) * 0.03 - 0.015, 0.3, (i - 1.5) * 0.02));
  quiver.rotation.x = 0.5;
  // Bow arm (left, +Z): pivot at the shoulder. At rest the bow hangs by her side.
  const bowArm = pivot(0, 1.36, 0.19);
  bowArm.add(limb([0, 0, 0], [0.02, -0.26, 0.03], 0.05, 0.04, skin));
  bowArm.add(limb([0.02, -0.26, 0.03], [0.06, -0.5, 0.02], 0.042, 0.036, dark));
  const bow = longbow();
  bow.position.set(0.06, -0.52, 0.02);
  bow.rotation.z = 0.15;
  bowArm.add(bow);
  // Draw arm (right, -Z).
  const drawArm = pivot(0, 1.36, -0.19);
  drawArm.add(limb([0, 0, 0], [0.04, -0.26, -0.02], 0.05, 0.04, skin));
  drawArm.add(limb([0.04, -0.26, -0.02], [0.1, -0.48, 0.0], 0.042, 0.036, dark));
  const nock = M.mesh(M.tube([[-0.05, 0, 0], [0.4, 0, 0], [0.85, 0, 0]], 0.012, 0.012, 2, 5), M.mat('#6b4a2a'), 0.1, -0.48, 0);
  nock.visible = false;
  drawArm.add(nock);
  body.add(legL, legR, skirt, torso, belt, sash, neck, head, brow, ...eyes, ...ears, crown, tail, ...paulds, cape, quiver, bowArm, drawArm);
  body.scale.setScalar(1.35);
  // The renderer drives `staff` (raised while drawing); pose both arms from it.
  const staff = new THREE.Object3D();
  body.add(staff);
  let draw = 0;
  driver(body, (dt) => {
    const k = Math.min(1, Math.max(0, -staff.rotation.x / 0.9));
    draw += (k - draw) * Math.min(1, dt * 14);
    // Bow arm swings up and forward to shoulder height, bow held upright.
    bowArm.rotation.set(-0.35 * draw, 0, 1.35 * draw);
    bow.rotation.set(0, 0, 0.15 - 1.3 * draw);
    drawArm.rotation.set(0.5 * draw, 0.2 * draw, 1.25 * draw);
    nock.visible = draw > 0.5;
    tail.rotation.z = Math.sin(performance.now() / 700) * 0.03;
  });
  g.userData = { body, legL, legR, staff, kind: 'hero' };
  return g;
}

registerSkin('archer', archer);

// The arrow in flight: a shaft with a leaf-shaped head and pale fletching,
// on a shallow arc from bow height, and a faint streak behind it at night.
function arrowModel() {
  const g = new THREE.Group();
  g.add(M.mesh(M.tube([[-0.55, 0, 0], [0, 0, 0], [0.5, 0, 0]], 0.022, 0.022, 2, 6), M.mat('#6b4a2a')));
  g.add(M.mesh(M.scaled(M.G.cone, 0.055, 0.18, 0.02).rotateZ(-Math.PI / 2), M.mat('#cfd6e0', { metalness: 0.7, roughness: 0.3 }), 0.58, 0, 0));
  for (const r of [0, Math.PI / 2]) {
    const fl = M.mesh(M.scaled(M.G.box, 0.18, 0.012, 0.09), M.mat('#e8e0d0'), -0.46, 0, 0);
    fl.rotation.x = r;
    g.add(fl);
  }
  return g;
}

registerView('bowarrow', {
  make(e, world, v) {
    const g = new THREE.Group();
    const a = arrowModel();
    g.add(a);
    v.parts = { a };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const p = Math.min(1, Math.max(0, a.p + (b.p - a.p) * k));
    const d = b.d || 1;
    const lift = Math.min(1.1, d * 0.06);
    const h = 1.5 + Math.sin(p * Math.PI) * lift - p * 0.6;
    v.obj.position.y = h;
    // Pitch the arrow along its arc.
    const slope = (Math.cos(p * Math.PI) * Math.PI * lift - 0.6) / d;
    v.parts.a.rotation.z = Math.atan(slope);
    if (Math.random() < 0.6) world.fx.trail(v.x, h, v.z, '#c8d8ff', 0.18, 0.18, 0.02);
  },
});

// An arrow that found nobody: it sticks in the ground, quivering, then fades.
registerEvent('bowmiss', (e, world) => {
  const g = new THREE.Group();
  const a = arrowModel();
  a.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.transparent = true;
      o.userData.own = true;
    }
  });
  a.position.set(-0.35, 0, 0);
  g.add(a);
  g.position.set(e.x, 0.25, e.y);
  g.rotation.set(0, -e.f, -0.55);
  world.fx.dustCloud(e.x, e.y, 0.25, '#6a6a5a', 3);
  transient(world, g, 3, (k) => {
    a.rotation.x = k < 0.1 ? Math.sin(k * 180) * 0.12 * (1 - k * 10) : 0;
    const op = Math.min(1, (1 - k) * 4);
    a.traverse((o) => {
      if (o.isMesh) o.material.opacity = op;
    });
  });
  play('hit');
});
