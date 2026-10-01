// The Skull of Gul'dan (#31): the cave, its creeps and demons, the two
// bosses, the Skull and the potions, the iron gate, the foot switches, the
// shimmering portal, the finish circle and the goblin merchant.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerTheme, registerMapBuilder } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';

registerTheme(
  'skull_cave',
  { sky: '#0a0908', fog: '#14100e', floor: ['#5a4e44', 25, {}], sun: '#ffd8b0', hemi: ['#8a7a70', '#1a1210'], sunI: 1.7 },
  {
    floor: { tex: 'tex_dirt.webp', tint: '#a89888', color: '#5a4e44', units: 6 },
    edge: { tex: 'tex_dirt.webp', tint: '#6a5a4c', color: '#3a3028', units: 5 },
    outer: { tex: 'tex_boulder.webp', tint: '#4a4440', color: '#2a2624', units: 5 },
    edgeWidth: 1,
  },
);

// ------------------------------------------------------------ models

// Unlit glow materials, cached per colour and opacity so models share them.
const glowCache = new Map();
function glow(c, op = 1) {
  const k = c + op;
  if (!glowCache.has(k)) glowCache.set(k, M.glowMat(c, op));
  return glowCache.get(k);
}

// A demon, built from one template: digitigrade legs (or a smoky tail for
// floaters), a muscled torso, horned head with glowing eyes, arms with claws
// or a weapon, optional bat wings and tail. Faces +X.
function demon(o) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = M.triMat('tex_hide.webp', o.skin, o.tint, 1.2, { roughness: 0.55 });
  const dark = M.triMat('tex_hide.webp', o.dark || '#2a1a1a', o.darkTint || '#7a5a5a', 1.2, { roughness: 0.6 });
  const horn = M.mat(o.horn || '#2a2020', { roughness: 0.35 });
  const eye = glow(o.eye || '#7dff5a');
  const legs = [];
  if (o.float) {
    body.add(M.mesh(M.tube([[0, 0.9, 0], [-0.2, 0.5, 0], [-0.5, 0.25, 0.1], [-0.8, 0.2, -0.1]], 0.3, 0.02, 14, 10), dark));
  } else {
    for (const s of [1, -1]) {
      const hip = new THREE.Group();
      hip.position.set(0, 0.95, 0.2 * s);
      hip.add(M.mesh(M.tube([[0, 0, 0], [0.18, -0.35, 0.02 * s], [-0.12, -0.68, 0.02 * s], [0.02, -0.92, 0]], 0.14, 0.06, 12, 10), skin));
      hip.add(M.mesh(M.blob(0.11, 0.07, 0.1, { seed: 501 }), horn, 0.04, -0.94, 0));
      body.add(hip);
      legs.push(hip);
    }
  }
  const torso = new THREE.Group();
  torso.position.set(0, 1.0, 0);
  body.add(torso);
  torso.add(M.mesh(M.blob(0.3, 0.42, 0.4, { seed: 502, amt: 0.06 }), skin, 0, 0.35, 0));
  torso.add(M.mesh(M.blob(0.3, 0.26, 0.5, { seed: 503, amt: 0.05 }), skin, 0.05, 0.68, 0));
  if (o.armor) {
    const plate = M.texMat('tex_plate.webp', o.armor, '#b0a0a8', 1, { metalness: 0.6, roughness: 0.35 });
    for (const s of [1, -1]) {
      const p = M.mesh(new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), plate, 0, 0.82, 0.42 * s);
      p.rotation.x = 0.4 * s;
      torso.add(p);
      torso.add(M.mesh(M.scaled(M.G.cone, 0.05, 0.25, 0.05), horn, 0, 1.02, 0.46 * s).rotateX(0.3 * s));
    }
    torso.add(M.mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 20).rotateX(Math.PI / 2), plate, 0, 0.02, 0));
  }
  if (o.spikes) for (let i = 0; i < 5; i++) torso.add(M.mesh(M.scaled(M.G.cone, 0.05, 0.28, 0.05), horn, -0.28, 0.2 + i * 0.13, 0).rotateZ(1.2));
  // Head.
  const head = new THREE.Group();
  head.position.set(0.12, 0.98, 0);
  torso.add(head);
  head.add(M.mesh(M.blob(0.17, 0.19, 0.16, { seed: 504 }), skin, 0, 0.08, 0));
  head.add(M.mesh(M.blob(0.12, 0.08, 0.13, { seed: 505 }), dark, 0.1, -0.03, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.scaled(M.G.sphere, 0.03), eye, 0.16, 0.1, 0.06 * s));
    const hl = o.hornLen ?? 1;
    if (o.horns === 'ram') head.add(M.mesh(M.tube([[0, 0.18, 0.1 * s], [-0.12, 0.3, 0.2 * s], [-0.05, 0.22, 0.3 * s], [0.08, 0.1, 0.28 * s]], 0.055, 0.015, 12, 8), horn));
    else head.add(M.mesh(M.tube([[0, 0.2, 0.09 * s], [-0.05, 0.4 * hl, 0.16 * s], [-0.22 * hl, 0.6 * hl, 0.2 * s]], 0.05, 0.008, 10, 8), horn));
  }
  // Arms.
  const arms = [];
  for (const s of [1, -1]) {
    const a = new THREE.Group();
    a.position.set(0, 0.78, 0.42 * s);
    a.add(M.mesh(M.tube([[0, 0, 0], [0.1, -0.3, 0.06 * s], [0.3, -0.55, 0.04 * s]], 0.09, 0.07, 8, 8), skin));
    a.add(M.mesh(M.blob(0.08, 0.07, 0.07, { seed: 506 }), skin, 0.32, -0.6, 0.04 * s));
    for (let c = -1; c <= 1; c++) a.add(M.mesh(M.scaled(M.G.cone, 0.02, 0.1, 0.02), horn, 0.4, -0.64, 0.04 * s + c * 0.03).rotateZ(-2));
    if (o.orb) a.add(M.mesh(M.scaled(M.G.sphere, 0.09), glow(o.orb), 0.4, -0.52, 0.05 * s));
    torso.add(a);
    arms.push(a);
  }
  if (o.weapon === 'trident') {
    const w = new THREE.Group();
    w.position.set(0.35, -0.6, -0.04);
    w.add(M.mesh(M.tube([[0, -1.1, 0], [0, 0.4, 0], [0, 1.4, 0]], 0.035, 0.035, 6, 6), M.mat('#3a2a20')));
    const steel = M.mat('#6a6a70', { metalness: 0.7, roughness: 0.35 });
    for (const dz of [-0.14, 0, 0.14]) w.add(M.mesh(M.tube([[0, 1.35, dz * 0.4], [0, 1.6, dz], [0, 1.85, dz]], 0.03, 0.005, 6, 6), steel));
    w.add(M.mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.34, 8).rotateX(Math.PI / 2), steel, 0, 1.38, 0));
    arms[1].add(w);
  } else if (o.weapon === 'sword') {
    const w = new THREE.Group();
    w.position.set(0.35, -0.6, -0.04);
    w.rotation.z = -0.9;
    w.add(M.mesh(new THREE.BoxGeometry(0.06, 1.5, 0.18), M.mat('#8a8a90', { metalness: 0.8, roughness: 0.3 }), 0, 0.85, 0));
    w.add(M.mesh(new THREE.BoxGeometry(0.1, 0.08, 0.45), M.goldMat(), 0, 0.1, 0));
    w.add(M.mesh(new THREE.BoxGeometry(0.02, 1.3, 0.04), glow('#ff7a30'), 0.04, 0.9, 0));
    arms[1].add(w);
  } else if (o.weapon === 'whip') {
    arms[1].add(M.mesh(M.tube([[0.35, -0.6, 0], [0.6, -0.9, 0.2], [0.4, -1.0, 0.5], [0.7, -1.0, 0.7]], 0.02, 0.008, 16, 5), M.mat('#2a1a20')));
  }
  if (o.wings) {
    const wm = M.mat(o.wings, { roughness: 0.7, side: THREE.DoubleSide });
    for (const s of [1, -1]) {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0);
      sh.lineTo(-0.2, 0.9);
      sh.lineTo(-0.5, 1.3);
      sh.quadraticCurveTo(-0.55, 0.9, -0.85, 0.75);
      sh.quadraticCurveTo(-0.8, 0.45, -1.1, 0.3);
      sh.quadraticCurveTo(-0.9, 0.05, -1.15, -0.15);
      sh.quadraticCurveTo(-0.5, -0.1, 0, 0);
      const wing = M.mesh(new THREE.ShapeGeometry(sh, 8), wm, -0.2, 0.7, 0.15 * s);
      wing.rotation.set(0, s * 1.1, 0);
      wing.scale.setScalar(o.wingScale || 1);
      torso.add(wing);
      torso.add(M.mesh(M.tube([[-0.2, 0.7, 0.15 * s], [-0.35, 1.45, 0.4 * s], [-0.6, 2.0, 0.75 * s]].map(([x, y, z]) => [x, (y - 0.7) * (o.wingScale || 1) + 0.7, z * (o.wingScale || 1)]), 0.04, 0.01, 8, 5), horn));
    }
  }
  if (o.tail) body.add(M.mesh(M.tube([[-0.25, 1.0, 0], [-0.6, 0.7, 0.1], [-0.9, 0.35, -0.1], [-1.1, 0.25, 0.1]], 0.07, 0.015, 14, 6), skin));
  if (o.cape) {
    const c = M.mesh(M.cloth(0.9, 1.5, 0.3, 0.3), M.mat(o.cape, { roughness: 0.85, side: THREE.DoubleSide }), -0.28, 1.1, 0);
    torso.add(c);
    c.position.set(-0.3, 0.2, 0);
  }
  body.scale.setScalar(o.scale || 1);
  g.userData = { body, torso, head, arms, legs };
  return g;
}

