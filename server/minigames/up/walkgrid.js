// Shared helpers for the Uther Party ports that have walls, mazes and
// monsters (Covert Kitty, Blinky the Bear, Minotaur Maze, The Unseen,
// Troubled Waters, The Death Trap):
//  - WalkGrid: the arena's pathing map as a grid of walkable / blocked cells,
//    read from the rule sheet's ASCII layout. It keeps units out of walls
//    (circle against cell push-out), finds WC3-style paths (A*, then string
//    pulling, and the nearest reachable spot when the target cannot be
//    reached), and answers line and fit queries for blinks and bots.
//  - GridRace: a race minigame whose heroes path round the walls on a
//    right-click (as WC3 units do), and whose finishers are removed with a
//    teleport effect, as the original's Race Finish does.
//  - Creep helpers: WC3-style melee for the monsters (commit on swing start,
//    hit after the damage point unless the victim got out of range + the
//    250 u range motion buffer, engine.md).
//
// Coordinates: server x = WC3 X - centre X, server y = -(WC3 Y - centre Y),
// so WC3 north is up the screen. Everything is in Hammerguy units (wc3()).

import { Minigame } from '../../base.js';
import { Unit, dist, wc3, round1, round2, wrapAngle } from '../../../engine/server/sim.js';

// WC3 to server coordinates for an arena centred on (cx, cy).
export const toServer = (cx, cy) => (X, Y) => [wc3(X - cx), -wc3(Y - cy)];

export class WalkGrid {
  // rows: strings, top (north) row first; `blocked` lists the characters that
  // are unwalkable. x0, y0: server coordinates of the top-left corner.
  constructor(rows, { cell, x0, y0, blocked = '#', outsideBlocked = true }) {
    this.rows = rows.length;
    this.cols = Math.max(...rows.map((r) => r.length));
    this.s = cell;
    this.x0 = x0;
    this.y0 = y0;
    this.outsideBlocked = outsideBlocked;
    this.cells = new Uint8Array(this.rows * this.cols);
    this.chars = rows.map((r) => r.padEnd(this.cols, '.'));
    rows.forEach((row, r) => {
      for (let c = 0; c < this.cols; c++) if (blocked.includes(row[c] ?? '.')) this.cells[r * this.cols + c] = 1;
    });
  }

