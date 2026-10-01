// #49 Clandestine Kitty: the Priestess of the Moon on her white nightsaber
// (player skin, with the stolen vial shown over her), the Doom Guards with
// their charmer's ring, the vials, the Ashenvale corridor of violet-crowned
// trees and the circle of power at home, and the Charm / Cripple / Rain of
// Fire effects.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerTheme, registerMapBuilder } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { unitBar, setBar, teamRing, doomGuard, animDoomGuard, emissive, mergeGeos, glow } from './up-kit.js';

// Ashenvale at night: a moonlit earth path between dark violet woods.
registerTheme(
  'kittynight',
  { sky: '#0a0c1e', fog: '#141a34', floor: ['#3a3a4a', 30, {}], outer: ['#1a1c30', 30, { blades: true }], sun: '#b0c0ff', hemi: ['#7a88d0', '#1a1424'], sunI: 1.8 },
  { floor: { tex: 'tex_dirt.webp', tint: '#7088d0', color: '#3a3a4a', units: 6 }, edge: { tex: 'tex_dirt.webp', tint: '#6a6890', color: '#2a2a3a', units: 5 }, outer: { tex: 'tex_nightgrass.webp', tint: '#7a78a8', color: '#1a1c30' }, edgeWidth: 1.2 },
);

// ------------------------------------------------------------ the vial

// A glass vial of glowing blue water with a cork, as the item model.
function vial(scale = 1) {
  const g = new THREE.Group();
  const shine = glow('#c8f0ff');
  const glass = M.mat('#bfe8ff', { roughness: 0.1, metalness: 0.1, emissive: '#3a8ad8', emissiveIntensity: 0.5 });
  g.add(M.mesh(M.lathe([[0.001, 0], [0.12, 0.01], [0.15, 0.1], [0.13, 0.2], [0.05, 0.28], [0.045, 0.36], [0.001, 0.36]], 14), glass));
  g.add(M.mesh(M.scaled(M.G.sphere, 0.1, 0.09, 0.1), shine, 0, 0.12, 0));
  g.add(M.mesh(M.scaled(M.G.cyl, 0.05, 0.08, 0.05), M.boneMat(), 0, 0.39, 0));
  g.scale.setScalar(scale);
  return g;
}

// ------------------------------------------------------------ Priestess

