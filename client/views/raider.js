// Raider Relay (#14): the Raider and Goblin Zeppelin skins, the parked
// zeppelins, bears, hippogryphs, ensnare nets and the walled course.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';
import { bakeModel, bakeStatic } from '../../engine/client/render/batch.js';
import { cliffField, cliffMaterial, dressWalls, circleOfPower, blobShadow, emit } from './lib-f-cliffs.js';
import { ironMat, brassMat } from './lib-f-units.js';

const AIR = 2.6; // flying height drawn for zeppelins and hippogryphs

const greenSkin = () => M.mat('#6a9a48', { roughness: 0.7 });

// ------------------------------------------------------------ raider

// A wolf for the raider (and nothing else): grey fur, long snout, bushy tail.
function wolf(g) {
  const fur = M.triMat('tex_fur.webp', '#6a6460', '#c8c0b8', 1.8);
  const dark = M.mat('#2a2624', { roughness: 0.8 });
  const B = (sx, sy, sz, seed, amt = 0.08) => M.blob(sx, sy, sz, { seed, amt, detail: 2 });
  g.add(M.mesh(B(0.75, 0.38, 0.36, 61), fur, 0, 0.9, 0));
  g.add(M.mesh(B(0.4, 0.42, 0.4, 62), fur, 0.45, 0.98, 0));
  const head = new THREE.Group();
  head.position.set(0.9, 1.15, 0);
  head.add(M.mesh(B(0.26, 0.22, 0.22, 63), fur));
  head.add(M.mesh(M.scaled(M.G.cone, 0.12, 0.42, 0.13).rotateZ(-Math.PI / 2), fur, 0.3, -0.06, 0));
  head.add(M.mesh(M.scaled(M.G.sphere, 0.05), dark, 0.51, -0.05, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.scaled(M.G.cone, 0.07, 0.2, 0.05), fur, -0.02, 0.24, 0.12 * s));
    head.add(M.mesh(M.scaled(M.G.sphere, 0.035), M.glowMat('#ffd040'), 0.17, 0.06, 0.12 * s));
  }
  g.add(head);
  const leg = (x, z) => {
    const h = new THREE.Group();
    h.position.set(x, 0.85, z);
    h.add(M.mesh(M.tube([[0, 0.05, 0], [0.06, -0.4, 0], [0.02, -0.82, 0]], 0.12, 0.07, 4, 7), fur));
    h.add(M.mesh(M.scaled(M.G.sphere, 0.09, 0.05, 0.08), dark, 0.07, -0.84, 0));
    g.add(h);
    return h;
  };
  const legs = [leg(0.45, 0.22), leg(0.45, -0.22), leg(-0.5, 0.22), leg(-0.5, -0.22)];
  const tail = new THREE.Group();
  tail.position.set(-0.7, 1.0, 0);
  tail.add(M.mesh(M.tube([[0, 0, 0], [-0.3, -0.05, 0], [-0.55, -0.25, 0]], 0.13, 0.05, 6, 7), fur));
  g.add(tail);
  return { head, legs, tail };
}

