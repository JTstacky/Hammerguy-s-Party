// Milton's forest bomb: a visible fuse, eight peasants, and the relentless attacker.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { registerSkin, registerView, registerEvent, registerMapBuilder, registerTheme } from '../../engine/client/render/registry.js';
import { pivot, limb, oval } from './ux4-common.js';

function peasant(color) {
  const g = new THREE.Group();
  const body = pivot(0, 0, 0);
  body.scale.setScalar(1.12);
  g.add(body);
  const skin = M.mat('#e0bc90', { roughness: 0.72 });
  const tunic = M.leatherMat('#b3a078');
  const brown = M.leatherMat('#574738');
  const team = M.mat(color, { roughness: 0.62 });
  const metal = M.plateMat('#8196a1');
  const legs = [-1, 1].map((s) => {
    const p = pivot(0, 0.65, s * 0.17);
    p.add(limb([0, 0, 0], [0.04, -0.52, 0], 0.11, 0.08, brown));
    p.add(oval(0.18, 0.09, 0.12, brown, 0.11, -0.55, 0));
    body.add(p);
    return p;
  });
  body.add(oval(0.31, 0.39, 0.24, tunic, 0, 1.1, 0));
  body.add(M.mesh(new THREE.TorusGeometry(0.26, 0.04, 8, 24).rotateX(Math.PI / 2), team, 0, 0.8, 0));
  body.add(oval(0.2, 0.22, 0.18, skin, 0.12, 1.59, 0));
  body.add(M.mesh(M.scaled(M.G.sphere, 0.22, 0.09, 0.2), brown, 0.04, 1.82, 0));
  body.add(oval(0.12, 0.07, 0.12, brown, 0.26, 1.46, 0));
  for (const s of [-1, 1]) body.add(limb([0, 1.42, s * 0.27], [0.15, 0.83, s * 0.35], 0.1, 0.07, skin));
  const shield = pivot(0.34, 0.95, -0.39);
  shield.add(M.mesh(M.scaled(M.G.sphere, 0.08, 0.45, 0.38), metal));
  shield.add(M.mesh(M.scaled(M.G.sphere, 0.09, 0.13, 0.13), team, 0.08, 0, 0));
  body.add(shield);
  g.userData = { body, legL: legs[1], legR: legs[0], staff: shield, kind: 'hero' };
  return g;
}
registerSkin('uxpeasant', peasant);

function barrel() {
  const g = new THREE.Group();
  const wood = M.barkMat('#875533');
  const iron = M.plateMat('#383b39');
  const fuse = M.glowMat('#ffb246');
  g.add(M.mesh(M.lathe([[0.2, 0], [0.53, 0.05], [0.61, 0.35], [0.61, 0.8], [0.52, 1.05], [0.2, 1.08]], 24), wood));
  for (const y of [0.23, 0.89]) g.add(M.mesh(new THREE.TorusGeometry(0.61, 0.055, 7, 28).rotateX(Math.PI / 2), iron, 0, y, 0));
  g.add(M.mesh(M.scaled(M.G.cyl, 0.12, 0.1, 0.12), iron, 0, 1.1, 0));
  g.add(M.mesh(M.tube([[0, 1.12, 0], [0.07, 1.35, 0]], 0.035, 0.025, 2, 8), iron));
  g.add(M.mesh(M.scaled(M.G.sphere, 0.09), fuse, 0.07, 1.37, 0));
  return g;
}

registerTheme('uxbombforest',
  { sky: '#726c54', fog: '#77745d', sun: '#ffd79a', hemi: ['#dfcaa1', '#2f3324'], sunI: 1.5 },
  { floor: { tex: 'tex_grass.webp', tint: '#799069', color: '#536c42', units: 5 }, edge: { tex: 'tex_dirt.webp', tint: '#8c8068', color: '#73634e', units: 5 }, outer: { tex: 'tex_nightgrass.webp', tint: '#647255', color: '#3d4b35' }, edgeWidth: 1.2 });

registerMapBuilder('uxmilton', (map, world) => {
  const g = new THREE.Group();
  const dirt = M.triMat('tex_rock.webp', '#655c50', '#a18a69', 0.8);
  const wood = M.barkMat('#6e5035');
  const cloth = M.leatherMat('#7b6248');
  const fire = M.glowMat('#ff8e36');
  g.add(M.mesh(M.scaled(M.G.cyl, 1.5, 0.15, 1.5), dirt, 0, 0.04, 0));
  // Milton stands north of the barrel with a torch and a heavy striking mallet.
  g.add(oval(0.35, 0.48, 0.28, cloth, 0, 1.0, 1.85));
  g.add(oval(0.22, 0.22, 0.2, M.mat('#b98d6c'), 0.1, 1.56, 1.85));
  g.add(M.mesh(M.tube([[0.3, 0.85, 1.7], [0.65, 1.7, 1.45]], 0.05, 0.04, 2, 8), wood));
  g.add(M.mesh(M.scaled(M.G.box, 0.4, 0.25, 0.22), dirt, 0.65, 1.73, 1.45));
  for (let i = 0; i < 22; i++) {
    const a = i * Math.PI * 2 / 22;
    const r = 7 + (i % 4) * 0.8;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const tree = M.tree(1.15 + (i % 3) * 0.11);
    tree.position.set(x, 0, z);
    g.add(tree);
  }
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    g.add(M.mesh(M.scaled(M.G.box, 0.16, 0.8, 0.16), wood, Math.cos(a) * 4.8, 0.4, Math.sin(a) * 4.8));
    g.add(M.mesh(M.scaled(M.G.sphere, 0.13), fire, Math.cos(a) * 4.8, 0.89, Math.sin(a) * 4.8));
  }
  bakeStatic(g);
  world.mapGroup.add(g);
});

registerView('uxbarrel', {
  make(e) { return barrel(); },
  update(v, a, b, k, dt, world) {
    v.obj.visible = !b.ex;
    v.spark = (v.spark || 0) + dt * (b.ex ? 0 : 7);
    while (v.spark >= 1) {
      v.spark--;
      world.fx.sparks(v.x, 1.4, v.z, 2, 1.2, b.hp < 6 ? '#ff4624' : '#ffc56d');
    }
  },
});
registerEvent('uxbarrelhit', (e, world) => {
  world.fx.sparks(e.x, 1.4, e.y, 12, 3, '#ffc474');
  world.shake = 0.08;
});
registerEvent('uxshield', (e, world) => {
  world.fx.ring(e.x, e.y, 1.2, '#99dfff', 0.5);
  world.fx.flash(e.x, e.y, 1, '#c7eeff', 0.25);
});
