import { Minigame, SHOVE } from '../base.js';
import { newId, rand, dist, clampToCircle, round2 } from '../../engine/server/sim.js';
import { ringOf, treesAroundCircle } from './props.js';

const R = 12;

// Hold the holy circle alone to score. Shove others out of it.
export class KingOfTheHill extends Minigame {
  static id = 'koth';
  static name = 'King of the Hill';
  static desc = 'Whoever stands closest to the centre of the golden circle scores. It moves every few seconds. Shove rivals away!';
  static controls = 'Right-click to move. Q: Holy Shove.';
  static duration = 40;
  static ranking = 'score';

  setup() {
    this.map = { theme: 'stone', floor: { shape: 'disc', r: R }, props: [...ringOf('pillar', R + 0.8, 12), ...treesAroundCircle(R + 1, 36)], bounds: R + 5 };
    this.spawnHeroes(this.ringPositions(R * 0.7));
    this.shove = { ...SHOVE };
    this.hill = { id: newId(), x: 0, y: 0, r: 2.6 };
    this.moveT = 8;
    this.holder = null;
    this.tickAcc = 0;
  }

  tick(dt) {
    this.moveT -= dt;
    if (this.moveT <= 0) {
      this.moveT = 8;
      const a = rand(0, Math.PI * 2);
      const r = rand(2, R - 4);
      this.hill.x = Math.cos(a) * r;
      this.hill.y = Math.sin(a) * r;
      this.ev({ k: 'sfx', s: 'beep' });
    }
    this.stepHeroes(dt);
    // The paladin closest to the centre of the circle holds the hill.
    let best = null;
    let bd = this.hill.r;
    for (const [pid, u] of this.heroes) {
      clampToCircle(u, R);
      const d = dist(u.x, u.y, this.hill.x, this.hill.y);
      if (d < bd) {
        bd = d;
        best = pid;
      }
    }
    this.holder = best;
    if (this.holder) {
      this.scores.set(this.holder, this.scores.get(this.holder) + dt);
      this.tickAcc += dt;
      if (this.tickAcc >= 1) {
        this.tickAcc -= 1;
        const u = this.heroes.get(this.holder);
        this.ev({ k: 'txt', x: round2(u.x), y: round2(u.y), s: '+1', c: '#ffd700' });
      }
    }
  }

  botThink(pid, u, mem) {
    if (mem.ox == null || Math.random() < 0.1) {
      mem.ox = rand(-1.2, 1.2);
      mem.oy = rand(-1.2, 1.2);
    }
    u.order(this.hill.x + mem.ox, this.hill.y + mem.oy);
    for (const [op, v] of this.heroes) {
      if (op !== pid && dist(u.x, u.y, v.x, v.y) < 2.2 && Math.random() < 0.5) this.doShove(pid);
    }
  }

  worldEnts() {
    return [{ id: this.hill.id, k: 'hill', x: round2(this.hill.x), y: round2(this.hill.y), r: this.hill.r, o: this.holder }];
  }
}
