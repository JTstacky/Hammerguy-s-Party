// Nature's Circle (#30): the Druid of the Wilds and its three forms (bear,
// quillbeast, hawk), their missiles and the morph effect.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';
import { pose, pivot, limb, octCorners, blobShadow } from './e-common.js';
import { play } from '../../engine/client/audio.js';

const ELF = '#7a6ab8';
// WC3 hover height is 240 u (4.4 u here); drawn lower so the hawk stays readable next to its selection circle.
const HOVER = 2.1;

// ------------------------------------------------------------ druid

// Druid of the Claw: a big night elf in hides and fur with antlers, a long
// green mane and beard, bear-claw bracers and a gnarled staff. Faces +X.
function druid(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = M.mat(ELF, { roughness: 0.6 });
  const hair = M.mat('#3a8a6a', { roughness: 0.6 });
  const fur = M.furMat('#a88a68');
  const leather = M.leatherMat('#8a9a6a');
  const antler = M.mat('#d8c8a0', { roughness: 0.6 });
  const team = M.mat(color, { roughness: 0.85, side: THREE.DoubleSide });
  const leg = (s) => {
    const hip = pivot(0, 0.82, 0.13 * s);
    hip.add(limb([0, 0, 0], [0.04, -0.4, 0], 0.1, 0.08, leather));
    hip.add(limb([0.04, -0.38, 0], [0, -0.76, 0], 0.08, 0.06, skin));
    hip.add(M.mesh(M.blob(0.1, 0.08, 0.09, { seed: 61 }), fur, 0.02, -0.72, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  const kilt = M.mesh(M.lathe([[0.2, 0.98], [0.26, 0.8], [0.32, 0.58]], 16), M.mat('#5a4a30', { roughness: 0.9, side: THREE.DoubleSide }));
  const torso = M.mesh(M.lathe([[0.2, 0.95], [0.24, 1.15], [0.3, 1.38], [0.28, 1.52], [0.14, 1.62], [0.06, 1.65]], 18), skin);
  torso.scale.set(0.9, 1, 1.15);
  const sash = M.mesh(new THREE.TorusGeometry(0.28, 0.04, 6, 22), team, 0, 1.28, 0);
  sash.rotation.set(Math.PI / 2, 0.6, 0);
  const mantle = new THREE.Group();
  for (const s of [1, -1]) mantle.add(M.mesh(M.blob(0.16, 0.1, 0.16, { seed: 62, amt: 0.14 }), fur, -0.02, 1.56, 0.26 * s));
  const head = pivot(0.08, 1.8, 0);
  head.add(M.mesh(M.blob(0.12, 0.14, 0.11, { seed: 63 }), skin, 0, 0, 0));
  head.add(M.mesh(M.blob(0.1, 0.16, 0.12, { seed: 64, amt: 0.1 }), hair, 0.08, -0.14, 0));
  head.add(M.mesh(M.blob(0.14, 0.12, 0.13, { seed: 65, amt: 0.1 }), hair, -0.05, 0.05, 0));
  head.add(M.mesh(M.tube([[-0.08, 0.02, 0], [-0.2, -0.2, 0], [-0.22, -0.5, 0]], 0.08, 0.03, 10, 8), hair));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.scaled(M.G.sphere, 0.022, 0.012, 0.024), M.glowMat('#fff2c0'), 0.11, 0.03, 0.045 * s));
    head.add(M.mesh(M.tube([[0, 0.02, 0.1 * s], [-0.06, 0.06, 0.18 * s], [-0.16, 0.12, 0.24 * s]], 0.03, 0.004, 6, 6), skin));
    // Antlers: a main beam with tines.
    head.add(M.mesh(M.tube([[0, 0.1, 0.06 * s], [-0.02, 0.28, 0.16 * s], [-0.1, 0.44, 0.3 * s], [-0.14, 0.56, 0.42 * s]], 0.035, 0.012, 14, 8), antler));
    head.add(M.mesh(M.tube([[-0.02, 0.28, 0.16 * s], [0.08, 0.4, 0.2 * s], [0.12, 0.5, 0.22 * s]], 0.022, 0.008, 6, 6), antler));
    head.add(M.mesh(M.tube([[-0.1, 0.44, 0.3 * s], [-0.02, 0.58, 0.32 * s]], 0.02, 0.006, 4, 6), antler));
  }
  const arm = (s) => {
    const a = pivot(0, 1.5, 0.34 * s);
    a.add(limb([0, 0, 0], [0.06, -0.34, 0.04 * s], 0.08, 0.07, skin));
    a.add(limb([0.06, -0.32, 0.04 * s], [0.2, -0.58, 0.02 * s], 0.07, 0.06, skin));
    a.add(M.mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 12), fur, 0.16, -0.5, 0.03 * s));
    return a;
  };
  const armL = arm(1);
  const armR = arm(-1);
  const staff = new THREE.Group();
  staff.position.set(0.22, 0.92, -0.36);
  staff.add(M.mesh(M.tube([[0, -0.9, 0], [0.03, 0, 0.02], [-0.02, 0.8, 0], [0.08, 1.0, 0.04]], 0.035, 0.025, 14, 8), M.barkMat()));
  staff.add(M.mesh(M.scaled(M.G.sphere, 0.07), M.glowMat('#8affb0'), 0.08, 1.04, 0.04));
  body.add(legL, legR, kilt, torso, sash, mantle, head, armL, armR, staff);
  body.scale.setScalar(1.35);
  g.userData = { body, legL, legR, staff, kind: 'hero' };
  return g;
}

