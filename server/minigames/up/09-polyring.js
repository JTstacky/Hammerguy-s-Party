import { Minigame } from '../../base.js';
import { rand, dist, round2, wc3, collideUnits, stepUnits, newId, clamp } from '../../../engine/server/sim.js';
import { makeMob, meleeTick, mobSnap } from './lib-f-mob.js';

// Uther Party 4.0 #9 "The Polymorph Ring" (docs/uther-party/rules-4.0.md).
//  - An octagonal 1280x1280 room. Sorceresses (5 HP, speed 220) start 500 u
//    from the centre with 400 mana that never regenerates.
//  - Q Slow: 100 mana, cooldown 8, range 700: -60 % move speed (and -25 %
//    attack speed) for 20 s, or 10 s on a sorceress (Resistant Skin).
//    W Invisibility: 300 mana, range 300 (self allowed), 10 s; hidden from
//    the monsters and from rivals, broken by casting. E Polymorph: 200 mana,
//    cooldown 10, range 500: a Sasquatch becomes a harmless sheep for 25 s.
//    Resistant Skin is taken to block Polymorph on sorceresses (the sheet's
//    reading of the engine).
//  - Ancient Sasquatches (speed 220, acquisition 300, range 128, cooldown
//    1.35, 61-68 chaos: one hit kills) come from the centre: from 5 s the
//    Spawn trigger ticks every 10 s and, while there are fewer than 8, adds
//    one after 0-5 s. Every 2.5 s each is ordered to attack-move to a random
//    point in the room, biting whatever it meets within 300 u.
//  - Survival, no ties, no timer: when the last two die in the same instant
//    the second one processed wins, as in the original.
export const HALF = wc3(640);
export const OCT = wc3(960); // |x| + |y| limit of the cut corners
export const SORC = { hp: 5, speed: wc3(220), r: wc3(16), mana: 400, castPoint: 0.3 };
export const SLOW = { mana: 100, cd: 8, range: wc3(700), dur: 20, durHero: 10, mult: 0.4 };
export const INVIS = { mana: 300, range: wc3(300), dur: 10 };
export const POLY = { mana: 200, cd: 10, range: wc3(500), dur: 25 };
export const SAS = { hp: 1200, speed: wc3(220), r: wc3(32), acq: wc3(300), range: wc3(128), cd: 1.35, point: 0.5, cap: 8, sheepSpeed: wc3(150) };

