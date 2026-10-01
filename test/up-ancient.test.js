// Ancient Punisher (#41): day/night clock, cloaks, and the hunting Ancient.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AncientPunisher, hourAt, FADE, ANCIENT } from '../server/minigames/up/41-ancient.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};

test('ancient: 7:00 at the start, one game hour per second after 4 s', () => {
  assert.equal(hourAt(0), 7);
  assert.equal(hourAt(4), 7);
  assert.equal(hourAt(5), 8);
  assert.equal(hourAt(15), 18);
  assert.equal(ANCIENT.speed, wc3(320));
  const g = new AncientPunisher(party(), [1, 2, 3]);
  g.setup();
  assert.equal(g.heroes.get(1).hp, 30);
  assert.equal(g.heroes.get(1).speed, wc3(320));
});

test('ancient: at 8:00 sacks appear, one cloak fewer than players plus a ledger', () => {
  const g = new AncientPunisher(party(), [1, 2, 3, 4]);
  g.setup();
  for (const u of g.heroes.values()) [u.x, u.y] = [wc3(560), 0];
  run(g, 5.1);
  // (A ranger may already have walked onto one.)
  const all = [...g.items, ...[...g.heroes.values()].map((u) => u.item).filter(Boolean)];
  assert.equal(all.length, 4);
  assert.equal(all.filter((i) => i.type === 'cloak').length, 3);
  assert.equal(all.filter((i) => i.type === 'ledger').length, 1);
});

test('ancient: it uproots at 18:00 and hunts; cloaked, still, in the dark is hidden', () => {
  const g = new AncientPunisher(party(), [1, 2]);
  g.setup();
  run(g, 15.1);
  assert.equal(g.ancient.mode, 'uproot');
  run(g, 1);
  assert.equal(g.ancient.mode, 'hunt');
  const u = g.heroes.get(1);
  u.item = { type: 'cloak' };
  u.stop();
  u.stillT = FADE - 0.1;
  assert.equal(g.hidden(u), false);
  u.stillT = FADE;
  assert.equal(g.hidden(u), true);
  u.item = { type: 'ledger' };
  assert.equal(g.hidden(u), false, 'a ledger hides nobody');
  // A hidden ranger is not sent to rivals.
  u.item = { type: 'cloak' };
  const seen = (pid) => g.snapshot(pid).ents.some((e) => e.id === u.id);
  assert.equal(seen(2), false);
  assert.equal(seen(1), true);
});

test('ancient: it walks home at 4:00, roots, and dawn at 6:00 takes every item', () => {
  const g = new AncientPunisher(party(), [1, 2]);
  g.setup();
  for (const u of g.heroes.values()) [u.x, u.y] = [wc3(500), 0];
  run(g, 5.1);
  g.heroes.get(1).item = g.items.pop();
  g.ancient.mode = 'hunt';
  g.time = 24.9; // 4:00 at t=25
  g.lastHour = hourAt(g.time);
  run(g, 0.2);
  assert.equal(g.ancient.mode === 'return' || g.ancient.mode === 'rooting', true);
  run(g, 2);
  assert.equal(g.items.length, 0);
  assert.equal(g.heroes.get(1).item, null);
});

test('ancient: a smash kills outright; last ranger standing scores 8', () => {
  const g = new AncientPunisher(party(), [1, 2]);
  g.setup();
  g.smash(g.heroes.get(1));
  assert.equal(g.heroes.get(1).alive, false);
  assert.ok(g.isDone());
  assert.equal(g.payouts().get(2), 8);
});
