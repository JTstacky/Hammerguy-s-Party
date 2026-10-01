import test from 'node:test';
import assert from 'node:assert/strict';
import { DefenseJoke } from '../server/minigames/ux/167-defense.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('Defense: helpless 50 HP peons in a 352 by 288 WC3 lane', () => {
  const g = new DefenseJoke(party(), [1, 2]);
  g.setup();
  assert.equal(g.map.floor.w, wc3(352));
  assert.equal(g.map.floor.h, wc3(288));
  assert.equal(g.heroes.get(1).hp, 50);
  assert.equal(g.attack, null);
  assert.equal(g.creeps.length, 8);
  assert.equal(g.creeps.filter((c) => c.kind === 'ux6cultist').length, 3);
  assert.equal(g.creeps.find((c) => c.kind === 'ux6tree').hp, 1300);
});