  inside(c, r) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
  }

  // Blocked for movement: out-of-grid cells follow `outsideBlocked`.
  blocked(c, r) {
    if (!this.inside(c, r)) return this.outsideBlocked;
    return this.cells[r * this.cols + c] === 1;
  }

  // Blocked for pathing: nothing outside the grid is ever a path cell.
  pathBlocked(c, r) {
    return !this.inside(c, r) || this.cells[r * this.cols + c] === 1;
  }

  setBlocked(c, r, v = true) {
    if (this.inside(c, r)) this.cells[r * this.cols + c] = v ? 1 : 0;
  }

  cellOf(x, y) {
    return [Math.floor((x - this.x0) / this.s), Math.floor((y - this.y0) / this.s)];
  }

  centerOf(c, r) {
    return [this.x0 + (c + 0.5) * this.s, this.y0 + (r + 0.5) * this.s];
  }

  get width() {
    return this.cols * this.s;
  }

  get height() {
    return this.rows * this.s;
  }

  // Every blocked cell (for the client's wall builder).
  blockedList() {
    const out = [];
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.cells[r * this.cols + c]) out.push([c, r]);
    return out;
  }

  // True if a circle of radius `rad` at (x, y) touches no blocked cell.
  fits(x, y, rad) {
    const [c0, r0] = this.cellOf(x - rad, y - rad);
    const [c1, r1] = this.cellOf(x + rad, y + rad);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (!this.blocked(c, r)) continue;
        const bx = this.x0 + c * this.s;
        const by = this.y0 + r * this.s;
        const px = Math.max(bx, Math.min(x, bx + this.s));
        const py = Math.max(by, Math.min(y, by + this.s));
        if ((px - x) ** 2 + (py - y) ** 2 < rad * rad - 1e-9) return false;
      }
    }
    return true;
  }

  // Pushes a unit (x, y, r) out of any blocked cell it overlaps, so it slides
  // along walls. Returns true if it moved.
  push(u) {
    let moved = false;
    for (let pass = 0; pass < 3; pass++) {
      let any = false;
      const rad = u.r;
      const [c0, r0] = this.cellOf(u.x - rad, u.y - rad);
      const [c1, r1] = this.cellOf(u.x + rad, u.y + rad);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (!this.blocked(c, r)) continue;
          const bx = this.x0 + c * this.s;
          const by = this.y0 + r * this.s;
          const px = Math.max(bx, Math.min(u.x, bx + this.s));
          const py = Math.max(by, Math.min(u.y, by + this.s));
          let dx = u.x - px;
          let dy = u.y - py;
          const d2 = dx * dx + dy * dy;
          if (d2 >= rad * rad) continue;
          if (d2 < 1e-12) {
            // The centre is inside the cell: leave by the nearest free side.
            const opts = [
              [bx - u.x - rad, 0, !this.blocked(c - 1, r)],
              [bx + this.s - u.x + rad, 0, !this.blocked(c + 1, r)],
              [0, by - u.y - rad, !this.blocked(c, r - 1)],
              [0, by + this.s - u.y + rad, !this.blocked(c, r + 1)],
            ].filter((o) => o[2]);
            const list = opts.length ? opts : [[bx - u.x - rad, 0], [bx + this.s - u.x + rad, 0], [0, by - u.y - rad], [0, by + this.s - u.y + rad]];
            list.sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) - Math.abs(b[0]) - Math.abs(b[1]));
            u.x += list[0][0];
            u.y += list[0][1];
          } else {
            const d = Math.sqrt(d2);
            dx /= d;
            dy /= d;
            u.x = px + dx * rad;
            u.y = py + dy * rad;
          }
          any = moved = true;
        }
      }
      if (!any) break;
    }
    return moved;
  }

  // Is the straight walk from (ax, ay) to (bx, by) clear for radius `rad`?
  lineClear(ax, ay, bx, by, rad) {
    const d = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.ceil(d / (this.s * 0.2)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (!this.fits(ax + (bx - ax) * t, ay + (by - ay) * t, rad * 0.98)) return false;
    }
    return true;
  }

  // The nearest point to (x, y) where a circle of radius `rad` fits (WC3 moves
  // a unit placed on unpathable ground to the nearest pathable spot).
  nearestFit(x, y, rad, maxR = 12) {
    if (this.fits(x, y, rad)) return [x, y];
    const step = Math.min(0.1, this.s / 8);
    for (let d = step; d <= maxR; d += step) {
      const n = Math.max(8, Math.ceil((2 * Math.PI * d) / step));
      let best = null;
      let bd = Infinity;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const px = x + Math.cos(a) * d;
        const py = y + Math.sin(a) * d;
        if (!this.fits(px, py, rad)) continue;
        const dd = (px - x) ** 2 + (py - y) ** 2;
        if (dd < bd) {
          bd = dd;
          best = [px, py];
        }
      }
      if (best) return best;
    }
    return [x, y];
  }

  // Connected areas of walkable cells (4-neighbour), as labels per cell (-1 blocked).
  regions() {
    if (this._regions) return this._regions;
    const lab = new Int32Array(this.rows * this.cols).fill(-1);
    let n = 0;
    for (let i = 0; i < lab.length; i++) {
      if (this.cells[i] || lab[i] >= 0) continue;
      const stack = [i];
      lab[i] = n;
      while (stack.length) {
        const k = stack.pop();
        const c = k % this.cols;
        const r = (k - c) / this.cols;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = c + dc;
          const nr = r + dr;
          if (this.pathBlocked(nc, nr)) continue;
          const j = nr * this.cols + nc;
          if (lab[j] < 0) {
            lab[j] = n;
            stack.push(j);
          }
        }
      }
      n++;
    }
    this._regions = lab;
    return lab;
  }

  regionAt(x, y) {
    const [c, r] = this.cellOf(x, y);
    if (!this.inside(c, r)) return -1;
    return this.regions()[r * this.cols + c];
  }

  // Walking distance (in cells) from every cell to the goal cells, 4-neighbour.
  distanceField(goals) {
    const D = new Float32Array(this.rows * this.cols).fill(Infinity);
    const q = [];
    for (const [c, r] of goals) {
      if (this.pathBlocked(c, r)) continue;
      D[r * this.cols + c] = 0;
      q.push(r * this.cols + c);
    }
    for (let h = 0; h < q.length; h++) {
      const k = q[h];
      const c = k % this.cols;
      const r = (k - c) / this.cols;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc;
        const nr = r + dr;
        if (this.pathBlocked(nc, nr)) continue;
        const j = nr * this.cols + nc;
        if (D[j] === Infinity) {
          D[j] = D[k] + 1;
          q.push(j);
        }
      }
    }
    return D;
  }

  // A WC3-style path from (x, y) to (tx, ty) for a unit of radius `rad`:
  // A* over the cells (8 directions, no corner cutting), then string pulling.
  // If the target cannot be reached the path ends at the reachable cell
  // nearest to it. Returns waypoints [{x, y}] (the start excluded).
  path(x, y, tx, ty, rad) {
    const cols = this.cols;
    let [sc, sr] = this.cellOf(x, y);
    if (this.pathBlocked(sc, sr)) [sc, sr] = this.nearestFreeCell(sc, sr, x, y);
    let [gc, gr] = this.cellOf(tx, ty);
    const goalFree = !this.pathBlocked(gc, gr);
    if (sc == null) return [];
    const start = sr * cols + sc;
    const goal = goalFree ? gr * cols + gc : -1;
    const h = (k) => {
      const c = k % cols;
      const r = (k - c) / cols;
      const dx = Math.abs(c - gc);
      const dy = Math.abs(r - gr);
      return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    };
    const g = new Float32Array(this.rows * cols).fill(Infinity);
    const from = new Int32Array(this.rows * cols).fill(-1);
    const closed = new Uint8Array(this.rows * cols);
    const open = new Heap();
    g[start] = 0;
    open.push(start, h(start));
    let best = start;
    let bestH = h(start);
    let found = false;
    while (open.size) {
      const k = open.pop();
      if (closed[k]) continue;
      closed[k] = 1;
      if (k === goal) {
        found = true;
        best = k;
        break;
      }
      const hk = h(k);
      if (hk < bestH || (hk === bestH && g[k] < g[best])) {
        bestH = hk;
        best = k;
      }
      const c = k % cols;
      const r = (k - c) / cols;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue;
          const nc = c + dc;
          const nr = r + dr;
          if (this.pathBlocked(nc, nr)) continue;
          if (dc && dr && (this.pathBlocked(c + dc, r) || this.pathBlocked(c, r + dr))) continue;
          const j = nr * cols + nc;
          if (closed[j]) continue;
          const ng = g[k] + (dc && dr ? Math.SQRT2 : 1);
          if (ng < g[j]) {
            g[j] = ng;
            from[j] = k;
            open.push(j, ng + h(j));
          }
        }
      }
    }
    const cellsPath = [];
    for (let k = best; k !== -1 && k !== start; k = from[k]) cellsPath.push(k);
    cellsPath.reverse();
    const pts = cellsPath.map((k) => {
      const c = k % cols;
      const [px, py] = this.centerOf(c, (k - c) / cols);
      return { x: px, y: py };
    });
    if (found && this.fits(tx, ty, rad)) {
      if (pts.length) pts[pts.length - 1] = { x: tx, y: ty };
      else pts.push({ x: tx, y: ty });
    }
    // String pulling: skip waypoints while the straight walk stays clear.
    const out = [];
    let cx = x;
    let cy = y;
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.lineClear(cx, cy, pts[j].x, pts[j].y, rad)) j--;
      out.push(pts[j]);
      cx = pts[j].x;
      cy = pts[j].y;
      i = j + 1;
    }
    return out;
  }

  nearestFreeCell(c, r, x, y) {
    let best = [null, null];
    let bd = Infinity;
    for (let rr = 0; rr < this.rows; rr++) {
      for (let cc = 0; cc < this.cols; cc++) {
        if (this.pathBlocked(cc, rr)) continue;
        const [px, py] = this.centerOf(cc, rr);
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < bd) {
          bd = d;
          best = [cc, rr];
        }
      }
    }
    return best;
  }

  // Map data for the client's wall builder.
  snap(extra = {}) {
    return { cell: round2(this.s), x0: round2(this.x0), y0: round2(this.y0), rows: this.chars, ...extra };
  }
}

