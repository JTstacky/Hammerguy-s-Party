import test from 'node:test';import assert from 'node:assert/strict';
import { UndergroundRun,BURROW } from '../server/minigames/ux/168-underground.js';import { game } from './ux2-common.js';
test('underground: original drain, morph and den spiders',()=>{const g=game(UndergroundRun);assert.equal(g.heroes.get(1).hp,125);assert.equal(BURROW.drainPeriod,0.15);assert.equal(BURROW.drain,2);assert.equal(BURROW.morph,1.45);assert.equal(g.dens.length,10);});
test('underground: each morph heals; finish pays placement',()=>{const g=game(UndergroundRun,3);const u=g.heroes.get(1);u.hp=5;g.toggle(u);assert.equal(u.hp,150);u.hp=5;g.toggle(u);assert.equal(u.hp,125);g.finish(1);assert.deepEqual([...g.payouts().values()],[8,0,0]);});
test('underground: drain kills unburrowed racers but spares burrowed ones',()=>{const g=game(UndergroundRun);g.time=6;const a=g.heroes.get(1),b=g.heroes.get(2);a.hp=2;g.toggle(b);g.tick(0.15);assert.equal(a.alive,false);assert.equal(b.hp,150);});
