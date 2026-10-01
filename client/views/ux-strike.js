// Anonymous Seers and the magical pen that contracts for deathmatch.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { registerSkin, registerView, registerEvent, registerMapBuilder, registerTheme } from '../../engine/client/render/registry.js';
import { pivot, limb, oval } from './ux4-common.js';

function seer() {
  const g = new THREE.Group();
  const body = pivot(0, 0, 0);
  body.scale.setScalar(1.35);
  g.add(body);
  const fur = M.furMat('#a77b58');
  const robe = M.leatherMat('#534d78');
  const trim = M.goldMat('#bfaa66');
  const glow = M.glowMat('#e1b7ff');
  const legs = [-1, 1].map((s) => {
    const p = pivot(-0.03, 0.63, 0.18 * s);
    p.add(limb([0, 0, 0], [0.03, -0.52, 0], 0.1, 0.08, fur));
    p.add(oval(0.16, 0.07, 0.11, robe, 0.12, -0.56, 0, 4 + s));
    body.add(p);
    return p;
  });
  body.add(M.mesh(M.lathe([[0.18, 0.85], [0.27, 0.68], [0.33, 0.25], [0.35, 0.2]], 22), robe));
  body.add(oval(0.27, 0.36, 0.28, robe, 0, 1.16, 0, 11));
  body.add(M.mesh(new THREE.TorusGeometry(0.29, 0.025, 8, 28).rotateX(Math.PI / 2), trim, 0, 0.86, 0));
  const head = pivot(0.11, 1.55, 0);
  head.add(oval(0.2, 0.22, 0.2, fur, 0, 0, 0, 12));
  head.add(oval(0.2, 0.12, 0.19, fur, 0.12, -0.09, 0, 13));
  // Tauren-like horns, broad from above, distinguish the Seer silhouette.
  for (const s of [-1, 1]) {
    head.add(M.mesh(M.tube([[-0.06, 0.15, 0.16 * s], [-0.1, 0.33, 0.33 * s], [-0.02, 0.43, 0.45 * s]], 0.08, 0.015, 10, 8), M.boneMat('#e7dabb')));
    head.add(M.mesh(M.scaled(M.G.sphere, 0.035), glow, 0.18, 0.02, 0.12 * s));
    body.add(oval(0.2, 0.13, 0.21, robe, -0.04, 1.43, 0.3 * s, 17 + s));
  }
  body.add(head);
  const staff = pivot(0.1, 1.15, -0.42);
  staff.add(M.mesh(M.tube([[0, -0.85, 0], [0, 0.5, 0], [0.04, 0.8, 0]], 0.045, 0.025, 7, 8), M.barkMat('#58412f')));
  staff.add(M.mesh(M.scaled(M.G.sphere, 0.16), glow, 0.04, 0.91, 0));
  for (const s of [-1, 1]) staff.add(M.mesh(new THREE.ConeGeometry(0.06, 0.24, 8), trim, 0.04, 0.76, 0.14 * s));
  body.add(staff);
  g.userData = { body, legL: legs[1], legR: legs[0], staff, kind: 'hero' };
  return g;
}
registerSkin('uxseer', seer);

function pen(hx, hy, color) {
  const g = new THREE.Group();
  const pillar = M.plateMat('#797385');
  const rune = M.glowMat(color);
  for (let side = 0; side < 4; side++) {
    const vertical = side >= 2;
    const sign = side % 2 ? 1 : -1;
    const fixed = (vertical ? hx : hy) * sign;
    const span = vertical ? hy : hx;
    const n = vertical ? 7 : 9;
    for (let i = 0; i <= n; i++) {
      const p = -span + 2 * span * i / n;
      const x = vertical ? fixed : p;
      const z = vertical ? p : fixed;
      g.add(oval(0.2, 0.85, 0.2, pillar, x, 0.85, z, i + side * 19));
      g.add(M.mesh(M.scaled(M.G.sphere, 0.18), rune, x, 1.65, z));
      if (i < n) {
        const middle = p + span / n;
        g.add(M.mesh(M.scaled(M.G.box, vertical ? 0.09 : 2 * span / n, 0.06, vertical ? 2 * span / n : 0.09), rune,
          vertical ? fixed : middle, 1.12, vertical ? middle : fixed));
      }
    }
  }
  bakeStatic(g);
  return g;
}

registerTheme('uxpen',
  { sky: '#37324c', fog: '#554d69', sun: '#d9cbff', hemi: ['#c7bbed', '#423248'], sunI: 2.1 },
  { floor: { tex: 'tex_marble.webp', tint: '#aaa2b8', color: '#8d849c', units: 5 }, edge: { tex: 'tex_stone.webp', tint: '#81798c', color: '#6f687c', units: 5 }, outer: { tex: 'tex_rock.webp', tint: '#5b5369', color: '#4a4058' }, edgeWidth: 0.8 });

registerMapBuilder('uxstrike', (map, world) => {
  const roster = window.game?.state.lobby?.players;
  world.uxSeerRoster = roster?.map((p) => ({ p, name: p.name, slot: p.slot }));
  for (const p of roster || []) {
    p.name = 'Seer';
    p.slot = 11; // The original temporarily assigns every player WC3 brown.
  }
  world.uxSeerNames = world.names;
  world.uxSeerColors = world.colors;
  world.names = Object.fromEntries(Object.keys(world.names).map((id) => [id, 'Seer']));
  world.colors = Object.fromEntries(Object.keys(world.colors).map((id) => [id, '#7a4a14']));
  const outer = pen(560 / 54, 528 / 54, '#d1a6ff');
  const inner = pen(480 / 54, 448 / 54, '#ff789b');
  outer.name = 'uxstrikeouter';
  inner.name = 'uxstrikeinner';
  inner.visible = false;
  world.mapGroup.add(outer, inner);
});

registerView('uxstrikezone', {
  make() { return new THREE.Group(); },
  update(v, a, b, k, dt, world) {
    const inner = world.mapGroup.getObjectByName('uxstrikeinner');
    const outer = world.mapGroup.getObjectByName('uxstrikeouter');
    if (inner && outer) { inner.visible = !!b.d; outer.visible = !b.d; }
  },
  remove(v, world) {
    for (const item of world.uxSeerRoster || []) {
      item.p.name = item.name;
      item.p.slot = item.slot;
    }
    if (world.uxSeerNames) world.names = world.uxSeerNames;
    if (world.uxSeerColors) world.colors = world.uxSeerColors;
  },
});
registerEvent('uxlightning', (e, world) => {
  world.fx.flash(e.tx, e.ty, 1.6, '#d3a5ff', 0.2);
  world.fx.sparks(e.tx, 1.3, e.ty, 16, 6, '#d6c7ff');
});
registerEvent('uxdeathmatch', (e, world) => {
  world.fx.shockwave(0, 0, 8, '#ff8ca9');
  world.shake = 0.4;
});
