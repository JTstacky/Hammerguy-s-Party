import test from 'node:test';import assert from 'node:assert/strict';
import { EnergyBlitz } from '../server/minigames/ux/065-energy.js';import { wc3 } from '../engine/server/sim.js';
const party={room:{isBot:()=>false,nameOf:String,colorOf:()=> '#fff'},ev(){},msg(){}};
test('energy: dragons and resting bolt launch',()=>{const g=new EnergyBlitz(party,[1,2]);g.setup();const u=g.heroes.get(1),b=g.bolts[0];assert.equal(u.hp,500);assert.equal(u.speed,wc3(350));u.x=b.x=u.y=b.y=0;u.setFacing(0);g.time=5;g.tick(1/30);assert.equal(b.s,500);assert.equal(b.x,wc3(155));});
test('energy: contact deals current speed and locks all bolts',()=>{const g=new EnergyBlitz(party,[1,2]);g.setup();const u=g.heroes.get(1),b=g.bolts[0];u.x=b.x=0;u.y=b.y=0;b.s=300;b.f=0;g.time=5;g.tick(1/30);assert.ok(u.hp<220);assert.equal(g.contactLock,0.5);assert.ok(b.s<201);});
test('energy: a second resting bolt arrives at 60 s',()=>{const g=new EnergyBlitz(party,[1,2]);g.setup();g.time=60;g.tick(1/30);assert.equal(g.bolts.length,2);assert.equal(g.bolts[1].s,0);});
