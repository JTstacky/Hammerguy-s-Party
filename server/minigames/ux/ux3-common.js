import { wc3, rand } from '../../../engine/server/sim.js';

export const ring = (n, radius, offset = 0) => Array.from({ length: n }, (_, i) => {
  const a = offset + i * Math.PI * 2 / n;
  return [Math.cos(a) * wc3(radius), Math.sin(a) * wc3(radius)];
});
export const inside = (u, hx, hy) => {
  u.x = Math.max(-hx + u.r, Math.min(hx - u.r, u.x));
  u.y = Math.max(-hy + u.r, Math.min(hy - u.r, u.y));
};
export const wander = (u, hx, hy, mem) => {
  if (!u.target || Math.random() < 0.17) u.order(rand(-hx + 1, hx - 1), rand(-hy + 1, hy - 1));
};
export const active = (game) => game.time >= 5;