// The Priestess of the Moon (Emoo): a violet-skinned night elf with long
// blue-white hair in silver armour and a white cloak, bow in hand, riding a
// white nightsaber with faint lilac stripes. The saber's front legs are the
// world's legL / legR; the hind legs and tail are posed from userData.tick.
function priestess(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const fur = M.mat('#f2eefa', { roughness: 0.7 });
  const furDark = M.mat('#a890d8', { roughness: 0.7 });
  const silver = M.silverMat();
  const skin = M.mat('#a88ae0', { roughness: 0.55 });
  const cloak = M.mat('#34408a', { roughness: 0.75, side: THREE.DoubleSide });
  const hair = M.mat('#dce6ff', { roughness: 0.5 });
  const shine = glow('#c8f0ff');
  const team = M.mat(color, { roughness: 0.75, side: THREE.DoubleSide });
  const claw = M.boneMat();
  // Nightsaber
  body.add(M.mesh(M.blob(0.62, 0.26, 0.24, { seed: 51, amt: 0.04 }), fur, 0, 0.72, 0));
  body.add(M.mesh(M.blob(0.3, 0.27, 0.26, { seed: 52, amt: 0.04, detail: 2 }), fur, 0.42, 0.78, 0));
  for (let k = 0; k < 4; k++) {
    const st = M.mesh(new THREE.TorusGeometry(0.24, 0.025, 4, 16, Math.PI), furDark, -0.35 + k * 0.2, 0.74, 0);
    st.rotation.y = Math.PI / 2;
    body.add(st);
  }
  const head = new THREE.Group();
  head.position.set(0.78, 0.95, 0);
  head.add(M.mesh(M.blob(0.2, 0.17, 0.18, { seed: 53, amt: 0.04, detail: 2 }), fur, 0, 0, 0));
  head.add(M.mesh(M.blob(0.12, 0.09, 0.12, { seed: 54, detail: 2 }), fur, 0.16, -0.05, 0));
  head.add(M.mesh(M.scaled(M.G.sphere, 0.035), furDark, 0.27, -0.02, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.scaled(M.G.cone, 0.06, 0.12, 0.04), fur, -0.04, 0.17, 0.11 * s));
    head.add(M.mesh(M.scaled(M.G.sphere, 0.03), shine, 0.14, 0.05, 0.09 * s));
    const fang = M.mesh(M.scaled(M.G.cone, 0.018, 0.09, 0.018), claw, 0.2, -0.13, 0.05 * s);
    fang.rotation.z = Math.PI;
    head.add(fang);
  }
  body.add(head);
  const saberLeg = (x, s) => {
    const l = new THREE.Group();
    l.position.set(x, 0.66, 0.15 * s);
    l.add(M.mesh(M.tube([[0, 0, 0], [0.04, -0.3, 0], [0.0, -0.58, 0]], 0.1, 0.06, 6, 8), fur));
    l.add(M.mesh(M.blob(0.09, 0.05, 0.07, { seed: 55, detail: 1 }), fur, 0.05, -0.62, 0));
    return l;
  };
  const legL = saberLeg(0.42, 1);
  const legR = saberLeg(0.42, -1);
  const hindL = saberLeg(-0.45, 1);
  const hindR = saberLeg(-0.45, -1);
  body.add(legL, legR, hindL, hindR);
  const tail = new THREE.Group();
  tail.position.set(-0.6, 0.8, 0);
  tail.add(M.mesh(M.tube([[0, 0, 0], [-0.3, 0.1, 0], [-0.55, 0.3, 0.05], [-0.65, 0.5, 0]], 0.06, 0.035, 10, 6), fur));
  body.add(tail);
  // Saddle cloth in team colour.
  const saddle = M.mesh(M.cloth(0.42, 0.36, 0.2), team, 0.05, 0.88, 0);
  saddle.rotation.y = Math.PI / 2;
  body.add(saddle);
  // Rider
  const rider = new THREE.Group();
  rider.position.set(0.05, 1.0, 0);
  rider.add(M.mesh(M.lathe([[0.15, 0.0], [0.17, 0.12], [0.16, 0.32], [0.12, 0.45], [0.05, 0.5]], 14), silver));
  for (const s of [1, -1]) {
    rider.add(M.mesh(M.tube([[0, 0.02, 0.1 * s], [0.12, -0.12, 0.2 * s], [0.18, -0.3, 0.2 * s]], 0.06, 0.05, 6, 8), skin));
    const p = M.mesh(new THREE.SphereGeometry(0.065, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), silver, 0, 0.44, 0.15 * s);
    p.rotation.x = 0.5 * s;
    rider.add(p);
  }
  rider.add(M.mesh(M.scaled(M.G.sphere, 0.1, 0.12, 0.1), skin, 0.03, 0.6, 0));
  for (const s of [1, -1]) {
    rider.add(M.mesh(M.tube([[0, 0.62, 0.08 * s], [-0.08, 0.72, 0.18 * s], [-0.16, 0.8, 0.22 * s]], 0.025, 0.004, 8, 6), skin)); // ears
    rider.add(M.mesh(M.scaled(M.G.sphere, 0.015), shine, 0.12, 0.62, 0.04 * s));
  }
  rider.add(M.mesh(M.tube([[-0.02, 0.7, 0], [-0.14, 0.6, 0], [-0.2, 0.35, 0], [-0.24, 0.1, 0]], 0.07, 0.025, 10, 8), hair));
  rider.add(M.mesh(M.lathe([[0.001, 0.72], [0.09, 0.7], [0.11, 0.62]], 12), silver, 0.0, 0, 0)); // circlet cap
  rider.add(M.mesh(M.scaled(M.G.sphere, 0.025), shine, 0.1, 0.7, 0));
  const cape = M.mesh(M.cloth(0.34, 0.5, 0.15, 0.2), cloak, -0.14, 0.22, 0);
  rider.add(cape);
  body.add(rider);
  // Bow arm (left): a curved moon-elf bow, as staff.
  const bowArm = new THREE.Group();
  bowArm.position.set(0.05, 1.42, 0.16);
  bowArm.add(M.mesh(M.tube([[0, 0, 0], [0.16, -0.06, 0.06], [0.3, 0, 0.06]], 0.05, 0.04, 6, 8), skin));
  bowArm.add(M.mesh(M.tube([[0.32, -0.45, 0.06], [0.42, -0.2, 0.06], [0.33, 0, 0.06], [0.42, 0.2, 0.06], [0.32, 0.45, 0.06]], 0.025, 0.02, 16, 6), silver));
  bowArm.add(M.mesh(M.tube([[0.32, -0.45, 0.06], [0.32, 0.45, 0.06]], 0.005, 0.005, 2, 4), shine));
  body.add(bowArm);
  // The stolen vial, floating over her head while she carries it.
  const held = vial(1.4);
  held.position.set(0, 2.7, 0);
  held.visible = false;
  g.add(held);
  body.scale.setScalar(1.6);
  const st = { t: 0 };
  // Hind legs in counter-phase to the front legs, the tail sways; the vial
  // shows and bobs while she carries one. Nothing is allocated here.
  const tick = (dt, v, snap) => {
    st.t += dt;
    hindL.rotation.z = -legL.rotation.z;
    hindR.rotation.z = -legR.rotation.z;
    tail.rotation.y = Math.sin(st.t * 2.2) * 0.35;
    tail.rotation.z = Math.abs(legL.rotation.z) * 0.4;
    held.visible = !!snap?.vial;
    if (held.visible) {
      held.position.y = 2.7 + Math.sin(st.t * 3) * 0.08;
      held.rotation.y = st.t * 1.5;
    }
  };
  g.userData = { body, legL, legR, staff: bowArm, anim: [hindL, hindR, tail, held], tick, kind: 'hero' };
  return g;
}
registerSkin('priestess', priestess);