function spider(big) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const hide = M.triMat('tex_fur.webp', big ? '#2a2420' : '#3a2e24', big ? '#8a7a6a' : '#b0987a', 1.6, { roughness: 0.8 });
  body.add(M.mesh(M.blob(0.55, 0.45, 0.5, { seed: 520 }), hide, -0.5, 0.6, 0));
  body.add(M.mesh(M.blob(0.32, 0.22, 0.3, { seed: 521 }), hide, 0.2, 0.5, 0));
  // Red hourglass markings.
  body.add(M.mesh(M.blob(0.18, 0.05, 0.1, { seed: 522 }), M.mat('#a01a14', { roughness: 0.5 }), -0.5, 1.02, 0));
  for (let i = 0; i < 4; i++) body.add(M.mesh(M.scaled(M.G.sphere, 0.035), glow('#ff4030'), 0.46, 0.58 + (i % 2) * 0.05, (i < 2 ? 1 : -1) * (0.05 + (i % 2) * 0.05)));
  for (const s of [1, -1]) body.add(M.mesh(M.tube([[0.45, 0.45, 0.07 * s], [0.58, 0.35, 0.06 * s], [0.6, 0.2, 0.03 * s]], 0.04, 0.01, 6, 6), M.boneMat()));
  const legs = [];
  for (const s of [1, -1]) {
    for (let i = 0; i < 4; i++) {
      const hip = new THREE.Group();
      hip.position.set(0.25 - i * 0.12, 0.55, 0.2 * s);
      const fwd = 0.5 - i * 0.35;
      hip.add(M.mesh(M.tube([[0, 0, 0], [fwd * 0.4, 0.45, 0.4 * s], [fwd * 0.9, 0.2, 0.8 * s], [fwd * 1.1, -0.55, 0.95 * s]], 0.05, 0.015, 12, 6), hide));
      body.add(hip);
      legs.push(hip);
    }
  }
  body.scale.setScalar(big ? 1.35 : 0.75);
  g.userData = { body, legs, arms: [], spider: true };
  return g;
}

function sludge() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const ooze = M.triMat('tex_hide.webp', '#4a5a2a', '#b8d080', 1.2, { roughness: 0.2, metalness: 0.1 });
  body.add(M.mesh(M.blob(0.95, 0.7, 0.9, { seed: 530, amt: 0.16, freq: 3 }), ooze, 0, 0.6, 0));
  body.add(M.mesh(M.blob(0.55, 0.5, 0.55, { seed: 531, amt: 0.14 }), ooze, 0.35, 1.25, 0));
  const arms = [];
  for (const s of [1, -1]) {
    const a = new THREE.Group();
    a.position.set(0.3, 1.2, 0.7 * s);
    a.add(M.mesh(M.tube([[0, 0, 0], [0.4, -0.2, 0.3 * s], [0.6, -0.7, 0.25 * s]], 0.2, 0.12, 10, 8), ooze));
    body.add(a);
    arms.push(a);
  }
  for (const s of [1, -1]) body.add(M.mesh(M.scaled(M.G.sphere, 0.07), glow('#e8ff60'), 0.82, 1.4, 0.15 * s));
  const bubbles = [];
  for (let i = 0; i < 6; i++) {
    const b = M.mesh(M.scaled(M.G.sphere, 0.1 + Math.random() * 0.08), glow('#a8e040', 0.8), (Math.random() - 0.5) * 1.2, 0.9 + Math.random() * 0.6, (Math.random() - 0.5) * 1.2);
    body.add(b);
    bubbles.push(b);
  }
  g.userData = { body, arms, legs: [], bubbles, ooze: true };
  return g;
}

