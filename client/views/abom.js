// The Abombinations (#28): dwarven riflemen, the abominations, their blasts,
// the portal they come out of, and the blighted arena.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerMapBuilder, registerTheme } from '../../engine/client/render/registry.js';
import { driver, pivot, limb, octCorners } from './e-common.js';
import { play } from '../../engine/client/audio.js';

// ------------------------------------------------------------ rifleman

// A dwarven rifle: a long iron barrel with a flared muzzle on a wooden stock.
function rifle() {
  const g = new THREE.Group();
  const iron = M.mat('#4a4a50', { metalness: 0.75, roughness: 0.35 });
  const wood = M.texMat('tex_wood.webp', '#6a4428', '#c89870', 1);
  g.add(M.mesh(M.tube([[-0.35, -0.02, 0], [-0.12, 0.0, 0], [0.05, 0.02, 0]], 0.05, 0.045, 4, 8), wood));
  g.add(M.mesh(M.scaled(M.G.box, 0.14, 0.12, 0.07), wood, -0.4, -0.06, 0));
  g.add(M.mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.78, 10).rotateZ(-Math.PI / 2), iron, 0.4, 0.04, 0));
  g.add(M.mesh(M.lathe([[0.03, 0], [0.05, 0.04], [0.06, 0.08]], 10).rotateZ(-Math.PI / 2), iron, 0.79, 0.04, 0));
  for (const x of [0.12, 0.45]) g.add(M.mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 10).rotateY(Math.PI / 2), M.goldMat(), x, 0.04, 0));
  g.add(M.mesh(M.scaled(M.G.box, 0.1, 0.05, 0.02), iron, -0.02, -0.04, 0));
  return g;
}

