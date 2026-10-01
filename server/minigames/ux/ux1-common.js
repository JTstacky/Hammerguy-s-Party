import { wc3, rand } from '../../../engine/server/sim.js';

export const ring = (n, radius, step = 135, start = -22.5) => Array.from({ length: n }, (_, i) => {
  const a = (start + i * step) * Math.PI / 180;
  return [wc3(radius) * Math.cos(a), wc3(radius) * Math.sin(a)];
});
export const shuffled = (a) => a.sort(() => Math.random() - 0.5);
export const nearestEnemy = (game, pid, u) => {
  let best = null, bd = Infinity;
  for (const [p, v] of game.heroes) {
    if (p === pid || !v.alive || v.finished) continue;
    const d = Math.hypot(v.x - u.x, v.y - u.y);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
};
export const randomPoint = (hw, hh) => [rand(-hw, hw), rand(-hh, hh)];
export const pauseCommand = (game, pid, m, pause) => {
  if (game.time < pause) return true;
  return false;
};
