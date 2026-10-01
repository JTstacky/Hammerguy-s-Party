import { Minigame } from '../../base.js';
import { newId, rand, dist, round2, wc3 } from '../../../engine/server/sim.js';

// Uther Party 4.0 #39 "The Sheep Shearers" (docs/uther-party/rules-4.0.md).
// Two Sheep Shearer blades (400 u/s, kill radius 160, checked every 0.05 s)
// run round a 1536x512 rectangular loop, half a lap apart, so every point of
// it is swept every 5.12 s. Every 15 s, after a random 0-5 s wait, both
// reverse. Sheep (speed 200, 15 HP) start in one of two pens just north of
// the loop and race to the finish box in the middle of its southern edge,
// right on the blade path. Race: 8, 7, 6 ... for finishers, 0 for the shorn
// and for anyone still out at 90 s.
//
// The walkable ground is copied from the arena's pathing
// (docs/uther-party/arenas/Sheep_Shearers.png): the loop is a 2-tile track
// with 2-tile stubs off it (the start pens, pens south of the bottom edge,
// and pockets past each corner). The middle of the loop is unwalkable, so the
// way to the finish is along the track, slipping between the blades and
// sheltering in the pockets, which lie just outside the kill radius.
//
// Deviation: the original's computer sheep are only ordered straight at the
// finish at t=2 (and so die). Ours plan a route through time, waiting in the
// pockets for the gaps, and only trust the blades' direction until the next
// reversal could come.
//
// Coordinates: WC3 units relative to the arena centre, y up (north), are
// converted with P(x, y) -> (wc3(x), wc3(-y)).
const P = (x, y) => [wc3(x), wc3(-y)];
const HALF_W = wc3(1024);
const HALF_H = wc3(512);
const LOOP_W = 768; // corners at (+-768, +-256), WC3 units
const LOOP_H = 256;
const PERIM = 2 * (2 * LOOP_W + 2 * LOOP_H); // 4096
export const BLADE_SPEED = 400; // WC3 u/s
export const KILL_R = 160; // WC3 u
const SHEEP = { hp: 15, speed: wc3(200), r: wc3(15) };
const SWAP_EVERY = 15;
const DURATION = 90;

// Walkable rectangles (WC3 x0, x1, y0, y1; y up). They overlap where they
// join, so a unit (confined to a rectangle shrunk by its radius) can pass.
const WALK = [
  [-1024, 1024, 128, 384], // northern track
  [-1024, 1024, -384, -128], // southern track
  [-900, -644, -512, 512], // western track
  [644, 900, -512, 512], // eastern track
  [-388, -132, 128, 512], // start pens
  [132, 388, 128, 512],
  [-388, -132, -512, -128], // southern pens
  [132, 388, -512, -128],
].map(([x0, x1, y0, y1]) => ({ x0: wc3(x0), x1: wc3(x1), y0: wc3(-y1), y1: wc3(-y0) }));
const START = [[-384, -128], [128, 384]]; // x ranges; y 448..512 (north of the loop)
const FINISH = { x0: wc3(-64), x1: wc3(64), y0: wc3(192), y1: wc3(320) }; // (0, -256) +- 64

// A point on the loop at arc length s (WC3 units, clockwise from the NW corner).
export function loopPoint(s) {
  s = ((s % PERIM) + PERIM) % PERIM;
  const W = 2 * LOOP_W;
  const H = 2 * LOOP_H;
  if (s < W) return [-LOOP_W + s, LOOP_H];
  s -= W;
  if (s < H) return [LOOP_W, LOOP_H - s];
  s -= H;
  if (s < W) return [LOOP_W - s, -LOOP_H];
  s -= W;
  return [-LOOP_W, -LOOP_H + s];
}

export class SheepShearers extends Minigame {
  static id = 'sheep';
  static name = 'The Sheep Shearers';
  static desc = 'Reach the end! Two whirling shearer blades race round the track, half a lap apart, and every so often both reverse. The finish is on the far side, right in their path. Slip in behind a blade, shelter in the side pockets, and dash for it.';
  static controls = 'Right-click to move. Anything within reach of a blade is shorn on the spot.';
  static duration = DURATION;
  static ranking = 'race';

