// Obey Archimonde (#22): Archimonde on his blighted dais, the warlock pads,
// the four commands (Roar, War Stomp, Bloodlust, Unholy Frenzy) and the
// lightning that strikes whoever disobeys.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerTheme, registerMapBuilder } from '../../engine/client/render/registry.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { play } from '../../engine/client/audio.js';

const NAMES = { roar: 'Roar!', stomp: 'War Stomp!', bloodlust: 'Bloodlust!', unholyfrenzy: 'Unholy Frenzy!' };
const COLORS = { roar: '#ff5a3a', stomp: '#e8d0a0', bloodlust: '#ff2a2a', unholyfrenzy: '#7dff5a' };

// Unlit glow materials, one per colour, so skins share them.
const glowCache = new Map();
const glow = (c) => glowCache.get(c) || glowCache.set(c, M.glowMat(c)).get(c);

// A low-poly sphere for a skin's small parts (eyes, studs, knuckles).
const LOW_SPHERE = new THREE.SphereGeometry(1, 10, 8);

// The Fel Orc Warlock (`nchw`), the player unit: a hulking red-skinned orc
// caster in a dark robe, hunched under a mantle of bone spikes and skulls,
// with a black top-knot, tusks and burning yellow eyes, leaning on a staff
// crowned with a horned skull and a green fel flame. Team colour on the robe's
// sash, hem and front panel. Faces +X.
export function felWarlock(color) {
  const { mesh, blob, tube, lathe, cloth, mat, G, scaled } = M;
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(1.4);
  g.add(body);
  const skin = mat('#d0503c', { roughness: 0.55 });
  const robe = M.texMat('tex_leather.webp', '#5a3454', '#e0b0d8', 1, { roughness: 0.9, side: THREE.DoubleSide });
  const robeDark = M.texMat('tex_leather.webp', '#301c2e', '#80607c', 1, { roughness: 0.95 });
  const team = mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  const bone = M.boneMat();
  const gold = M.goldMat();
  const leather = M.leatherMat('#a07050');
  const hair = mat('#1a1414', { roughness: 0.9 });
  const socket = hair;
  const wood = M.texMat('tex_wood.webp', '#4a3020', '#b09070');

  // Legs in dark wraps, heavy boots below the robe.
  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(0, 0.55, 0.13 * s);
    hip.add(mesh(tube([[0, 0, 0], [0.03, -0.25, 0.01 * s], [0.02, -0.46, 0]], 0.1, 0.08, 5, 8), robeDark));
    hip.add(mesh(blob(0.15, 0.07, 0.1, { seed: 60 + s, amt: 0.05, detail: 2 }), leather, 0.06, -0.5, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);

  // The robe: a long skirt split at the front over a team-colour panel, a
  // team hem and sash, and a hunched, heavy upper body.
  const skirt = mesh(lathe([[0.25, 0.74], [0.29, 0.6], [0.35, 0.36], [0.4, 0.16]], 22), robe);
  skirt.scale.z = 1.1;
  const hem = mesh(new THREE.TorusGeometry(0.4, 0.028, 6, 28).rotateX(Math.PI / 2), team, 0, 0.16, 0);
  hem.scale.z = 1.1;
  const sash = mesh(new THREE.TorusGeometry(0.26, 0.045, 8, 24).rotateX(Math.PI / 2), team, 0, 0.72, 0);
  sash.scale.z = 1.12;
  const panel = mesh(cloth(0.22, 0.52, 0.03, -0.05), team, 0.3, 0.46, 0);
  panel.rotation.y = Math.PI;
  const buckle = mesh(scaled(LOW_SPHERE, 0.06, 0.07, 0.06), gold, 0.28, 0.72, 0);
  const torso = mesh(blob(0.32, 0.34, 0.36, { seed: 62, amt: 0.05, detail: 2 }), robe, 0.0, 0.98, 0);
  torso.rotation.z = -0.3;
  const chest = mesh(blob(0.14, 0.18, 0.2, { seed: 63, amt: 0.04, detail: 2 }), skin, 0.22, 1.02, 0);
  // Mantle: leather pads, a skull on each, bone spikes fanning outward.
  const mantle = new THREE.Group();
  for (const s of [1, -1]) {
    const pad = mesh(new THREE.SphereGeometry(0.17, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), leather, -0.02, 1.17, 0.3 * s);
    pad.rotation.x = 0.45 * s;
    mantle.add(pad);
    mantle.add(mesh(scaled(LOW_SPHERE, 0.07, 0.075, 0.065), bone, 0.06, 1.2, 0.36 * s));
    for (const e of [-0.02, 0.02]) mantle.add(mesh(scaled(LOW_SPHERE, 0.018), socket, 0.12, 1.21, 0.36 * s + e));
    for (let i = 0; i < 3; i++) {
      const sp = mesh(new THREE.ConeGeometry(0.035, 0.26, 7), bone, -0.1 + i * 0.07, 1.3, 0.34 * s);
      sp.rotation.x = s * (0.5 + i * 0.12);
      sp.rotation.z = 0.3 - i * 0.15;
      mantle.add(sp);
    }
  }
  const collar = mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 18).rotateX(Math.PI / 2), robeDark, 0.05, 1.2, 0);
  // Arms: wide sleeves, bare red hands; the right one grips the staff.
  const arm = (s, reach) => {
    const a = new THREE.Group();
    a.add(mesh(tube([[-0.04, 1.12, 0.34 * s], [0.08 + reach * 0.06, 0.9, 0.42 * s], [0.2 + reach * 0.12, 0.72, 0.36 * s]], 0.08, 0.12, 8, 10), robe));
    a.add(mesh(new THREE.TorusGeometry(0.11, 0.025, 6, 16).rotateY(Math.PI / 2).rotateZ(-0.6), team, 0.2 + reach * 0.12, 0.72, 0.36 * s));
    a.add(mesh(blob(0.08, 0.08, 0.075, { seed: 64 + s, detail: 2 }), skin, 0.26 + reach * 0.13, 0.64, 0.35 * s));
    return a;
  };
  // Head thrust forward: heavy brow, underbite and tusks, long ears, a bald
  // red scalp with a black top-knot and braid, glowing eyes.
  const head = new THREE.Group();
  head.position.set(0.24, 1.3, 0);
  head.scale.setScalar(1.2);
  head.add(mesh(blob(0.15, 0.15, 0.14, { seed: 65, amt: 0.05 }), skin, 0, 0.04, 0));
  head.add(mesh(blob(0.12, 0.09, 0.14, { seed: 66, amt: 0.05, detail: 2 }), skin, 0.07, -0.07, 0));
  head.add(mesh(blob(0.05, 0.03, 0.12, { seed: 67, amt: 0.04, detail: 2 }), skin, 0.12, 0.09, 0));
  for (const s of [1, -1]) {
    head.add(mesh(scaled(LOW_SPHERE, 0.026), glow('#ffd040'), 0.14, 0.05, 0.055 * s));
    const t = mesh(new THREE.ConeGeometry(0.024, 0.1, 8), bone, 0.16, -0.03, 0.07 * s);
    t.rotation.z = -0.25;
    head.add(t);
    const ear = mesh(new THREE.ConeGeometry(0.05, 0.25, 8), skin, -0.02, 0.08, 0.16 * s);
    ear.rotation.x = s * 1.3;
    ear.rotation.z = 0.35;
    head.add(ear);
  }
  head.add(mesh(blob(0.05, 0.06, 0.05, { seed: 68, detail: 2 }), hair, -0.06, 0.19, 0));
  head.add(mesh(tube([[-0.08, 0.2, 0], [-0.2, 0.14, 0], [-0.26, -0.05, 0], [-0.28, -0.25, 0]], 0.035, 0.015, 10, 6), hair));
  head.add(mesh(new THREE.TorusGeometry(0.04, 0.012, 5, 12).rotateY(Math.PI / 2), gold, -0.2, 0.13, 0));

  // The staff in the right hand: a gnarled shaft, a horned skull and a green
  // flame. It is the "staff" the cast animation raises.
  const staff = new THREE.Group();
  staff.position.set(0.42, 0.66, -0.36);
  staff.add(mesh(tube([[0, -0.64, 0], [0.03, -0.1, 0.01], [-0.02, 0.4, 0], [0.01, 0.82, 0]], 0.035, 0.028, 12, 7), wood));
  staff.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 10), leather, 0.02, 0.0, 0));
  staff.add(mesh(scaled(LOW_SPHERE, 0.1, 0.1, 0.09), bone, 0.01, 0.92, 0));
  staff.add(mesh(blob(0.07, 0.04, 0.07, { seed: 69, detail: 2 }), bone, 0.05, 0.84, 0));
  for (const s of [1, -1]) {
    staff.add(mesh(scaled(LOW_SPHERE, 0.024), socket, 0.09, 0.93, 0.035 * s));
    staff.add(mesh(tube([[0, 0.97, 0.06 * s], [-0.04, 1.08, 0.16 * s], [0.04, 1.2, 0.2 * s], [0.12, 1.24, 0.14 * s]], 0.03, 0.006, 10, 6), bone));
  }
  staff.add(mesh(scaled(LOW_SPHERE, 0.08), glow('#9aff60'), 0.02, 1.12, 0));
  const flame = mesh(new THREE.ConeGeometry(0.07, 0.24, 10), glow('#5aff3a'), 0.02, 1.24, 0);
  staff.add(flame);

  body.add(legL, legR, skirt, hem, sash, panel, buckle, torso, chest, mantle, collar, arm(1, 0), arm(-1, 1), head, staff);
  g.userData = { body, staff, legL, legR, kind: 'hero' };
  return g;
}

