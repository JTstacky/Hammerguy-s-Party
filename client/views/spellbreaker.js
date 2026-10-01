// #42 Spell Breaker Blood: the blood-elf Spell Breaker, the Demon Gate, the
// gate's summons (carrion scarabs, skeletons, skeletal mages, Infernal,
// Doom Guard), the night arena with its cliff-notched corners, and the
// Control Magic / Spell Steal / Bloodlust / Feedback effects.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerTheme, registerMapBuilder } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { unitBar, setBar, teamRing, slab, smooth, doomGuard, animDoomGuard, glowSprite, emissive, glow } from './up-kit.js';

registerTheme(
  'sbnight',
  { sky: '#080a18', fog: '#0e1024', floor: ['#28382e', 30, { blades: true }], outer: ['#18241c', 30, { blades: true }], sun: '#aab6ff', hemi: ['#6a78c0', '#1a1420'], sunI: 1.6 },
  { floor: { tex: 'tex_nightgrass.webp', tint: '#c4c8e0', color: '#28382e' }, edge: { tex: 'tex_dirt.webp', tint: '#7a7090', color: '#3a3440', units: 5 }, outer: { tex: 'tex_nightgrass.webp', tint: '#6a7090', color: '#18241c' }, edgeWidth: 1.2 },
);

// ------------------------------------------------------------ Spell Breaker

