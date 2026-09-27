// Blended ground, the way WC3 terrain looks: the arena is a patch of one tile
// type painted into another, with ragged, noisy borders and a worn band of a
// third tile where they meet, instead of a hard-edged plane and a curb.
// One big plane. The blend is computed once per map on the CPU into a small
// mask texture (outside / band / light patches), so the fragment shader only
// samples textures: cheap enough for phones.

import * as THREE from 'three';
import { fxTexture } from './effects.js';
import { LITE } from '../device.js';

// Value noise and fBm (same shapes the shader version used).
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(x, y) {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < 4; i++) {
    v += a * noise(x, y);
    x = x * 2.03 + 17;
    y = y * 2.03 + 17;
    a *= 0.5;
  }
  return v;
}
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Signed distance to the arena edge: < 0 inside. Rects get rounded corners.
function arenaDist(shape, x, y) {
  if (shape.shape === 'disc') return Math.hypot(x, y) - shape.r;
  const hw = shape.w / 2;
  const hh = shape.h / 2;
  const r = Math.min(2, Math.min(hw, hh) * 0.25);
  const qx = Math.abs(x) - hw + r;
  const qy = Math.abs(y) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

// R: how far outside the arena (0 floor, 1 outer tile), G: the worn border
// band, B: large light/dark patches that hide the tile repeat.
// Built on the main thread at each map change, so it is kept cheap: the edge
// noise is only evaluated near the edge (elsewhere it cannot change the
// result), and the very low-frequency light patches are sampled every 4 px
// and filled in bilinearly. Same output as evaluating everything per pixel,
// within a few levels of B; 4-10x faster.
const WOB = 1.65; // fbm stays within [0, 0.94), so the edge wobble is at most 1.2 + 0.45
const LSTEP = 4;
function blendMask(shape, extent, edgeW, res) {
  const data = new Uint8Array(res * res * 4);
  const px = (2 * extent) / res;
  const at = (i) => (i + 0.5) * px - extent;
  const gn = Math.ceil(res / LSTEP) + 1;
  const light = new Float32Array(gn * gn);
  for (let gj = 0; gj < gn; gj++) for (let gi = 0; gi < gn; gi++) light[gj * gn + gi] = fbm(at(gi * LSTEP) * 0.07 + 3, at(gj * LSTEP) * 0.07 + 3);
  // Beyond this distance from the edge, neither the blend nor the band can show.
  const far = WOB + Math.max(0.35, 2.4 * edgeW);
  for (let j = 0; j < res; j++) {
    const y = at(j);
    const gj = Math.floor(j / LSTEP);
    const fy = (j - gj * LSTEP) / LSTEP;
    for (let i = 0; i < res; i++) {
      const x = at(i);
      const d0 = arenaDist(shape, x, y);
      const o = (j * res + i) * 4;
      if (d0 < -far || d0 > far) {
        data[o] = d0 > 0 ? 255 : 0;
      } else {
        const wob = (fbm(x * 0.22, y * 0.22) - 0.5) * 2.4 + (fbm(x * 1.1 + 5, y * 1.1 + 5) - 0.5) * 0.9;
        const d = d0 + wob;
        const band = Math.exp(-((d / edgeW) ** 2)) * smooth(0.3, 0.7, fbm(x * 0.35 + 11, y * 0.35 + 11) + 0.12 + 0.15 * noise(x * 2.3, y * 2.3));
        data[o] = smooth(-0.35, 0.35, d) * 255;
        data[o + 1] = Math.min(0.9, band) * 255;
      }
      const gi = Math.floor(i / LSTEP);
      const fx = (i - gi * LSTEP) / LSTEP;
      const k = gj * gn + gi;
      const l0 = light[k] + (light[k + 1] - light[k]) * fx;
      const l1 = light[k + gn] + (light[k + gn + 1] - light[k + gn]) * fx;
      data[o + 2] = (l0 + (l1 - l0) * fy) * 255;
      data[o + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, res, res);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

// A 1x1 placeholder so every sampler is valid before the painted tiles load.
function solid(hex) {
  const c = new THREE.Color(hex);
  const t = new THREE.DataTexture(new Uint8Array([c.r * 255, c.g * 255, c.b * 255, 255]), 1, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// layers: { floor, edge, outer } each { tex: file, tint, color (fallback), units }
// shape: { shape: 'rect', w, h } | { shape: 'disc', r }. `extent`: half-size of
// the area the blend covers (beyond it, it's all outer tile).
export function blendedGround(layers, shape, extent = 60, size = 240) {
  const res = LITE ? 384 : 512;
  const uniforms = {
    tMask: { value: blendMask(shape, extent, layers.edgeWidth ?? 1.1, res) },
    uExtent: { value: extent },
    tFloor: { value: solid(layers.floor.color) },
    tEdge: { value: solid(layers.edge.color) },
    tOuter: { value: solid(layers.outer.color) },
    cFloor: { value: new THREE.Color(layers.floor.tint || '#ffffff') },
    cEdge: { value: new THREE.Color(layers.edge.tint || '#ffffff') },
    cOuter: { value: new THREE.Color(layers.outer.tint || '#ffffff') },
    sFloor: { value: 1 / (layers.floor.units || 8) },
    sEdge: { value: 1 / (layers.edge.units || 7) },
    sOuter: { value: 1 / (layers.outer.units || 11) },
  };
  for (const k of ['floor', 'edge', 'outer']) {
    const L = layers[k];
    if (!L.tex) continue;
    const name = `t${k[0].toUpperCase()}${k.slice(1)}`;
    fxTexture(L.tex, (t) => (uniforms[name].value = t), { repeat: true });
  }
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGround;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = (modelMatrix * vec4(position, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vGround;
        uniform sampler2D tMask, tFloor, tEdge, tOuter;
        uniform vec3 cFloor, cEdge, cOuter;
        uniform float sFloor, sEdge, sOuter, uExtent;`)
      .replace('#include <map_fragment>', `
        vec2 wp = vGround;
        vec3 m = texture2D(tMask, wp / (2.0 * uExtent) + 0.5).rgb;
        vec3 floorC = texture2D(tFloor, wp * sFloor).rgb * cFloor;
        vec3 outerC = texture2D(tOuter, wp * sOuter + 0.37).rgb * cOuter;
        vec3 edgeC = texture2D(tEdge, wp * sEdge + 0.71).rgb * cEdge;
        vec3 g = mix(mix(floorC, outerC, m.r), edgeC, m.g);
        g *= 0.84 + 0.32 * m.b;
        diffuseColor.rgb *= g;`);
  };
  mat.customProgramCacheKey = () => 'blendedGround2';
  mat.userData.dispose = () => uniforms.tMask.value.dispose();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1).rotateX(-Math.PI / 2), mat);
  mesh.receiveShadow = true;
  return mesh;
}
