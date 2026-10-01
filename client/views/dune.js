// #43 Dune Worm Distress: the Dune Worm, the field of Rock Chunks (one
// instanced mesh per rock shape, cells hidden as they are eaten), the
// Wildkin, the troll-burrow Barricade, the arrival portal and the digging
// effects, on a sandy desert theme.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerTheme, registerMapBuilder } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { unitBar, setBar, mergeGeos, glow } from './up-kit.js';

registerTheme(
  'dune',
  { sky: '#c8a878', fog: '#c8a882', floor: ['#c8a86a', 40, {}], outer: ['#8a6a44', 30, {}], sun: '#fff6e6', hemi: ['#f4f0e8', '#6a5a44'], sunI: 2.3 },
  { floor: { tex: 'tex_dirt.webp', tint: '#d8e4b0', color: '#c8a870', units: 7 }, edge: { tex: 'tex_dirt.webp', tint: '#e8d0a8', color: '#9a7a50', units: 5 }, outer: { tex: 'tex_dirt.webp', tint: '#b8986c', color: '#7a5a3a', units: 9 }, edgeWidth: 1.6 },
);

// ------------------------------------------------------------ Dune Worm

// A Dune Worm: a fat segmented sand worm, pale belly plates and a banded
// back, a round maw of hooked teeth and two pincers in front (so it reads its
// facing), a team-coloured band and spines. Its segments ripple as it crawls.
function duneWorm(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const hide = M.triMat('tex_hide.webp', '#a87a52', '#e09a68', 2.4, { roughness: 0.6 });
  const belly = M.mat('#f0d0a0', { roughness: 0.55 });
  const team = M.mat(color, { roughness: 0.5 });
  const tooth = M.boneMat();
  // Segments from the head (x > 0) back; each is a pivot the hook sways.
  const segs = [];
  const sizes = [0.3, 0.33, 0.31, 0.27, 0.22, 0.16];
  let x = 0.25;
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    const seg = new THREE.Group();
    seg.position.set(x, s * 0.95, 0);
    seg.add(M.mesh(M.blob(s * 1.05, s * 0.92, s, { seed: 100 + i, amt: 0.05 }), hide, 0, 0, 0));
    seg.add(M.mesh(M.blob(s * 0.8, s * 0.35, s * 0.72, { seed: 110 + i }), belly, 0, -s * 0.6, 0));
    if (i === 1) {
      const band = M.mesh(new THREE.TorusGeometry(s * 0.95, 0.05, 8, 24), team, 0, 0, 0);
      band.rotation.y = Math.PI / 2;
      seg.add(band);
    }
    if (i > 0 && i < 5) seg.add(M.mesh(M.scaled(M.G.cone, 0.05, 0.2, 0.05), i === 2 ? team : tooth, 0, s * 0.95, 0));
    body.add(seg);
    segs.push(seg);
    x -= s * 1.35;
  }
  // The head: a round maw ringed with teeth, and pincers.
  const head = segs[0];
  head.add(M.mesh(M.lathe([[0.2, -0.05], [0.24, 0.08], [0.2, 0.16], [0.08, 0.14], [0.001, 0.1]], 16), M.mat('#5a1a18', { roughness: 0.4 }), 0.28, 0, 0).rotateZ(-Math.PI / 2));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const t = M.mesh(M.scaled(M.G.cone, 0.035, 0.12, 0.035), tooth, 0.34, Math.sin(a) * 0.17, Math.cos(a) * 0.17);
    t.rotation.z = -Math.PI / 2;
    t.rotation.x = -a;
    head.add(t);
  }
  const jaw = new THREE.Group();
  jaw.position.set(0.3, 0, 0);
  for (const s of [1, -1]) jaw.add(M.mesh(M.tube([[0, 0, 0.18 * s], [0.2, 0.02, 0.24 * s], [0.34, 0.0, 0.08 * s]], 0.05, 0.012, 10, 6), tooth));
  head.add(jaw);
  for (const s of [1, -1]) head.add(M.mesh(M.scaled(M.G.sphere, 0.04), glow('#ffdf6a'), 0.2, 0.2, 0.12 * s));
  body.scale.setScalar(1.7);
  // The world moves legL / legR (walk phase) and staff (bite); the hook
  // turns them into a ripple along the body and a snapping jaw.
  const legL = new THREE.Object3D();
  const legR = new THREE.Object3D();
  const staff = new THREE.Object3D();
  g.add(legL, legR, staff);
  // userData.tick (run by the world every frame) ripples the segments and
  // snaps the jaw; nothing is allocated per frame.
  const st = { phase: 0 };
  const tick = (dt) => {
    const amp = Math.abs(legL.rotation.z) + Math.abs(legR.rotation.z);
    const k = amp > 0.01 ? 1 : 0.25;
    st.phase += dt * (amp > 0.01 ? 9 : 1.2);
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      s.rotation.y = Math.sin(st.phase - i * 0.9) * 0.22 * k * Math.min(1, i * 0.6);
      s.position.y = sizes[i] * 0.95 + Math.max(0, Math.sin(st.phase - i * 0.9)) * 0.05 * k;
    }
    jaw.rotation.z = Math.max(-0.5, staff.rotation.x * 0.6);
    jaw.scale.set(1, 1, 1 - Math.min(0.4, -staff.rotation.x * 0.4));
  };
  g.userData = { body, legL, legR, staff, anim: [...segs, jaw], tick, kind: 'hero' };
  return g;
}
registerSkin('duneworm', duneWorm);

