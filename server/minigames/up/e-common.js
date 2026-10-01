// Helpers shared by the port/E games (#6, #10, #25, #28, #30, #35): WC3
// coordinates, damage and armour math, "no ties" scoring, walls and trees
// (collision plus grid pathfinding, the way WC3 units path round doodads),
// and idle target acquisition.
import { wc3, dist, clamp } from '../../../engine/server/sim.js';

// WC3 offsets from the arena centre to Hammerguy units. WC3's +y is north, and
// north is the top of our screen (-y), so y flips. Angles flip with it.
export const W = (x, y) => [wc3(x), -wc3(y)];
export const wAng = (deg) => (-deg * Math.PI) / 180;

// Spawn ring of Uther Party's pre-created units: angle playerSlot * 135 - 22.5
// (slots 1-8), which gives 8 spots 45 degrees apart.
export const slotAngle = (slot) => slot * 135 - 22.5;
export function ringSpots(n, radius) {
  const out = [];
  for (let s = 1; s <= n; s++) {
    const a = wAng(slotAngle(s));
    out.push([Math.cos(a) * wc3(radius), Math.sin(a) * wc3(radius)]);
  }
  return out;
}

// Next Event hands the pre-created units out at random.
export function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const dice = (n, sides) => {
  let s = 0;
  for (let i = 0; i < n; i++) s += 1 + Math.floor(Math.random() * sides);
  return s;
};
export const between = (a, b) => a + Math.random() * (b - a);

// WC3 1.26 armour: reduction 0.06 A / (1 + 0.06 A).
export const armorMult = (a) => (a >= 0 ? 1 - (0.06 * a) / (1 + 0.06 * a) : 2 - 0.94 ** -a);

// Attack type vs armour type (MiscGame.txt, 1.26).
const TABLE = {
  normal: { light: 1, medium: 1.5, heavy: 1, fort: 0.7, hero: 1, unarmored: 1 },
  pierce: { light: 2, medium: 0.75, heavy: 1, fort: 0.35, hero: 0.5, unarmored: 1.5 },
  magic: { light: 1.25, medium: 0.75, heavy: 2, fort: 0.35, hero: 0.5, unarmored: 1 },
  siege: { light: 1, medium: 0.5, heavy: 1, fort: 1.5, hero: 0.5, unarmored: 1.5 },
  hero: { light: 1, medium: 1, heavy: 1, fort: 0.5, hero: 1, unarmored: 1 },
  chaos: { light: 1, medium: 1, heavy: 1, fort: 1, hero: 1, unarmored: 1 },
};
export const typeMult = (atk, armor) => TABLE[atk]?.[armor] ?? 1;

// Games without ties (TiesPossible false): units that die in the same instant
// are still scored one by one, so each death is its own group. If the last
// ones die together, the one processed last scores the winner's 8, which the
// base payout gives the last group anyway.
export function noTies(Game) {
  Game.prototype.deathGroups = function () {
    return this.elimOrder.map((e) => [e.pid]);
  };
  return Game;
}

// ------------------------------------------------------------ obstacles

// Solid obstacles: axis-aligned boxes {x0, y0, x1, y1} and circles {x, y, r},
// in Hammerguy units. push() moves a unit out of them, sliding along the face.
export class Obstacles {
  constructor() {
    this.boxes = [];
    this.circles = [];
  }