// A blood-elf Spell Breaker: crimson-and-gold plate, a winged helm over a
// fall of golden hair and long ears, a great round shield on the left arm and
// a curved elven blade raised in the right, a team-coloured tabard and cape.
function spellBreaker(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const red = M.texMat('tex_plate.webp', '#8a1c18', '#e0584a', 1, { metalness: 0.6, roughness: 0.35 });
  const gold = M.goldMat();
  const skin = M.mat('#f0d2b4', { roughness: 0.6 });
  const hair = M.mat('#f2d066', { roughness: 0.55 });
  const team = M.mat(color, { side: THREE.DoubleSide, roughness: 0.8 });
  const teamDark = M.mat(M.darken(color, 0.55), { side: THREE.DoubleSide, roughness: 0.85 });
  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(0, 0.66, 0.12 * s);
    hip.add(M.mesh(M.tube([[0, 0, 0], [0.03, -0.3, 0], [0, -0.58, 0]], 0.085, 0.07, 6, 10), red));
    hip.add(M.mesh(M.scaled(M.G.sphere, 0.075), gold, 0.05, -0.3, 0));
    hip.add(M.mesh(M.blob(0.14, 0.06, 0.08, { seed: 3 }), gold, 0.05, -0.62, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  const torso = M.mesh(M.lathe([[0.17, 0.62], [0.2, 0.74], [0.25, 0.92], [0.27, 1.06], [0.22, 1.18], [0.11, 1.26], [0.06, 1.28]]), red);
  torso.scale.set(0.85, 1, 1.12);
  const belt = M.mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 24).rotateX(Math.PI / 2), gold, 0, 0.72, 0);
  const tabard = M.mesh(M.cloth(0.22, 0.62, 0.04), team, 0.23, 0.6, 0);
  tabard.rotation.y = Math.PI;
  const cape = M.mesh(M.cloth(0.56, 0.9, 0.08, 0.22), teamDark, -0.2, 0.74, 0);
  const gorget = M.mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.08, 16), gold, 0, 1.27, 0);
  // Head: pale face, long swept-back ears, golden hair, a winged helm.
  const head = new THREE.Group();
  head.position.set(0.02, 1.42, 0);
  head.add(M.mesh(M.blob(0.12, 0.14, 0.11, { seed: 5, amt: 0.04 }), skin, 0.02, 0, 0));
  head.add(M.mesh(M.blob(0.13, 0.15, 0.14, { seed: 6, amt: 0.05 }), hair, -0.07, -0.02, 0));
  head.add(M.mesh(M.tube([[-0.08, 0.02, 0], [-0.22, -0.14, 0], [-0.3, -0.36, 0]], 0.09, 0.02, 8, 8), hair));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.tube([[0, 0.0, 0.1 * s], [-0.12, 0.08, 0.2 * s], [-0.26, 0.16, 0.24 * s]], 0.03, 0.004, 8, 6), skin));
    head.add(M.mesh(M.scaled(M.G.sphere, 0.018), glow('#7dff6a'), 0.12, 0.02, 0.045 * s));
  }
  head.add(M.mesh(M.lathe([[0.001, 0.2], [0.1, 0.18], [0.14, 0.1], [0.14, 0.04]], 20), red, -0.01, 0, 0));
  head.add(M.mesh(slab(smooth([[0, 0], [0.05, 0.18], [-0.06, 0.34], [-0.16, 0.12]], 4), 0.025, 0.008), gold, -0.02, 0.14, 0));
  for (const s of [1, -1]) {
    const wing = M.mesh(slab(smooth([[0, 0], [-0.06, 0.12], [-0.22, 0.22], [-0.16, 0.06]], 4), 0.02, 0.006), gold, -0.02, 0.1, 0.13 * s);
    wing.rotation.x = -0.35 * s;
    head.add(wing);
  }
  const pauld = (s) => {
    const p = M.mesh(new THREE.SphereGeometry(0.14, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold, 0, 1.13, 0.27 * s);
    p.rotation.x = 0.55 * s;
    p.scale.set(1, 0.8, 1.1);
    return p;
  };
  // Shield arm (left, +Z): a great round shield with a green fel gem.
  const shieldArm = new THREE.Group();
  shieldArm.position.set(0.02, 1.1, 0.3);
  shieldArm.add(M.mesh(M.tube([[0, 0, 0], [0.12, -0.2, 0.06], [0.22, -0.35, 0.08]], 0.07, 0.06, 6, 8), red));
  const shield = new THREE.Group();
  shield.position.set(0.26, -0.3, 0.16);
  shield.add(M.mesh(M.lathe([[0.001, 0.05], [0.18, 0.04], [0.3, 0.0], [0.34, -0.03], [0.34, -0.05]], 28), M.texMat('tex_plate.webp', '#8a1c18', '#e0584a', 1, { metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide })));
  shield.add(M.mesh(new THREE.TorusGeometry(0.34, 0.03, 8, 32).rotateX(Math.PI / 2), gold, 0, -0.04, 0));
  shield.add(M.mesh(M.scaled(M.G.sphere, 0.07, 0.04, 0.07), emissive('#40ff60', '#20c040', 1.4), 0, 0.06, 0));
  for (let i = 0; i < 4; i++) {
    const ray = M.mesh(M.scaled(M.G.box, 0.03, 0.02, 0.24), gold, 0, 0.04, 0);
    ray.rotation.y = (i / 4) * Math.PI;
    ray.position.set(0, 0.02, 0);
    shield.add(ray);
  }
  shield.rotation.x = -Math.PI / 2 + 0.2;
  shield.rotation.z = 0.25;
  shieldArm.add(shield);
  // Blade arm (right, -Z): a curved elven blade.
  const bladeArm = new THREE.Group();
  bladeArm.position.set(0.02, 1.1, -0.3);
  bladeArm.add(M.mesh(M.tube([[0, 0, 0], [0.1, -0.22, -0.04], [0.2, -0.36, 0]], 0.07, 0.06, 6, 8), red));
  const blade = new THREE.Group();
  blade.position.set(0.22, -0.4, 0);
  blade.add(M.mesh(M.tube([[0, -0.14, 0], [0, 0.08, 0]], 0.03, 0.03, 2, 8), M.leatherMat('#5a1a10')));
  blade.add(M.mesh(slab(smooth([[-0.16, 0.08], [0.16, 0.08], [0.2, 0.14], [-0.2, 0.14]], 2), 0.05, 0.01), gold, 0, 0, 0));
  blade.add(M.mesh(slab(smooth([[-0.05, 0.12], [0.06, 0.14], [0.14, 0.55], [0.08, 0.95], [0.0, 1.05], [0.02, 0.6], [-0.05, 0.3]], 5), 0.03, 0.012), M.silverMat(), 0, 0, 0));
  blade.rotation.z = -0.5;
  bladeArm.add(blade);
  body.add(legL, legR, torso, belt, tabard, cape, gorget, head, pauld(1), pauld(-1), shieldArm, bladeArm);
  body.scale.setScalar(1.45);
  g.userData = { body, legL, legR, staff: bladeArm, kind: 'hero' };
  return g;
}
registerSkin('spellbreaker', spellBreaker);

// ------------------------------------------------------------ summons

const carapace = () => M.triMat('tex_hide.webp', '#1c2a1a', '#6a8a5a', 2.2, { metalness: 0.35, roughness: 0.35 });
const bone = () => M.triMat('tex_boulder.webp', '#d8ceb4', '#fff4dc', 2.5, { roughness: 0.55 });

