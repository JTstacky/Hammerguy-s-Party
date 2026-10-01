import test from 'node:test';import assert from 'node:assert/strict';
import { SwordWeaver,SWORD } from '../server/minigames/ux/051-sword-weaver.js';import { wc3 } from '../engine/server/sim.js';
const party=()=>({room:{isBot:()=>false,nameOf:p=>`P${p}`,colorOf:()=>''},msg(){},ev(){}});
test('sword: 475 HP, 350 speed, 150 ahead and 100 radius',()=>{const g=new SwordWeaver(party(),[1,2]);g.setup();assert.equal(g.heroes.get(1).hp,475);assert.equal(g.heroes.get(1).speed,wc3(350));assert.equal(SWORD.reach,wc3(150));assert.equal(SWORD.radius,wc3(100));assert.equal(g.abilities[0].cd,0.35);assert.equal(g.abilities[0].castPoint,0.5);});
test('sword: swing hits ahead through armour, misses behind',()=>{const g=new SwordWeaver(party(),[1,2]);g.setup();const a=g.heroes.get(1),b=g.heroes.get(2);a.x=a.y=0;a.setFacing(0);b.x=wc3(150);b.y=0;g.slash(1,a);assert.ok(Math.abs(b.hp-(475-75/(1+0.06*3.9)))<0.01);b.hp=475;b.x=-wc3(150);g.slash(1,a);assert.equal(b.hp,475);});
test('sword: same-tick eliminations do not tie',()=>{const g=new SwordWeaver(party(),[1,2,3]);g.setup();g.time=5;g.eliminate(1);g.eliminate(2);assert.deepEqual(g.deathGroups(),[[1],[2]]);});
