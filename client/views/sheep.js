// Uther Party #39 The Sheep Shearers: a sheep farm's fenced track, the two
// whirling shearer glaives, sheep (hero skin) and the Circle of Power finish.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerTheme, registerMapBuilder } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { skinTick, mapAnimate, bakeView, bakeScenery, clothMat, woolMat, groundGlow, blobShadow, emit, glow, ownMat, disposeOwn } from './d-kit.js';

registerTheme('sheep',
  { sky: '#88aacc', fog: '#9fb8c8', floor: ['#4f7a34', 40, { blades: true }], sun: '#fff2d8', hemi: ['#cfe6ff', '#3a4a20'] },
  {
    floor: { tex: 'tex_grass.webp', color: '#4f7a34', units: 8 },
    edge: { tex: 'tex_dirt.webp', tint: '#a89c84', color: '#6a5a40' },
    outer: { tex: 'tex_grass.webp', tint: '#8c9c80', color: '#3a5a26' },
    edgeWidth: 0.9,
  });

// A Circle of Power: a round plate of carved stone with a ring of light.
export function circleOfPower(r = 1.2, color = '#ffe070') {
  const g = new THREE.Group();
  const stone = M.texMat('tex_stone.webp', '#9a968c', '#d8d4cc', 0.6);
  g.add(M.mesh(M.lathe([[r * 1.08, 0], [r * 1.08, 0.05], [r, 0.09], [0.01, 0.09]], 40), stone));
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.82, r * 0.95, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  ring.position.y = 0.1;
  const halo = groundGlow(r * 1.6, color, 0.35);
  halo.position.y = 0.11;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, 3, 32, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
  beam.position.y = 1.5;
  g.add(ring, halo, beam);
  mapAnimate(g, (t) => {
    ring.material.opacity = 0.7 + Math.sin(t * 3) * 0.15;
    beam.material.opacity = 0.06 + Math.sin(t * 2) * 0.03;
  });
  return g;
}

registerMapBuilder('sheep', (map, world) => {
  const scen = new THREE.Group(); // static scenery, merged per material
  const walk = map.walk; // [x0, x1, y0, y1] sim units
  const inside = (x, y) => walk.some(([x0, x1, y0, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
  // The track: packed dirt over every walkable rectangle.
  const dirt = M.texMat('tex_dirt.webp', '#8a6a48', '#e0cfb0', 1);
  for (const [x0, x1, y0, y1] of walk) {
    const geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0).rotateX(-Math.PI / 2);
    // World-space UVs so neighbouring pieces line up.
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + (x0 + x1) / 2) / 5, (pos.getZ(i) + (y0 + y1) / 2) / 5);
    const m = new THREE.Mesh(geo, dirt);
    m.position.set((x0 + x1) / 2, 0.025, (y0 + y1) / 2);
    m.receiveShadow = true;
    world.mapGroup.add(m);
  }
  // A split-rail fence along the edge of the walkable ground.
  const wood = M.texMat('tex_wood.webp', '#7a5230', '#e8d8c0', 1);
  const posts = [];
  const step = 0.9;
  for (const [x0, x1, y0, y1] of walk) {
    const edges = [
      [x0, y0, x1, y0, 0, -1], [x0, y1, x1, y1, 0, 1],
      [x0, y0, x0, y1, -1, 0], [x1, y0, x1, y1, 1, 0],
    ];
    for (const [ax, ay, bx, by, nx, ny] of edges) {
      const len = Math.hypot(bx - ax, by - ay);
      for (let d = 0; d <= len + 0.01; d += step) {
        const x = ax + ((bx - ax) * d) / len;
        const y = ay + ((by - ay) * d) / len;
        if (inside(x + nx * 0.15, y + ny * 0.15)) continue;
        if (Math.abs(x) > map.bounds - 1.2 || Math.abs(y) > map.bounds / 2 + 0.2) continue;
        posts.push([x + nx * 0.15, y + ny * 0.15, nx, ny]);
      }
    }
  }
  const postGeo = M.tube([[0, 0, 0], [0.01, 0.4, 0], [0, 0.8, 0]], 0.07, 0.06, 2, 6);
  const railGeo = new THREE.CylinderGeometry(0.035, 0.035, step * 1.02, 6).rotateZ(Math.PI / 2);
  for (const [x, y, nx, ny] of posts) {
    scen.add(M.mesh(postGeo, wood, x, 0, y));
    for (const h of [0.35, 0.65]) {
      const r = M.mesh(railGeo, wood, x + (ny ? step / 2 : 0), h, y + (nx ? step / 2 : 0));
      if (nx) r.rotation.y = Math.PI / 2;
      if (inside(x + (ny ? step : 0) - nx * 0.15, y + (nx ? step : 0) - ny * 0.15) || inside(x + (ny ? step : 0) + nx * 0.3, y + (nx ? step : 0) + ny * 0.3)) continue;
      scen.add(r);
    }
  }
  // Hay bales and bushes in the unwalkable fields; trees round the farm.
  const hay = M.texMat('tex_grass.webp', '#c8a850', '#f0d890', 1);
  const B = map.bounds;
  for (let i = 0; i < 70; i++) {
    const x = (Math.random() - 0.5) * 2 * (B - 1);
    const y = (Math.random() - 0.5) * 2 * (B / 2 - 0.5);
    let ok = !inside(x, y);
    for (const [x0, x1, y0, y1] of walk) if (x > x0 - 1 && x < x1 + 1 && y > y0 - 1 && y < y1 + 1) ok = false;
    if (!ok) continue;
    if (Math.random() < 0.3) {
      const b = M.mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.7, 16).rotateZ(Math.PI / 2), hay, x, 0.45, y);
      b.rotation.y = Math.random() * 3;
      scen.add(b);
    } else {
      const b = M.bush(0.5 + Math.random() * 0.4);
      b.position.set(x, 0, y);
      scen.add(b);
    }
  }
  for (let a = -B - 2; a <= B + 2; a += 2.3) {
    for (const z of [-B / 2 - 2.6, B / 2 + 2.6]) {
      const t = M.tree(1 + Math.random() * 0.4);
      t.position.set(a + (Math.random() - 0.5), 0, z + (Math.random() - 0.5) * 1.5);
      scen.add(t);
    }
  }
  for (let a = -B / 2 - 2; a <= B / 2 + 2; a += 2.3) {
    for (const x of [-B - 1.5, B + 1.5]) {
      const t = M.tree(1 + Math.random() * 0.4);
      t.position.set(x + (Math.random() - 0.5), 0, a);
      scen.add(t);
    }
  }
  world.mapGroup.add(bakeScenery(scen));
  const [fx, fy, fr] = map.finish;
  const cop = circleOfPower(fr * 1.05);
  cop.position.set(fx, 0, fy);
  world.mapGroup.add(cop);
});