// A carrion scarab: a glossy segmented beetle with hooked mandibles and six
// jointed legs; bigger levels grow a horn and spines.
function scarab(level = 1) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shell = carapace();
  const under = M.mat('#2a1a10', { roughness: 0.7 });
  body.add(M.mesh(M.blob(0.55, 0.32, 0.42, { seed: 21, amt: 0.05 }), shell, -0.25, 0.45, 0));
  body.add(M.mesh(M.blob(0.32, 0.26, 0.36, { seed: 22, amt: 0.05 }), shell, 0.32, 0.46, 0));
  // The wing-case seam and ridges.
  body.add(M.mesh(M.tube([[0.25, 0.72, 0], [-0.25, 0.78, 0], [-0.75, 0.55, 0]], 0.025, 0.015, 10, 6), M.mat('#0c140c', { roughness: 0.3 })));
  const head = new THREE.Group();
  head.position.set(0.62, 0.42, 0);
  head.add(M.mesh(M.blob(0.2, 0.17, 0.22, { seed: 23 }), shell, 0, 0, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.tube([[0.1, -0.04, 0.1 * s], [0.3, -0.02, 0.16 * s], [0.42, 0.0, 0.04 * s]], 0.045, 0.01, 10, 6), M.boneMat()));
    head.add(M.mesh(M.scaled(M.G.sphere, 0.04), glow(level > 2 ? '#ff5a30' : '#c8ff5a'), 0.14, 0.07, 0.12 * s));
  }
  if (level >= 2) head.add(M.mesh(M.tube([[0.05, 0.12, 0], [0.18, 0.35, 0], [0.12, 0.52, 0]], 0.07, 0.01, 10, 8), M.mat('#1a1410', { roughness: 0.4 })));
  body.add(head);
  const legs = [];
  for (const s of [1, -1]) {
    for (let k = 0; k < 3; k++) {
      const hip = new THREE.Group();
      hip.position.set(0.3 - k * 0.32, 0.4, 0.28 * s);
      hip.add(M.mesh(M.tube([[0, 0, 0], [0.05, 0.12, 0.3 * s], [0.12 - k * 0.1, -0.36, 0.5 * s]], 0.04, 0.02, 8, 6), under));
      legs.push(hip);
      body.add(hip);
    }
  }
  if (level >= 3) for (let k = 0; k < 4; k++) body.add(M.mesh(M.scaled(M.G.cone, 0.05, 0.22, 0.05), M.mat('#161010'), 0.1 - k * 0.25, 0.85 - k * 0.04, 0));
  g.userData = { body, legs, head, kind: 'bug' };
  return g;
}

// A burrowed scarab: a mound of churned earth with the beetle's back and
// horn breaking the surface and a faint glow in the soil.
function burrow() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  body.add(M.mesh(M.blob(1.0, 0.32, 0.95, { seed: 31, amt: 0.14, freq: 3 }), M.triMat('tex_dirt.webp', '#5a4632', '#b8a088', 1.6), 0, 0.05, 0));
  body.add(M.mesh(M.blob(0.55, 0.28, 0.45, { seed: 32, amt: 0.05 }), carapace(), 0.05, 0.25, 0));
  body.add(M.mesh(M.tube([[0.4, 0.3, 0], [0.62, 0.55, 0], [0.55, 0.78, 0]], 0.08, 0.01, 10, 8), M.mat('#1a1410', { roughness: 0.4 })));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    body.add(M.mesh(M.blob(0.14, 0.1, 0.12, { seed: 33 + k }), M.boulderMat(), Math.cos(a) * 0.85, 0.08, Math.sin(a) * 0.8));
  }
  g.userData = { body, legs: [], kind: 'bug' };
  return g;
}

