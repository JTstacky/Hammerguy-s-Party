import { Minigame } from '../../base.js';
import { wc3, dist, rand, round2, newId } from '../../../engine/server/sim.js';
import { ring, inside, active } from './ux3-common.js';

export class EnergyBlitz extends Minigame {
  static id='ux-energy'; static name='Energy Blitz';
  static desc='Push a resting Energy Bolt with your body. Moving bolts bounce and hit for their speed.';
  static controls='Right-click to move. Face a resting bolt and walk into it to launch.';
  static duration=180; static ranking='survival';
  setup(){this.map={theme:'stone',floor:{shape:'rect',w:wc3(1408),h:wc3(1280)},bounds:wc3(650),build:['ux-energy']};
    this.spawnHeroes(ring(this.pids.length,500),{hp:500,regen:1,speed:wc3(350),r:wc3(32),turnRate:0.5});
    for(const u of this.heroes.values())u.skin='ux-dragon';
    this.bolts=[{id:newId(),x:0,y:0,f:0,s:0}];this.contactLock=0;this.second=false;
  }
  command(pid,m){if(active(this))super.command(pid,m);}
  tick(dt){if(!active(this))return;this.stepHeroes(dt);for(const u of this.heroes.values())if(u.alive)inside(u,wc3(650),wc3(580));
    if(this.time>=60&&!this.second){this.second=true;this.bolts.push({id:newId(),x:0,y:0,f:0,s:0});this.ev({k:'purge',x:0,y:0});}
    this.contactLock=Math.max(0,this.contactLock-dt);
    for(const b of this.bolts){
      if(b.s>=50){b.x+=Math.cos(b.f)*wc3(4*b.s)*dt;b.y+=Math.sin(b.f)*wc3(4*b.s)*dt;
        const hx=wc3(558),hy=wc3(478);if(b.x>hx||b.x< -hx){b.x=Math.max(-hx,Math.min(hx,b.x));b.f=Math.PI-b.f;}if(b.y>hy||b.y< -hy){b.y=Math.max(-hy,Math.min(hy,b.y));b.f=-b.f;}
        b.s=Math.max(0,b.s-dt*(b.s>=400?200:b.s>=100?100:30));
      }
      if(this.contactLock>0)continue;
      for(const [pid,u] of this.heroes)if(u.alive&&dist(u.x,u.y,b.x,b.y)<wc3(150)){
        if(b.s>=50){this.damage(pid,b.s,'burn');b.s=Math.max(0,b.s-100);this.contactLock=0.5;this.ev({k:'hit',x:round2(u.x),y:round2(u.y)});break;}
        b.x=u.x+Math.cos(u.heading)*wc3(155);b.y=u.y+Math.sin(u.heading)*wc3(155);b.f=u.heading;b.s=500;this.ev({k:'purge',x:round2(b.x),y:round2(b.y)});break;
      }
    }
  }
  botThink(pid,u,mem){const resting=this.bolts.find(b=>b.s<50);if(resting){let target=null,bd=Infinity;for(const [p,v] of this.heroes)if(p!==pid&&v.alive){let d=dist(v.x,v.y,resting.x,resting.y);if(d<bd){bd=d;target=v;}}if(target){u.order(resting.x-(target.x-resting.x)*0.08,resting.y-(target.y-resting.y)*0.08);return;}}
    let danger=null,bd=Infinity;for(const b of this.bolts)if(b.s>=50){let d=dist(u.x,u.y,b.x,b.y);if(d<bd){bd=d;danger=b;}}if(danger&&bd<wc3(320))u.order(u.x-Math.sin(danger.f)*(mem.skill>0.65?4:-4),u.y+Math.cos(danger.f)*4);else u.order(rand(-8,8),rand(-7,7));
  }
  worldEnts(){return this.bolts.map(b=>({id:b.id,k:'uxbolt',x:round2(b.x),y:round2(b.y),s:Math.round(b.s)}));}
}
