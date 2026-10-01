// #46 Tower Defense: the Peasant (player skin and crew), the Arcane Tower
// rising out of its scaffold, the Archmage on his horse with Brilliance Aura,
// the Water Elemental, and the build / collapse effects.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { unitBar, setBar, teamRing, emissive, glow } from './up-kit.js';

// ------------------------------------------------------------ Peasant

// A Peasant: a stocky labourer in a team-coloured tunic over a cream shirt,
// brown breeches and boots, a leather belt, a round bearded face under a
// cloth cap, and a builder's hammer in the right hand.
function peasant(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const tunic = M.mat(color, { roughness: 0.85 });
  const shirt = M.texMat('tex_leather.webp', '#d8c8a0', '#fff4dc', 1);
  const breeches = M.leatherMat('#a07850');
  const boot = M.mat('#3a2414', { roughness: 0.7 });
  const skin = M.mat('#f0c8a0', { roughness: 0.65 });
  const beard = M.mat('#8a5a2a', { roughness: 0.8 });
  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(0, 0.55, 0.12 * s);
    hip.add(M.mesh(M.tube([[0, 0, 0], [0.02, -0.22, 0], [0, -0.42, 0]], 0.1, 0.08, 6, 10), breeches));
    hip.add(M.mesh(M.blob(0.14, 0.08, 0.09, { seed: 21, amt: 0.03 }), boot, 0.05, -0.48, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  // A barrel chest and round belly: the tunic is a lathe, the shirt shows at
  // the sleeves.
  const torso = M.mesh(M.lathe([[0.2, 0.5], [0.27, 0.62], [0.3, 0.78], [0.28, 0.95], [0.22, 1.06], [0.1, 1.12], [0.05, 1.13]], 18), tunic);
  torso.scale.set(1.05, 1, 1.12);
  const belt = M.mesh(new THREE.TorusGeometry(0.29, 0.035, 8, 24).rotateX(Math.PI / 2), M.leatherMat('#6a4020'), 0, 0.66, 0);
  belt.scale.z = 1.1;
  const buckle = M.mesh(M.scaled(M.G.box, 0.03, 0.07, 0.09), M.goldMat(), 0.31, 0.66, 0);
  const head = new THREE.Group();
  head.position.set(0.03, 1.25, 0);
  head.add(M.mesh(M.blob(0.15, 0.16, 0.15, { seed: 22, amt: 0.03 }), skin, 0, 0, 0));
  head.add(M.mesh(M.scaled(M.G.sphere, 0.05), skin, 0.15, -0.01, 0)); // nose
  head.add(M.mesh(M.blob(0.1, 0.1, 0.13, { seed: 23, amt: 0.08 }), beard, 0.08, -0.1, 0));
  for (const s of [1, -1]) head.add(M.mesh(M.scaled(M.G.sphere, 0.022), M.mat('#1a120a'), 0.13, 0.04, 0.06 * s));
  // Cloth cap, slouched back.
  head.add(M.mesh(M.lathe([[0.17, 0.0], [0.17, 0.05], [0.13, 0.13], [0.06, 0.17], [0.001, 0.17]], 16), M.mat('#b89060', { roughness: 0.9 }), -0.02, 0.06, 0));
  // Left arm hangs; the right (staff) arm swings the hammer.
  const armL = M.mesh(M.tube([[0, 1.0, 0.3], [0.06, 0.8, 0.36], [0.12, 0.62, 0.32]], 0.075, 0.065, 8, 8), shirt);
  const fistL = M.mesh(M.scaled(M.G.sphere, 0.07), skin, 0.13, 0.6, 0.32);
  const arm = new THREE.Group();
  arm.position.set(0, 1.0, -0.3);
  arm.add(M.mesh(M.tube([[0, 0, 0], [0.08, -0.2, -0.06], [0.2, -0.32, -0.04]], 0.075, 0.065, 8, 8), shirt));
  arm.add(M.mesh(M.scaled(M.G.sphere, 0.07), skin, 0.21, -0.33, -0.04));
  const hammer = new THREE.Group();
  hammer.position.set(0.22, -0.34, -0.04);
  hammer.add(M.mesh(M.tube([[0, -0.08, 0], [0, 0.42, 0]], 0.025, 0.022, 2, 8), M.texMat('tex_wood.webp', '#7a5030', '#e0c090')));
  const hhead = M.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.24, 10), M.mat('#9aa0a8', { metalness: 0.6, roughness: 0.4 }), 0, 0.45, 0);
  hhead.rotation.x = Math.PI / 2;
  hammer.add(hhead);
  hammer.rotation.z = -0.9;
  arm.add(hammer);
  body.add(legL, legR, torso, belt, buckle, head, armL, fistL, arm);
  body.scale.setScalar(1.3);
  g.userData = { body, legL, legR, staff: arm, kind: 'hero' };
  return g;
}
registerSkin('peasant', peasant);

