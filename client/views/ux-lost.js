// Ultima-X #76: a blue-armoured marine stalked by low, spined hunters.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin, registerView, registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';
import { bakeStatic } from '../../engine/client/render/batch.js';

function marine(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const armour = M.plateMat('#285e99');
  const trim = M.mat(color);
  const dark = M.leatherMat('#212d40');
  const metal = M.silverMat();
  const visor = M.glowMat('#90f4ff');
  const leg = (s) => {
    const p = new THREE.Group();
    p.position.set(-0.08, 0.9, s * 0.19);
    p.add(M.mesh(M.blob(0.16, 0.35, 0.16, { seed: 4, amt: 0.04 }), armour, 0, -0.3, 0));
    p.add(M.mesh(M.blob(0.19, 0.24, 0.19, { seed: 5, amt: 0.05 }), dark, 0.09, -0.72, 0));
    return p;
  };
  const legL = leg(1), legR = leg(-1);
  body.add(legL, legR);
  body.add(M.mesh(M.blob(0.4, 0.48, 0.36, { seed: 11, amt: 0.05 }), armour, 0, 1.28, 0));
  body.add(M.mesh(M.blob(0.37, 0.32, 0.34, { seed: 12, amt: 0.04 }), trim, 0.05, 1.42, 0));
  for (const s of [-1, 1]) {
    body.add(M.mesh(M.blob(0.22, 0.19, 0.23, { seed: 7, amt: 0.04 }), armour, 0, 1.61, s * 0.44));
    body.add(M.mesh(M.tube([[0, 1.55, s * 0.46], [0.1, 1.1, s * 0.49]], 0.1, 0.08), dark));
  }
  body.add(M.mesh(M.blob(0.28, 0.28, 0.28, { seed: 18, amt: 0.03 }), armour, 0.05, 2.0, 0));
  body.add(M.mesh(M.scaled(M.G.sphere, 0.25, 0.1, 0.28), visor, 0.27, 2.03, 0));
  body.add(M.mesh(M.tube([[0.2, 1.36, -0.2], [0.75, 1.31, -0.14], [1.05, 1.32, -0.12]], 0.12, 0.09), metal));
  body.add(M.mesh(M.scaled(M.G.box, 0.4, 0.17, 0.22), dark, 0.7, 1.23, -0.11));
  g.add(body);
  g.userData = { body, legL, legR, kind: 'hero' };
  return g;
}
registerSkin('uxmarine', marine);

function hunter() {
  const g = new THREE.Group();
  const torso = new THREE.Group();
  const shell = M.triMat('tex_hide.webp', '#563b65', '#aa7aaa', 0.7);
  const claw = M.boneMat();
  const glow = M.glowMat('#efefb0');
  torso.add(M.mesh(M.blob(0.64, 0.33, 0.32, { seed: 77, amt: 0.12 }), shell, 0, 0.6, 0));
  torso.add(M.mesh(M.blob(0.38, 0.24, 0.28, { seed: 79, amt: 0.08 }), shell, 0.48, 0.58, 0));
  for (const s of [-1, 1]) {
    torso.add(M.mesh(M.tube([[0.35, 0.5, s * 0.22], [0.72, 0.31, s * 0.35], [0.96, 0.25, s * 0.39]], 0.09, 0.015), claw));
    torso.add(M.mesh(M.scaled(M.G.sphere, 0.07), glow, 0.67, 0.68, s * 0.16));
    for (let i = 0; i < 3; i++) torso.add(M.mesh(M.tube([[-0.5 + i * 0.3, 0.72, s * 0.2], [-0.68 + i * 0.27, 1.03, s * 0.18]], 0.08, 0.005), claw));
  }
  g.add(torso);
  g.userData.torso = torso;
  return g;
}
registerView('uxhunter', {
  make(e, world, v) { const g = hunter(); v.parts = g.userData; v.phase = e.id * 0.6; return g; },
  update(v, a, b, k, dt, world) {
    v.parts.torso.position.y = Math.sin(world.time * 10 + v.phase) * 0.07;
  },
});

registerEvent('uxlostflash', (e, world) => {
  world.fx.flash(0, 0, 25, '#e6f8ff', 0.25);
  world.shake = 0.15;
});

registerView('uxvision', {
  make(e, world, v) {
    const veil = document.createElement('div');
    veil.style.cssText = 'position:fixed;inset:0;pointer-events:none;background:#030814;opacity:0.83;';
    world.overlay.appendChild(veil);
    v.veil = veil;
    v.project = new THREE.Vector3();
    return new THREE.Group();
  },
  update(v, a, b, k, dt, world) {
    if (b.reveal || !b.alive) {
      v.veil.style.opacity = '0';
      return;
    }
    v.project.set(v.x, 0.8, v.z).project(world.camera);
    const x = (v.project.x + 1) * 50;
    const y = (1 - v.project.y) * 50;
    v.veil.style.background = `radial-gradient(circle 145px at ${x}% ${y}%, transparent 0%, rgba(3,8,20,.35) 62%, #030814 100%)`;
    v.veil.style.opacity = '0.9';
  },
  remove(v) { v.veil.remove(); },
});

registerMapBuilder('uxlostlamps', (map, world) => {
  const scene = new THREE.Group();
  const stone = M.triMat('tex_boulder.webp', '#494858', '#75778d', 0.8);
  const h = map.floor.w / 2;
  for (let i = -7; i <= 7; i++) for (const s of [-1, 1]) {
    scene.add(M.mesh(M.blob(0.8, 0.55, 0.8, { seed: i + s * 33, amt: 0.15 }), stone, i * 1.8, 0.28, s * h));
    scene.add(M.mesh(M.blob(0.8, 0.55, 0.8, { seed: i + s * 53, amt: 0.15 }), stone, s * h, 0.28, i * 1.8));
  }
  bakeStatic(scene);
  world.mapGroup.add(scene);
});
