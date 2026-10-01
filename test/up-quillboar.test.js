// Uther Party 4.0 #33 Quillboar Mile against docs/uther-party/rules-4.0.md
// and the missile (splash) aiming measured in engine.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { QuillboarMile, PIG, HUNTER } from '../server/minigames/up/33-quillboar.js';
import { wc3 } from '../engine/server/sim.js';

function game(n = 1) {
  const party = { room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} };
  const g = new QuillboarMile(party, Array.from({ length: n }, (_, i) => i + 1));
  g.setup();
  return g;
}

const step = (g, secs, each) => {
  for (let t = 0; t < secs - 1e-9; t += 1 / 30) {
    g.time += 1 / 30;
    g.tick(1 / 30);
    each?.();
  }
};

// One hunter west of an open strip of ground, the pig running north past it.
function duel() {
  const g = game(1);
  g.hunters = [g.hunters[0]];
  const h = g.hunters[0];
  [h.x, h.y] = [-6, 0];
  h.cd = 0;
  const u = g.heroes.get(1);
  [u.x, u.y] = [0, 4];
  u.order(0, -30);
  return { g, h, u };
}

test('quillboar mile: pigs (190, 10 HP, r 15) against six fixed hunters, three a side', () => {
  const g = game(4);
  for (const u of g.heroes.values()) {
    assert.ok(Math.abs(u.speed - wc3(190)) < 1e-9 && u.hp === 10 && Math.abs(u.r - wc3(15)) < 1e-9);
  }
  assert.equal(g.hunters.length, 6);
  assert.equal(g.hunters.filter((h) => h.x < 0).length, 3);
  assert.ok(Math.abs(HUNTER.range + HUNTER.r + PIG.r - wc3(446)) < 1e-9, 'reach 446');
  assert.equal(HUNTER.cd, 1.6);
  assert.equal(HUNTER.point, 0.6);
  assert.ok(Math.abs(HUNTER.missile - wc3(400)) < 1e-9);
  assert.equal(QuillboarMile.duration, 60);
});

test('quillboar mile: a pig that holds its course is hit, and one quill kills', () => {
  const { g, u } = duel();
  step(g, 2.5);
  assert.equal(u.alive, false);
});

test('quillboar mile: turning after the throw makes the quill miss', () => {
  const { g, u } = duel();
  let thrown = false;
  step(g, 2.2, () => {
    if (!thrown && g.quills.length) {
      thrown = true;
      u.order(u.x + 6, u.y + 2); // veer away as soon as it is thrown
    }
  });
  assert.ok(thrown);
  assert.equal(u.alive, true);
});

test('quillboar mile: the quill is aimed where the pig will be, not where it is', () => {
  const { g, u } = duel();
  step(g, 1, () => {});
  while (!g.quills.length) step(g, 1 / 30);
  const q = g.quills[0];
  // Heading north at 190 u/s: the aim point is ahead of it (smaller y).
  assert.ok(q.ty < u.y - 0.5, `aimed ${(u.y - q.ty).toFixed(2)} ahead`);
});

test('quillboar mile: the circle at the north end finishes the race', () => {
  const g = game(2);
  const u = g.heroes.get(1);
  [u.x, u.y] = [0, -wc3(896)];
  g.hunters = [];
  step(g, 0.05);
  assert.deepEqual(g.finishOrder, [1]);
});
