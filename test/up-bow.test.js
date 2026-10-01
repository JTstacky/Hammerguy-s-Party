// Way of the Bow (#6) against docs/uther-party/rules-4.0.md and engine.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WayOfTheBow, ARROW_SPEED, GRID, tileCenter } from '../server/minigames/up/06-bow.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;

function duel() {
  const g = new WayOfTheBow(party(), [1, 2]);
  g.setup();
  g.time = 5; // after the opening pause
  // Arrow tests in the open: no trees in the way.
  g.obs.boxes = [];
  g.nav = null;
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  // An open strip of the glade (row 16 is open from column 1 to 9).
  [a.x, a.y] = tileCenter(2, 16);
  [b.x, b.y] = tileCenter(7, 16);
  b.y -= 0.01;
  a.setFacing(0);
  b.setFacing(Math.PI / 2);
  return { g, a, b };
}

function run(g, secs, each) {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
    each?.(t);
  }
}

test('bow: archers have 5 HP, speed 270, collision 31; the bow is 800 range, 1.5 s, 0.72 s draw', () => {
  const { g, a } = duel();
  assert.equal(a.hp, 5);
  assert.equal(a.speed, wc3(270));
  assert.equal(a.r, wc3(31));
  assert.equal(g.attack.range, wc3(800));
  assert.equal(g.attack.cd, 1.5);
  assert.equal(g.attack.point, 0.72);
  assert.ok(Math.abs(ARROW_SPEED - wc3(1000)) < 1e-9);
  assert.equal(GRID.length, 20);
  assert.ok(GRID.every((r) => r.length === 20));
});

test('bow: an arrow leads a runner who holds course, and hits', () => {
  const { g, a, b } = duel();
  b.order(b.x, b.y - 14); // run south across the line of fire
  run(g, 0.3);
  g.command(1, { c: 'move', x: b.x, y: b.y });
  assert.equal(a.attackOrder, b);
  run(g, 2.5);
  assert.equal(b.alive, false, 'held course: hit');
});

test('bow: reversing after the release dodges; the arrow flies on to the aim point', () => {
  const { g, a, b } = duel();
  b.order(b.x, b.y - 14);
  run(g, 0.3);
  g.command(1, { c: 'move', x: b.x, y: b.y });
  let reversed = false;
  run(g, 2.5, () => {
    if (!reversed && g.arrows.length) {
      reversed = true;
      b.order(b.x, b.y + 14);
    }
  });
  assert.ok(reversed, 'an arrow was loosed');
  assert.equal(b.alive, true, 'changed course after release: missed');
});

test('bow: stopping after the release dodges; stopping before it does not', () => {
  const after = duel();
  after.b.order(after.b.x, after.b.y - 14);
  run(after.g, 0.3);
  after.g.command(1, { c: 'move', x: after.b.x, y: after.b.y });
  let stopped = false;
  run(after.g, 2.5, () => {
    if (!stopped && after.g.arrows.length) {
      stopped = true;
      after.b.stop();
    }
  });
  assert.equal(after.b.alive, true);

  const before = duel();
  before.b.order(before.b.x, before.b.y - 14);
  run(before.g, 0.3);
  before.g.command(1, { c: 'move', x: before.b.x, y: before.b.y });
  run(before.g, 0.3);
  before.b.stop();
  run(before.g, 2.5);
  assert.equal(before.b.alive, false);
});

test('bow: a new order during the draw cancels the shot; a loosed arrow still hits if the archer dies', () => {
  const { g, a, b } = duel();
  g.command(1, { c: 'move', x: b.x, y: b.y });
  run(g, 0.5);
  assert.ok(a.swing, 'drawing');
  g.command(1, { c: 'move', x: a.x - 3, y: a.y });
  assert.equal(a.swing, null);
  run(g, 1.5);
  assert.equal(g.arrows.length, 0);
  assert.equal(b.alive, true);

  const d = duel();
  d.g.command(1, { c: 'move', x: d.b.x, y: d.b.y });
  run(d.g, 0.8);
  assert.equal(d.g.arrows.length, 1);
  d.g.damage(1, 10);
  run(d.g, 1);
  assert.equal(d.b.alive, false, 'the arrow of a dead archer still lands');
});

test('bow: everyone is paused for the first 5 s', () => {
  const g = new WayOfTheBow(party(), [1, 2]);
  g.setup();
  const a = g.heroes.get(1);
  g.command(1, { c: 'move', x: 0, y: 0 });
  assert.equal(a.target, null);
  g.time = 5;
  g.command(1, { c: 'move', x: 0, y: 0 });
  assert.ok(a.target);
});

test('bow: tree walls block; archers path round them', () => {
  const g = new WayOfTheBow(party(), [1, 2]);
  g.setup();
  g.time = 5;
  const a = g.heroes.get(1);
  // Column 10, rows 15-17 are trees: walk from west to east of them.
  [a.x, a.y] = tileCenter(8, 16);
  const [tx, ty] = tileCenter(12, 16);
  g.command(1, { c: 'move', x: tx, y: ty });
  let inside = false;
  run(g, 6, () => {
    if (g.obs.hits(a.x, a.y, 0)) inside = true;
  });
  assert.equal(inside, false);
  assert.ok(Math.hypot(a.x - tx, a.y - ty) < 0.5, `reached the far side (${a.x.toFixed(1)}, ${a.y.toFixed(1)})`);
});

test('bow: no ties; mutual kills in the same instant are scored one by one', () => {
  const g = new WayOfTheBow(party(), [1, 2, 3]);
  g.setup();
  g.damage(3, 10);
  g.time = 20;
  g.damage(1, 10);
  g.damage(2, 10);
  assert.ok(g.isDone());
  const pts = g.payouts();
  assert.deepEqual([pts.get(3), pts.get(1), pts.get(2)], [6, 7, 8]);
});

test('bow: at 120 s all survivors share the current ante', () => {
  const g = new WayOfTheBow(party(), [1, 2, 3, 4]);
  g.setup();
  g.damage(4, 10);
  g.time = 120;
  assert.ok(g.isDone());
  const pts = g.payouts();
  assert.deepEqual([1, 2, 3, 4].map((p) => pts.get(p)), [6, 6, 6, 5]);
});

test('bow: engine.md reversal threshold: reversing 0.45 s into the draw is hit, 0.65 s is missed', () => {
  for (const [at, hit] of [[0.45, true], [0.65, false]]) {
    const { g, a, b } = duel();
    b.order(b.x, b.y - 14);
    run(g, 0.3);
    g.command(1, { c: 'move', x: b.x, y: b.y });
    let since = null;
    let done = false;
    run(g, 3, () => {
      if (g.arrows.length) a.attackOrder = null; // one arrow only
      if (since == null && a.swing) since = 0;
      else if (since != null) since += dt;
      if (!done && since != null && since >= at) {
        done = true;
        b.order(b.x, b.y + 14);
      }
    });
    assert.equal(!b.alive, hit, `reverse at +${at} s`);
  }
});
