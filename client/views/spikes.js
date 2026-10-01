// The Spike Pit (#20): a dungeon pit floored with 176 spike traps that sink
// round the moving safe spot and shoot up again behind it, and the players'
// Militia skin.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerEvent, registerMapBuilder, registerSkin } from '../../engine/client/render/registry.js';
import { ball } from './dispel-fx.js';
import { play } from '../../engine/client/audio.js';

const WU = 54;

// The spike positions, in the server's order (see server/minigames/up/20-spikes.js).
function spikeSpots() {
  const out = [];
  for (let j = 0; j < 10; j++) {
    for (let i = 0; i < 18; i++) {
      if ((i === 0 || i === 17) && (j === 0 || j === 9)) continue;
      out.push([(-1088 + 128 * i) / WU, (-576 + 128 * j) / WU]);
    }
  }
  return out;
}

// One trap: a cluster of seven iron spikes, tips darkened with old blood,
// baked into one geometry per material for instancing.
function spikeGeometries() {
  const iron = [];
  const tips = [];
  const spots = [[0, 0, 1.25], [0.55, 0.3, 1.0], [-0.5, 0.35, 0.95], [0.1, -0.6, 1.05], [-0.45, -0.4, 0.9], [0.55, -0.35, 0.85], [-0.05, 0.65, 0.95]];
  for (const [x, z, h] of spots) {
    const shaft = new THREE.CylinderGeometry(0.04, 0.15, h * 0.85, 10, 1);
    shaft.translate(x * 0.9, h * 0.425, z * 0.9);
    iron.push(shaft);
    const tip = new THREE.ConeGeometry(0.04, h * 0.32, 10, 1);
    tip.translate(x * 0.9, h * 0.85 + h * 0.16, z * 0.9);
    tips.push(tip);
  }
  const clean = (gs) => mergeGeometries(gs.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    return n;
  }));
  return { iron: clean(iron), tips: clean(tips) };
}

registerMapBuilder('spikes', (map, world) => {
  const S = map.spikes;
  const G = world.mapGroup;
  // Trap holes: a dark iron-rimmed pit in each tile.
  const holeGeo = new THREE.CircleGeometry(0.62, 20).rotateX(-Math.PI / 2);
  const rimGeo = new THREE.TorusGeometry(0.62, 0.07, 6, 20).rotateX(Math.PI / 2);
  const spots = spikeSpots();
  const holes = new THREE.InstancedMesh(holeGeo, M.mat('#0c0907', { roughness: 1 }), spots.length);
  const rims = new THREE.InstancedMesh(rimGeo, M.mat('#3a3430', { metalness: 0.5, roughness: 0.5 }), spots.length);
  const d = new THREE.Object3D();
  spots.forEach(([x, z], i) => {
    d.position.set(x, 0.03, z);
    d.updateMatrix();
    holes.setMatrixAt(i, d.matrix);
    d.position.y = 0.05;
    d.updateMatrix();
    rims.setMatrixAt(i, d.matrix);
  });
  rims.receiveShadow = true;
  G.add(holes, rims);
  // The pit wall: a low parapet of dressed stone round the whole pit.
  const stone = M.texMat('tex_stone.webp', '#7a7068', '#c8bcb0', 0.5);
  const hw = S.hw + 0.5;
  const hh = S.hh + 0.5;
  const segs = [];
  for (let x = -hw; x < hw - 0.01; x += 2.4) segs.push([x + 1.2, -hh, 0], [x + 1.2, hh, 0]);
  for (let z = -hh; z < hh - 0.01; z += 2.4) segs.push([-hw, z + 1.2, 1], [hw, z + 1.2, 1]);
  const blocks = [];
  for (const [x, z, vert] of segs) {
    const g = new RoundedBoxGeometry(vert ? 1 : 2.35, 0.9 + Math.random() * 0.25, vert ? 2.35 : 1, 2, 0.12);
    g.translate(x, 0.45, z);
    blocks.push(g.index ? g.toNonIndexed() : g);
  }
  const wall = M.mesh(mergeGeometries(blocks), stone);
  G.add(wall);
  // Iron braziers on the corners, and rubble beyond.
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const t = M.torch();
    t.position.set(sx * (hw + 0.9), 0, sz * (hh + 0.9));
    t.scale.setScalar(1.4);
    G.add(t);
    world.animated.push({ type: 'torch', obj: t });
  }
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const x = Math.cos(a) * (hw + 3 + Math.random() * 6);
    const z = Math.sin(a) * (hh + 3 + Math.random() * 6);
    const r = M.rock(0.6 + Math.random() * 1.2);
    r.position.set(Math.max(-hw - 9, Math.min(hw + 9, x * 1.1)), 0, z);
    G.add(r);
  }
});

