// Checks the engine against behaviour measured in the real Warcraft III 1.26a
// with instrumented maps (docs/uther-party/engine.md, and Arcane Arena's
// docs/wc3-observations.md sections 1, 2 and 9).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Unit, stepUnits, collideUnits, WC3, wc3, dist } from '../engine/server/sim.js';
import { Minigame } from '../server/base.js';

const DEG = Math.PI / 180;

// A unit standing at the origin facing east, with its step phase lined up so
// that step 1 comes 0.03 s after the order.
function standing(turnRate = 0.6, windowDeg = 60) {
  const u = new Unit({ kind: 't', speed: wc3(270) });
  u.turnRate = turnRate;
  u.propWindow = windowDeg * DEG;
  u.setFacing(0);
  u.stepT = WC3.STEP;
  return u;
}

// Orders a turn of `deg` and returns [step walking starts, first walking direction in degrees].
function firstWalk(u, deg) {
  u.order(Math.cos(deg * DEG) * 20 + u.x, Math.sin(deg * DEG) * 20 + u.y);
  const dt = 0.001;
  for (let t = 0; t < 1; t += dt) {
    const x0 = u.x;
    const y0 = u.y;
    stepUnits([u], dt);
    if (u.x !== x0 || u.y !== y0) return [Math.round((t + dt) / WC3.STEP + 0.49), Math.atan2(u.y - y0, u.x - x0) / DEG];
  }
  return [null, null];
}

// Measured on standing turns, turn rate 0.6, window 60° (wc3-observations.md §1).
const MEASURED = [
  [0, 1, 0.0],
  [15, 1, 14.8],
  [30, 1, 30.0],
  [45, 1, 34.1],
  [75, 2, 68.2],
  [90, 2, 68.7],
  [105, 3, 102.9],
  [120, 3, 103.8],
  [135, 4, 135.0],
  [150, 4, 137.3],
  [165, 5, 165.1],
  [180, 5, 171.8],
  [-45, 1, -34.3],
  [-90, 2, -68.8],
  [-150, 4, -137.3],
];

test('wc3: standing turns start walking on the measured step, in the measured direction', () => {
  for (const [deg, step, dir] of MEASURED) {
    const [s, d] = firstWalk(standing(), deg);
    assert.equal(s, step, `${deg}°: walks from step ${s}, WC3 step ${step}`);
    // 180° may turn either way; compare magnitudes there.
    const got = Math.abs(deg) === 180 ? Math.abs(d) : d;
    assert.ok(Math.abs(got - dir) < 1.5, `${deg}°: first direction ${d.toFixed(1)}°, WC3 ${dir}°`);
  }
});

test('wc3: turn rate is radians per step and the window gates the pre-turn heading', () => {
  // Turn rate 0.3 rad per step, 90° turn: headings 17.2, 34.4, 51.6 → 3rd step is within 60° before turning.
  assert.equal(firstWalk(standing(0.3), 90)[0], 3);
  // A 1° window: the heading must already point at the target, so 90° at 0.6 walks on step 4.
  assert.equal(firstWalk(standing(0.6, 1), 90)[0], 4);
  // A 180° window walks at once, even backwards.
  assert.equal(firstWalk(standing(0.6, 180), 150)[0], 1);
});

test('wc3: full speed at once, no acceleration, stops dead about 11 u short', () => {
  const u = standing();
  u.order(10, 0);
  const dt = 0.01;
  let t = 0;
  while (!u.walking) {
    stepUnits([u], dt);
    t += dt;
  }
  const x0 = u.x;
  stepUnits([u], dt);
  assert.ok(Math.abs((u.x - x0) / dt - wc3(270)) < 1e-9, 'first walking tick is at full speed');
  while (u.target) stepUnits([u], dt);
  const short = (10 - u.x) * 54;
  assert.ok(short > 5 && short <= 12, `stopped ${short.toFixed(1)} WC3 units short`);
});

test('wc3: a new order stops translation at once, even straight ahead', () => {
  const u = standing();
  u.order(20, 0);
  for (let i = 0; i < 50; i++) stepUnits([u], 0.01);
  assert.ok(u.walking);
  u.order(30, 0);
  const x0 = u.x;
  // Line the step up so the next one is 0.03 s away: no movement before it.
  u.stepT = WC3.STEP;
  stepUnits([u], 0.02);
  assert.equal(u.x, x0);
  stepUnits([u], 0.02);
  assert.ok(u.x > x0);
});