registerSkin('obey_warlock', (color) => felWarlock(color));

registerTheme(
  'obey',
  { sky: '#1a1024', fog: '#241632', floor: ['#6a6070', 30, {}], sun: '#ffd8e8', hemi: ['#b0a0d8', '#2a1830'], sunI: 2.0 },
  {
    floor: { tex: 'tex_stone.webp', tint: '#b4acc0', color: '#6a6470', units: 6 },
    edge: { tex: 'tex_dirt.webp', tint: '#7a5a80', color: '#4a3450', units: 5 },
    outer: { tex: 'tex_dirt.webp', tint: '#5a4070', color: '#3a2a44' },
    edgeWidth: 1.3,
  },
);

// Archimonde the Defiler: a towering blue eredar with digitigrade legs and
// hooves, glowing fel runes, spiked pauldrons, a horned crown and a beard of
// tendrils. Faces +X. Parts are grouped at their joints for the animations.
function archimonde() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = M.triMat('tex_hide.webp', '#4656a8', '#9aa8ff', 1.1, { roughness: 0.55 });
  const skinDark = M.triMat('tex_hide.webp', '#303c80', '#7080d8', 1.1, { roughness: 0.6 });
  const metal = M.texMat('tex_plate.webp', '#3a3044', '#8a78a0', 1, { metalness: 0.6, roughness: 0.35 });
  const gold = M.goldMat();
  const rune = M.glowMat('#7dff5a');
  const horn = M.mat('#2a2230', { roughness: 0.4 });
  const cloth = M.mat('#4a1e5a', { roughness: 0.85, side: THREE.DoubleSide });
  const legs = [];
  for (const s of [1, -1]) {
    const hip = new THREE.Group();
    hip.position.set(0, 1.95, 0.36 * s);
    hip.add(M.mesh(M.tube([[0, 0, 0], [0.28, -0.7, 0.03 * s], [-0.18, -1.35, 0.04 * s], [-0.02, -1.85, 0.02 * s]], 0.26, 0.11, 16, 12), skin));
    hip.add(M.mesh(M.blob(0.2, 0.14, 0.18, { seed: 101 }), horn, 0.04, -1.88, 0));
    hip.add(M.mesh(M.scaled(M.G.sphere, 0.17), metal, 0.3, -0.7, 0.05 * s));
    hip.add(M.mesh(M.scaled(M.G.cone, 0.07, 0.25, 0.07), gold, 0.42, -0.62, 0.05 * s));
    legs.push(hip);
    body.add(hip);
  }
  // Tail, loincloth and belt.
  body.add(M.mesh(M.tube([[-0.3, 2.0, 0], [-0.8, 1.6, 0], [-1.2, 0.8, 0.2], [-1.6, 0.25, 0.5]], 0.14, 0.03, 16, 8), skinDark));
  const front = M.mesh(M.cloth(0.55, 1.1, 0.08, 0.05), cloth, 0.42, 1.55, 0);
  front.rotation.y = Math.PI;
  body.add(front, M.mesh(M.cloth(0.7, 1.2, 0.1, 0.15), cloth, -0.36, 1.5, 0));
  const belt = M.mesh(new THREE.TorusGeometry(0.5, 0.07, 8, 28).rotateX(Math.PI / 2), gold, 0, 2.08, 0);
  belt.scale.z = 1.15;
  body.add(belt, M.mesh(M.scaled(M.G.sphere, 0.13), M.glowMat('#9dff7a'), 0.5, 2.08, 0));
  // Torso: a broad, muscular chest with fel runes.
  const torso = new THREE.Group();
  torso.position.set(0, 2.1, 0);
  body.add(torso);
  torso.add(M.mesh(M.blob(0.55, 0.62, 0.72, { seed: 102, amt: 0.06 }), skin, 0, 0.55, 0));
  torso.add(M.mesh(M.blob(0.5, 0.42, 0.85, { seed: 103, amt: 0.05 }), skin, 0.08, 1.02, 0));
  for (const s of [1, -1]) {
    torso.add(M.mesh(M.tube([[0.52, 1.05, 0.08 * s], [0.56, 0.8, 0.3 * s], [0.5, 0.5, 0.42 * s]], 0.025, 0.02, 8, 5), rune));
    torso.add(M.mesh(M.tube([[0.5, 0.45, 0.12 * s], [0.55, 0.25, 0.2 * s]], 0.022, 0.018, 4, 5), rune));
  }
  // Head with horned crown and tendril beard.
  const head = new THREE.Group();
  head.position.set(0.18, 1.52, 0);
  torso.add(head);
  head.add(M.mesh(M.blob(0.3, 0.34, 0.28, { seed: 104 }), skin, 0.05, 0.2, 0));
  head.add(M.mesh(M.blob(0.2, 0.12, 0.22, { seed: 105 }), skinDark, 0.18, 0.02, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.scaled(M.G.sphere, 0.05, 0.035, 0.05), M.glowMat('#caff9a'), 0.3, 0.26, 0.11 * s));
    // The great swept-back horns of his crown.
    head.add(M.mesh(M.tube([[0.1, 0.42, 0.14 * s], [0.0, 0.8, 0.32 * s], [-0.35, 1.15, 0.42 * s], [-0.75, 1.2, 0.36 * s]], 0.09, 0.012, 16, 8), horn));
    head.add(M.mesh(M.tube([[0.05, 0.3, 0.26 * s], [-0.15, 0.45, 0.5 * s], [-0.45, 0.4, 0.62 * s]], 0.06, 0.01, 10, 6), horn));
    head.add(M.mesh(M.scaled(M.G.sphere, 0.06), gold, 0.08, 0.42, 0.16 * s));
  }
  head.add(M.mesh(M.tube([[0.2, 0.45, 0], [0.1, 0.8, 0], [-0.15, 1.05, 0]], 0.07, 0.01, 12, 8), horn));
  for (let i = -2; i <= 2; i++) head.add(M.mesh(M.tube([[0.25, 0.0, i * 0.06], [0.3, -0.25, i * 0.08], [0.22, -0.5 - Math.abs(i) * 0.04, i * 0.1]], 0.035, 0.008, 8, 6), skinDark));
  // Shoulders and arms.
  const arms = [];
  for (const s of [1, -1]) {
    const pa = new THREE.Group();
    pa.position.set(0, 1.22, 0.72 * s);
    torso.add(pa);
    const p = M.mesh(new THREE.SphereGeometry(0.42, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), metal, 0, 0.05, 0.05 * s);
    p.rotation.x = 0.35 * s;
    pa.add(p);
    for (let k = 0; k < 3; k++) {
      const sp = M.mesh(M.scaled(M.G.cone, 0.08, 0.5, 0.08), gold, -0.15 + k * 0.15, 0.42, (0.18 + k * 0.03) * s);
      sp.rotation.x = 0.4 * s;
      pa.add(sp);
    }
    const arm = new THREE.Group();
    arm.position.set(0, 0, 0.1 * s);
    arm.add(M.mesh(M.tube([[0, 0, 0], [0.15, -0.55, 0.12 * s], [0.45, -1.0, 0.08 * s]], 0.2, 0.15, 10, 10), skin));
    arm.add(M.mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.42, 14), metal, 0.35, -0.85, 0.09 * s).rotateZ(-0.8));
    arm.add(M.mesh(M.tube([[0.2, -0.5, 0.2 * s], [0.3, -0.72, 0.22 * s]], 0.02, 0.02, 3, 5), rune));
    const hand = new THREE.Group();
    hand.position.set(0.55, -1.12, 0.08 * s);
    hand.add(M.mesh(M.blob(0.17, 0.13, 0.13, { seed: 106 }), skin));
    for (let c = -1; c <= 1; c++) {
      const claw = M.mesh(M.scaled(M.G.cone, 0.03, 0.16, 0.03), horn, 0.14, -0.08, c * 0.07);
      claw.rotation.z = -2.3;
      hand.add(claw);
    }
    arm.add(hand);
    pa.add(arm);
    arms.push(arm);
  }
  body.scale.setScalar(1.25);
  const aura = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  aura.position.y = 0.08;
  g.add(aura);
  g.userData = { body, torso, head, arms, legs, aura };
  return g;
}

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
// 0 -> 1 -> 0 over [a, b, c].
const hump = (t, a, b, c) => (t < a || t > c ? 0 : t < b ? ease((t - a) / (b - a)) : 1 - ease((t - b) / (c - b)));

