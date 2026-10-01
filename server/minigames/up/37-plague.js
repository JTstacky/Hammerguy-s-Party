import { Minigame } from '../../base.js';
import { Unit, stepUnits, collideUnits, newId, rand, dist, round2, wc3 } from '../../../engine/server/sim.js';
import { meleeStep, avoidObstacles, outwardPoint, gap } from './d-common.js';

// Uther Party 4.0 #37 "The Plague" (docs/uther-party/rules-4.0.md).
// A 1280x1280 graveyard at night. Everyone is an Acolyte (25 HP, no regen,
// speed 220, collision 15) with a weak attack (13.5-15 per 2.5 s, range 90),
// used only when ordered: acolytes are WC3 workers, which never pick targets
// on their own (the sheet assumes they do; its acquisition 90 has no effect). Patient zero, one more
// acolyte, is killed at t=6; every corpse rises about 4 s later as a Zombie
// (240 HP, speed 220 = acolyte speed, 15-16.5 per 1.35 s, range 100) owned by
// whoever owned the corpse. So every player who dies keeps playing as a zombie
// hunting the living, and a killed zombie rises again at full HP. Two zombie
// hits kill an acolyte. Last acolyte standing wins.
//
// Scoring is the base survival rule; `alive` is overridden so that a player
// counts as out from the moment their acolyte dies, even while they walk on as
// a zombie.
//
// Deviations:
//  - The original has no time limit (two good runners could stall forever);
//    this one stops at 180 s, and the survivors then share the ante.
//  - Computer acolytes also run from zombies that come close (100-300 u, by skill); the original AI only
//    moves them 200-400 u outward every 4 s, which makes them free kills.
//  - Zombies only hunt acolytes (not each other).
//  - The sheet says patient zero's zombie idles until something comes within
//    100 u, but also that computer-owned zombies get acquisition 2000, and its
//    owner (Player 12) is a computer slot. It hunts across the graveyard here.
const HALF = wc3(640);
const CUT = wc3(1152);
const PILLAR_R = wc3(72);
const PILLARS = [[-192, -448], [192, -448], [-448, -192], [448, -192], [-448, 192], [448, 192], [-192, 448], [192, 448]];
export const ACOLYTE = { hp: 25, speed: wc3(220), r: wc3(15), acquire: wc3(90), weapon: { range: wc3(90), cd: 2.5, point: 0.5, dmg: [13.5, 15] } };
export const ZOMBIE = { hp: 240, speed: wc3(220), r: wc3(31), regen: 0.5, acquire: wc3(100), botAcquire: wc3(2000), weapon: { range: wc3(100), cd: 1.35, point: 0.3, dmg: [15, 16.5] } };
export const RISE = 4; // death to zombie (death animation + decay)
const P0_DIES = 6;
const DURATION = 180;

