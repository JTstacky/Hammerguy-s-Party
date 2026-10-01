import test from 'node:test';import assert from 'node:assert/strict';
import { AssassinsCove } from '../server/minigames/ux/064-assassin.js';import { wc3 } from '../engine/server/sim.js';
const party={room:{isBot:()=>false,nameOf:String,colorOf:()=> '#fff'},ev(){},msg(){}};
test('assassin: stats, ranges and cooldowns',()=>{const g=new AssassinsCove(party,[1,2]);g.setup();assert.equal(g.heroes.get(1).hp,100);assert.equal(g.heroes.get(1).speed,wc3(320));assert.deepEqual(g.abilities.map(a=>[a.range,a.cd]),[[wc3(100),3],[wc3(500),5]]);});
test('assassin: rear cone kills and a frontal miss does not',()=>{const g=new AssassinsCove(party,[1,2]);g.setup();const a=g.heroes.get(1),b=g.heroes.get(2);a.x=-1;b.x=0;a.y=b.y=0;b.setFacing(0);g.abilities[0].cast(1,a,{u:b});assert.equal(b.alive,false);const h=new AssassinsCove(party,[1,2]);h.setup();const c=h.heroes.get(1),d=h.heroes.get(2);c.x=1;d.x=0;c.y=d.y=0;d.setFacing(0);h.abilities[0].cast(1,c,{u:d});assert.equal(d.alive,true);});
