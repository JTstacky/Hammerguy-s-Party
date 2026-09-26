// Sea Combat (#52) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SeaCombat, SHIP, GUN } from '../server/minigames/up/52-sea.js';
import { wc3 } from '../engine/server/sim.js';

function fakeParty(bots = false) {
  const events = [];
  return { events, room: { isBot: () => bots, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev: (e) => events.push(e) };
}
const dt = 1 / 30;

test('sea: 400 HP battleships, speed 270, turn rate 0.1, on a ring of 896 facing the centre', () => {
  const g = new SeaCombat(fakeParty(), [1, 2, 3, 4, 5, 6, 7, 8]);
  g.setup();
  for (const u of g.heroes.values()) {
    assert.equal(u.hp, 400);
    assert.equal(u.skin, 'battleship');
    assert.equal(u.turnRate, 0.1);
    assert.ok(Math.abs(u.speed - wc3(270)) < 1e-9);
    assert.ok(Math.abs(u.r - wc3(48)) < 1e-9);
    assert.ok(Math.abs(Math.hypot(u.x, u.y) - wc3(896)) < 1e-9);
    assert.ok(Math.abs(Math.atan2(-u.y, -u.x) - u.heading) < 1e-9);
  }
  assert.ok(Math.abs(SHIP.armour - 0.769) < 1e-3);
  assert.equal(SeaCombat.duration, 115, '120 s minus the 5 s frozen start');
});

test('sea: splash 100 / 50 / 25 % within 100 / 150 / 250 of the edge, never the firing ship', () => {
  const g = new SeaCombat(fakeParty(), [1, 2, 3, 4, 5]);
  g.setup();
  const r = SHIP.r;
  const place = [0, 0, wc3(150) + r - 0.01, wc3(250) + r - 0.01, wc3(250) + r + 0.05];
  g.pids.forEach((p, i) => {
    const u = g.heroes.get(p);
    [u.x, u.y] = [place[i], i === 0 ? 0 : 3];
    u.hp = 1000;
  });
  g.land({ pid: 1, x: 0, y: 3, dmg: 80 });
  assert.deepEqual(g.pids.map((p) => 1000 - g.heroes.get(p).hp), [0, 80, 40, 20, 0]);
});

test('sea: a shell flies at 900 u/s to where the target was at the release', () => {
  const g = new SeaCombat(fakeParty(), [1, 2]);
  g.setup();
  const [a, b] = [g.heroes.get(1), g.heroes.get(2)];
  [a.x, a.y] = [0, 0];
  a.setFacing(0);
  [b.x, b.y] = [wc3(600), 0];
  b.setFacing(Math.PI / 2);
  g.command(1, { c: 'move', x: b.x, y: b.y }); // right-click the rival
  assert.equal(a.attackOrder.u, b);
  let t = 0;
  while (!g.shells.length && t < 2) {
    g.tick(dt);
    t += dt;
  }
  assert.ok(Math.abs(t - GUN.point) < 0.1, `fired after ${t.toFixed(2)} s`);
  const s = g.shells[0];
  assert.ok(Math.abs(s.x - b.x) < 1e-9 && Math.abs(s.y - b.y) < 1e-9);
  assert.ok(Math.abs(s.flight - Math.hypot(s.x - a.x, s.y - a.y) / wc3(900)) < 1e-9);
  // Sail off after the release: 0.67 s at 270 u/s gets out of the direct hit (the 50 % ring still catches it).
  g.command(2, { c: 'move', x: b.x, y: b.y + 10 });
  const hp = b.hp;
  for (let i = 0; i < 30; i++) g.tick(dt);
  assert.ok(hp - b.hp <= 0.5 * 105 * SHIP.armour + 1e-9, `took ${hp - b.hp}`);
});

test('sea: ships fire every 2 s and sail into range 900 first', () => {
  const party = fakeParty();
  const g = new SeaCombat(party, [1, 2]);
  g.setup();
  const [a, b] = [g.heroes.get(1), g.heroes.get(2)];
  [a.x, a.y] = [-10, 0];
  a.setFacing(0);
  [b.x, b.y] = [10, 0];
  b.hp = 1e9;
  g.command(1, { c: 'move', x: b.x, y: b.y });
  const shots = [];
  for (let t = 0; t < 12; t += dt) {
    g.time += dt;
    g.tick(dt);
    for (const e of party.events.splice(0)) if (e.k === 'cannon') shots.push({ t: g.time, d: Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r });
  }
  assert.ok(shots.length >= 4);
  assert.ok(shots[0].d <= GUN.range + 1e-6, 'within range at the first shot');
  assert.ok(20 - a.r - b.r > GUN.range, 'started out of range');
  for (let i = 1; i < shots.length; i++) assert.ok(Math.abs(shots[i].t - shots[i - 1].t - 2) < 0.05);
});

test('sea: Attack Ground keeps bombarding a spot', () => {
  const g = new SeaCombat(fakeParty(), [1, 2]);
  g.setup();
  const a = g.heroes.get(1);
  [a.x, a.y] = [0, 0];
  g.command(1, { c: 'cast', slot: 0, x: 5, y: 0 });
  let shells = 0;
  for (let t = 0; t < 7; t += dt) {
    const n = g.shells.length;
    g.tick(dt);
    if (g.shells.length > n) shells++;
  }
  assert.ok(shells >= 3, `${shells} shells`);
});

test('sea: no ties, ships sinking together get sequential antes', () => {
  const g = new SeaCombat(fakeParty(), [1, 2, 3]);
  g.setup();
  g.damage(1, 1000);
  g.damage(2, 1000);
  const pts = g.payouts();
  assert.deepEqual([1, 2, 3].map((p) => pts.get(p)), [6, 7, 8]);
});
