import { MortarMayhem } from '../mortar.js';
import { newId, rand, dist, clampToRect, round2, wc3 } from '../../../engine/server/sim.js';

const HW = wc3(512);
const TIERS = [[wc3(25), 1], [wc3(50), 0.4], [wc3(150), 0.25]];

// Ultima-X #164 shares the Peon pit. Fast spear volleys turn every hit into
// a kill; the last twenty shooters are Demolishers.
export class PiggyPandemonium extends MortarMayhem {
  static id = 'uxpiggy';
  static name = 'Piggy Pandemonium';
  static desc = 'One-hit pigs dodge a growing ring of spear throwers and Demolishers.';
  static controls = 'Right-click to dodge the marked impacts. One hit kills your pig.';
  static duration = 150;
  static timer = false;

  setup() {
    super.setup();
    this.map.theme = 'grass';
    for (const u of this.heroes.values()) {
      u.skin = 'uxpig';
      u.hp = u.maxHp = 10;
      u.speed = wc3(190);
      u.r = wc3(15);
    }
    this.siege = [];
    this.rocks = [];
    this.oil = [];
    // These countdowns start when the trigger enables at t=6.
    this.spawnT = 1.5 + rand(0, 2);
    this.fireT = 2;
    this.aimT = 1.5;
  }

  spawnSiege() {
    if (this.siege.length >= 60) return;
    const side = Math.floor(rand(0, 4));
    const along = rand(-wc3(576), wc3(576));
    const out = rand(wc3(704), wc3(864));
    const [x, y] = [[out, along], [along, out], [-out, along], [along, -out]][side];
    this.siege.push({ id: newId(), x, y, f: Math.atan2(-y, -x), demo: this.siege.length >= 40, cd: 0, aim: null, wind: -1 });
    this.ev({ k: 'tele', x1: round2(x), y1: round2(y), x2: round2(x), y2: round2(y) });
  }

  stepSiege(s, dt) {
    if (s.demo) return super.stepSiege(s, dt);
    s.cd -= dt;
    if (!s.aim) return;
    const want = Math.atan2(s.aim.y - s.y, s.aim.x - s.x);
    const diff = Math.atan2(Math.sin(want - s.f), Math.cos(want - s.f));
    const turn = 10 * dt;
    s.f += Math.max(-turn, Math.min(turn, diff));
    if (s.wind >= 0) {
      s.wind += dt;
      if (s.wind >= 0.1) {
        s.wind = -1;
        this.launch(s);
      }
    } else if (s.cd <= 0 && Math.abs(diff) < 0.05) {
      s.wind = 0;
      s.cd = 2.31; // Troll Hunter attack cooldown, versus 4.5 for siege.
    }
  }

  tick(dt) {
    if (this.time >= 6) {
      this.spawnT -= dt;
      this.fireT -= dt;
      this.aimT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT += 1.5 + rand(0, 0.3);
        this.spawnSiege();
        this.aimAll();
      }
      if (this.fireT <= 0) { this.fireT += 2; this.aimAll(); }
      if (this.aimT <= 0) {
        this.aimT += 1.5;
        const s = this.siege[Math.floor(rand(0, this.siege.length))];
        const live = this.alive;
        const u = this.heroes.get(live[Math.floor(rand(0, live.length))]);
        if (s && u) s.aim = { x: u.x, y: u.y };
      }
    }
    for (const s of this.siege) this.stepSiege(s, dt);
    this.stepHeroes(dt);
    for (const u of this.heroes.values()) if (u.alive) clampToRect(u, HW, HW);
    for (const r of this.rocks) {
      r.t += dt;
      if (r.t >= r.flight) this.land(r);
    }
    this.rocks = this.rocks.filter((r) => !r.dead);
  }

  launch(s) {
    const { x, y } = s.aim;
    const speed = wc3(s.demo ? 400 : 1200);
    const flight = Math.max(0.15, dist(s.x, s.y, x, y) / speed - 0.2);
    this.rocks.push({ id: newId(), sx: s.x, sy: s.y, x, y, t: 0, flight, dmg: s.demo ? rand(42, 72) : rand(17, 20), oil: s.demo });
    this.ev({ k: 'sfx', s: 'mortar' });
  }

  land(r) {
    r.dead = true;
    for (const [pid, u] of this.heroes) {
      if (!u.alive) continue;
      const d = dist(u.x, u.y, r.x, r.y) - u.r;
      const tier = r.oil ? TIERS.find(([radius]) => d <= radius) : d <= wc3(10) ? [wc3(10), 1] : null;
      if (tier) this.damage(pid, r.dmg * tier[1], 'death');
    }
    this.ev({ k: 'boom', s: r.oil ? 'fire' : 'rock', x: round2(r.x), y: round2(r.y), r: r.oil ? wc3(150) : wc3(10) });
  }

  botThink(pid, u, mem) {
    if (Math.random() > mem.skill) return;
    let danger = null;
    for (const r of this.rocks) if (r.flight - r.t < 0.7 && dist(u.x, u.y, r.x, r.y) < (r.oil ? wc3(150) : wc3(40)) + u.r) { danger = r; break; }
    if (danger) {
      const a = Math.atan2(u.y - danger.y, u.x - danger.x);
      u.order(Math.max(-HW, Math.min(HW, u.x + Math.cos(a) * 2)), Math.max(-HW, Math.min(HW, u.y + Math.sin(a) * 2)));
    } else if (!u.target || Math.random() < 0.1) u.order(rand(-HW, HW), rand(-HW, HW));
  }
}
