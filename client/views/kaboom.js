// The Kaboom Room (#3): an octagonal stone room walled by cliffs, four stone
// pillars with braziers, the burning centre, fire wisps flying out of it,
// sapper explosions, and the players' Goblin Sapper skin.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerEvent, registerMapBuilder, registerSkin } from '../../engine/client/render/registry.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { LITE } from '../../engine/client/device.js';
import { play } from '../../engine/client/audio.js';
import { emit, fireball, glowDisc, ball, glowMat } from './dispel-fx.js';

const WU = 54;
const IMMO_R = 220 / WU;

// A square stone pillar (128x128 in the map): bevelled blocks with a plinth,
// a carved capital and an iron brazier burning on top.
function stonePillar(side) {
  const g = new THREE.Group();
  const stone = M.texMat('tex_stone.webp', '#8a847a', '#d8d2c8', 0.6);
  const dark = M.texMat('tex_stone.webp', '#6a645c', '#aaa296', 0.6);
  const block = (w, h, y, m = stone) => {
    const b = M.mesh(new RoundedBoxGeometry(w, h, w, 3, Math.min(0.12, h * 0.3)), m, 0, y, 0);
    g.add(b);
    return b;
  };
  block(side * 1.08, 0.35, 0.17, dark);
  block(side * 0.98, 0.3, 0.5);
  for (let i = 0; i < 4; i++) block(side * 0.86, 0.66, 0.99 + i * 0.68, i % 2 ? stone : dark);
  block(side * 1.02, 0.3, 3.8);
  block(side * 1.1, 0.22, 4.06, dark);
  const iron = M.mat('#2c2a28', { metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide });
  g.add(M.mesh(M.lathe([[0.08, 4.15], [0.35, 4.2], [0.55, 4.45], [0.62, 4.62], [0.58, 4.64]], 16), iron));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.add(M.mesh(M.tube([[Math.cos(a) * 0.3, 4.17, Math.sin(a) * 0.3], [Math.cos(a) * 0.62, 4.4, Math.sin(a) * 0.62], [Math.cos(a) * 0.66, 4.72, Math.sin(a) * 0.66]], 0.035, 0.02, 6, 6), iron));
  }
  g.add(coalHeap(0.42, 7, 4.5, 0.2));
  return g;
}

// A heap of charred lumps with embers glowing in their cracks.
function coalHeap(r, n, y, size, own = false) {
  const g = new THREE.Group();
  const m = M.triMat('tex_boulder.webp', '#1a1210', '#3a2e2a', 3, { emissive: '#b02a04', emissiveIntensity: own ? 0 : 0.18 });
  const mat = own ? m.clone() : m;
  if (own) mat.onBeforeCompile = m.onBeforeCompile;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 * 2.618;
    const rr = Math.sqrt((i + 0.5) / n) * r;
    const k = size * (0.7 + ((i * 37) % 10) / 20);
    const lump = M.mesh(M.blob(k, k * 0.7, k, { seed: 150 + i, amt: 0.25, freq: 3.5 }), mat, Math.cos(a) * rr, y + k * 0.4, Math.sin(a) * rr);
    lump.rotation.set(i, i * 2, 0);
    g.add(lump);
  }
  g.userData.mat = mat;
  return g;
}

// A burning stone brazier in the middle of the room.
function centreBrazier() {
  const g = new THREE.Group();
  const stone = M.texMat('tex_stone.webp', '#7a746a', '#c8c2b8', 0.5);
  g.add(M.mesh(M.lathe([[1.9, 0], [1.9, 0.12], [1.7, 0.2], [1.55, 0.2], [1.5, 0.08], [0.01, 0.08]], 32), stone));
  const ring = M.mesh(new THREE.TorusGeometry(1.72, 0.11, 8, 40).rotateX(Math.PI / 2), M.texMat('tex_stone.webp', '#5a544c', '#9a948a', 0.5), 0, 0.2, 0);
  g.add(ring);
  const coals = coalHeap(1.4, 26, 0.08, 0.3, true);
  g.add(coals);
  g.userData.coals = coals.userData.mat;
  return g;
}

