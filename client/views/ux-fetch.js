// Night forest hunt, with a long-snouted felhound and the small fleeing Child.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { registerSkin, registerEvent, registerMapBuilder, registerTheme } from '../../engine/client/render/registry.js';
import { pivot, limb, oval, fence } from './ux4-common.js';

function felhound(color) {
  const g = new THREE.Group();
  const body = pivot(0, 0, 0);
  body.scale.setScalar(1.5);
  g.add(body);
  const hide = M.hideMat('#5a4b65');
  const dark = M.furMat('#342d46');
  const bone = M.boneMat('#e0c8a2');
  const glow = M.glowMat('#ed9353');
  const team = M.mat(color, { roughness: 0.65 });
  const legs = [];
  for (const x of [-0.62, 0.52]) for (const s of [-1, 1]) {
    const p = pivot(x, 0.67, s * 0.31);
    p.add(limb([0, 0, 0], [x < 0 ? -0.1 : 0.12, -0.54, s * 0.03], 0.13, 0.08, hide));
    p.add(oval(0.24, 0.09, 0.13, dark, 0.16, -0.58, 0));
    body.add(p);
    legs.push(p);
  }
  body.add(oval(0.87, 0.39, 0.36, hide, -0.03, 0.9, 0));
  body.add(oval(0.43, 0.48, 0.4, dark, 0.46, 1.0, 0));
  body.add(M.mesh(new THREE.TorusGeometry(0.38, 0.055, 8, 28).rotateX(Math.PI / 2), team, 0.4, 1.1, 0));
  body.add(oval(0.33, 0.26, 0.27, hide, 0.87, 1.22, 0));
  body.add(oval(0.48, 0.13, 0.16, dark, 1.13, 1.06, 0));
  body.add(oval(0.13, 0.1, 0.17, dark, 1.5, 1.08, 0));
  for (const s of [-1, 1]) {
    body.add(M.mesh(new THREE.ConeGeometry(0.12, 0.4, 12), dark, 0.77, 1.53, s * 0.23));
    body.add(M.mesh(M.scaled(M.G.sphere, 0.055), glow, 1.04, 1.29, s * 0.22));
    for (let i = 0; i < 3; i++) body.add(M.mesh(new THREE.ConeGeometry(0.035, 0.16, 7).rotateZ(Math.PI / 2), bone, 1.12 + i * 0.11, 0.99, s * 0.14));
    body.add(M.mesh(new THREE.ConeGeometry(0.07, 0.24, 9).rotateZ(-Math.PI / 5), bone, 0.2, 1.31, s * 0.37));
  }
  const tail = pivot(-0.75, 1.05, 0);
  tail.add(M.mesh(M.tube([[0, 0, 0], [-0.5, 0.15, 0], [-0.75, 0.55, 0]], 0.17, 0.06, 10, 8), dark));
  body.add(tail);
  g.userData = { body, legL: legs[2], legR: legs[3], anim: [tail], kind: 'hero',
    tick(dt, v, snap, world) { tail.rotation.y = Math.sin(world.time * 6 + v.x) * 0.23; } };
  return g;
}

function child(color) {
  const g = new THREE.Group();
  const body = pivot(0, 0, 0);
  body.scale.setScalar(0.85);
  g.add(body);
  const skin = M.mat('#e8c6a5', { roughness: 0.7 });
  const cloth = M.leatherMat('#e7a3ae');
  const hair = M.furMat('#5b413b');
  const team = M.mat(color, { roughness: 0.65 });
  const legs = [-1, 1].map((s) => {
    const p = pivot(0, 0.45, s * 0.12);
    p.add(limb([0, 0, 0], [0.05, -0.36, 0], 0.08, 0.06, skin));
    p.add(oval(0.13, 0.07, 0.1, hair, 0.1, -0.39, 0));
    body.add(p);
    return p;
  });
  body.add(M.mesh(M.lathe([[0.12, 0.82], [0.18, 0.65], [0.33, 0.21]], 18), cloth));
  body.add(oval(0.23, 0.28, 0.2, cloth, 0, 0.83, 0));
  body.add(oval(0.21, 0.22, 0.2, skin, 0.1, 1.27, 0));
  body.add(oval(0.23, 0.12, 0.23, hair, 0.02, 1.46, 0));
  for (const s of [-1, 1]) {
    body.add(limb([0, 1.02, s * 0.22], [0.14, 0.55, s * 0.3], 0.07, 0.05, skin));
    body.add(M.mesh(M.scaled(M.G.sphere, 0.04), M.mat('#293344'), 0.28, 1.3, s * 0.11));
  }
  body.add(M.mesh(new THREE.TorusGeometry(0.2, 0.045, 8, 20).rotateX(Math.PI / 2), team, 0, 0.82, 0));
  const charm = pivot(0.34, 0.75, 0.26);
  charm.add(M.mesh(M.scaled(M.G.sphere, 0.13), M.glowMat('#ff72bd')));
  body.add(charm);
  g.userData = { body, legL: legs[1], legR: legs[0], staff: charm, kind: 'hero' };
  return g;
}
registerSkin('uxfelhound', felhound);
registerSkin('uxchild', child);

registerTheme('uxdarkforest',
  { sky: '#111d30', fog: '#17283a', sun: '#86a7c9', hemi: ['#7892b5', '#182923'], sunI: 1.1 },
  { floor: { tex: 'tex_nightgrass.webp', tint: '#527069', color: '#253e3b', units: 5 }, edge: { tex: 'tex_dirt.webp', tint: '#66706b', color: '#39423e', units: 5 }, outer: { tex: 'tex_nightgrass.webp', tint: '#344d49', color: '#162e2c' }, edgeWidth: 1.5 });

registerMapBuilder('uxfetch', (map, world) => {
  fence(map, world, 800 / 54 - 0.4, 800 / 54 - 0.4, { stone: '#485161', cap: '#617580', height: 1.45 });
  const g = new THREE.Group();
  const bark = M.barkMat('#414440');
  const glow = M.glowMat('#76c7ad');
  // The map's symmetric pillar trees leave lanes between a central clearing
  // and the forest wall. Trees are visual obstacles; the path is walkable.
  const rings = [[5.0, 8], [9.1, 16]];
  for (const [r, n] of rings) for (let i = 0; i < n; i++) {
    const a = i * Math.PI * 2 / n + (n === 16 ? 0.13 : 0);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const tree = M.tree(1.0 + (i % 4) * 0.13);
    tree.position.set(x, 0, z);
    g.add(tree);
    if (i % 3 === 0) g.add(M.mesh(M.scaled(M.G.sphere, 0.075), glow, x + 0.28, 1.5, z));
  }
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    g.add(M.mesh(M.scaled(M.G.cyl, 0.3, 0.23, 0.3), bark, Math.cos(a) * 3.2, 0.12, Math.sin(a) * 3.2));
  }
  bakeStatic(g);
  world.mapGroup.add(g);
});

registerEvent('uxcurse', (e, world) => {
  world.fx.ring(e.x, e.y, 1.8, '#ff75bd', 0.65);
  world.fx.burst(e.x, 1.2, e.y, '#ff9acc', { n: 22, speed: 3, size: 0.3, life: 0.65 });
});
registerEvent('uxpass', (e, world) => {
  world.fx.flash(e.x, e.y, 1.2, '#ff76ba', 0.35);
  world.fx.flash(e.tx, e.ty, 1.2, '#ff76ba', 0.35);
  world.fx.sparks(e.tx, 1.2, e.ty, 20, 4, '#ffd1ed');
});
