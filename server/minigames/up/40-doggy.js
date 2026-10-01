import { Minigame } from '../../base.js';
import { newId, rand, dist, round2, wc3 } from '../../../engine/server/sim.js';

// Uther Party 4.0 #40 "Doggy Hell" (docs/uther-party/rules-4.0.md).
// Fetch a stick and bring it back to the Circle of Power. The 1536x1536 arena
// is a serpentine maze of 13 lava rectangles with 1-tile (128 u) corridors;
// walking into lava is death. 10 invulnerable Meat Wagons sit on the walls,
// each shelling one fixed chokepoint 768 u ahead: 35-44 damage after armour
// (a dog has 15 HP) to everything within 64 u, every 2.0 s, and every 1.5 s
// from the moment anyone first picks up a stick. Eight sticks lie at the far
// end; a dog carries one and drops it where it dies. Dogs: speed 190, 15 HP.
// Race: 8, 7, 6 ... for dogs home with a stick; 0 for the dead and for anyone
// still out at 120 s.
//
// Movement is WC3's straight-line walking: the lava is not blocked by pathing,
// so a careless right-click across a wall walks straight into it.
//
// Deviations:
//  - The original computer dogs fly in a straight line and die in the lava at
//    about t=5.7. Ours walk the maze and time their dashes between shells.
//  - A dog picks up a stick by walking onto it (WC3 needs a right-click on it).
//  - The shell's flight speed is not in the extracted data; 900 u/s is used.
//
// Coordinates: WC3 units relative to the arena centre, y up, converted with
// (x, y) -> (wc3(x), wc3(-y)) so north is at the top of the screen.
const R = (x0, x1, y0, y1) => ({ x0: wc3(x0), x1: wc3(x1), y0: wc3(-y1), y1: wc3(-y0) });
const EDGE = wc3(704); // the outer lava ring's outer edge
export const LAVA = [
  R(-704, 704, 576, 704), R(-704, 704, -704, -576), R(-704, -576, -704, 704), R(576, 704, -704, 704), // ring
  R(-704, -192, -64, 64), R(192, 704, -64, 64), // side bars
  R(-448, 448, 192, 320), R(-448, 448, -320, -192), // long bars
  R(-448, -320, 192, 448), R(320, 448, 192, 448), // stubs round the sticks
  R(-448, -320, -448, -192), R(320, 448, -448, -192), // stubs round the start
  R(-64, 64, -320, 320), // spine
];
export const START = R(-64, 64, -512, -384);
const STICKS = R(-64, 64, 384, 512);
const DOG = { hp: 15, speed: wc3(190), r: wc3(15) };
export const SHELL = { splash: wc3(64), dmg: [71 * 0.5, 88 * 0.5], cd: 2.0, cdFast: 1.5, point: 0.7, speed: wc3(900) };
const PICKUP_R = wc3(40);
const DURATION = 120;

// Wagons: position (WC3, from the centre) and the direction it shells, 768 u ahead.
const WAGONS = [
  [-640, 0, 1, 0], [640, 0, -1, 0],
  [-320, -640, 0, 1], [320, -640, 0, 1],
  [-320, 640, 0, -1], [320, 640, 0, -1],
  [-256, 256, 1, 0], [256, 256, -1, 0],
  [-256, -256, 1, 0], [256, -256, -1, 0],
];

export class DoggyHell extends Minigame {
  static id = 'doggy';
  static name = 'Doggy Hell';
  static desc = 'Fetch the stick, and return to the circle of power! Pick your way through a lava maze to the sticks at the far end and bring one home. Meat wagons shell the chokepoints like clockwork, and faster once anyone grabs a stick.';
  static controls = 'Right-click to move (dogs walk in a straight line, lava or not). Walk onto a stick to pick it up, then bring it back to the circle.';
  static duration = DURATION;
  static ranking = 'race';

