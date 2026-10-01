// Doggy Hell (#40): fetch a stick through a lava maze under meat wagon fire.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DoggyHell, LAVA, START, SHELL } from '../server/minigames/up/40-doggy.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};

test('doggy: dogs 15 HP at 190 in the circle; 8 sticks; 10 wagons; 13 lava pools', () => {
  const g = new DoggyHell(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.hp, 15);
  assert.equal(u.speed, wc3(190));
  assert.ok(u.x >= START.x0 && u.x <= START.x1 && u.y >= START.y0 && u.y <= START.y1);
  assert.equal(g.sticks.length, 8);
  assert.equal(g.wagons.length, 10);
  assert.equal(LAVA.length, 13);
  assert.equal(SHELL.splash, wc3(64));
});

test('doggy: wagons fire every 2.0 s, and every 1.5 s once a stick is taken', () => {
  const g = new DoggyHell(party(), [1, 2]);
  g.setup();
  run(g, 0.2);
  assert.equal(g.wagons[0].cd > 1.5, true);
  const u = g.heroes.get(1);
  const s = g.sticks[0];
  [u.x, u.y] = [s.x, s.y];
  run(g, 0.05);
  assert.equal(u.stick, s);
  assert.equal(u.skin, 'dogstick');
  assert.equal(g.fast, true);
  run(g, 0.1);
  for (const w of g.wagons) assert.ok(w.wind >= 0 || w.cd <= SHELL.cdFast, 'all wagons re-aimed at once');
});

test('doggy: lava kills and drops the stick where the dog fell', () => {
  const g = new DoggyHell(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  const s = g.sticks[0];
  [u.x, u.y] = [s.x, s.y];
  run(g, 0.05);
  const spine = LAVA[12];
  [u.x, u.y] = [(spine.x0 + spine.x1) / 2, (spine.y0 + spine.y1) / 2];
  run(g, 0.05);
  assert.equal(u.alive, false);
  assert.equal(g.sticks.length, 8, 'the stick is back on the ground');
});

test('doggy: bringing a stick home is a race finish', () => {
  const g = new DoggyHell(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(2);
  u.stick = g.sticks.pop();
  [u.x, u.y] = [0, (START.y0 + START.y1) / 2];
  run(g, 0.05);
  assert.deepEqual(g.finishOrder, [2]);
  assert.equal(u.skin, 'dog');
  assert.equal(g.payouts().get(2), 8);
});
