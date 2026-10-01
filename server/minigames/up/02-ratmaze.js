import { Minigame } from '../../base.js';
import { rand, dist, round2, wc3, collideUnits, stepUnits, newId } from '../../../engine/server/sim.js';
import { TileGrid, followGrid, planRoute } from './lib-f-grid.js';
import { makeMob, meleeTick, nearest, mobSnap } from './lib-f-mob.js';

// Uther Party 4.0 #2 "The Rat Maze" (docs/uther-party/rules-4.0.md).
//  - The exact 19x19 maze of 128 u corridors and 2-tile walls, with eight
//    edge starts (one per player slot, each with its Circle of Power) and the
//    cheese in the centre.
//  - Rats: 15 HP, speed 270, collision 7; 190 while carrying the cheese.
//    Walking over the cheese picks it up (in WC3 you right-click the item;
//    computer rats are handed it within 72 u, and here everyone is).
//  - 5 spiders start on the cheese (centre and +-128 u on each axis). At 4 s
//    and every 10 s after, each is ordered to patrol to a uniform random
//    point of the maze. On patrol they bite any rat within 275 u: speed 270,
//    range 100, cooldown 1.35, 15-16.5 damage after armour, so one bite
//    kills. The map's GuardDistance of 10000 means a chase lasts until the
//    next patrol order.
//  - Winner-take-all: "Rat Finish" empties the contestant list before
//    scoring, so the first rat home (within 100 u of its own start) with the
//    cheese scores 8 and the game ends; everyone else scores 0. At 120 s
//    every rat dies and nobody scores; if every rat dies it is a draw too.
//    (A race with done = true after the first finish; base payouts do the rest.)
export const MAZE = [
  '...1...##......6...',
  '.#####.##.########.',
  '.#####.##.########.',
  '5##.............##2',
  '.##.########.##.##.',
  '.##.########.##.##.',
  '.##....##....##....',
  '.##.##.##.#####.###',
  '.##.##.##.#####.###',
  '....##...C...##....',
  '###.#####.##.##.##.',
  '###.#####.##.##.##.',
  '....##....##....##.',
  '.##.##.########.##.',
  '.##.##.########.##.',
  '4##.............##7',
  '.########.##.#####.',
  '.########.##.#####.',
  '...8......##...3...',
];
export const T = wc3(128);
export const RAT = { hp: 15, speed: wc3(270), carry: wc3(190), r: wc3(7) };
export const SPIDER = { hp: 200, speed: wc3(270), r: wc3(15), acq: wc3(275), range: wc3(100), cd: 1.35, point: 0.5 };
const PICKUP = wc3(72);
const HOME = wc3(100);

export class RatMaze extends Minigame {
  static id = 'ratmaze';
  static name = 'The Rat Maze';
  static desc = 'Get the cheese, and return to your circle! Spiders guard the centre, then patrol the maze, and one bite kills. The cheese slows you down. The first rat home with it wins everything.';
  static controls = 'Right-click to move (rats find their own way round the walls). Walk over the cheese to pick it up, then get back to your circle.';
  static duration = 120;
  static ranking = 'race';
  static canDraw = true; // a timeout or every rat dying is a draw in the original

  setup() {
    this.grid = new TileGrid(MAZE, T);
    const half = (MAZE.length * T) / 2;
    this.map = {
      theme: 'dirt',
      floor: { shape: 'rect', w: half * 2, h: half * 2 },
      props: [],
      bounds: half - 6,
      build: ['ratmaze'],
      maze: MAZE,
      T: round2(T),
    };
    this.starts = [];
    for (let k = 1; k <= 8; k++) {
      MAZE.forEach((row, r) => {
        const c = row.indexOf(String(k));
        if (c >= 0) this.starts[k - 1] = this.grid.center(c, r);
      });
    }
    const home = this.pids.map((_, i) => this.starts[i % 8]);
    this.home = new Map(this.pids.map((p, i) => [p, home[i]]));
    this.spawnHeroes(home, { hp: RAT.hp, speed: RAT.speed, r: RAT.r, regen: 0.5 });
    for (const [pid, u] of this.heroes) {
      u.skin = 'rat';
      const [hx, hy] = this.home.get(pid);
      u.setFacing(Math.atan2(-hy, -hx));
    }
    const [cx, cy] = this.grid.center(9, 9);
    this.cheese = { id: newId(), x: cx, y: cy, carrier: null, lx: cx, ly: cy };
    this.circles = new Map(this.pids.map((p) => [p, newId()]));
    this.spiders = [[0, 0], [T, 0], [-T, 0], [0, T], [0, -T]].map(([dx, dy]) =>
      makeMob('spider', cx + dx, cy + dy, { speed: SPIDER.speed, r: SPIDER.r, hp: SPIDER.hp, acq: SPIDER.acq, range: SPIDER.range, cd: SPIDER.cd, point: SPIDER.point }),
    );
    for (const s of this.spiders) s.setFacing(rand(-Math.PI, Math.PI));
    this.patrolT = 4;
  }