// ------------------------------------------------------------ the rock field

const ROCK_SHAPES = 3;
function rockGeos() {
  const out = [];
  for (let v = 0; v < ROCK_SHAPES; v++) {
    const parts = [];
    const n = 3 + v;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + v;
      const r = k === 0 ? 0 : 0.42;
      const s = k === 0 ? 0.62 : 0.34 + ((k * 37) % 10) / 60;
      const gg = M.blob(s, s * (0.75 + ((k * 13) % 5) / 12), s * 0.9, { seed: 200 + v * 10 + k, amt: 0.18, freq: 3.2, detail: 2 });
      gg.translate(Math.cos(a) * r, s * 0.55, Math.sin(a) * r);
      parts.push(gg);
    }
    out.push(mergeGeos(parts));
  }
  return out;
}

// The Rock Chunks: sandstone boulder clusters filling each 128 u cell.
// One InstancedMesh per shape; a cell's instance shrinks away when eaten.
registerView('dunegrid', {
  make(e, world, v) {
    const g = new THREE.Group();
    const n = e.n;
    const cs = e.cs;
    const mat = M.triMat('tex_boulder.webp', '#8a7050', '#f0d0a0', 0.8, { roughness: 0.9 });
    const geos = rockGeos();
    const meshes = geos.map((geo) => {
      const m = new THREE.InstancedMesh(geo, mat, n * n);
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      g.add(m);
      return m;
    });
    const cells = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const h = (i * 7 + j * 13) % 17;
        cells.push({ shape: (i * 3 + j * 5) % ROCK_SHAPES, x: (i + 0.5 - n / 2) * cs, z: (j + 0.5 - n / 2) * cs, rot: h * 0.37, s: cs * (0.62 + (h % 5) * 0.03), on: null, k: 1 });
      }
    }
    v.parts = { meshes, cells, dummy: new THREE.Object3D() };
    return g;
  },
  update(v, a, b, k, dt) {
    v.obj.rotation.y = 0;
    const p = v.parts;
    const d = p.dummy;
    const touched = new Set();
    for (let c = 0; c < p.cells.length; c++) {
      const on = ((parseInt(b.g[c >> 2], 16) >> (c & 3)) & 1) === 1;
      const cell = p.cells[c];
      if (cell.on === null) cell.k = on ? 1 : 0;
      else if (!on && cell.k > 0) cell.k = Math.max(0, cell.k - dt * 5);
      else if (on) cell.k = 1;
      if (cell.on !== on || (cell.k > 0 && cell.k < 1) || cell.drawn !== cell.k) {
        cell.on = on;
        cell.drawn = cell.k;
        d.position.set(cell.x, -(1 - cell.k) * 0.6, cell.z);
        d.rotation.set(0, cell.rot, 0);
        d.scale.setScalar(Math.max(0.0001, cell.s * cell.k));
        d.updateMatrix();
        p.meshes.forEach((m, sidx) => m.setMatrixAt(c, sidx === cell.shape ? d.matrix : ZERO));
        touched.add(cell.shape);
      }
    }
    if (touched.size) p.meshes.forEach((m) => (m.instanceMatrix.needsUpdate = true));
  },
});
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

