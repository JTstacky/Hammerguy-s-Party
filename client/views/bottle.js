// Visuals for Uther Party 4.0 #50 "Battle for the Bottle"
// (server/minigames/up/50-bottle.js): the Tauren arena's cut corners and
// autumn trees, Runes of Mana, the Drunken Haze brew jug, Breath of Fire,
// haze and burn effects on the fighters, and the "drunk" screen: a random
// tinted flash every 3.25 s and a swaying camera (both softened from the
// original, which was close to blinding).

import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerEvent, registerSkin, registerMapBuilder } from '../../engine/client/render/registry.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { fxTexture } from '../../engine/client/render/effects.js';
import { play } from '../../engine/client/audio.js';

// How strong the effects are compared with the original. The flash there
// reaches 50-100 % opacity; here it peaks at 35 % of that.
const FLASH_CAP = 0.35;
const SWAY = 0.9; // camera drift in world units (the original's noise is ~15)
const ROLL = 0.035; // radians of camera roll

// ------------------------------------------------------------ Pandaren

// A single unbaked template shares geometry between contestants. Each clone
// gets its own animation pivots and a cached team material before bakeModel.
let brewerTemplate;
function brewerFur(color) {
  const m = M.texMat('tex_fur.webp', color, color, 2, { roughness: 1, metalness: 0 });
  // The painted fur tile is brown; retain its brushwork, but make panda fur
  // ivory/charcoal rather than tinting the panda brown.
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec3 fur = texture2D(map, vMapUv).rgb;
        diffuseColor.rgb *= 0.78 + 0.22 * dot(fur, vec3(0.299, 0.587, 0.114));
      #endif`);
  };
  m.customProgramCacheKey = () => 'brewmasterFur';
  return m;
}

