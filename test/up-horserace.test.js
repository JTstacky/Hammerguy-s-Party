// Uther Party 4.0 #24 Horse Race against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HorseRace, HORSE, PAUSE } from '../server/minigames/up/24-horserace.js';

function game(n = 1) {
  const party = { room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} };
  const g = new HorseRace(party, Array.from({ length: n }, (_, i) => i + 1));
  g.setup();
  return g;
}

// Runs one runner that boosts whenever `when(speed, t)` says so; returns the
// race time after the 6 s start, or null if it didn't finish by 60 s.
function race(when) {
  const g = game(1);
  const dt = 1 / 30;
  while (!g.isDone() && g.time < HorseRace.duration) {
    g.time += dt;
    g.tick(dt);
    if (g.time > PAUSE && when(g.ws.get(1), g.time - PAUSE)) g.command(1, { c: 'cast', slot: 0 });
  }
  return g.finishOrder.length ? g.time - PAUSE : null;
}

test('horse race: speed drops 2 every 0.05 s to a floor of 60; a boost resets it to 320', () => {
  const g = game(1);
  const dt = 1 / 30;
  while (g.time < PAUSE + 2) {
    g.time += dt;
    g.tick(dt);
  }
  assert.ok(Math.abs(g.ws.get(1) - (320 - 80)) <= 2, `after 2 s: ${g.ws.get(1)}`);
  while (g.time < PAUSE + 10) {
    g.time += dt;
    g.tick(dt);
  }
  assert.equal(g.ws.get(1), 60);
  g.command(1, { c: 'cast', slot: 0 });
  assert.equal(g.ws.get(1), 320);
  assert.equal(g.acharges.get(1)[0], HORSE.boosts - 1);
});

test('horse race: runners are held for the first 6 s, which the 60 s timer includes', () => {
  const g = game(1);
  const u = g.heroes.get(1);
  const x0 = u.x;
  g.command(1, { c: 'cast', slot: 0 });
  while (g.time < PAUSE - 0.1) {
    g.time += 1 / 30;
    g.tick(1 / 30);
  }
  assert.equal(u.x, x0);
  assert.equal(g.acharges.get(1)[0], 4, 'no boosting while held');
  assert.equal(HorseRace.duration, 60);
});

test('horse race: coasting never makes it (61.7 s needed, 54 s available)', () => {
  assert.equal(race(() => false), null);
});

test('horse race: one well-timed boost finishes in about 47 s', () => {
  let used = false;
  const t = race((s) => {
    if (used || s > 60) return false;
    used = true;
    return true;
  });
  assert.ok(t != null && Math.abs(t - 47) < 1.5, `took ${t}`);
});

test('horse race: four boosts every 3.6 s finish in about 18.4 s (the optimum)', () => {
  let next = 3.6;
  const t = race((s, tt) => {
    if (tt < next) return false;
    next += 3.6;
    return true;
  });
  assert.ok(t != null && Math.abs(t - 18.4) < 0.6, `took ${t}`);
});

test('horse race: all four boosts spammed from the start (1 s apart) take about 45.5 s', () => {
  let next = 1;
  const t = race((s, tt) => {
    if (tt < next) return false;
    next += 1.05;
    return true;
  });
  assert.ok(t != null && Math.abs(t - 45.5) < 1.5, `took ${t}`);
});

test('horse race: every runner has a lane of its own', () => {
  const g = game(8);
  const ys = new Set([...g.heroes.values()].map((u) => u.y.toFixed(3)));
  assert.equal(ys.size, 8);
});
