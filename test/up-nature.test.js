// Nature's Circle (#30) against docs/uther-party/rules-4.0.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NaturesCircle, FORMS, MORPH_COST } from '../server/minigames/up/30-nature.js';
import { wc3 } from '../engine/server/sim.js';

const party = () => ({ room: { isBot: () => false, nameOf: (p) => `P${p}`, colorOf: () => '#fff' }, msg() {}, ev() {} });
const dt = 1 / 30;
const run = (g, secs) => {
  for (let t = 0; t < secs; t += dt) {
    g.time += dt;
    g.tick(dt);
  }
};
const QUILL = 0;
const HAWK = 1;
const BEAR = 2;

test('nature: druid 250 HP, 100 mana; forms 300/200/150 HP at 320/300/350', () => {
  const g = new NaturesCircle(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  assert.equal(u.hp, 250);
  assert.equal(g.mana.get(1), 100);
  assert.deepEqual([FORMS.bear.hp, FORMS.quill.hp, FORMS.hawk.hp], [300, 200, 150]);
  assert.deepEqual([FORMS.bear.speed, FORMS.quill.speed, FORMS.hawk.speed], [wc3(320), wc3(300), wc3(350)]);
  assert.deepEqual([FORMS.bear.atk.range, FORMS.quill.atk.range, FORMS.hawk.atk.range], [wc3(128), wc3(550), wc3(300)]);
});

test('nature: a morph keeps HP %, empties mana, and the next is ready 6.7 s later', () => {
  const g = new NaturesCircle(party(), [1, 2]);
  g.setup();
  const u = g.heroes.get(1);
  u.hp = 125; // 50 %
  g.command(1, { c: 'cast', slot: BEAR });
  assert.equal(u.form, 'bear');
  assert.equal(u.hp, 150);
  assert.equal(g.mana.get(1), 0);
  g.command(1, { c: 'cast', slot: HAWK });
  assert.equal(u.form, 'bear', 'no mana');
  g.command(1, { c: 'cast', slot: BEAR });
  assert.equal(u.form, 'bear');
  run(g, 6.6);
  g.command(1, { c: 'cast', slot: HAWK });
  assert.equal(u.form, 'bear', 'not yet');
  run(g, 0.15);
  assert.ok(g.mana.get(1) >= MORPH_COST);
  g.command(1, { c: 'cast', slot: HAWK });
  assert.equal(u.form, 'hawk');
  assert.ok(Math.abs(u.hp - 75) < 1);
});

test('nature: the counter triangle (damage per hit from the 1.26 table)', () => {
  const g = new NaturesCircle(party(), [1, 2]);
  g.setup();
  const b = g.heroes.get(2);
  const per = (atk, def) => {
    g.setForm(b, def, 1);
    b.hp = 1000;
    b.maxHp = 1000;
    const vals = [];
    for (let i = 0; i < 200; i++) {
      b.hp = 1000;
      const hp0 = b.hp;
      g.hit(1, FORMS[atk].atk, b);
      vals.push(hp0 - b.hp);
    }
    return [Math.min(...vals), Math.max(...vals)];
  };
  const within = ([lo, hi], a, z) => lo >= a - 0.05 && hi <= z + 0.05;
  assert.ok(within(per('bear', 'quill'), 28.5, 31.5), 'bear -> quill');
  assert.ok(within(per('quill', 'bear'), 13, 15), 'quill -> bear');
  assert.ok(within(per('quill', 'hawk'), 22, 25.5), 'quill -> hawk');
  assert.ok(within(per('hawk', 'quill'), 15.7, 18.8), 'hawk -> quill');
  assert.ok(within(per('hawk', 'bear'), 42, 50), 'hawk -> bear');
});

test('nature: bears cannot attack hawks; everyone else can', () => {
  const g = new NaturesCircle(party(), [1, 2]);
  g.setup();
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  g.setForm(a, 'bear', 1);
  g.setForm(b, 'hawk', 1);
  assert.equal(g.attackables(1).length, 0);
  g.setForm(a, 'quill', 1);
  assert.equal(g.attackables(1).length, 1);
  g.setForm(a, 'druid', 1);
  assert.equal(FORMS.druid.atk, null, 'druids have no attack');
});

test('nature: changing form drops every attack aimed at you', () => {
  const g = new NaturesCircle(party(), [1, 2]);
  g.setup();
  const a = g.heroes.get(1);
  const b = g.heroes.get(2);
  g.setForm(a, 'quill', 1);
  [a.x, a.y] = [-3, 0];
  [b.x, b.y] = [3, 0];
  g.command(1, { c: 'move', x: b.x, y: b.y });
  assert.equal(a.attackOrder, b);
  g.command(2, { c: 'cast', slot: BEAR });
  assert.equal(a.attackOrder, null);
});

test('nature: a quillbeast kills a hawk in about 7 hits; survivors at 120 s share the ante', () => {
  const g = new NaturesCircle(party(), [1, 2, 3]);
  g.setup();
  const [a, b, c] = [1, 2, 3].map((p) => g.heroes.get(p));
  g.setForm(a, 'quill', 1);
  g.setForm(b, 'hawk', 1);
  [a.x, a.y] = [-4, 0];
  [b.x, b.y] = [4, 0];
  [c.x, c.y] = [0, 9];
  b.stun = 100;
  g.command(1, { c: 'move', x: b.x, y: b.y });
  run(g, 1.5 * 5.5);
  assert.equal(b.alive, true, 'not after 6 hits');
  run(g, 3.2);
  assert.equal(b.alive, false, 'dead by the 7th or 8th');
  g.time = 120;
  assert.ok(g.isDone());
  const pts = g.payouts();
  assert.equal(pts.get(1), pts.get(3));
  assert.equal(pts.get(2), 6);
});