function makeBrewerTemplate() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.name = 'body';
  body.scale.setScalar(1.45); // same display scale as the paladin
  g.add(body);
  const white = brewerFur('#f2eddf');
  const black = brewerFur('#252a30');
  const eye = M.mat('#110f0e', { roughness: 0.3 });
  const team = M.mat('#ffffff', { roughness: 0.9, side: THREE.DoubleSide });
  const leather = M.leatherMat('#9d7555');
  const wood = M.texMat('tex_wood.webp', '#78512c', '#c69c65');
  const iron = M.mat('#49413a', { roughness: 0.55, metalness: 0.5 });
  const round = (parent, material, x, y, z, sx, sy, sz, seed = 1) => {
    const detail = Math.max(sx, sy, sz) > 0.25 ? 3 : Math.max(sx, sy, sz) > 0.07 ? 2 : 1;
    const m = M.mesh(M.blob(sx, sy, sz, { seed, amt: 0.035, detail }), material, x, y, z);
    parent.add(m);
    return m;
  };
  // Broad black shoulders above a hanging white belly, with short planted legs.
  round(body, black, -0.035, 1.12, 0, 0.35, 0.35, 0.43);
  round(body, white, 0.035, 0.86, 0, 0.43, 0.48, 0.43, 2);
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.name = s > 0 ? 'legL' : 'legR';
    leg.position.set(-0.02, 0.48, s * 0.23);
    round(leg, black, 0, -0.16, 0, 0.16, 0.25, 0.17);
    round(leg, black, 0.09, -0.39, 0, 0.23, 0.1, 0.18);
    leg.add(M.mesh(new THREE.CylinderGeometry(0.163, 0.17, 0.13, 16), team, 0.01, -0.27, 0));
    body.add(leg);
  }
  // Face tips up toward the RTS camera: patches sit on the upper-front cheek.
  const head = new THREE.Group();
  head.position.set(0.12, 1.48, 0);
  head.rotation.z = 0.18;
  body.add(head);
  round(head, white, 0, 0, 0, 0.31, 0.3, 0.34, 3);
  for (const s of [-1, 1]) {
    round(head, black, -0.07, 0.22, s * 0.275, 0.115, 0.13, 0.105);
    const patch = round(head, black, 0.253, 0.078, s * 0.165, 0.077, 0.125, 0.104);
    patch.rotation.x = s * 0.3;
    round(head, white, 0.313, 0.095, s * 0.165, 0.025, 0.043, 0.036);
    round(head, eye, 0.333, 0.098, s * 0.159, 0.017, 0.027, 0.022);
    round(head, white, 0.273, -0.093, s * 0.093, 0.15, 0.105, 0.117);
  }
  round(head, eye, 0.404, -0.033, 0, 0.057, 0.045, 0.072);
  head.add(M.mesh(M.tube([[0.377, -0.1, -0.1], [0.397, -0.131, 0], [0.377, -0.1, 0.1]], 0.012, 0.012, 8, 5), eye));
  // A wide cloth sash, knotted at the side, and a hanging front apron.
  const sash = M.mesh(M.lathe([[0.39, 0.53], [0.445, 0.61], [0.45, 0.72]], 24), team);
  sash.scale.z = 1.03;
  body.add(sash);
  const loin = M.mesh(M.cloth(0.43, 0.45, 0.045, -0.04), team, 0.38, 0.41, 0);
  loin.rotation.y = Math.PI;
  body.add(loin);
  round(body, team, 0.1, 0.65, 0.45, 0.12, 0.1, 0.075);
  const tail = M.mesh(M.cloth(0.17, 0.4, 0.035, 0.1), team, 0.01, 0.45, 0.46);
  body.add(tail);
  // Wooden back keg: bulging staves, iron hoops, end grain and a bung.
  const keg = new THREE.Group();
  keg.position.set(-0.43, 1.02, 0);
  keg.rotation.x = Math.PI / 2;
  keg.rotation.z = -0.15;
  keg.add(M.mesh(M.lathe([[0, -0.38], [0.24, -0.38], [0.29, -0.3], [0.33, 0], [0.29, 0.3], [0.24, 0.38], [0, 0.38]], 20), wood));
  for (const y of [-0.29, 0.29]) keg.add(M.mesh(M.lathe([[0.29, y - 0.045], [0.3, y], [0.29, y + 0.045]], 20), iron));
  keg.add(M.mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 12), leather, 0, 0.407, 0));
  body.add(keg);
  for (const s of [-1, 1]) {
    body.add(M.mesh(M.tube([[-0.45, 0.7, s * 0.24], [0.08, 0.89, s * 0.41], [0.12, 1.31, s * 0.25], [-0.4, 1.35, s * 0.22]], 0.035, 0.035, 14, 6), leather));
  }
  // The gripping arm and bo share the staff pivot, so casts carry the hand.
  const staff = new THREE.Group();
  staff.name = 'staff';
  staff.position.set(0.02, 1.2, -0.39);
  staff.add(M.mesh(M.tube([[0, 0, 0], [0.18, -0.19, -0.04], [0.34, -0.26, -0.01]], 0.16, 0.11, 8, 10), black));
  round(staff, team, 0.26, -0.235, -0.01, 0.11, 0.105, 0.12);
  round(staff, black, 0.36, -0.265, -0.01, 0.1, 0.105, 0.105);
  staff.add(M.mesh(M.tube([[0.18, -1.05, 0], [0.36, -0.25, -0.02], [0.48, 0.55, -0.035], [0.46, 1.07, -0.04]], 0.052, 0.042, 16, 10), wood));
  for (const y of [-0.86, 0.8, 0.91]) staff.add(M.mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.065, 12), leather, y < 0 ? 0.23 : 0.47, y, -0.035));
  body.add(staff);
  body.add(M.mesh(M.tube([[0, 1.19, 0.39], [0.11, 0.97, 0.48], [0.3, 0.87, 0.42]], 0.165, 0.115, 8, 10), black));
  round(body, team, 0.23, 0.9, 0.435, 0.12, 0.11, 0.13);
  round(body, black, 0.33, 0.85, 0.4, 0.12, 0.12, 0.12);
  g.traverse((o) => { if (o.material === team) o.name = 'team'; });
  return g;
}

export function brewmaster(color) {
  brewerTemplate ??= makeBrewerTemplate();
  const g = brewerTemplate.clone(true);
  const team = M.mat(color, { roughness: 0.9, side: THREE.DoubleSide });
  g.traverse((o) => { if (o.isMesh && o.name === 'team') o.material = team; });
  g.userData = { body: g.getObjectByName('body'), staff: g.getObjectByName('staff'), legL: g.getObjectByName('legL'), legR: g.getObjectByName('legR'), kind: 'hero' };
  return g;
}
registerSkin('brewmaster', brewmaster);

