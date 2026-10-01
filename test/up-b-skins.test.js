// Player-unit skins of the batch-B ports: budget, cached materials, and that
// baking keeps every animated part (userData body/legs/staff/anim) separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// Textured materials start an image load; a tiny DOM stub makes that a no-op
// (node --test runs each file in its own process, so this stays here).
const noop = () => {};
const el = () => ({ addEventListener: noop, removeEventListener: noop, setAttribute: noop, style: {}, getContext: () => null, appendChild: noop });
globalThis.document ??= { createElementNS: el, createElement: el, body: el() };
globalThis.location ??= { search: '?touch=0' };
const { SKINS } = await import('../engine/client/render/registry.js');
const { bakeModel } = await import('../client/views/walkgrid-art.js');
await import('../client/views/huntress.js');
await import('../client/views/blinky.js');
await import('../client/views/skink.js');
await import('../client/views/trolls.js');
await import('../client/views/hermitcrab.js');

function stats(g) {
  let triangles = 0;
  const materials = new Set();
  g.traverse((o) => {
    if (!o.isMesh) return;
    triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    materials.add(o.material);
  });
  return { triangles, materials };
}

const parts = (ud) => [ud.body, ud.legL, ud.legR, ud.staff, ...(ud.anim || [])].filter(Boolean);

for (const name of ['huntress', 'grizzly', 'skink', 'witchdoctor', 'hermitcrab', 'foresttroll']) {
  test(`skin ${name}: within budget, cached materials, animated parts survive baking`, () => {
    const make = SKINS.get(name);
    assert.ok(make, 'registered');
    const a = make('#ed3020');
    const b = make('#2050ed');
    const before = stats(a);
    assert.ok(before.triangles <= 9000, `${before.triangles} triangles`);
    assert.ok(before.materials.size <= 12, `${before.materials.size} materials`);
    const bm = stats(b).materials;
    const shared = [...before.materials].filter((m) => bm.has(m));
    assert.ok(shared.length >= before.materials.size - 1, 'only the team colour differs between players');
    const box = new THREE.Box3().setFromObject(a);
    assert.ok(box.min.y >= -0.1 && box.max.y > 0.6 && box.max.y < 3.2, `height ${box.max.y.toFixed(2)}`);
    assert.ok(a.userData.body?.isObject3D);
    if (!a.userData.legL) assert.equal(typeof a.userData.tick, 'function', 'four-legged skins animate themselves');
    bakeModel(a);
    const after = stats(a);
    assert.equal(after.triangles, before.triangles);
    assert.equal(after.materials.size, before.materials.size);
    for (const p of parts(a.userData)) {
      assert.ok(p.isObject3D && p.parent, 'still in the tree');
      let up = p;
      while (up.parent) up = up.parent;
      assert.equal(up, a);
    }
    const red = [...after.materials].find((m) => m.color?.getHexString() === 'ed3020');
    assert.ok(red, 'team colour survives batching');
    // A tick runs without allocating state errors, moving or dead.
    const v = { id: 1, walk: 1, deadT: 0.2 };
    a.userData.tick?.(1 / 30, v, { mv: 1 }, { time: 1 });
    a.userData.tick?.(1 / 30, v, { dead: 1 }, { time: 1 });
  });
}
