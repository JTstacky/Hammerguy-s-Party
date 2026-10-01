// Shared client pieces for the race ports (Roadkill, Stop and Go, Push the
// Ogre, Horse Race, Quillboar Mile, Flight of the Footmen): WC3's Circle of
// Power finish marker, rugged cliff blocks, and a frame-rate independent
// particle emitter. Registers nothing itself.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as M from '../../engine/client/render/models.js';
import { fxTexture } from '../../engine/client/render/effects.js';
import { FX_DENSITY } from '../../engine/client/device.js';

// Fixed-rate emission: how many particles `rate` per second owes this frame.
export function emit(v, key, rate, dt) {
  const acc = (v.emit ??= {});
  acc[key] = (acc[key] || 0) + rate * FX_DENSITY * dt;
  const n = Math.floor(acc[key]);
  acc[key] -= n;
  return n;
}

// ------------------------------------------------------------ Circle of Power

// The rune ring painted on WC3's Circle of Power: an outer band of glyphs, a
// thin inner ring and a star, white on black for additive blending.
let runeTex = null;
function runeTexture() {
  if (runeTex) return runeTex;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  g.translate(S / 2, S / 2);
  g.strokeStyle = '#fff';
  g.shadowColor = '#fff';
  g.shadowBlur = 6;
  const ring = (r, w, a = 1) => {
    g.globalAlpha = a;
    g.lineWidth = w;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
  };
  ring(118, 5);
  ring(96, 3);
  ring(62, 2, 0.8);
  // Glyphs between the two outer rings.
  g.globalAlpha = 0.95;
  g.lineWidth = 3;
  let s = 7;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 16; i++) {
    g.save();
    g.rotate((i / 16) * Math.PI * 2);
    g.translate(0, -107);
    g.beginPath();
    const k = Math.floor(rnd() * 4);
    if (k === 0) {
      g.moveTo(-5, 6);
      g.lineTo(0, -6);
      g.lineTo(5, 6);
    } else if (k === 1) {
      g.moveTo(-5, -5);
      g.lineTo(5, 5);
      g.moveTo(5, -5);
      g.lineTo(-5, 5);
    } else if (k === 2) {
      g.moveTo(0, -6);
      g.lineTo(0, 6);
      g.moveTo(-5, 0);
      g.lineTo(5, -4);
    } else {
      g.arc(0, 0, 4.5, 0, Math.PI * 1.5);
    }
    g.stroke();
    g.restore();
  }
  // A six-pointed star in the middle.
  g.globalAlpha = 0.75;
  g.lineWidth = 2.5;
  for (const off of [0, Math.PI / 3]) {
    g.beginPath();
    for (let i = 0; i <= 3; i++) {
      const a = off + (i / 3) * Math.PI * 2 - Math.PI / 2;
      const f = i === 0 ? 'moveTo' : 'lineTo';
      g[f](Math.cos(a) * 60, Math.sin(a) * 60);
    }
    g.stroke();
  }
  runeTex = new THREE.CanvasTexture(c);
  runeTex.colorSpace = THREE.SRGBColorSpace;
  return runeTex;
}

// WC3's Circle of Power: a low ring of worked stone round a glowing rune disc,
// with a column of light over it. `r` is the circle's radius in units.
export function circleOfPower(color = '#ffd24a', r = 1.2) {
  const g = new THREE.Group();
  const stone = M.texMat('tex_stone.webp', '#8a8680', '#c8c4bc', 0.5);
  const rim = M.mesh(M.lathe([[r * 0.92, 0], [r * 1.02, 0.05], [r * 1.04, 0.12], [r * 0.98, 0.16], [r * 0.9, 0.12]], 40), stone);
  rim.castShadow = false;
  g.add(rim);
  // Eight little standing stones on the rim.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const m = M.mesh(M.blob(0.09, 0.14, 0.07, { seed: 90 + i, amt: 0.15 }), M.boulderMat(), Math.cos(a) * r, 0.14, Math.sin(a) * r);
    m.rotation.y = -a;
    g.add(m);
  }
  const floor = M.mesh(new THREE.CircleGeometry(r * 0.92, 40).rotateX(-Math.PI / 2), M.texMat('tex_stone.webp', '#6a6660', '#8a8680', 0.6), 0, 0.02, 0);
  floor.castShadow = false;
  g.add(floor);
  const runes = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: runeTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  runes.position.y = 0.05;
  g.add(runes);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(r * 3.2, r * 3.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: fxTexture('fx_flare.webp'), color, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  glow.position.y = 0.04;
  g.add(glow);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.9, 3.2, 32, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
  beam.position.y = 1.6;
  g.add(beam);
  g.userData = { runes, glow, beam, color: new THREE.Color(color), on: 1 };
  return g;
}

