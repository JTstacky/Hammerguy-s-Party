import { Minigame } from '../../base.js';
import { rand, dist, clampToRect, round1, round2, wc3, stepUnits, collideUnits, newId } from '../../../engine/server/sim.js';
import { fighter, fightStep, nearest, dealt, Grid, followPath } from './rtskit.js';

// Uther Party 4.0 #43 "Dune Worm Distress" (docs/uther-party/rules-4.0.md).
// A 1792x1792 field filled with a 14x14 grid of Rock Chunks at 128 u (the
// four corners are cliff; a 2x2 hole in the middle is the only open ground).
// Every rock has 5 HP, so one bite of a Dune Worm (12-13 normal, cooldown
// 1.35, range 90) eats it and opens a 128 u tunnel. Worms: speed 100, 15 HP,
// collision 7; a bite one-shots another worm too. Each player has 100 lumber,
// exactly one Barricade (10 s to build, 100 HP, armour 5 fortified, solid
// 128x128) to plug a tunnel. At t=40 a Wildkin (550 HP, speed 300, melee
// 19-22, acquisition 500) appears in the middle. It can't bite rock, but it
// breaks a barricade in 9-10 hits. Every 4 s, with a 50 % chance, it
// attack-moves to a random living unit. Survival with no timer: the last worm
// alive wins.
//
// Simplifications:
//  - Build is an ability cast on an open cell next to you, not a builder
//    walking to a placed foundation. The barricade stands (and blocks) at
//    once with 10 % HP and grows to 100 over 10 s while its worm stays within
//    about 200 u; walking off pauses it, as a WC3 human builder does.
//  - Repair is left out: it costs lumber and the only 100 lumber went into
//    the barricade, so it could never be used anyway.
//  - The Wildkin acquires only worms (and barricades) it has a path to, and
//    attacks a barricade that stands in its path.
//  - Bot AI: "move to a point 256 u from centre at the current bearing +-45"
//    is read as 256 u from the worm, outward along its bearing from the
//    centre, so bots dig outward the way the original's did. Bots never build.
const CS = wc3(128);
const N = 14;
const HW = (N * CS) / 2;
const WORM = { speed: wc3(100), hp: 15, r: wc3(7) };
const BITE = { min: 12, max: 13, type: 'normal', range: wc3(90), cd: 1.35, point: 0.33 };
const ROCK_HP = 5;
const BARRICADE = { hp: 100, build: 10, armor: 5, range: wc3(300), stay: wc3(220) };
const WILDKIN = { t: 40, hp: 550, speed: wc3(300), r: wc3(48), acquire: wc3(500), retarget: 4 };
const CLAW = { min: 19, max: 22, type: 'normal', range: wc3(128), cd: 1.35, point: 0.5 };
export const OPEN = 0;
export const ROCK = 1;
export const WALL = 2; // a barricade
export const CLIFF = 3;

