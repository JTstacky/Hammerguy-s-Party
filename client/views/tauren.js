// The Tauren Tragedy (#10): tauren chieftains, the footman swarm, the
// barracks they pour out of, Shockwave and War Stomp.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';
import { driver, pivot, limb, octCorners, stunStars, transient } from './e-common.js';
import { play } from '../../engine/client/audio.js';

// ------------------------------------------------------------ tauren

// A tauren's great totem: a thick carved log with a painted animal face,
// bound in hide, with feathers hanging off the head.
function totem() {
  const g = new THREE.Group();
  const wood = M.texMat('tex_wood.webp', '#6a4a2a', '#c8a888', 1);
  g.add(M.mesh(M.tube([[0, -0.55, 0], [0.01, 0.2, 0], [0, 0.75, 0]], 0.06, 0.07, 6, 10), wood));
  g.add(M.mesh(M.lathe([[0.02, 0.62], [0.2, 0.66], [0.24, 0.85], [0.22, 1.12], [0.18, 1.2], [0.02, 1.24]], 14), wood));
  // Painted eyes and a beak on the head.
  for (const s of [1, -1]) g.add(M.mesh(M.scaled(M.G.sphere, 0.05, 0.035, 0.03), M.mat('#e0d060'), 0.2, 1.02, 0.08 * s));
  g.add(M.mesh(M.scaled(M.G.cone, 0.06, 0.16, 0.05).rotateZ(-Math.PI / 2), M.mat('#b04020'), 0.28, 0.94, 0));
  g.add(M.mesh(new THREE.TorusGeometry(0.235, 0.03, 6, 16).rotateX(Math.PI / 2), M.leatherMat('#c0a080'), 0, 0.7, 0));
  for (const s of [1, -1]) g.add(M.mesh(M.tube([[0, 1.15, 0.18 * s], [-0.05, 1.0, 0.26 * s], [-0.06, 0.8, 0.28 * s]], 0.03, 0.01, 6, 6), M.mat('#e8e0d0')));
  return g;
}