// ------------------------------------------------------------ sheep

function sheep(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const wool = woolMat();
  const face = M.mat('#2c2420', { roughness: 0.7 });
  const hoof = M.mat('#1a1410', { roughness: 0.5 });
  // Fleece: a big lumpy body of wool.
  body.add(M.mesh(M.blob(0.5, 0.36, 0.36, { seed: 31, amt: 0.16, freq: 5 }), wool, 0, 0.62, 0));
  body.add(M.mesh(M.blob(0.26, 0.26, 0.28, { seed: 32, amt: 0.2, freq: 5 }), wool, 0.36, 0.78, 0));
  body.add(M.mesh(M.blob(0.14, 0.12, 0.12, { seed: 33, amt: 0.2, freq: 5 }), wool, -0.48, 0.72, 0));
  // Head: black face with drooping ears and a woolly topknot.
  const head = new THREE.Group();
  head.position.set(0.56, 0.86, 0);
  head.add(M.mesh(M.blob(0.16, 0.12, 0.11, { seed: 34 }), face, 0.06, 0, 0));
  head.add(M.mesh(M.blob(0.1, 0.08, 0.08, { seed: 35 }), face, 0.18, -0.05, 0));
  head.add(M.mesh(M.blob(0.1, 0.07, 0.11, { seed: 36, amt: 0.2, freq: 5 }), wool, -0.02, 0.1, 0));
  for (const s of [1, -1]) {
    const ear = M.mesh(M.blob(0.09, 0.025, 0.045, { seed: 37 }), face, -0.02, 0.03, 0.14 * s);
    ear.rotation.x = 0.5 * s;
    head.add(ear);
    head.add(M.mesh(M.scaled(M.G.sphere, 0.022), M.mat('#f0e8c0', { roughness: 0.3 }), 0.14, 0.04, 0.07 * s));
  }
  body.add(head);
  // Team-coloured collar with a bell.
  const collar = M.mesh(new THREE.TorusGeometry(0.15, 0.03, 6, 18).rotateY(Math.PI / 2), clothMat(color), 0.47, 0.75, 0);
  collar.rotation.z = 0.5;
  body.add(collar);
  body.add(M.mesh(M.scaled(M.G.sphere, 0.05), M.goldMat(), 0.56, 0.62, 0));
  const legAt = (x, s) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.45, 0.16 * s);
    hip.add(M.mesh(M.tube([[0, 0, 0], [0.01, -0.2, 0], [0, -0.4, 0]], 0.045, 0.035, 4, 6), face));
    hip.add(M.mesh(M.scaled(M.G.sphere, 0.045, 0.035, 0.045), hoof, 0.01, -0.42, 0));
    body.add(hip);
    return hip;
  };
  const legL = legAt(0.28, 1);
  const legR = legAt(0.28, -1);
  const backL = legAt(-0.28, 1);
  const backR = legAt(-0.28, -1);
  body.scale.setScalar(1.35);
  Object.assign(g.userData, { body, legL, legR, kind: 'hero' });
  // Diagonal gait: each back leg moves with the opposite front one.
  skinTick(g, [backL, backR], () => {
    backL.rotation.z = legR.rotation.z;
    backR.rotation.z = legL.rotation.z;
  });
  return g;
}