let plateauMaterial;
function plateauMat() {
  if (plateauMaterial) return plateauMaterial;
  const m = M.texMat('tex_dirt.webp', '#8e794d', '#b7a67b', 1, { roughness: 0.95 });
  const grass = { value: null };
  const ready = { value: 0 };
  fxTexture('tex_grass.webp', (t) => { grass.value = t; ready.value = 1; }, { repeat: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tGrass = grass;
    sh.uniforms.grassReady = ready;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPlateau; varying float vTurf;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlateau = position; vTurf = uv.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPlateau; varying float vTurf; uniform sampler2D tGrass; uniform float grassReady;')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec3 dirt = texture2D(map, vPlateau.xz * 0.18).rgb * diffuseColor.rgb;
          vec3 grass = texture2D(tGrass, vPlateau.xz / 11.0 + 0.37).rgb * vec3(0.35, 0.37, 0.25); // the dirt theme's outer tint
          float tuft = dot(grass, vec3(0.333)); // ("patch" is reserved in GLSL ES 3)
          // Turf grows back from the cliff edge; the tile only breaks up the line.
          float blend = smoothstep(0.3, 0.75, vTurf + (tuft - 0.45) * 0.35);
          diffuseColor.rgb = mix(dirt, grass, blend * grassReady);
        #endif`);
  };
  m.customProgramCacheKey = () => 'bottlePlateau';
  plateauMaterial = m;
  return m;
}

// ------------------------------------------------------------ map

// A deciduous "Fall Tree Wall" tree: a gnarled trunk under a round crown of
// orange and red leaves.
function autumnTree(s = 1, seed = 1) {
  const g = new THREE.Group();
  const bark = M.barkMat();
  g.add(M.mesh(M.lathe([[0.26 * s, 0], [0.2 * s, 0.3 * s], [0.15 * s, 1.3 * s], [0.1 * s, 2.1 * s]], 10), bark));
  for (const [dx, dz, h] of [[0.5, 0.2, 1.6], [-0.4, 0.35, 1.7], [0.05, -0.5, 1.8]]) {
    g.add(M.mesh(M.tube([[0, 1.2 * s, 0], [dx * 0.5 * s, 1.5 * s, dz * 0.5 * s], [dx * s, h * s, dz * s]], 0.09 * s, 0.04 * s, 6, 6), bark));
  }
  const tints = ['#ffffff', '#ffe4d4', '#fff4dc'];
  const leaves = (i) => M.triMat('tex_bottle_leaves.webp', ['#c4621e', '#b8401c', '#d8962a'][i % 3], tints[i % 3], 0.7, { roughness: 0.95 });
  const crowns = [[0, 2.5, 0, 1.25], [0.6, 2.2, 0.35, 0.85], [-0.55, 2.25, 0.3, 0.8], [0.1, 2.15, -0.6, 0.85], [0.05, 3.05, 0.05, 0.75]];
  crowns.forEach(([x, y, z, r], i) => {
    g.add(M.mesh(M.blob(r * s, r * 0.8 * s, r * s, { seed: seed * 13 + i, amt: 0.16, freq: 3.2 }), leaves(i + seed), x * s, y * s, z * s));
  });
  g.rotation.y = seed * 1.7;
  return g;
}

registerMapBuilder('bottle', (map, world) => {
  const HW = map.floor.w / 2;
  const CUT = HW * 1.5; // |x| + |y| <= 960 u of the 640 u half-width
  const scenery = new THREE.Group();
  const cliff = M.triMat('tex_boulder.webp', '#71634f', '#aa9275', 0.6);
  const top = plateauMat();
  // Four stepped rock strata. Every point stays outside the chamfer's
  // collision line; ledges retreat outward as they rise, exposing the face.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const e = HW + 3;
    const N = 40;
    const rows = [[0.06, 0.02], [0.25, 0.45], [0.39, 0.62], [0.43, 1.28], [0.76, 1.45], [0.91, 2.05], [1.15, 2.17]];
    const pos = [];
    const idx = [];
    const edge = [];
    const phase = sx * 2 + sy * 4;
    for (let r = 0; r < rows.length; r++) {
      const [setback, height] = rows[r];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const x = CUT - e + (2 * e - CUT) * t;
        const z = CUT - x;
        const crag = 0.25 + 0.16 * Math.sin(t * 31 + phase) + 0.09 * Math.sin(t * 67 + phase);
        const out = setback + crag * (r ? 1 : 0.3);
        const y = height + (r ? 0.14 * Math.sin(t * 19 + phase) + 0.07 * Math.sin(t * 43) : 0);
        const p = [sx * (x + out), y, sy * (z + out)];
        pos.push(...p);
        if (r === rows.length - 1) edge.push(p);
        if (r && i) {
          const a = r * (N + 1) + i, b = a - N - 1;
          if (sx * sy > 0) idx.push(a, b, a - 1, b, b - 1, a - 1);
          else idx.push(a, a - 1, b, b, a - 1, b - 1);
        }
      }
    }
    const face = new THREE.BufferGeometry();
    face.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    face.setIndex(idx);
    face.computeVertexNormals();
    scenery.add(M.mesh(face, cliff));
    // The plateau continues out into the treeline, tapering back to ground.
    const capPos = [], capIdx = [], capUV = [];
    for (let r = 0; r <= 8; r++) for (let i = 0; i <= N; i++) {
      const t = r / 8;
      const p = edge[i];
      const outer = e + 1.8 + 0.35 * Math.sin(i * 0.7 + phase);
      const retreat = Math.max(0.2, outer - Math.max(Math.abs(p[0]), Math.abs(p[2])));
      const fall = Math.max(0, (t - 0.25) / 0.75);
      capPos.push(p[0] + sx * retreat * t, p[1] * (1 - fall * fall * (3 - 2 * fall)) + 0.015, p[2] + sy * retreat * t);
      capUV.push(i / N, t);
      if (r && i) {
        const a = r * (N + 1) + i, b = a - N - 1;
        if (sx * sy > 0) capIdx.push(a, b, a - 1, b, b - 1, a - 1);
        else capIdx.push(a, a - 1, b, b, a - 1, b - 1);
      }
    }
    const cap = new THREE.BufferGeometry();
    cap.setAttribute('position', new THREE.Float32BufferAttribute(capPos, 3));
    cap.setAttribute('uv', new THREE.Float32BufferAttribute(capUV, 2));
    cap.setIndex(capIdx);
    cap.computeVertexNormals();
    scenery.add(M.mesh(cap, top));
    for (let i = 0; i < 9; i++) {
      const t = (i + 0.5) / 9;
      const x = CUT - e + (2 * e - CUT) * t;
      const size = 0.28 + (i % 3) * 0.12;
      // Radius is included in the setback, keeping the playable octagon clear.
      scenery.add(M.mesh(M.blob(size, size * 0.8, size * 0.85, { seed: i + 50, amt: 0.25, detail: 2 }), cliff, sx * (x + size), size * 0.45, sy * (CUT - x + size)));
    }
  }
  // The Fall Tree Walls: three autumn trees on the rim, where the map has them.
  const t = HW / 5; // one tile
  for (const [i, [x, y]] of [[4.5, -2.5], [-4.5, 2.5], [2.5, 4.5]].entries()) {
    const tr = autumnTree(1.15, i + 1);
    // They block pathing in the original; stand them on the cliff shelf.
    const k = Math.max(1, (CUT + 0.9 * t) / (Math.abs(x * t) + Math.abs(y * t)));
    tr.position.set(x * t * k, 2.05, y * t * k);
    scenery.add(tr);
  }
  // A ring of autumn trees among the pines outside.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.2;
    const r = HW * 1.45 + 2 + (i % 3) * 1.4;
    const tr = autumnTree(1 + (i % 4) * 0.12, i + 4);
    tr.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    scenery.add(tr);
  }
  bakeStatic(scenery);
  world.mapGroup.add(scenery);
});

