// Push the Ogre (#19): the fat Ogre Warrior, the "!" before he retches, the
// plague cloud he leaves behind him, the four tree tiles the gas can fell and
// the rocky corners of the field. The goals are 'cop' circles (roadkill.js).

import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { cliffBlock, cliffMat, emit } from './race-kit.js';

// An Ogre Warrior: a huge gut on short, thick legs, long arms hanging to his
// knees, a small head with tusks and a topknot, a spiked pauldron and a
// studded club. Faces +X.
export function ogre() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = M.triMat('tex_hide.webp', '#c89070', '#f4c8a8', 1.1);
  const skinDark = M.triMat('tex_hide.webp', '#a87050', '#d8a888', 1.1);
  const leather = M.leatherMat('#d0b090');
  const fur = M.furMat('#6a5040');
  const iron = M.mat('#5a5a62', { metalness: 0.6, roughness: 0.45 });
  // Legs.
  const legs = [];
  for (const s of [1, -1]) {
    const hip = new THREE.Group();
    hip.position.set(-0.05, 0.85, 0.36 * s);
    hip.add(M.mesh(M.tube([[0, 0, 0], [0.06, -0.4, 0.02 * s], [0, -0.75, 0]], 0.26, 0.2, 6, 12), skin));
    hip.add(M.mesh(M.blob(0.28, 0.12, 0.2, { seed: 12 + (s > 0 ? 1 : 0) }), skinDark, 0.1, -0.8, 0));
    hip.add(M.mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.14, 14), leather, 0.03, -0.55, 0));
    legs.push(hip);
    body.add(hip);
  }
  // The gut, the chest and a leather belt with a buckle.
  const belly = M.mesh(M.blob(0.78, 0.72, 0.74, { seed: 3, amt: 0.05 }), skin, 0.12, 1.28, 0);
  body.add(belly);
  body.add(M.mesh(M.blob(0.62, 0.52, 0.8, { seed: 5, amt: 0.06 }), skin, -0.05, 1.9, 0));
  const belt = M.mesh(new THREE.TorusGeometry(0.72, 0.07, 8, 28), leather, 0.08, 0.95, 0);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1.05, 1.02, 1);
  body.add(belt);
  body.add(M.mesh(M.scaled(M.G.box, 0.08, 0.2, 0.26), M.goldMat(), 0.8, 0.95, 0));
  const loin = M.mesh(M.cloth(0.5, 0.5, 0.05, 0.05), M.mat('#6a3a24', { side: THREE.DoubleSide }), 0.72, 0.72, 0);
  loin.rotation.y = Math.PI;
  body.add(loin);
  body.add(M.mesh(M.cloth(0.7, 0.45, 0.2, 0.05), M.mat('#5a3220', { side: THREE.DoubleSide }), -0.6, 0.75, 0));
  // Head: a low brow, a jutting jaw with tusks, little eyes, a black topknot.
  const head = new THREE.Group();
  head.position.set(0.42, 2.35, 0);
  head.add(M.mesh(M.blob(0.3, 0.28, 0.3, { seed: 7 }), skin, 0, 0, 0));
  head.add(M.mesh(M.blob(0.24, 0.14, 0.26, { seed: 8 }), skinDark, 0.14, -0.18, 0));
  head.add(M.mesh(M.blob(0.12, 0.09, 0.1, { seed: 9 }), skinDark, 0.3, 0.02, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.tube([[0.28, -0.22, 0.12 * s], [0.36, -0.08, 0.15 * s], [0.34, 0.04, 0.12 * s]], 0.045, 0.01, 6, 8), M.boneMat()));
    head.add(M.mesh(M.scaled(M.G.sphere, 0.04), M.glowMat('#ffe060'), 0.27, 0.1, 0.11 * s));
    head.add(M.mesh(M.blob(0.08, 0.1, 0.05, { seed: 10 }), skin, -0.02, 0.05, 0.3 * s));
  }
  head.add(M.mesh(M.tube([[-0.05, 0.22, 0], [-0.15, 0.45, 0], [-0.35, 0.5, 0], [-0.45, 0.3, 0]], 0.08, 0.03, 10, 8), M.mat('#1a1410', { roughness: 0.9 })));
  body.add(head);
  // Arms: shoulders like boulders, forearms to the knee, a club in the right fist.
  const arms = [];
  for (const s of [1, -1]) {
    const arm = new THREE.Group();
    arm.position.set(0.0, 2.05, 0.78 * s);
    arm.add(M.mesh(M.blob(0.3, 0.28, 0.3, { seed: 14 }), skin, 0, 0, 0));
    arm.add(M.mesh(M.tube([[0, -0.05, 0.05 * s], [0.08, -0.55, 0.14 * s], [0.18, -1.0, 0.12 * s]], 0.2, 0.17, 8, 12), skin));
    arm.add(M.mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.25, 14), leather, 0.15, -0.85, 0.12 * s));
    arm.add(M.mesh(M.blob(0.19, 0.17, 0.18, { seed: 15 }), skinDark, 0.2, -1.12, 0.12 * s));
    if (s < 0) {
      const club = new THREE.Group();
      club.position.set(0.22, -1.12, 0.12 * s);
      club.add(M.mesh(M.tube([[0, 0.1, 0], [0.35, 0.05, 0], [0.9, -0.05, 0]], 0.06, 0.16, 8, 10), M.texMat('tex_wood.webp', '#5a3a1e', '#c8a888')));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const sp = M.mesh(M.scaled(M.G.cone, 0.04, 0.14, 0.04), iron, 0.72 + (i % 2) * 0.12, -0.03 + Math.cos(a) * 0.15, Math.sin(a) * 0.15);
        sp.rotation.x = a;
        club.add(sp);
      }
      club.rotation.z = -0.9;
      arm.add(club);
    } else {
      // A spiked iron pauldron on the left shoulder.
      arm.add(M.mesh(new THREE.SphereGeometry(0.34, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), iron, 0, 0.05, 0));
      for (let i = 0; i < 3; i++) arm.add(M.mesh(M.scaled(M.G.cone, 0.05, 0.22, 0.05), iron, -0.15 + i * 0.15, 0.36, 0.05));
    }
    arms.push(arm);
    body.add(arm);
  }
  // Fur on his back.
  body.add(M.mesh(M.blob(0.4, 0.3, 0.6, { seed: 21 }), fur, -0.42, 2.0, 0));
  // WC3's "!" over his head (TalkToMe), shown while he gags.
  const bang = new THREE.Group();
  const gold = M.glowMat('#ffd21a');
  bang.add(M.mesh(M.lathe([[0.01, 0], [0.13, 0.12], [0.1, 0.8], [0.01, 0.82]], 12), gold, 0, 0.35, 0));
  bang.add(M.mesh(M.scaled(M.G.sphere, 0.12), gold, 0, 0.12, 0));
  bang.position.y = 3.3;
  bang.visible = false;
  g.add(bang);
  g.userData = { body, legs, arms, head, belly, bang };
  return g;
}

