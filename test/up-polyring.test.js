// The Polymorph Ring (#9) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PolymorphRing, HALF, OCT, SORC, SLOW, INVIS, POLY, SAS } from '../server/minigames/up/09-polyring.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};
const fresh = (n = 3) => {
  const g = new PolymorphRing(party(), Array.from({ length: n }, (_, i) => i + 1));
  g.setup();
  return g;
};

test('polyring: sorceresses 5 HP, speed 220, 400 mana that never regenerates, 500 u from the centre', () => {
  const g = fresh();
  for (const u of g.heroes.values()) {
    assert.equal(u.hp, 5);
    assert.equal(u.speed, wc3(220));
    assert.ok(Math.abs(Math.hypot(u.x, u.y) - wc3(500)) < 1e-6);
    assert.equal(u.skin, 'sorceress');
  }
  assert.equal(g.mana.get(1), 400);
  run(g, 3);
  assert.equal(g.mana.get(1), 400);
  assert.equal(HALF, wc3(640));
  assert.equal(OCT, wc3(960));
  assert.deepEqual([SLOW.mana, INVIS.mana, POLY.mana], [100, 300, 200]);
});

test('polyring: Sasquatches spawn from the centre up to 8 and one hit kills', () => {
  const g = fresh();
  run(g, 100);
  assert.ok(g.sas.length <= SAS.cap);
  assert.ok(g.sas.length >= 6);
  assert.equal(SAS.speed, wc3(220));
  assert.equal(SAS.acq, wc3(300));
  const v = g.heroes.get(1);
  g.smash(v);
  assert.equal(v.alive, false);
});

test('polyring: Polymorph turns a Sasquatch into a harmless sheep for 25 s (200 mana)', () => {
  const g = fresh();
  g.nextSpawn = 1e9;
  g.spawnSas();
  const s = g.sas[0];
  const u = g.heroes.get(1);
  s.x = u.x + 2;
  s.y = u.y;
  g.useAbility(1, 2, s.x, s.y);
  run(g, SORC.castPoint + 0.2);
  assert.ok(s.sheep > 24);
  assert.equal(g.mana.get(1), 200);
  // A sheep never bites, even right next to her.
  s.x = u.x + 0.6;
  run(g, 3);
  assert.equal(u.alive, true);
});

test('polyring: Slow lasts 20 s on a Sasquatch and 10 s on a sorceress; invisible sorceresses are not seen', () => {
  const g = fresh();
  g.nextSpawn = 1e9;
  g.spawnSas();
  const s = g.sas[0];
  const [a, b] = [g.heroes.get(1), g.heroes.get(2)];
  g.castSlow(1, a, s);
  g.castSlow(1, a, b);
  assert.equal(g.slowed.get(s), SLOW.dur);
  assert.equal(g.slowed.get(b), SLOW.durHero);
  assert.equal(g.mana.get(1), 200);
  g.mana.set(2, 400);
  g.castInvis(2, b, b);
  assert.ok(g.invis.has(2));
  assert.equal(g.heroEnts(3).some((e) => e.o === 2), false);
  assert.equal(g.heroEnts(2).some((e) => e.o === 2), true);
});
