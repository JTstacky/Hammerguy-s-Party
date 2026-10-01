// The Salamander Sizzle (#21): an underground pen of giant mushrooms (the
// map's Dungeon Tree Walls), the salamanders' fireballs, and the mushrooms
// going up in flames when a fireball hits them, and the players' Salamander
// skin.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerEvent, registerMapBuilder, registerSkin } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { emit, fireball, glowDisc, ball, glowMat } from './dispel-fx.js';

const WU = 54;
const IMMO_R = 220 / WU;
const KILL_R = 100 / WU;

// Giant mushroom parts, instanced: a pale fibrous stem flaring at the foot, a
// spotted violet cap and dark gills under it.
function mushroomGeos() {
  const stem = M.lathe([[0.55, 0], [0.42, 0.12], [0.3, 0.4], [0.26, 0.9], [0.28, 1.45], [0.34, 1.6], [0.01, 1.62]], 16);
  const cap = M.lathe([[1.15, 1.45], [1.25, 1.52], [1.22, 1.72], [1.05, 1.98], [0.75, 2.2], [0.35, 2.33], [0.01, 2.36]], 28);
  const gills = M.lathe([[0.3, 1.52], [0.7, 1.5], [1.1, 1.47], [1.2, 1.5]], 28);
  return { stem, cap, gills };
}

registerMapBuilder('salamander', (map, world) => {
  const G = world.mapGroup;
  // Cavern walls beyond the ring: heaped boulders.
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + Math.random() * 0.05;
    for (const [r0, s0] of [[23.2, 1.2], [26, 2]]) {
      const r = r0 + Math.random() * 1.5;
      const rock = M.rock(s0 + Math.random() * 0.9);
      rock.position.set(Math.cos(a) * r, -0.2, Math.sin(a) * r);
      rock.scale.y = 1.4 + Math.random() * 0.8;
      G.add(rock);
    }
  }
  // Small glowing toadstools in the cracks outside the pen.
  const glow = glowMat('#8ae0ff');
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 22.2 + Math.random() * 1.2;
    const t = new THREE.Group();
    t.add(M.mesh(M.lathe([[0.08, 0], [0.05, 0.25], [0.01, 0.27]], 8), M.mat('#d8d0c0')));
    t.add(M.mesh(M.lathe([[0.2, 0.22], [0.16, 0.32], [0.01, 0.36]], 12), glow));
    t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    t.scale.setScalar(0.8 + Math.random());
    G.add(t);
  }
});

registerView('shrooms', {
  make(e, world, v) {
    const spots = world.map.blocks;
    const geos = mushroomGeos();
    const n = spots.length;
    const capMat = M.texMat('tex_salamander_mushroom.webp', '#7a3a8a', '#ffffff', 1.4, { roughness: 0.55 });
    const stemMat = M.texMat('tex_bark.webp', '#cfc4b0', '#f4ead8', 1);
    const gillMat = M.mat('#4a2a44', { roughness: 0.9, side: THREE.DoubleSide });
    const stem = new THREE.InstancedMesh(geos.stem, stemMat, n);
    const cap = new THREE.InstancedMesh(geos.cap, capMat, n);
    const gills = new THREE.InstancedMesh(geos.gills, gillMat, n);
    for (const m of [stem, cap, gills]) {
      m.castShadow = m !== gills;
      m.receiveShadow = true;
      m.frustumCulled = false;
    }
    // Each mushroom a little different: height, spread, tilt and hue.
    let s = 7;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const inst = spots.map(([x, z]) => ({ x, z, h: 0.95 + rnd() * 0.35, w: 0.95 + rnd() * 0.2, ry: rnd() * 6.28, tx: (rnd() - 0.5) * 0.12, tz: (rnd() - 0.5) * 0.12, k: 1 }));
    const c = new THREE.Color();
    inst.forEach((it, i) => cap.setColorAt(i, c.setHSL(0.8 + (rnd() - 0.5) * 0.08, 0.35 + rnd() * 0.2, 0.7 + rnd() * 0.15)));
    const g = new THREE.Group();
    g.add(stem, gills, cap);
    v.parts = { stem, cap, gills, inst, alive: decode(e.up, n) };
    place(v.parts);
    return g;
  },
  update(v, a, b, k, dt) {
    const p = v.parts;
    const alive = decode(b.up, p.inst.length);
    let dirty = false;
    p.inst.forEach((it, i) => {
      if (!alive[i] && it.k > 0) {
        it.k = Math.max(0, it.k - dt / 0.5);
        dirty = true;
      }
    });
    if (dirty) place(p);
    v.obj.position.set(0, 0, 0);
    v.obj.rotation.y = 0;
    return false;
  },
});