  setup() {
    this.map = {
      theme: 'doggy',
      floor: { shape: 'rect', w: wc3(1536), h: wc3(1536) },
      props: [],
      lava: LAVA.map((r) => [r.x0, r.x1, r.y0, r.y1].map(round2)),
      start: [START.x0, START.x1, START.y0, START.y1].map(round2),
      build: ['doggy'],
      bounds: EDGE + 2,
    };
    this.spawnHeroes(this.pids.map(() => [rand(START.x0 + 0.4, START.x1 - 0.4), rand(START.y0 + 0.4, START.y1 - 0.4)]), { hp: DOG.hp, speed: DOG.speed, r: DOG.r, facing: -Math.PI / 2 });
    for (const u of this.heroes.values()) {
      u.skin = 'dog';
      u.solid = false;
      u.stick = null;
    }
    // Always 8 sticks, at random points of the box beyond the maze's far end.
    this.sticks = Array.from({ length: 8 }, () => ({ id: newId(), x: rand(STICKS.x0 + 0.1, STICKS.x1 - 0.1), y: rand(STICKS.y0 + 0.1, STICKS.y1 - 0.1) }));
    this.wagons = WAGONS.map(([x, y, dx, dy]) => ({
      id: newId(),
      x: wc3(x), y: wc3(-y), f: Math.atan2(-dy, dx),
      tx: wc3(x + dx * 768), ty: wc3(-(y + dy * 768)),
      cd: rand(0, 0.05), // all ordered to fire at t=0
      wind: -1,
    }));
    this.shells = [];
    this.fast = false;
    this.grid = new Grid();
    this.bpaths = new Map();
  }