// The crew: same model, posed by the view (walking, hammering at the tower).
registerView('tdpeasant', {
  bake: 'flat', // crowds: one mesh per moving part
  make(e, world, v) {
    const g = peasant(world.colors[e.o] || '#ccc');
    v.parts = g.userData;
    unitBar(v, world, 30);
    return g;
  },
  update(v, a, b, k, dt) {
    const U = v.parts;
    setBar(v, b.h, b.h < 100);
    v.walk = (v.walk || 0) + dt * (b.mv ? 12 : 0);
    const amp = b.mv ? 0.6 : 0;
    U.legL.rotation.z = Math.sin(v.walk) * amp;
    U.legR.rotation.z = -Math.sin(v.walk) * amp;
    U.body.position.y = b.mv ? Math.abs(Math.sin(v.walk)) * 0.06 : 0;
    // Building: a steady hammering beat; attacking: a swing.
    v.beat = (v.beat || Math.random() * 6) + dt * 7;
    const hit = b.b ? Math.max(0, Math.sin(v.beat)) : b.sw ? Math.max(0, Math.sin(v.beat * 0.6)) : 0;
    U.staff.rotation.x = 0;
    U.staff.rotation.z = hit * 1.3 - 0.2;
  },
});

// ------------------------------------------------------------ Arcane Tower

