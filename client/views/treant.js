// Treant Valley (#15): the valley's twelve trees (glowing green before they
// wake), the treants that step out of them, and the players' Gnoll skin.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerEvent, registerSkin } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { emit, glowDisc, swingPhase, ball, glowMat, bakeParts } from './dispel-fx.js';

// A treant: a walking tree. Root-footed legs, a bark trunk leaning forward with
// a knotted face and glowing green eyes, long branch arms ending in twig
// claws, and a leafy crown with branches poking out of it.
export function treant() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const bark = M.texMat('tex_bark.webp', '#5b3d22', '#c8b098', 1);
  const barkDark = M.texMat('tex_bark.webp', '#3e2a18', '#8a7460', 1);
  const leaves = M.triMat('tex_needles.webp', '#3b6e30', '#9ccf7a', 1.4, { roughness: 0.95 });
  const leavesDark = M.triMat('tex_needles.webp', '#2f5a28', '#78a860', 1.4, { roughness: 0.95 });
  const moss = M.mat('#5a7a34', { roughness: 0.95 });
  const glow = glowMat('#b8ff6a');
  const legs = [];
  for (const s of [1, -1]) {
    const hip = new THREE.Group();
    hip.position.set(0, 0.95, 0.22 * s);
    hip.add(M.mesh(M.tube([[0, 0.1, 0], [0.06, -0.45, 0.03 * s], [0, -0.85, 0.06 * s]], 0.2, 0.16, 6, 10), bark));
    // Roots splaying out as toes.
    for (const [dx, dz] of [[0.35, 0.05], [0.12, 0.28], [-0.25, 0.12]]) hip.add(M.mesh(M.tube([[0, -0.8, 0.06 * s], [dx * 0.6, -0.9, (0.06 + dz * 0.6) * s], [dx, -0.95, (0.06 + dz) * s]], 0.09, 0.02, 6, 6), barkDark));
    legs.push(hip);
    body.add(hip);
  }
  const torso = new THREE.Group();
  torso.rotation.z = -0.15; // leaning into the walk
  body.add(torso);
  torso.add(M.mesh(M.tube([[0, 0.8, 0], [0.05, 1.5, 0], [0.02, 2.2, 0], [-0.05, 2.6, 0]], 0.42, 0.34, 10, 14), bark));
  torso.add(M.mesh(M.blob(0.3, 0.14, 0.32, { seed: 111 }), moss, 0.25, 1.35, 0.1));
  // Face: a heavy brow, hollow eyes with a green glow, a gnarled nose, a gaping mouth.
  torso.add(M.mesh(M.blob(0.2, 0.08, 0.34, { seed: 112 }), barkDark, 0.36, 2.15, 0));
  for (const s of [1, -1]) {
    torso.add(M.mesh(ball(0.075, 0.06, 0.075), M.mat('#140c06'), 0.38, 2.04, 0.13 * s));
    torso.add(M.mesh(ball(0.045), glow, 0.42, 2.04, 0.13 * s));
  }
  torso.add(M.mesh(M.tube([[0.36, 2.0, 0], [0.5, 1.92, 0], [0.56, 1.8, 0]], 0.06, 0.02, 6, 6), barkDark));
  torso.add(M.mesh(ball(0.12, 0.07, 0.16), M.mat('#140c06'), 0.36, 1.72, 0));
  // Crown of leaves with branches sticking out.
  const crown = new THREE.Group();
  crown.position.set(-0.05, 2.75, 0);
  crown.add(M.mesh(M.blob(0.75, 0.55, 0.8, { seed: 113, amt: 0.2, freq: 3 }), leaves, 0, 0.2, 0));
  crown.add(M.mesh(M.blob(0.5, 0.4, 0.5, { seed: 114, amt: 0.2, freq: 3 }), leavesDark, -0.3, 0.55, 0.25));
  crown.add(M.mesh(M.blob(0.45, 0.35, 0.45, { seed: 115, amt: 0.2, freq: 3 }), leaves, 0.2, 0.6, -0.3));
  for (const [x, z, h] of [[0.3, 0.5, 0.9], [-0.4, -0.4, 1.1], [0.1, -0.6, 0.8]]) crown.add(M.mesh(M.tube([[0, 0, 0], [x * 0.6, h * 0.6, z * 0.6], [x, h, z]], 0.07, 0.015, 6, 6), bark));
  torso.add(crown);
  // Shoulder leaf clumps.
  for (const s of [1, -1]) torso.add(M.mesh(M.blob(0.4, 0.3, 0.38, { seed: 116 + (s > 0 ? 0 : 1), amt: 0.2, freq: 3 }), leavesDark, 0, 2.45, 0.42 * s));
  const arms = [];
  for (const s of [1, -1]) {
    const arm = new THREE.Group();
    arm.position.set(0, 2.3, 0.45 * s);
    arm.add(M.mesh(M.tube([[0, 0, 0], [0.2, -0.45, 0.2 * s], [0.45, -0.95, 0.12 * s], [0.7, -1.25, 0.02 * s]], 0.15, 0.08, 10, 10), bark));
    for (const [dx, dy, dz] of [[0.35, -0.2, 0.08], [0.3, -0.35, -0.1], [0.4, -0.05, -0.02]]) arm.add(M.mesh(M.tube([[0.7, -1.25, 0.02 * s], [0.7 + dx * 0.6, -1.25 + dy * 0.6, (0.02 + dz * 0.6) * s], [0.7 + dx, -1.25 + dy, (0.02 + dz) * s]], 0.05, 0.01, 5, 6), barkDark));
    arm.add(M.mesh(M.blob(0.22, 0.16, 0.2, { seed: 118 }), leaves, 0.25, -0.5, 0.25 * s));
    arms.push(arm);
    torso.add(arm);
  }
  body.scale.setScalar(1.2);
  g.userData = { body, legs, arms, torso, kind: 'beast' };
  return g;
}