// Tauren Chieftain: a towering bull-man in brown fur, broad hunched
// shoulders and a heavy mane, long horns sweeping out and forward, a team
// kilt, hooves, and a totem over the shoulder. Faces +X.
function tauren(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const fur = M.furMat('#c89868');
  const furDark = M.furMat('#8a6040');
  const hide = M.hideMat();
  const horn = M.boneMat();
  const team = M.mat(color, { roughness: 0.85, side: THREE.DoubleSide });
  const leg = (s) => {
    const hip = pivot(-0.02, 0.8, 0.2 * s);
    hip.add(limb([0, 0, 0], [0.1, -0.38, 0], 0.17, 0.12, fur));
    hip.add(limb([0.1, -0.36, 0], [-0.02, -0.72, 0], 0.11, 0.08, fur));
    hip.add(M.mesh(M.blob(0.12, 0.07, 0.11, { seed: 3 }), M.mat('#2a2018', { roughness: 0.5 }), 0.02, -0.76, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  const kilt = M.mesh(M.lathe([[0.3, 0.95], [0.34, 0.8], [0.4, 0.55], [0.41, 0.52]], 18), team);
  const belt = M.mesh(new THREE.TorusGeometry(0.31, 0.045, 6, 22).rotateX(Math.PI / 2), M.leatherMat('#8a6a4a'), 0, 0.93, 0);
  // Barrel chest leaning forward and a hump of mane over the shoulders.
  const chest = M.mesh(M.blob(0.42, 0.48, 0.46, { seed: 11, amt: 0.06 }), fur, 0.06, 1.32, 0);
  const belly = M.mesh(M.blob(0.34, 0.3, 0.36, { seed: 12 }), fur, 0.08, 1.0, 0);
  const mane = M.mesh(M.blob(0.36, 0.3, 0.5, { seed: 13, amt: 0.14 }), furDark, -0.12, 1.7, 0);
  // Head: a bull's head thrust forward on the mane, with a muzzle, nose
  // ring, ears and long curving horns.
  const head = pivot(0.34, 1.78, 0);
  head.add(M.mesh(M.blob(0.2, 0.2, 0.19, { seed: 14 }), fur, 0, 0, 0));
  head.add(M.mesh(M.blob(0.15, 0.12, 0.14, { seed: 15 }), M.mat('#6a4a38', { roughness: 0.6 }), 0.2, -0.08, 0));
  head.add(M.mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12), M.goldMat(), 0.34, -0.14, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.scaled(M.G.sphere, 0.028), M.mat('#140c08', { roughness: 0.2 }), 0.15, 0.06, 0.12 * s));
    head.add(M.mesh(M.tube([[0.02, 0.12, 0.14 * s], [0.02, 0.22, 0.34 * s], [0.14, 0.38, 0.5 * s], [0.34, 0.42, 0.5 * s]], 0.07, 0.012, 14, 10), horn));
    const ear = M.mesh(M.blob(0.1, 0.04, 0.06, { seed: 16 }), fur, -0.06, 0.02, 0.22 * s);
    ear.rotation.x = 0.5 * s;
    head.add(ear);
  }
  // Braids hanging from the mane.
  for (const s of [1, -1]) body.add(M.mesh(M.tube([[0.2, 1.72, 0.2 * s], [0.26, 1.5, 0.24 * s], [0.26, 1.28, 0.22 * s]], 0.04, 0.025, 8, 6), furDark));
  // Arms: the totem arm (right, -Z) and a huge fist on the left.
  const armL = pivot(0.02, 1.52, 0.42);
  armL.add(limb([0, 0, 0], [0.12, -0.36, 0.06], 0.14, 0.11, fur));
  armL.add(limb([0.12, -0.34, 0.06], [0.28, -0.6, 0.02], 0.11, 0.09, fur));
  armL.add(M.mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 12), hide, 0.22, -0.5, 0.03));
  armL.add(M.mesh(M.blob(0.1, 0.09, 0.09, { seed: 17 }), fur, 0.3, -0.64, 0.02));
  const armR = pivot(0.02, 1.52, -0.42);
  armR.add(limb([0, 0, 0], [0.1, -0.32, -0.06], 0.14, 0.11, fur));
  armR.add(limb([0.1, -0.3, -0.06], [0.3, -0.42, -0.06], 0.11, 0.09, fur));
  armR.add(M.mesh(M.blob(0.1, 0.09, 0.09, { seed: 18 }), fur, 0.34, -0.44, -0.06));
  const club = totem();
  club.position.set(0.34, -0.44, -0.06);
  club.rotation.set(0, 0, -0.6);
  armR.add(club);
  // Shoulder pads of hide and a necklace of teeth.
  for (const s of [1, -1]) body.add(M.mesh(M.blob(0.2, 0.1, 0.18, { seed: 19 }), hide, 0.02, 1.64, 0.4 * s));
  const neckl = M.mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 20), M.boneMat(), 0.2, 1.6, 0);
  neckl.rotation.y = Math.PI / 2;
  neckl.rotation.z = 0.5;
  body.add(legL, legR, kilt, belt, belly, chest, mane, head, armL, armR, neckl);
  body.add(M.mesh(M.tube([[-0.36, 0.9, 0], [-0.55, 0.6, 0], [-0.52, 0.35, 0]], 0.04, 0.02, 8, 6), furDark));
  body.scale.setScalar(1.45);
  const staff = new THREE.Object3D();
  body.add(staff);
  driver(body, () => {
    // Swings and casts: raise the totem overhead and bring it down.
    const k = Math.min(1.6, Math.max(0, -staff.rotation.x));
    armR.rotation.z = k * 1.5;
    armR.rotation.x = -k * 0.3;
    armL.rotation.z = k * 0.4;
    head.rotation.z = -k * 0.15;
  });
  g.userData = { body, legL, legR, staff, kind: 'hero' };
  return g;
}

registerSkin('tauren', tauren);

// ------------------------------------------------------------ footman

const P12 = '#4e2a04'; // Player 12 brown
const P12_LIGHT = '#8a5a24';

