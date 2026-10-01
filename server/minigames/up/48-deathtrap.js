import { newId, rand, dist, wc3 } from '../../../engine/server/sim.js';
import { WalkGrid, GridRace, toServer, rectFromWc3, randIn } from './walkgrid.js';
import { treesAroundRect } from '../props.js';

// Uther Party 4.0 #48 "The Death Trap" (docs/uther-party/rules-4.0.md): a
// 2432x1280 grid of 6x3 solid 256x256 pillars with 128 u lanes between them.
// A spike sits in the middle of 40 of the 45 lane segments. Every standing
// spike kills anyone within 64 u (checked every 0.1 s). All spikes stand for
// the first 5 s; then every 2.5 s each one independently rises or drops,
// 50/50. Junctions have no spike and are safe. Forest trolls (speed 270,
// collision 7) start in the top-left or bottom-left corner and race to the
// circle on the east side. 90 s limit.
const CX = 6208;
const CY = -8320;
const conv = toServer(CX, CY);
const CELL = wc3(128);
const COLS = 19;
const ROWS = 10;
export const TROLL = { speed: wc3(270), r: wc3(7), hp: 300 };
export const KILL_R = wc3(64);
export const TICK = 0.1;
export const FIRST_TOGGLE = 5;
export const PERIOD = 2.5;
const BOT_SMART = 0.6;

// Lanes are the columns and rows divisible by 3; everything else is pillar.
export const LAYOUT = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => (c % 3 && r % 3 ? '#' : '.')).join(''));

// The 40 spikes, in WC3 coordinates: the middle of every lane segment except
// the ones beside the two starts and the finish segment.
export function spikeSpots() {
  const out = [];
  const skip = new Set(['5248,-7744', '5248,-8896', '5056,-7936', '5056,-8704', '7360,-8320']);
  for (const y of [-7744, -8128, -8512, -8896]) for (let k = 0; k < 6; k++) out.push([5248 + 384 * k, y]);
  for (let k = 0; k < 7; k++) for (const y of [-7936, -8320, -8704]) out.push([5056 + 384 * k, y]);
  return out.filter(([x, y]) => !skip.has(`${x},${y}`));
}

export class DeathTrap extends GridRace {
  static id = 'deathtrap';
  static name = 'The Death Trap';
  static desc = 'Reach the end! Cross a grid of stone pillars whose lanes are guarded by spikes. Every 2.5 seconds each spike rises or drops at random. Wait at the junctions and dash when the way ahead falls. A standing spike kills.';
  static controls = 'Right-click to move (you walk round the pillars). Junctions are safe; spikes are not.';
  static duration = 90;
  static ranking = 'race';

  setup() {
    const [x0, y0] = conv(4992, -7680);
    this.grid = new WalkGrid(LAYOUT, { cell: CELL, x0, y0, blocked: '#' });
    this.spikes = spikeSpots().map(([X, Y]) => {
      const [x, y] = conv(X, Y);
      return { x, y, up: true };
    });
    const HW = wc3(1216);
    const HH = wc3(640);
    this.map = {
      theme: 'dirt',
      floor: { shape: 'rect', w: HW * 2, h: HH * 2 },
      props: treesAroundRect(HW, HH, 0.4, 2.2),
      bounds: HW,
      build: ['upmaze'],
      maze: this.grid.snap({ style: 'pillar', h: 0.8 }), // low, so the spikes in the lanes show
      spikes: this.spikes.map((s) => [+s.x.toFixed(2), +s.y.toFixed(2)]),
    };
    this.finishRect = rectFromWc3(conv, 7296, -8384, 7424, -8256);
    this.goal = { x: (this.finishRect.x0 + this.finishRect.x1) / 2, y: (this.finishRect.y0 + this.finishRect.y1) / 2 };
    // Each troll starts in Death_Start_1 (top-left) or Death_Start_2 (bottom-left), facing east.
    const starts = [rectFromWc3(conv, 4992, -7808, 5120, -7680), rectFromWc3(conv, 4992, -8960, 5120, -8832)];
    this.spawnHeroes(
      this.pids.map(() => {
        const r = starts[Math.random() < 0.5 ? 0 : 1];
        const m = TROLL.r;
        return randIn({ x0: r.x0 + m, x1: r.x1 - m, y0: r.y0 + m, y1: r.y1 - m });
      }),
      { ...TROLL, facing: 0 },
    );
    for (const u of this.heroes.values()) u.skin = 'foresttroll';
    this.fieldId = newId();
    this.circleId = newId();
    this.killT = 0;
    // The toggle trigger is periodic from map init, so its first tick after
    // t=5 lands 0-2.5 s later.
    this.toggleT = FIRST_TOGGLE + rand(0, PERIOD);
    this.toggles = 0;
    this.botsGo();
  }