// A small binary min-heap of (key, priority).
class Heap {
  constructor() {
    this.k = [];
    this.p = [];
  }

  get size() {
    return this.k.length;
  }

  push(key, pri) {
    const k = this.k;
    const p = this.p;
    k.push(key);
    p.push(pri);
    let i = k.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (p[par] <= p[i]) break;
      [k[par], k[i]] = [k[i], k[par]];
      [p[par], p[i]] = [p[i], p[par]];
      i = par;
    }
  }

  pop() {
    const k = this.k;
    const p = this.p;
    const top = k[0];
    const lk = k.pop();
    const lp = p.pop();
    if (k.length) {
      k[0] = lk;
      p[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < k.length && p[l] < p[m]) m = l;
        if (r < k.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [p[m], p[i]] = [p[i], p[m]];
        i = m;
      }
    }
    return top;
  }
}

// Walks a unit along a list of waypoints (unit.path). Switches to the next
// waypoint a little before arriving so the walk does not stop at each corner.
export function followPath(u, grid) {
  const list = u.path;
  grid = u.pathGrid || grid;
  // A spell's turn and cast point come first; the walk resumes after it.
  if (!list || u.cast) return;
  if (!u.alive) {
    u.path = null;
    return;
  }
  if (u.target && list.length) {
    const near = dist(u.x, u.y, u.target.x, u.target.y) < Math.max(0.25, u.speed * u.speedMult * 0.07);
    if (near || (grid && grid.lineClear(u.x, u.y, list[0].x, list[0].y, u.r))) {
      const p = list.shift();
      u.steer(p.x, p.y);
    }
  } else if (!u.target) {
    if (list.length && u.stun <= 0) {
      const p = list.shift();
      u.order(p.x, p.y);
    } else if (!list.length) u.path = null;
  }
}

