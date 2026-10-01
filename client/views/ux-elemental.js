// Terrain-keyed elemental spells and the Geomancer's five-colour arena.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { registerSkin, registerEvent, registerMapBuilder, registerTheme } from '../../engine/client/render/registry.js';
import { pivot, limb, oval, fence } from './ux4-common.js';

const GRID = [
  'ISSSSISSSSI', 'SRGGRGRGGRS', 'SGRGGIGGRGS', 'SGGRIRIRGGS',
  'SRGIRRRIGRS', 'IGIRRMRRIGI', 'SRGIRRRIGRS', 'SGGRIRIRGGS',
  'SGRGGIGGRGS', 'SRGGRGRGGRS', 'ISSSSISSSSI',
];

function geomancer(color) {
  const g = new THREE.Group();
  const body = pivot(0, 0, 0);
  body.scale.setScalar(1.32);
  g.add(body);
  const skin = M.mat('#cfad83', { roughness: 0.65 });
  const robe = M.leatherMat('#4c5e68');
  const armour = M.plateMat('#668b83');
  const trim = M.mat(color, { roughness: 0.6 });
  const stone = M.boulderMat('#8b8073');
  const legs = [-1, 1].map((s) => {
    const p = pivot(0, 0.74, 0.15 * s);
    p.add(limb([0, 0, 0], [0.05, -0.55, 0], 0.1, 0.08, robe));
    p.add(oval(0.16, 0.09, 0.11, stone, 0.1, -0.61, 0, 11 + s));
    body.add(p);
    return p;
  });
  body.add(M.mesh(M.lathe([[0.18, 0.9], [0.25, 0.67], [0.32, 0.33], [0.35, 0.19]], 22), robe));
  body.add(oval(0.26, 0.35, 0.24, armour, 0, 1.18, 0, 20));
  body.add(M.mesh(new THREE.TorusGeometry(0.25, 0.035, 8, 24).rotateX(Math.PI / 2), trim, 0, 0.92, 0));
  for (const s of [-1, 1]) {
    body.add(oval(0.2, 0.11, 0.21, stone, -0.04, 1.42, 0.28 * s, 21 + s));
    body.add(limb([0, 1.38, 0.3 * s], [0.14, 0.84, 0.34 * s], 0.09, 0.07, skin));
    body.add(M.mesh(new THREE.ConeGeometry(0.07, 0.25, 8), M.glowMat(s > 0 ? '#87caff' : '#ffc075'), -0.02, 1.62, 0.3 * s));
  }
  const head = pivot(0.1, 1.62, 0);
  head.add(oval(0.17, 0.2, 0.17, skin, 0, 0, 0, 25));
  head.add(M.mesh(new THREE.ConeGeometry(0.23, 0.38, 16), armour, -0.04, 0.23, 0));
  head.add(M.mesh(M.scaled(M.G.sphere, 0.05, 0.03, 0.14), M.glowMat('#b7e8ff'), 0.14, 0.04, 0));
  body.add(head);
  const staff = pivot(0.1, 1.17, -0.34);
  staff.add(M.mesh(M.tube([[0, -0.98, 0], [0, 0.54, 0]], 0.04, 0.035, 2, 8), M.barkMat('#6e5741')));
  staff.add(oval(0.16, 0.19, 0.14, stone, 0, 0.61, 0, 29));
  staff.add(M.mesh(M.scaled(M.G.sphere, 0.1), M.glowMat('#d9c7ff'), 0, 0.69, 0));
  body.add(staff);
  const orbs = ['#8ed6ff', '#ecad60', '#96e378'].map((c, i) => {
    const p = pivot(0, 0, 0);
    p.add(M.mesh(M.scaled(M.G.sphere, 0.13), M.glowMat(c)));
    g.add(p);
    return p;
  });
  g.userData = { body, legL: legs[1], legR: legs[0], staff, anim: orbs, kind: 'hero',
    tick(dt, v, snap, world) {
      for (let i = 0; i < 3; i++) {
        const a = world.time * 1.7 + i * Math.PI * 2 / 3;
        orbs[i].position.set(Math.cos(a) * 1.05, 1.7 + Math.sin(a * 2) * 0.12, Math.sin(a) * 1.05);
      }
    } };
  return g;
}
registerSkin('uxgeomancer', geomancer);

registerTheme('uxelements',
  { sky: '#b7ac95', fog: '#aaa392', sun: '#fff1d0', hemi: ['#ecdfbf', '#424739'], sunI: 2 },
  { floor: { tex: 'tex_dirt.webp', tint: '#968b6b', color: '#80765e', units: 6 }, edge: { tex: 'tex_rock.webp', tint: '#8f887a', color: '#766c5e', units: 5 }, outer: { tex: 'tex_grass.webp', tint: '#738063', color: '#657155' }, edgeWidth: 1 });

registerMapBuilder('uxelemental', (map, world) => {
  const tile = 128 / 54;
  const g = new THREE.Group();
  const mats = {
    S: M.texMat('tex_dirt.webp', '#987956', '#c0a474', 1),
    I: M.texMat('tex_ice.webp', '#9ad0d8', '#d6f6ff', 1),
    G: M.texMat('tex_grass.webp', '#5d9351', '#8acb69', 1),
    R: M.texMat('tex_rock.webp', '#706f65', '#a9a49a', 1),
    M: M.texMat('tex_marble.webp', '#d4cbb7', '#fff0d5', 1),
  };
  for (let r = 0; r < 11; r++) for (let c = 0; c < 11; c++) {
    const ch = GRID[r][c];
    const x = (c - 5) * tile;
    const z = (r - 5) * tile;
    const p = M.mesh(new THREE.PlaneGeometry(tile, tile).rotateX(-Math.PI / 2), mats[ch], x, 0.045, z);
    g.add(p);
    if (ch === 'M') g.add(M.mesh(new THREE.RingGeometry(0.5, 0.6, 32).rotateX(-Math.PI / 2), M.goldMat(), x, 0.07, z));
  }
  bakeStatic(g, { castShadow: false });
  world.mapGroup.add(g);
  fence(map, world, map.floor.w / 2 - 0.2, map.floor.h / 2 - 0.2, { stone: '#817e73', height: 1.65 });
});

registerEvent('uxelement', (e, world) => {
  const color = { S: '#fff2a0', I: '#9cecff', G: '#7add67', R: '#d2a16c', M: '#e9dcff' }[e.e];
  world.fx.ring(e.x, e.y, e.e === 'M' ? 3 : 2, color, 0.5);
  world.fx.burst(e.x, 1, e.y, color, { n: 18, speed: 4, size: 0.28, life: 0.55 });
});
registerEvent('uxstarfall', (e, world) => {
  world.fx.burst(e.x, 3, e.y, '#d4c4ff', { n: 28, speed: 5, size: 0.35, life: 0.8 });
  world.fx.shockwave(e.x, e.y, 6, '#e4d8ff');
});