// A Lordaeron footman: plate over mail, a brown Player 12 tabard, a nasal
// helm, a round shield with a boss on the left arm and a sword. Faces +X.
function footman() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const steel = M.plateMat();
  const mail = M.mat('#7a7e86', { metalness: 0.6, roughness: 0.5 });
  const tab = M.mat(P12, { roughness: 0.85, side: THREE.DoubleSide });
  const skin = M.mat('#d8a888', { roughness: 0.7 });
  const leg = (s) => {
    const hip = pivot(0, 0.55, 0.09 * s);
    hip.add(limb([0, 0, 0], [0.02, -0.26, 0], 0.075, 0.06, mail));
    hip.add(limb([0.02, -0.25, 0], [0, -0.5, 0], 0.065, 0.055, steel));
    hip.add(M.mesh(M.scaled(M.G.sphere, 0.09, 0.05, 0.07), steel, 0.04, -0.52, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  const torso = M.mesh(M.lathe([[0.16, 0.55], [0.19, 0.7], [0.21, 0.88], [0.2, 0.98], [0.12, 1.05], [0.06, 1.08]], 16), steel);
  torso.scale.set(0.9, 1, 1.15);
  const tabard = M.mesh(M.cloth(0.22, 0.5, 0.05), tab, 0.19, 0.64, 0);
  tabard.rotation.y = Math.PI;
  const trim = M.mesh(new THREE.TorusGeometry(0.18, 0.02, 6, 20).rotateX(Math.PI / 2), M.mat(P12_LIGHT), 0, 0.6, 0);
  const helm = M.mesh(M.lathe([[0.12, 1.07], [0.14, 1.14], [0.145, 1.24], [0.12, 1.32], [0.05, 1.36], [0.01, 1.37]], 18), steel);
  const face = M.mesh(M.scaled(M.G.sphere, 0.08, 0.07, 0.09), skin, 0.08, 1.15, 0);
  const nasal = M.mesh(M.scaled(M.G.box, 0.02, 0.12, 0.025), steel, 0.145, 1.17, 0);
  const crest = M.mesh(M.scaled(M.G.box, 0.2, 0.04, 0.02), M.mat(P12_LIGHT), -0.01, 1.35, 0);
  const paulds = [1, -1].map((s) => M.mesh(new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), steel, 0, 0.96, 0.21 * s));
  // Shield arm (left, +Z).
  const shieldArm = pivot(0.02, 0.95, 0.24);
  shieldArm.add(limb([0, 0, 0], [0.1, -0.25, 0.02], 0.05, 0.045, mail));
  const shield = new THREE.Group();
  shield.position.set(0.16, -0.26, 0.06);
  const disc = M.mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 22).rotateX(Math.PI / 2), M.texMat('tex_wood.webp', '#6a4a2a', '#b8987a', 1), 0, 0, 0);
  const rim = M.mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 24), steel, 0, 0, 0);
  const boss = M.mesh(M.scaled(M.G.sphere, 0.07, 0.07, 0.04), M.goldMat(), 0, 0, 0.03);
  const band = M.mesh(M.scaled(M.G.box, 0.08, 0.42, 0.045), M.mat(P12), 0, 0, 0.005);
  shield.add(disc, rim, band, boss);
  shield.rotation.y = -0.5;
  shieldArm.add(shield);
  // Sword arm (right, -Z).
  const swordArm = pivot(0.02, 0.95, -0.24);
  swordArm.add(limb([0, 0, 0], [0.12, -0.24, -0.02], 0.05, 0.045, mail));
  const sword = new THREE.Group();
  sword.position.set(0.14, -0.26, -0.02);
  sword.add(M.mesh(M.scaled(M.G.box, 0.035, 0.62, 0.012), M.silverMat(), 0, 0.38, 0));
  sword.add(M.mesh(M.scaled(M.G.box, 0.03, 0.03, 0.18), M.goldMat(), 0, 0.06, 0));
  sword.add(M.mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8), M.leatherMat(), 0, 0, 0));
  sword.rotation.z = -0.9;
  swordArm.add(sword);
  body.add(legL, legR, torso, tabard, trim, helm, face, nasal, crest, ...paulds, shieldArm, swordArm);
  body.scale.setScalar(1.25);
  g.userData = { body, legL, legR, swordArm };
  return g;
}