function eggSack() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shell = M.triMat('tex_hide.webp', '#c8c0a0', '#fff8e0', 1.8, { roughness: 0.45 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    body.add(M.mesh(M.blob(0.22, 0.3, 0.22, { seed: 540 + i, amt: 0.08 }), shell, Math.cos(a) * 0.22, 0.28, Math.sin(a) * 0.22));
  }
  body.add(M.mesh(M.blob(0.26, 0.35, 0.26, { seed: 546 }), shell, 0, 0.5, 0));
  const web = M.mat('#ffffff', { transparent: true, opacity: 0.35, roughness: 1, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    body.add(M.mesh(M.tube([[0, 0.8, 0], [Math.cos(a) * 0.4, 0.6, Math.sin(a) * 0.4], [Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75]], 0.01, 0.01, 6, 4), web));
  }
  g.userData = { body, arms: [], legs: [], egg: true };
  return g;
}

function infernal() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const rock = M.triMat('tex_boulder.webp', '#3a3430', '#8a7a70', 1.1);
  const fire = glow('#7dff3a');
  body.add(M.mesh(M.blob(0.75, 0.8, 0.8, { seed: 550, amt: 0.14, freq: 3 }), rock, 0, 1.6, 0));
  body.add(M.mesh(M.blob(0.35, 0.32, 0.35, { seed: 551, amt: 0.14 }), rock, 0.35, 2.45, 0));
  body.add(M.mesh(M.scaled(M.G.sphere, 0.5, 0.55, 0.55), fire, 0.05, 1.6, 0));
  for (const s of [1, -1]) body.add(M.mesh(M.scaled(M.G.sphere, 0.06), glow('#e8ff80'), 0.62, 2.5, 0.12 * s));
  const arms = [];
  const legs = [];
  for (const s of [1, -1]) {
    const a = new THREE.Group();
    a.position.set(0, 2.0, 0.8 * s);
    a.add(M.mesh(M.blob(0.3, 0.35, 0.3, { seed: 552 }), rock, 0.05, -0.2, 0.05 * s));
    a.add(M.mesh(M.blob(0.28, 0.4, 0.28, { seed: 553 }), rock, 0.2, -0.75, 0.1 * s));
    a.add(M.mesh(M.blob(0.3, 0.26, 0.3, { seed: 554 }), rock, 0.3, -1.25, 0.1 * s));
    body.add(a);
    arms.push(a);
    const l = new THREE.Group();
    l.position.set(0, 1.0, 0.4 * s);
    l.add(M.mesh(M.blob(0.3, 0.5, 0.3, { seed: 555 }), rock, 0, -0.45, 0));
    body.add(l);
    legs.push(l);
  }
  body.scale.setScalar(1.15);
  g.userData = { body, arms, legs, flames: true };
  return g;
}

const CREEP_MODELS = {
  bloodfiend: () => demon({ skin: '#8a2020', tint: '#ff8a70', dark: '#3a0a0a', spikes: true, horns: 'straight', hornLen: 0.8, eye: '#ffe040', tail: true, scale: 1.05 }),
  tormentor: () => demon({ skin: '#4a2a6a', tint: '#c8a0ff', dark: '#1a0a2a', float: true, horns: 'ram', eye: '#ff60ff', orb: '#c070ff', scale: 1.05 }),
  succubus: () => demon({ skin: '#9a4a8a', tint: '#ffc0e8', dark: '#3a1030', horns: 'ram', eye: '#ff80c0', wings: '#4a1a3a', wingScale: 0.8, tail: true, weapon: 'whip', armor: '#3a1a30', scale: 0.9 }),
  giantspider: () => spider(true),
  spider: () => spider(false),
  sludge,
  egg: eggSack,
  pitlord: () => demon({ skin: '#5a6a2a', tint: '#d0e0a0', dark: '#2a2a10', horns: 'straight', hornLen: 1.4, eye: '#ffd040', tail: true, weapon: 'trident', armor: '#4a3a2a', spikes: true, scale: 1.85 }),
  dreadlord: () => demon({ skin: '#3a3a6a', tint: '#b0b0f0', dark: '#1a1a30', horns: 'ram', eye: '#7dff5a', wings: '#1a1424', wingScale: 1.3, cape: '#3a0a1a', armor: '#2a2030', scale: 1.4 }),
  doomguard: () => demon({ skin: '#8a2a1a', tint: '#ffa080', dark: '#2a0a0a', horns: 'straight', hornLen: 1.3, eye: '#ffe040', wings: '#3a1010', wingScale: 1.4, tail: true, weapon: 'sword', armor: '#3a2a20', scale: 1.7 }),
  infernal,
};
const SCALE_OF = { pitlord: 1.85, dreadlord: 1.4, doomguard: 1.7, infernal: 1.15, bloodfiend: 1.05, tormentor: 1.05, succubus: 0.9, giantspider: 1.35, spider: 0.75, sludge: 1, egg: 1 };

// The Skull of Gul'dan: a blackened skull with green fel fire in its eyes.
function skullModel() {
  const g = new THREE.Group();
  const bone = M.mat('#2a3a24', { roughness: 0.35, metalness: 0.2 });
  g.add(M.mesh(M.blob(0.26, 0.24, 0.22, { seed: 560, amt: 0.04 }), bone, 0, 0.3, 0));
  g.add(M.mesh(M.blob(0.16, 0.1, 0.17, { seed: 561 }), bone, 0.13, 0.13, 0));
  for (const s of [1, -1]) g.add(M.mesh(M.scaled(M.G.sphere, 0.06), glow('#7dff3a'), 0.2, 0.3, 0.09 * s));
  for (let i = -2; i <= 2; i++) g.add(M.mesh(M.scaled(M.G.box, 0.03, 0.05, 0.03), M.boneMat(), 0.24, 0.12, i * 0.035));
  g.add(M.mesh(M.tube([[-0.1, 0.5, 0.1], [-0.2, 0.62, 0.2], [-0.35, 0.6, 0.25]], 0.035, 0.005, 6, 5), bone));
  g.add(M.mesh(M.tube([[-0.1, 0.5, -0.1], [-0.2, 0.62, -0.2], [-0.35, 0.6, -0.25]], 0.035, 0.005, 6, 5), bone));
  return g;
}