registerView('vtreant', {
  make(e, world, v) {
    const g = bakeParts(treant());
    v.parts = g.userData;
    return g;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    // A slow, heavy stride.
    v.walk = (v.walk || 0) + dt * (b.mv ? 6 : 0);
    P.legs[0].rotation.z = Math.sin(v.walk) * 0.45 * (b.mv ? 1 : 0);
    P.legs[1].rotation.z = -Math.sin(v.walk) * 0.45 * (b.mv ? 1 : 0);
    P.body.position.y = b.mv ? Math.abs(Math.sin(v.walk)) * 0.08 : 0;
    P.torso.rotation.x = Math.sin(v.walk) * 0.05;
    // Attack: both branch arms come down in a clubbing sweep (the 'swing' event sets castT).
    const sw = swingPhase(v, dt, 0.8);
    P.arms.forEach((arm, i) => {
      arm.rotation.z = 1.2 * sw + (b.mv ? Math.sin(v.walk + i * Math.PI) * 0.25 : 0.05);
      arm.rotation.x = (i ? -1 : 1) * 0.15 * sw;
    });
    if (b.mv && emit(v, 'leaf', 1.5, dt)) world.fx.burst(v.x, 2.8, v.z, '#6aa040', { n: 1, speed: 0.6, size: 0.3, life: 1.4, up: 0.2, grav: 0.8, additive: false });
  },
});

// One of the valley's trees. Before it wakes it glows green for 2 s (WC3's
// TargetArtLumber): a glowing ring at its foot and motes spiralling up.
registerView('vtree', {
  make(e, world, v) {
    const g = new THREE.Group();
    const t = M.tree(1.35);
    g.add(t);
    const ring = glowDisc('#7aff4a', 1.8, 0);
    g.add(ring);
    v.parts = { t, ring };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const p = v.parts;
    const on = b.g != null;
    const g = b.g ?? 0;
    p.ring.material.opacity = on ? 0.45 + 0.25 * Math.sin(world.time * 10) : 0;
    p.ring.scale.setScalar(1.6 + g * 0.8);
    // The tree shudders as it wakes.
    p.t.rotation.z = on ? Math.sin(world.time * 30) * 0.03 * g : 0;
    p.t.rotation.x = on ? Math.cos(world.time * 26) * 0.03 * g : 0;
    if (on) {
      for (let n = emit(v, 'mote', 30, dt); n > 0; n--) {
        const ang = world.time * 3 + Math.random() * Math.PI * 2;
        const r = 0.6 + Math.random() * 0.8;
        world.fx.trail(v.x + Math.cos(ang) * r, 0.2 + Math.random() * 3.5, v.z + Math.sin(ang) * r, '#9aff5a', 0.45, 0.7, 0.1);
      }
    }
    v.obj.rotation.y = 0;
    return false;
  },
});

