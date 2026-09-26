import { Minigame } from '../../base.js';
import { Unit, stepUnits, collideUnits, rand, dist, round2, wc3 } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';
import { ringSpots, shuffled, nearest, idle, clampOct, dice, armorMult, typeMult, wAng, stopOnLostTarget } from './e-common.js';

// Uther Party 4.0 #28 "The Abombinations" (docs/uther-party/rules-4.0.md).
// A 1024x1024 blighted octagon with a portal in the middle. Every player is a
// rifleman (535 HP, speed 270) whose rifle hits instantly anywhere in the
// arena (range 2000, 18-24 pierce every 1.5 s). Abominations (100 HP that
// drain at 5/s, so 20 s to live; speed 400) come out of the portal and follow
// a random rifleman. When one dies it blows up: 700 damage within 150 u and
// 300 within 250 u to every ground unit, abominations included, so blasts
// chain. A new one comes every 10 s while fewer than 10 are out, and each
// death is replaced 1-3 s later. The trick is to shoot them next to someone
// else. Survival with ties (same blast, same place); no timer.
const HW = wc3(512);
const CUT = wc3(192);
export const RIFLE = { hp: 535, regen: 0.25, r: wc3(16), speed: wc3(270), range: wc3(2000), cd: 1.5, point: 0.17 };
export const ABOM = { hp: 100, decay: 5, r: wc3(48), speed: wc3(400), cap: 10 };
export const BLAST = [
  [wc3(150), 700],
  [wc3(250), 300],
];

