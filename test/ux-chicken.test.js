import test from 'node:test';
import assert from 'node:assert/strict';
import { ChickenStampede } from '../server/minigames/ux/162-chicken-stampede.js';
import { KodoStampede } from '../server/minigames/kodo.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('Chicken Stampede reuses the 1408 by 768 arena and 700 HP grunts', () => {
  const g = new ChickenStampede(party(), [1, 2]);
  g.setup();
  assert.ok(g instanceof KodoStampede);
  assert.equal(g.map.floor.w, wc3(1408));
  assert.equal(g.map.floor.h, wc3(768));
  assert.equal(g.heroes.get(1).hp, 700);
  assert.equal(g.spawnT, 3);
});

test('Chicken Stampede: contact deals 25 within 100 WC3 units', () => {
  const g = new ChickenStampede(party(), [1, 2]);
  g.setup();
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  a.x = b.x = 0;
  a.y = b.y = 0;
  g.chickens.push({ id: 9999, x: 0, y: 0, vx: 0, vy: 0 });
  g.tick(1 / 30);
  assert.equal(a.hp, 675);
  assert.equal(b.hp, 675);
  assert.equal(g.chickens.length, 0);
});
