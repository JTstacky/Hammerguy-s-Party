import test from 'node:test';
import assert from 'node:assert/strict';
import { BadFurDay, CAR, RABBIT } from '../server/minigames/ux/159-badfur.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: String, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('bad fur: slow-turning cars and ten capped-speed rabbits', () => {
  const g = new BadFurDay(party(), [1, 2]);
  g.setup();
  assert.equal(CAR.speed, wc3(250));
  assert.equal(CAR.turnRate, 0.1);
  assert.equal(RABBIT.speed, wc3(525));
  g.time = 6;
  g.auraT = 1;
  g.tick(1 / 30);
  assert.equal(g.rabbits.length, 10);
});

test('bad fur: 16 kills at 13 XP finish, 15 do not', () => {
  const g = new BadFurDay(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  g.time = 6;
  for (let i = 0; i < 16; i++) {
    g.rabbits = [{ id: 100 + i, x: u.x, y: u.y, tx: u.x, ty: u.y, f: 0, wander: 1 }];
    for (let j = 0; j < 9; j++) g.rabbits.push({ id: 1000 + j, x: -10, y: -10,
      tx: -10, ty: -10, f: 0, wander: 100 });
    g.auraT = 0;
    g.tick(1 / 30);
    if (i === 14) assert.equal(u.finished, undefined);
  }
  assert.equal(u.xp, 208);
  assert.deepEqual(g.finishOrder, [1]);
});
