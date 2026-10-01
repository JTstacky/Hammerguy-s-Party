// Mathogs, the bomb-carrying sapper, and the walled dawn clearing.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin, registerView, registerEvent, registerMapBuilder, registerTheme } from '../../engine/client/render/registry.js';
import { pivot, limb, oval, fence } from './ux4-common.js';

function mathog(color) {
  const g = new THREE.Group();
  const body = pivot(0, 0, 0);
  body.scale.setScalar(1.25);
  g.add(body);
  const hide = M.hideMat('#899b36');
  const dark = M.leatherMat('#54402d');
  const metal = M.plateMat('#8a857b');
  const bone = M.boneMat('#e8d6a5');
  const team = M.mat(color, { roughness: 0.7 });
  const legs = [-1, 1].map((s) => {
    const p = pivot(-0.06, 0.68, 0.22 * s);
    p.add(limb([0, 0, 0], [0.12, -0.52, 0.02 * s], 0.17, 0.13, hide));
    p.add(oval(0.24, 0.11, 0.15, dark, 0.23, -0.56, 0, 4 + s));
    return p;
  });
  body.add(...legs);
  body.add(oval(0.42, 0.48, 0.34, hide, 0, 1.05, 0, 11));
  body.add(oval(0.35, 0.24, 0.28, dark, 0, 0.73, 0, 12));
  body.add(M.mesh(new THREE.TorusGeometry(0.34, 0.055, 8, 24).rotateX(Math.PI / 2), team, 0, 0.77, 0));
  // Massive asymmetric shoulder plates and a heavy hunched neck.
  for (const s of [-1, 1]) {
    body.add(oval(0.25, 0.16, 0.27, metal, -0.06, 1.39, 0.36 * s, 20 + s));
    body.add(limb([0, 1.32, 0.45 * s], [0.17, 0.76, 0.48 * s], 0.15, 0.11, hide));
    body.add(oval(0.13, 0.13, 0.12, hide, 0.2, 0.67, 0.48 * s, 23 + s));
    body.add(M.mesh(new THREE.ConeGeometry(0.08, 0.3, 10), bone, -0.05, 1.56, 0.4 * s));
  }
  const head = pivot(0.26, 1.47, 0);
  head.add(oval(0.24, 0.23, 0.23, hide, 0, 0, 0, 31));
  head.add(oval(0.22, 0.1, 0.2, hide, 0.16, -0.13, 0, 32));
  for (const s of [-1, 1]) {
    head.add(M.mesh(new THREE.ConeGeometry(0.07, 0.39, 10), bone, -0.12, 0.27, 0.17 * s));
    head.add(M.mesh(M.scaled(M.G.sphere, 0.05), M.glowMat('#f7b82b'), 0.19, 0.02, 0.12 * s));
    head.add(M.mesh(new THREE.ConeGeometry(0.035, 0.12, 8), bone, 0.23, -0.13, 0.12 * s));
  }
  body.add(head);
  // The Mathog has no attack; its conspicuous metal bracers sell its Blink.
  const staff = pivot(0.05, 0.96, -0.47);
  staff.add(oval(0.16, 0.13, 0.15, metal, 0.1, -0.05, 0, 36));
  staff.add(M.mesh(M.scaled(M.G.sphere, 0.12), M.glowMat('#59edff'), 0.15, -0.06, 0));
  body.add(staff);
  g.userData = { body, legL: legs[1], legR: legs[0], staff, kind: 'hero' };
  return g;
}
registerSkin('uxmathog', mathog);

function sapper() {
  const g = new THREE.Group();
  const green = M.hideMat('#6ca944');
  const leather = M.leatherMat('#715139');
  const iron = M.plateMat('#524b43');
  g.add(oval(0.28, 0.32, 0.25, green, 0.04, 0.7, 0, 41));
  g.add(oval(0.24, 0.2, 0.23, green, 0.17, 1.13, 0, 42));
  g.add(oval(0.29, 0.34, 0.28, iron, -0.27, 0.79, 0, 43));
  g.add(M.mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.35, 12), leather, -0.29, 1.15, 0));
  for (const s of [-1, 1]) {
    g.add(M.mesh(new THREE.ConeGeometry(0.07, 0.26, 8), green, 0.05, 1.25, 0.22 * s));
    g.add(oval(0.13, 0.08, 0.12, leather, 0.12, 0.14, 0.19 * s, 44 + s));
    g.add(M.mesh(M.scaled(M.G.sphere, 0.035), M.glowMat('#ff4a10'), 0.34, 1.17, 0.12 * s));
  }
  return g;
}
registerView('uxsapper', {
  make(e) { return sapper(); },
  update(v, a, b, k, dt, world) {
    v.obj.position.y = b.p ? 0 : Math.sin(world.time * 11) * 0.04;
    v.smoke = (v.smoke || 0) + dt * (b.p ? 2 : 10);
    if (v.smoke > 1) { v.smoke--; world.fx.smokePuff(v.x - 0.25, 1.3, v.z, '#5a5148', 0.45, 0.5, 0.18); }
  },
});

registerEvent('uxblink', (e, world) => {
  world.fx.ring(e.x, e.y, 1.25, '#59eaff', 0.4);
  world.fx.burst(e.x, 1, e.y, '#9bf8ff', { n: 18, speed: 3, size: 0.25, life: 0.5 });
});

registerTheme('uxkeepdawn',
  { sky: '#c9a796', fog: '#b9a28c', sun: '#fff0c1', hemi: ['#fff2cc', '#504332'], sunI: 2 },
  { floor: { tex: 'tex_dirt.webp', tint: '#a79772', color: '#806b50', units: 5 }, edge: { tex: 'tex_rock.webp', tint: '#918276', color: '#685b54', units: 5 }, outer: { tex: 'tex_grass.webp', tint: '#72805c', color: '#526049' }, edgeWidth: 1.2 });
registerMapBuilder('uxkeep', (map, world) => fence(map, world, map.floor.w / 2 - 0.45, map.floor.h / 2 - 0.45,
  { stone: '#75695d', cap: '#807a67', height: 1.5 }));