// Corners are cliff; round the field, a rim of wind-carved mesas.
registerMapBuilder('dunefield', (map, world) => {
  const half = (map.n * map.cs) / 2;
  const cliff = M.triMat('tex_boulder.webp', '#7a5a3a', '#e0b080', 0.6, { roughness: 0.95 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const m = M.mesh(M.blob(map.cs * 0.75, 1.8, map.cs * 0.75, { seed: 300 + sx * 3 + sz, amt: 0.12, freq: 2.2 }), cliff, sx * (half - map.cs / 2), 0.9, sz * (half - map.cs / 2));
      world.mapGroup.add(m);
    }
  }
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 44; i++) {
    const side = i % 4;
    const along = (rnd() - 0.5) * (half * 2 + 6);
    const out = half + 1.6 + rnd() * 3.5;
    const x = side === 0 ? out : side === 1 ? -out : along;
    const z = side === 2 ? out : side === 3 ? -out : along;
    const s = 1 + rnd() * 1.6;
    const m = M.mesh(M.blob(s, s * (0.9 + rnd() * 0.8), s * (0.8 + rnd() * 0.4), { seed: 320 + i, amt: 0.16, freq: 2.8 }), cliff, x, s * 0.4, z);
    m.rotation.y = rnd() * 6;
    world.mapGroup.add(m);
  }
});

// ------------------------------------------------------------ the Wildkin

// The Wildkin: a hulking owlbeast of brown and cream feathers, a broad owl
// face with a hooked beak and great amber eyes, curling horns, wing-arms
// ending in talons, and heavy clawed feet.
function wildkin() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const feathers = M.furMat('#fff0d0');
  const cream = M.furMat('#fff4dc');
  const dark = M.mat('#3a2818', { roughness: 0.7 });
  const beak = M.mat('#e8b040', { roughness: 0.35 });
  const hornM = M.boneMat();
  body.add(M.mesh(M.blob(0.95, 1.05, 0.95, { seed: 401, amt: 0.08 }), feathers, -0.05, 1.45, 0));
  body.add(M.mesh(M.blob(0.62, 0.8, 0.8, { seed: 402, amt: 0.06 }), cream, 0.38, 1.35, 0));
  const head = new THREE.Group();
  head.position.set(0.35, 2.55, 0);
  head.add(M.mesh(M.blob(0.62, 0.52, 0.66, { seed: 403, amt: 0.06 }), feathers, 0, 0, 0));
  head.add(M.mesh(M.blob(0.2, 0.44, 0.52, { seed: 404, amt: 0.04 }), cream, 0.45, -0.02, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.scaled(M.G.sphere, 0.13, 0.13, 0.13), M.mat('#ffb020', { emissive: '#6a3000', emissiveIntensity: 0.8, roughness: 0.2 }), 0.52, 0.1, 0.22 * s));
    head.add(M.mesh(M.scaled(M.G.sphere, 0.06), M.mat('#0a0806', { roughness: 0.1 }), 0.62, 0.1, 0.22 * s));
    head.add(M.mesh(M.tube([[0.0, 0.35, 0.35 * s], [-0.15, 0.75, 0.55 * s], [-0.5, 0.85, 0.5 * s], [-0.62, 0.6, 0.35 * s]], 0.09, 0.015, 16, 8), hornM));
    head.add(M.mesh(M.blob(0.18, 0.2, 0.08, { seed: 405 }), feathers, 0.05, 0.42, 0.42 * s));
  }
  head.add(M.mesh(M.tube([[0.58, 0.02, 0], [0.74, -0.05, 0], [0.76, -0.22, 0]], 0.1, 0.02, 10, 8), beak));
  body.add(head);
  const arms = [];
  for (const s of [1, -1]) {
    const a = new THREE.Group();
    a.position.set(0.1, 2.0, 0.9 * s);
    a.add(M.mesh(M.blob(0.3, 0.75, 0.22, { seed: 406 }), feathers, 0.1, -0.5, 0.05 * s));
    for (let k = 0; k < 3; k++) a.add(M.mesh(M.tube([[0.25, -1.1, (k - 1) * 0.08], [0.45, -1.25, (k - 1) * 0.1], [0.55, -1.12, (k - 1) * 0.12]], 0.035, 0.008, 8, 6), dark));
    a.rotation.x = -0.15 * s;
    arms.push(a);
    body.add(a);
  }
  const legs = [];
  for (const s of [1, -1]) {
    const l = new THREE.Group();
    l.position.set(-0.05, 0.75, 0.45 * s);
    l.add(M.mesh(M.tube([[0, 0, 0], [0.12, -0.4, 0], [0.05, -0.7, 0]], 0.24, 0.12, 8, 10), feathers));
    for (let k = 0; k < 3; k++) l.add(M.mesh(M.tube([[0.05, -0.7, 0], [0.3, -0.74, (k - 1) * 0.14], [0.42, -0.78, (k - 1) * 0.18]], 0.05, 0.01, 6, 6), dark));
    legs.push(l);
    body.add(l);
  }
  body.scale.setScalar(1.3);
  g.userData = { body, head, arms, legs };
  return g;
}

