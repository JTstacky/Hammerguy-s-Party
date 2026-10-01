// #46 Tower Defense against its rule sheet (docs/uther-party/rules-4.0.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TowerDefense, TD } from '../server/minigames/up/46-tower.js';
import { wc3 } from '../engine/server/sim.js';

function game(n = 1) {
  const party = { room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} };
  const g = new TowerDefense(party, Array.from({ length: n }, (_, i) => i + 1));
  g.setup();
  return g;
}

const run = (g, secs, dt = 1 / 30) => {
  const end = g.time + secs;
  while (g.time < end - 1e-9 && !g.isDone()) {
    g.time += dt;
    g.tick(dt);
  }
};

// Everyone invulnerable to the Archmages for timing tests.
function calm(g) {
  for (const m of g.mages) m.alive = false;
  g.summoned = true;
}

test('tower defense: 8 peasants on a 128 u ring, one of them starts the tower at once', () => {
  const g = game(2);
  for (const pid of g.pids) {
    const ps = g.peasants(pid);
    assert.equal(ps.length, 8);
    const tw = g.towers.get(pid);
    for (const p of ps) assert.ok(Math.abs(Math.hypot(p.x - tw.x, p.y - tw.y) - wc3(128)) < 1e-6);
    assert.equal(ps.filter((p) => p.build).length, 1);
    assert.equal(p0speed(ps), wc3(190));
  }
  assert.equal(g.mages.length, 8, 'an Archmage at every spot, used or not');
});
const p0speed = (ps) => ps[0].speed;

test('tower defense: one builder needs 240 s; each extra adds 0.6x (eight: about 46 s)', () => {
  const g = game(1);
  calm(g);
  run(g, 20);
  const solo = g.towers.get(1).prog;
  // Builders stand at the tower after a short walk, so allow for it.
  assert.ok(solo > (19 / 240) && solo < 20 / 240, `solo ${solo}`);
  const h = game(1);
  calm(h);
  h.useAbility(1, 0, 0, 0);
  run(h, 60);
  assert.ok(h.finishOrder.includes(1), 'eight peasants finish');
  assert.ok(h.time > 46 && h.time < 50, `finished at ${h.time.toFixed(1)} s`);
});

test('tower defense: Archmages wake at t=5, shoot peasants within 450 before the tower', () => {
  const g = game(1);
  const tw = g.towers.get(1);
  const m = g.mages[0];
  assert.ok(Math.abs(Math.hypot(m.x - tw.x, m.y - tw.y) - wc3(448)) < 1e-6);
  run(g, 4.9);
  assert.equal(g.missiles2.length, 0);
  assert.equal(m.tgt, null);
  run(g, 1.5);
  assert.ok(m.tgt && m.tgt.kind !== 'tower', 'a peasant first');
  assert.ok(Math.abs(TD.ARCHMAGE.atk.range - wc3(450)) < 1e-9);
});

test('tower defense: a Water Elemental per Archmage at t=17, 525 HP, gone after 60 s', () => {
  const g = game(1);
  for (const p of g.peasants(1)) p.hp = 1e9;
  g.towers.get(1).hp = 1e9;
  run(g, 17.1);
  assert.equal(g.elementals.length, 8);
  assert.equal(g.elementals[0].maxHp, 525);
  run(g, 60);
  assert.equal(g.elementals.length, 0);
});

test('tower defense: losing the construction kills all your units and scores 0; finishing pays 8', () => {
  const g = game(2);
  calm(g);
  run(g, 3);
  const tw = g.towers.get(2);
  g.hurt(tw, 1e6);
  assert.equal(g.peasants(2).length, 0);
  assert.ok(g.elimOrder.some((e) => e.pid === 2));
  g.useAbility(1, 0, 0, 0);
  run(g, 80);
  assert.deepEqual(g.finishOrder, [1]);
  const pts = g.payouts();
  assert.equal(pts.get(1), 8);
  assert.equal(pts.get(2), 0);
});

test('tower defense: when the hero peasant dies another peasant takes over', () => {
  const g = game(1);
  calm(g);
  const h = g.heroes.get(1);
  g.hurt(h, 1e6);
  const h2 = g.heroes.get(1);
  assert.notEqual(h2, h);
  assert.ok(h2.alive);
  assert.equal(h2.kind, 'paladin');
  assert.equal(g.peasants(1).length, 7);
  assert.equal(g.elimOrder.length, 0);
});
