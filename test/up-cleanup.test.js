// The Clean-up Crew (#5) against its rule sheet (docs/uther-party/rules-4.0.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CleanupCrew, CLEANUP } from '../server/minigames/up/05-cleanup.js';
import { wc3, dist } from '../engine/server/sim.js';

const fakeParty = (events = []) => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev: (e) => events.push(e) });
const step = (g, secs) => {
  for (let t = 0; t < secs - 1e-9; t += 1 / 30) {
    g.time += 1 / 30;
    g.tick(1 / 30);
  }
};

test('clean-up: the blight starts as three radius-512 discs centred in the middle 256x256', () => {
  const g = new CleanupCrew(fakeParty(), [1, 2]);
  g.setup();
  assert.equal(g.blight.length, 3);
  for (const [add, x, y, r] of g.blight) {
    assert.equal(add, 1);
    assert.ok(Math.abs(x) <= wc3(128) && Math.abs(y) <= wc3(128));
    assert.ok(Math.abs(r - wc3(512)) < 1e-9);
  }
  for (const u of g.heroes.values()) {
    assert.ok(Math.hypot(u.x, u.y) <= wc3(256) + 1e-9);
    assert.ok(g.isBlight(u.x, u.y), 'ghouls start on the blight');
  }
});

test('clean-up: a ghoul holds 50 HP on the blight and dies 2.5 s after stepping off it', () => {
  const g = new CleanupCrew(fakeParty(), [1, 2]);
  g.setup();
  g.dispelT = 1e9;
  const on = g.heroes.get(1);
  const off = g.heroes.get(2);
  [on.x, on.y] = [0, 0];
  [off.x, off.y] = [wc3(800), wc3(800)];
  assert.equal(g.isBlight(off.x, off.y), false);
  step(g, 2.4);
  assert.ok(off.alive, 'still alive at 2.4 s');
  assert.ok(on.hp >= CLEANUP.HP - 1.01, `on blight: ${on.hp}`);
  step(g, 0.15);
  assert.equal(off.alive, false, 'dead at 2.5 s');
  assert.ok(on.alive);
});

test('clean-up: a dead ghoul leaves a radius-192 disc of blight, which is safe again', () => {
  const g = new CleanupCrew(fakeParty(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  [u.x, u.y] = [wc3(750), -wc3(750)];
  g.eliminate(1, 'death');
  assert.equal(g.isBlight(wc3(750) + wc3(180), -wc3(750)), true);
  assert.equal(g.isBlight(wc3(750) - wc3(200), -wc3(750)), false);
});

test('clean-up: a priest walks into range 500, and 0.5 s into his cast clears the blight within 200 of where the ghoul stood', () => {
  const events = [];
  const g = new CleanupCrew(fakeParty(events), [1, 2]);
  g.setup();
  g.blight = [[1, 0, 0, wc3(900)]];
  g.dispelT = 1e9;
  const v = g.heroes.get(1);
  [v.x, v.y] = [0, 0];
  const p = g.priests[0];
  [p.x, p.y] = [wc3(700), wc3(700)];
  p.job = { v, cast: -1 };
  let castAt = null;
  let castStart = null;
  for (let i = 0; i < 300 && !castAt; i++) {
    g.time += 1 / 30;
    g.tick(1 / 30);
    if (p.job?.cast >= 0 && castStart == null) {
      castStart = g.time;
      assert.ok(dist(p.x, p.y, v.x, v.y) <= wc3(500) + 1e-6, 'cast from within range 500');
      v.x = wc3(300); // moving off after the cast starts dodges it
    }
    if (events.some((e) => e.k === 'cleandispel')) castAt = g.time;
  }
  assert.ok(castAt, 'the dispel landed');
  assert.ok(Math.abs(castAt - castStart - 0.5) < 0.05, `cast point ${castAt - castStart}`);
  // Measured from where the ghoul stood when the cast began (a collision
  // nudge can move it a little off 0,0 first).
  const hit = events.find((e) => e.k === 'cleandispel');
  assert.equal(g.isBlight(hit.x, hit.y), false, 'cleared where the ghoul was');
  assert.equal(g.isBlight(hit.x + wc3(210), hit.y), true, 'kept beyond 200');
  assert.equal(g.isBlight(v.x, v.y), true, 'the ghoul that moved away is still on blight');
});

test('clean-up: the first dispel is ordered 5-15 s in, then every 10 s', () => {
  const g = new CleanupCrew(fakeParty(), [1, 2]);
  g.setup();
  assert.ok(g.dispelT >= 5 && g.dispelT <= 15);
  g.isBlight = () => true; // keep everyone alive
  const orders = [];
  const orig = g.onDispelOrdered.bind(g);
  g.onDispelOrdered = (v) => {
    orders.push(g.time);
    orig(v);
  };
  step(g, 40);
  assert.ok(orders.length >= 3);
  for (let i = 1; i < orders.length; i++) assert.ok(Math.abs(orders[i] - orders[i - 1] - 10) < 0.05);
});
