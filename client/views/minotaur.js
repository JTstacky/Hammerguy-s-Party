// Minotaur Maze (#32): the minotaurs ("Tiny Tauren"), the Shimmerweed and
// its pickup effects. The maze walls come from the 'upmaze' builder.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerEvent } from '../../engine/client/render/registry.js';
import { fxTexture } from '../../engine/client/render/effects.js';
import { play } from '../../engine/client/audio.js';
import { bakeModel } from './walkgrid-art.js';

// A minotaur: a hunched bull-headed brute with a shaggy mane, sweeping horns,
// a gold nose ring and a stone-headed totem club. Faces +X; the snout and
// horns point the way it walks.
export function minotaur() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const fur = M.furMat('#c08a5a');
  const mane = M.furMat('#6a4a30');
  const hide = M.triMat('tex_hide.webp', '#7a5236', '#caa482', 1.4);
  const horn = M.boneMat();
  const hoof = M.mat('#2a2220', { roughness: 0.5 });
  const leather = M.leatherMat('#d0b090');
  const legs = [];
  for (const s of [1, -1]) {
    const hip = new THREE.Group();
    hip.position.set(-0.1, 0.95, 0.24 * s);
    hip.add(M.mesh(M.tube([[0, 0.05, 0], [0.16, -0.35, 0.02 * s], [-0.08, -0.62, 0.02 * s], [0.02, -0.9, 0]], 0.17, 0.09, 10, 10), fur));
    hip.add(M.mesh(M.blob(0.13, 0.08, 0.12, { seed: 5 + s, detail: 2 }), hoof, 0.06, -0.92, 0));
    legs.push(hip);
    body.add(hip);
  }
  const lean = new THREE.Group();
  lean.rotation.z = -0.22; // hunched forward
  lean.position.set(-0.05, 0.95, 0);
  body.add(lean);
  lean.add(M.mesh(M.blob(0.42, 0.34, 0.4, { seed: 11, amt: 0.08, detail: 2 }), hide, 0.02, 0.18, 0));
  lean.add(M.mesh(M.blob(0.55, 0.45, 0.58, { seed: 12, amt: 0.08, detail: 2 }), fur, 0.05, 0.62, 0));
  lean.add(M.mesh(M.blob(0.5, 0.36, 0.62, { seed: 13, amt: 0.14, freq: 3, detail: 2 }), mane, -0.12, 0.92, 0));
  const loin = M.mesh(M.cloth(0.4, 0.45, 0.05, 0.05), leather, 0.34, -0.05, 0);
  loin.material = loin.material.clone();
  loin.material.side = THREE.DoubleSide;
  loin.rotation.y = Math.PI;
  lean.add(loin);
  lean.add(M.mesh(new THREE.TorusGeometry(0.42, 0.045, 6, 24).rotateX(Math.PI / 2), leather, 0.02, 0.12, 0));
  // Head: skull, long muzzle, nostrils and a ring, eyes, ears and horns.
  const head = new THREE.Group();
  head.position.set(0.5, 1.05, 0);
  head.add(M.mesh(M.blob(0.24, 0.24, 0.24, { seed: 21, detail: 2 }), fur, 0, 0, 0));
  head.add(M.mesh(M.blob(0.22, 0.15, 0.17, { seed: 22, detail: 2 }), hide, 0.24, -0.1, 0));
  head.add(M.mesh(M.scaled(M.G.sphere, 0.1, 0.07, 0.13), M.mat('#3a2a24', { roughness: 0.4 }), 0.43, -0.12, 0));
  const ring = M.mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 16), M.goldMat(), 0.47, -0.2, 0);
  ring.rotation.y = Math.PI / 2;
  head.add(ring);
  for (const s of [1, -1]) {
    head.add(M.mesh(M.scaled(M.G.sphere, 0.035), M.glowMat('#ff5a2a'), 0.2, 0.06, 0.13 * s));
    const ear = M.mesh(M.blob(0.1, 0.035, 0.07, { seed: 23, detail: 2 }), fur, 0.0, 0.08, 0.26 * s);
    ear.rotation.x = 0.5 * s;
    head.add(ear);
    head.add(M.mesh(M.tube([[0.02, 0.14, 0.14 * s], [0.02, 0.24, 0.36 * s], [0.18, 0.4, 0.5 * s], [0.38, 0.46, 0.42 * s]], 0.075, 0.012, 16, 10), horn));
  }
  head.add(M.mesh(M.blob(0.14, 0.1, 0.16, { seed: 24, amt: 0.2, freq: 3, detail: 2 }), mane, -0.08, 0.2, 0));
  lean.add(head);
  // Arms: massive, the right one gripping a totem club.
  const arms = [];
  for (const s of [1, -1]) {
    const a = new THREE.Group();
    a.position.set(0.12, 0.85, 0.52 * s);
    a.add(M.mesh(M.blob(0.2, 0.18, 0.2, { seed: 30 + s, detail: 2 }), mane, 0, 0.06, 0));
    a.add(M.mesh(M.tube([[0, 0, 0], [0.12, -0.3, 0.06 * s], [0.34, -0.5, 0.02 * s]], 0.15, 0.1, 8, 10), fur));
    a.add(M.mesh(M.blob(0.1, 0.1, 0.1, { seed: 33, detail: 2 }), hide, 0.38, -0.54, 0));
    a.add(M.mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 12).rotateZ(Math.PI / 2 - 0.6), M.goldMat(), 0.24, -0.42, 0.03 * s));
    arms.push(a);
    lean.add(a);
  }
  const club = new THREE.Group();
  club.position.set(0.38, -0.54, 0);
  club.add(M.mesh(M.tube([[0, -0.35, 0], [0.05, 0.2, 0], [0.02, 0.95, 0]], 0.05, 0.06, 6, 8), M.barkMat()));
  club.add(M.mesh(M.blob(0.2, 0.26, 0.2, { seed: 35, amt: 0.2, freq: 3, detail: 2 }), M.boulderMat(), 0.02, 1.0, 0));
  club.add(M.mesh(M.tube([[0, 0.8, -0.1], [0.12, 0.72, -0.2], [0.18, 0.55, -0.22]], 0.03, 0.01, 6, 6), M.mat('#a02018', { side: THREE.DoubleSide })));
  club.rotation.z = -0.5;
  arms[1].add(club);
  body.scale.setScalar(1.1);
  g.userData = { body, legs, arms, club, lean };
  return g;
}

