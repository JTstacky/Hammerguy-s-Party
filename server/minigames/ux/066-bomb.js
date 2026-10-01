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
  // Mines within chain reach go off together, at the shortest fuse among them.
  mineGroups() {
    const left = [...this.mines];
    const groups = [];
    while (left.length) {
      const g = [left.pop()];
      for (let i = 0; i < g.length; i++) {
        for (let j = left.length - 1; j >= 0; j--) if (dist(g[i].x, g[i].y, left[j].x, left[j].y) < wc3(400)) g.push(...left.splice(j, 1));
      }
      groups.push({ mines: g, fuse: Math.min(...g.map((m) => 5 - m.age)) });
    }
    return groups;
  }

  // Bots read the chains: if where they stand will be inside a blast before
  // they could walk clear, they pick the nearest safe spot; otherwise they
  // keep just outside a rival's blast range and mine where the rival stands.
  botThink(pid, u, mem) {
    const groups = this.mineGroups();
    const hx = wc3(640), hy = wc3(670);
    const unsafe = (x, y, slack) => groups.some((g) => g.fuse < 2.6 + slack && g.mines.some((m) => dist(x, y, m.x, m.y) < wc3(300) + 0.6));
    if (unsafe(u.x, u.y, mem.skill) && Math.random() < 0.45 + mem.skill * 0.4) {
      let best = null, bd = Infinity;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        for (const r of [3, 5.5, 8]) {
          const x = Math.max(-hx, Math.min(hx, u.x + Math.cos(a) * r));
          const y = Math.max(-hy, Math.min(hy, u.y + Math.sin(a) * r));
          if (!unsafe(x, y, 1.5) && r < bd) { bd = r; best = [x, y]; }
        }
      }
      if (best) return u.order(best[0], best[1]);
    }
    let target = null, td = Infinity;
    for (const [p, v] of this.heroes) if (p !== pid && v.alive) { const d = dist(u.x, u.y, v.x, v.y); if (d < td) { td = d; target = v; } }
    if (!target) return;
    // Never mine somewhere that would catch ourselves.
    if (td < wc3(325) && td > wc3(300) + 0.4 && this.acd.get(pid)[0] <= 0 && Math.random() < 0.3 + mem.skill * 0.5) {
      // Lead a moving rival: mine where it is going.
      const [lx, ly] = target.target ? [target.target.x, target.target.y] : [target.x, target.y];
      const k = Math.min(1, (target.speed * 1.2) / (dist(target.x, target.y, lx, ly) || 1));
      const x = target.x + (lx - target.x) * k, y = target.y + (ly - target.y) * k;
      if (dist(u.x, u.y, x, y) <= wc3(325) && dist(u.x, u.y, x, y) > wc3(300) + 0.4) return this.useAbility(pid, 0, x, y);
      return this.useAbility(pid, 0, target.x, target.y);
    }
    if ((mem.next || 0) > this.time) return;
    mem.next = this.time + 0.4 + Math.random() * 0.4;
    const a = Math.atan2(u.y - target.y, u.x - target.x) + rand(-0.4, 0.4);
    const x = target.x + Math.cos(a) * wc3(318), y = target.y + Math.sin(a) * wc3(318);
    if (!unsafe(x, y, 1)) u.order(Math.max(-hx, Math.min(hx, x)), Math.max(-hy, Math.min(hy, y)));
  }
  worldEnts(){return [...this.mines.map(m=>({id:m.id,k:'uxmine',x:round2(m.x),y:round2(m.y),a:round2(m.age)})),...this.trees.filter(t=>t.alive).map(t=>({id:100000+t.id,k:'uxtree',x:t.x,y:t.y}))];}
}