registerView('footman', {
  make(e, world, v) {
    const g = footman();
    v.parts = g.userData;
    v.walk = Math.random() * 6;
    return g;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    const moving = b.mv && !b.st;
    v.walk += dt * (moving ? 13 : 0);
    P.legL.rotation.z = moving ? Math.sin(v.walk) * 0.55 : 0;
    P.legR.rotation.z = moving ? -Math.sin(v.walk) * 0.55 : 0;
    P.body.position.y = moving ? Math.abs(Math.sin(v.walk)) * 0.06 : 0;
    // Chop: raise during the 0.5 s wind-up, cut down at the end.
    v.sw = Math.max(0, Math.min(1, (v.sw || 0) + dt * (b.sw ? 2.2 : -6)));
    P.swordArm.rotation.z = v.sw * 1.6;
    P.swordArm.rotation.x = -v.sw * 0.4;
    if (b.st) stunStars(world, v.x, v.z, 2.0, world.time + v.id);
  },
});

// ------------------------------------------------------------ barracks

// A human barracks: a fieldstone footing, timbered plaster walls under a
// steep red-brown roof, a great doorway facing south, a banner and a
// weathervane. It is invulnerable and sits in the middle as a solid block.
function barracks() {
  const g = new THREE.Group();
  const stone = M.texMat('tex_stone.webp', '#8a8478', '#d8d2c8', 1);
  const wood = M.texMat('tex_wood.webp', '#6a4a2a', '#c09a78', 1);
  const plaster = M.mat('#d8ccb0', { roughness: 0.9 });
  const roof = M.texMat('tex_wood.webp', '#7a3a24', '#b86a50', 1);
  const S = 2.3;
  // Footing: an octagonal stone plinth.
  g.add(M.mesh(new THREE.CylinderGeometry(S * 1.12, S * 1.2, 0.5, 8), stone, 0, 0.25, 0));
  // Walls.
  const walls = M.mesh(new THREE.BoxGeometry(S * 1.6, 1.7, S * 1.6), plaster, 0, 1.35, 0);
  g.add(walls);
  // Timber framing on each face.
  for (let f = 0; f < 4; f++) {
    const a = (f * Math.PI) / 2;
    const cx = Math.cos(a) * S * 0.81;
    const cz = Math.sin(a) * S * 0.81;
    for (const t of [-0.75, 0, 0.75]) {
      const post = M.mesh(new THREE.BoxGeometry(0.12, 1.72, 0.12), wood, cx - Math.sin(a) * t * S, 1.35, cz + Math.cos(a) * t * S);
      g.add(post);
    }
    const beam = M.mesh(new THREE.BoxGeometry(0.12, 0.12, S * 1.64), wood, cx, 2.15, cz);
    beam.rotation.y = -a;
    g.add(beam);
  }
  // Steep hip roof.
  const r = M.mesh(new THREE.ConeGeometry(S * 1.35, 2.2, 4, 1), roof, 0, 3.3, 0);
  r.rotation.y = Math.PI / 4;
  g.add(r);
  g.add(M.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), M.mat('#2a2a2c', { metalness: 0.6 }), 0, 4.7, 0));
  g.add(M.mesh(M.scaled(M.G.box, 0.4, 0.2, 0.02), M.mat('#2a2a2c', { metalness: 0.6 }), 0.15, 5.0, 0));
  // Doorway with a round arch on the south face (+Z is south on screen).
  const door = M.mesh(new THREE.CircleGeometry(0.55, 16, 0, Math.PI), M.mat('#140c08'), 0, 0.95, S * 0.805);
  const doorLow = M.mesh(M.scaled(M.G.box, 1.1, 0.5, 0.02), M.mat('#140c08'), 0, 0.72, S * 0.805);
  const arch = M.mesh(new THREE.TorusGeometry(0.58, 0.08, 6, 16, Math.PI), stone, 0, 0.95, S * 0.81);
  g.add(door, doorLow, arch);
  // Chimney and a banner pole.
  g.add(M.mesh(new THREE.BoxGeometry(0.4, 1.4, 0.4), stone, S * 0.45, 3.6, -S * 0.3));
  g.add(M.mesh(M.tube([[S * 0.9, 0.5, S * 0.9], [S * 0.9, 2.5, S * 0.9], [S * 0.9, 4.2, S * 0.9]], 0.05, 0.04), M.mat('#dcdcdc')));
  const flag = M.mesh(M.cloth(0.8, 1.1, 0.03, 0.1), M.mat('#2050c8', { side: THREE.DoubleSide }), S * 0.9 + 0.02, 3.55, S * 0.9);
  flag.rotation.y = Math.PI / 2;
  g.add(flag);
  g.add(M.mesh(M.scaled(M.G.box, 0.05, 0.5, 0.3), M.goldMat(), S * 0.9 + 0.05, 3.6, S * 0.9 + 0.35));
  return g;
}

