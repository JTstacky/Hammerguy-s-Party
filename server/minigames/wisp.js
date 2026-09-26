import { Minigame } from '../base.js';
import { newId, rand, dist, clampToCircle, round2, wc3 } from '../../engine/server/sim.js';
import { treesAroundCircle } from './props.js';

// Uther Party 4.0 #47 "Wheel of Fire" (docs/uther-party/rules-4.0.md): four
// spokes of five fires (at 128-640 u) plus one at the centre turn round the
// arena. Anyone within 64 u of a fire dies (checked every 0.05 s). The wheel
// starts still and accelerates; at 40°/s it keeps accelerating for 1, 2, 3 ...
// more seconds and then reverses. Nowhere is out of reach, so you run with the
// wheel. Everyone has one Purge (cast point 0.5 s, range 700) that stalls a
// rival, whose speed recovers over 2 s.
const R = wc3(700);
const FIRE_R = wc3(64);
const SPOKE = [128, 256, 384, 512, 640].map(wc3);
const DEG = Math.PI / 180;
const TICK = 0.05;

export class WispWheel extends Minigame {
  static id = 'wisp';
  static name = 'Wisp Wheel';
  static desc = 'Four spokes of wisp fire turn round the glade, faster and faster, then reverse. Touch a flame and you are out. Run with the wheel! Last one standing wins.';
  static controls = 'Right-click to move. Q, then click a rival: Purge (once per game) slows them to a crawl.';
  static duration = 300;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'night', floor: { shape: 'disc', r: R }, props: treesAroundCircle(R, 44), bounds: R + 6 };
    this.spell = {
      name: 'Purge',
      icon: '🌀',
      desc: 'Slows a rival to a crawl; they recover over 2 seconds. Once per game.',
      charges: 1,
      range: wc3(700),
      castPoint: 0.5,
      pickTarget: (pid, u, x, y) => this.pickRival(pid, u, x, y),
      cast: (pid, u, tgt) => this.purge(u, tgt.u),
    };
    // Players start at a random point of one of four 256x256 squares on the diagonals between the spokes.
    this.spawnHeroes(
      this.pids.map(() => {
        const sx = Math.random() < 0.5 ? 1 : -1;
        const sy = Math.random() < 0.5 ? 1 : -1;
        return [sx * wc3(384 + rand(-128, 128)), sy * wc3(384 + rand(-128, 128))];
      }),
    );
    this.wheelId = newId();
    this.angle = 0; // degrees
    this.speed = 0; // degrees per 0.05 s tick
    this.rate = 0;
    this.cw = Math.random() < 0.5;
    this.dc = 0;
    this.reverse = null; // seconds left before the pending reversal
    this.armed = true;
    this.acc = 0;
    this.slows = new Map();
  }

  // One 0.05 s tick of the original's "Wheel Motion" trigger.
  wheelTick() {
    if (this.rate < 10) this.rate = Math.min(10, this.rate + 0.01);
    this.speed += ((this.cw ? -1 : 1) * this.rate) / 1000;
    this.angle += this.speed;
    if (this.armed && Math.abs(this.speed) >= 2) {
      this.armed = false;
      this.reverse = this.dc + 1;
    }
    if (this.reverse != null) {
      this.reverse -= TICK;
      if (this.reverse <= 0) {
        this.reverse = null;
        this.cw = !this.cw;
        this.dc++;
      }
    }
    if (!this.armed && this.reverse == null && Math.abs(this.speed) <= 1) this.armed = true;
  }

  fires() {
    const out = [[0, 0]];
    for (let s = 0; s < 4; s++) {
      const a = (this.angle + s * 90) * DEG;
      for (const r of SPOKE) out.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return out;
  }

  tick(dt) {
    for (const [pid, t] of this.slows) {
      const u = this.heroes.get(pid);
      const nt = t + dt;
      this.slows.set(pid, nt);
      u.speedMult = Math.min(1, nt / 2);
      if (nt >= 2) this.slows.delete(pid);
    }
    this.stepHeroes(dt);
    for (const [, u] of this.heroes) if (u.alive) clampToCircle(u, R);
    this.acc += dt;
    while (this.acc >= TICK) {
      this.acc -= TICK;
      this.wheelTick();
      const fires = this.fires();
      for (const [pid, u] of this.heroes) {
        if (u.alive && fires.some(([x, y]) => dist(u.x, u.y, x, y) <= FIRE_R)) this.eliminate(pid, 'burn');
      }
    }
  }

  pickRival(pid, u, x, y) {
    let best = null;
    let bd = 2.5;
    for (const [op, v] of this.heroes) {
      if (op === pid || !v.alive) continue;
      const d = dist(x, y, v.x, v.y);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    if (!best) return null;
    if (dist(u.x, u.y, best.x, best.y) > this.spell.range) return null;
    return { x: best.x, y: best.y, u: best };
  }

  purge(u, v) {
    if (!v?.alive) return;
    this.ev({ k: 'bolt', x1: round2(u.x), y1: round2(u.y), x2: round2(v.x), y2: round2(v.y) });
    this.ev({ k: 'sfx', s: 'zap' });
    v.speedMult = 0;
    this.slows.set(v.owner, 0);
  }

  // Run with the wheel: stay mid-way between two spokes, at a radius where you can keep pace.
  botThink(pid, u, mem) {
    if (Math.random() > mem.skill) return;
    const omega = (this.speed / TICK) * DEG; // rad/s
    const th = Math.atan2(u.y, u.x);
    const base = this.angle * DEG + Math.PI / 4;
    const k = Math.round((th - base) / (Math.PI / 2));
    const mid = base + k * (Math.PI / 2);
    const keep = Math.abs(omega) > 0.05 ? (u.speed * 0.8) / Math.abs(omega) : R;
    const r = Math.max(wc3(200), Math.min(R - 0.8, keep, Math.max(Math.hypot(u.x, u.y), wc3(300))));
    const lead = mid + omega * 0.35;
    u.order(Math.cos(lead) * r, Math.sin(lead) * r);
    if (this.charges.get(pid) > 0 && Math.random() < 0.03) {
      const rivals = [...this.heroes.values()].filter((v) => v !== u && v.alive);
      if (rivals.length) {
        const v = rivals[Math.floor(Math.random() * rivals.length)];
        this.castSpell(pid, v.x, v.y);
      }
    }
  }

  worldEnts() {
    return [{ id: this.wheelId, k: 'firewheel', x: 0, y: 0, a: round2(this.angle * DEG), rs: SPOKE.map(round2), fr: round2(FIRE_R) }];
  }
}
