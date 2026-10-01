import { Minigame } from '../../base.js';
import { newId, rand, dist, wc3, round2, clampToRect } from '../../../engine/server/sim.js';
import { ring, nearestEnemy, randomPoint } from './ux1-common.js';

export const GRIM={hp:10,speed:wc3(320),r:wc3(32),dmg:16,cd:1.7,range:wc3(100),kidXP:25,wraithXP:40,goal:300,revive:10,cloakCD:5,cloakDuration:60,fade:0.9,backstab:40,pause:6};
const HW=wc3(656),HH=wc3(640);
export class GrimReapage extends Minigame {
  static id='grimreapage';static name='The Grim Reapage';
  static desc='Wraiths hunt children and each other. One hit kills; slain wraiths revive. Reach 300 XP first.';
  static controls='Right-click a child or wraith to attack. Q: cloak for 60 s (5 s cooldown).';
  static duration=150;static ranking='race';
  setup(){
    this.map={theme:'ux-grim-night',floor:{shape:'rect',w:HW*2,h:HH*2},bounds:HW+3,build:['ux-grim'],props:[]};
    this.attack={range:GRIM.range,cd:GRIM.cd,point:0.3,dmg:GRIM.dmg,missile:0};
    this.abilities=[{name:'Night Merge',icon:'🌙',desc:'Cloak for 60 seconds. Your next attack reveals you. Recast after 5 seconds.',kind:'instant',cd:GRIM.cloakCD,cast:(pid,u)=>this.cloak(u)}];
    this.spawnHeroes(ring(this.pids.length,400,45,45),{hp:GRIM.hp,speed:GRIM.speed,r:GRIM.r,regen:0.5});
    for(const u of this.heroes.values()){u.skin='ux-wraith';u.cloak=GRIM.cloakDuration;u.fade=GRIM.fade;u.respawn=0;}
    this.xp=new Map(this.pids.map(p=>[p,0]));this.kids=Array.from({length:this.pids.length},()=>this.newKid());
  }
  newKid(){const [x,y]=randomPoint(HW-1,HH-1);return{id:newId(),kind:'kid',x,y,tx:x,ty:y,r:wc3(16),hp:10,alive:true};}
  cloak(u){u.cloak=GRIM.cloakDuration;u.fade=GRIM.fade;u.speed=wc3(352);}
  command(pid,m){if(this.time<GRIM.pause)return;super.command(pid,m);}
  attackables(pid){return [...this.kids.filter(k=>k.alive),...[...this.heroes.entries()].filter(([p,u])=>p!==pid&&u.alive&&!u.finished&&u.respawn<=0).map(([,u])=>u)];}
  attackHit(pid,u,tgt){if(!tgt.alive)return;const hit=GRIM.dmg+(u.cloak>0&&u.fade<=0?GRIM.backstab:0);u.cloak=0;u.fade=0;u.speed=GRIM.speed;tgt.hp-=hit;this.ev({k:'hit',x:round2(tgt.x),y:round2(tgt.y)});if(tgt.hp>0)return;if(tgt.kind==='kid'){tgt.alive=false;this.gain(pid,GRIM.kidXP);const i=this.kids.indexOf(tgt);this.kids[i]=this.newKid();this.ev({k:'death',x:round2(tgt.x),y:round2(tgt.y)});}else{tgt.hp=0;tgt.alive=false;tgt.respawn=GRIM.revive;tgt.target=null;tgt.attackOrder=null;this.gain(pid,GRIM.wraithXP);this.ev({k:'death',x:round2(tgt.x),y:round2(tgt.y),u:tgt.id});}}
  gain(pid,n){if(this.finishOrder.includes(pid))return;const xp=(this.xp.get(pid)||0)+n;this.xp.set(pid,xp);if(xp>=GRIM.goal)this.finish(pid);}
  finish(pid){if(this.finishOrder.includes(pid))return;super.finish(pid);const u=this.heroes.get(pid);u.stop();u.x=HW+10;u.y=HH+10;}
  tick(dt){if(this.time<GRIM.pause)return;for(const u of this.heroes.values()){if(u.finished)continue;if(!u.alive){u.respawn-=dt;if(u.respawn<=0){[u.x,u.y]=randomPoint(HW-1,HH-1);u.alive=true;u.hp=GRIM.hp;this.cloak(u);}continue;}if(u.cloak>0){u.cloak-=dt;u.fade=Math.max(0,u.fade-dt);if(u.cloak<=0)u.speed=GRIM.speed;}}this.stepHeroes(dt);for(const u of this.heroes.values())if(u.alive&&!u.finished)clampToRect(u,HW-u.r,HH-u.r);for(const k of this.kids){if(!k.alive)continue;const dx=k.tx-k.x,dy=k.ty-k.y,d=Math.hypot(dx,dy);if(d<0.15){[k.tx,k.ty]=randomPoint(HW-1,HH-1);continue;}k.x+=dx/d*wc3(190)*dt;k.y+=dy/d*wc3(190)*dt;}}
  botThink(pid,u,mem){if(!u.alive)return;if(u.cloak<=0&&this.acd.get(pid)?.[0]<=0)this.useAbility(pid,0,u.x,u.y);if((mem.next||0)>this.time)return;mem.next=this.time+0.45+pid%3*0.12;let tgt=null,bd=Infinity;for(const k of this.kids){const d=dist(u.x,u.y,k.x,k.y);if(d<bd){bd=d;tgt=k;}}const v=nearestEnemy(this,pid,u);if(v&&v.alive&&dist(u.x,u.y,v.x,v.y)<bd*0.7)tgt=v;if(tgt)u.attackOrder=tgt;}
  heroEnts(pid){return super.heroEnts(pid).filter(e=>!this.heroes.get(e.o)?.finished&&(e.o===pid||!this.heroes.get(e.o)?.cloak||this.heroes.get(e.o)?.fade>0||dist(this.heroes.get(pid).x,this.heroes.get(pid).y,e.x,e.y)<wc3(160))).map(e=>({...e,cl:this.heroes.get(e.o)?.cloak>0&&this.heroes.get(e.o)?.fade<=0?1:0}));}
  worldEnts(){return [{id:'ux-grim-key',k:'uxgrimkey',x:0,y:0},...this.kids.map(k=>({id:k.id,k:'uxkid',x:round2(k.x),y:round2(k.y),f:round2(Math.atan2(k.ty-k.y,k.tx-k.x))}))];}
  hud(pid){return {label:`XP: ${this.xp.get(pid)||0} / ${GRIM.goal} · 25 child / 40 wraith`};}
}