const POTION_COLORS = { heal: '#e02020', mana: '#2050ff', speed: '#ffd020', invul: '#f0f8ff' };
function potionModel(kind) {
  const g = new THREE.Group();
  g.add(M.mesh(M.lathe([[0.001, 0], [0.16, 0.02], [0.2, 0.14], [0.17, 0.28], [0.06, 0.34], [0.06, 0.46], [0.08, 0.48], [0.001, 0.48]], 16), M.mat('#d8f0ff', { transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.1 })));
  g.add(M.mesh(M.lathe([[0.001, 0.02], [0.15, 0.04], [0.18, 0.14], [0.14, 0.24], [0.001, 0.25]], 14), glow(POTION_COLORS[kind] || '#fff')));
  g.add(M.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10), M.mat('#8a6a40'), 0, 0.5, 0));
  return g;
}

// A low-poly sphere for a skin's small parts (eyes, studs, knuckles).
const LOW_SPHERE = new THREE.SphereGeometry(1, 10, 8);

// The Demon Hunter (`Edem`), the player unit: a tall, lean night elf with
// lavender skin traced with green fel tattoos, bare-chested, blindfolded,
// long pointed ears and a dark mane tied back, in leather leggings and boots,
// a warglaive (a double crescent blade) in each hand. Team colour on the
// loincloth, the blindfold's tails and the wrist wraps. Faces +X.
export function demonHunter(color) {
  const { mesh, blob, tube, lathe, cloth, mat, G, scaled } = M;
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(1.4);
  g.add(body);
  const skin = mat('#b494e8', { roughness: 0.5 });
  const leather = M.leatherMat('#9a7aa8');
  const bootM = M.leatherMat('#6a4a70');
  const hair = mat('#3a2c66', { roughness: 0.75 });
  const band = mat('#1e2a1c', { roughness: 0.8 });
  const team = mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  const blade = mat('#dfe4ec', { metalness: 0.35, roughness: 0.3 });
  const tattoo = glow('#7dff5a');

  // Long legs in leather leggings and cuffed boots.
  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(0, 0.78, 0.12 * s);
    hip.add(mesh(tube([[0, 0.02, 0], [0.04, -0.34, 0.01 * s], [0.02, -0.52, 0]], 0.1, 0.075, 6, 10), leather));
    hip.add(mesh(tube([[0.02, -0.48, 0], [0.01, -0.64, 0], [0.0, -0.74, 0]], 0.08, 0.07, 4, 10), bootM));
    hip.add(mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.07, 12), bootM, 0.02, -0.47, 0));
    hip.add(mesh(blob(0.14, 0.05, 0.075, { seed: 80 + s, amt: 0.05, detail: 2 }), bootM, 0.07, -0.75, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);

  // Hips, belt and a team loincloth front and back.
  const hips = mesh(lathe([[0.17, 0.66], [0.2, 0.76], [0.19, 0.86]], 18), leather);
  hips.scale.z = 1.2;
  const belt = mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 22).rotateX(Math.PI / 2), bootM, 0, 0.84, 0);
  belt.scale.z = 1.2;
  const loinF = mesh(cloth(0.2, 0.46, 0.03, -0.04), team, 0.2, 0.62, 0);
  loinF.rotation.y = Math.PI;
  const loinB = mesh(cloth(0.22, 0.5, 0.04, 0.06), team, -0.2, 0.6, 0);
  // A lean bare torso: chest, shoulders and a narrow waist.
  const torso = mesh(blob(0.2, 0.3, 0.27, { seed: 82, amt: 0.04 }), skin, 0.0, 1.1, 0);
  const chest = mesh(blob(0.12, 0.13, 0.25, { seed: 83, amt: 0.04, detail: 2 }), skin, 0.08, 1.2, 0);
  const shoulders = mesh(blob(0.15, 0.1, 0.36, { seed: 84, amt: 0.05, detail: 2 }), skin, -0.02, 1.33, 0);
  // Fel tattoos: glowing lines across the chest and belly.
  const tattoos = [
    tube([[0.2, 1.3, 0.2], [0.26, 1.2, 0.1], [0.27, 1.1, 0.02], [0.22, 0.95, 0.06]], 0.012, 0.008, 12, 4),
    tube([[0.2, 1.3, -0.2], [0.26, 1.2, -0.1], [0.27, 1.1, -0.02], [0.22, 0.95, -0.06]], 0.012, 0.008, 12, 4),
    tube([[0.25, 1.05, 0.14], [0.28, 1.08, 0], [0.25, 1.05, -0.14]], 0.01, 0.01, 8, 4),
  ].map((geo) => mesh(geo, tattoo));
  // Arms: long and lean, tattoo bands, team wrist wraps, a glaive in each hand.
  const arm = (s, reach) => {
    const a = new THREE.Group();
    a.add(mesh(tube([[-0.02, 1.32, 0.32 * s], [0.04 + reach * 0.06, 1.06, 0.38 * s], [0.14 + reach * 0.12, 0.84, 0.36 * s]], 0.075, 0.055, 8, 10), skin));
    a.add(mesh(new THREE.TorusGeometry(0.07, 0.01, 4, 16).rotateX(Math.PI / 2), tattoo, 0.02 + reach * 0.03, 1.18, 0.36 * s));
    a.add(mesh(new THREE.TorusGeometry(0.066, 0.01, 4, 16).rotateX(Math.PI / 2), tattoo, 0.03 + reach * 0.04, 1.13, 0.37 * s));
    a.add(mesh(new THREE.CylinderGeometry(0.06, 0.062, 0.12, 10), team, 0.12 + reach * 0.11, 0.88, 0.36 * s));
    a.add(mesh(blob(0.06, 0.065, 0.055, { seed: 85 + s, detail: 2 }), skin, 0.16 + reach * 0.13, 0.79, 0.36 * s));
    return a;
  };
  // A warglaive: a leather grip with two crescent blades sweeping forward.
  const glaive = () => {
    const w = new THREE.Group();
    w.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), bootM));
    for (const s of [1, -1]) {
      const geo = tube([[0, 0.08 * s, 0], [0.14, 0.24 * s, 0], [0.2, 0.44 * s, 0], [0.12, 0.62 * s, 0], [-0.02, 0.7 * s, 0]], 0.05, 0.004, 16, 8);
      geo.scale(1, 1, 0.3);
      w.add(mesh(geo, blade));
      const back = tube([[0, 0.1 * s, 0], [-0.06, 0.22 * s, 0], [-0.04, 0.3 * s, 0]], 0.03, 0.004, 6, 6);
      back.scale(1, 1, 0.3);
      w.add(mesh(back, blade));
    }
    return w;
  };
  const armL = arm(1, 0.2);
  const glaiveL = glaive();
  glaiveL.position.set(0.2, 0.8, 0.36);
  glaiveL.rotation.x = -0.25;
  armL.add(glaiveL);
  const glaiveR = glaive();
  glaiveR.position.set(0.3, 0.8, -0.36);
  glaiveR.rotation.x = 0.25;
  // Head: a long face, blindfold with team tails, long swept-back ears and a
  // mane tied into a tail down the back.
  const head = new THREE.Group();
  head.position.set(0.06, 1.52, 0);
  head.add(mesh(blob(0.11, 0.14, 0.1, { seed: 86, amt: 0.04, detail: 2 }), skin, 0.02, 0, 0));
  head.add(mesh(blob(0.07, 0.05, 0.075, { seed: 87, amt: 0.04, detail: 2 }), skin, 0.07, -0.08, 0));
  const fold = mesh(new THREE.TorusGeometry(0.105, 0.028, 6, 22).rotateX(Math.PI / 2), band, 0.02, 0.03, 0);
  fold.scale.set(1.02, 1, 1.02);
  head.add(fold);
  for (const s of [1, -1]) {
    head.add(mesh(tube([[-0.08, 0.03, 0.03 * s], [-0.2, -0.04, 0.06 * s], [-0.3, -0.16, 0.05 * s]], 0.022, 0.012, 6, 5), team));
    const ear = mesh(new THREE.ConeGeometry(0.035, 0.34, 8), skin, -0.04, 0.08, 0.14 * s);
    ear.rotation.x = s * 1.05;
    ear.rotation.z = 0.9;
    head.add(ear);
  }
  head.add(mesh(blob(0.12, 0.1, 0.11, { seed: 88, amt: 0.08, detail: 2 }), hair, -0.03, 0.09, 0));
  head.add(mesh(tube([[-0.1, 0.1, 0], [-0.2, 0.0, 0], [-0.24, -0.3, 0], [-0.22, -0.6, 0]], 0.06, 0.025, 12, 8), hair));

  body.add(legL, legR, hips, belt, loinF, loinB, torso, chest, shoulders, ...tattoos, armL, arm(-1, 0.6), head, glaiveR);
  g.userData = { body, staff: glaiveR, legL, legR, kind: 'hero' };
  return g;
}

