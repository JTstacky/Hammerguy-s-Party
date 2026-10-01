import test from 'node:test';
import assert from 'node:assert/strict';
import { wc3 } from '../engine/server/sim.js';
import { StrikeAndLightGalore, STRIKE } from '../server/minigames/ux/070-strike.js';

const party = () => ({ room: { isBot: () => false, nameOf: String, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('strike: chain lightning pushes 350 units and the ring shrinks for two', () => {
  const g = new StrikeAndLightGalore(party(), [1, 2, 3]);
  g.setup();
  assert.equal(g.abilities[0].range, wc3(900));
  assert.equal(g.abilities[0].cd, 5);
  assert.equal(g.abilities[1].cd, 6);
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  a.x = 0; a.y = 0;
  b.x = 2; b.y = 0;
  g.abilities[0].cast(1, a, { u: b });
  assert.equal(b.x, 2 + STRIKE.push);
  g.eliminate(3);
  g.checkEdges();
  assert.equal(g.dm, true);
  assert.equal(STRIKE.innerX, wc3(480));
  assert.equal(STRIKE.innerY, wc3(448));
});

test('strike: crossing the active kill line eliminates the Seer', () => {
  const g = new StrikeAndLightGalore(party(), [1, 2]);
  g.setup();
  g.heroes.get(1).x = STRIKE.innerX + 0.01;
  g.checkEdges();
  assert.deepEqual(g.alive, [2]);
  assert.equal(g.payouts().get(2), 8);
});