// The Arcane Tower (hatw): a stone footing and a slim tapering stone shaft
// banded in gold, a blue-violet slate spire with a gold finial, and an arcane
// orb turning above it. Team banners hang from the shaft.
const STONE = () => M.texMat('tex_stone.webp', '#a8a49c', '#f4f0e8', 1);
function arcaneTower(color, size) {
  const g = new THREE.Group();
  const rise = new THREE.Group();
  g.add(rise);
  const stone = STONE();
  const gold = M.goldMat();
  const slate = M.mat('#4a54b8', { roughness: 0.45, metalness: 0.2 });
  const s = size;
  rise.add(M.mesh(new THREE.CylinderGeometry(s * 0.95, s * 1.1, s * 0.5, 8), stone, 0, s * 0.25, 0));
  rise.add(M.mesh(M.lathe([[s * 0.72, s * 0.45], [s * 0.6, s * 1.6], [s * 0.52, s * 2.6], [s * 0.6, s * 2.75], [s * 0.6, s * 2.85]], 8), stone));
  for (const y of [0.5, 1.6, 2.75]) {
    const r = y === 0.5 ? 0.74 : y === 1.6 ? 0.62 : 0.62;
    rise.add(M.mesh(new THREE.TorusGeometry(s * r, s * 0.04, 6, 8).rotateX(Math.PI / 2).rotateY(Math.PI / 8), gold, 0, s * y, 0));
  }
  // Windows glowing violet on four sides.
  const win = emissive('#c8a0ff', '#8a5aff', 1.4);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const w = M.mesh(M.scaled(M.G.box, 0.04, s * 0.32, s * 0.14), win, Math.cos(a) * s * 0.56, s * 2.0, Math.sin(a) * s * 0.56);
    w.rotation.y = -a;
    rise.add(w);
  }
  const spire = new THREE.Group();
  rise.add(spire);
  spire.add(M.mesh(M.lathe([[s * 0.8, s * 2.85], [s * 0.7, s * 3.05], [s * 0.4, s * 3.6], [s * 0.1, s * 4.2], [0.001, s * 4.35]], 8), slate));
  spire.add(M.mesh(M.scaled(M.G.cone, s * 0.06, s * 0.4, s * 0.06), gold, 0, s * 4.5, 0));
  const orb = new THREE.Group();
  orb.position.y = s * 5.0;
  orb.add(M.mesh(M.scaled(M.G.sphere, s * 0.2), emissive('#d8c0ff', '#9a6aff', 2.2)));
  const ring = M.mesh(new THREE.TorusGeometry(s * 0.34, s * 0.025, 6, 24), gold);
  orb.add(ring);
  spire.add(orb);
  const team = M.mat(color, { side: THREE.DoubleSide, roughness: 0.8 });
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + Math.PI / 4;
    const flag = M.mesh(M.cloth(s * 0.36, s * 0.8, 0.04), team, Math.cos(a) * s * 0.66, s * 2.2, Math.sin(a) * s * 0.66);
    flag.rotation.y = -a + Math.PI;
    rise.add(flag);
  }
  // Scaffold: poles and planks round the footing while it is unfinished.
  const scaffold = new THREE.Group();
  const wood = M.texMat('tex_wood.webp', '#7a5030', '#e0c090');
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    scaffold.add(M.mesh(new THREE.CylinderGeometry(0.05, 0.05, s * 3.2, 6), wood, Math.cos(a) * s * 1.15, s * 1.6, Math.sin(a) * s * 1.15));
  }
  for (const y of [0.9, 1.9, 2.9]) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const p = M.mesh(M.scaled(M.G.box, 0.08, 0.05, s * 1.62), wood, Math.cos(a) * s * 1.15, s * y, Math.sin(a) * s * 1.15);
      p.rotation.y = -a;
      scaffold.add(p);
    }
  }
  g.add(scaffold);
  // The foundation outline, always flat on the ground.
  const pad = M.mesh(new THREE.CylinderGeometry(s * 1.25, s * 1.3, 0.08, 8), M.texMat('tex_stone.webp', '#7a766e', '#bcb8b0', 2), 0, 0.04, 0);
  g.add(pad);
  g.userData = { rise, spire, scaffold, orb, ring };
  return g;
}

registerView('tdtower', {
  bake: true,
  make(e, world, v) {
    v.size = (e.th ?? world.mapData?.th ?? 1.185) * 0.95;
    const g = arcaneTower(world.colors[e.o] || '#ccc', 1.15);
    v.parts = g.userData;
    unitBar(v, world, 60);
    return g;
  },
  update(v, a, b, k, dt, world) {
    const U = v.parts;
    v.obj.rotation.y = 0;
    setBar(v, b.h, true);
    const p = Math.max(0.03, b.p ?? 1);
    // The tower grows out of the ground inside its scaffold.
    U.rise.position.y = -(1 - p) * 3.3;
    U.scaffold.visible = p < 1;
    U.spire.visible = p > 0.8; // the roof goes on last
    U.orb.rotation.y += dt * 1.5;
    U.ring.rotation.x = Math.PI / 2 + Math.sin(world.time * 2) * 0.4;
    if (b.n && Math.random() < dt * Math.min(12, 2 + b.n * 2)) {
      const ang = Math.random() * Math.PI * 2;
      world.fx.dustCloud(v.x + Math.cos(ang) * 1.4, v.z + Math.sin(ang) * 1.4, 0.4, '#b8a888', 2);
    }
  },
});

// Unused spots hold a finished Neutral Passive Arcane Tower; the arena's
// corners are notched with rock.
registerMapBuilder('tdfield', (map, world) => {
  for (const [x, y] of map.neutral || []) {
    const t = arcaneTower('#9a9a9a', 1.15);
    t.userData.scaffold.visible = false;
    t.position.set(x, 0, y);
    world.mapGroup.add(t);
  }
  const half = map.bounds - 3;
  const n = map.notch || 2.4;
  const rockM = M.boulderMat();
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const r = M.mesh(M.blob(n * (0.7 - i * 0.12), n * 0.55, n * (0.6 - i * 0.1), { seed: 600 + i + sx * 3 + sz * 7, amt: 0.15 }), rockM, sx * (half - n * 0.5 - i * 0.5), n * 0.2, sz * (half - n * 0.5 - (2 - i) * 0.5));
        world.mapGroup.add(r);
      }
    }
  }
});