// The WC3 Raider: an orc on a great wolf, a team-coloured shoulder cloth and
// banner pole, a bola net ready to throw (Ensnare).
function raiderModel(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const w = wolf(body);
  const team = M.mat(color, { roughness: 0.6, emissive: color, emissiveIntensity: 0.1 });
  const leather = M.leatherMat();
  // Saddle.
  body.add(M.mesh(M.blob(0.32, 0.08, 0.38, { seed: 64, amt: 0.04, detail: 1 }), team, 0.1, 1.27, 0));
  // Rider.
  const rider = new THREE.Group();
  rider.position.set(0.1, 1.3, 0);
  rider.add(M.mesh(M.lathe([[0.001, 0], [0.2, 0.02], [0.24, 0.25], [0.26, 0.45], [0.18, 0.55], [0.001, 0.56]], 10), leather));
  rider.add(M.mesh(M.scaled(M.G.sphere, 0.16, 0.15, 0.16), greenSkin(), 0.08, 0.68, 0));
  rider.add(M.mesh(M.scaled(M.G.box, 0.1, 0.06, 0.18), greenSkin(), 0.2, 0.6, 0));
  for (const s of [1, -1]) {
    rider.add(M.mesh(M.tube([[0.2, 0.58, 0.07 * s], [0.25, 0.68, 0.09 * s]], 0.022, 0.008, 2, 4), M.boneMat()));
    rider.add(M.mesh(M.blob(0.16, 0.1, 0.14, { seed: 65, detail: 1 }), team, 0, 0.5, 0.24 * s));
    rider.add(M.mesh(M.tube([[0, 0.12, 0.2 * s], [0.08, 0.0, 0.26 * s], [0.2, -0.12, 0.2 * s]], 0.06, 0.05, 3, 5), leather, 0, 0, 0));
  }
  rider.add(M.mesh(M.tube([[-0.05, 0.75, 0], [-0.12, 0.85, 0], [-0.25, 0.9, 0]], 0.05, 0.03, 4, 5), M.mat('#1a1410')));
  body.add(rider);
  // Banner pole on the back.
  body.add(M.mesh(M.tube([[-0.15, 1.4, -0.15], [-0.2, 2.0, -0.15], [-0.22, 2.4, -0.15]], 0.02, 0.02, 2, 4), M.mat('#4a3020')));
  const flag = M.mesh(M.cloth(0.25, 0.4, 0.02, 0.1), M.mat(color, { roughness: 0.7, side: THREE.DoubleSide }), -0.33, 2.2, -0.15);
  body.add(flag);
  // Throwing arm with the net.
  const arm = new THREE.Group();
  arm.position.set(0.12, 1.75, -0.24);
  arm.add(M.mesh(M.tube([[0, 0, 0], [0.12, -0.15, -0.05], [0.25, -0.2, -0.05]], 0.06, 0.05, 3, 5), greenSkin()));
  arm.add(M.mesh(M.blob(0.12, 0.12, 0.12, { seed: 66, amt: 0.25, detail: 1 }), M.mat('#b8a070', { roughness: 0.9 }), 0.3, -0.2, -0.05));
  body.add(arm);
  // Ensnared: a net over the whole raider.
  const net = M.mesh(M.blob(0.95, 0.75, 0.6, { seed: 67, amt: 0.1, detail: 1 }), M.mat('#c8b080', { wireframe: true }), 0.1, 1.0, 0);
  net.visible = false;
  body.add(net);
  body.scale.setScalar(0.9);
  g.userData = {
    body,
    legL: w.legs[0],
    legR: w.legs[1],
    staff: arm,
    anim: [w.legs[2], w.legs[3], w.tail, w.head, net, flag],
    kind: 'hero',
    tick(dt, v, b, world) {
      w.legs[2].rotation.z = w.legs[1].rotation.z;
      w.legs[3].rotation.z = w.legs[0].rotation.z;
      const t = world.time + v.id;
      w.tail.rotation.y = Math.sin(t * (b.mv ? 10 : 3)) * 0.3;
      w.head.rotation.z = b.mv ? Math.sin(t * 12) * 0.06 : Math.sin(t * 1.3) * 0.04;
      flag.rotation.y = b.mv ? 0.5 : Math.sin(t * 2) * 0.1;
      const snared = b.fx?.includes('snared');
      net.visible = !!snared;
      if (snared) net.rotation.y = Math.sin(t * 8) * 0.05;
    },
  };
  return g;
}
registerSkin('raider', raiderModel);

// ------------------------------------------------------------ zeppelin

