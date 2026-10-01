import test from 'node:test';
import assert from 'node:assert/strict';
import { WildClickingDuel } from '../server/minigames/ux/166-wild-clicking.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('Wild Clicking: a click in the first half-second saves; the gap does not', () => {
  const g = new WildClickingDuel(party(), [1, 2, 3]);
  g.setup();
  g.time = 8.1;
  g.tick(1 / 30);
  g.click(1);
  g.time = 8.55;
  g.click(2);
  g.tick(1 / 30);
  assert.equal(g.heroes.get(1).alive, true);
  assert.equal(g.heroes.get(2).alive, false);
  assert.equal(g.heroes.get(3).alive, false);
  assert.equal(g.payouts().get(2), g.payouts().get(3));
});