registerMapBuilder('tauren', (map, world) => {
  const b = barracks();
  world.mapGroup.add(b);
  const hw = map.floor.w / 2;
  octCorners(world, hw, map.cut || 5);
  // A trampled dirt apron round the barracks.
  const apron = new THREE.Mesh(new THREE.CircleGeometry(4.4, 40).rotateX(-Math.PI / 2), M.texMat('tex_dirt.webp', '#7a6448', '#c0ac90', 3, { transparent: true, opacity: 0.85, depthWrite: false }));
  apron.position.y = 0.02;
  apron.receiveShadow = true;
  world.mapGroup.add(apron);
});

// ------------------------------------------------------------ spells

// Shockwave: a wave of force tearing along the ground, throwing up dirt
// and rock spikes as it goes, 800 u at 1050 u/s.
registerEvent('shockwave', (e, world) => {
  const dur = e.len / e.sp;
  const ca = Math.cos(e.f);
  const sa = Math.sin(e.f);
  const g = new THREE.Group();
  let last = 0;
  transient(world, g, dur + 0.6, (k) => {
    const t = Math.min(1, (k * (dur + 0.6)) / dur);
    const d = t * e.len;
    const x = e.x + ca * d;
    const z = e.y + sa * d;
    while (last + 0.35 <= d) {
      last += 0.35;
      const px = e.x + ca * last;
      const pz = e.y + sa * last;
      world.fx.dustCloud(px, pz, 0.55, '#8a7458', 2);
      if (Math.random() < 0.5) world.fx.debrisBurst(px, pz, 2, 2.5);
    }
    if (t < 1) world.fx.glow(x, 0.5, z, '#ffe0b0', 1.8, 0.15);
  });
  world.fx.sparks(e.x, 1, e.y, 10, 4, '#ffe0a0');
  world.shake = Math.max(world.shake || 0, 0.15);
  play('thrust');
});

// War Stomp: the ground cracks in a ring, dust and stones fly.
registerEvent('warstomp', (e, world) => {
  world.fx.shockwave(e.x, e.y, e.r, '#ffe8c0', 0.5);
  world.fx.ring(e.x, e.y, e.r, '#fff0c8', 0.4);
  world.fx.dustCloud(e.x, e.y, e.r * 0.45, '#9a8466', 16);
  world.fx.debrisBurst(e.x, e.y, 14, 6);
  world.fx.scorch(e.x, e.y, e.r * 0.5, 4);
  world.shake = Math.max(world.shake || 0, 0.25);
  play('bigboom');
});

// A footman gibbed (Player 12 units explode on death).
registerEvent('gib', (e, world) => {
  world.fx.burst(e.x, 0.9, e.y, '#8a1010', { n: 16, speed: 4, size: 0.35, life: 0.6, up: 1.2, grav: 12, additive: false });
  world.fx.burst(e.x, 0.8, e.y, '#9aa0a8', { n: 6, speed: 4, size: 0.25, life: 0.7, up: 1.5, grav: 14, additive: false });
  world.fx.dustCloud(e.x, e.y, 0.35, '#6a5040', 3);
  play('squish');
});
