import test from 'node:test';import assert from 'node:assert/strict';
import { OneBombTooMany } from '../server/minigames/ux/066-bomb.js';import { wc3 } from '../engine/server/sim.js';
const party={room:{isBot:()=>false,nameOf:String,colorOf:()=> '#fff'},ev(){},msg(){}};
test('bomb: tinker and mine numbers',()=>{const g=new OneBombTooMany(party,[1,2]);g.setup();assert.equal(g.heroes.get(1).hp,575);assert.equal(g.heroes.get(1).speed,wc3(270));assert.equal(g.abilities[0].range,wc3(325));assert.equal(g.abilities[0].cd,0.5);assert.equal(g.abilities[0].castPoint,0.53);});
test('bomb: blast kills owner and chains within 400',()=>{const g=new OneBombTooMany(party,[1,2]);g.setup();const u=g.heroes.get(1);g.mines=[{id:1,x:u.x,y:u.y,age:5},{id:2,x:u.x+wc3(350),y:u.y,age:0}];g.blast(g.mines[0]);assert.equal(u.alive,false);assert.equal(g.mines[1].done,true);});
test('bomb: one explosion can draw the last two players',()=>{const g=new OneBombTooMany(party,[1,2]);g.setup();for(const u of g.heroes.values()){u.x=0;u.y=0;}g.time=5;g.blast({id:1,x:0,y:0,age:5});assert.equal(g.alive.length,0);assert.equal(g.payouts().get(1),7);assert.equal(g.payouts().get(2),7);});
