import test from 'node:test';
import assert from 'node:assert/strict';
import { DrinkAndBow } from '../server/minigames/ux/161-drinkbow.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: String, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('drink bow: five HP archers with homing 900-speed arrows and 160-second timer', () => {
  const g = new DrinkAndBow(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.hp, 5);
  assert.equal(u.speed, wc3(270));
  assert.equal(g.attack.range, wc3(800));
  assert.equal(g.attack.cd, 1.5);
  assert.equal(g.attack.point, 0.72);
  assert.equal(g.attack.missile, wc3(900));
  assert.equal(DrinkAndBow.duration, 160);
});

test('drink bow: a landed arrow kills even after medium armour', () => {
  const g = new DrinkAndBow(party(), [1, 2]);
  g.setup();
  g.attackHit(1, g.heroes.get(1), g.heroes.get(2));
  assert.equal(g.heroes.get(2).alive, false);
});