// ------------------------------------------------------------ bear

// Four legs from one proxy: the renderer swings legL (rotation.z); this
// copies that swing to diagonal pairs, from the skin's tick.
function quadruped(legs, proxyL) {
  const s = proxyL.rotation.z;
  legs[0].rotation.z = s;
  legs[3].rotation.z = s;
  legs[1].rotation.z = -s;
  legs[2].rotation.z = -s;
}

// Druid bear form: a massive dark-brown bear with a hump, a broad head and
// snout, claws, and the druid's carved wooden armour plates. Faces +X.
function bear(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const fur = M.furMat('#7a5234');
  const dark = M.furMat('#4a3020');
  const wood = M.texMat('tex_wood.webp', '#5a4a2a', '#a8b088', 1);
  const team = M.mat(color, { roughness: 0.85 });
  body.add(M.mesh(M.blob(0.95, 0.62, 0.62, { seed: 71, amt: 0.08 }), fur, -0.1, 1.0, 0));
  body.add(M.mesh(M.blob(0.5, 0.5, 0.55, { seed: 72 }), fur, 0.4, 1.3, 0));
  const head = pivot(0.95, 1.12, 0);
  head.add(M.mesh(M.blob(0.3, 0.27, 0.28, { seed: 73 }), fur, 0, 0, 0));
  head.add(M.mesh(M.blob(0.2, 0.14, 0.15, { seed: 74 }), M.furMat('#a07850'), 0.25, -0.08, 0));
  head.add(M.mesh(M.scaled(M.G.sphere, 0.06, 0.045, 0.07), M.mat('#140c08', { roughness: 0.25 }), 0.44, -0.04, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.scaled(M.G.sphere, 0.03), M.glowMat('#ffe070'), 0.2, 0.08, 0.13 * s));
    head.add(M.mesh(M.blob(0.07, 0.08, 0.04, { seed: 75 }), dark, -0.08, 0.26, 0.18 * s));
    head.add(M.mesh(M.scaled(M.G.cone, 0.02, 0.07, 0.02).rotateZ(Math.PI), M.boneMat(), 0.32, -0.2, 0.06 * s));
  }
  body.add(head);
  // Carved armour: a saddle plate with a team-painted band and horned shoulder guards.
  body.add(M.mesh(M.blob(0.55, 0.14, 0.6, { seed: 76, amt: 0.05 }), wood, 0.1, 1.55, 0));
  const band = M.mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 24), team, 0.05, 1.2, 0);
  band.rotation.y = Math.PI / 2;
  body.add(band);
  for (const s of [1, -1]) body.add(M.mesh(M.tube([[0.5, 1.55, 0.35 * s], [0.45, 1.8, 0.5 * s], [0.3, 1.95, 0.55 * s]], 0.05, 0.01, 8, 8), M.boneMat()));
  const legs = [];
  for (const [x, z] of [[0.5, 0.36], [0.5, -0.36], [-0.6, 0.36], [-0.6, -0.36]]) {
    const hip = pivot(x, 0.9, z);
    hip.add(limb([0, 0.1, 0], [0.04, -0.45, 0], 0.2, 0.15, fur));
    hip.add(limb([0.04, -0.4, 0], [0.02, -0.82, 0], 0.15, 0.13, dark));
    for (let i = -1; i <= 1; i++) hip.add(M.mesh(M.scaled(M.G.cone, 0.02, 0.08, 0.02).rotateZ(-Math.PI / 2 - 0.6), M.boneMat(), 0.15, -0.86, i * 0.06));
    legs.push(hip);
    body.add(hip);
  }
  body.add(M.mesh(M.blob(0.1, 0.1, 0.1, { seed: 77 }), dark, -1.05, 1.1, 0));
  body.scale.setScalar(1.05);
  const legL = new THREE.Object3D();
  const legR = new THREE.Object3D();
  body.add(legL, legR);
  const staff = new THREE.Object3D();
  body.add(staff);
  const tick = () => {
    quadruped(legs, legL);
    // A swipe: rear up a little and throw the head forward.
    const k = Math.min(1.6, Math.max(0, -staff.rotation.x));
    head.rotation.z = -k * 0.25;
    body.rotation.z = k * 0.08;
  };
  g.userData = { body, legL, legR, staff, kind: 'hero', anim: [head, ...legs], tick };
  return g;
}

