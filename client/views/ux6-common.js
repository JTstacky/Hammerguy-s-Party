// Shared visual vocabulary for the three Arcane Tower duels.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';
import { bakeStatic } from '../../engine/client/render/batch.js';

function shaman(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = M.hideMat('#667f9a');
  const robe = M.leatherMat('#4b3868');
  const team = M.mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  const fur = M.furMat('#b9af99');
  const bone = M.boneMat();
  const gold = M.goldMat();
  const leg = (s) => {
    const p = new THREE.Group();
    p.position.set(-0.03, 0.7, s * 0.16);
    p.add(M.mesh(M.tube([[0, 0, 0], [0.03, -0.35, 0], [0.1, -0.65, 0]], 0.1, 0.07), robe));
    p.add(M.mesh(M.blob(0.15, 0.07, 0.11, { seed: s + 81 }), skin, 0.15, -0.68, 0));
    return p;
  };
  const legL = leg(1);
  const legR = leg(-1);
  body.add(legL, legR);
  body.add(M.mesh(M.lathe([[0.24, 0.47], [0.27, 0.66], [0.19, 0.86], [0.16, 1.28], [0.05, 1.42]], 18), robe));
  body.add(M.mesh(M.blob(0.29, 0.26, 0.31, { seed: 82 }), skin, -0.05, 1.23, 0));
  body.add(M.mesh(M.blob(0.19, 0.19, 0.17, { seed: 83 }), skin, 0.17, 1.61, 0));
  body.add(M.mesh(M.tube([[0.23, 1.7, 0], [0.34, 1.66, 0], [0.36, 1.55, 0]], 0.06, 0.025), skin));
  for (const s of [-1, 1]) {
    body.add(M.mesh(M.tube([[0.1, 1.65, s * 0.13], [-0.08, 1.73, s * 0.32], [-0.22, 1.81, s * 0.39]], 0.07, 0.01), skin));
    body.add(M.mesh(M.tube([[-0.07, 1.32, s * 0.26], [0.08, 1.06, s * 0.32], [0.16, 0.83, s * 0.28]], 0.11, 0.065), skin));
    body.add(M.mesh(M.blob(0.22, 0.12, 0.2, { seed: s + 91 }), fur, -0.1, 1.36, s * 0.3));
    body.add(M.mesh(M.scaled(M.G.sphere, 0.035), M.glowMat('#fff7a6'), 0.31, 1.66, s * 0.09));
    body.add(M.mesh(new THREE.ConeGeometry(0.04, 0.17, 8), bone, 0.19, 1.46, s * 0.13));
  }
  body.add(M.mesh(M.cloth(0.62, 0.7, 0.12, 0.08), team, -0.22, 1.05, 0));
  body.add(M.mesh(new THREE.TorusGeometry(0.23, 0.055, 8, 24).rotateX(Math.PI / 2), team, 0, 0.82, 0));
  const staff = new THREE.Group();
  staff.position.set(0.18, 1, -0.34);
  staff.add(M.mesh(M.tube([[0, -0.65, 0], [0.06, 0.4, 0], [0, 1.0, 0]], 0.045, 0.028), M.barkMat()));
  staff.add(M.mesh(M.blob(0.14, 0.18, 0.14, { seed: 96 }), gold, 0, 1.04, 0));
  staff.add(M.mesh(M.scaled(M.G.sphere, 0.095), M.glowMat('#77dfff'), 0, 1.12, 0));
  body.add(staff);
  body.scale.setScalar(1.25);
  g.userData = { body, legL, legR, staff, kind: 'hero' };
  return g;
}
registerSkin('uxshaman', shaman);

registerEvent('ux6lightning', (e, world) => {
  for (let i = 0; i < 10; i++) {
    const h = i * 0.45;
    const jitter = Math.sin(i * 17 + e.x * 5) * 0.18;
    world.fx.trail(e.x + jitter, h, e.y - jitter, '#b9e9ff', 0.2, 0.18, 0.02);
  }
  world.fx.flash(e.x, e.y, 2.3, '#d3f2ff', 0.35);
  world.shake = Math.max(world.shake, 0.3);
});