// The Goblin Zeppelin: a striped gas bag in the owner's colour over a
// wooden gondola with a goblin pilot and a spinning rear prop.
function zeppelinModel(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const bag = M.mat(color, { roughness: 0.55 });
  const cloth = M.mat('#d8c8a0', { roughness: 0.8 });
  const wood = M.texMat('tex_wood.webp', '#7a5230', '#ffffff');
  const envelope = M.lathe([[0.001, -1.3], [0.35, -1.15], [0.55, -0.7], [0.62, 0], [0.55, 0.7], [0.35, 1.1], [0.001, 1.25]], 14);
  envelope.rotateZ(-Math.PI / 2);
  body.add(M.mesh(envelope, bag, 0, 1.2, 0));
  for (const x of [-0.6, 0, 0.6]) body.add(M.mesh(new THREE.TorusGeometry(Math.cos(x * 0.9) * 0.6 + 0.02, 0.035, 5, 18).rotateY(Math.PI / 2), cloth, x, 1.2, 0));
  // Fins.
  for (const [ry, rx] of [[0, 0], [0, Math.PI / 2]]) {
    const fin = M.mesh(M.scaled(M.G.box, 0.45, 0.7, 0.04), cloth, -1.15, 1.2, 0);
    fin.rotation.x = rx + ry;
    body.add(fin);
  }
  // Ropes and gondola.
  for (const [x, z] of [[0.4, 0.2], [0.4, -0.2], [-0.4, 0.2], [-0.4, -0.2]]) body.add(M.mesh(M.tube([[x, 0.65, z], [x, 0.25, z]], 0.012, 0.012, 1, 3), M.mat('#3a3020')));
  body.add(M.mesh(M.scaled(M.G.box, 1.0, 0.25, 0.45), wood, 0, 0.12, 0));
  body.add(M.mesh(M.scaled(M.G.box, 1.05, 0.05, 0.5), brassMat(), 0, 0.26, 0));
  // Goblin pilot: green skin, big ears, goggles.
  body.add(M.mesh(M.scaled(M.G.sphere, 0.13), greenSkin(), 0.3, 0.42, 0));
  for (const s of [1, -1]) body.add(M.mesh(M.scaled(M.G.cone, 0.05, 0.22, 0.03).rotateX(Math.PI / 2 * s), greenSkin(), 0.28, 0.45, 0.15 * s));
  body.add(M.mesh(M.scaled(M.G.box, 0.05, 0.05, 0.18), M.glowMat('#ffe8a0'), 0.42, 0.45, 0));
  const prop = new THREE.Group();
  prop.position.set(-0.6, 0.15, 0);
  for (const s of [1, -1]) prop.add(M.mesh(M.scaled(M.G.box, 0.03, 0.45, 0.07), wood, 0, 0.22 * s, 0));
  body.add(M.mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8).rotateZ(Math.PI / 2), ironMat(), -0.5, 0.15, 0));
  body.add(prop);
  return { g, body, prop };
}

registerSkin('zeppelin', (color) => {
  const z = zeppelinModel(color);
  const shadow = blobShadow(1.3);
  z.g.add(shadow);
  z.g.userData = {
    body: z.body,
    anim: [z.prop, shadow],
    kind: 'hero',
    tick(dt, v, b, world) {
      z.prop.rotation.x += dt * 25;
      if (b.dead) return;
      // Ensnared zeppelins are dragged to the ground.
      const down = b.fx?.includes('snared');
      const want = down ? 0.3 : AIR;
      v.alt = v.alt == null ? want : v.alt + (want - v.alt) * Math.min(1, dt * 3);
      z.body.position.y = v.alt + Math.sin(world.time * 1.6 + v.id) * 0.08;
      z.body.rotation.x = Math.sin(world.time * 1.1 + v.id) * 0.03;
    },
  };
  return z.g;
});

