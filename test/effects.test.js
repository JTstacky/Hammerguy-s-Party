import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.location = { search: '?touch=0' };
globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} }) }) };
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
const { Particles, SpriteParticles, Effects } = await import('../engine/client/render/effects.js');

for (const sprite of [false, true]) {
  test(`${sprite ? 'sprite' : 'plain'} particles compact every array and update the moved particle once`, () => {
    const make = () => sprite ? new SpriteParticles(new THREE.Scene(), { file: '', max: 4, cols: 4 }) : new Particles(new THREE.Scene(), THREE.AdditiveBlending);
    const spawn = (pool, n, life) => sprite
      ? pool.spawn(n, n + 1, n + 2, { vx: n, vy: 2, vz: 3, color: '#abcdef', size: n, life, grow: 2, spin: 3, frame: 1, anim: 3, alpha: 0.8, fadeIn: 0.2, grav: 4, drag: 0.2, rot: 0.4 })
      : pool.spawn(n, n + 1, n + 2, n, 2, 3, new THREE.Color('#abcdef'), n, life, 4, 0.2);
    const pool = make(), expected = make();
    spawn(pool, 1, 0.01);
    spawn(pool, 2, 0.01);
    spawn(pool, 3, 2);
    spawn(expected, 3, 2);
    pool.update(0.1);
    expected.update(0.1);
    assert.equal(pool.count, 1);
    for (const [key, array] of Object.entries(pool)) {
      if (!(array instanceof Float32Array)) continue;
      const stride = array.length / pool.max;
      assert.deepEqual(array.slice(0, stride), expected[key].slice(0, stride), key);
    }
    assert.equal(pool.geo.drawRange.count, 1);
    for (const attr of Object.values(pool.geo.attributes)) assert.deepEqual(attr.updateRanges, [{ start: 0, count: attr.itemSize }]);
    const colorVersion = pool.geo.attributes.color.version;
    pool.update(0.1);
    assert.equal(pool.geo.attributes.color.version, colorVersion, 'unchanged color is not uploaded');
    pool.life[pool.max - 1] = 10;
    pool.update(0.1);
    assert.equal(pool.life[pool.max - 1], 10, 'dead capacity is not scanned');
    const posVersion = pool.geo.attributes.position.version;
    pool.update(3);
    assert.equal(pool.count, 0);
    assert.equal(pool.points.visible, false);
    assert.equal(pool.geo.drawRange.count, 0);
    assert.equal(pool.geo.attributes.position.version, posVersion, 'no final empty upload');
    spawn(pool, 4, 1);
    pool.update(0);
    assert.equal(pool.pos[0], 4);
    assert.equal(pool.points.visible, true);
  });
}

test('full sprite pools replace a slot without growing and still sprites skip frame/rotation uploads', () => {
  const p = new SpriteParticles(new THREE.Scene(), { file: '', max: 2 });
  for (let i = 0; i < 3; i++) p.spawn(i, 0, 0, { life: 2, rot: 0, frame: 0 });
  p.update(0.1);
  assert.equal(p.count, 2);
  assert.ok([...p.pos].includes(2));
  const versions = ['color', 'rot', 'frame'].map((k) => p.geo.attributes[k].version);
  p.update(0.1);
  assert.deepEqual(['color', 'rot', 'frame'].map((k) => p.geo.attributes[k].version), versions);
});

for (const clear of [false, true]) {
  test(`effects ${clear ? 'clear' : 'expiry'} disposes child materials and private geometry only`, () => {
    const scene = new THREE.Scene();
    const fx = new Effects(scene, {}, new THREE.PerspectiveCamera());
    fx.ring(0, 0, 1, '#fff');
    fx.scorch(0, 0);
    fx.bolt(0, 0, 1, 1);
    fx.flash(0, 0, 1, '#fff');
    let materials = 0, tubes = 0, shared = 0, removedText = 0;
    for (const tr of fx.transients) tr.obj.traverse((o) => {
      o.material?.addEventListener('dispose', () => materials++);
      if (o.geometry?.type === 'TubeGeometry') o.geometry.addEventListener('dispose', () => tubes++);
    });
    for (const resource of [fx.ringGeo, fx.decalGeo, fx.scorchTex]) resource.addEventListener('dispose', () => shared++);
    fx.texts.push({ t: 0, dur: 1, pos: new THREE.Vector3(), el: { style: {}, remove() { removedText++; } } });
    const transients = fx.transients, texts = fx.texts;
    for (const p of [fx.add, fx.norm, ...Object.values(fx.sp)]) {
      if (p instanceof Particles) p.spawn(0, 0, 0, 0, 0, 0, new THREE.Color(), 1, 2);
      else p.spawn(0, 0, 0, { life: 2 });
    }
    if (clear) fx.clear();
    else fx.update(10, 100, 100);
    assert.equal(materials, 4);
    assert.equal(tubes, 2);
    assert.equal(shared, 0);
    assert.equal(removedText, 1);
    assert.equal(fx.transients, transients);
    assert.equal(fx.texts, texts);
    assert.equal(transients.length, 0);
    assert.equal(texts.length, 0);
    assert.ok(fx.lightPool.every((l) => !l.userData.busy));
    for (const p of [fx.add, fx.norm, ...Object.values(fx.sp)]) {
      assert.equal(p.count, 0);
      assert.equal(p.geo.drawRange.count, 0);
      assert.equal(p.points.visible, false);
      p.update(0.01);
      assert.equal(p.count, 0);
    }
  });
}