function arcaneTower() {
  const g = new THREE.Group();
  const stone = M.triMat('tex_stone.webp', '#8d91a9', '#d8d5ec', 1.4);
  const gold = M.goldMat();
  const blue = M.glowMat('#80dafa');
  g.add(M.mesh(M.lathe([[1.25, 0], [1.35, 0.25], [1.1, 0.45], [0.9, 0.6]], 8), stone));
  g.add(M.mesh(M.lathe([[0.83, 0.5], [0.64, 2.5], [0.82, 2.7], [0.58, 3.15], [0.74, 3.3], [0.38, 3.6]], 8), stone));
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const x = Math.cos(a) * 0.65;
    const z = Math.sin(a) * 0.65;
    g.add(M.mesh(M.tube([[x * 0.9, 0.7, z * 0.9], [x, 2.75, z], [x * 1.2, 3.45, z * 1.2]], 0.12, 0.06), gold));
    g.add(M.mesh(M.scaled(M.G.sphere, 0.12), blue, x * 1.2, 3.46, z * 1.2));
  }
  g.add(M.mesh(M.scaled(M.G.sphere, 0.36), blue, 0, 3.7, 0));
  g.add(M.mesh(new THREE.TorusGeometry(0.5, 0.04, 8, 32).rotateX(Math.PI / 2), gold, 0, 3.5, 0));
  return g;
}

registerView('ux6tower', {
  make(e, world, v) {
    const g = arcaneTower();
    const hud = document.getElementById('hud');
    const panel = document.createElement('div');
    panel.style.cssText = 'position:absolute;left:50%;top:60px;transform:translateX(-50%);z-index:15;padding:5px 12px;border:2px solid #b99755;border-radius:8px;background:rgba(20,18,36,.9);color:#fff;font:700 14px sans-serif;text-align:center;white-space:nowrap;max-width:85vw';
    const label = document.createElement('div');
    const button = document.createElement('button');
    button.textContent = '⚡ CLICK TOWER';
    button.style.cssText = 'margin-top:4px;padding:6px 16px;background:#395d92;color:white;border:2px solid #a9dcff;border-radius:5px;font:bold 15px sans-serif;touch-action:manipulation';
    panel.append(label, button);
    hud.appendChild(panel);
    const click = (ev) => {
      ev.preventDefault();
      window.game?.send({ t: 'cmd', c: 'uxclick' });
    };
    const canvasClick = (ev) => {
      if (ev.button !== 0 || ev.pointerType === 'touch') return;
      const p = world.screenToGround(ev.clientX, ev.clientY);
      if (p && Math.hypot(p.x, p.y) < 2) click(ev);
    };
    button.addEventListener('pointerdown', click);
    world.canvas.addEventListener('pointerdown', canvasClick);
    v.cleanup = () => {
      button.removeEventListener('pointerdown', click);
      world.canvas.removeEventListener('pointerdown', canvasClick);
      panel.remove();
    };
    v.label = label;
    return g;
  },
  update(v, a, b, k, dt, world) {
    const snap = world.snaps[world.snaps.length - 1]?.snap;
    const hud = snap?.hud;
    if (hud && v.label.textContent !== hud.label) v.label.textContent = hud.label;
  },
  remove(v) { v.cleanup?.(); },
});

registerMapBuilder('ux6towerarena', (map, world) => {
  const scen = new THREE.Group();
  const stone = M.triMat('tex_stone.webp', '#6e7188', '#b9b7ca', 1);
  const gold = M.goldMat();
  const half = map.floor.w / 2;
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8;
    const x = Math.cos(a) * half * 0.88;
    const z = Math.sin(a) * half * 0.88;
    scen.add(M.mesh(M.lathe([[0.3, 0], [0.38, 0.2], [0.27, 1.45], [0.38, 1.55], [0.05, 1.72]], 8), stone, x, 0, z));
    scen.add(M.mesh(M.scaled(M.G.sphere, 0.12), gold, x, 1.76, z));
  }
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const x = Math.cos(a) * half * 0.55;
    const z = Math.sin(a) * half * 0.55;
    scen.add(M.mesh(new THREE.TorusGeometry(0.48, 0.05, 8, 24).rotateX(Math.PI / 2), gold, x, 0.04, z));
  }
  bakeStatic(scen);
  world.mapGroup.add(scen);
});
