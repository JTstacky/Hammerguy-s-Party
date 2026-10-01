import { newId, rand, dist, round2, wc3, collideUnits, stepUnits, pick } from '../../../engine/server/sim.js';
import { WalkGrid, GridRace, creep, meleeStep, creepSnap, pathTo, followPath } from './walkgrid.js';

// Uther Party 4.0 #32 "Minotaur Maze" (docs/uther-party/rules-4.0.md): a
// 1408x1408 maze of short walls on a 64 u grid, with no dead ends. Everyone
// starts at the centre as a skink (speed 200, 15 HP, collision 15). Four
// minotaurs (speed 270, collision 16, attack and acquisition range 64, one hit
// kills) start in the corners and, from t=4 and then every 10 s, patrol to a
// random point of the maze. One Shimmerweed is on the field at a time: the
// first appears at t=4, 640 u from the centre; whoever grabs it finishes
// (8, 7, 6 ...) and the next one appears at a random spot. 180 s limit.
//
// Deviation: the original can drop the respawned weed inside a wall cell
// (engine-dependent); here it is moved to the nearest walkable spot.
export const MAZE = [
  '########################',
  '#M..#.................M#',
  '#.#.#.######.#########.#',
  '#.#...#............#...#',
  '#.#####.########.#.#.###',
  '#.#.....#........#.#...#',
  '#.#.#####.########.#.#.#',
  '#.#.....#.#........#.#.#',
  '#.###.#.#.#.##.#####.#.#',
  '#.....#...#..#.......#.#',
  '###.###.####.#####.#.#.#',
  '#.....#.#...S#...#.#.#.#',
  '#.#.#.#...#....#...#...#',
  '#.#.#.###.#.########.###',
  '#.#.#.#...#..#.........#',
  '#.#.#.#.####.#.#######.#',
  '#.#.#...#......#.....#.#',
  '#.#.#.#.#.######.###.#.#',
  '#.#...#.#..........#...#',
  '#.#####.##########.#.###',
  '#.#.....#..........#...#',
  '#.#.#.###.#.##########.#',
  '#M..#.....#...........M#',
  '########################',
];
const CELL = wc3(64);
const HALF = wc3(704); // the arena rect is 1408 x 1408
const EDGE = wc3(768); // the boundary ring lies just outside it
export const SKINK = { speed: wc3(200), r: wc3(15), hp: 15 };
export const MINO = { speed: wc3(270), r: wc3(16), hp: 1300 };
export const MINO_ATTACK = { range: wc3(64), cd: 1.9, point: 0.3 };
export const ACQUIRE = wc3(64);
export const PICKUP = wc3(64);
export const FIRST_WEED_R = wc3(640);
export const PATROL_EVERY = 10;
export const START = 4;
const BOT_SMART = 0.6;

export class MinotaurMaze extends GridRace {
  static id = 'minotaur';
  static name = 'Minotaur Maze';
  static desc = 'Claim the Shimmerweed! Everyone starts in the middle of a stone maze as a little skink. One weed is out at a time: grab it to finish, and the next one sprouts somewhere else. Four minotaurs roam the halls, faster than you, and one hit kills.';
  static controls = 'Right-click to move (you walk round the walls). Walk over the Shimmerweed to claim it.';
  static duration = 180;
  static ranking = 'race';

  setup() {
    this.grid = new WalkGrid(MAZE, { cell: CELL, x0: -EDGE, y0: -EDGE, blocked: '#' });
    this.map = {
      theme: 'grass',
      floor: { shape: 'rect', w: EDGE * 2, h: EDGE * 2 },
      props: mazeSurrounds(),
      bounds: EDGE - 2,
      build: ['upmaze'],
      maze: this.grid.snap({ style: 'stone', h: 1.25 }),
    };
    // Skinks are created within 8 u of the centre.
    this.spawnHeroes(
      this.pids.map(() => {
        const a = rand(0, Math.PI * 2);
        const r = wc3(rand(0, 8));
        return [Math.cos(a) * r, Math.sin(a) * r];
      }),
      { ...SKINK, facing: -Math.PI / 2 },
    );
    for (const u of this.heroes.values()) u.skin = 'skink';
    const c = wc3(672);
    this.minos = [[-c, -c], [c, -c], [-c, c], [c, c]].map(([x, y]) => {
      const m = creep('minotaur', x, y, { ...MINO, facing: Math.atan2(-y, -x) });
      m.patrol = null;
      m.victim = null;
      m.repath = 0;
      return m;
    });
    this.weed = null;
    this.claimed = 0;
    this.patrolT = START;
    this.goal = { x: 0, y: 0 };
  }

