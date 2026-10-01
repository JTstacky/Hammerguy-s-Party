import test from 'node:test';
import assert from 'node:assert/strict';
import { WildWestDuel } from '../server/minigames/ux/169-wild-west.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('Wild West: 1664 square arena, randomized 4-9 second cue', () => {
  const g = new WildWestDuel(party(), [1, 2, 3]);
  g.setup();
  assert.equal(g.map.floor.w, wc3(1664));
  assert.ok(g.buzzAt >= 8 && g.buzzAt < 13);
  assert.equal(g.endAt, g.buzzAt + 5);
});

test('Wild West: false start dies; the final clicker after the cue dies', () => {
  const g = new WildWestDuel(party(), [1, 2, 3]);
  g.setup();
  g.time = 4.1;
  g.click(1);
  assert.equal(g.heroes.get(1).alive, false);
  g.time = g.buzzAt + 0.2;
  g.click(2);
  assert.equal(g.heroes.get(2).alive, true);
  g.click(3);
  assert.equal(g.heroes.get(3).alive, false);
  assert.equal(g.payouts().get(2), 8);
});
