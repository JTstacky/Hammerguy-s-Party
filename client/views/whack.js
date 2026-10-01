// Whack-a-Fiend (#23): crypt fiends that burrow and surface, Storm Bolt's
// hurled hammer, Thunder Clap, stuns and the level-up flash.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';

// A low-poly sphere for a skin's small parts (eyes, studs, knuckles).
const LOW_SPHERE = new THREE.SphereGeometry(1, 10, 8);

// The Mountain King (`Hmkg`), the player unit: a broad, short dwarf in plate
// with huge round pauldrons, a horned helm over a bushy auburn beard with two
// gold-ringed braids, and a stone-headed war hammer in his right hand. Team
// colour on the tabard, the kilt and the armbands. Faces +X.
export function mountainKing(color) {
  const { mesh, blob, tube, lathe, cloth, mat, G, scaled } = M;
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(1.5);
  g.add(body);
  const steel = M.plateMat();
  const gold = M.goldMat();
  const mail = mat('#80848e', { metalness: 0.6, roughness: 0.5 });
  const skin = mat('#f2bc94', { roughness: 0.65 });
  const beard = mat('#c8642e', { roughness: 0.9 });
  const horn = M.boneMat();
  const leather = M.leatherMat('#b08058');
  const team = mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  const eye = mat('#18202a', { roughness: 0.3 });
  const wood = M.texMat('tex_wood.webp', '#5a3a20', '#c49a60');
  const stone = M.triMat('tex_boulder.webp', '#8a8680', '#d0ccc4', 3);

  // Short, thick legs in mail with gold knee cops and big boots.
  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(0, 0.42, 0.14 * s);
    hip.add(mesh(tube([[0, 0, 0], [0.03, -0.16, 0.01 * s], [0.02, -0.3, 0]], 0.11, 0.1, 5, 10), mail));
    hip.add(mesh(scaled(LOW_SPHERE, 0.07, 0.065, 0.07), gold, 0.08, -0.15, 0));
    hip.add(mesh(blob(0.17, 0.08, 0.11, { seed: 70 + s, amt: 0.05, detail: 2 }), leather, 0.06, -0.36, 0));
    hip.add(mesh(new THREE.CylinderGeometry(0.105, 0.11, 0.08, 12), leather, 0.02, -0.28, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);

  // A barrel chest in plate, a mail kilt with a team tabard, a wide belt.
  const torso = mesh(lathe([[0.22, 0.44], [0.28, 0.54], [0.34, 0.68], [0.36, 0.82], [0.33, 0.95], [0.22, 1.03], [0.1, 1.06]], 24), steel);
  torso.scale.z = 1.25;
  const kilt = mesh(lathe([[0.27, 0.5], [0.3, 0.4], [0.33, 0.28]], 22), mail);
  kilt.scale.z = 1.25;
  const hemBand = mesh(new THREE.TorusGeometry(0.33, 0.025, 6, 26).rotateX(Math.PI / 2), team, 0, 0.29, 0);
  hemBand.scale.z = 1.25;
  const tabard = mesh(cloth(0.26, 0.42, 0.04, -0.03), team, 0.34, 0.3, 0);
  tabard.rotation.y = Math.PI;
  const tabBack = mesh(cloth(0.3, 0.46, 0.06, 0.08), team, -0.33, 0.3, 0);
  const belt = mesh(new THREE.TorusGeometry(0.29, 0.045, 8, 28).rotateX(Math.PI / 2), leather, 0, 0.51, 0);
  belt.scale.z = 1.25;
  const buckle = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 16).rotateZ(Math.PI / 2), gold, 0.3, 0.51, 0);
  // Pauldrons: great round shells with gold rims and a stud.
  const pauldron = (s) => {
    const p = new THREE.Group();
    p.position.set(-0.02, 0.98, 0.34 * s);
    p.rotation.x = 0.5 * s;
    p.add(mesh(new THREE.SphereGeometry(0.23, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.46), steel));
    p.add(mesh(new THREE.TorusGeometry(0.215, 0.024, 6, 24).rotateX(Math.PI / 2), gold, 0, 0.03, 0));
    p.add(mesh(scaled(LOW_SPHERE, 0.045), gold, 0, 0.23, 0));
    return p;
  };
  // Thick arms in mail with team armbands and steel gauntlets.
  const arm = (s, reach) => {
    const a = new THREE.Group();
    a.add(mesh(tube([[0, 0.94, 0.38 * s], [0.08 + reach * 0.06, 0.74, 0.44 * s], [0.18 + reach * 0.12, 0.58, 0.38 * s]], 0.1, 0.085, 8, 10), mail));
    a.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 12), team, 0.07 + reach * 0.05, 0.78, 0.43 * s));
    a.add(mesh(blob(0.1, 0.09, 0.09, { seed: 72 + s, detail: 2 }), steel, 0.2 + reach * 0.13, 0.54, 0.37 * s));
    return a;
  };
  // Head: a broad face, big nose, bushy brows, a beard down over the chest
  // with two gold-ringed braids, under a horned steel helm with a nasal.
  const head = new THREE.Group();
  head.position.set(0.12, 1.14, 0);
  head.scale.setScalar(1.1);
  head.add(mesh(scaled(LOW_SPHERE, 0.13, 0.13, 0.12), skin, 0.02, 0, 0));
  head.add(mesh(blob(0.05, 0.045, 0.045, { seed: 74, detail: 2 }), skin, 0.14, -0.01, 0));
  head.add(mesh(blob(0.15, 0.18, 0.16, { seed: 75, amt: 0.1, detail: 2 }), beard, 0.1, -0.22, 0));
  for (const s of [1, -1]) {
    head.add(mesh(scaled(LOW_SPHERE, 0.02), eye, 0.125, 0.04, 0.05 * s));
    head.add(mesh(tube([[0.13, 0.08, 0.02 * s], [0.14, 0.085, 0.06 * s], [0.12, 0.07, 0.09 * s]], 0.022, 0.012, 5, 6), beard));
    head.add(mesh(tube([[0.16, -0.04, 0.02 * s], [0.17, -0.06, 0.08 * s], [0.14, -0.12, 0.12 * s]], 0.028, 0.012, 6, 6), beard));
    head.add(mesh(tube([[0.18, -0.3, 0.06 * s], [0.22, -0.42, 0.07 * s], [0.22, -0.54, 0.06 * s]], 0.035, 0.02, 6, 6), beard));
    head.add(mesh(new THREE.TorusGeometry(0.03, 0.012, 5, 12).rotateX(Math.PI / 2), gold, 0.22, -0.46, 0.07 * s));
    head.add(mesh(tube([[0.0, 0.1, 0.14 * s], [0.02, 0.2, 0.26 * s], [0.08, 0.33, 0.3 * s], [0.16, 0.41, 0.26 * s]], 0.045, 0.008, 12, 8), horn));
  }
  head.add(mesh(lathe([[0.15, 0.03], [0.155, 0.09], [0.14, 0.16], [0.1, 0.21], [0.001, 0.235]], 22), steel));
  head.add(mesh(new THREE.TorusGeometry(0.152, 0.02, 6, 24).rotateX(Math.PI / 2), gold, 0, 0.04, 0));
  head.add(mesh(scaled(G.box, 0.03, 0.12, 0.035), gold, 0.155, 0.04, 0));
  const gorget = mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.08, 18), gold, 0, 1.04, 0);
  gorget.scale.z = 1.2;

  // The war hammer, upright in the right hand: a wooden haft wrapped in
  // leather, a stone head bound in gold. It is the "staff" the cast raises.
  const hammer = new THREE.Group();
  hammer.position.set(0.34, 0.54, -0.37);
  hammer.add(mesh(tube([[0, -0.36, 0], [0, 0.1, 0], [0, 0.56, 0]], 0.035, 0.03, 6, 8), wood));
  hammer.add(mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.2, 10), leather, 0, -0.02, 0));
  hammer.add(mesh(scaled(LOW_SPHERE, 0.05), gold, 0, -0.38, 0));
  hammer.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 14).rotateZ(Math.PI / 2), stone, 0, 0.62, 0));
  for (const x of [-0.13, 0.13]) hammer.add(mesh(new THREE.TorusGeometry(0.12, 0.022, 6, 18).rotateY(Math.PI / 2), gold, x, 0.62, 0));

  body.add(legL, legR, torso, kilt, hemBand, tabard, tabBack, belt, buckle, pauldron(1), pauldron(-1), arm(1, 0), arm(-1, 1), gorget, head, hammer);
  g.userData = { body, staff: hammer, legL, legR, kind: 'hero' };
  return g;
}