registerMapBuilder('kaboom', (map, world) => {
  const R = map.room;
  // Static scenery (rocks, pillars, the centre brazier), merged per material
  // at the end. Torches stay out: their flame plane is animated per-frame.
  const G = new THREE.Group();
  const corners = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    corners.push([Math.cos(a), Math.sin(a)]);
  }
  const edge = (t) => {
    // A point on the octagon's boundary |x|,|y| <= a, |x|+|y| <= d, walking round by angle.
    const c = [Math.cos(t), Math.sin(t)];
    const s = Math.min(R.a / Math.max(Math.abs(c[0]), 1e-6), R.a / Math.max(Math.abs(c[1]), 1e-6), R.d / (Math.abs(c[0]) + Math.abs(c[1])));
    return [c[0] * s, c[1] * s];
  };
  for (let i = 0; i < 72; i++) {
    const t = (i / 72) * Math.PI * 2;
    const [x, y] = edge(t);
    const n = Math.hypot(x, y);
    for (const [out, s] of [[0.9, 1.1 + Math.random() * 0.5], [2.4, 1.5 + Math.random() * 0.8]]) {
      const rock = M.rock(s);
      rock.position.set(x + (x / n) * (out + Math.random() * 0.4), -0.1, y + (y / n) * (out + Math.random() * 0.4));
      rock.scale.y = 1.3 + Math.random() * 0.6;
      G.add(rock);
    }
  }
  for (const [x, y] of R.p) {
    const p = stonePillar(R.ph * 2);
    p.position.set(x, 0, y);
    G.add(p);
  }
  const c = centreBrazier();
  G.add(c);
  world.kaboomCentre = c;
  // Torches on the cut corners, as in the room's original lighting.
  for (const [cx, cy] of corners) {
    const t = M.torch();
    const r = R.d / (Math.abs(cx) + Math.abs(cy)) - 0.6;
    t.position.set(cx * r, 0, cy * r);
    world.mapGroup.add(t);
    world.animated.push({ type: 'torch', obj: t });
  }
  bakeStatic(G);
  world.mapGroup.add(G);
  // The braziers' flames are emitted by the 'kcentre' view (the world animates torches only).
  world.kaboomBraziers = { pillars: R.p };
});

// The centre flame: dark coals until the room ignites at t=5, then a roaring
// fire over the 128 u damage zone.
registerView('kcentre', {
  make(e, world, v) {
    const g = new THREE.Group();
    const heat = glowDisc('#ff6a20', e.r * 1.25, 0);
    g.add(heat);
    let light = null;
    if (!LITE) {
      light = new THREE.PointLight('#ff8a30', 0, 16, 1.6);
      light.position.y = 2;
      g.add(light);
    }
    v.parts = { heat, light, on: 0 };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const p = v.parts;
    p.on = Math.max(0, Math.min(1, p.on + dt * (b.on ? 1.5 : -1)));
    p.heat.material.opacity = p.on * (0.45 + Math.sin(world.time * 9) * 0.08);
    if (p.light) p.light.intensity = p.on * (22 + Math.sin(world.time * 11) * 4);
    const coals = world.kaboomCentre?.userData.coals;
    if (coals) coals.emissiveIntensity = 0.02 + p.on * (0.2 + Math.sin(world.time * 7) * 0.06);
    const r = b.r;
    for (let n = emit(v, 'fire', 60 * p.on, dt); n > 0; n--) {
      const ang = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * r * 0.8;
      world.fx.flame(Math.cos(ang) * rr, 0.15, Math.sin(ang) * rr, 2.2 + Math.random() * 1.2, 0.8, 0);
    }
    for (let n = emit(v, 'blaze', 14 * p.on, dt); n > 0; n--) world.fx.sp.fire.spawn((Math.random() - 0.5) * r, 0.9, (Math.random() - 0.5) * r, { vy: 1.4, size: 3 + Math.random() * 1.5, grow: 0.6, life: 0.5, frame: -1, spin: 1, fadeIn: 0.1 });
    if (emit(v, 'smoke', 5 * p.on, dt)) world.fx.smokePuff((Math.random() - 0.5) * r, 2.2, (Math.random() - 0.5) * r, '#241e1c', 1.8, 2.2, 0.35);
    if (emit(v, 'ember', 6 * p.on, dt)) world.fx.sparks((Math.random() - 0.5) * r, 1, (Math.random() - 0.5) * r, 2, 2.5, '#ffb050');
    // The pillars' braziers burn all game.
    for (const [x, z] of world.kaboomBraziers?.pillars || []) {
      for (let n = emit(v, `b${x}${z}`, 18, dt); n > 0; n--) world.fx.flame(x, 4.55, z, 1.3, 0.55, 0.2);
    }
    return false;
  },
});

