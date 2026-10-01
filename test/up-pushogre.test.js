// Uther Party 4.0 #19 Push the Ogre against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PushTheOgre, GOALS, GAS, KNIGHT, OGRE, GOAL_HALF } from '../server/minigames/up/19-pushogre.js';
import { wc3, dist } from '../engine/server/sim.js';

function game(n = 2) {
  const party = { room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} };
  const g = new PushTheOgre(party, Array.from({ length: n }, (_, i) => i + 1));
  g.setup();
  return g;
}

const step = (g, secs) => {
  for (let t = 0; t < secs - 1e-9; t += 1 / 30) {
    g.time += 1 / 30;
    g.tick(1 / 30);
  }
};

test('push the ogre: eight goals 689 u from the centre; knights (350, r 32, 835 HP) start 200 u inside their own', () => {
  for (const [x, y] of GOALS) assert.ok(Math.abs(Math.hypot(x, y) - wc3(Math.hypot(256, 640))) < 1e-9);
  assert.ok(Math.abs(wc3(Math.hypot(256, 640)) - wc3(689.3)) < 0.01);
  const g = game(8);
  g.pids.forEach((pid, i) => {
    const u = g.heroes.get(pid);
    assert.ok(Math.abs(u.speed - wc3(350)) < 1e-9 && Math.abs(u.r - wc3(32)) < 1e-9 && u.hp === 835);
    assert.ok(Math.abs(dist(u.x, u.y, ...GOALS[i]) - wc3(200)) < 1e-6);
  });
  assert.ok(Math.abs(OGRE.speed - wc3(75)) < 1e-9 && Math.abs(OGRE.r - wc3(48)) < 1e-9);
  assert.equal(PushTheOgre.duration, 90);
});

test('push the ogre: walking into the ogre shoves him; standing next to him does not', () => {
  const g = game(1);
  g.gas.t = 999;
  const o = g.ogre;
  o.rest = 999;
  const u = g.heroes.get(1);
  [u.x, u.y] = [-3, 0];
  step(g, 0.5);
  assert.ok(Math.abs(o.x) < 1e-9, 'idle knight: no push');
  u.order(5, 0);
  step(g, 1.5);
  assert.ok(o.x > 1.5, `pushed east to ${o.x.toFixed(2)}`);
  assert.ok(dist(u.x, u.y, o.x, o.y) >= KNIGHT.r + OGRE.r - 0.05, 'no overlap');
});

test('push the ogre: the goal owner scores when the ogre enters, whoever pushed', () => {
  const g = game(2);
  g.gas.t = 999;
  const [gx, gy] = GOALS[1]; // player 2's goal
  g.ogre.x = gx - GOAL_HALF - 0.3;
  g.ogre.y = gy;
  g.ogre.rest = 999;
  const pusher = g.heroes.get(1);
  [pusher.x, pusher.y] = [g.ogre.x - 1.6, gy];
  pusher.order(gx + 3, gy);
  step(g, 2);
  assert.deepEqual(g.finishOrder, [2]);
});

test('push the ogre: the gas lands 64 u behind him, 192 u across, and kills a knight in 12 ticks (0.6 s)', () => {
  const g = game(2);
  const o = g.ogre;
  o.rest = 999;
  o.f = 0; // facing east: his back is west
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  [a.x, a.y] = [-wc3(64) - wc3(150), 0];
  [b.x, b.y] = [-wc3(64) - wc3(200), 0];
  g.gas.t = 0.001;
  step(g, GAS.telegraph + 0.04);
  assert.equal(g.gas.phase, 'gas');
  assert.ok(Math.abs(g.gas.x + wc3(64)) < 1e-6 && Math.abs(g.gas.y) < 1e-6);
  step(g, 0.5);
  assert.equal(a.alive, true, 'still alive after 10 ticks');
  step(g, 0.12);
  assert.equal(a.alive, false, 'dead after 12 ticks');
  assert.equal(b.alive, true, 'outside 192 u');
  assert.equal(g.goals.find((q) => q.pid === 1).on, false, "a dead knight's goal is removed");
});

test('push the ogre: gas every 8.5-10.5 s (a 6-8 s wait, 1 s telegraph, 1.5 s cloud)', () => {
  const g = game(1);
  g.heroes.get(1).alive = false;
  const starts = [];
  let last = g.gas.phase;
  while (g.time < 120) {
    g.time += 1 / 30;
    g.stepGas(1 / 30);
    if (g.gas.phase === 'warn' && last !== 'warn') starts.push(g.time);
    last = g.gas.phase;
  }
  assert.ok(starts[0] >= 6 - 0.05 && starts[0] <= 8 + 0.05);
  for (let i = 1; i < starts.length; i++) {
    const d = starts[i] - starts[i - 1];
    assert.ok(d >= 8.5 - 0.05 && d <= 10.5 + 0.05, `gap ${d.toFixed(2)}`);
  }
});

test("push the ogre: a finished player's goal doesn't score again", () => {
  const g = game(2);
  g.gas.t = 999;
  g.ogre.rest = 999;
  const [gx, gy] = GOALS[0];
  [g.ogre.x, g.ogre.y] = [gx, gy];
  step(g, 0.05);
  assert.deepEqual(g.finishOrder, [1]);
  [g.ogre.x, g.ogre.y] = [0, 0];
  step(g, 0.05);
  [g.ogre.x, g.ogre.y] = [gx, gy];
  step(g, 0.05);
  assert.deepEqual(g.finishOrder, [1]);
});
