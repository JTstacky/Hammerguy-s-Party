import test from 'node:test';
import assert from 'node:assert/strict';
import { GreatNavalEnmity, SHIP, FIRE, BIG } from '../server/minigames/ux/078-naval.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: String, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('naval: ship and shell numbers match the rule sheet', () => {
  const g = new GreatNavalEnmity(party(), [1, 2]);
  g.setup();
  assert.equal(SHIP.hp, 700);
  assert.equal(SHIP.speed, wc3(300));
  assert.equal(FIRE.speed, wc3(400));
  assert.equal(BIG.castPoint, 4);
  assert.equal(BIG.cd, 20);
  assert.equal(g.heroes.get(1).skin, 'uxwarship');
});

test('naval: Fire has three damage rings and the Big One can one-shot', () => {
  const g = new GreatNavalEnmity(party(), [1, 2, 3]);
  g.setup();
  [g.heroes.get(1).x, g.heroes.get(1).y] = [0, 0];
  [g.heroes.get(2).x, g.heroes.get(2).y] = [wc3(150), 0];
  [g.heroes.get(3).x, g.heroes.get(3).y] = [wc3(250), 0];
  g.impact({ tx: 0, ty: 0, big: false });
  assert.equal(g.heroes.get(1).hp, 400);
  assert.equal(g.heroes.get(2).hp, 550);
  assert.equal(g.heroes.get(3).hp, 655);
  g.impact({ tx: 0, ty: 0, big: true });
  assert.equal(g.heroes.get(1).alive, false);
  assert.equal(g.shells.length, 6);
});

test('naval: simultaneous sinks are scored sequentially', () => {
  const g = new GreatNavalEnmity(party(), [1, 2, 3]);
  g.setup();
  g.time = 10;
  g.eliminate(1);
  g.eliminate(2);
  assert.deepEqual(g.deathGroups(), [[1], [2]]);
});
