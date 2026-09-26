import { Minigame, SHOVE } from '../base.js';
import { newId, rand, dist, clampToRect, round2 } from '../../engine/server/sim.js';
import { treesAroundRect } from './props.js';

const HW = 14;
const HH = 10;

// Grab as much gold as you can before the goblin merchant closes shop.
export class GoldRush extends Minigame {
  static id = 'gold';
  static name = 'Gold Rush';
  static desc = 'Gold coins are scattered across the field. Collect the most! Big sacks are worth 5.';
  static controls = 'Right-click to move. Q: Holy Shove.';
  static duration = 35;
  static ranking = 'score';

  setup() {
    this.map = { theme: 'grass', floor: { shape: 'rect', w: HW * 2, h: HH * 2 }, props: [...treesAroundRect(HW, HH), { t: 'goldmine', x: 0, y: HH + 4, s: 1 }], bounds: 18 };
    this.spawnHeroes(this.gridPositions(0, 0, 2));
    this.shove = { ...SHOVE };
    this.coins = [];
    for (let i = 0; i < 10; i++) this.spawnCoin(1);
    this.bagT = 6;
  }

  spawnCoin(v) {
    this.coins.push({ id: newId(), x: rand(-HW + 1, HW - 1), y: rand(-HH + 1, HH - 1), v });
  }

  tick(dt) {
    if (this.coins.filter((c) => c.v === 1).length < 8 + this.pids.length && Math.random() < dt * 4) this.spawnCoin(1);
    this.bagT -= dt;
    if (this.bagT <= 0) {
      this.bagT = rand(5, 8);
      this.spawnCoin(5);
    }
    this.stepHeroes(dt);
    for (const [pid, u] of this.heroes) {
      clampToRect(u, HW, HH);
      for (const c of this.coins) {
        if (!c.dead && dist(u.x, u.y, c.x, c.y) < u.r + 0.5) {
          c.dead = true;
          this.addScore(pid, c.v, c.x, c.y);
          this.ev({ k: 'sfx', s: 'coin', to: pid });
        }
      }
    }
    this.coins = this.coins.filter((c) => !c.dead);
  }

  botThink(pid, u) {
    let best = null;
    let bv = -Infinity;
    for (const c of this.coins) {
      const d = dist(u.x, u.y, c.x, c.y);
      let rival = Infinity;
      for (const [op, v] of this.heroes) if (op !== pid) rival = Math.min(rival, dist(v.x, v.y, c.x, c.y));
      const val = c.v / (d + 2) - (rival < d * 0.6 ? 0.2 : 0);
      if (val > bv) {
        bv = val;
        best = c;
      }
    }
    if (best) u.order(best.x, best.y);
    for (const [op, v] of this.heroes) {
      if (op !== pid && dist(u.x, u.y, v.x, v.y) < 2 && Math.random() < 0.3) this.doShove(pid);
    }
  }

  worldEnts() {
    return this.coins.map((c) => ({ id: c.id, k: c.v > 1 ? 'goldbag' : 'coin', x: round2(c.x), y: round2(c.y) }));
  }
}
