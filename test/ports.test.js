// Checks the minigames ported from Uther Party 4.0 against the rule sheets in
// docs/uther-party/rules-4.0.md and the live measurements in engine.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WispWheel } from '../server/minigames/wisp.js';
import { MortarMayhem } from '../server/minigames/mortar.js';
import { KodoStampede } from '../server/minigames/kodo.js';
import { HammerguysParty } from '../server/party.js';
import { wc3 } from '../engine/server/sim.js';

function fakeParty(bots = false) {
  return { room: { isBot: () => bots, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} };
}

test('wheel of fire: spins up quadratically and first reverses at about 31.6 s', () => {
  const g = new WispWheel(fakeParty(), [1, 2]);
  g.setup();
  const at = (t) => {
    while (g.time < t) {
      g.time += 0.05;
      g.wheelTick();
    }
    return Math.abs(g.speed / 0.05);
  };
  // ω ≈ 0.04 t² °/s: 4 at 10 s, 16 at 20 s.
  assert.ok(Math.abs(at(10) - 4) < 0.3);
  assert.ok(Math.abs(at(20) - 16) < 0.6);
  while (g.armed) at(g.time + 0.05);
  assert.ok(Math.abs(g.time - 31.6) < 0.3, `reversal armed at ${g.time.toFixed(1)} s`);
  // It keeps accelerating for DC + 1 = 1 s, peaking about 42°/s, then brakes at 4°/s².
  let peak = 0;
  while (g.dc === 0) peak = Math.max(peak, at(g.time + 0.05));
  assert.ok(Math.abs(peak - 42) < 1.5, `first peak ${peak.toFixed(1)}°/s`);
});

test('wheel of fire: Purge turns to face, stands still for its 0.5 s cast point, then slows for 2 s', () => {
  const g = new WispWheel(fakeParty(), [1, 2]);
  g.setup();
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  [a.x, a.y] = [-3, 0];
  [b.x, b.y] = [3, 0];
  a.setFacing(Math.PI); // facing away from b
  b.order(3, 8);
  g.command(1, { c: 'cast', x: 3, y: 0 });
  assert.ok(a.cast, 'cast started');
  g.command(1, { c: 'move', x: -3, y: -8 }); // a right-click during the cast waits for it
  let t = 0;
  const dt = 1 / 30;
  while (a.cast && t < 2) {
    const x0 = a.x;
    g.stepHeroes(dt);
    t += dt;
    assert.equal(a.x, x0, 'caster does not walk while turning or casting');
  }
  // 180° at 0.6 rad per step is 6 steps (0.18 s) of turning, then 0.5 s.
  assert.ok(t > 0.6 && t < 0.8, `effect after ${t.toFixed(2)} s`);
  assert.equal(b.speedMult, 0);
  assert.equal(g.charges.get(1), 0, 'Purge is once per game');
  assert.deepEqual(a.target, { x: -3, y: -8 }, 'queued order runs after the cast');
  for (let i = 0; i < 30; i++) g.tick(dt);
  assert.ok(Math.abs(b.speedMult - 0.5) < 0.05, 'half speed back after 1 s');
  for (let i = 0; i < 31; i++) g.tick(dt);
  assert.equal(b.speedMult, 1);
});

test('peon pandemonium: splash tiers are 100/40/25 % of one roll, measured to the victim edge', () => {
  const g = new MortarMayhem(fakeParty(), [1, 2, 3, 4]);
  g.setup();
  const r = wc3(16);
  const place = [0, wc3(50) + r - 0.01, wc3(150) + r - 0.01, wc3(150) + r + 0.05];
  g.pids.forEach((p, i) => {
    const u = g.heroes.get(p);
    [u.x, u.y] = [place[i], 5];
    u.hp = 1000;
  });
  g.land({ x: 0, y: 5, dmg: 50 });
  assert.deepEqual(g.pids.map((p) => 1000 - g.heroes.get(p).hp), [50, 20, 12.5, 0]);
});

test('peon pandemonium: rocks fly at 400 u/s (flight = d/399.7 - 0.365 s from the attack)', () => {
  const g = new MortarMayhem(fakeParty(), [1]);
  g.setup();
  for (const d of [600, 1200, 1800]) {
    g.rocks = [];
    g.launch({ x: 0, y: 0, aim: { x: wc3(d), y: 0 }, demo: false });
    const measured = { 600: 1.136, 1200: 2.637, 1800: 4.138 }[d];
    // Our launch is the release, 0.1 s after the attack event.
    assert.ok(Math.abs(g.rocks[0].flight + 0.1 - measured) < 0.03, `${d} u`);
  }
});

test('stampede: beastmasters arrive on schedule, the first extra one facing east', () => {
  const g = new KodoStampede(fakeParty(), [1, 2]);
  g.setup();
  for (const h of g.heroes.values()) h.hp = 1e9;
  const dt = 1 / 30;
  while (g.time < 45) {
    g.time += dt;
    g.tick(dt);
  }
  // BM #1 at t=7, BM #2 15 s after the first spawn tick (t=7 + 20 - 20... first tick at t=7): t=22-42.
  assert.equal(g.bms.length, 2);
  assert.equal(g.bms[1].dir, 1);
  assert.equal(g.bms[0].dir, -1);
});

test('tie-breaker: tied leaders play another game and it decides the winner', () => {
  const players = [1, 2, 3].map((id) => ({ id, name: `B${id}`, bot: true }));
  const room = { playerList: () => players, isBot: () => true, isConnected: () => true, nameOf: (i) => `B${i}`, colorOf: () => '#fff' };
  const party = new HammerguysParty(room, { games: 1, only: 'kodo' });
  party.points.set(1, 10);
  party.points.set(2, 10);
  party.index = 1;
  party.phase = 'results';
  party.timer = 0.01;
  party.tick(0.02);
  assert.equal(party.tiebreak, 1);
  assert.deepEqual(party.mg.pids, [1, 2]);
  for (let t = 0; t < 400 && !party.over; t += 1 / 30) party.tick(1 / 30);
  assert.ok(party.over);
  const st = party.standings();
  assert.ok([1, 2].includes(st[0].id));
  assert.equal(party.points.get(st[0].id), 10, 'tie-breakers pay no points');
});
