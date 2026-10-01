import test from 'node:test';import assert from 'node:assert/strict';
import { StompOfDoom,STOMP } from '../server/minigames/ux/058-stomp.js';import { game } from './ux2-common.js';
test('stomp: original speed, radius, damage and cooldown',()=>{const g=game(StompOfDoom);assert.equal(g.heroes.get(1).hp,1000);assert.equal(STOMP.radius,150/54);assert.equal(STOMP.damage,5000);assert.equal(g.abilities[0].cd,10);});
test('stomp: nearby rival dies; duel is faster',()=>{const g=game(StompOfDoom);const a=g.heroes.get(1),b=g.heroes.get(2);b.x=a.x+STOMP.radius*0.5;b.y=a.y;g.stomp(1,a);assert.equal(b.alive,false);});
test('stomp: simultaneous deaths rank sequentially',()=>{const g=game(StompOfDoom,3);g.eliminate(1);g.eliminate(2);assert.deepEqual(g.deathGroups(),[[1],[2]]);});
