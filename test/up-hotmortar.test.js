// Hot Mortar (#4) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HotMortar, TEAM, MISSILE, CAST_POINT, RANGE, FUSE, PAUSE } from '../server/minigames/up/04-hotmortar.js';
import { wc3, dist } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};
const fresh = (n = 3) => {
  const g = new HotMortar(party(), Array.from({ length: n }, (_, i) => i + 1));
  g.setup();
  return g;
};

test('hotmortar: mortar teams 5 HP, speed 270, collision 48; pass: range 2000, 1 s cast point, 900 u/s', () => {
  const g = fresh();
  const u = g.heroes.get(1);
  assert.equal(u.hp, TEAM.hp);
  assert.equal(TEAM.hp, 5);
  assert.equal(u.speed, wc3(270));
  assert.equal(u.r, wc3(48));
  assert.equal(RANGE, wc3(2000));
  assert.equal(CAST_POINT, 1.0);
  assert.equal(MISSILE, wc3(900));
  assert.deepEqual(FUSE, [5, 25]);
  assert.equal(u.skin, 'mortarteam');
});

test('hotmortar: 4 s pause, then the tower throws to a team and a 5-25 s fuse starts', () => {
  const g = fresh();
  run(g, PAUSE - 0.1);
  assert.equal(g.flight, null);
  run(g, 0.2);
  assert.ok(g.flight);
  assert.ok(g.fuse >= 5 && g.fuse <= 25);
});

test('hotmortar: only the holder acts; a right-click (or tap) on a rival passes after 1 s plus flight', () => {
  const g = fresh();
  g.startT = null;
  g.holder = 1;
  g.fuse = 100;
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  // A paused team ignores orders.
  const bx = b.x;
  g.command(2, { c: 'move', x: bx + 1, y: b.y });
  run(g, 0.5);
  assert.equal(b.x, bx);
  g.command(1, { c: 'attack', x: b.x, y: b.y });
  run(g, CAST_POINT - 0.1);
  assert.equal(g.flight, null);
  run(g, 0.3);
  assert.ok(g.flight);
  assert.equal(g.holder, null);
  const flightT = dist(a.x, a.y, b.x, b.y) / MISSILE;
  run(g, flightT + 0.1);
  assert.equal(g.holder, 2);
});

test('hotmortar: the fuse kills the holder; in flight, it kills the receiver on landing', () => {
  const g = fresh();
  g.startT = null;
  g.holder = 1;
  g.fuse = 0.05;
  run(g, 0.1);
  assert.equal(g.heroes.get(1).alive, false);
  assert.ok(g.startT > PAUSE - 0.1); // the next round's 4 s pause

  const h = fresh();
  h.startT = null;
  h.holder = null;
  h.launch(h.heroes.get(1).x, h.heroes.get(1).y, 3);
  h.fuse = 0.05;
  run(h, 0.1);
  assert.equal(h.heroes.get(3).alive, true);
  run(h, 3);
  assert.equal(h.heroes.get(3).alive, false);
  assert.equal(h.heroes.get(1).alive, true);
});
