// The Abombinations (#28) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Abombinations, RIFLE, ABOM } from '../server/minigames/up/28-abom.js';
import { Unit, wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};
const abom = (g, x, y, hp = ABOM.hp) => {
  const a = new Unit({ kind: 'abom', x, y, r: ABOM.r, speed: ABOM.speed, hp });
  a.follow = null;
  a.wander = 100;
  g.aboms.push(a);
  return a;
};

test('abom: riflemen 535 HP, speed 270, range 2000; abominations 100 HP at speed 400', () => {
  const g = new Abombinations(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.hp, 535);
  assert.equal(u.speed, wc3(270));
  assert.equal(g.attack.range, wc3(2000));
  assert.equal(g.attack.cd, 1.5);
  assert.equal(ABOM.speed, wc3(400));
  assert.equal(RIFLE.hp, 535);
});

test('abom: an abomination burns out in 20 s (-5 HP/s) and explodes', () => {
  const g = new Abombinations(party(), [1, 2]);
  g.setup();
  g.spawnT = 1e9;
  const a = abom(g, 0, 0);
  run(g, 19.8);
  assert.equal(a.alive, true);
  run(g, 0.4);
  assert.equal(a.alive, false);
});

test('abom: the blast does 700 within 150 u and 300 within 250 u (plus the victim radius)', () => {
  const g = new Abombinations(party(), [1, 2, 3]);
  g.setup();
  const [a, b, c] = [1, 2, 3].map((p) => g.heroes.get(p));
  const r = RIFLE.r;
  [a.x, a.y] = [wc3(150) + r - 0.02, 0];
  [b.x, b.y] = [0, wc3(250) + r - 0.02];
  [c.x, c.y] = [-(wc3(250) + r + 0.05), 0];
  a.hp = b.hp = c.hp = 1000;
  const x = abom(g, 0, 0);
  x.boom = true;
  g.detonate();
  assert.deepEqual([a, b, c].map((u) => 1000 - u.hp), [700, 300, 0]);
});

test('abom: blasts chain, and riflemen killed by one chain tie', () => {
  const g = new Abombinations(party(), [1, 2, 3]);
  g.setup();
  const [a, b, c] = [1, 2, 3].map((p) => g.heroes.get(p));
  [c.x, c.y] = [-10, 0];
  const x1 = abom(g, 0, 0);
  const x2 = abom(g, wc3(200), 0);
  [a.x, a.y] = [0, wc3(60)];
  [b.x, b.y] = [wc3(200), wc3(60)];
  // One shot to the first one: its blast sets off the second.
  x1.hp = 1;
  g.attackHit(3, c, x1);
  assert.equal(x1.alive, false);
  assert.equal(x2.alive, false, 'chain reaction');
  assert.equal(a.alive, false);
  assert.equal(b.alive, false);
  assert.ok(g.isDone());
  const pts = g.payouts();
  assert.equal(pts.get(1), pts.get(2), 'same blast, same place');
  assert.equal(pts.get(3), 8);
});

test('abom: one comes every 10 s while fewer than 10, and each death is replaced 1-3 s later', () => {
  const g = new Abombinations(party(), [1, 2]);
  g.setup();
  for (const u of g.heroes.values()) {
    u.hp = 1e9;
    u.x = -9;
  }
  run(g, 5);
  assert.equal(g.aboms.length, 0, 'nothing before t=5');
  run(g, 10.1);
  // It may already have reached the riflemen and been shot (then its
  // replacement is pending).
  assert.equal(g.aboms.length + g.pending.length >= 1, true, 'the first by t=15');
  for (let i = 0; i < 12; i++) g.spawnAbom();
  assert.equal(g.aboms.length, ABOM.cap);
  const a = g.aboms[0];
  a.boom = true;
  g.detonate();
  g.aboms = g.aboms.filter((x) => x.alive);
  g.spawnT = 1e9;
  run(g, 0.9);
  const n = g.aboms.length;
  run(g, 2.2);
  assert.ok(g.aboms.length > n || g.aboms.length === ABOM.cap, 'replaced');
});

test('abom: players swing at an abomination hugging them (acquisition 100)', () => {
  const g = new Abombinations(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  [u.x, u.y] = [5, 5];
  const a = abom(g, 5 + u.r + ABOM.r + wc3(40), 5);
  a.stun = 100;
  g.tick(dt);
  assert.equal(u.attackOrder, a);
});
