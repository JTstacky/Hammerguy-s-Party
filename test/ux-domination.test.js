import test from 'node:test';import assert from 'node:assert/strict';
import { Domination,DH } from '../server/minigames/ux/031-domination.js';import { wc3 } from '../engine/server/sim.js';
const party=()=>({room:{isBot:()=>false,nameOf:p=>`P${p}`,colorOf:()=>''},msg(){},ev(){}});
test('domination: demon hunters and spell numbers',()=>{const g=new Domination(party(),[1,2]);g.setup();const u=g.heroes.get(1);assert.equal(u.hp,100);assert.equal(u.speed,wc3(320));assert.equal(u.r,wc3(31));assert.equal(DH.aura,wc3(250));assert.equal(DH.disable,wc3(300));});
test('domination: toggled aura deals 10 per second and off-switch disables',()=>{const g=new Domination(party(),[1,2]);g.setup();g.time=5;const a=g.heroes.get(1),b=g.heroes.get(2);a.x=b.x=0;a.y=b.y=0;g.useAbility(1,0,0,0);assert.equal(a.immolate,true);g.tick(1/30);assert.ok(b.hp<100);g.abilities[1].cast(2,b,{u:a});assert.equal(a.immolate,false);});
test('domination: simultaneous deaths still pay sequential antes',()=>{const g=new Domination(party(),[1,2,3]);g.setup();g.time=8;g.eliminate(1);g.eliminate(2);assert.deepEqual(g.deathGroups(),[[1],[2]]);assert.equal(g.payouts().get(3),8);});
