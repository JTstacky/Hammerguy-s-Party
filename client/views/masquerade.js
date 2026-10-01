// The Masquerade (#25): dreadlords, villagers, vampire dens, the town
// square and its day/night cycle.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerMapBuilder, registerTheme } from '../../engine/client/render/registry.js';
import { pose, pivot, limb, octCorners, lerp } from './e-common.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { play } from '../../engine/client/audio.js';

// ------------------------------------------------------------ dreadlord

// A bat wing: a membrane with a scalloped trailing edge between bony
// fingers, spreading from the shoulder toward -X/+Y (drawn for the +Z side).
function batWing(side) {
  const g = new THREE.Group();
  const bone = M.mat('#3a2c3c', { roughness: 0.5 });
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.lineTo(-0.35, 0.75);
  sh.lineTo(-0.95, 0.95);
  sh.quadraticCurveTo(-0.85, 0.55, -1.0, 0.3);
  sh.quadraticCurveTo(-0.7, 0.25, -0.75, -0.05);
  sh.quadraticCurveTo(-0.45, 0.0, -0.4, -0.3);
  sh.quadraticCurveTo(-0.2, -0.1, 0, 0);
  const mem = M.mesh(new THREE.ShapeGeometry(sh, 10), M.mat('#3c1c3a', { roughness: 0.7, side: THREE.DoubleSide, emissive: '#1a0414', emissiveIntensity: 0.4 }));
  g.add(mem);
  for (const tip of [[-0.95, 0.95], [-1.0, 0.3], [-0.75, -0.05], [-0.4, -0.3]]) g.add(M.mesh(M.tube([[0, 0, 0], [tip[0] * 0.5, tip[1] * 0.55 + 0.05, 0], [tip[0], tip[1], 0]], 0.03, 0.01, 6, 6), bone));
  g.add(M.mesh(M.scaled(M.G.cone, 0.03, 0.14, 0.03), M.boneMat(), -0.35, 0.8, 0));
  g.rotation.y = side * 0.55;
  return g;
}

