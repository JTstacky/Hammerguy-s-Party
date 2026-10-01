import test from 'node:test';
import assert from 'node:assert/strict';
import { wc3 } from '../engine/server/sim.js';
import { Fetch, FETCH } from '../server/minigames/ux/074-fetch.js';

const party = () => ({ room: { isBot: () => false, nameOf: String, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('fetch: hound and child speeds, bite, and pass match the sheet', () => {
  const g = new Fetch(party(), [1, 2]);
  g.setup();
  assert.equal(g.heroes.get(1).speed, wc3(350));
  assert.equal(g.attack.dmg, 50);
  assert.equal(g.abilities[0].castPoint, 1);
  assert.equal(g.abilities[0].range, wc3(2000));
  g.becomeChild(1, 3);
  assert.equal(g.heroes.get(1).hp, 15);
  assert.equal(g.heroes.get(1).speed, wc3(190));
});

test('fetch: passing leaves a childless interval of distance / 1400', () => {
  const g = new Fetch(party(), [1, 2]);
  g.setup();
  g.time = 5;
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  a.x = a.y = 0;
  b.x = wc3(700); b.y = 0;
  g.becomeChild(1);
  g.pass(1, a, b);
  assert.equal(g.child, null);
  assert.equal(a.speed, FETCH.houndSpeed);
  assert.ok(Math.abs(g.transfer.at - 5.5) < 1e-9);
  g.time = 5.51;
  g.tick(1 / 30);
  assert.equal(g.child, 2);
  assert.equal(b.hp, 15);
});
