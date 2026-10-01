import { Minigame } from '../../base.js';
import { wc3, rand, round2 } from '../../../engine/server/sim.js';
import { ring, noTies } from './ux2-common.js';

export const STOMP = { hp: 1000, speed: wc3(200), duelSpeed: wc3(300), r: wc3(48), radius: wc3(150), cd: 10, duelCd: 1.5, damage: 5000, pause: 3.5, decoyPeriod: 4, decoyChance: 0.25 };
const HW = wc3(480);
export class StompOfDoom extends Minigame {
  static id = 'stomp'; static name = 'Stomp of Doom'; static desc = 'Invisible doom guards hunt by watching stomp flashes. Stomp nearby rivals, and beware decoy flashes.';
  static controls = 'Move with right-click or joystick. Q stomps within 150 Warcraft units. At two survivors, stomps recharge rapidly.';
  static duration = 150; static ranking = 'survival';
  setup() {
    this.map = { theme: 'night', floor: { shape: 'rect', w: HW * 2, h: HW * 2 }, props: [], bounds: HW + 2 };
    this.abilities = [{ name: 'Stomp of Doom', icon: '💥', desc: 'Kill every nearby rival. The flash reveals your position.', kind: 'instant', cd: STOMP.cd, castPoint: 0.5, available: () => this.time >= STOMP.pause, cast: (pid, u) => this.stomp(pid, u) }];
    this.spawnHeroes(ring(this.pids.length, 450), { hp: STOMP.hp, speed: STOMP.speed, r: STOMP.r, regen: 0.5, turnRate: 0.4 });
    for (const u of this.heroes.values()) u.skin = 'uxdoom';
    this.duel = false; this.decoy = STOMP.decoyPeriod;
    // Every flash anyone could see (real or decoy): what bots know of the others.
    this.flashes = [];
  }
  command(pid, m) { if (this.time >= STOMP.pause) super.command(pid, m); }
  stomp(pid, u) { this.flash(u.x, u.y, pid); this.ev({ k: 'uxstomp', x: round2(u.x), y: round2(u.y) }); for (const [op, v] of this.heroes) if (op !== pid && v.alive && Math.hypot(u.x - v.x, u.y - v.y) <= STOMP.radius) this.damage(op, STOMP.damage); }
  tick(dt) {
    if (this.time < STOMP.pause) return;
    if (!this.duel && this.alive.length === 2) { this.duel = true; for (const u of this.heroes.values()) u.speed = STOMP.duelSpeed; this.abilities[0].cd = STOMP.duelCd; this.ev({ k: 'txt', x: 0, y: 0, s: 'DEATH MATCH MODE!', c: '#ff6244' }); }
    this.stepHeroes(dt);
    for (const u of this.heroes.values()) { u.x = Math.max(-HW + u.r, Math.min(HW - u.r, u.x)); u.y = Math.max(-HW + u.r, Math.min(HW - u.r, u.y)); }
    this.decoy -= dt;
    if (this.decoy <= 0) { this.decoy += STOMP.decoyPeriod; if (Math.random() < STOMP.decoyChance) { const a = rand(0, Math.PI * 2), r = wc3(rand(300, 500)); this.flash(Math.cos(a) * r, Math.sin(a) * r, 0); this.ev({ k: 'uxstomp', x: round2(Math.cos(a) * r), y: round2(Math.sin(a) * r), decoy: 1 }); } }
  }
  flash(x, y, by) {
    this.flashes.push({ x, y, by, t: this.time });
    if (this.flashes.length > 12) this.flashes.shift();
  }

  // Bots know only what a player knows: the flashes, and a bump when they walk
  // into someone they cannot see. Each bot decides for itself whether a flash
  // is worth the risk, sneaks up on it from its own side, stomps once and
  // moves on; otherwise it prowls.
  botThink(pid, u, mem) {
    const ready = this.acd.get(pid)[0] <= 0;
    const bump = [...this.heroes.values()].some((v) => v.alive && v !== u && Math.hypot(u.x - v.x, u.y - v.y) < u.r + v.r + 0.25);
    if (bump && ready && Math.random() < 0.08 + mem.skill * 0.1) return this.useAbility(pid, 0, u.x, u.y);
    const fresh = this.flashes.filter((f) => f.by !== pid && f.t > (mem.seen ?? 0));
    if (fresh.length) {
      mem.seen = this.time;
      const f = fresh[fresh.length - 1];
      if (Math.random() < 0.3 + mem.skill * 0.3) {
        const a = rand(0, Math.PI * 2);
        const off = rand(0.5, 2);
        mem.chase = { x: f.x + Math.cos(a) * off, y: f.y + Math.sin(a) * off, until: this.time + rand(3, 6) };
      }
    }
    const c = mem.chase;
    if (c && this.time < c.until) {
      if (Math.hypot(u.x - c.x, u.y - c.y) > 0.8) return u.order(c.x, c.y);
      mem.chase = null;
      if (ready && Math.random() < 0.3 + mem.skill * 0.3) return this.useAbility(pid, 0, u.x, u.y);
      return;
    }
    mem.chase = null;
    if (!u.target && Math.random() < 0.06) {
      const lim = (v) => Math.max(-HW * 0.85, Math.min(HW * 0.85, v));
      u.order(lim(u.x + rand(-3, 3)), lim(u.y + rand(-3, 3)));
    }
  }
  heroEnts(pid) { return super.heroEnts(pid).filter((e) => e.o === pid); }
  hud() { return { label: this.duel ? 'DEATH MATCH — rapid stomps!' : `${this.alive.length} invisible stompers remain` }; }
}
noTies(StompOfDoom);
