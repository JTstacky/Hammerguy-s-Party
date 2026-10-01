import test from 'node:test';
import assert from 'node:assert/strict';
import { MiltonsMisery, MILTON } from '../server/minigames/ux/073-milton.js';

const party = () => ({ room: { isBot: () => false, nameOf: String, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('milton: barrel starts at 13 and the threshold is hidden from snapshots', () => {
  const g = new MiltonsMisery(party(), [1, 2]);
  g.setup();
  assert.equal(g.barrelHp, 13);
  assert.ok(g.threshold >= 1 && g.threshold <= 10);
  assert.equal(g.abilities[0].cd, MILTON.shieldCd);
  assert.equal(g.worldEnts()[0].hp, 13);
  assert.equal('threshold' in g.worldEnts()[0], false);
});

test('milton: the blast kills unshielded players; later shield wins', () => {
  const g = new MiltonsMisery(party(), [1, 2, 3]);
  g.setup();
  g.time = 8;
  g.barrelHp = 9;
  g.abilities[0].cast(1, g.heroes.get(1));
  g.barrelHp = 5;
  g.abilities[0].cast(2, g.heroes.get(2));
  assert.equal(g.heroes.get(1).saved, 4);
  assert.equal(g.heroes.get(2).saved, 8);
  g.blast();
  assert.deepEqual(g.alive, [1, 2]);
  g.sortShielders();
  assert.deepEqual(g.alive, [2]);
  assert.equal(g.payouts().get(2), 8);
});
