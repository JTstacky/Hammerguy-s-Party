import { Minigame } from '../../base.js';
import { wc3, rand, round2, newId, dist } from '../../../engine/server/sim.js';
import { ring, inside, active } from './ux3-common.js';

export class WintersEquinox extends Minigame {
  static id = 'ux-winter'; static name = "Winter's Equinox";
  static desc = 'Dodge the spirits’ signalled Flame Strikes. Blink clear of the fire; your size shows your remaining life.';
  static controls = 'Right-click to move. Q then click to Blink up to 400 Warcraft units.';
  static duration = 600; static timer = false; static ranking = 'survival';
  setup() {
    this.map = { theme: 'night', floor: { shape: 'rect', w: wc3(1280), h: wc3(1280) }, bounds: wc3(610), build: ['ux-winter'] };
    this.abilities = [{ name: 'Blink', icon: '✨', desc: 'Teleport up to 400 units.', kind: 'point', cd: 3, range: wc3(400), cast: (pid, u, t) => {
      const d = dist(u.x,u.y,t.x,t.y) || 1, f = Math.min(1,wc3(400)/d);
      u.x += (t.x-u.x)*f; u.y += (t.y-u.y)*f; inside(u,wc3(610),wc3(610)); u.stop();
      this.ev({k:'purge',x:round2(u.x),y:round2(u.y)});
    }}];
    this.spawnHeroes(ring(this.pids.length,200), {hp:50,speed:wc3(270),r:wc3(31)});
    for (const u of this.heroes.values()) u.skin='ux-icicle';
    this.spirits=[]; this.strikes=[]; this.spawnAt=5; this.castClock=0;
  }
  command(pid,m){if(active(this))super.command(pid,m);}
  tick(dt) {
    if (!active(this)) return;
    this.stepHeroes(dt);
    for(const u of this.heroes.values()) if(u.alive) inside(u,wc3(610),wc3(610));
    if(this.time>=this.spawnAt && this.spirits.length<8) {
      this.spirits.push({id:newId(),x:rand(-9,9),y:rand(-9,9)}); this.spawnAt+=15;
      if (this.spirits.length === 1) this.strikes.push({id:newId(),x:rand(-wc3(555),wc3(555)),y:rand(-wc3(555),wc3(555)),age:0});
    }
    this.castClock+=dt;
    while(this.castClock>=1.6) { this.castClock-=1.6;
      for(const s of this.spirits) this.strikes.push({id:newId(),x:rand(-wc3(555),wc3(555)),y:rand(-wc3(555),wc3(555)),age:0});
    }
    for(const f of this.strikes) {
      f.age+=dt;
      if(f.age>=1 && f.age<10) for(const [pid,u] of this.heroes) if(u.alive && dist(u.x,u.y,f.x,f.y)<wc3(170))
        this.damage(pid,dt*(f.age<3.67?15:2),'burn');
    }
    this.strikes=this.strikes.filter(f=>f.age<10);
  }
  isDone(){return this.pids.length>1?this.alive.length<=1:this.alive.length===0;}
  botThink(pid,u,mem) {
    let threat=null, best=Infinity;
    for(const f of this.strikes) if(f.age<4 && f.age>0.3) { const d=dist(u.x,u.y,f.x,f.y); if(d<best){best=d;threat=f;} }
    if(threat && best<wc3(220)) {
      const a=Math.atan2(u.y-threat.y,u.x-threat.x)+rand(-0.4,0.4);
      const x=u.x+Math.cos(a)*wc3(300), y=u.y+Math.sin(a)*wc3(300);
      if(best<wc3(145) && this.acd.get(pid)[0]<=0 && mem.skill>0.55) this.useAbility(pid,0,x,y);
      else u.order(x,y);
    } else if(!u.target) u.order(rand(-7,7),rand(-7,7));
  }
  worldEnts() { return [
    ...this.spirits.map(s=>({id:s.id,k:'uxspirit',x:round2(s.x),y:round2(s.y)})),
    ...this.strikes.map(s=>({id:s.id,k:'uxflame',x:round2(s.x),y:round2(s.y),a:round2(s.age)}))
  ]; }
}
