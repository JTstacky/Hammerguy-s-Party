// Shared unit parts for the port/F games: a WC3 dwarf (Mortar Team crew,
// Flying Machine pilot) and per-material merging for instanced crowds.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as M from '../../engine/client/render/models.js';

export const skinMat = () => M.mat('#e8b090', { roughness: 0.7 });
export const ironMat = () => M.mat('#4a4a50', { metalness: 0.7, roughness: 0.4 });
export const brassMat = () => M.mat('#c89a40', { metalness: 0.75, roughness: 0.35 });

// A stocky dwarf about 0.95 tall facing +X: a team-coloured tunic, a big
// beard, an iron helm. Returns the group and its leg and arm pivots, which
// the caller lists in the skin's userData.
export function dwarf(color, { beard = '#b8682c', helm = true } = {}) {
  const g = new THREE.Group();
  const team = M.mat(color, { roughness: 0.6 });
  const leather = M.leatherMat();
  const legs = [];
  for (const s of [1, -1]) {
    const hip = new THREE.Group();
    hip.position.set(0, 0.34, 0.1 * s);
    hip.add(M.mesh(M.tube([[0, 0, 0], [0.01, -0.16, 0], [0, -0.28, 0]], 0.075, 0.065, 3, 7), leather));
    hip.add(M.mesh(M.scaled(M.G.sphere, 0.1, 0.06, 0.08), M.mat('#3a2a1c', { roughness: 0.8 }), 0.04, -0.3, 0));
    g.add(hip);
    legs.push(hip);
  }
  // Tunic (team colour) with a belt.
  g.add(M.mesh(M.lathe([[0.001, 0.3], [0.2, 0.3], [0.23, 0.42], [0.22, 0.6], [0.17, 0.72], [0.001, 0.74]], 12), team));
  g.add(M.mesh(new THREE.TorusGeometry(0.215, 0.03, 5, 14).rotateX(Math.PI / 2), leather, 0, 0.44, 0));
  g.add(M.mesh(M.scaled(M.G.box, 0.05, 0.06, 0.08), M.goldMat(), 0.21, 0.44, 0));
  // Head, nose, beard, helm.
  g.add(M.mesh(M.scaled(M.G.sphere, 0.14, 0.15, 0.14), skinMat(), 0.03, 0.85, 0));
  g.add(M.mesh(M.scaled(M.G.sphere, 0.045, 0.04, 0.04), M.mat('#d89878'), 0.16, 0.84, 0));
  g.add(M.mesh(M.blob(0.12, 0.17, 0.15, { seed: 77, amt: 0.15, detail: 1 }), M.mat(beard, { roughness: 0.9 }), 0.12, 0.7, 0));
  if (helm) {
    g.add(M.mesh(M.lathe([[0.001, 0.2], [0.13, 0.19], [0.16, 0.1], [0.165, 0.0]], 12), ironMat(), 0.02, 0.86, 0));
    g.add(M.mesh(new THREE.TorusGeometry(0.16, 0.02, 4, 14).rotateX(Math.PI / 2), brassMat(), 0.02, 0.87, 0));
  }
  const arms = [];
  for (const s of [1, -1]) {
    const sh = new THREE.Group();
    sh.position.set(0.02, 0.66, 0.22 * s);
    sh.add(M.mesh(M.tube([[0, 0, 0], [0.08, -0.12, 0.02 * s], [0.18, -0.2, 0]], 0.065, 0.05, 3, 6), team));
    sh.add(M.mesh(M.scaled(M.G.sphere, 0.055), skinMat(), 0.2, -0.21, 0));
    g.add(sh);
    arms.push(sh);
  }
  return { g, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1] };
}

// Bakes a model into one geometry per material (in the model's own space),
// for InstancedMesh crowds.
export function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(o.matrixWorld);
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(g);
  });
  const out = [];
  for (const [material, geos] of buckets) {
    const geo = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    out.push({ geo, material });
  }
  return out;
}
