import test from 'node:test';
import assert from 'node:assert/strict';
import { WallStreetTraffic, STOCK } from '../server/minigames/ux/072-stock.js';

const party = () => ({ room: { isBot: () => false, nameOf: String, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('stock: a buy and sale change the shared quote and cash as specified', () => {
  const g = new WallStreetTraffic(party(), [1, 2]);
  g.setup();
  g.time = 4;
  assert.equal(g.gold.get(1), STOCK.startGold);
  assert.deepEqual(g.prices, [5, 5, 5, 5]);
  assert.equal(g.trade(1, 0), true);
  assert.equal(g.gold.get(1), 95);
  assert.equal(g.prices[0], 8);
  assert.equal(g.shares.get(1)[0], 1);
  assert.equal(g.trade(2, 0), true);
  assert.equal(g.prices[0], 11);
  assert.equal(g.trade(1, 0, true), true);
  assert.equal(g.gold.get(1), 106);
  assert.equal(g.prices[0], 9);
});

test('stock: unsold shares score zero and equal cash shares the top ante', () => {
  const g = new WallStreetTraffic(party(), [1, 2]);
  g.setup();
  g.time = 4;
  g.trade(1, 0);
  g.time = 55;
  g.tick(1 / 30);
  assert.equal(g.scores.get(1), 95);
  assert.equal(g.scores.get(2), 100);
  assert.equal(g.payouts().get(2), 8);
  assert.equal(g.trade(1, 0, true), false);
});
