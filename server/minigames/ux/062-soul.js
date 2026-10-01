import { Minigame } from '../../base.js';
import { wc3, rand, dist, round2 } from '../../../engine/server/sim.js';
import { ring, noTies, nearest } from './ux2-common.js';

export const SOUL = {hp:250,speed:wc3(300),r:wc3(31),range:wc3(128),attackCd:1.35,attackPoint:0.6,swapRange:wc3(600),swapCast:3.5,swapCd:10,pause:5};
const HW=wc3(640);
export class SoulExchange extends Minigame {
  static id='soul';static name='The Soul Exchange';static desc='Brawl as ice revenants. Channel Soul Displace to exchange bodies, health and cooldown with a rival.';
  static controls='Right-click a rival to attack. Q then click a rival within 600 units to channel a body swap.';
  static duration=150;static ranking='survival';
  setup(){this.map={theme:'grass',floor:{shape:'rect',w:HW*2,h:HW*2},props:[...Array.from({length:14},(_,i)=>{const a=i*2.399,r=wc3(180+(i%4)*100);return{t:'bush',x:Math.cos(a)*r,y:Math.sin(a)*r,s:0.7};}),{t:'rock',x:0,y:0,s:1.5}],bounds:HW+2,build:['uxsoul']};
    this.attack={range:SOUL.range,cd:SOUL.attackCd,point:SOUL.attackPoint,dmg:27/(1+0.06*4),missile:0};
    this.abilities=[{name:'Soul Displace',icon:'🔮',desc:'Channel for 3 seconds, then swap bodies, HP and cooldown with a rival.',kind:'unit',range:SOUL.swapRange,castPoint:SOUL.swapCast,cd:SOUL.swapCd,pickTarget:(pid,u,x,y)=>{let v=nearest({x,y,alive:true},[...this.heroes.values()].filter((a)=>a.owner!==pid),wc3(70));return v&&dist(u.x,u.y,v.x,v.y)<=SOUL.swapRange?{x:v.x,y:v.y,u:v}:null;},cast:(pid,u,t)=>this.swap(pid,u,t.u)}];
    this.spawnHeroes(ring(this.pids.length,600),{hp:SOUL.hp,speed:SOUL.speed,r:SOUL.r});for(const u of this.heroes.values())u.skin='uxrevenant';}
  command(pid,m){if(this.time<SOUL.pause)return;const u=this.heroes.get(pid);if(u?.cast&&(m.c==='move'||m.c==='steer'||m.c==='stop')){u.cast=null;u.stop();}super.command(pid,m);}
  swap(pid,u,v){if(!v.alive||!u.alive||dist(u.x,u.y,v.x,v.y)>SOUL.swapRange)return;const op=v.owner;const a=this.acd.get(pid)[0],b=this.acd.get(op)[0];this.heroes.set(pid,v);this.heroes.set(op,u);v.owner=pid;u.owner=op;this.acd.get(pid)[0]=b;this.acd.get(op)[0]=a;u.attackOrder=null;v.attackOrder=null;this.ev({k:'uxswap',x1:round2(u.x),y1:round2(u.y),x2:round2(v.x),y2:round2(v.y),id1:u.id,id2:v.id,o1:op,o2:pid});}
  tick(dt){if(this.time<SOUL.pause)return;this.stepHeroes(dt);for(const u of this.heroes.values()){u.x=Math.max(-HW,Math.min(HW,u.x));u.y=Math.max(-HW,Math.min(HW,u.y));}}
  botThink(pid,u,mem){const v=nearest(u,[...this.heroes.values()].filter((a)=>a.owner!==pid),SOUL.swapRange);if(!v)return;if(u.hp<v.hp-50&&this.acd.get(pid)[0]<=0&&Math.random()<0.2)this.useAbility(pid,0,v.x,v.y);else u.attackOrder=v;}
  hud(pid){return{label:`Body ${Math.ceil(this.heroes.get(pid)?.hp||0)} HP · swap cooldown ${Math.max(0,this.acd.get(pid)?.[0]||0).toFixed(1)} s`};}
}
noTies(SoulExchange);