  box(x0, y0, x1, y1, tag) {
    this.boxes.push({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), tag });
    return this;
  }

  circle(x, y, r, tag) {
    this.circles.push({ x, y, r, tag });
    return this;
  }

  // True if a circle of radius r at (x, y) overlaps an obstacle.
  hits(x, y, r = 0, skip) {
    for (const b of this.boxes) {
      if (b.tag && b.tag === skip) continue;
      const cx = clamp(x, b.x0, b.x1);
      const cy = clamp(y, b.y0, b.y1);
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r || (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1)) return true;
    }
    for (const c of this.circles) {
      if (c.tag && c.tag === skip) continue;
      if (dist(x, y, c.x, c.y) < c.r + r) return true;
    }
    return false;
  }

  push(u, skip) {
    for (let pass = 0; pass < 2; pass++) {
      for (const b of this.boxes) {
        if (b.tag && b.tag === skip) continue;
        const cx = clamp(u.x, b.x0, b.x1);
        const cy = clamp(u.y, b.y0, b.y1);
        const dx = u.x - cx;
        const dy = u.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= u.r * u.r) continue;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2);
          u.x = cx + (dx / d) * u.r;
          u.y = cy + (dy / d) * u.r;
        } else {
          // Centre inside the box: leave by the nearest face.
          const opts = [
            [u.x - b.x0, -1, 0],
            [b.x1 - u.x, 1, 0],
            [u.y - b.y0, 0, -1],
            [b.y1 - u.y, 0, 1],
          ].sort((p, q) => p[0] - q[0]);
          const [, nx, ny] = opts[0];
          if (nx) u.x = nx < 0 ? b.x0 - u.r : b.x1 + u.r;
          else u.y = ny < 0 ? b.y0 - u.r : b.y1 + u.r;
        }
      }
      for (const c of this.circles) {
        if (c.tag && c.tag === skip) continue;
        const d = dist(u.x, u.y, c.x, c.y);
        const min = c.r + u.r;
        if (d >= min) continue;
        const k = min / (d || 0.01);
        u.x = c.x + (u.x - c.x) * k || c.x + min;
        u.y = c.y + (u.y - c.y) * k;
      }
    }
  }
}

// ------------------------------------------------------------ pathing

// A* over a square grid of `cell`-sized cells covering [-hw, hw] x [-hh, hh].
// A cell is open if a unit of radius `clear` fits at its centre. Paths are
// smoothed by line-of-sight, so units walk straight wherever they can, as WC3
// units do.
export class Nav {
  constructor(obs, hw, hh, cell, clear, inside = () => true) {
    this.obs = obs;
    this.hw = hw;
    this.hh = hh;
    this.cell = cell;
    this.clear = clear;
    this.cols = Math.ceil((hw * 2) / cell);
    this.rows = Math.ceil((hh * 2) / cell);
    this.open = new Uint8Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const [x, y] = this.center(c, r);
        this.open[r * this.cols + c] = !obs.hits(x, y, clear * 0.92) && inside(x, y) ? 1 : 0;
      }
    }
  }

  center(c, r) {
    return [-this.hw + (c + 0.5) * this.cell, -this.hh + (r + 0.5) * this.cell];
  }

  cellOf(x, y) {
    return [clamp(Math.floor((x + this.hw) / this.cell), 0, this.cols - 1), clamp(Math.floor((y + this.hh) / this.cell), 0, this.rows - 1)];
  }

  // Straight walk from a to b without touching an obstacle.
  clearLine(ax, ay, bx, by, r = this.clear) {
    const d = dist(ax, ay, bx, by);
    const n = Math.ceil(d / (this.cell * 0.25));
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      if (this.obs.hits(ax + (bx - ax) * k, ay + (by - ay) * k, r * 0.9)) return false;
    }
    return true;
  }

  nearestOpen(c, r) {
    if (this.open[r * this.cols + c]) return [c, r];
    for (let rad = 1; rad < 8; rad++) {
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          const cc = c + dc;
          const rr = r + dr;
          if (cc < 0 || rr < 0 || cc >= this.cols || rr >= this.rows) continue;
          if (this.open[rr * this.cols + cc]) return [cc, rr];
        }
      }
    }
    return null;
  }

  // Waypoints from (ax, ay) to (bx, by), not including the start.
  path(ax, ay, bx, by) {
    if (this.clearLine(ax, ay, bx, by)) return [[bx, by]];
    const s = this.nearestOpen(...this.cellOf(ax, ay));
    const g = this.nearestOpen(...this.cellOf(bx, by));
    if (!s || !g) return [[bx, by]];
    const C = this.cols;
    const start = s[1] * C + s[0];
    const goal = g[1] * C + g[0];
    const cost = new Float32Array(C * this.rows).fill(Infinity);
    const from = new Int32Array(C * this.rows).fill(-1);
    const heur = (i) => Math.hypot((i % C) - g[0], Math.floor(i / C) - g[1]);
    const open = [[heur(start), start]];
    cost[start] = 0;
    let found = start === goal;
    while (open.length && !found) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, cur] = open.splice(bi, 1)[0];
      const cc = cur % C;
      const cr = Math.floor(cur / C);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue;
          const nc = cc + dc;
          const nr = cr + dr;
          if (nc < 0 || nr < 0 || nc >= C || nr >= this.rows) continue;
          const ni = nr * C + nc;
          if (!this.open[ni]) continue;
          // No corner cutting between two blocked cells.
          if (dc && dr && (!this.open[cr * C + nc] || !this.open[nr * C + cc])) continue;
          const nc2 = cost[cur] + (dc && dr ? 1.4142 : 1);
          if (nc2 >= cost[ni]) continue;
          cost[ni] = nc2;
          from[ni] = cur;
          if (ni === goal) {
            found = true;
            break;
          }
          open.push([nc2 + heur(ni), ni]);
        }
        if (found) break;
      }
    }
    if (!found) return [[bx, by]];
    const cells = [];
    for (let i = goal; i !== -1 && i !== start; i = from[i]) cells.push(this.center(i % C, Math.floor(i / C)));
    cells.reverse();
    // The real goal replaces the last cell centre if it is reachable from it.
    const endOpen = !this.obs.hits(bx, by, this.clear * 0.9);
    if (endOpen) cells.push([bx, by]);
    // Smooth: skip every waypoint that can be seen past.
    const out = [];
    let px = ax;
    let py = ay;
    let i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.clearLine(px, py, cells[j][0], cells[j][1])) j--;
      out.push(cells[j]);
      [px, py] = cells[j];
      i = j + 1;
    }
    return out.length ? out : [[bx, by]];
  }
}

