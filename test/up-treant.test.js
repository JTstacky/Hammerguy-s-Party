// Treant Valley (#15) against its rule sheet (docs/uther-party/rules-4.0.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TreantValley, TREANT_VALLEY as TV } from '../server/minigames/up/15-treant.js';
import { wc3 } from '../engine/server/sim.js';

const fakeParty = (events = []) => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev: (e) => events.push(e) });
const step = (g, secs) => {
  for (let t = 0; t < secs - 1e-9; t += 1 / 30) {
    g.time += 1 / 30;
    g.tick(1 / 30);
  }
};

test('treant valley: 12 trees in a 2-4-4-2 grid; 25 HP gnolls at speed 270 start 100-400 u from the centre', () => {
  const g = new TreantValley(fakeParty(), [1, 2, 3]);
  g.setup();
  assert.equal(g.trees.length, 12);
  const rows = {};
  for (const t of g.trees) rows[Math.round(t.y * 54)] = (rows[Math.round(t.y * 54)] || 0) + 1;
  assert.deepEqual(rows, { 384: 2, 128: 4, '-128': 4, '-384': 2 });
  for (const u of g.heroes.values()) {
    assert.equal(u.maxHp, 25);
    assert.ok(Math.abs(u.speed - wc3(270)) < 1e-9);
    const d = Math.hypot(u.x, u.y) * 54;
    assert.ok(d >= 100 - 1e-6 && d <= 400 + 1e-6);
  }
});

test('treant valley: from t=7 a tree glows for 2 s, then a treant (speed 220) stands on its spot; one per 10 s, at most 12', () => {
  const events = [];
  const g = new TreantValley(fakeParty(events), [1, 2]);
  g.setup();
  for (const u of g.heroes.values()) {
    u.hp = u.maxHp = 1e9;
    u.alive = true;
  }
  step(g, 7);
  assert.ok(!events.some((e) => e.k === 'treeglow'), 'nothing before t=7');
  while (!events.some((e) => e.k === 'treeglow') && g.time < 17.1) step(g, 1 / 30);
  const glow = events.find((e) => e.k === 'treeglow');
  assert.ok(glow, 'first glow within 10 s of t=7');
  const t0 = g.time;
  while (!events.some((e) => e.k === 'treantrise')) step(g, 1 / 30);
  assert.ok(Math.abs(g.time - t0 - 2) < 0.05, 'the treant appears 2 s after its glow');
  const rise = events.find((e) => e.k === 'treantrise');
  assert.equal(rise.x, glow.x);
  assert.equal(rise.y, glow.y);
  assert.ok(Math.abs(g.treants[0].speed - wc3(220)) < 1e-9);
  step(g, 130);
  assert.equal(g.treants.length, 12);
  assert.equal(g.trees.filter((t) => t.alive).length, 0);
});

test('treant valley: treants pick up gnolls within 200 only, and two 15-17 hits kill', () => {
  const g = new TreantValley(fakeParty(), [1, 2]);
  g.setup();
  g.trees.forEach((t) => (t.alive = false));
  g.spawnTreant({ x: 0, y: 0, id: 0 });
  const c = g.treants[0];
  c.setFacing(0);
  const near = g.heroes.get(1);
  const far = g.heroes.get(2);
  [near.x, near.y] = [wc3(150), 0];
  [far.x, far.y] = [-wc3(250), 0];
  g.time = 1; // before the patrol starts
  g.stepTreant(c, 1 / 30);
  assert.equal(c.victim, near);
  const hits = [];
  const orig = g.damage.bind(g);
  g.damage = (pid, n, how) => {
    hits.push(n);
    orig(pid, n, how);
  };
  step(g, 1 / 30);
  for (let i = 0; i < 200 && near.alive; i++) {
    g.stepTreant(c, 1 / 30);
    near.x = c.x + c.r + near.r + wc3(50); // stand in reach
    near.y = c.y;
  }
  assert.equal(near.alive, false);
  assert.equal(hits.length, 2);
  for (const n of hits) assert.ok(n >= 15 && n <= 17);
  assert.equal(TV.TREANT.cd, 1.75);
});
