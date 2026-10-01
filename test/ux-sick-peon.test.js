import test from 'node:test';
import assert from 'node:assert/strict';
import { SickPeonPandemonium } from '../server/minigames/ux/163-sick-peon.js';
import { MortarMayhem } from '../server/minigames/mortar.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('Sick Peon: 150 HP, 190 speed, siege pit and reverse race', () => {
  const g = new SickPeonPandemonium(party(), [1, 2, 3]);
  g.setup();
  assert.ok(g instanceof MortarMayhem);
  assert.equal(g.heroes.get(1).hp, 150);
  assert.equal(g.heroes.get(1).speed, wc3(190));
  assert.equal(g.map.floor.w, wc3(1024));
  g.damage(2, 200);
  g.damage(1, 200);
  g.damage(3, 200);
  assert.deepEqual(g.finishOrder, [2, 1, 3]);
  assert.deepEqual([...g.payouts().values()], [7, 8, 6]);
  assert.equal(g.isDone(), true);
});
