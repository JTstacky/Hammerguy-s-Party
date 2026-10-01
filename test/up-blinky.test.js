// Blinky the Bear (#27) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BlinkyBear, BLINKY, BLINK_RANGE, BEAR, BEAR_ATTACK, PATROLS } from '../server/minigames/up/27-blinky.js';
import { wc3, dist } from '../engine/server/sim.js';
import { party, run } from './up-b-helpers.js';

test('blinky: grizzlies (speed 320, collision 31, 5 HP) against 10 polar bears', () => {
  const g = new BlinkyBear(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.speed, wc3(320));
  assert.equal(u.r, wc3(31));
  assert.equal(BLINKY.hp, 5);
  assert.equal(u.hp, 5);
  assert.equal(u.skin, 'grizzly');
  assert.equal(PATROLS.length, 10);
  assert.equal(g.bears.length, 10);
  assert.equal(BEAR.hp, 475);
  assert.equal(BEAR_ATTACK.range, wc3(128));
  const blink = g.abilities[0];
  assert.equal(blink.name, 'Blink');
  assert.equal(blink.cd, 0.5);
  assert.equal(BLINK_RANGE, wc3(512));
});

test('blinky: Blink clamps to 512 and lands on open ground', () => {
  const g = new BlinkyBear(party(), [1]);
  g.setup();
  const u = g.heroes.get(1);
  const [x0, y0] = [u.x, u.y];
  g.blink(u, x0, y0 - 100);
  assert.ok(dist(x0, y0, u.x, u.y) <= BLINK_RANGE + g.grid.s * 1.5, 'no further than 512 (plus the snap)');
  assert.ok(g.grid.fits(u.x, u.y, u.r), 'not inside a cliff');
});

test('blinky: leaving the arena kills; the finish rect finishes', () => {
  const g = new BlinkyBear(party(), [1, 2]);
  g.setup();
  const [a, b] = [g.heroes.get(1), g.heroes.get(2)];
  [a.x, a.y] = [g.arena.x1 + 2, 0];
  [b.x, b.y] = [g.goal.x, g.goal.y];
  for (const bear of g.bears) bear.speed = 0;
  run(g, 0.1);
  assert.equal(a.alive, false);
  assert.ok(b.finished);
});