const dummy = new THREE.Object3D();
function place(p) {
  p.inst.forEach((it, i) => {
    // A burning mushroom shrivels and sinks.
    const k = it.k;
    dummy.position.set(it.x, -0.4 * (1 - k), it.z);
    dummy.rotation.set(it.tx + (1 - k) * 0.4, it.ry, it.tz);
    dummy.scale.set(it.w * (0.3 + 0.7 * k), it.h * k + 0.0001, it.w * (0.3 + 0.7 * k));
    dummy.updateMatrix();
    for (const m of [p.stem, p.cap, p.gills]) m.setMatrixAt(i, dummy.matrix);
  });
  for (const m of [p.stem, p.cap, p.gills]) m.instanceMatrix.needsUpdate = true;
}

function decode(hex, n) {
  const out = new Array(n).fill(false);
  for (let c = 0; c < hex.length; c++) {
    const v = parseInt(hex[c], 16);
    for (let b = 0; b < 4; b++) if (c * 4 + b < n) out[c * 4 + b] = !!(v & (1 << b));
  }
  return out;
}

// A salamander's fire: a low-flying ball of flame with its 220 u immolation
// glow on the ground and a hotter core the size of its 100 u kill radius.
registerView('sfire', {
  make(e, world, v) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), glowMat('#fff2b8'));
    core.position.y = 0.75;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshBasicMaterial({ color: '#ff7a20', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.position.y = 0.75;
    const heat = glowDisc('#ff4a10', IMMO_R, 0.18);
    const hot = glowDisc('#ffb050', KILL_R * 1.1, 0.45);
    g.add(heat, hot, halo, core);
    v.parts = { core, halo, heat };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const p = v.parts;
    p.core.scale.setScalar(1 + Math.sin(world.time * 25 + v.id) * 0.12);
    p.halo.scale.setScalar(1 + Math.sin(world.time * 14 + v.id) * 0.15);
    p.heat.material.opacity = 0.15 + Math.sin(world.time * 8 + v.id) * 0.04;
    fireball(world, v, v.x, 0.75, v.z, dt, 0.85);
    // A streak of flame left behind it.
    for (let n = emit(v, 'tail', 30, dt); n > 0; n--) world.fx.flame(v.x - Math.cos(v.f) * 0.5, 0.3, v.z - Math.sin(v.f) * 0.5, 0.7, 0.35, 0.15);
    return false;
  },
});

registerEvent('flameshot', (e, world) => {
  world.fx.glow(e.x, 0.8, e.y, '#ffb060', 2.5, 0.25);
  world.fx.sparks(e.x, 0.8, e.y, 10, 5, '#ffc070');
  for (let i = 0; i < 6; i++) world.fx.flame(e.x, 0.3, e.y, 1, 0.4, 0.3);
  play('fireball');
});

registerEvent('salfiredie', (e, world) => {
  if (e.hit) {
    world.fx.explosion(e.x, e.y, 1.3);
    world.fx.shockwave(e.x, e.y, 2, '#ffb070', 0.4);
    play('boom');
  } else {
    world.fx.glow(e.x, 0.8, e.y, '#ff9040', 1.8, 0.3);
    for (let i = 0; i < 4; i++) world.fx.smokePuff(e.x, 0.8, e.y, '#2a2220', 0.9, 1.2, 0.4);
  }
});

// A mushroom struck by a fireball bursts into flame and spores.
registerEvent('shroomburn', (e, world) => {
  const fx = world.fx;
  for (let i = 0; i < 26; i++) fx.flame(e.x + (Math.random() - 0.5) * 1.6, 0.4 + Math.random() * 1.6, e.y + (Math.random() - 0.5) * 1.6, 1.3, 0.9, 0.3);
  fx.burst(e.x, 2, e.y, '#c89ad8', { n: 30, speed: 3, size: 0.35, life: 1.6, up: 0.6, grav: 1, additive: false });
  fx.burst(e.x, 1.5, e.y, '#6a3a6a', { n: 14, speed: 5, size: 0.4, life: 0.9, up: 1, grav: 12, additive: false });
  for (let i = 0; i < 6; i++) fx.smokePuff(e.x, 1.2, e.y, '#2a2024', 1.5, 2.2, 0.45);
  fx.scorch(e.x, e.y, 1.3, 20);
  play('boom');
});

// ------------------------------------------------------------ the player unit

