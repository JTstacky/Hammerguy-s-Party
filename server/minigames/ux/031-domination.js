import { Minigame } from '../../base.js';
import { wc3, dist, clampToRect, round2 } from '../../../engine/server/sim.js';
import { ring, shuffled, nearestEnemy } from './ux1-common.js';

export const DH = { hp: 100, speed: wc3(320), r: wc3(31), aura: wc3(250), burn: 10, disable: wc3(300), pause: 5 };
const HW = wc3(560), HH = wc3(576), P = wc3(128);
const PILLARS = [[wc3(-284), wc3(236)], [wc3(228), wc3(-276)]];

export class Domination extends Minigame {
  static id = 'domination'; static name = 'Domination';
  static desc = 'Demon Hunters burn nearby rivals with Immolation. Mana Burn switches a rival’s fire off. Last hunter alive wins.';
  static controls = 'Q: toggle Immolation. W, then click a rival: switch their Immolation off. Right-click to move.';
  static duration = 150; static ranking = 'survival';
  setup() {
    this.map = { theme: 'ux-fog', floor: { shape: 'rect', w: HW * 2, h: HH * 2 }, bounds: HW + 3, props: [], build: ['ux-domination'] };
    this.abilities = [
      { name: 'Immolation', icon: '🔥', desc: 'Toggle a free aura that deals 10 damage per second within 250 WC3 units.', kind: 'instant', cast: (pid,u) => { u.immolate = !u.immolate; this.ev({ k: 'uxflame', x: round2(u.x), y: round2(u.y) }); } },
      { name: 'Mana Burn', icon: '🟣', desc: 'Switch off a rival’s Immolation. They can switch it back on immediately.', kind: 'unit', range: DH.disable, castPoint: 0.3, pickTarget: (pid,u,x,y) => { const v = [...this.heroes.values()].find(v => v.owner !== pid && v.alive && dist(x,y,v.x,v.y) < v.r + 0.8 && dist(u.x,u.y,v.x,v.y) <= DH.disable); return v ? { x:v.x,y:v.y,u:v } : null; }, cast: (pid,u,t) => { if (t.u.alive) t.u.immolate = false; } },
    ];
    this.spawnHeroes(shuffled(ring(this.pids.length, 200)), { hp: DH.hp, speed: DH.speed, r: DH.r, turnRate: 0.5 });
    for (const u of this.heroes.values()) { u.skin = 'ux-dh'; u.immolate = false; }
  }
  command(pid,m) { if (this.time < DH.pause) return; super.command(pid,m); }
  tick(dt) {
    if (this.time < DH.pause) return;
    this.stepHeroes(dt);
    for (const [pid,u] of this.heroes) {
      if (!u.alive) continue;
      clampToRect(u, HW-u.r, HH-u.r);
      for (const [x,y] of PILLARS) { const dx=u.x-x, dy=u.y-y; if (Math.abs(dx)<P+u.r && Math.abs(dy)<P+u.r) { if (Math.abs(dx)>Math.abs(dy)) u.x=x+Math.sign(dx||1)*(P+u.r); else u.y=y+Math.sign(dy||1)*(P+u.r); } }
      let burners=0;
      for (const [op,v] of this.heroes) if (op!==pid && v.alive && v.immolate && dist(u.x,u.y,v.x,v.y)<=DH.aura) burners++;
      if (burners) this.damage(pid, burners*DH.burn*dt, 'burn');
    }
  }
  botThink(pid,u,mem) {
    if (this.time < DH.pause) return;
    if (!u.immolate) this.useAbility(pid,0,u.x,u.y);
    const v=nearestEnemy(this,pid,u); if (!v) return;
    if (v.immolate && dist(u.x,u.y,v.x,v.y)<=DH.disable && Math.random()<0.18) this.useAbility(pid,1,v.x,v.y);
    if ((mem.next||0)>this.time) return;
    mem.next=this.time+0.5+Math.random()*0.6;
    const a=Math.atan2(v.y-u.y,v.x-u.x)+(mem.skill<0.6?0.4:0);
    const goal=wc3(190+pid%3*20); u.order(v.x-Math.cos(a)*goal,v.y-Math.sin(a)*goal);
  }
  heroEnts(pid) { return super.heroEnts(pid).map(e => ({ ...e, im: this.heroes.get(e.o)?.immolate ? 1 : 0 })); }
  hud(pid) { return { label: `Hunters: ${this.alive.length} · Immolation ${this.heroes.get(pid)?.immolate?'ON':'OFF'}` }; }
  worldEnts() { return [{ id:'ux-dh-keys', k:'uxdhkeys', x:0, y:0 }]; }
}
// Ultima-X disables same-instant survival ties for this duel.
Domination.prototype.deathGroups = function () { return this.elimOrder.map(e => [e.pid]); };
