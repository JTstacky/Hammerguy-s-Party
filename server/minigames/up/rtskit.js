// A small RTS kit for the Uther Party ports that have armies, creatures and
// buildings (#42 Spell Breaker Blood, #43 Dune Worm Distress, #46 Tower
// Defense, #49 Clandestine Kitty). It lives next to those games rather than in
// the shared engine:
//  - WC3 1.26 damage: attack type x armour type table and the armour formula.
//  - Fighters: Units with a WC3 attack (range, cooldown, damage point, melee
//    commit or a homing missile), acquired targets and a leash.
//  - A cell grid with pathfinding (8-way, no corner cutting, string-pulled)
//    and circle-vs-cell collision, for rock fields, tree walls and buildings.
import { Unit, dist, rand, round2, newId, wrapAngle, WC3 } from '../../../engine/server/sim.js';

// ------------------------------------------------------------------ damage

// Attack type vs armour type, the 1.26 MiscGame table.
export const DMG_TABLE = {
  normal: { light: 1, medium: 1.5, heavy: 1, fort: 0.7, hero: 1, none: 1 },
  pierce: { light: 2, medium: 0.75, heavy: 1, fort: 0.35, hero: 0.5, none: 1.5 },
  siege: { light: 1, medium: 0.5, heavy: 1, fort: 1.5, hero: 0.5, none: 1.5 },
  magic: { light: 1.25, medium: 0.75, heavy: 2, fort: 0.35, hero: 0.5, none: 1 },
  chaos: { light: 1, medium: 1, heavy: 1, fort: 1, hero: 1, none: 1 },
  hero: { light: 1, medium: 1, heavy: 1, fort: 0.5, hero: 1, none: 1 },
  spell: { light: 1, medium: 1, heavy: 1, fort: 1, hero: 1, none: 1 },
};

// Damage taken per point of attack at `armor` (0.06 per point, WC3 1.26).
export function armorMult(armor = 0) {
  return armor >= 0 ? 1 - (0.06 * armor) / (1 + 0.06 * armor) : 2 - Math.pow(0.94, -armor);
}

export const roll = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// Final damage of one hit of `atkType` on a unit with `def` (armour type) and `armor`.
export function dealt(base, atkType, def = 'medium', armor = 0) {
  return base * (DMG_TABLE[atkType]?.[def] ?? 1) * armorMult(armor);
}

// ---------------------------------------------------------------- fighters

// A WC3 unit with an attack. `atk`: { min, max, type, range (edge to edge),
// cd, point (damage point, s), missile (speed or 0 for melee), art }.
// `def`/`armor`: armour type and value. `acquire`: auto-acquire range.
export function fighter({ kind, owner = null, x, y, r, speed, hp, atk = null, def = 'medium', armor = 0, acquire = 0, turnRate = 0.6, facing = 0 }) {
  const u = new Unit({ kind, owner, x, y, r, speed, hp });
  u.turnRate = turnRate;
  u.setFacing(facing);
  u.atk = atk;
  u.def = def;
  u.armor = armor;
  u.acquire = acquire;
  u.atkCd = 0;
  u.swing = null;
  u.tgt = null; // unit being attacked
  u.haste = 1; // attack rate multiplier (Bloodlust)
  return u;
}

// Melee hits commit when the swing starts and connect unless the target gets
// beyond range + this buffer by the damage point (engine.md).
export const MELEE_BUFFER = 60 / 54;

