// The Sheep Shearers (#39): two blades on a 4096 u loop, reversing every 15-20 s.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SheepShearers, loopPoint, BLADE_SPEED, KILL_R } from '../server/minigames/up/39-sheep.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};

test('sheep: the loop is 4096 u, a lap takes 10.24 s, the blades are half a lap apart', () => {
  assert.deepEqual(loopPoint(0), [-768, 256]);
  assert.deepEqual(loopPoint(1536), [768, 256]);
  assert.deepEqual(loopPoint(4096), loopPoint(0));
  assert.equal(4096 / BLADE_SPEED, 10.24);
  const g = new SheepShearers(party(), [1, 2]);
  g.setup();
  assert.equal(Math.abs(g.blades[0].s - g.blades[1].s), 2048);
  assert.deepEqual(loopPoint(g.blades[0].s), [0, -256], 'blade A starts on the finish');
  assert.equal(g.heroes.get(1).hp, 15);
  assert.equal(g.heroes.get(1).speed, wc3(200));
});

test('sheep: anything within 160 of a blade is shorn', () => {
  const g = new SheepShearers(party(), [1, 2]);
  g.setup();
  g.swapT = 1e9;
  const [a, b] = [g.heroes.get(1), g.heroes.get(2)];
  const [bx, by] = loopPoint(g.blades[1].s + BLADE_SPEED * g.dir * 0.05);
  // a right on the blade's path; b well clear of both blades in its start pen.
  [a.x, a.y] = [wc3(bx), wc3(-by)];
  run(g, 0.06);
  assert.equal(a.alive, false);
  assert.equal(b.alive, true);
  assert.equal(KILL_R, 160);
});

test('sheep: both blades reverse within 15-20 s', () => {
  const g = new SheepShearers(party(), [1, 2]);
  g.setup();
  for (const u of g.heroes.values()) u.alive = false;
  const d0 = g.dir;
  run(g, 14.9);
  assert.equal(g.dir, d0);
  run(g, 5.2);
  assert.equal(g.dir, -d0);
});

test('sheep: reaching the finish is a race finish; first home scores 8', () => {
  const g = new SheepShearers(party(), [1, 2]);
  g.setup();
  g.swapT = 1e9;
  const u = g.heroes.get(2);
  // Move blade A off the finish first.
  g.blades[0].s += 1024;
  g.blades[1].s += 1024;
  [u.x, u.y] = [0, wc3(256)];
  run(g, 0.05);
  assert.deepEqual(g.finishOrder, [2]);
  assert.equal(g.payouts().get(2), 8);
});
