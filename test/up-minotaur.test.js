// Minotaur Maze (#32) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MinotaurMaze, MAZE, SKINK, MINO, MINO_ATTACK, PICKUP, FIRST_WEED_R, START } from '../server/minigames/up/32-minotaur.js';
import { wc3, dist } from '../engine/server/sim.js';
import { party, run } from './up-b-helpers.js';

test('minotaur: skinks (speed 200, collision 15) and four 1300 HP minotaurs in a 24 x 24 maze', () => {
  const g = new MinotaurMaze(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.speed, wc3(200));
  assert.equal(u.r, wc3(15));
  assert.equal(SKINK.hp, 15);
  assert.equal(u.skin, 'skink');
  assert.equal(MAZE.length, 24);
  assert.ok(MAZE.every((r) => r.length === 24));
  assert.equal(g.minos.length, 4);
  assert.equal(MINO.speed, wc3(270));
  assert.equal(MINO.hp, 1300);
  assert.equal(MINO_ATTACK.range, wc3(64));
  assert.equal(MINO_ATTACK.cd, 1.9);
});

test('minotaur: the first shimmerweed appears at t=4, 640 from the centre', () => {
  const g = new MinotaurMaze(party(), [1]);
  g.setup();
  for (const m of g.minos) m.speed = 0;
  run(g, START - 0.1);
  assert.equal(g.weed, null);
  run(g, 0.2);
  assert.ok(g.weed);
  // Snapped to the nearest open spot, so within a cell or so of the ring.
  const r = dist(0, 0, g.weed.x, g.weed.y);
  assert.ok(Math.abs(r - FIRST_WEED_R) < wc3(96), `${r}`);
  assert.ok(g.grid.fits(g.weed.x, g.weed.y, SKINK.r));
});

test('minotaur: touching the weed (64) finishes you and a new weed spawns', () => {
  const g = new MinotaurMaze(party(), [1, 2]);
  g.setup();
  for (const m of g.minos) m.speed = 0;
  run(g, START + 0.1);
  const w = g.weed;
  const u = g.heroes.get(1);
  [u.x, u.y] = [w.x, w.y];
  assert.ok(PICKUP === wc3(64));
  u.stop();
  run(g, 0.1);
  assert.ok(u.finished);
  assert.deepEqual(g.finishOrder, [1]);
  assert.ok(g.weed && g.weed !== w, 'a new weed');
  assert.equal(g.claimed, 1);
});
