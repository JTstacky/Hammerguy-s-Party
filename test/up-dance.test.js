// Destruction's Dance (#35) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DestructionsDance, BLINK, BM } from '../server/minigames/up/35-dance.js';
import { dist, wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};

test('dance: blademasters have 250 HP, 240 mana, speed 320; attack 2.03 s, 0.33 s point', () => {
  const g = new DestructionsDance(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.hp, BM.hp);
  assert.equal(g.mana.get(1), 240);
  assert.equal(u.speed, wc3(320));
  assert.equal(g.attack.cd, 2.03);
  assert.equal(g.attack.point, 0.33);
  assert.equal(BLINK.range, wc3(400));
  assert.equal(BLINK.cost, 2);
});

test('dance: a right-click blinks up to 400 u for 2 mana and never walks', () => {
  const g = new DestructionsDance(party(), [1, 2]);
  g.setup();
  g.time = 5;
  const u = g.heroes.get(1);
  [u.x, u.y] = [-8, 0];
  g.command(1, { c: 'move', x: 8, y: 0 });
  assert.ok(Math.abs(u.x - (-8 + wc3(400))) < 1e-6);
  assert.equal(u.target, null, 'no walking afterwards');
  assert.equal(g.mana.get(1), 238);
  g.command(1, { c: 'move', x: u.x + 1, y: 0 });
  assert.ok(Math.abs(u.x - (-8 + wc3(400) + 1)) < 1e-6, 'short blinks land on the point');
  g.mana.set(1, 1.5);
  const x0 = u.x;
  g.command(1, { c: 'move', x: 8, y: 0 });
  assert.equal(u.x, x0, 'no mana, no blink');
});

test('dance: right-clicking a rival blinks you 32 u from it and attacks', () => {
  const g = new DestructionsDance(party(), [1, 2]);
  g.setup();
  g.time = 5;
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  [a.x, a.y] = [-5, 0];
  [b.x, b.y] = [0, 0];
  g.command(1, { c: 'move', x: 0, y: 0 });
  assert.ok(Math.abs(dist(a.x, a.y, b.x, b.y) - (a.r + b.r + wc3(32))) < 1e-6);
  assert.equal(a.attackOrder, b);
  run(g, 0.5);
  assert.ok(b.hp < 250 - 15, 'struck');
});

test('dance: a hit does 26-48 less armour 5.2 (about 20-37); about 9 hits to kill', () => {
  const g = new DestructionsDance(party(), [1, 2]);
  g.setup();
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  let lo = Infinity;
  let hi = 0;
  let sum = 0;
  for (let i = 0; i < 400; i++) {
    b.hp = 1000;
    g.attackHit(1, a, b);
    const d = 1000 - b.hp;
    lo = Math.min(lo, d);
    hi = Math.max(hi, d);
    sum += d;
  }
  assert.ok(lo >= 19.7 && hi <= 36.7, `${lo}-${hi}`);
  const avg = sum / 400;
  assert.ok(Math.round(250 / avg) === 9, `average ${avg.toFixed(1)}`);
});

test('dance: nobody moves for the first 5 s; survivors at 120 s share the ante', () => {
  const g = new DestructionsDance(party(), [1, 2, 3]);
  g.setup();
  const u = g.heroes.get(1);
  const x0 = u.x;
  g.command(1, { c: 'move', x: 0, y: 0 });
  assert.equal(u.x, x0);
  g.damage(3, 1000);
  g.time = 120;
  assert.ok(g.isDone());
  const pts = g.payouts();
  assert.deepEqual([pts.get(1), pts.get(2), pts.get(3)], [7, 7, 6]);
});