registerSkin('whack_mk', (color) => mountainKing(color));

// A Crypt Fiend: an undead spider-man. A bloated bone-plated abdomen behind,
// a hunched torso with a mandibled head and green eyes in front, four jointed
// spider legs and two scythe-like forelegs raised to strike. Faces +X.
export function cryptFiend() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const chitin = M.triMat('tex_hide.webp', '#3a3848', '#a098c0', 1.3, { roughness: 0.55 });
  const dark = M.triMat('tex_hide.webp', '#26242e', '#6a6480', 1.3, { roughness: 0.5 });
  const bone = M.boneMat();
  const eye = M.glowMat('#9dff6a');
  // Abdomen with ridged bone plates down the back.
  body.add(M.mesh(M.blob(0.62, 0.48, 0.52, { seed: 201, amt: 0.07 }), chitin, -0.55, 0.85, 0));
  for (let i = 0; i < 4; i++) {
    const p = M.mesh(M.blob(0.16, 0.06, 0.26 - i * 0.03, { seed: 202 + i }), bone, -0.25 - i * 0.24, 1.3 - i * 0.07 - (i > 1 ? (i - 1) * 0.08 : 0), 0);
    p.rotation.z = 0.3 + i * 0.25;
    body.add(p);
  }
  body.add(M.mesh(M.scaled(M.G.cone, 0.1, 0.35, 0.1), bone, -1.12, 0.72, 0).rotateZ(Math.PI / 2 + 0.4));
  // Hunched torso and head.
  const torso = new THREE.Group();
  torso.position.set(0.1, 0.9, 0);
  body.add(torso);
  torso.add(M.mesh(M.blob(0.3, 0.4, 0.34, { seed: 207 }), chitin, 0.1, 0.3, 0));
  torso.add(M.mesh(M.blob(0.22, 0.12, 0.3, { seed: 208 }), bone, 0.02, 0.62, 0));
  const head = new THREE.Group();
  head.position.set(0.38, 0.62, 0);
  torso.add(head);
  head.add(M.mesh(M.blob(0.2, 0.17, 0.18, { seed: 209 }), dark, 0, 0, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.scaled(M.G.sphere, 0.04), eye, 0.15, 0.06, 0.08 * s));
    head.add(M.mesh(M.scaled(M.G.sphere, 0.025), eye, 0.17, 0.1, 0.03 * s));
    head.add(M.mesh(M.tube([[0.12, -0.08, 0.08 * s], [0.26, -0.14, 0.1 * s], [0.34, -0.1, 0.03 * s]], 0.035, 0.008, 8, 6), bone));
  }
  // Scythe forelegs.
  const arms = [];
  for (const s of [1, -1]) {
    const a = new THREE.Group();
    a.position.set(0.25, 0.45, 0.25 * s);
    a.add(M.mesh(M.tube([[0, 0, 0], [0.2, 0.35, 0.12 * s], [0.5, 0.45, 0.14 * s]], 0.06, 0.045, 8, 8), chitin));
    a.add(M.mesh(M.tube([[0.5, 0.45, 0.14 * s], [0.72, 0.25, 0.12 * s], [0.8, -0.1, 0.08 * s]], 0.05, 0.005, 10, 8), bone));
    torso.add(a);
    arms.push(a);
  }
  // Four spider legs.
  const legs = [];
  [[0.0, 0.55, 1], [-0.45, 0.6, 1], [0.0, 0.55, -1], [-0.45, 0.6, -1]].forEach(([x, z0, s], i) => {
    const hip = new THREE.Group();
    hip.position.set(x - 0.2, 0.85, 0.3 * s);
    const back = i % 2 ? -0.25 : 0.15;
    hip.add(M.mesh(M.tube([[0, 0, 0], [back, 0.45, z0 * s], [back * 1.8, -0.1, (z0 + 0.35) * s], [back * 2.2, -0.85, (z0 + 0.45) * s]], 0.07, 0.015, 14, 8), dark));
    body.add(hip);
    legs.push(hip);
  });
  body.scale.setScalar(1.05);
  g.userData = { body, torso, arms, legs, head };
  return g;
}

