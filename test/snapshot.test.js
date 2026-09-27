import test from 'node:test';
import assert from 'node:assert/strict';
import { HammerguysParty } from '../server/party.js';
import { MINIGAMES } from '../server/minigames/index.js';

const room = { playerList: () => [1, 2].map((id) => ({ id })), isBot: () => false, nameOf: String, colorOf: () => '#fff' };
const wire = (value) => JSON.parse(JSON.stringify(value));

for (const Game of MINIGAMES) {
  test(`${Game.id}: map carries definitions and snapshots carry only ability state`, () => {
    const party = new HammerguysParty(room, { games: 1, only: Game.id });
    const map = wire(party.mapInfo);
    assert.deepEqual(map.mg, { id: Game.id, name: Game.name, desc: Game.desc, controls: Game.controls });
    const s = wire(party.snapshot(1));
    assert.ok(!('mg' in s));
    assert.ok(!('ability' in s));
    assert.equal(s.abilities.length, map.abilities.length);
    s.abilities.forEach((a, i) => {
      assert.ok(Object.keys(a).every((k) => ['cd', 'left', 'empty'].includes(k)));
      const restored = { ...map.abilities[i], ...a };
      assert.equal(typeof restored.name, 'string');
      assert.equal(typeof restored.max, 'number');
      assert.equal(restored.key, 'QWER'[i]);
      assert.equal(restored.cd, 0);
    });
    const mg = party.mg;
    if (mg.abilities.length) {
      mg.acd.get(1)[0] = 2;
      mg.acharges.get(1)[0] = 0;
      assert.deepEqual(party.snapshot(1).abilities[0], { cd: 2, left: 0, empty: true });
      assert.equal(party.snapshot(2).abilities[0].cd, 0);
    }
    const oldMap = party.mapInfo;
    party.queue = [Game];
    party.nextGame();
    assert.notEqual(party.mapInfo, oldMap);
    assert.equal(party.mapInfo.v, oldMap.v + 1);
  });
}