  tick(dt) {
    if (this.time >= DURATION) {
      for (const [pid, u] of this.heroes) if (u.alive && !u.finished) this.eliminate(pid, 'death');
      return;
    }
    for (const w of this.wagons) {
      w.cd -= dt;
      if (w.wind >= 0) {
        w.wind += dt;
        if (w.wind >= SHELL.point) {
          w.wind = -1;
          const flight = dist(w.x, w.y, w.tx, w.ty) / SHELL.speed;
          this.shells.push({ id: newId(), sx: w.x, sy: w.y, x: w.tx, y: w.ty, t: 0, flight });
        }
      } else if (w.cd <= 0) {
        w.cd = this.fast ? SHELL.cdFast : SHELL.cd;
        w.wind = 0;
      }
    }
    for (const [pid, u] of this.heroes) if (this.bots.has(pid) && u.alive && !u.finished) this.botStep(pid, u, dt);
    this.stepHeroes(dt);
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.finished) continue;
      u.x = Math.max(-EDGE, Math.min(EDGE, u.x));
      u.y = Math.max(-EDGE, Math.min(EDGE, u.y));
      if (LAVA.some((r) => u.x >= r.x0 && u.x <= r.x1 && u.y >= r.y0 && u.y <= r.y1)) {
        this.kill(pid, 'burn');
        continue;
      }
      if (!u.stick) {
        const s = this.sticks.find((k) => dist(k.x, k.y, u.x, u.y) <= PICKUP_R);
        if (s) this.pickUp(u, s);
      } else if (u.x >= START.x0 && u.x <= START.x1 && u.y >= START.y0 && u.y <= START.y1) {
        u.stick = null;
        u.skin = 'dog';
        this.finish(pid);
        u.finT = this.time;
      }
    }
    for (const s of this.shells) {
      s.t += dt;
      if (s.t >= s.flight) this.land(s);
    }
    this.shells = this.shells.filter((s) => !s.done);
  }

  pickUp(u, s) {
    this.sticks = this.sticks.filter((k) => k !== s);
    u.stick = s;
    u.skin = 'dogstick';
    this.ev({ k: 'sfx', s: 'coin' });
    this.bpaths.delete(u.owner);
    if (!this.fast) {
      // Doggy Obtain: every wagon is replaced by a faster one, re-aimed at once.
      this.fast = true;
      for (const w of this.wagons) if (w.wind < 0) w.cd = 0;
      this.ev({ k: 'dogfast' });
    }
  }

  land(s) {
    s.done = true;
    this.ev({ k: 'dogshell', x: round2(s.x), y: round2(s.y), r: round2(SHELL.splash) });
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.finished) continue;
      if (dist(u.x, u.y, s.x, s.y) <= SHELL.splash + u.r) {
        const dmg = SHELL.dmg[0] + Math.random() * (SHELL.dmg[1] - SHELL.dmg[0]);
        u.hp -= dmg;
        this.ev({ k: 'dmg', x: round2(u.x), y: round2(u.y), n: Math.round(dmg) });
        if (u.hp <= 0) this.kill(pid, 'squish');
      }
    }
  }

  kill(pid, how) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return;
    u.hp = 0;
    // The stick drops where the dog fell.
    if (u.stick) {
      this.sticks.push({ id: newId(), x: u.x, y: u.y });
      u.stick = null;
      u.skin = 'dog';
    }
    this.eliminate(pid, how);
  }

  // Seconds until each future shell lands at wagon w's target, up to `horizon`.
  landings(w, horizon) {
    const out = [];
    for (const s of this.shells) if (s.x === w.tx && s.y === w.ty) out.push(s.flight - s.t);
    const flight = dist(w.x, w.y, w.tx, w.ty) / SHELL.speed;
    const cd = this.fast ? SHELL.cdFast : SHELL.cd;
    let t = w.wind >= 0 ? SHELL.point - w.wind : Math.max(0, w.cd) + SHELL.point;
    for (; t + flight <= horizon; t += cd) out.push(t + flight);
    return out;
  }

  // Computer dogs: walk the maze on a 32 u grid, and wait outside a shelled
  // chokepoint until a shell has just landed.
  botStep(pid, u, dt) {
    const mem = this.bots.get(pid).mem;
    let bp = this.bpaths.get(pid);
    const goal = u.stick ? { x: 0, y: (START.y0 + START.y1) / 2 } : this.nearestStick(u);
    if (!goal) {
      u.stop();
      return;
    }
    if (!bp || bp.gx !== goal.x || bp.gy !== goal.y || this.time >= bp.until) {
      bp = { gx: goal.x, gy: goal.y, path: this.grid.path(u.x, u.y, goal.x, goal.y), i: 0, until: this.time + 2 };
      this.bpaths.set(pid, bp);
    }
    const path = bp.path;
    if (!path.length) return;
    while (bp.i < path.length - 1 && dist(u.x, u.y, path[bp.i][0], path[bp.i][1]) < wc3(12)) bp.i++;
    // Timing: will the next stretch of path cross a shelled spot as a shell lands?
    const margin = (mem.shellMargin ??= wc3(4 + (1 - mem.skill) * 12));
    const danger = SHELL.splash + u.r + margin;
    const inside = this.wagons.some((w) => dist(u.x, u.y, w.tx, w.ty) < danger);
    if (!inside) {
      const speed = u.speed;
      let arc = 0;
      let px = u.x;
      let py = u.y;
      const windows = new Map();
      for (let i = bp.i; i < path.length && arc < wc3(420); i++) {
        const [x, y] = path[i];
        arc += dist(px, py, x, y);
        px = x;
        py = y;
        this.wagons.forEach((w, wi) => {
          if (dist(x, y, w.tx, w.ty) < danger) {
            const wdw = windows.get(wi) || { a: arc, b: arc };
            wdw.b = arc;
            windows.set(wi, wdw);
          }
        });
      }
      for (const [wi, wdw] of windows) {
        const tIn = wdw.a / speed - 0.05;
        const tOut = wdw.b / speed + 0.08;
        if (this.landings(this.wagons[wi], tOut + 0.1).some((t) => t >= tIn && t <= tOut)) {
          // Impatient dogs sometimes chance it anyway.
          if (Math.random() < (1 - mem.skill) * 0.35 * dt) break;
          if (u.target) u.stop();
          return;
        }
      }
    }
    const [x, y] = path[Math.min(bp.i, path.length - 1)];
    u.steer(x, y);
  }

  nearestStick(u) {
    let best = null;
    let bd = Infinity;
    for (const s of this.sticks) {
      const d = this.grid.distance(u.x, u.y, s.x, s.y);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  progress(pid) {
    const u = this.heroes.get(pid);
    return u ? (u.stick ? 1000 : 0) - dist(u.x, u.y, 0, u.stick ? START.y0 : STICKS.y0) : 0;
  }

  hud(pid) {
    const u = this.heroes.get(pid);
    const label = u?.stick ? 'Stick in your jaws: back to the circle!' : `Sticks left ${this.sticks.length}`;
    return { label: this.fast ? `${label} · Wagons firing faster!` : label };
  }

  heroEnts(pid) {
    const ents = super.heroEnts(pid);
    for (const e of ents) {
      const u = [...this.heroes.values()].find((h) => h.id === e.id);
      // Finished dogs trot off into the circle.
      if (u?.finT != null && this.time - u.finT > 1.2) e.gone = 1;
    }
    return ents.filter((e) => !e.gone);
  }

  worldEnts() {
    const ents = this.wagons.map((w) => ({ id: w.id, k: 'meatwagon', x: round2(w.x), y: round2(w.y), f: round2(w.f), fire: w.wind >= 0 ? 1 : undefined }));
    for (const s of this.sticks) ents.push({ id: s.id, k: 'stick', x: round2(s.x), y: round2(s.y) });
    for (const s of this.shells) ents.push({ id: s.id, k: 'dogshell', x: round2(s.x), y: round2(s.y), sx: round2(s.sx), sy: round2(s.sy), t: round2(s.t / s.flight), r: round2(SHELL.splash) });
    return ents;
  }
}

// The maze on a 32 u grid: a cell is open if its centre keeps a dog clear of
// the lava. Paths are breadth-first with diagonal steps, then thinned.
const CELL = wc3(32);
class Grid {
  constructor() {
    this.n = Math.round((EDGE * 2) / CELL);
    this.open = new Uint8Array(this.n * this.n);
    const pad = DOG.r + wc3(8);
    for (let j = 0; j < this.n; j++) {
      for (let i = 0; i < this.n; i++) {
        const [x, y] = this.center(i, j);
        this.open[j * this.n + i] = LAVA.some((r) => x >= r.x0 - pad && x <= r.x1 + pad && y >= r.y0 - pad && y <= r.y1 + pad) ? 0 : 1;
      }
    }
    this.cache = new Map();
  }

  center(i, j) {
    return [-EDGE + (i + 0.5) * CELL, -EDGE + (j + 0.5) * CELL];
  }

  cellOf(x, y) {
    const i = Math.max(0, Math.min(this.n - 1, Math.floor((x + EDGE) / CELL)));
    const j = Math.max(0, Math.min(this.n - 1, Math.floor((y + EDGE) / CELL)));
    return [i, j];
  }

  // The open cell nearest (x, y).
  nearestOpen(x, y) {
    const [ci, cj] = this.cellOf(x, y);
    let best = null;
    let bd = Infinity;
    for (let j = Math.max(0, cj - 3); j <= Math.min(this.n - 1, cj + 3); j++) {
      for (let i = Math.max(0, ci - 3); i <= Math.min(this.n - 1, ci + 3); i++) {
        if (!this.open[j * this.n + i]) continue;
        const [cx, cy] = this.center(i, j);
        const d = (cx - x) ** 2 + (cy - y) ** 2;
        if (d < bd) {
          bd = d;
          best = j * this.n + i;
        }
      }
    }
    return best;
  }

  // Distance field (in steps) to the cell nearest (x, y), cached per goal cell.
  field(x, y) {
    const g = this.nearestOpen(x, y);
    if (g == null) return null;
    if (this.cache.has(g)) return this.cache.get(g);
    const N = this.n;
    const d = new Float32Array(N * N).fill(Infinity);
    d[g] = 0;
    // Dijkstra-lite: two passes of BFS with diagonal weights via a bucket queue.
    const q = [g];
    const steps = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (q.length) {
      const c = q.shift();
      const ci = c % N;
      const cj = (c - ci) / N;
      for (const [di, dj, w] of steps) {
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const k = j * N + i;
        // No corner cutting past lava.
        if (!this.open[k] || !this.open[cj * N + i] || !this.open[j * N + ci]) continue;
        if (d[k] > d[c] + w + 1e-6) {
          d[k] = d[c] + w;
          q.push(k);
        }
      }
    }
    this.cache.set(g, d);
    return d;
  }

  distance(ax, ay, bx, by) {
    const d = this.field(bx, by);
    const s = this.nearestOpen(ax, ay);
    return d && s != null ? d[s] : Infinity;
  }

  path(ax, ay, bx, by) {
    const d = this.field(bx, by);
    let c = this.nearestOpen(ax, ay);
    if (!d || c == null || !Number.isFinite(d[c])) return [];
    const N = this.n;
    const cells = [c];
    while (d[c] > 0 && cells.length < 400) {
      const ci = c % N;
      const cj = (c - ci) / N;
      let best = c;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const i = ci + di;
          const j = cj + dj;
          if (i < 0 || j < 0 || i >= N || j >= N) continue;
          const k = j * N + i;
          if (!this.open[k] || !this.open[cj * N + i] || !this.open[j * N + ci]) continue;
          if (d[k] < d[best]) best = k;
        }
      }
      if (best === c) break;
      c = best;
      cells.push(c);
    }
    const pts = cells.map((k) => this.center(k % N, Math.floor(k / N)));
    pts.push([bx, by]);
    return pts;
  }
}