// Orders a unit to walk to (x, y) by a path round the walls.
export function pathTo(u, grid, x, y) {
  if (!grid) {
    u.path = null;
    u.order(x, y);
    return;
  }
  u.pathGrid = null;
  const pts = grid.path(u.x, u.y, x, y, u.r);
  if (!pts.length) {
    u.path = null;
    u.stop();
    return;
  }
  const first = pts.shift();
  if (u.target) u.steer(first.x, first.y);
  else u.order(first.x, first.y);
  u.path = pts;
}

// ------------------------------------------------------------ race base

export class GridRace extends Minigame {
  static ranking = 'race';

  constructor(party, pids) {
    super(party, pids);
    this.grid = null;
  }

  // A right-click walks round the walls, as a WC3 move order does. Joystick
  // steering (continuous, short range) slides along them instead.
  command(pid, m) {
    const u = this.heroes.get(pid);
    if (u && m.c !== 'cast') u.path = u.pathGrid = u.pendingMove = null;
    // A right-click during a cast waits for it, and then walks round the walls.
    if (u && this.grid && m.c === 'move' && u.cast) {
      u.cast.queued = null;
      u.pendingMove = { x: +m.x || 0, y: +m.y || 0 };
      return;
    }
    if (u && this.grid && m.c === 'move' && u.alive && !u.finished && !(this.attack && this.attackTargetAt(pid, +m.x || 0, +m.y || 0))) {
      u.attackOrder = null;
      pathTo(u, this.grid, +m.x || 0, +m.y || 0);
      return;
    }
    super.command(pid, m);
  }

  moveTo(pid, x, y) {
    const u = this.heroes.get(pid);
    if (u?.alive) pathTo(u, this.grid, x, y);
  }

  // Heroes step, then walls push them out. Games call this from tick().
  stepRace(dt) {
    for (const u of this.heroes.values()) {
      if (!u.alive || u.finished) continue;
      if (u.pendingMove && !u.cast) {
        pathTo(u, this.grid, u.pendingMove.x, u.pendingMove.y);
        u.pendingMove = null;
      }
      followPath(u, this.grid);
    }
    this.stepHeroes(dt);
    if (this.grid) for (const u of this.heroes.values()) if (u.alive && !u.finished) this.grid.push(u);
  }