// A skeleton warrior (or, robed, a skeletal mage): a bone frame with a
// grinning skull, a notched sword and buckler, or a staff with a green skull.
function skeleton(mage = false) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const b = bone();
  const iron = M.mat('#5a5650', { metalness: 0.6, roughness: 0.5 });
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  [legL, legR].forEach((hip, i) => {
    const s = i ? -1 : 1;
    hip.position.set(0, 0.7, 0.1 * s);
    hip.add(M.mesh(M.tube([[0, 0, 0], [0.04, -0.34, 0], [0, -0.66, 0]], 0.035, 0.028, 6, 6), b));
    hip.add(M.mesh(M.scaled(M.G.sphere, 0.05), b, 0.04, -0.34, 0));
    hip.add(M.mesh(M.blob(0.1, 0.04, 0.06, { seed: 41 }), b, 0.05, -0.68, 0));
    body.add(hip);
  });
  body.add(M.mesh(M.blob(0.12, 0.07, 0.16, { seed: 42 }), b, 0, 0.72, 0));
  body.add(M.mesh(M.tube([[0, 0.72, 0], [-0.03, 0.95, 0], [0, 1.25, 0]], 0.035, 0.03, 8, 6), b));
  for (let k = 0; k < 4; k++) {
    const rib = M.mesh(new THREE.TorusGeometry(0.15 - k * 0.012, 0.018, 6, 16, Math.PI * 1.5), b, 0.03, 1.0 + k * 0.07, 0);
    rib.rotation.set(Math.PI / 2, 0, Math.PI * 0.25);
    body.add(rib);
  }
  const skull = new THREE.Group();
  skull.position.set(0.04, 1.38, 0);
  skull.add(M.mesh(M.blob(0.13, 0.13, 0.12, { seed: 43, amt: 0.05 }), b, 0, 0, 0));
  skull.add(M.mesh(M.blob(0.08, 0.05, 0.08, { seed: 44 }), b, 0.08, -0.1, 0));
  for (const s of [1, -1]) skull.add(M.mesh(M.scaled(M.G.sphere, 0.028), glow(mage ? '#7dff6a' : '#6ad8ff'), 0.11, 0.02, 0.05 * s));
  body.add(skull);
  if (mage) {
    const robe = M.mesh(M.lathe([[0.3, 0.1], [0.26, 0.4], [0.18, 0.8], [0.16, 1.1], [0.2, 1.25], [0.08, 1.32]], 18), M.mat('#2a1638', { roughness: 0.9, side: THREE.DoubleSide }));
    body.add(robe);
    skull.add(M.mesh(M.lathe([[0.16, -0.04], [0.16, 0.08], [0.1, 0.2], [0.02, 0.3]], 16), M.mat('#2a1638', { roughness: 0.9, side: THREE.DoubleSide }), -0.03, 0, 0));
  }
  const arm = (s, item) => {
    const a = new THREE.Group();
    a.position.set(0.0, 1.22, 0.2 * s);
    a.add(M.mesh(M.tube([[0, 0, 0], [0.12, -0.2, 0.04 * s], [0.26, -0.3, 0]], 0.03, 0.024, 6, 6), b));
    if (item) {
      item.position.set(0.28, -0.32, 0);
      a.add(item);
    }
    body.add(a);
    return a;
  };
  let weapon;
  if (mage) {
    weapon = new THREE.Group();
    weapon.add(M.mesh(M.tube([[0, -0.7, 0], [0.02, 0, 0], [0, 0.6, 0]], 0.025, 0.02, 4, 6), M.mat('#3a2818')));
    weapon.add(M.mesh(M.blob(0.07, 0.07, 0.07, { seed: 45 }), b, 0, 0.66, 0));
    weapon.add(M.mesh(M.scaled(M.G.sphere, 0.09), glow('#8aff5a', 0.5), 0, 0.66, 0));
    arm(-1, weapon);
    arm(1, null);
  } else {
    weapon = new THREE.Group();
    weapon.add(M.mesh(slab([[0, -0.03], [0.62, -0.02], [0.7, 0.0], [0.62, 0.03], [0.3, 0.035], [0.25, 0.01], [0, 0.03]], 0.02, 0.005), iron, 0.06, 0, 0));
    weapon.add(M.mesh(M.scaled(M.G.box, 0.03, 0.14, 0.04), iron, 0.05, 0, 0));
    weapon.rotation.x = Math.PI / 2;
    weapon.rotation.z = -0.3;
    arm(-1, weapon);
    const buckler = M.mesh(M.lathe([[0.001, 0.03], [0.12, 0.02], [0.17, -0.02]], 16), M.texMat('tex_wood.webp', '#5a3a20', '#9a7a60'), 0, 0, 0);
    buckler.rotation.x = -Math.PI / 2;
    arm(1, buckler);
  }
  body.scale.setScalar(1.15);
  g.userData = { body, legs: [legL, legR], weapon, kind: 'biped', mage };
  return g;
}