// ------------------------------------------------------------ Archmage

// The Archmage (Hamg): a white-bearded old man in blue and violet robes with
// a deep hood, riding a white horse in blue barding, a staff with a glowing
// orb in hand and Brilliance Aura's runes turning at his feet.
function archmage() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const horse = M.mat('#ecebe6', { roughness: 0.6 });
  const mane = M.mat('#c8c6c0', { roughness: 0.8 });
  const barding = M.mat('#2a3c9a', { roughness: 0.7, side: THREE.DoubleSide });
  const robe = M.mat('#3a4cc0', { roughness: 0.75, side: THREE.DoubleSide });
  const violet = M.mat('#6a3aa0', { roughness: 0.7 });
  const gold = M.goldMat();
  const skin = M.mat('#f0caa8', { roughness: 0.6 });
  const white = M.mat('#f4f4f0', { roughness: 0.8 });
  // Horse
  body.add(M.mesh(M.blob(0.75, 0.38, 0.32, { seed: 31, amt: 0.04 }), horse, 0, 1.05, 0));
  body.add(M.mesh(M.tube([[0.55, 1.15, 0], [0.8, 1.5, 0], [0.92, 1.75, 0]], 0.2, 0.13, 8, 10), horse));
  const hhead = M.mesh(M.blob(0.3, 0.13, 0.12, { seed: 32, amt: 0.03 }), horse, 1.05, 1.72, 0);
  hhead.rotation.z = -0.6;
  body.add(hhead);
  for (const s of [1, -1]) body.add(M.mesh(M.scaled(M.G.cone, 0.035, 0.12, 0.03), horse, 0.92, 1.95, 0.06 * s));
  body.add(M.mesh(M.tube([[0.6, 1.4, 0], [0.8, 1.8, 0], [0.88, 1.92, 0]], 0.07, 0.04, 8, 6), mane));
  body.add(M.mesh(M.tube([[-0.72, 1.12, 0], [-0.95, 0.9, 0], [-1.0, 0.5, 0]], 0.09, 0.03, 8, 6), mane));
  const cloth = M.mesh(M.cloth(0.7, 0.42, 0.3), barding, 0, 1.0, 0);
  cloth.rotation.y = Math.PI / 2;
  body.add(cloth);
  const legs = [];
  for (const [x, s] of [[0.5, 1], [0.5, -1], [-0.5, 1], [-0.5, -1]]) {
    const l = new THREE.Group();
    l.position.set(x, 0.95, 0.18 * s);
    l.add(M.mesh(M.tube([[0, 0, 0], [0.02, -0.45, 0], [0, -0.9, 0]], 0.09, 0.05, 6, 8), horse));
    l.add(M.mesh(M.scaled(M.G.cyl, 0.065, 0.06, 0.065), M.mat('#3a3430'), 0, -0.92, 0));
    legs.push(l);
    body.add(l);
  }
  // Rider
  const rider = new THREE.Group();
  rider.position.set(-0.05, 1.3, 0);
  rider.add(M.mesh(M.lathe([[0.3, 0.0], [0.28, 0.15], [0.22, 0.45], [0.18, 0.7], [0.08, 0.78]], 16), robe));
  for (const s of [1, -1]) rider.add(M.mesh(M.tube([[0, 0.1, 0.15 * s], [0.15, -0.15, 0.3 * s], [0.25, -0.35, 0.3 * s]], 0.09, 0.06, 6, 8), robe));
  rider.add(M.mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 16).rotateX(Math.PI / 2), gold, 0, 0.3, 0));
  rider.add(M.mesh(M.scaled(M.G.sphere, 0.12), skin, 0.06, 0.88, 0));
  rider.add(M.mesh(M.tube([[0.14, 0.84, 0], [0.18, 0.6, 0], [0.12, 0.38, 0]], 0.1, 0.02, 8, 8), white)); // beard
  rider.add(M.mesh(M.lathe([[0.19, 0.0], [0.18, 0.15], [0.12, 0.3], [0.001, 0.36]], 14), violet, -0.03, 0.82, 0)); // hood
  rider.add(M.mesh(M.cloth(0.4, 0.75, 0.15, 0.1), violet, -0.18, 0.42, 0));
  const arm = new THREE.Group();
  arm.position.set(0.05, 0.6, -0.22);
  arm.add(M.mesh(M.tube([[0, 0, 0], [0.18, -0.12, -0.06], [0.3, -0.05, -0.08]], 0.08, 0.06, 6, 8), robe));
  const staff = new THREE.Group();
  staff.position.set(0.32, -0.05, -0.08);
  staff.add(M.mesh(M.tube([[0, -0.7, 0], [0.02, 0.2, 0], [0, 0.85, 0]], 0.03, 0.025, 6, 8), M.texMat('tex_wood.webp', '#6a4a2a', '#d8b890')));
  staff.add(M.mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 16), gold, 0, 0.95, 0));
  const orb = M.mesh(M.scaled(M.G.sphere, 0.08), emissive('#c8e8ff', '#5aa8ff', 2.4), 0, 0.95, 0);
  staff.add(orb);
  arm.add(staff);
  rider.add(arm);
  body.add(rider);
  // Brilliance Aura: blue runes turning at his feet.
  const aura = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 6, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7ab8ff', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  aura.position.y = 0.06;
  g.add(aura);
  body.scale.setScalar(1.4);
  g.userData = { body, legs, arm, orb, aura, rider };
  return g;
}

