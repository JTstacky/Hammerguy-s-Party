import test from 'node:test';
import assert from 'node:assert/strict';
import { wc3 } from '../engine/server/sim.js';
import { KeepAway, KEEP } from '../server/minigames/ux/069-keep.js';

const party = () => ({ room: { isBot: () => false, nameOf: String, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('keep away: Mathogs and accelerating sapper use the WC3 dimensions', () => {
  const g = new KeepAway(party(), [1, 2]);
  g.setup();
  assert.equal(g.heroes.get(1).speed, wc3(240));
  assert.equal(g.heroes.get(1).hp, 340);
  assert.equal(g.abilities[0].range, wc3(650));
  assert.equal(g.abilities[0].cd, 3);
  g.time = 6;
  g.sapper.x = -7;
  g.sapper.y = -7;
  for (let i = 0; i < 30; i++) g.tick(1 / 30);
  assert.ok(Math.abs(g.sapper.speed - wc3(35)) < 0.1);
});

test('keep away: every Mathog in the 120 radius dies in one explosion', () => {
  const g = new KeepAway(party(), [1, 2, 3]);
  g.setup();
  g.time = 7;
  g.sapper.x = g.sapper.y = 0;
  g.heroes.get(1).x = 0;
  g.heroes.get(1).y = 0;
  g.heroes.get(2).x = KEEP.kill - 0.01;
  g.heroes.get(2).y = 0;
  g.heroes.get(3).x = KEEP.kill + 0.01;
  g.heroes.get(3).y = 0;
  g.explode();
  assert.deepEqual(g.alive, [3]);
  assert.equal(g.sapper.pause, 3);
  assert.equal(g.payouts().get(1), g.payouts().get(2));
});
