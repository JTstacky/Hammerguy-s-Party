import { Minigame } from '../../base.js';
import { newId, rand, dist, wc3, round2, clampToRect } from '../../../engine/server/sim.js';
import { ring, randomPoint } from './ux1-common.js';

export const TORNADO={speed:wc3(220),kill:wc3(100),spawnEvery:5,cap:50,pause:4,hw:wc3(1552),hh:wc3(784)};
const MURGUL_N=15;
export class TornadoNaga extends Minigame {
  static id='tornadonaga';static name='Tornado Naga Madness';
  static desc='Escape the multiplying tornadoes in the shallow basin. Only a tornado’s centre kills.';
  static controls='Right-click or use the touch joystick to move. Stay clear of the tornado centres.';
  static duration=300;static timer=false;static ranking='survival';
  setup(){
    this.map={theme:'ux-basin',floor:{shape:'rect',w:TORNADO.hw*2,h:TORNADO.hh*2},bounds:TORNADO.hw+3,build:['ux-tornado'],props:[]};
    this.spawnHeroes(ring(this.pids.length,800,45,45).map(([x,y])=>[x,Math.max(-TORNADO.hh+0.3,Math.min(TORNADO.hh-0.3,y))]),{speed:wc3(370),r:wc3(12),hp:1});
    for(const u of this.heroes.values())u.skin=Math.random()<0.5?'ux-siren':'ux-myrmidon';
    this.tornados=[this.makeTornado(0,0)];this.murguls=Array.from({length:MURGUL_N},()=>{const [x,y]=randomPoint(TORNADO.hw,TORNADO.hh);return{id:newId(),x,y,tx:rand(-TORNADO.hw,TORNADO.hw),ty:rand(-TORNADO.hh,TORNADO.hh),alive:true};});this.spawnT=TORNADO.spawnEvery;
  }
  makeTornado(x,y,tx,ty){const a=tx==null?rand(0,Math.PI*2):Math.atan2(ty-y,tx-x);return{id:newId(),x,y,vx:Math.cos(a)*TORNADO.speed,vy:Math.sin(a)*TORNADO.speed};}
  command(pid,m){if(this.time<TORNADO.pause)return;super.command(pid,m);}
  tick(dt){if(this.time<TORNADO.pause)return;this.stepHeroes(dt);for(const u of this.heroes.values())if(u.alive)clampToRect(u,TORNADO.hw-u.r,TORNADO.hh-u.r);
    for(const t of this.tornados){t.x+=t.vx*dt;t.y+=t.vy*dt;if(Math.abs(t.x)>TORNADO.hw||Math.abs(t.y)>TORNADO.hh){const [x,y]=randomPoint(TORNADO.hw,TORNADO.hh);const a=Math.atan2(y-t.y,x-t.x);t.vx=Math.cos(a)*TORNADO.speed;t.vy=Math.sin(a)*TORNADO.speed;}for(const [pid,u] of this.heroes)if(u.alive&&dist(t.x,t.y,u.x,u.y)<=TORNADO.kill)this.eliminate(pid,'squish');for(const m of this.murguls)if(m.alive&&dist(t.x,t.y,m.x,m.y)<=TORNADO.kill)m.alive=false;}
    for(const m of this.murguls){if(!m.alive)continue;const dx=m.tx-m.x,dy=m.ty-m.y,d=Math.hypot(dx,dy);if(d<0.3){[m.tx,m.ty]=randomPoint(TORNADO.hw,TORNADO.hh);continue;}m.x+=dx/d*wc3(400)*dt;m.y+=dy/d*wc3(400)*dt;for(const u of this.heroes.values())if(u.alive&&dist(m.x,m.y,u.x,u.y)<u.r+wc3(16)){u.x+=(u.x-m.x)/(dist(m.x,m.y,u.x,u.y)||1)*dt;u.y+=(u.y-m.y)/(dist(m.x,m.y,u.x,u.y)||1)*dt;}}
    this.spawnT-=dt;if(this.spawnT<=0){this.spawnT+=TORNADO.spawnEvery;const old=[...this.tornados];for(const t of old){if(this.tornados.length>=TORNADO.cap)break;if(old.length>=10&&Math.random()>=1/3)continue;const alive=[...this.heroes.values()].filter(u=>u.alive);if(!alive.length)break;const v=alive[Math.floor(Math.random()*alive.length)];this.tornados.push(this.makeTornado(t.x,t.y,v.x,v.y));}}
  }
  botThink(pid,u,mem){let dx=0,dy=0;for(const t of this.tornados){const d=dist(t.x,t.y,u.x,u.y);if(d<wc3(420)){const w=1/Math.max(0.25,d*d);dx+=(u.x-t.x)*w;dy+=(u.y-t.y)*w;}}if(Math.hypot(dx,dy)>0.001){const a=Math.atan2(dy,dx)+(pid%3-1)*0.2;u.order(Math.max(-TORNADO.hw+1,Math.min(TORNADO.hw-1,u.x+Math.cos(a)*wc3(350))),Math.max(-TORNADO.hh+1,Math.min(TORNADO.hh-1,u.y+Math.sin(a)*wc3(350))));}else if((mem.next||0)<this.time){mem.next=this.time+1.5+Math.random();u.order(rand(-TORNADO.hw,TORNADO.hw),rand(-TORNADO.hh,TORNADO.hh));}}
  worldEnts(){return [...this.tornados.map(t=>({id:t.id,k:'uxtornado',x:round2(t.x),y:round2(t.y)})),...this.murguls.filter(m=>m.alive).map(m=>({id:m.id,k:'uxmurgul',x:round2(m.x),y:round2(m.y),f:round2(Math.atan2(m.ty-m.y,m.tx-m.x))}))];}
  hud(){return {label:`Naga left: ${this.alive.length} · Tornadoes: ${this.tornados.length}`};}
}