export class PolymorphRing extends Minigame {
  static id = 'polyring';
  static name = 'The Polymorph Ring';
  static desc = 'Survive as long as possible! Sasquatches keep coming out of the centre, as fast as you are, and one hit kills. You have 400 mana and it never comes back: Slow, Invisibility and Polymorph have to count. Last sorceress standing wins.';
  static controls = 'Right-click to move. Q Slow (100 mana), W Invisibility (300, can target yourself), E Polymorph a Sasquatch into a sheep (200). Then click a target.';
  static duration = 400;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.map = {
      theme: 'polyring',
      floor: { shape: 'rect', w: HALF * 2, h: HALF * 2 },
      props: [],
      bounds: 5,
      build: ['polyring'],
      half: round2(HALF),
      oct: round2(OCT),
    };
    this.mana = new Map(this.pids.map((p) => [p, SORC.mana]));
    this.invis = new Map(); // pid -> seconds left
    this.slowed = new Map(); // unit -> seconds left
    const cost = (m) => (pid) => this.mana.get(pid) >= m;
    this.abilities = [
      {
        name: 'Slow', icon: '🐌', desc: 'Slows a target by 60 % for 20 s (10 s on a sorceress). 100 mana.',
        kind: 'unit', cd: SLOW.cd, range: SLOW.range, castPoint: SORC.castPoint, available: cost(SLOW.mana),
        pickTarget: (pid, u, x, y) => this.pick(pid, u, x, y, SLOW.range, { sas: true, sorc: true }),
        cast: (pid, u, tgt) => this.castSlow(pid, u, tgt.u),
      },
      {
        name: 'Invisibility', icon: '👻', desc: 'Makes a sorceress (yourself too) invisible for 10 s: the Sasquatches can\'t see her. Casting breaks it. 300 mana.',
        kind: 'unit', cd: 0, range: INVIS.range, castPoint: SORC.castPoint, available: cost(INVIS.mana),
        pickTarget: (pid, u, x, y) => this.pick(pid, u, x, y, INVIS.range, { sorc: true, self: true }),
        cast: (pid, u, tgt) => this.castInvis(pid, u, tgt.u),
      },
      {
        name: 'Polymorph', icon: '🐑', desc: 'Turns a Sasquatch into a harmless sheep for 25 s. 200 mana.',
        kind: 'unit', cd: POLY.cd, range: POLY.range, castPoint: SORC.castPoint, available: cost(POLY.mana),
        pickTarget: (pid, u, x, y) => this.pick(pid, u, x, y, POLY.range, { sas: true }),
        cast: (pid, u, tgt) => this.castPoly(pid, u, tgt.u),
      },
    ];
    this.spawnHeroes(
      this.pids.map(() => {
        const a = rand(0, Math.PI * 2);
        return [Math.cos(a) * wc3(500), Math.sin(a) * wc3(500)];
      }),
      { hp: SORC.hp, speed: SORC.speed, r: SORC.r },
    );
    for (const u of this.heroes.values()) u.skin = 'sorceress';
    this.sas = [];
    this.pending = []; // spawn delays
    // Spawn is a 10 s periodic enabled at 5 s: its first tick comes 0-10 s later.
    this.nextSpawn = 5 + rand(0, 10);
    this.patrolT = rand(0, 2.5);
    this.centreId = newId();
  }

  // The unit under the click that this spell may target.
  pick(pid, u, x, y, range, { sas = false, sorc = false, self = false }) {
    const cands = [];
    if (sas) for (const s of this.sas) if (s.alive) cands.push(s);
    if (sorc) for (const [op, v] of this.heroes) if (v.alive && (self || op !== pid) && (op === pid || !this.invis.has(op))) cands.push(v);
    let best = null;
    let bd = 1.6;
    for (const v of cands) {
      const d = dist(x, y, v.x, v.y) - v.r;
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    if (!best && self && dist(x, y, u.x, u.y) < 2.5) best = u;
    if (!best || dist(u.x, u.y, best.x, best.y) > range + best.r + u.r) return null;
    return { x: best.x, y: best.y, u: best };
  }

  spend(pid, m) {
    this.mana.set(pid, this.mana.get(pid) - m);
    this.invis.delete(pid); // casting breaks invisibility
  }

  castSlow(pid, u, t) {
    if (!t?.alive || this.mana.get(pid) < SLOW.mana) return;
    this.spend(pid, SLOW.mana);
    const hero = this.heroes.get(t.owner) === t;
    this.slowed.set(t, hero ? SLOW.durHero : SLOW.dur);
    this.ev({ k: 'prslow', x1: round2(u.x), y1: round2(u.y), x2: round2(t.x), y2: round2(t.y), u: t.id });
  }

  castInvis(pid, u, t) {
    if (!t?.alive || this.mana.get(pid) < INVIS.mana) return;
    this.spend(pid, INVIS.mana);
    this.invis.set(t.owner, INVIS.dur);
    for (const s of this.sas) if (s.tgt === t) s.tgt = null;
    this.ev({ k: 'prinvis', x: round2(t.x), y: round2(t.y) });
  }

  castPoly(pid, u, t) {
    if (!t?.alive || this.mana.get(pid) < POLY.mana) return;
    this.spend(pid, POLY.mana);
    t.sheep = POLY.dur;
    t.tgt = null;
    t.swing = null;
    this.ev({ k: 'prpoly', x: round2(t.x), y: round2(t.y), x1: round2(u.x), y1: round2(u.y) });
  }

  spawnSas() {
    const s = makeMob('sasquatch', rand(-0.2, 0.2), rand(-0.2, 0.2), { speed: SAS.speed, r: SAS.r, hp: SAS.hp, acq: SAS.acq, range: SAS.range, cd: SAS.cd, point: SAS.point });
    s.setFacing(rand(-Math.PI, Math.PI));
    s.sheep = 0;
    this.sas.push(s);
    this.ev({ k: 'tele', x1: 0, y1: 0, x2: 0, y2: 0 });
    this.ev({ k: 'sfx', s: 'teleport' });
  }

  randomPoint() {
    for (;;) {
      const x = rand(-HALF, HALF);
      const y = rand(-HALF, HALF);
      if (Math.abs(x) + Math.abs(y) <= OCT) return [x, y];
    }
  }

  tick(dt) {
    // Spawn: periodic every 10 s, enabled at 5 s.
    const t = this.time;
    if (t >= this.nextSpawn) {
      this.nextSpawn += 10;
      if (this.sas.length + this.pending.length < SAS.cap) this.pending.push(rand(0, 5));
    }
    this.pending = this.pending.map((d) => d - dt);
    while (this.pending.length && this.pending[0] <= 0) {
      this.pending.shift();
      this.spawnSas();
    }
    this.patrolT -= dt;
    if (this.patrolT <= 0) {
      this.patrolT += 2.5;
      for (const s of this.sas) {
        s.tgt = null;
        const [x, y] = this.randomPoint();
        s.order(x, y);
      }
    }
    for (const [pid, left] of this.invis) {
      if (left - dt <= 0 || !this.heroes.get(pid).alive) this.invis.delete(pid);
      else this.invis.set(pid, left - dt);
    }
    for (const [unit, left] of this.slowed) {
      if (left - dt <= 0 || !unit.alive) {
        this.slowed.delete(unit);
        unit.speedMult = 1;
      } else {
        this.slowed.set(unit, left - dt);
        unit.speedMult = SLOW.mult;
      }
    }
    const visible = [...this.heroes.entries()].filter(([pid, u]) => u.alive && !this.invis.has(pid)).map(([, u]) => u);
    for (const s of this.sas) this.stepSas(s, visible, dt);
    stepUnits(this.sas, dt);
    this.stepHeroes(dt);
    const all = [...this.heroes.values(), ...this.sas];
    collideUnits(all);
    for (const u of all) if (u.alive) this.keepIn(u);
  }

  stepSas(s, visible, dt) {
    if (s.sheep > 0) {
      s.sheep -= dt;
      s.speed = SAS.sheepSpeed;
      if (s.sheep <= 0) {
        s.speed = SAS.speed;
        this.ev({ k: 'prpoly', x: round2(s.x), y: round2(s.y) });
      }
      return;
    }
    const slow = this.slowed.has(s);
    s.atk.cd = slow ? SAS.cd / 0.75 : SAS.cd;
    if (s.tgt && (!s.tgt.alive || !visible.includes(s.tgt))) {
      s.tgt = null;
      s.swing = null;
    }
    if (!s.tgt) {
      let best = null;
      let bd = s.acq;
      for (const v of visible) {
        const d = dist(s.x, s.y, v.x, v.y);
        if (d <= bd) {
          bd = d;
          best = v;
        }
      }
      s.tgt = best;
    }
    if (!s.tgt) return;
    const busy = meleeTick(s, dt, (v) => this.smash(v));
    if (!busy) s.steer(s.tgt.x, s.tgt.y);
  }

  smash(v) {
    this.ev({ k: 'hit', x: round2(v.x), y: round2(v.y) });
    this.damage(v.owner, 61 + Math.floor(Math.random() * 8), 'death');
  }

  // No ties: players out in the same instant still rank one after another,
  // and if the last two die together the second one processed wins.
  eliminate(pid, how) {
    const alive = this.alive;
    if (alive.length === 1 && alive[0] === pid && this.elimOrder.some((e) => e.t === this.time)) {
      const u = this.heroes.get(pid);
      u.hp = Math.max(u.hp, 1);
      return;
    }
    super.eliminate(pid, how);
  }

  deathGroups() {
    return this.elimOrder.map((e) => [e.pid]);
  }

  keepIn(u) {
    const m = HALF - u.r;
    u.x = clamp(u.x, -m, m);
    u.y = clamp(u.y, -m, m);
    const lim = OCT - u.r * Math.SQRT2;
    const s = Math.abs(u.x) + Math.abs(u.y);
    if (s > lim) {
      const k = (s - lim) / 2;
      u.x -= Math.sign(u.x) * k;
      u.y -= Math.sign(u.y) * k;
    }
  }

  // Computer sorceresses (from 5 s, every 2 s): move 200-500 u in a
  // direction within 120 degrees of straight out from the centre, then half the time cast Slow
  // or Polymorph on a random unit within 400 u (which may not be allowed).
  botThink(pid, u, mem) {
    if (this.time < 5 || this.time < (mem.next ?? 0)) return;
    mem.next = this.time + 2;
    const a = Math.atan2(u.y, u.x) + rand(-1, 1) * ((120 * Math.PI) / 180);
    const r = wc3(rand(200, 500));
    u.order(u.x + Math.cos(a) * r, u.y + Math.sin(a) * r);
    const roll = Math.random();
    if (roll >= 0.5) return;
    const near = [...this.sas, ...[...this.heroes.values()].filter((v) => v !== u)].filter((v) => v.alive && dist(u.x, u.y, v.x, v.y) <= wc3(400));
    if (!near.length) return;
    const v = near[Math.floor(Math.random() * near.length)];
    this.useAbility(pid, roll < 0.25 ? 0 : 2, v.x, v.y);
  }

  hud(pid) {
    return { label: `Mana ${Math.floor(this.mana.get(pid) ?? 0)} / ${SORC.mana}` };
  }

  // Invisible sorceresses are left out of rivals' snapshots.
  heroEnts(pid) {
    return super.heroEnts(pid).flatMap((e) => {
      const owner = e.o;
      if (!this.invis.has(owner)) return [e];
      if (owner !== pid) return [];
      e.fx = [...(e.fx || []), 'invis'];
      return [e];
    });
  }

  worldEnts() {
    const ents = [{ id: this.centreId, k: 'prcentre', x: 0, y: 0 }];
    for (const s of this.sas) ents.push(mobSnap(s, { sh: s.sheep > 0 ? 1 : undefined, sl: this.slowed.has(s) ? 1 : undefined }));
    return ents;
  }
}
