// Shared helpers for the batch-D ports (Dark Forest, Sleepy Time, The Plague,
// The Sheep Shearers, Doggy Hell, Ancient Punisher). Only these games import it.
//  - WC3 melee attacks for creatures and hero units that carry their own weapon
//    (the base class's `this.attack` gives every hero the same one).
//  - Solid round obstacles (trees, pillars) that units slide round.
//  - Axis-aligned rectangles in WC3 coordinates.
//
// Coordinates: sim x = WC3 x, sim y = -WC3 y (relative to the arena centre), so
// that WC3 north is at the top of the screen.
import { dist, rand, round1, wc3, wrapAngle } from '../../../engine/server/sim.js';

// engine.md: a melee swing starts when the target is within range + both
// collision radii + about 60 u, and once started it lands unless the target is
// more than range + 250 u (WC3's range motion buffer) away at the damage point.
export const SWING_SLACK = wc3(60);
export const MOTION_BUFFER = wc3(250);

export const roll = ([a, b]) => a + Math.random() * (b - a);

// Gap between two units' collision circles.
export const gap = (a, b) => dist(a.x, a.y, b.x, b.y) - a.r - b.r;

// One step of a WC3 melee attack for unit `u` against `u.atkTarget`.
//   u.weapon = { range, cd, point, dmg: [min, max] }
// Chases while out of reach, stands for the swing, then calls onHit(u, tgt, dmg).
// Returns 'swing' on the step a swing starts (for the attack animation event).
export function meleeStep(u, dt, onHit) {
  const W = u.weapon;
  if (u.atkCd > 0) u.atkCd -= dt;
  if (u.swing) {
    u.swing.t += dt;
    if (u.swing.t >= W.point) {
      const t = u.swing.tgt;
      u.swing = null;
      if (t.alive && gap(u, t) <= W.range + MOTION_BUFFER) onHit(u, t, roll(W.dmg));
    }
    return null;
  }
  const t = u.atkTarget;
  if (!t) return null;
  if (!t.alive) {
    u.atkTarget = null;
    return null;
  }
  const g = gap(u, t);
  const ang = Math.atan2(t.y - u.y, t.x - u.x);
  if (g > W.range + SWING_SLACK * (u.walking ? 1 : 0) + 1e-6) {
    if (u.target) u.steer(t.x, t.y);
    else u.order(t.x, t.y);
    return null;
  }
  if (u.target) u.stop();
  if (Math.abs(wrapAngle(ang - u.heading)) > 0.35) {
    u.faceTo = ang;
    return null;
  }
  u.faceTo = null;
  if (u.atkCd > 0) return null;
  u.atkCd = W.cd;
  u.swing = { t: 0, tgt: t };
  return 'swing';
}

// Pushes ground unit `u` out of round obstacles [{x, y, r}], sliding it round
// them so a unit walking straight at a tree goes round it instead of sticking.
export function avoidObstacles(u, obstacles) {
  for (const o of obstacles) {
    const dx = u.x - o.x;
    const dy = u.y - o.y;
    const d = Math.hypot(dx, dy) || 0.001;
    const min = o.r + u.r;
    if (d >= min) continue;
    const nx = dx / d;
    const ny = dy / d;
    u.x = o.x + nx * min;
    u.y = o.y + ny * min;
    if (u.walking) {
      // Slide along the tangent on the side the unit is already heading for.
      const hx = Math.cos(u.heading);
      const hy = Math.sin(u.heading);
      let side = -ny * hx + nx * hy;
      if (Math.abs(side) < 0.15) side = u.id % 2 ? 1 : -1;
      const s = Math.sign(side) * (min - d + 0.02);
      u.x += -ny * s;
      u.y += nx * s;
    }
  }
}

// Clamps a unit into the rectangle |x| <= hw, |y| <= hh.
export function clampRect(u, hw, hh) {
  u.x = Math.max(-hw + u.r, Math.min(hw - u.r, u.x));
  u.y = Math.max(-hh + u.r, Math.min(hh - u.r, u.y));
}

// A rectangle given by WC3 bounds relative to the arena centre (x0, x1, y0, y1,
// with WC3 y up), converted to sim units (y flipped).
export function wrect(x0, x1, y0, y1) {
  return { x0: wc3(x0), x1: wc3(x1), y0: wc3(-y1), y1: wc3(-y0) };
}

export const inRect = (r, x, y, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && y >= r.y0 - pad && y <= r.y1 + pad;

// Random point on a ring round the origin.
export function ringPoint(r0, r1) {
  const a = rand(0, Math.PI * 2);
  const r = rand(r0, r1);
  return [Math.cos(a) * r, Math.sin(a) * r];
}

// A WC3 AI "move outward" order: 200-500 u from the unit, heading away from
// the centre +-120 degrees (Dark Forest, The Plague).
export function outwardPoint(u, d0, d1, hw, hh = hw) {
  const base = Math.hypot(u.x, u.y) > 0.01 ? Math.atan2(u.y, u.x) : rand(0, Math.PI * 2);
  const a = base + rand(-1, 1) * ((120 * Math.PI) / 180);
  const d = rand(d0, d1);
  return [Math.max(-hw, Math.min(hw, u.x + Math.cos(a) * d)), Math.max(-hh, Math.min(hh, u.y + Math.sin(a) * d))];
}

export const r1 = round1;
