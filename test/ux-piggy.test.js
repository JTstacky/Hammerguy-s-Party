import test from 'node:test';
import assert from 'node:assert/strict';
import { PiggyPandemonium } from '../server/minigames/ux/164-piggy-pandemonium.js';
import { MortarMayhem } from '../server/minigames/mortar.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('Piggy: 10 HP, 190 speed, 40 hunters then 20 demolishers', () => {
  const g = new PiggyPandemonium(party(), [1, 2]);
  g.setup();
  assert.ok(g instanceof MortarMayhem);
  assert.equal(g.heroes.get(1).hp, 10);
  assert.equal(g.heroes.get(1).speed, wc3(190));
  for (let i = 0; i < 41; i++) g.spawnSiege();
  assert.equal(g.siege[39].demo, false);
  assert.equal(g.siege[40].demo, true);
});

test('Piggy: simultaneous deaths share the lower ante', () => {
  const g = new PiggyPandemonium(party(), [1, 2, 3]);
  g.setup();
  g.damage(1, 10);
  g.damage(2, 10);
  assert.equal(g.payouts().get(1), 6);
  assert.equal(g.payouts().get(2), 6);
  assert.equal(g.payouts().get(3), 8);
});
