// Crab Island (#26) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CrabIsland, CRABS } from '../server/minigames/up/26-crab.js';
import { wc3 } from '../engine/server/sim.js';

const party = (bots = false) => ({ room: { isBot: () => bots, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;

test('crab: banshees (285 HP, 400 mana, speed 270) wear the Banshee skin; one critter crab', () => {
  const g = new CrabIsland(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.hp, 285);
  assert.equal(u.speed, wc3(270));
  assert.equal(u.skin, 'crab_banshee');
  assert.equal(g.mana.get(1), 400);
  assert.equal(g.crabs.length, 1);
  assert.equal(g.crabs[0].type, 'critter');
  assert.equal(CRABS.behemoth.hp, 850);
});

test('crab: Possession costs 250 mana and takes the crab over with its current HP', () => {
  const g = new CrabIsland(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  const c = g.newCrab('limb', u.x + wc3(150), u.y);
  c.hp = 300;
  g.possess(1, u, c);
  assert.equal(c.alive, false);
  assert.equal(u.form, 'limb');
  assert.equal(u.skin, 'crab_limb');
  assert.equal(u.hp, 300);
  assert.equal(u.maxHp, 400);
  assert.equal(u.speed, CRABS.limb.speed);
  assert.equal(g.mana.get(1), 150);
  // Only one possession: not enough mana and already a crab.
  const d = g.newCrab('shore', u.x, u.y + 1);
  g.possess(1, u, d);
  assert.equal(d.alive, true);
});

test('crab: Anti-magic Shell (50 mana, 20 s) protects a crab from Possession', () => {
  const g = new CrabIsland(party(), [1, 2]);
  g.setup();
  const [u, v] = [g.heroes.get(1), g.heroes.get(2)];
  const c = g.newCrab('behemoth', 0, wc3(300));
  g.shell(2, c);
  assert.equal(g.mana.get(2), 350);
  assert.equal(c.shieldT, 20);
  g.possess(1, u, c);
  assert.equal(c.alive, true);
  assert.equal(u.form, null);
  assert.equal(g.mana.get(1), 400);
  void v;
});

test('crab: spawns stop at 30 hostile crabs', () => {
  const g = new CrabIsland(party(), [1, 2]);
  g.setup();
  for (let i = 0; i < 40; i++) g.spawnCrab();
  assert.equal(g.hostiles.length, 30);
  assert.ok(g.hostiles.every((c) => ['shore', 'limb', 'behemoth'].includes(c.type)));
});

test('crab: a game of bots ends', () => {
  const g = new CrabIsland(party(true), [1, 2, 3, 4]);
  g.setup();
  for (let t = 0; t < 900 && !g.isDone(); t += dt) {
    g.time += dt;
    g.tick(dt);
  }
  assert.ok(g.isDone());
});
