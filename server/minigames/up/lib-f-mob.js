// Player 12's melee creatures for the ports in this batch (spiders,
// sasquatches, bears, hippogryphs): WC3 melee as measured in engine.md.
//  - A unit walks into range (range + both collision radii), turns to face
//    and starts a swing when its cooldown allows.
//  - The hit is decided when the swing starts and lands after the damage
//    point, unless the target got out of range + the 250 u "range motion
//    buffer" by then, or is gone.
import { Unit, dist, wc3, round2 } from '../../../engine/server/sim.js';

const MOTION_BUFFER = wc3(250);

export function makeMob(kind, x, y, { speed, r, hp = 100, acq, range, cd, point = 0.5, turnRate = 0.6 }) {
  const m = new Unit({ kind, x, y, r, speed, hp });
  m.turnRate = turnRate;
  m.atk = { range, cd, point };
  m.acq = acq;
  m.tgt = null;
  m.swing = null;
  m.atkCd = 0;
  return m;
}

// Swing logic for a mob with a target (m.tgt). Returns true while the mob
// is attacking (in range or mid-swing), false when it still has to close in.
export function meleeTick(m, dt, onHit) {
  if (m.atkCd > 0) m.atkCd -= dt;
  if (m.swing) {
    m.swing.t += dt;
    if (m.swing.t >= m.atk.point) {
      const t = m.swing.tgt;
      m.swing = null;
      if (t.alive && dist(m.x, m.y, t.x, t.y) - m.r - t.r <= m.atk.range + MOTION_BUFFER) onHit(t);
    }
    return true;
  }
  const t = m.tgt;
  if (!t || !t.alive) return false;
  const gap = dist(m.x, m.y, t.x, t.y) - m.r - t.r;
  if (gap > m.atk.range) return false;
  m.stop();
  const ang = Math.atan2(t.y - m.y, t.x - m.x);
  if (!m.facingAt(ang, 0.35)) {
    m.faceTo = ang;
    return true;
  }
  m.faceTo = null;
  if (m.atkCd <= 0 && m.stun <= 0) {
    m.atkCd = m.atk.cd;
    m.swing = { t: 0, tgt: t };
  }
  return true;
}

// Nearest candidate within acquisition `range`, or null. Measured from the
// creature's centre to the target's edge.
export function nearest(m, list, range) {
  let best = null;
  let bd = range;
  for (const v of list) {
    if (!v.alive) continue;
    const d = dist(m.x, m.y, v.x, v.y) - v.r;
    if (d <= bd) {
      bd = d;
      best = v;
    }
  }
  return best;
}

export function mobSnap(m, extra = {}) {
  const s = { id: m.id, k: m.kind, x: round2(m.x), y: round2(m.y), f: round2(m.facing) };
  if (m.mx || m.my) s.mv = 1;
  if (m.swing) s.sw = round2(m.swing.t / m.atk.point);
  if (!m.alive) s.dead = 1;
  return Object.assign(s, extra);
}
