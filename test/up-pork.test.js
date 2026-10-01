// Pork the Piggy (#36) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PorkThePiggy } from '../server/minigames/up/36-pork.js';
import { wc3 } from '../engine/server/sim.js';

const party = (bots = false) => ({ room: { isBot: () => bots, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};
const game = (n = 2) => {
  const g = new PorkThePiggy(party(), Array.from({ length: n }, (_, i) => i + 1));
  g.setup();
  g.patrolT = 1e9;
  return g;
};

test('pork: stationary Troll Headhunters; a 15 HP pig at speed 100', () => {
  const g = game();
  const u = g.heroes.get(1);
  assert.equal(u.speed, 0);
  assert.equal(u.skin, 'pork_hunter');
  assert.equal(g.pig.hp, 15);
  assert.equal(g.pig.speed, wc3(100));
});

test('pork: a click is attack-ground; one spear every 2.31 s', () => {
  const g = game();
  g.pig.stop();
  [g.pig.x, g.pig.y] = [wc3(500), -wc3(500)]; // far from the aim
  const u = g.heroes.get(1);
  g.command(1, { c: 'move', x: u.x, y: u.y - wc3(300) });
  let thrown = 0;
  const throwSpear = g.throwSpear.bind(g);
  g.throwSpear = (...a) => {
    thrown++;
    throwSpear(...a);
  };
  run(g, 0.5);
  assert.equal(thrown, 1);
  run(g, 2.31 - 0.5 - 0.05);
  assert.equal(thrown, 1);
  run(g, 0.4);
  assert.equal(thrown, 2);
  g.command(1, { c: 'stop' });
  run(g, 3);
  assert.equal(thrown, 2);
});

test('pork: a spear kills the pig within 10 u of its landing point and scores once', () => {
  const g = game(3);
  const pig = g.pig;
  pig.stop();
  const land = (pid, dx) => g.land({ pid, x: pig.x + dx, y: pig.y, dmg: 20 });
  land(2, wc3(10) + pig.r + 0.05);
  assert.equal(pig.alive, true);
  land(2, wc3(10) + pig.r - 0.05);
  assert.equal(pig.alive, false);
  assert.deepEqual(g.finishOrder, [2]);
  assert.equal(g.pig, null);
  run(g, 2.1);
  assert.ok(g.pig?.alive); // respawns after 2 s
  g.land({ pid: 2, x: g.pig.x, y: g.pig.y, dmg: 20 });
  assert.equal(g.pig.alive, true); // a finished hunter cannot score again
});

test('pork: a game of bots ends within the 90 s timer', () => {
  const g = new PorkThePiggy(party(true), [1, 2, 3, 4]);
  g.setup();
  while (!g.isDone()) {
    g.time += dt;
    g.tick(dt);
  }
  assert.ok(g.time <= 90 + dt);
});