// Spin the runes and pulse the light; `on` 0..1 dims a spent circle.
export function animateCircle(obj, t, on = 1) {
  const U = obj.userData;
  U.on += (on - U.on) * 0.1;
  U.runes.rotation.y = t * 0.35;
  U.runes.material.opacity = (0.65 + Math.sin(t * 2.2) * 0.2) * (0.25 + 0.75 * U.on);
  U.glow.material.opacity = (0.3 + Math.sin(t * 2.2) * 0.08) * U.on;
  U.beam.material.opacity = (0.08 + Math.sin(t * 3.1) * 0.03) * U.on;
}

// ------------------------------------------------------------ cliffs

// Triplanar ground for cliffs: `top` on faces pointing up, `side` rock on
// the walls, sampled in world space so neighbouring blocks line up.
const cliffCache = new Map();
export function cliffMat(top = 'tex_grass.webp', topTint = '#a8b894', side = 'tex_boulder.webp', sideTint = '#b8b0a4', scale = 0.28) {
  const key = [top, topTint, side, sideTint, scale].join('|');
  if (cliffCache.has(key)) return cliffCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 0.95, metalness: 0 });
  const u = { tTop: { value: null }, tSide: { value: null }, cTop: { value: new THREE.Color(topTint) }, cSide: { value: new THREE.Color(sideTint) }, uScale: { value: scale }, uOn: { value: 0 } };
  let loaded = 0;
  const done = () => {
    if (++loaded === 2) {
      u.uOn.value = 1;
      m.color.set('#ffffff');
    }
  };
  fxTexture(top, (t) => {
    u.tTop.value = t;
    done();
  }, { repeat: true });
  fxTexture(side, (t) => {
    u.tSide.value = t;
    done();
  }, { repeat: true });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCW; varying vec3 vCN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCW = (modelMatrix * vec4(position, 1.0)).xyz; vCN = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCW; varying vec3 vCN; uniform sampler2D tTop, tSide; uniform vec3 cTop, cSide; uniform float uScale, uOn;')
      .replace('#include <map_fragment>', `
        if (uOn > 0.5) {
          vec3 n = normalize(vCN);
          vec3 w = pow(abs(n), vec3(4.0));
          w /= (w.x + w.y + w.z);
          vec3 p = vCW * uScale;
          vec3 rock = (texture2D(tSide, p.zy).rgb * w.x + texture2D(tSide, p.xy).rgb * w.z) * cSide;
          vec3 rockY = texture2D(tSide, p.xz).rgb * cSide;
          vec3 topC = texture2D(tTop, p.xz * 0.5).rgb * cTop;
          // Grass only on the flat top; steep faces are rock.
          float grassy = smoothstep(0.55, 0.85, n.y);
          diffuseColor.rgb *= rock + mix(rockY, topC, grassy) * w.y;
        }`);
  };
  m.customProgramCacheKey = () => 'raceCliff';
  cliffCache.set(key, m);
  return m;
}

