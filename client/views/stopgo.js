// Stop and Go (#18): the lane between cliffs, the ten Spirit Towers whose
// floating crystals show the light (red, yellow, green), their spirit bolts,
// and the night slowly turning to dawn.

import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { fxTexture } from '../../engine/client/render/effects.js';
import { registerView, registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { play } from '../../engine/client/audio.js';
import { cliffBlock, cliffMat, emit } from './race-kit.js';

export const CLIFF_H = 1.7;
const LIGHT = { r: '#ff3b2a', y: '#ffc21a', g: '#3dff6a' };

// An undead Spirit Tower: a dark stepped ziggurat with bone tusks at its
// corners, a tapering obelisk, and a crystal floating over it wreathed in
// spirit light. Built round +Y; its glow shows the traffic light.
const LIGHT_C = Object.fromEntries(Object.entries(LIGHT).map(([k, c]) => [k, new THREE.Color(c)]));

export function spiritTower() {
  const g = new THREE.Group();
  const stone = M.texMat('tex_stone.webp', '#6a6680', '#b8b2cc', 0.6);
  const dark = M.texMat('tex_stone.webp', '#45425a', '#8a86a0', 0.6);
  const tier = (r0, r1, y0, y1, m) => {
    const t = M.mesh(M.lathe([[r0, y0], [r0, y0 + 0.05], [r1, y1 - 0.05], [r1 * 0.96, y1], [0.01, y1]], 4), m);
    t.rotation.y = Math.PI / 4;
    return t;
  };
  g.add(tier(1.25, 1.05, 0, 0.45, dark), tier(0.98, 0.78, 0.45, 0.85, stone), tier(0.72, 0.52, 0.85, 1.2, dark));
  // Gold-green trim between the tiers, the scourge colours.
  for (const [r, y] of [[1.02, 0.46], [0.76, 0.86]]) {
    const band = M.mesh(new THREE.TorusGeometry(r * Math.SQRT2 * 0.72, 0.03, 4, 4), M.mat('#6a8a5a', { metalness: 0.4 }), 0, y, 0);
    band.rotation.set(Math.PI / 2, 0, Math.PI / 4);
    g.add(band);
  }
  // Bone tusks curling out of the corners.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const c = Math.cos(a);
    const s = Math.sin(a);
    g.add(M.mesh(M.tube([[c * 0.95, 0.35, s * 0.95], [c * 1.3, 0.9, s * 1.3], [c * 1.2, 1.55, s * 1.2], [c * 0.95, 1.85, s * 0.95]], 0.11, 0.015, 12, 8), M.boneMat()));
    g.add(M.mesh(M.tube([[c * 0.6, 1.1, s * 0.6], [c * 0.8, 1.5, s * 0.8], [c * 0.7, 1.9, s * 0.7]], 0.06, 0.01, 8, 6), M.boneMat()));
  }
  const obelisk = M.mesh(M.lathe([[0.38, 1.2], [0.3, 1.9], [0.22, 2.5], [0.01, 2.75]], 4), stone);
  obelisk.rotation.y = Math.PI / 4;
  g.add(obelisk);
  // A skull set into the obelisk, facing out.
  g.add(M.mesh(M.blob(0.14, 0.13, 0.12, { seed: 61 }), M.boneMat(), 0.33, 1.65, 0));
  // The floating crystal and its light.
  const crystal = new THREE.Group();
  crystal.position.y = 3.35;
  const glass = new THREE.MeshStandardMaterial({ color: '#ff3b2a', emissive: '#ff3b2a', emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1 });
  crystal.add(M.mesh(M.lathe([[0.01, -0.45], [0.2, -0.05], [0.24, 0.05], [0.01, 0.5]], 6), glass));
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: fxTexture('fx_flare.webp'), color: '#ff3b2a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  crystal.add(halo);
  g.add(crystal);
  // The light cast on the ground round the tower.
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(5, 5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: fxTexture('fx_flare.webp'), color: '#ff3b2a', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pool.position.y = 0.06;
  g.add(pool);
  g.userData = { crystal, glass, halo, pool };
  return g;
}

registerView('spirittower', {
  bake: true, // ten of these; the static ziggurat merges, the crystal/halo/pool stay as they are.
  make(e, world, v) {
    const g = spiritTower();
    g.position.y = CLIFF_H;
    v.parts = g.userData;
    v.col = new THREE.Color(LIGHT.r);
    v.t = Math.random() * 6;
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.obj.position.y = CLIFF_H;
    v.obj.rotation.y = 0; // the ziggurat doesn't turn; the crystal does
    v.t += dt;
    const P = v.parts;
    v.col.lerp(LIGHT_C[b.l] || LIGHT_C.r, Math.min(1, dt * 10));
    P.glass.emissive.copy(v.col);
    P.glass.color.copy(v.col);
    P.halo.material.color.copy(v.col);
    P.pool.material.color.copy(v.col);
    const red = b.l === 'r';
    P.crystal.position.y = 3.35 + Math.sin(v.t * 2) * 0.12;
    P.crystal.rotation.y += dt * (red ? 2.5 : 0.8);
    P.halo.quaternion.copy(world.camera.quaternion);
    const pulse = red ? 1 + Math.sin(v.t * 9) * 0.15 : 0.8;
    P.halo.scale.setScalar(pulse * (b.fire ? 1.4 : 1));
    P.pool.material.opacity = red ? 0.55 : 0.35;
    if (red && emit(v, 'wisp', 5, dt)) world.fx.trail(v.x + (Math.random() - 0.5), CLIFF_H + 3 + Math.random() * 0.6, v.z + (Math.random() - 0.5), `#${v.col.getHexString()}`, 0.5, 0.7, 0.3);
  },
});

// A spirit bolt arcing down from the crystal onto its seal.
registerView('sgbolt', {
  bake: true,
  make(e, world, v) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), M.glowMat('#cfe8ff')));
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: fxTexture('fx_flare.webp'), color: '#7fb8ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    g.add(halo);
    v.parts = { halo };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const p = Math.min(1, (a.p ?? 0) + ((b.p ?? 0) - (a.p ?? 0)) * k);
    const y = (CLIFF_H + 3.3) * (1 - p) + 0.9 * p + Math.sin(p * Math.PI) * 0.8;
    v.obj.position.y = y;
    v.parts.halo.quaternion.copy(world.camera.quaternion);
    world.fx.trail(v.x, y, v.z, '#8fc4ff', 0.55, 0.35, 0.12);
  },
});

