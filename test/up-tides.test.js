// Tides of Darkness (#44) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TidesOfDarkness } from '../server/minigames/up/44-tides.js';
import { wc3 } from '../engine/server/sim.js';

const party = (bots = false) => ({ room: { isBot: () => bots, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;

test('tides: frigates with 200 HP and speed 350; one orc destroyer per player', () => {
  const g = new TidesOfDarkness(party(), [1, 2, 3]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.hp, 200);
  assert.equal(u.speed, wc3(350));
  assert.equal(u.skin, 'tides_frigate');
  assert.equal(g.orcs.length, 3);
});

test('tides: splash 100 % within 25, 30 % within 35, 10 % within 50 (to the hull)', () => {
  const g = new TidesOfDarkness(party(), [1, 2]);
  g.setup();
  const [a, b, c, d] = [0, 1, 2, 3].map((i) => {
    const o = g.orcs[i] || g.spawnOrc();
    o.hp = 1000;
    return o;
  });
  const r = a.r;
  [a, b, c, d].forEach((o, i) => {
    [o.x, o.y] = [0, i * 10];
  });
  const hitAt = (o, off) => {
    const before = o.hp;
    g.land({ pid: 1, x: o.x - off, y: o.y, dmg: 60 });
    return before - o.hp;
  };
  assert.equal(hitAt(a, wc3(20) + r), 60);
  assert.equal(hitAt(b, wc3(30) + r), 18);
  assert.equal(Math.round(hitAt(c, wc3(45) + r)), 6);
  assert.equal(hitAt(d, wc3(60) + r), 0);
});

test('tides: the frigate that lands the killing shell finishes', () => {
  const g = new TidesOfDarkness(party(), [1, 2]);
  g.setup();
  const o = g.orcs[0];
  o.hp = 10;
  g.land({ pid: 1, x: o.x, y: o.y, dmg: 30 });
  g.land({ pid: 2, x: o.x, y: o.y, dmg: 30 });
  assert.deepEqual(g.finishOrder, [1]);
});

test('tides: reinforcements stop at 7 destroyers (8 with the shipyard)', () => {
  const g = new TidesOfDarkness(party(), [1, 2]);
  g.setup();
  g.orcAiT = 1e9;
  for (let i = 0; i < 20; i++) {
    g.spawnT = 0;
    g.tick(dt);
  }
  assert.equal(g.orcs.filter((o) => o.alive).length, 7);
});

test('tides: a game of bots ends within the 120 s timer', () => {
  const g = new TidesOfDarkness(party(true), [1, 2, 3, 4]);
  g.setup();
  while (!g.isDone()) {
    g.time += dt;
    g.tick(dt);
  }
  assert.ok(g.time <= 120 + dt);
});