// The zeppelins waiting on the pad (and those left there after unloading).
registerView('rrzep', {
  unit: true,
  bake: 'flat', // these wait on the pad in numbers; fold each part into one vertex-coloured mesh.
  make(e, world, v) {
    v.parked = !!e.p;
    const z = zeppelinModel(v.parked ? '#8a8a88' : world.colors[e.o] || '#cccccc');
    v.parts = z;
    z.g.add(blobShadow(1.3));
    z.g.userData = { body: z.body, prop: z.prop };
    return z.g;
  },
  update(v, a, b, k, dt, world) {
    const p = v.parts;
    if (v.parked !== !!b.p) {
      // Woken: swap in a model in the owner's colour. The initial model was
      // baked by the registry; this one is rebuilt at runtime, so bake it by hand.
      v.parked = !!b.p;
      const z = zeppelinModel(world.colors[b.o] || '#cccccc');
      z.g.userData = { body: z.body, prop: z.prop };
      bakeModel(z.g, { flat: true });
      v.obj.remove(p.body);
      v.obj.add(z.body);
      v.parts = z;
    }
    const want = b.sn ? 0.3 : v.parked ? 0.6 : AIR;
    v.alt = v.alt == null ? want : v.alt + (want - v.alt) * Math.min(1, dt * 3);
    v.parts.body.position.y = v.alt + (v.parked ? 0 : Math.sin(world.time * 1.6 + v.id) * 0.08);
    if (!v.parked) v.parts.prop.rotation.x += dt * 25;
  },
});

// ------------------------------------------------------------ creatures

// Druid of the Claw, bear form: a huge brown bear with a pale muzzle.
function bearModel() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const fur = M.triMat('tex_fur.webp', '#5a3e28', '#b88a60', 1.6);
  const muzzle = M.mat('#c8a880', { roughness: 0.8 });
  const B = (sx, sy, sz, seed) => M.blob(sx, sy, sz, { seed, amt: 0.1, detail: 2 });
  body.add(M.mesh(B(0.95, 0.7, 0.65, 71), fur, 0, 1.15, 0));
  body.add(M.mesh(B(0.55, 0.6, 0.6, 72), fur, 0.5, 1.45, 0));
  const head = new THREE.Group();
  head.position.set(1.05, 1.45, 0);
  head.add(M.mesh(B(0.38, 0.34, 0.36, 73), fur));
  head.add(M.mesh(B(0.22, 0.16, 0.18, 74), muzzle, 0.32, -0.1, 0));
  head.add(M.mesh(M.scaled(M.G.sphere, 0.06), M.mat('#140c08'), 0.52, -0.05, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.scaled(M.G.sphere, 0.1, 0.1, 0.05), fur, -0.05, 0.3, 0.25 * s));
    head.add(M.mesh(M.scaled(M.G.sphere, 0.04), M.glowMat('#ffb040'), 0.27, 0.1, 0.17 * s));
  }
  body.add(head);
  const legs = [];
  for (const [x, z] of [[0.55, 0.38], [0.55, -0.38], [-0.55, 0.38], [-0.55, -0.38]]) {
    const h = new THREE.Group();
    h.position.set(x, 0.95, z);
    h.add(M.mesh(M.tube([[0, 0.1, 0], [0.05, -0.45, 0], [0.05, -0.9, 0]], 0.26, 0.2, 4, 8), fur));
    h.add(M.mesh(M.blob(0.22, 0.09, 0.2, { seed: 75, detail: 1 }), M.mat('#2a1c10'), 0.12, -0.92, 0));
    body.add(h);
    legs.push(h);
  }
  body.scale.setScalar(0.85);
  return { g, body, head, legs };
}