// ------------------------------------------------------------ rune of mana

function manaRune() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const stone = M.triMat('tex_boulder.webp', '#4a5a7a', '#9ab0d8', 1.4);
  // A rounded rune stone, carved on its face, floating over a glow.
  const tablet = M.mesh(M.lathe([[0.001, -0.08], [0.34, -0.07], [0.4, -0.02], [0.4, 0.03], [0.33, 0.08], [0.001, 0.09]], 20), stone);
  tablet.rotation.x = Math.PI / 2;
  body.add(tablet);
  const sigil = new THREE.Group();
  const glow = M.glowMat('#7fc8ff');
  sigil.add(M.mesh(new THREE.TorusGeometry(0.27, 0.025, 6, 32), glow));
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.09 : 0.21;
    if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  sigil.add(M.mesh(new THREE.ShapeGeometry(star), glow));
  for (const z of [0.092, -0.092]) {
    const s = sigil.clone();
    s.position.z = z;
    body.add(s);
  }
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#3a8cff', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = 0.05;
  g.add(halo);
  g.userData = { body, halo };
  return g;
}

registerView('manarune', {
  make(e, world, v) {
    const g = manaRune();
    v.parts = g.userData;
    world.fx.glow(e.x, 1, e.y, '#8fd0ff', 3, 0.5);
    return g;
  },
  update(v, a, b, k, dt, world) {
    const t = world.time + v.id;
    v.parts.body.position.y = 1 + Math.sin(t * 2.2) * 0.12;
    v.parts.body.rotation.y = t * 1.4;
    v.parts.halo.material.opacity = 0.28 + Math.sin(t * 3) * 0.08;
    if (Math.random() < 0.25) world.fx.trail(v.x + (Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.8, v.z + (Math.random() - 0.5) * 0.6, '#9fd8ff', 0.3, 0.6, 0.1);
    return true;
  },
});

registerEvent('runepick', (e, world) => {
  world.fx.burst(e.x, 1, e.y, '#8fd0ff', { n: 30, speed: 3, size: 0.5, life: 0.6 });
  world.fx.ring(e.x, e.y, 1.6, '#6fb4ff', 0.5);
  world.fx.glow(e.x, 1.2, e.y, '#8fd0ff', 3, 0.4);
  play('shield');
});

// ------------------------------------------------------------ drunken haze

function brewJug() {
  const g = new THREE.Group();
  const clay = M.triMat('tex_boulder.webp', '#8a5530', '#e0a070', 2.2);
  g.add(M.mesh(M.lathe([[0.001, -0.2], [0.14, -0.19], [0.2, -0.1], [0.2, 0.02], [0.13, 0.12], [0.07, 0.16], [0.08, 0.22], [0.001, 0.23]], 16), clay));
  g.add(M.mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.08, 10), M.texMat('tex_wood.webp', '#7a5230'), 0, 0.26, 0));
  const handle = M.mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 14, Math.PI * 1.2), clay, 0.16, 0.03, 0);
  handle.rotation.z = -Math.PI * 0.6;
  g.add(handle);
  g.add(M.mesh(new THREE.TorusGeometry(0.2, 0.018, 6, 20).rotateX(Math.PI / 2), M.mat('#3a2a1a'), 0, -0.04, 0));
  return g;
}

