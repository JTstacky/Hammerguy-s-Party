import test from 'node:test';
import assert from 'node:assert/strict';
import { TitanicPanic, BOAT, RAM } from '../server/minigames/ux/077-titanic.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: String, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('titanic: 500 HP boats and 125-ahead ram every 0.66 seconds', () => {
  const g = new TitanicPanic(party(), [1, 2]);
  g.setup();
  assert.equal(BOAT.speed, wc3(320));
  assert.equal(BOAT.turnRate, 0.4);
  assert.equal(RAM.period, 0.66);
  const a = g.heroes.get(1), b = g.heroes.get(2);
  assert.equal(a.hp, 500);
  [a.x, a.y, b.x, b.y] = [0, 0, wc3(125), 0];
  a.setFacing(0);
  a.hp = 400;
  g.ram(1, a);
  assert.equal(b.hp, 400);
  assert.equal(a.hp, 415);
  assert.ok(g.arcs.some((arc) => arc.u === b && Math.abs(arc.ex - b.x - wc3(270)) < 1e-8));
});

test('titanic: landing splash is 300 damage within 50', () => {
  const g = new TitanicPanic(party(), [1, 2, 3]);
  g.setup();
  [g.heroes.get(2).x, g.heroes.get(2).y] = [wc3(49), 0];
  [g.heroes.get(3).x, g.heroes.get(3).y] = [wc3(51), 0];
  g.splash(0, 0, 1);
  assert.equal(g.heroes.get(2).hp, 200);
  assert.equal(g.heroes.get(3).hp, 500);
});
