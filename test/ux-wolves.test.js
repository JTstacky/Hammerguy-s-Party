import test from 'node:test';import assert from 'node:assert/strict';
import { RampageWithWolves,WOLVES } from '../server/minigames/ux/056-wolves.js';import { game } from './ux2-common.js';
test('wolves: 28 wolves, eight grass, sheep and kill radius',()=>{const g=game(RampageWithWolves);assert.equal(g.wolves.length,28);assert.equal(g.grass.length,8);assert.equal(g.heroes.get(1).hp,15);assert.equal(WOLVES.kill,80/54);});
test('wolves: finishing pays 8, 7; unplaced pays zero',()=>{const g=game(RampageWithWolves,3);g.finish(1);g.finish(2);assert.deepEqual([...g.payouts().values()],[8,7,0]);});
test('wolves: caught carrier drops a patch of grass',()=>{const g=game(RampageWithWolves);const u=g.heroes.get(1);u.carry=true;g.grass.forEach(v=>v.taken=true);g.wolves[0].x=u.x;g.wolves[0].y=u.y;g.time=5;g.tick(1/30);assert.equal(u.alive,false);assert.equal(g.grass.length,9);assert.equal(g.grass[8].taken,false);});
