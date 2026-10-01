// Covert Kitty (#8) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CovertKitty, ARMOR, GUARD, GUARD_ATTACK, ACQUIRE, CRIPPLE, MANA, MELD_FADE, DAWN } from '../server/minigames/up/08-covert.js';
import { wc3 } from '../engine/server/sim.js';
import { party, run } from './up-b-helpers.js';

test('covert: huntresses (55 HP, armor 2, speed 270) and three doom guards', () => {
  const g = new CovertKitty(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.hp, 55);
  assert.equal(u.speed, wc3(270));
  assert.equal(u.r, wc3(31));
  assert.equal(u.skin, 'huntress');
  assert.ok(Math.abs(ARMOR - 1 / 1.12) < 1e-9, 'armor 2 takes 10.7% off');
  assert.equal(g.guards.length, 3);
  assert.equal(GUARD.hp, 1350);
  assert.equal(GUARD_ATTACK.range, wc3(128));
  assert.equal(ACQUIRE, wc3(600));
  assert.deepEqual([CRIPPLE.cost, CRIPPLE.cd, CRIPPLE.range, CRIPPLE.dur, CRIPPLE.slow], [175, 10, wc3(400), 30, 0.25]);
  assert.equal(MANA, 500);
  assert.equal(DAWN, 100, '06:00 at 20 s per hour from 01:00');
});

test('covert: Shadowmeld hides you from rivals after 1.5 s still; moving breaks it', () => {
  const g = new CovertKitty(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  const ents = (pid) => g.heroEnts(pid).filter((e) => e.o === 1);
  g.meld(u);
  run(g, MELD_FADE - 0.2);
  assert.equal(ents(2).length, 1, 'still fading');
  run(g, 0.3);
  assert.equal(ents(2).length, 0, 'hidden from the other player');
  assert.ok(ents(1)[0].fx.includes('invis'), 'shown to yourself as invisible');
  assert.equal(g.visibleHuntresses().includes(u), false, 'guards cannot see you');
  g.command(1, { c: 'move', x: g.goal.x, y: g.goal.y });
  run(g, 0.1);
  assert.equal(ents(2).length, 1, 'moving breaks it');
});

test('covert: no Shadowmeld after dawn (100 s)', () => {
  const g = new CovertKitty(party(), [1]);
  g.setup();
  g.time = DAWN;
  assert.equal(g.abilities[0].available(1), false);
  g.meld(g.heroes.get(1));
  assert.ok(!g.heroes.get(1).meld);
  assert.ok(g.hud().label.includes('no more hiding'));
});