registerView('obey_archimonde', {
  bake: true,
  make(e, world, v) {
    const g = archimonde();
    v.parts = g.userData;
    return g;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    const ct = b.ct != null ? (a.ct ?? b.ct) + ((b.ct ?? 0) - (a.ct ?? b.ct)) * k : 99;
    const o = b.o;
    const t = world.time;
    // Idle: a slow, heavy breath and a sway of the arms.
    let lean = Math.sin(t * 1.2) * 0.02;
    let headUp = 0;
    let armOut = 0.15 + Math.sin(t * 1.2) * 0.03;
    let armUp = 0;
    let legLift = 0;
    let drop = 0;
    if (o === 'roar') {
      const h = hump(ct, 0, 0.35, 1.4);
      lean += 0.25 * h;
      headUp = 0.6 * h;
      armOut += 0.9 * h;
    } else if (o === 'stomp') {
      legLift = hump(ct, 0, 0.45, 0.62);
      drop = hump(ct, 0.55, 0.62, 1.0) * 0.2;
      armOut += 0.5 * hump(ct, 0, 0.45, 1.0);
    } else if (o === 'bloodlust' || o === 'unholyfrenzy') {
      armUp = hump(ct, 0, 0.35, 1.2);
      headUp = 0.3 * armUp;
    }
    P.torso.rotation.z = lean;
    P.head.rotation.z = headUp;
    P.arms.forEach((arm, i) => {
      const s = i ? -1 : 1;
      arm.rotation.x = -s * armOut;
      arm.rotation.z = armUp * 2.2;
    });
    P.legs[0].rotation.z = legLift * 0.9;
    P.legs[0].position.y = 1.95 + legLift * 0.5;
    P.body.position.y = -drop;
    // Buffs last until the window closes.
    const open = b.w != null;
    const bl = open && o === 'bloodlust';
    const uf = open && o === 'unholyfrenzy';
    const target = bl ? 1.4 : 1.25;
    const cur = P.body.scale.x;
    P.body.scale.setScalar(cur + (target - cur) * Math.min(1, dt * 4));
    P.aura.material.color.set(uf ? '#58ff3a' : '#ff2a2a');
    P.aura.material.opacity = bl || uf ? 0.28 + Math.sin(t * 5) * 0.08 : Math.max(0, P.aura.material.opacity - dt);
    if ((bl || uf) && Math.random() < dt * 30) {
      const ang = Math.random() * Math.PI * 2;
      world.fx.trail(v.x + Math.cos(ang) * 1.3, 1 + Math.random() * 4, v.z + Math.sin(ang) * 1.3, bl ? '#ff3020' : '#6aff40', 0.9, 0.7, 0.4);
    }
    // Fel smoke curling off him.
    if (Math.random() < dt * 5) world.fx.smokePuff(v.x + (Math.random() - 0.5) * 2, 0.3, v.z + (Math.random() - 0.5) * 2, '#3a2a48', 1.6, 2, 0.35);
  },
});

