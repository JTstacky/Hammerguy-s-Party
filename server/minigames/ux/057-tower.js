import { Minigame } from '../../base.js';
import { wc3, round2, newId, rand, dist } from '../../../engine/server/sim.js';
import { ring, rim, noTies, nearest } from './ux2-common.js';

export const TOWERS = {
  arrow: { build:6, life:26, hp:20, range:wc3(225), dmg:4, cd:1, icon:'🏹' },
  siege: { build:14, life:34, hp:20, range:wc3(550), dmg:6, cd:1.5, icon:'💣' },
  magic: { build:11, life:31, hp:10, range:wc3(800), dmg:2, cd:1.75, icon:'✨' },
};
export const BUILDER={hp:25,speed:wc3(190),r:wc3(16),shield:10,shieldCd:20,pause:3};
const HW=wc3(656),CUT=wc3(1000);
export class TowerAttack extends Minigame {
  static id='tower';static name='Tower Attack';static desc='Build short lived Arrow, Siege and Magic towers to kill opposing builders. Raise an anti magic shield to survive spells.';
  static controls='Q/W/E then click ground to build Arrow/Siege/Magic. R shields you for 10 s. Right-click your tower to stop and remove it.';
  static duration=210;static ranking='survival';
  setup(){this.map={theme:'grass',floor:{shape:'rect',w:HW*2,h:HW*2},props:rim(HW,HW,'tree'),bounds:HW+3};
    this.towers=[];this.shield=new Map();
    this.abilities=Object.entries(TOWERS).map(([type,s])=>({name:`Build ${type}`,icon:s.icon,desc:`Builds in ${s.build}s; lasts ${s.life}s.`,kind:'point',range:wc3(150),available:(pid)=>this.heroes.get(pid)?.stun<=0,cast:(pid,u,t)=>this.build(pid,u,type,t.x,t.y)}));
    this.abilities.push({name:'Anti-Magic Shield',icon:'🛡️',desc:'Immune to Magic Tower shots for 10 s.',kind:'instant',cd:BUILDER.shieldCd,cast:(pid)=>this.shield.set(pid,BUILDER.shield)});
    this.spawnHeroes(ring(this.pids.length,800).map(([x,y])=>{const f=Math.min(1,(CUT-0.5)/(Math.abs(x)+Math.abs(y)),(HW-0.5)/Math.abs(x||1),(HW-0.5)/Math.abs(y||1));return[x*f,y*f];}),{hp:BUILDER.hp,speed:BUILDER.speed,r:BUILDER.r});for(const u of this.heroes.values())u.skin='uxbuilder';
  }
  command(pid,m){if(this.time<BUILDER.pause)return;if(m.c==='move'||m.c==='attack'){const x=+m.x||0,y=+m.y||0;const own=this.towers.find((t)=>t.alive&&t.owner===pid&&dist(x,y,t.x,t.y)<wc3(45));if(own){own.alive=false;this.ev({k:'uxbuild',x:round2(own.x),y:round2(own.y)});return;}}super.command(pid,m);}
  build(pid,u,type,x,y){const s=TOWERS[type];if(u.stun>0||dist(u.x,u.y,x,y)>wc3(180))return;if(Math.abs(x)>HW-1||Math.abs(y)>HW-1||Math.abs(x)+Math.abs(y)>CUT)return;if(this.towers.some((t)=>t.alive&&dist(x,y,t.x,t.y)<wc3(90)))return;u.stop();u.stun=s.build;this.towers.push({id:newId(),owner:pid,type,x,y,alive:true,hp:s.hp,building:s.build,life:s.life,cd:0});this.ev({k:'uxbuild',x:round2(x),y:round2(y)});}
  eliminate(pid,how){super.eliminate(pid,how);for(const t of this.towers)if(t.owner===pid)t.alive=false;}
  hurt(t,n){t.hp-=n;if(t.hp<=0){t.alive=false;this.ev({k:'death',x:round2(t.x),y:round2(t.y)});}}
  fire(t,target){const s=TOWERS[t.type];t.cd=s.cd;this.ev({k:'uxtowershot',x:round2(t.x),y:round2(t.y),tx:round2(target.x),ty:round2(target.y),type:t.type});
    const hit=(v,n)=>{if(v.kind==='paladin'){if(t.type==='magic'&&(this.shield.get(v.owner)||0)>0)return;this.damage(v.owner,n);}else this.hurt(v,n);};
    const damageTo=(v)=>{if(t.type==='arrow')return v.kind==='paladin'?3:6;if(t.type==='magic')return v.kind==='paladin'?1.5:v.type==='arrow'?0:2;return v.kind==='paladin'?3:v.type==='arrow'?8:6;};
    if(t.type==='siege'){for(const v of this.towers)if(v.alive&&v!==t){const d=dist(v.x,v.y,target.x,target.y);if(d<wc3(125))hit(v,damageTo(v)*(d<wc3(50)?1:d<wc3(100)?0.5:0.1));}for(const v of this.heroes.values())if(v.alive&&dist(v.x,v.y,target.x,target.y)<wc3(125))hit(v,damageTo(v));}else hit(target,damageTo(target));
  }
  tick(dt){if(this.time<BUILDER.pause)return;this.stepHeroes(dt);for(const u of this.heroes.values()){u.x=Math.max(-HW,Math.min(HW,u.x));u.y=Math.max(-HW,Math.min(HW,u.y));const over=Math.abs(u.x)+Math.abs(u.y)-CUT;if(over>0){u.x-=Math.sign(u.x)*over/2;u.y-=Math.sign(u.y)*over/2;}}
    for(const [pid,t] of this.shield)this.shield.set(pid,Math.max(0,t-dt));
    for(const t of this.towers){if(!t.alive)continue;if(t.building>0){t.building-=dt;continue;}t.life-=dt;if(t.life<=0){t.alive=false;continue;}t.cd-=dt;if(t.cd>0)continue;const targets=[...this.heroes.values(),...this.towers].filter((v)=>v.alive&&v.owner!==t.owner&&(!v.building||v.building<=0)&&!(t.type==='magic'&&v.type==='arrow'));const v=nearest(t,targets,TOWERS[t.type].range);if(v)this.fire(t,v);}
    this.towers=this.towers.filter((t)=>t.alive);
  }
  botThink(pid,u,mem){if(this.time<BUILDER.pause)return;const danger=nearest(u,this.towers.filter((t)=>t.owner!==pid&&t.building<=0),wc3(500));if(danger&&u.hp<15){if(this.acd.get(pid)[3]<=0)this.useAbility(pid,3,u.x,u.y);u.order(-danger.x,-danger.y);}mem.next??=0;if(this.time<mem.next)return;mem.next=this.time+rand(2.5,5.5);const type=['arrow','siege','magic'][(pid+Math.floor(this.time/20))%3];const a=rand(0,Math.PI*2),r=wc3(rand(70,140));this.build(pid,u,type,Math.max(-HW+1,Math.min(HW-1,u.x+Math.cos(a)*r)),Math.max(-HW+1,Math.min(HW-1,u.y+Math.sin(a)*r)));}
  worldEnts(){return this.towers.map((t)=>({id:t.id,k:'uxtower',x:round2(t.x),y:round2(t.y),o:t.owner,type:t.type,b:round2(Math.max(0,t.building)/TOWERS[t.type].build)}));}
  hud(pid){return{label:`${this.towers.filter((t)=>t.owner===pid).length} towers · ${this.shield.get(pid)>0?'shielded':'shield ready in '+Math.max(0,this.acd.get(pid)[3]).toFixed(1)+'s'}`};}
}
noTies(TowerAttack);