// A rugged raised block over the box x0..x1, z0..z1, `h` high, with rounded
// corners and noisy walls. Built in world coordinates (add it at the origin).
export function cliffBlock(x0, z0, x1, z1, h, { mat = cliffMat(), rough = 0.3, seed = 1, round = 0.9, edge = 0.5 } = {}) {
  const w = x1 - x0;
  const d = z1 - z0;
  const r = Math.max(0.05, Math.min(round, w / 2 - 0.02, d / 2 - 0.02));
  const sh = new THREE.Shape();
  // Shape y is -z (see the rotation below); subdivide the edges so the walls can be roughened.
  const pts = [];
  const seg = (ax, az, bx, bz) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / edge));
    for (let i = 0; i < n; i++) pts.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n]);
  };
  const corner = (cx, cz, a0) => {
    for (let i = 0; i < 4; i++) {
      const a = a0 + (i / 4) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  };
  seg(x0 + r, z0, x1 - r, z0);
  corner(x1 - r, z0 + r, -Math.PI / 2);
  seg(x1, z0 + r, x1, z1 - r);
  corner(x1 - r, z1 - r, 0);
  seg(x1 - r, z1, x0 + r, z1);
  corner(x0 + r, z1 - r, Math.PI / 2);
  seg(x0, z1 - r, x0, z0 + r);
  corner(x0 + r, z0 + r, Math.PI);
  sh.moveTo(pts[0][0], -pts[0][1]);
  for (const [x, z] of pts.slice(1)) sh.lineTo(x, -z);
  sh.closePath();
  let geo = new THREE.ExtrudeGeometry(sh, { depth: h, steps: Math.max(2, Math.ceil(h / 0.5)), bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.35, bevelSegments: 3, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2); // extrude +z -> world +y; shape y -> world -z
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  geo = mergeVertices(geo, 1e-3);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const k = seed * 1.7;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const hy = v.y / (h + 0.3);
    const wall = Math.max(0, Math.min(1, 1 - Math.abs(hy - 0.45) * 1.6));
    const n1 = Math.sin(v.x * 1.3 + k) * Math.cos(v.z * 1.1 - k) + Math.sin(v.y * 2.1 + v.x * 0.7 + k * 2) * 0.6;
    const n2 = Math.cos(v.z * 1.4 + k) * Math.sin(v.x * 0.9 + k) + Math.cos(v.y * 1.9 - v.z * 0.8) * 0.6;
    v.x += n1 * rough * wall;
    v.z += n2 * rough * wall;
    v.y += (Math.sin(v.x * 0.8 + v.z * 0.6 + k) * 0.12) * (hy > 0.9 ? 1 : 0);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Boulders tumbled along the foot of a box's walls, facing out.
export function rubble(group, x0, z0, x1, z1, { every = 1.6, s = [0.35, 0.8], out = 0.35 } = {}) {
  const put = (x, z) => {
    const r = M.rock(s[0] + Math.random() * (s[1] - s[0]));
    r.position.set(x, 0, z);
    group.add(r);
  };
  for (let x = x0; x <= x1; x += every * (0.7 + Math.random() * 0.6)) {
    put(x, z0 - out * Math.random());
    put(x, z1 + out * Math.random());
  }
  for (let z = z0; z <= z1; z += every * (0.7 + Math.random() * 0.6)) {
    put(x0 - out * Math.random(), z);
    put(x1 + out * Math.random(), z);
  }
}

// A soft-edged ground decal (a dirt road, a worn strip): a textured plane
// whose edges fade out through an alpha gradient.
const fadeCache = new Map();
function fadeTexture(across = true) {
  const key = across ? 'a' : 'b';
  if (fadeCache.has(key)) return fadeCache.get(key);
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const img = g.createImageData(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const ex = Math.min(x, 63 - x) / 16;
      const ey = Math.min(y, 63 - y) / 16;
      const a = Math.min(1, ey) * (across ? Math.min(1, ex) : 1);
      const i = (y * 64 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * a * a * (3 - 2 * a));
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  fadeCache.set(key, t);
  return t;
}

export function groundStrip(x0, z0, x1, z1, { file = 'tex_dirt.webp', tint = '#b8a488', base = '#7a6448', opacity = 0.9, units = 5, y = 0.025 } = {}) {
  const w = x1 - x0;
  const d = z1 - z0;
  const mat = new THREE.MeshStandardMaterial({ color: base, roughness: 1, transparent: true, opacity, alphaMap: fadeTexture(true), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  fxTexture(file, (t) => {
    const tt = t.clone();
    tt.wrapS = tt.wrapT = THREE.RepeatWrapping;
    tt.repeat.set(w / units, d / units);
    tt.needsUpdate = true;
    mat.map = tt;
    mat.color.set(tint);
    mat.needsUpdate = true;
  }, { repeat: true });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat);
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  m.receiveShadow = true;
  m.renderOrder = 1;
  return m;
}

export function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
