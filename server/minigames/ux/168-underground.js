import { Minigame } from '../../base.js';
import { Unit, wc3, rand, round2, dist, stepUnits, collideUnits } from '../../../engine/server/sim.js';
import { rim } from './ux2-common.js';

export const BURROW={hp:125,burrowHp:150,speed:wc3(300),r:wc3(10),drain:2,drainPeriod:0.15,morph:1.45,denCount:10,denR:wc3(60),denSpeed:wc3(270),pause:5};
const W=wc3(3328),H=wc3(1280),X0=-W/2,Y0=-H/2,LANE=wc3(250),END=X0+wc3(3100);
export class UndergroundRun extends Minigame {
  static id='underground';static name='Underground Run';static desc='Race through a U shaped blighted course. Life drains as you move; burrow to heal before you die.';
  static controls='Run east along the bottom lane, north at the far end, then west to the finish. Q burrows or unburrows, fully healing each time.';
  static duration=60;static ranking='race';
  setup(){this.map={theme:'blight',floor:{shape:'rect',w:W,h:H},props:rim(W/2,H/2,'rock',3),bounds:W/2+2,build:['uxunderground']};
    this.abilities=[{name:'Burrow',icon:'🕷️',desc:'Morph for 1.45 s and heal fully. Burrowed spiders cannot move.',kind:'instant',castPoint:BURROW.morph,cast:(pid,u)=>this.toggle(u)}];
    this.spawnHeroes(this.pids.map((_,i)=>[X0+wc3(100),Y0+wc3(170)+i*0.06]),{hp:BURROW.hp,speed:BURROW.speed,r:BURROW.r});for(const u of this.heroes.values()){u.skin='uxspider';u.burrowed=false;u.draining=true;u.setFacing(0);}
    this.dens=Array.from({length:BURROW.denCount},()=>new Unit({kind:'uxden',x:rand(X0,END),y:Math.random()<0.5?Y0+wc3(150):Y0+wc3(1110),r:BURROW.denR,speed:BURROW.denSpeed,hp:240}));for(const d of this.dens)d.wander=0;this.drainT=BURROW.drainPeriod;this.boomT=0.7;
  }
  toggle(u){u.burrowed=!u.burrowed;u.hp=u.burrowed?BURROW.burrowHp:BURROW.hp;u.maxHp=u.hp;u.speed=u.burrowed?0:BURROW.speed;u.draining=false;u.stop();this.ev({k:'uxburrow',x:round2(u.x),y:round2(u.y)});}
  command(pid,m){if(this.time<BURROW.pause)return;const u=this.heroes.get(pid);if(u?.burrowed&&(m.c==='move'||m.c==='steer')){this.useAbility(pid,0,u.x,u.y);return;}if(u&&!u.burrowed&&(m.c==='move'||m.c==='steer'))u.draining=true;super.command(pid,m);}
  inside(x,y){return(y<Y0+LANE||y>Y0+H-LANE||x>END-wc3(250))&&x>X0&&x<X0+W&&y>Y0&&y<Y0+H;}
  constrain(u,oldX,oldY){u.x=Math.max(X0+u.r,Math.min(X0+W-u.r,u.x));u.y=Math.max(Y0+u.r,Math.min(Y0+H-u.r,u.y));if(!this.inside(u.x,u.y)){u.x=oldX;u.y=oldY;}}
  tick(dt){if(this.time<BURROW.pause)return;const old=new Map([...this.heroes.values()].map((u)=>[u,[u.x,u.y]]));this.stepHeroes(dt);for(const u of this.heroes.values()){const p=old.get(u);this.constrain(u,p[0],p[1]);if(u.alive&&!u.finished&&u.x<X0+wc3(200)&&u.y>Y0+H-wc3(230))this.finish(u.owner);}
    this.drainT-=dt;while(this.drainT<=0){this.drainT+=BURROW.drainPeriod;for(const [pid,u] of this.heroes)if(u.alive&&!u.finished&&u.draining&&!u.burrowed)this.damage(pid,BURROW.drain);}
    for(const d of this.dens){d.wander-=dt;if(d.wander<=0||!d.target){d.wander=rand(1,3);d.order(rand(X0,END),d.y<0?Y0+wc3(150):Y0+wc3(1120));}const x=d.x,y=d.y;stepUnits([d],dt);this.constrain(d,x,y);}
    collideUnits([...this.heroes.values(),...this.dens]);this.boomT-=dt;if(this.boomT<=0){this.boomT+=0.7;if(Math.random()<0.25)this.ev({k:'boom',x:round2(rand(X0,X0+W)),y:round2(rand(Y0,Y0+H)),s:'fire',r:1});}
  }
  botThink(pid,u,mem){if(u.burrowed){if(!u.cast)this.useAbility(pid,0,u.x,u.y);return;}if(u.hp<35&&!u.cast){this.useAbility(pid,0,u.x,u.y);return;}mem.phase??=0;if(mem.phase===0&&u.x>END-wc3(70))mem.phase=1;if(mem.phase===1&&u.y>Y0+H-wc3(250))mem.phase=2;let x,y;if(mem.phase===0){x=END;y=Y0+wc3(150);}else if(mem.phase===1){x=END;y=Y0+H-wc3(150);}else{x=X0+wc3(100);y=Y0+H-wc3(150);}u.order(x,y);u.draining=true;}
  progress(pid){const u=this.heroes.get(pid);return u.y<0?(u.x-X0):wc3(3100)+(u.y-Y0)+wc3(3100)-(u.x-X0);}
  worldEnts(){return this.dens.map((d)=>({id:d.id,k:'uxden',x:round2(d.x),y:round2(d.y),f:round2(d.facing)}));}
  heroEnts(pid){return super.heroEnts(pid).map((e)=>({...e,bur:this.heroes.get(e.o)?.burrowed?1:undefined}));}
  hud(pid){const u=this.heroes.get(pid);return{label:`${Math.ceil(u?.hp||0)} HP · ${u?.burrowed?'burrowed — Q to emerge':'Q to burrow and heal'}`};}
}