export class ThePlague extends Minigame {
  static id = 'plague';
  static name = 'The Plague';
  static desc = 'Avoid contact with the plague! Patient zero falls at 6 seconds and rises as a zombie as fast as you are. Two bites kill, and every acolyte who dies rises as a zombie under its player\'s control. Last acolyte standing wins.';
  static controls = 'Right-click to move; right-click a unit to attack it (acolytes also swing at anything next to them). Once you die, you control your zombie: hunt the living.';
  static duration = DURATION;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.pillars = PILLARS.map(([x, y]) => ({ x: wc3(x), y: wc3(-y), r: PILLAR_R }));
    this.map = {
      theme: 'plague',
      floor: { shape: 'rect', w: HALF * 2, h: HALF * 2 },
      props: [],
      pillars: this.pillars.map((p) => [round2(p.x), round2(p.y)]),
      half: round2(HALF),
      cut: round2(CUT),
      build: ['plague'],
      bounds: HALF + 2,
    };
    this.out = new Set();
    // Each acolyte starts at a random point 100-300 u from the centre, facing anywhere.
    const spot = () => {
      const a = rand(0, Math.PI * 2);
      const r = wc3(rand(100, 300));
      return [Math.cos(a) * r, Math.sin(a) * r];
    };
    this.spawnHeroes(this.pids.map(spot), { hp: ACOLYTE.hp, speed: ACOLYTE.speed, r: ACOLYTE.r, facing: rand(-3, 3) });
    for (const u of this.heroes.values()) {
      this.arm(u, ACOLYTE);
      u.skin = 'acolyte';
      u.setFacing(rand(-Math.PI, Math.PI));
    }
    const [px, py] = spot();
    const p0 = new Unit({ kind: 'plnpc', x: px, y: py, r: ACOLYTE.r, speed: ACOLYTE.speed, hp: ACOLYTE.hp });
    this.arm(p0, ACOLYTE);
    p0.setFacing(rand(-Math.PI, Math.PI));
    this.npcs = [p0];
    this.p0 = p0;
    this.aiT = rand(0, 4);
  }

  // Gives a unit the acolyte's or the zombie's stats.
  arm(u, S) {
    u.zombie = S === ZOMBIE;
    u.hp = u.maxHp = S.hp;
    u.speed = S.speed;
    u.r = S.r;
    u.regen = S.regen || 0;
    u.weapon = S.weapon;
    u.acquireR = S.acquire;
    u.atkCd = 0;
    u.atkTarget = null;
    u.swing = null;
    u.chase = false;
  }

  // A player counts as out once their acolyte has died.
  get alive() {
    return this.pids.filter((p) => !this.out.has(p));
  }

  allUnits() {
    return [...this.heroes.values(), ...this.npcs];
  }

  // Who `u` may attack: acolytes hit anything hostile; zombies hunt acolytes.
  hostile(u, v) {
    if (v === u || !v.alive) return false;
    if (u.owner != null && v.owner === u.owner) return false;
    if (u.zombie) return !v.zombie;
    return true;
  }

  command(pid, m) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return;
    if (m.c === 'move') {
      const x = +m.x || 0;
      const y = +m.y || 0;
      let best = null;
      let bd = 0.9;
      for (const v of this.allUnits()) {
        if (!this.hostile(u, v)) continue;
        const d = dist(x, y, v.x, v.y) - v.r;
        if (d < bd) {
          bd = d;
          best = v;
        }
      }
      u.atkTarget = best;
      u.chase = !!best;
      if (best) return;
    } else if (m.c === 'steer' || m.c === 'stop') {
      u.atkTarget = null;
      u.chase = false;
    }
    super.command(pid, m);
  }

  tick(dt) {
    if (this.p0.alive && !this.p0.zombie && this.time >= P0_DIES) this.kill(this.p0);
    // Computer players: every 4 s each of their units moves 200-400 u outward (+-120 degrees).
    this.aiT -= dt;
    if (this.aiT <= 0) {
      this.aiT += 4;
      for (const [pid, u] of this.heroes) {
        if (!this.bots.has(pid) || !u.alive) continue;
        // (Ours skip it while running from a zombie.)
        if (!u.zombie && this.allUnits().some((v) => v.alive && v.zombie && dist(u.x, u.y, v.x, v.y) < wc3(400))) continue;
        const [x, y] = outwardPoint(u, wc3(200), wc3(400), HALF - 0.4);
        u.atkTarget = null;
        u.order(x, y);
      }
    }
    // Corpses rise as zombies.
    for (const u of this.allUnits()) {
      if (u.alive || u.riseT == null) continue;
      u.riseT -= dt;
      if (u.riseT <= 0) this.rise(u);
    }
    for (const u of this.allUnits()) {
      if (!u.alive) continue;
      if (u.atkTarget && !this.hostile(u, u.atkTarget)) u.atkTarget = null;
      // Idle zombies go for whatever comes within their acquisition range.
      if (u.zombie && !u.atkTarget && !u.swing && !u.target) {
        // Zombies of computer slots (patient zero's is Player 12, a computer slot) get acquisition 2000.
        const bot = u.owner == null || this.bots.has(u.owner);
        const t = this.nearestHostile(u, bot ? ZOMBIE.botAcquire : u.acquireR);
        if (t) {
          u.atkTarget = t;
          u.chase = true;
        }
      }
      if (meleeStep(u, dt, (a, t, dmg) => this.hurt(t, dmg)) === 'swing') this.ev({ k: 'swing', u: u.id });
    }
    stepUnits(this.npcs, dt);
    this.stepHeroes(dt);
    const all = this.allUnits();
    collideUnits(all);
    for (const u of all) {
      if (!u.alive) continue;
      avoidObstacles(u, this.pillars);
      this.confine(u);
    }
  }

  confine(u) {
    u.x = Math.max(-HALF + u.r, Math.min(HALF - u.r, u.x));
    u.y = Math.max(-HALF + u.r, Math.min(HALF - u.r, u.y));
    const over = Math.abs(u.x) + Math.abs(u.y) - (CUT - u.r * 1.41);
    if (over > 0) {
      u.x -= (Math.sign(u.x) * over) / 2;
      u.y -= (Math.sign(u.y) * over) / 2;
    }
  }

  nearestHostile(u, range) {
    let best = null;
    let bd = range;
    for (const v of this.allUnits()) {
      if (!this.hostile(u, v)) continue;
      const d = gap(u, v);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  hurt(v, dmg) {
    if (!v.alive) return;
    this.ev({ k: 'hit', x: round2(v.x), y: round2(v.y) });
    this.ev({ k: 'dmg', x: round2(v.x), y: round2(v.y), n: Math.round(dmg) });
    v.hp -= dmg;
    if (v.hp <= 0) this.kill(v);
  }

  kill(v) {
    v.hp = 0;
    v.alive = false;
    v.target = null;
    v.walking = false;
    v.atkTarget = null;
    v.swing = null;
    v.riseT = RISE;
    this.ev({ k: 'death', x: round2(v.x), y: round2(v.y), u: v.id });
    const pid = v.owner;
    if (pid != null && !v.zombie && !this.out.has(pid)) {
      this.out.add(pid);
      this.elimOrder.push({ pid, t: this.time });
      this.party.msg(`${this.party.room.nameOf(pid)} has caught the plague!`, this.party.room.colorOf(pid));
    }
    for (const u of this.allUnits()) if (u.atkTarget === v) u.atkTarget = null;
  }

  rise(u) {
    u.riseT = null;
    this.arm(u, ZOMBIE);
    u.alive = true;
    u.stop();
    if (u.owner == null) u.id = newId();
    else u.skin = 'zombie';
    this.ev({ k: 'plrise', x: round2(u.x), y: round2(u.y) });
  }

  // Deviation: computer acolytes run from zombies closing in (see header):
  // of 16 directions, the one that keeps farthest from every zombie a second
  // from now without running into a wall or a pillar.
  botThink(pid, u, mem) {
    if (u.zombie) return;
    const zs = this.allUnits().filter((v) => v.alive && v.zombie);
    const close = zs.filter((v) => dist(u.x, u.y, v.x, v.y) < wc3(250 + 300 * mem.skill));
    if (!close.length || Math.random() > 0.35 + mem.skill * 0.6) return;
    let best = null;
    let bs = -Infinity;
    const step = u.speed * 1.2;
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const x = u.x + Math.cos(ang) * step;
      const y = u.y + Math.sin(ang) * step;
      let sc = Math.min(...close.map((v) => dist(x, y, v.x, v.y)));
      const wall = Math.min(HALF - Math.abs(x), HALF - Math.abs(y), (CUT - Math.abs(x) - Math.abs(y)) / 1.41);
      if (wall < 0.3) sc -= 4;
      else sc += Math.min(3, wall) * 0.6;
      for (const pl of this.pillars) if (dist(x, y, pl.x, pl.y) < pl.r + u.r + 0.2) sc -= 3;
      // Keep running the same way rather than zig-zagging (every turn loses ground).
      if (mem.fleeA != null) sc += 0.5 * Math.cos(ang - mem.fleeA);
      if (sc > bs) {
        bs = sc;
        best = [x, y, ang];
      }
    }
    mem.fleeA = best[2];
    u.atkTarget = null;
    u.order(best[0], best[1]);
  }

  hud(pid) {
    const n = this.alive.length;
    const u = this.heroes.get(pid);
    if (u?.zombie) return { label: `You are a zombie: hunt the living! · Acolytes left ${n}` };
    return { label: `Acolytes left ${n}` };
  }

  worldEnts() {
    return this.npcs.map((u) => {
      const e = { id: u.id, k: u.zombie ? 'plzombie' : 'placolyte', x: round2(u.x), y: round2(u.y), f: round2(u.facing) };
      if (!u.alive) e.dead = 1;
      if (u.mx || u.my) e.mv = 1;
      if (u.swing) e.sw = 1;
      return e;
    });
  }
}