  // Race Finish: score the place and remove the unit with a teleport effect.
  finish(pid) {
    const u = this.heroes.get(pid);
    if (!u || u.finished || !u.alive) return;
    super.finish(pid);
    u.solid = false;
    u.path = null;
    this.ev({ k: 'tele', x1: round1(u.x), y1: round1(u.y), x2: round1(u.x), y2: round1(u.y) });
    this.ev({ k: 'sfx', s: 'teleport' });
  }

  inRect(u, rect) {
    return u.x >= rect.x0 && u.x <= rect.x1 && u.y >= rect.y0 && u.y <= rect.y1;
  }

  // Finished heroes are gone from the field.
  heroEnts(pid) {
    return super.heroEnts(pid).filter((e) => {
      const u = this.heroes.get(e.o);
      return !(u && u.finished);
    });
  }

  // Unfinished players rank by how close they got.
  progress(pid) {
    const u = this.heroes.get(pid);
    if (!u || !this.goal) return 0;
    return -dist(u.x, u.y, this.goal.x, this.goal.y);
  }
}

// A rect in server coordinates from a WC3 rect (minX, minY, maxX, maxY).
export function rectFromWc3(conv, x0, y0, x1, y1) {
  const [ax, ay] = conv(x0, y0);
  const [bx, by] = conv(x1, y1);
  return { x0: Math.min(ax, bx), x1: Math.max(ax, bx), y0: Math.min(ay, by), y1: Math.max(ay, by) };
}

export const randIn = (rect) => [rect.x0 + Math.random() * (rect.x1 - rect.x0), rect.y0 + Math.random() * (rect.y1 - rect.y0)];

// ------------------------------------------------------------ creeps

// A Player 12 monster: a WC3 unit with its own orders and a melee attack.
export function creep(kind, x, y, { speed, r, hp = 100, turnRate = 0.6, facing = 0 }) {
  const c = new Unit({ kind, x, y, r, speed, hp });
  c.turnRate = turnRate;
  c.setFacing(facing);
  c.atkCd = 0;
  c.swing = null;
  c.path = null;
  return c;
}

// One step of a melee attack order on `tgt`. `A` = { range, cd, point,
// buffer }: WC3 range is edge to edge; the hit is decided when the swing
// starts and lands after the damage point unless the victim is then beyond
// range + buffer (the 250 u range motion buffer). Returns 'swing' while
// winding up, 'hit' on the step it lands, 'chase' while closing in, 'idle'.
export function meleeStep(game, c, tgt, dt, A, onHit, chase = true) {
  if (c.swing) {
    c.swing.t += dt;
    if (c.swing.t < A.point) return 'swing';
    const t = c.swing.tgt;
    c.swing = null;
    if (t.alive && dist(c.x, c.y, t.x, t.y) - c.r - t.r <= A.range + (A.buffer ?? wc3(250))) {
      onHit(t);
      return 'hit';
    }
    return 'idle';
  }
  if (!tgt || !tgt.alive) return 'idle';
  const gap = dist(c.x, c.y, tgt.x, tgt.y) - c.r - tgt.r;
  if (gap > A.range) {
    if (!chase) return 'idle';
    if (c.target && !c.path) c.steer(tgt.x, tgt.y);
    else if (!c.path) c.order(tgt.x, tgt.y);
    return 'chase';
  }
  if (c.target) c.stop();
  c.path = null;
  const ang = Math.atan2(tgt.y - c.y, tgt.x - c.x);
  if (Math.abs(wrapAngle(ang - c.heading)) > 0.35) {
    c.faceTo = ang;
    return 'chase';
  }
  c.faceTo = null;
  if (c.atkCd > 0) return 'chase';
  c.atkCd = A.cd;
  c.swing = { t: 0, tgt };
  game.ev({ k: 'swing', u: c.id });
  return 'swing';
}

// Snapshot of a creep for worldEnts.
export function creepSnap(c, k, extra = {}) {
  const s = { id: c.id, k, x: round2(c.x), y: round2(c.y), f: round2(c.facing) };
  if (c.mx || c.my) s.mv = 1;
  if (c.swing) s.sw = 1;
  if (c.stun > 0) s.st = 1;
  if (!c.alive) s.dead = 1;
  return Object.assign(s, extra);
}