// A warlock pad: a rune circle under each contestant in their colour, pulsing
// red while they still owe Archimonde an answer.
registerView('obey_pad', {
  bake: true, // the stone base merges; the glowing rings stay transparent and untouched.
  make(e, world, v) {
    const g = new THREE.Group();
    const c = world.colors[e.o] || '#ffffff';
    const base = M.mesh(M.lathe([[1.25, 0], [1.25, 0.03], [1.15, 0.05], [0.001, 0.05]], 8), M.texMat('tex_stone.webp', '#6a6470', '#a8a0b0'), 0, 0, 0);
    base.rotation.y = Math.PI / 8;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
    ring.position.y = 0.07;
    const inner = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.6, 5).rotateX(-Math.PI / 2), ring.material);
    inner.position.y = 0.07;
    const warn = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff2020', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    warn.position.y = 0.08;
    g.add(base, ring, inner, warn);
    v.parts = { ring, inner, warn };
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.obj.rotation.y = 0;
    v.parts.inner.rotation.y = world.time * 0.6;
    v.parts.ring.material.opacity = b.dead ? 0.15 : 0.8;
    v.parts.warn.material.opacity = b.t && !b.dead ? 0.18 + Math.sin(world.time * 10) * 0.1 : 0;
  },
});

// Buffs on a contestant: Roar (a red glow), Bloodlust (red embers), Unholy Frenzy (fel-green smoke).
registerView('obey_buff', {
  make() {
    const g = new THREE.Group();
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff3020', transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    glow.position.y = 0.17;
    g.add(glow);
    return g;
  },
  update(v, a, b, k, dt, world) {
    const bs = (b.b || '').split(',');
    const glow = v.obj.children[0];
    const bl = bs.includes('bloodlust');
    const uf = bs.includes('unholyfrenzy');
    glow.material.color.set(uf && !bl ? '#58ff3a' : '#ff3020');
    glow.material.opacity = 0.2 + Math.sin(world.time * 6) * 0.06;
    const rate = (bl ? 18 : 0) + (uf ? 18 : 0) + (bs.includes('roar') ? 6 : 0);
    v.acc = (v.acc || 0) + rate * dt;
    for (; v.acc >= 1; v.acc--) {
      const ang = Math.random() * Math.PI * 2;
      const c = uf && (!bl || Math.random() < 0.5) ? '#6aff40' : '#ff3a20';
      world.fx.trail(v.x + Math.cos(ang) * 0.6, 0.4 + Math.random() * 2, v.z + Math.sin(ang) * 0.6, c, 0.5, 0.6, 0.2);
    }
  },
});

