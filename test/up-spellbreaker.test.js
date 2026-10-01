// #42 Spell Breaker Blood against its rule sheet (docs/uther-party/rules-4.0.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SpellBreakerBlood, rollSummon, SUMMONS, CM_COST, SB } from '../server/minigames/up/42-spellbreaker.js';
import { wc3 } from '../engine/server/sim.js';

function fakeParty() {
  const events = [];
  return { events, room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev: (e) => events.push(e) };
}

function game(n = 2) {
  const g = new SpellBreakerBlood(fakeParty(), Array.from({ length: n }, (_, i) => i + 1));
  g.setup();
  return g;
}

const run = (g, secs, dt = 1 / 30) => {
  const end = g.time + secs;
  while (g.time < end - 1e-9) {
    g.time += dt;
    g.tick(dt);
  }
};

test('spell breaker: 200 HP, speed 300, 0 of 500 mana at 5 per second, ring of radius 400', () => {
  const g = game(4);
  for (const [pid, u] of g.heroes) {
    assert.equal(u.hp, 200);
    assert.ok(Math.abs(u.speed - wc3(300)) < 1e-9);
    assert.ok(Math.abs(Math.hypot(u.x, u.y) - wc3(400)) < 1e-6);
    assert.equal(g.mana.get(pid), 0);
  }
  for (const u of g.heroes.values()) u.hp = 1e9;
  run(g, 10);
  assert.ok(Math.abs(g.mana.get(1) - 50) < 0.5, `mana after 10 s: ${g.mana.get(1)}`);
  run(g, 100);
  assert.equal(g.mana.get(1), SB.MANA_MAX);
});

test('spell breaker: summons start at t=5+ and stop at 30 living units', () => {
  const g = game(2);
  for (const u of g.heroes.values()) u.hp = 1e9;
  run(g, 4.9);
  assert.equal(g.units.length, 0, 'nothing before spawning is enabled');
  g.spawnAt = g.time; // force a spawn tick
  run(g, 2.2);
  assert.equal(g.units.length, 1);
  // Fill the arena to the cap: 2 breakers + the gate + 27 summons = 30.
  while (g.units.length < 27) g.spawn(2);
  for (const c of g.units) c.speed = 0;
  g.spawnAt = g.time;
  g.pendingSpawns = [];
  run(g, 2.2);
  assert.equal(g.units.filter((c) => c.alive).length, 27, 'no spawn at the cap');
});

test('spell breaker: the DifficultyCurve roll gives Infernals 0.7 % and Doom Guards 0.3 % at DC 7', () => {
  const N = 400000;
  const hist = new Array(8).fill(0);
  for (let i = 0; i < N; i++) hist[rollSummon(7, false)]++;
  assert.ok(Math.abs(hist[6] / N - 0.0074) < 0.0015, `infernal ${hist[6] / N}`);
  assert.ok(Math.abs(hist[7] / N - 0.0034) < 0.001, `doom guard ${hist[7] / N}`);
  for (let i = 0; i < 2000; i++) assert.ok(rollSummon(7, true) <= 5, 'at most one big summon at a time');
  for (let i = 0; i < 2000; i++) assert.equal(rollSummon(1, false), 1, 'the first spawn is always a scarab');
});

test('spell breaker: Control Magic costs 45 % of CURRENT HP; without the mana it fails with no cooldown', () => {
  const g = game(2);
  const u = g.heroes.get(1);
  const c = g.spawn(2); // Skeleton Warrior, 180 HP -> 81 mana
  assert.equal(Math.ceil(CM_COST(c)), 81);
  c.x = u.x + 2;
  c.y = u.y;
  g.mana.set(1, 80);
  g.controlMagic(1, u, c);
  assert.equal(c.owner, null);
  assert.equal(g.acd.get(1)[0], 0, 'refunded');
  c.hp = 100; // wounded: now 45 mana
  g.controlMagic(1, u, c);
  assert.equal(c.owner, 1);
  assert.equal(g.mana.get(1), 35);
  // The Infernal costs more than a full 500 mana until it's hurt below ~1111 HP.
  assert.ok(CM_COST({ hp: SUMMONS[6].hp }) > 500);
  assert.ok(CM_COST({ hp: 1110 }) < 500);
});

test('spell breaker: a dead breaker takes their whole army with them', () => {
  const g = game(3);
  const a = g.spawn(1);
  const b = g.spawn(2);
  a.owner = 2;
  b.owner = 2;
  g.damage(2, 500);
  assert.equal(g.heroes.get(2).alive, false);
  assert.equal(a.alive, false);
  assert.equal(b.alive, false);
});

test('spell breaker: glaives do 13-15 normal (x1.5 vs medium, armour 3) plus Feedback of 20 mana', () => {
  const g = game(2);
  const [a, b] = [g.heroes.get(1), g.heroes.get(2)];
  g.mana.set(2, 100);
  g.attackHit(1, a, b);
  const lost = 200 - b.hp;
  // 13..15 x 1.5 x (1 - 0.18/1.18) = 16.5..19.1, plus 20 burned.
  assert.ok(lost >= 36.4 && lost <= 39.1, `damage ${lost}`);
  assert.equal(g.mana.get(2), 80);
});