registerSkin('skull_dh', (color) => demonHunter(color));

function bar(y = 3) {
  const b = new THREE.Group();
  b.position.y = y;
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.14), new THREE.MeshBasicMaterial({ color: '#101010', transparent: true, opacity: 0.8, depthWrite: false }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.33, 0.09), new THREE.MeshBasicMaterial({ color: '#e03020', depthWrite: false }));
  fill.position.z = 0.01;
  b.add(bg, fill);
  b.rotation.x = -0.4;
  b.userData.fill = fill;
  return b;
}

// ------------------------------------------------------------ views

registerView('skull_creep', {
  bake: 'flat', // crowds: one mesh per moving part
  make(e, world, v) {
    const g = (CREEP_MODELS[e.t] || CREEP_MODELS.bloodfiend)();
    const s = SCALE_OF[e.t] || 1;
    const hb = bar(e.t === 'egg' ? 1.3 : 2.4 * s + 0.4);
    g.add(hb);
    const sk = skullModel();
    sk.visible = false;
    sk.position.y = 2.6 * s + 0.6;
    g.add(sk);
    const zz = new THREE.Group();
    g.add(zz);
    // Kept whole by bakeModel: the bar, its fill and the carried Skull move.
    Object.assign(g.userData, { hb, hbFill: hb.userData.fill, sk });
    v.parts = { ...g.userData, s };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    const t = world.time + v.id * 0.7;
    const moving = !!b.mv;
    v.walk = (v.walk || 0) + dt * (moving ? 9 : 0);
    if (P.spider) P.legs.forEach((l, i) => (l.rotation.x = moving ? Math.sin(v.walk * 1.5 + i * 1.3) * 0.3 : 0));
    else P.legs.forEach((l, i) => (l.rotation.z = moving ? Math.sin(v.walk + i * Math.PI) * 0.5 : 0));
    const swing = b.sw ? Math.sin(t * 9) : 0;
    P.arms.forEach((arm, i) => (arm.rotation.z = (i === 1 ? swing * 1.1 : swing * 0.4) + Math.sin(t * 1.5 + i) * 0.05));
    if (P.torso) P.torso.rotation.z = Math.sin(t * 1.2) * 0.03 + (b.sw ? 0.1 : 0);
    if (P.ooze) {
      P.body.scale.set(1 + Math.sin(t * 2) * 0.04, 1 - Math.sin(t * 2) * 0.04, 1 + Math.cos(t * 2.3) * 0.04);
      P.bubbles.forEach((bb, i) => (bb.position.y = 0.9 + ((t * 0.3 + i * 0.17) % 1) * 0.7));
    }
    if (P.egg) P.body.scale.setScalar(1 + Math.sin(t * 3) * 0.03);
    if (P.flames && Math.random() < dt * 20) world.fx.flame(v.x + (Math.random() - 0.5) * 1.2, 1 + Math.random() * 1.8, v.z + (Math.random() - 0.5) * 1.2, 0.8, 0.5, 0.2);
    if (b.t === 'tormentor') v.obj.position.y = 0.3 + Math.sin(t * 2) * 0.12;
    P.hb.rotation.y = v.f;
    const fr = Math.max(0, Math.min(1, (b.hp ?? 1) / (b.mhp || 1)));
    P.hb.userData.fill.scale.x = Math.max(0.001, fr);
    P.hb.userData.fill.position.x = -0.665 * (1 - fr);
    P.sk.visible = !!b.sk;
    if (b.sk) P.sk.rotation.y = t;
    if (b.sl && Math.random() < dt * 2) world.fx.text(v.x, 2.5 * P.s, v.z, 'z', '#c8d8ff');
  },
});

// Hero extras the shared hero view does not draw: Immolation, Sleep and the Skull overhead.
registerView('skull_herofx', {
  make(e, world, v) {
    const g = new THREE.Group();
    const sk = skullModel();
    sk.position.y = 3.3;
    const mark = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 4), M.glowMat('#ffd84a'));
    mark.rotation.z = Math.PI;
    mark.position.y = 4.2;
    g.add(sk, mark);
    v.parts = { sk, mark };
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.obj.rotation.y = 0;
    const P = v.parts;
    P.sk.visible = P.mark.visible = !!b.sk;
    if (b.sk) {
      P.sk.rotation.y = world.time * 1.5;
      P.mark.position.y = 4.2 + Math.sin(world.time * 5) * 0.12;
      if (Math.random() < dt * 8) world.fx.trail(v.x, 3.5, v.z, '#7dff3a', 0.5, 0.6, 0.3);
    }
    if (b.im) {
      v.acc = (v.acc || 0) + dt * 40;
      for (; v.acc >= 1; v.acc--) {
        const ang = Math.random() * Math.PI * 2;
        const r = 0.5 + Math.random() * 1.9;
        world.fx.flame(v.x + Math.cos(ang) * r, 0.05, v.z + Math.sin(ang) * r, 0.7, 0.45, 0.05);
      }
    }
    if (b.sl && Math.random() < dt * 2.5) world.fx.text(v.x + 0.3, 2.8, v.z, 'Zz', '#c8d8ff');
  },
});

