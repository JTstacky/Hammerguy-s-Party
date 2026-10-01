import { Minigame } from '../../base.js';
import { wc3 } from '../../../engine/server/sim.js';
import { shuffled } from './ux1-common.js';

export const TYPING={pool:'abcdefgihklmnopqrstuvwy',window:5.5,between:2.1,first:6.1};
const COLS=[-384,-128,160,416].map(wc3);
export class TypingTerror extends Minigame {
  static id='typingterror';static name='Typing Terror';
  static desc='Type Mannoroth’s exact nonsense word before the 5.5 second deadline. Any wrong submission eliminates you.';
  static controls='Type into the on-screen field and press Enter or Submit. A wrong answer kills immediately.';
  static duration=300;static timer=false;static ranking='survival';
  setup(){
    this.map={theme:'ux-fel',floor:{shape:'rect',w:wc3(1152),h:wc3(1024)},bounds:wc3(650),build:['ux-typing','ux-mannoroth-details'],props:[]};
    const spots=shuffled([wc3(-128),wc3(-352)].flatMap(y=>COLS.map(x=>[x,y])));
    this.spawnHeroes(spots,{hp:1,speed:0,r:wc3(31)});
    for(const u of this.heroes.values())u.skin='ux-felgrunt';
    this.round=0;this.word='';this.phase='wait';this.next=TYPING.first;this.deadline=0;this.safe=new Set();
  }
  command(pid,m){if(m.c!=='type'||!this.heroes.get(pid)?.alive)return;const s=String(m.text??'').toLowerCase();if(s===this.word){if(this.phase==='type')this.safe.add(pid);}else this.eliminate(pid,'boom');}
  newRound(){this.round++;const n=2*this.round-1;this.word=Array.from({length:n},()=>TYPING.pool[Math.floor(Math.random()*TYPING.pool.length)]).join('');this.phase='type';this.safe.clear();this.deadline=this.time+TYPING.window;}
  tick(dt){if(this.phase==='wait'&&this.time>=this.next)this.newRound();if(this.phase==='type'&&this.time>=this.deadline){for(const pid of this.alive)if(!this.safe.has(pid))this.eliminate(pid,'boom');this.phase='wait';this.next=this.time+TYPING.between;}for(const [pid,b] of this.bots){if(!this.heroes.get(pid)?.alive||this.phase!=='type'||this.safe.has(pid))continue;const m=b.mem;if(m.round!==this.round){m.round=this.round;m.at=this.time+0.45+this.word.length*(0.17+(pid%4)*0.045);}if(this.time>=m.at){if(Math.random()<Math.max(0.3,0.99-this.word.length*(0.02+pid%3*0.005)))this.safe.add(pid);else this.eliminate(pid,'boom');}}}
  hud(pid){return {label:this.phase==='type'?`Mannoroth: ${this.word} · ${Math.max(0,this.deadline-this.time).toFixed(1)}s${this.safe.has(pid)?' · SAFE':''}`:'Mannoroth is thinking…'};}
  worldEnts(){return [{id:'ux-typing-ui',k:'uxtypingui',x:0,y:0,word:this.phase==='type'?this.word:'',left:this.phase==='type'?Math.max(0,Math.round((this.deadline-this.time)*10)/10):0,round:this.round}];}
}