// ------------------------------------------------------------ quillbeast

// Quilbeast: a squat, tusked boar-like beast with a crest of long quills
// along its back that it flings. Faces +X.
function quillbeast(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const hide = M.triMat('tex_hide.webp', '#8a5a34', '#e0a070', 1.4);
  const belly = M.mat('#d8b890', { roughness: 0.8 });
  const quillM = M.mat('#efe6d0', { roughness: 0.5 });
  const tipM = M.mat('#2a1a10', { roughness: 0.5 });
  body.add(M.mesh(M.blob(0.7, 0.45, 0.5, { seed: 81, amt: 0.08 }), hide, 0, 0.7, 0));
  body.add(M.mesh(M.blob(0.5, 0.25, 0.4, { seed: 82 }), belly, 0.05, 0.45, 0));
  const head = pivot(0.68, 0.72, 0);
  head.add(M.mesh(M.blob(0.26, 0.22, 0.24, { seed: 83 }), hide, 0, 0, 0));
  head.add(M.mesh(M.blob(0.14, 0.1, 0.12, { seed: 84 }), M.mat('#6a3a2a'), 0.24, -0.06, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.tube([[0.22, -0.1, 0.08 * s], [0.34, -0.02, 0.14 * s], [0.36, 0.12, 0.12 * s]], 0.03, 0.006, 8, 6), M.boneMat()));
    head.add(M.mesh(M.scaled(M.G.sphere, 0.03), M.glowMat('#ff8030'), 0.16, 0.08, 0.12 * s));
    head.add(M.mesh(M.blob(0.08, 0.1, 0.04, { seed: 85 }), hide, -0.08, 0.2, 0.14 * s));
  }
  body.add(head);
  // The quill crest, longest over the shoulders, raked back.
  const quills = new THREE.Group();
  quills.position.y = 0.95;
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const x = 0.45 - t * 1.0;
    const z = ((i % 5) - 2) * 0.1;
    const len = 0.35 + Math.sin(t * Math.PI) * 0.35;
    const q = pivot(x, Math.sin(t * Math.PI) * 0.12, z);
    q.add(M.mesh(M.scaled(M.G.cone, 0.03, len, 0.03), quillM, 0, len / 2, 0));
    q.add(M.mesh(M.scaled(M.G.cone, 0.018, 0.1, 0.018), tipM, 0, len + 0.02, 0));
    q.rotation.z = 0.7 + t * 0.3;
    q.rotation.x = z * 1.8;
    quills.add(q);
  }
  body.add(quills);
  // Team-coloured beads braided into the crest.
  const beads = M.mesh(new THREE.TorusGeometry(0.46, 0.04, 6, 20), M.mat(color, { roughness: 0.7 }), 0.2, 0.7, 0);
  beads.rotation.y = Math.PI / 2;
  body.add(beads);
  const legs = [];
  for (const [x, z] of [[0.38, 0.3], [0.38, -0.3], [-0.4, 0.3], [-0.4, -0.3]]) {
    const hip = pivot(x, 0.55, z);
    hip.add(limb([0, 0, 0], [0.03, -0.28, 0], 0.12, 0.08, hide));
    hip.add(M.mesh(M.scaled(M.G.sphere, 0.08, 0.05, 0.07), M.mat('#2a1a10'), 0.03, -0.52, 0));
    hip.add(limb([0.03, -0.26, 0], [0.02, -0.5, 0], 0.08, 0.06, hide));
    legs.push(hip);
    body.add(hip);
  }
  body.add(M.mesh(M.tube([[-0.68, 0.72, 0], [-0.85, 0.6, 0], [-0.9, 0.45, 0]], 0.05, 0.015, 8, 6), hide));
  body.scale.setScalar(1.3);
  const legL = new THREE.Object3D();
  const legR = new THREE.Object3D();
  body.add(legL, legR);
  const staff = new THREE.Object3D();
  body.add(staff);
  const tick = () => {
    quadruped(legs, legL);
    // Bristle the quills when it fires: the crest rears up and fans out.
    const k = Math.min(1.6, Math.max(0, -staff.rotation.x));
    quills.rotation.z = -k * 0.2;
    quills.scale.set(1, 1 + k * 0.2, 1 + k * 0.15);
  };
  g.userData = { body, legL, legR, staff, kind: 'hero', anim: [quills, ...legs], tick };
  return g;
}

