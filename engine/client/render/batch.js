// Static batching: merges every mesh under `root` that shares a material into
// one mesh, in world space. A forest of 150 trees (5 meshes each) becomes a
// handful of draw calls, which is most of the frame on a phone. Anything
// animated must not be under `root` (or must set userData.dynamic).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// mergeGeometries needs all-indexed or all-plain inputs. Keep the indices when
// every part has them (shared vertices: about a third of the vertex work).
function sameIndexing(geos) {
  if (geos.every((g) => g.index)) return geos;
  return geos.map((g) => (g.index ? g.toNonIndexed() : g));
}

export function bakeStatic(root, { castShadow = true } = {}) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const drop = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.dynamic) return;
    const g = o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.morphAttributes = {};
    g.applyMatrix4(o.matrixWorld);
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(g);
    drop.push(o);
  });
  for (const o of drop) o.parent?.remove(o);
  // Empty groups left behind are harmless; remove top-level ones to keep the tree small.
  for (const c of [...root.children]) if (c.isGroup && !c.children.length) root.remove(c);
  for (const [material, geos] of buckets) {
    const merged = mergeGeometries(sameIndexing(geos), false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const m = new THREE.Mesh(merged, material);
    m.castShadow = castShadow;
    m.receiveShadow = true;
    root.add(m);
  }
}

// Merges a unit model's static parts per material, so a hero is a handful of
// draw calls instead of fifty. Anything the animation code moves is listed in
// the model's userData (body, legs, staff, wings...); each of those keeps its
// own transform, and the meshes under it merge into it. Transparent and
// additive materials are left alone (their opacity is animated).
// flat: true goes further for units that come in crowds (crew, creeps): every
// plain material under an animated part folds into ONE vertex-coloured mesh,
// so a part is one draw call whatever it is made of. Textures and metalness
// are lost (invisible at RTS distance); glowing materials stay separate.
const FLAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 });
FLAT.userData.shared = true;
const glows = (m) => m.emissive && m.emissiveIntensity > 0 && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.05;

export function bakeModel(root, { flat = false } = {}) {
  const anim = new Set([root]);
  const note = (v) => {
    if (v?.isObject3D) anim.add(v);
    else if (Array.isArray(v)) v.forEach(note);
  };
  for (const v of Object.values(root.userData)) note(v);
  root.updateMatrixWorld(true);
  const owners = new Map(); // owner -> Map(material -> geos)
  const drop = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || anim.has(o)) return;
    if (o.material.transparent || o.material.blending === THREE.AdditiveBlending) return;
    let owner = o.parent;
    while (!anim.has(owner)) owner = owner.parent;
    // Transform into the owner's space.
    const m = new THREE.Matrix4().copy(owner.matrixWorld).invert().multiply(o.matrixWorld);
    const g = o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.morphAttributes = {};
    g.applyMatrix4(m);
    let key = o.material;
    if (flat && !glows(o.material) && o.material.color) {
      key = FLAT;
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      // Textured materials keep their average colour (their .color is the texture tint).
      const { r, g: gg, b: bb } = o.material.userData.base || o.material.color;
      for (let i = 0; i < n; i++) col.set([r, gg, bb], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    if (!owners.has(owner)) owners.set(owner, new Map());
    const b = owners.get(owner);
    if (!b.has(key)) b.set(key, { geos: [], cast: false });
    const e = b.get(key);
    e.geos.push(g);
    e.cast ||= o.castShadow;
    drop.push(o);
  });
  for (const o of drop) {
    // Keep any children (e.g. an animated part hung off a static mesh).
    for (const c of [...o.children]) o.parent.attach(c);
    o.parent.remove(o);
  }
  for (const [owner, b] of owners) {
    for (const [material, { geos, cast }] of b) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(sameIndexing(geos), false);
      if (geos.length > 1) for (const g of geos) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mm = new THREE.Mesh(merged, material);
      mm.castShadow = cast;
      mm.userData.baked = true; // own geometry: dispose with the view
      mm.receiveShadow = true;
      owner.add(mm);
    }
  }
  return root;
}
