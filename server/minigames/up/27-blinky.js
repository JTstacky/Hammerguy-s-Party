import { newId, rand, dist, round1, round2, wc3, collideUnits, stepUnits } from '../../../engine/server/sim.js';
import { WalkGrid, GridRace, toServer, rectFromWc3, randIn, creep, meleeStep, creepSnap, pathTo, followPath } from './walkgrid.js';

// Uther Party 4.0 #27 "Blinky the Bear" (docs/uther-party/rules-4.0.md): a
// 1280x3712 lattice of four one-tile lanes split by two-tile walls and cut
// into segments by wall bands. Every Blinky (speed 320, 5 HP, collision 31)
// starts in a sealed pocket at the south end and must Blink (range 512,
// cooldown 0.5 s, free) over the walls to the finish strip at the north end.
// One polar bear patrols each lane segment (speed 300, acquisition 128, one
// hit kills), mirror pairs in opposite phase. Leaving the arena rect kills.
// 90 s limit.
//
// Blink lands at the nearest walkable spot when its target is inside a wall,
// as WC3 places units (the sheet notes the original's exact behaviour there
// is uncertain). A target beyond 512 u blinks the full 512 toward it.
const CX = 10368;
const CY = -2752;
const conv = toServer(CX, CY);
export const LAYOUT = [
  '....FF....',
  '....FF....',
  '.########.',
  '.#~~~~~##.',
  '.#~~~~~~#.',
  '.########.',
  '.##.##.##.',
  '.##.##.##.',
  '###.##.###',
  '###.##.###',
  '.##.##.##.',
  '.##.##.##.',
  '.##.##.##.',
  '.########.',
  '.########.',
  '.##.##.##.',
  '.##.##.##.',
  '.##.##.##.',
  '###.##.###',
  '###.##.###',
  '.##.##.##.',
  '.##.##.##.',
  '.##.##.##.',
  '.########.',
  '.########.',
  '.##....##.',
  '.##.SS.##.',
  '.##.SS.##.',
  '.##....##.',
];
const CELL = wc3(128);
const HW = wc3(640);
const HH = wc3(1856);
export const BLINKY = { speed: wc3(320), r: wc3(31), hp: 5 };
export const BLINK_RANGE = wc3(512);
export const BEAR = { speed: wc3(300), r: wc3(32), hp: 475 };
export const BEAR_ATTACK = { range: wc3(128), cd: 1.35, point: 0.5 };
export const ACQUIRE = wc3(128);
const WAIT_COST = 0.05;
// Patrols: lane x, first leg start y -> end y (WC3 coordinates).
export const PATROLS = [
  [9792, -3584, -4608],
  [9792, -2304, -3200],
  [9792, -1920, -1024],
  [10176, -2944, -3840],
  [10176, -2560, -1792],
  [10560, -3840, -2944],
  [10560, -1792, -2560],
  [10944, -4608, -3584],
  [10944, -3200, -2304],
  [10944, -1024, -1920],
];

export class BlinkyBear extends GridRace {
  static id = 'blinky';
  static name = 'Blinky the Bear';
  static desc = 'Reach the end! You are a bear who can Blink. Walls cut the field into narrow lanes, and the only way across is to teleport. Polar bears patrol every lane: one swipe kills, and so does blinking out of the arena.';
  static controls = 'Right-click to move. Q, then click: Blink up to 512 range (0.5 s cooldown). Plan your route!';
  static duration = 90;
  static ranking = 'race';

  setup() {
    const [x0, y0] = conv(9728, -896);
    this.grid = new WalkGrid(LAYOUT, { cell: CELL, x0, y0, blocked: '#~', outsideBlocked: false });
    this.map = {
      theme: 'grass',
      floor: { shape: 'rect', w: HW * 2, h: HH * 2 },
      props: surrounds(),
      bounds: HH,
      build: ['upmaze'],
      maze: this.grid.snap({ style: 'cliff', h: 1.5 }),
    };
    this.arena = { x0: -HW, x1: HW, y0: -HH, y1: HH };
    this.finishRect = rectFromWc3(conv, 10240, -1152, 10496, -896);
    this.goal = { x: (this.finishRect.x0 + this.finishRect.x1) / 2, y: (this.finishRect.y0 + this.finishRect.y1) / 2 };
    this.abilities = [
      {
        name: 'Blink',
        icon: '✨',
        desc: 'Teleport to the target point, up to 512 range. Lands on the nearest open ground if you aim into a wall. Leaving the arena kills.',
        kind: 'point',
        cd: 0.5,
        range: BLINK_RANGE,
        castPoint: 0,
        cast: (pid, u, tgt) => this.blink(u, tgt.x, tgt.y),
      },
    ];
    const st = rectFromWc3(conv, 10240, -4480, 10496, -4224);
    this.spawnHeroes(this.pids.map(() => randIn(st)), { ...BLINKY, facing: -Math.PI / 2 });
    for (const u of this.heroes.values()) u.skin = 'grizzly';
    for (const u of this.heroes.values()) this.grid.push(u);
    this.bears = PATROLS.map(([X, Y0, Y1]) => {
      const [x, ya] = conv(X, Y0);
      const [, yb] = conv(X, Y1);
      const b = creep('polarbear', x, ya, { ...BEAR, facing: yb > ya ? Math.PI / 2 : -Math.PI / 2 });
      b.patrol = { ax: x, ay: ya, bx: x, by: yb, leg: 1 };
      b.victim = null;
      b.repath = 0;
      b.order(x, yb);
      return b;
    });
    this.buildBotField();
    this.circleId = newId();
  }

