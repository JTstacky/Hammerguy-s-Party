import { Minigame } from '../../base.js';
import { rand, dist, round2, wc3, newId, Unit, stepUnits, collideUnits, clamp } from '../../../engine/server/sim.js';
import { TileGrid, followGrid, planRoute } from './lib-f-grid.js';
import { makeMob, meleeTick, mobSnap } from './lib-f-mob.js';

// Uther Party 4.0 #14 "Raider Relay" (docs/uther-party/rules-4.0.md).
//  - The 1280x2816 course from the map's pathing: two 3-tile lanes up from
//    the bottom corners, a middle band, a top band, the zeppelin pad (a
//    walled pocket entered from above), a walled middle platform and the
//    walled Island at the bottom centre, whose southern half is the Finish.
//    Only flyers reach the platform and the Island.
//  - Raiders: speed 350, 25 HP, no attack, one Ensnare (Q; range 500, pins
//    for 10 s and pulls flyers to the ground; rivals, their zeppelins and
//    the creatures are all fair game).
//  - Each player's Goblin Zeppelin (speed 270, 25 HP) waits on the pad,
//    paused and invulnerable, until its raider steps onto the pad. Then
//    board it (W, or right-click it), fly, and unload (E, click a point)
//    onto the Island; the raider must walk into the Finish.
//  - Two bears (speed 270, acquisition 400, range 100, cooldown 1.5,
//    27-32 damage: one hit kills a raider) wander in the lanes. Four
//    hippogryphs (speed 400, acquisition 300, air-only, 50-57 damage: one hit
//    kills a zeppelin) guard the flight: two patrol across the course, two
//    stand still. GuardDistance 10000: once they aggro they don't let go.
//  - A dead raider takes its zeppelin with it; a dead zeppelin takes its
//    cargo, and its raider too unless the raider is on the Island.
//  - Race, 90 s, 8/7/6 ...
export const T = wc3(128);
export const COURSE = [
  '###.....##',
  '#........#',
  '#..#..#..#',
  '#..#oo#..#',
  '#..#oo#..#',
  '#..#oo#..#',
  '#..####..#',
  '#..####..#',
  '#..#..#..#',
  '#........#',
  '..........',
  '...####...',
  '...#pp#...',
  '...#pp#...',
  '...####...',
  '..........',
  '..........',
  '...####...',
  '...#ii#...',
  '...#ii#...',
  '...#ff#...',
  '...#ff#...',
];
export const RAIDER = { hp: 25, speed: wc3(350), r: wc3(32) };
export const ZEP = { hp: 25, speed: wc3(270), r: wc3(30) };
export const SNARE = { range: wc3(500), dur: 10, cd: 10, speed: wc3(1500), castPoint: 0.3 };
export const BEAR = { hp: 810, speed: wc3(270), r: wc3(32), acq: wc3(400), range: wc3(100), cd: 1.5, point: 0.5 };
export const HIPPO = { hp: 525, speed: wc3(400), r: wc3(32), acq: wc3(300), range: wc3(128), cd: 1.05, point: 0.5 };
const BOARD = wc3(200);
const COLS = COURSE[0].length;
const ROWS = COURSE.length;
const HX = (COLS * T) / 2;
const HY = (ROWS * T) / 2;
// Cell rectangles [c0, r0, c1, r1] (inclusive).
const PAD = [4, 2, 5, 4];
const ISLAND = [4, 18, 5, 21];
const FINISH = [4, 20, 5, 21];
const STARTS = [[0, 20, 2, 21], [7, 20, 9, 21]];

export class RaiderRelay extends Minigame {
  static id = 'raider';
  static name = 'Raider Relay';
  static desc = 'Reach the end! Run your raider up a lane past the bear to the zeppelin pad, fly your zeppelin down through the hippogryphs and drop onto the Island, then step into the Finish. One Ensnare each. First one home scores most.';
  static controls = 'Right-click to move. Q Ensnare (once): pin a bear, hippogryph or rival for 10 s. W Board your zeppelin (or right-click it). E Unload at a point.';
  static duration = 90;
  static ranking = 'race';
  static canDraw = true; // nobody finishing is a draw in the original

