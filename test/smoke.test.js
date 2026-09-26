// Plays every minigame to the end with bots for 2, 4 and 8 players and checks
// the basics: nothing throws, snapshots serialise, the game ends within its
// duration cap, and payouts follow the ante rules (0-8 points each).
import test from 'node:test';
import assert from 'node:assert/strict';
import { MINIGAMES } from '../server/minigames/index.js';

function fakeParty() {
  const events = [];
  return { events, room: { isBot: () => true, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev: (e) => events.push(e) };
}

export function playOut(Game, n, dt = 1 / 30) {
  const party = fakeParty();
  const pids = Array.from({ length: n }, (_, i) => i + 1);
  const g = new Game(party, pids);
  g.setup();
  JSON.stringify(g.map);
  let steps = 0;
  const cap = (Game.duration || 300) + 5;
  while (!g.isDone() && g.time < cap) {
    g.time += dt;
    g.tick(dt);
    if (++steps % 15 === 0) for (const p of pids) JSON.stringify(g.snapshot(p));
    party.events.length = 0;
  }
  return { g, pts: g.payouts(), groups: g.ranking() };
}

for (const Game of MINIGAMES) {
  test(`smoke: ${Game.id} (${Game.name}) plays out with bots`, () => {
    for (const n of [2, 4, 8]) {
      const { g, pts, groups } = playOut(Game, n);
      assert.ok(g.isDone(), `${Game.id} with ${n} players ends (t=${g.time.toFixed(1)})`);
      for (const [, v] of pts) assert.ok(v >= 0 && v <= 8 && Number.isFinite(v), `${Game.id}: payout ${v}`);
      assert.equal(groups.flat().length, n, `${Game.id}: ranking covers every player`);
    }
  });
}