  tick(dt) {
    this.stepRace(dt);
    this.stepBears(dt);
    const all = [...this.heroes.values(), ...this.bears];
    collideUnits(all);
    for (const u of all) if (u.alive && !u.finished) this.grid.push(u);
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.finished) continue;
      if (!this.inRect(u, this.arena)) this.eliminate(pid, 'death');
      else if (this.inRect(u, this.finishRect)) this.finish(pid);
    }
  }

  blink(u, x, y) {
    let dx = x - u.x;
    let dy = y - u.y;
    const d = Math.hypot(dx, dy);
    if (d > BLINK_RANGE) {
      dx *= BLINK_RANGE / d;
      dy *= BLINK_RANGE / d;
    }
    const [tx, ty] = this.grid.nearestFit(u.x + dx, u.y + dy, u.r);
    this.ev({ k: 'blink', x1: round1(u.x), y1: round1(u.y), x2: round1(tx), y2: round1(ty) });
    u.x = tx;
    u.y = ty;
    u.stop();
    u.path = null;
  }

  stepBears(dt) {
    for (const b of this.bears) {
      if (b.atkCd > 0) b.atkCd -= dt;
      const region = this.grid.regionAt(b.x, b.y);
      if (!b.victim && !b.swing) {
        let best = null;
        let bd = Infinity;
        for (const u of this.heroes.values()) {
          if (!u.alive || u.finished) continue;
          const gap = dist(b.x, b.y, u.x, u.y) - b.r - u.r;
          if (gap <= ACQUIRE && gap < bd) {
            bd = gap;
            best = u;
          }
        }
        if (best) {
          b.victim = best;
          b.path = null;
          b.stop();
        }
      }
      if (b.victim || b.swing) {
        const v = b.victim;
        // A target that blinked out of this bear's lane is lost: back to patrol.
        const lost = !v || !v.alive || v.finished || this.grid.regionAt(v.x, v.y) !== region;
        const res = meleeStep(this, b, lost ? null : v, dt, BEAR_ATTACK, (t) => this.maul(b, t), false);
        if (res === 'idle' && lost) {
          b.victim = null;
          const p = b.patrol;
          pathTo(b, this.grid, p.leg ? p.bx : p.ax, p.leg ? p.by : p.ay);
        } else if (res === 'idle') {
          b.repath -= dt;
          if (b.repath <= 0 || !b.path) {
            b.repath = 0.3;
            pathTo(b, this.grid, v.x, v.y);
          }
        }
      } else if (!b.target && !b.path) {
        const p = b.patrol;
        p.leg = 1 - p.leg;
        pathTo(b, this.grid, p.leg ? p.bx : p.ax, p.leg ? p.by : p.ay);
      }
      followPath(b, this.grid);
    }
    stepUnits(this.bears, dt);
  }

  maul(b, u) {
    this.ev({ k: 'hit', x: round2(u.x), y: round2(u.y) });
    this.damage(u.owner, 21 + Math.floor(Math.random() * 5), 'death');
  }

  // ---------------------------------------------------------------- bots
  // The original bot orders a blink 512 u toward the finish +-90 degrees at
  // random every 0.5 s, which often kills it. Ours plans instead: a cost to
  // the finish for every cell, over walking steps and blink hops, and it
  // steers clear of the bears. Low-skill bots sometimes blink like the
  // original.
  buildBotField() {
    const G = this.grid;
    const n = G.rows * G.cols;
    const D = new Float32Array(n).fill(Infinity);
    const free = [];
    for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) if (!G.pathBlocked(c, r)) free.push([c, r]);
    const hop = 3.5; // blink hops of up to 448 u between cell centres
    const open = [];
    for (const [c, r] of free) if (G.chars[r][c] === 'F') {
      D[r * G.cols + c] = 0;
      open.push(r * G.cols + c);
    }
    // Plain Dijkstra (the grid is tiny).
    const done = new Uint8Array(n);
    for (;;) {
      let k = -1;
      let best = Infinity;
      for (const j of open) if (!done[j] && D[j] < best) {
        best = D[j];
        k = j;
      }
      if (k < 0) break;
      done[k] = 1;
      const c = k % G.cols;
      const r = (k - c) / G.cols;
      for (const [cc, rr] of free) {
        const j = rr * G.cols + cc;
        if (done[j]) continue;
        const dd = Math.hypot(cc - c, rr - r);
        let w = Infinity;
        if (dd === 1) w = 1;
        else if (dd <= hop) w = 1.6 + dd * 0.1;
        if (D[k] + w < D[j]) {
          if (D[j] === Infinity) open.push(j);
          D[j] = D[k] + w;
        }
      }
    }
    this.botD = D;
    this.botFree = free;
  }

  botThink(pid, u, mem) {
    const G = this.grid;
    const ab = this.abilities[0];
    const ready = (this.acd.get(pid)?.[0] || 0) <= 0;
    if (ready && Math.random() < 0.006 * (1 - mem.skill)) {
      // The original's blind blink toward the finish.
      const a = Math.atan2(this.goal.y - u.y, this.goal.x - u.x) + rand(-Math.PI / 2, Math.PI / 2);
      this.useAbility(pid, 0, u.x + Math.cos(a) * BLINK_RANGE, u.y + Math.sin(a) * BLINK_RANGE);
      return;
    }
    const [c, r] = G.cellOf(u.x, u.y);
    const here = G.inside(c, r) ? this.botD[r * G.cols + c] : Infinity;
    // Bears in the same segment, where they are and where they will be in 0.8 s.
    const danger = (x, y) => {
      let p = 0;
      const reg = G.regionAt(x, y);
      for (const b of this.bears) {
        if (G.regionAt(b.x, b.y) !== reg) continue;
        const d = Math.min(dist(b.x, b.y, x, y), dist(b.x + b.mx * 0.8, b.y + b.my * 0.8, x, y));
        if (d < wc3(330)) p += (wc3(330) - d) * 8;
      }
      return p;
    };
    // Standing still costs a little, so a bot only waits when every way on
    // is guarded, and more the longer it has waited, so it never waits for good.
    let best = null;
    let bestCost = here + danger(u.x, u.y) + 1.2 + (mem.wait || 0) * WAIT_COST;
    const myReg = G.regionAt(u.x, u.y);
    for (const [cc, rr] of this.botFree) {
      const [x, y] = G.centerOf(cc, rr);
      const d = dist(u.x, u.y, x, y);
      const base = this.botD[rr * G.cols + cc] + danger(x, y);
      if (G.regionAt(x, y) === myReg && d <= CELL * 1.6 && d > CELL * 0.4) {
        const cost = base + d / CELL;
        if (cost < bestCost) {
          bestCost = cost;
          best = { x, y, walk: true };
        }
      }
      if (ready && d <= BLINK_RANGE - 0.15) {
        const cost = base + 1.6;
        if (cost < bestCost) {
          bestCost = cost;
          best = { x, y, walk: false };
        }
      }
    }
    if (!best) {
      mem.wait = (mem.wait || 0) + 1;
      if (!u.target) this.moveTo(pid, ...G.centerOf(c, r));
      return;
    }
    mem.wait = 0;
    if (best.walk) {
      if (!u.target || dist(u.target.x, u.target.y, best.x, best.y) > 0.3) this.moveTo(pid, best.x, best.y);
    } else if (ab && ready) this.useAbility(pid, 0, best.x, best.y);
  }

  worldEnts() {
    const ents = this.bears.map((b) => creepSnap(b, 'polarbear'));
    ents.push({ id: this.circleId, k: 'powercircle', x: round2(this.goal.x), y: round2(this.goal.y), f: 0, s: 2 });
    return ents;
  }
}

// Pines and boulders outside the arena, a little way back from the edge.
function surrounds() {
  const props = [];
  for (let y = -HH - 3; y <= HH + 3; y += rand(1.4, 2.6)) {
    for (const s of [-1, 1]) {
      props.push({ t: 'tree', x: s * (HW + rand(3.5, 7)), y, s: rand(0.8, 1.4) });
      if (Math.random() < 0.4) props.push({ t: 'rock', x: s * (HW + rand(2, 3.5)), y: y + rand(-0.5, 0.5), s: rand(0.3, 0.7) });
    }
  }
  for (let x = -HW - 4; x <= HW + 4; x += rand(1.5, 2.5)) {
    for (const s of [-1, 1]) props.push({ t: 'tree', x, y: s * (HH + rand(3, 6)), s: rand(0.8, 1.4) });
  }
  return props;
}
