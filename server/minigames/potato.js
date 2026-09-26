import { Minigame } from '../base.js';
import { rand, pick, dist, clampToCircle, round2 } from '../../engine/server/sim.js';
import { ringOf } from './props.js';

const R = 11;

// A goblin sapper's bomb is ticking. Tag someone else before it blows.
export class SapperTag extends Minigame {
  static id = 'potato';
  static name = 'Sapper Tag';
  static desc = "Someone's carrying a goblin sapper charge! Touch another hammerguy to pass it on before it explodes.";
  static controls = 'Right-click to move. The bomb carrier is faster.';
  static duration = 90;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'dirt', floor: { shape: 'disc', r: R }, props: [...ringOf('torch', R + 0.8, 14), ...ringOf('rock', R + 3, 20, 1.3)], bounds: R + 5 };
    this.spawnHeroes(this.ringPositions(R * 0.6));
    this.bombHolder = null;
    this.fuse = 0;
    this.nextBomb = 1.5;
    this.immune = new Map();
  }

  tick(dt) {
    for (const [p, t] of this.immune) this.immune.set(p, t - dt);
    if (this.bombHolder == null) {
      this.nextBomb -= dt;
      if (this.nextBomb <= 0 && this.alive.length > 1) this.giveBomb(pick(this.alive), rand(7, 12));
    } else {
      this.fuse -= dt;
      if (this.fuse <= 0) {
        const u = this.heroes.get(this.bombHolder);
        this.ev({ k: 'boom', x: round2(u.x), y: round2(u.y), r: 2.5, c: '#ff6020', big: 1 });
        for (const [, v] of this.heroes) {
          if (v !== u && v.alive && dist(u.x, u.y, v.x, v.y) < 3) v.knock(v.x - u.x || 0.1, v.y - u.y, 12);
        }
        this.eliminate(this.bombHolder, 'death');
        this.bombHolder = null;
        this.nextBomb = 1.5;
      }
    }
    for (const [pid, u] of this.heroes) u.speedMult = pid === this.bombHolder ? 1.18 : 1;
    this.stepHeroes(dt);
    for (const [, u] of this.heroes) clampToCircle(u, R);
    if (this.bombHolder != null) {
      const h = this.heroes.get(this.bombHolder);
      for (const [pid, v] of this.heroes) {
        if (pid === this.bombHolder || !v.alive || (this.immune.get(pid) || 0) > 0) continue;
        if (dist(h.x, h.y, v.x, v.y) < h.r + v.r + 0.15) {
          this.immune.set(this.bombHolder, 0.8);
          this.giveBomb(pid, this.fuse);
          break;
        }
      }
    }
  }

  giveBomb(pid, fuse) {
    this.bombHolder = pid;
    this.fuse = fuse;
    const u = this.heroes.get(pid);
    this.ev({ k: 'txt', x: round2(u.x), y: round2(u.y), s: 'BOMB!', c: '#ff5040' });
    this.ev({ k: 'sfx', s: 'tag' });
  }

  isDone() {
    return super.isDone();
  }

  botThink(pid, u) {
    if (this.bombHolder === pid) {
      let target = null;
      let td = Infinity;
      for (const [op, v] of this.heroes) {
        if (op === pid || !v.alive || (this.immune.get(op) || 0) > 0) continue;
        const d = dist(u.x, u.y, v.x, v.y);
        if (d < td) {
          td = d;
          target = v;
        }
      }
      if (target) u.order(target.x + target.mx * 0.3, target.y + target.my * 0.3);
      return;
    }
    if (this.bombHolder == null) return;
    const h = this.heroes.get(this.bombHolder);
    const dx = u.x - h.x;
    const dy = u.y - h.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 7) return;
    // Flee, curving toward the centre so we don't get cornered at the wall.
    let fx = (dx / d) * 4 - u.x * 0.25;
    let fy = (dy / d) * 4 - u.y * 0.25;
    u.order(u.x + fx, u.y + fy);
  }

  hud() {
    return this.bombHolder != null ? { fuse: round2(this.fuse) } : null;
  }
}