registerView('flask', {
  make() {
    const g = new THREE.Group();
    const jug = brewJug();
    jug.position.y = 1.5;
    g.add(jug);
    g.userData = { jug };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const j = v.obj.userData.jug;
    j.rotation.z += dt * 14;
    if (Math.random() < 0.6) world.fx.trail(v.x, 1.5, v.z, '#e8b040', 0.3, 0.4, 0.2);
  },
});

registerEvent('haze', (e, world) => {
  const fx = world.fx;
  fx.burst(e.x, 1.2, e.y, '#e8c060', { n: 26, speed: 4, size: 0.45, life: 0.6, additive: false, grav: 6 });
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * e.r;
    fx.smokePuff(e.x + Math.cos(a) * r, 0.6, e.y + Math.sin(a) * r, i % 2 ? '#a8a040' : '#c8a060', 1.6, 1.8, 0.45);
  }
  fx.ring(e.x, e.y, e.r, '#e8d070', 0.5);
  play('splash');
});

// Haze and fire on a fighter: bubbling brew fumes round the head, flames on the body.
registerView('brewfx', {
  make() {
    return new THREE.Group();
  },
  update(v, a, b, k, dt, world) {
    const fx = world.fx;
    const acc = (v.acc ??= { hz: 0, bn: 0 });
    if (b.hz) {
      acc.hz += dt * 7;
      while (acc.hz >= 1) {
        acc.hz -= 1;
        const ang = Math.random() * Math.PI * 2;
        fx.smokePuff(v.x + Math.cos(ang) * 0.4, 2.1, v.z + Math.sin(ang) * 0.4, Math.random() < 0.5 ? '#b0a848' : '#d0a860', 0.8, 1.1, 0.4);
        fx.trail(v.x + Math.cos(ang) * 0.5, 2.3, v.z + Math.sin(ang) * 0.5, '#f0d860', 0.25, 0.6, 0.2);
      }
    }
    if (b.bn) {
      acc.bn += dt * 20;
      while (acc.bn >= 1) {
        acc.bn -= 1;
        fx.flame(v.x, 0.5 + Math.random() * 1.2, v.z, 0.8, 0.45, 0.35);
      }
    }
  },
});

