// Two games registering the same view, skin, event, theme or map builder name
// silently replace each other's visuals (the last import wins). Every name
// must be registered once.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('every registered client name is unique', () => {
  const dir = 'client/views';
  const seen = new Map();
  const dupes = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const [, kind, name] of src.matchAll(/^\s*register(View|Skin|Event|Theme|MapBuilder)\(\s*'([^']+)'/gm)) {
      const key = `${kind}:${name}`;
      if (seen.has(key)) dupes.push(`${key} in ${seen.get(key)} and ${f}`);
      else seen.set(key, f);
    }
  }
  assert.deepEqual(dupes, []);
});

test('every minigame id is unique', async () => {
  const { MINIGAMES } = await import('../server/minigames/index.js');
  const ids = MINIGAMES.map((m) => m.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
});