registerView('wildkin', {
  make(e, world, v) {
    const g = wildkin();
    v.parts = g.userData;
    unitBar(v, world, 64);
    return g;
  },
  update(v, a, b, k, dt, world) {
    const U = v.parts;
    setBar(v, b.h, !b.dead);
    const moving = b.mv && !b.dead;
    v.walk = (v.walk || 0) + dt * (moving ? 11 : 0);
    U.legs.forEach((l, i) => (l.rotation.z = moving ? Math.sin(v.walk + i * Math.PI) * 0.55 : 0));
    U.body.position.y = moving ? Math.abs(Math.sin(v.walk)) * 0.12 : Math.sin(world.time * 2) * 0.03;
    if (v.castT > 0) v.castT -= dt;
    const sw = v.castT > 0 ? Math.sin((v.castT / 0.3) * Math.PI) : 0;
    U.arms.forEach((arm, i) => (arm.rotation.z = -sw * 1.3 * (i ? 0.6 : 1) + (moving ? Math.sin(v.walk + i * Math.PI) * 0.25 : 0)));
    U.head.rotation.z = -sw * 0.3;
    if (moving && Math.random() < dt * 8) world.fx.smokePuff(v.x - Math.cos(b.f), 0.2, v.z - Math.sin(b.f), '#c8a878', 0.8, 0.9, 0.35);
    if (b.dead) {
      v.deadT = (v.deadT || 0) + dt;
      U.body.rotation.z = Math.min(Math.PI / 2, v.deadT * 3);
    }
  },
});

// ------------------------------------------------------------ Barricade

// The Barricade (TrollBurrow model): a round earthen mound roofed with hide
// and ringed with sharpened stakes, a dark doorway and its owner's banner.
// Under construction it rises out of a scaffold and a dust cloud.
function barricade(color) {
  const g = new THREE.Group();
  const earth = M.triMat('tex_dirt.webp', '#6a5034', '#d0b088', 1.4);
  const wood = M.texMat('tex_wood.webp', '#6a4a2a', '#e0c0a0');
  const hide = M.hideMat();
  const rise = new THREE.Group();
  g.add(rise);
  rise.add(M.mesh(M.blob(1.1, 0.55, 1.1, { seed: 501, amt: 0.08 }), earth, 0, 0.2, 0));
  rise.add(M.mesh(M.lathe([[0.95, 0.35], [0.85, 0.7], [0.55, 1.05], [0.2, 1.2], [0.001, 1.22]], 18), hide));
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const st = M.mesh(M.lathe([[0.06, 0], [0.07, 0.5], [0.001, 0.95]], 6), wood, Math.cos(a) * 1.05, 0.05, Math.sin(a) * 1.05);
    st.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
    rise.add(st);
  }
  for (let k = 0; k < 4; k++) {
    const r = M.mesh(new THREE.TorusGeometry(0.72 - k * 0.14, 0.035, 6, 20), M.leatherMat(), 0, 0.62 + k * 0.14, 0);
    r.rotation.x = Math.PI / 2;
    rise.add(r);
  }
  rise.add(M.mesh(M.scaled(M.G.sphere, 0.3, 0.32, 0.18), M.mat('#140c06'), 0.82, 0.35, 0));
  const pole = new THREE.Group();
  pole.position.set(-0.3, 0.9, -0.4);
  pole.add(M.mesh(M.tube([[0, 0, 0], [0, 0.8, 0], [0.02, 1.6, 0]], 0.035, 0.03), wood));
  const flag = M.mesh(M.cloth(0.5, 0.36, 0.02, 0.06), M.mat(color, { side: THREE.DoubleSide }), 0.25, 1.4, 0);
  flag.rotation.y = Math.PI / 2;
  pole.add(flag);
  rise.add(pole);
  const scaffold = new THREE.Group();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    scaffold.add(M.mesh(M.tube([[Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2], [Math.cos(a) * 1.15, 1.3, Math.sin(a) * 1.15]], 0.04, 0.04, 2, 6), wood));
  }
  for (const y of [0.5, 1.1]) {
    const ring = M.mesh(new THREE.TorusGeometry(1.18, 0.03, 4, 6), wood, 0, y, 0);
    ring.rotation.x = Math.PI / 2;
    scaffold.add(ring);
  }
  g.add(scaffold);
  g.userData = { rise, scaffold, flag };
  return g;
}

