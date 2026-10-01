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
  // Bots watch their backs: anyone creeping up behind gets faced, or blinked
  // away from. They only strike from inside the rear cone (a miss wastes the
  // 3 s cooldown) and creep round to a rival's back otherwise.
  botThink(pid, u, mem) {
    const hx = wc3(704), hy = wc3(688);
    const lim = (x, h) => Math.max(-h * 0.75, Math.min(h * 0.75, x));
    const foes = [...this.heroes.values()].filter((v) => v.owner !== pid && v.alive);
    if (!foes.length) return;
    const by = (v) => dist(u.x, u.y, v.x, v.y);
    foes.sort((p, q) => by(p) - by(q));
    const near = foes[0];
    const d = by(near);
    const cd = this.acd.get(pid);
    // Is that rival behind me (outside the half I am looking at)?
    const toward = Math.atan2(near.y - u.y, near.x - u.x);
    const behindMe = Math.abs(wrapAngle(toward - u.heading)) > Math.PI / 2;
    if (d < wc3(260) && behindMe && Math.random() < 0.25 + mem.skill * 0.5) {
      if (cd[1] <= 0 && Math.random() < 0.4) {
        const a = toward + Math.PI + rand(-0.8, 0.8);
        return this.useAbility(pid, 1, lim(u.x + Math.cos(a) * 8, hx), lim(u.y + Math.sin(a) * 8, hy));
      }
      u.stop();
      u.faceTo = toward;
      return;
    }
    // Strike only from the rear cone.
    const fromBack = Math.abs(wrapAngle(Math.atan2(near.y - u.y, near.x - u.x) - near.heading)) <= Math.PI / 4 * 0.85;
    if (d < wc3(100) && cd[0] <= 0 && fromBack) return this.useAbility(pid, 0, near.x, near.y);
    if ((mem.next || 0) > this.time) return;
    mem.next = this.time + 0.3 + Math.random() * 0.4;
    // Come in from behind: through a point well off the rival's back first.
    const back = near.heading + Math.PI;
    const far = d > wc3(220);
    const bx = near.x + Math.cos(back) * wc3(far ? 200 : 70);
    const byy = near.y + Math.sin(back) * wc3(far ? 200 : 70);
    if (far && d < wc3(520) && cd[1] <= 0 && mem.skill > 0.6 && Math.random() < 0.3) return this.useAbility(pid, 1, lim(bx, hx), lim(byy, hy));
    u.order(lim(bx + rand(-0.3, 0.3), hx), lim(byy + rand(-0.3, 0.3), hy));
  }
}
