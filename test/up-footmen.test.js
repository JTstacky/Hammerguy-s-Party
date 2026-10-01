// Uther Party 4.0 #45 Flight of the Footmen against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FlightOfTheFootmen, FOOTMAN, DEFEND, ARMOR, GUARD, CANNON, MELD } from '../server/minigames/up/45-footmen.js';
import { wc3 } from '../engine/server/sim.js';

function game(n = 1) {
  const party = { room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} };
  const g = new FlightOfTheFootmen(party, Array.from({ length: n }, (_, i) => i + 1));
  g.setup();
  return g;
}

const step = (g, secs) => {
  for (let t = 0; t < secs - 1e-9; t += 1 / 30) {
    g.time += 1 / 30;
    g.tick(1 / 30);
  }
};

test('footmen: 125 HP, speed 270, collision 15; seven towers, two of them cannons; 90 s', () => {
  const g = game(2);
  for (const u of g.heroes.values()) assert.ok(u.hp === 125 && Math.abs(u.speed - wc3(270)) < 1e-9 && Math.abs(u.r - wc3(15)) < 1e-9);
  assert.equal(g.towers.length, 7);
  assert.equal(g.towers.filter((t) => t.kind === 'cannon').length, 2);
  // The bottom (outbound) lane faces no cannons.
  assert.ok(g.towers.filter((t) => t.kind === 'cannon').every((t) => t.y < 0));
  assert.deepEqual(FOOTMAN, { speed: wc3(270), r: wc3(15), hp: 125 });
  assert.equal(FlightOfTheFootmen.duration, 90);
  assert.equal(GUARD.cd, 0.9);
  assert.equal(CANNON.cd, 2.5);
});

test('footmen: a guard arrow does 23-27 less armour 2 (20.5-24.1); Defend cuts it to 5 % and slows to 60 %', () => {
  assert.ok(Math.abs(23 * ARMOR - 20.54) < 0.05 && Math.abs(27 * ARMOR - 24.11) < 0.05);
  const g = game(1);
  const u = g.heroes.get(1);
  g.towers = [];
  g.arrows.push({ id: 1, x: u.x - 0.1, y: u.y, tgt: u, dmg: 22, from: { x: 0, y: 0 } });
  step(g, 0.05);
  assert.equal(u.hp, 125 - 22);
  g.command(1, { c: 'cast', slot: 0 });
  assert.equal(u.defend, true);
  assert.equal(u.speedMult, DEFEND.speed);
  let hits = 0;
  for (let i = 0; i < 40; i++) {
    const hp = u.hp;
    g.arrows.push({ id: 2 + i, x: u.x - 0.1, y: u.y, tgt: u, dmg: 22, from: { x: 0, y: 0 } });
    step(g, 0.05);
    if (u.hp < hp) {
      hits++;
      assert.ok(Math.abs(hp - u.hp - 22 * DEFEND.pierce) < 1e-9);
    }
  }
  assert.ok(hits > 18 && hits < 38, `about 70 % get through (${hits}/40)`);
});

test('footmen: cannon shells are not reduced by Defend and splash 50/100/125 u at 100/50/10 %', () => {
  const g = game(3);
  g.towers = [];
  const us = [1, 2, 3].map((p) => g.heroes.get(p));
  us[0].defend = true;
  const r = wc3(15);
  [us[0].x, us[0].y] = [0, 8];
  [us[1].x, us[1].y] = [wc3(100) + r - 0.02, 8];
  [us[2].x, us[2].y] = [-(wc3(125) + r - 0.02), 8];
  g.landShell({ x: 0, y: 8, dmg: 80 });
  assert.deepEqual(us.map((u) => 125 - u.hp), [80, 40, 8]);
});

test('footmen: standing still for 1.5 s shadowmelds, and the towers let go', () => {
  const g = game(1);
  const u = g.heroes.get(1);
  const t = g.towers.find((q) => q.kind === 'guard' && q.y > 0);
  [u.x, u.y] = [t.x, t.y + 6];
  u.hp = 1e9;
  u.order(u.x + 0.5, u.y);
  step(g, 1);
  assert.equal(t.tgt, u, 'targeted while visible');
  step(g, MELD + 0.3);
  assert.ok(g.melded(u));
  assert.equal(t.tgt, null, 'lost once melded');
});

test('footmen: the circle 768 u north of the start is the finish, reached the long way round', () => {
  const g = game(2);
  const [fx, fy] = g.map.ff.finish;
  const u = g.heroes.get(1);
  assert.ok(Math.abs(u.y - fy - wc3(768)) < wc3(70));
  // Walking straight north runs into the plateau.
  u.order(u.x, fy);
  g.towers = [];
  step(g, 4);
  assert.equal(g.finishOrder.length, 0);
  [u.x, u.y] = [fx, fy];
  step(g, 0.05);
  assert.deepEqual(g.finishOrder, [1]);
});
