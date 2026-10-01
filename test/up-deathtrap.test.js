// The Death Trap (#48) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DeathTrap, spikeSpots, TROLL, KILL_R, FIRST_TOGGLE, PERIOD } from '../server/minigames/up/48-deathtrap.js';
import { wc3 } from '../engine/server/sim.js';
import { party, run, near } from './up-b-helpers.js';

test('deathtrap: forest trolls (speed 270, collision 7) among 40 spikes', () => {
  const g = new DeathTrap(party(), [1, 2, 3]);
  g.setup();
  assert.equal(spikeSpots().length, 40);
  assert.equal(g.spikes.length, 40);
  const u = g.heroes.get(1);
  assert.equal(u.speed, wc3(270));
  assert.equal(u.r, wc3(7));
  assert.equal(u.skin, 'foresttroll');
  assert.equal(TROLL.hp, 300);
  assert.equal(KILL_R, wc3(64));
  assert.ok(g.spikes.every((s) => s.up), 'all spikes stand at the start');
});

test('deathtrap: first toggle 5 to 7.5 s in, then every 2.5 s, each spike 50/50', () => {
  const g = new DeathTrap(party(), [1]);
  g.setup();
  assert.ok(g.toggleT >= FIRST_TOGGLE && g.toggleT <= FIRST_TOGGLE + PERIOD);
  const first = g.toggleT;
  g.heroes.get(1).finished = true; // keep the troll out of the way
  run(g, first + 0.05);
  assert.equal(g.toggles, 1);
  run(g, PERIOD);
  assert.equal(g.toggles, 2);
  let up = 0;
  let n = 0;
  for (let i = 0; i < 200; i++) {
    run(g, PERIOD);
    up += g.spikes.filter((s) => s.up).length;
    n += g.spikes.length;
  }
  assert.ok(Math.abs(up / n - 0.5) < 0.03, `${((up / n) * 100).toFixed(1)}% up`);
});

test('deathtrap: a standing spike kills within 64; the finish rect finishes', () => {
  const g = new DeathTrap(party(), [1, 2]);
  g.setup();
  const [a, b] = [g.heroes.get(1), g.heroes.get(2)];
  const s = g.spikes[0];
  [a.x, a.y] = [s.x + KILL_R * 0.9, s.y];
  [b.x, b.y] = [g.goal.x, g.goal.y];
  run(g, 0.2);
  assert.equal(a.alive, false);
  assert.ok(b.finished);
  assert.deepEqual(g.finishOrder, [2]);
});

test('deathtrap: a fallen spike is safe', () => {
  const g = new DeathTrap(party(), [1]);
  g.setup();
  const a = g.heroes.get(1);
  for (const s of g.spikes) s.up = false;
  g.toggleT = 99;
  [a.x, a.y] = [g.spikes[3].x, g.spikes[3].y];
  run(g, 0.5);
  assert.ok(a.alive);
  assert.ok(near(a.x, g.spikes[3].x, 1e-3));
});
