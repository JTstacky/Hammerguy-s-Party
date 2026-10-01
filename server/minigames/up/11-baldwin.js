import { Minigame } from '../../base.js';
import { rand, dist, round1, round2, wc3, shuffle, newId, clamp, Unit, stepUnits } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';

// Uther Party 4.0 #11 "Bomb Baldwin" (docs/uther-party/rules-4.0.md).
//  - A 1664x1664 field with a Farm in the middle. Each player flies a
//    Flying Machine (speed 400, collision 8), starting 700 u from the centre
//    on one of eight spots 45 degrees apart, handed out at random.
//  - Its only weapon is ground bombs: range 100, cooldown 2.5 s, 11-12
//    damage. Right-click a peasant to bomb it; an idle machine also bombs
//    whatever walks under it (acquisition 100; computer machines 1000).
//  - Everyone is frozen for 5 s. Then 50 "Not Baldwin" peasants, one
//    "Baldwin" per player and 50 more "Not Baldwin"s come out round the farm
//    and wander. All have 5 HP and look the same: only the name, shown when
//    you point at one, tells them apart. The first two batches wear brown;
//    the last 50 decoys keep the default black of neutral hostile (an
//    oddity of the original: a Baldwin is never black).
//  - A bombed peasant's neighbours within 200 u run (CreepCallForHelp on
//    unarmed creeps), which scatters the crowd.
//  - Race: bombing a Baldwin finishes you (8, 7, 6 ...) and your machine
//    leaves. 60 s including the 5 s freeze; anyone left then scores 0.
export const HW = wc3(832);
export const FLYER = { hp: 200, speed: wc3(400), r: wc3(8), ring: wc3(700) };
export const BOMB = { range: wc3(100), cd: 2.5, point: 0.3, acq: wc3(100), botAcq: wc3(1000) };
export const PEASANT = { hp: 5, speed: wc3(190), r: wc3(16), decoys: 100 };
export const FREEZE = 5;
const FARM_R = wc3(96);
const HELP = wc3(200);

export class BombBaldwin extends Minigame {
  static id = 'baldwin';
  static name = 'Bomb Baldwin';
  static desc = 'Find and kill Baldwin! A crowd of a hundred peasants wanders round the farm, and a few of them are called Baldwin. They all look alike: point at one to read its name, then bomb it. Every Baldwin bombed finishes a player, first to last.';
  static controls = 'Right-click a peasant to bomb it (range 100, one bomb every 2.5 s); right-click the ground to fly. Point at a peasant (hold a finger on it) to see its name.';
  static duration = 60;
  static ranking = 'race';

  setup() {
    this.map = {
      theme: 'grass',
      floor: { shape: 'rect', w: HW * 2, h: HW * 2 },
      props: treesAroundRect(HW, HW, 0.45, 2.4),
      bounds: HW - 8,
      build: ['baldwin'],
      farmR: round2(FARM_R),
    };
    const spots = shuffle(Array.from({ length: 8 }, (_, k) => {
      const a = ((22.5 + 45 * k) * Math.PI) / 180;
      return [Math.cos(a) * FLYER.ring, Math.sin(a) * FLYER.ring];
    }));
    this.attack = { range: BOMB.range, cd: BOMB.cd, point: BOMB.point, dmg: 12, missile: 0 };
    this.spawnHeroes(this.pids.map((_, i) => spots[i % 8]), { hp: FLYER.hp, speed: FLYER.speed, r: FLYER.r });
    for (const u of this.heroes.values()) u.skin = 'flyingmachine';
    this.peasants = [];
    this.gone = new Set(); // finished machines, removed from the field
    this.crowdId = newId();
  }

  spawnPeasants() {
    const add = (baldwin, dark) => {
      const a = rand(0, Math.PI * 2);
      const r = FARM_R + PEASANT.r + rand(0, wc3(14));
      const p = new Unit({ kind: 'peasant', x: Math.cos(a) * r, y: Math.sin(a) * r, r: PEASANT.r, speed: PEASANT.speed, hp: PEASANT.hp });
      p.setFacing(a);
      p.baldwin = baldwin;
      p.dark = dark;
      p.idle = 0;
      p.order(rand(-HW, HW) * 0.9, rand(-HW, HW) * 0.9);
      this.peasants.push(p);
    };
    for (let i = 0; i < PEASANT.decoys / 2; i++) add(false, false);
    for (let i = 0; i < this.pids.length; i++) add(true, false);
    for (let i = 0; i < PEASANT.decoys / 2; i++) add(false, true);
    this.ev({ k: 'sfx', s: 'start' });
  }

  command(pid, m) {
    if (this.time < FREEZE || this.gone.has(pid)) return;
    super.command(pid, m);
  }

  attackables() {
    return this.peasants.filter((p) => p.alive);
  }

