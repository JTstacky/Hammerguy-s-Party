import { Minigame } from '../base.js';
import { newId, rand, dist, clampToRect, round2 } from '../../engine/server/sim.js';
import { treesAroundRect } from './props.js';

const HW = 16;
const HH = 11;

// Kodo beasts stampede across the field. Get trampled and you're out.
export class KodoStampede extends Minigame {
  static id = 'kodo';
  static name = 'Kodo Stampede';
  static desc = 'Kodo beasts are stampeding across the field. Dodge them — last hammerguy standing wins.';
  static controls = 'Right-click to move.';
  static duration = 45;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'grass', floor: { shape: 'rect', w: HW * 2, h: HH * 2 }, props: treesAroundRect(HW, HH), bounds: 20 };
    this.spawnHeroes(this.gridPositions(0, 0, 2.2));
    this.kodos = [];
    this.spawnT = 1;
  }

  tick(dt) {
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = Math.max(0.2, 1.1 - this.time * 0.022);
      this.spawnKodo();
      if (this.time > 20 && Math.random() < 0.3) this.spawnKodo();
    }
    for (const k of this.kodos) {
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      if (Math.abs(k.x) > HW + 6 || Math.abs(k.y) > HH + 6) k.dead = true;
    }
    this.kodos = this.kodos.filter((k) => !k.dead);
    this.stepHeroes(dt);
    for (const [pid, u] of this.heroes) {
      if (!u.alive) continue;
      clampToRect(u, HW, HH);
      for (const k of this.kodos) {
        if (dist(u.x, u.y, k.x, k.y) < u.r + k.r * 0.85) {
          u.knock(k.vx, k.vy, 14);
          this.eliminate(pid, 'squish');
          this.ev({ k: 'sfx', s: 'kodo' });
          break;
        }
      }
    }
  }

  spawnKodo() {
    const speed = rand(6, 9) + this.time * 0.09;
    const side = this.time < 12 ? (Math.random() < 0.5 ? 0 : 1) : Math.floor(rand(0, 4));
    let x;
    let y;
    let vx = 0;
    let vy = 0;
    if (side === 0) [x, y, vx] = [-HW - 3, rand(-HH + 1, HH - 1), speed];
    else if (side === 1) [x, y, vx] = [HW + 3, rand(-HH + 1, HH - 1), -speed];
    else if (side === 2) [x, y, vy] = [rand(-HW + 1, HW - 1), -HH - 3, speed];
    else [x, y, vy] = [rand(-HW + 1, HW - 1), HH + 3, -speed];
    this.kodos.push({ id: newId(), x, y, vx, vy, r: 1.1 });
  }

  botThink(pid, u, mem) {
    if (Math.random() > mem.skill) return; // bots sometimes react late
    let dx = 0;
    let dy = 0;
    for (const k of this.kodos) {
      const rx = u.x - k.x;
      const ry = u.y - k.y;
      const sp2 = k.vx * k.vx + k.vy * k.vy;
      const t = (rx * k.vx + ry * k.vy) / sp2;
      if (t < 0 || t > 1.4) continue;
      const cx = k.x + k.vx * t - u.x;
      const cy = k.y + k.vy * t - u.y;
      const miss = Math.hypot(cx, cy);
      if (miss > 2.6) continue;
      // Move perpendicular to the kodo, away from its path.
      const sp = Math.sqrt(sp2);
      let px = -k.vy / sp;
      let py = k.vx / sp;
      if (px * -cx + py * -cy < 0) [px, py] = [-px, -py];
      if (miss < 0.3) [px, py] = u.x * px + u.y * py > 0 ? [-px, -py] : [px, py];
      const w = (1.5 - t) * (3 - miss);
      dx += px * w;
      dy += py * w;
    }
    if (dx || dy) u.order(u.x + dx * 3, u.y + dy * 3);
    else if (!u.target && Math.random() < 0.3) u.order(rand(-HW / 2, HW / 2), rand(-HH / 2, HH / 2));
  }

  worldEnts() {
    return this.kodos.map((k) => ({ id: k.id, k: 'kodo', x: round2(k.x), y: round2(k.y), f: round2(Math.atan2(k.vy, k.vx)), mv: 1 }));
  }
}
