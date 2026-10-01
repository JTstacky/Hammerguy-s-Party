// #49 Clandestine Kitty against its rule sheet (docs/uther-party/rules-4.0.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ClandestineKitty, KITTY, TREES } from '../server/minigames/up/49-kitty.js';
import { wc3 } from '../engine/server/sim.js';

function game(n = 2) {
  const party = { room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} };
  const g = new ClandestineKitty(party, Array.from({ length: n }, (_, i) => i + 1));
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

// Parks the guards out of the way at the north end.
function park(g) {
  g.guards.forEach((v, i) => {
    v.x = -2 + i * 2;
    v.y = -KITTY.HH + 6;
    v.speed = 0;
    v.mana = 0;
  });
}

test('kitty: a 768x3072 corridor, 46 trees, 8 vials about 2600 u north of the start', () => {
  const g = game();
  assert.equal(TREES.length, 46);
  assert.equal(g.vials.length, 8);
  assert.ok(Math.abs(KITTY.START.y - KITTY.VIALS.y - wc3(2624)) < 1e-6);
  for (const u of g.heroes.values()) {
    assert.equal(u.hp, 50);
    assert.ok(Math.abs(u.speed - wc3(320)) < 1e-9);
  }
  assert.equal(g.guards.length, 3);
  assert.equal(g.guards[0].hp, 1350);
});

test('kitty: two Doom Guard hits (35-42 chaos vs hero armour 3.7) kill a priestess', () => {
  const g = game();
  const u = g.heroes.get(1);
  const d = g.guards[0];
  g.hit(d, u, 35);
  assert.ok(u.alive);
  g.hit(d, u, 35);
  assert.equal(u.alive, false);
});

test('kitty: Charm takes a guard for 125 mana; a rival can charm it back', () => {
  const g = game();
  park(g);
  const [a, b] = [g.heroes.get(1), g.heroes.get(2)];
  const d = g.guards[0];
  [a.x, a.y] = [d.x, d.y + 6];
  [b.x, b.y] = [d.x + 1, d.y + 6];
  g.charm(1, a, d);
  assert.equal(d.owner, 1);
  assert.equal(g.mana.get(1), 100);
  g.charm(2, b, d);
  assert.equal(d.owner, 2);
  g.charm(1, a, d);
  assert.equal(d.owner, 2, 'not enough mana left to take it back');
});

test('kitty: Shadowmeld hides you after 1.5 s standing still; guards then cannot find you', () => {
  const g = game(1);
  const u = g.heroes.get(1);
  const d = g.guards[0];
  [u.x, u.y] = [d.x, d.y + wc3(450)];
  g.useAbility(1, 1, u.x, u.y);
  run(g, 1.4);
  assert.ok(g.visible(u));
  run(g, 0.2);
  assert.equal(g.visible(u), false);
  assert.equal(g.guardEnemies(d).includes(u), false);
  g.command(1, { c: 'move', x: u.x, y: u.y + 3 });
  run(g, 0.1);
  assert.ok(g.visible(u), 'moving breaks it');
});

test('kitty: guard Cripple slows a priestess by 75 % for 10 s', () => {
  const g = game(1);
  park(g);
  const u = g.heroes.get(1);
  g.cripple(g.guards[0], u);
  run(g, 0.1);
  assert.equal(u.speedMult, 0.25);
  run(g, 10);
  assert.equal(u.speedMult, 1);
});

test('kitty: grab a vial, bring it into the start circle to finish; dying drops it', () => {
  const g = game(2);
  park(g);
  const [a, b] = [g.heroes.get(1), g.heroes.get(2)];
  const v = g.vials[0];
  [a.x, a.y] = [v.x, v.y];
  run(g, 0.1);
  assert.equal(a.vial, v);
  g.damage(1, 100);
  assert.equal(v.holder, null, 'dropped');
  [b.x, b.y] = [v.x, v.y];
  run(g, 0.1);
  assert.equal(b.vial, v);
  [b.x, b.y] = [KITTY.START.x, KITTY.START.y];
  run(g, 0.1);
  assert.deepEqual(g.finishOrder, [2]);
  assert.equal(g.payouts().get(2), 8);
});
