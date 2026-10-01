// The Rat Maze (#2) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RatMaze, MAZE, T, RAT, SPIDER } from '../server/minigames/up/02-ratmaze.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};
const fresh = (n = 2) => {
  const g = new RatMaze(party(), Array.from({ length: n }, (_, i) => i + 1));
  g.setup();
  return g;
};

test('ratmaze: 19x19 maze of 128 u cells; rats 15 HP, speed 270 (190 with the cheese), collision 7', () => {
  assert.equal(MAZE.length, 19);
  assert.ok(MAZE.every((r) => r.length === 19));
  assert.equal(T, wc3(128));
  const g = fresh();
  const u = g.heroes.get(1);
  assert.equal(u.hp, 15);
  assert.equal(u.speed, wc3(270));
  assert.equal(u.r, wc3(7));
  assert.equal(RAT.carry, wc3(190));
  assert.equal(u.skin, 'rat');
});

test('ratmaze: five spiders guard the cheese; one bite (15-16.5) kills a rat', () => {
  const g = fresh();
  assert.equal(g.spiders.length, 5);
  for (const s of g.spiders) assert.ok(Math.hypot(s.x - g.cheese.x, s.y - g.cheese.y) <= T + 1e-6);
  assert.equal(SPIDER.acq, wc3(275));
  assert.equal(SPIDER.cd, 1.35);
  const u = g.heroes.get(1);
  g.bite(u);
  assert.equal(u.alive, false);
});

test('ratmaze: rats cannot walk through the walls', () => {
  const g = fresh(1);
  for (const s of g.spiders) s.alive = false;
  g.spiders = [];
  const u = g.heroes.get(1);
  // Start 1 is at the top; straight south of it is a wall.
  u.order(u.x, u.y + T * 3);
  run(g, 2);
  assert.ok(g.grid.walkable(u.x, u.y));
});

test('ratmaze: carrying the cheese slows you; the first rat home with it takes everything', () => {
  const g = fresh(3);
  g.spiders = [];
  const u = g.heroes.get(2);
  u.x = g.cheese.x;
  u.y = g.cheese.y;
  run(g, dt * 2);
  assert.equal(g.cheese.carrier, 2);
  assert.equal(u.speed, RAT.carry);
  const [hx, hy] = g.home.get(2);
  u.x = hx;
  u.y = hy;
  run(g, dt * 2);
  assert.ok(g.isDone());
  const pay = g.payouts();
  assert.equal(pay.get(2), 8);
  assert.equal(pay.get(1) || 0, 0);
  assert.equal(pay.get(3) || 0, 0);
});

test('ratmaze: a rat that dies drops the cheese where it fell', () => {
  const g = fresh();
  g.spiders = [];
  const u = g.heroes.get(1);
  u.x = g.cheese.x;
  u.y = g.cheese.y;
  run(g, dt * 2);
  assert.equal(g.cheese.carrier, 1);
  g.bite(u);
  assert.equal(g.cheese.carrier, null);
});