// A hippogryph: an eagle's head and wings on a deer-brown body.
function hippoModel() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const hide = M.triMat('tex_fur.webp', '#8a6040', '#e0b890', 1.8);
  const white = M.mat('#ecebe4', { roughness: 0.8 });
  const beak = M.mat('#e0a830', { roughness: 0.5 });
  body.add(M.mesh(M.blob(0.7, 0.32, 0.3, { seed: 81, amt: 0.08, detail: 2 }), hide, 0, 0, 0));
  body.add(M.mesh(M.blob(0.3, 0.32, 0.28, { seed: 82, amt: 0.06, detail: 2 }), white, 0.55, 0.15, 0));
  body.add(M.mesh(M.scaled(M.G.cone, 0.08, 0.28, 0.07).rotateZ(-Math.PI / 2 - 0.4), beak, 0.95, 0.2, 0));
  body.add(M.mesh(M.scaled(M.G.sphere, 0.17), white, 0.78, 0.32, 0));
  for (const s of [1, -1]) body.add(M.mesh(M.scaled(M.G.sphere, 0.03), M.mat('#140c08'), 0.88, 0.38, 0.1 * s));
  const wings = [];
  for (const s of [1, -1]) {
    const w = new THREE.Group();
    w.position.set(0.15, 0.2, 0.2 * s);
    const sh = new THREE.Shape();
    sh.moveTo(0.3, 0);
    sh.quadraticCurveTo(0.2, 0.9, -0.5, 1.6);
    sh.lineTo(-0.55, 1.2);
    sh.lineTo(-0.6, 0.8);
    sh.lineTo(-0.5, 0.35);
    sh.lineTo(-0.3, 0);
    const geo = new THREE.ShapeGeometry(sh, 6);
    geo.rotateX((Math.PI / 2) * s);
    w.add(M.mesh(geo, M.mat('#f4f0e6', { roughness: 0.8, side: THREE.DoubleSide })));
    body.add(w);
    wings.push(w);
  }
  for (const [x, z] of [[0.35, 0.12], [0.35, -0.12], [-0.4, 0.12], [-0.4, -0.12]]) body.add(M.mesh(M.tube([[x, -0.15, z], [x - 0.1, -0.45, z], [x - 0.25, -0.6, z]], 0.06, 0.035, 3, 5), x > 0 ? beak : hide));
  body.add(M.mesh(M.tube([[-0.65, 0.05, 0], [-0.9, 0.0, 0], [-1.1, 0.1, 0]], 0.05, 0.02, 4, 5), hide));
  body.scale.setScalar(1.1);
  const shadow = blobShadow(0.9);
  g.add(shadow);
  return { g, body, wings };
}

