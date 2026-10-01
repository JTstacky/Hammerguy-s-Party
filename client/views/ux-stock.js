// Four shared indexes, eight broker stalls, and the trading panel.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { registerSkin, registerView, registerEvent, registerMapBuilder, registerTheme } from '../../engine/client/render/registry.js';
import { pivot, limb, oval } from './ux4-common.js';

const NAMES = ['Human', 'Orc', 'Undead', 'Night Elf'];
const COLORS = ['#4c9eff', '#e25545', '#b591d6', '#88db7f'];

function broker(color) {
  const g = new THREE.Group();
  const body = pivot(0, 0, 0);
  body.scale.setScalar(1.28);
  g.add(body);
  const coat = M.leatherMat('#394c65');
  const skin = M.mat('#d6b08a', { roughness: 0.7 });
  const shirt = M.mat('#e3d7b8', { roughness: 0.8 });
  const gold = M.goldMat('#c29a4e');
  const team = M.mat(color, { roughness: 0.55 });
  const legs = [-1, 1].map((s) => {
    const p = pivot(0, 0.65, s * 0.18);
    p.add(limb([0, 0, 0], [0.03, -0.48, 0], 0.11, 0.09, coat));
    p.add(oval(0.21, 0.1, 0.12, M.leatherMat('#382e2a'), 0.14, -0.52, 0));
    body.add(p);
    return p;
  });
  body.add(oval(0.34, 0.45, 0.27, coat, 0, 1.12, 0));
  body.add(M.mesh(M.scaled(M.G.box, 0.13, 0.45, 0.03), shirt, 0.31, 1.14, 0));
  body.add(M.mesh(M.scaled(M.G.box, 0.09, 0.34, 0.05), team, 0.37, 1.12, 0));
  body.add(oval(0.21, 0.22, 0.2, skin, 0.1, 1.65, 0));
  body.add(M.mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.08, 20), coat, 0.06, 1.88, 0));
  body.add(M.mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.34, 20), coat, 0.06, 2.06, 0));
  body.add(M.mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.07, 20), gold, 0.06, 1.99, 0));
  for (const s of [-1, 1]) {
    body.add(limb([0.03, 1.4, s * 0.3], [0.3, 0.92, s * 0.42], 0.11, 0.07, coat));
    body.add(oval(0.1, 0.1, 0.1, skin, 0.31, 0.88, s * 0.42));
  }
  const ledger = pivot(0.43, 0.9, 0);
  ledger.add(M.mesh(M.scaled(M.G.box, 0.42, 0.04, 0.32), M.leatherMat('#643b34')));
  ledger.add(M.mesh(M.scaled(M.G.box, 0.36, 0.015, 0.27), shirt, 0, 0.035, 0));
  body.add(ledger);
  g.userData = { body, legL: legs[1], legR: legs[0], staff: ledger, kind: 'hero' };
  return g;
}
registerSkin('uxbroker', broker);

registerTheme('uxexchange',
  { sky: '#b1ad9b', fog: '#b2ab9a', sun: '#fff0c6', hemi: ['#f5e8c8', '#514e50'], sunI: 2 },
  { floor: { tex: 'tex_marble.webp', tint: '#c0b9a9', color: '#a9a08f', units: 5 }, edge: { tex: 'tex_stone.webp', tint: '#8e8d82', color: '#77776e', units: 5 }, outer: { tex: 'tex_grass.webp', tint: '#718164', color: '#64735b' }, edgeWidth: 1.1 });

registerMapBuilder('uxstock', (map, world) => {
  const g = new THREE.Group();
  const stone = M.triMat('tex_boulder.webp', '#8e8678', '#b6aa91', 0.8);
  const wood = M.leatherMat('#715344');
  const metal = M.goldMat('#c2a260');
  const xs = [-384, -128, 160, 416].map((x) => x / 54);
  for (const y of [-192, -416]) for (const x of xs) {
    const z = y / 54;
    g.add(M.mesh(M.scaled(M.G.box, 2.2, 0.17, 0.7), wood, x, 0.85, z - 0.9));
    for (const dx of [-0.95, 0.95]) g.add(M.mesh(M.scaled(M.G.box, 0.12, 0.8, 0.12), stone, x + dx, 0.4, z - 0.9));
    g.add(M.mesh(M.scaled(M.G.box, 1.8, 0.45, 0.08), stone, x, 1.35, z - 1.22));
    g.add(M.mesh(M.scaled(M.G.box, 1.65, 0.05, 0.1), metal, x, 1.36, z - 1.16));
  }
  for (let i = 0; i < 4; i++) {
    const x = [-320, -96, 128, 320][i] / 54;
    g.add(M.mesh(M.scaled(M.G.cyl, 0.65, 1.5, 0.65), stone, x, 0.75, 2.2));
    g.add(M.mesh(M.scaled(M.G.sphere, 0.57), M.mat(COLORS[i]), x, 1.75, 2.2));
    g.add(M.mesh(M.scaled(M.G.box, 0.9, 0.11, 0.5), metal, x, 2.3, 2.2));
  }
  for (const x of [-10.4, 10.4]) for (const z of [-8.7, 8.7]) {
    g.add(M.mesh(M.scaled(M.G.cyl, 0.55, 2.5, 0.55), stone, x, 1.25, z));
    g.add(M.mesh(M.scaled(M.G.sphere, 0.42), metal, x, 2.65, z));
  }
  bakeStatic(g);
  world.mapGroup.add(g);
});

