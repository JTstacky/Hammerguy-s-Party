import { Minigame } from '../../base.js';
import { wc3, dist, rand, round2, newId, wrapAngle } from '../../../engine/server/sim.js';
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
  // Bots read each moving bolt's line a second ahead and step off it; with
  // nothing coming they walk round a resting bolt to line it up on a rival
  // and push it, and otherwise keep away from the walls and the bolts.
  botThink(pid, u, mem) {
    const hx = wc3(600), hy = wc3(530);
    const lim = (x, h) => Math.max(-h * 0.8, Math.min(h * 0.8, x));
    for (const b of this.bolts) {
      if (b.s < 50) continue;
      const v = wc3(4 * b.s);
      const cx = Math.cos(b.f), cy = Math.sin(b.f);
      const along = (u.x - b.x) * cx + (u.y - b.y) * cy;
      const side = -(u.x - b.x) * cy + (u.y - b.y) * cx;
      const look = v * (0.4 + mem.skill * 0.8);
      if (along > -1 && along < look && Math.abs(side) < wc3(190) && Math.random() < 0.5 + mem.skill * 0.45) {
        const s = Math.sign(side) || 1;
        return u.order(lim(u.x - cy * s * 4, hx), lim(u.y + cx * s * 4, hy));
      }
    }
    if ((mem.next || 0) > this.time) return;
    mem.next = this.time + 0.3 + Math.random() * 0.3;
    const resting = this.bolts.find((b) => b.s < 50);
    if (resting) {
      let target = null, bd = Infinity;
      for (const [p, v] of this.heroes) if (p !== pid && v.alive) { const d = dist(v.x, v.y, resting.x, resting.y); if (d < bd) { bd = d; target = v; } }
      const mine = dist(u.x, u.y, resting.x, resting.y);
      if (target && mine < bd + 3) {
        // Line up behind the bolt first, then walk through it toward the rival.
        const a = Math.atan2(target.y - resting.y, target.x - resting.x) + rand(-0.15, 0.15) * (1 - mem.skill);
        const sx = resting.x - Math.cos(a) * wc3(260), sy = resting.y - Math.sin(a) * wc3(260);
        if (dist(u.x, u.y, sx, sy) > 1 && mine >= wc3(300)) return u.order(lim(sx, hx), lim(sy, hy));
        if (Math.abs(wrapAngle(Math.atan2(resting.y - u.y, resting.x - u.x) - a)) < 0.5) return u.order(resting.x + Math.cos(a) * 2, resting.y + Math.sin(a) * 2);
        return u.order(lim(sx, hx), lim(sy, hy));
      }
    }
    if (!u.target || Math.random() < 0.1) u.order(rand(-hx, hx) * 0.6, rand(-hy, hy) * 0.6);
  }
  worldEnts(){return this.bolts.map(b=>({id:b.id,k:'uxbolt',x:round2(b.x),y:round2(b.y),s:Math.round(b.s)}));}
}