registerView('minotaur', {
  make(e, world, v) {
    const g = bakeModel(minotaur());
    v.parts = g.userData;
    return g;
  },
  update(v, a, b, k, dt) {
    const P = v.parts;
    const moving = !!b.mv;
    v.walk = (v.walk || 0) + dt * (moving ? 11 : 0);
    P.body.position.y = moving ? Math.abs(Math.sin(v.walk)) * 0.07 : 0;
    P.legs[0].rotation.z = Math.sin(v.walk) * (moving ? 0.55 : 0);
    P.legs[1].rotation.z = -Math.sin(v.walk) * (moving ? 0.55 : 0);
    P.arms[0].rotation.z = -Math.sin(v.walk) * (moving ? 0.3 : 0);
    // The club: raised during the wind-up, smashed down on the hit.
    if (v.castT > 0) v.castT -= dt;
    v.raise = Math.max(0, Math.min(1, (v.raise || 0) + dt * (b.sw ? 5 : -4)));
    const smash = v.castT > 0 ? Math.sin((v.castT / 0.3) * Math.PI) : 0;
    P.arms[1].rotation.z = Math.sin(v.walk) * (moving ? 0.3 : 0) + v.raise * 1.4 - smash * 0.6;
    P.lean.rotation.z = -0.22 - v.raise * 0.15;
  },
});

// The Shimmerweed: a clump of glowing violet fronds with bright seed pods,
// a soft ground glow and a faint column of light so it can be found.
function shimmerweed() {
  const g = new THREE.Group();
  const leaf = M.mat('#6a4ad8', { emissive: '#3a1a9a', emissiveIntensity: 0.9, roughness: 0.5, side: THREE.DoubleSide });
  const stem = M.mat('#4a7a3a', { roughness: 0.7 });
  const plant = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + (i % 2) * 0.3;
    const r = 0.25 + (i % 3) * 0.08;
    const h = 0.55 + (i % 3) * 0.2;
    plant.add(M.mesh(M.tube([[0, 0, 0], [Math.cos(a) * r * 0.4, h * 0.6, Math.sin(a) * r * 0.4], [Math.cos(a) * r, h, Math.sin(a) * r], [Math.cos(a) * r * 1.4, h * 0.8, Math.sin(a) * r * 1.4]], 0.05, 0.008, 12, 6), leaf));
    if (i % 2 === 0) {
      plant.add(M.mesh(M.tube([[0, 0, 0], [Math.cos(a + 0.4) * 0.08, h * 0.7, Math.sin(a + 0.4) * 0.08], [Math.cos(a + 0.4) * 0.14, h + 0.25, Math.sin(a + 0.4) * 0.14]], 0.02, 0.012, 6, 6), stem));
      plant.add(M.mesh(M.scaled(M.G.sphere, 0.07), M.glowMat('#e8c8ff'), Math.cos(a + 0.4) * 0.14, h + 0.3, Math.sin(a + 0.4) * 0.14));
    }
  }
  g.add(plant);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#9a6aff', map: fxTexture('fx_flare.webp'), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  glow.position.y = 0.05;
  g.add(glow);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 5, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#b08aff', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
  beam.position.y = 2.5;
  g.add(beam);
  g.userData = { plant, glow, beam };
  return g;
}

registerView('shimmerweed', {
  make(e, world, v) {
    const g = bakeModel(shimmerweed());
    v.parts = g.userData;
    v.born = world.time;
    return g;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    const t = world.time;
    const grow = Math.min(1, (t - v.born) * 2.5);
    P.plant.scale.setScalar(grow * (1 + Math.sin(t * 3) * 0.04));
    P.plant.rotation.y = t * 0.4;
    P.glow.material.opacity = 0.45 + Math.sin(t * 4) * 0.15;
    P.beam.material.opacity = 0.08 + Math.sin(t * 2.5) * 0.04;
    v.acc = (v.acc || 0) + dt * 5;
    while (v.acc >= 1) {
      v.acc -= 1;
      const ang = Math.random() * Math.PI * 2;
      world.fx.trail(v.x + Math.cos(ang) * 0.4, 0.3 + Math.random() * 0.8, v.z + Math.sin(ang) * 0.4, '#d4b8ff', 0.3, 0.8, 0.1);
    }
    v.obj.rotation.y = 0;
    return true;
  },
});

registerEvent('weedup', (e, world) => {
  world.fx.burst(e.x, 0.6, e.y, '#c8a8ff', { n: 24, speed: 3, size: 0.45, life: 0.6 });
  world.fx.ring(e.x, e.y, 1.2, '#b08aff', 0.5);
});

registerEvent('weedgrab', (e, world) => {
  world.fx.burst(e.x, 1, e.y, '#e8d8ff', { n: 40, speed: 5, size: 0.6, life: 0.7 });
  world.fx.glow(e.x, 1, e.y, '#b08aff', 3, 0.5);
  play('coin');
});