// ------------------------------------------------------------ vials

registerView('kittyvial', {
  make(e, world, v) {
    const g = new THREE.Group();
    const vl = vial(1.6);
    vl.position.y = 0.4;
    g.add(vl);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#7ad8ff', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
    beam.position.y = 1.5;
    g.add(beam);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#5ab8ff', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    glow.position.y = 0.05;
    g.add(glow);
    v.parts = { vl, beam };
    v.phase = Math.random() * 6;
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.obj.rotation.y = 0;
    const t = world.time + v.phase;
    v.parts.vl.position.y = 0.45 + Math.sin(t * 2.5) * 0.1;
    v.parts.vl.rotation.y = t;
    v.parts.beam.material.opacity = 0.12 + Math.sin(t * 3) * 0.04;
  },
});

// ------------------------------------------------------------ Doom Guards

registerView('kittyguard', {
  make(e, world, v) {
    const g = new THREE.Group();
    const model = doomGuard();
    model.scale.setScalar(1.3);
    g.add(model);
    v.parts = model.userData;
    unitBar(v, world, 60);
    return g;
  },
  update(v, a, b, k, dt, world) {
    // Charmed: its new master's ring (and it changes hands on a re-charm).
    if (b.o !== v.o) {
      if (v.ring) {
        v.obj.remove(v.ring);
        v.ring.geometry.dispose();
        v.ring.material.dispose();
      }
      v.ring = b.o != null ? teamRing(world.colors[b.o] || '#fff', 1.6) : null;
      if (v.ring) v.obj.add(v.ring);
      v.o = b.o;
    }
    setBar(v, b.h, !b.dead);
    if (v.ring) v.ring.visible = !b.dead;
    if (b.sw) v.castT = Math.max(v.castT || 0, 0.3);
    animDoomGuard(v, v.parts, b, dt, world.time);
    if (b.ch && Math.random() < dt * 12) world.fx.flame(v.x + (Math.random() - 0.5), 2.8, v.z + (Math.random() - 0.5), 0.6, 0.4, 0.2);
    if (b.st && Math.random() < dt * 8) world.fx.trail(v.x, 3 + Math.random() * 0.3, v.z, '#ffe060', 0.3, 0.4, 0.4);
  },
});

// ------------------------------------------------------------ the corridor