function panel() {
  const el = document.createElement('div');
  el.id = 'ux-stock-panel';
  el.style.cssText = 'position:absolute;left:8px;top:48px;width:min(430px,58vw);padding:5px 8px;border:2px solid #bda56b;border-radius:8px;background:rgba(21,25,33,.94);color:#fff1cf;font:600 11px system-ui;box-shadow:0 5px 20px #0009;pointer-events:auto';
  const title = document.createElement('div');
  title.style.cssText = 'display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px';
  el.appendChild(title);
  const rows = [];
  for (let i = 0; i < 4; i++) {
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:1fr 65px 35px 45px 45px;gap:3px;align-items:center;margin:1px 0';
    const label = document.createElement('span');
    label.textContent = NAMES[i];
    label.style.color = COLORS[i];
    const price = document.createElement('span');
    const held = document.createElement('span');
    const buy = document.createElement('button');
    const sell = document.createElement('button');
    for (const b of [buy, sell]) b.style.cssText = 'padding:3px;border:1px solid #a78b58;border-radius:4px;background:#514737;color:white;font:700 12px system-ui;touch-action:manipulation';
    buy.textContent = 'Buy';
    sell.textContent = 'Sell';
    buy.onclick = () => window.game?.send({ t: 'cmd', c: 'trade', index: i, sell: false });
    sell.onclick = () => window.game?.send({ t: 'cmd', c: 'trade', index: i, sell: true });
    row.append(label, price, held, buy, sell);
    el.appendChild(row);
    rows.push({ price, held, buy, sell });
  }
  const details = document.createElement('details');
  details.style.cssText = 'margin-top:4px;border-top:1px solid #7d6c50;padding-top:3px';
  const summary = document.createElement('summary');
  summary.textContent = 'All portfolios  ·  H / O / U / NE';
  const portfolios = document.createElement('div');
  portfolios.style.cssText = 'max-height:100px;overflow:auto;white-space:pre;font:11px monospace';
  details.append(summary, portfolios);
  el.appendChild(details);
  document.getElementById('hud').appendChild(el);
  return { el, title, rows, portfolios };
}

registerView('uxmarket', {
  make(e, world, v) {
    v.panel = panel();
    return new THREE.Group();
  },
  update(v, a, b) {
    const p = v.panel;
    const seconds = Math.ceil(b.t);
    if (v.gold !== b.g || v.seconds !== seconds) {
      p.title.textContent = `MARKET  ·  Gold ${b.g}  ·  ${seconds}s`;
      v.gold = b.g;
      v.seconds = seconds;
    }
    for (let i = 0; i < 4; i++) {
      const row = p.rows[i];
      if (row.lastPrice !== b.p[i] || row.lastDelta !== b.d[i]) {
        row.price.textContent = `${b.p[i]}g (${b.d[i] > 0 ? '+' : ''}${b.d[i]})`;
        row.lastPrice = b.p[i];
        row.lastDelta = b.d[i];
      }
      if (row.lastHeld !== b.h[i]) {
        row.held.textContent = `×${b.h[i]}`;
        row.lastHeld = b.h[i];
      }
      row.buy.disabled = b.g < b.p[i] || b.t <= 0;
      row.sell.disabled = b.h[i] < 1 || b.t <= 0;
    }
    let changed = false;
    for (let i = 0; i < b.o.length; i++) for (let j = 0; j < 5; j++) {
      if (v.owners?.[i]?.[j] !== b.o[i][j]) changed = true;
    }
    if (changed) {
      p.portfolios.textContent = b.o.map((line) => `${window.game?.world.names[line[0]] || line[0]}: ${line.slice(1).join(' / ')}`).join('\n');
      v.owners = b.o;
    }
  },
  remove(v) { v.panel.el.remove(); },
});
registerEvent('uxtrade', (e, world) => world.fx.flash(e.x, e.y, 0.9, e.s === 'BUY' ? '#70eaa4' : '#ffd56e', 0.25));
