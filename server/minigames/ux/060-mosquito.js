import { Minigame } from '../../base.js';
import { Unit, wc3, round2, dist } from '../../../engine/server/sim.js';
import { ring, rim } from './ux2-common.js';

export const MOSQUITO = { hp: 1000, speed: wc3(350), r: wc3(8), drain: 25, biteCd: 0.6, biteRange: wc3(130), biteHeal: 20, ogreHp: 5000, ogreRegen: 500, ogreSpeed: wc3(30), ogreRange: wc3(80), ogreDamage: 200, ogreCd: 3.5, pause: 3 };
const HW = wc3(656), HH = wc3(640);
export class MosquitoSwarm extends Minigame {
  static id = 'mosquito'; static name = 'Mosquito Swarm'; static desc = 'Bite the giant ogre to heal while your life drains. Fly away when it turns to swat you. Last mosquito survives.';
  static controls = 'Right-click or tap the ogre to bite. Move with right-click or joystick to dodge its swing.';
  static duration = 240; static timer = false; static ranking = 'survival';
  setup() {
    this.map = { theme: 'grass', floor: { shape: 'rect', w: HW*2, h: HH*2 }, props: rim(HW, HH, 'tree'), bounds: HW+2 };
    this.attack = { range: MOSQUITO.biteRange, cd: MOSQUITO.biteCd, point: MOSQUITO.biteCd, dmg: 0, missile: 0 };
    this.spawnHeroes(ring(this.pids.length, 400), { hp: MOSQUITO.hp, speed: MOSQUITO.speed, r: MOSQUITO.r, turnRate: 0.4 });
    for (const u of this.heroes.values()) u.skin = 'uxmosquito';
    this.ogre = new Unit({ kind: 'uxogre', x: 0, y: 0, r: wc3(48), speed: MOSQUITO.ogreSpeed, hp: MOSQUITO.ogreHp }); this.ogre.cd = 0; this.ogre.aggro = null; this.drainT = 1;
  }
  attackables() { return [this.ogre]; }
  command(pid, m) { if (this.time >= MOSQUITO.pause) super.command(pid, m); }
  attackHit(pid, u, tgt) { if (tgt !== this.ogre || !u.alive) return; tgt.hp = Math.max(1, tgt.hp - 2); u.hp = Math.min(u.maxHp, u.hp + MOSQUITO.biteHeal); this.ogre.aggro = pid; this.ev({ k: 'hit', x: round2(tgt.x), y: round2(tgt.y) }); }
  tick(dt) {
    if (this.time < MOSQUITO.pause) return;
    this.stepHeroes(dt);
    for (const u of this.heroes.values()) { u.x = Math.max(-HW, Math.min(HW, u.x)); u.y = Math.max(-HH, Math.min(HH, u.y)); }
    this.drainT -= dt;
    if (this.drainT <= 0) { this.drainT += 1; for (const pid of this.alive) this.damage(pid, MOSQUITO.drain); }
    this.ogre.hp = Math.min(MOSQUITO.ogreHp, this.ogre.hp + MOSQUITO.ogreRegen * dt);
    this.ogre.cd -= dt;
    let victim = this.heroes.get(this.ogre.aggro);
    if (!victim?.alive) victim = [...this.heroes.values()].find((u) => u.alive && dist(u.x,u.y,this.ogre.x,this.ogre.y)<wc3(100));
    if (victim) {
      if (dist(victim.x,victim.y,this.ogre.x,this.ogre.y) > MOSQUITO.ogreRange) this.ogre.order(victim.x,victim.y);
      else { this.ogre.stop(); if (this.ogre.cd <= 0) { this.ogre.cd = MOSQUITO.ogreCd; this.damage(victim.owner, MOSQUITO.ogreDamage, 'squish'); this.ev({ k: 'swing', u: this.ogre.id }); } }
    }
    this.ogre.logicStep();
    if (this.ogre.walking) { this.ogre.x += Math.cos(this.ogre.heading)*this.ogre.speed*dt; this.ogre.y += Math.sin(this.ogre.heading)*this.ogre.speed*dt; }
  }
  botThink(pid, u, mem) { const d = dist(u.x,u.y,this.ogre.x,this.ogre.y); if (this.ogre.aggro === pid && d < wc3(110) && u.hp < 500) { u.attackOrder = null; u.order(this.ogre.x + (u.x-this.ogre.x)*3, this.ogre.y + (u.y-this.ogre.y)*3); } else u.attackOrder = this.ogre; }
  worldEnts() { return [{ id: this.ogre.id, k: 'uxogre', x: round2(this.ogre.x), y: round2(this.ogre.y), f: round2(this.ogre.facing) }]; }
  hud(pid) { return { label: `Life ${Math.ceil(this.heroes.get(pid)?.hp || 0)} — bite for +20` }; }
}