  setup() {
    this.map = {
      theme: 'sheep',
      floor: { shape: 'rect', w: HALF_W * 2, h: HALF_H * 2 },
      props: [],
      walk: WALK.map((r) => [r.x0, r.x1, r.y0, r.y1].map(round2)),
      loop: [round2(wc3(LOOP_W)), round2(wc3(LOOP_H))],
      finish: [0, round2(wc3(256)), round2(wc3(64))],
      build: ['sheep'],
      bounds: HALF_W + 1,
    };
    // Each sheep picks the left or right pen at random, facing south.
    this.spawnHeroes(this.pids.map(() => {
      const [x0, x1] = START[Math.random() < 0.5 ? 0 : 1];
      return P(rand(x0 + 20, x1 - 20), rand(452, 508));
    }), { hp: SHEEP.hp, speed: SHEEP.speed, r: SHEEP.r, facing: Math.PI / 2 });
    for (const u of this.heroes.values()) {
      u.skin = 'sheep';
      u.solid = false; // sheep walk through each other
    }
    // Blade A on the finish (bottom middle), blade B at the top middle: half a lap apart.
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.blades = [{ id: newId(), s: 2 * LOOP_W + 2 * LOOP_H + LOOP_W }, { id: newId(), s: LOOP_W }];
    this.swapT = SWAP_EVERY;
    this.flipAt = null; // seconds until the pending reversal
    this.killAcc = 0;
    this.graph = buildGraph();
    this.plans = new Map();
  }

  // Blade arc positions `t` seconds from now, given what is known.
  bladeS(t, i) {
    const b = this.blades[i];
    const v = BLADE_SPEED * this.dir;
    if (this.flipAt != null && t > this.flipAt) return b.s + v * this.flipAt - v * (t - this.flipAt);
    return b.s + v * t;
  }

  // How far ahead the blades are predictable: until the next reversal could happen.
  horizon() {
    return Math.max(0, this.swapT);
  }

