import { wc3, rand } from '../../../engine/server/sim.js';

export const ring = (n, radius, start = 45) => Array.from({ length: n }, (_, i) => {
  const a = (start + i * 45) * Math.PI / 180;
  return [Math.cos(a) * wc3(radius), Math.sin(a) * wc3(radius)];
});

export function rim(hw, hh, theme = 'tree', step = 2.3) {
  const p = [];
  for (let x = -hw; x <= hw; x += step) for (const s of [-1, 1]) {
    p.push({ t: theme, x: x + rand(-0.4, 0.4), y: s * (hh + rand(0.5, 1.3)), s: rand(0.8, 1.3) });
  }
  for (let y = -hh; y <= hh; y += step) for (const s of [-1, 1]) {
    p.push({ t: theme, x: s * (hw + rand(0.5, 1.3)), y: y + rand(-0.4, 0.4), s: rand(0.8, 1.3) });
  }
  return p;
}

export const nearest = (u, units, max = Infinity) => {
  let best = null;
  let d0 = max;
  for (const v of units) {
    if (!v.alive || v === u) continue;
    const d = Math.hypot(u.x - v.x, u.y - v.y);
    if (d < d0) { best = v; d0 = d; }
  }
  return best;
};

export const noTies = (klass) => { klass.prototype.deathGroups = function () { return this.elimOrder.map((e) => [e.pid]); }; };
