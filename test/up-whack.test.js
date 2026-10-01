// Whack-a-Fiend (#23) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WhackAFiend } from '../server/minigames/up/23-whack.js';
import { wc3 } from '../engine/server/sim.js';

const party = (bots = false) => ({ room: { isBot: () => bots, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};

test('whack: Mountain Kings with 775 HP, 240 mana; N fiends burrowed at 6 s', () => {
  const g = new WhackAFiend(party(), [1, 2, 3]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.hp, 775);
  assert.equal(u.skin, 'whack_mk');
  assert.equal(g.mana.get(1), 240);
  assert.equal(g.attack.range, wc3(100));
  run(g, 5.9);
  assert.equal(g.fiends.length, 0);
  run(g, 0.2);
  assert.equal(g.fiends.length, 3);
});

test('whack: each swap burrows one surfaced fiend and raises up to two', () => {
  const g = new WhackAFiend(party(), [1, 2, 3, 4, 5, 6]);
  g.setup();
  g.time = 6;
  g.tick(dt);
  for (const f of g.fiends) f.state = 'up';
  g.swapT = g.time;
  g.tick(dt);
  assert.equal(g.fiends.filter((f) => f.state === 'down').length, 1);
  for (const f of g.fiends) f.state = 'under';
  g.swapT = g.time;
  g.tick(dt);
  // Two random picks among the burrowed (and rising) fiends: the same one can be picked twice.
  const rising = g.fiends.filter((f) => f.state === 'rise').length;
  assert.ok(rising >= 1 && rising <= 2);
});

test('whack: a kill respawns the fiend burrowed; 10 kills finish', () => {
  const g = new WhackAFiend(party(), [1, 2]);
  g.setup();
  g.time = 6;
  g.tick(dt);
  for (let i = 0; i < 10; i++) {
    const f = g.fiends[0];
    f.state = 'up';
    g.hitFiend(1, f);
    g.fiends = g.fiends.filter((x) => x.alive);
  }
  assert.equal(g.kills.get(1), 10);
  assert.deepEqual(g.finishOrder, [1]);
  assert.equal(g.fiends.length, 2);
  assert.ok(g.fiends.every((f) => f.state === 'under'));
});

test('whack: Thunder Clap kills every surfaced fiend in 250, hurts and slows rivals', () => {
  const g = new WhackAFiend(party(), [1, 2]);
  g.setup();
  g.time = 6;
  g.tick(dt);
  const [u, v] = [g.heroes.get(1), g.heroes.get(2)];
  [u.x, u.y, v.x, v.y] = [0, 0, wc3(200), 0];
  const fs = [g.newFiend(), g.newFiend(), g.newFiend()];
  fs.forEach((f, i) => Object.assign(f, { x: wc3(100) * (i - 1), y: wc3(120), state: i === 2 ? 'under' : 'up' }));
  g.thunderClap(1, u);
  assert.equal(g.kills.get(1), 2);
  assert.equal(fs[2].alive, true); // burrowed fiends are safe
  assert.equal(v.hp, 775 - 60);
  assert.equal(g.slowT.get(2), 3);
  assert.equal(g.mana.get(1), 240 - 90);
});

test('whack: bots finish a game', () => {
  const g = new WhackAFiend(party(true), [1, 2, 3, 4]);
  g.setup();
  for (let t = 0; t < 90 && !g.isDone(); t += dt) {
    g.time += dt;
    g.tick(dt);
  }
  assert.ok(g.finishOrder.length >= 1);
});
