import { Minigame } from '../../base.js';
import { newId, rand, dist, clamp, round2, wc3 } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';
import { pushOutRect, box, arrive, withoutGone, raceLabel } from './race-kit.js';

// Uther Party 4.0 #7 "Roadkill Challenge" (docs/uther-party/rules-4.0.md): a
// Frogger race round a U-shaped course. A 3-tile wall splits the 1920x1536
// arena into a left and a right half joined only across the top strip; you
// run north up the left half, east along the top and south down the right
// half to the Circle of Power. Eight Siege Engines patrol horizontal lanes at
// 220-340 u/s with no collision, and anything within 128 u of one (centre to
// centre, checked every 0.05 s) dies at once. Race: 8, 7, 6 ... for finishers,
// 0 for the dead and for anyone still running when the 90 s timer ends.
//
// Coordinates: WC3 (x, y) maps to (wc3(x - 576), -wc3(y + 768)), so north is
// up on screen as in the original.

const CX = 576;
const CY = -768;
export const P = (x, y) => [wc3(x - CX), -wc3(y - CY)];
const HW = wc3(960);
const HH = wc3(768);
export const KILL_R = wc3(128);
const CHECK = 0.05;

// Unwalkable blocks (WC3 rects x0, y0, x1, y1): the dividing wall and the two
// cliff corners at the top of the arena image.
const BLOCKS_WC3 = [
  [384, -1600, 768, -256],
  [-384, -128, -128, 0],
  [1408, -256, 1536, 0],
];
const BLOCKS = BLOCKS_WC3.map(([x0, y0, x1, y1]) => box(...P(x0, y0), ...P(x1, y1)));

// The patrol table: lane y, first patrol point, second patrol point, speed.
export const LANES = [
  [-1216, 320, -320, 220],
  [-832, 320, -320, 280],
  [-448, 320, -320, 340],
  [-448, 832, 1472, 260],
  [-576, 1472, 832, 260],
  [-960, 832, 1472, 280],
  [-1088, 1472, 832, 280],
  [-1216, 832, 1472, 280],
];

const FINISH = P(1152, -1408);
const FINISH_HALF = wc3(64);

// Where a bot can stand with no car able to reach it, in route order (WC3 y
// on each side; the top strip is the bend). Crossings are made near the ends
// of the patrols, where a car spends least time: x ±300 on the left, x 800 or
// 1504 (against the walls) on the right. Straight down the middle of the
// right-hand trio there is never a gap wide enough.
const LEFT_STOPS = [-1024, -640, -200];
const RIGHT_STOPS = [-288, -768, -1380];

export class Roadkill extends Minigame {
  static id = 'roadkill';
  static name = 'Roadkill Challenge';
  static desc = 'Reach the end! Run north up the left side, across the top and down the right side to the circle, through lanes of patrolling siege engines. Anything that comes near an engine is flattened. First home scores most.';
  static controls = 'Right-click to move, S to stop. Time your crossings: a siege engine kills anyone within about 2 tiles. Other runners block you.';
  static duration = 90;
  static ranking = 'race';

  setup() {
    this.map = {
      theme: 'grass',
      floor: { shape: 'rect', w: HW * 2, h: HH * 2 },
      props: treesAroundRect(HW, HH, 0.4, 2.2),
      build: ['roadkill'],
      rk: { blocks: BLOCKS.map((b) => [b.x0, b.y0, b.x1, b.y1].map(round2)), lanes: LANES.map(([y, a, b]) => [round2(P(0, y)[1]), round2(P(Math.min(a, b), 0)[0]), round2(P(Math.max(a, b), 0)[0])]), finish: FINISH.map(round2), start: [P(-384, -1536), P(384, -1408)].map((p) => p.map(round2)) },
      bounds: HW + 2,
    };
    // Murloc Tiderunners: speed 270, collision 31 (a paladin's), anywhere in the
    // 768x128 start strip, facing north.
    this.spawnHeroes(
      this.pids.map(() => P(rand(-384 + 40, 384 - 40), rand(-1536 + 36, -1408 - 4))),
      { facing: -Math.PI / 2 },
    );
    for (const u of this.heroes.values()) u.skin = 'murloc';
    this.cars = LANES.map(([y, a, b, sp]) => {
      const [x0] = P(a, y);
      const [x1, yy] = P(b, y);
      return { id: newId(), x: x0, y: yy, a: x0, b: x1, dir: Math.sign(x1 - x0), speed: wc3(sp), lo: Math.min(x0, x1), hi: Math.max(x0, x1) };
    });
    this.acc = 0;
    this.copId = newId();
  }

  // Where a car will be `t` seconds from now (patrol ping-pong).
  carAt(c, t) {
    const len = c.hi - c.lo;
    // Distance travelled from the low end along the loop lo -> hi -> lo.
    let s = (c.dir > 0 ? c.x - c.lo : 2 * len - (c.x - c.lo)) + c.speed * t;
    s %= 2 * len;
    return [s <= len ? c.lo + s : c.hi - (s - len), c.y];
  }

