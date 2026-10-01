import { Minigame } from '../../base.js';
import { newId, rand, dist, round2, wc3 } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';

const HW = wc3(944);
const HH = wc3(832);
const DEG = Math.PI / 180;
const ISLANDS = [[-8, -9, 2.3], [7, -9, 1.6], [10, -4, 1.1], [-8, 7, 3.1], [8, 8, 1.6]];
export const BOAT = { hp: 500, speed: wc3(320), r: wc3(30), turnRate: 0.4 };
export const RAM = { period: 0.66, ahead: wc3(125), radius: wc3(100), damage: 100,
  heal: 15, shove: wc3(270), recoil: wc3(70), landingDamage: 300, landingRadius: wc3(50) };

// Ultima-X #77: contact is sampled ahead of the bow whether or not it moves.
export class TitanicPanic extends Minigame {
  static id = 'ux-titanic';
  static name = 'Titanic Panic';
  static desc = 'Ram rival boats into icebergs or over the lake edge. Landings cause violent chain reactions.';
  static controls = 'Right-click to sail. Q: Unstuck, moving 200 units toward the centre.';
  static duration = 150;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'uxtitanicsea', floor: { shape: 'rect', w: HW * 2, h: HH * 2 },
      props: treesAroundRect(HW, HH, 0.06), build: ['sea', 'uxtitanic'], bounds: HW + 3 };
    this.abilities = [{ name: 'Unstuck', icon: '⚓', desc: 'Teleport 200 WC3 units toward the centre.',
      kind: 'instant', cd: 3, castPoint: 1, cast: (pid, u) => {
        const d = Math.hypot(u.x, u.y) || 1;
        u.x -= u.x / d * wc3(200);
        u.y -= u.y / d * wc3(200);
        u.stuck = false;
        this.ev({ k: 'splash', x: round2(u.x), y: round2(u.y) });
      } }];
    this.spawnHeroes(this.pids.map((_, i) => {
      const a = ((i + 1) * 135 - 22.5) * DEG;
      return [Math.cos(a) * wc3(400), Math.sin(a) * wc3(400)];
    }), BOAT);
    for (const u of this.heroes.values()) u.skin = 'uxbumperboat';
    this.ramT = 5;
    this.rainId = newId();
    this.arcs = [];
    this.predict = false;
  }

  tick(dt) {
    if (this.time < 5) return;
    for (const arc of this.arcs) {
      arc.t += dt;
      const k = Math.min(1, arc.t);
      arc.u.x = arc.sx + (arc.ex - arc.sx) * k;
      arc.u.y = arc.sy + (arc.ey - arc.sy) * k;
      if (k === 1) {
        arc.u.stun = 0;
        arc.u.stuck = ISLANDS.some(([x, y, r]) => dist(arc.u.x, arc.u.y, x, y) < r + BOAT.r);
        arc.done = true;
        this.splash(arc.u.x, arc.u.y, arc.u.owner);
      }
    }
    this.arcs = this.arcs.filter((a) => !a.done);
    for (const u of this.heroes.values()) if (u.stuck) { u.stop(); u.stun = dt * 2; }
    this.stepHeroes(dt);
    for (const [pid, u] of this.heroes) {
      if (u.alive && !u.stuck && !this.arcs.some((a) => a.u === u)) {
        for (const [x, y, r] of ISLANDS) {
          const d = dist(u.x, u.y, x, y);
          if (d < r + u.r) {
            const angle = Math.atan2(u.y - y, u.x - x);
            u.x = x + Math.cos(angle) * (r + u.r);
            u.y = y + Math.sin(angle) * (r + u.r);
          }
        }
      }
      if (u.alive && (Math.abs(u.x) > HW || Math.abs(u.y) > HH)) this.eliminate(pid, 'boom');
    }
    this.ramT -= dt;
    if (this.ramT <= 0) {
      this.ramT += RAM.period;
      for (const [pid, u] of this.heroes) if (u.alive) this.ram(pid, u);
    }
  }

  arc(u, dx, dy) {
    const prior = this.arcs.find((a) => a.u === u);
    if (prior) prior.done = true;
    u.stop();
    u.stun = 1;
    this.arcs.push({ u, sx: u.x, sy: u.y, ex: u.x + dx, ey: u.y + dy, t: 0 });
  }

  ram(pid, u) {
    const dx = Math.cos(u.facing);
    const dy = Math.sin(u.facing);
    const cx = u.x + dx * RAM.ahead;
    const cy = u.y + dy * RAM.ahead;
    for (const [other, v] of this.heroes) {
      if (other === pid || !v.alive || dist(cx, cy, v.x, v.y) > RAM.radius) continue;
      this.damage(other, RAM.damage);
      u.hp = Math.min(BOAT.hp, u.hp + RAM.heal);
      if (v.alive) this.arc(v, dx * RAM.shove, dy * RAM.shove);
      this.arc(u, -dx * RAM.recoil, -dy * RAM.recoil);
      this.ev({ k: 'splash', x: round2(v.x), y: round2(v.y) });
    }
  }

  splash(x, y, owner) {
    this.ev({ k: 'boom', s: 'rock', x: round2(x), y: round2(y), r: RAM.landingRadius });
    for (const [pid, u] of this.heroes) {
      if (pid !== owner && u.alive && dist(x, y, u.x, u.y) < RAM.landingRadius) this.damage(pid, RAM.landingDamage);
    }
  }

  botThink(pid, u, mem) {
    const rivals = [...this.heroes.values()].filter((v) => v !== u && v.alive);
    rivals.sort((a, b) => dist(u.x, u.y, a.x, a.y) - dist(u.x, u.y, b.x, b.y));
    if (!rivals.length) return;
    const v = rivals[0];
    u.order(v.x + rand(-1, 1) * (1 - mem.skill), v.y + rand(-1, 1) * (1 - mem.skill));
    if (Math.abs(u.x) > HW - 2 || Math.abs(u.y) > HH - 2) this.useAbility(pid, 0, 0, 0);
  }

  worldEnts() { return [{ id: this.rainId, k: 'uxrain', x: 0, y: 0 }]; }
}