// An Infernal: a hulking golem of black meteor rock split by glowing green
// fel cracks, with a burning head and fists.
function infernal() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const rock = M.triMat('tex_boulder.webp', '#26221e', '#6a6058', 1.2, { roughness: 0.9, emissive: '#0a2a08', emissiveIntensity: 0.6 });
  const fel = glow('#6aff3a');
  body.add(M.mesh(M.blob(0.7, 0.62, 0.66, { seed: 51, amt: 0.14, freq: 3 }), rock, 0, 1.75, 0));
  body.add(M.mesh(M.blob(0.46, 0.4, 0.5, { seed: 52, amt: 0.12, freq: 3 }), rock, -0.05, 1.05, 0));
  body.add(M.mesh(M.blob(0.34, 0.3, 0.32, { seed: 53, amt: 0.12, freq: 3 }), rock, 0.35, 2.35, 0));
  // Fel seams.
  for (let k = 0; k < 6; k++) {
    const a = k * 1.1;
    body.add(M.mesh(M.tube([[0.2 * Math.cos(a), 1.3 + k * 0.12, 0.6 * Math.sin(a)], [0.55 * Math.cos(a + 0.4), 1.6 + k * 0.1, 0.62 * Math.sin(a + 0.4)], [0.5 * Math.cos(a + 0.9), 1.95, 0.5 * Math.sin(a + 0.9)]], 0.035, 0.02, 8, 5), fel));
  }
  for (const s of [1, -1]) {
    body.add(M.mesh(M.scaled(M.G.sphere, 0.06), fel, 0.62, 2.4, 0.14 * s));
    const arm = new THREE.Group();
    arm.position.set(0.05, 2.0, 0.72 * s);
    arm.add(M.mesh(M.blob(0.32, 0.3, 0.3, { seed: 54 }), rock, 0, 0, 0));
    arm.add(M.mesh(M.tube([[0, 0, 0], [0.25, -0.5, 0.1 * s], [0.4, -1.0, 0]], 0.26, 0.2, 6, 10), rock));
    arm.add(M.mesh(M.blob(0.3, 0.3, 0.3, { seed: 55 }), rock, 0.42, -1.12, 0));
    body.add(arm);
    const leg = new THREE.Group();
    leg.position.set(-0.05, 0.85, 0.34 * s);
    leg.add(M.mesh(M.tube([[0, 0, 0], [0.06, -0.4, 0], [0, -0.8, 0]], 0.26, 0.24, 6, 10), rock));
    leg.add(M.mesh(M.blob(0.3, 0.14, 0.26, { seed: 56 }), rock, 0.08, -0.84, 0));
    body.add(leg);
  }
  const light = new THREE.PointLight('#6aff3a', 6, 7, 2);
  light.position.set(0, 1.8, 0);
  g.add(light);
  g.userData = { body, legs: body.children.filter((c) => c.isGroup && c.position.y < 1), kind: 'golem', light };
  return g;
}

const MAKERS = {
  scarab1: () => [scarab(1), 0.62],
  scarab2: () => [scarab(2), 0.85],
  scarab3: () => [scarab(3), 1.05],
  burrow: () => [burrow(), 1.0],
  skeleton: () => [skeleton(false), 1.0],
  mage: () => [skeleton(true), 1.0],
  infernal: () => [infernal(), 1.0],
  doom: () => [doomGuard(), 1.0],
};
const RADIUS = { scarab1: 0.3, scarab2: 0.45, scarab3: 0.6, burrow: 0.6, skeleton: 0.3, mage: 0.3, infernal: 0.9, doom: 0.9 };