// ------------------------------------------------------------ hawk

// Hawk: a great storm-grey hawk hovering at about 4 u (WC3 hover height 240),
// broad wings beating, hooked golden beak, team-coloured jesses. Its shadow
// stays on the ground. Faces +X.
function hawk(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shadow = blobShadow(0.9, 0.35);
  g.add(shadow);
  const feathers = M.triMat('tex_fur.webp', '#6a5a4a', '#c8b8a8', 2.2);
  const pale = M.mat('#e8e0d0', { roughness: 0.7 });
  const flyer = pivot(0, HOVER, 0);
  flyer.add(M.mesh(M.blob(0.55, 0.28, 0.3, { seed: 91, amt: 0.06 }), feathers, 0, 0, 0));
  flyer.add(M.mesh(M.blob(0.3, 0.18, 0.2, { seed: 92 }), pale, 0.15, -0.14, 0));
  const head = pivot(0.55, 0.12, 0);
  head.add(M.mesh(M.blob(0.18, 0.16, 0.15, { seed: 93 }), pale, 0, 0, 0));
  head.add(M.mesh(M.tube([[0.14, 0.02, 0], [0.26, -0.02, 0], [0.3, -0.12, 0]], 0.05, 0.008, 8, 8), M.goldMat()));
  for (const s of [1, -1]) head.add(M.mesh(M.scaled(M.G.sphere, 0.03), M.glowMat('#ffd040'), 0.1, 0.05, 0.1 * s));
  flyer.add(head);
  // Tail fan.
  const tail = M.mesh(M.cloth(0.4, 0.5, 0.05, 0), M.mat('#5a4a3a', { side: THREE.DoubleSide }), -0.7, 0, 0);
  tail.rotation.z = Math.PI / 2;
  flyer.add(tail);
  // Wings: a shoulder pivot each, a long tapering feathered panel.
  const wing = (s) => {
    const w = pivot(0.05, 0.1, 0.2 * s);
    const sh = new THREE.Shape();
    sh.moveTo(0.25, 0);
    sh.quadraticCurveTo(0.2, 0.8, -0.15, 1.6);
    sh.lineTo(-0.4, 1.45);
    sh.lineTo(-0.35, 1.2);
    sh.lineTo(-0.5, 1.0);
    sh.lineTo(-0.45, 0.7);
    sh.lineTo(-0.55, 0.45);
    sh.quadraticCurveTo(-0.4, 0.1, -0.3, 0);
    const geo = new THREE.ShapeGeometry(sh, 8).rotateX((Math.PI / 2) * s);
    w.add(M.mesh(geo, M.mat('#5a4a3a', { roughness: 0.8, side: THREE.DoubleSide })));
    w.add(M.mesh(M.tube([[0.2, 0, 0], [0.05, 0, 0.8 * s], [-0.15, 0, 1.55 * s]], 0.06, 0.02, 8, 6), feathers));
    return w;
  };
  const wingL = wing(1);
  const wingR = wing(-1);
  flyer.add(wingL, wingR);
  // Talons with team jesses.
  for (const s of [1, -1]) {
    flyer.add(M.mesh(M.tube([[0.1, -0.2, 0.1 * s], [0.12, -0.38, 0.1 * s], [0.2, -0.45, 0.1 * s]], 0.03, 0.015, 6, 6), M.mat('#d8b040')));
    flyer.add(M.mesh(M.tube([[0.12, -0.35, 0.1 * s], [0.0, -0.55, 0.12 * s], [-0.1, -0.7, 0.1 * s]], 0.02, 0.02, 6, 6), M.mat(color, { roughness: 0.8 })));
  }
  body.add(flyer);
  body.scale.setScalar(1.25);
  const legL = new THREE.Object3D();
  const legR = new THREE.Object3D();
  const staff = new THREE.Object3D();
  body.add(legL, legR, staff);
  let beat = Math.random() * 6;
  const tick = pose((dt, t) => {
    const k = Math.min(1.6, Math.max(0, -staff.rotation.x));
    const moving = Math.abs(legL.rotation.z) > 0.01;
    beat += dt * (moving ? 9 : 6) + k * dt * 6;
    const a = Math.sin(beat) * 0.55;
    wingL.rotation.x = -a;
    wingR.rotation.x = a;
    flyer.position.y = HOVER + Math.sin(beat) * 0.08 + Math.sin(t * 1.3) * 0.1;
    head.rotation.z = -k * 0.3;
    shadow.scale.setScalar(1 + Math.sin(beat) * 0.05);
  });
  g.userData = { body, legL, legR, staff, kind: 'hero', anim: [flyer, head, wingL, wingR, shadow], tick };
  return g;
}

