// The Spike Pit (#20) against its rule sheet (docs/uther-party/rules-4.0.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SpikePit, SPIKES } from '../server/minigames/up/20-spikes.js';
import { wc3, dist } from '../engine/server/sim.js';

const fakeParty = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });

test('spike pit: 176 spikes on the 128 u tile centres of an 18x10 pit, the four corners left out', () => {
  assert.equal(SPIKES.length, 176);
  const xs = new Set(SPIKES.map(([x]) => Math.round(x * 54)));
  const ys = new Set(SPIKES.map(([, y]) => Math.round(y * 54)));
  assert.equal(xs.size, 18);
  assert.equal(ys.size, 10);
  assert.ok(!SPIKES.some(([x, y]) => Math.round(Math.abs(x) * 54) === 1088 && Math.round(Math.abs(y) * 54) === 576));
});

test('spike pit: spikes within 400 of the centre start down; militia start 50-100 u out with collision 15', () => {
  const g = new SpikePit(fakeParty(), [1, 2, 3]);
  g.setup();
  SPIKES.forEach(([x, y], i) => assert.equal(g.up[i], Math.hypot(x, y) > wc3(400)));
  for (const u of g.heroes.values()) {
    const d = Math.hypot(u.x, u.y) * 54;
    assert.ok(d >= 50 - 1e-6 && d <= 100 + 1e-6);
    assert.ok(Math.abs(u.r - wc3(15)) < 1e-9);
  }
});

test('spike pit: the safe point speeds up by 0.2 u per tick every 0.25 s (3.2t u/s) and turns counter-clockwise', () => {
  const g = new SpikePit(fakeParty(), [1, 2]);
  g.setup();
  g.p.x = 0;
  g.p.y = 0;
  // 30 s = 120 ticks: 0.8t u per tick, i.e. 96 u/s.
  let turned = 0;
  for (let i = 0; i < 120; i++) {
    const a = g.p.a;
    const inside = Math.abs(g.p.x) <= wc3(1152) && Math.abs(g.p.y) <= wc3(640);
    g.spikeWork();
    const inside2 = Math.abs(g.p.x) <= wc3(1152) && Math.abs(g.p.y) <= wc3(640);
    if (inside && inside2) {
      const d = g.p.a - a;
      assert.ok(d >= 0 && d <= (5 * Math.PI) / 180 + 1e-9, 'heading drifts 0-5° counter-clockwise');
      turned++;
    }
  }
  assert.ok(Math.abs(g.p.speed - 24) < 1e-9, `speed per tick ${g.p.speed}`);
  assert.ok(Math.abs((g.p.speed / 0.25) - 96) < 1e-6, '96 u/s at 30 s');
  assert.ok(turned > 60);
});

test('spike pit: leaving the pit points the safe point back at the centre', () => {
  const g = new SpikePit(fakeParty(), [1, 2]);
  g.setup();
  g.p = { x: wc3(1200), y: wc3(100), speed: 0, a: 0 };
  g.spikeWork();
  const toCentre = Math.atan2(-wc3(100), -wc3(1200));
  const d = Math.atan2(Math.sin(g.p.a - toCentre), Math.cos(g.p.a - toCentre));
  assert.ok(d >= -1e-9 && d <= (5 * Math.PI) / 180 + 1e-9);
});

test('spike pit: spikes drop within 400 of the point, rise again beyond 512, keep their state between', () => {
  const g = new SpikePit(fakeParty(), [1, 2]);
  g.setup();
  g.p = { x: wc3(600), y: 0, speed: 0, a: 0 };
  const before = [...g.up];
  // The random heading drift does not move the point at speed 0.
  g.spikeWork();
  SPIKES.forEach(([x, y], i) => {
    const d = dist(x, y, g.p.x, g.p.y);
    if (d <= wc3(400)) assert.equal(g.up[i], false);
    else if (d >= wc3(512)) assert.equal(g.up[i], true);
    else assert.equal(g.up[i], before[i]);
  });
});

test('spike pit: a raised spike kills within 128, and players impaled in the same tick tie', () => {
  const g = new SpikePit(fakeParty(), [1, 2, 3]);
  g.setup();
  const [a, b, c] = [1, 2, 3].map((p) => g.heroes.get(p));
  const i = SPIKES.findIndex(([x, y]) => Math.hypot(x, y) > wc3(700));
  const [sx, sy] = SPIKES[i];
  [a.x, a.y] = [sx + wc3(120), sy];
  [b.x, b.y] = [sx, sy - wc3(100)];
  [c.x, c.y] = [0, 0];
  g.p = { x: 0, y: 0, speed: 0, a: 0 };
  g.spikeWork();
  assert.equal(a.alive, false);
  assert.equal(b.alive, false);
  assert.equal(c.alive, true);
  assert.deepEqual(g.deathGroups(), [[1, 2]]);
  const pts = g.payouts();
  assert.equal(pts.get(1), pts.get(2));
  assert.equal(pts.get(3), 8);
});
