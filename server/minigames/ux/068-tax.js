import { Minigame } from '../../base.js';
import { wc3, round2 } from '../../../engine/server/sim.js';

export class ATaxingSituation extends Minigame {
  static id='ux-tax';static name='A Taxing Situation';
  static desc='Bid secretly to appease Lord Garithos. Everyone tied for the cheapest payment is executed; your 100 gold must last.';
  static controls='Q: pay 1 gold. W: pay 5. E: pay 10. Spend carefully over many rounds.';
  static duration=600;static timer=false;static ranking='survival';
  setup(){this.map={theme:'stone',floor:{shape:'rect',w:wc3(1152),h:wc3(1024)},bounds:wc3(560),build:['ux-tax']};
    this.gold=new Map(this.pids.map(p=>[p,100]));this.bids=new Map(this.pids.map(p=>[p,0]));this.phase='intro';this.phaseTime=0;this.round=1;this.minBid=null;
    this.abilities=[1,5,10].map((n)=>({name:`Pay ${n}`,icon:n===1?'🪙':n===5?'💰':'🏆',desc:`Pay ${n} gold from your wallet.`,kind:'instant',cd:0,
      available:pid=>this.phase==='bidding'&&this.gold.get(pid)>=n,
      cast:(pid)=>{this.gold.set(pid,this.gold.get(pid)-n);this.bids.set(pid,this.bids.get(pid)+n);}}));
    const xs=[-384,-128,160,416].map(wc3),ys=[192,416].map(wc3);
    this.spawnHeroes(this.pids.map((_,i)=>[xs[i%4],ys[Math.floor(i/4)%2]]),{hp:100,speed:0,r:wc3(31),facing:Math.PI/2});
    for(const u of this.heroes.values())u.skin='ux-villager';this.predict=false;
  }
  command(pid,m){if(m.c==='cast')return super.command(pid,m);}
  tick(dt){this.phaseTime+=dt;
    if(this.phase==='intro'&&this.phaseTime>=4){this.phase='bidding';this.phaseTime=0;this.party.msg('Payment due! You have 20 seconds.');}
    else if(this.phase==='bidding'&&this.phaseTime>=20){this.phase='reveal';this.phaseTime=0;this.minBid=Math.min(...this.alive.map(p=>this.bids.get(p)));this.party.msg(`The cheapest payment was ${this.minBid} gold.`);}
    else if(this.phase==='reveal'&&this.phaseTime>=9.2){this.phase='judged';this.phaseTime=0;
      const losers=this.alive.filter(p=>this.bids.get(p)===this.minBid);
      for(const p of losers)this.eliminate(p);this.party.msg(`${losers.length} villager${losers.length===1?'':'s'} payed too little!`);
      if(this.alive.length<=1)this.endAt=this.time+5;
    }
    else if(this.phase==='judged'&&this.phaseTime>=3&&!this.endAt){this.phase='bidding';this.phaseTime=0;this.round++;for(const p of this.pids)this.bids.set(p,0);this.party.msg('The rest of you! Get paying!');}
    for(const [pid,b] of this.bots){if(!this.heroes.get(pid)?.alive||this.phase!=='bidding')continue;b.think-=dt;if(b.think<=0){b.think=0.7+Math.random();this.botThink(pid,this.heroes.get(pid),b.mem);}}
  }
  botThink(pid,u,mem){const bid=this.bids.get(pid),gold=this.gold.get(pid),desired=Math.min(gold,Math.max(1,Math.round((gold/(Math.max(2,this.alive.length)+1))*(0.35+mem.skill*0.9))));
    if(this.phaseTime<2+mem.skill*5||bid>=desired)return;
    const n=desired-bid>=10?10:desired-bid>=5?5:1;if(gold>=n)this.useAbility(pid,[1,5,10].indexOf(n),u.x,u.y);
  }
  isDone(){return this.endAt!=null&&this.time>=this.endAt;}
  hud(pid){return{label:`Round ${this.round} · ${this.phase==='bidding'?`Payment due in ${Math.max(0,Math.ceil(20-this.phaseTime))}s`:this.phase} · Gold ${this.gold.get(pid)??0} · Paying ${this.bids.get(pid)??0}`};}
  worldEnts(){return[{id:900068,k:'uxlord',x:0,y:-wc3(320)}];}
  snapshot(pid){const s=super.snapshot(pid);s.tax={phase:this.phase,round:this.round,left:this.phase==='bidding'?Math.max(0,round2(20-this.phaseTime)):0,gold:this.gold.get(pid),bid:this.bids.get(pid)};return s;}
}