// Orders a unit along a path (u.path holds the waypoints after the first).
export function goTo(nav, u, x, y) {
  const p = nav ? nav.path(u.x, u.y, x, y) : [[x, y]];
  const [first, ...rest] = p;
  u.order(first[0], first[1]);
  u.path = rest;
}

// Moves on to the next waypoint without WC3's stop when close to the current one.
export function followPaths(units) {
  for (const u of units) {
    if (!u.alive || !u.path?.length) continue;
    if (!u.target) {
      const [x, y] = u.path.shift();
      u.order(x, y);
    } else if (dist(u.x, u.y, u.target.x, u.target.y) < Math.max(0.35, u.speed * 0.08)) {
      const [x, y] = u.path.shift();
      u.steer(x, y);
    }
  }
}

// The nearest candidate within `range` (edge to edge), for idle acquisition.
export function nearest(u, list, range = Infinity) {
  let best = null;
  let bd = Infinity;
  for (const v of list) {
    if (!v.alive || v === u) continue;
    const d = dist(u.x, u.y, v.x, v.y) - u.r - v.r;
    if (d <= range && d < bd) {
      bd = d;
      best = v;
    }
  }
  return best;
}

// A unit doing nothing: no move, no attack, no cast, no swing.
export const idle = (u) => u.alive && !u.target && !u.attackOrder && !u.cast && !u.swing && !u.path?.length && !(u.stun > 0);

// Octagonal arenas: a square of half-width hw with its corners cut so that
// |x| + |y| <= 2 hw - cut. Keeps a unit (radius r) inside.
export function clampOct(u, hw, cut) {
  u.x = clamp(u.x, -hw + u.r, hw - u.r);
  u.y = clamp(u.y, -hw + u.r, hw - u.r);
  const lim = 2 * hw - cut - u.r * Math.SQRT2;
  const s = Math.abs(u.x) + Math.abs(u.y);
  if (s > lim) {
    u.x -= Math.sign(u.x) * (s - lim) / 2;
    u.y -= Math.sign(u.y) * (s - lim) / 2;
  }
}
export const inOct = (x, y, hw, cut, r = 0) => Math.abs(x) <= hw - r && Math.abs(y) <= hw - r && Math.abs(x) + Math.abs(y) <= 2 * hw - cut - r * Math.SQRT2;

// WC3 units stop when the unit they were attacking dies; the base attack only
// drops the order, so the unit would walk on to the last chase point. Wraps
// a step: units that lose their attack order during it are stopped.
export function stopOnLostTarget(units, step) {
  const had = [...units].filter((u) => u.attackOrder);
  step();
  for (const u of had) if (u.alive && !u.attackOrder && !u.path?.length && !u.cast) u.stop();
}
