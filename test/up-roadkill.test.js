// Uther Party 4.0 #7 Roadkill Challenge against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Roadkill, LANES, KILL_R, P } from '../server/minigames/up/07-roadkill.js';
import { wc3 } from '../engine/server/sim.js';

function game(n = 2, bots = false) {
  const party = { room: { isBot: () => bots, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} };
  const g = new Roadkill(party, Array.from({ length: n }, (_, i) => i + 1));
  g.setup();
  return g;
}

const step = (g, secs) => {
  for (let t = 0; t < secs; t += 1 / 30) {
    g.time += 1 / 30;
    g.tick(1 / 30);
  }
};

test('roadkill: murlocs are paladin-sized runners (270, collision 31) spawned in the start strip facing north', () => {
  const g = game(8);
  for (const u of g.heroes.values()) {
    assert.ok(Math.abs(u.speed - wc3(270)) < 1e-9);
    assert.ok(Math.abs(u.r - wc3(31)) < 1e-9);
    assert.ok(Math.abs(u.heading + Math.PI / 2) < 1e-9);
    // x -384..384, y -1536..-1408 in WC3.
    assert.ok(u.x >= P(-384, 0)[0] && u.x <= P(384, 0)[0]);
    assert.ok(u.y >= P(0, -1408)[1] - 1e-9 && u.y <= P(0, -1536)[1] + 1e-9);
  }
  assert.equal(Roadkill.duration, 90);
});

test('roadkill: eight siege engines ping-pong on the sheet lanes; a round trip takes 1280 / speed', () => {
  const g = game();
  assert.equal(g.cars.length, 8);
  g.cars.forEach((c, i) => {
    assert.ok(Math.abs(c.speed - wc3(LANES[i][3])) < 1e-9);
    assert.ok(Math.abs(c.hi - c.lo - wc3(640)) < 1e-9);
  });
  const c = g.cars[2]; // 340 u/s
  const x0 = c.x;
  const period = 1280 / 340;
  for (const h of g.heroes.values()) h.alive = false; // keep them out of the way
  step(g, period);
  assert.ok(Math.abs(c.x - x0) < 0.25, `back where it started after ${period.toFixed(2)} s`);
});

test('roadkill: a car kills anything within 128 u of its centre and nothing further', () => {
  const g = game(2);
  for (const c of g.cars) c.speed = 0;
  const car = g.cars[0];
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  [a.x, a.y] = [car.x, car.y + KILL_R - 0.02];
  [b.x, b.y] = [car.x, car.y - KILL_R - 0.05];
  step(g, 0.1);
  assert.equal(a.alive, false);
  assert.equal(b.alive, true);
});

test('roadkill: finishing order pays 8, 7 and the dead get 0', () => {
  const g = game(3);
  for (const c of g.cars) c.speed = 0;
  const [fx, fy] = P(1152, -1408);
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  [a.x, a.y] = [fx, fy];
  step(g, 0.05);
  [b.x, b.y] = [fx, fy];
  step(g, 0.05);
  g.eliminate(3, 'squish');
  assert.ok(g.isDone());
  const pts = g.payouts();
  assert.deepEqual([pts.get(1), pts.get(2), pts.get(3)], [8, 7, 0]);
});

test('roadkill: the dividing wall stops runners cutting across', () => {
  const g = game(1);
  const u = g.heroes.get(1);
  [u.x, u.y] = [P(300, -900)[0], P(300, -900)[1]];
  for (const c of g.cars) c.speed = 0;
  g.cars.forEach((c) => (c.y = 999));
  u.order(P(900, -900)[0], P(900, -900)[1]);
  step(g, 3);
  assert.ok(u.x < P(384, 0)[0], 'still on the left of the wall');
});
