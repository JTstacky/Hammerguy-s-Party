// Troubled Waters (#38) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TroubledWaters, LANES, CRAB, WAVE_X, STEP, TICK, KILL_R, PERIOD } from '../server/minigames/up/38-troubled.js';
import { wc3 } from '../engine/server/sim.js';
import { party, run } from './up-b-helpers.js';

test('troubled: hermit crabs (speed 200, collision 15) in three lanes 128 u apart', () => {
  const g = new TroubledWaters(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.speed, wc3(200));
  assert.equal(u.r, wc3(15));
  assert.equal(CRAB.hp, 15);
  assert.equal(u.skin, 'hermitcrab');
  assert.equal(LANES.length, 3);
  assert.ok(Math.abs(Math.abs(LANES[1] - LANES[0]) - wc3(128)) < 1e-9);
  assert.ok(Math.abs(STEP / TICK - wc3(320)) < 1e-9, 'waves roll at 320 u/s');
  assert.equal(KILL_R, wc3(64));
});

test('troubled: every 2.5 s one or two waves (never one lane twice) spawn at X -1024', () => {
  const g = new TroubledWaters(party(), [1]);
  g.setup();
  g.heroes.get(1).finished = true;
  let rows = 0;
  let doubles = 0;
  for (let i = 0; i < 300; i++) {
    const ids = new Set(g.waves.map((w) => w.id));
    run(g, PERIOD);
    const fresh = g.waves.filter((w) => !ids.has(w.id));
    assert.ok(fresh.length === 1 || fresh.length === 2, `${fresh.length} new waves`);
    assert.equal(new Set(fresh.map((w) => w.lane)).size, fresh.length);
    for (const w of fresh) assert.ok(w.x <= WAVE_X && w.x > WAVE_X - wc3(820));
    rows++;
    if (fresh.length === 2) doubles++;
  }
  // Two independent lane picks differ 2/3 of the time.
  assert.ok(Math.abs(doubles / rows - 2 / 3) < 0.08, `${doubles}/${rows}`);
});

test('troubled: a wave drowns a crab in its lane, not the next lane over', () => {
  const g = new TroubledWaters(party(), [1, 2]);
  g.setup();
  const [a, b] = [g.heroes.get(1), g.heroes.get(2)];
  g.spawnT = 99;
  g.waves.push({ id: 1, x: 0, y: LANES[0], lane: 0 });
  [a.x, a.y] = [-1, LANES[0]];
  [b.x, b.y] = [-1, LANES[1]];
  run(g, 0.5);
  assert.equal(a.alive, false);
  assert.ok(b.alive);
});