// One tick of a fighter's attack against `c.tgt`. `move(c, x, y)` walks it
// toward a target out of range (a grid game passes a path-aware mover);
// `hit(c, tgt, dmg)` applies a landed hit; missiles are pushed to `missiles`.
// Returns true while the fighter is busy with its target.
export function fightStep(c, dt, { hit, move, missiles, ev }) {
  const A = c.atk;
  if (!A || !c.alive) return false;
  if (c.atkCd > 0) c.atkCd -= dt * c.haste;
  if (c.stun > 0) {
    c.swing = null;
    return true;
  }
  if (c.swing) {
    c.swing.t += dt * c.haste;
    if (c.swing.t < (A.point ?? 0.3)) return true;
    const t = c.swing.tgt;
    c.swing = null;
    if (!t.alive) return true;
    const dmg = roll(A.min, A.max);
    if (A.missile) missiles.push({ id: newId(), x: c.x, y: c.y, tgt: t, src: c, speed: A.missile, dmg, art: A.art || 'arrow', type: A.type });
    else if (dist(c.x, c.y, t.x, t.y) - c.r - t.r <= A.range + MELEE_BUFFER) hit(c, t, dmg);
    return true;
  }
  const t = c.tgt;
  if (!t) return false;
  if (!t.alive) {
    c.tgt = null;
    return false;
  }
  const gap = dist(c.x, c.y, t.x, t.y) - c.r - t.r;
  if (gap > A.range) {
    move(c, t.x, t.y);
    return true;
  }
  if (c.target) c.stop();
  c.path = null;
  const ang = Math.atan2(t.y - c.y, t.x - c.x);
  if (Math.abs(wrapAngle(ang - c.heading)) > 0.35) {
    c.faceTo = ang;
    return true;
  }
  c.faceTo = null;
  if (c.atkCd > 0) return true;
  c.atkCd = A.cd;
  c.swing = { t: 0, tgt: t };
  ev?.({ k: 'swing', u: c.id });
  return true;
}

// Homing attack missiles (WC3 unit attacks other than arrows home).
export function stepMissiles(missiles, dt, hit) {
  for (const m of missiles) {
    const tx = m.tgt.x - m.x;
    const ty = m.tgt.y - m.y;
    const d = Math.hypot(tx, ty);
    const step = m.speed * dt;
    if (d <= step + (m.tgt.r || 0) * 0.5 || !m.tgt.alive) {
      m.done = true;
      if (m.tgt.alive) hit(m.src, m.tgt, m.dmg, m);
      continue;
    }
    m.x += (tx / d) * step;
    m.y += (ty / d) * step;
    m.f = Math.atan2(ty, tx);
  }
  return missiles.filter((m) => !m.done);
}

export function missileSnap(m) {
  return { id: m.id, k: 'missile', x: round2(m.x), y: round2(m.y), f: round2(m.f || 0), m: m.art };
}

// The nearest unit in `list` passing `ok` within `range` (centre distance) of (x, y).
export function nearest(list, x, y, range, ok = () => true) {
  let best = null;
  let bd = range;
  for (const v of list) {
    if (!v.alive || !ok(v)) continue;
    const d = dist(x, y, v.x, v.y);
    if (d < bd) {
      bd = d;
      best = v;
    }
  }
  return best;
}

// Keeps a unit out of an axis-aligned rectangle (a building, a gate, a cliff notch).
export function pushOutRect(u, x0, y0, x1, y1) {
  const cx = Math.max(x0, Math.min(x1, u.x));
  const cy = Math.max(y0, Math.min(y1, u.y));
  const dx = u.x - cx;
  const dy = u.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= u.r * u.r) return false;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    u.x = cx + (dx / d) * u.r;
    u.y = cy + (dy / d) * u.r;
    return true;
  }
  // Centre inside: leave by the nearest side.
  const opts = [
    [u.x - x0, -1, 0],
    [x1 - u.x, 1, 0],
    [u.y - y0, 0, -1],
    [y1 - u.y, 0, 1],
  ].sort((a, b) => a[0] - b[0]);
  const [, sx, sy] = opts[0];
  if (sx < 0) u.x = x0 - u.r;
  else if (sx > 0) u.x = x1 + u.r;
  else if (sy < 0) u.y = y0 - u.r;
  else u.y = y1 + u.r;
  return true;
}

// ------------------------------------------------------------------- grid