// Ashenvale trees: dark twisted trunks under layered violet-blue crowns,
// instanced (one mesh for trunks, one for crowns) so the corridor costs two
// draw calls. Home is a WC3 circle of power.
registerMapBuilder('kittycorridor', (map, world) => {
  const trees = map.trees || [];
  const n = trees.length;
  if (n) {
    const trunkGeo = mergeGeos([
      M.tube([[0, 0, 0], [0.1, 1.2, 0.05], [-0.05, 2.4, 0], [0.05, 3.2, 0]], 0.32, 0.14, 10, 8),
      M.tube([[0, 2.2, 0], [0.5, 2.9, 0.2], [0.8, 3.3, 0.3]], 0.1, 0.04, 6, 6),
      M.tube([[0, 2.0, 0], [-0.5, 2.7, -0.3], [-0.7, 3.2, -0.4]], 0.1, 0.04, 6, 6),
      M.lathe([[0.6, 0], [0.35, 0.25], [0.001, 0.5]], 8),
    ]);
    // A loose crown of leaf clumps round the branch tips, not a stack.
    const clumps = [[0.75, 3.35, 0.3, 0.75], [-0.7, 3.25, -0.4, 0.7], [0.1, 3.3, -0.75, 0.65], [-0.2, 3.4, 0.7, 0.68], [0.05, 4.0, 0.0, 0.85], [0.3, 4.6, -0.1, 0.55]];
    const crownGeo = mergeGeos(clumps.map(([x, y, z, r], i) => M.blob(r * 1.15, r * 0.8, r * 1.15, { seed: 71 + i, amt: 0.2, freq: 3.2, detail: 2 }).translate(x, y, z)));
    const trunkMat = M.texMat('tex_bark.webp', '#3a2a3a', '#a890b0', 1);
    const crownMat = M.triMat('tex_snow.webp', '#8a6ad8', '#b894ff', 1.1, { roughness: 0.85 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, n);
    const d = new THREE.Object3D();
    const tint = new THREE.Color();
    trees.forEach(([x, y], i) => {
      const h = ((i * 37) % 11) / 11;
      d.position.set(x + (h - 0.5) * 0.4, 0, y + (((i * 53) % 7) / 7 - 0.5) * 0.4);
      d.rotation.set(0, h * 6.28, 0);
      d.scale.setScalar((map.cs || 2.37) * (0.36 + h * 0.06));
      d.updateMatrix();
      trunks.setMatrixAt(i, d.matrix);
      crowns.setMatrixAt(i, d.matrix);
      crowns.setColorAt(i, tint.setHSL(0.7 + h * 0.12, 0.6, 0.8 + h * 0.15));
    });
    for (const m of [trunks, crowns]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.computeBoundingSphere();
      world.mapGroup.add(m);
    }
  }
  // Circle of power at the start: a stone ring with glowing runes.
  if (map.start) {
    const [x, y, hw, hh] = map.start;
    const g = new THREE.Group();
    g.position.set(x, 0, y);
    const r = Math.min(hw, hh) * 1.1;
    g.add(M.mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.08, 32), M.texMat('tex_stone.webp', '#6a6878', '#c8c4d8', 1), 0, 0.04, 0));
    const rune = new THREE.Mesh(new THREE.RingGeometry(r * 0.72, r * 0.88, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7ad8ff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    rune.position.y = 0.1;
    g.add(rune);
    const star = new THREE.Mesh(new THREE.RingGeometry(r * 0.2, r * 0.55, 5, 1).rotateX(-Math.PI / 2), rune.material);
    star.position.y = 0.1;
    g.add(star);
    const light = new THREE.PointLight('#7ad8ff', 6, 8, 2);
    light.position.y = 1.2;
    g.add(light);
    world.mapGroup.add(g);
  }
});

// ------------------------------------------------------------ events

registerEvent('kittycharm', (e, world) => {
  world.fx.bolt(e.x1, e.y1, e.x2, e.y2, '#d070ff');
  world.fx.burst(e.x2, 2, e.y2, '#d070ff', { n: 40, speed: 4, size: 0.6, life: 0.7 });
  world.fx.ring(e.x2, e.y2, 1.8, '#d070ff', 0.6);
  play('drain');
});

registerEvent('kittycripple', (e, world) => {
  world.fx.bolt(e.x1, e.y1, e.x2, e.y2, '#80ff60');
  world.fx.burst(e.x2, 1, e.y2, '#4a8a2a', { n: 24, speed: 2, size: 0.5, life: 0.8, additive: false, grav: 2 });
  play('zap');
});

// Rain of Fire: a burning circle marks the target for the 6 s channel.
registerEvent('kittyrain', (e, world) => {
  const m = new THREE.Mesh(new THREE.RingGeometry(e.r * 0.9, e.r, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff6a20', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  m.position.set(e.x, 0.1, e.y);
  world.fx.scene.add(m);
  world.fx.transients.push({ obj: m, t: 0, dur: 6, update: (k) => (m.material.opacity = 0.6 * Math.min(1, (1 - k) * 6) * (0.8 + Math.sin(k * 60) * 0.2)), dispose: () => m.geometry.dispose() });
  play('shield');
});

registerEvent('kittywave', (e, world) => {
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * e.r * 0.9;
    const x = e.x + Math.cos(a) * rr;
    const z = e.y + Math.sin(a) * rr;
    world.fx.flame(x, 0.4, z, 1.2, 0.6, 0.3);
    world.fx.burst(x, 0.3, z, '#ff8a2a', { n: 10, speed: 4, size: 0.5, life: 0.4 });
  }
  world.fx.scorch(e.x, e.y, e.r * 0.8, 4);
  world.shake = Math.max(world.shake || 0, 0.2);
  play('boom');
});

export { priestess, vial, emissive };