// A fire wisp: a ball of flame at waist height with its Permanent Immolation
// burning the floor round it. It is teleported back to the centre when it
// reaches 800 u, so a change of `j` snaps it instead of sliding it back.
registerView('kfire', {
  make(e, world, v) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), glowMat('#fff0b0'));
    core.position.y = 1.1;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshBasicMaterial({ color: '#ff8a30', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.position.y = 1.1;
    const heat = glowDisc('#ff5a10', IMMO_R, 0.22);
    const scorch = glowDisc('#ffb060', 1.1, 0.5);
    g.add(heat, scorch, halo, core);
    v.parts = { core, halo, heat, j: e.j };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const p = v.parts;
    if (a.j !== b.j) {
      // Mid-reset: show it at the new spot at once.
      v.x = b.x;
      v.z = b.y;
      v.obj.position.set(b.x, 0, b.y);
    }
    if (p.j !== b.j) {
      p.j = b.j;
      world.fx.glow(0, 1.1, 0, '#ffb060', 2.5, 0.25);
    }
    const flick = 1 + Math.sin(world.time * 23 + v.id) * 0.12;
    p.core.scale.setScalar(flick);
    p.halo.scale.setScalar(1 + Math.sin(world.time * 13 + v.id) * 0.15);
    p.heat.material.opacity = 0.18 + Math.sin(world.time * 7 + v.id) * 0.05;
    fireball(world, v, v.x, 1.1, v.z, dt, 0.9);
    // The immolation aura licks the ground round it.
    for (let n = emit(v, 'aura', 18, dt); n > 0; n--) {
      const ang = Math.random() * Math.PI * 2;
      const rr = (0.35 + Math.random() * 0.65) * IMMO_R;
      world.fx.flame(v.x + Math.cos(ang) * rr, 0.05, v.z + Math.sin(ang) * rr, 0.55, 0.4, 0);
    }
    return false;
  },
});

registerEvent('kfire', (e, world) => {
  world.fx.explosion(e.x, e.y, 1.2, { scorch: false });
  play('boom');
});

// A goblin sapper's Death Damage: a fireball blast that kills everyone within 250.
registerEvent('kaboom', (e, world) => {
  const fx = world.fx;
  const r = 250 / WU;
  fx.explosion(e.x, e.y, 2.4);
  fx.shockwave(e.x, e.y, r, '#ffc080', 0.55);
  fx.ring(e.x, e.y, 150 / WU, '#ffe0a0', 0.35);
  fx.debrisBurst(e.x, e.y, 18, 8);
  fx.dustCloud(e.x, e.y, 1.6, '#6a5a4a', 10);
  fx.flash(e.x, e.y, r, '#ff9040', 0.35);
  for (let i = 0; i < 20; i++) fx.flame(e.x + (Math.random() - 0.5) * 2, 0.3, e.y + (Math.random() - 0.5) * 2, 1.6, 0.8, 0.5);
  world.shake = 0.5;
  play('bigboom');
});

// ------------------------------------------------------------ the player unit