registerView('tdarchmage', {
  bake: true,
  make(e, world, v) {
    const g = archmage();
    v.parts = g.userData;
    unitBar(v, world, 56);
    return g;
  },
  update(v, a, b, k, dt, world) {
    const U = v.parts;
    setBar(v, b.h, !b.dead);
    const t = world.time;
    U.aura.rotation.y = t * 0.5;
    U.aura.visible = !b.dead;
    U.aura.material.opacity = b.z ? 0.12 : 0.3 + Math.sin(t * 2) * 0.08;
    U.orb.scale.setScalar(1 + Math.sin(t * 5) * 0.12);
    if (b.sw) v.cast = 0.6;
    v.cast = Math.max(0, (v.cast || 0) - dt);
    U.arm.rotation.x = -Math.sin((v.cast / 0.6) * Math.PI) * 0.9;
    U.body.position.y = Math.sin(t * 1.6) * 0.02;
    if (b.dead) {
      v.deadT = (v.deadT || 0) + dt;
      U.body.rotation.x = Math.min(Math.PI / 2, v.deadT * 2.5);
    }
  },
});

// ------------------------------------------------------------ Water Elemental

// A Water Elemental: a translucent blue torso of churning water rising out
// of a swirling pool, with heavy arms, a crested head and pale glowing eyes.
const waterMat = new THREE.MeshStandardMaterial({ color: '#4aa8ff', emissive: '#1a5ab0', emissiveIntensity: 0.6, transparent: true, opacity: 0.8, roughness: 0.15, metalness: 0.1, depthWrite: true });
const foamMat = new THREE.MeshStandardMaterial({ color: '#d8f0ff', emissive: '#6ab0e0', emissiveIntensity: 0.4, transparent: true, opacity: 0.85, roughness: 0.3 });
function waterElemental() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const swirl = new THREE.Group();
  swirl.add(M.mesh(M.lathe([[0.7, 0.0], [0.5, 0.15], [0.35, 0.5], [0.4, 0.9]], 18), waterMat));
  swirl.add(M.mesh(new THREE.TorusGeometry(0.6, 0.08, 8, 24).rotateX(Math.PI / 2), foamMat, 0, 0.08, 0));
  body.add(swirl);
  body.add(M.mesh(M.blob(0.55, 0.6, 0.6, { seed: 41, amt: 0.1 }), waterMat, 0, 1.35, 0));
  const head = M.mesh(M.blob(0.28, 0.3, 0.26, { seed: 42, amt: 0.08 }), waterMat, 0.25, 2.0, 0);
  body.add(head);
  body.add(M.mesh(M.tube([[0.1, 2.1, 0], [-0.2, 2.35, 0], [-0.5, 2.25, 0]], 0.14, 0.03, 8, 8), foamMat));
  for (const s of [1, -1]) body.add(M.mesh(M.scaled(M.G.sphere, 0.05), glow('#e8ffff'), 0.5, 2.05, 0.1 * s));
  const arms = [];
  for (const s of [1, -1]) {
    const a = new THREE.Group();
    a.position.set(0.05, 1.65, 0.55 * s);
    a.add(M.mesh(M.tube([[0, 0, 0], [0.2, -0.35, 0.15 * s], [0.35, -0.75, 0.1 * s]], 0.2, 0.14, 8, 8), waterMat));
    a.add(M.mesh(M.blob(0.2, 0.2, 0.2, { seed: 43 }), foamMat, 0.38, -0.82, 0.1 * s));
    arms.push(a);
    body.add(a);
  }
  g.userData = { body, swirl, arms, head };
  return g;
}

