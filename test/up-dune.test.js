// #43 Dune Worm Distress against its rule sheet (docs/uther-party/rules-4.0.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DuneWorm, DUNE, OPEN, ROCK, WALL, CLIFF } from '../server/minigames/up/43-dune.js';
import { wc3 } from '../engine/server/sim.js';

function game(n = 2) {
  const party = { room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} };
  const g = new DuneWorm(party, Array.from({ length: n }, (_, i) => i + 1));
  g.setup();
  return g;
}

const run = (g, secs, dt = 1 / 30) => {
  const end = g.time + secs;
  while (g.time < end - 1e-9) {
    g.time += dt;
    g.tick(dt);
  }
};

test('dune: a 14x14 field of 188 rocks at 128 u, cliff corners and a 2x2 hole in the middle', () => {
  const g = game();
  const count = (v) => [...g.grid.block].filter((b) => b === v).length;
  assert.equal(count(ROCK), 188);
  assert.equal(count(CLIFF), 4);
  assert.equal(count(OPEN), 4);
  for (const [i, j] of [[6, 6], [7, 6], [6, 7], [7, 7]]) assert.equal(g.grid.get(i, j), OPEN);
  assert.ok(Math.abs(DUNE.CS - wc3(128)) < 1e-9);
  // Worms: speed 100, 15 HP, collision 7, within 100 u of the centre.
  for (const u of g.heroes.values()) {
    assert.equal(u.hp, 15);
    assert.ok(Math.abs(u.speed - wc3(100)) < 1e-9);
    assert.ok(Math.hypot(u.x, u.y) <= wc3(100) + 1e-6);
  }
});

test('dune: one bite eats a rock and opens the cell; a worm walks into the tunnel', () => {
  const g = game(1);
  const u = g.heroes.get(1);
  [u.x, u.y] = g.grid.center(7, 7);
  const rock = g.rockAt(8, 7);
  g.command(1, { c: 'move', x: rock.x, y: rock.y });
  assert.equal(u.attackOrder, rock);
  run(g, 3);
  assert.equal(g.grid.get(8, 7), OPEN);
  g.command(1, { c: 'move', x: rock.x, y: rock.y });
  run(g, 4);
  assert.deepEqual(g.grid.cellOf(u.x, u.y), [8, 7]);
});

test('dune: a worm bite (12-13 normal, x1.5 vs medium) kills a 15 HP worm in one', () => {
  const g = game(2);
  const [a, b] = [g.heroes.get(1), g.heroes.get(2)];
  g.hit(a, b, 12);
  assert.equal(b.alive, false);
});

test('dune: the Wildkin arrives at t=40, speed 300, and breaks a finished barricade in 9-10 hits', () => {
  const g = game(2);
  for (const u of g.heroes.values()) u.hp = 1e9;
  run(g, 39.9);
  assert.equal(g.wildkin, null);
  run(g, 0.2);
  assert.ok(g.wildkin);
  assert.ok(Math.abs(g.wildkin.speed - wc3(300)) < 1e-9);
  assert.equal(g.wildkin.hp, 550);
  const b = { alive: true, hp: 100, def: 'fort', armor: 5, kind: 'barricade', i: 5, j: 5, x: 0, y: 0 };
  let hits = 0;
  while (b.alive) {
    g.hit(g.wildkin, b, 19 + Math.floor(Math.random() * 4));
    hits++;
  }
  assert.ok(hits >= 9 && hits <= 10, `${hits} hits`);
});

test('dune: one barricade per player, 10 s to build next to its worm, solid while it stands', () => {
  const g = game(1);
  const u = g.heroes.get(1);
  [u.x, u.y] = g.grid.center(6, 6);
  const [tx, ty] = g.grid.center(7, 6);
  g.useAbility(1, 0, tx, ty);
  run(g, 0.5);
  assert.equal(g.grid.get(7, 6), WALL);
  assert.equal(g.lumber.get(1), 0);
  const b = g.barricades[0];
  assert.ok(Math.abs(b.hp - 10 - b.prog * 90) < 1);
  run(g, 10);
  assert.equal(b.prog, 1);
  assert.equal(b.hp, 100);
  assert.equal(g.acharges.get(1)[0], 0, 'only one');
  g.acd.get(1)[0] = 0;
  const [sx, sy] = g.grid.center(6, 7);
  g.useAbility(1, 0, sx, sy);
  run(g, 0.5);
  assert.equal(g.grid.get(6, 7), OPEN, 'no second barricade');
});

test('dune: the Wildkin cannot dig: a worm sealed in rock is out of its reach', () => {
  const g = game(2);
  const [a, b] = [g.heroes.get(1), g.heroes.get(2)];
  [a.x, a.y] = g.grid.center(6, 6);
  // Worm b in its own pocket at (2, 2), cut off by rock.
  g.grid.set(2, 2, OPEN);
  [b.x, b.y] = g.grid.center(2, 2);
  run(g, 40.1);
  const k = g.wildkin;
  assert.ok(g.kinPath(k, a.x, a.y));
  assert.equal(g.kinPath(k, b.x, b.y), null);
});
