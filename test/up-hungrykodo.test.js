// Hungry Hungry Kodos (#13) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HungryKodos, ARENA, T, KODO, DEVOUR, FOOD, BOLT, GATES_OPEN } from '../server/minigames/up/13-hungrykodos.js';
import { Unit, wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};
const fresh = (n = 3) => {
  const g = new HungryKodos(party(), Array.from({ length: n }, (_, i) => i + 1));
  g.setup();
  g.nextSpawn = null;
  g.periodic = 1e9;
  return g;
};
const food = (g, kind, x, y) => {
  const f = new Unit({ kind, x, y, r: FOOD.r, speed: FOOD.speed, hp: FOOD.hp });
  f.idle = 1e9;
  g.food.push(f);
  return f;
};

test('hungrykodo: kodos 1000 HP draining 15/s (starved in 66.7 s), speed 220, collision 48, 0 of 200 mana', () => {
  assert.equal(ARENA.length * T, wc3(1536));
  const g = fresh();
  const u = g.heroes.get(1);
  assert.equal(u.hp, 1000);
  assert.equal(u.speed, wc3(220));
  assert.equal(u.r, wc3(48));
  assert.equal(g.mana.get(1), 0);
  assert.equal(KODO.maxMana, 200);
  assert.equal(u.skin, 'hkodo');
  run(g, 10);
  assert.ok(Math.abs(u.hp - 850) < 1);
  run(g, 57);
  assert.equal(u.alive, false);
});

test('hungrykodo: the gates open at 6 s', () => {
  const g = fresh();
  run(g, GATES_OPEN - 0.1);
  assert.equal(g.gatesOpen, false);
  run(g, 0.2);
  assert.equal(g.gatesOpen, true);
});

test('hungrykodo: right-click (or tap, or Q) a pig to devour it: 2 s later +50 HP', () => {
  const g = fresh();
  const u = g.heroes.get(1);
  u.hp = 500;
  const pig = food(g, 'pig', u.x + 2, u.y);
  g.command(1, { c: 'attack', x: pig.x, y: pig.y });
  run(g, 1);
  assert.equal(pig.eaten, true);
  assert.ok(g.stomach.has(1));
  const hp = u.hp;
  run(g, FOOD.hp / DEVOUR.dps + 0.1);
  assert.equal(g.stomach.has(1), false);
  assert.ok(u.hp > hp + FOOD.pigHeal - 40);
  // Q (Devour) on a child: +100 mana.
  const kid = food(g, 'child', u.x - 1.5, u.y);
  g.command(1, { c: 'cast', slot: 0, x: kid.x, y: kid.y });
  run(g, 3);
  assert.equal(g.mana.get(1), FOOD.childMana);
});

test('hungrykodo: W Regurgitate (100 mana, range 800) does 100 damage and stuns for 2 s', () => {
  const g = fresh();
  const [a, b] = [g.heroes.get(1), g.heroes.get(2)];
  [a.x, a.y, b.x, b.y] = [-3, 0, 3, 0];
  g.mana.set(1, 100);
  const hp = b.hp;
  g.command(1, { c: 'cast', slot: 1, x: b.x, y: b.y });
  run(g, BOLT.castPoint + 0.5);
  assert.equal(g.mana.get(1), 0);
  assert.ok(hp - b.hp >= BOLT.dmg);
  assert.ok(b.stun > 1);
});
