// Fel Orc Fiasco (#51) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FelOrcFiasco, FEL, BURROW } from '../server/minigames/up/51-fel.js';
import { wc3 } from '../engine/server/sim.js';

function fakeParty(bots = false) {
  const events = [];
  return { events, room: { isBot: () => bots, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev: (e) => events.push(e) };
}
const dt = 1 / 30;
function run(g, until, keep) {
  while (g.time < until) {
    g.time += dt;
    g.tick(dt);
    keep?.();
  }
}

test('fel: peons are 50 HP, 1 HP/s, speed 190, collision 16, with 100 lumber', () => {
  const g = new FelOrcFiasco(fakeParty(), [1, 2]);
  g.setup();
  for (const [pid, u] of g.heroes) {
    assert.equal(u.hp, 50);
    assert.equal(u.regen, 1);
    assert.ok(Math.abs(u.speed - wc3(190)) < 1e-9);
    assert.ok(Math.abs(u.r - wc3(16)) < 1e-9);
    assert.equal(g.lumber.get(pid), 100);
  }
});

test('fel: one siege engine a second from t = 5 up to 30, demolishers from the 27th', () => {
  const g = new FelOrcFiasco(fakeParty(), [1, 2]);
  g.setup();
  const safe = () => {
    for (const u of g.heroes.values()) u.hp = 1e9;
  };
  run(g, 4.9, safe);
  assert.equal(g.siege.length, 0);
  run(g, 15.5, safe);
  assert.ok(g.siege.length >= 10 && g.siege.length <= 11, `${g.siege.length} at 15.5 s`);
  run(g, 40, safe);
  assert.equal(g.siege.length, FEL.max);
  assert.equal(g.siege.filter((s) => s.demo).length, 4);
  assert.ok(g.siege.slice(0, 26).every((s) => !s.demo));
});

test('fel: a burrow costs 75 lumber, takes 10 s with the peon inside, and has 200 HP; only one each', () => {
  const g = new FelOrcFiasco(fakeParty(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  [u.x, u.y] = [0, 0];
  g.orderBuild(1, u, 1, 0);
  const b = g.burrowOf(1);
  assert.ok(b && b.building);
  assert.equal(g.lumber.get(1), 25);
  assert.ok(u.hidden, 'the peon works from inside');
  assert.equal(g.abilities[0].available(1), false, 'one burrow per player');
  for (let t = 0; t < 9.9; t += dt) g.stepBurrows(dt);
  assert.ok(b.building && b.hp < 200);
  for (let t = 0; t < 0.2; t += dt) g.stepBurrows(dt);
  assert.ok(b.built);
  assert.ok(Math.abs(b.hp - 200) < 1e-6);
  assert.ok(!u.hidden, 'pops out when it is done');
});

test('fel: garrisoned peons are safe; rocks hit the burrow through its armour and it ejects them when it falls', () => {
  const g = new FelOrcFiasco(fakeParty(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  [u.x, u.y] = [0, 0];
  g.orderBuild(1, u, 0, 0);
  for (let t = 0; t < 10.1; t += dt) g.stepBurrows(dt);
  const b = g.burrowOf(1);
  g.toggleBurrow(1, u);
  assert.ok(u.hidden);
  g.land({ x: 0, y: 0, dmg: 50 }); // a roll of 100 siege, halved for a peon's medium armour
  assert.equal(u.hp, 50, 'the peon inside is untouched');
  assert.ok(Math.abs(200 - b.hp - 100 * BURROW.armour) < 1e-9, 'full siege damage through armour 2');
  g.land({ x: BURROW.half + wc3(100), y: 0, dmg: 50 });
  assert.ok(Math.abs(200 - b.hp - 125 * BURROW.armour) < 1e-9, '25 % within 150 of its edge');
  g.hurtBurrow(b, 1000);
  assert.ok(!b.alive && !u.hidden && u.alive);
});

test('fel: enemy peons chip burrows for 7-8 chaos through armour; repair costs 35 % for full HP over 15 s', () => {
  const g = new FelOrcFiasco(fakeParty(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  [u.x, u.y] = [0, 0];
  g.orderBuild(1, u, 0, 0);
  for (let t = 0; t < 10.1; t += dt) g.stepBurrows(dt);
  const b = g.burrowOf(1);
  assert.deepEqual(g.attackables(2), [b]);
  assert.deepEqual(g.attackables(1), []);
  g.attackHit(2, g.heroes.get(2), b);
  const chip = 200 - b.hp;
  assert.ok(chip >= 7 * BURROW.armour - 1e-9 && chip <= 8 * BURROW.armour + 1e-9, `chip ${chip}`);
  b.hp = 100;
  [u.x, u.y] = [BURROW.half + u.r + 0.2, 0];
  g.startRepair(1, u, b);
  for (let t = 0; t < 7.5; t += dt) g.stepBurrows(dt);
  assert.ok(Math.abs(b.hp - 200) < 1, `repaired to ${b.hp}`);
  assert.ok(Math.abs(g.lumber.get(1) - (25 - 75 * 0.35 * 0.5)) < 0.1, `lumber ${g.lumber.get(1)}`);
});

test('fel: peons dying in the same instant tie; no timer, 300 s cap', () => {
  const g = new FelOrcFiasco(fakeParty(), [1, 2, 3, 4]);
  g.setup();
  g.time = 20;
  g.damage(1, 100);
  g.damage(2, 100);
  const pts = g.payouts();
  assert.deepEqual([1, 2].map((p) => pts.get(p)), [5, 5]);
  assert.equal(FelOrcFiasco.timer, false);
  assert.equal(FelOrcFiasco.duration, 300);
});
