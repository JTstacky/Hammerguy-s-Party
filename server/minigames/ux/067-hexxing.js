import { Minigame } from '../../base.js';
import { wc3, dist, rand, round2 } from '../../../engine/server/sim.js';
import { ring, inside, active } from './ux3-common.js';

export const CRITTERS=[
  {skin:'ux-chicken',hp:50,speed:200,regen:0.5}, {skin:'ux-crab',hp:75,speed:90,regen:0.5},
  {skin:'ux-frog',hp:50,speed:120,regen:0.5}, {skin:'ux-racoon',hp:35,speed:150,regen:0.1},
  {skin:'ux-rabbit',hp:50,speed:100,regen:0.5}
];
export class HexxingHavoc extends Minigame {
  static id='ux-hexxing';static name='Hexxing Havoc';
  static desc='One rotating Furbolg hunts the critters. Every morph carries your current health percentage.';
  static controls='Right-click prey to attack as the hunter. Frog: Q to Jump. Rabbit: Q then click to Bite.';
  static duration=150;static ranking='survival';
  setup(){this.map={theme:'grass',floor:{shape:'rect',w:wc3(1088),h:wc3(1152)},bounds:wc3(545),build:['ux-hexxing']};
    this.abilities=[{name:'Critter Perk',icon:'🐸',desc:'Frog Jump or Rabbit Bite.',kind:'point',cd:3,range:wc3(400),available:pid=>['ux-frog','ux-rabbit'].includes(this.heroes.get(pid)?.skin),
      cast:(pid,u,t)=>{if(u.skin==='ux-frog'){const d=dist(u.x,u.y,t.x,t.y)||1,f=Math.min(1,wc3(400)/d);u.x+=(t.x-u.x)*f;u.y+=(t.y-u.y)*f;inside(u,wc3(515),wc3(545));this.ev({k:'purge',x:round2(u.x),y:round2(u.y)});}else if(u.skin==='ux-rabbit'){
        this.acd.get(pid)[0]=20;
        for(const [p,v] of this.heroes)if(p!==pid&&v.alive&&dist(v.x,v.y,t.x,t.y)<1&&dist(u.x,u.y,v.x,v.y)<wc3(70)){v.stun=3;this.damage(p,1);break;}
      }}}];
    this.attack={range:wc3(100),cd:1.35,point:0.3,dmg:18.75,missile:0};
    this.spawnHeroes(ring(this.pids.length,400,-Math.PI/8),{hp:550,speed:wc3(300),r:wc3(20)});for(const u of this.heroes.values()){u.skin='ux-furbolg';u.maxHp=550;}
    this.period=rand(5,8);this.nextMorph=5;this.hunter=null;
  }
  morph(){const candidates=this.alive.filter(p=>p!==this.hunter);if(!candidates.length)return;const next=candidates[Math.floor(Math.random()*candidates.length)];
    for(const [pid,u] of this.heroes)if(u.alive){const pct=Math.max(0.01,u.hp/u.maxHp);const kit=CRITTERS[Math.floor(Math.random()*CRITTERS.length)];u.skin=kit.skin;u.maxHp=kit.hp;u.hp=kit.hp*pct;u.speed=wc3(kit.speed);u.regen=kit.regen;u.r=0;u.attackOrder=null;}
    const h=this.heroes.get(next),pct=h.hp/h.maxHp;h.skin='ux-furbolg';h.maxHp=100;h.hp=100*pct;h.speed=wc3(150);h.regen=0;h.r=wc3(20);this.hunter=next;this.ev({k:'txt',x:round2(h.x),y:round2(h.y),s:'HUNTER!',c:'#ff9020'});
    this.nextMorph+=this.period;
  }
  command(pid,m){if(!active(this))return;const u=this.heroes.get(pid);if(m.c==='move'&&u?.skin==='ux-frog'&&this.acd.get(pid)?.[0]<=0){this.useAbility(pid,0,+m.x||0,+m.y||0);return;}super.command(pid,m);}
  attackables(pid){return pid===this.hunter?super.attackables(pid):[];}
  attackHit(pid,u,t){if(pid!==this.hunter)return;if(t.skin==='ux-racoon'&&Math.random()<0.25)return;this.damage(t.owner,t.skin==='ux-crab'?12.5:18.75);}
  tick(dt){if(!active(this))return;if(this.time>=this.nextMorph)this.morph();this.stepHeroes(dt);for(const u of this.heroes.values())if(u.alive)inside(u,wc3(515),wc3(545));}
  botThink(pid,u,mem){if(pid===this.hunter){let t=null,bd=Infinity;for(const [p,v] of this.heroes)if(p!==pid&&v.alive){let d=dist(u.x,u.y,v.x,v.y);if(d<bd){bd=d;t=v;}}if(t)u.attackOrder=t;}
    else {const h=this.heroes.get(this.hunter);if(h?.alive){let d=dist(u.x,u.y,h.x,h.y);if(d<wc3(450)){const x=u.x+(u.x-h.x)/(d||1)*5,y=u.y+(u.y-h.y)/(d||1)*5;if(u.skin==='ux-frog'&&d<wc3(230)&&this.acd.get(pid)[0]<=0)this.useAbility(pid,0,x,y);else u.order(x,y);return;}}u.order(rand(-6,6),rand(-6,6));}
  }
  hud(pid){return{label:`Hunter: ${this.hunter==null?'soon':this.party.room.nameOf(this.hunter)} · Morph in ${Math.max(0,Math.ceil(this.nextMorph-this.time))}s`};}
}