  tick(dt) {
    if (this.time >= START && !this.weed && this.claimed === 0 && !this.firstWeed) {
      this.firstWeed = true;
      const a = rand(0, Math.PI * 2);
      this.placeWeed(Math.cos(a) * FIRST_WEED_R, Math.sin(a) * FIRST_WEED_R);
    }
    if (this.time >= START) {
      this.patrolT -= dt;
      if (this.patrolT <= 0) {
        this.patrolT += PATROL_EVERY;
        for (const m of this.minos) this.patrolFrom(m);
      }
    }
    this.stepRace(dt);
    this.stepMinos(dt);
    const all = [...this.heroes.values(), ...this.minos];
    collideUnits(all);
    for (const u of all) if (u.alive && !u.finished) this.grid.push(u);

    if (this.weed) {
      for (const [pid, u] of this.heroes) {
        if (!u.alive || u.finished || !this.weed) continue;
        if (dist(u.x, u.y, this.weed.x, this.weed.y) <= PICKUP) this.claim(pid, u);
      }
    }
    if (this.weed) this.goal = this.weed;
  }

  placeWeed(x, y) {
    const [wx, wy] = this.grid.nearestFit(x, y, SKINK.r);
    this.weed = { id: newId(), x: wx, y: wy };
    this.ev({ k: 'weedup', x: round2(wx), y: round2(wy) });
  }

  claim(pid, u) {
    const w = this.weed;
    this.ev({ k: 'weedgrab', x: round2(w.x), y: round2(w.y) });
    this.claimed++;
    // The next weed is created at a random point anywhere in the maze rect.
    this.placeWeed(rand(-HALF, HALF), rand(-HALF, HALF));
    this.finish(pid);
  }

  // A patrol order: back and forth between here and a random point of the maze.
  patrolFrom(m) {
    const [bx, by] = this.grid.nearestFit(rand(-HALF, HALF), rand(-HALF, HALF), m.r);
    m.patrol = { ax: m.x, ay: m.y, bx, by, leg: 1 };
    m.victim = null;
    m.swing = null;
    pathTo(m, this.grid, bx, by);
  }

  stepMinos(dt) {
    for (const m of this.minos) {
      if (m.atkCd > 0) m.atkCd -= dt;
      // Acquire any skink within 64 u (edge to edge).
      if (!m.victim) {
        let best = null;
        let bd = Infinity;
        for (const u of this.heroes.values()) {
          if (!u.alive || u.finished) continue;
          const gap = dist(m.x, m.y, u.x, u.y) - m.r - u.r;
          if (gap <= ACQUIRE && gap < bd) {
            bd = gap;
            best = u;
          }
        }
        if (best) {
          m.victim = best;
          m.path = null;
          m.stop();
        }
      }
      if (m.victim || m.swing) {
        const v = m.victim;
        const res = meleeStep(this, m, v, dt, MINO_ATTACK, (t) => this.gore(m, t), false);
        if (res === 'idle' && (!v || !v.alive || v.finished)) {
          m.victim = null;
          if (m.patrol) pathTo(m, this.grid, m.patrol.leg ? m.patrol.bx : m.patrol.ax, m.patrol.leg ? m.patrol.by : m.patrol.ay);
        } else if (res === 'idle' && v) {
          // Chase round the walls (the creeps never give up: GuardDistance 10000).
          m.repath -= dt;
          if (m.repath <= 0 || !m.path) {
            m.repath = 0.3;
            pathTo(m, this.grid, v.x, v.y);
          }
        }
      } else if (m.patrol && !m.target && !m.path) {
        m.patrol.leg = 1 - m.patrol.leg;
        const p = m.patrol;
        pathTo(m, this.grid, p.leg ? p.bx : p.ax, p.leg ? p.by : p.ay);
      }
      followPath(m, this.grid);
    }
    stepUnits(this.minos, dt);
  }