  tick(dt) {
    if (this.time >= this.toggleT) {
      this.toggleT += PERIOD;
      this.toggles++;
      for (const s of this.spikes) s.up = Math.random() < 0.5;
      this.ev({ k: 'sfx', s: 'smack' });
      this.botsGo();
    }
    this.stepRace(dt);
    for (const [pid, u] of this.heroes) if (u.alive && !u.finished && this.inRect(u, this.finishRect)) this.finish(pid);
    this.killT -= dt;
    if (this.killT <= 0) {
      this.killT += TICK;
      for (const [pid, u] of this.heroes) {
        if (!u.alive || u.finished) continue;
        if (this.spikes.some((s) => s.up && dist(s.x, s.y, u.x, u.y) <= KILL_R)) this.eliminate(pid, 'spiked');
      }
      // Bots stop whenever any standing spike is within 160 u. Skilled bots
      // instead hop from junction to junction, entering a lane only when its
      // spike is down and they can clear it before the next shift.
      for (const [pid, b] of this.bots) {
        const u = this.heroes.get(pid);
        if (!u?.alive || u.finished) continue;
        if (b.mem.skill >= BOT_SMART) {
          this.junctionBot(pid, u, b.mem);
          continue;
        }
        if (this.spikes.some((s) => s.up && dist(s.x, s.y, u.x, u.y) <= wc3(160))) {
          u.stop();
          u.path = null;
        }
      }
    }
  }

  // At the start and after every toggle, bots are ordered to the finish.
  botsGo() {
    for (const [pid, b] of this.bots) if (b.mem.skill < BOT_SMART) this.moveTo(pid, this.goal.x, this.goal.y);
  }

  // The lane junctions (every third cell both ways), their links, the spike
  // on each link, and each junction's hop count to the finish.
  junctions() {
    if (this.jn) return this.jn;
    const G = this.grid;
    const nodes = [];
    for (let r = 0; r < ROWS; r += 3) for (let c = 0; c < COLS; c += 3) nodes.push({ c, r, x: G.centerOf(c, r)[0], y: G.centerOf(c, r)[1], links: [], d: Infinity });
    const at = (c, r) => nodes.find((n) => n.c === c && n.r === r);
    for (const n of nodes) {
      for (const [dc, dr] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) {
        const m = at(n.c + dc, n.r + dr);
        if (!m) continue;
        const mx = (n.x + m.x) / 2;
        const my = (n.y + m.y) / 2;
        const spike = this.spikes.find((q) => dist(q.x, q.y, mx, my) < 0.5) || null;
        const goal = dist(mx, my, this.goal.x, this.goal.y) < 0.5;
        n.links.push({ to: m, spike, goal });
      }
    }
    const queue = nodes.filter((n) => n.links.some((l) => l.goal));
    for (const n of queue) n.d = 0;
    while (queue.length) {
      const n = queue.shift();
      for (const l of n.links) if (l.to.d > n.d + 1) {
        l.to.d = n.d + 1;
        queue.push(l.to);
      }
    }
    this.jn = nodes;
    return nodes;
  }

  junctionBot(pid, u, mem) {
    const nodes = this.junctions();
    const left = this.toggleT - this.time;
    if (mem.final) {
      if (!u.target) this.moveTo(pid, this.goal.x, this.goal.y);
      return;
    }
    if (mem.dest) {
      if (dist(u.x, u.y, mem.dest.x, mem.dest.y) > 0.3) {
        if (!u.target) this.moveTo(pid, mem.dest.x, mem.dest.y);
        return;
      }
      mem.at = mem.dest;
      mem.dest = null;
    }
    let here = mem.at;
    if (!here || dist(u.x, u.y, here.x, here.y) > 0.6) {
      here = nodes.reduce((a, n) => (dist(n.x, n.y, u.x, u.y) < dist(a.x, a.y, u.x, u.y) ? n : a));
      if (dist(u.x, u.y, here.x, here.y) > 0.3) {
        mem.dest = here;
        this.moveTo(pid, here.x, here.y);
        return;
      }
      mem.at = here;
    }
    const goalLink = here.links.find((l) => l.goal);
    if (goalLink) {
      mem.final = true;
      this.moveTo(pid, this.goal.x, this.goal.y);
      return;
    }
    let best = null;
    for (const l of here.links) {
      if (l.to.d >= here.d) continue;
      const need = dist(here.x, here.y, l.to.x, l.to.y) / u.speed + 0.35;
      if (l.spike && (l.spike.up || (left < need && this.time >= FIRST_TOGGLE - 1))) continue;
      if (l.spike && this.time < FIRST_TOGGLE) continue;
      if (!best || l.to.d < best.d) best = l.to;
    }
    if (best) {
      mem.dest = best;
      this.moveTo(pid, best.x, best.y);
    } else if (u.target) {
      u.stop();
      u.path = null;
    }
  }

  hud() {
    const next = this.toggleT - this.time;
    return { label: this.time < FIRST_TOGGLE ? `Spikes start moving in ${Math.ceil(FIRST_TOGGLE - this.time)}` : `Spikes shift in ${next.toFixed(1)} s` };
  }

  worldEnts() {
    return [
      { id: this.fieldId, k: 'spikefield', x: 0, y: 0, f: 0, up: this.spikes.map((s) => (s.up ? 1 : 0)).join(''), n: this.toggles },
      { id: this.circleId, k: 'powercircle', x: +this.goal.x.toFixed(2), y: +this.goal.y.toFixed(2), f: 0, s: 1 },
    ];
  }
}