  setup() {
    this.grid = new TileGrid(COURSE, T);
    this.map = {
      theme: 'grass',
      floor: { shape: 'rect', w: HX * 2, h: HY * 2 },
      props: [],
      bounds: HY - 6,
      build: ['raider'],
      grid: COURSE,
      T: round2(T),
      finish: this.rectCentre(FINISH).map(round2),
    };
    this.abilities = [
      {
        name: 'Ensnare', icon: '🕸️', desc: 'Pins a bear, hippogryph, rival raider or zeppelin for 10 s and pulls flyers to the ground. Once per game.',
        kind: 'unit', cd: SNARE.cd, charges: 1, range: SNARE.range, castPoint: SNARE.castPoint,
        available: (pid) => this.mode.get(pid) === 'ground',
        pickTarget: (pid, u, x, y) => this.pickSnare(pid, u, x, y),
        cast: (pid, u, tgt) => this.snares.push({ id: newId(), x: u.x, y: u.y, tgt: tgt.u }),
      },
      {
        name: 'Board', icon: '🎈', desc: 'Walk to your zeppelin and climb aboard (it wakes up when you reach the pad).',
        kind: 'instant', cd: 0,
        available: (pid) => this.mode.get(pid) === 'ground' && this.zeps.get(pid).state === 'active',
        cast: (pid) => this.boarding.add(pid),
      },
      {
        name: 'Unload', icon: '⬇️', desc: 'Fly to a point and set your raider down there.',
        kind: 'point', cd: 0,
        available: (pid) => this.mode.get(pid) === 'air',
        pickTarget: (pid, u, x, y) => ({ x, y }),
        cast: (pid, u, tgt) => this.unloadAt.set(pid, this.landingPoint(tgt.x, tgt.y)),
      },
    ];
    const starts = this.pids.map(() => this.randomIn(STARTS[Math.floor(Math.random() * 2)]));
    this.spawnHeroes(starts, { hp: RAIDER.hp, speed: RAIDER.speed, r: RAIDER.r, facing: -Math.PI / 2 });
    this.mode = new Map(this.pids.map((p) => [p, 'ground']));
    this.raiderHp = new Map();
    this.zeps = new Map();
    for (const [pid, u] of this.heroes) {
      u.skin = 'raider';
      const [zx, zy] = this.randomIn(PAD);
      const z = new Unit({ kind: 'zeppelin', owner: pid, x: zx, y: zy, r: ZEP.r, speed: ZEP.speed, hp: ZEP.hp });
      z.setFacing(Math.PI / 2);
      z.state = 'parked';
      z.pin = 0;
      this.zeps.set(pid, z);
    }
    this.boarding = new Set();
    this.unloadAt = new Map();
    this.snares = [];
    this.pinned = new Map(); // unit -> seconds left
    this.bears = [-448, 448].map((x) => {
      const b = makeMob('bear', wc3(x), wc3(128), BEAR);
      b.home = { x: b.x, y: b.y };
      b.idle = rand(0, 2);
      b.setFacing(Math.PI / 2);
      return b;
    });
    const hip = (x, y, patrolTo) => {
      const h = makeMob('hippo', wc3(x), wc3(y), HIPPO);
      h.post = { x: h.x, y: h.y };
      // Patrol ends pulled in by the collision radius (the course edge).
      const edge = (v) => Math.sign(v) * Math.min(Math.abs(wc3(v)), HX - HIPPO.r - 0.05);
      if (patrolTo) h.x = edge(x);
      h.patrol = patrolTo ? [{ x: h.x, y: h.y }, { x: edge(patrolTo), y: h.y }] : null;
      h.leg = 1;
      h.setFacing(patrolTo ? (patrolTo > x ? 0 : Math.PI) : Math.PI / 2);
      return h;
    };
    this.hippos = [hip(-640, 512, 640), hip(640, 1024, -640), hip(-512, 768, null), hip(512, 768, null)];
    this.botT = 0;
  }

  // ---------------------------------------------------------- helpers