registerView('ogre', {
  make(e, world, v) {
    const g = ogre();
    g.userData.body.scale.setScalar(1.12);
    v.parts = g.userData;
    v.t = 0;
    return g;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    v.t += dt;
    const moving = !!b.mv;
    // A pushed ogre slides without walking; any motion still waddles a bit.
    const speed = v.last ? Math.hypot(v.x - v.last[0], v.z - v.last[1]) / Math.max(dt, 1e-3) : 0;
    v.last = [v.x, v.z];
    const gait = moving || speed > 0.3;
    v.walk = (v.walk || 0) + dt * (gait ? 5 : 0);
    P.legs.forEach((l, i) => (l.rotation.z = gait ? Math.sin(v.walk + i * Math.PI) * 0.35 : 0));
    P.arms.forEach((ar, i) => (ar.rotation.z = gait ? Math.sin(v.walk + i * Math.PI) * 0.2 : Math.sin(v.t * 1.3 + i) * 0.04));
    P.body.position.y = gait ? Math.abs(Math.sin(v.walk)) * 0.06 : 0;
    P.body.rotation.x = gait ? Math.sin(v.walk) * 0.05 : 0;
    // Breathing, and heaving before he retches.
    const warn = !!b.w;
    const heave = warn ? Math.sin(v.t * 14) * 0.06 : Math.sin(v.t * 1.8) * 0.02;
    P.belly.scale.set(1 + heave, 1 + heave * 0.5, 1 + heave);
    P.head.rotation.z = warn ? -0.35 + Math.sin(v.t * 14) * 0.12 : 0;
    P.bang.visible = warn;
    if (warn) {
      P.bang.position.y = 3.3 + Math.abs(Math.sin(v.t * 6)) * 0.25;
      P.bang.rotation.y = v.t * 3;
      if (emit(v, 'drool', 12, dt)) world.fx.trail(v.x + Math.cos(-v.obj.rotation.y) * 0.9, 2.2, v.z + Math.sin(-v.obj.rotation.y) * 0.9, '#9ad84a', 0.35, 0.6, 0.1);
    }
    if (speed > 0.8 && emit(v, 'dust', 8, dt)) world.fx.smokePuff(v.x, 0.2, v.z, '#8a7a5a', 1, 0.8, 0.3);
  },
});