  tick(dt) {
    if (this.time >= DURATION) {
      for (const [pid, u] of this.heroes) if (u.alive && !u.finished) this.eliminate(pid, 'death');
      return;
    }
    // Sheep Swap: every 15 s, wait 0-5 s, then both blades reverse.
    this.swapT -= dt;
    if (this.swapT <= 0) {
      this.swapT += SWAP_EVERY;
      this.flipAt = rand(0, 5);
    }
    if (this.flipAt != null) {
      this.flipAt -= dt;
      if (this.flipAt <= 0) {
        this.flipAt = null;
        this.dir = -this.dir;
        this.ev({ k: 'shearswap' });
        for (const pl of this.plans.values()) pl.stale = true;
      }
    }
    for (const b of this.blades) b.s = (((b.s + BLADE_SPEED * this.dir * dt) % PERIM) + PERIM) % PERIM;

    for (const [pid, u] of this.heroes) if (this.bots.has(pid) && u.alive && !u.finished) this.botStep(pid, u, dt);
    this.stepHeroes(dt);
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.finished) continue;
      confine(u);
      if (u.x >= FINISH.x0 && u.x <= FINISH.x1 && u.y >= FINISH.y0 && u.y <= FINISH.y1) this.finish(pid);
    }
    // Sheep Death, every 0.05 s: anything within 160 of a blade.
    this.killAcc += dt;
    while (this.killAcc >= 0.05) {
      this.killAcc -= 0.05;
      const pts = this.blades.map((b) => P(...loopPoint(b.s)));
      for (const [pid, u] of this.heroes) {
        if (!u.alive || u.finished) continue;
        if (pts.some(([x, y]) => dist(u.x, u.y, x, y) <= wc3(KILL_R))) this.eliminate(pid, 'shear');
      }
    }
  }

  // ---- computer sheep: a search through (place, time) on a 20 u graph.

  botStep(pid, u, dt) {
    let plan = this.plans.get(pid);
    if (plan) plan.t += dt;
    if (!plan || plan.stale || plan.t >= plan.replan) {
      const next = this.plan(u, this.bots.get(pid).mem);
      if (next.ok || !plan) plan = next;
      else if (plan.stale) plan = this.runToPocket(u);
      else plan.replan = plan.t + 0.3; // keep to the old plan, which still had room
      this.plans.set(pid, plan);
    }
    // Aim one node ahead of the schedule while moving, so the sheep never stops between nodes.
    const path = plan.path;
    const i = Math.min(path.length - 1, Math.floor(plan.t / STEP) + 1);
    const j = Math.min(path.length - 1, i + 1);
    const n = this.graph.nodes[path[i] !== path[i - 1] && path[j] !== path[i] ? path[j] : path[i]];
    const [x, y] = P(n.x, n.y);
    if (dist(u.x, u.y, x, y) < wc3(4)) {
      if (u.target) u.stop();
    } else u.steer(x, y);
  }

  plan(u, mem) {
    const G = this.graph;
    const margin = (mem.margin ??= 45 + rand(0, 40) * (1 - mem.skill));
    const safeR = KILL_R + margin;
    const steps = Math.max(1, Math.min(MAX_STEPS, Math.floor(this.horizon() / STEP)));
    // Blade points per step.
    const blades = [];
    for (let k = 0; k <= steps; k++) blades.push([0, 1].map((i) => loopPoint(this.bladeS(k * STEP, i))));
    const ok = (n, k) => n.pocket || blades[k].every(([bx, by]) => (n.x - bx) ** 2 + (n.y - by) ** 2 > safeR * safeR);
    // Start from the nearest node.
    const wx = u.x * 54;
    const wy = -u.y * 54;
    let start = 0;
    let bd = Infinity;
    G.nodes.forEach((n, i) => {
      const d = (n.x - wx) ** 2 + (n.y - wy) ** 2;
      if (d < bd) {
        bd = d;
        start = i;
      }
    });
    const N = G.nodes.length;
    const parent = [new Int32Array(N).fill(-2)];
    parent[0][start] = -1;
    let frontier = [start];
    let goal = null;
    for (let k = 1; k <= steps && frontier.length && goal == null; k++) {
      const par = new Int32Array(N).fill(-2);
      const next = [];
      for (const i of frontier) {
        for (const j of [i, ...G.nodes[i].adj]) {
          if (par[j] !== -2 || !ok(G.nodes[j], k)) continue;
          par[j] = i;
          next.push(j);
          if (G.nodes[j].goal) goal = j;
        }
      }
      parent.push(par);
      frontier = next;
    }
    const trace = (k, j) => {
      const path = [];
      for (; k >= 0; k--) {
        path.push(j);
        j = parent[k][j];
      }
      return path.reverse();
    };
    if (goal != null) return { path: trace(parent.length - 1, goal), replan: 0.6, ok: true, t: 0 };
    // No way through yet: end up in the pocket nearest the finish that can be reached.
    const k = parent.length - 1;
    let best = null;
    let bestD = Infinity;
    for (let j = 0; j < N; j++) {
      if (parent[k][j] === -2 || !G.nodes[j].pocket) continue;
      if (G.nodes[j].toGoal < bestD) {
        bestD = G.nodes[j].toGoal;
        best = j;
      }
    }
    if (best == null) return { path: [start], replan: 0.3, ok: false, t: 0 };
    return { path: trace(k, best), replan: 0.6, ok: true, t: 0 };
  }

  // Caught out by a reversal: head for the nearest pocket and hope.
  runToPocket(u) {
    const G = this.graph;
    const wx = u.x * 54;
    const wy = -u.y * 54;
    let start = 0;
    G.nodes.forEach((n, i) => {
      if ((n.x - wx) ** 2 + (n.y - wy) ** 2 < (G.nodes[start].x - wx) ** 2 + (G.nodes[start].y - wy) ** 2) start = i;
    });
    const prev = new Map([[start, -1]]);
    const q = [start];
    let end = start;
    while (q.length) {
      const i = q.shift();
      if (G.nodes[i].pocket) {
        end = i;
        break;
      }
      for (const j of G.nodes[i].adj) if (!prev.has(j)) (prev.set(j, i), q.push(j));
    }
    const path = [];
    for (let i = end; i !== -1; i = prev.get(i)) path.unshift(i);
    return { path, replan: 0.3, ok: false, t: 0 };
  }

  heroEnts(pid) {
    // Finished sheep leave the track.
    return super.heroEnts(pid).filter((e) => !(e.fx && e.fx.includes('finished') && this.finTime(e.id) > 1.2));
  }

  finish(pid) {
    super.finish(pid);
    this.heroes.get(pid).finT = this.time;
  }

  finTime(id) {
    const u = [...this.heroes.values()].find((h) => h.id === id);
    return u?.finT != null ? this.time - u.finT : 0;
  }

  progress(pid) {
    const u = this.heroes.get(pid);
    return u ? -dist(u.x, u.y, 0, wc3(256)) : 0;
  }

  hud() {
    const t = this.flipAt;
    return { label: t != null ? 'The blades are about to turn!' : `Blades running ${this.dir > 0 ? 'clockwise' : 'counter-clockwise'}` };
  }

  worldEnts() {
    return this.blades.map((b) => {
      const [x, y] = P(...loopPoint(b.s));
      return { id: b.id, k: 'shearblade', x: round2(x), y: round2(y), d: this.dir, r: round2(wc3(KILL_R)) };
    });
  }
}

