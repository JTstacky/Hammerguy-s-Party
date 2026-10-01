// Obey Archimonde (#22) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ObeyArchimonde, ORDERS, TRIGGERS_ON } from '../server/minigames/up/22-obey.js';

const party = (bots = false) => ({ room: { isBot: () => bots, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};
const game = (n = 4) => {
  const g = new ObeyArchimonde(party(), Array.from({ length: n }, (_, i) => i + 1));
  g.setup();
  g.botsAct = () => {};
  return g;
};
const cast = (g, pid, slot) => {
  const u = g.heroes.get(pid);
  g.command(pid, { c: 'cast', slot, x: u.x, y: u.y });
};

test('obey: warlocks cannot move and wear the Fel Orc Warlock skin', () => {
  const g = game();
  const u = g.heroes.get(1);
  assert.equal(u.speed, 0);
  assert.equal(u.skin, 'obey_warlock');
  const [x, y] = [u.x, u.y];
  g.command(1, { c: 'move', x: x + 5, y: y + 5 });
  run(g, 1);
  assert.deepEqual([u.x, u.y], [x, y]);
  assert.equal(u.alive, true);
});

test('obey: the window starts at 5.5 s and shrinks by 0.5 s per command to 1.5 s', () => {
  const g = game();
  const windows = [];
  for (let i = 0; i < 12; i++) {
    g.time = 100 + i * 10;
    g.giveCommand();
    windows.push(+(g.deadline - g.time).toFixed(2));
    g.inTrouble.clear();
    g.closeWindow();
  }
  assert.deepEqual(windows, [5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1.5, 1.5, 1.5]);
});

test('obey: the right order saves you; the wrong one, stop or a unit click kills', () => {
  const g = game(5);
  g.time = TRIGGERS_ON + 1;
  g.giveCommand();
  const slot = ORDERS.indexOf(g.order);
  cast(g, 1, slot);
  cast(g, 2, (slot + 1) % 4);
  g.command(3, { c: 'stop' });
  const v = g.heroes.get(5);
  g.command(4, { c: 'move', x: v.x, y: v.y });
  assert.equal(g.heroes.get(2).alive, false);
  assert.equal(g.heroes.get(3).alive, false);
  assert.equal(g.heroes.get(4).alive, false);
  g.time = g.deadline;
  g.closeWindow();
  assert.equal(g.heroes.get(1).alive, true);
  assert.equal(g.heroes.get(5).alive, false); // did nothing in time
});

test('obey: everyone who misses the deadline dies in the same instant (they tie)', () => {
  const g = game(4);
  g.time = TRIGGERS_ON + 1;
  g.giveCommand();
  cast(g, 1, ORDERS.indexOf(g.order));
  g.time = g.deadline;
  g.closeWindow();
  const t = g.elimOrder.map((e) => e.t);
  assert.equal(t.length, 3);
  assert.ok(t.every((x) => x === t[0]));
  const pay = g.payouts();
  assert.equal(pay.get(1), 8);
  assert.deepEqual([2, 3, 4].map((p) => pay.get(p)), [5, 5, 5]);
});

test('obey: commands follow the odds tiers (roar/stomp first, bloodlust from 5, frenzy from 10)', () => {
  const g = game();
  const seen = Array.from({ length: 14 }, () => new Set());
  for (let k = 0; k < 400; k++) {
    g.curve = 0;
    for (let i = 0; i < 14; i++) {
      g.giveCommand();
      seen[i].add(g.order);
    }
  }
  for (let i = 0; i < 4; i++) assert.deepEqual([...seen[i]].sort(), ['roar', 'stomp']);
  assert.ok(seen[4].has('bloodlust') && !seen[4].has('unholyfrenzy'));
  assert.ok(seen[9].has('unholyfrenzy'));
});

test('obey: a game of bots ends with at most one survivor', () => {
  const g = new ObeyArchimonde(party(true), [1, 2, 3, 4, 5, 6, 7, 8]);
  g.setup();
  for (let t = 0; t < 300 && !g.isDone(); t += dt) {
    g.time += dt;
    g.tick(dt);
  }
  assert.ok(g.isDone());
  assert.ok(g.alive.length <= 1);
});