test('steer (joystick, held right-click) moves the destination without the WC3 stop', () => {
  const u = standing();
  u.order(20, 0);
  for (let i = 0; i < 50; i++) stepUnits([u], 0.01);
  assert.ok(u.walking);
  // Re-steering every 0.1 s keeps full speed: 1 s covers the full distance.
  const x0 = u.x;
  for (let i = 0; i < 100; i++) {
    if (i % 10 === 0) u.steer(u.x + 2, 0);
    stepUnits([u], 0.01);
  }
  assert.ok(Math.abs(u.x - x0 - wc3(270)) < 1e-6, `moved ${(u.x - x0).toFixed(3)}, full speed ${wc3(270).toFixed(3)}`);
  // A sharp steer still turns first: the propulsion window applies.
  u.steer(u.x - 2, 0);
  u.stepT = WC3.STEP;
  stepUnits([u], 0.031);
  assert.equal(u.walking, false);
});

test('wc3: the model lags the heading, so a 180° turn walks backwards for a moment', () => {
  const u = standing();
  firstWalk(u, 180);
  // Walking has started, but the model still faces well away from the path.
  const off = Math.abs(Math.atan2(Math.sin(u.heading - u.facing), Math.cos(u.heading - u.facing))) / DEG;
  assert.ok(off > 90, `model is ${off.toFixed(0)}° behind the heading when walking starts`);
  let t = 0;
  while (Math.abs(u.heading - u.facing) > 1e-6 && t < 2) {
    stepUnits([u], 0.01);
    t += 0.01;
  }
  assert.ok(t > 0.25 && t < 0.7, `model settles ${t.toFixed(2)} s after walking starts (WC3 about 0.35-0.5 s)`);
});

test('wc3: a walking unit steers round an idle one and never shoves it', () => {
  const idle = new Unit({ kind: 't', x: 0, y: 0.1, r: wc3(31) });
  const walker = standing();
  walker.r = wc3(31);
  walker.x = -6;
  walker.order(6, 0);
  let closest = Infinity;
  for (let i = 0; i < 400 && walker.target; i++) {
    stepUnits([idle, walker], 0.01);
    collideUnits([idle, walker]);
    closest = Math.min(closest, dist(idle.x, idle.y, walker.x, walker.y));
  }
  assert.equal(idle.x, 0);
  assert.equal(idle.y, 0.1);
  assert.equal(walker.target, null, 'walker got past');
  // WC3: passes with 20-30 % overlap of the combined radii (50-58 u for two paladins).
  assert.ok(closest * 54 > 40 && closest * 54 < 62, `closest ${(closest * 54).toFixed(0)} u`);
});

function fakeParty(n) {
  return { room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} };
}

class Surv extends Minigame {
  static ranking = 'survival';
  static duration = 100;
}
class Race extends Minigame {
  static ranking = 'race';
  static duration = 100;
}

test('uther party: survival ante with 8 players pays 1..7 in death order and 8 to the winner', () => {
  const g = new Surv(fakeParty(), [1, 2, 3, 4, 5, 6, 7, 8]);
  g.spawnHeroes(g.ringPositions(5));
  [3, 5, 1, 8, 2, 7, 4].forEach((p, i) => {
    g.time = i;
    g.eliminate(p);
  });
  const p = g.payouts();
  assert.deepEqual([3, 5, 1, 8, 2, 7, 4, 6].map((x) => p.get(x)), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('uther party: same-instant deaths share the lower ante; the ante still rises per death', () => {
  const g = new Surv(fakeParty(), [1, 2, 3, 4]);
  g.spawnHeroes(g.ringPositions(5));
  g.time = 1;
  g.eliminate(1);
  g.eliminate(2);
  g.time = 2;
  g.eliminate(3);
  const p = g.payouts();
  // N = 4: ante starts at 5. Two die together: 5 each, ante → 7. Then 7. Winner 8.
  assert.deepEqual([1, 2, 3, 4].map((x) => p.get(x)), [5, 5, 7, 8]);
});

test('uther party: at a timeout every survivor gets the current ante, nobody the 8', () => {
  const g = new Surv(fakeParty(), [1, 2, 3]);
  g.spawnHeroes(g.ringPositions(5));
  g.eliminate(1);
  g.time = 100;
  assert.ok(g.isDone());
  const p = g.payouts();
  // N = 3: ante 6 → player 1 gets 6, ante 7 for both survivors.
  assert.deepEqual([1, 2, 3].map((x) => p.get(x)), [6, 7, 7]);
});

test('uther party: races pay 8, 7, 6 to finishers and 0 to everyone else', () => {
  const g = new Race(fakeParty(), [1, 2, 3, 4]);
  g.spawnHeroes(g.ringPositions(5));
  g.finish(3);
  g.finish(1);
  g.eliminate(2);
  const p = g.payouts();
  assert.deepEqual([1, 2, 3, 4].map((x) => p.get(x)), [7, 0, 8, 0]);
});
