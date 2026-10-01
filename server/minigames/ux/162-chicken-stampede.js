import { KodoStampede } from '../kodo.js';
import { newId, rand, dist, clampToRect, round2, wc3 } from '../../../engine/server/sim.js';

const HW = wc3(704);
const HH = wc3(384);
const BLAST = wc3(100);
const CHICKEN_R = wc3(20);

// Ultima-X #162 keeps the Stampede arena and grunt, but replaces the beast
// stream with faster, weaker chickens from twelve four-direction casters.
export class ChickenStampede extends KodoStampede {
  static id = 'uxchicken';
  static name = 'Chicken Stampede';
  static desc = 'Dodge exploding chickens from a growing crowd of Beastmasters. Last grunt standing wins.';
  static controls = 'Right-click to move. Chickens fly at 600 WC3 units/s and each explosion deals 25 damage.';
  static duration = 240;
  static timer = false;

  setup() {
    super.setup();
    this.chickens = [];
    this.bms = [{ id: newId(), x: 0, y: 0, a: Math.PI, acc: 0 }];
    // Spawn trigger begins at t=7, then waits three seconds for each caster.
    this.spawnT = 3;
  }

  tick(dt) {
    if (this.time >= 7) {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.bms.length < 12) {
        this.spawnT += 4;
        const a = Math.floor(rand(0, 4)) * Math.PI / 2;
        const bm = { id: newId(), x: 0, y: rand(-wc3(256), wc3(256)), a, acc: 0 };
        this.bms.push(bm);
        this.ev({ k: 'tele', x1: 0, y1: 0, x2: 0, y2: round2(bm.y) });
      }
      for (const bm of this.bms) {
        bm.acc += dt * 3;
        while (bm.acc >= 1) {
          bm.acc--;
          const spread = rand(-wc3(500), wc3(500));
          this.chickens.push({ id: newId(), x: bm.x - Math.sin(bm.a) * spread, y: bm.y + Math.cos(bm.a) * spread, vx: Math.cos(bm.a) * wc3(600), vy: Math.sin(bm.a) * wc3(600) });
        }
      }
    }
    this.stepHeroes(dt);
    for (const u of this.heroes.values()) if (u.alive) clampToRect(u, HW, HH);
    for (const c of this.chickens) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (Math.abs(c.x) > HW + 2 || Math.abs(c.y) > HH + 2) c.dead = true;
      if (c.dead) continue;
      if (![...this.heroes.values()].some((u) => u.alive && dist(u.x, u.y, c.x, c.y) < u.r + CHICKEN_R)) continue;
      c.dead = true;
      this.ev({ k: 'boom', s: 'kodo', x: round2(c.x), y: round2(c.y), r: BLAST, c: '#ffe8a8' });
      for (const [pid, u] of this.heroes) if (u.alive && dist(u.x, u.y, c.x, c.y) <= BLAST + u.r) this.damage(pid, 25, 'squish');
    }
    this.chickens = this.chickens.filter((c) => !c.dead);
  }

  botThink(pid, u, mem) {
    if (Math.random() > mem.skill) return;
    let best = null;
    let soon = 1;
    for (const c of this.chickens) {
      const v2 = c.vx * c.vx + c.vy * c.vy;
      const t = ((u.x - c.x) * c.vx + (u.y - c.y) * c.vy) / v2;
      if (t < 0 || t > soon) continue;
      if (dist(u.x, u.y, c.x + c.vx * t, c.y + c.vy * t) < BLAST + u.r) {
        best = c;
        soon = t;
      }
    }
    if (best) {
      const side = (u.x - best.x) * -best.vy + (u.y - best.y) * best.vx >= 0 ? 1 : -1;
      u.order(Math.max(-HW + 0.5, Math.min(HW - 0.5, u.x - side * best.vy * 0.4)), Math.max(-HH + 0.5, Math.min(HH - 0.5, u.y + side * best.vx * 0.4)));
    } else if (!u.target && Math.random() < 0.05) u.order(rand(-HW * 0.7, HW * 0.7), rand(-HH * 0.7, HH * 0.7));
  }

  worldEnts() {
    const ents = this.chickens.map((c) => ({ id: c.id, k: 'uxchickenbird', x: round2(c.x), y: round2(c.y), f: round2(Math.atan2(c.vy, c.vx)), mv: 1 }));
    for (const bm of this.bms) ents.push({ id: bm.id, k: 'beastmaster', x: round2(bm.x), y: round2(bm.y), f: round2(bm.a), on: this.time >= 7 ? 1 : undefined });
    return ents;
  }
}
