import { Minigame } from '../../base.js';
import { wc3, dist, round2, rand, pick, clamp } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';

// Ultima-X #74. During a pass the child is absent for distance / 1400 seconds.
export const FETCH = { houndSpeed: wc3(350), childSpeed: wc3(190), passRange: wc3(2000), passSpeed: wc3(1400), biteRange: wc3(100) };

export class Fetch extends Minigame {
  static id = 'uxfetch';
  static name = 'Fetch!';
  static desc = 'Felhounds hunt the Child. As Child, stand still for one second to pass the curse.';
  static controls = 'Right-click to move or bite the Child. As Child, Q then click a hound to pass.';
  static duration = 150;
  static ranking = 'survival';

  setup() {
    const half = wc3(800);
    this.map = { theme: 'night', floor: { shape: 'rect', w: half * 2, h: half * 2 },
      props: treesAroundRect(half, half, 0.5, 1.5), build: ['uxfetch'], bounds: half + 3 };
    this.abilities = [{ name: 'Pass', icon: '🔮', desc: 'After a one second cast, pass Child to a hound within 2000 WC3 units.',
      kind: 'unit', cd: 0, castPoint: 1, range: FETCH.passRange,
      available: (pid) => this.child === pid && !this.transfer,
      pickTarget: (pid, u, x, y) => {
        for (const [op, v] of this.heroes) if (op !== pid && v.alive && dist(v.x, v.y, x, y) < v.r + 0.8 && dist(u.x, u.y, v.x, v.y) <= FETCH.passRange) return { x: v.x, y: v.y, u: v };
        return null;
      }, cast: (pid, u, tgt) => this.pass(pid, u, tgt.u) }];
    this.attack = { range: FETCH.biteRange, cd: 1.35, point: 0.3, dmg: 50, missile: 0, art: 'hit' };
    this.spawnHeroes(this.pids.map((_, i) => {
      const a = Math.PI / 8 + i * Math.PI / 4;
      return [Math.cos(a) * wc3(400), Math.sin(a) * wc3(400)];
    }), { hp: 100, speed: FETCH.houndSpeed, r: wc3(31) });
    for (const u of this.heroes.values()) u.skin = 'uxfelhound';
    this.child = null;
    this.transfer = null;
    this.nextChild = 4;
    this.protectUntil = 0;
  }

  becomeChild(pid, protection = 0) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return;
    this.child = pid;
    u.skin = 'uxchild';
    u.speed = FETCH.childSpeed;
    u.hp = 15;
    u.r = wc3(16);
    u.attackOrder = null;
    this.protectUntil = this.time + protection;
    this.ev({ k: 'uxcurse', x: round2(u.x), y: round2(u.y) });
  }

  becomeHound(pid) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return;
    u.skin = 'uxfelhound';
    u.speed = FETCH.houndSpeed;
    u.hp = 100;
    u.r = wc3(31);
  }

  pass(pid, u, target) {
    if (this.child !== pid || !u.alive || !target.alive) return;
    this.child = null;
    this.becomeHound(pid);
    this.transfer = { target: target.owner, at: this.time + dist(u.x, u.y, target.x, target.y) / FETCH.passSpeed };
    this.ev({ k: 'uxpass', x: round2(u.x), y: round2(u.y), tx: round2(target.x), ty: round2(target.y) });
  }

  attackables(pid) {
    const v = this.heroes.get(this.child);
    return v?.alive && pid !== this.child ? [v] : [];
  }

  attackHit(pid, u, tgt) {
    if (tgt.owner !== this.child || this.time < this.protectUntil) return;
    this.damage(this.child, 50);
    if (!tgt.alive) {
      this.child = null;
      this.nextChild = this.time + 2;
    }
  }

  tick(dt) {
    if (this.transfer && this.time >= this.transfer.at) {
      const chosen = this.heroes.get(this.transfer.target)?.alive ? this.transfer.target : pick(this.alive);
      this.transfer = null;
      if (chosen != null) this.becomeChild(chosen);
    }
    if (this.child == null && !this.transfer && this.time >= this.nextChild) {
      const chosen = pick(this.alive);
      if (chosen != null) this.becomeChild(chosen, 3);
      this.nextChild = Infinity;
    }
    this.stepHeroes(dt);
    const edge = wc3(760);
    for (const u of this.heroes.values()) {
      u.x = clamp(u.x, -edge, edge);
      u.y = clamp(u.y, -edge, edge);
    }
  }

  botThink(pid, u, mem) {
    if (this.child === pid) {
      if (this.time < this.protectUntil && this.protectUntil - this.time > 1) return;
      const foes = [...this.heroes.values()].filter((v) => v.alive && v !== u);
      if (!foes.length) return;
      const nearest = foes.reduce((a, b) => dist(u.x, u.y, a.x, a.y) < dist(u.x, u.y, b.x, b.y) ? a : b);
      if (this.acd.get(pid)[0] <= 0 && !u.cast && dist(u.x, u.y, nearest.x, nearest.y) < FETCH.passRange * 0.8) {
        const target = foes[(pid + Math.floor(this.time)) % foes.length];
        this.useAbility(pid, 0, target.x, target.y);
      } else u.order(clamp(u.x + (u.x - nearest.x) * 0.5, -12, 12), clamp(u.y + (u.y - nearest.y) * 0.5, -12, 12));
    } else if (this.child != null) {
      const v = this.heroes.get(this.child);
      if (v?.alive) u.attackOrder = v;
    } else u.order(rand(-8, 8), rand(-8, 8));
  }

  hud(pid) { return { label: this.child === pid ? 'YOU ARE THE CHILD — PASS!' : this.child == null ? 'Waiting for Child...' : `Hunt the Child · ${this.alive.length} remain` }; }
}
