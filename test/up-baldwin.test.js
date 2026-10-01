// Bomb Baldwin (#11) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BombBaldwin, HW, FLYER, BOMB, PEASANT, FREEZE } from '../server/minigames/up/11-baldwin.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};
const fresh = (n = 3) => {
  const g = new BombBaldwin(party(), Array.from({ length: n }, (_, i) => i + 1));
  g.setup();
  return g;
};

test('baldwin: flying machines 200 HP, speed 400, 700 u out on spots 45 degrees apart; bombs range 100 every 2.5 s', () => {
  const g = fresh();
  assert.equal(HW, wc3(832));
  for (const u of g.heroes.values()) {
    assert.equal(u.hp, 200);
    assert.equal(u.speed, wc3(400));
    assert.ok(Math.abs(Math.hypot(u.x, u.y) - FLYER.ring) < 1e-6);
    const deg = ((Math.atan2(u.y, u.x) * 180) / Math.PI + 360) % 45;
    assert.ok(Math.abs(deg - 22.5) < 1e-6);
    assert.equal(u.skin, 'flyingmachine');
  }
  assert.equal(g.attack.range, wc3(100));
  assert.equal(g.attack.cd, 2.5);
  assert.equal(BOMB.range, wc3(100));
});

test('baldwin: frozen for 5 s, then 100 decoys and one Baldwin per player come out round the farm', () => {
  const g = fresh(4);
  const u = g.heroes.get(1);
  const [x, y] = [u.x, u.y];
  g.command(1, { c: 'move', x: 0, y: 0 });
  run(g, FREEZE - 0.2);
  assert.equal(g.peasants.length, 0);
  assert.equal(u.x, x);
  assert.equal(u.y, y);
  run(g, 0.4);
  assert.equal(g.peasants.length, PEASANT.decoys + 4);
  assert.equal(g.peasants.filter((p) => p.baldwin).length, 4);
  assert.ok(g.peasants.every((p) => p.hp === 5));
});

test('baldwin: bombing a Baldwin finishes you (8, 7 ...); a decoy only scatters its neighbours', () => {
  const g = fresh(3);
  run(g, FREEZE + 0.1);
  const [a, b] = [g.heroes.get(1), g.heroes.get(2)];
  const decoy = g.peasants.find((p) => !p.baldwin);
  const near = g.peasants.find((p) => p !== decoy && Math.hypot(p.x - decoy.x, p.y - decoy.y) < wc3(150));
  g.attackHit(1, a, decoy);
  assert.equal(decoy.alive, false);
  assert.equal(g.finishOrder.length, 0);
  if (near) assert.ok(near.target);
  const bald = g.peasants.filter((p) => p.baldwin && p.alive);
  g.attackHit(2, b, bald[0]);
  g.attackHit(1, a, bald[1]);
  assert.deepEqual(g.finishOrder, [2, 1]);
  assert.equal(g.heroEnts(3).some((e) => e.o === 2), false);
  g.time = 60;
  assert.ok(g.isDone());
  const pay = g.payouts();
  assert.equal(pay.get(2), 8);
  assert.equal(pay.get(1), 7);
  assert.equal(pay.get(3) || 0, 0);
});