function orderFx(world, o, x, z, big) {
  const fx = world.fx;
  const s = big ? 2.2 : 1;
  const c = COLORS[o];
  if (o === 'roar') {
    fx.shockwave(x, z, 3.5 * s, '#ff6a4a', 0.6);
    fx.burst(x, 2.2 * s, z, c, { n: 18 * s, speed: 5 * s, size: 0.6, life: 0.5, up: 0.3 });
    fx.glow(x, 2 * s, z, c, 2.5 * s, 0.35);
    play('windwalk');
  } else if (o === 'stomp') {
    fx.shockwave(x, z, 3 * s, '#ffe0b0', 0.5);
    fx.dustCloud(x, z, 0.9 * s, '#8a7a68', 10);
    fx.debrisBurst(x, z, 6 * s, 4);
    if (big) world.shake = 0.25;
    play('smack');
  } else {
    const n = 24 * s;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      fx.trail(x + Math.cos(ang) * 0.8 * s, 0.5 + (i / n) * 2.5 * s, z + Math.sin(ang) * 0.8 * s, c, 0.7, 0.8, 0.1);
    }
    fx.glow(x, 1.5 * s, z, c, 3 * s, 0.4);
    fx.ring(x, z, 1.4 * s, c, 0.5);
    play(o === 'bloodlust' ? 'drain' : 'gravity');
  }
}

