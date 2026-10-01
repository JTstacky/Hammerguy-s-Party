import test from 'node:test';
import assert from 'node:assert/strict';
import { WildEastDuel } from '../server/minigames/ux/059-wild-east.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('Wild East: 4-10 second target, paused 335 HP Shaman, preview clicks count as zero', () => {
  const g = new WildEastDuel(party(), [1, 2]);
  g.setup();
  assert.ok(g.target >= 4 && g.target <= 10);
  assert.equal(g.heroes.get(1).hp, 335);
  assert.equal(g.heroes.get(1).speed, 0);
  g.time = 4.1;
  g.click(1);
  assert.equal(g.errors.get(1), g.target);
  g.time = 8 + g.target;
  g.click(2);
  assert.equal(g.errors.get(2), 0);
});

test('Wild East: no click dies at 23 s; exact worst ties share their payout', () => {
  const g = new WildEastDuel(party(), [1, 2, 3]);
  g.setup();
  g.time = 12;
  g.click(1);
  g.click(2);
  g.time = 23;
  g.tick(1 / 30);
  assert.equal(g.heroes.get(3).alive, false);
  g.time = 25;
  g.tick(1 / 30);
  assert.equal(g.heroes.get(1).alive, false);
  assert.equal(g.heroes.get(2).alive, false);
  assert.equal(g.payouts().get(1), g.payouts().get(2));
});