registerView('dunebarricade', {
  make(e, world, v) {
    const g = barricade(world.colors[e.o] || '#ccc');
    v.parts = g.userData;
    unitBar(v, world, 48);
    return g;
  },
  update(v, a, b, k, dt, world) {
    const U = v.parts;
    v.obj.rotation.y = 0;
    setBar(v, b.h, true);
    const p = b.p ?? 1;
    U.rise.scale.set(1, 0.25 + 0.75 * p, 1);
    U.scaffold.visible = p < 1;
    U.flag.rotation.z = Math.sin(world.time * 3) * 0.08;
    if (p < 1 && Math.random() < dt * 4) world.fx.dustCloud(v.x + (Math.random() - 0.5) * 1.6, v.z + (Math.random() - 0.5) * 1.6, 0.5, '#c8a878', 2);
  },
});

// ------------------------------------------------------------ the portal

// MassTeleport's glow at the centre until the Wildkin comes through.
registerView('duneportal', {
  make(e, world, v) {
    const g = new THREE.Group();
    const mk = (r0, r1, c, o) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48, 1, 0, Math.PI * 1.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
      m.position.y = 0.08;
      g.add(m);
      return m;
    };
    const rings = [mk(1.2, 1.5, '#8ad8ff', 0.8), mk(0.7, 0.95, '#c8f0ff', 0.7), mk(1.7, 1.8, '#5aa8ff', 0.5)];
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 5, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#8ad8ff', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
    beam.position.y = 2.5;
    g.add(beam);
    v.parts = { rings, beam };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const t = world.time;
    v.obj.rotation.y = 0;
    v.parts.rings.forEach((r, i) => (r.rotation.y = t * (1 + i * 0.7) * (i % 2 ? -1 : 1)));
    // Brighter as the Wildkin's arrival nears.
    const urgency = Math.max(0, 1 - (b.t ?? 40) / 40);
    v.parts.beam.material.opacity = 0.08 + urgency * 0.2 + Math.sin(t * 6) * 0.03;
    if (Math.random() < dt * (6 + urgency * 20)) world.fx.trail((Math.random() - 0.5) * 2.4, 0.3, (Math.random() - 0.5) * 2.4, '#bfe8ff', 0.5, 1.2, 0.2);
  },
});

// ------------------------------------------------------------ events

registerEvent('dunebite', (e, world) => {
  world.fx.debrisBurst(e.x, e.y, 10, 4);
  world.fx.dustCloud(e.x, e.y, 1.1, '#d0b080', 10);
  play('smack');
});

registerEvent('dunebuild', (e, world) => {
  world.fx.dustCloud(e.x, e.y, 1.2, '#c8a878', 10);
  play('buy');
});

registerEvent('dunebuilt', (e, world) => {
  world.fx.ring(e.x, e.y, 1.6, '#ffe8a0', 0.5);
  play('coin');
});

registerEvent('dunebreak', (e, world) => {
  world.fx.debrisBurst(e.x, e.y, 16, 6);
  world.fx.dustCloud(e.x, e.y, 1.4, '#8a6a44', 14);
  world.shake = 0.25;
  play('boom');
});

registerEvent('duneportal', (e, world) => {
  world.fx.flash(e.x, e.y, 4, '#8ad8ff', 0.5);
  world.fx.shockwave(e.x, e.y, 4, '#bfe8ff', 0.6);
  world.fx.burst(e.x, 1.5, e.y, '#bfe8ff', { n: 60, speed: 7, size: 0.8, life: 0.8 });
  world.shake = 0.4;
  play('teleport');
});

registerEvent('dunedeath', (e, world) => {
  world.fx.burst(e.x, 0.5, e.y, '#c8a060', { n: 22, speed: 3, size: 0.5, life: 0.6, additive: false, grav: 8 });
  world.fx.dustCloud(e.x, e.y, 0.8, '#b89868', 8);
  play('squish');
});

export { duneWorm, wildkin, barricade };
