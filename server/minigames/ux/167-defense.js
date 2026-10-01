import { Minigame } from '../../base.js';
import { newId, rand, dist, clampToRect, round2, wc3 } from '../../../engine/server/sim.js';

const HW = wc3(176);
const HH = wc3(144);

// Ultima-X #167 is unreachable dead content in WC3. This runs its written
// joke: helpless peons in a tiny lane, threatened by both armies at slowest.
export class DefenseJoke extends Minigame {
  static id = 'uxdefense';
  static name = '???';
  static desc = 'Helpless peons stand between two approaching armies in a tiny mock DotA lane.';
  static controls = 'Right-click to flee the creeps. Last peon standing wins.';
  static duration = 120;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'night', floor: { shape: 'rect', w: HW * 2, h: HH * 2 }, bounds: 10, follow: false, build: ['ux6defenselane'], props: [] };
    this.spawnHeroes(this.pids.map((_, i) => {
      const a = (i * 135 - 22.5) * Math.PI / 180;
      return [Math.cos(a) * wc3(50), Math.sin(a) * wc3(50)];
    }), { hp: 50, speed: wc3(190) * 0.5, r: wc3(16) });
    for (const u of this.heroes.values()) u.skin = 'peon';
    this.creeps = [];
    const add = (kind, x, y, hp, speed, dmg, r) => this.creeps.push({ id: newId(), kind, x: wc3(x), y: wc3(y), hp, speed: wc3(speed) * 0.5, dmg, r: wc3(r), cd: rand(0, 1) });
    add('ux6tree', -600, 0, 1300, 0, 45, 64);
    add('ux6treant', -400, -65, 300, 190, 16, 25);
    add('ux6treant', -400, 65, 300, 190, 16, 25);
    add('ux6archer', -400, 0, 245, 240, 20, 20);
    add('ux6crypt', 600, 0, 1300, 0, 0, 64);
    for (let i = 0; i < 3; i++) add('ux6cultist', 400, (i - 1) * 60, 25, 240, 10, 18);
  }

  tick(dt) {
    this.stepHeroes(dt);
    for (const u of this.heroes.values()) if (u.alive) clampToRect(u, HW, HH);
    if (this.time < 2) return;
    for (const c of this.creeps) {
      const live = [...this.heroes.entries()].filter(([, u]) => u.alive);
      if (!live.length) break;
      live.sort((a, b) => dist(a[1].x, a[1].y, c.x, c.y) - dist(b[1].x, b[1].y, c.x, c.y));
      const [pid, u] = live[0];
      const d = dist(c.x, c.y, u.x, u.y);
      if (c.speed && d > c.r + u.r + 0.4) {
        c.x += (u.x - c.x) / d * c.speed * dt;
        c.y += (u.y - c.y) / d * c.speed * dt;
      }
      c.cd -= dt;
      if (c.cd <= 0 && d < c.r + u.r + (c.kind === 'ux6archer' ? wc3(500) : wc3(55))) {
        this.damage(pid, c.dmg, 'death');
        c.cd = c.kind === 'ux6archer' ? 1.3 : 1.6;
      }
    }
  }

  botThink(pid, u, mem) {
    const nearest = this.creeps.filter((c) => c.speed).sort((a, b) => dist(u.x, u.y, a.x, a.y) - dist(u.x, u.y, b.x, b.y))[0];
    if (!nearest || Math.random() > mem.skill) return;
    const a = Math.atan2(u.y - nearest.y, u.x - nearest.x) + (pid % 2 ? 0.4 : -0.4);
    u.order(Math.max(-HW, Math.min(HW, u.x + Math.cos(a) * 2)), Math.max(-HH, Math.min(HH, u.y + Math.sin(a) * 2)));
  }

  worldEnts() {
    return this.creeps.map((c) => ({ id: c.id, k: c.kind, x: round2(c.x), y: round2(c.y), f: c.x < 0 ? 0 : Math.PI }));
  }
}