// The plague cloud: a sickly green murk sitting where it was released.
registerView('plaguecloud', {
  make(e, world, v) {
    const g = new THREE.Group();
    const r = e.r || 3.5;
    const fill = new THREE.Mesh(new THREE.CircleGeometry(r, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#4a8a1a', transparent: true, opacity: 0.35, depthWrite: false }));
    fill.position.y = 0.06;
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.94, r, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#b8ff5a', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.position.y = 0.07;
    g.add(fill, ring);
    v.parts = { fill, ring, r };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const { r } = v.parts;
    v.obj.rotation.y = 0;
    const life = Math.min(1, (b.t ?? 1) / 0.3);
    v.parts.fill.material.opacity = 0.32 * life;
    v.parts.ring.material.opacity = (0.5 + Math.sin(world.time * 10) * 0.2) * life;
    for (let n = emit(v, 'murk', 60, dt); n > 0; n--) {
      const ang = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * r * 0.9;
      world.fx.smokePuff(v.x + Math.cos(ang) * rr, 0.3 + Math.random() * 0.8, v.z + Math.sin(ang) * rr, Math.random() < 0.5 ? '#5a9a22' : '#3a6a18', 1.8, 1.3, 0.55);
    }
    for (let n = emit(v, 'bubble', 25, dt); n > 0; n--) {
      const ang = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * r;
      world.fx.trail(v.x + Math.cos(ang) * rr, 0.3, v.z + Math.sin(ang) * rr, '#b8ff5a', 0.4, 0.8, 0.2);
    }
  },
});

// A single tree tile in the field; the gas fells it.
registerView('pushtree', {
  make() {
    const g = new THREE.Group();
    const t = M.tree(1.15);
    g.add(t);
    return g;
  },
  update(v) {
    v.obj.rotation.y = 0;
  },
});

registerEvent('ogrewarn', (e, world) => {
  play('kodo');
  world.fx.text(e.x, 3.6, e.y, 'Blurgh...', '#b8ff5a');
});

registerEvent('ogregas', (e, world) => {
  const fx = world.fx;
  fx.burst(e.x, 0.8, e.y, '#8ad83a', { n: 60, speed: 6, size: 1, life: 0.8, additive: false, up: 0.5 });
  fx.dustCloud(e.x, e.y, e.r * 0.5, '#4a7a20', 16);
  fx.shockwave(e.x, e.y, e.r, '#b8ff5a', 0.5);
  play('splash');
});

registerEvent('treefall', (e, world) => {
  const fx = world.fx;
  fx.debrisBurst(e.x, e.y, 12, 4);
  fx.dustCloud(e.x, e.y, 1.2, '#4a5a2a', 12);
  fx.burst(e.x, 1.5, e.y, '#6a8a3a', { n: 30, speed: 4, size: 0.5, life: 0.9, additive: false });
  play('squish');
});

registerMapBuilder('pushogre', (map, world) => {
  const G = world.mapGroup;
  const mat = cliffMat('tex_grass.webp', '#9aae84');
  map.po.corners.forEach(([x0, y0, x1, y1], i) => {
    // Grow each corner outward only, so the rock matches the unwalkable tile inside.
    const sx = Math.sign(x0 + x1);
    const sy = Math.sign(y0 + y1);
    G.add(cliffBlock(sx < 0 ? x0 - 2 : x0 + 0.3, sy < 0 ? y0 - 2 : y0 + 0.3, sx > 0 ? x1 + 2 : x1 - 0.3, sy > 0 ? y1 + 2 : y1 - 0.3, 1.2, { mat, seed: 11 + i, rough: 0.25, round: 1.2 }));
    const t = M.tree(0.9);
    t.position.set((x0 + x1) / 2, 1.3, (y0 + y1) / 2);
    G.add(t);
  });
});
