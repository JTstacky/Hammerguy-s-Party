// The Kaboom Room (#3) against its rule sheet (docs/uther-party/rules-4.0.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { KaboomRoom, KABOOM } from '../server/minigames/up/03-kaboom.js';
import { wc3 } from '../engine/server/sim.js';

const fakeParty = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const step = (g, secs) => {
  for (let t = 0; t < secs - 1e-9; t += 1 / 30) {
    g.time += 1 / 30;
    g.tick(1 / 30);
  }
};

test('kaboom: sappers have 25 HP, speed 270, collision 32 and start 600 u from the centre', () => {
  const g = new KaboomRoom(fakeParty(), [1, 2, 3]);
  g.setup();
  for (const u of g.heroes.values()) {
    assert.equal(u.maxHp, 25);
    assert.ok(Math.abs(u.speed - wc3(270)) < 1e-9);
    assert.ok(Math.abs(u.r - wc3(32)) < 1e-9);
    assert.ok(Math.abs(Math.hypot(u.x, u.y) - wc3(600)) < 1e-6);
  }
});

test('kaboom: fires fly out at 350 u/s and are sent back to the centre at 800 u', () => {
  const g = new KaboomRoom(fakeParty(), [1]);
  g.setup();
  g.heroes.get(1).hp = 1e9;
  g.heroes.get(1).maxHp = 1e9;
  g.addFire();
  const f = g.fires[0];
  const a0 = f.a;
  g.time = 5;
  for (let i = 0; i < 30; i++) g.tick(1 / 30);
  assert.ok(Math.abs(Math.hypot(f.x, f.y) - wc3(350)) < 0.05, `1 s out: ${Math.hypot(f.x, f.y) * 54} u`);
  // 800 u takes 2.29 s; the reset check runs every 0.05 s.
  for (let i = 0; i < 40; i++) g.tick(1 / 30);
  assert.ok(Math.hypot(f.x, f.y) < wc3(150), 'back near the centre after the reset');
  assert.notEqual(f.a, a0, 'new heading');
});

test('kaboom: one fire every 10 s from t=5 (after a 0-2 s wait), up to 10', () => {
  const g = new KaboomRoom(fakeParty(), [1, 2]);
  g.setup();
  for (const u of g.heroes.values()) {
    u.hp = u.maxHp = 1e9;
    u.x = wc3(650);
  }
  step(g, 5);
  assert.equal(g.fires.length, 0, 'nothing before the room ignites');
  step(g, 12.1);
  assert.ok(g.fires.length >= 1, 'first fire by t=17');
  step(g, 120);
  assert.equal(g.fires.length, 10);
});

test('kaboom: Permanent Immolation burns 10 a second within 220 (plus collision): three ticks kill', () => {
  const g = new KaboomRoom(fakeParty(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  const far = g.heroes.get(2);
  [far.x, far.y] = [-wc3(650), 0];
  [u.x, u.y] = [wc3(200) + u.r, wc3(-400)];
  g.fires.push({ id: 1, x: 0, y: wc3(-400), a: 0, go: 0, immo: 1 });
  g.time = 1; // before the centre lights
  g.tick(1);
  assert.equal(Math.floor(u.hp), 15, 'one 10-damage tick (plus 0.25 regen)');
  g.tick(1);
  g.tick(1);
  assert.equal(u.alive, false);
});

test('kaboom: the lit centre burns 10 HP a second within 128', () => {
  const g = new KaboomRoom(fakeParty(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  const v = g.heroes.get(2);
  [u.x, u.y] = [wc3(100), 0];
  [v.x, v.y] = [-wc3(200), 0];
  g.spawnT = 1e9;
  step(g, 7.1);
  assert.ok(u.hp <= 25 - 10 + 0.6, `in the flame: ${u.hp}`);
  assert.ok(v.hp >= 25, 'outside the flame');
});

test('kaboom: a dying sapper deals 700 within 150 and 300 within 250 (edge), and deaths chain and tie', () => {
  const g = new KaboomRoom(fakeParty(), [1, 2, 3, 4]);
  g.setup();
  const [a, b, c, d] = [1, 2, 3, 4].map((p) => g.heroes.get(p));
  const r = wc3(32);
  [a.x, a.y] = [0, wc3(400)];
  [b.x, b.y] = [wc3(240) + r, wc3(400)]; // 240 from a's centre to b's edge: in the 300 tier
  [c.x, c.y] = [wc3(480) + 2 * r, wc3(400)]; // caught only by b's blast
  [d.x, d.y] = [-wc3(600), 0];
  g.damage(1, 100);
  assert.equal(a.alive, false);
  assert.equal(b.alive, false);
  assert.equal(c.alive, false);
  assert.equal(d.alive, true);
  assert.deepEqual(g.deathGroups(), [[1, 2, 3]], 'chain deaths share one instant');
  assert.equal(g.isDone(), true);
  assert.equal(g.payouts().get(4), 8);
  assert.equal(g.payouts().get(1), 9 - 4);
  assert.deepEqual(KABOOM.BLAST.map(([rr, n]) => [Math.round(rr * 54), n]), [[150, 700], [250, 300]]);
});