registerView('skull_item', {
  make(e, world, v) {
    const g = new THREE.Group();
    const m = e.t === 'skull' ? skullModel() : potionModel(e.t);
    if (e.t === 'skull') m.scale.setScalar(1.4);
    g.add(m);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: e.t === 'skull' ? '#7dff3a' : POTION_COLORS[e.t], transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.y = 0.05;
    g.add(glow);
    v.parts = { m, glow };
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.parts.m.position.y = 0.25 + Math.sin(world.time * 3 + v.x) * 0.1;
    v.parts.m.rotation.y = world.time;
    v.parts.glow.material.opacity = 0.25 + Math.sin(world.time * 4) * 0.08;
  },
});

// The iron gate: a portcullis between two stone posts; it sinks when it opens.
registerView('skull_gate', {
  make(e, world, v) {
    const g = new THREE.Group();
    const iron = M.mat('#3a3a40', { metalness: 0.7, roughness: 0.4 });
    const stone = M.texMat('tex_stone.webp', '#6a6460', '#b0a8a0');
    const w = 4.74;
    for (const s of [1, -1]) g.add(M.mesh(M.lathe([[0.45, 0], [0.4, 3.2], [0.5, 3.3], [0.5, 3.5], [0.001, 3.55]], 8), stone, s * (w / 2 + 0.2), 0, 0));
    const grille = new THREE.Group();
    for (let i = 0; i < 9; i++) grille.add(M.mesh(M.tube([[0, 0, 0], [0, 1.4, 0], [0, 2.8, 0]], 0.07, 0.07, 3, 6), iron, -w / 2 + 0.3 + i * ((w - 0.6) / 8), 0, 0));
    for (const y of [0.6, 1.5, 2.4]) grille.add(M.mesh(M.tube([[-w / 2, y, 0], [0, y, 0], [w / 2, y, 0]], 0.06, 0.06, 3, 6), iron));
    for (let i = 0; i < 9; i++) grille.add(M.mesh(M.scaled(M.G.cone, 0.08, 0.25, 0.08), iron, -w / 2 + 0.3 + i * ((w - 0.6) / 8), -0.1, 0).rotateZ(Math.PI));
    g.add(grille);
    v.parts = { grille };
    return g;
  },
  update(v, a, b, k, dt) {
    v.obj.rotation.y = 0;
    const target = b.open ? -3.2 : 0;
    const gr = v.parts.grille;
    gr.position.y += (target - gr.position.y) * Math.min(1, dt * 1.5);
  },
});

registerView('skull_switch', {
  make(e, world, v) {
    const g = new THREE.Group();
    const stone = M.texMat('tex_stone.webp', '#7a7470', '#c8c0b8');
    const plate = M.mesh(M.lathe([[1.1, 0], [1.1, 0.12], [1.0, 0.18], [0.001, 0.18]], 4), stone);
    plate.rotation.y = Math.PI / 4;
    const rune = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffb040', transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false }));
    rune.position.y = 0.2;
    g.add(plate, rune);
    v.parts = { plate, rune };
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.obj.rotation.y = 0;
    v.parts.plate.position.y = b.on ? -0.1 : 0;
    v.parts.rune.position.y = b.on ? 0.1 : 0.2;
    v.parts.rune.material.opacity = b.on ? 0.9 : 0.25 + Math.sin(world.time * 3) * 0.1;
    v.parts.rune.material.color.set(b.on ? '#60ff60' : '#ffb040');
    v.parts.rune.rotation.y = world.time * (b.on ? 1 : 0.3);
  },
});

registerView('skull_portal', {
  make(e, world, v) {
    const g = new THREE.Group();
    const stone = M.texMat('tex_stone.webp', '#4a4450', '#9a90a8');
    const base = M.mesh(M.lathe([[1.5, 0], [1.5, 0.15], [1.3, 0.2], [0.001, 0.2]], 12), stone);
    const swirl = new THREE.Mesh(new THREE.CircleGeometry(1.25, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#b070ff', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    swirl.position.y = 0.23;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.06, 8, 40).rotateX(Math.PI / 2), M.glowMat('#d0a0ff'));
    ring.position.y = 0.24;
    g.add(base, swirl, ring);
    v.parts = { swirl };
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.obj.rotation.y = 0;
    v.parts.swirl.material.opacity = 0.35 + Math.sin(world.time * 3) * 0.12;
    if (Math.random() < dt * 20) {
      const ang = Math.random() * Math.PI * 2;
      world.fx.trail(v.x + Math.cos(ang) * 1.1, 0.3 + Math.random() * 1.5, v.z + Math.sin(ang) * 1.1, '#c890ff', 0.5, 0.8, 0.1);
    }
  },
});

// The finish: a Circle of Power.
registerView('skull_finish', {
  make() {
    const g = new THREE.Group();
    const stone = M.texMat('tex_stone.webp', '#8a8680', '#e0dcd4');
    g.add(M.mesh(M.lathe([[1.4, 0], [1.4, 0.1], [1.25, 0.14], [0.001, 0.14]], 32), stone));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.15, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
    ring.position.y = 0.16;
    const star = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.5, 5).rotateX(-Math.PI / 2), ring.material);
    star.position.y = 0.16;
    g.add(ring, star);
    g.userData.star = star;
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.obj.rotation.y = 0;
    v.obj.userData.star.rotation.y = world.time * 0.5;
    if (Math.random() < dt * 6) world.fx.trail(v.x + (Math.random() - 0.5) * 2, 0.3, v.z + (Math.random() - 0.5) * 2, '#ffe080', 0.4, 1, 0.1);
  },
});

