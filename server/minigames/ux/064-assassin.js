import { Minigame } from '../../base.js';
import { wc3, dist, rand, wrapAngle, round2 } from '../../../engine/server/sim.js';
import { ring, inside, active } from './ux3-common.js';

export class AssassinsCove extends Minigame {
  static id='ux-assassin'; static name="The Assassin's Cove";
  static desc='Blink behind another assassin and strike. The edges and corners are dangerous.';
  static controls='Q then click an assassin to Assassinate. W then click to Blink.';
  static duration=150; static ranking='survival';
  setup() {
    const hx=wc3(704),hy=wc3(688);
    this.map={theme:'night',floor:{shape:'rect',w:hx*2,h:hy*2},bounds:hx,build:['ux-assassin']};
    this.abilities=[
      {name:'Assassinate',icon:'🗡️',desc:'Kill from the rear 90° cone, within 100 units.',kind:'unit',cd:3,range:wc3(100),castPoint:0.25,
        pickTarget:(pid,u,x,y)=>{let best=null,bd=wc3(100);for(const [,v] of this.heroes) if(v.alive){let d=dist(u.x,u.y,v.x,v.y);if(d<bd&&dist(x,y,v.x,v.y)<1.5){best=v;bd=d;}}return best?{x:best.x,y:best.y,u:best}:null;},
        cast:(pid,u,t)=>{const v=t.u;if(!v.alive||dist(u.x,u.y,v.x,v.y)>wc3(100))return;if(v===u){this.eliminate(pid);return;}const angle=Math.atan2(v.y-u.y,v.x-u.x);if(Math.abs(wrapAngle(angle-v.heading))<=Math.PI/4){this.ev({k:'txt',x:round2(v.x),y:round2(v.y),s:'Success!',c:'#ff4444'});this.eliminate(v.owner);}else this.ev({k:'txt',x:round2(v.x),y:round2(v.y),s:'Miss',c:'#dddddd'});}},
      {name:'Blink',icon:'✨',desc:'Teleport up to 500 units.',kind:'point',cd:5,range:wc3(500),cast:(pid,u,t)=>{const d=dist(u.x,u.y,t.x,t.y)||1,f=Math.min(1,wc3(500)/d);u.x+=(t.x-u.x)*f;u.y+=(t.y-u.y)*f;inside(u,hx,hy);u.stop();this.ev({k:'purge',x:round2(u.x),y:round2(u.y)});}}
    ];
    this.spawnHeroes(ring(this.pids.length,500),{hp:100,speed:wc3(320),r:wc3(32),turnRate:0.4});
    for(const u of this.heroes.values()){u.skin='ux-assassin';u.setFacing(rand(-Math.PI,Math.PI));u.edgeCd=0;}
  }
  command(pid,m){if(active(this))super.command(pid,m);}
  tick(dt){if(!active(this))return;this.stepHeroes(dt);
    const hx=wc3(704),hy=wc3(688);
    for(const [pid,u] of this.heroes) if(u.alive){inside(u,hx,hy);u.edgeCd-=dt;
      const ex=hx-Math.abs(u.x),ey=hy-Math.abs(u.y);
      if(u.edgeCd<=0 && (ex<wc3(70)||ey<wc3(70))){this.damage(pid,ex<wc3(95)&&ey<wc3(95)?21:4.5);u.edgeCd=1;}
    }
  }
  botThink(pid,u,mem){let target=null,bd=Infinity;for(const [p,v] of this.heroes)if(p!==pid&&v.alive){let d=dist(u.x,u.y,v.x,v.y);if(d<bd){bd=d;target=v;}}if(!target)return;
    const bx=target.x-Math.cos(target.heading)*wc3(75),by=target.y-Math.sin(target.heading)*wc3(75);
    if(bd<wc3(100)&&this.acd.get(pid)[0]<=0)this.useAbility(pid,0,target.x,target.y);
    else if(bd>wc3(140)&&bd<wc3(520)&&this.acd.get(pid)[1]<=0&&mem.skill>0.62)this.useAbility(pid,1,bx,by);
    else u.order(bx+rand(-0.3,0.3),by+rand(-0.3,0.3));
  }
}
