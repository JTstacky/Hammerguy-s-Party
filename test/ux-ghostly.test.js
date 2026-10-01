import test from 'node:test';import assert from 'node:assert/strict';
import { GhostlyGambit,GHOSTLY } from '../server/minigames/ux/061-ghostly.js';import { game } from './ux2-common.js';
test('ghostly: forty bodies and five leech ticks',()=>{const g=game(GhostlyGambit);assert.equal(g.pool.length,40);assert.equal(g.heroes.get(1).hp,100);assert.equal(GHOSTLY.drain,20);assert.equal(GHOSTLY.range,250/54);});
test('ghostly: possession consumes neutral and resets HP',()=>{const g=game(GhostlyGambit);const u=g.heroes.get(1),v=g.pool[0];v.x=u.x+1;v.y=u.y;u.hp=20;g.possess(1,u,v);assert.equal(u.hp,100);assert.equal(v.alive,false);assert.equal(u.x,v.x);});
test('ghostly: five global leech ticks consume a full body',()=>{const g=game(GhostlyGambit);g.time=7;for(let i=0;i<5;i++){g.time+=1;g.tick(1);}assert.equal(g.heroes.get(1).alive,false);assert.deepEqual(g.deathGroups(),[[1,2]]);});
