import { Minigame } from '../../base.js';
import { wc3, clampToRect, round2 } from '../../../engine/server/sim.js';
import { shuffled } from './ux1-common.js';

export const MULE={ base:1, step:3.9, cap:525, pause:6, finish:wc3(4480-(-64)), duration:50 };
const MINX=wc3(-2496), MAXX=wc3(2496), HH=wc3(512);
const LANES=[480,352,224,96,-32,-160,-288,-416].map(wc3);
export class MuleRace extends Minigame {
  static id='mulerace'; static name='Mule Race';
  static desc='Mash Down or tap the big button to make your mule faster. Speed never decays. Cross the finish first.';
  static controls='Down arrow or Q / TAP button: +3.9 WC3 speed per press. Right-click can steer.';
  static duration=MULE.duration; static ranking='race';
  setup(){
    this.map={theme:'ux-track',floor:{shape:'rect',w:MAXX-MINX,h:HH*2},bounds:wc3(2600),follow:true,build:['ux-mule'],props:[]};
    this.abilities=[{name:'Giddy Up!',icon:'🐎',desc:'Each press permanently adds 3.9 speed, up to 525.',kind:'instant',cast:(pid)=>this.tap(pid)}];
    this.spawnHeroes(shuffled(LANES.map(y=>[wc3(-2304),y])),{hp:100,speed:wc3(1),r:wc3(16),facing:0,turnRate:0.5});
    for(const u of this.heroes.values()){u.skin='ux-mule';u.presses=0;}
  }
  tap(pid){const u=this.heroes.get(pid);if(!u?.alive||u.finished||this.time<MULE.pause)return;u.presses++;u.speed=wc3(Math.min(MULE.cap,MULE.base+u.presses*MULE.step));}
  command(pid,m){if(m.c==='tap'||(m.c==='cast'&&(m.slot===0||m.slot==null))){this.tap(pid);return;}if(this.time<MULE.pause)return;super.command(pid,m);}
  tick(dt){if(this.time<MULE.pause)return;for(const u of this.heroes.values())if(u.alive&&!u.finished&&!u.target)u.order(wc3(2368),0);this.stepHeroes(dt);for(const [pid,u] of this.heroes){if(!u.alive||u.finished)continue;u.y=Math.max(-HH+u.r,Math.min(HH-u.r,u.y));u.x=Math.max(MINX+u.r,Math.min(MAXX-u.r,u.x));if(u.x>=wc3(2240))this.finish(pid);}}
  progress(pid){return this.heroes.get(pid)?.x||0;}
  finish(pid){if(this.finishOrder.includes(pid))return;super.finish(pid);const u=this.heroes.get(pid);u.stop();u.x=wc3(3000);u.y=0;}
  heroEnts(pid){return super.heroEnts(pid).filter(e=>!this.heroes.get(e.o)?.finished);}
  botThink(pid,u,mem){if(this.time<MULE.pause)return;mem.tapAt??=this.time;const rate=4.2+(pid%4)*1.1;while(this.time>=mem.tapAt){this.tap(pid);mem.tapAt+=1/rate;}if(!u.target)u.order(wc3(2368),0);}
  hud(pid){const u=this.heroes.get(pid);return {label:`Speed: ${((u?.speed||0)*54/10).toFixed(1)} km/h · ${u?.presses||0} taps`};}
  worldEnts(){return [{id:'ux-mule-ui',k:'uxmuleui',x:0,y:0}];}
}