registerView('whack_fiend', {
  make(e, world, v) {
    const g = cryptFiend();
    v.parts = g.userData;
    return g;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    const t = world.time + v.id;
    // Burrowing sinks the fiend into the ground over 1.45 s; surfacing raises it in 0.5 s.
    const st = b.t ?? 0;
    let y = 0;
    if (b.s === 'down') y = -1.9 * Math.min(1, Math.max(0, (st - 0.3) / 1.15));
    else if (b.s === 'rise') y = -1.9 * (1 - Math.min(1, st / 0.5));
    v.obj.position.y = y;
    if (b.s && Math.random() < dt * 25) world.fx.dustCloud(v.x + (Math.random() - 0.5), v.z + (Math.random() - 0.5), 0.35, '#6a5a40', 1);
    P.torso.rotation.z = Math.sin(t * 2.2) * 0.06;
    P.arms.forEach((arm, i) => (arm.rotation.z = Math.sin(t * 3 + i) * 0.15));
    P.legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 2 + i * 1.3) * 0.05));
  },
});

// Storm Bolt: a spinning stone hammer trailing blue sparks.
registerView('whack_bolt', {
  make(e, world, v) {
    const g = new THREE.Group();
    const h = M.warhammer();
    h.scale.setScalar(0.8);
    h.position.y = -0.3;
    const spin = new THREE.Group();
    spin.position.y = 1.3;
    spin.add(h);
    g.add(spin);
    v.parts = { spin };
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.parts.spin.rotation.z -= dt * 22;
    world.fx.trail(v.x, 1.3, v.z, '#9fd4ff', 0.6, 0.35, 0.2);
  },
});