// ------------------------------------------------------------ breath of fire

// The wave sweeps out over len / speed seconds, spraying flames across the
// widening cone as it goes.
registerEvent('bof', (e, world) => {
  const fx = world.fx;
  const dir = { x: Math.cos(e.a), z: Math.sin(e.a) };
  const side = { x: -dir.z, z: dir.x };
  const dur = e.len / e.sp;
  let front = 0;
  fx.transients.push({
    obj: new THREE.Group(),
    t: 0,
    dur: dur + 0.05,
    update: (kk) => {
      const now = Math.min(e.len, (kk * (dur + 0.05) / dur) * e.len);
      const n = Math.round((now - front) * 24);
      for (let i = 0; i < n; i++) {
        const d = front + ((i + Math.random()) / Math.max(1, n)) * (now - front);
        const half = (e.w0 + (e.w1 - e.w0) * (d / e.len)) / 2;
        const s = (Math.random() * 2 - 1) * half;
        const x = e.x + dir.x * d + side.x * s;
        const z = e.y + dir.z * d + side.z * s;
        fx.sp.flames.spawn(x, 0.6 + Math.random() * 0.5, z, { vx: dir.x * 3, vy: 1.2, vz: dir.z * 3, size: 1.9 + d * 0.2, grow: 0.9, life: 0.6, frame: 0, anim: 16, rot: Math.random() - 0.5, spin: 0.3, fadeIn: 0.05 });
        if (Math.random() < 0.15) fx.smokePuff(x, 1.2, z, '#2e2826', 1.1, 1.2, 0.35);
      }
      front = now;
    },
  });
  fx.glow(e.x + dir.x * 1.2, 1.4, e.y + dir.z * 1.2, '#ffa040', 3, 0.35);
  fx.flash(e.x + dir.x * e.len * 0.5, e.y + dir.z * e.len * 0.5, e.len, '#ff8030', dur + 0.2);
});

// ------------------------------------------------------------ drunk screen

let flash = null;
registerEvent('bflash', (e) => {
  flash = { c: e.c, a: e.a * FLASH_CAP, t: 0 };
});

registerView('bottlefx', {
  make(e, world, v) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;inset:0;pointer-events:none;opacity:0;mix-blend-mode:normal;';
    world.overlay.appendChild(div);
    v.div = div;
    v.on = !!e.on;
    flash = null;
    // Sway the camera after the world has placed it (CameraSetTargetNoise).
    v.cam = (camera, dt, w) => {
      const me = w.myView();
      const want = v.on && me && !(me.deadT > 0) ? 1 : 0;
      v.sway = (v.sway || 0) + (want - (v.sway || 0)) * Math.min(1, dt * 1.5);
      if (v.sway < 0.01) return;
      const t = w.time;
      const s = v.sway;
      camera.position.x += (Math.sin(t * 0.83) + 0.5 * Math.sin(t * 1.91 + 1)) * SWAY * s;
      camera.position.z += (Math.sin(t * 0.67 + 2) + 0.5 * Math.sin(t * 1.53)) * SWAY * 0.7 * s;
      camera.position.y += Math.sin(t * 1.1 + 4) * SWAY * 0.4 * s;
      camera.lookAt(w.focus);
      camera.rotateZ(Math.sin(t * 0.9 + 0.5) * ROLL * s);
    };
    world.cameraFx.add(v.cam);
    return new THREE.Group();
  },
  update(v, a, b, k, dt) {
    v.on = !!b.on;
    if (flash) {
      // Fade out to the tint over 1.5 s, then back in over 1.5 s.
      flash.t += dt;
      const t = flash.t;
      const w = t < 1.5 ? t / 1.5 : t < 3 ? 1 - (t - 1.5) / 1.5 : 0;
      if (v.bg !== flash.c) v.div.style.background = v.bg = flash.c;
      v.div.style.opacity = String(Math.max(0, w) * flash.a);
      if (t >= 3) flash = null;
    } else if (v.div.style.opacity !== '0') v.div.style.opacity = '0';
    return true;
  },
  remove(v, world) {
    v.div.remove();
    world.cameraFx.delete(v.cam);
    flash = null;
  },
});
