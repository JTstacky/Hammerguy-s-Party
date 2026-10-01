// The Masquerade (#25) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Masquerade, MAX_HP, START_HP, VILL } from '../server/minigames/up/25-masquerade.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs, each) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
    each?.();
  }
};

test('masquerade: Dreadlords start at 135 of 600 HP; villagers are 60 HP at speed 190', () => {
  const g = new Masquerade(party(), [1, 2, 3]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.hp, START_HP);
  assert.equal(u.maxHp, MAX_HP);
  assert.equal(u.speed, wc3(270));
  assert.equal(VILL.hp, 60);
  assert.equal(VILL.speed, wc3(190));
});

test('masquerade: the clock starts at 19:00 at t=4; night 1 is 22 s, days 12 s, later nights 24 s', () => {
  const g = new Masquerade(party(), [1, 2, 3]);
  g.setup();
  for (const u of g.heroes.values()) u.hp = 1e9;
  const flips = [];
  let day = g.isDay;
  run(g, 100, () => {
    if (g.isDay !== day) {
      day = g.isDay;
      flips.push(+g.time.toFixed(1));
    }
  });
  const want = [26, 38, 62, 74, 98];
  flips.forEach((t, i) => assert.ok(Math.abs(t - want[i]) < 0.15, `flip ${i} at ${t}, expected ${want[i]}`));
  assert.equal(flips.length, 5);
});

test('masquerade: N villagers at t=4, then each dusk the town is topped up to (vampires alive - 1)', () => {
  const g = new Masquerade(party(), [1, 2, 3, 4]);
  g.setup();
  // Everyone hides in their den, so nobody feeds in this test.
  for (const u of g.heroes.values()) {
    u.hp = 1e9;
    g.enterDen(u);
  }
  run(g, 4.1);
  assert.equal(g.villagers.length, 4);
  // Two are eaten, one vampire starves; at dusk alive = 3, so 2 are wanted and 2 are left.
  g.villagers[0].alive = false;
  g.villagers[1].alive = false;
  g.eliminate(4);
  run(g, 38 - g.time + 0.1);
  assert.equal(g.villagers.filter((v) => v.alive).length, 2);
  g.villagers[0].alive = false;
  g.villagers[1].alive = false;
  run(g, 36.2);
  assert.equal(g.villagers.filter((v) => v.alive).length, 2);
});

test('masquerade: sunlight drains 40 HP/s in the den and 140 HP/s outside', () => {
  const g = new Masquerade(party(), [1, 2]);
  g.setup();
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  g.enterDen(a);
  a.hp = b.hp = MAX_HP;
  g.started = true;
  g.hour = 6;
  g.time = 30;
  run(g, 2);
  assert.ok(Math.abs(MAX_HP - a.hp - 80) < 5, `den: ${MAX_HP - a.hp}`);
  assert.ok(Math.abs(MAX_HP - b.hp - 280) < 10, `open: ${MAX_HP - b.hp}`);
});

test('masquerade: only the killing blow feeds (to full), with 15 % life steal on every hit', () => {
  const g = new Masquerade(party(), [1, 2]);
  g.setup();
  g.spawnVillagers(1);
  const v = g.villagers[0];
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  a.hp = b.hp = 100;
  v.hp = 60;
  g.attackHit(1, a, v);
  assert.ok(a.hp > 100 && a.hp < 106, 'life steal');
  v.hp = 1;
  g.attackHit(2, b, v);
  assert.equal(v.alive, false);
  assert.equal(b.hp, MAX_HP, 'the killer is healed to 100 %');
  assert.ok(a.hp < 110);
});

test('masquerade: vampires cannot see or attack each other', () => {
  const g = new Masquerade(party(), [1, 2]);
  g.setup();
  const snap = g.snapshot(1);
  const heroes = snap.ents.filter((e) => e.k === 'paladin');
  assert.equal(heroes.length, 1);
  assert.equal(heroes[0].o, 1);
  assert.ok(g.attackables(1).every((v) => v.kind === 'villager'));
});

test('masquerade: right-click your den to hide in it, right-click away to come out', () => {
  const g = new Masquerade(party(), [1, 2]);
  g.setup();
  const a = g.heroes.get(1);
  const d = g.dens.get(1);
  g.command(1, { c: 'move', x: d.x, y: d.y });
  run(g, 3);
  assert.equal(a.inDen, true);
  assert.equal(g.snapshot(1).ents.filter((e) => e.k === 'paladin').length, 0, 'hidden while in the den');
  g.command(1, { c: 'move', x: 0, y: 0 });
  assert.equal(a.inDen, false);
  assert.ok(a.target);
});

test('masquerade: a vampire that dies takes its den with it; no ties', () => {
  const g = new Masquerade(party(), [1, 2, 3]);
  g.setup();
  g.started = true;
  g.hour = 6;
  for (const u of g.heroes.values()) u.hp = 1;
  g.heroes.get(3).hp = 1000;
  run(g, 0.1);
  assert.equal(g.dens.get(1).alive, false);
  const pts = g.payouts();
  assert.notEqual(pts.get(1), pts.get(2), 'simultaneous deaths are scored one by one');
});