// Stunned: little stars circling the head.
registerView('whack_stun', {
  make(e, world, v) {
    const g = new THREE.Group();
    const stars = [];
    for (let i = 0; i < 3; i++) {
      const s = M.mesh(new THREE.OctahedronGeometry(0.12, 0), M.glowMat('#ffe066'));
      g.add(s);
      stars.push(s);
    }
    v.parts = { stars };
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.obj.rotation.y = 0;
    v.parts.stars.forEach((s, i) => {
      const ang = world.time * 5 + (i * Math.PI * 2) / 3;
      s.position.set(Math.cos(ang) * 0.5, 2.9, Math.sin(ang) * 0.5);
      s.rotation.y += dt * 6;
    });
  },
});

registerEvent('whack_rise', (e, world) => {
  world.fx.dustCloud(e.x, e.y, 0.7, '#7a6448', 8);
  world.fx.debrisBurst(e.x, e.y, 5, 3);
});

// A fiend dies and bursts (the trigger makes them explode).
registerEvent('whack_pop', (e, world) => {
  world.fx.burst(e.x, 1, e.y, '#9dff6a', { n: 22, speed: 4, size: 0.5, life: 0.6 });
  world.fx.burst(e.x, 1, e.y, '#4a4458', { n: 14, speed: 5, size: 0.4, life: 0.8, additive: false, grav: 12 });
  world.fx.dustCloud(e.x, e.y, 0.6, '#5a5068', 5);
  world.fx.debrisBurst(e.x, e.y, 5, 4);
  play('squish');
});

registerEvent('whack_clap', (e, world) => {
  world.fx.shockwave(e.x, e.y, e.r, '#bfe0ff', 0.5);
  world.fx.ring(e.x, e.y, e.r, '#9fd4ff', 0.45);
  world.fx.dustCloud(e.x, e.y, 1.2, '#8a7a68', 14);
  world.fx.debrisBurst(e.x, e.y, 10, 5);
  world.fx.sparks(e.x, 0.5, e.y, 18, 7, '#bfe6ff');
  world.shake = 0.2;
  play('smack');
});

registerEvent('whack_bolthit', (e, world) => {
  world.fx.sparks(e.x, 1.2, e.y, 16, 5, '#bfe6ff');
  world.fx.glow(e.x, 1.2, e.y, '#9fd4ff', 2, 0.3);
  play('zap');
});

registerEvent('whack_boltfizz', (e, world) => world.fx.burst(e.x, 1.2, e.y, '#9fd4ff', { n: 8, speed: 2, size: 0.4, life: 0.3 }));

// Level 3: WC3's golden level-up flash.
registerEvent('whack_levelup', (e, world) => {
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 8, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  beam.position.set(e.x, 4, e.y);
  world.scene.add(beam);
  world.fx.transients.push({ obj: beam, t: 0, dur: 1.2, update: (k) => { beam.material.opacity = 0.5 * (1 - k); beam.scale.set(1 - k * 0.6, 1, 1 - k * 0.6); }, dispose: () => beam.geometry.dispose() });
  world.fx.burst(e.x, 1.5, e.y, '#ffd84a', { n: 40, speed: 4, size: 0.6, life: 0.9 });
  world.fx.ring(e.x, e.y, 1.6, '#ffd84a', 0.6);
});