  tick(dt) {
    for (const c of this.cars) {
      c.x += c.dir * c.speed * dt;
      if (c.x >= c.hi) {
        c.x = c.hi - (c.x - c.hi);
        c.dir = -1;
      } else if (c.x <= c.lo) {
        c.x = c.lo + (c.lo - c.x);
        c.dir = 1;
      }
    }
    this.stepHeroes(dt);
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.finished) continue;
      u.x = clamp(u.x, -HW + u.r, HW - u.r);
      u.y = clamp(u.y, -HH + u.r, HH - u.r);
      for (const b of BLOCKS) pushOutRect(u, b);
      if (Math.abs(u.x - FINISH[0]) <= FINISH_HALF && Math.abs(u.y - FINISH[1]) <= FINISH_HALF) arrive(this, pid);
    }
    // Roadkill Death, every 0.05 s.
    this.acc += dt;
    while (this.acc >= CHECK) {
      this.acc -= CHECK;
      for (const [pid, u] of this.heroes) {
        if (!u.alive || u.finished) continue;
        if (this.cars.some((c) => dist(u.x, u.y, c.x, c.y) <= KILL_R)) this.eliminate(pid, 'squish');
      }
    }
  }

  progress(pid) {
    const u = this.heroes.get(pid);
    const [, top] = P(0, -128);
    // Distance along the U: up the left, across, down the right.
    if (u.x < BLOCKS[0].x0 && u.y > top) return HH - u.y;
    if (u.y <= top) return HH * 2 + (u.x + HW);
    return HH * 4 + HW * 2 + (u.y - top);
  }

  // Would a unit standing at (x, y) after `t` seconds be clear of every car?
  clearAt(x, y, t, margin) {
    for (const c of this.cars) {
      const [cx, cy] = this.carAt(c, t);
      if (Math.abs(cy - y) > KILL_R + margin) continue;
      if (dist(x, y, cx, cy) <= KILL_R + margin) return false;
    }
    return true;
  }

  // The original's computer murlocs get one move to the finish at 4 s and
  // nothing else, so most of them die. Ours walk the same route but hop
  // between the spots no car can reach and cross only when the whole gap is
  // clear. Clumsier bots sometimes go without looking, as the originals do.
  botThink(pid, u, mem) {
    if (this.time < 4) return;
    if (!mem.route) {
      const lx = P(u.x < P(0, 0)[0] ? -300 + rand(0, 40) : 300 - rand(0, 40), 0)[0];
      const rx = P(Math.random() < 0.5 ? 800 + rand(0, 16) : 1504 - rand(0, 16), 0)[0];
      mem.route = [...LEFT_STOPS.map((y) => [lx, P(0, y)[1]]), [Math.min(rx, P(1350, 0)[0]), P(0, -200)[1]], ...RIGHT_STOPS.map((y) => [rx, P(0, y)[1]]), [...FINISH]];
      mem.i = 0;
    }
    let [tx, ty] = mem.route[mem.i];
    if (dist(u.x, u.y, tx, ty) < 0.5 && mem.i < mem.route.length - 1) {
      mem.i++;
      mem.go = false;
      mem.careless = undefined;
      [tx, ty] = mem.route[mem.i];
    }
    const d = dist(u.x, u.y, tx, ty);
    const T = d / u.speed;
    const margin = 0.25 + 0.35 * mem.skill;
    if (!mem.go) {
      // Look before crossing: every point of the walk must be clear when we get there.
      let ok = true;
      for (let t = 0; t <= T + 0.15 && ok; t += 0.05) {
        const k = Math.min(1, t / Math.max(T, 1e-3));
        const px = u.x + (tx - u.x) * k;
        const py = u.y + (ty - u.y) * k;
        // Robust to setting off a little early or late (turning, a crowd).
        ok = this.clearAt(px, py, t, margin) && this.clearAt(px, py, t + 0.12, margin) && this.clearAt(px, py, t + 0.25, margin);
      }
      // Decided once per crossing: a careless bot just goes.
      mem.careless ??= Math.random() < (1 - mem.skill) * 0.3;
      if (!ok && !mem.careless) {
        if (u.target) u.stop();
        return;
      }
      mem.go = true;
    }
    if (u.target) u.steer(tx, ty);
    else u.order(tx, ty);
  }

  heroEnts(pid) {
    return withoutGone(this, super.heroEnts(pid));
  }

  worldEnts() {
    const ents = this.cars.map((c) => ({ id: c.id, k: 'siegeengine', x: round2(c.x), y: round2(c.y), f: c.dir > 0 ? 0 : 3.14, mv: 1 }));
    ents.push({ id: this.copId, k: 'cop', x: round2(FINISH[0]), y: round2(FINISH[1]), s: 1, r: 1.25 });
    return ents;
  }

  hud(pid) {
    return { label: raceLabel(this, pid) };
  }
}