registerEvent('obey_cmd', (e, world) => {
  orderFx(world, e.o, e.x, e.y, true);
  world.fx.text(e.x, 7.5, e.y, NAMES[e.o], COLORS[e.o], true);
});

registerEvent('obey_do', (e, world) => orderFx(world, e.o, e.x, e.y, false));

// Disobedience: a bolt from the sky, an explosion and a hard camera shake.
registerEvent('obey_death', (e, world) => {
  const pts = [];
  let x = e.x + (Math.random() - 0.5) * 2;
  let z = e.y - 3;
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    pts.push(new THREE.Vector3(x + (e.x - x) * k + (i && i < 10 ? (Math.random() - 0.5) * 0.8 : 0), 16 * (1 - k), z + (e.y - z) * k + (i && i < 10 ? (Math.random() - 0.5) * 0.8 : 0)));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const bolt = new THREE.Group();
  for (const [r, c, op] of [[0.07, '#ffffff', 1], [0.3, '#9fd4ff', 0.5]]) bolt.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, r, 5), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  world.scene.add(bolt);
  world.fx.transients.push({ obj: bolt, t: 0, dur: 0.35, update: (k) => bolt.children.forEach((m, i) => (m.material.opacity = (i ? 0.5 : 1) * (1 - k) * (Math.random() < 0.7 ? 1 : 0.3))), dispose: () => bolt.children.forEach((m) => { m.geometry.dispose(); m.material.dispose(); }) });
  world.fx.flash(e.x, e.y, 5, '#bfe0ff', 0.3);
  world.fx.explosion(e.x, e.y, 1.3);
  world.fx.sparks(e.x, 1, e.y, 16, 6, '#bfe6ff');
  world.shake = 0.6;
  play('lightning');
  play('bigboom');
});

