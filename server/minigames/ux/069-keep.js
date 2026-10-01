import { Minigame } from '../../base.js';
import { wc3, dist, rand, round2, clamp } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';

// Ultima-X #69. The sapper acquires the nearest Mathog every tenth second.
export const KEEP = { halfW: wc3(880), halfH: wc3(752), blink: wc3(650), kill: wc3(120), max: wc3(522) };

export class KeepAway extends Minigame {
  static id = 'uxkeep';
  static name = 'Keep Away!';
  static desc = 'Blink away from the accelerating sapper. The last Mathog alive wins.';
  static controls = 'Right-click to run. Q then click to Blink up to 650 WC3 units.';
  static duration = 180;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'uxkeepdawn', floor: { shape: 'rect', w: KEEP.halfW * 2, h: KEEP.halfH * 2 },
      props: treesAroundRect(KEEP.halfW + 0.5, KEEP.halfH + 0.5, 0.7, 1.5), build: ['uxkeep'], bounds: KEEP.halfW + 3 };
    this.abilities = [{ name: 'Blink', icon: '✨', desc: 'Teleport up to 650 WC3 units.', kind: 'point', cd: 3,
      range: KEEP.blink, castPoint: 0.001, cast: (pid, u, p) => {
        const d = dist(u.x, u.y, p.x, p.y);
        const s = Math.min(1, KEEP.blink / Math.max(d, 0.001));
        u.x += (p.x - u.x) * s;
        u.y += (p.y - u.y) * s;
        u.stop();
        this.ev({ k: 'uxblink', x: round2(u.x), y: round2(u.y) });
        this.checkBounds();
      } }];
    this.spawnHeroes(this.pids.map((_, i) => {
      const a = i * Math.PI / 4 + Math.PI / 4;
      return [Math.cos(a) * wc3(300), Math.sin(a) * wc3(300)];
    }), { hp: 340, speed: wc3(240), r: wc3(32) });
    for (const u of this.heroes.values()) u.skin = 'uxmathog';
    this.sapper = { x: 0, y: 0, speed: wc3(10), pause: 0, heading: 0 };
    this.roll = 0;
    this.blast = 0;
  }

  checkBounds() {
    for (const [pid, u] of this.heroes) {
      if (u.alive && (Math.abs(u.x) > KEEP.halfW || Math.abs(u.y) > KEEP.halfH)) this.eliminate(pid);
    }
  }

  explode() {
    const s = this.sapper;
    const victims = [...this.heroes].filter(([, u]) => u.alive && dist(u.x, u.y, s.x, s.y) < KEEP.kill);
    if (!victims.length) return;
    for (const [pid] of victims) this.eliminate(pid);
    this.ev({ k: 'boom', x: round2(s.x), y: round2(s.y), r: 2.5, s: 'fire' });
    const a = rand(0, Math.PI * 2);
    const r = Math.sqrt(Math.random()) * wc3(500);
    s.x = Math.cos(a) * r;
    s.y = Math.sin(a) * r;
    s.speed = wc3(10);
    s.pause = 3;
  }

  tick(dt) {
    this.stepHeroes(dt);
    this.checkBounds();
    if (this.time < 6) return;
    const s = this.sapper;
    if (s.pause > 0) s.pause -= dt;
    else {
      this.roll += dt;
      while (this.roll >= 0.1) {
        this.roll -= 0.1;
        s.speed = Math.min(KEEP.max, s.speed + wc3(2.5));
        let nearest = null;
        let best = Infinity;
        for (const u of this.heroes.values()) {
          const d = dist(u.x, u.y, s.x, s.y);
          if (u.alive && d < best) { best = d; nearest = u; }
        }
        if (nearest) s.heading = Math.atan2(nearest.y - s.y, nearest.x - s.x);
      }
      s.x += Math.cos(s.heading) * s.speed * dt;
      s.y += Math.sin(s.heading) * s.speed * dt;
    }
    this.blast += dt;
    if (this.blast >= 0.05) { this.blast = 0; this.explode(); }
  }

  botThink(pid, u, mem) {
    if (this.time < 5.5) return;
    const s = this.sapper;
    const away = Math.atan2(u.y - s.y, u.x - s.x) + Math.sin(pid * 3.1) * 0.35;
    const x = clamp(u.x + Math.cos(away) * wc3(350), -KEEP.halfW + 1.5, KEEP.halfW - 1.5);
    const y = clamp(u.y + Math.sin(away) * wc3(350), -KEEP.halfH + 1.5, KEEP.halfH - 1.5);
    u.order(x, y);
    if (dist(u.x, u.y, s.x, s.y) < KEEP.kill * (1.6 + mem.skill) && this.acd.get(pid)[0] <= 0) {
      this.useAbility(pid, 0, x, y);
    }
  }

  hud() { return { label: this.time < 6 ? `Chase starts in ${Math.ceil(6 - this.time)}` : `Mathogs left: ${this.alive.length}` }; }
  worldEnts() { const s = this.sapper; return [{ id: 69001, k: 'uxsapper', x: round2(s.x), y: round2(s.y), f: round2(s.heading), p: s.pause > 0 ? 1 : 0 }]; }
}
