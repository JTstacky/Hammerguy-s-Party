// Tile-grid pathing for the ports with walls (The Rat Maze, Hungry Hungry
// Kodos, Raider Relay, Hot Mortar): WC3 pathing is a grid, units path round
// unwalkable cells on their own when given an order, and nothing walks
// through a wall. Shared by those games only (not an engine file).
//
// Cells are strings, row 0 = north. In Hammerguy units north is -y (the
// camera looks from +y), so row r spans y0 + r*T .. y0 + (r+1)*T.

import { dist, WC3 } from '../../../engine/server/sim.js';

export class TileGrid {
  // cells: array of equal-length strings; T: tile size in hammer units;
  // solid(ch) says which characters are unwalkable.
  constructor(cells, T, { cx = 0, cy = 0, solid = (ch) => ch === '#' } = {}) {
    this.cells = cells;
    this.T = T;
    this.rows = cells.length;
    this.cols = cells[0].length;
    this.x0 = cx - (this.cols * T) / 2;
    this.y0 = cy - (this.rows * T) / 2;
    this.solidFn = solid;
    this.extra = new Set(); // cells blocked at run time ("c,r")
    this.open = new Set(); // cells opened at run time
  }

  ch(c, r) {
    return this.cells[r]?.[c];
  }

  blocked(c, r) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return true;
    const k = c + ',' + r;
    if (this.open.has(k)) return false;
    if (this.extra.has(k)) return true;
    return this.solidFn(this.cells[r][c]);
  }

  tileAt(x, y) {
    return [Math.floor((x - this.x0) / this.T), Math.floor((y - this.y0) / this.T)];
  }

  center(c, r) {
    return [this.x0 + (c + 0.5) * this.T, this.y0 + (r + 0.5) * this.T];
  }

  walkable(x, y) {
    const [c, r] = this.tileAt(x, y);
    return !this.blocked(c, r);
  }

  // True if a circle of radius `r` at (x, y) touches no blocked cell.
  circleFree(x, y, r) {
    const T = this.T;
    const c0 = Math.floor((x - r - this.x0) / T);
    const c1 = Math.floor((x + r - this.x0) / T);
    const r0 = Math.floor((y - r - this.y0) / T);
    const r1 = Math.floor((y + r - this.y0) / T);
    for (let rr = r0; rr <= r1; rr++) {
      for (let cc = c0; cc <= c1; cc++) {
        if (!this.blocked(cc, rr)) continue;
        const bx = this.x0 + cc * T;
        const by = this.y0 + rr * T;
        const px = Math.max(bx, Math.min(x, bx + T));
        const py = Math.max(by, Math.min(y, by + T));
        if ((px - x) ** 2 + (py - y) ** 2 < r * r) return false;
      }
    }
    return true;
  }

  // Pushes a unit's circle out of every blocked cell it overlaps.
  collide(u) {
    const T = this.T;
    for (let pass = 0; pass < 2; pass++) {
      const c0 = Math.floor((u.x - u.r - this.x0) / T);
      const c1 = Math.floor((u.x + u.r - this.x0) / T);
      const r0 = Math.floor((u.y - u.r - this.y0) / T);
      const r1 = Math.floor((u.y + u.r - this.y0) / T);
      let moved = false;
      for (let rr = r0; rr <= r1; rr++) {
        for (let cc = c0; cc <= c1; cc++) {
          if (!this.blocked(cc, rr)) continue;
          const bx = this.x0 + cc * T;
          const by = this.y0 + rr * T;
          const px = Math.max(bx, Math.min(u.x, bx + T));
          const py = Math.max(by, Math.min(u.y, by + T));
          const dx = u.x - px;
          const dy = u.y - py;
          const d = Math.hypot(dx, dy);
          if (d >= u.r) continue;
          if (d > 1e-6) {
            u.x = px + (dx / d) * u.r;
            u.y = py + (dy / d) * u.r;
          } else {
            // Centre inside the cell: leave by the nearest open side.
            const opts = [
              [u.x - bx, -1, 0, !this.blocked(cc - 1, rr)],
              [bx + T - u.x, 1, 0, !this.blocked(cc + 1, rr)],
              [u.y - by, 0, -1, !this.blocked(cc, rr - 1)],
              [by + T - u.y, 0, 1, !this.blocked(cc, rr + 1)],
            ].sort((a, b) => (b[3] - a[3]) || a[0] - b[0]);
            const [pen, sx, sy] = opts[0];
            u.x += sx * (pen + u.r);
            u.y += sy * (pen + u.r);
          }
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  // Straight-line clearance for a circle of radius r.
  clear(x0, y0, x1, y1, r) {
    const len = dist(x0, y0, x1, y1);
    const n = Math.max(1, Math.ceil(len / (this.T * 0.2)));
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      if (!this.circleFree(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, r)) return false;
    }
    return true;
  }

  // Nearest walkable cell to a point (breadth first from its cell).
  nearestFloor(x, y) {
    const [c, r] = this.tileAt(x, y);
    if (!this.blocked(c, r)) return [c, r];
    let best = null;
    let bd = Infinity;
    for (let rr = 0; rr < this.rows; rr++) {
      for (let cc = 0; cc < this.cols; cc++) {
        if (this.blocked(cc, rr)) continue;
        const [px, py] = this.center(cc, rr);
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < bd) {
          bd = d;
          best = [cc, rr];
        }
      }
    }
    return best;
  }

  // Path distance (in cells) from a cell to every cell: Dijkstra with
  // 8-neighbour moves that don't cut blocked corners. `cost(c, r)` adds a
  // penalty for stepping into a cell (bots use it to keep clear of threats).
  field(c, r, cost = null) {
    const W = this.cols;
    const D = new Float64Array(W * this.rows).fill(Infinity);
    const prev = new Int32Array(W * this.rows).fill(-1);
    if (this.blocked(c, r)) return { D, prev };
    D[r * W + c] = 0;
    const open = [[0, c, r]];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [d, cc, rr] = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (d > D[rr * W + cc]) continue;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue;
          const nc = cc + dc;
          const nr = rr + dr;
          if (this.blocked(nc, nr)) continue;
          if (dc && dr && (this.blocked(cc + dc, rr) || this.blocked(cc, rr + dr))) continue;
          const nd = d + (dc && dr ? Math.SQRT2 : 1) + (cost ? cost(nc, nr) : 0);
          if (nd < D[nr * W + nc]) {
            D[nr * W + nc] = nd;
            prev[nr * W + nc] = rr * W + cc;
            open.push([nd, nc, nr]);
          }
        }
      }
    }
    return { D, prev };
  }

  // Waypoints from (sx, sy) to (tx, ty) for a unit of radius `r`, string
  // pulled so the unit walks straight wherever it can. A target in a wall
  // goes to the nearest walkable cell, as a WC3 order does. Null if there
  // is no way there.
  // Bots may pass `cost` (see field) and `avoid`, circles [{x, y, r}] the
  // straightened path must not cut through.
  path(sx, sy, tx, ty, r = 0.3, { cost = null, avoid = null } = {}) {
    const start = this.nearestFloor(sx, sy);
    const goal = this.walkable(tx, ty) ? this.tileAt(tx, ty) : this.nearestFloor(tx, ty);
    if (!start || !goal) return null;
    // Costs are symmetric enough here to search from the goal.
    const { D } = this.field(goal[0], goal[1], cost);
    const W = this.cols;
    let i = start[1] * W + start[0];
    if (!Number.isFinite(D[i])) return null;
    // Walk down the field from the start to the goal.
    const cellsPath = [];
    let guard = 0;
    while (guard++ < W * this.rows) {
      const c = i % W;
      const rr = Math.floor(i / W);
      cellsPath.push([c, rr]);
      if (D[i] === 0) break;
      let best = -1;
      let bd = D[i];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue;
          const nc = c + dc;
          const nr = rr + dr;
          if (this.blocked(nc, nr)) continue;
          if (dc && dr && (this.blocked(c + dc, rr) || this.blocked(c, rr + dr))) continue;
          const j = nr * W + nc;
          if (D[j] < bd - 1e-9 && D[j] < D[i]) {
            bd = D[j];
            best = j;
          }
        }
      }
      if (best < 0) break;
      i = best;
    }
    const pts = cellsPath.map(([c, rr]) => this.center(c, rr));
    const endInside = this.walkable(tx, ty);
    pts[pts.length - 1] = endInside ? [tx, ty] : pts[pts.length - 1];
    // String pulling.
    const out = [];
    let ax = sx;
    let ay = sy;
    let k = 0;
    const rr = r + 0.04;
    while (k < pts.length) {
      let j = pts.length - 1;
      while (j > k && !(this.clear(ax, ay, pts[j][0], pts[j][1], rr) && (!avoid || avoid.every((a) => segDist(ax, ay, pts[j][0], pts[j][1], a.x, a.y) > a.r)))) j--;
      out.push({ x: pts[j][0], y: pts[j][1] });
      [ax, ay] = pts[j];
      k = j + 1;
    }
    return out;
  }
}