// The spikes themselves: two instanced meshes; each trap eases up (fast) or
// down (slower) toward its state in the snapshot.
registerView('spikegrid', {
  make(e, world, v) {
    const spots = spikeSpots();
    const { iron, tips } = spikeGeometries();
    const ironMesh = new THREE.InstancedMesh(iron, M.texMat('tex_plate.webp', '#8a8a90', '#d0ccc8', 1, { metalness: 0.7, roughness: 0.3 }), spots.length);
    const tipMesh = new THREE.InstancedMesh(tips, M.mat('#7a2018', { metalness: 0.5, roughness: 0.3 }), spots.length);
    ironMesh.castShadow = true;
    for (const m of [ironMesh, tipMesh]) m.frustumCulled = false;
    const g = new THREE.Group();
    g.add(ironMesh, tipMesh);
    const up = decode(e.up, spots.length);
    v.parts = { spots, ironMesh, tipMesh, h: up.map((u) => (u ? 1 : 0)), up, rot: spots.map(() => Math.random() * 6) };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const p = v.parts;
    const up = decode(b.up, p.spots.length);
    const d = new THREE.Object3D();
    let rose = 0;
    for (let i = 0; i < p.spots.length; i++) {
      if (up[i] && !p.up[i]) {
        rose++;
        if (rose < 8) world.fx.dustCloud(p.spots[i][0], p.spots[i][1], 0.4, '#8a7a6a', 3);
        if (rose < 5) world.fx.sparks(p.spots[i][0], 0.4, p.spots[i][1], 3, 2, '#ffd8a0');
      }
      p.up[i] = up[i];
      p.h[i] = Math.min(1, Math.max(0, p.h[i] + (up[i] ? dt / 0.12 : -dt / 0.35)));
      const [x, z] = p.spots[i];
      d.position.set(x, -1.35 * (1 - p.h[i]) + 0.02, z);
      d.rotation.y = p.rot[i];
      d.scale.setScalar(p.h[i] > 0 ? 1 : 0.0001);
      d.updateMatrix();
      p.ironMesh.setMatrixAt(i, d.matrix);
      p.tipMesh.setMatrixAt(i, d.matrix);
    }
    p.ironMesh.instanceMatrix.needsUpdate = true;
    p.tipMesh.instanceMatrix.needsUpdate = true;
    v.obj.position.set(0, 0, 0);
    v.obj.rotation.y = 0;
    return false;
  },
});

function decode(hex, n) {
  const out = new Array(n).fill(false);
  for (let c = 0; c < hex.length; c++) {
    const v = parseInt(hex[c], 16);
    for (let b = 0; b < 4; b++) if (c * 4 + b < n) out[c * 4 + b] = !!(v & (1 << b));
  }
  return out;
}

// Impaled: blood and a shower of grit.
registerEvent('spikeimpale', (e, world) => {
  world.fx.burst(e.x, 0.8, e.y, '#8a0c0c', { n: 30, speed: 4, size: 0.4, life: 0.8, up: 1.4, grav: 12, additive: false });
  world.fx.sparks(e.x, 0.6, e.y, 8, 3, '#ffd0a0');
  world.fx.dustCloud(e.x, e.y, 0.6, '#6a5a4a', 5);
  play('squish');
});

// ------------------------------------------------------------ the player unit

