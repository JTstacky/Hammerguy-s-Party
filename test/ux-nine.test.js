import test from 'node:test';
import assert from 'node:assert/strict';
import { OverNineThousand } from '../server/minigames/ux/075-nine.js';

const party = () => ({ room: { isBot: () => false, nameOf: String, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('nine: seed at five seconds and one foreign click replaces four diagonal sites', () => {
  const g = new OverNineThousand(party(), [1, 2]);
  g.setup();
  g.time = 4.99;
  g.tick(1 / 30);
  assert.equal(g.sludges.size, 0);
  g.time = 5;
  g.tick(1 / 30);
  assert.equal(g.sludges.size, 1);
  assert.equal(g.click(1, 0, 0), true);
  assert.equal(g.sludges.size, 4);
  assert.equal([...g.sludges.values()].filter((s) => s.owner === 1).length, 3);
  assert.equal(g.click(1, 0, 0), false);
});

test('nine: zero-piece players receive 8 minus positive holders', () => {
  const g = new OverNineThousand(party(), [1, 2, 3, 4]);
  g.setup();
  g.put(0, 0, 1);
  g.put(1, 1, 2);
  g.put(2, 2, 2);
  const p = g.payouts();
  assert.equal(p.get(3), 6);
  assert.equal(p.get(4), 6);
  assert.equal(p.get(2), 8);
});