// The hall: Archimonde's blighted dais in the north, pillars and braziers
// down the sides, and rubble along the unwalkable edges.
registerMapBuilder('obey_hall', (map, world) => {
  // Static scenery (dais, blight, crystals, pillars, rubble), merged per
  // material at the end. Torches go through world.addProp, untouched.
  const G = new THREE.Group();
  const hw = map.floor.w / 2;
  const hh = map.floor.h / 2;
  const ax = map.archi.x;
  const az = map.archi.y;
  const stone = M.texMat('tex_stone.webp', '#6a6470', '#9a92a4', 1);
  const dark = M.texMat('tex_stone.webp', '#3a3040', '#6a5a74', 1);
  // Stepped octagonal dais.
  const dais = M.mesh(M.lathe([[3.4, 0], [3.4, 0.25], [3.0, 0.28], [3.0, 0.5], [2.6, 0.53], [2.6, 0.75], [0.001, 0.75]], 8), stone, ax, 0, az);
  dais.rotation.y = Math.PI / 8;
  G.add(dais);
  // Blight creeping over it.
  const blight = new THREE.Mesh(new THREE.CircleGeometry(2.5, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#4a2a5a', roughness: 0.4, transparent: true, opacity: 0.85 }));
  blight.position.set(ax, 0.77, az);
  G.add(blight);
  // Fel crystals and spikes round the dais.
  const fel = M.glowMat('#6aff40');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = ax + Math.cos(a) * 3.8;
    const z = az + Math.sin(a) * 3.8;
    const spike = M.mesh(M.tube([[0, 0, 0], [0.05, 1.2, 0], [0.2, 2.4, 0]], 0.28, 0.02, 10, 8), dark, x, 0, z);
    spike.rotation.y = -a;
    G.add(spike);
    if (i % 2) G.add(M.mesh(M.scaled(M.G.cone, 0.12, 0.6, 0.12), fel, x, 0.3, z));
  }
  // Pillars and braziers down the sides of the hall.
  for (const sx of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      const z = -hh + 2 + j * ((hh * 2 - 4) / 2);
      const p = M.pillar(1.1);
      p.position.set(sx * (hw + 1.2), 0, z);
      G.add(p);
    }
  }
  for (const [x, z] of [[-hw + 1.5, az + 1], [hw - 1.5, az + 1], [-hw - 0.5, hh - 0.5], [hw + 0.5, hh - 0.5]]) world.addProp({ t: 'torch', x, y: z }, map.theme);
  // Rubble and dark rock round the edges.
  for (let i = 0; i < 60; i++) {
    const side = i % 4;
    const t = Math.random() * 2 - 1;
    const out = 1.6 + Math.random() * 3;
    const [x, z] = [[t * hw, -hh - out], [t * hw, hh + out], [-hw - out, t * hh], [hw + out, t * hh]][side];
    const r = M.rock(0.5 + Math.random() * 1.2);
    r.children[0].material = M.triMat('tex_boulder.webp', '#4a4050', '#8a7a98', 0.9);
    r.position.set(x, 0, z);
    G.add(r);
  }
  bakeStatic(G);
  world.mapGroup.add(G);
});