// Dwarven rifleman: stocky and broad in a steel cap and mail, a big braided
// beard, a team tabard, fur boots, and a rifle held at the ready. Faces +X.
function rifleman(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = M.mat('#e0a888', { roughness: 0.7 });
  const mail = M.mat('#7a7e86', { metalness: 0.6, roughness: 0.5 });
  const steel = M.plateMat();
  const beard = M.mat('#d8782c', { roughness: 0.8 });
  const team = M.mat(color, { roughness: 0.85, side: THREE.DoubleSide });
  const leather = M.leatherMat('#a07a58');
  const leg = (s) => {
    const hip = pivot(0, 0.42, 0.11 * s);
    hip.add(limb([0, 0, 0], [0.02, -0.2, 0], 0.08, 0.07, leather));
    hip.add(M.mesh(M.blob(0.1, 0.12, 0.09, { seed: 41 }), M.furMat('#8a6a4a'), 0.02, -0.28, 0));
    hip.add(M.mesh(M.scaled(M.G.sphere, 0.1, 0.05, 0.08), M.mat('#3a2a1a'), 0.05, -0.4, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  const torso = M.mesh(M.blob(0.26, 0.3, 0.28, { seed: 42, amt: 0.05 }), mail, 0, 0.72, 0);
  const tabard = M.mesh(M.cloth(0.26, 0.45, 0.06), team, 0.25, 0.6, 0);
  tabard.rotation.y = Math.PI;
  const belt = M.mesh(new THREE.TorusGeometry(0.25, 0.035, 6, 20).rotateX(Math.PI / 2), leather, 0, 0.55, 0);
  const buckle = M.mesh(M.scaled(M.G.box, 0.03, 0.08, 0.1), M.goldMat(), 0.26, 0.55, 0);
  const head = M.mesh(M.blob(0.17, 0.16, 0.16, { seed: 43 }), skin, 0.05, 1.1, 0);
  const nose = M.mesh(M.scaled(M.G.sphere, 0.06, 0.05, 0.05), M.mat('#d88a70'), 0.22, 1.1, 0);
  const helm = M.mesh(new THREE.SphereGeometry(0.19, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), steel, 0.02, 1.17, 0);
  const brim = M.mesh(new THREE.TorusGeometry(0.19, 0.03, 6, 20).rotateX(Math.PI / 2), M.goldMat(), 0.02, 1.17, 0);
  const beardM = M.mesh(M.blob(0.14, 0.26, 0.19, { seed: 44, amt: 0.1 }), beard, 0.18, 0.92, 0);
  const braid = M.mesh(M.tube([[0.2, 0.8, 0], [0.24, 0.66, 0], [0.22, 0.56, 0]], 0.04, 0.02, 6, 6), beard);
  const paulds = [1, -1].map((s) => M.mesh(new THREE.SphereGeometry(0.12, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), steel, 0, 0.92, 0.25 * s));
  // Arms hold the rifle across the body; the whole rig lifts to aim.
  const aim = pivot(0.02, 0.86, 0);
  aim.add(limb([0, 0, 0.27], [0.24, -0.1, 0.2], 0.07, 0.06, mail));
  aim.add(limb([0, 0, -0.27], [0.1, -0.16, -0.12], 0.07, 0.06, mail));
  aim.add(M.mesh(M.scaled(M.G.sphere, 0.06), leather, 0.24, -0.12, 0.18));
  aim.add(M.mesh(M.scaled(M.G.sphere, 0.06), leather, 0.1, -0.18, -0.1));
  const gun = rifle();
  gun.position.set(0.12, -0.14, 0.05);
  gun.rotation.set(0, -0.35, -0.35);
  aim.add(gun);
  body.add(legL, legR, torso, tabard, belt, buckle, head, nose, helm, brim, beardM, braid, ...paulds, aim);
  body.scale.setScalar(1.35);
  const staff = new THREE.Object3D();
  body.add(staff);
  let raised = 0;
  driver(body, (dt) => {
    const k = Math.min(1, Math.max(0, -staff.rotation.x / 0.9));
    raised += (k - raised) * Math.min(1, dt * 16);
    // Shoulder the rifle and point it straight ahead.
    gun.rotation.set(0, -0.35 * (1 - raised), -0.35 * (1 - raised));
    aim.position.y = 0.86 + raised * 0.12;
  });
  g.userData = { body, legL, legR, staff, kind: 'hero' };
  return g;
}

registerSkin('rifleman', rifleman);

// ------------------------------------------------------------ abomination

// An abomination: a hulking undead flesh golem, grey-green and stitched
// together, a gaping belly wound, a cleaver in one hand and a meat hook on a
// chain in the other, extra arms and a little head sunk in its shoulders.
// It glows hotter and leaks plague gas as its 20 s fuse runs down.
function abomination() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const flesh = M.triMat('tex_hide.webp', '#6a7a5a', '#b0c898', 1.3);
  const pale = M.mat('#8a9a78', { roughness: 0.6 });
  const stitch = M.mat('#1a1410', { roughness: 0.8 });
  const iron = M.mat('#4a4a50', { metalness: 0.7, roughness: 0.4 });
  const leg = (s) => {
    const hip = pivot(-0.05, 0.62, 0.34 * s);
    hip.add(limb([0, 0, 0], [0.06, -0.3, 0.02 * s], 0.2, 0.16, flesh));
    hip.add(limb([0.06, -0.28, 0.02 * s], [0.02, -0.58, 0], 0.15, 0.13, flesh));
    hip.add(M.mesh(M.blob(0.17, 0.08, 0.15, { seed: 51 }), pale, 0.06, -0.6, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  const gut = M.mesh(M.blob(0.62, 0.58, 0.62, { seed: 52, amt: 0.1 }), flesh, 0.05, 1.08, 0);
  const chest = M.mesh(M.blob(0.5, 0.36, 0.56, { seed: 53, amt: 0.08 }), flesh, -0.02, 1.55, 0);
  // Belly wound with guts.
  const wound = M.mesh(M.scaled(M.G.sphere, 0.2, 0.18, 0.1), M.mat('#5a0a0a', { roughness: 0.4, emissive: '#200000' }), 0.6, 1.0, 0.05);
  wound.rotation.y = Math.PI / 2;
  const guts = M.mesh(M.tube([[0.6, 1.0, 0.05], [0.72, 0.82, 0.12], [0.62, 0.62, 0.0], [0.7, 0.45, -0.1]], 0.05, 0.035, 12, 8), M.mat('#b85a6a', { roughness: 0.35 }));
  // Stitch lines across the belly.
  const stitches = [];
  for (let i = 0; i < 3; i++) {
    const s = M.mesh(new THREE.TorusGeometry(0.55 - i * 0.05, 0.012, 4, 30, Math.PI * 0.9), stitch, 0.02, 0.9 + i * 0.28, 0);
    s.rotation.set(Math.PI / 2, 0, -0.9 + i * 0.3);
    stitches.push(s);
  }
  const head = M.mesh(M.blob(0.16, 0.15, 0.16, { seed: 54 }), pale, 0.3, 1.86, 0);
  const eyes = [1, -1].map((s) => M.mesh(M.scaled(M.G.sphere, 0.025), M.glowMat('#e0ff60'), 0.44, 1.9, 0.06 * s));
  const jaw = M.mesh(M.blob(0.1, 0.05, 0.1, { seed: 55 }), pale, 0.4, 1.76, 0);
  // Cleaver arm (+Z) and hook arm (-Z), plus a small third arm.
  const armC = pivot(0.05, 1.62, 0.56);
  armC.add(limb([0, 0, 0], [0.2, -0.36, 0.1], 0.15, 0.12, flesh));
  armC.add(limb([0.2, -0.34, 0.1], [0.46, -0.52, 0.06], 0.12, 0.1, flesh));
  const cleaver = new THREE.Group();
  cleaver.position.set(0.5, -0.56, 0.06);
  cleaver.add(M.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8), M.leatherMat(), 0, 0, 0));
  cleaver.add(M.mesh(M.scaled(M.G.box, 0.36, 0.5, 0.03), iron, 0.18, 0.32, 0));
  cleaver.rotation.z = -0.4;
  armC.add(cleaver);
  const armH = pivot(0.05, 1.62, -0.56);
  armH.add(limb([0, 0, 0], [0.16, -0.36, -0.1], 0.15, 0.12, flesh));
  armH.add(limb([0.16, -0.34, -0.1], [0.38, -0.58, -0.08], 0.12, 0.1, flesh));
  armH.add(M.mesh(M.tube([[0.4, -0.62, -0.08], [0.46, -0.9, -0.1], [0.56, -1.0, -0.1], [0.62, -0.88, -0.1]], 0.03, 0.02, 12, 6), iron));
  const armS = pivot(0.3, 1.25, -0.4);
  armS.add(limb([0, 0, 0], [0.24, -0.2, -0.08], 0.07, 0.05, pale));
  // Rusty chains round the gut and spikes in the back.
  const chain = M.mesh(new THREE.TorusGeometry(0.64, 0.03, 6, 30), iron, 0, 1.2, 0);
  chain.rotation.set(Math.PI / 2, 0.25, 0);
  const spikes = [];
  for (let i = 0; i < 4; i++) spikes.push(M.mesh(M.scaled(M.G.cone, 0.05, 0.3, 0.05), iron, -0.45, 1.4 + i * 0.12, (i - 1.5) * 0.18));
  spikes.forEach((s) => (s.rotation.z = 1.2));
  body.add(legL, legR, gut, chest, wound, guts, ...stitches, head, ...eyes, jaw, armC, armH, armS, chain, ...spikes);
  body.scale.setScalar(1.25);
  // The fuse: a sickly glow under the skin, brighter and faster as life runs out.
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.7, 18, 12), new THREE.MeshBasicMaterial({ color: '#c0ff40', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.y = 1.35;
  glow.scale.set(1.2, 1.1, 1.2);
  g.add(glow);
  g.userData = { body, legL, legR, glow, armC, armH };
  return g;
}

registerView('abom', {
  make(e, world, v) {
    const g = abomination();
    v.parts = g.userData;
    v.walk = Math.random() * 6;
    return g;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    v.walk += dt * (b.mv ? 9 : 0);
    const sw = b.mv ? Math.sin(v.walk) * 0.45 : 0;
    P.legL.rotation.z = sw;
    P.legR.rotation.z = -sw;
    P.body.position.y = b.mv ? Math.abs(Math.sin(v.walk)) * 0.1 : 0;
    P.body.rotation.x = b.mv ? Math.sin(v.walk) * 0.06 : 0;
    P.armC.rotation.z = -sw * 0.4;
    P.armH.rotation.z = sw * 0.4;
    const l = b.l ?? 1;
    const danger = 1 - l;
    const pulse = 0.5 + 0.5 * Math.sin(world.time * (4 + danger * 18));
    P.glow.material.opacity = danger * danger * 0.35 * (0.4 + 0.6 * pulse);
    // Plague gas.
    if (Math.random() < dt * (3 + danger * 10)) world.fx.smokePuff(v.x + (Math.random() - 0.5), 0.8, v.z + (Math.random() - 0.5), '#6a8a30', 0.9, 1.4, 0.25);
  },
});

// ------------------------------------------------------------ effects

// A rifle shot: muzzle flash, a smoke puff and a tracer to the target.
registerEvent('rifle', (e, world) => {
  const f = Math.atan2(e.y2 - e.y1, e.x2 - e.x1);
  const mx = e.x1 + Math.cos(f) * 1.3;
  const mz = e.y1 + Math.sin(f) * 1.3;
  world.fx.glow(mx, 1.3, mz, '#ffd080', 1.2, 0.12);
  world.fx.sparks(mx, 1.3, mz, 4, 3, '#ffe0a0');
  world.fx.smokePuff(mx, 1.3, mz, '#b8b0a8', 0.5, 0.8, 0.4);
  const d = Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
  for (let i = 0; i < d; i += 0.7) {
    const k = i / d;
    world.fx.trail(mx + (e.x2 - mx) * k, 1.3 - k * 0.3, mz + (e.y2 - mz) * k, '#fff0c0', 0.12, 0.12, 0.01);
  }
  world.fx.sparks(e.x2, 1.0, e.y2, 5, 3, '#ffe0b0');
  play('mortar');
});

// An abomination bursting: a green-grey blast of gore and plague, a
// shockwave to the 250 u edge, and the camera quake the map plays.
registerEvent('abomboom', (e, world) => {
  world.fx.explosion(e.x, e.y, 1.6, { scorch: false });
  world.fx.burst(e.x, 1.2, e.y, '#6a0e0e', { n: 40, speed: 7, size: 0.5, life: 0.9, up: 1.3, grav: 12, additive: false });
  world.fx.burst(e.x, 1.2, e.y, '#8aa060', { n: 26, speed: 6, size: 0.45, life: 0.8, up: 1.2, grav: 12, additive: false });
  world.fx.shockwave(e.x, e.y, e.r, '#c0ff80', 0.5);
  world.fx.ring(e.x, e.y, e.r * 0.6, '#ff5030', 0.35);
  for (let i = 0; i < 8; i++) world.fx.smokePuff(e.x + (Math.random() - 0.5) * 2, 0.6, e.y + (Math.random() - 0.5) * 2, '#5a7a28', 1.8, 2.2, 0.35);
  world.fx.scorch(e.x, e.y, 1.6, 10);
  world.fx.flash(e.x, e.y, 3, '#c0ff60', 0.35);
  world.shake = 0.5;
  play('bigboom');
});

registerEvent('portal', (e, world) => {
  world.fx.burst(e.x, 1.2, e.y, '#80c0ff', { n: 24, speed: 3, size: 0.5, life: 0.6 });
  world.fx.ring(e.x, e.y, 2, '#a0d0ff', 0.5);
  play('teleport');
});

// ------------------------------------------------------------ arena

registerTheme(
  'blight',
  { sky: '#1c1624', fog: '#241c2c', floor: ['#5a4a5a', 35, {}], sun: '#d8c8f0', hemi: ['#a898c8', '#2a2030'], sunI: 2.0 },
  { floor: { tex: 'tex_dirt.webp', tint: '#8a80c0', color: '#5a4a5a', units: 6 }, edge: { tex: 'tex_dirt.webp', tint: '#7a6a70', color: '#4a3a3a', units: 5 }, outer: { tex: 'tex_grass.webp', tint: '#8a8a70', color: '#3a4228' }, edgeWidth: 1.2 },
);

// The permanent Mass Teleport portal at the centre: a turning ring of blue
// light over a glowing disc, with motes rising through it.
registerMapBuilder('abom', (map, world) => {
  const hw = map.floor.w / 2;
  octCorners(world, hw, map.cut || 3.5, { trees: false });
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.3, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#4a90ff', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  disc.position.y = 0.05;
  const rings = [0, 1, 2].map((i) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.0 - i * 0.2, 0.04, 6, 40), new THREE.MeshBasicMaterial({ color: '#9fd0ff', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, toneMapped: false }));
    r.rotation.x = Math.PI / 2;
    r.position.y = 0.3 + i * 0.5;
    return r;
  });
  const runes = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.7, 8, 1).rotateX(-Math.PI / 2), M.texMat('tex_stone.webp', '#4a4a58', '#8a8aa0', 1));
  runes.position.y = 0.03;
  g.add(disc, runes, ...rings);
  world.mapGroup.add(g);
  driver(g, (dt, t) => {
    rings.forEach((r, i) => {
      r.rotation.z = t * (0.8 + i * 0.5) * (i % 2 ? -1 : 1);
      r.position.y = 0.3 + i * 0.5 + Math.sin(t * 2 + i) * 0.08;
    });
    disc.material.opacity = 0.3 + Math.sin(t * 3) * 0.08;
    if (Math.random() < dt * 12) world.fx.trail((Math.random() - 0.5) * 1.6, 0.2, (Math.random() - 0.5) * 1.6, '#a0d8ff', 0.4, 1.2, 0.1);
  });
});