export class DuneWorm extends Minigame {
  static id = 'dune';
  static name = 'Dune Worm Distress';
  static desc = 'Dig a home, and keep away from the predator! Bite tunnels through the rock for 40 seconds and plug yours with your one barricade before the Wildkin comes hunting. Last worm alive wins.';
  static controls = 'Right-click a rock to bite through it, or the ground to crawl. Q, then click an open spot next to you: build your one Barricade (10 s; stay close).';
  static duration = 480;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.grid = new Grid(N, N, CS, -HW, -HW);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const corner = (i === 0 || i === N - 1) && (j === 0 || j === N - 1);
        const hole = (i === 6 || i === 7) && (j === 6 || j === 7);
        this.grid.set(i, j, corner ? CLIFF : hole ? OPEN : ROCK);
      }
    }
    this.rocks = new Map(); // cell key -> rock target object
    this.map = { theme: 'dune', floor: { shape: 'rect', w: HW * 2, h: HW * 2 }, props: [], bounds: HW + 2, build: ['dunefield'], n: N, cs: round2(CS) };
    this.abilities = [
      {
        name: 'Build Barricade', icon: '🧱', kind: 'point', range: BARRICADE.range, charges: 1, castPoint: 0.2,
        desc: 'Costs your 100 lumber: one per game. A solid plug for a tunnel, 100 HP, armour 5. Builds over 10 s while you stay next to it. The Wildkin can break it; it cannot dig.',
        pickTarget: (pid, u, x, y) => this.pickBuildSite(pid, u, x, y),
        cast: (pid, u, tgt) => this.placeBarricade(pid, u, tgt),
      },
    ];
    this.spawnHeroes(
      this.pids.map(() => {
        const a = rand(0, Math.PI * 2);
        const r = wc3(rand(0, 100));
        return [Math.cos(a) * r, Math.sin(a) * r];
      }),
      { speed: WORM.speed, r: WORM.r, hp: WORM.hp },
    );
    for (const [, u] of this.heroes) {
      u.skin = 'duneworm';
      u.def = 'medium';
      u.armor = 0;
      u.atk = { ...BITE };
      u.atkCd = 0;
      u.haste = 1;
    }
    this.attack = { range: BITE.range }; // right-click targets
    this.barricades = [];
    this.wildkin = null;
    this.portalId = newId();
    this.gridId = newId();
    this.lumber = new Map(this.pids.map((p) => [p, 100]));
  }

  // ------------------------------------------------------------ grid

  key(i, j) {
    return j * N + i;
  }

  // A rock as an attack target (created on demand, one per cell).
  rockAt(i, j) {
    if (this.grid.get(i, j) !== ROCK) return null;
    const k = this.key(i, j);
    let r = this.rocks.get(k);
    if (!r) {
      const [x, y] = this.grid.center(i, j);
      r = { id: newId(), kind: 'rock', i, j, x, y, r: CS / 2, hp: ROCK_HP, alive: true, def: 'none', armor: 0 };
      this.rocks.set(k, r);
    }
    return r;
  }

  breakRock(rock) {
    rock.alive = false;
    this.grid.set(rock.i, rock.j, OPEN);
    this.rocks.delete(this.key(rock.i, rock.j));
    this.ev({ k: 'dunebite', x: round2(rock.x), y: round2(rock.y) });
  }

  // Worms and the Wildkin walk on open cells; the Wildkin may walk "through"
  // barricades at a price, because it breaks them on the way.
  wormCost = (i, j) => (this.grid.get(i, j) === OPEN ? 1 : Infinity);
  kinCost = (i, j) => {
    const v = this.grid.get(i, j);
    return v === OPEN ? 1 : v === WALL ? 6 : Infinity;
  };

  moveAlong(u, x, y, cost, goalOk = false) {
    // Re-plan at most every 0.4 s, or when the goal moves.
    const g = u.goal;
    if (g && u.path && this.time - g.t < 0.4 && Math.abs(g.x - x) < 0.3 && Math.abs(g.y - y) < 0.3) return;
    u.goal = { x, y, t: this.time };
    u.path = this.grid.findPath(u.x, u.y, x, y, { cost, r: u.r, goalOk });
  }

  // ------------------------------------------------------------ building

  pickBuildSite(pid, u, x, y) {
    if (!(this.lumber.get(pid) >= 100)) return null;
    const [i, j] = this.grid.cellOf(x, y);
    if (this.grid.get(i, j) !== OPEN) return this.nope(pid, u);
    const [cx, cy] = this.grid.center(i, j);
    if (dist(u.x, u.y, cx, cy) > BARRICADE.range) return this.nope(pid, u);
    // No unit may stand on the footprint.
    const units = [...this.heroes.values(), ...(this.wildkin ? [this.wildkin] : [])];
    const half = CS / 2;
    if (units.some((v) => v.alive && Math.abs(v.x - cx) < half + v.r * 0.5 && Math.abs(v.y - cy) < half + v.r * 0.5)) return this.nope(pid, u);
    return { x: cx, y: cy, i, j };
  }

  nope(pid, u) {
    this.ev({ k: 'txt', x: round1(u.x), y: round1(u.y), s: "Can't build there", c: '#ffcc66', to: pid });
    return null;
  }

  placeBarricade(pid, u, tgt) {
    if (this.grid.get(tgt.i, tgt.j) !== OPEN) {
      this.acharges.get(pid)[0] = 1;
      return;
    }
    this.lumber.set(pid, 0);
    const b = { id: newId(), kind: 'barricade', owner: pid, i: tgt.i, j: tgt.j, x: tgt.x, y: tgt.y, r: CS / 2, hp: BARRICADE.hp * 0.1, maxHp: BARRICADE.hp, prog: 0, alive: true, def: 'fort', armor: BARRICADE.armor };
    this.barricades.push(b);
    this.grid.set(tgt.i, tgt.j, WALL);
    for (const [, v] of this.heroes) if (v.alive) this.grid.pushOut(v);
    this.ev({ k: 'dunebuild', x: round2(b.x), y: round2(b.y) });
  }

  stepBarricades(dt) {
    for (const b of this.barricades) {
      if (!b.alive || b.prog >= 1) continue;
      const w = this.heroes.get(b.owner);
      if (!w?.alive || w.walking || dist(w.x, w.y, b.x, b.y) > BARRICADE.stay) continue;
      const before = b.prog;
      b.prog = Math.min(1, b.prog + dt / BARRICADE.build);
      b.hp = Math.min(b.maxHp, b.hp + (b.prog - before) * b.maxHp * 0.9);
      if (b.prog >= 1) this.ev({ k: 'dunebuilt', x: round2(b.x), y: round2(b.y) });
    }
  }

  // ------------------------------------------------------------ combat

  attackables(pid) {
    const list = [...this.heroes.values()].filter((v) => v.alive && v.owner !== pid);
    if (this.wildkin?.alive) list.push(this.wildkin);
    for (const b of this.barricades) if (b.alive) list.push(b);
    return list;
  }

  // A right-click on a rock bites it: rocks are picked by the cell under the
  // cursor, everything else by the usual click radius.
  attackTargetAt(pid, x, y) {
    const t = super.attackTargetAt(pid, x, y);
    if (t && t.kind !== 'barricade') return t;
    const [i, j] = this.grid.cellOf(x, y);
    if (this.grid.get(i, j) === ROCK) return this.rockAt(i, j);
    const b = this.barricades.find((v) => v.alive && v.i === i && v.j === j);
    return b || t;
  }

  hit = (src, tgt, base) => {
    if (!tgt.alive) return;
    if (tgt.kind === 'rock') {
      tgt.hp -= base;
      if (tgt.hp <= 0) this.breakRock(tgt);
      return;
    }
    const amount = dealt(base, src.atk.type, tgt.def, tgt.armor);
    this.ev({ k: 'hit', x: round1(tgt.x), y: round1(tgt.y) });
    if (tgt.kind === 'paladin' && this.heroes.get(tgt.owner) === tgt) return this.damage(tgt.owner, amount, 'dunedeath');
    tgt.hp -= amount;
    if (amount >= 1) this.ev({ k: 'dmg', x: round1(tgt.x), y: round1(tgt.y), n: Math.round(amount) });
    if (tgt.hp <= 0) {
      tgt.alive = false;
      if (tgt.kind === 'barricade') {
        this.grid.set(tgt.i, tgt.j, OPEN);
        this.ev({ k: 'dunebreak', x: round2(tgt.x), y: round2(tgt.y) });
      } else this.ev({ k: 'death', x: round1(tgt.x), y: round1(tgt.y), u: tgt.id });
    }
  };

  // Worms: the WC3 attack cycle, walking round the rock along the tunnels.
  stepAttacks(dt) {
    for (const [, u] of this.heroes) {
      if (!u.alive) continue;
      const t = u.attackOrder;
      if (t && !t.alive) u.attackOrder = null;
      // A new order before the damage point cancels the bite.
      if (u.swing && u.swing.tgt !== u.attackOrder) u.swing = null;
      u.tgt = u.attackOrder;
      if (!u.tgt && !u.swing) {
        if (u.atkCd > 0) u.atkCd -= dt;
        continue;
      }
      if (u.cast) continue;
      const cellTarget = t && (t.kind === 'rock' || t.kind === 'barricade');
      fightStep(u, dt, { hit: this.hit, move: (w, x, y) => this.moveAlong(w, x, y, this.wormCost, cellTarget), missiles: [], ev: (e) => this.ev(e) });
      if (u.tgt === null) u.attackOrder = null;
    }
  }

  command(pid, m) {
    const u = this.heroes.get(pid);
    super.command(pid, m);
    if (!u?.alive || u.cast) return;
    if ((m.c === 'move' || m.c === 'steer') && u.target && !u.attackOrder) {
      u.path = this.grid.findPath(u.x, u.y, +m.x || 0, +m.y || 0, { cost: this.wormCost, r: u.r });
      u.goal = null;
      u.stop();
    } else if (m.c === 'stop') u.path = null;
    else if (u.attackOrder) u.path = null;
  }

  // ------------------------------------------------------------ the Wildkin

  spawnWildkin() {
    this.wildkin = fighter({ kind: 'wildkin', x: 0, y: 0, r: WILDKIN.r, speed: WILDKIN.speed, hp: WILDKIN.hp, atk: { ...CLAW }, def: 'medium', armor: 2, acquire: WILDKIN.acquire, facing: Math.PI / 2 });
    this.wildkin.retarget = WILDKIN.retarget;
    this.wildkin.dest = null;
    this.ev({ k: 'duneportal', x: 0, y: 0 });
    this.ev({ k: 'sfx', s: 'kodo' });
  }

  // Can the Wildkin get to (x, y)? Returns the path if so.
  kinPath(k, x, y, goalOk = false) {
    const path = this.grid.findPath(k.x, k.y, x, y, { cost: this.kinCost, r: k.r * 0.6, goalOk });
    const end = path[path.length - 1];
    const [ei, ej] = this.grid.cellOf(end[0], end[1]);
    const [ti, tj] = this.grid.cellOf(x, y);
    return ei === ti && ej === tj ? path : null;
  }

  kinThink(k) {
    // Acquire a worm it can reach (units before structures), else a barricade.
    if (!k.tgt?.alive || k.tgt.kind === 'barricade') {
      const worms = [...this.heroes.values()].filter((w) => w.alive && dist(w.x, w.y, k.x, k.y) <= k.acquire).sort((a, b) => dist(a.x, a.y, k.x, k.y) - dist(b.x, b.y, k.x, k.y));
      const reach = worms.find((w) => this.kinPath(k, w.x, w.y));
      if (reach) k.tgt = reach;
      else if (!k.tgt?.alive) k.tgt = nearest(this.barricades, k.x, k.y, k.acquire, (b) => !!this.kinPath(k, b.x, b.y, true));
    }
    // A barricade in the way of the path gets broken first.
    const goal = k.tgt?.alive ? k.tgt : k.dest;
    if (!goal) return;
    const path = this.kinPath(k, goal.x, goal.y, goal.kind === 'barricade') || this.grid.findPath(k.x, k.y, goal.x, goal.y, { cost: this.kinCost, r: k.r * 0.6 });
    let px = k.x;
    let py = k.y;
    for (const [x, y] of path) {
      const n = Math.max(1, Math.ceil(dist(px, py, x, y) / (CS * 0.3)));
      for (let s = 1; s <= n; s++) {
        const [i, j] = this.grid.cellOf(px + ((x - px) * s) / n, py + ((y - py) * s) / n);
        if (this.grid.get(i, j) === WALL) {
          const b = this.barricades.find((v) => v.alive && v.i === i && v.j === j);
          if (b) {
            k.tgt = b;
            k.path = null;
            return;
          }
        }
      }
      px = x;
      py = y;
    }
    if (!k.tgt?.alive) {
      k.tgt = null;
      k.path = path;
    }
  }

  stepWildkin(dt) {
    const k = this.wildkin;
    if (!k?.alive) return;
    k.retarget -= dt;
    if (k.retarget <= 0) {
      k.retarget += WILDKIN.retarget;
      // 50 %: attack-move to the position of a random living unit (worm or barricade).
      if (Math.random() < 0.5) {
        const pool = [...[...this.heroes.values()].filter((w) => w.alive), ...this.barricades.filter((b) => b.alive)];
        if (pool.length) {
          const v = pool[Math.floor(Math.random() * pool.length)];
          k.dest = { x: v.x, y: v.y, kind: v.kind };
          if (k.tgt?.kind !== 'paladin') k.tgt = null;
        }
      }
    }
    k.thinkT = (k.thinkT || 0) - dt;
    if (k.thinkT <= 0) {
      k.thinkT = 0.3;
      this.kinThink(k);
    }
    const busy = fightStep(k, dt, { hit: this.hit, move: (u, x, y) => this.moveAlong(u, x, y, this.kinCost, k.tgt?.kind === 'barricade'), missiles: [], ev: (e) => this.ev(e) });
    if (!busy && k.dest && dist(k.x, k.y, k.dest.x, k.dest.y) < 0.6) k.dest = null;
    followPath(k);
  }

  // ------------------------------------------------------------ tick

  tick(dt) {
    if (!this.wildkin && this.time >= WILDKIN.t) this.spawnWildkin();
    for (const [, u] of this.heroes) followPath(u);
    this.stepHeroes(dt);
    this.stepBarricades(dt);
    this.stepWildkin(dt);
    const units = [...this.heroes.values()].filter((u) => u.alive);
    if (this.wildkin?.alive) {
      stepUnits([this.wildkin], dt);
      units.push(this.wildkin);
    }
    collideUnits(units);
    for (const u of units) {
      this.grid.pushOut(u);
      clampToRect(u, HW, HW);
    }
  }

  // Original AI: every 2 s move 256 u out along the bearing from the centre
  // +-45 deg; 1 s later bite a random rock within a 256x256 box around you.
  botThink(pid, u, mem) {
    mem.move ??= this.time + rand(0, 2);
    if (this.time >= mem.move) {
      mem.move = this.time + 2;
      mem.bite = this.time + 1;
      const a = Math.atan2(u.y, u.x) + rand(-1, 1) * (Math.PI / 4);
      const x = Math.max(-HW + 0.5, Math.min(HW - 0.5, u.x + Math.cos(a) * wc3(256)));
      const y = Math.max(-HW + 0.5, Math.min(HW - 0.5, u.y + Math.sin(a) * wc3(256)));
      u.attackOrder = null;
      u.path = this.grid.findPath(u.x, u.y, x, y, { cost: this.wormCost, r: u.r });
      u.stop();
    } else if (mem.bite && this.time >= mem.bite) {
      mem.bite = null;
      const rocks = [];
      const [ci, cj] = this.grid.cellOf(u.x, u.y);
      for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) if (this.grid.get(i, j) === ROCK) rocks.push(this.rockAt(i, j));
      if (rocks.length) {
        u.path = null;
        u.stop();
        u.attackOrder = rocks[Math.floor(Math.random() * rocks.length)];
      }
    }
  }

  hud(pid) {
    const b = this.barricades.find((v) => v.owner === pid && v.alive);
    const kin = this.wildkin ? (this.wildkin.alive ? 'The Wildkin hunts!' : 'The Wildkin is dead') : `Wildkin in ${Math.ceil(WILDKIN.t - this.time)} s`;
    const lum = b ? (b.prog < 1 ? ` · Barricade ${Math.floor(b.prog * 100)}%` : ' · Barricade up') : this.lumber.get(pid) >= 100 ? ' · 🪵 100 lumber' : '';
    return { label: `${kin}${lum}` };
  }

  // The rock field as a hex bitmask of standing rocks, one bit per cell.
  gridHex() {
    let s = '';
    for (let k = 0; k < N * N; k += 4) {
      let v = 0;
      for (let b = 0; b < 4; b++) if (k + b < N * N && this.grid.block[k + b] === ROCK) v |= 1 << b;
      s += v.toString(16);
    }
    return s;
  }

  worldEnts() {
    const ents = [{ id: this.gridId, k: 'dunegrid', x: 0, y: 0, g: this.gridHex(), n: N, cs: round2(CS) }];
    if (!this.wildkin) ents.push({ id: this.portalId, k: 'duneportal', x: 0, y: 0, t: round1(WILDKIN.t - this.time) });
    for (const b of this.barricades) if (b.alive) ents.push({ id: b.id, k: 'dunebarricade', x: round2(b.x), y: round2(b.y), o: b.owner, p: round2(b.prog), h: Math.ceil((100 * b.hp) / b.maxHp) });
    const k = this.wildkin;
    if (k) ents.push({ id: k.id, k: 'wildkin', x: round2(k.x), y: round2(k.y), f: round2(k.facing), h: Math.max(0, Math.ceil((100 * k.hp) / k.maxHp)), mv: k.mx || k.my ? 1 : undefined, sw: k.swing ? 1 : undefined, dead: k.alive ? undefined : 1 });
    return ents;
  }
}

export const DUNE = { CS, N, HW, WORM, BITE, BARRICADE, WILDKIN, CLAW, ROCK_HP };
