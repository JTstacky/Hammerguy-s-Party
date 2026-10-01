import { Minigame } from '../../base.js';
import { newId, rand, dist, clampToRect, round2, wc3 } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';

const HW = wc3(656);
const HH = wc3(640);
export const CAR = { hp: 100, speed: wc3(250), r: wc3(40), turnRate: 0.1 };
export const RABBIT = { count: 10, speed: wc3(525), aura: wc3(100), xp: 13, levelXp: 200, kills: 16 };

// Ultima-X #159: invulnerable Meat Wagons race to level two by driving
// through bunnies. Normal XP is disabled; each roadkill awards 13 XP.
export class BadFurDay extends Minigame {
  static id = 'ux-badfur';
  static name = 'Bad Fur Day';
  static desc = 'Drive over rabbits. Sixteen roadkills reach level two and finish the race.';
  static controls = 'Right-click or use the joystick to steer the slow-turning car.';
  static duration = 130;
  static ranking = 'race';

  setup() {
    this.map = { theme: 'night', floor: { shape: 'rect', w: HW * 2, h: HH * 2 },
      props: treesAroundRect(HW, HH, 0.22), bounds: HW + 3 };
    this.spawnHeroes(this.pids.map((_, i) => {
      const a = i * Math.PI / 4;
      return [Math.cos(a) * wc3(400), Math.sin(a) * wc3(400)];
    }), CAR);
    for (const u of this.heroes.values()) { u.skin = 'uxmeatwagon'; u.xp = 0; u.kills = 0; }
    this.rabbits = [];
    this.rainId = newId();
    this.auraT = 0;
    this.predict = false;
  }

  spawnRabbit() {
    this.rabbits.push({ id: newId(), x: rand(-HW, HW), y: rand(-HH, HH),
      tx: rand(-HW, HW), ty: rand(-HH, HH), f: 0, wander: rand(0.2, 1.2) });
  }

  tick(dt) {
    if (this.time < 6) return;
    while (this.rabbits.length < RABBIT.count) this.spawnRabbit();
    this.stepHeroes(dt);
    for (const u of this.heroes.values()) if (u.alive) clampToRect(u, HW, HH);
    for (const r of this.rabbits) {
      r.wander -= dt;
      if (r.wander <= 0 || dist(r.x, r.y, r.tx, r.ty) < 0.5) {
        r.tx = rand(-HW, HW);
        r.ty = rand(-HH, HH);
        r.wander = rand(0.5, 2.5);
      }
      const dx = r.tx - r.x;
      const dy = r.ty - r.y;
      const d = Math.hypot(dx, dy) || 1;
      r.x += dx / d * Math.min(d, RABBIT.speed * dt);
      r.y += dy / d * Math.min(d, RABBIT.speed * dt);
      r.f = Math.atan2(dy, dx);
    }
    this.auraT -= dt;
    if (this.auraT > 0) return;
    this.auraT += 0.5;
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.finished) continue;
      for (const r of this.rabbits) {
        if (r.dead || dist(u.x, u.y, r.x, r.y) > RABBIT.aura + u.r) continue;
        r.dead = true;
        u.kills++;
        u.xp += RABBIT.xp;
        this.ev({ k: 'squish', x: round2(r.x), y: round2(r.y) });
        if (u.xp >= RABBIT.levelXp) this.finish(pid);
      }
    }
    this.rabbits = this.rabbits.filter((r) => !r.dead);
  }

  progress(pid) { return this.heroes.get(pid)?.xp || 0; }

  botThink(pid, u, mem) {
    let best = null;
    let bd = Infinity;
    for (const r of this.rabbits) {
      const d = dist(u.x, u.y, r.x, r.y) + rand(0, 2) * (1 - mem.skill);
      if (d < bd) { bd = d; best = r; }
    }
    if (best) u.order(best.x + rand(-0.3, 0.3), best.y + rand(-0.3, 0.3));
  }

  hud(pid) { return { label: `Roadkills: ${this.heroes.get(pid)?.kills || 0} / 16` }; }
  worldEnts() {
    return [...this.rabbits.map((r) => ({ id: r.id, k: 'uxrabbit', x: round2(r.x), y: round2(r.y), f: round2(r.f) })),
      { id: this.rainId, k: 'uxrain', x: 0, y: 0 }];
  }
}