registerEvent('treeglow', (e, world) => {
  world.fx.ring(e.x, e.y, 2.2, '#8aff5a', 0.6, 0.1);
  world.fx.glow(e.x, 1.5, e.y, '#9aff5a', 4, 0.5);
  play('zap');
});

// The tree bursts apart and a treant stands in its place.
registerEvent('treantrise', (e, world) => {
  const fx = world.fx;
  fx.burst(e.x, 2.5, e.y, '#5a9a38', { n: 40, speed: 5, size: 0.45, life: 1.2, up: 0.8, grav: 5, additive: false });
  fx.burst(e.x, 1.2, e.y, '#6a4a2a', { n: 18, speed: 4, size: 0.35, life: 0.9, up: 1, grav: 12, additive: false });
  fx.dustCloud(e.x, e.y, 1.2, '#7a6a4a', 10);
  fx.glow(e.x, 1.5, e.y, '#9aff5a', 5, 0.4);
  fx.shockwave(e.x, e.y, 2.5, '#b8ff9a', 0.5);
  world.shake = 0.15;
  play('smack');
});

// ------------------------------------------------------------ the player unit

// The Gnoll (`ngno`): a hunched hyena-man with a long spotted muzzle, round
// ears, a dark bristling mane down the neck, digitigrade legs and a stub of
// tail, in a leather harness with a team-coloured loincloth and shoulder rag,
// carrying a studded club.
export function gnoll(color) {
  const { mesh, blob, tube, mat } = M;
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(1.3);
  g.add(body);
  const fur = M.furMat('#e8c890');
  const furLight = mat('#e0c49a', { roughness: 0.85 });
  const mane = M.furMat('#6a4a2a');
  const spot = mat('#6a4a2c', { roughness: 0.9 });
  const leather = M.leatherMat('#b08060');
  const team = mat(color, { roughness: 0.85, side: THREE.DoubleSide });
  const dark = mat('#140c06', { roughness: 0.35 });
  const wood = M.texMat('tex_wood.webp', '#6a4a2a', '#c8a070');
  const iron = mat('#8a8c92', { metalness: 0.7, roughness: 0.35 });
  const tooth = mat('#f0e8d0', { roughness: 0.5 });
  const eye = glowMat('#ffb030');

  // Digitigrade legs: thigh, back-bent shin, paw.
  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(-0.05, 0.62, 0.14 * s);
    hip.add(mesh(tube([[0, 0, 0], [0.14, -0.22, 0.02 * s], [0.0, -0.44, 0.02 * s], [0.05, -0.6, 0.02 * s]], 0.1, 0.05, 8, 8), fur));
    hip.add(mesh(blob(0.1, 0.045, 0.08, { seed: 221, detail: 1 }), furLight, 0.1, -0.6, 0.02 * s));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  // Torso leaning forward: a deep chest, a leaner belly, spots on the flanks.
  const chest = mesh(blob(0.26, 0.26, 0.24, { seed: 222, amt: 0.06, detail: 2 }), fur, 0.08, 0.98, 0);
  chest.rotation.z = -0.45;
  const belly = mesh(blob(0.18, 0.18, 0.18, { seed: 223, detail: 2 }), furLight, 0.02, 0.72, 0);
  body.add(chest, belly);
  for (const [x, y, z] of [[-0.04, 1.04, 0.2], [0.1, 0.9, -0.22], [-0.1, 0.86, -0.18], [0.02, 1.12, -0.16], [0.16, 1.02, 0.2]]) body.add(mesh(ball(0.05, 0.04, 0.02), spot, x, y, z));
  // Bristling mane from the crown down the back of the neck.
  for (let i = 0; i < 5; i++) {
    const tuft = mesh(new THREE.ConeGeometry(0.06, 0.2, 6), mane, 0.1 - i * 0.09, 1.3 - i * 0.07, 0);
    tuft.rotation.z = 0.9 + i * 0.1;
    body.add(tuft);
  }
  // Harness, loincloth, shoulder rag.
  const strap = mesh(tube([[0.2, 1.18, 0.18], [0.26, 0.9, 0], [0.16, 0.66, -0.2]], 0.03, 0.03, 8, 5), leather);
  const belt = mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 18).rotateX(Math.PI / 2), leather, 0.02, 0.62, 0);
  const loin = mesh(M.cloth(0.26, 0.34, 0.03, -0.02), team, 0.2, 0.47, 0);
  loin.rotation.y = Math.PI;
  const rag = mesh(new THREE.SphereGeometry(0.16, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), team, 0.02, 1.16, 0.25);
  rag.rotation.x = 0.6;
  body.add(strap, belt, loin, rag);
  // Tail.
  body.add(mesh(tube([[-0.2, 0.7, 0], [-0.36, 0.64, 0], [-0.46, 0.5, 0]], 0.06, 0.02, 6, 6), mane));
  // Head: hyena skull with a long muzzle, black nose, round ears, glinting eyes.
  const head = new THREE.Group();
  head.position.set(0.36, 1.3, 0);
  head.add(mesh(blob(0.15, 0.14, 0.14, { seed: 224, detail: 2 }), fur, 0, 0, 0));
  head.add(mesh(blob(0.16, 0.08, 0.09, { seed: 225, detail: 2 }), furLight, 0.16, -0.05, 0));
  head.add(mesh(ball(0.04, 0.03, 0.04), dark, 0.31, -0.02, 0));
  head.add(mesh(ball(0.12, 0.02, 0.07), dark, 0.2, -0.1, 0));
  for (const s of [1, -1]) {
    head.add(mesh(ball(0.026), eye, 0.12, 0.05, 0.075 * s));
    const ear = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.025, 12), fur, -0.02, 0.15, 0.1 * s);
    ear.rotation.set(Math.PI / 2 - 0.3 * s, 0, 0.3);
    head.add(ear, mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 10), spot, -0.01, 0.15, 0.1 * s).rotateX(Math.PI / 2 - 0.3 * s));
    const fang = mesh(new THREE.ConeGeometry(0.014, 0.05, 5), tooth, 0.26, -0.1, 0.035 * s);
    fang.rotation.z = Math.PI;
    head.add(fang);
  }
  body.add(head);
  // Arms: the left hangs, the right holds the club (the "staff" the swing raises).
  const armL = mesh(tube([[0.12, 1.14, 0.26], [0.2, 0.92, 0.3], [0.32, 0.76, 0.24]], 0.07, 0.055, 8, 8), fur);
  const pawL = mesh(ball(0.065), furLight, 0.34, 0.73, 0.23);
  const club = new THREE.Group();
  club.position.set(0.12, 1.14, -0.26);
  club.add(mesh(tube([[0, 0, 0], [0.1, -0.2, -0.04], [0.22, -0.34, -0.02]], 0.07, 0.055, 8, 8), fur));
  club.add(mesh(ball(0.065), furLight, 0.24, -0.36, -0.02));
  club.add(mesh(tube([[0.24, -0.5, -0.02], [0.28, -0.2, -0.02], [0.33, 0.25, -0.02]], 0.035, 0.085, 8, 8), wood));
  for (const [y, a] of [[0.05, 0], [0.12, 2.1], [0.19, 4.2], [0.0, 1.0], [0.16, 3.1]]) {
    const stud = mesh(new THREE.ConeGeometry(0.025, 0.08, 6), iron, 0.31 + Math.cos(a) * 0.075, y, -0.02 + Math.sin(a) * 0.075);
    stud.rotation.set(Math.sin(a) * 1.57, 0, -Math.cos(a) * 1.57);
    club.add(stud);
  }
  body.add(legL, legR, armL, pawL, club);
  g.userData = { body, legL, legR, staff: club, kind: 'hero' };
  return g;
}

registerSkin('gnoll', gnoll);
