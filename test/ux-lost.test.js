import test from 'node:test';
import assert from 'node:assert/strict';
import { LostAndFound } from '../server/minigames/ux/076-lost.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: String, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('lost: marines have 15 HP and speed 240; a hunter appears every four seconds', () => {
  const g = new LostAndFound(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.hp, 15);
  assert.equal(u.speed, wc3(240));
  assert.equal(u.r, wc3(15));
  g.time = 6;
  g.tick(1 / 30);
  assert.equal(g.hunters.length, 1);
  assert.ok(g.revealUntil > g.time);
});

test('lost: two bites kill and a dead marine returns as a hunter', () => {
  const g = new LostAndFound(party(), [1, 2]);
  g.setup();
  g.time = 7;
  const u = g.heroes.get(1);
  g.spawnHunter(u.x, u.y);
  g.tick(1 / 30);
  assert.ok(u.hp <= 4.5);
  g.hunters[0].cd = 0;
  g.tick(1 / 30);
  assert.equal(u.alive, false);
  g.time += 5;
  g.tick(1 / 30);
  assert.ok(g.hunters.some((h) => h.owner === 1));
});
