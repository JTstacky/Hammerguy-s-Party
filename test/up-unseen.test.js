// The Unseen (#34) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TheUnseen, MANA, WARD, TRAP, GUARD, N_GUARDS } from '../server/minigames/up/34-unseen.js';
import { wc3, dist } from '../engine/server/sim.js';
import { party, run } from './up-b-helpers.js';

test('unseen: witch doctors (speed 270, 200 mana) and 20 hidden guards', () => {
  const g = new TheUnseen(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.speed, wc3(270));
  assert.equal(u.r, wc3(16));
  assert.equal(u.skin, 'witchdoctor');
  assert.equal(MANA, 200);
  assert.equal(g.mana.get(1), MANA);
  assert.equal(g.guards.length, N_GUARDS);
  assert.equal(GUARD.hp, 240);
  assert.deepEqual([WARD.cost, WARD.life, WARD.sight], [50, 10, wc3(500)]);
  assert.deepEqual([TRAP.cost, TRAP.arm, TRAP.trip, TRAP.blast, TRAP.stun], [100, 5, wc3(250), wc3(400), 6]);
});

test('unseen: guards are hidden until your own ward sees them', () => {
  const g = new TheUnseen(party(), [1, 2]);
  g.setup();
  const guards = (pid) => g.worldEnts(pid).filter((e) => e.k === 'guardian');
  assert.equal(guards(1).length, 0);
  const tgt = g.guards[0];
  g.plantWard(1, { x: tgt.x, y: tgt.y + 0.5 });
  assert.equal(g.mana.get(1), MANA - WARD.cost);
  const seen = guards(1);
  assert.ok(seen.some((e) => e.id === tgt.id));
  assert.ok(seen.every((e) => dist(e.x, e.y, tgt.x, tgt.y + 0.5) <= WARD.sight + GUARD.r + 0.02));
  assert.equal(guards(2).length, 0, 'not shown to other players');
  g.heroes.get(1).finished = true;
  g.heroes.get(2).finished = true;
  run(g, WARD.life + 0.1);
  assert.equal(g.wards.length, 0, 'wards last 10 s');
});

test('unseen: a stasis trap arms after 5 s and stuns guards within 400 for 6 s', () => {
  const g = new TheUnseen(party(), [1]);
  g.setup();
  g.heroes.get(1).finished = true;
  // Two guards: one 200 from the trap, one 450 away (outside the blast).
  const [tgt, far] = g.guards;
  g.guards = [tgt, far];
  const at = { x: tgt.x + wc3(200), y: tgt.y };
  [far.x, far.y] = [at.x + wc3(450), at.y];
  g.plantTrap(1, at);
  assert.equal(g.mana.get(1), MANA - TRAP.cost);
  run(g, TRAP.arm - 0.1);
  assert.equal(g.traps.length, 1);
  assert.ok(!(tgt.stun > 0));
  run(g, 0.2);
  assert.equal(g.traps.length, 0, 'went off');
  assert.ok(tgt.stun > TRAP.stun - 0.2);
  assert.ok(!(far.stun > 0), 'outside 400 not stunned');
});

test('unseen: 200 mana buys a trap and two wards, not more', () => {
  const g = new TheUnseen(party(), [1]);
  g.setup();
  g.plantTrap(1, { x: 0, y: 0 });
  g.plantWard(1, { x: 0, y: 0 });
  g.plantWard(1, { x: 0, y: 0 });
  g.plantWard(1, { x: 0, y: 0 });
  assert.equal(g.mana.get(1), 0);
  assert.equal(g.wards.length, 2);
  assert.equal(g.abilities[0].available(1), false);
});