  // "Rat Patrol": a patrol order to a uniform random point in the maze rect.
  patrol() {
    const half = (MAZE.length * T) / 2;
    for (const s of this.spiders) {
      s.tgt = null;
      s.patrol = [{ x: s.x, y: s.y }, { x: rand(-half, half), y: rand(-half, half) }];
      s.leg = 1;
      s.order(s.patrol[1].x, s.patrol[1].y);
    }
  }

  tick(dt) {
    this.patrolT -= dt;
    if (this.patrolT <= 0) {
      this.patrolT += 10;
      this.patrol();
    }
    const rats = [...this.heroes.values()].filter((u) => u.alive && !u.finished);
    for (const s of this.spiders) this.stepSpider(s, rats, dt);
    for (const s of this.spiders) followGrid(s, this.grid, dt, false);
    for (const u of this.heroes.values()) followGrid(u, this.grid, dt);
    stepUnits(this.spiders, dt);
    this.stepHeroes(dt);
    collideUnits([...this.heroes.values(), ...this.spiders]);
    for (const u of [...this.heroes.values(), ...this.spiders]) if (u.alive) this.grid.collide(u);

    const ch = this.cheese;
    if (ch.carrier != null) {
      const u = this.heroes.get(ch.carrier);
      ch.x = u.x;
      ch.y = u.y;
      const [hx, hy] = this.home.get(ch.carrier);
      if (dist(u.x, u.y, hx, hy) <= HOME) this.ratHome(ch.carrier);
    } else {
      for (const [pid, u] of this.heroes) {
        if (!u.alive || u.finished || dist(u.x, u.y, ch.x, ch.y) > PICKUP) continue;
        ch.carrier = pid;
        u.speed = RAT.carry;
        this.ev({ k: 'sfx', s: 'coin' });
        this.ev({ k: 'txt', x: round2(u.x), y: round2(u.y), s: 'Cheese!', c: '#ffe066' });
        break;
      }
    }
  }

  // Idle or patrolling, a spider acquires the nearest rat within 275 u and
  // chases it round the walls.
  stepSpider(s, rats, dt) {
    if (s.tgt && (!s.tgt.alive || s.tgt.finished)) s.tgt = null;
    if (!s.tgt) {
      const t = nearest(s, rats, s.acq);
      if (t) s.tgt = t;
    }
    if (s.tgt) {
      const busy = meleeTick(s, dt, (t) => this.bite(t));
      if (!busy) {
        s.chaseT = (s.chaseT || 0) - dt;
        if (!s.target || s.chaseT <= 0) {
          s.chaseT = 0.25;
          s.steer(s.tgt.x, s.tgt.y);
        }
      }
      return;
    }
    if (s.swing) return void meleeTick(s, dt, (t) => this.bite(t));
    // Patrol back and forth between the two points.
    if (s.patrol && !s.target) {
      s.leg = 1 - s.leg;
      const p = s.patrol[s.leg];
      s.order(p.x, p.y);
    }
  }

  bite(t) {
    const pid = t.owner;
    this.ev({ k: 'hit', x: round2(t.x), y: round2(t.y) });
    // Bite 10-11 normal damage, x1.5 against the rat's medium armour.
    this.damage(pid, (10 + Math.floor(Math.random() * 2)) * 1.5, 'death');
    if (!t.alive) this.ratDied(pid);
  }

  ratDied(pid) {
    const ch = this.cheese;
    if (ch.carrier === pid) {
      ch.carrier = null;
      ch.lx = ch.x;
      ch.ly = ch.y;
      this.ev({ k: 'txt', x: round2(ch.x), y: round2(ch.y), s: 'Cheese dropped', c: '#ffe066' });
    }
    this.circles.delete(pid);
  }

  ratHome(pid) {
    this.finish(pid);
    this.done = true; // winner-take-all
    this.cheese.carrier = null;
    this.party.msg(`${this.party.room.nameOf(pid)} brought the cheese home!`, this.party.room.colorOf(pid));
  }