// A grid of square cells, each open or blocked, over the arena: WC3 pathing
// at the scale of the map's blockers (128-unit rocks, trees, buildings).
// Cells outside the grid count as blocked.
export class Grid {
  constructor(cols, rows, cs, x0, y0) {
    this.cols = cols;
    this.rows = rows;
    this.cs = cs;
    this.x0 = x0; // world x of the left edge of column 0
    this.y0 = y0;
    this.block = new Uint8Array(cols * rows);
  }

  inside(i, j) {
    return i >= 0 && j >= 0 && i < this.cols && j < this.rows;
  }

  blocked(i, j) {
    return !this.inside(i, j) || this.block[j * this.cols + i] > 0;
  }

  set(i, j, v) {
    if (this.inside(i, j)) this.block[j * this.cols + i] = v;
  }

  get(i, j) {
    return this.inside(i, j) ? this.block[j * this.cols + i] : 255;
  }

  cellOf(x, y) {
    return [Math.floor((x - this.x0) / this.cs), Math.floor((y - this.y0) / this.cs)];
  }

  center(i, j) {
    return [this.x0 + (i + 0.5) * this.cs, this.y0 + (j + 0.5) * this.cs];
  }

  // Pushes a unit out of every blocked cell it overlaps. `passable(i, j)`
  // may open cells for this unit (a unit standing in its own tunnel).
  pushOut(u, passable = null) {
    const [ci, cj] = this.cellOf(u.x, u.y);
    for (let pass = 0; pass < 2; pass++) {
      for (let j = cj - 1; j <= cj + 1; j++) {
        for (let i = ci - 1; i <= ci + 1; i++) {
          if (!this.blocked(i, j) && this.inside(i, j)) continue;
          if (passable && this.inside(i, j) && passable(i, j)) continue;
          if (!this.inside(i, j)) continue; // arena edges are clamped by the game
          const x0 = this.x0 + i * this.cs;
          const y0 = this.y0 + j * this.cs;
          pushOutRect(u, x0, y0, x0 + this.cs, y0 + this.cs);
        }
      }
    }
  }

  // Is the straight segment clear for a unit of radius r? `cost(i, j)`
  // decides what is walkable (defaults to open cells).
  clearLine(x0, y0, x1, y1, r, cost = null) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(d / (this.cs * 0.2)));
    const walk = (x, y) => {
      const [i, j] = this.cellOf(x, y);
      return cost ? cost(i, j) < 2 : !this.blocked(i, j);
    };
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      const y = y0 + ((y1 - y0) * k) / n;
      if (!walk(x, y) || !walk(x + r, y) || !walk(x - r, y) || !walk(x, y + r) || !walk(x, y - r)) return false;
    }
    return true;
  }

  // A path of world points from (sx, sy) to (gx, gy): Dijkstra over cells,
  // 8-way without cutting corners. `cost(i, j)` is the price of entering a
  // cell (Infinity = blocked; default 1 for open cells). If the goal cannot be
  // reached, the path ends at the reachable cell nearest to it. The result is
  // string-pulled, and ends at the exact goal when the goal cell is walkable.
  findPath(sx, sy, gx, gy, { cost = null, r = 0, goalOk = false } = {}) {
    const C = cost || ((i, j) => (this.blocked(i, j) ? Infinity : 1));
    const [si, sj] = this.cellOf(sx, sy);
    const [ti, tj] = this.cellOf(gx, gy);
    const N = this.cols * this.rows;
    const key = (i, j) => j * this.cols + i;
    const best = new Float64Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const startK = this.inside(si, sj) ? key(si, sj) : -1;
    if (startK < 0) return [[gx, gy]];
    best[startK] = 0;
    const open = [[0, si, sj]];
    let reached = -1;
    let closest = startK;
    let closestD = Math.hypot(si - ti, sj - tj);
    const cellCost = (i, j) => (i === ti && j === tj && goalOk ? 1 : C(i, j));
    while (open.length) {
      // Small grids: a linear pop keeps this simple and fast enough.
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [d, i, j] = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      const k0 = key(i, j);
      if (d > best[k0]) continue;
      const h = Math.hypot(i - ti, j - tj);
      if (h < closestD) {
        closestD = h;
        closest = k0;
      }
      if (i === ti && j === tj) {
        reached = k0;
        break;
      }
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di;
          const nj = j + dj;
          if (!this.inside(ni, nj)) continue;
          const c = cellCost(ni, nj);
          if (!Number.isFinite(c)) continue;
          if (di && dj && (!Number.isFinite(cellCost(i + di, j)) || !Number.isFinite(cellCost(i, j + dj)))) continue;
          const nd = d + c * (di && dj ? Math.SQRT2 : 1);
          const nk = key(ni, nj);
          if (nd < best[nk]) {
            best[nk] = nd;
            prev[nk] = k0;
            open.push([nd, ni, nj]);
          }
        }
      }
    }
    const end = reached >= 0 ? reached : closest;
    const cells = [];
    for (let k = end; k >= 0; k = prev[k]) cells.push(k);
    cells.reverse();
    const pts = cells.map((k) => this.center(k % this.cols, Math.floor(k / this.cols)));
    pts.shift(); // the start cell
    if (reached >= 0 && Number.isFinite(C(ti, tj))) {
      if (pts.length) pts[pts.length - 1] = [gx, gy];
      else pts.push([gx, gy]);
    } else if (reached >= 0 && goalOk) {
      // Goal is a blocked cell we may walk up to (a rock to bite, a barricade to hit).
      if (!pts.length) pts.push([gx, gy]);
    }
    // String-pull: skip waypoints that can be reached in a straight line.
    const walk = (i, j) => cellCost(i, j);
    const out = [];
    let cx = sx;
    let cy = sy;
    let k = 0;
    while (k < pts.length) {
      let far = k;
      for (let m = pts.length - 1; m > k; m--) {
        if (this.clearLine(cx, cy, pts[m][0], pts[m][1], r, walk)) {
          far = m;
          break;
        }
      }
      out.push(pts[far]);
      [cx, cy] = pts[far];
      k = far + 1;
    }
    return out.length ? out : [[gx, gy]];
  }
}

