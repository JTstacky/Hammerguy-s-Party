// Small helpers shared by the race ports in this folder (Roadkill, Stop and
// Go, Push the Ogre, Horse Race, Quillboar Mile, Flight of the Footmen).
import { clamp, round2 } from '../../../engine/server/sim.js';

// Pushes a unit's circle out of an axis-aligned box {x0, y0, x1, y1}, so it
// slides along the side it walked into (cliffs, walls, tree blocks).
export function pushOutRect(u, b) {
  const cx = clamp(u.x, b.x0, b.x1);
  const cy = clamp(u.y, b.y0, b.y1);
  const dx = u.x - cx;
  const dy = u.y - cy;
  const d = Math.hypot(dx, dy);
  if (d >= u.r) return;
  if (d > 1e-6) {
    u.x = cx + (dx / d) * u.r;
    u.y = cy + (dy / d) * u.r;
    return;
  }
  const l = u.x - b.x0;
  const r = b.x1 - u.x;
  const t = u.y - b.y0;
  const btm = b.y1 - u.y;
  const m = Math.min(l, r, t, btm);
  if (m === l) u.x = b.x0 - u.r;
  else if (m === r) u.x = b.x1 + u.r;
  else if (m === t) u.y = b.y0 - u.r;
  else u.y = b.y1 + u.r;
}

// A box from two corners in any order.
export const box = (ax, ay, bx, by) => ({ x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) });

export function ordinal(n) {
  return n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');
}

// Race Finish in the original scores the unit and removes it with a teleport
// effect. The hero stays in the game's lists (so ranking works) but stops
// colliding and leaves the snapshot a moment after the flash.
export function arrive(game, pid) {
  const u = game.heroes.get(pid);
  if (!u || u.finished || !u.alive) return;
  game.finish(pid);
  u.solid = false;
  (game.goneT ??= new Map()).set(pid, game.time);
  game.ev({ k: 'tele', x1: round2(u.x), y1: round2(u.y), x2: round2(u.x), y2: round2(u.y) });
}

export function withoutGone(game, ents) {
  if (!game.goneT) return ents;
  return ents.filter((e) => !(game.goneT.has(e.o) && game.time - game.goneT.get(e.o) > 0.4));
}

export function raceLabel(game, pid) {
  const u = game.heroes.get(pid);
  if (u?.finished) return `Home! ${ordinal(game.finishOrder.indexOf(pid) + 1)} place`;
  return `${game.finishOrder.length} of ${game.pids.length} home`;
}