// The Goblin Sapper (`ngsp`): a short green goblin with a big head, long
// ears, a hooked nose and goggles pushed up on a leather cap, hunched under
// a huge bundle of red dynamite with a lit fuse. Team colour on the bandana,
// the sash and the straps of the bundle.
export function goblinSapper(color) {
  const { mesh, blob, tube, lathe, mat } = M;
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(1.3);
  g.add(body);
  const skin = mat('#6cc03c', { roughness: 0.6 });
  const skinDark = mat('#4e9a2a', { roughness: 0.65 });
  const leather = M.leatherMat('#c89468');
  const cloth = M.texMat('tex_leather.webp', '#8a6a48', '#d8b890', 1, { roughness: 0.95 });
  const team = mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  const brass = mat('#d8a840', { metalness: 0.7, roughness: 0.35 });
  const lens = mat('#9ae0ff', { metalness: 0.2, roughness: 0.1, emissive: '#1a4050' });
  const dyn = mat('#d02a1a', { roughness: 0.55 });
  const rope = mat('#c8b080', { roughness: 0.9 });
  const dark = mat('#140c06', { roughness: 0.4 });
  const eyeMat = mat('#ffe070', { emissive: '#604000' });

  // Short bandy legs with big pointed boots.
  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(0, 0.42, 0.11 * s);
    hip.add(mesh(tube([[0, 0, 0], [0.04, -0.18, 0.02 * s], [0.01, -0.34, 0.02 * s]], 0.07, 0.055, 5, 8), skin));
    hip.add(mesh(blob(0.14, 0.07, 0.08, { seed: 201, detail: 2 }), leather, 0.07, -0.37, 0.02 * s));
    hip.add(mesh(tube([[0.18, -0.38, 0.02 * s], [0.25, -0.36, 0.02 * s], [0.28, -0.3, 0.02 * s]], 0.04, 0.01, 4, 6), leather));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  // Pot-bellied torso in a leather jerkin, a team sash and a belt of pouches.
  const torso = mesh(blob(0.22, 0.24, 0.22, { seed: 202, amt: 0.05, detail: 2 }), cloth, 0.02, 0.66, 0);
  torso.rotation.z = -0.2;
  const sash = mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 20).rotateX(Math.PI / 2), team, 0.03, 0.5, 0);
  sash.scale.z = 1.05;
  const pouches = [1, -1].map((s) => mesh(blob(0.06, 0.07, 0.05, { seed: 203, detail: 1 }), leather, 0.12, 0.48, 0.15 * s));
  // Arms: thin and long, holding the straps of the bundle.
  const arm = (s) => mesh(tube([[0, 0.84, 0.2 * s], [0.08, 0.66, 0.26 * s], [0.18, 0.56, 0.2 * s]], 0.05, 0.045, 6, 8), skin);
  const hand = (s) => mesh(ball(0.06), skin, 0.2, 0.55, 0.19 * s);
  // Head: big, forward, with a long hooked nose and huge ears.
  const head = new THREE.Group();
  head.position.set(0.14, 1.02, 0);
  head.add(mesh(blob(0.19, 0.18, 0.17, { seed: 204, amt: 0.05, detail: 2 }), skin, 0, 0, 0));
  head.add(mesh(tube([[0.14, 0.0, 0], [0.26, -0.02, 0], [0.33, -0.08, 0]], 0.05, 0.015, 6, 8), skin));
  head.add(mesh(blob(0.1, 0.05, 0.12, { seed: 205, detail: 1 }), skinDark, 0.12, -0.11, 0));
  for (const s of [1, -1]) {
    head.add(mesh(ball(0.028), eyeMat, 0.16, 0.04, 0.06 * s));
    head.add(mesh(ball(0.014), dark, 0.185, 0.04, 0.06 * s));
    head.add(mesh(tube([[0, 0.03, 0.14 * s], [-0.06, 0.1, 0.3 * s], [-0.14, 0.16, 0.44 * s]], 0.06, 0.008, 6, 8), skin));
    // Goggles pushed up on the cap.
    const rim = mesh(new THREE.TorusGeometry(0.05, 0.016, 6, 14), brass, 0.12, 0.15, 0.065 * s);
    rim.rotation.y = Math.PI / 2 - 0.3 * s;
    rim.rotation.z = -0.5;
    head.add(rim, mesh(ball(0.042, 0.042, 0.02), lens, 0.125, 0.15, 0.065 * s));
  }
  head.add(mesh(lathe([[0.18, 0.06], [0.19, 0.1], [0.16, 0.17], [0.08, 0.21], [0.001, 0.22]], 14), leather, -0.02, 0, 0));
  const bandana = mesh(new THREE.TorusGeometry(0.175, 0.03, 6, 18).rotateX(Math.PI / 2), team, -0.01, 0.08, 0);
  bandana.rotation.z = -0.25;
  head.add(bandana);
  // The dynamite bundle on the back: sticks tied with rope, team straps, a lit fuse.
  const pack = new THREE.Group();
  pack.position.set(-0.3, 0.86, 0);
  pack.rotation.z = 0.25;
  const stick = new THREE.CylinderGeometry(0.075, 0.075, 0.62, 10);
  // Seven sticks standing upright in a tight hexagon.
  for (const [x, z] of [[0, 0], [0, 0.15], [0, -0.15], [0.13, 0.075], [0.13, -0.075], [-0.13, 0.075], [-0.13, -0.075]]) pack.add(mesh(stick, dyn, x, 0, z));
  for (const y of [-0.18, 0.18]) {
    const band = mesh(new THREE.TorusGeometry(0.24, 0.025, 6, 18).rotateX(Math.PI / 2), rope, 0, y, 0);
    band.scale.set(0.85, 1, 1.05);
    pack.add(band);
  }
  for (const s of [1, -1]) pack.add(mesh(tube([[0.12, 0.25, 0.12 * s], [0.3, 0.1, 0.2 * s], [0.42, -0.25, 0.16 * s]], 0.025, 0.025, 6, 5), team));
  pack.add(mesh(tube([[0, 0.31, 0], [0.05, 0.45, 0.03], [-0.04, 0.58, 0.06]], 0.012, 0.01, 6, 5), dark));
  const spark = mesh(ball(0.05), glowMat('#ffd040', 0.9), -0.04, 0.6, 0.06);
  spark.castShadow = false;
  pack.add(spark);
  body.add(legL, legR, torso, sash, ...pouches, arm(1), arm(-1), hand(1), hand(-1), head, pack);
  g.userData = { body, legL, legR, kind: 'hero' };
  return g;
}

registerSkin('goblinsapper', goblinSapper);
