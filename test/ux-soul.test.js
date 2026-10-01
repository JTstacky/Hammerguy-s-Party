import test from 'node:test';import assert from 'node:assert/strict';
import { SoulExchange,SOUL } from '../server/minigames/ux/062-soul.js';import { game } from './ux2-common.js';
test('soul: revenant health and channel stats',()=>{const g=game(SoulExchange);assert.equal(g.heroes.get(1).hp,250);assert.equal(SOUL.swapRange,600/54);assert.equal(SOUL.swapCd,10);assert.equal(g.attack.cd,1.35);});
test('soul: swap retains HP and cooldown with the body',()=>{const g=game(SoulExchange);const a=g.heroes.get(1),b=g.heroes.get(2);a.x=0;a.y=0;b.x=1;b.y=0;a.hp=12;b.hp=230;g.acd.get(1)[0]=10;g.swap(1,a,b);assert.equal(g.heroes.get(1),b);assert.equal(g.heroes.get(1).hp,230);assert.equal(g.heroes.get(2).hp,12);assert.equal(g.acd.get(1)[0],0);assert.equal(g.acd.get(2)[0],10);});
