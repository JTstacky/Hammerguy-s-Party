import { Minigame } from '../../base.js';
import { wc3, dist, rand, round2, newId } from '../../../engine/server/sim.js';
import { ring, inside, active } from './ux3-common.js';

export class OneBombTooMany extends Minigame {
  static id='ux-bomb'; static name='One Bomb Too Many';
  static desc='Lay timed mines in the flooded grove. Every explosion can set off nearby mines and hurt its owner.';
  static controls='Q then click within 325 units to lay a mine. It explodes after five seconds.';
  static duration=150; static ranking='survival';
  setup(){this.map={theme:'night',floor:{shape:'rect',w:wc3(1408),h:wc3(1472)},bounds:wc3(705),build:['ux-bomb']};
    this.abilities=[{name:'Mine',icon:'💣',desc:'Five second fuse; lethal within 300 units.',kind:'point',cd:0.5,castPoint:0.53,range:wc3(325),
      pickTarget:(pid,u,x,y)=>dist(u.x,u.y,x,y)<=wc3(325)?{x,y}:null,
      cast:(pid,u,t)=>{this.mines.push({id:newId(),x:t.x,y:t.y,age:0});this.ev({k:'txt',x:round2(t.x),y:round2(t.y),s:'Mine',c:'#ffc451'});}}];
    this.spawnHeroes(ring(this.pids.length,500),{hp:575,speed:wc3(270),r:wc3(32),turnRate:0.6});for(const u of this.heroes.values())u.skin='ux-tinker';
    this.mines=[];this.rain=0;this.trees=[[-8,-8],[-5,6],[-1,-7],[3,8],[8,-4],[-9,2],[7,3],[0,1]].map(([x,y],i)=>({id:i,x,y,alive:true}));
  }
  command(pid,m){if(active(this))super.command(pid,m);}
  blast(m){const queue=[m];m.done=true;for(let i=0;i<queue.length;i++){const b=queue[i];this.ev({k:'boom',s:'fire',x:round2(b.x),y:round2(b.y),r:wc3(300),big:true});
      for(const [pid,u] of this.heroes)if(u.alive&&dist(u.x,u.y,b.x,b.y)<wc3(300))this.damage(pid,2000);
      for(const t of this.trees)if(t.alive&&dist(t.x,t.y,b.x,b.y)<wc3(200))t.alive=false;
      for(const n of this.mines)if(!n.done&&dist(n.x,n.y,b.x,b.y)<wc3(400)){n.done=true;queue.push(n);}
    }}
  tick(dt){if(!active(this))return;this.stepHeroes(dt);for(const u of this.heroes.values())if(u.alive){inside(u,wc3(675),wc3(705));for(const t of this.trees)if(t.alive){const d=dist(u.x,u.y,t.x,t.y),min=u.r+wc3(48);if(d<min){u.x+=(u.x-t.x)/(d||1)*(min-d);u.y+=(u.y-t.y)/(d||1)*(min-d);}}}
    if(this.alive.length===2){this.rain+=dt;if(this.rain>=1.4){this.rain-=1.4;this.mines.push({id:newId(),x:rand(-wc3(610),wc3(610)),y:rand(-wc3(640),wc3(640)),age:0});}}else this.rain=0;
    for(const m of this.mines)if(!m.done){m.age+=dt;if(m.age>=5)this.blast(m);}
    this.mines=this.mines.filter(m=>!m.done);
  }
  botThink(pid,u,mem){let danger=null,bd=Infinity;for(const m of this.mines){let d=dist(u.x,u.y,m.x,m.y);if(d<bd){bd=d;danger=m;}}if(danger&&bd<wc3(370)){u.order(u.x+(u.x-danger.x)/(bd||1)*wc3(420),u.y+(u.y-danger.y)/(bd||1)*wc3(420));return;}
    let target=null,td=Infinity;for(const [p,v] of this.heroes)if(p!==pid&&v.alive){let d=dist(u.x,u.y,v.x,v.y);if(d<td){td=d;target=v;}}
    if(target&&td<wc3(325)&&td>wc3(300)&&this.acd.get(pid)[0]<=0){this.useAbility(pid,0,target.x,target.y);return;}
    if(target){const a=Math.atan2(u.y-target.y,u.x-target.x);if(td<wc3(300))u.order(target.x+Math.cos(a)*wc3(345),target.y+Math.sin(a)*wc3(345));else u.order(target.x+Math.cos(a)*wc3(310),target.y+Math.sin(a)*wc3(310));}
  }
  worldEnts(){return [...this.mines.map(m=>({id:m.id,k:'uxmine',x:round2(m.x),y:round2(m.y),a:round2(m.age)})),...this.trees.filter(t=>t.alive).map(t=>({id:100000+t.id,k:'uxtree',x:t.x,y:t.y}))];}
}
