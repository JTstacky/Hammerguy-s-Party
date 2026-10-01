import test from 'node:test';
import assert from 'node:assert/strict';
import { WintersEquinox } from '../server/minigames/ux/063-winter.js';
import { wc3 } from '../engine/server/sim.js';
const party={room:{isBot:()=>false,nameOf:String,colorOf:()=> '#fff'},ev(){},msg(){}};
test('winter: icicles, blink and growing spirit clock match the sheet',()=>{const g=new WintersEquinox(party,[1,2]);g.setup();const u=g.heroes.get(1);assert.equal(u.hp,50);assert.equal(u.speed,wc3(270));assert.equal(g.abilities[0].range,wc3(400));assert.equal(g.abilities[0].cd,3);g.time=5;g.tick(1/30);assert.equal(g.spirits.length,1);g.time=20;g.tick(1/30);assert.equal(g.spirits.length,2);});
test('winter: warning is harmless, pillar burns, and no countdown',()=>{const g=new WintersEquinox(party,[1,2]);g.setup();g.time=5;const u=g.heroes.get(1);g.strikes=[{id:9,x:u.x,y:u.y,age:0}];g.tick(0.5);assert.equal(u.hp,50);g.tick(0.6);assert.ok(u.hp<50);assert.equal(WintersEquinox.timer,false);});
