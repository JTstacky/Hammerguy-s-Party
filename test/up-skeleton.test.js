// The Skeleton Sonata (#16) against its rule sheet (docs/uther-party/rules-4.0.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SkeletonSonata, SONATA } from '../server/minigames/up/16-skeleton.js';
import { wc3 } from '../engine/server/sim.js';

const fakeParty = (events = []) => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev: (e) => events.push(e) });
const step = (g, secs) => {
  for (let t = 0; t < secs - 1e-9; t += 1 / 30) {
    g.time += 1 / 30;
    g.tick(1 / 30);
  }
};

test('skeleton sonata: priests have 290 HP, speed 270, collision 16 and 200 of 400 mana (+4/s)', () => {
  const g = new SkeletonSonata(fakeParty(), [1, 2]);
  g.setup();
  for (const u of g.heroes.values()) {
    assert.equal(u.maxHp, 290);
    assert.ok(Math.abs(u.r - wc3(16)) < 1e-9);
    assert.ok(Math.abs(u.speed - wc3(270)) < 1e-9);
  }
  assert.equal(g.mana.get(1), 200);
  g.tick(1);
  assert.equal(g.mana.get(1), 204);
  assert.equal(g.corpses.length, 4, 'four corpses at the start');
});

test('skeleton sonata: from t=6, every 2.5 s a corpse raises 3 skeletons and a new one lies down 0.5 s later', () => {
  const events = [];
  const g = new SkeletonSonata(fakeParty(events), [1, 2]);
  g.setup();
  for (const u of g.heroes.values()) u.hp = u.maxHp = 1e9;
  step(g, 6);
  assert.equal(g.skels.length, 0);
  const raises = [];
  for (let i = 0; i < 30 * 10; i++) {
    const n = events.length;
    step(g, 1 / 30);
    for (const e of events.slice(n)) if (e.k === 'sonataraise') raises.push({ t: g.time, corpses: g.corpses.length });
  }
  assert.ok(raises[0].t <= 6 + 2.5 + 0.05, 'first raise within 2.5 s of t=6');
  for (let i = 1; i < raises.length; i++) assert.ok(Math.abs(raises[i].t - raises[i - 1].t - 2.5) < 0.05);
  assert.equal(raises[0].corpses, 3, 'three corpses while the lightning strikes');
  assert.equal(g.skels.length + 0, raises.length * 3, 'three skeletons each time, no cap');
  assert.ok(g.corpses.length >= 3);
});

test('skeleton sonata: Dispel Magic costs 75 mana, has an 8 s cooldown and destroys every skeleton within 200', () => {
  const g = new SkeletonSonata(fakeParty(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  [u.x, u.y] = [0, 0];
  u.setFacing(0);
  g.heroes.get(2).x = -wc3(300);
  g.spawnSkel(wc3(300), 0);
  g.spawnSkel(wc3(300) + wc3(190), 0);
  g.spawnSkel(wc3(300) - wc3(250), 0);
  g.useAbility(1, 0, wc3(300), 0);
  for (let i = 0; i < 30 && u.cast; i++) g.stepHeroes(1 / 30);
  assert.equal(g.mana.get(1), 125);
  assert.equal(g.skels.filter((s) => s.alive).length, 1, 'the one 250 away survives');
  assert.ok(Math.abs(g.acd.get(1)[0] - 8) < 0.1);
  assert.deepEqual([SONATA.DISPEL.r, SONATA.DISPEL.range].map((r) => Math.round(r * 54)), [200, 500]);
});

test('skeleton sonata: a Dispel ordered out of range walks into range 500 first', () => {
  const g = new SkeletonSonata(fakeParty(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  [u.x, u.y] = [-wc3(350), 0];
  g.command(1, { c: 'cast', slot: 0, x: wc3(350), y: 0 });
  assert.ok(g.walkCast.has(1), 'walking into range');
  let cast = false;
  for (let i = 0; i < 90 && !cast; i++) {
    g.time += 1 / 30;
    g.tick(1 / 30);
    cast = g.mana.get(1) < 150;
  }
  assert.ok(cast, 'cast once in range');
  assert.ok(u.x - -wc3(350) >= wc3(190), 'it had to walk about 200 u');
});

test('skeleton sonata: skeletons chase the nearest priest and hit for 14-15 every 2 s', () => {
  const g = new SkeletonSonata(fakeParty(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  const v = g.heroes.get(2);
  [u.x, u.y] = [wc3(100), 0];
  [v.x, v.y] = [-wc3(350), -wc3(350)];
  g.corpses = [];
  g.spawnT = 1e9;
  g.spawnSkel(wc3(300), 0);
  const hp = [];
  for (let i = 0; i < 30 * 6.5; i++) {
    g.time += 1 / 30;
    g.tick(1 / 30);
    u.x = wc3(100);
    u.y = 0;
    if (hp.length === 0 || hp[hp.length - 1] !== u.hp) hp.push(u.hp);
  }
  const hits = hp.slice(1).map((h, i) => hp[i] - h);
  assert.equal(hits.length, 3, `three hits in about 6 s: ${hits}`);
  for (const n of hits) assert.ok(n >= 14 && n <= 15);
  assert.equal(v.hp, 290);
});
