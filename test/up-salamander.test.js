// The Salamander Sizzle (#21) against its rule sheet (docs/uther-party/rules-4.0.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SalamanderSizzle, BLOCKS } from '../server/minigames/up/21-salamander.js';
import { wc3, dist } from '../engine/server/sim.js';

const fakeParty = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const step = (g, secs) => {
  for (let t = 0; t < secs - 1e-9; t += 1 / 30) {
    g.time += 1 / 30;
    g.tick(1 / 30);
  }
};

test('salamander sizzle: 60 mushrooms in the ring at 960-1190 u and 28 in the spokes, an open centre', () => {
  const ring = BLOCKS.filter(([x, y]) => Math.hypot(x, y) * 54 > 900);
  const spokes = BLOCKS.filter(([x, y]) => Math.hypot(x, y) * 54 <= 900);
  assert.equal(ring.length, 60);
  assert.equal(spokes.length, 28);
  for (const [x, y] of ring) {
    const d = Math.hypot(x, y) * 54;
    assert.ok(d >= 940 && d <= 1200, `ring block at ${d}`);
  }
  for (const [x, y] of spokes) assert.ok(Math.hypot(x, y) * 54 >= 440);
});

test('salamander sizzle: 25 HP, speed 270, collision 48; spawns on the ring of 8 at 800 u between the spokes', () => {
  const g = new SalamanderSizzle(fakeParty(), [1, 2, 3, 4, 5, 6, 7, 8]);
  g.setup();
  const angles = new Set();
  for (const u of g.heroes.values()) {
    assert.equal(u.maxHp, 25);
    assert.ok(Math.abs(u.r - wc3(48)) < 1e-9);
    assert.ok(Math.abs(Math.hypot(u.x, u.y) - wc3(800)) < 1e-6);
    const deg = ((Math.atan2(u.y, u.x) * 180) / Math.PI + 360) % 360;
    assert.ok(Math.abs(((deg - 22.5) % 45 + 45) % 45) < 1e-6 || Math.abs(((deg - 22.5) % 45 + 45) % 45 - 45) < 1e-6);
    angles.add(Math.round(deg));
  }
  assert.equal(angles.size, 8);
});

test('salamander sizzle: mana starts at 0 and refills 10/s, so the first 75-mana shot is ready at 7.5 s', () => {
  const g = new SalamanderSizzle(fakeParty(), [1, 2]);
  g.setup();
  step(g, 7.4);
  g.useAbility(1, 0, 0, 0);
  assert.equal(g.fires.length, 0, 'not yet');
  step(g, 0.15);
  g.useAbility(1, 0, 0, 0);
  assert.equal(g.fires.length, 1, 'ready at 7.5 s');
  assert.ok(g.mana.get(1) < 1);
});

test('salamander sizzle: the fire starts 128 u ahead along the facing, stops the shooter, flies at 350 and lasts about 6.1 s', () => {
  const g = new SalamanderSizzle(fakeParty(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  [u.x, u.y] = [-wc3(700), 0];
  u.setFacing(0);
  u.order(0, 0);
  g.heroes.get(2).y = wc3(700);
  g.heroes.get(2).x = 0;
  g.blocks = g.blocks.map(() => false); // nothing to hit
  g.mana.set(1, 200);
  g.useAbility(1, 0, 0, 0);
  const f = g.fires[0];
  assert.ok(Math.abs(f.x - (u.x + wc3(128))) < 1e-9 && Math.abs(f.y) < 1e-9);
  assert.equal(u.target, null, 'the caster is stopped');
  const x0 = f.x;
  let t = 0;
  while (!f.dead && t < 10) {
    g.time += 1 / 30;
    g.tick(1 / 30);
    t += 1 / 30;
  }
  assert.ok(u.alive, 'its own fire does not kill the shooter at launch');
  assert.ok(Math.abs(t - 6.15) < 0.1, `lasted ${t.toFixed(2)} s`);
  assert.ok(Math.abs((f.x - x0) * 54 - 350 * t) < 40, 'at 350 u/s');
});

test('salamander sizzle: a fire kills any salamander within 100, and a mushroom and a fire destroy each other', () => {
  const g = new SalamanderSizzle(fakeParty(), [1, 2, 3]);
  g.setup();
  const [a, b, c] = [1, 2, 3].map((p) => g.heroes.get(p));
  [a.x, a.y] = [0, wc3(95)];
  [b.x, b.y] = [0, -wc3(300)];
  [c.x, c.y] = [wc3(600), wc3(600)];
  g.fires.push({ id: 1, x: 0, y: 0, a: 0, go: 1000, hp: 120, immo: 1 });
  g.burn();
  assert.equal(a.alive, false);
  assert.equal(b.alive, true);
  const i = 0;
  const [bx, by] = BLOCKS[i];
  g.fires.push({ id: 2, x: bx + wc3(90), y: by, a: 0, go: 1000, hp: 120, immo: 1 });
  g.burn();
  assert.equal(g.blocks[i], false, 'the mushroom is destroyed');
  assert.ok(g.fires.find((f) => f.id === 2).dead, 'and so is the fire');
});

test('salamander sizzle: Permanent Immolation burns 10 a second within 220 (plus collision)', () => {
  const g = new SalamanderSizzle(fakeParty(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  [u.x, u.y] = [0, wc3(260)];
  g.heroes.get(2).x = wc3(700);
  g.fires.push({ id: 1, x: 0, y: 0, a: 0, go: 0, hp: 120, immo: 1 });
  for (let i = 0; i < 32; i++) {
    g.time += 1 / 30;
    g.tick(1 / 30);
    [u.x, u.y] = [0, wc3(260)];
  }
  assert.ok(Math.abs(u.hp - 15) < 0.1, `one tick of 10 after 1 s: hp ${u.hp}`);
  assert.ok(dist(u.x, u.y, 0, 0) > wc3(220));
});

test('salamander sizzle: at 150 s the survivors share the ante', () => {
  const g = new SalamanderSizzle(fakeParty(), [1, 2, 3, 4]);
  g.setup();
  g.eliminate(1, 'burn');
  g.time = 150;
  assert.equal(g.isDone(), true);
  const pts = g.payouts();
  assert.equal(pts.get(1), 5);
  assert.equal(pts.get(2), 6);
  assert.equal(pts.get(3), 6);
  assert.equal(pts.get(4), 6);
});
