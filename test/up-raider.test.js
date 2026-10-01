// Raider Relay (#14) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RaiderRelay, COURSE, T, RAIDER, ZEP, SNARE, BEAR, HIPPO } from '../server/minigames/up/14-raider.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};
const fresh = (n = 2) => {
  const g = new RaiderRelay(party(), Array.from({ length: n }, (_, i) => i + 1));
  g.setup();
  return g;
};
const cellCentre = (g, ch) => {
  for (let r = 0; r < COURSE.length; r++) {
    const c = COURSE[r].indexOf(ch);
    if (c >= 0) return g.grid.center(c, r);
  }
  return null;
};

test('raider: a 10x22-tile course; raiders 25 HP, speed 350; zeppelins 25 HP, speed 270; creatures as the sheet', () => {
  assert.equal(COURSE.length, 22);
  assert.ok(COURSE.every((r) => r.length === 10));
  assert.equal(T, wc3(128));
  const g = fresh();
  const u = g.heroes.get(1);
  assert.equal(u.hp, 25);
  assert.equal(u.speed, wc3(350));
  assert.equal(u.skin, 'raider');
  assert.equal(ZEP.hp, 25);
  assert.equal(ZEP.speed, wc3(270));
  assert.equal(SNARE.range, wc3(500));
  assert.equal(SNARE.dur, 10);
  assert.equal(g.bears.length, 2);
  assert.equal(g.hippos.length, 4);
  assert.equal(BEAR.acq, wc3(400));
  assert.equal(HIPPO.speed, wc3(400));
  assert.equal(RAIDER.r, wc3(32));
});

test('raider: the zeppelin wakes when its raider reaches the pad; boarding turns the raider into it', () => {
  const g = fresh();
  const u = g.heroes.get(1);
  const z = g.zeps.get(1);
  assert.equal(z.state, 'parked');
  const [px, py] = cellCentre(g, 'o');
  [u.x, u.y] = [px, py];
  run(g, dt * 2);
  assert.equal(z.state, 'active');
  assert.equal(g.zeps.get(2).state, 'parked');
  g.command(1, { c: 'cast', slot: 1 });
  run(g, 1);
  assert.equal(g.mode.get(1), 'air');
  assert.equal(u.skin, 'zeppelin');
  assert.equal(u.speed, wc3(270));
});

test('raider: unload on the Island, walk into the Finish: first home scores 8', () => {
  const g = fresh();
  const u = g.heroes.get(1);
  [u.x, u.y] = cellCentre(g, 'o');
  run(g, dt * 2);
  g.board(1);
  g.hippos = [];
  const [ix, iy] = cellCentre(g, 'i');
  [u.x, u.y] = [ix, iy - 0.5];
  g.command(1, { c: 'cast', slot: 2, x: ix, y: iy });
  run(g, 1);
  assert.equal(g.mode.get(1), 'ground');
  assert.equal(u.skin, 'raider');
  const [fx, fy] = cellCentre(g, 'f');
  g.command(1, { c: 'move', x: fx, y: fy });
  run(g, 3);
  assert.deepEqual(g.finishOrder, [1]);
  g.time = 90;
  assert.ok(g.isDone());
  assert.equal(g.payouts().get(1), 8);
});

test('raider: Ensnare is single use and pins a bear for 10 s; one bear hit kills a raider', () => {
  const g = fresh();
  const u = g.heroes.get(1);
  const b = g.bears[0];
  [u.x, u.y] = [b.x, b.y + wc3(450)];
  g.command(1, { c: 'cast', slot: 0, x: b.x, y: b.y });
  run(g, 1);
  assert.ok(g.pinned.has(b));
  assert.equal(g.acharges.get(1)[0], 0);
  g.maul(u);
  assert.equal(u.alive, false);
  // The raider's zeppelin goes with it.
  assert.equal(g.zeps.get(1).alive, false);
});