// The Goblin Merchant: a green goblin behind a plank counter under a striped
// awning, crates and a potion sign.
registerView('skull_merchant', {
  make() {
    const g = new THREE.Group();
    const wood = M.texMat('tex_wood.webp', '#6a4a2c', '#e0c8a8');
    g.add(M.mesh(new THREE.BoxGeometry(0.6, 0.9, 2.2), wood, 0.9, 0.45, 0));
    for (const [x, z] of [[-0.8, 1.2], [-0.8, -1.2], [1.1, 1.2], [1.1, -1.2]]) g.add(M.mesh(M.tube([[0, 0, 0], [0, 1.4, 0], [0, 2.6, 0]], 0.07, 0.06, 3, 6), wood, x, 0, z));
    const awning = M.mesh(M.cloth(2.6, 2.2, 0.15, 0), M.mat('#c8302a', { side: THREE.DoubleSide, roughness: 0.8 }), 0.15, 2.65, 0);
    awning.rotation.z = Math.PI / 2 - 0.25;
    g.add(awning);
    for (let i = -1; i <= 1; i += 2) g.add(M.mesh(M.cloth(2.62, 0.4, 0.15, 0), M.mat('#f0e0c0', { side: THREE.DoubleSide }), 0.15 + i * 0.01, 2.66 + i * 0.3, 0).rotateZ(Math.PI / 2 - 0.25));
    // The goblin.
    const skin = M.triMat('tex_hide.webp', '#4a8a3a', '#b0e090', 1.5, { roughness: 0.6 });
    g.add(M.mesh(M.blob(0.28, 0.35, 0.3, { seed: 570 }), M.leatherMat(), 0.2, 0.75, 0));
    g.add(M.mesh(M.blob(0.22, 0.2, 0.2, { seed: 571 }), skin, 0.25, 1.25, 0));
    for (const s of [1, -1]) {
      const ear = M.mesh(M.scaled(M.G.cone, 0.07, 0.4, 0.05), skin, 0.2, 1.32, 0.28 * s);
      ear.rotation.x = -1.2 * s;
      g.add(ear);
      g.add(M.mesh(M.scaled(M.G.sphere, 0.035), M.glowMat('#ffe060'), 0.43, 1.3, 0.07 * s));
    }
    g.add(M.mesh(M.scaled(M.G.cone, 0.05, 0.18, 0.05), skin, 0.5, 1.22, 0).rotateZ(-Math.PI / 2));
    for (let i = 0; i < 3; i++) g.add(M.mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), wood, -0.6 + (i % 2) * 0.1, 0.25 + Math.floor(i / 2) * 0.5, 0.7 - i * 0.5));
    for (let i = 0; i < 4; i++) {
      const p = potionModel(['heal', 'mana', 'heal', 'mana'][i]);
      p.scale.setScalar(0.6);
      p.position.set(0.95, 0.9, -0.6 + i * 0.4);
      g.add(p);
    }
    return g;
  },
});

// ------------------------------------------------------------ events

registerEvent('skull_button', (e, world) => {
  world.fx.ring(e.x, e.y, 1.5, '#60ff60', 0.5);
  world.fx.dustCloud(e.x, e.y, 0.6, '#6a5a4c', 6);
  world.fx.text(e.x, 2, e.y, 'Click!', '#a0ffa0', true);
  play('smack');
});

registerEvent('skull_gate', (e, world) => {
  world.fx.dustCloud(e.x, e.y, 1.4, '#6a5a4c', 16);
  world.shake = 0.35;
  play('bigboom');
});

registerEvent('skull_boss', (e, world) => {
  world.fx.glow(e.x, 1.5, e.y, '#b070ff', 6, 0.6);
  world.fx.shockwave(e.x, e.y, 4, '#c890ff', 0.7);
  world.fx.burst(e.x, 1.5, e.y, '#c890ff', { n: 60, speed: 6, size: 0.7, life: 1 });
  world.fx.text(e.x, 5, e.y, e.t === 'pitlord' ? 'Pit Lord!' : 'Dreadlord!', '#ff6060', true);
  world.shake = 0.4;
  play('teleport');
});

registerEvent('skull_die', (e, world) => {
  const fx = world.fx;
  if (e.t === 'egg') {
    fx.burst(e.x, 0.5, e.y, '#f0e8c0', { n: 20, speed: 3, size: 0.5, life: 0.7, additive: false, grav: 10 });
    play('squish');
    return;
  }
  fx.burst(e.x, 1, e.y, e.t === 'sludge' ? '#a8e040' : '#ff5020', { n: 24, speed: 4, size: 0.6, life: 0.7 });
  fx.dustCloud(e.x, e.y, 0.8, '#4a3e34', 6);
  const s = SCALE_OF[e.t] || 1;
  const corpse = (CREEP_MODELS[e.t] || CREEP_MODELS.bloodfiend)();
  corpse.position.set(e.x, 0, e.y);
  corpse.rotation.y = -(e.f || 0);
  world.scene.add(corpse);
  fx.transients.push({ obj: corpse, t: 0, dur: 4, update: (k) => {
    corpse.userData.body.rotation.z = Math.min(Math.PI / 2, k * 12);
    corpse.position.y = -Math.max(0, k - 0.5) * 2 * s;
  } });
  play('death');
});

registerEvent('skull_bossdeath', (e, world) => {
  world.fx.flash(e.x, e.y, 10, '#ffffff', 0.6);
  world.fx.explosion(e.x, e.y, 2.5);
  world.fx.shockwave(e.x, e.y, 6, '#ffffff', 0.8);
  world.shake = 0.8;
  play('bigboom');
});

registerEvent('skull_summon', (e, world) => {
  if (e.t === 'infernal') {
    world.fx.explosion(e.x, e.y, 2);
    world.fx.burst(e.x, 1, e.y, '#7dff3a', { n: 40, speed: 6, size: 0.7, life: 0.8 });
  } else {
    world.fx.glow(e.x, 1.5, e.y, '#ff4020', 5, 0.6);
    world.fx.burst(e.x, 1.5, e.y, '#ff6030', { n: 40, speed: 5, size: 0.7, life: 0.9 });
  }
  world.fx.shockwave(e.x, e.y, 3, '#ffa060', 0.6);
  world.shake = 0.4;
  play('bigboom');
});

registerEvent('skull_drop', (e, world) => {
  world.fx.glow(e.x, 1, e.y, '#7dff3a', 3, 0.5);
  world.fx.ring(e.x, e.y, 1.2, '#7dff3a', 0.5);
});

registerEvent('skull_pickup', (e, world) => {
  world.fx.burst(e.x, 1.2, e.y, e.s ? '#7dff3a' : '#ffe080', { n: e.s ? 30 : 12, speed: 3, size: 0.5, life: 0.6 });
  play(e.s ? 'tag' : 'coin');
});

registerEvent('skull_potion', (e, world) => {
  const c = POTION_COLORS[e.t] || '#fff';
  world.fx.burst(e.x, 1.2, e.y, c, { n: 20, speed: 2.5, size: 0.5, life: 0.7, up: 1.5 });
  world.fx.glow(e.x, 1.2, e.y, c, 2, 0.4);
  play('drain');
});

registerEvent('skull_manaburn', (e, world) => {
  world.fx.bolt(e.x1, e.y1, e.x2, e.y2, '#60ff60');
  world.fx.burst(e.x2, 1.2, e.y2, '#60a0ff', { n: 14, speed: 3, size: 0.4, life: 0.5 });
  play('zap');
});