// The Militia (`hmil`): a human peasant called to arms. A steel kettle helmet
// over a round, ruddy face, a padded leather jerkin over a team-coloured
// tunic, brown breeches and boots, a round wooden buckler with an iron boss
// and a short sword.
export function militia(color) {
  const { mesh, blob, tube, lathe, mat } = M;
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(1.35);
  g.add(body);
  const skin = mat('#f0c49a', { roughness: 0.65 });
  const steel = M.plateMat();
  const leather = M.leatherMat('#c89468');
  const team = mat(color, { roughness: 0.85, side: THREE.DoubleSide });
  const breeches = mat('#7a5a3a', { roughness: 0.9 });
  const boot = mat('#4a3020', { roughness: 0.7 });
  const wood = M.texMat('tex_wood.webp', '#8a6030', '#e0b080');
  const iron = mat('#6a6c72', { metalness: 0.7, roughness: 0.4 });
  const hair = mat('#8a5a2a', { roughness: 0.9 });
  const dark = mat('#1a120a', { roughness: 0.4 });

  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(0, 0.58, 0.12 * s);
    hip.add(mesh(tube([[0, 0, 0], [0.02, -0.22, 0], [0, -0.4, 0]], 0.09, 0.07, 5, 8), breeches));
    hip.add(mesh(lathe([[0.075, -0.56], [0.08, -0.42], [0.07, -0.36], [0.001, -0.36]], 10), boot));
    hip.add(mesh(blob(0.11, 0.05, 0.075, { seed: 231, detail: 1 }), boot, 0.05, -0.55, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);
  // Tunic skirt in team colour under a laced leather jerkin, and a belt.
  const skirt = mesh(lathe([[0.2, 0.72], [0.24, 0.6], [0.28, 0.44], [0.29, 0.4]], 16), team);
  skirt.scale.z = 1.1;
  const jerkin = mesh(lathe([[0.22, 0.66], [0.26, 0.8], [0.27, 0.95], [0.24, 1.06], [0.14, 1.14], [0.06, 1.16]], 16), leather);
  jerkin.scale.z = 1.15;
  const belt = mesh(new THREE.TorusGeometry(0.235, 0.03, 6, 18).rotateX(Math.PI / 2), mat('#3a2616', { roughness: 0.6 }), 0, 0.7, 0);
  belt.scale.z = 1.15;
  const buckle = mesh(new THREE.BoxGeometry(0.03, 0.06, 0.07), mat('#d8b040', { metalness: 0.7, roughness: 0.35 }), 0.26, 0.7, 0);
  // Team-coloured sleeves and a collar.
  const collar = mesh(new THREE.TorusGeometry(0.1, 0.035, 6, 14).rotateX(Math.PI / 2), team, 0, 1.13, 0);
  // Head: face, nose, hair at the neck, the kettle helmet with its broad brim.
  const head = new THREE.Group();
  head.position.set(0.03, 1.3, 0);
  head.add(mesh(ball(0.14, 0.15, 0.13), skin, 0, 0, 0));
  head.add(mesh(ball(0.03, 0.035, 0.03), skin, 0.14, -0.01, 0));
  head.add(mesh(ball(0.12, 0.08, 0.13), hair, -0.05, -0.06, 0));
  for (const s of [1, -1]) head.add(mesh(ball(0.018), dark, 0.125, 0.03, 0.05 * s));
  head.add(mesh(lathe([[0.001, 0.2], [0.09, 0.19], [0.14, 0.14], [0.155, 0.07], [0.16, 0.05], [0.21, 0.035], [0.215, 0.02], [0.15, 0.03]], 18), steel));
  // Left arm with the buckler strapped on.
  const armL = mesh(tube([[0, 1.06, 0.26], [0.05, 0.9, 0.32], [0.18, 0.78, 0.28]], 0.075, 0.065, 6, 8), team);
  const handL = mesh(ball(0.06), skin, 0.2, 0.77, 0.27);
  const shield = new THREE.Group();
  shield.position.set(0.2, 0.86, 0.36);
  shield.rotation.set(0, -0.25, 0);
  const disc = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 20).rotateX(Math.PI / 2), wood);
  const rim = mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 20), iron);
  const boss = mesh(new THREE.SphereGeometry(0.08, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), iron, 0, 0, 0.025);
  const stripe = mesh(new THREE.BoxGeometry(0.1, 0.5, 0.02), team, 0, 0, 0.03);
  shield.add(disc, rim, boss, stripe);
  // Right arm and the sword (the "staff" the attack animation raises).
  const sword = new THREE.Group();
  sword.position.set(0, 1.06, -0.26);
  sword.add(mesh(tube([[0, 0, 0], [0.08, -0.16, -0.06], [0.22, -0.26, -0.04]], 0.075, 0.065, 6, 8), team));
  sword.add(mesh(ball(0.06), skin, 0.24, -0.27, -0.04));
  const blade = new THREE.Group();
  blade.position.set(0.25, -0.27, -0.04);
  blade.rotation.z = -0.35;
  blade.add(mesh(new THREE.BoxGeometry(0.03, 0.02, 0.18), iron, 0, 0.05, 0));
  blade.add(mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.12, 6), leather, 0, -0.02, 0));
  const bladeGeo = new THREE.CylinderGeometry(0.01, 0.035, 0.55, 4);
  bladeGeo.scale(1, 1, 0.35);
  blade.add(mesh(bladeGeo, steel, 0, 0.33, 0));
  sword.add(blade);
  body.add(legL, legR, skirt, jerkin, belt, buckle, collar, head, armL, handL, shield, sword);
  g.userData = { body, legL, legR, staff: sword, kind: 'hero' };
  return g;
}

registerSkin('militia', militia);
