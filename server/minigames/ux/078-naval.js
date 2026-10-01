import { Minigame } from '../../base.js';
import { newId, rand, dist, round2, wc3 } from '../../../engine/server/sim.js';
import { noTies } from '../up/e-common.js';

const HW = wc3(1024);
const HH = wc3(960);
const DEG = Math.PI / 180;
export const SHIP = { hp: 700, speed: wc3(300), r: wc3(48), turnRate: 1 };
export const FIRE = { range: wc3(1200), cd: 1, speed: wc3(400), tiers: [[25, 300], [150, 150], [250, 45]] };
export const BIG = { range: wc3(1200), cd: 20, castPoint: 4, speed: wc3(250), tiers: [[125, 901], [400, 450], [750, 135]] };

// Ultima-X #78: artillery targets ground points; splash hits every ship,
// including the firer. The Big One roots for four seconds before launch.
export class GreatNavalEnmity extends Minigame {
  static id = 'ux-naval';
  static name = 'Great Naval Enmity';
  static desc = 'Lead moving battleships with shells. The Big One can sink a ship in a single hit.';
  static controls = 'Right-click to sail. Q then tap: Fire. W then tap: The Big One.';
  static duration = 150;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'sea', floor: { shape: 'rect', w: HW * 2, h: HH * 2 },
      props: [{ t: 'rock', x: HW - 2, y: -HH + 2, s: 1.4 }, { t: 'rock', x: -HW + 2, y: HH - 2, s: 1.6 }],
      build: ['sea', 'uxnaval'], bounds: HW + 3 };
    this.abilities = [
      { name: 'Fire', icon: '💥', desc: 'Fast shell with 300 / 150 / 45 splash.', kind: 'point',
        cd: FIRE.cd, range: FIRE.range, available: (pid) => !(this.heroes.get(pid)?.bigFollow > 0),
        pickTarget: (pid, u, x, y) => dist(u.x, u.y, x, y) <= FIRE.range ? { x, y } : null,
        cast: (pid, u, p) => this.fire(u, p, FIRE) },
      { name: 'The Big One', icon: '☄️', desc: 'Four-second rooted cast. One-shot core splash.', kind: 'point',
        cd: BIG.cd, range: BIG.range, available: (pid) => !(this.heroes.get(pid)?.bigFollow > 0),
        pickTarget: (pid, u, x, y) => dist(u.x, u.y, x, y) <= BIG.range ? { x, y } : null,
        castPoint: BIG.castPoint, cast: (pid, u, p) => this.fire(u, p, BIG) },
    ];
    this.spawnHeroes(this.pids.map((_, i) => {
      const a = ((i + 1) * 135 - 22.5) * DEG;
      return [Math.cos(a) * wc3(800), Math.sin(a) * wc3(800)];
    }), SHIP);
    for (const u of this.heroes.values()) u.skin = 'uxwarship';
    this.shells = [];
    this.sunk = new Set();
  }

  command(pid, m) {
    if (this.time < 5) return;
    const u = this.heroes.get(pid);
    if (u?.cast?.ab === this.abilities[1] && (m.c === 'move' || m.c === 'steer' || m.c === 'stop')) {
      u.cast = null;
      u.faceTo = null;
    }
    super.command(pid, m);
  }

  fire(u, p, gun) {
    const tx = Math.max(-HW, Math.min(HW, p.x));
    const ty = Math.max(-HH, Math.min(HH, p.y));
    const d = dist(u.x, u.y, tx, ty);
    if (d > gun.range) return;
    this.shells.push({ id: newId(), x: u.x, y: u.y, sx: u.x, sy: u.y,
      tx, ty, t: 0, flight: d / gun.speed, big: gun === BIG });
    if (gun === BIG) u.bigFollow = 2;
    this.ev({ k: 'sfx', s: 'cannon' });
  }

  damage(pid, amount, how = 'death') {
    super.damage(pid, amount, how);
    const u = this.heroes.get(pid);
    if (!u?.alive && !this.sunk.has(pid)) {
      this.sunk.add(pid);
      // Six wreck shells spread equally round the sinking hull.
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        const tx = u.x + Math.cos(a) * wc3(280);
        const ty = u.y + Math.sin(a) * wc3(280);
        this.shells.push({ id: newId(), x: u.x, y: u.y, sx: u.x, sy: u.y,
          tx, ty, t: 0, flight: wc3(280) / FIRE.speed, big: false });
      }
    }
  }

  impact(s) {
    const tiers = s.big ? BIG.tiers : FIRE.tiers;
    this.ev({ k: 'boom', s: 'fire', x: round2(s.tx), y: round2(s.ty), r: wc3(tiers.at(-1)[0]), big: s.big });
    for (const [pid, u] of this.heroes) {
      if (!u.alive) continue;
      const d = dist(s.tx, s.ty, u.x, u.y);
      const tier = tiers.find(([r]) => d <= wc3(r));
      if (tier) this.damage(pid, tier[1]);
    }
  }

  tick(dt) {
    if (this.time < 5) return;
    this.stepHeroes(dt);
    for (const u of this.heroes.values()) {
      u.bigFollow = Math.max(0, (u.bigFollow || 0) - dt);
      u.x = Math.max(-HW, Math.min(HW, u.x));
      u.y = Math.max(-HH, Math.min(HH, u.y));
    }
    for (const s of this.shells) {
      s.t += dt;
      const k = Math.min(1, s.t / Math.max(0.01, s.flight));
      s.x = s.sx + (s.tx - s.sx) * k;
      s.y = s.sy + (s.ty - s.sy) * k;
      if (k >= 1) { s.done = true; this.impact(s); }
    }
    this.shells = this.shells.filter((s) => !s.done);
  }

  // Bots sail broadside to their target and never sit still, step clear of
  // any shell about to land near them, and lead a moving target by its
  // measured speed (a shell takes a couple of seconds to arrive).
  botThink(pid, u, mem) {
    const rivals = [...this.heroes.values()].filter((v) => v.alive && v !== u);
    if (!rivals.length) return;
    const lim = (x, h) => Math.max(-h * 0.85, Math.min(h * 0.85, x));
    // Dodge: the first shell landing near us soon.
    const danger = this.shells.find((sh) => {
      const left = sh.flight - sh.t;
      const reach = wc3(sh.big ? 420 : 170);
      return left < 1.6 + mem.skill && dist(sh.tx, sh.ty, u.x, u.y) < reach;
    });
    if (danger && Math.random() < 0.4 + mem.skill * 0.5) {
      const a = Math.atan2(u.y - danger.ty, u.x - danger.tx) + rand(-0.5, 0.5);
      u.order(lim(u.x + Math.cos(a) * 5, HW), lim(u.y + Math.sin(a) * 5, HH));
      mem.next = this.time + 0.8;
    }
    // Track every ship's speed to lead our shots.
    mem.seen ??= new Map();
    for (const v of rivals) {
      const p = mem.seen.get(v.id);
      if (p && this.time > p.t) mem.seen.set(v.id, { x: v.x, y: v.y, t: this.time, vx: (v.x - p.x) / (this.time - p.t), vy: (v.y - p.y) / (this.time - p.t) });
      else if (!p) mem.seen.set(v.id, { x: v.x, y: v.y, t: this.time, vx: 0, vy: 0 });
    }
    rivals.sort((p, q) => dist(u.x, u.y, p.x, p.y) - dist(u.x, u.y, q.x, q.y));
    const v = rivals[0];
    const d = dist(u.x, u.y, v.x, v.y);
    const tr = mem.seen.get(v.id);
    if (d < FIRE.range && Math.random() < 0.5 + mem.skill * 0.4) {
      const lead = (d / FIRE.speed) * (0.4 + mem.skill * 0.6);
      this.useAbility(pid, 0, v.x + tr.vx * lead + rand(-0.6, 0.6), v.y + tr.vy * lead + rand(-0.6, 0.6));
    }
    // The Big One only at a ship that has stopped, from a safe distance.
    if (Math.hypot(tr.vx, tr.vy) < 0.5 && d > wc3(500) && Math.random() < 0.03) this.useAbility(pid, 1, v.x, v.y);
    if ((mem.next || 0) > this.time || u.cast) return;
    mem.next = this.time + rand(0.8, 1.6);
    // Keep about 700 u off, circling: broadside, never parked.
    mem.side ??= Math.random() < 0.5 ? 1 : -1;
    if (Math.random() < 0.15) mem.side = -mem.side;
    const a = Math.atan2(u.y - v.y, u.x - v.x) + mem.side * 0.7;
    const r = wc3(700);
    u.order(lim(v.x + Math.cos(a) * r, HW), lim(v.y + Math.sin(a) * r, HH));
  }

  worldEnts() {
    return this.shells.map((s) => ({ id: s.id, k: 'uxshell', x: round2(s.x), y: round2(s.y),
      p: round2(s.t / Math.max(0.01, s.flight)), b: s.big ? 1 : 0 }));
  }
}

noTies(GreatNavalEnmity);
