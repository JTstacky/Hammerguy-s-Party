// Blended ground, the way WC3 terrain looks: the arena is a patch of one tile
// type painted into another, with ragged, noisy borders and a worn band of a
// third tile where they meet, instead of a hard-edged plane and a curb.
// One big plane; the fragment shader picks the tile per pixel from the
// arena's signed distance plus noise.

import * as THREE from 'three';
import { fxTexture } from './effects.js';

const NOISE = /* glsl */ `
  float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float tNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), f.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float tFbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * tNoise(p); p = p * 2.03 + 17.0; a *= 0.5; } return v; }
`;

// A 1x1 placeholder so every sampler is valid before the painted tiles load.
function solid(hex) {
  const c = new THREE.Color(hex);
  const t = new THREE.DataTexture(new Uint8Array([c.r * 255, c.g * 255, c.b * 255, 255]), 1, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// layers: { floor, edge, outer } each { tex: file, tint, color (fallback), units }
// shape: { shape: 'rect', w, h } | { shape: 'disc', r }
export function blendedGround(layers, shape, size = 240) {
  const uniforms = {
    tFloor: { value: solid(layers.floor.color) },
    tEdge: { value: solid(layers.edge.color) },
    tOuter: { value: solid(layers.outer.color) },
    cFloor: { value: new THREE.Color(layers.floor.tint || '#ffffff') },
    cEdge: { value: new THREE.Color(layers.edge.tint || '#ffffff') },
    cOuter: { value: new THREE.Color(layers.outer.tint || '#ffffff') },
    sFloor: { value: 1 / (layers.floor.units || 8) },
    sEdge: { value: 1 / (layers.edge.units || 7) },
    sOuter: { value: 1 / (layers.outer.units || 11) },
    uShape: { value: shape.shape === 'disc' ? 1 : 0 },
    uSize: { value: shape.shape === 'disc' ? new THREE.Vector2(shape.r, shape.r) : new THREE.Vector2(shape.w / 2, shape.h / 2) },
    uEdgeW: { value: layers.edgeWidth ?? 1.1 },
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
        uniform sampler2D tFloor, tEdge, tOuter;
        uniform vec3 cFloor, cEdge, cOuter;
        uniform float sFloor, sEdge, sOuter, uEdgeW;
        uniform int uShape;
        uniform vec2 uSize;
        ${NOISE}
        // Signed distance to the arena edge: < 0 inside. Rects get rounded corners.
        float arenaDist(vec2 p) {
          if (uShape == 1) return length(p) - uSize.x;
          float r = min(2.0, min(uSize.x, uSize.y) * 0.25);
          vec2 q = abs(p) - uSize + r;
          return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
        }`)
      .replace('#include <map_fragment>', `
        vec2 wp = vGround;
        // Two octaves of wobble: big lobes and small ragged teeth along the border.
        float wob = (tFbm(wp * 0.22) - 0.5) * 2.4 + (tFbm(wp * 1.1 + 5.0) - 0.5) * 0.9;
        float d = arenaDist(wp) + wob;
        vec3 floorC = texture2D(tFloor, wp * sFloor).rgb * cFloor;
        vec3 outerC = texture2D(tOuter, wp * sOuter + 0.37).rgb * cOuter;
        vec3 edgeC = texture2D(tEdge, wp * sEdge + 0.71).rgb * cEdge;
        float outside = smoothstep(-0.35, 0.35, d);
        vec3 g = mix(floorC, outerC, outside);
        // The worn band where the two tiles meet, patchy along its length.
        float band = exp(-pow(d / uEdgeW, 2.0)) * smoothstep(0.3, 0.7, tFbm(wp * 0.35 + 11.0) + 0.12 + 0.15 * tNoise(wp * 2.3));
        g = mix(g, edgeC, clamp(band, 0.0, 0.9));
        // Large-scale light and dark patches hide the tile repeat.
        g *= 0.84 + 0.32 * tFbm(wp * 0.07 + 3.0);
        diffuseColor.rgb *= g;`);
  };
  mat.customProgramCacheKey = () => 'blendedGround';
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1).rotateX(-Math.PI / 2), mat);
  mesh.receiveShadow = true;
  return mesh;
}