// The Salamander (`nslr`): a fire lizard on four splayed legs, orange-red
// with a pale belly, a long tapering tail, a blunt head with a wide mouth
// and glowing eyes, and a crest of burning spines down its back. Team
// colour on the collar and the tail band. The renderer swings legL / legR
// (the forelegs); userData.tick makes each hind leg follow the opposite
// foreleg and turns the death pose into a roll onto its side.
export function salamander(color) {
  const { mesh, blob, tube, mat } = M;
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(1.25);
  g.add(body);
  const hide = M.triMat('tex_hide.webp', '#d0501c', '#ff9a60', 1.8, { roughness: 0.55 });
  const belly = mat('#f4c070', { roughness: 0.6 });
  const dark = mat('#5a1a0a', { roughness: 0.6 });
  const team = mat(color, { roughness: 0.8 });
  const spine = mat('#ffb030', { roughness: 0.4, emissive: '#ff5a00', emissiveIntensity: 0.9 });
  const claw = mat('#2a1a10', { roughness: 0.4 });
  const eye = glowMat('#fff060');

  // Body: a long low torso, a paler belly under it.
  body.add(mesh(blob(0.62, 0.26, 0.32, { seed: 241, amt: 0.05, detail: 2 }), hide, 0, 0.5, 0));
  body.add(mesh(blob(0.52, 0.14, 0.26, { seed: 242, detail: 2 }), belly, 0.02, 0.36, 0));
  // Tail: tapering behind, curling a little.
  body.add(mesh(tube([[-0.5, 0.52, 0], [-0.85, 0.42, 0.06], [-1.15, 0.3, -0.04], [-1.4, 0.22, -0.16]], 0.2, 0.03, 16, 10), hide));
  const band = mesh(new THREE.TorusGeometry(0.13, 0.04, 6, 14), team, -0.8, 0.44, 0.05);
  band.rotation.y = Math.PI / 2;
  body.add(band);
  // Neck, collar and head.
  body.add(mesh(tube([[0.45, 0.55, 0], [0.62, 0.62, 0], [0.74, 0.66, 0]], 0.2, 0.16, 6, 10), hide));
  const collar = mesh(new THREE.TorusGeometry(0.19, 0.045, 6, 16), team, 0.58, 0.6, 0);
  collar.rotation.y = Math.PI / 2;
  collar.rotation.x = 0.3;
  body.add(collar);
  const head = new THREE.Group();
  head.position.set(0.86, 0.66, 0);
  head.add(mesh(blob(0.22, 0.13, 0.18, { seed: 243, amt: 0.05, detail: 2 }), hide, 0.04, 0.03, 0));
  head.add(mesh(blob(0.2, 0.06, 0.15, { seed: 244, detail: 1 }), belly, 0.06, -0.07, 0));
  head.add(mesh(ball(0.17, 0.02, 0.13), dark, 0.1, -0.03, 0));
  for (const s of [1, -1]) {
    head.add(mesh(ball(0.05, 0.04, 0.04), hide, 0.06, 0.12, 0.09 * s));
    head.add(mesh(ball(0.032), eye, 0.1, 0.13, 0.1 * s));
    const horn = mesh(new THREE.ConeGeometry(0.03, 0.16, 6), spine, -0.1, 0.12, 0.08 * s);
    horn.rotation.z = 1.9;
    head.add(horn);
  }
  body.add(head);
  // The crest: glowing spines from the head to the tail.
  for (let i = 0; i < 8; i++) {
    const x = 0.62 - i * 0.2;
    const h = 0.22 - Math.abs(i - 2.5) * 0.025;
    const cone = mesh(new THREE.ConeGeometry(0.05, h, 6), spine, x, (i < 6 ? 0.76 : 0.64 - (i - 6) * 0.06) + h * 0.4, 0);
    cone.rotation.z = 0.5;
    body.add(cone);
  }
  // Legs: splayed out to the sides, elbows up, three clawed toes each.
  const leg = (x, s) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.46, 0.22 * s);
    hip.add(mesh(tube([[0, 0, 0], [0.04, 0.02, 0.2 * s], [0.08, -0.22, 0.3 * s], [0.1, -0.42, 0.3 * s]], 0.085, 0.06, 8, 8), hide));
    hip.add(mesh(ball(0.09, 0.035, 0.08), hide, 0.14, -0.43, 0.3 * s));
    for (const z of [-0.05, 0, 0.05]) hip.add(mesh(tube([[0.2, -0.44, (0.3 + z) * s], [0.27, -0.45, (0.3 + z * 1.4) * s]], 0.02, 0.004, 2, 5), claw));
    return hip;
  };
  const legL = leg(0.36, 1);
  const legR = leg(0.36, -1);
  const hindL = leg(-0.34, 1);
  const hindR = leg(-0.34, -1);
  body.add(legL, legR, hindL, hindR);
  // Runs after the renderer has posed body, legL and legR this frame.
  const tick = () => {
    // A lizard trot: each hind leg moves with the opposite foreleg.
    hindR.rotation.z = legL.rotation.z;
    hindL.rotation.z = legR.rotation.z;
    // The renderer tips a dead hero back by body.rotation.z; a long lizard
    // rolls onto its side instead of standing on its tail.
    if (body.rotation.z !== 0) {
      body.rotation.x = body.rotation.z;
      body.rotation.z = 0;
    } else if (body.rotation.x !== 0) body.rotation.x = 0;
  };
  g.userData = { body, legL, legR, anim: [hindL, hindR], tick, kind: 'hero' };
  return g;
}

registerSkin('salamander', salamander);