// Dreadlord: a tall nathrezim in dark violet plate, pale purple skin, great
// ram horns, glowing green eyes, clawed hands, a tail and folded bat wings.
function dreadlord(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = M.mat('#9a88b0', { roughness: 0.55 });
  const plate = M.texMat('tex_plate.webp', '#3a2c48', '#8a70a8', 1, { metalness: 0.5, roughness: 0.4 });
  const dark = M.mat('#221a2a', { metalness: 0.3, roughness: 0.5 });
  const team = M.mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  const horn = M.mat('#2a2230', { roughness: 0.45 });
  const leg = (s) => {
    const hip = pivot(0, 0.82, 0.12 * s);
    hip.add(limb([0, 0, 0], [0.08, -0.36, 0], 0.09, 0.07, plate));
    hip.add(limb([0.08, -0.34, 0], [-0.04, -0.62, 0], 0.07, 0.05, skin));
    hip.add(limb([-0.04, -0.6, 0], [0.02, -0.8, 0], 0.05, 0.04, dark));
    hip.add(M.mesh(M.blob(0.08, 0.04, 0.06, { seed: 3 }), dark, 0.06, -0.8, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  const hips = M.mesh(M.blob(0.2, 0.14, 0.22, { seed: 4 }), plate, 0, 0.88, 0);
  const loin = M.mesh(M.cloth(0.2, 0.46, 0.03, 0.05), team, 0.18, 0.72, 0);
  loin.rotation.y = Math.PI;
  const loinB = M.mesh(M.cloth(0.24, 0.5, 0.04, 0.06), team, -0.17, 0.72, 0);
  const torso = M.mesh(M.lathe([[0.16, 0.9], [0.2, 1.05], [0.26, 1.25], [0.28, 1.42], [0.2, 1.54], [0.08, 1.6]], 18), plate);
  torso.scale.set(0.9, 1, 1.2);
  const abs = M.mesh(M.blob(0.12, 0.14, 0.14, { seed: 5 }), skin, 0.11, 1.1, 0);
  const neck = limb([0, 1.55, 0], [0.04, 1.68, 0], 0.07, 0.06, skin);
  const head = pivot(0.06, 1.8, 0);
  head.add(M.mesh(M.blob(0.12, 0.14, 0.11, { seed: 6 }), skin, 0, 0, 0));
  head.add(M.mesh(M.blob(0.08, 0.06, 0.08, { seed: 7 }), skin, 0.09, -0.06, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.scaled(M.G.sphere, 0.025, 0.014, 0.03), M.glowMat('#7aff6a'), 0.11, 0.02, 0.05 * s));
    head.add(M.mesh(M.scaled(M.G.cone, 0.012, 0.05, 0.012).rotateZ(Math.PI), M.boneMat(), 0.14, -0.1, 0.025 * s));
    // Great ram horns curling back and down.
    head.add(M.mesh(M.tube([[0.02, 0.1, 0.07 * s], [-0.04, 0.24, 0.14 * s], [-0.2, 0.28, 0.2 * s], [-0.3, 0.14, 0.22 * s], [-0.24, 0.02, 0.2 * s]], 0.06, 0.012, 16, 10), horn));
    head.add(M.mesh(M.tube([[0.0, 0.03, 0.1 * s], [-0.06, 0.08, 0.2 * s], [-0.12, 0.12, 0.26 * s]], 0.028, 0.004, 6, 6), skin));
  }
  // Spiked pauldrons.
  const paulds = [1, -1].map((s) => {
    const p = pivot(0, 1.46, 0.3 * s);
    p.add(M.mesh(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), plate));
    for (let i = 0; i < 3; i++) p.add(M.mesh(M.scaled(M.G.cone, 0.03, 0.16, 0.03), horn, -0.06 + i * 0.06, 0.16, 0.04 * s));
    p.rotation.x = 0.35 * s;
    return p;
  });
  // Arms with long claws; the right arm slashes.
  const arm = (s) => {
    const a = pivot(0, 1.42, 0.34 * s);
    a.add(limb([0, 0, 0], [0.06, -0.3, 0.04 * s], 0.07, 0.06, skin));
    a.add(limb([0.06, -0.28, 0.04 * s], [0.2, -0.52, 0.02 * s], 0.06, 0.05, plate));
    a.add(M.mesh(M.blob(0.06, 0.05, 0.05, { seed: 8 }), skin, 0.22, -0.56, 0.02 * s));
    for (let i = -1; i <= 1; i++) a.add(M.mesh(M.tube([[0.24, -0.58, (0.02 + i * 0.025) * s], [0.33, -0.64, (0.02 + i * 0.03) * s], [0.36, -0.74, (0.02 + i * 0.03) * s]], 0.012, 0.002, 6, 5), M.boneMat()));
    return a;
  };
  const armL = arm(1);
  const armR = arm(-1);
  const tail = M.mesh(M.tube([[-0.14, 0.86, 0], [-0.4, 0.6, 0], [-0.5, 0.3, 0.1], [-0.7, 0.15, 0.2]], 0.05, 0.01, 14, 8), skin);
  const wings = pivot(-0.14, 1.45, 0);
  const wingL = batWing(1);
  wingL.position.z = 0.12;
  const wingR = batWing(-1);
  wingR.position.z = -0.12;
  wingR.scale.z = -1;
  wings.add(wingL, wingR);
  body.add(legL, legR, hips, loin, loinB, torso, abs, neck, head, ...paulds, armL, armR, tail, wings);
  body.scale.setScalar(1.4);
  const staff = new THREE.Object3D();
  body.add(staff);
  const tick = pose((dt, t) => {
    const k = Math.min(1.6, Math.max(0, -staff.rotation.x));
    armR.rotation.z = k * 1.4;
    armR.rotation.x = -k * 0.5;
    armL.rotation.z = k * 0.5;
    // Wings breathe slowly and flare during a strike.
    const flap = Math.sin(t * 1.6) * 0.06 + k * 0.25;
    wingL.rotation.y = 0.55 + flap;
    wingR.rotation.y = -(0.55 + flap);
  });
  g.userData = { body, legL, legR, staff, kind: 'hero', anim: [armL, armR, wingL, wingR], tick };
  return g;
}

registerSkin('dreadlord', dreadlord);

// ------------------------------------------------------------ villager

const TUNICS = ['#e8c8a0', '#c8e0a0', '#f0a898', '#a8c0f0', '#f0e0b0', '#d8b0e0'];

// A townsperson in a belted tunic, hose and a floppy cap, clothes varied.
function villager(seed) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = M.mat('#e0b090', { roughness: 0.7 });
  const tunic = M.texMat('tex_leather.webp', '#6a4a30', TUNICS[seed % TUNICS.length], 1);
  const hose = M.mat(['#4a3a2a', '#3a3a3a', '#5a4a3a'][seed % 3], { roughness: 0.9 });
  const cap = M.mat(['#8a2a1a', '#3a5a2a', '#6a5a3a', '#2a3a6a'][seed % 4], { roughness: 0.85 });
  const leg = (s) => {
    const hip = pivot(0, 0.5, 0.08 * s);
    hip.add(limb([0, 0, 0], [0.01, -0.45, 0], 0.06, 0.045, hose));
    hip.add(M.mesh(M.scaled(M.G.sphere, 0.07, 0.04, 0.05), M.leatherMat('#6a4a30'), 0.03, -0.48, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  const coat = M.mesh(M.lathe([[0.2, 0.42], [0.18, 0.55], [0.16, 0.75], [0.17, 0.9], [0.12, 1.0], [0.05, 1.04]], 16), tunic);
  const belt = M.mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 18).rotateX(Math.PI / 2), M.leatherMat('#4a3020'), 0, 0.66, 0);
  const head = M.mesh(M.blob(0.1, 0.11, 0.1, { seed: 20 + (seed % 5), amt: 0.05 }), skin, 0.02, 1.12, 0);
  const hat = M.mesh(M.lathe([[0.13, 0], [0.12, 0.05], [0.09, 0.1], [0.02, 0.12]], 14), cap, 0, 1.17, 0);
  hat.rotation.z = 0.25;
  const arms = [1, -1].map((s) => {
    const a = pivot(0, 0.92, 0.18 * s);
    a.add(limb([0, 0, 0], [0.04, -0.36, 0.02 * s], 0.045, 0.04, tunic));
    a.add(M.mesh(M.scaled(M.G.sphere, 0.04), skin, 0.05, -0.39, 0.02 * s));
    return a;
  });
  body.add(legL, legR, coat, belt, head, hat, ...arms);
  body.scale.setScalar(1.3);
  g.userData = { body, legL, legR, arms };
  return g;
}

registerView('villager', {
  make(e, world, v) {
    const g = villager(e.id);
    v.parts = g.userData;
    v.walk = Math.random() * 6;
    return g;
  },
  update(v, a, b, k, dt) {
    const P = v.parts;
    v.walk += dt * (b.mv ? 10 : 0);
    const sw = b.mv ? Math.sin(v.walk) * 0.5 : 0;
    P.legL.rotation.z = sw;
    P.legR.rotation.z = -sw;
    P.arms[0].rotation.z = -sw * 0.6;
    P.arms[1].rotation.z = sw * 0.6;
    P.body.position.y = b.mv ? Math.abs(Math.sin(v.walk)) * 0.04 : 0;
  },
});

// ------------------------------------------------------------ den

// The Vampire Den (a renamed Troll Burrow): an earthen mound under a frame of
// lashed logs and stretched hide, tusks at the door, a team banner. When
// its owner hides inside, red eyes glow in the doorway (only they see it).
function den(color) {
  const g = new THREE.Group();
  const earth = M.triMat('tex_dirt.webp', '#5a4a38', '#a89480', 1.2);
  const wood = M.texMat('tex_wood.webp', '#5a3a22', '#a08060', 1);
  const hide = M.hideMat();
  g.add(M.mesh(M.blob(1.25, 0.75, 1.25, { seed: 31, amt: 0.1 }), earth, 0, 0.1, 0));
  g.add(M.mesh(M.blob(0.9, 0.55, 0.9, { seed: 32, amt: 0.12 }), hide, -0.1, 0.55, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    g.add(M.mesh(M.tube([[Math.cos(a) * 1.1, 0.1, Math.sin(a) * 1.1], [Math.cos(a) * 0.7, 1.0, Math.sin(a) * 0.7], [Math.cos(a) * 0.15, 1.55, Math.sin(a) * 0.15]], 0.06, 0.04, 8, 6), wood));
  }
  // Doorway facing +X (the square).
  const door = M.mesh(new THREE.CircleGeometry(0.42, 18), M.mat('#070406'), 0.97, 0.42, 0);
  door.rotation.y = Math.PI / 2;
  door.scale.y = 1.2;
  g.add(door);
  g.add(M.mesh(new THREE.TorusGeometry(0.45, 0.07, 6, 16, Math.PI), wood, 0.99, 0.42, 0));
  g.children[g.children.length - 1].rotation.y = Math.PI / 2;
  for (const s of [1, -1]) g.add(M.mesh(M.tube([[1.0, 0.1, 0.45 * s], [1.25, 0.5, 0.5 * s], [1.2, 0.85, 0.35 * s]], 0.06, 0.01, 10, 8), M.boneMat()));
  const eyes = new THREE.Group();
  for (const s of [1, -1]) eyes.add(M.mesh(M.scaled(M.G.sphere, 0.05, 0.03, 0.05), M.glowMat('#ff2a2a'), 0.95, 0.5, 0.1 * s));
  eyes.visible = false;
  g.add(eyes);
  g.add(M.mesh(M.tube([[-0.6, 0.4, 0.6], [-0.6, 1.5, 0.6], [-0.6, 2.4, 0.6]], 0.04, 0.03), wood));
  const flag = M.mesh(M.cloth(0.6, 0.7, 0.03, 0.1), M.mat(color, { side: THREE.DoubleSide }), -0.58, 2.05, 0.6);
  flag.rotation.y = Math.PI / 2;
  g.add(flag);
  g.userData = { eyes, flag };
  return g;
}

registerView('vden', {
  make(e, world, v) {
    const g = den(world.colors[e.o] || '#888');
    v.parts = g.userData;
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.parts.eyes.visible = !!b.occ && Math.sin(world.time * 2.3) > -0.85;
    v.parts.flag.rotation.x = Math.sin(world.time * 2 + v.id) * 0.08;
    if (b.occ && Math.random() < dt * 3) world.fx.smokePuff(v.x, 1.4, v.z, '#302028', 0.6, 1.2, 0.3);
  },
});

// ------------------------------------------------------------ the town

function house(w, d, h, seed) {
  const g = new THREE.Group();
  const stone = M.texMat('tex_stone.webp', '#8a8478', '#d0c8bc', 1);
  const plaster = M.mat(['#d8ccb0', '#cfc2a4', '#e0d4bc'][seed % 3], { roughness: 0.92 });
  const beam = M.texMat('tex_wood.webp', '#4a3020', '#a08060', 1);
  const roofM = M.texMat('tex_wood.webp', '#5a3028', ['#e08a70', '#a0a8c0', '#d07858'][seed % 3], 1);
  // Stone ground floor, timbered upper floor jutting out a little.
  g.add(M.mesh(new THREE.BoxGeometry(w, h * 0.45, d), stone, 0, h * 0.225, 0));
  g.add(M.mesh(new THREE.BoxGeometry(w + 0.2, h * 0.55, d + 0.2), plaster, 0, h * 0.72, 0));
  for (const sx of [-1, 1]) {
    for (let i = 0; i <= Math.round(d / 0.9); i++) {
      const z = -d / 2 - 0.1 + (i / Math.round(d / 0.9)) * (d + 0.2);
      g.add(M.mesh(new THREE.BoxGeometry(0.06, h * 0.55, 0.1), beam, sx * (w / 2 + 0.11), h * 0.72, z));
    }
    g.add(M.mesh(new THREE.BoxGeometry(0.1, 0.1, d + 0.3), beam, sx * (w / 2 + 0.12), h * 0.46, 0));
  }
  for (const sz of [-1, 1]) {
    for (let i = 0; i <= Math.round(w / 0.9); i++) {
      const x = -w / 2 - 0.1 + (i / Math.round(w / 0.9)) * (w + 0.2);
      g.add(M.mesh(new THREE.BoxGeometry(0.1, h * 0.55, 0.06), beam, x, h * 0.72, sz * (d / 2 + 0.11)));
    }
  }
  // Warm windows (the town is lit at night).
  const glass = new THREE.MeshStandardMaterial({ color: '#2a1a08', emissive: '#ffb050', emissiveIntensity: 1.2 });
  for (const sz of [-1, 1]) {
    for (let i = 0; i < Math.max(1, Math.floor(w / 1.3)); i++) {
      const x = -w / 2 + (i + 0.5) * (w / Math.max(1, Math.floor(w / 1.3)));
      g.add(M.mesh(M.scaled(M.G.box, 0.36, 0.42, 0.04), glass, x, h * 0.74, sz * (d / 2 + 0.13)));
    }
  }
  // A steep gabled roof along the long side.
  const long = Math.max(w, d);
  const short = Math.min(w, d);
  const sh = new THREE.Shape();
  sh.moveTo(-short / 2 - 0.35, 0);
  sh.lineTo(0, short * 0.75);
  sh.lineTo(short / 2 + 0.35, 0);
  sh.lineTo(-short / 2 - 0.35, 0);
  const rg = new THREE.ExtrudeGeometry(sh, { depth: long + 0.5, bevelEnabled: false });
  rg.translate(0, 0, -(long + 0.5) / 2);
  if (w > d) rg.rotateY(Math.PI / 2);
  const roof = M.mesh(rg, roofM, 0, h, 0);
  g.add(roof);
  g.add(M.mesh(new THREE.BoxGeometry(0.4, 1.0, 0.4), stone, w > d ? w * 0.28 : short * 0.2, h + short * 0.5, w > d ? short * 0.15 : d * 0.28));
  return g;
}

function flowerBed(r) {
  const g = new THREE.Group();
  g.add(M.mesh(new THREE.TorusGeometry(r, 0.12, 6, 24).rotateX(Math.PI / 2), M.texMat('tex_stone.webp', '#8a8478', '#c8c0b4', 1), 0, 0.08, 0));
  g.add(M.mesh(new THREE.CircleGeometry(r, 24).rotateX(-Math.PI / 2), M.texMat('tex_dirt.webp', '#4a3424', '#8a6a50', 1), 0, 0.1, 0));
  const cols = ['#e04060', '#f0d040', '#b060e0', '#f0f0f0', '#ff8040'];
  for (let i = 0; i < r * 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * r * 0.85;
    const f = M.mesh(M.scaled(M.G.sphere, 0.08, 0.06, 0.08), M.mat(cols[i % cols.length], { roughness: 0.6 }), Math.cos(a) * rr, 0.2, Math.sin(a) * rr);
    f.castShadow = false;
    g.add(f);
    if (i % 3 === 0) g.add(M.mesh(M.blob(0.12, 0.08, 0.12, { seed: i }), M.mat('#3a6a2a'), Math.cos(a) * rr, 0.14, Math.sin(a) * rr));
  }
  return g;
}

function lampPost() {
  return M.torch();
}

registerTheme(
  'masquerade',
  { sky: '#0c1428', fog: '#101a30', floor: ['#8e8a80', 35, { tiles: true }], sun: '#9fb8ff', hemi: ['#5870b0', '#101810'], sunI: 1.4 },
  { floor: { tex: 'tex_stone.webp', tint: '#b8b4c8', color: '#6e6a72', units: 6 }, edge: { tex: 'tex_dirt.webp', tint: '#8a8a9a', color: '#4a4440', units: 5 }, outer: { tex: 'tex_nightgrass.webp', tint: '#8890a0', color: '#1c3028' }, edgeWidth: 1.0 },
);

registerMapBuilder('masquerade', (map, world) => {
  const hw = map.floor.w / 2;
  // Everything but the lamps (their flames flicker) is merged per material
  // into a few meshes: the town is over a thousand parts otherwise.
  const town = new THREE.Group();
  let seed = 0;
  for (const [x0, y0, x1, y1] of map.buildings || []) {
    const w = x1 - x0;
    const d = y1 - y0;
    const h = house(w - 0.15, d - 0.15, Math.min(w, d) > 3 ? 2.8 : 2.2, seed++);
    h.position.set((x0 + x1) / 2, 0, (y0 + y1) / 2);
    town.add(h);
  }
  // The central tree ringed by flower beds.
  const tree = M.tree(1.5);
  town.add(tree);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const fb = flowerBed(0.55);
    fb.position.set(Math.cos(a) * 1.7, 0, Math.sin(a) * 1.7);
    town.add(fb);
  }
  // Lamp posts round the square.
  for (const [x, z] of [[-6, -6], [6, -6], [6, 6], [-6, 6], [0, -9], [9, 0], [0, 9], [-9, 0]]) {
    const l = lampPost();
    l.position.set(x, 0, z);
    world.mapGroup.add(l);
    world.animated.push({ type: 'torch', obj: l });
  }
  // The town beyond the square.
  for (let i = 0; i < 20; i++) {
    const side = i % 4;
    const along = -hw + ((Math.floor(i / 4) + 0.5) / 5) * hw * 2;
    const out = hw + 2.8 + Math.random() * 0.8;
    const [x, z] = [[along, -out], [out, along], [along, out], [-out, along]][side];
    const h = house(side % 2 ? 3 : 4, side % 2 ? 4 : 3, 2.6 + Math.random() * 0.8, i);
    h.position.set(x, 0, z);
    town.add(h);
  }
  octCorners({ mapGroup: town }, hw, map.cut || 7);
  bakeStatic(town, { castShadow: true });
  world.mapGroup.add(town);
});

// ------------------------------------------------------------ day and night

const NIGHT = { sky: new THREE.Color('#0c1428'), sun: new THREE.Color('#9fb8ff'), hemi: new THREE.Color('#5870b0'), ground: new THREE.Color('#101810'), sunI: 1.4 };
const DAY = { sky: new THREE.Color('#bcd4f0'), sun: new THREE.Color('#fff0d0'), hemi: new THREE.Color('#e8f0ff'), ground: new THREE.Color('#5a5040'), sunI: 3.0 };

// Daylight factor for a game hour: 0 at night, 1 by day, easing over dawn and dusk.
function daylight(h) {
  if (h >= 6.5 && h < 17.5) return 1;
  if (h >= 5.5 && h < 6.5) return h - 5.5;
  if (h >= 17.5 && h < 18.5) return 18.5 - h;
  return 0;
}

registerView('masqclock', {
  make() {
    return new THREE.Group();
  },
  update(v, a, b, k, dt, world) {
    const d = daylight(b.h);
    const c = new THREE.Color();
    world.scene.background?.copy?.(c.copy(NIGHT.sky).lerp(DAY.sky, d));
    world.scene.fog?.color.copy(c);
    world.sun.color.copy(NIGHT.sun).lerp(DAY.sun, d);
    world.sun.intensity = lerp(NIGHT.sunI, DAY.sunI, d);
    world.hemi.color.copy(NIGHT.hemi).lerp(DAY.hemi, d);
    world.hemi.groundColor.copy(NIGHT.ground).lerp(DAY.ground, d);
    // By day every Dreadlord in the open smoulders and burns.
    if (d > 0.5) {
      for (const hv of world.views.values()) {
        if (hv.k !== 'paladin' || hv.sk !== 'dreadlord' || hv.deadT > 0) continue;
        if (Math.random() < dt * 20) world.fx.flame(hv.x + (Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 1.4, hv.z + (Math.random() - 0.5) * 0.6, 0.7, 0.5, 0.1);
        if (Math.random() < dt * 6) world.fx.smokePuff(hv.x, 2.2, hv.z, '#2a2020', 0.9, 1.2, 0.4);
      }
    }
  },
});

// ------------------------------------------------------------ events

registerEvent('bite', (e, world) => {
  world.fx.burst(e.x, 1.0, e.y, '#a01010', { n: 14, speed: 3, size: 0.3, life: 0.5, up: 1, grav: 10, additive: false });
  play('hit');
});

// Feeding: seen only by the vampire that fed (the others cannot see it).
registerEvent('feed', (e, world) => {
  if (e.to !== world.myId) return;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    world.fx.trail(e.x + Math.cos(a) * 0.7, 0.3 + (i % 6) * 0.35, e.y + Math.sin(a) * 0.7, '#ff3040', 0.45, 0.8, 0.1);
  }
  world.fx.text(e.x, 3.2, e.y, 'Fed!', '#ff5050', true);
  play('drain');
});

registerEvent('denin', (e, world) => {
  if (e.to !== world.myId) return;
  world.fx.dustCloud(e.x, e.y, 0.6, '#6a5a4a', 5);
  play('teleport');
});

registerEvent('dencollapse', (e, world) => {
  world.fx.dustCloud(e.x, e.y, 1.2, '#6a5a4a', 14);
  world.fx.debrisBurst(e.x, e.y, 12, 4);
  const v = [...world.views.values()].find((w) => w.k === 'vden' && Math.abs(w.x - e.x) < 0.1 && Math.abs(w.z - e.y) < 0.1);
  if (v) v.obj.visible = false;
  play('squish');
});

registerEvent('dawn', () => play('meteor'));
registerEvent('dusk', () => play('gravity'));
