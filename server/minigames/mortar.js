import { Minigame } from '../base.js';
import { newId, rand, pick, dist, clampToCircle, round2 } from '../../engine/server/sim.js';
import { ringOf } from './props.js';

const R = 12;

// Dwarven mortar teams shell the arena. Stay out of the target circles.
export class MortarMayhem extends Minigame {
  static id = 'mortar';
  static name = 'Mortar Mayhem';
  static desc = 'Mortar shells rain down on the arena. Get out of the red circles before they land!';
  static controls = 'Right-click to move.';
  static duration = 40;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'dirt', floor: { shape: 'disc', r: R }, props: [...ringOf('torch', R + 1, 16), ...ringOf('rock', R + 3.5, 22, 1.4)], bounds: R + 5 };
    this.spawnHeroes(this.ringPositions(R * 0.5));
    this.shells = [];
    this.spawnT = 1.2;
  }

  tick(dt) {
    this.spawnT -= dt;
    while (this.spawnT <= 0) {
      this.spawnT += Math.max(0.12, 0.65 - this.time * 0.013);
      this.spawnShell();
    }
    this.stepHeroes(dt);
    for (const [, u] of this.heroes) if (u.alive) clampToCircle(u, R);
    for (const s of this.shells) {
      s.t -= dt;
      if (s.t > 0) continue;
      s.dead = true;
      this.ev({ k: 'boom', x: round2(s.x), y: round2(s.y), r: s.r, c: '#ffa040', big: 1 });
      for (const [pid, u] of this.heroes) {
        if (!u.alive) continue;
        const d = dist(u.x, u.y, s.x, s.y);
        if (d < s.r + u.r * 0.5) {
          u.knock(u.x - s.x || 0.1, u.y - s.y, 12);
          this.eliminate(pid, 'death');
        }
      }
    }
    this.shells = this.shells.filter((s) => !s.dead);
  }

  spawnShell() {
    let x;
    let y;
    const alive = this.alive;
    if (alive.length && Math.random() < 0.55) {
      const u = this.heroes.get(pick(alive));
      x = u.x + u.mx * 0.8 + rand(-1.5, 1.5);
      y = u.y + u.my * 0.8 + rand(-1.5, 1.5);
    } else {
      const a = rand(0, Math.PI * 2);
      const r = Math.sqrt(Math.random()) * R;
      x = Math.cos(a) * r;
      y = Math.sin(a) * r;
    }
    const delay = Math.max(1.0, 1.5 - this.time * 0.01);
    this.shells.push({ id: newId(), x, y, r: rand(1.6, 2.2) + Math.min(0.8, this.time * 0.02), t: delay, delay });
  }

  inDanger(x, y, margin) {
    return this.shells.some((s) => dist(x, y, s.x, s.y) < s.r + margin);
  }

  botThink(pid, u, mem) {
    if (Math.random() > mem.skill) return; // bots sometimes react late
    if (!this.inDanger(u.x, u.y, 0.8)) {
      if (u.target && this.inDanger(u.target.x, u.target.y, 0.6)) u.stop();
      return;
    }
    let best = null;
    let bd = Infinity;
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      for (const r of [1.5, 3, 4.5]) {
        const x = u.x + Math.cos(a) * r;
        const y = u.y + Math.sin(a) * r;
        if (Math.hypot(x, y) > R - 1 || this.inDanger(x, y, 0.8)) continue;
        if (r < bd) {
          bd = r;
          best = [x, y];
        }
      }
    }
    if (best) u.order(best[0], best[1]);
  }

  worldEnts() {
    return this.shells.map((s) => ({ id: s.id, k: 'warn', x: round2(s.x), y: round2(s.y), r: round2(s.r), t: round2(1 - s.t / s.delay) }));
  }
}
