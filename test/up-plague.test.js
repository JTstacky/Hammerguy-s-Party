// The Plague (#37): patient zero, rising zombies, last acolyte standing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ThePlague, ACOLYTE, ZOMBIE, RISE } from '../server/minigames/up/37-plague.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};

test('plague: acolytes 25 HP at 220; zombies 240 HP at 220, bites of 15-16.5', () => {
  const g = new ThePlague(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.hp, 25);
  assert.equal(u.speed, wc3(220));
  assert.equal(ZOMBIE.hp, 240);
  assert.equal(ZOMBIE.speed, ACOLYTE.speed);
  assert.deepEqual(ZOMBIE.weapon.dmg, [15, 16.5]);
  assert.ok(2 * ZOMBIE.weapon.dmg[0] >= ACOLYTE.hp, 'two bites kill');
  assert.equal(RISE, 4);
});

test('plague: patient zero falls at 6 s and rises as a zombie 4 s later', () => {
  const g = new ThePlague(party(), [1, 2]);
  g.setup();
  for (const u of g.heroes.values()) [u.x, u.y] = [8, 8];
  [g.p0.x, g.p0.y] = [-8, -8];
  run(g, 6.1);
  assert.equal(g.p0.alive, false);
  run(g, RISE);
  assert.equal(g.p0.alive, true);
  assert.equal(g.p0.zombie, true);
  assert.equal(g.p0.hp, 240);
});

test('plague: a dead acolyte is out, and rises as its player\'s zombie', () => {
  const g = new ThePlague(party(), [1, 2, 3]);
  g.setup();
  const u = g.heroes.get(2);
  g.kill(u);
  assert.deepEqual(g.alive, [1, 3]);
  assert.equal(g.isDone(), false);
  run(g, RISE + 0.1);
  assert.equal(u.alive, true);
  assert.equal(u.zombie, true);
  assert.equal(u.skin, 'zombie');
  assert.deepEqual(g.alive, [1, 3], 'a zombie does not count as alive');
  // Zombies hunt acolytes, never each other.
  assert.equal(g.hostile(u, g.heroes.get(1)), true);
  g.kill(g.p0);
  g.rise(g.p0);
  assert.equal(g.hostile(u, g.p0), false);
});

test('plague: last acolyte standing scores 8', () => {
  const g = new ThePlague(party(), [1, 2, 3]);
  g.setup();
  g.time = 1;
  g.kill(g.heroes.get(1));
  g.time = 2;
  g.kill(g.heroes.get(2));
  assert.ok(g.isDone());
  const pts = g.payouts();
  assert.equal(pts.get(3), 8);
  assert.ok(pts.get(2) > pts.get(1));
});