registerView('sbunit', {
  make(e, world, v) {
    const g = new THREE.Group();
    v.t = e.t;
    const [model, s] = MAKERS[e.t]?.() || MAKERS.skeleton();
    model.scale.setScalar(s);
    g.add(model);
    v.parts = { model };
    v.o = e.o;
    if (e.o != null) {
      v.ring = teamRing(world.colors[e.o] || '#fff', RADIUS[e.t] * 1.5 + 0.2);
      g.add(v.ring);
    }
    unitBar(v, world, e.t === 'infernal' || e.t === 'doom' ? 60 : 40);
    return g;
  },
  update(v, a, b, k, dt, world) {
    // A burrowed scarab rising, or a change of owner (Control Magic): rebuild.
    if (b.t !== v.t) {
      v.obj.remove(v.parts.model);
      const [model, s] = MAKERS[b.t]();
      model.scale.setScalar(s);
      v.obj.add(model);
      v.parts.model = model;
      v.t = b.t;
    }
    if (b.o !== v.o) {
      if (v.ring) v.obj.remove(v.ring);
      v.ring = b.o != null ? teamRing(world.colors[b.o] || '#fff', RADIUS[b.t] * 1.5 + 0.2) : null;
      if (v.ring) v.obj.add(v.ring);
      v.o = b.o;
    }
    const model = v.parts.model;
    const U = model.userData;
    const t = world.time;
    setBar(v, b.h, !b.dead);
    if (v.ring) v.ring.material.opacity = 0.55 + Math.sin(t * 3) * 0.12;
    // Bloodlust: WC3 swells the unit and tints it red.
    const want = b.bl ? 1.12 : 1;
    v.swell = (v.swell ?? 1) + (want - (v.swell ?? 1)) * Math.min(1, dt * 5);
    v.obj.scale.setScalar(v.swell);
    if (b.bl && Math.random() < dt * 14) world.fx.trail(v.x + (Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 1.2, v.z + (Math.random() - 0.5) * 0.6, '#ff3020', 0.5, 0.5, 0.2);
    if (b.st && Math.random() < dt * 8) world.fx.trail(v.x, 2 + Math.random() * 0.3, v.z, '#ffe060', 0.3, 0.4, 0.4);
    if (v.castT > 0) v.castT -= dt;
    const swing = v.castT > 0 ? Math.sin((v.castT / 0.3) * Math.PI) : 0;
    if (b.t === 'doom') return animDoomGuard(v, U, b, dt, t);
    const moving = b.mv && !b.dead;
    v.walk = (v.walk || 0) + dt * (moving ? (U.kind === 'bug' ? 16 : 9) : 0);
    if (U.kind === 'bug') {
      U.legs.forEach((l, i) => (l.rotation.y = moving ? Math.sin(v.walk + (i % 2) * Math.PI) * 0.35 : 0));
      U.body.position.y = moving ? Math.abs(Math.sin(v.walk * 2)) * 0.03 : 0;
      if (U.head) U.head.rotation.z = swing * 0.5;
      if (b.ub && Math.random() < dt * 20) world.fx.dustCloud(v.x, v.z, 0.6, '#6a5a44', 1);
    } else if (U.kind === 'biped') {
      U.legs.forEach((l, i) => (l.rotation.z = moving ? Math.sin(v.walk + i * Math.PI) * 0.5 : 0));
      U.body.position.y = moving ? Math.abs(Math.sin(v.walk)) * 0.05 : 0;
      U.weapon.rotation.y = -swing * 1.1;
      if (U.mage && Math.random() < dt * 5) world.fx.trail(v.x + Math.cos(b.f) * 0.3, 2.0, v.z + Math.sin(b.f) * 0.3, '#8aff5a', 0.35, 0.5, 0.1);
    } else if (U.kind === 'golem') {
      U.legs.forEach((l, i) => (l.rotation.z = moving ? Math.sin(v.walk + i * Math.PI) * 0.35 : 0));
      U.body.position.y = moving ? Math.abs(Math.sin(v.walk)) * 0.08 : 0;
      U.body.rotation.z = -swing * 0.25;
      // Permanent Immolation: green fel flames licking off its shoulders and head.
      if (!b.dead) {
        const n = Math.floor((v.acc = (v.acc || 0) + dt * 30));
        v.acc -= n;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          world.fx.add.spawn(v.x + Math.cos(a) * 0.6, 1.4 + Math.random() * 1.4, v.z + Math.sin(a) * 0.6, 0, 1.4 + Math.random(), 0, new THREE.Color('#5aff2a'), 0.7, 0.5, -0.5, 0.5);
        }
        U.light.intensity = 5 + Math.sin(t * 9) * 1.5;
      }
    }
    if (b.dead) {
      v.deadT = (v.deadT || 0) + dt;
      U.body.rotation.x = Math.min(U.kind === 'bug' ? Math.PI : Math.PI / 2, v.deadT * 4) * (U.kind === 'bug' ? 1 : 0.9);
      v.obj.position.y = -Math.min(1.5, Math.max(0, v.deadT - 1.2) * 0.9);
    }
  },
});

// ------------------------------------------------------------ Demon Gate

