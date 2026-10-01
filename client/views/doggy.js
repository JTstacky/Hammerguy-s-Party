// Uther Party #40 Doggy Hell: a lava maze on scorched ground, the dogs (hero
// skin, with a stick in the jaws once they have one), the Meat Wagons on the
// walls and their lobbed corpses, the sticks and the Circle of Power.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerTheme, registerMapBuilder } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { skinTick, bakeView, bakeScenery, clothMat, fleshMat, blobShadow, groundGlow, itemSack, stick, lavaMaterial, now, emit, ownMat, disposeOwn } from './d-kit.js';
import { circleOfPower } from './sheep.js';

registerTheme('doggy',
  { sky: '#3a2420', fog: '#4a2c22', floor: ['#5a4a42', 40, {}], sun: '#ffe0c0', hemi: ['#ffd8b8', '#3a2018'], sunI: 2.2 },
  {
    floor: { tex: 'tex_dirt.webp', tint: '#a8948a', color: '#5a4a42', units: 6 },
    edge: { tex: 'tex_boulder.webp', tint: '#8a7a74', color: '#4a3c36', units: 4 },
    outer: { tex: 'tex_dirt.webp', tint: '#6a5a54', color: '#3a2e2a', units: 9 },
    edgeWidth: 1.2,
  });

registerMapBuilder('doggy', (map, world) => {
  const scen = new THREE.Group(); // static scenery, merged per material
  const lava = lavaMaterial();
  const crust = M.triMat('tex_boulder.webp', '#2a2220', '#6a5a56', 1.4);
  const embers = [];
  for (const [x0, x1, y0, y1] of map.lava) {
    const w = x1 - x0;
    const h = y1 - y0;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), lava);
    m.position.set((x0 + x1) / 2, 0.035, (y0 + y1) / 2);
    world.mapGroup.add(m);
    embers.push([x0, x1, y0, y1, w * h]);
    // A low basalt lip along each side of the channel.
    for (const [ax, az, bx, bz] of [[x0, y0, x1, y0], [x0, y1, x1, y1], [x0, y0, x0, y1], [x1, y0, x1, y1]]) {
      const len = Math.hypot(bx - ax, bz - az);
      const lip = M.mesh(new THREE.CylinderGeometry(0.1, 0.13, len, 6, 1).rotateZ(Math.PI / 2), crust, (ax + bx) / 2, 0.06, (az + bz) / 2);
      lip.rotation.y = -Math.atan2(bz - az, bx - ax);
      lip.castShadow = false;
      scen.add(lip);
    }
    // Lava glow on the ground round it.
    const glow = groundGlow(1, '#ff6a18', 0.25);
    glow.scale.set(w / 2 + 0.6, 1, h / 2 + 0.6);
    glow.position.set((x0 + x1) / 2, 0.02, (y0 + y1) / 2);
    world.mapGroup.add(glow);
  }
  // A few warm lights over the maze.
  for (const [x, z] of [[0, 0], [-7, -7], [7, -7], [-7, 7], [7, 7]]) {
    const l = new THREE.PointLight('#ff7a30', 9, 12, 1.6);
    l.position.set(x, 2, z);
    world.mapGroup.add(l);
  }
  // Volcanic rocks round the outside.
  const B = map.bounds;
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = B + 1 + Math.random() * 8;
    const rock = M.lavaRock(0.8 + Math.random() * 1.6);
    rock.position.set(Math.max(-B - 6, Math.min(B + 6, Math.cos(a) * r)), 0, Math.max(-B - 6, Math.min(B + 6, Math.sin(a) * r)));
    scen.add(rock);
  }
  world.mapGroup.add(bakeScenery(scen));
  const [sx0, sx1, sy0, sy1] = map.start;
  const cop = circleOfPower((sx1 - sx0) * 0.62, '#ffd060');
  cop.position.set((sx0 + sx1) / 2, 0, (sy0 + sy1) / 2);
  world.mapGroup.add(cop);
  // Shader clock plus rising embers and heat smoke.
  const total = embers.reduce((s, e) => s + e[4], 0);
  const clock = new THREE.Mesh(new THREE.PlaneGeometry(0.001, 0.001), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  clock.frustumCulled = false;
  const t0 = now();
  let last = t0;
  const acc = {};
  clock.onBeforeRender = () => {
    const t = now();
    const dt = Math.min(0.1, t - last);
    last = t;
    lava.uniforms.time.value = t - t0;
    for (let n = emit(acc, 'ember', 22, dt); n > 0; n--) {
      let pick = Math.random() * total;
      const e = embers.find((q) => (pick -= q[4]) <= 0) || embers[0];
      const x = e[0] + Math.random() * (e[1] - e[0]);
      const z = e[2] + Math.random() * (e[3] - e[2]);
      world.fx.trail(x, 0.2, z, Math.random() < 0.5 ? '#ff8a20' : '#ffc040', 0.25, 1.2, 0.1);
      if (Math.random() < 0.08) world.fx.smokePuff(x, 0.4, z, '#2a1c18', 0.9, 1.6, 0.3);
    }
  };
  world.mapGroup.add(clock);
});

