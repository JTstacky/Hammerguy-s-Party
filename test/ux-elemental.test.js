import test from 'node:test';
import assert from 'node:assert/strict';
import { wc3 } from '../engine/server/sim.js';
import { ElementalClash, ELEM, ELEMENT_GRID, terrainAt } from '../server/minigames/ux/071-elemental.js';

const party = () => ({ room: { isBot: () => false, nameOf: String, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('elemental: the exact 11 tile matrix has one marble centre', () => {
  assert.equal(ELEMENT_GRID.length, 11);
  assert.ok(ELEMENT_GRID.every((row) => row.length === 11));
  assert.equal(ELEMENT_GRID.join('').split('M').length - 1, 1);
  assert.equal(terrainAt(0, 0), 'M');
  assert.equal(terrainAt(0, ELEM.tile), 'R');
});

test('elemental: soil heals 100, rock hits for 75 and stuns for a second', () => {
  const g = new ElementalClash(party(), [1, 2]);
  g.setup();
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  assert.equal(a.hp, 500);
  assert.equal(a.speed, wc3(250));
  assert.equal(g.attack.range, wc3(250));
  a.hp = 350;
  a.x = -4 * ELEM.tile; a.y = -5 * ELEM.tile;
  g.element(1, a);
  assert.equal(a.hp, 450);
  a.x = ELEM.tile; a.y = 0;
  b.x = a.x + ELEM.aoe - 0.1; b.y = 0;
  g.element(1, a);
  assert.equal(b.hp, 425);
  assert.equal(b.stun, 1);
});
