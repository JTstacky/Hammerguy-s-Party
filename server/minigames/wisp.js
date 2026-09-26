import { Minigame } from '../base.js';
import { newId, rand, clampToCircle, round2 } from '../../engine/server/sim.js';
import { treesAroundCircle } from './props.js';

const R = 13;
const HUB = 2.2;

// Arms of wisps sweep around a central moonwell. Slip through the gaps.
export class WispWheel extends Minigame {
  static id = 'wisp';
  static name = 'Wisp Wheel';
  static desc = 'Spinning arms of wisps sweep the glade. Touch one and you are out — slip through the gaps!';
  static controls = 'Right-click to move.';
  static duration = 45;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'night', floor: { shape: 'disc', r: R }, props: [{ t: 'moonwell', x: 0, y: 0, s: 1 }, ...treesAroundCircle(R, 44)], bounds: R + 6 };
    this.spawnHeroes(this.ringPositions(R * 0.6));
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.arms = [];
    this.addArm(0);
    this.addArm(Math.PI);
    this.speed = 0.4;
  }

  addArm(angle) {
    this.arms.push({ id: newId(), a: angle, phase: rand(0, Math.PI * 2), gw: 2.6 });
  }

  gapR(arm) {
    return (HUB + R) / 2 + Math.sin(this.time * 0.6 + arm.phase) * ((R - HUB) / 2 - 2);
  }

  tick(dt) {
    this.speed = 0.4 + this.time * 0.018;
    if (this.arms.length === 2 && this.time > 15) this.addArm(this.arms[0].a + Math.PI / 2);
    if (this.arms.length === 3 && this.time > 28) this.addArm(this.arms[0].a - Math.PI / 2);
    for (const arm of this.arms) arm.a += this.speed * this.dir * dt;

    this.stepHeroes(dt);
    for (const [pid, u] of this.heroes) {
      if (!u.alive) continue;
      clampToCircle(u, R);
      const d = Math.hypot(u.x, u.y);
      if (d < HUB + u.r) {
        const k = (HUB + u.r) / (d || 0.01);
        u.x *= k;
        u.y *= k;
      }
      const r = Math.hypot(u.x, u.y);
      const th = Math.atan2(u.y, u.x);
      for (const arm of this.arms) {
        const diff = th - arm.a;
        if (Math.cos(diff) < 0) continue;
        const perp = Math.abs(r * Math.sin(diff));
        if (perp > 0.35 + u.r * 0.8) continue;
        if (Math.abs(r - this.gapR(arm)) < arm.gw / 2 - 0.2) continue;
        this.eliminate(pid, 'zap');
        break;
      }
    }
  }

  botThink(pid, u, mem) {
    if (Math.random() > mem.skill) return; // bots sometimes react late
    const r = Math.hypot(u.x, u.y);
    const th = Math.atan2(u.y, u.x);
    // Find the arm that will reach us soonest.
    let soonest = null;
    let st = Infinity;
    for (const arm of this.arms) {
      let da = (th - arm.a) * this.dir;
      da = ((da % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const t = da / this.speed;
      if (t < st) {
        st = t;
        soonest = arm;
      }
    }
    if (!soonest) return;
    const g = this.gapR(soonest);
    // Aim for the gap's radius, drifting slightly ahead of the sweep.
    const ahead = th + this.dir * 0.15;
    const tr = Math.max(HUB + 0.8, Math.min(R - 0.8, g));
    if (Math.abs(r - tr) > 0.3 || st < 1.5) u.order(Math.cos(ahead) * tr, Math.sin(ahead) * tr);
  }

  worldEnts() {
    return this.arms.map((arm) => ({ id: arm.id, k: 'wisparm', x: 0, y: 0, a: round2(arm.a), g: round2(this.gapR(arm)), gw: arm.gw, r0: HUB, r1: R }));
  }
}
