import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bakeModel } from '../engine/client/render/batch.js';
import { SKINS } from '../engine/client/render/registry.js';

// Models use the renderer's device module, but need no canvas or textures.
globalThis.location = { search: '?touch=0' };
const { grunt } = await import('../client/views/grunt.js');
const { satyr } = await import('../client/views/satyr.js');

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

for (const [name, make] of [['grunt', grunt], ['satyr', satyr]]) {
  test(`${name}: batching preserves geometry and independently animated pivots`, () => {
    assert.equal(SKINS.get(name), make);
    const a = make('#ed3020');
    const b = make('#2050ed');
    const before = stats(a);
    assert.ok(before.triangles <= 9000, `${before.triangles} triangles`);
    assert.ok(before.materials.size <= 12);
    assert.ok([...before.materials].every((m) => m.userData.shared));
    const box = new THREE.Box3().setFromObject(a);
    assert.ok(box.min.y >= -0.05 && box.max.y > 2 && box.max.y < 3);
    const first = a.getObjectByProperty('isMesh', true);
    assert.equal(first.geometry, b.getObjectByProperty('isMesh', true).geometry, 'clones share template geometry');
    bakeModel(a);
    assert.equal(stats(a).triangles, before.triangles);
    assert.equal(stats(a).materials.size, before.materials.size);
    assert.equal(a.userData.body.scale.x, 1.45);
    for (const key of ['body', 'staff', 'legL', 'legR']) {
      const pivot = a.userData[key];
      assert.ok(pivot?.isGroup, key);
      assert.notEqual(pivot, b.userData[key]);
      assert.ok(pivot.children.some((o) => o.isMesh), `${key} retains baked meshes`);
      const otherRotation = b.userData[key].rotation.toArray();
      pivot.rotation[key === 'staff' ? 'x' : 'z'] = 0.6;
      assert.deepEqual(b.userData[key].rotation.toArray(), otherRotation, `${key} does not move another player`);
    }
    const red = [...stats(a).materials].find((m) => m.color.getHexString() === 'ed3020');
    assert.ok(red, 'team colour survives batching');
    assert.ok(!stats(b).materials.has(red), 'team colour does not leak between players');
    const c = make('#ed3020');
    assert.equal(c.getObjectByProperty('isMesh', true).geometry, first.geometry, 'baking leaves template intact');
  });
}
