// The Tauren Tragedy (#10) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TaurenTragedy, SHOCK, STOMP, FOOT } from '../server/minigames/up/10-tauren.js';
import { Unit, wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};
const foot = (g, x, y) => {
  const f = new Unit({ kind: 'footman', x, y, r: FOOT.r, speed: FOOT.speed, hp: FOOT.hp });
  f.atkCd = 0;
  f.retarget = 0;
  g.footmen.push(f);
  return f;
};

test('tauren: level 2 chieftain, 800 HP, 240 mana; footmen 15 HP, 12-13 damage, 1.35 s', () => {
  const g = new TaurenTragedy(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.hp, 800);
  assert.equal(u.speed, wc3(270));
  assert.equal(g.mana.get(1), 240);
  assert.equal(FOOT.hp, 15);
  assert.equal(FOOT.cd, 1.35);
  assert.equal(SHOCK.cost, 100);
  assert.equal(SHOCK.cd, 8);
  assert.equal(SHOCK.dmg, 75);
  assert.equal(STOMP.cost, 50);
  assert.equal(STOMP.cd, 6);
  assert.equal(STOMP.dmg, 25);
});

test('tauren: one footman per starting player every 1.5 s from t=7, up to 49 (the barracks counts)', () => {
  const g = new TaurenTragedy(party(), [1, 2, 3]);
  g.setup();
  for (const u of g.heroes.values()) {
    u.hp = 1e9;
    u.stun = 1e9; // nobody fights back
  }
  g.spawnT = 0.75; // the periodic timer's phase is random; pin it mid-period
  run(g, 7);
  assert.equal(g.footmen.length, 0);
  run(g, 1.55);
  assert.equal(g.footmen.length, 3);
  run(g, 1.5);
  assert.equal(g.footmen.length, 6);
  // Cap: the batch spawns while fewer than 50 P12 units live (barracks included).
  g.footmen = [];
  for (let i = 0; i < 48; i++) foot(g, 0, 8);
  g.spawnFootmen();
  assert.equal(g.footmen.length, 51, '48 + barracks = 49 < 50: a whole batch comes');
  g.spawnFootmen();
  assert.equal(g.footmen.length, 51);
});

test('tauren: a chieftain can only attack footmen, and auto-swings only at adjacent ones', () => {
  const g = new TaurenTragedy(party(), [1, 2]);
  g.setup();
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  [a.x, a.y] = [-6, 0];
  [b.x, b.y] = [-4.5, 0];
  g.command(1, { c: 'move', x: b.x, y: b.y });
  assert.equal(a.attackOrder, null, 'rival taurens are not targets');
  a.stop();
  const far = foot(g, -6, 5);
  g.time = 1;
  g.tick(dt);
  assert.equal(a.attackOrder, null, 'acquisition 128 does not reach 5 u');
  const near = foot(g, -6, -1.3);
  near.stun = 10;
  far.stun = 10;
  g.tick(dt);
  assert.equal(a.attackOrder, near);
  run(g, 1);
  assert.equal(near.alive, false, '30-40 damage kills a 15 HP footman');
});

test('tauren: Shockwave costs 100 mana and hits footmen and rivals along 800 u, 125 wide', () => {
  const g = new TaurenTragedy(party(), [1, 2]);
  g.setup();
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  [a.x, a.y] = [-10, 5];
  a.setFacing(0);
  [b.x, b.y] = [-10 + wc3(600), 5];
  const inLine = foot(g, -10 + wc3(300), 5 + wc3(40));
  const offLine = foot(g, -10 + wc3(300), 5 + wc3(120));
  const tooFar = foot(g, -10 + wc3(900), 5);
  for (const f of g.footmen) f.stun = 10;
  g.command(1, { c: 'cast', slot: 0, x: b.x, y: b.y });
  run(g, 1.5);
  assert.equal(g.mana.get(1) < 150, true);
  assert.equal(inLine.alive, false);
  assert.equal(offLine.alive, true);
  assert.equal(tooFar.alive, true);
  assert.ok(Math.abs(b.hp - (800 - 75 + 1.65 * 1.5)) < 5, `rival took 75 (hp ${b.hp.toFixed(1)})`);
  // Not enough mana for another one for a while (0.8/s).
  g.acd.get(1)[0] = 0;
  g.mana.set(1, 99);
  g.command(1, { c: 'cast', slot: 0, x: b.x, y: b.y });
  assert.equal(a.cast, null);
});

test('tauren: War Stomp does 25 within 250 and stuns footmen 3 s, taurens 2 s', () => {
  const g = new TaurenTragedy(party(), [1, 2]);
  g.setup();
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  [a.x, a.y] = [-8, 5];
  [b.x, b.y] = [-8 + wc3(200), 5];
  const f = foot(g, -8, 5 + wc3(200));
  f.hp = 1000;
  g.command(1, { c: 'cast', slot: 1 });
  run(g, 0.4);
  assert.equal(g.mana.get(1) < 200, true);
  assert.equal(1000 - f.hp, 25);
  assert.ok(f.stun > 2.5 && f.stun <= 3);
  assert.ok(b.stun > 1.5 && b.stun <= 2);
  assert.ok(b.hp < 800 - 20);
});

test('tauren: footmen home on the nearest tauren and hit it', () => {
  const g = new TaurenTragedy(party(), [1]);
  g.setup();
  const a = g.heroes.get(1);
  [a.x, a.y] = [8, 0];
  a.attackOrder = null;
  foot(g, 8, 6);
  g.time = 1;
  const hp0 = a.hp;
  // Keep the tauren from fighting back.
  a.stun = 100;
  run(g, 4);
  assert.ok(a.hp < hp0 - 15, `took hits (${(hp0 - a.hp).toFixed(1)})`);
});