registerEvent('skull_slow', (e, world) => world.fx.burst(e.x, 1, e.y, '#a8e040', { n: 14, speed: 2, size: 0.4, life: 0.6 }));

// Rain of Fire: a warning ring, then each wave of falling fire.
registerEvent('skull_rof', (e, world) => {
  world.fx.ring(e.x, e.y, e.r, '#ff5020', 0.8);
  world.fx.scorch(e.x, e.y, e.r * 0.8, 8);
});
registerView('skull_fire', {
  make(e) {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff4010', transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
    disc.scale.setScalar(e.r);
    disc.position.y = 0.06;
    g.add(disc);
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.obj.children[0].material.opacity = 0.15 + Math.sin(world.time * 8) * 0.06;
    if (Math.random() < dt * 25) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * b.r;
      world.fx.flame(v.x + Math.cos(ang) * r, 0.05, v.z + Math.sin(ang) * r, 0.9, 0.5, 0.05);
    }
  },
});
registerEvent('skull_rofwave', (e, world) => {
  for (let i = 0; i < 5; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * e.r;
    world.fx.explosion(e.x + Math.cos(ang) * r, e.y + Math.sin(ang) * r, 0.7, { scorch: false });
  }
  play('boom');
});

registerEvent('skull_howl', (e, world) => {
  world.fx.shockwave(e.x, e.y, e.r, '#ff3030', 0.7);
  world.fx.ring(e.x, e.y, e.r, '#ff5050', 0.6);
  world.fx.text(e.x, 5, e.y, 'Howl of Terror!', '#ff6060', true);
  play('kodo');
});

// Carrion Swarm: a widening wave of bats.
registerEvent('skull_swarm', (e, world) => {
  for (let i = 0; i < 40; i++) {
    const d = Math.random() * 13;
    const w = (Math.random() - 0.5) * (2 + d * 0.5);
    const x = e.x + Math.cos(e.f) * d - Math.sin(e.f) * w;
    const z = e.y + Math.sin(e.f) * d + Math.cos(e.f) * w;
    world.fx.burst(x, 1.2, z, '#2a1a30', { n: 1, speed: 3, size: 0.6, life: 0.8, additive: false, grav: -1 });
  }
  play('windwalk');
});

registerEvent('skull_sleep', (e, world) => {
  world.fx.glow(e.x, 1.5, e.y, '#8080ff', 2, 0.5);
  world.fx.text(e.x, 2.8, e.y, 'Sleep', '#c8d8ff', true);
});

registerEvent('skull_win', (e, world) => {
  for (let i = 0; i < 4; i++) world.fx.burst(e.x, 2 + i, e.y, ['#ffd84a', '#7dff3a', '#ffffff', '#ff8040'][i], { n: 40, speed: 6, size: 0.7, life: 1.2 });
  world.fx.shockwave(e.x, e.y, 4, '#ffd84a', 0.8);
  play('victory');
});

// ------------------------------------------------------------ the cave

// Rock walls on every unwalkable tile that borders the floor (merged into a
// few meshes), lower rubble behind them, and torches along the walls.
registerMapBuilder('skull_cave', (map, world) => {
  const G = world.mapGroup;
  const grid = map.grid;
  const T = map.tile;
  const rows = grid.length;
  const cols = grid[0].length;
  const W = cols * T;
  const H = rows * T;
  const wall = (c, r) => c < 0 || r < 0 || c >= cols || r >= rows || grid[r][c] === '#';
  const centre = (c, r) => [-W / 2 + (c + 0.5) * T, -H / 2 + (r + 0.5) * T];
  const geos = [];
  const low = [];
  let seed = 600;
  const rock = (list, x, z, sx, sy, sz) => {
    const g = M.blob(sx, sy, sz, { seed: seed++, amt: 0.22, freq: 2.8, detail: 2 });
    g.rotateY(Math.random() * 6);
    g.translate(x, sy * 0.45, z);
    list.push(g);
  };
  for (let r = -2; r < rows + 2; r++) {
    for (let c = -2; c < cols + 2; c++) {
      if (!wall(c, r)) continue;
      let border = false;
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) if (!wall(c + dc, r + dr)) border = true;
      const [x, z] = centre(c, r);
      if (border) {
        rock(geos, x + (Math.random() - 0.5) * 0.6, z + (Math.random() - 0.5) * 0.6, T * 0.62, T * (0.9 + Math.random() * 0.6), T * 0.62);
        rock(geos, x + (Math.random() - 0.5) * 1.2, z + (Math.random() - 0.5) * 1.2, T * 0.42, T * (0.6 + Math.random() * 0.8), T * 0.42);
      } else if ((r + c) % 2 === 0) rock(low, x, z, T * 0.75, T * 0.5, T * 0.75);
    }
  }
  const mat = M.triMat('tex_boulder.webp', '#4a4440', '#8a8078', 0.45);
  const merged = mergeGeometries(geos);
  const walls = new THREE.Mesh(merged, mat);
  walls.castShadow = walls.receiveShadow = true;
  G.add(walls);
  if (low.length) {
    const back = new THREE.Mesh(mergeGeometries(low), M.triMat('tex_boulder.webp', '#2a2624', '#5a5048', 0.45));
    back.receiveShadow = true;
    G.add(back);
  }
  // Torches on the walls of each hall.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (wall(c, r) || (r * 7 + c * 3) % 9) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dc, dr]) => wall(c + dc, r + dr));
      if (!nb) continue;
      const [x, z] = centre(c, r);
      world.addProp({ t: 'torch', x: x + nb[0] * T * 0.35, y: z + nb[1] * T * 0.35 }, map.theme);
    }
  }
  // Stalagmites and bones scattered on the floor edges.
  for (let i = 0; i < 40; i++) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (wall(c, r)) continue;
    const [x, z] = centre(c, r);
    if (Math.random() < 0.5) {
      const s = M.mesh(M.tube([[0, 0, 0], [0.05, 0.4, 0], [0, 0.9, 0]], 0.18, 0.02, 6, 8), mat, x + (Math.random() - 0.5) * T * 0.8, 0, z + (Math.random() - 0.5) * T * 0.8);
      G.add(s);
    } else {
      const b = M.mesh(M.tube([[-0.3, 0.05, 0], [0, 0.08, 0.05], [0.3, 0.05, 0]], 0.04, 0.03, 6, 5), M.boneMat(), x + (Math.random() - 0.5) * T * 0.8, 0, z + (Math.random() - 0.5) * T * 0.8);
      b.rotation.y = Math.random() * 6;
      G.add(b);
    }
  }
});
