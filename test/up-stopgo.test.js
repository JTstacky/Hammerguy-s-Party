// Uther Party 4.0 #18 Stop and Go against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { StopAndGo, SEAL, CYCLE, MELD_DELAY, NIGHT } from '../server/minigames/up/18-stopgo.js';
import { wc3 } from '../engine/server/sim.js';

function game(n = 2) {
  const party = { room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} };
  const g = new StopAndGo(party, Array.from({ length: n }, (_, i) => i + 1));
  g.setup();
  return g;
}

const step = (g, secs) => {
  for (let t = 0; t < secs - 1e-9; t += 1 / 30) {
    g.time += 1 / 30;
    g.tick(1 / 30);
  }
};

test('stop and go: seals crawl at 75 u/s with 15 HP and collision 7; ten towers; no timer', () => {
  const g = game(4);
  for (const u of g.heroes.values()) {
    assert.ok(Math.abs(u.speed - wc3(75)) < 1e-9);
    assert.equal(u.hp, 15);
    assert.ok(Math.abs(u.r - wc3(7)) < 1e-9);
  }
  assert.equal(g.towers.length, 10);
  assert.equal(StopAndGo.timer, false);
  assert.deepEqual(SEAL, { speed: wc3(75), r: wc3(7), hp: 15 });
});

test('stop and go: the light starts red and cycles red 5-9 s, green 3-5 s, yellow 1 s', () => {
  const g = game();
  for (const u of g.heroes.values()) u.alive = false;
  assert.equal(g.light, 'red');
  const seen = { red: [], green: [], yellow: [] };
  let cur = g.light;
  let since = 0;
  for (let i = 0; i < 30 * 200; i++) {
    g.time += 1 / 30;
    g.tick(1 / 30);
    since += 1 / 30;
    if (g.light !== cur) {
      seen[cur].push(since);
      assert.equal(g.light, { red: 'green', green: 'yellow', yellow: 'red' }[cur]);
      cur = g.light;
      since = 0;
    }
  }
  for (const k of ['red', 'green', 'yellow']) {
    assert.ok(seen[k].length > 3);
    for (const d of seen[k]) assert.ok(d >= CYCLE[k][0] - 0.05 && d <= CYCLE[k][1] + 0.05, `${k} lasted ${d.toFixed(2)} s`);
  }
});

test('stop and go: on red a seal that moves is shot dead; one standing still (melded) is not', () => {
  const g = game(2);
  g.light = 'red';
  g.lightT = 99;
  const mover = g.heroes.get(1);
  const still = g.heroes.get(2);
  mover.order(mover.x, mover.y - 5);
  step(g, 3);
  assert.equal(mover.alive, false, 'one bolt kills');
  assert.equal(still.alive, true);
  assert.ok(still.meld >= MELD_DELAY);
});

test('stop and go: towers hold fire on green and yellow', () => {
  const g = game(1);
  g.light = 'green';
  g.lightT = 99;
  const u = g.heroes.get(1);
  u.order(u.x, u.y - 20);
  step(g, 3);
  assert.equal(u.alive, true);
  assert.equal(g.bolts.length, 0);
});

test('stop and go: Purge (once, range 700) stops the target for 1 s and slows it over 5 s', () => {
  const g = game(2);
  g.light = 'green';
  g.lightT = 99;
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  [a.x, a.y] = [0, 5];
  [b.x, b.y] = [0, 3];
  b.order(0, -10);
  step(g, 0.2);
  g.command(1, { c: 'cast', slot: 0, x: b.x, y: b.y });
  let t = 0;
  while (a.cast && t < 2) {
    step(g, 1 / 30);
    t += 1 / 30;
  }
  assert.equal(b.speedMult, 0, 'purged');
  const y0 = b.y;
  step(g, 0.9);
  assert.ok(Math.abs(b.y - y0) < 1e-6, 'paused for the first second');
  step(g, 1.6);
  assert.ok(b.speedMult > 0.45 && b.speedMult < 0.55, `half speed at 2.5 s (${b.speedMult.toFixed(2)})`);
  step(g, 2.6);
  assert.equal(b.speedMult, 1);
  assert.equal(g.acharges.get(1)[0], 0, 'only one Purge');
});

test('stop and go: after dawn (about 100 s) standing still no longer hides you', () => {
  const g = game(1);
  const u = g.heroes.get(1);
  g.time = NIGHT + 1;
  g.light = 'red';
  g.lightT = 99;
  step(g, 3);
  assert.equal(u.alive, false);
});

test('stop and go: entering the finish scores 8', () => {
  const g = game(2);
  const u = g.heroes.get(1);
  u.y = g.map.sg.finish - 0.1;
  step(g, 0.05);
  assert.deepEqual(g.finishOrder, [1]);
  g.eliminate(2);
  assert.equal(g.payouts().get(1), 8);
});
