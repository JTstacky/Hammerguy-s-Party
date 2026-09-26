import { Minigame } from '../base.js';
import { newId, rand, dist, clampToRect, round2 } from '../../engine/server/sim.js';
import { treesAroundRect } from './props.js';

const HW = 32;
const HH = 7;
const START = -HW + 2.5;
const FINISH = HW - 2.5;

// Race to the far end while flesh golems patrol across the track.
export class GolemGauntlet extends Minigame {
  static id = 'race';
  static name = 'Golem Gauntlet';
  static desc = 'Race to the finish line! Patrolling golems will smack you back toward the start.';
  static controls = 'Right-click to move. The camera follows you.';
  static duration = 60;
  static ranking = 'race';

  setup() {
    this.rocks = [];
    for (let x = START + 8; x < FINISH - 4; x += rand(5, 8)) {
      this.rocks.push({ x, y: rand(-HH + 1.5, HH - 1.5), r: rand(0.8, 1.4) });
    }
    this.golems = [];
    for (let x = START + 6; x < FINISH - 3; x += rand(4, 5.5)) {
      this.golems.push({ id: newId(), x, y: 0, bx: x, amp: HH - 1.2, spd: rand(0.8, 1.6), ph: rand(0, 6.28), r: 1.0, vy: 0 });
    }
    this.map = {
      theme: 'grass', floor: { shape: 'rect', w: HW * 2, h: HH * 2 }, follow: true, bounds: HW + 4,
      props: [
        ...treesAroundRect(HW, HH, 0.4, 2),
        ...this.rocks.map((r) => ({ t: 'rock', x: r.x, y: r.y, s: r.r })),
        { t: 'line', x1: START, y1: -HH, x2: START, y2: HH, c: '#ffffff' },
        { t: 'line', x1: FINISH, y1: -HH, x2: FINISH, y2: HH, c: '#ffd700' },
        { t: 'flag', x: FINISH, y: -HH - 0.5, s: 1 },
        { t: 'flag', x: FINISH, y: HH + 0.5, s: 1 },
      ],
    };
    const n = this.pids.length;
    this.spawnHeroes(this.pids.map((_, i) => [START - 1, -HH + 1 + ((HH * 2 - 2) * (i + 0.5)) / n]), { facing: 0 });
  }

  tick(dt) {
    for (const g of this.golems) {
      const ny = Math.sin(this.time * g.spd + g.ph) * g.amp;
      g.vy = (ny - g.y) / dt;
      g.y = ny;
    }
    this.stepHeroes(dt);
    for (const [pid, u] of this.heroes) {
      if (!u.alive) continue;
      clampToRect(u, HW, HH);
      for (const r of this.rocks) {
        const d = dist(u.x, u.y, r.x, r.y);
        if (d < u.r + r.r) {
          const k = (u.r + r.r) / (d || 0.01);
          u.x = r.x + (u.x - r.x) * k;
          u.y = r.y + (u.y - r.y) * k;
        }
      }
      if (u.finished) continue;
      for (const g of this.golems) {
        if (dist(u.x, u.y, g.x, g.y) < u.r + g.r && u.stun <= 0) {
          u.knock(-1, Math.sign(u.y - g.y) * 0.3, 17);
          u.stun = 0.7;
          this.ev({ k: 'boom', x: round2(u.x), y: round2(u.y), r: 0.8, c: '#9be07a' });
          this.ev({ k: 'sfx', s: 'smack' });
        }
      }
      if (u.x >= FINISH) this.finish(pid);
    }
  }

  progress(pid) {
    return this.heroes.get(pid).x;
  }

  botThink(pid, u) {
    let ty = u.y;
    // Look ahead for golems that will be near our lane when we get there.
    for (const g of this.golems) {
      const ahead = g.x - u.x;
      if (ahead < -1 || ahead > 4) continue;
      const tArrive = Math.max(0, ahead) / 5;
      const gy = Math.sin((this.time + tArrive) * g.spd + g.ph) * g.amp;
      if (Math.abs(gy - u.y) < 2.4) {
        if (ahead > 1.8) {
          u.order(u.x, u.y); // wait for it to pass
          return;
        }
        ty = gy > u.y ? u.y - 3 : u.y + 3;
      }
    }
    for (const r of this.rocks) {
      const ahead = r.x - u.x;
      if (ahead > 0 && ahead < 3 && Math.abs(r.y - u.y) < r.r + 0.8) ty = r.y + (u.y >= r.y ? r.r + 1.2 : -r.r - 1.2);
    }
    ty = Math.max(-HH + 1, Math.min(HH - 1, ty));
    u.order(Math.min(FINISH + 2, u.x + 4), ty);
  }

  worldEnts() {
    return this.golems.map((g) => ({ id: g.id, k: 'golem', x: round2(g.x), y: round2(g.y), f: g.vy > 0 ? 1.57 : -1.57, mv: 1 }));
  }
}
