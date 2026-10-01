import test from 'node:test';import assert from 'node:assert/strict';
import { RampageWithWolves, WOLVES, LAYOUT, walkable } from '../server/minigames/ux/056-wolves.js';import { game } from './ux2-common.js';
test('wolves: 28 wolves, eight grass, sheep and kill radius',()=>{const g=game(RampageWithWolves);assert.equal(g.wolves.length,28);assert.equal(g.grass.length,8);assert.equal(g.heroes.get(1).hp,15);assert.equal(WOLVES.kill,80/54);});
test('wolves: finishing pays 8, 7; unplaced pays zero',()=>{const g=game(RampageWithWolves,3);g.finish(1);g.finish(2);assert.deepEqual([...g.payouts().values()],[8,7,0]);});
test('wolves: caught carrier drops a patch of grass',()=>{const g=game(RampageWithWolves);const u=g.heroes.get(1);u.carry=true;g.grass.forEach(v=>v.taken=true);g.wolves[0].x=u.x;g.wolves[0].y=u.y;g.time=5;g.tick(1/30);assert.equal(u.alive,false);assert.equal(g.grass.length,9);assert.equal(g.grass[8].taken,false);});
test('wolves: sheep start in the south (bottom), the grass is in the far north (top)', () => {
  const g = game(RampageWithWolves);
  for (const u of g.heroes.values()) assert.ok(u.y > LAYOUT.WALL_S, 'south of the gate wall');
  for (const p of g.grass) assert.ok(p.y < LAYOUT.FIELD_N, 'up the corridor');
  assert.ok(LAYOUT.CIRCLE[1] > LAYOUT.WALL_S);
});
test('wolves: the 28 wolves spread over the whole camp, both fields and the middle', () => {
  const g = game(RampageWithWolves);
  const south = g.wolves.filter((w) => w.y > LAYOUT.WALL_S).length;
  const north = g.wolves.filter((w) => w.y < LAYOUT.WALL_N).length;
  const middle = g.wolves.filter((w) => Math.abs(w.x) < 6).length;
  assert.ok(south >= 4 && north >= 4 && middle >= 4, `south ${south}, north ${north}, middle ${middle}`);
  for (const w of g.wolves) assert.ok(walkable(w.x, w.y));
});
test('wolves: the gate wall only lets you through the 640 gap', () => {
  assert.equal(walkable(0, (LAYOUT.WALL_S + LAYOUT.WALL_N) / 2), true);
  assert.equal(walkable(LAYOUT.FX0 + 1, (LAYOUT.WALL_S + LAYOUT.WALL_N) / 2), false);
});
