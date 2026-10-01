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
  }
  command(pid, m) { if (this.time >= STOMP.pause) super.command(pid, m); }
  stomp(pid, u) { this.ev({ k: 'uxstomp', x: round2(u.x), y: round2(u.y) }); for (const [op, v] of this.heroes) if (op !== pid && v.alive && Math.hypot(u.x - v.x, u.y - v.y) <= STOMP.radius) this.damage(op, STOMP.damage); }
  tick(dt) {
    if (this.time < STOMP.pause) return;
    if (!this.duel && this.alive.length === 2) { this.duel = true; for (const u of this.heroes.values()) u.speed = STOMP.duelSpeed; this.abilities[0].cd = STOMP.duelCd; this.ev({ k: 'txt', x: 0, y: 0, s: 'DEATH MATCH MODE!', c: '#ff6244' }); }
    this.stepHeroes(dt);
    for (const u of this.heroes.values()) { u.x = Math.max(-HW + u.r, Math.min(HW - u.r, u.x)); u.y = Math.max(-HW + u.r, Math.min(HW - u.r, u.y)); }
    this.decoy -= dt;
    if (this.decoy <= 0) { this.decoy += STOMP.decoyPeriod; if (Math.random() < STOMP.decoyChance) { const a = rand(0, Math.PI * 2), r = wc3(rand(300, 500)); this.ev({ k: 'uxstomp', x: round2(Math.cos(a) * r), y: round2(Math.sin(a) * r), decoy: 1 }); } }
  }
  botThink(pid, u, mem) {
    const foes = [...this.heroes.values()].filter((v) => v.alive && v !== u);
    let target = foes.sort((a, b) => Math.hypot(u.x-a.x,u.y-a.y)-Math.hypot(u.x-b.x,u.y-b.y))[0];
    if (!target) return;
    const d = Math.hypot(u.x-target.x,u.y-target.y);
    if (d < STOMP.radius * (0.75 + mem.skill * 0.35) && this.acd.get(pid)[0] <= 0) this.useAbility(pid, 0, u.x, u.y);
    else u.order(target.x + rand(-0.6, 0.6), target.y + rand(-0.6, 0.6));
  }
  heroEnts(pid) { return super.heroEnts(pid).filter((e) => e.o === pid); }
  hud() { return { label: this.duel ? 'DEATH MATCH — rapid stomps!' : `${this.alive.length} invisible stompers remain` }; }
}
noTies(StompOfDoom);