registerSkin('nc_druid', druid);
registerSkin('nc_bear', bear);
registerSkin('nc_quill', quillbeast);
registerSkin('nc_hawk', hawk);

// ------------------------------------------------------------ missiles

registerView('ncshot', {
  make(e, world, v) {
    const g = new THREE.Group();
    if (e.m === 'quill') {
      g.add(M.mesh(M.scaled(M.G.cone, 0.04, 0.45, 0.04).rotateZ(-Math.PI / 2), M.mat('#efe6d0'), 0, 0, 0));
      g.add(M.mesh(M.scaled(M.G.cone, 0.025, 0.12, 0.025).rotateZ(-Math.PI / 2), M.mat('#2a1a10'), 0.25, 0, 0));
      g.position.y = 1.1;
    } else {
      // The hawk's magic strike: a bolt of wind-blue light.
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), M.glowMat('#c8f0ff')));
      g.position.y = 2.8;
    }
    v.parts = { hawk: e.m !== 'quill', y0: g.position.y };
    return g;
  },
  update(v, a, b, k, dt, world) {
    // Hawk bolts dive from the hawk toward the target's chest.
    if (v.parts.hawk) {
      v.obj.position.y = Math.max(1.0, v.obj.position.y - dt * 4);
      world.fx.trail(v.x, v.obj.position.y, v.z, '#9fe0ff', 0.4, 0.25, 0.05);
    } else v.obj.position.y = 1.1;
  },
});

// Morph: a whirl of leaves and green light round the druid as it changes.
registerEvent('morph', (e, world) => {
  world.fx.burst(e.x, 1.2, e.y, '#7affa0', { n: 30, speed: 3, size: 0.5, life: 0.7 });
  world.fx.burst(e.x, 1.0, e.y, '#3a8a2a', { n: 20, speed: 3, size: 0.25, life: 1.0, up: 1.2, grav: 2, additive: false });
  world.fx.ring(e.x, e.y, 1.6, '#9affb0', 0.5);
  world.fx.glow(e.x, 1.4, e.y, '#9affb0', 3, 0.35);
  play('shield');
});

// The four Summer Tree Walls stand in the props; the builder dresses the cut corners.
registerMapBuilder('nature', (map, world) => {
  octCorners(world, map.floor.w / 2, map.cut || 3.4);
});
