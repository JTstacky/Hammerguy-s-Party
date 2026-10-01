import { Minigame } from '../../base.js';
import { newId, wc3, rand, round2, dist } from '../../../engine/server/sim.js';
import { ring, noTies } from './ux2-common.js';

export const GHOSTLY = { hp: 100, speed: wc3(1), r: wc3(16), pool: 40, range: wc3(250), drain: 20, cast: 0.5, pause: 5, firstDrain: 7 };
const HW = wc3(480);
export class GhostlyGambit extends Minigame {
  static id = 'ghostly'; static name = 'Ghostly Gambit'; static desc = 'Possess neutral banshees before your current body fades. Bodies vanish after each jump; the last ghost wins.';
  static controls = 'Right-click or tap a neutral ghost within 250 Warcraft units. Q then click also possesses it.';
  static duration = 90; static timer = false; static ranking = 'survival';
  setup() {
    this.map = { theme: 'night', floor: { shape: 'rect', w: HW*2, h: HW*2 }, props: [], bounds: HW+2 };
    this.abilities = [{ name: 'Possession', icon: '👻', desc: 'Jump into a neutral banshee within 250 units. Your old body vanishes.', kind: 'unit', range: GHOSTLY.range, castPoint: GHOSTLY.cast, pickTarget: (pid,u,x,y) => this.pick(u,x,y), cast: (pid,u,t) => this.possess(pid,u,t.g) }];
    this.spawnHeroes(ring(this.pids.length,400,22.5), { hp: GHOSTLY.hp, speed: GHOSTLY.speed, r: GHOSTLY.r });
    for (const u of this.heroes.values()) u.skin = 'uxghost';
    this.pool = Array.from({length:GHOSTLY.pool}, () => ({ id:newId(), x:rand(-HW,HW), y:rand(-HW,HW), alive:true })); this.drainT = 1;
  }
  pick(u,x,y) { let best = null, bd = wc3(55); for (const g of this.pool) { const d=dist(x,y,g.x,g.y); if (g.alive && d<bd) {best=g;bd=d;} } return best && dist(u.x,u.y,best.x,best.y)<=GHOSTLY.range ? {x:best.x,y:best.y,g:best} : null; }
  possess(pid,u,g) { if (!g.alive || dist(u.x,u.y,g.x,g.y)>GHOSTLY.range) return; const x=u.x,y=u.y; g.alive=false; u.x=g.x;u.y=g.y;u.hp=GHOSTLY.hp;u.stop(); this.ev({k:'uxpossess',x1:round2(x),y1:round2(y),x2:round2(u.x),y2:round2(u.y)}); }
  command(pid,m) { if (this.time<GHOSTLY.pause) return; if (m.c==='move' || m.c==='attack') { const u=this.heroes.get(pid); const t=this.pick(u,+m.x||0,+m.y||0); if(t) this.useAbility(pid,0,t.x,t.y); return; } if (m.c==='steer') return; super.command(pid,m); }
  tick(dt) { if (this.time<GHOSTLY.pause) return; this.stepHeroes(dt); if (this.time>=GHOSTLY.firstDrain) { this.drainT-=dt; if(this.drainT<=0) {this.drainT+=1; for(const pid of this.alive) this.damage(pid,GHOSTLY.drain);}} }
  botThink(pid,u,mem) { if (u.hp>40 && Math.random()>0.04) return; let best=null,score=-Infinity; for(const g of this.pool) if(g.alive && dist(u.x,u.y,g.x,g.y)<=GHOSTLY.range) {const nearby=this.pool.filter((h)=>h.alive&&h!==g&&dist(g.x,g.y,h.x,h.y)<GHOSTLY.range).length;const s=nearby*2+rand(0,mem.skill);if(s>score){best=g;score=s;}} if(best) this.useAbility(pid,0,best.x,best.y); }
  worldEnts() {return this.pool.filter((g)=>g.alive).map((g)=>({id:g.id,k:'uxneutralghost',x:round2(g.x),y:round2(g.y)}));}
  hud(pid) {return {label:`Body ${Math.ceil(this.heroes.get(pid)?.hp||0)} HP · ${this.pool.filter((g)=>g.alive).length} neutral ghosts remain`};}
}
// Ghostly Gambit allows same-tick ties: use the base deathGroups implementation.
