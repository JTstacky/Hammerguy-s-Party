// Dark Forest (#12) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DarkForest, ABOM, GARGOYLE } from '../server/minigames/up/12-darkforest.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};
const quiet = (g) => {
  g.spawnT = 1e9;
  g.patrolT = 1e9;
  g.aiT = 1e9;
};

test('darkforest: druids 100 HP at 270, 200 mana; 32 trees; hunters as fast as their prey', () => {
  const g = new DarkForest(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.hp, 100);
  assert.equal(u.speed, wc3(270));
  assert.equal(u.mana, 200);
  assert.equal(u.skin, 'druid');
  assert.equal(g.trees.length, 32);
  assert.equal(ABOM.hp, 1175);
  assert.equal(ABOM.speed, wc3(270));
  assert.equal(GARGOYLE.hp, 410);
  assert.equal(GARGOYLE.speed, wc3(350));
});

test('darkforest: Storm Crow Form costs 50 mana each way and switches speed and skin', () => {
  const g = new DarkForest(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  g.morph(u);
  assert.equal(u.air, true);
  assert.equal(u.skin, 'crow');
  assert.equal(u.speed, wc3(350));
  assert.equal(u.mana, 150);
  g.morph(u);
  assert.equal(u.air, false);
  assert.equal(u.speed, wc3(270));
  assert.equal(u.mana, 100);
  u.mana = 49;
  g.morph(u);
  assert.equal(u.air, false, 'not enough mana');
});

test('darkforest: abominations only hit druids, gargoyles only crows', () => {
  const g = new DarkForest(party(), [1, 2]);
  g.setup();
  g.spawnWave();
  const abom = g.hunters.find((h) => h.kind === 'dfabom');
  const garg = g.hunters.find((h) => h.kind === 'gargoyle');
  assert.ok(abom && garg, 'the first wave always brings a gargoyle');
  const u = g.heroes.get(1);
  assert.equal(g.canHit(abom, u), true);
  assert.equal(g.canHit(garg, u), false);
  g.morph(u);
  assert.equal(g.canHit(abom, u), false);
  assert.equal(g.canHit(garg, u), true);
});

test('darkforest: an abomination cleaves a druid for 33-39', () => {
  const g = new DarkForest(party(), [1, 2]);
  g.setup();
  quiet(g);
  g.spawnWave();
  g.hunters = g.hunters.filter((h) => h.kind === 'dfabom');
  const [a] = g.hunters;
  const u = g.heroes.get(1);
  [u.x, u.y] = [5, 5];
  [a.x, a.y] = [5 + a.r + u.r + wc3(60), 5];
  a.dest = null;
  run(g, 1.2);
  const lost = 100 + 1.2 * 0.5 - u.hp;
  assert.ok(lost >= 32.9 && lost <= 39.2, `damage ${lost}`);
});