// The Demon Gate: a black-rock arch of two horned pillars on a rune-carved
// dais, a swirling fel portal between them, green braziers on the corners.
function demonGate() {
  const g = new THREE.Group();
  const stone = M.texMat('tex_stone.webp', '#2a2430', '#6a5a74', 1.5, { roughness: 0.85 });
  const rock = M.triMat('tex_boulder.webp', '#1c1818', '#5a4c50', 0.9, { roughness: 0.8 });
  const iron = M.mat('#262022', { metalness: 0.65, roughness: 0.4 });
  const fel = glow('#62ff3a');
  // The 256 x 256 dais (2.37 units a side), stepped.
  g.add(M.mesh(M.lathe([[2.55, 0], [2.55, 0.18], [2.2, 0.22], [2.2, 0.42], [1.9, 0.46], [0.001, 0.46]], 4), stone, 0, 0, 0));
  g.children[0].rotation.y = Math.PI / 4;
  const runes = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.5, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#4aff2a', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  runes.position.y = 0.48;
  g.add(runes);
  // Two pillars curving up to meet overhead.
  for (const s of [1, -1]) {
    g.add(M.mesh(M.tube([[1.25 * s, 0.4, 0], [1.4 * s, 1.6, 0], [1.25 * s, 2.9, 0.05], [0.7 * s, 3.9, 0], [0.12 * s, 4.25, 0]], 0.42, 0.18, 24, 12), rock));
    for (let k = 0; k < 4; k++) {
      const y = 0.9 + k * 0.8;
      const sp = M.mesh(M.scaled(M.G.cone, 0.1, 0.55, 0.1), iron, (1.45 - k * 0.12) * s + 0.25 * s, y, 0);
      sp.rotation.z = -1.2 * s;
      g.add(sp);
    }
    // Curling horns at the crown.
    g.add(M.mesh(M.tube([[0.3 * s, 4.1, 0], [0.9 * s, 4.7, 0.1], [1.5 * s, 4.6, 0], [1.6 * s, 4.1, -0.1]], 0.16, 0.02, 16, 10), M.mat('#1a1410', { roughness: 0.4 })));
    // Braziers at the front corners.
    const br = new THREE.Group();
    br.position.set(1.9 * s, 0.46, 1.9);
    br.add(M.mesh(M.lathe([[0.001, 0], [0.16, 0.02], [0.1, 0.5], [0.24, 0.62], [0.28, 0.72], [0.22, 0.74]], 14), iron));
    br.add(M.mesh(M.scaled(M.G.sphere, 0.16), fel, 0, 0.78, 0));
    g.add(br);
  }
  g.add(M.mesh(M.blob(0.45, 0.35, 0.4, { seed: 61 }), rock, 0, 4.3, 0));
  g.add(M.mesh(M.scaled(M.G.sphere, 0.12), fel, 0.3, 4.35, 0.2));
  // The portal: layered additive discs, spun in update().
  const portal = new THREE.Group();
  portal.position.set(0, 2.2, 0);
  const tex = new THREE.MeshBasicMaterial({ color: '#2aff4a', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const discs = [];
  for (let k = 0; k < 3; k++) {
    const d = new THREE.Mesh(new THREE.RingGeometry(0.15 + k * 0.28, 1.15 - k * 0.2, 40, 1, 0, Math.PI * 1.5), tex.clone());
    d.material.opacity = 0.35 + k * 0.15;
    d.scale.set(1, 1.45, 1);
    portal.add(d);
    discs.push(d);
  }
  const core = new THREE.Mesh(new THREE.CircleGeometry(1.05, 40), new THREE.MeshBasicMaterial({ color: '#0a3a10', transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  core.scale.set(1, 1.45, 1);
  core.position.z = -0.02;
  portal.add(core);
  g.add(portal);
  const light = new THREE.PointLight('#50ff30', 14, 12, 1.6);
  light.position.set(0, 2.4, 1.2);
  g.add(light);
  g.userData = { discs, runes, light };
  return g;
}

registerView('sbdemongate', {
  make(e, world, v) {
    const g = demonGate();
    v.parts = g.userData;
    return g;
  },
  update(v, a, b, k, dt, world) {
    const t = world.time;
    v.obj.rotation.y = 0; // faces south, toward the spawn side
    v.parts.discs.forEach((d, i) => (d.rotation.z = t * (0.8 + i * 0.6) * (i % 2 ? -1 : 1)));
    v.parts.runes.material.opacity = 0.45 + Math.sin(t * 2) * 0.15;
    v.parts.light.intensity = 12 + Math.sin(t * 5) * 3;
    if (Math.random() < dt * 10) world.fx.add.spawn((Math.random() - 0.5) * 1.6, 1 + Math.random() * 2.4, 0.2, 0, 0.6, 0.8, new THREE.Color('#5aff3a'), 0.45, 1.0, -0.2, 0.3);
    for (const s of [1, -1]) if (Math.random() < dt * 12) world.fx.flame(1.9 * s, 1.3, 1.9, 0.45, 0.4, 0.05);
  },
});

// The corners: 128 u cliff notches, rugged outcrops of dark rock.
registerMapBuilder('sbarena', (map, world) => {
  const half = map.floor.w / 2;
  const n = map.notch;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const cx = sx * (half - n / 2);
      const cz = sy * (half - n / 2);
      const base = M.mesh(M.blob(n * 0.7, 1.3, n * 0.7, { seed: 70 + sx + sy * 3, amt: 0.16, freq: 2.6 }), M.triMat('tex_boulder.webp', '#3a3438', '#8a8090', 0.7), cx + sx * 0.3, 0.5, cz + sy * 0.3);
      world.mapGroup.add(base);
      for (let k = 0; k < 3; k++) {
        const r = M.rock(0.6 + Math.random() * 0.5);
        r.position.set(cx + (Math.random() - 0.5) * n, 0, cz + (Math.random() - 0.5) * n);
        world.mapGroup.add(r);
      }
    }
  }
});

// ------------------------------------------------------------ events

registerEvent('sbgate', (e, world) => {
  const fx = world.fx;
  fx.burst(e.x, 1, e.y, '#5aff3a', { n: e.big ? 60 : 26, speed: e.big ? 6 : 3.5, size: 0.6, life: 0.6 });
  fx.ring(e.x, e.y, e.big ? 3 : 1.4, '#5aff3a', 0.5);
  fx.glow(e.x, 1, e.y, '#6aff4a', e.big ? 5 : 2.5, 0.4);
  if (e.big) world.shake = 0.4;
  play('teleport');
});

registerEvent('sbcontrol', (e, world) => {
  world.fx.bolt(e.x1, e.y1, e.x2, e.y2, '#c88aff');
  world.fx.ring(e.x2, e.y2, 1.6, '#c88aff', 0.5);
  world.fx.burst(e.x2, 1.2, e.y2, '#d8a8ff', { n: 30, speed: 3, size: 0.5, life: 0.7 });
  const v = world.views.get(e.u);
  world.fx.purgeSwirl(() => (v ? { x: v.x, z: v.z } : null), 1.2);
  play('drain');
});

registerEvent('sbsteal', (e, world) => {
  world.fx.bolt(e.x1, e.y1, e.x2, e.y2, '#ffe07a');
  world.fx.sparks(e.x2, 1.2, e.y2, 16, 3, '#ffd24a');
  play('shield');
});

registerEvent('sbbloodlust', (e, world) => {
  world.fx.burst(e.x, 1, e.y, '#ff3020', { n: 22, speed: 3, size: 0.55, life: 0.5 });
  world.fx.ring(e.x, e.y, 1.1, '#ff4030', 0.4);
});

registerEvent('sbfeedback', (e, world) => {
  world.fx.sparks(e.x, 1.2, e.y, 12, 4, '#6ab8ff');
  world.fx.glow(e.x, 1.2, e.y, '#4a8aff', 1.4, 0.25);
});

registerEvent('sbunburrow', (e, world) => {
  world.fx.dustCloud(e.x, e.y, 1, '#6a5a44', 12);
  world.fx.debrisBurst(e.x, e.y, 8, 4);
  play('squish');
});

registerEvent('sbdie', (e, world) => {
  const fx = world.fx;
  if (e.t === 'infernal' || e.t === 'doom') {
    fx.explosion(e.x, e.y, 1.8);
    fx.burst(e.x, 1.5, e.y, '#5aff3a', { n: 40, speed: 6, size: 0.8, life: 0.8 });
    world.shake = 0.3;
    play('bigboom');
  } else if (e.t === 'skeleton' || e.t === 'mage') {
    fx.debrisBurst(e.x, e.y, 8, 4);
    fx.burst(e.x, 1, e.y, '#f0e6cc', { n: 16, speed: 3, size: 0.4, life: 0.5, additive: false });
    play('death');
  } else {
    fx.burst(e.x, 0.6, e.y, '#6a8a2a', { n: 20, speed: 3, size: 0.5, life: 0.6, additive: false, grav: 8 });
    fx.dustCloud(e.x, e.y, 0.7, '#5a4a3a', 5);
    play('squish');
  }
});

export { spellBreaker, scarab, skeleton, infernal, demonGate, glowSprite };
