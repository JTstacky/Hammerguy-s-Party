// Battle for the Bottle (#50) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleForTheBottle, BREW, BOF, HAZE, RUNE } from '../server/minigames/up/50-bottle.js';
import { wc3 } from '../engine/server/sim.js';

function fakeParty(bots = false) {
  const events = [];
  return { events, room: { isBot: () => bots, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev: (e) => events.push(e) };
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('bottle: level-2 brewmasters on a ring of 500 at (135 i - 22.5)°, full mana', () => {
  const g = new BattleForTheBottle(fakeParty(), [1, 2, 3, 4, 5, 6, 7, 8]);
  g.setup();
  const angles = [];
  for (const [pid, u] of g.heroes) {
    assert.equal(u.hp, 375);
    assert.ok(near(u.speed, wc3(270)));
    assert.ok(near(u.r, wc3(32)));
    assert.equal(u.regen, 0.7);
    assert.equal(g.mana.get(pid), 240);
    assert.ok(near(Math.hypot(u.x, u.y), wc3(500), 1e-9));
    angles.push(Math.round(((Math.atan2(-u.y, u.x) * 180) / Math.PI + 360) % 360 * 10) / 10);
  }
  assert.deepEqual(angles.sort((a, b) => a - b), [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5]);
  assert.equal(BattleForTheBottle.duration, 175, '180 s minus the 5 s frozen start');
});

test('bottle: melee hits roll 26-36 through 3.65 armour every 2.22 / 1.3 s', () => {
  const g = new BattleForTheBottle(fakeParty(), [1, 2]);
  g.setup();
  assert.ok(near(g.attack.cd, 1.7077, 1e-3));
  assert.ok(near(g.attack.range, wc3(100)));
  const v = g.heroes.get(2);
  let lo = Infinity;
  let hi = 0;
  for (let i = 0; i < 2000; i++) {
    v.hp = 1e6;
    g.attackHit(1, g.heroes.get(1), v);
    const d = 1e6 - v.hp;
    lo = Math.min(lo, d);
    hi = Math.max(hi, d);
  }
  assert.ok(near(lo, 26 * BREW.armour, 1e-6) && near(hi, 36 * BREW.armour, 1e-6), `${lo}-${hi}`);
  assert.ok(near(BREW.armour, 0.8203, 1e-3));
});

test('bottle: Drunken Haze makes 45 % of swings miss and slows by 15 % for 5 s', () => {
  const g = new BattleForTheBottle(fakeParty(), [1, 2, 3]);
  g.setup();
  const [a, b, c] = [1, 2, 3].map((p) => g.heroes.get(p));
  [a.x, a.y, b.x, b.y, c.x, c.y] = [0, 0, 5, 0, 5 + wc3(150), 0];
  g.hazeBurst(1, b.x, b.y);
  assert.ok(g.hazed.has(2) && g.hazed.has(3) && !g.hazed.has(1), 'radius 200 round the target, not the caster');
  let misses = 0;
  for (let i = 0; i < 4000; i++) {
    a.hp = 1e6;
    const before = a.hp;
    g.attackHit(2, b, a);
    if (a.hp === before) misses++;
  }
  assert.ok(Math.abs(misses / 4000 - 0.45) < 0.03, `miss rate ${misses / 4000}`);
  g.tick(1 / 30);
  assert.ok(near(b.speedMult, 0.85));
  for (let t = 0; t < 5.1; t += 1 / 30) g.tick(1 / 30);
  assert.ok(!g.hazed.has(2));
  assert.equal(b.speedMult, 1);
});

test('bottle: Breath of Fire is a 375-long cone, 125 -> 300 wide, 65 damage, and ignites hazed rivals', () => {
  const g = new BattleForTheBottle(fakeParty(), [1, 2, 3, 4]);
  g.setup();
  const [a, inCone, wide, behind] = [1, 2, 3, 4].map((p) => g.heroes.get(p));
  for (const u of [a, inCone, wide, behind]) u.regen = 0;
  [a.x, a.y] = [0, 0];
  [inCone.x, inCone.y] = [wc3(340), wc3(140)]; // near the far end, inside the 150 half-width + its radius
  [wide.x, wide.y] = [wc3(200), wc3(220)]; // outside the cone
  [behind.x, behind.y] = [wc3(-150), 0];
  g.hazed.set(2, 5);
  g.breathOfFire(1, a, { x: 5, y: 0 });
  assert.equal(g.mana.get(1), 240 - BOF.mana);
  for (let i = 0; i < 20; i++) g.stepWaves(1 / 30);
  assert.equal(375 - inCone.hp, 65);
  assert.equal(wide.hp, 375);
  assert.equal(behind.hp, 375);
  assert.ok(g.burning.has(2), 'hazed victim catches fire');
  // Part the others so nobody auto-acquires anybody while it burns.
  [a.x, a.y, wide.x, wide.y, behind.x, behind.y] = [-9, -9, 9, -9, -9, 9];
  const hp = inCone.hp;
  g.hazed.clear();
  for (let t = 0; t < 6; t += 1 / 30) g.tick(1 / 30);
  assert.ok(Math.abs(hp - inCone.hp - 35) < 0.5, `burn ${hp - inCone.hp}`);
  assert.equal(HAZE.range, wc3(550));
});

test('bottle: a mana rune every 10 s within 500 of the centre, +125 mana', () => {
  const g = new BattleForTheBottle(fakeParty(), [1, 2]);
  g.setup();
  g.runeT = 10;
  for (let t = 0; t < 40.01; t += 1 / 30) {
    g.time += 1 / 30;
    g.tick(1 / 30);
    // Parked in opposite corners, away from the runes and each other.
    for (const [p, u] of g.heroes) [u.x, u.y] = p === 1 ? [100, 100] : [-100, -100];
  }
  assert.equal(g.runes.length, 4);
  for (const r of g.runes) assert.ok(Math.hypot(r.x, r.y) <= RUNE.maxR + 1e-9);
  g.runes = [g.runes[0]]; // one rune, so two close ones cannot both be taken
  g.mana.set(1, 50);
  const u = g.heroes.get(1);
  [u.x, u.y] = [g.runes[0].x, g.runes[0].y];
  g.tick(1 / 30);
  assert.ok(Math.abs(g.mana.get(1) - 175) < 0.1, `mana ${g.mana.get(1)}`);
});

test('bottle: the screen flashes every 3.25 s while two or more fight', () => {
  const party = fakeParty();
  const g = new BattleForTheBottle(party, [1, 2]);
  g.setup();
  for (const u of g.heroes.values()) u.hp = 1e9;
  g.flashT = 0.01;
  for (let t = 0; t < 12.9; t += 1 / 30) g.tick(1 / 30);
  const flashes = party.events.filter((e) => e.k === 'bflash');
  assert.equal(flashes.length, 4);
  for (const f of flashes) assert.ok(f.a >= 0.5 && f.a <= 1);
});

test('bottle: no ties, brewmasters dying in the same instant get sequential antes', () => {
  const g = new BattleForTheBottle(fakeParty(), [1, 2, 3, 4]);
  g.setup();
  g.time = 10;
  g.damage(1, 1000);
  g.damage(2, 1000);
  g.time = 20;
  g.damage(3, 1000);
  const pts = g.payouts();
  assert.deepEqual([1, 2, 3, 4].map((p) => pts.get(p)), [5, 6, 7, 8]);
});

test('bottle: computer brewmasters re-roll a destination every 4 s and never cast', () => {
  const g = new BattleForTheBottle(fakeParty(true), [1, 2]);
  g.setup();
  g.aiT = 0.01;
  for (let t = 0; t < 30; t += 1 / 30) {
    g.time += 1 / 30;
    g.tick(1 / 30);
  }
  for (const pid of [1, 2]) assert.equal(g.mana.get(pid) >= 240 - 1e-6 || g.heroes.get(pid).alive === false, true, 'mana never spent');
});