registerView('tdelemental', {
  make(e, world, v) {
    const g = waterElemental();
    v.parts = g.userData;
    unitBar(v, world, 44);
    return g;
  },
  update(v, a, b, k, dt, world) {
    const U = v.parts;
    setBar(v, b.h, true);
    const t = world.time;
    U.swirl.rotation.y = t * 3;
    U.body.position.y = Math.sin(t * 2.4) * 0.06;
    if (b.sw) v.cast = 0.5;
    v.cast = Math.max(0, (v.cast || 0) - dt);
    const sw = Math.sin((v.cast / 0.5) * Math.PI);
    U.arms.forEach((arm, i) => (arm.rotation.z = Math.sin(t * 2 + i * 2) * 0.12 + sw * 0.9));
    // Fading out over its last seconds.
    const fade = Math.min(1, (b.l ?? 60) / 3);
    v.obj.scale.setScalar(0.4 + 0.6 * fade);
    if (Math.random() < dt * 10) world.fx.trail(v.x + (Math.random() - 0.5) * 1.2, 0.2, v.z + (Math.random() - 0.5) * 1.2, '#9ad8ff', 0.4, 0.5, 0.1);
  },
});

// ------------------------------------------------------------ events

registerEvent('tdplace', (e, world) => {
  world.fx.dustCloud(e.x, e.y, 1.6, '#b8a888', 12);
  play('buy');
});

registerEvent('tddone', (e, world) => {
  world.fx.shockwave(e.x, e.y, 3, '#d8c0ff', 0.6);
  world.fx.burst(e.x, 4, e.y, '#d8c0ff', { n: 50, speed: 6, size: 0.7, life: 0.8 });
  world.fx.ring(e.x, e.y, 2.4, world.colors[e.o] || '#fff', 0.8);
  play('coin');
});

registerEvent('tdcollapse', (e, world) => {
  world.fx.explosion(e.x, e.y, e.big ? 2.6 : 1.8);
  world.fx.debrisBurst(e.x, e.y, e.big ? 24 : 14, 7);
  world.fx.dustCloud(e.x, e.y, 2, '#8a8070', 16);
  world.shake = e.big ? 0.8 : 0.4;
  play(e.big ? 'bigboom' : 'boom');
});

registerEvent('tdsummon', (e, world) => {
  world.fx.burst(e.x, 1, e.y, '#7ac8ff', { n: 40, speed: 4, size: 0.6, life: 0.7, grav: 6 });
  world.fx.ring(e.x, e.y, 1.6, '#7ac8ff', 0.5);
  play('splash');
});

registerEvent('tdunsummon', (e, world) => {
  world.fx.burst(e.x, 1, e.y, '#9ad8ff', { n: 30, speed: 3, size: 0.5, life: 0.6, grav: 8, additive: false });
  play('splash');
});

export { peasant, arcaneTower, archmage, waterElemental, teamRing };
