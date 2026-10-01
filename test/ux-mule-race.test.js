import test from 'node:test';import assert from 'node:assert/strict';
import { MuleRace,MULE } from '../server/minigames/ux/052-mule-race.js';import { wc3 } from '../engine/server/sim.js';
const party=()=>({room:{isBot:()=>false,nameOf:p=>`P${p}`,colorOf:()=>''},msg(){},ev(){}});
test('mule: speed gains are permanent, capped at 525, 6 second start',()=>{const g=new MuleRace(party(),[1,2]);g.setup();const u=g.heroes.get(1);g.tap(1);assert.equal(u.speed,wc3(1));g.time=6;g.tap(1);assert.equal(u.speed,wc3(4.9));for(let i=0;i<200;i++)g.tap(1);assert.equal(u.speed,wc3(525));});
test('mule: finish pays 8 then 7, unfinished zero',()=>{const g=new MuleRace(party(),[1,2,3]);g.setup();g.finish(2);g.finish(1);assert.deepEqual([...g.payouts().values()],[7,8,0]);assert.equal(MULE.duration,50);});
test('mule: eight varied bots race through the finish instead of blocking one another',()=>{const p=party();p.room.isBot=()=>true;const g=new MuleRace(p,[1,2,3,4,5,6,7,8]);g.setup();for(let i=0;i<1500&&!g.isDone();i++){g.time+=1/30;g.tick(1/30);}assert.ok(g.finishOrder.length>=6,`${g.finishOrder.length} finished`);});
