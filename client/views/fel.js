// Visuals for Uther Party 4.0 #51 "Fel Orc Fiasco"
// (server/minigames/up/51-fel.js). The pit, catapults, rocks and burning oil
// are Peon Pandemonium's (built into world.js); this file adds the Fel Orc
// Burrow: an earthen mound hut under a hide roof on timber ribs, with bone
// tusks at the door, a ring of sharpened stakes and a banner in its owner's
// colour. It rises out of scaffolding while it is built and shows a glowing
// door and chimney smoke while its owner hides inside.

import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerEvent } from '../../engine/client/render/registry.js';
import { bakeModel } from '../../engine/client/render/batch.js';
import { play } from '../../engine/client/audio.js';

// Faces the fixed RTS camera (56° angle of attack).
const BAR_TILT = -(56 * Math.PI) / 180;

function burrow(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const earth = M.triMat('tex_dirt.webp', '#6a4a30', '#c8a888', 0.7);
  const hide = M.hideMat();
  const wood = M.texMat('tex_wood.webp', '#6a4428', '#e0c8b0');
  const bone = M.boneMat();
  const team = M.mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  // Earthen mound and the hut on it (front door toward +X).
  body.add(M.mesh(M.blob(1.85, 0.7, 1.85, { seed: 91, amt: 0.1, freq: 2.6 }), earth, 0, 0.1, 0));
  const dome = M.mesh(M.lathe([[1.35, 0], [1.38, 0.35], [1.25, 0.85], [0.95, 1.3], [0.55, 1.62], [0.18, 1.78], [0.001, 1.8]], 24), hide, 0, 0.45, 0);
  body.add(dome);
  // Timber ribs over the roof.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const c = Math.cos(a);
    const s = Math.sin(a);
    body.add(M.mesh(M.tube([[c * 1.42, 0.45, s * 1.42], [c * 1.32, 1.35, s * 1.32], [c * 0.75, 2.05, s * 0.75], [c * 0.1, 2.35, s * 0.1]], 0.07, 0.05, 10, 6), wood));
  }
  body.add(M.mesh(M.lathe([[0.001, 2.2], [0.22, 2.25], [0.2, 2.45], [0.001, 2.5]], 10), wood));
  // Door with tusks either side.
  const door = M.mesh(new THREE.CircleGeometry(0.42, 20, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#120a06', emissive: '#ff8a30', emissiveIntensity: 0, roughness: 1 }), 1.37, 0.46, 0);
  door.rotation.y = Math.PI / 2;
  body.add(door);
  body.add(M.mesh(new THREE.TorusGeometry(0.44, 0.07, 6, 16, Math.PI), wood, 1.36, 0.46, 0).rotateY(Math.PI / 2));
  for (const s of [1, -1]) {
    body.add(M.mesh(M.tube([[1.3, 0.25, 0.62 * s], [1.75, 0.8, 0.72 * s], [1.95, 1.45, 0.55 * s], [1.8, 1.85, 0.3 * s]], 0.12, 0.02, 14, 8), bone));
  }
  // A ring of sharpened stakes, leaning out.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    if (Math.cos(a) > 0.85) continue; // leave the doorway clear
    const c = Math.cos(a);
    const s = Math.sin(a);
    const r0 = 1.72;
    body.add(M.mesh(M.tube([[c * r0, 0.05, s * r0], [c * (r0 + 0.25), 0.7, s * (r0 + 0.25)], [c * (r0 + 0.45), 1.15, s * (r0 + 0.45)]], 0.09, 0.012, 6, 6), wood));
  }
  // Banner pole in the owner's colour.
  body.add(M.mesh(M.tube([[-0.9, 0.9, -0.9], [-0.92, 2.2, -0.92], [-0.94, 3.4, -0.94]], 0.05, 0.04), wood));
  const flag = M.mesh(M.cloth(0.55, 0.8, 0.04, 0.12), team, -0.94, 3.0, -0.94);
  flag.rotation.y = Math.PI / 2;
  body.add(flag);
  body.add(M.mesh(M.blob(0.12, 0.14, 0.12, { seed: 97 }), bone, -0.94, 3.5, -0.94));
  // Scaffolding shown while it goes up.
  const scaffold = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    scaffold.add(M.mesh(M.tube([[Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6], [Math.cos(a) * 1.5, 1.2, Math.sin(a) * 1.5], [Math.cos(a) * 1.35, 2.3, Math.sin(a) * 1.35]], 0.05, 0.04, 4, 6), wood));
  }
  for (const y of [0.8, 1.6]) {
    const ring = M.mesh(new THREE.TorusGeometry(1.52 - y * 0.08, 0.035, 5, 24).rotateX(Math.PI / 2), wood, 0, y, 0);
    scaffold.add(ring);
  }
  g.add(scaffold);
  // HP bar, tilted to face the camera.
  const bar = new THREE.Group();
  bar.position.set(0, 3.9, 0);
  bar.rotation.x = BAR_TILT;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.22), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.7, depthWrite: false }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.14).translate(1.05, 0, 0), new THREE.MeshBasicMaterial({ color: '#2fdc2f', depthWrite: false }));
  fill.position.set(-1.05, 0, 0.01);
  bar.add(back, fill);
  g.add(bar);
  g.userData = { body, scaffold, door, fill, flag };
  return g;
}