export class Abombinations extends Minigame {
  static id = 'abom';
  static name = 'The Abombinations';
  static desc = 'Abominations crawl out of the portal and chase the riflemen. Shoot one and it explodes, killing everything close by, chain reactions included. Blow them up next to your rivals, never next to you. Last rifleman standing wins.';
  static controls = 'Right-click to move. Right-click an abomination (or a rival) to shoot; your rifle reaches the whole arena.';
  static duration = 600;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'blight', floor: { shape: 'rect', w: HW * 2, h: HW * 2 }, props: treesAroundRect(HW + 0.5, HW + 0.5, 0.4, 2.2), bounds: HW + 3, build: ['abom'], cut: round2(CUT) };
    this.attack = { range: RIFLE.range, cd: RIFLE.cd, point: RIFLE.point, missile: 0, art: 'bolt' };
    // Riflemen stand 384 u from the centre (slot x 135 - 22.5 degrees), handed out at random.
    this.spawnHeroes(shuffled(ringSpots(this.pids.length, 384)), { hp: RIFLE.hp, regen: RIFLE.regen, r: RIFLE.r, speed: RIFLE.speed });
    for (const u of this.heroes.values()) u.skin = 'rifleman';
    this.aboms = [];
    this.pending = []; // replacement spawns (seconds left)
    // Spawn is periodic (10 s) from map load; it is switched on at t=5.
    this.spawnT = rand(0, 10);
  }

  attackables(pid) {
    return [...this.aboms.filter((a) => a.alive), ...[...this.heroes.values()].filter((v) => v.alive && v.owner !== pid)];
  }

  // Instant hit: 16 + 2d4 pierce. Abominations have heavy armour 2; riflemen medium 0.
  attackHit(pid, u, tgt) {
    const raw = 16 + dice(2, 4);
    this.ev({ k: 'rifle', x1: round2(u.x), y1: round2(u.y), x2: round2(tgt.x), y2: round2(tgt.y), u: u.id });
    if (tgt.kind === 'abom') {
      this.hurtAbom(tgt, raw * typeMult('pierce', 'heavy') * armorMult(2));
      this.detonate();
    } else this.damage(tgt.owner, raw * typeMult('pierce', 'medium'));
  }

  hurtAbom(a, dmg) {
    if (!a.alive || a.boom) return;
    a.hp -= dmg;
    if (a.hp <= 0) a.boom = true;
  }

  // Blow up every abomination at 0 HP; their blasts can set off others in the same instant.
  detonate() {
    for (let guard = 0; guard < 20; guard++) {
      const now = this.aboms.filter((a) => a.alive && a.boom);
      if (!now.length) return;
      for (const a of now) a.alive = false;
      for (const a of now) this.blast(a);
    }
  }

  blast(a) {
    this.ev({ k: 'abomboom', x: round2(a.x), y: round2(a.y), r: round2(BLAST[1][0]) });
    const hurt = (v) => {
      const d = dist(a.x, a.y, v.x, v.y);
      const tier = BLAST.find(([r]) => d <= r + v.r);
      return tier ? tier[1] : 0;
    };
    for (const [pid, v] of this.heroes) {
      if (!v.alive) continue;
      const n = hurt(v);
      if (n) this.damage(pid, n, 'squish');
    }
    for (const b of this.aboms) {
      if (!b.alive || b.boom) continue;
      const n = hurt(b);
      if (n) this.hurtAbom(b, n);
    }
    // Abominations Death: a replacement 1-3 s later.
    this.pending.push(rand(1, 3));
  }

  spawnAbom() {
    if (this.aboms.filter((a) => a.alive).length >= ABOM.cap) return;
    const a = new Unit({ kind: 'abom', x: rand(-0.1, 0.1), y: rand(-0.1, 0.1), r: ABOM.r, speed: ABOM.speed, hp: ABOM.hp });
    // Ordered to follow a random rifleman, dead ones included.
    a.follow = [...this.heroes.values()][Math.floor(Math.random() * this.heroes.size)];
    a.setFacing(Math.atan2(a.follow.y, a.follow.x));
    a.wander = 0;
    this.aboms.push(a);
    this.ev({ k: 'portal', x: 0, y: 0 });
  }

  stepAboms(dt) {
    for (const a of this.aboms) {
      if (!a.alive) continue;
      // HP regen -5/s: a 20 s fuse.
      this.hurtAbom(a, ABOM.decay * dt);
      const t = a.follow;
      if (t?.alive) {
        const gap = dist(a.x, a.y, t.x, t.y) - a.r - t.r;
        if (gap > wc3(20)) {
          if (a.target) a.steer(t.x, t.y);
          else a.order(t.x, t.y);
        } else a.stop();
      } else {
        // The follow order fails on a corpse; Wander takes over.
        a.wander -= dt;
        if (a.wander <= 0) {
          a.wander = rand(1.5, 4);
          const ang = rand(0, Math.PI * 2);
          a.order(a.x + Math.cos(ang) * wc3(300), a.y + Math.sin(ang) * wc3(300));
        }
      }
    }
    this.detonate();
  }

  tick(dt) {
    if (this.time >= 5) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT += 10;
        this.spawnAbom();
      }
    }
    this.pending = this.pending.map((t) => t - dt);
    while (this.pending.length && this.pending.some((t) => t <= 0)) {
      this.pending.splice(this.pending.findIndex((t) => t <= 0), 1);
      this.spawnAbom();
    }
    // Acquisition 100 for players (so a hugging abomination gets shot), 2000 for computers.
    for (const [pid, u] of this.heroes) {
      if (!idle(u)) continue;
      const v = nearest(u, this.attackables(pid), this.bots.has(pid) ? RIFLE.range : wc3(100));
      if (v) u.attackOrder = v;
    }
    this.stepAboms(dt);
    stepUnits(this.aboms.filter((a) => a.alive), dt);
    stopOnLostTarget(this.heroes.values(), () => this.stepHeroes(dt));
    const all = [...this.heroes.values(), ...this.aboms].filter((u) => u.alive);
    collideUnits(all);
    for (const u of all) clampOct(u, HW, CUT);
    this.aboms = this.aboms.filter((a) => a.alive);
  }

  // The original AI: every 4 s, walk 200-400 u away from the centre give or
  // take 120 degrees; in between, acquisition 2000 shoots the nearest enemy.
  botThink(pid, u, mem) {
    if (this.time < 5) return;
    mem.next ??= this.time + rand(0, 4);
    if (this.time < mem.next) return;
    mem.next += 4;
    const a = Math.atan2(u.y, u.x) + wAng(rand(-120, 120));
    const d = wc3(rand(200, 400));
    u.attackOrder = null;
    u.swing = null;
    u.order(u.x + Math.cos(a) * d, u.y + Math.sin(a) * d);
  }

  hud() {
    return { label: `Abominations: ${this.aboms.length} / ${ABOM.cap}` };
  }

  worldEnts() {
    return this.aboms.map((a) => {
      const e = { id: a.id, k: 'abom', x: round2(a.x), y: round2(a.y), f: round2(a.facing), l: round2(Math.max(0, a.hp) / ABOM.hp) };
      if (a.mx || a.my) e.mv = 1;
      return e;
    });
  }
}