// Walks a unit along u.path (a list of [x, y]). Call every tick before stepUnits.
export function followPath(u, dt = 1 / 30) {
  if (!u.path || !u.alive) return;
  // WC3 would re-path round a unit standing in a narrow gap; our units only
  // sidestep, which can jam against a wall. A unit that makes no headway for
  // 0.6 s detours to one side (alternating), then carries on.
  const moved = u._lx == null ? 1 : Math.hypot(u.x - u._lx, u.y - u._ly);
  u._lx = u.x;
  u._ly = u.y;
  if (u.walking && moved < u.speed * u.speedMult * dt * 0.3) u._st = (u._st || 0) + dt;
  else u._st = 0;
  if (u._st > 0.6 && u.path.length) {
    u._st = 0;
    u._side = -(u._side || 1);
    const [px, py] = u.path[0];
    const a = Math.atan2(py - u.y, px - u.x) + (u._side * Math.PI) / 2;
    const d = Math.max(0.8, u.r * 2);
    u.path.unshift([u.x + Math.cos(a) * d - Math.cos(a - (u._side * Math.PI) / 2) * d * 0.5, u.y + Math.sin(a) * d - Math.sin(a - (u._side * Math.PI) / 2) * d * 0.5]);
    u.stop();
  }
  while (u.path.length) {
    const [px, py] = u.path[0];
    const last = u.path.length === 1;
    if (dist(u.x, u.y, px, py) > (last ? WC3.ARRIVE * 1.5 : Math.max(0.35, u.r))) break;
    u.path.shift();
  }
  if (!u.path.length) {
    u.path = null;
    return;
  }
  const [px, py] = u.path[0];
  if (!u.target) u.order(px, py);
  else if (u.target.x !== px || u.target.y !== py) u.steer(px, py);
}

// A unit that has stopped short of its path (blocked, or arrived at a
// waypoint without re-ordering) resumes it; idle units drop their path.
export function randomIn(x0, y0, x1, y1) {
  return [rand(x0, x1), rand(y0, y1)];
}