registerView('burrow', {
  make(e, world, v) {
    const g = bakeModel(burrow(world.colors[e.o] || '#cccccc'));
    v.parts = g.userData;
    world.fx.dustCloud(e.x, e.y, 1.6, '#8a7050', 12);
    return g;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    const prog = b.b ?? 1;
    const building = prog < 1;
    // The hut rises out of the ground as it is built.
    P.body.scale.set(1, 0.25 + 0.75 * prog, 1);
    P.body.position.y = building ? -0.3 * (1 - prog) : 0;
    P.scaffold.visible = building;
    if (building && Math.random() < dt * 6) world.fx.smokePuff(v.x + (Math.random() - 0.5) * 2.4, 0.3, v.z + (Math.random() - 0.5) * 2.4, '#8a7050', 1, 1, 0.4);
    if (building && Math.random() < dt * 3) world.fx.sparks(v.x + (Math.random() - 0.5) * 1.6, 1.2, v.z + (Math.random() - 0.5) * 1.6, 3, 2, '#ffd070');
    const frac = Math.max(0, Math.min(1, (b.hp ?? 0) / (b.mhp || 1)));
    P.fill.scale.x = Math.max(0.001, frac);
    P.fill.material.color.set(frac > 0.6 ? '#2fdc2f' : frac > 0.3 ? '#e8d020' : '#e82020');
    // Someone inside: a glowing doorway and smoke from the roof.
    const lit = b.g && !building ? 1 : 0;
    P.door.material.emissiveIntensity += (lit * 1.6 - P.door.material.emissiveIntensity) * Math.min(1, dt * 4);
    if (lit && Math.random() < dt * 3) world.fx.smokePuff(v.x, 2.7, v.z, '#4a4442', 0.9, 2, 0.35);
    if (b.rp && Math.random() < dt * 8) world.fx.sparks(v.x + (Math.random() - 0.5) * 2, 0.9, v.z + (Math.random() - 0.5) * 2, 4, 2.5, '#ffe0a0');
    // Heavily damaged: it smoulders.
    if (!building && frac < 0.5 && Math.random() < dt * (1 - frac) * 8) world.fx.flame(v.x + (Math.random() - 0.5) * 1.8, 1 + Math.random(), v.z + (Math.random() - 0.5) * 1.8, 0.8, 0.5, 0.2);
    P.flag.rotation.z = Math.sin(world.time * 3 + v.id) * 0.08;
  },
});

registerEvent('burrowfall', (e, world) => {
  const fx = world.fx;
  fx.explosion(e.x, e.y, 1.6, { scorch: true });
  fx.debrisBurst(e.x, e.y, 18, 6);
  fx.dustCloud(e.x, e.y, e.r * 1.2, '#7a6040', 16);
  for (let i = 0; i < 10; i++) fx.flame(e.x + (Math.random() - 0.5) * e.r * 2, 0.3, e.y + (Math.random() - 0.5) * e.r * 2, 1.2, 0.9, 0.3);
  world.shake = 0.35;
  play('bigboom');
});