  // Computer rats. The original's (from 4 s, every 1 s: with no spider
  // within 600 go for the cheese's item location, otherwise run home; with
  // the cheese, go home) almost never gets a rat home with five spiders
  // about, so ours plan round the spiders instead:
  //  - every 0.5 s, a path to the cheese (or home with it) that keeps clear
  //    of the spiders' bite zones;
  //  - while that path would pass a spider, wait out of its reach;
  //  - chased, run to the nearby cell the spider is farthest behind on.
  botThink(pid, u, mem) {
    if (this.time < 4 || this.time < (mem.next ?? 0)) return;
    const spiders = this.spiders;
    const close = spiders.filter((s) => s.tgt === u || dist(u.x, u.y, s.x, s.y) < wc3(420));
    mem.next = this.time + (close.length ? 0.2 : 0.5);
    if (close.length) return this.botFlee(u, close);
    const g = this.grid;
    const [hx, hy] = this.home.get(pid);
    const ch = this.cheese;
    const carrying = ch.carrier === pid;
    const near = wc3(carrying ? 420 : 340);
    const far = wc3(650);
    const cost = (c, r) => {
      const [x, y] = g.center(c, r);
      let k = 0;
      for (const s of spiders) {
        const d = dist(x, y, s.x, s.y);
        if (d < near) k += 60;
        else if (d < far) k += 4;
      }
      return k;
    };
    const [gx, gy] = carrying ? [hx, hy] : ch.carrier == null ? [ch.x, ch.y] : [ch.lx, ch.ly];
    const [c0, r0] = g.tileAt(u.x, u.y);
    const [gc, gr] = g.walkable(gx, gy) ? g.tileAt(gx, gy) : g.nearestFloor(gx, gy);
    const i = gr * g.cols + gc;
    const plain = g.field(c0, r0).D[i];
    const costed = g.field(c0, r0, cost).D[i];
    // Next to the cheese, only take it when the way home looks clear:
    // carrying it, a rat can't outrun anything.
    let wait = costed - plain > 50 && !carrying;
    if (!carrying && ch.carrier == null && dist(u.x, u.y, ch.x, ch.y) < T * 2.5) {
      const [cc, cr] = g.tileAt(ch.x, ch.y);
      const [hc, hr] = g.tileAt(hx, hy);
      const wide = (c, r) => {
        const [x, y] = g.center(c, r);
        return spiders.some((sp) => dist(x, y, sp.x, sp.y) < wc3(560)) ? 60 : 0;
      };
      const j = hr * g.cols + hc;
      const risk = g.field(cc, cr, wide).D[j] - g.field(cc, cr).D[j];
      if (risk > 50 && (mem.patience = (mem.patience ?? 0) + 0.5) < 25) wait = true;
    }
    if (wait) {
      const wary = spiders.filter((s) => dist(u.x, u.y, s.x, s.y) < wc3(900));
      if (wary.length) this.botFlee(u, wary);
      else if (dist(u.x, u.y, ch.x, ch.y) < T * 1.2) {
        // Hold just off the cheese.
        const a = Math.atan2(u.y - ch.y, u.x - ch.x);
        planRoute(u, g, ch.x + Math.cos(a) * T * 1.6, ch.y + Math.sin(a) * T * 1.6, {});
      } else if (u.target) u.stop();
      return;
    }
    planRoute(u, g, gx, gy, { cost });
  }

  // Run to the nearby cell the given spiders are farthest behind on.
  botFlee(u, list) {
    const g = this.grid;
    const slow = u.speed / SPIDER.speed;
    const [c0, r0] = g.tileAt(u.x, u.y);
    const me = g.field(c0, r0).D;
    const them = list.map((s) => {
      const [sc, sr] = g.tileAt(s.x, s.y);
      return g.field(sc, sr).D;
    });
    let best = -1;
    let bs = -Infinity;
    for (let i = 0; i < me.length; i++) {
      if (!Number.isFinite(me[i]) || me[i] > 7) continue;
      let it = Infinity;
      for (const D of them) it = Math.min(it, D[i]);
      const lead = it - me[i] / slow;
      if (lead <= 0 && me[i] > 0) continue;
      const score = Math.min(it, 12) + lead * 0.5;
      if (score > bs) {
        bs = score;
        best = i;
      }
    }
    if (best < 0) return;
    const [x, y] = g.center(best % g.cols, Math.floor(best / g.cols));
    if (dist(u.x, u.y, x, y) < 0.3) {
      if (u.target) u.stop();
      return;
    }
    planRoute(u, g, x, y, {});
  }

  progress(pid) {
    const u = this.heroes.get(pid);
    return u?.alive ? -dist(u.x, u.y, this.cheese.x, this.cheese.y) : -1e9;
  }

  hud() {
    const ch = this.cheese;
    if (ch.carrier != null) return { label: `Cheese: ${this.party.room.nameOf(ch.carrier)} has it` };
    return { label: 'Cheese: up for grabs' };
  }

  worldEnts() {
    const ents = this.spiders.map((s) => mobSnap(s));
    const ch = this.cheese;
    ents.push({ id: ch.id, k: 'cheese', x: round2(ch.x), y: round2(ch.y), c: ch.carrier != null ? 1 : undefined });
    for (const [pid, id] of this.circles) {
      const [x, y] = this.home.get(pid);
      ents.push({ id, k: 'powercircle', x: round2(x), y: round2(y), o: pid });
    }
    return ents;
  }
}