// ------------------------------------------------------------ dog

function dog(color, carrying = false) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const fur = M.triMat('tex_fur.webp', '#6a4a30', '#ffffff', 2.2, { roughness: 0.85 });
  const dark = M.mat('#2a1c14', { roughness: 0.7 });
  body.add(M.mesh(M.blob(0.42, 0.2, 0.19, { seed: 41, amt: 0.08 }), fur, 0, 0.58, 0));
  body.add(M.mesh(M.blob(0.22, 0.22, 0.21, { seed: 42, amt: 0.08 }), fur, 0.28, 0.66, 0));
  const head = new THREE.Group();
  head.position.set(0.52, 0.85, 0);
  head.add(M.mesh(M.blob(0.15, 0.13, 0.13, { seed: 43 }), fur));
  head.add(M.mesh(M.blob(0.14, 0.07, 0.07, { seed: 44 }), fur, 0.16, -0.04, 0));
  head.add(M.mesh(M.scaled(M.G.sphere, 0.035), dark, 0.3, -0.02, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.scaled(M.G.cone, 0.05, 0.14, 0.035), fur, -0.04, 0.15, 0.08 * s));
    head.add(M.mesh(M.scaled(M.G.sphere, 0.022), M.mat('#140c08', { roughness: 0.2 }), 0.12, 0.04, 0.07 * s));
  }
  if (carrying) {
    const st = stick(0.75);
    st.rotation.y = Math.PI / 2;
    st.position.set(0.26, -0.07, 0);
    head.add(st);
  }
  body.add(head);
  body.add(M.mesh(new THREE.TorusGeometry(0.13, 0.028, 6, 16).rotateY(Math.PI / 2), clothMat(color), 0.4, 0.74, 0));
  const tail = new THREE.Group();
  tail.position.set(-0.38, 0.62, 0);
  tail.add(M.mesh(M.tube([[0, 0, 0], [-0.17, 0.16, 0], [-0.24, 0.33, 0]], 0.05, 0.02, 8, 6), fur));
  body.add(tail);
  const legAt = (x, s) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.5, 0.11 * s);
    hip.add(M.mesh(M.tube([[0, 0.05, 0], [0.02, -0.2, 0], [0, -0.44, 0]], 0.05, 0.035, 4, 6), fur));
    hip.add(M.mesh(M.scaled(M.G.sphere, 0.045, 0.03, 0.045), dark, 0.03, -0.46, 0));
    body.add(hip);
    return hip;
  };
  const legL = legAt(0.26, 1);
  const legR = legAt(0.26, -1);
  const backL = legAt(-0.26, 1);
  const backR = legAt(-0.26, -1);
  body.scale.setScalar(1.45);
  Object.assign(g.userData, { body, legL, legR, kind: 'hero' });
  skinTick(g, [backL, backR, tail], (t) => {
    backL.rotation.z = legR.rotation.z;
    backR.rotation.z = legL.rotation.z;
    tail.rotation.x = Math.sin(t * 9) * 0.25;
  });
  return g;
}

registerSkin('dog', (c) => dog(c, false));
registerSkin('dogstick', (c) => dog(c, true));

// ------------------------------------------------------------ meat wagon