  attackHit(pid, u, tgt) {
    if (!tgt.alive) return;
    tgt.alive = false;
    tgt.hp = 0;
    this.ev({ k: 'bbomb', x: round2(tgt.x), y: round2(tgt.y) });
    // Neighbours run from the attacker.
    for (const p of this.peasants) {
      if (!p.alive || dist(p.x, p.y, tgt.x, tgt.y) > HELP) continue;
      const a = Math.atan2(p.y - u.y, p.x - u.x) + rand(-0.6, 0.6);
      const d = wc3(rand(350, 600));
      p.order(clamp(p.x + Math.cos(a) * d, -HW + 0.5, HW - 0.5), clamp(p.y + Math.sin(a) * d, -HW + 0.5, HW - 0.5));
      p.idle = rand(1, 3);
    }
    if (tgt.baldwin && !this.finishOrder.includes(pid)) {
      this.ev({ k: 'txt', x: round2(tgt.x), y: round2(tgt.y), s: 'Baldwin!', c: '#ffd700' });
      this.finish(pid);
      this.gone.add(pid);
      u.attackOrder = null;
      u.swing = null;
      u.stop();
      this.ev({ k: 'tele', x1: round2(u.x), y1: round2(u.y), x2: round2(u.x), y2: round2(u.y) });
      this.party.msg(`${this.party.room.nameOf(pid)} bombed a Baldwin!`, this.party.room.colorOf(pid));
    }
  }

  tick(dt) {
    if (this.time >= FREEZE && !this.spawned) {
      this.spawned = true;
      this.spawnPeasants();
    }
    for (const p of this.peasants) {
      if (!p.alive) continue;
      // Wander: pause, then stroll somewhere nearby.
      if (!p.target) {
        p.idle -= dt;
        if (p.idle <= 0) {
          p.idle = rand(1, 5);
          const a = rand(0, Math.PI * 2);
          const d = wc3(rand(100, 400));
          p.order(clamp(p.x + Math.cos(a) * d, -HW + 0.5, HW - 0.5), clamp(p.y + Math.sin(a) * d, -HW + 0.5, HW - 0.5));
        }
      }
    }
    stepUnits(this.peasants, dt);
    for (const p of this.peasants) {
      if (!p.alive) continue;
      p.x = clamp(p.x, -HW + p.r, HW - p.r);
      p.y = clamp(p.y, -HW + p.r, HW - p.r);
      const d = Math.hypot(p.x, p.y);
      const min = FARM_R + p.r;
      if (d < min) {
        p.x *= min / (d || 0.01);
        p.y *= min / (d || 0.01);
        if (p.target && Math.hypot(p.target.x, p.target.y) < min) p.stop();
      }
    }
    this.peasants = this.peasants.filter((p) => p.alive);
    // Idle machines bomb whatever comes within their acquisition range.
    for (const [pid, u] of this.heroes) {
      if (this.time < FREEZE || this.gone.has(pid) || u.target || u.attackOrder || u.swing) continue;
      const acq = this.bots.has(pid) ? BOMB.botAcq : BOMB.acq;
      let best = null;
      let bd = acq;
      for (const p of this.peasants) {
        const d = dist(u.x, u.y, p.x, p.y) - u.r - p.r;
        if (d <= bd) {
          bd = d;
          best = p;
        }
      }
      if (best) u.attackOrder = best;
    }
    this.stepHeroes(dt);
    for (const u of this.heroes.values()) {
      u.x = clamp(u.x, -HW + 0.3, HW - 0.3);
      u.y = clamp(u.y, -HW + 0.3, HW - 0.3);
    }
  }

  // Computer machines have no script of their own: acquisition 1000 does it.
  botThink() {}

  isDone() {
    if (this.time >= this.meta.duration) {
      this.timedOut = true;
      return true;
    }
    return this.finishOrder.length >= this.pids.length;
  }

  hud() {
    const left = this.pids.length - this.finishOrder.length;
    if (this.time < FREEZE) return { label: `Get ready: ${Math.ceil(FREEZE - this.time)}` };
    return { label: `${left} Baldwin${left === 1 ? '' : 's'} left to find` };
  }

  heroEnts(pid) {
    return super.heroEnts(pid).filter((e) => !this.gone.has(e.o));
  }

  worldEnts() {
    const ents = [{ id: this.crowdId, k: 'bbcrowd', x: 0, y: 0 }];
    for (const p of this.peasants) {
      const e = { id: p.id, k: 'peasant', x: round1(p.x), y: round1(p.y), f: round1(p.facing) };
      if (p.mx || p.my) e.mv = 1;
      if (p.baldwin) e.b = 1;
      if (p.dark) e.d = 1;
      ents.push(e);
    }
    return ents;
  }
}