function mobView(build, { air = false } = {}) {
  return {
    unit: true,
    bake: 'flat', // these spawn in numbers; fold each part into one vertex-coloured mesh.
    make(e, world, v) {
      const m = build();
      v.parts = m;
      if (!air) {
        const net = M.mesh(M.blob(1.0, 0.9, 0.7, { seed: 68, amt: 0.1, detail: 1 }), M.mat('#c8b080', { wireframe: true }), 0, 1.0, 0);
        net.visible = false;
        m.g.add(net);
        m.net = net;
      }
      // Kept whole by bakeModel: everything update() moves or toggles.
      m.g.userData = { ...m };
      return m.g;
    },
    update(v, a, b, k, dt, world) {
      const p = v.parts;
      const moving = b.mv && !b.dead && !b.sn;
      v.walk = (v.walk || 0) + dt * (moving ? 10 : 0);
      const sw = b.sw ?? -1;
      const strike = sw >= 0 ? Math.sin(Math.min(1, sw) * Math.PI) : 0;
      if (air) {
        const want = b.sn ? 0.5 : AIR;
        v.alt = v.alt == null ? want : v.alt + (want - v.alt) * Math.min(1, dt * 3);
        p.body.position.y = v.alt + Math.sin(world.time * 3 + v.id) * 0.12;
        const flap = b.sn ? 0.2 : Math.sin(world.time * (moving ? 10 : 6) + v.id) * 0.6;
        p.wings.forEach((w, i) => (w.rotation.x = (i ? -1 : 1) * flap));
        p.body.rotation.z = strike * -0.4;
      } else {
        p.legs.forEach((l, i) => (l.rotation.z = moving ? Math.sin(v.walk + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.45 : 0));
        p.body.position.y = moving ? Math.abs(Math.sin(v.walk)) * 0.06 : 0;
        // Rears up to maul.
        p.body.rotation.z = strike * 0.5;
        p.head.rotation.z = -strike * 0.3;
        p.net.visible = !!b.sn;
      }
      if (b.dead) {
        v.deadT = (v.deadT || 0) + dt;
        p.body.rotation.x = Math.min(Math.PI / 2, v.deadT * 3);
      }
    },
  };
}
registerView('bear', mobView(bearModel));
registerView('hippo', mobView(hippoModel, { air: true }));

// The bola net in flight.
registerView('rrnet', {
  make() {
    const g = new THREE.Group();
    g.add(M.mesh(M.blob(0.25, 0.25, 0.25, { seed: 69, amt: 0.2, detail: 1 }), M.mat('#c8b080', { wireframe: true })));
    g.add(M.mesh(M.scaled(M.G.sphere, 0.07), M.mat('#6a6a6a'), 0.25, 0, 0));
    return g;
  },
  update(v, a, b, k, dt) {
    v.obj.position.y = 1.4;
    v.obj.rotation.x += dt * 14;
  },
});

registerEvent('rrsnare', (e, world) => {
  world.fx.burst(e.x, 1, e.y, '#d8c090', { n: 16, speed: 3, size: 0.4, life: 0.5, additive: false });
  world.fx.ring(e.x, e.y, 1.2, '#d8c090', 0.4);
});
registerEvent('rrwake', (e, world) => {
  world.fx.burst(e.x, 1.2, e.y, world.colors[e.o] || '#ffffff', { n: 30, speed: 3, size: 0.6, life: 0.7 });
  world.fx.ring(e.x, e.y, 1.6, world.colors[e.o] || '#ffffff', 0.6);
});
registerEvent('rrdrop', (e, world) => {
  world.fx.dustCloud(e.x, e.y, 1, '#9a8266', 8);
});
registerEvent('rrcrash', (e, world) => {
  world.fx.explosion(e.x, e.y, 1.8);
  world.fx.debrisBurst(e.x, e.y, 12, 6);
  world.shake = Math.max(world.shake || 0, 0.3);
});

// ------------------------------------------------------------ course

registerMapBuilder('raider', (map, world) => {
  const cells = map.grid;
  const T = map.T;
  const solid = (ch) => ch === '#';
  const mat = cliffMaterial({ top: 'tex_grass.webp', topTint: '#b0c098', rockTint: '#aaa294' });
  world.mapGroup.add(cliffField({ cells, T, solid, H: 1.5, ramp: 0.45, margin: 6, res: 0.3, material: mat }));
  // Wall-top doodads and the landing deck: static scenery, merged per material.
  const deco = new THREE.Group();
  dressWalls(deco, { cells, T, solid, H: 1.5, density: 0.3, trees: 0.2, seed: 14 });
  // The Finish: a Circle of Power on the Island.
  const [fx, fy] = map.finish;
  const c = circleOfPower('#ffd700', T * 0.85);
  c.position.set(fx, 0, fy);
  world.mapGroup.add(c);
  // The zeppelin pad: a wooden landing deck.
  const rows = cells.length;
  const cols = cells[0].length;
  const wood = M.texMat('tex_wood.webp', '#7a5230', '#e8d8c8');
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      if (cells[r][col] !== 'o') continue; // 'o': the pad; 'p' is the air-only middle platform
      const x = (col + 0.5) * T - (cols * T) / 2;
      const z = (r + 0.5) * T - (rows * T) / 2;
      const deck = M.mesh(M.scaled(M.G.box, T * 0.96, 0.08, T * 0.96), wood, x, 0.03, z);
      deck.castShadow = false;
      deco.add(deck);
    }
  }
  bakeStatic(deco);
  world.mapGroup.add(deco);
});