function meatWagon() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  g.add(blobShadow(1.4, 0.4));
  const wood = M.texMat('tex_wood.webp', '#3a3a34', '#9aa098', 1);
  const bone = M.boneMat();
  const iron = M.mat('#2a2a2c', { metalness: 0.6, roughness: 0.45 });
  const flesh = fleshMat('#c0a098');
  const beam = (a, b, r = 0.07) => M.mesh(M.tube([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], b], r, r, 2, 6), wood);
  for (const z of [0.42, -0.42]) {
    body.add(beam([-0.9, 0.55, z], [0.9, 0.55, z], 0.09));
    body.add(beam([-0.5, 0.55, z], [-0.35, 1.3, z * 0.8], 0.07));
    body.add(beam([0.2, 0.55, z], [-0.35, 1.3, z * 0.8], 0.06));
  }
  body.add(M.mesh(M.scaled(M.G.box, 1.6, 0.08, 0.84), wood, 0, 0.62, 0));
  // Ribcage sides and a spine along the top.
  for (let i = 0; i < 5; i++) {
    for (const s of [1, -1]) body.add(M.mesh(M.tube([[-0.7 + i * 0.3, 0.62, 0.42 * s], [-0.7 + i * 0.3, 0.9, 0.5 * s], [-0.72 + i * 0.3, 1.05, 0.34 * s]], 0.03, 0.018, 8, 5), bone));
  }
  // Bone-spoked wheels.
  for (const [x, z] of [[0.62, 0.55], [0.62, -0.55], [-0.62, 0.55], [-0.62, -0.55]]) {
    const w = new THREE.Group();
    w.position.set(x, 0.36, z);
    w.add(M.mesh(new THREE.TorusGeometry(0.31, 0.055, 8, 24), iron));
    for (let i = 0; i < 5; i++) {
      const sp = M.mesh(M.scaled(M.G.cyl, 0.025, 0.58, 0.025), bone);
      sp.rotation.z = (i / 5) * Math.PI;
      w.add(sp);
    }
    w.add(M.mesh(M.scaled(M.G.sphere, 0.09), bone));
    body.add(w);
  }
  // A heap of corpses in the back.
  for (let i = 0; i < 5; i++) body.add(M.mesh(M.blob(0.2, 0.12, 0.16, { seed: 50 + i }), flesh, -0.55 + Math.random() * 0.3, 0.75 + Math.random() * 0.1, (Math.random() - 0.5) * 0.5));
  body.add(M.mesh(M.blob(0.12, 0.12, 0.12, { seed: 58 }), bone, -0.45, 0.9, 0.1));
  // The throwing arm with its gut-bucket.
  const arm = new THREE.Group();
  arm.position.set(-0.35, 1.25, 0);
  arm.add(M.mesh(M.tube([[-0.45, 0, 0], [0.4, 0.02, 0], [1.0, 0.05, 0]], 0.065, 0.05, 4, 8), wood));
  arm.add(M.mesh(M.lathe([[0.01, -0.12], [0.2, -0.1], [0.25, 0.05], [0.23, 0.1]], 14), iron, 1.0, 0.08, 0));
  arm.add(M.mesh(M.blob(0.18, 0.14, 0.16, { seed: 60 }), flesh, 1.0, 0.2, 0));
  arm.add(M.mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 10).rotateX(Math.PI / 2), iron));
  arm.rotation.z = -0.5;
  body.add(arm);
  // Chains and a hook dangling at the front.
  for (let i = 0; i < 4; i++) {
    const l = M.mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 10), iron, 0.9, 0.5 - i * 0.07, 0.3);
    l.rotation.y = i % 2 ? Math.PI / 2 : 0;
    body.add(l);
  }
  body.scale.setScalar(1.1);
  g.userData = { body, arm };
  return g;
}

