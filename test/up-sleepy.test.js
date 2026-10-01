// Sleepy Time (#29): first to die wins; survivors at 120 s score nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SleepyTime, TAUNT, GOLEM } from '../server/minigames/up/29-sleepy.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs && !g.isDone(); t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};

test('sleepy: giants 1600 HP at 270, ten 675 HP golems with acquisition 100', () => {
  const g = new SleepyTime(party(), [1, 2, 3]);
  g.setup();
  assert.equal(g.heroes.get(1).hp, 1600);
  assert.equal(g.heroes.get(1).speed, wc3(270));
  assert.equal(g.golems.length, 10);
  assert.equal(g.golems[0].hp, 675);
  assert.equal(GOLEM.acquire, wc3(100));
  assert.equal(TAUNT.radius, wc3(450));
  assert.equal(TAUNT.cd, 15);
});

test('sleepy: death order is the finish order; first asleep scores 8, the next 7', () => {
  const g = new SleepyTime(party(), [1, 2, 3]);
  g.setup();
  g.sleep(2);
  g.sleep(3);
  assert.deepEqual(g.finishOrder, [2, 3]);
  const pts = g.payouts();
  assert.equal(pts.get(2), 8);
  assert.equal(pts.get(3), 7);
  assert.equal(pts.get(1), 0, 'still awake');
  assert.equal(g.isDone(), false, 'the last giant can still fall asleep for 6');
});

test('sleepy: at 120 s every giant still standing is killed and scores 0', () => {
  const g = new SleepyTime(party(), [1, 2]);
  g.setup();
  for (const gl of g.golems) [gl.x, gl.y] = [-8, -8];
  g.time = 119.9;
  run(g, 0.3);
  assert.ok(g.isDone());
  assert.equal(g.heroes.get(1).alive, false);
  assert.deepEqual([...g.payouts().values()], [0, 0]);
});

test('sleepy: Taunt pulls golems within 450 onto the caster, even off a rival', () => {
  const g = new SleepyTime(party(), [1, 2]);
  g.setup();
  const [a, b] = [g.heroes.get(1), g.heroes.get(2)];
  [a.x, a.y] = [0, 0];
  const near = g.golems[0];
  const far = g.golems[1];
  [near.x, near.y] = [wc3(400), 0];
  near.atkTarget = b;
  [far.x, far.y] = [wc3(600) + far.r, 0];
  g.taunt(a);
  assert.equal(near.atkTarget, a);
  assert.notEqual(far.atkTarget, a);
});
