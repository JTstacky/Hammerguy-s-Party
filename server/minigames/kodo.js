import { Minigame } from '../base.js';
import { newId, rand, dist, clampToRect, round2, wc3 } from '../../engine/server/sim.js';
import { treesAroundRect } from './props.js';

// Uther Party 4.0 #17 "Stampede" (docs/uther-party/rules-4.0.md): a walled
// 1408x768 field. Beastmasters in the centre column channel Stampede along the
// long axis: 2 beasts per second each, running at 500 u/s (the ability's
// missile speed), exploding on the first enemy they touch for 60 damage to
// everyone within 100 u. Players are unarmed 700 HP grunts that start in the
// western half. Beastmaster #1 fires west at t=7; another one arrives every
// 20 s (the first extra always fires east), up to 8.
const HW = wc3(704);
const HH = wc3(384);
const BEAST_SPEED = wc3(500);
const BEAST_R = wc3(55);
const BLAST_R = wc3(100);
const BLAST_DMG = 60;
const AREA = wc3(500);
const MAX_BM = 8;

export class KodoStampede extends Minigame {
  static id = 'kodo';
  static name = 'Kodo Stampede';
  static desc = 'Beastmasters in the middle of the field send kodo beasts stampeding toward the ends, from both sides before long. Each kodo explodes on the first hammerguy it hits. Last one standing wins.';
  static controls = 'Right-click to move. You have 700 HP; each kodo does 60 to everyone near the blast.';
  static duration = 300;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'grass', floor: { shape: 'rect', w: HW * 2, h: HH * 2 }, props: treesAroundRect(HW, HH), bounds: HW + 4 };
    // Grunts: 700 HP, speed 270, collision 31, created at centre + (-384, ±192), facing east.
    this.spawnHeroes(
      this.pids.map(() => [wc3(-384) + rand(-0.3, 0.3), wc3(rand(-192, 192))]),
      { hp: 700, facing: 0 },
    );
    this.kodos = [];
    this.bms = [{ id: newId(), x: 0, y: 0, dir: -1, on: false, acc: 0 }];
    this.spawnT = 7;
    this.pending = [];
  }

  tick(dt) {
    const bm1 = this.bms[0];
    if (!bm1.on && this.time >= 7) bm1.on = true;
    // Spawn runs every 20 s from t=7 while there are fewer than 8, then waits 15 s.
    if (this.time >= 7) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 20;
        if (this.bms.length + this.pending.length < MAX_BM) this.pending.push(15);
      }
    }
    this.pending = this.pending.map((t) => t - dt);
    while (this.pending.length && this.pending[0] <= 0) {
      this.pending.shift();
      const dir = this.bms.length === 1 ? 1 : Math.random() < 0.5 ? 1 : -1;
      this.bms.push({ id: newId(), x: 0, y: wc3(rand(-256, 256)), dir, on: true, acc: 0 });
      this.ev({ k: 'tele', x1: 0, y1: 0, x2: 0, y2: round2(this.bms[this.bms.length - 1].y) });
      this.ev({ k: 'sfx', s: 'kodo' });
    }
    for (const bm of this.bms) {
      if (!bm.on) continue;
      bm.acc += dt * 2;
      while (bm.acc >= 1) {
        bm.acc -= 1;
        this.spawnKodo(bm);
      }
    }
    for (const k of this.kodos) {
      k.x += k.vx * dt;
      if (Math.abs(k.x) > HW + 2) k.dead = true;
    }

    this.stepHeroes(dt);
    for (const [, u] of this.heroes) {
      if (!u.alive) continue;
      clampToRect(u, HW, HH);
      // Beastmasters are units too: walk round them.
      for (const bm of this.bms) {
        const d = dist(u.x, u.y, bm.x, bm.y);
        const min = u.r + wc3(32);
        if (d < min) {
          const k = min / (d || 0.01);
          u.x = bm.x + (u.x - bm.x) * k;
          u.y = bm.y + (u.y - bm.y) * k;
        }
      }
    }

    for (const k of this.kodos) {
      if (k.dead) continue;
      const hit = [...this.heroes.values()].some((u) => u.alive && dist(u.x, u.y, k.x, k.y) < u.r + BEAST_R);
      if (!hit) continue;
      k.dead = true;
      this.ev({ k: 'boom', s: 'kodo', x: round2(k.x), y: round2(k.y), r: BLAST_R, c: '#ffb050' });
      for (const [pid, u] of this.heroes) {
        if (u.alive && dist(u.x, u.y, k.x, k.y) <= BLAST_R + u.r) this.damage(pid, BLAST_DMG, 'squish');
      }
    }
    this.kodos = this.kodos.filter((k) => !k.dead);
  }

  // Beasts start just ahead of the Beastmaster, spread across the stampede's area.
  spawnKodo(bm) {
    const y = Math.max(-HH + 0.3, Math.min(HH - 0.3, bm.y + rand(-AREA, AREA)));
    this.kodos.push({ id: newId(), x: bm.x + bm.dir * rand(0.8, 1.6), y, vx: bm.dir * BEAST_SPEED, vy: 0 });
  }

  botThink(pid, u, mem) {
    if (Math.random() > mem.skill) return; // bots sometimes react late
    let dx = 0;
    let dy = 0;
    for (const k of this.kodos) {
      const t = (u.x - k.x) / k.vx;
      if (t < 0 || t > 1.2) continue;
      const miss = Math.abs(k.y - u.y);
      if (miss > BEAST_R + u.r + 1) continue;
      const w = (1.4 - t) * (2.5 - miss);
      const side = u.y > k.y ? 1 : -1;
      dy += (Math.abs(u.y + side * 2) > HH - 0.5 ? -side : side) * w;
    }
    // Keep near the middle column, behind the newest Beastmaster, as the designer advises.
    if (dy) u.order(u.x + dx, u.y + dy * 2);
    else if (!u.target && Math.random() < 0.3) u.order(rand(-HW / 3, HW / 3), rand(-HH / 1.5, HH / 1.5));
  }

  worldEnts() {
    const ents = this.kodos.map((k) => ({ id: k.id, k: 'kodo', x: round2(k.x), y: round2(k.y), f: k.vx > 0 ? 0 : 3.14, mv: 1 }));
    for (const bm of this.bms) ents.push({ id: bm.id, k: 'beastmaster', x: 0, y: round2(bm.y), f: bm.dir > 0 ? 0 : 3.14, on: bm.on ? 1 : undefined });
    return ents;
  }
}