function segDist(x0, y0, x1, y1, px, py) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy;
  const k = l2 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2)) : 0;
  return Math.hypot(x0 + dx * k - px, y0 + dy * k - py);
}

// Gives a unit a route planned with bot costs (see TileGrid.path);
// followGrid then walks it. Returns false if there is no way.
export function planRoute(u, grid, tx, ty, opts) {
  const route = grid.path(u.x, u.y, tx, ty, u.r, opts);
  if (!route || !route.length) return false;
  const first = !u.target;
  u.route = route;
  u.routeCur = route[0];
  if (first) u.order(route[0].x, route[0].y);
  u.target = route[0];
  u.routeCur = u.target;
  return true;
}

// Order-following for units on a grid. Call before the units step. When a
// unit's move target can't be reached in a straight line, it is replaced by
// a route of waypoints; the unit then walks them without stopping at each.
// Targets close by inside a wall (a touch joystick pushing into one) are
// left alone so the unit slides along the wall instead.
export function followGrid(u, grid, dt, slide = true) {
  if (!u.alive) return;
  const t = u.target;
  if (!t) {
    u.route = null;
    return;
  }
  if (u.route && t === u.routeCur) {
    const reach = u.speed * (u.speedMult ?? 1) * dt + WC3.ARRIVE + 0.06;
    if (u.route.length > 1 && dist(u.x, u.y, t.x, t.y) <= reach) {
      u.route.shift();
      u.routeCur = u.route[0];
      u.target = u.routeCur; // no stop between waypoints
    }
    return;
  }
  u.route = null;
  if (grid.clear(u.x, u.y, t.x, t.y, u.r * 0.9)) return;
  if (slide && !grid.walkable(t.x, t.y) && dist(u.x, u.y, t.x, t.y) < 3) return;
  const route = grid.path(u.x, u.y, t.x, t.y, u.r);
  if (!route || !route.length) return;
  u.route = route;
  u.routeCur = route[0];
  u.target = route[0];
}
