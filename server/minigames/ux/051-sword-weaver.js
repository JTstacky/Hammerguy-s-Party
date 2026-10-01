import { Minigame } from '../../base.js';
import { wc3, dist, clampToRect, round2 } from '../../../engine/server/sim.js';
import { ring, shuffled, nearestEnemy } from './ux1-common.js';

export const SWORD = { hp:475, regen:1, speed:wc3(350), r:wc3(32), dmg:75, armour:3.9, reach:wc3(150), radius:wc3(100), cd:0.35, castPoint:0.5, pause:5 };
const HW=wc3(480), CORNER=wc3(530);
export class SwordWeaver extends Minigame {
  static id='swordweaver'; static name='The Sword Weaver';
  static desc='Face your rival and weave a sword slash. Corner bumpers punish campers. Last paladin alive wins.';
  static controls='Q: slash a circle ahead of you. Right-click to move and face your target.';
  static duration=150; static ranking='survival';
  setup() {
    this.map={ theme:'ux-sword-stone', floor:{shape:'rect',w:HW*2,h:HW*2}, bounds:HW+3, props:[], build:['ux-sword'] };
    this.abilities=[{name:'Sword Attack',icon:'⚔️',desc:'75 damage in a 100-unit circle centred 150 units ahead. 0.35 s cooldown.',kind:'instant',cd:SWORD.cd,castPoint:SWORD.castPoint,cast:(pid,u)=>this.slash(pid,u)}];
    this.spawnHeroes(shuffled(ring(this.pids.length,400)),{hp:SWORD.hp,regen:SWORD.regen,speed:SWORD.speed,r:SWORD.r});
    for(const u of this.heroes.values())u.skin='ux-swordsman';
    this.zapT=0;
  }
  command(pid,m){if(this.time<SWORD.pause)return;super.command(pid,m);}
  slash(pid,u){const x=u.x+Math.cos(u.heading)*SWORD.reach,y=u.y+Math.sin(u.heading)*SWORD.reach;this.ev({k:'uxslash',x:round2(x),y:round2(y),f:round2(u.heading)});for(const [op,v] of this.heroes)if(op!==pid&&v.alive&&dist(x,y,v.x,v.y)<=SWORD.radius+v.r)this.damage(op,SWORD.dmg/(1+0.06*SWORD.armour));}
  tick(dt){if(this.time<SWORD.pause)return;this.stepHeroes(dt);for(const [pid,u] of this.heroes){if(!u.alive)continue;clampToRect(u,HW-u.r,HW-u.r);if(Math.abs(u.x)>HW-wc3(32)&&Math.abs(u.y)>HW-wc3(32))this.damage(pid,21*dt,'burn');}}
  botThink(pid,u,mem){const v=nearestEnemy(this,pid,u);if(!v)return;const d=dist(u.x,u.y,v.x,v.y);if(d<SWORD.reach+SWORD.radius&&d>SWORD.reach-SWORD.radius){u.faceTo=Math.atan2(v.y-u.y,v.x-u.x);if(u.facingAt(u.faceTo,0.25))this.useAbility(pid,0,u.x,u.y);}if((mem.next||0)>this.time)return;mem.next=this.time+0.4+pid%3*0.13;u.order(v.x-Math.cos(Math.atan2(v.y-u.y,v.x-u.x))*wc3(150),v.y-Math.sin(Math.atan2(v.y-u.y,v.x-u.x))*wc3(150));}
  hud(){return {label:`Paladins left: ${this.alive.length}`};}
  worldEnts(){return [{id:'ux-sword-key',k:'uxswordkey',x:0,y:0}];}
}
SwordWeaver.prototype.deathGroups = function () { return this.elimOrder.map(e => [e.pid]); };