// Night into dawn: the moonlight warms and brightens over the last 12 s of night.
registerView('sgsky', {
  make(e, world, v) {
    v.base = { hemi: world.hemi.color.clone(), ground: world.hemi.groundColor.clone(), sun: world.sun.color.clone(), sunI: world.sun.intensity, hemiI: world.hemi.intensity, sky: world.scene.background?.clone?.() };
    return new THREE.Group();
  },
  update(v, a, b, k, dt, world) {
    const d = b.d || 0;
    const B = v.base;
    world.hemi.color.copy(B.hemi).lerp(new THREE.Color('#ffd8b0'), d);
    world.hemi.groundColor.copy(B.ground).lerp(new THREE.Color('#5a4a3a'), d);
    world.sun.color.copy(B.sun).lerp(new THREE.Color('#ffc890'), d);
    world.sun.intensity = B.sunI + (2.4 - B.sunI) * d;
    if (B.sky && world.scene.background?.isColor) world.scene.background.copy(B.sky).lerp(new THREE.Color('#e8a878'), d);
    if (world.scene.fog) world.scene.fog.color.copy(world.scene.background);
  },
  remove(v, world) {
    const B = v.base;
    world.hemi.color.copy(B.hemi);
    world.hemi.groundColor.copy(B.ground);
    world.sun.color.copy(B.sun);
    world.sun.intensity = B.sunI;
  },
});

registerEvent('sglight', (e) => {
  play(e.l === 'red' ? 'error' : e.l === 'green' ? 'start' : 'beep');
});

registerEvent('sghit', (e, world) => {
  world.fx.burst(e.x, 1, e.y, '#9fd0ff', { n: 26, speed: 4, size: 0.6, life: 0.5 });
  world.fx.glow(e.x, 1, e.y, '#9fd0ff', 3, 0.3);
  world.fx.ring(e.x, e.y, 1.2, '#9fd0ff', 0.35);
  play('zap');
});

registerMapBuilder('stopgo', (map, world) => {
  const S = map.sg;
  const G = world.mapGroup;
  const mat = cliffMat('tex_nightgrass.webp', '#8894b0', 'tex_boulder.webp', '#8a8ea8');
  const W = 12;
  // Cliffs down both sides of the lane, and closing its two ends.
  G.add(cliffBlock(S.hw + 0.4, -S.hh - 7, S.hw + W, S.hh + 7, CLIFF_H, { mat, seed: 3, rough: 0.3 }));
  G.add(cliffBlock(-S.hw - W, -S.hh - 7, -S.hw - 0.4, S.hh + 7, CLIFF_H, { mat, seed: 5, rough: 0.3 }));
  G.add(cliffBlock(-S.hw - 0.2, -S.hh - 7, S.hw + 0.2, -S.hh - 0.4, CLIFF_H, { mat, seed: 7, rough: 0.25 }));
  G.add(cliffBlock(-S.hw - 0.2, S.hh + 0.4, S.hw + 0.2, S.hh + 7, CLIFF_H, { mat, seed: 9, rough: 0.25 }));
  // Dead trees and bones on the cliff tops: static scenery, merged per material.
  const deco = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (S.hw + 2 + Math.random() * 8);
    const z = -S.hh - 5 + Math.random() * (S.hh * 2 + 10);
    if (S.towers.some(([tx, ty]) => Math.hypot(tx - x, ty - z) < 2.2)) continue;
    const t = M.tree(0.7 + Math.random() * 0.4);
    t.position.set(x, CLIFF_H + 0.05, z);
    deco.add(t);
  }
  bakeStatic(deco);
  G.add(deco);
});