// Keeps a sheep on the walkable ground: into the nearest walkable rectangle.
function confine(u) {
  let bx = u.x;
  let by = u.y;
  let bd = Infinity;
  for (const R of WALK) {
    const x = Math.max(R.x0 + u.r, Math.min(R.x1 - u.r, u.x));
    const y = Math.max(R.y0 + u.r, Math.min(R.y1 - u.r, u.y));
    const d = (x - u.x) ** 2 + (y - u.y) ** 2;
    if (d < bd) {
      bd = d;
      bx = x;
      by = y;
      if (d === 0) break;
    }
  }
  u.x = bx;
  u.y = by;
}

// The bots' graph: nodes 20 u apart (0.1 s at speed 200) along the loop and
// along spurs into the pens and pockets. Pocket ends lie beyond the kill
// radius from the loop and count as always safe.
const STEP = 0.1;
const MAX_STEPS = 200;
function buildGraph() {
  const nodes = [];
  const key = new Map();
  const add = (x, y) => {
    const k = `${Math.round(x)},${Math.round(y)}`;
    if (key.has(k)) return key.get(k);
    const i = nodes.length;
    nodes.push({ x, y, adj: [] });
    key.set(k, i);
    return i;
  };
  const link = (a, b) => {
    if (a === b) return;
    nodes[a].adj.push(b);
    nodes[b].adj.push(a);
  };
  const D = 20;
  const loop = [];
  for (let s = 0; s < PERIM; s += D) loop.push(add(...loopPoint(s)));
  loop.forEach((a, i) => link(a, loop[(i + 1) % loop.length]));
  // Spurs from a loop point (x, y) out to (x2, y2).
  const spur = (x, y, x2, y2) => {
    const len = Math.hypot(x2 - x, y2 - y);
    // Hook onto the nearest loop node.
    let prev = loop.reduce((b, i) => (Math.hypot(nodes[i].x - x, nodes[i].y - y) < Math.hypot(nodes[b].x - x, nodes[b].y - y) ? i : b), loop[0]);
    for (let d = D; d <= len + 0.1; d += D) {
      const i = add(x + ((x2 - x) * d) / len, y + ((y2 - y) * d) / len);
      link(prev, i);
      prev = i;
    }
  };
  for (const sx of [-1, 1]) {
    spur(sx * 256, 256, sx * 256, 476); // start pens
    spur(sx * 256, -256, sx * 256, -476); // southern pens
    for (const sy of [-1, 1]) {
      spur(sx * 768, sy * 256, sx * 768, sy * 476); // pockets past the corners (N/S)
      spur(sx * 768, sy * 256, sx * 988, sy * 256); // pockets past the corners (E/W)
    }
  }
  for (const n of nodes) {
    n.pocket = distToLoop(n.x, n.y) > KILL_R + 40;
    n.goal = Math.abs(n.y + 256) < 1 && Math.abs(n.x) <= 60;
  }
  // Graph distance to the finish, for choosing the best pocket to wait in.
  const q = [];
  nodes.forEach((n, i) => {
    n.toGoal = n.goal ? 0 : Infinity;
    if (n.goal) q.push(i);
  });
  while (q.length) {
    const i = q.shift();
    for (const j of nodes[i].adj) {
      if (nodes[j].toGoal > nodes[i].toGoal + 1) {
        nodes[j].toGoal = nodes[i].toGoal + 1;
        q.push(j);
      }
    }
  }
  return { nodes };
}

function distToLoop(x, y) {
  const dx = Math.abs(x) - LOOP_W;
  const dy = Math.abs(y) - LOOP_H;
  // Distance to the rectangle's outline.
  if (Math.abs(x) <= LOOP_W && Math.abs(y) <= LOOP_H) return Math.min(-dx, -dy);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
}
