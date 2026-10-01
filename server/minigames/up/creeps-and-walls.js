// Helpers shared by the ports in this batch (Kaboom Room, Clean-up Crew,
// Treant Valley, Skeleton Sonata, Spike Pit, Salamander Sizzle): arena walls
// and blockers, and WC3 melee creeps that chase and hit hammerguys.
import { clamp, dist, round1, wrapAngle } from '../../../engine/server/sim.js';

// Keeps a unit inside an octagon: |x|, |y| <= a and |x| + |y| <= d (the WC3
// arenas with cliff-cut corners).
export function clampOct(u, a, d) {
  u.x = clamp(u.x, -a + u.r, a - u.r);
  u.y = clamp(u.y, -a + u.r, a - u.r);
  const lim = d - u.r * Math.SQRT2;
  const s = Math.abs(u.x) + Math.abs(u.y);
  if (s > lim) {
    const e = (s - lim) / 2;
    u.x -= Math.sign(u.x) * e;
    u.y -= Math.sign(u.y) * e;
  }
}

export function inOct(x, y, a, d, m = 0) {
  return Math.abs(x) <= a - m && Math.abs(y) <= a - m && Math.abs(x) + Math.abs(y) <= d - m * Math.SQRT2;
}

// Pushes a unit's circle out of an axis-aligned square blocker (a pillar, a
// tree wall tile): WC3 pathing blocks are square.
export function pushOutSquare(u, cx, cy, h) {
  const dx = u.x - cx;
  const dy = u.y - cy;
  // Nearest point of the square to the unit centre.
  const nx = clamp(dx, -h, h);
  const ny = clamp(dy, -h, h);
  const ox = dx - nx;
  const oy = dy - ny;
  const d = Math.hypot(ox, oy);
  if (d >= u.r) return false;
  if (d > 1e-6) {
    u.x += (ox / d) * (u.r - d);
    u.y += (oy / d) * (u.r - d);
  } else {
    // Centre inside the square: leave by the nearest side.
    const ex = h + u.r - Math.abs(dx);
    const ey = h + u.r - Math.abs(dy);
    if (ex < ey) u.x += (dx >= 0 ? 1 : -1) * ex;
    else u.y += (dy >= 0 ? 1 : -1) * ey;
  }
  return true;
}

export function pushOutCircle(u, cx, cy, r) {
  const dx = u.x - cx;
  const dy = u.y - cy;
  const d = Math.hypot(dx, dy);
  const min = r + u.r;
  if (d >= min) return false;
  const k = d > 1e-6 ? min / d : 0;
  if (k) {
    u.x = cx + dx * k;
    u.y = cy + dy * k;
  } else u.x = cx + min;
  return true;
}

// A WC3 melee creep: chases its victim, stops in range, turns to face it and
// swings. The hit is committed when the swing starts and lands after the
// damage point unless the victim got beyond range + the 250 u "range motion
// buffer" (engine.md). The creep stands still for the whole damage point.
//   c: a Unit with c.atk = { range, cd, point, roll() }, c.atkT, c.swing, c.victim
//   hit(c, victim): applies the damage
export const MOTION_BUFFER = 250 / 54;

export function stepMelee(c, dt, hit, onSwing) {
  if (c.atkT > 0) c.atkT -= dt;
  const A = c.atk;
  if (c.swing) {
    c.swing.t += dt;
    if (c.swing.t >= A.point) {
      const v = c.swing.v;
      c.swing = null;
      if (v.alive && dist(c.x, c.y, v.x, v.y) - c.r - v.r <= A.range + MOTION_BUFFER) hit(c, v);
    }
    return;
  }
  const v = c.victim;
  if (!v || !v.alive) return;
  const gap = dist(c.x, c.y, v.x, v.y) - c.r - v.r;
  if (gap > A.range) {
    if (c.target) c.steer(v.x, v.y);
    else c.order(v.x, v.y);
    return;
  }
  if (c.target) c.stop();
  const ang = Math.atan2(v.y - c.y, v.x - c.x);
  if (Math.abs(wrapAngle(ang - c.heading)) > 0.35) {
    c.faceTo = ang;
    return;
  }
  c.faceTo = null;
  if (c.atkT > 0) return;
  c.atkT = A.cd;
  c.swing = { t: 0, v };
  onSwing?.(c, v);
}

export function hitEvent(game, v) {
  game.ev({ k: 'hit', x: round1(v.x), y: round1(v.y) });
}
