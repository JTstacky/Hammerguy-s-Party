// The Skull of Gul'dan (#31) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SkullOfGuldan, SPOTS } from '../server/minigames/up/31-skull.js';

const party = (bots = false) => ({ room: { isBot: () => bots, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const step = (g) => {
  g.time += dt;
  g.tick(dt);
};

test('skull: Demon Hunters (675 HP, 300 mana); creep HP scales by 1 + 0.2 N', () => {
  const g = new SkullOfGuldan(party(), [1, 2, 3, 4, 5]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.hp, 675);
  assert.equal(u.mana, 300);
  assert.equal(u.skin, 'skull_dh');
  assert.equal(g.scale, 2);
  const c = g.spawnCreep('pitlord', 0, 0);
  assert.equal(c.hp, 1450 * 2);
});

test('skull: the gate opens only when both switches have been stood on', () => {
  const g = new SkullOfGuldan(party(), [1, 2]);
  g.setup();
  g.aiT = 1e9;
  const [a, b] = [g.heroes.get(1), g.heroes.get(2)];
  [a.x, a.y] = [SPOTS.buttonL.x, SPOTS.buttonL.y];
  step(g);
  assert.equal(g.pressed.L, true);
  assert.equal(g.gateOpen, false);
  assert.equal(g.boss, null);
  [b.x, b.y] = [SPOTS.buttonR.x, SPOTS.buttonR.y];
  step(g);
  assert.equal(g.gateOpen, true);
  assert.ok(['pitlord', 'dreadlord'].includes(g.boss.type));
  assert.equal(g.skullHolder, g.boss);
});

test('skull: the boss falls, everyone turns hostile, and the Skull in the circle wins it all', () => {
  const g = new SkullOfGuldan(party(), [1, 2, 3]);
  g.setup();
  g.aiT = 1e9;
  g.openGate();
  const boss = g.boss;
  boss.alive = false;
  g.bossDied(boss);
  assert.equal(g.ffa, true);
  assert.ok(g.enemies(g.heroes.get(1), g.heroes.get(2)));
  const u = g.heroes.get(2);
  g.skullHolder = u;
  u.inv.skull = true;
  [u.x, u.y] = [SPOTS.finish.x, SPOTS.finish.y];
  step(g);
  assert.ok(g.isDone());
  const pay = g.payouts();
  assert.deepEqual([1, 2, 3].map((p) => pay.get(p)), [0, 8, 0]);
});

test('skull: 8 bots play to the end without errors', () => {
  const g = new SkullOfGuldan(party(true), [1, 2, 3, 4, 5, 6, 7, 8]);
  g.setup();
  while (!g.isDone()) step(g);
  assert.ok(g.time <= 240 + dt);
});