  rectCentre([c0, r0, c1, r1]) {
    return [this.grid.x0 + ((c0 + c1 + 1) / 2) * T, this.grid.y0 + ((r0 + r1 + 1) / 2) * T];
  }

  randomIn([c0, r0, c1, r1]) {
    return [this.grid.x0 + rand(c0 + 0.3, c1 + 0.7) * T, this.grid.y0 + rand(r0 + 0.3, r1 + 0.7) * T];
  }

  inRect(x, y, [c0, r0, c1, r1]) {
    const [c, r] = this.grid.tileAt(x, y);
    return c >= c0 && c <= c1 && r >= r0 && r <= r1;
  }

  landingPoint(x, y) {
    if (this.grid.walkable(x, y)) return { x, y };
    const cell = this.grid.nearestFloor(x, y);
    const [cx, cy] = this.grid.center(cell[0], cell[1]);
    return { x: cx, y: cy };
  }

  // Everything that can be ensnared, by who may cast.
  pickSnare(pid, u, x, y) {
    const cands = [...this.bears, ...this.hippos];
    for (const [op, v] of this.heroes) if (op !== pid && v.alive && !v.finished) cands.push(v);
    for (const [op, z] of this.zeps) if (op !== pid && z.state === 'active') cands.push(z);
    let best = null;
    let bd = 1.4;
    for (const v of cands) {
      if (!v.alive) continue;
      const d = dist(x, y, v.x, v.y) - v.r;
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    if (!best || dist(u.x, u.y, best.x, best.y) > SNARE.range + best.r + u.r) return null;
    return { x: best.x, y: best.y, u: best };
  }

  isAir(v) {
    if (this.pinned.has(v)) return false; // ensnared flyers are pulled down
    if (v.kind === 'zeppelin') return v.state === 'active';
    if (v.kind === 'hippo') return true;
    return this.heroes.get(v.owner) === v && this.mode.get(v.owner) === 'air';
  }

  // ---------------------------------------------------------- orders

  command(pid, m) {
    const u = this.heroes.get(pid);
    if (!u?.alive || u.finished) return;
    if (m.c === 'move' || m.c === 'stop') {
      this.boarding.delete(pid);
      if (m.c === 'move') this.unloadAt.delete(pid);
      // A right-click on your own zeppelin boards it.
      const z = this.zeps.get(pid);
      if (m.c === 'move' && this.mode.get(pid) === 'ground' && z.state === 'active' && dist(+m.x || 0, +m.y || 0, z.x, z.y) < 1.4) {
        this.boarding.add(pid);
        return;
      }
    }
    super.command(pid, m);
  }

  board(pid) {
    const u = this.heroes.get(pid);
    const z = this.zeps.get(pid);
    this.boarding.delete(pid);
    this.raiderHp.set(pid, u.hp);
    this.mode.set(pid, 'air');
    z.state = 'loaded';
    u.x = z.x;
    u.y = z.y;
    u.hp = z.hp;
    u.skin = 'zeppelin';
    u.speed = ZEP.speed;
    u.r = ZEP.r;
    u.solid = false;
    u.stop();
    u.route = null;
    if (this.pinned.has(z)) {
      this.pinned.set(u, this.pinned.get(z));
      this.pinned.delete(z);
    }
    this.ev({ k: 'sfx', s: 'swap', to: pid });
  }

  unload(pid) {
    const u = this.heroes.get(pid);
    const z = this.zeps.get(pid);
    this.unloadAt.delete(pid);
    this.mode.set(pid, 'ground');
    z.state = 'active';
    z.x = u.x;
    z.y = u.y;
    z.hp = u.hp;
    z.setFacing(u.facing);
    u.hp = this.raiderHp.get(pid) ?? RAIDER.hp;
    u.skin = 'raider';
    u.speed = RAIDER.speed;
    u.r = RAIDER.r;
    u.solid = true;
    u.stop();
    this.grid.collide(u);
    this.ev({ k: 'rrdrop', x: round2(u.x), y: round2(u.y) });
  }

  // ---------------------------------------------------------- tick

  tick(dt) {
    for (const [unit, left] of this.pinned) {
      if (left - dt <= 0 || !unit.alive) {
        this.pinned.delete(unit);
        unit.speedMult = 1;
      } else {
        this.pinned.set(unit, left - dt);
        unit.speedMult = 0;
      }
    }
    this.stepSnares(dt);
    this.botOrders(dt);
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.finished) continue;
      const z = this.zeps.get(pid);
      if (this.mode.get(pid) === 'ground') {
        if (z.state === 'parked' && this.inRect(u.x, u.y, PAD)) {
          z.state = 'active';
          this.ev({ k: 'rrwake', x: round2(z.x), y: round2(z.y), o: pid });
        }
        if (this.boarding.has(pid)) {
          if (z.state !== 'active') this.boarding.delete(pid);
          else if (dist(u.x, u.y, z.x, z.y) <= BOARD) this.board(pid);
          else if (!u.cast) u.steer(z.x, z.y);
        }
      } else {
        const p = this.unloadAt.get(pid);
        if (p && !u.cast) {
          if (dist(u.x, u.y, p.x, p.y) <= 0.3) this.unload(pid);
          else if (!u.target) u.order(p.x, p.y);
        }
      }
    }
    for (const b of this.bears) this.stepBear(b, dt);
    for (const h of this.hippos) this.stepHippo(h, dt);
    for (const b of this.bears) followGrid(b, this.grid, dt, false);
    for (const [pid, u] of this.heroes) if (this.mode.get(pid) === 'ground') followGrid(u, this.grid, dt);
    stepUnits([...this.bears, ...this.hippos, ...[...this.zeps.values()].filter((z) => z.state === 'active')], dt);
    this.stepHeroes(dt);
    collideUnits([...this.heroes.values(), ...this.bears]);
    for (const [pid, u] of this.heroes) {
      if (!u.alive) continue;
      if (this.mode.get(pid) === 'ground') this.grid.collide(u);
      else this.clampAir(u);
    }
    for (const b of this.bears) this.grid.collide(b);
    for (const h of this.hippos) this.clampAir(h);
    // Finish: the raider on foot in the Finish.
    for (const [pid, u] of this.heroes) {
      if (u.alive && !u.finished && this.mode.get(pid) === 'ground' && this.inRect(u.x, u.y, FINISH)) {
        this.finish(pid);
        u.solid = false; // out of the way of the raiders behind
        this.party.msg(`${this.party.room.nameOf(pid)} reached the end!`, this.party.room.colorOf(pid));
      }
    }
  }

  clampAir(u) {
    u.x = clamp(u.x, -HX + u.r, HX - u.r);
    u.y = clamp(u.y, -HY + u.r, HY - u.r);
  }

  stepSnares(dt) {
    for (const s of this.snares) {
      const t = s.tgt;
      const d = dist(s.x, s.y, t.x, t.y);
      const step = SNARE.speed * dt;
      if (!t.alive || (t.kind === 'zeppelin' && t.state === 'loaded')) {
        s.done = true;
        continue;
      }
      if (d <= step) {
        s.done = true;
        this.pinned.set(t, SNARE.dur);
        t.speedMult = 0;
        t.stop();
        t.tgt = null;
        this.ev({ k: 'rrsnare', x: round2(t.x), y: round2(t.y), u: t.id });
        continue;
      }
      s.x += ((t.x - s.x) / d) * step;
      s.y += ((t.y - s.y) / d) * step;
      s.f = Math.atan2(t.y - s.y, t.x - s.x);
    }
    this.snares = this.snares.filter((s) => !s.done);
  }

  // Ground targets for the bears: raiders on foot and anything ensnared.
  groundPrey() {
    const out = [];
    for (const [pid, u] of this.heroes) if (u.alive && !u.finished && !this.isAir(u)) out.push(u);
    for (const z of this.zeps.values()) if (z.alive && z.state === 'active' && !this.isAir(z)) out.push(z);
    return out;
  }

  airPrey() {
    const out = [];
    for (const u of this.heroes.values()) if (u.alive && !u.finished && this.isAir(u)) out.push(u);
    for (const z of this.zeps.values()) if (z.alive && this.isAir(z)) out.push(z);
    return out;
  }

  acquire(m, prey) {
    let best = null;
    let bd = m.acq;
    for (const v of prey) {
      const d = dist(m.x, m.y, v.x, v.y) - v.r;
      if (d <= bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  stepBear(b, dt) {
    const prey = this.groundPrey();
    if (b.tgt && !prey.includes(b.tgt)) {
      b.tgt = null;
      b.swing = null;
    }
    if (!b.tgt) b.tgt = this.acquire(b, prey);
    if (b.tgt) {
      const busy = meleeTick(b, dt, (v) => this.maul(v));
      if (!busy && !this.pinned.has(b)) {
        b.chaseT = (b.chaseT || 0) - dt;
        if (!b.target || b.chaseT <= 0) {
          b.chaseT = 0.25;
          b.steer(b.tgt.x, b.tgt.y);
        }
      }
      return;
    }
    if (b.swing) return void meleeTick(b, dt, (v) => this.maul(v));
    // Wander round where it is.
    if (!b.target) {
      b.idle -= dt;
      if (b.idle <= 0) {
        b.idle = rand(2, 5);
        const a = rand(0, Math.PI * 2);
        const d = wc3(rand(100, 300));
        const x = b.x + Math.cos(a) * d;
        const y = b.y + Math.sin(a) * d;
        if (this.grid.walkable(x, y)) b.order(x, y);
      }
    }
  }

  stepHippo(h, dt) {
    const prey = this.airPrey();
    if (h.tgt && !prey.includes(h.tgt)) {
      h.tgt = null;
      h.swing = null;
    }
    if (!h.tgt) h.tgt = this.acquire(h, prey);
    if (h.tgt) {
      const busy = meleeTick(h, dt, (v) => this.claw(v));
      if (!busy && !this.pinned.has(h)) h.steer(h.tgt.x, h.tgt.y);
      h.back = true;
      return;
    }
    if (h.swing) return void meleeTick(h, dt, (v) => this.claw(v));
    // Resume the patrol, or go back to the post.
    if (h.patrol) {
      if (!h.target) {
        h.leg = 1 - h.leg;
        const p = h.patrol[h.leg];
        h.order(p.x, p.y);
      }
    } else if (h.back || !h.target) {
      h.back = false;
      if (dist(h.x, h.y, h.post.x, h.post.y) > 0.3) h.order(h.post.x, h.post.y);
    }
  }

  maul(v) {
    this.ev({ k: 'hit', x: round2(v.x), y: round2(v.y) });
    this.hurt(v, 27 + Math.floor(Math.random() * 6));
  }

  claw(v) {
    this.ev({ k: 'hit', x: round2(v.x), y: round2(v.y) });
    this.hurt(v, 50 + Math.floor(Math.random() * 8));
  }

  // Damage to a raider, a flying zeppelin (the hero in air mode) or a
  // zeppelin standing by, with the death links between them.
  hurt(v, n) {
    if (v.kind === 'zeppelin') {
      v.hp -= n;
      this.ev({ k: 'dmg', x: round2(v.x), y: round2(v.y), n });
      if (v.hp <= 0) this.zeppelinDown(v.owner, v);
      return;
    }
    const pid = v.owner;
    const air = this.mode.get(pid) === 'air';
    this.damage(pid, n, air ? 'rrcrash' : 'death');
    if (!v.alive) {
      const z = this.zeps.get(pid);
      z.alive = false;
      z.state = 'dead';
      if (!air) this.ev({ k: 'rrcrash', x: round2(z.x), y: round2(z.y) });
    }
  }

  zeppelinDown(pid, z) {
    z.alive = false;
    z.state = 'dead';
    this.ev({ k: 'rrcrash', x: round2(z.x), y: round2(z.y) });
    const u = this.heroes.get(pid);
    if (u.alive && !u.finished && !this.inRect(u.x, u.y, ISLAND)) {
      u.hp = 0;
      this.eliminate(pid, 'death');
    }
  }

  // Computer raiders, every 0.25 s. The original's (on the pad, board; on
  // the Island, walk to the Finish; otherwise head for the pad; zeppelins
  // unload at the Finish; never Ensnare) loses nearly every raider to the
  // bears and hippogryphs, so ours play it the way the designer describes:
  //  - on foot, path round the bears and Ensnare one that is after them,
  //    then keep out of its reach;
  //  - in the air, hover above the middle platform until the hippogryphs'
  //    patrols leave a gap, then fly for the Island and unload on it.
  botOrders(dt) {
    if (this.time < 2) return;
    // Flyers watch for a gap every tick; the rest think every 0.25 s.
    const land = [0, this.grid.y0 + 18.5 * T];
    for (const pid of this.bots.keys()) {
      const u = this.heroes.get(pid);
      if (u.alive && !u.finished && !u.cast && this.mode.get(pid) === 'air') this.botFly(pid, u, land);
    }
    this.botT -= dt;
    if (this.botT > 0) return;
    this.botT += 0.25;
    const fin = this.rectCentre(FINISH);
    const pad = this.rectCentre(PAD);
    for (const pid of this.bots.keys()) {
      const u = this.heroes.get(pid);
      if (!u.alive || u.finished || u.cast || this.mode.get(pid) === 'air') continue;
      const z = this.zeps.get(pid);
      if (this.inRect(u.x, u.y, PAD) && z.state === 'active') this.boarding.add(pid);
      else if (this.inRect(u.x, u.y, ISLAND)) {
        if (!u.target) u.order(fin[0], fin[1]);
      } else if (!this.boarding.has(pid)) this.botRun(pid, u, pad);
    }
  }

  botRun(pid, u, pad) {
    const g = this.grid;
    const canSnare = (this.acharges.get(pid)[0] ?? 0) > 0 && !(this.acd.get(pid)[0] > 0);
    const chaser = this.bears.find((b) => !this.pinned.has(b) && b.tgt === u);
    if (chaser && canSnare) {
      // Lure it out of the lane into the middle band, then pin it there.
      const d = dist(u.x, u.y, chaser.x, chaser.y);
      if (Math.abs(chaser.x) < wc3(250) && d > wc3(290) && d <= SNARE.range + chaser.r + u.r - 0.3) {
        this.useAbility(pid, 0, chaser.x, chaser.y);
        return;
      }
      if (!u.lureSide) u.lureSide = -(Math.sign(u.x) || 1);
      planRoute(u, g, u.lureSide * wc3(380), g.y0 + 16.8 * T, {});
      return;
    }
    const reach = BEAR.range + BEAR.r + RAIDER.r + 0.9;
    const cost = (c, r) => {
      const [x, y] = g.center(c, r);
      let k = 0;
      for (const b of this.bears) {
        const d = dist(x, y, b.x, b.y);
        if (this.pinned.has(b)) k += d < reach ? 200 : 0;
        else if (d < wc3(260)) k += 80;
        else if (d < wc3(460)) k += 8;
      }
      return k;
    };
    const avoid = this.bears.filter((b) => this.pinned.has(b)).map((b) => ({ x: b.x, y: b.y, r: reach }));
    planRoute(u, g, pad[0], pad[1], { cost, avoid });
  }

  botFly(pid, u, fin) {
    if (this.unloadAt.has(pid)) return; // committed
    const hold = { x: 0, y: this.grid.y0 + 12 * T };
    if (u.y < hold.y - 0.6 || Math.abs(u.x - hold.x) > 0.6) {
      if (!u.target || dist(u.target.x, u.target.y, hold.x, hold.y) > 0.1) u.order(hold.x, hold.y);
      if (dist(u.x, u.y, hold.x, hold.y) > 0.6) return;
    }
    u.hover = (u.hover ?? this.time);
    // Waiting too long for a gap (or with time running out), go anyway.
    if (this.safeRun(u, fin[0], fin[1]) || this.time - u.hover > 15 || this.time > this.meta.duration - 8) this.unloadAt.set(pid, { x: fin[0], y: fin[1] });
  }

  // Would a straight flight from u to (tx, ty) get there before any
  // hippogryph could strike? Patrols and posts are predicted; one that
  // notices the zeppelin is assumed to chase it flat out.
  safeRun(u, tx, ty) {
    const dt = 0.05;
    const d = dist(u.x, u.y, tx, ty);
    const arrive = d / ZEP.speed;
    const sim = this.hippos.map((h) => {
      let dir = 0;
      if (h.patrol) dir = Math.sign(h.patrol[h.leg].x - h.x) || 1;
      return { x: h.x, y: h.y, dir, patrol: h.patrol, chase: !!h.tgt, swing: -1, h };
    });
    if (sim.some((s) => s.chase && dist(s.x, s.y, u.x, u.y) < 14)) return false;
    for (let t = 0; t <= arrive + 0.15; t += dt) {
      const k = Math.min(1, t / arrive);
      const zx = u.x + (tx - u.x) * k;
      const zy = u.y + (ty - u.y) * k;
      for (const s of sim) {
        const gap = dist(s.x, s.y, zx, zy);
        if (s.swing >= 0) {
          s.swing += dt;
          if (s.swing >= HIPPO.point && t < arrive + 0.1) return false;
          continue;
        }
        if (!s.chase && gap - ZEP.r <= HIPPO.acq) s.chase = true;
        if (s.chase) {
          if (gap - HIPPO.r - ZEP.r <= HIPPO.range) {
            s.swing = 0;
            continue;
          }
          const step = Math.min(gap, HIPPO.speed * dt);
          s.x += ((zx - s.x) / gap) * step;
          s.y += ((zy - s.y) / gap) * step;
        } else if (s.patrol) {
          s.x += s.dir * HIPPO.speed * dt;
          const lo = Math.min(s.patrol[0].x, s.patrol[1].x);
          const hi = Math.max(s.patrol[0].x, s.patrol[1].x);
          if (s.x > hi) {
            s.x = hi;
            s.dir = -1;
          } else if (s.x < lo) {
            s.x = lo;
            s.dir = 1;
          }
        }
      }
    }
    return true;
  }

  botThink() {}

  progress(pid) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return -1e9;
    return this.mode.get(pid) === 'air' ? 100 + u.y : this.zeps.get(pid).state === 'active' ? 50 : -dist(u.x, u.y, 0, this.grid.y0);
  }

  hud(pid) {
    const u = this.heroes.get(pid);
    if (!u) return null;
    if (u.finished) return { label: 'Home!' };
    const z = this.zeps.get(pid);
    if (this.mode.get(pid) === 'air') return { label: 'Flying: E to unload on the Island' };
    if (z.state === 'parked') return { label: 'Get to the zeppelin pad' };
    if (z.state === 'active') return { label: this.inRect(u.x, u.y, ISLAND) ? 'Walk into the Finish' : 'Zeppelin ready: W to board' };
    return null;
  }

  heroEnts(pid) {
    return super.heroEnts(pid).map((e) => {
      const u = this.heroes.get(e.o);
      if (u && this.pinned.has(u)) e.fx = [...(e.fx || []).filter((f) => f !== 'slow'), 'snared'];
      if (u && this.mode.get(e.o) === 'air' && !this.pinned.has(u)) e.fx = [...(e.fx || []), 'fly'];
      return e;
    });
  }

  worldEnts() {
    const ents = [];
    for (const z of this.zeps.values()) {
      if (z.state !== 'parked' && z.state !== 'active') continue;
      const e = { id: z.id, k: 'rrzep', x: round2(z.x), y: round2(z.y), f: round2(z.facing), o: z.owner };
      if (z.state === 'parked') e.p = 1;
      if (this.pinned.has(z)) e.sn = 1;
      ents.push(e);
    }
    for (const b of this.bears) ents.push(mobSnap(b, this.pinned.has(b) ? { sn: 1 } : {}));
    for (const h of this.hippos) ents.push(mobSnap(h, this.pinned.has(h) ? { sn: 1 } : {}));
    for (const s of this.snares) ents.push({ id: s.id, k: 'rrnet', x: round2(s.x), y: round2(s.y), f: round2(s.f || 0) });
    return ents;
  }
}