registerView('meatwagon', {
  make(e, world, v) {
    const o = bakeView(meatWagon());
    v.parts = o.userData;
    return o;
  },
  update(v, a, b, k, dt, world) {
    if (b.fire && !v.fired) v.windT = 0;
    v.fired = !!b.fire;
    // Winch back over the 0.7 s wind-up, then fling.
    if (v.windT != null) {
      v.windT += dt;
      const t = v.windT;
      v.parts.arm.rotation.z = t < 0.7 ? -0.5 - t * 0.5 : -0.85 + Math.min(1, (t - 0.7) * 8) * 2.2 - Math.max(0, t - 0.9) * 1.8;
      if (t > 1.6) {
        v.windT = null;
        v.parts.arm.rotation.z = -0.5;
      }
    }
    if (emit(v, 'fly', 1.5, dt)) world.fx.trail(v.x - Math.cos(v.f) * 0.6, 1.2, v.z - Math.sin(v.f) * 0.6, '#6a8a40', 0.2, 1.2, 0.3);
  },
});

// A lobbed corpse, flying from the wagon to its fixed spot.
registerView('dogshell', {
  make(e, world, v) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2), ownMat(new THREE.MeshBasicMaterial({ color: '#ff5030', transparent: true, opacity: 0, depthWrite: false })));
    ring.scale.setScalar(e.r);
    ring.position.y = 0.07;
    const shadow = blobShadow(e.r * 0.7, 0, true);
    g.add(shadow, ring);
    const corpse = new THREE.Group();
    corpse.add(M.mesh(M.blob(0.22, 0.16, 0.18, { seed: 70 }), fleshMat('#c8a8a0')));
    corpse.add(M.mesh(M.tube([[0, 0, 0], [0.2, 0.12, 0.05], [0.32, 0.1, 0.1]], 0.04, 0.03, 4, 5), M.boneMat()));
    world.entGroup.add(corpse);
    v.parts = { ring, shadow, corpse };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    const t = Math.min(1, Math.max(0, lerpK(a.t ?? 0, b.t ?? 0, k)));
    P.ring.material.opacity = 0.5 * Math.min(1, t * 1.6);
    P.shadow.material.opacity = 0.45 * t * t;
    const sx = b.sx;
    const sz = b.sy;
    const d = Math.hypot(v.x - sx, v.z - sz);
    const apex = Math.max(2.5, d * 0.35);
    const y = 1.4 * (1 - t) + 4 * t * (1 - t) * apex + 0.3 * t;
    P.corpse.visible = v.obj.visible;
    P.corpse.position.set(sx + (v.x - sx) * t, y, sz + (v.z - sz) * t);
    P.corpse.rotation.set(t * 8, t * 5, 0);
    v.obj.rotation.y = 0;
    if (emit(v, 'blood', 20, dt)) world.fx.trail(P.corpse.position.x, y, P.corpse.position.z, '#7a1010', 0.3, 0.4, 0.1);
  },
  remove(v, world) {
    world.entGroup.remove(v.parts.corpse);
    disposeOwn(v.obj);
  },
});

function lerpK(a, b, k) {
  return a + (b - a) * k;
}

registerEvent('dogshell', (e, world) => {
  const fx = world.fx;
  fx.burst(e.x, 0.5, e.y, '#8a1a10', { n: 26, speed: 4.5, size: 0.5, life: 0.7, up: 1.2, grav: 10, additive: false });
  fx.burst(e.x, 0.5, e.y, '#8ab040', { n: 12, speed: 3.5, size: 0.4, life: 0.6, up: 1, grav: 8, additive: false });
  fx.dustCloud(e.x, e.y, e.r * 0.6, '#6a5a50', 8);
  fx.debrisBurst(e.x, e.y, 5, 4);
  fx.scorch(e.x, e.y, e.r * 0.6, 4);
  play('squish');
});

registerEvent('dogfast', (e, world) => {
  play('kodo');
});

// A stick on the ground: the generic item sack with the branch poking out.
registerView('stick', {
  make(e, world, v) {
    const st = stick(0.8);
    st.rotation.z = 1.1;
    st.position.set(0.05, 0.62, 0.05);
    const o = bakeView(itemSack(st));
    v.parts = o.userData;
    return o;
  },
  update(v, a, b, k, dt, world) {
    v.parts.ring.material.opacity = 0.25 + Math.sin(world.time * 3 + v.id) * 0.1;
  },
  remove(v) {
    disposeOwn(v.obj);
  },
});
