// Tides of Darkness (#44): the open sea, the two shipyards, human frigates
// (the players' look), orc destroyers, lobbed shells and sinkings.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerTheme, registerMapBuilder } from '../../engine/client/render/registry.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { play } from '../../engine/client/audio.js';

registerTheme(
  'tides_sea',
  { sky: '#6a8098', fog: '#7a90a8', floor: ['#2a5070', 20, {}], sun: '#fff0dc', hemi: ['#d8e8ff', '#20384a'], sunI: 2.3 },
  {
    floor: { tex: 'tex_dirt.webp', tint: '#c8b890', color: '#8a7a58', units: 7 },
    edge: { tex: 'tex_dirt.webp', tint: '#b0a080', color: '#7a6a48' },
    outer: { tex: 'tex_grass.webp', tint: '#a0a888', color: '#4a6a3a' },
    edgeWidth: 0.8,
  },
);

// ------------------------------------------------------------ water

// An animated sea: deep blue in the middle, turquoise over the shallows by
// the two docks, foam where it meets the shore, and moving glints.
export function seaMaterial({ shallows = [], land = [], hw = 20, hh = 20, deep = '#0e3552', mid = '#1f5c7c', shallow = '#3fa0a8' } = {}) {
  const sh = shallows.slice(0, 4).map((s) => new THREE.Vector3(s.x, s.y, s.r));
  while (sh.length < 4) sh.push(new THREE.Vector3(9999, 9999, 0));
  const ld = land.slice(0, 4).map((s) => new THREE.Vector3(s.x, s.y, s.r));
  while (ld.length < 4) ld.push(new THREE.Vector3(9999, 9999, 0));
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      time: { value: 0 },
      uSh: { value: sh },
      uLand: { value: ld },
      uHalf: { value: new THREE.Vector2(hw, hh) },
      cDeep: { value: new THREE.Color(deep) },
      cMid: { value: new THREE.Color(mid) },
      cShallow: { value: new THREE.Color(shallow) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float time; uniform vec3 uSh[4]; uniform vec3 uLand[4]; uniform vec2 uHalf;
      uniform vec3 cDeep, cMid, cShallow;
      varying vec3 vW;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * n(p); p *= 2.07; a *= 0.5; } return v; }
      void main() {
        vec2 p = vW.xz;
        float depth = 1.0;
        for (int i = 0; i < 4; i++) depth = min(depth, smoothstep(0.0, 1.0, (length(p - uSh[i].xy) - uSh[i].z * 0.55) / (uSh[i].z * 0.7)));
        float shore = 99.0;
        for (int i = 0; i < 4; i++) shore = min(shore, length(p - uLand[i].xy) - uLand[i].z);
        vec2 q = abs(p) - uHalf;
        float out_ = max(q.x, q.y);
        float w = fbm(p * 0.18 + vec2(time * 0.05, time * 0.03)) + 0.5 * fbm(p * 0.5 - vec2(time * 0.07, -time * 0.04));
        vec3 col = mix(cShallow, mix(cMid, cDeep, smoothstep(0.3, 1.0, depth)), smoothstep(0.0, 0.6, depth));
        col *= 0.8 + 0.35 * w;
        col = mix(col, cDeep * 0.7, smoothstep(0.0, 6.0, out_));
        float glint = smoothstep(0.78, 0.95, fbm(p * 0.9 + vec2(time * 0.15, time * 0.11)));
        col += glint * 0.25;
        float foam = smoothstep(1.2, 0.0, shore) * (0.55 + 0.45 * sin(time * 1.6 + shore * 5.0 + w * 4.0));
        col = mix(col, vec3(0.92, 0.96, 1.0), clamp(foam, 0.0, 1.0) * 0.8);
        float a = mix(0.62, 0.95, smoothstep(0.1, 0.8, depth));
        a = mix(a, 1.0, smoothstep(0.0, 4.0, out_));
        a *= smoothstep(-0.2, 0.3, shore);
        gl_FragColor = vec4(col, a);
      }`,
  });
}

// ------------------------------------------------------------ ships

// A human frigate: a lathed timber hull with a raised stern castle, two masts
// under billowing sails in the owner's colour, a row of cannon on each side
// and a figurehead. Faces +X.
export function frigate(color = '#2f6fd0', orc = false) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const wood = M.texMat('tex_wood.webp', orc ? '#3a2a20' : '#6a4a2c', orc ? '#8a6a58' : '#d8c0a0');
  const plank = M.texMat('tex_wood.webp', orc ? '#4a3626' : '#8a6a44', orc ? '#a08070' : '#f0dcc0', 2);
  const trim = orc ? M.mat('#5a2a1a', { metalness: 0.5, roughness: 0.5 }) : M.goldMat();
  const iron = M.mat('#2a2a2e', { metalness: 0.6, roughness: 0.45 });
  const sail = M.mat(orc ? '#8a2418' : '#f2eadc', { roughness: 0.9, side: THREE.DoubleSide });
  const team = M.mat(color, { roughness: 0.85, side: THREE.DoubleSide });
  // Hull: a lathe along X, flattened, with a keel below the waterline.
  const hull = M.mesh(M.lathe([[0.001, -1.7], [0.35, -1.45], [0.62, -0.9], [0.72, -0.2], [0.72, 0.6], [0.62, 1.25], [0.45, 1.55], [0.001, 1.6]], 20), wood);
  hull.rotation.z = -Math.PI / 2;
  hull.scale.set(1, 1, 0.62);
  hull.position.y = 0.05;
  body.add(hull);
  const deck = M.mesh(new THREE.CylinderGeometry(1, 1, 0.08, 20), plank, 0, 0.42, 0);
  deck.scale.set(1.55, 1, 0.52);
  body.add(deck);
  // Gunwales and stern castle.
  for (const s of [1, -1]) {
    body.add(M.mesh(M.tube([[1.45, 0.52, 0.12 * s], [0.6, 0.55, 0.47 * s], [-0.6, 0.58, 0.47 * s], [-1.35, 0.62, 0.3 * s]], 0.05, 0.05, 16, 6), trim));
    for (let i = -1; i <= 1; i++) {
      const gun = M.mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.35, 10).rotateX(Math.PI / 2), iron, i * 0.45, 0.38, 0.45 * s);
      body.add(gun);
    }
  }
  const castle = M.mesh(M.blob(0.45, 0.28, 0.42, { seed: 301, amt: 0.02 }), plank, -1.05, 0.7, 0);
  body.add(castle);
  body.add(M.mesh(M.tube([[-1.4, 0.9, 0.35], [-1.4, 0.95, 0], [-1.4, 0.9, -0.35]], 0.04, 0.04, 6, 6), trim));
  // Masts, yards and sails.
  const sails = [];
  for (const [x, h, w] of [[0.55, 2.6, 1.0], [-0.35, 2.9, 1.2]]) {
    body.add(M.mesh(M.tube([[x, 0.4, 0], [x, h * 0.5, 0], [x, h, 0]], 0.06, 0.04, 6, 8), wood));
    body.add(M.mesh(M.tube([[x, h - 0.2, -w * 0.55], [x + 0.02, h - 0.18, 0], [x, h - 0.2, w * 0.55]], 0.03, 0.03, 6, 6), wood));
    const s = M.mesh(M.cloth(w, h * 0.5, 0.18, -0.12), orc ? sail : sail, x + 0.05, h * 0.68 - 0.05, 0);
    body.add(s);
    sails.push(s);
    // A band of the owner's colour across the sail (a black stripe for the Horde).
    const band = M.mesh(M.cloth(w * 1.01, h * 0.12, 0.18, -0.05), orc ? M.mat('#1a1414', { side: THREE.DoubleSide }) : team, x + 0.07, h * 0.72, 0);
    body.add(band);
  }
  // Pennant, figurehead / ram.
  const pennant = M.mesh(M.cloth(0.5, 0.18, 0.02, 0.1), orc ? M.mat('#d8c060', { side: THREE.DoubleSide }) : team, -0.6, 3.0, 0);
  pennant.rotation.y = Math.PI / 2;
  body.add(pennant);
  if (orc) {
    for (let i = 0; i < 3; i++) {
      const sp = M.mesh(M.scaled(M.G.cone, 0.08, 0.5, 0.08), M.boneMat(), 1.55 - i * 0.12, 0.35 + i * 0.12, 0);
      sp.rotation.z = -Math.PI / 2 + 0.3 - i * 0.25;
      body.add(sp);
    }
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) body.add(M.mesh(M.scaled(M.G.cone, 0.05, 0.3, 0.05), M.boneMat(), -0.8 + i * 0.6, 0.72, 0.48 * s).rotateX(-0.6 * s));
  } else {
    body.add(M.mesh(M.tube([[1.5, 0.45, 0], [1.85, 0.7, 0], [2.05, 0.95, 0]], 0.05, 0.02, 8, 6), wood));
    body.add(M.mesh(M.blob(0.12, 0.16, 0.09, { seed: 302 }), trim, 1.62, 0.6, 0));
  }
  body.scale.setScalar(1.05);
  g.userData = { body, sails, kind: 'ship' };
  return g;
}

registerSkin('tides_frigate', (color) => frigate(color, false));

// Ships rock on the swell; heroes get this from their skin's body bob, orcs here.
function rock(v, obj, t, moving) {
  const b = obj.userData.body;
  b.rotation.x = Math.sin(t * 1.3 + v.id) * 0.05;
  b.rotation.z = Math.sin(t * 0.9 + v.id * 0.7) * 0.03 + (moving ? -0.03 : 0);
}

registerView('tides_destroyer', {
  bake: true, // crowds: these come 6 to a side; merge the hull per material.
  make(e, world, v) {
    const g = frigate('#8a2418', true);
    // A small health bar that stays square to the camera.
    const bar = new THREE.Group();
    bar.position.y = 3.6;
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.16), new THREE.MeshBasicMaterial({ color: '#101010', transparent: true, opacity: 0.8, depthWrite: false }));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.52, 0.1), new THREE.MeshBasicMaterial({ color: '#e03020', depthWrite: false }));
    fill.position.z = 0.01;
    bar.add(bg, fill);
    bar.rotation.x = -0.4;
    g.add(bar);
    // Kept whole by bakeModel: the body it rocks, and the bar it animates.
    g.userData.bar = bar;
    v.parts = { bar, fill };
    return g;
  },
  update(v, a, b, k, dt, world) {
    rock(v, v.obj, world.time, b.mv);
    v.parts.bar.rotation.y = v.f;
    const fr = Math.max(0, Math.min(1, (b.hp ?? 1) / (b.mhp || 1)));
    v.parts.fill.scale.x = Math.max(0.001, fr);
    v.parts.fill.position.x = -0.76 * (1 - fr);
    if (b.mv && Math.random() < dt * 10) wake(world, v.x, v.z, v.f);
  },
});

function wake(world, x, z, f) {
  world.fx.burst(x - Math.cos(f) * 1.6, 0.05, z - Math.sin(f) * 1.6, '#e8f4ff', { n: 2, speed: 0.8, size: 0.5, life: 0.8, up: 0.2, grav: 0, additive: false });
}

// A cannonball on a high arc, trailing smoke (orc shells burn).
registerView('tides_shell', {
  make(e, world, v) {
    const g = new THREE.Group();
    const ball = M.mesh(new THREE.SphereGeometry(0.16, 12, 10), M.mat('#1e1e22', { metalness: 0.6, roughness: 0.4 }));
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#001018', transparent: true, opacity: 0.35, depthWrite: false }));
    g.add(ball, shadow);
    v.parts = { ball, shadow };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const t = Math.min(1, Math.max(0, a.t + (b.t - a.t) * k));
    const d = Math.hypot(b.x - b.sx, b.y - b.sy);
    const px = b.sx + (b.x - b.sx) * t;
    const pz = b.sy + (b.y - b.sy) * t;
    const y = 1.2 * (1 - t) + 4 * Math.max(1.2, d * 0.18) * t * (1 - t);
    v.obj.position.set(0, 0, 0);
    v.obj.rotation.set(0, 0, 0);
    v.parts.ball.position.set(px, y, pz);
    v.parts.shadow.position.set(px, 0.06, pz);
    if (Math.random() < dt * 30) {
      if (b.orc) world.fx.flame(px, y, pz, 0.45, 0.25, 0.05);
      world.fx.smokePuff(px, y, pz, b.orc ? '#3a2a24' : '#a8a8a8', 0.45, 0.6, 0.35);
    }
  },
});

registerEvent('tides_fire', (e, world) => {
  // Broadside flash and smoke from the side facing the target.
  const v = world.views.get(e.u);
  const x = v?.x ?? e.x;
  const z = v?.z ?? e.y;
  world.fx.glow(x + Math.cos(e.f) * 0.6, 0.6, z + Math.sin(e.f) * 0.6, '#ffd080', 1.4, 0.15);
  for (let i = 0; i < 3; i++) world.fx.smokePuff(x + Math.cos(e.f) * 0.7, 0.6, z + Math.sin(e.f) * 0.7, '#b0b0b0', 0.8, 1.1, 0.45);
  play('mortar');
});

registerEvent('tides_splash', (e, world) => {
  const fx = world.fx;
  if (e.hit) {
    fx.explosion(e.x, e.y, 0.8, { scorch: false });
    fx.debrisBurst(e.x, e.y, 6, 4);
    play('boom');
  } else {
    fx.burst(e.x, 0.1, e.y, '#e8f6ff', { n: e.big ? 30 : 22, speed: 3.5, size: 0.55, life: 0.8, up: 2.2, grav: 10, additive: false });
    fx.ring(e.x, e.y, e.big ? 1.6 : 0.9, '#ffffff', 0.6, 0.06);
    if (!e.big) play('splash');
  }
});

// A ship goes down: fire, smoke, flotsam and a big splash. Orc ships sink in place.
registerEvent('tides_sink', (e, world) => {
  const fx = world.fx;
  fx.explosion(e.x, e.y, 1.3, { scorch: false });
  fx.burst(e.x, 0.1, e.y, '#e8f6ff', { n: 40, speed: 4, size: 0.7, life: 1, up: 2, grav: 9, additive: false });
  fx.debrisBurst(e.x, e.y, 12, 5);
  world.shake = 0.25;
  play('bigboom');
  if (!e.orc) return;
  const hulk = frigate('#8a2418', true);
  hulk.position.set(e.x, 0, e.y);
  hulk.rotation.y = -(e.f || 0);
  world.scene.add(hulk);
  world.fx.transients.push({
    obj: hulk, t: 0, dur: 3,
    update: (k) => {
      hulk.userData.body.rotation.x = k * 1.1;
      hulk.userData.body.rotation.z = k * 0.4;
      hulk.position.y = -k * 3;
      if (Math.random() < 0.3) fx.smokePuff(e.x, 0.5, e.y, '#2a2624', 1.2, 1.6, 0.4);
    },
  });
});

// ------------------------------------------------------------ map

// A human shipyard: a timber dock on piles, a boathouse with a blue slate
// roof and a crane. The goblin one is rusty iron with a smokestack.
function shipyard(orc) {
  const g = new THREE.Group();
  const wood = M.texMat('tex_wood.webp', '#6a4a2c', orc ? '#a08070' : '#e0c8a8');
  const stone = M.texMat('tex_stone.webp', '#8a8680', '#d0ccc4');
  const roof = orc ? M.mat('#7a4a2a', { metalness: 0.5, roughness: 0.55 }) : M.mat('#3a5a9a', { roughness: 0.6 });
  const iron = M.mat('#4a4448', { metalness: 0.6, roughness: 0.45 });
  const deck = M.mesh(new THREE.BoxGeometry(5.2, 0.25, 4.2), wood, 0, 0.35, 0);
  g.add(deck);
  for (let i = 0; i < 12; i++) g.add(M.mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.4, 8), wood, -2.4 + (i % 4) * 1.6, -0.3, -1.9 + Math.floor(i / 4) * 1.9));
  const house = M.mesh(M.lathe([[1.6, 0], [1.6, 1.6], [0.001, 1.62]], 4), orc ? iron : stone, -0.6, 0.45, -0.3);
  house.rotation.y = Math.PI / 4;
  house.scale.set(1, 1, 0.8);
  g.add(house);
  const cap = M.mesh(M.lathe([[1.95, 0], [0.001, 1.5]], 4), roof, -0.6, 2.05, -0.3);
  cap.rotation.y = Math.PI / 4;
  cap.scale.set(1, 1, 0.8);
  g.add(cap);
  // Crane.
  g.add(M.mesh(M.tube([[1.8, 0.4, 1.4], [1.8, 2.2, 1.4], [1.8, 3.6, 1.4]], 0.12, 0.1, 6, 8), orc ? iron : wood));
  g.add(M.mesh(M.tube([[1.8, 3.5, 1.4], [0.8, 3.7, 1.4], [-0.2, 3.5, 1.4]], 0.08, 0.06, 6, 8), orc ? iron : wood));
  g.add(M.mesh(M.tube([[-0.2, 3.5, 1.4], [-0.2, 2.6, 1.4]], 0.015, 0.015, 2, 4), M.mat('#ccc')));
  if (orc) {
    g.add(M.mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.2, 12), iron, 0.6, 2.2, -1.2));
    g.userData.stack = { x: 0.6, y: 3.4, z: -1.2 };
  }
  return g;
}

// The sea, the corner shallows and land, the two shipyards, and rocks along
// the coast outside the arena.
registerMapBuilder('tides_sea', (map, world) => {
  const G = world.mapGroup;
  const hw = map.floor.w / 2;
  const hh = map.floor.h / 2;
  const yards = map.yards || [];
  const shallows = yards.map((y) => ({ x: y.x, y: y.y, r: 7 }));
  const land = yards.map((y) => ({ x: y.x + Math.sign(y.x) * 5, y: y.y + Math.sign(y.y) * 5, r: 4.5 }));
  const mat = seaMaterial({ shallows, land, hw, hh });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2), mat);
  sea.position.y = 0.12;
  sea.renderOrder = 2;
  G.add(sea);
  world.liquids.push(mat);
  // Everything below is static scenery, merged per material at the end.
  const deco = new THREE.Group();
  // Sandy spits by each dock, and green headlands behind them.
  for (const l of land) {
    const spit = M.mesh(M.blob(l.r, 0.6, l.r * 0.85, { seed: 310, amt: 0.15, freq: 1.5 }), M.triMat('tex_dirt.webp', '#b8a070', '#f0dcb0', 0.35), l.x, -0.1, l.y);
    deco.add(spit);
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const t = M.tree(0.9 + Math.random() * 0.4);
      t.position.set(l.x + Math.sign(l.x) * 2 + Math.cos(a) * 2.2, 0.35, l.y + Math.sign(l.y) * 2 + Math.sin(a) * 2.2);
      deco.add(t);
    }
  }
  yards.forEach((y) => {
    const s = shipyard(!!y.orc);
    s.position.set(y.x, 0, y.y);
    s.rotation.y = y.orc ? Math.PI * 0.75 : -Math.PI * 0.25;
    deco.add(s);
  });
  // Rocks breaking the surface round the arena.
  for (let i = 0; i < 70; i++) {
    const side = i % 4;
    const t = Math.random() * 2 - 1;
    const out = 1.5 + Math.random() * 5;
    const [x, z] = [[t * (hw + 3), -hh - out], [t * (hw + 3), hh + out], [-hw - out, t * (hh + 3)], [hw + out, t * (hh + 3)]][side];
    const r = M.rock(0.6 + Math.random() * 1.4);
    r.position.set(x, -0.3, z);
    deco.add(r);
  }
  bakeStatic(deco);
  G.add(deco);
});