registerSkin('sheep', sheep);

// ------------------------------------------------------------ the shearer

// A glaive: three crescent blades round a hub (the Glaive Thrower's missile at scale 2).
function glaive() {
  const g = new THREE.Group();
  const steel = M.mat('#d8dde6', { metalness: 0.85, roughness: 0.25 });
  const sh = new THREE.Shape();
  sh.moveTo(0.15, -0.08);
  sh.quadraticCurveTo(0.9, -0.1, 1.35, 0.35);
  sh.quadraticCurveTo(0.95, 0.12, 0.2, 0.12);
  sh.lineTo(0.15, -0.08);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.03, bevelSegments: 2, curveSegments: 12 });
  geo.translate(0, 0, -0.025);
  geo.rotateX(Math.PI / 2);
  for (let i = 0; i < 3; i++) {
    const b = M.mesh(geo, steel);
    b.rotation.y = (i / 3) * Math.PI * 2;
    g.add(b);
  }
  g.add(M.mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 20), M.goldMat()));
  g.add(M.mesh(M.scaled(M.G.sphere, 0.14, 0.1, 0.14), glow('#bff4ff')));
  return g;
}

registerView('shearblade', {
  make(e, world, v) {
    const g = new THREE.Group();
    const spin = glaive();
    spin.position.y = 0.95;
    spin.scale.setScalar(1.25);
    // The reach of the blade: a faint whirl of air on the ground.
    const reach = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), ownMat(new THREE.MeshBasicMaterial({ color: '#ff5050', transparent: true, opacity: 0.35, depthWrite: false })));
    reach.scale.setScalar(e.r);
    reach.position.y = 0.05;
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), ownMat(new THREE.MeshBasicMaterial({ color: '#ff3030', transparent: true, opacity: 0.1, depthWrite: false })));
    fill.scale.setScalar(e.r);
    fill.position.y = 0.045;
    g.add(fill, reach, spin, blobShadow(1.2, 0.35));
    v.parts = { spin, reach };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    P.spin.rotation.y -= dt * 22 * (b.d || 1);
    P.spin.rotation.z = Math.sin(world.time * 3 + v.id) * 0.08;
    // Throw up grass and dust as it passes.
    for (let n = emit(v, 'dust', 16, dt); n > 0; n--) {
      const ang = Math.random() * Math.PI * 2;
      world.fx.trail(v.x + Math.cos(ang) * 1.4, 0.8, v.z + Math.sin(ang) * 1.4, '#e8f4ff', 0.3, 0.3, 0.2);
    }
    if (emit(v, 'puff', 5, dt)) world.fx.dustCloud(v.x, v.z, 0.6, '#9a8a6a', 2);
  },
  remove(v) {
    disposeOwn(v.obj);
  },
});

registerEvent('shear', (e, world) => {
  world.fx.burst(e.x, 0.8, e.y, '#f4efe4', { n: 36, speed: 5, size: 0.7, life: 0.9, up: 1.2, grav: 3, additive: false });
  for (let i = 0; i < 6; i++) world.fx.smokePuff(e.x, 0.6, e.y, '#f0ece4', 1, 1.4, 0.6);
  world.fx.sparks(e.x, 0.9, e.y, 10, 5, '#ffffff');
  play('squish');
});

registerEvent('shearswap', () => play('swap'));
