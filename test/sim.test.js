// Headless simulation tests: run whole games with bots only and check that
// they progress through every phase and finish without throwing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HammerguysParty } from '../server/party.js';
import { MINIGAMES } from '../server/minigames/index.js';

function fakeRoom(n) {
  const players = Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Bot${i + 1}`, slot: i, bot: true }));
  return {
    playerList: () => players,
    isBot: () => true,
    isConnected: () => true,
    nameOf: (id) => `Bot${id}`,
    colorOf: () => '#fff',
  };
}

function run(game, maxSeconds) {
  const dt = 1 / 30;
  const phases = new Set();
  for (let t = 0; t < maxSeconds && !game.over; t += dt) {
    game.tick(dt);
    phases.add(game.phase);
    if (Math.round(t / dt) % 2 === 0) {
      const s = game.snapshot(1);
      JSON.stringify(s);
      game.events = [];
    }
  }
  return phases;
}

for (const M of MINIGAMES) {
  test(`party: ${M.id} runs to completion with bots`, () => {
    const party = new HammerguysParty(fakeRoom(6), { games: 1, only: M.id });
    // A tie for first plays tiebreaker games, so allow a few rounds.
    const phases = run(party, ((M.duration || 200) + 20) * 4);
    assert.ok(party.over, `${M.id} should finish`);
    assert.ok(phases.has('play'));
    const st = party.standings();
    console.log(`  ${M.id}: ${Math.round(party.mg.time)}s, points`, st.map((s) => s.score).join(','));
    assert.ok(st[0].score >= 1);
  });
}

test('party: full party of 8 games', () => {
  const party = new HammerguysParty(fakeRoom(8), { games: 8 });
  run(party, 60 * 15);
  assert.ok(party.over);
});