  gore(m, u) {
    this.ev({ k: 'hit', x: round2(u.x), y: round2(u.y) });
    this.damage(u.owner, 30 + Math.floor(Math.random() * 7), 'death');
  }

  // The original AI, every 1 s: with no minotaur within 400, head for the
  // weed; otherwise move 256 u straight away from a random one within 400.
  botThink(pid, u, mem) {
    mem.t = (mem.t ?? rand(0, 1)) - 0.25;
    if (mem.t > 0 || this.time < START) return;
    // Skilled bots look again every 0.5 s and take the way to the weed that
    // keeps clear of every minotaur (where it is and where it is heading).
    mem.t = mem.skill >= BOT_SMART ? 0.5 : 1;
    if (mem.skill >= BOT_SMART && this.weed && this.safeWay(u, this.weed)) return;
    const near = this.minos.filter((m) => dist(m.x, m.y, u.x, u.y) <= wc3(400));
    if (!near.length) {
      if (this.weed) this.moveTo(pid, this.weed.x, this.weed.y);
      return;
    }
    const m = pick(near);
    const d = dist(m.x, m.y, u.x, u.y) || 0.01;
    this.moveTo(pid, u.x + ((u.x - m.x) / d) * wc3(256), u.y + ((u.y - m.y) / d) * wc3(256));
  }

  // Where a minotaur will be in t seconds along its current route.
  minoAt(m, t) {
    const pts = [];
    if (m.target) pts.push(m.target);
    if (m.path) pts.push(...m.path);
    let x = m.x;
    let y = m.y;
    let left = m.speed * t;
    for (const q of pts) {
      const d = dist(x, y, q.x, q.y);
      if (d >= left) return [x + ((q.x - x) * left) / d, y + ((q.y - y) * left) / d];
      left -= d;
      x = q.x;
      y = q.y;
    }
    return [x, y];
  }

  safeWay(u, goal) {
    const G = this.grid;
    const R = MINO.r + SKINK.r + MINO_ATTACK.range + wc3(20);
    const ahead = 1.5;
    const spots = this.minos.flatMap((m) => {
      const out = [[m.x, m.y]];
      for (let t = 0.25; t <= ahead; t += 0.25) out.push(this.minoAt(m, t));
      return out;
    });
    const lines = G.chars.map((row, r) => [...row].map((ch, c) => {
      if (G.blocked(c, r)) return '#';
      const [x, y] = G.centerOf(c, r);
      if (dist(x, y, u.x, u.y) < G.s) return '.';
      return spots.some(([mx, my]) => dist(mx, my, x, y) < R) ? '#' : '.';
    }).join(''));
    const D = new WalkGrid(lines, { cell: G.s, x0: G.x0, y0: G.y0, blocked: '#' });
    const way = D.path(u.x, u.y, goal.x, goal.y, u.r);
    const last = way[way.length - 1];
    if (!last || dist(last.x, last.y, goal.x, goal.y) > 0.3) return false;
    const first = way.shift();
    u.path = way;
    u.pathGrid = D;
    u.pendingMove = null;
    if (u.target) u.steer(first.x, first.y);
    else u.order(first.x, first.y);
    return true;
  }

  hud() {
    return { label: this.weed ? `Shimmerweed claimed: ${this.claimed}` : 'The Shimmerweed sprouts at 0:04' };
  }

  worldEnts() {
    const ents = this.minos.map((m) => creepSnap(m, 'minotaur'));
    if (this.weed) ents.push({ id: this.weed.id, k: 'shimmerweed', x: round2(this.weed.x), y: round2(this.weed.y), f: 0 });
    return ents;
  }
}

// Outside the boundary wall: a scatter of trees and rocks.
function mazeSurrounds() {
  const props = [];
  const R = EDGE + 1.2;
  for (let i = 0; i < 44; i++) {
    const side = i % 4;
    const t = rand(-R - 2, R + 2);
    const out = R + rand(0.5, 4.5);
    const [x, y] = [[t, -out], [t, out], [-out, t], [out, t]][side];
    props.push({ t: Math.random() < 0.75 ? 'tree' : 'rock', x, y, s: rand(0.7, 1.3) });
  }
  return props;
}
