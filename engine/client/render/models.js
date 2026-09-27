// Procedural models in a Warcraft III style: smooth-shaded low-poly shapes
// (lathed bodies, tapered tubes, noise-displaced blobs) wearing hand-painted
// textures from client/public/fx/, instead of boxes and flat facets. The game
// needs no model files. Models face +X.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fxTexture } from './effects.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = new THREE.Color(color).getHexString() + JSON.stringify(opts);
  if (!matCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts });
    m.userData.shared = true;
    matCache.set(key, m);
  }
  return matCache.get(key);
}

// A material with a hand-painted texture. Shows `base` until the texture
// loads (or if it is missing), then the texture tinted by `tint`.
const texCache = new Map();
export function texMat(file, base, tint = '#ffffff', repeat = 1, opts = {}) {
  const key = [file, base, tint, repeat, JSON.stringify(opts)].join('|');
  if (!texCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color: base, roughness: 0.85, metalness: 0.05, ...opts });
    fxTexture(file, (t) => {
      const tt = repeat === 1 ? t : t.clone();
      tt.repeat.set(repeat, repeat);
      tt.needsUpdate = true;
      m.map = tt;
      m.color.set(tint);
      m.needsUpdate = true;
    }, { repeat: true });
    m.userData.shared = true;
    texCache.set(key, m);
  }
  return texCache.get(key);
}

// Triplanar texturing for the lumpy shapes (rocks, hide, bushes): samples the
// tile along all three axes in object space and blends by the surface normal,
// so round forms get no stretching or seams. `scale` is repeats per unit.
const triCache = new Map();
export function triMat(file, base, tint = '#ffffff', scale = 1, opts = {}) {
  const key = [file, base, tint, scale, JSON.stringify(opts)].join('|');
  if (triCache.has(key)) return triCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color: base, roughness: 0.85, metalness: 0.05, ...opts });
  const u = { tTri: { value: null }, uTriScale: { value: scale }, uTriOn: { value: 0 } };
  fxTexture(file, (t) => {
    u.tTri.value = t;
    u.uTriOn.value = 1;
    m.color.set(tint);
  }, { repeat: true });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos; varying vec3 vTriN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTriPos = position; vTriN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos; varying vec3 vTriN; uniform sampler2D tTri; uniform float uTriScale; uniform float uTriOn;')
      .replace('#include <map_fragment>', `
        if (uTriOn > 0.5) {
          vec3 w = pow(abs(normalize(vTriN)), vec3(4.0));
          w /= (w.x + w.y + w.z);
          vec3 p = vTriPos * uTriScale;
          vec3 c = texture2D(tTri, p.zy).rgb * w.x + texture2D(tTri, p.xz).rgb * w.y + texture2D(tTri, p.xy).rgb * w.z;
          diffuseColor.rgb *= c;
        }`);
  };
  m.customProgramCacheKey = () => 'triplanar';
  m.userData.shared = true;
  triCache.set(key, m);
  return m;
}

export const boulderMat = () => triMat('tex_boulder.webp', '#77746e', '#b4b2ae', 0.9);
export const plateMat = () => texMat('tex_plate.webp', '#b8bcc6', '#e8ecf4', 1, { metalness: 0.55, roughness: 0.4 });
export const goldMat = () => mat('#d8a834', { metalness: 0.75, roughness: 0.32 });
export const hideMat = () => triMat('tex_hide.webp', '#8a6a4a', '#e0c8a8', 1.1);
export const furMat = (tint = '#ffffff') => texMat('tex_fur.webp', '#5a3e28', tint, 2);
export const leatherMat = (tint = '#ffffff') => texMat('tex_leather.webp', '#5a3020', tint, 1);
export const barkMat = () => texMat('tex_bark.webp', '#5b3d22', '#d8c8b8', 1);
export const boneMat = () => mat('#eee4cc', { roughness: 0.5 });

export function glowMat(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false });
}

export function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export const G = {
  sphere: new THREE.SphereGeometry(1, 20, 14),
  cone: new THREE.ConeGeometry(1, 1, 16),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  box: new THREE.BoxGeometry(1, 1, 1),
};

export function scaled(geo, sx, sy = sx, sz = sx) {
  const g = geo.clone();
  g.scale(sx, sy, sz);
  return g;
}

export function darken(hex, k) {
  return new THREE.Color(hex).multiplyScalar(k);
}

// A solid of revolution round Y from [radius, height] pairs.
export function lathe(profile, segs = 20) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), segs);
}

// A tube along a smooth curve through `pts`, tapering from r0 to r1: horns,
// tusks, limbs, hafts, plumes.
const tv = new THREE.Vector3();
export function tube(pts, r0, r1 = r0, segs = 12, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = g.attributes.position;
  for (let i = 0; i <= segs; i++) {
    const c = curve.getPointAt(i / segs);
    const r = r0 + (r1 - r0) * (i / segs);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      tv.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(idx, tv.x, tv.y, tv.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

// A lumpy organic shape: an ellipsoid pushed in and out by smooth noise, with
// shared vertices so it shades smoothly, and a planar UV that wraps a tiling
// texture without a seam. Seeded so every copy of a model matches.
export function blob(sx, sy, sz, { amt = 0.12, freq = 2.2, seed = 1, detail = 3 } = {}) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const waves = Array.from({ length: 6 }, () => {
    const d = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    return { d, f: freq * (0.6 + rnd()), p: rnd() * 6.28 };
  });
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    tv.fromBufferAttribute(pos, i);
    let n = 0;
    for (const w of waves) n += Math.sin(tv.dot(w.d) * w.f + w.p);
    tv.multiplyScalar(1 + (n / waves.length) * amt * 2);
    tv.set(tv.x * sx, tv.y * sy, tv.z * sz);
    pos.setXYZ(i, tv.x, tv.y, tv.z);
    uv[i * 2] = (tv.x + tv.z * 0.6) * 0.8;
    uv[i * 2 + 1] = (tv.y + tv.z * 0.3) * 0.8;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// A flat axe blade in the XY plane, cutting edge toward +X.
export function axeBlade(w = 0.45, h = 0.55) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.08);
  sh.quadraticCurveTo(w * 0.5, -h * 0.35, w, -h * 0.5);
  sh.quadraticCurveTo(w * 0.8, 0, w, h * 0.5);
  sh.quadraticCurveTo(w * 0.5, h * 0.35, 0, 0.08);
  sh.lineTo(0, -0.08);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -0.025);
  return g;
}

// A cloth panel hanging from its top edge (cloaks, tabards, banners): width
// across Z, its sides curling toward +X by `bend` and its hem trailing
// toward -X by `sway`. A cape at the back wraps round the body as is; turn
// a front panel by PI.
export function cloth(w, h, bend = 0.15, sway = 0) {
  const g = new THREE.PlaneGeometry(w, h, 6, 8);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const t = (h / 2 - y) / h; // 0 at the top, 1 at the bottom
    pos.setXYZ(i, bend * (x / (w / 2)) ** 2 - sway * t * t, y, x);
  }
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------ heroes

// A hooded warlock with a glowing staff (Arcane Arena's hero; kept for the shared engine).
export function warlock(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const robe = mesh(lathe([[0.55, 0], [0.5, 0.2], [0.38, 0.7], [0.3, 1.05], [0.34, 1.2], [0.2, 1.3], [0.01, 1.32]]), mat(darken(color, 0.55)), 0, 0, 0);
  const trim = mesh(new THREE.TorusGeometry(0.53, 0.04, 8, 24).rotateX(Math.PI / 2), mat(color), 0, 0.05, 0);
  const head = mesh(scaled(G.sphere, 0.19), mat('#c9a27e'), 0.05, 1.42, 0);
  const hood = mesh(lathe([[0.24, 1.3], [0.25, 1.45], [0.2, 1.62], [0.08, 1.78], [0.01, 1.85]]), mat(color), -0.03, 0, 0);
  const eyeL = mesh(scaled(G.sphere, 0.035), glowMat('#ffcc55'), 0.2, 1.44, 0.07);
  const eyeR = mesh(scaled(G.sphere, 0.035), glowMat('#ffcc55'), 0.2, 1.44, -0.07);
  const shoulderL = mesh(scaled(G.sphere, 0.16, 0.12, 0.16), mat(color), 0, 1.2, 0.3);
  const shoulderR = mesh(scaled(G.sphere, 0.16, 0.12, 0.16), mat(color), 0, 1.2, -0.3);
  const staff = new THREE.Group();
  staff.position.set(0.2, 0.9, -0.42);
  staff.add(mesh(tube([[0, -0.8, 0], [0.02, 0.2, 0], [0, 1.0, 0]], 0.035, 0.03), mat('#5a3a1e')));
  const orb = mesh(scaled(G.sphere, 0.13), glowMat(color), 0, 1.08, 0);
  staff.add(orb);
  body.add(robe, trim, head, hood, eyeL, eyeR, shoulderL, shoulderR, staff);
  g.userData = { body, staff, orb, kind: 'hero' };
  return g;
}

// A paladin in plate: a hammerguy. Lathed breastplate and helm, a team
// tabard and cape, pauldrons, and a two-handed warhammer.
export function paladin(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const steel = plateMat();
  const silver = silverMat();
  const gold = goldMat();
  const mail = mat('#6c7078', { metalness: 0.6, roughness: 0.55 });
  const skin = mat('#e0b48e', { roughness: 0.7 });
  const beardM = mat('#d8c8a8', { roughness: 0.9 });
  const team = mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  const teamDark = mat(darken(color, 0.6), { roughness: 0.85, side: THREE.DoubleSide });
  const leather = leatherMat();

  // Legs: mail thighs, gold knee cops, steel greaves and pointed sabatons.
  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(0, 0.62, 0.12 * s);
    hip.add(mesh(tube([[0, 0.02, 0], [0.01, -0.2, 0.01 * s], [0.02, -0.3, 0]], 0.1, 0.085, 5, 10), mail));
    hip.add(mesh(scaled(G.sphere, 0.075, 0.07, 0.075), gold, 0.05, -0.3, 0));
    hip.add(mesh(lathe([[0.075, -0.56], [0.085, -0.48], [0.08, -0.36], [0.07, -0.32]], 12), silver));
    const foot = mesh(blob(0.15, 0.055, 0.075, { seed: 90, amt: 0.03 }), steel, 0.07, -0.58, 0);
    hip.add(foot);
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);

  // Torso: a breastplate with a proud chest and narrow waist, banded below.
  const torso = mesh(lathe([[0.17, 0.66], [0.2, 0.74], [0.25, 0.86], [0.3, 0.98], [0.31, 1.08], [0.27, 1.17], [0.16, 1.25], [0.09, 1.29]], 24), steel);
  torso.scale.set(0.82, 1, 1.3);
  const ridge = mesh(tube([[0.2, 0.8, 0], [0.26, 0.98, 0], [0.24, 1.16, 0]], 0.022, 0.018, 6, 6), gold);
  const bands = [0.7, 0.78].map((y, i) => {
    const b = mesh(new THREE.TorusGeometry(0.2 + i * 0.025, 0.018, 6, 24).rotateX(Math.PI / 2), silver, 0, y, 0);
    b.scale.set(0.84, 1, 1.25);
    return b;
  });
  const belt = mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 28).rotateX(Math.PI / 2), leather, 0, 0.64, 0);
  belt.scale.set(0.9, 1, 1.25);
  const buckle = mesh(scaled(G.box, 0.03, 0.07, 0.09), gold, 0.19, 0.64, 0);
  // Tassets over the hips.
  const tassets = [1, -1].map((s) => {
    const t = mesh(new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 0.6, Math.PI * 0.35, Math.PI * 0.4), steel, 0, 0.66, 0.08 * s);
    t.rotation.y = s > 0 ? -0.2 : Math.PI - 0.4;
    t.scale.set(1, 1.3, 1);
    return t;
  });
  // Tabard with gold trim and a sun emblem; cape with gold clasps.
  const tabard = mesh(cloth(0.2, 0.62, 0.03, -0.04), team, 0.21, 0.5, 0);
  tabard.rotation.y = Math.PI;
  const trimL = mesh(tube([[0.215, 0.2, 0.1], [0.23, 0.5, 0.1], [0.25, 0.78, 0.1]], 0.012, 0.012, 4, 5), gold);
  const trimR = mesh(tube([[0.215, 0.2, -0.1], [0.23, 0.5, -0.1], [0.25, 0.78, -0.1]], 0.012, 0.012, 4, 5), gold);
  const emblem = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 12).rotateZ(Math.PI / 2), gold, 0.3, 0.98, 0);
  const cape = mesh(cloth(0.62, 1.05, 0.22, 0.24), teamDark, -0.22, 0.72, 0);
  const clasps = [1, -1].map((s) => mesh(scaled(G.sphere, 0.045), gold, -0.14, 1.2, 0.2 * s));
  // Pauldrons: three overlapping shells, the top one trimmed in gold.
  const pauldron = (s) => {
    const p = new THREE.Group();
    p.position.set(-0.01, 1.16, 0.33 * s);
    p.rotation.x = 0.55 * s;
    const shell = (r, y) => mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), steel, 0, y, 0);
    p.add(shell(0.2, 0), shell(0.18, -0.06), shell(0.15, -0.11));
    const rim = mesh(new THREE.TorusGeometry(0.175, 0.016, 6, 24).rotateX(Math.PI / 2), gold, 0, 0.045, 0);
    p.add(rim, mesh(scaled(G.sphere, 0.035), gold, 0, 0.2, 0));
    return p;
  };
  // Arms: steel upper arms, gold elbow cops, gauntlets.
  const arm = (s, fwd) => {
    const a = new THREE.Group();
    a.add(mesh(tube([[0, 1.1, 0.35 * s], [0.04 + fwd * 0.08, 0.92, 0.38 * s], [0.1 + fwd * 0.18, 0.74, 0.3 * s]], 0.075, 0.065, 8, 10), steel));
    a.add(mesh(scaled(G.sphere, 0.06), gold, 0.04 + fwd * 0.08, 0.92, 0.38 * s));
    a.add(mesh(blob(0.085, 0.075, 0.075, { seed: 91 }), silver, 0.12 + fwd * 0.2, 0.71, 0.3 * s));
    return a;
  };
  // Head: a face with a full beard under an open-faced helm with a nasal,
  // cheek guards, a gold crest and a team-colour plume.
  const head = new THREE.Group();
  head.position.set(0.02, 1.4, 0);
  head.add(mesh(scaled(G.sphere, 0.14, 0.15, 0.13), skin, 0.02, 0, 0));
  head.add(mesh(blob(0.12, 0.13, 0.13, { seed: 92, amt: 0.1 }), beardM, 0.08, -0.1, 0));
  head.add(mesh(blob(0.06, 0.03, 0.1, { seed: 93 }), beardM, 0.14, -0.01, 0));
  for (const s of [1, -1]) head.add(mesh(scaled(G.sphere, 0.022), mat('#20303a'), 0.135, 0.03, 0.05 * s));
  head.add(mesh(lathe([[0.16, -0.02], [0.17, 0.05], [0.165, 0.12], [0.13, 0.19], [0.07, 0.23], [0.001, 0.24]], 24), silver));
  head.add(mesh(scaled(G.box, 0.04, 0.12, 0.025), silver, 0.16, 0.04, 0));
  for (const s of [1, -1]) {
    const cheek = mesh(scaled(G.box, 0.1, 0.13, 0.025), silver, 0.07, -0.04, 0.14 * s);
    cheek.rotation.y = -0.4 * s;
    head.add(cheek);
  }
  head.add(mesh(new THREE.TorusGeometry(0.165, 0.016, 6, 28).rotateX(Math.PI / 2), gold, 0, 0.05, 0));
  head.add(mesh(scaled(G.box, 0.3, 0.035, 0.025), gold, 0, 0.21, 0));
  head.add(mesh(tube([[0.02, 0.23, 0], [-0.12, 0.34, 0], [-0.3, 0.3, 0], [-0.4, 0.12, 0]], 0.045, 0.012, 12, 8), team));
  const gorget = mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.1, 18), gold, 0, 1.27, 0);
  gorget.scale.z = 1.2;

  const hammer = warhammer();
  hammer.position.set(0.15, 0.9, -0.42);
  hammer.rotation.z = -0.3;
  hammer.scale.setScalar(0.8);
  body.add(legL, legR, torso, ridge, ...bands, belt, buckle, ...tassets, tabard, trimL, trimR, emblem, cape, ...clasps, pauldron(1), pauldron(-1), arm(1, 0.3), arm(-1, 0), gorget, head, hammer);
  g.userData = { body, staff: hammer, legL, legR, kind: 'hero' };
  return g;
}

// A paladin's warhammer: a chunky octagonal silver head with flared striking
// faces and a back spike on a stout haft with a leather grip, gold only on the
// collar and rims. Group origin is the grip; the head sits at y = 0.8.
export const silverMat = () => mat('#dfe3ea', { metalness: 0.85, roughness: 0.22 });
export function warhammer() {
  const g = new THREE.Group();
  const silver = silverMat();
  const gold = goldMat();
  g.add(mesh(tube([[0, -0.45, 0], [0.005, 0.2, 0], [0, 0.72, 0]], 0.042, 0.036, 6, 10), mat('#5a3a1e', { roughness: 0.6 })));
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 12), leatherMat(), 0, -0.2, 0));
  g.add(mesh(scaled(G.sphere, 0.065), gold, 0, -0.47, 0));
  // Head, lathed along its own axis (X): flared faces, a waisted middle.
  const head = mesh(lathe([[0.001, -0.27], [0.15, -0.27], [0.16, -0.24], [0.12, -0.2], [0.1, -0.08], [0.11, 0], [0.1, 0.08], [0.12, 0.2], [0.16, 0.24], [0.15, 0.27], [0.001, 0.27]], 8), silver, 0, 0.8, 0);
  head.rotation.z = Math.PI / 2;
  g.add(head);
  for (const e of [-1, 1]) {
    const rim = mesh(new THREE.TorusGeometry(0.145, 0.018, 6, 8), gold, 0.235 * e, 0.8, 0);
    rim.rotation.y = Math.PI / 2;
    g.add(rim);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.12, 10), gold, 0, 0.64, 0));
  g.add(mesh(scaled(G.cone, 0.06, 0.2, 0.06), silver, 0, 1.0, 0));
  return g;
}

// ------------------------------------------------------------ beasts

// A kodo beast in war harness: a wrinkled hide body with a shoulder hump,
// a broad head with an open maw and curling horns, thick legs, a saddle
// and a war drum.
export function kodo() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const hide = hideMat();
  const dark = mat('#4a3424', { roughness: 0.9 });
  body.add(mesh(blob(1.35, 0.9, 0.85, { seed: 3, amt: 0.08 }), hide, 0, 1.2, 0));
  body.add(mesh(blob(0.75, 0.55, 0.7, { seed: 5, amt: 0.1 }), hide, 0.45, 1.65, 0));
  body.add(mesh(blob(0.6, 0.5, 0.52, { seed: 7 }), hide, 1.45, 1.1, 0));
  body.add(mesh(blob(0.4, 0.3, 0.36, { seed: 11 }), hide, 1.9, 0.92, 0));
  const jaw = mesh(blob(0.38, 0.14, 0.3, { seed: 13 }), hide, 1.78, 0.66, 0);
  jaw.rotation.z = -0.25;
  body.add(jaw);
  body.add(mesh(scaled(G.sphere, 0.2, 0.08, 0.22), mat('#6a1a18', { roughness: 0.5 }), 1.85, 0.77, 0));
  for (const s of [1, -1]) {
    body.add(mesh(scaled(G.sphere, 0.06), mat('#120c08', { roughness: 0.2 }), 1.78, 1.2, 0.3 * s));
    body.add(mesh(blob(0.14, 0.05, 0.1, { seed: 17 }), dark, 1.72, 1.29, 0.28 * s));
    body.add(mesh(scaled(G.sphere, 0.05), dark, 2.2, 0.98, 0.1 * s));
    body.add(mesh(tube([[1.55, 1.35, 0.3 * s], [1.55, 1.6, 0.58 * s], [1.8, 1.78, 0.66 * s], [2.05, 1.7, 0.48 * s]], 0.1, 0.012, 14, 10), boneMat()));
    body.add(mesh(tube([[1.9, 0.72, 0.18 * s], [2.02, 0.9, 0.24 * s], [2.05, 1.05, 0.2 * s]], 0.045, 0.01, 8, 8), boneMat()));
    const ear = mesh(blob(0.2, 0.06, 0.13, { seed: 19 }), hide, 1.3, 1.32, 0.5 * s);
    ear.rotation.x = 0.6 * s;
    body.add(ear);
  }
  const legs = [];
  for (const [x, z] of [[0.75, 0.45], [0.75, -0.45], [-0.8, 0.45], [-0.8, -0.45]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 1.0, z);
    hip.add(mesh(tube([[0, 0.1, 0], [0.04, -0.45, 0], [0, -0.9, 0]], 0.26, 0.19, 6, 12), hide));
    hip.add(mesh(blob(0.24, 0.1, 0.24, { seed: 23 }), dark, 0.06, -0.92, 0));
    legs.push(hip);
    body.add(hip);
  }
  body.add(mesh(tube([[-1.3, 1.35, 0], [-1.6, 1.1, 0], [-1.72, 0.7, 0]], 0.09, 0.03), hide));
  body.add(mesh(blob(0.1, 0.16, 0.1, { seed: 29 }), dark, -1.73, 0.6, 0));
  // Harness: a saddle blanket, a girth strap and the war drum with banners.
  const leather = leatherMat();
  const blanket = mesh(blob(0.7, 0.12, 0.8, { seed: 31, amt: 0.04 }), mat('#8a2a1a', { roughness: 0.9 }), -0.1, 2.0, 0);
  const girth = mesh(new THREE.TorusGeometry(0.95, 0.05, 6, 28), leather, -0.1, 1.2, 0);
  girth.rotation.y = Math.PI / 2;
  girth.scale.set(1, 0.95, 0.9);
  const drum = mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.45, 20), leather, -0.35, 2.32, 0);
  const skin = mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.02, 20), mat('#d8c4a0'), -0.35, 2.56, 0);
  body.add(blanket, girth, drum, skin);
  for (const s of [1, -1]) {
    body.add(mesh(tube([[-0.7, 1.9, 0.3 * s], [-0.72, 2.6, 0.32 * s], [-0.74, 3.1, 0.34 * s]], 0.025, 0.02), mat('#4a3020')));
    const flag = mesh(cloth(0.3, 0.5, 0.02, 0.08), mat('#a02018', { side: THREE.DoubleSide }), -0.74, 2.8, 0.34 * s);
    flag.rotation.y = Math.PI / 2;
    body.add(flag);
  }
  g.userData = { body, legs, kind: 'beast' };
  return g;
}

export function golem() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const flesh = mat('#8fae6e');
  body.add(mesh(blob(0.8, 0.9, 0.9, { seed: 2 }), flesh, 0, 1.3, 0));
  body.add(mesh(blob(0.7, 0.6, 0.75, { seed: 4 }), mat('#a3c07e'), 0.25, 0.9, 0));
  body.add(mesh(blob(0.3, 0.3, 0.3, { seed: 6 }), flesh, 0.5, 2.0, 0));
  for (const s of [1, -1]) body.add(mesh(tube([[0, 1.6, 0.8 * s], [0.2, 1.0, 0.95 * s], [0.4, 0.5, 0.9 * s]], 0.22, 0.18), flesh));
  body.add(mesh(scaled(G.box, 0.6, 0.1, 0.4), mat('#999', { metalness: 0.6 }), 0.5, 0.5, -1.0));
  g.userData = { body, kind: 'beast' };
  return g;
}

// An orc catapult (or, with `demo`, a demolisher with a burning-oil pot):
// a timber frame on spoked wheels with a throwing arm and a bucket.
export function catapult(demo = false) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const wood = texMat('tex_wood.webp', demo ? '#5a3a24' : '#7a5230', demo ? '#b89a88' : '#ffffff');
  const iron = mat('#3a3a3c', { metalness: 0.6, roughness: 0.45 });
  const beam = (x0, y0, z0, x1, y1, z1, r = 0.08) => mesh(tube([[x0, y0, z0], [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1, y1, z1]], r, r, 2, 6), wood);
  for (const z of [0.42, -0.42]) {
    body.add(beam(-0.85, 0.55, z, 0.85, 0.55, z, 0.1));
    body.add(beam(-0.3, 0.55, z, -0.3, 1.45, z * 0.9, 0.08));
    body.add(beam(0.35, 0.55, z, -0.3, 1.45, z * 0.9, 0.06));
  }
  for (const x of [-0.7, 0, 0.7]) body.add(beam(x, 0.55, 0.45, x, 0.55, -0.45, 0.07));
  body.add(mesh(scaled(G.box, 1.2, 0.06, 0.8), wood, 0, 0.64, 0));
  for (const [x, z] of [[0.6, 0.56], [0.6, -0.56], [-0.6, 0.56], [-0.6, -0.56]]) {
    const w = new THREE.Group();
    w.position.set(x, 0.36, z);
    w.add(mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 24), iron));
    w.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 12).rotateX(Math.PI / 2), iron));
    for (let i = 0; i < 6; i++) {
      const sp = mesh(scaled(G.box, 0.56, 0.05, 0.04), wood);
      sp.rotation.z = (i / 6) * Math.PI;
      w.add(sp);
    }
    body.add(w);
  }
  const arm = new THREE.Group();
  arm.position.set(-0.3, 1.4, 0);
  arm.add(mesh(tube([[-0.5, 0, 0], [0.4, 0.02, 0], [1.05, 0.05, 0]], 0.07, 0.055, 4, 8), wood));
  arm.add(mesh(lathe([[0.01, -0.12], [0.2, -0.1], [0.26, 0.05], [0.24, 0.1]], 16), iron, 1.05, 0.08, 0));
  arm.add(mesh(blob(0.2, 0.2, 0.2, { seed: 8 }), demo ? glowMat('#ff7a20') : boulderMat(), 1.05, 0.22, 0));
  arm.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 12).rotateX(Math.PI / 2), iron, 0, 0, 0));
  arm.rotation.z = -0.5;
  body.add(arm);
  if (demo) {
    for (const z of [0.3, -0.3]) body.add(mesh(scaled(G.box, 1.1, 0.35, 0.03), iron, 0, 0.85, z * 1.5));
    body.add(mesh(scaled(G.cone, 0.12, 0.5, 0.12), mat('#b0b0b0', { metalness: 0.6 }), 0.95, 0.75, 0));
  }
  g.userData = { body, arm, kind: 'siege' };
  return g;
}

// An orc Beastmaster channelling Stampede. Built to read at a glance which
// way he faces (the way his beasts will run): he leans into it under a bear
// skull whose snout points ahead, both axes thrust forward, a hawk on his
// shoulder looking the same way, and a fur cloak streaming behind. When
// channelling, glowing chevrons on the ground point down his lane.
export function beastmaster() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = mat('#5f8a3a', { roughness: 0.7 });
  const skinDark = mat('#4a6e2c', { roughness: 0.75 });
  const leather = leatherMat();
  const fur = furMat();
  const steel = mat('#9aa0a8', { metalness: 0.7, roughness: 0.35 });
  const wood = mat('#4a3020');
  const lean = new THREE.Group();
  lean.rotation.z = -0.18; // leaning forward
  body.add(lean);
  for (const s of [1, -1]) {
    body.add(mesh(tube([[0.02, 0.85, 0.2 * s], [0.06, 0.45, 0.28 * s], [0.05, 0.1, 0.3 * s]], 0.14, 0.11, 6, 10), leather));
    body.add(mesh(blob(0.2, 0.12, 0.15, { seed: 40 }), fur, 0.1, 0.08, 0.3 * s));
  }
  lean.add(mesh(blob(0.48, 0.55, 0.55, { seed: 41, amt: 0.06 }), skin, 0.02, 1.25, 0));
  lean.add(mesh(blob(0.42, 0.25, 0.48, { seed: 42, amt: 0.05 }), leather, 0, 0.82, 0));
  const loin = mesh(cloth(0.34, 0.4, 0.04, 0.05), furMat('#c8b8a0').clone(), 0.36, 0.62, 0);
  loin.material.side = THREE.DoubleSide;
  loin.rotation.y = Math.PI;
  lean.add(loin);
  for (const s of [1, -1]) {
    const strap = mesh(new THREE.TorusGeometry(0.52, 0.03, 6, 24), leather, 0.02, 1.3, 0);
    strap.rotation.set(0, Math.PI / 2, 0.7 * s);
    strap.scale.set(1, 1, 0.95);
    lean.add(strap);
  }
  const cloak = mesh(cloth(0.95, 1.35, 0.3, 0.25), furMat('#b8a890'), -0.38, 1.05, 0);
  cloak.material = cloak.material.clone();
  cloak.material.side = THREE.DoubleSide;
  lean.add(cloak);
  // Head: heavy jaw thrust forward, tusks, glowing eyes, a black topknot.
  const head = new THREE.Group();
  head.position.set(0.28, 1.82, 0);
  head.add(mesh(blob(0.24, 0.23, 0.22, { seed: 43 }), skin, 0, 0, 0));
  head.add(mesh(blob(0.18, 0.12, 0.2, { seed: 44 }), skinDark, 0.12, -0.14, 0));
  for (const s of [1, -1]) {
    head.add(mesh(tube([[0.22, -0.16, 0.1 * s], [0.28, -0.04, 0.12 * s], [0.26, 0.04, 0.1 * s]], 0.035, 0.008, 6, 8), boneMat()));
    head.add(mesh(scaled(G.sphere, 0.035), glowMat('#ffd84a'), 0.21, 0.04, 0.09 * s));
  }
  // Bear-skull helm: a white skull with its long snout pointing ahead (an
  // arrow from above), fangs, dark eye sockets, and the pelt behind it.
  head.add(mesh(blob(0.3, 0.19, 0.26, { seed: 45, amt: 0.06 }), boneMat(), 0.02, 0.16, 0));
  head.add(mesh(blob(0.3, 0.12, 0.15, { seed: 46, amt: 0.05 }), boneMat(), 0.36, 0.12, 0));
  head.add(mesh(scaled(G.sphere, 0.05, 0.035, 0.05), mat('#1a1410'), 0.64, 0.14, 0));
  for (const s of [1, -1]) {
    head.add(mesh(scaled(G.cone, 0.03, 0.11, 0.03).rotateZ(Math.PI), boneMat(), 0.52, 0.0, 0.08 * s));
    head.add(mesh(scaled(G.sphere, 0.055, 0.045, 0.05), mat('#140c08'), 0.24, 0.22, 0.12 * s));
    head.add(mesh(blob(0.07, 0.08, 0.05, { seed: 47 }), fur, -0.08, 0.3, 0.17 * s));
  }
  head.add(mesh(blob(0.26, 0.14, 0.3, { seed: 55 }), fur, -0.22, 0.1, 0));
  lean.add(head);
  // Shoulders: a bear-skull pauldron on the axe arm, fur on the other.
  lean.add(mesh(blob(0.26, 0.2, 0.26, { seed: 48 }), boneMat(), 0.02, 1.6, -0.5));
  lean.add(mesh(blob(0.26, 0.18, 0.26, { seed: 49 }), fur, 0.0, 1.62, 0.5));
  // Both arms thrust forward with axes raised: channelling toward his lane.
  const arms = [];
  for (const s of [1, -1]) {
    const a = new THREE.Group();
    a.position.set(0.05, 1.55, 0.52 * s);
    a.add(mesh(tube([[0, 0, 0], [0.3, -0.12, 0.06 * s], [0.62, 0.05, 0.02 * s]], 0.13, 0.1, 8, 10), skin));
    a.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 12).rotateZ(Math.PI / 2), leather, 0.5, 0.0, 0.03 * s));
    a.add(mesh(blob(0.1, 0.1, 0.1, { seed: 50 }), skin, 0.66, 0.06, 0.02 * s));
    const axe = new THREE.Group();
    axe.position.set(0.66, 0.06, 0.02 * s);
    axe.add(mesh(tube([[0, -0.3, 0], [0, 0.2, 0], [0.02, 0.55, 0]], 0.03, 0.025, 4, 6), wood));
    const blade = mesh(axeBlade(0.36, 0.44), steel, 0.02, 0.48, 0);
    axe.add(blade);
    axe.rotation.z = -0.4;
    a.add(axe);
    a.rotation.z = 0.35;
    arms.push(a);
    lean.add(a);
  }
  // The hawk, perched on the fur shoulder and staring ahead.
  const hawk = new THREE.Group();
  hawk.position.set(0.05, 1.78, 0.5);
  const feathers = mat('#6a4a2a', { roughness: 0.8 });
  hawk.add(mesh(blob(0.14, 0.1, 0.09, { seed: 51 }), feathers, 0, 0.05, 0));
  hawk.add(mesh(blob(0.07, 0.07, 0.07, { seed: 52 }), mat('#8a6a44'), 0.12, 0.13, 0));
  hawk.add(mesh(scaled(G.cone, 0.025, 0.07, 0.025).rotateZ(-Math.PI / 2), mat('#e8b020'), 0.2, 0.12, 0));
  const wings = [];
  for (const s of [1, -1]) {
    const w = mesh(blob(0.16, 0.025, 0.1, { seed: 53 }), feathers, -0.02, 0.1, 0.08 * s);
    w.rotation.x = 0.4 * s;
    wings.push(w);
    hawk.add(w);
  }
  hawk.add(mesh(blob(0.1, 0.02, 0.05, { seed: 54 }), feathers, -0.16, 0.02, 0));
  lean.add(hawk);
  body.scale.setScalar(1.35);
  // A channelling ring under him.
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.15, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#8cff5a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  ring.position.y = 0.04;
  g.add(ring);
  // Ground chevrons down the lane (shown while channelling).
  const chev = new THREE.Group();
  const sh = new THREE.Shape();
  sh.moveTo(0, 0.45);
  sh.lineTo(0.35, 0);
  sh.lineTo(0, -0.45);
  sh.lineTo(-0.18, -0.45);
  sh.lineTo(0.14, 0);
  sh.lineTo(-0.18, 0.45);
  sh.lineTo(0, 0.45);
  const cg = new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: '#b8ff7a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    m.position.set(1.6 + i * 0.85, 0.05, 0);
    m.scale.setScalar(1.3);
    chev.add(m);
  }
  g.add(chev);
  g.userData = { body, arms, hawk, wings, chev, ring, kind: 'beast' };
  return g;
}

// ------------------------------------------------------------ pickups

export function coin() {
  const g = new THREE.Group();
  const c = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 24), mat('#ffcc33', { metalness: 0.9, roughness: 0.25, emissive: '#553300' }), 0, 0.6, 0);
  c.rotation.x = Math.PI / 2;
  g.add(c);
  g.userData = { spin: c };
  return g;
}

export function goldbag() {
  const g = new THREE.Group();
  const sack = mesh(blob(0.5, 0.45, 0.5, { seed: 60 }), leatherMat('#e0c8a0'), 0, 0.45, 0);
  const tie = mesh(lathe([[0.16, 0.85], [0.08, 0.95], [0.14, 1.08], [0.01, 1.12]]), mat('#7a5030'));
  const gl = mesh(scaled(G.sphere, 0.18), mat('#ffd24a', { metalness: 0.9, emissive: '#664400' }), 0.2, 0.8, 0.15);
  g.add(sack, tie, gl);
  g.userData = { spin: g };
  return g;
}

// ------------------------------------------------------------ doodads

// A Lordaeron pine: a tapered bark trunk and drooping, ragged tiers of
// needles, each tree a slightly different shade.
function pineTier(r, h, seed) {
  const g = new THREE.ConeGeometry(r, h, 14, 3);
  const pos = g.attributes.position;
  let s = seed * 7919;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const jit = new Map();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (!jit.has(key)) jit.set(key, [rnd(), rnd()]);
    const [a, b] = jit.get(key);
    const rr = Math.hypot(x, z) / r; // 0 at the tip, 1 at the rim
    const k = 1 + (a - 0.5) * 0.35 * rr;
    pos.setXYZ(i, x * k, y - rr * rr * h * 0.18 - b * 0.12 * rr, z * k);
  }
  g.computeVertexNormals();
  return g;
}

const PINE_SHADES = ['#9cc08c', '#b0c894', '#a4b88a', '#b8d0a0'];
export function tree(s = 1, { snow = false } = {}) {
  const g = new THREE.Group();
  const seed = Math.floor(Math.random() * 1000) + 1;
  g.add(mesh(lathe([[0.2 * s, 0], [0.16 * s, 0.25 * s], [0.12 * s, 1.2 * s], [0.06 * s, 2.6 * s]], 10), barkMat()));
  // Four shades, so trees share materials and batch into few draw calls.
  const shade = snow ? '#ffffff' : PINE_SHADES[Math.floor(Math.random() * PINE_SHADES.length)];
  const needles = snow ? mat('#e4eef6', { roughness: 0.9 }) : texMat('tex_needles.webp', '#2f5a2a', shade, 1, { roughness: 0.95 });
  const tiers = [[1.2, 1.3, 1.25], [0.95, 1.15, 1.85], [0.7, 1.0, 2.4], [0.45, 0.85, 2.9]];
  tiers.forEach(([r, h, y], i) => {
    const m = mesh(pineTier(r * s, h * s, seed + i), needles, 0, y * s, 0);
    m.rotation.y = i * 0.9;
    g.add(m);
  });
  g.rotation.y = Math.random() * 6;
  return g;
}

export function snowTree(s = 1) {
  return tree(s, { snow: true });
}

export function bush(s = 1) {
  const g = new THREE.Group();
  const needles = triMat('tex_needles.webp', '#3b6e30', '#b8d0a0', 1.6, { roughness: 0.95 });
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28;
    const r = Math.random() * 0.35 * s;
    const k = (0.35 + Math.random() * 0.25) * s;
    g.add(mesh(blob(k, k * 0.75, k, { seed: 70 + i, amt: 0.18, freq: 3 }), needles, Math.cos(a) * r, k * 0.55, Math.sin(a) * r));
  }
  return g;
}

export function rock(s = 1) {
  const m = mesh(blob(s, s * (0.5 + Math.random() * 0.25), s * (0.7 + Math.random() * 0.25), { seed: Math.floor(Math.random() * 500), amt: 0.2, freq: 3.4 }), boulderMat(), 0, s * 0.22, 0);
  m.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * 6, (Math.random() - 0.5) * 0.4);
  const g = new THREE.Group();
  g.add(m);
  return g;
}

export function pillar(s = 1) {
  const g = new THREE.Group();
  const stone = texMat('tex_stone.webp', '#a8a294', '#e8e4dc', 1);
  g.add(mesh(lathe([[0.5 * s, 0], [0.5 * s, 0.2], [0.4 * s, 0.28], [0.32 * s, 0.35], [0.3 * s, 1.4 * s], [0.27 * s, 2.5 * s], [0.34 * s, 2.6 * s], [0.46 * s, 2.72 * s], [0.46 * s, 2.85 * s], [0.01, 2.86 * s]], 16), stone));
  return g;
}

export function torch() {
  const g = new THREE.Group();
  g.add(mesh(tube([[0, 0, 0], [0.02, 0.7, 0], [0, 1.35, 0]], 0.06, 0.045, 4, 8), mat('#4a3322')));
  g.add(mesh(lathe([[0.05, 1.3], [0.16, 1.38], [0.2, 1.5], [0.18, 1.52]], 12), mat('#2a2a2c', { metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide })));
  const flame = mesh(scaled(G.sphere, 0.09), glowMat('#ffcc66'), 0, 1.58, 0);
  flame.castShadow = false;
  g.add(flame);
  g.userData = { flame };
  return g;
}

export function moonwell() {
  const g = new THREE.Group();
  g.add(mesh(lathe([[2.3, 0], [2.3, 0.5], [2.1, 0.72], [1.85, 0.72], [1.85, 0.6], [0.01, 0.6]], 28), mat('#8d8aa8')));
  g.add(mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.1, 28), glowMat('#5fd0ff', 0.9), 0, 0.68, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(mesh(tube([[0, 0, 0], [0.05, 0.6, 0], [-0.1, 1.3, 0]], 0.14, 0.02), mat('#b7b3d6'), Math.cos(a) * 2.05, 0.5, Math.sin(a) * 2.05));
  }
  return g;
}

export function goldmine() {
  const g = new THREE.Group();
  g.add(mesh(blob(2.4, 1.5, 2, { seed: 80, amt: 0.12 }), boulderMat(), 0, 0.5, 0));
  const arch = mesh(new THREE.TorusGeometry(0.6, 0.12, 8, 16, Math.PI), texMat('tex_wood.webp', '#6a4a2a'), 0, 0.3, -1.75);
  g.add(arch, mesh(new THREE.CircleGeometry(0.6, 16, 0, Math.PI), mat('#0d0906'), 0, 0.3, -1.78));
  for (let i = 0; i < 6; i++) g.add(mesh(blob(0.25, 0.2, 0.25, { seed: 81 + i }), mat('#ffcc33', { metalness: 0.9, emissive: '#443300' }), (Math.random() - 0.5) * 3, 1.5 + Math.random() * 0.5, (Math.random() - 0.5) * 2));
  return g;
}

export function flag() {
  const g = new THREE.Group();
  g.add(mesh(tube([[0, 0, 0], [0, 1.3, 0], [0, 2.6, 0]], 0.05, 0.04), mat('#ddd')));
  const cloth_ = mesh(cloth(0.9, 0.55, 0.02, 0), mat('#e0c030', { side: THREE.DoubleSide }), 0.45, 2.3, 0);
  cloth_.rotation.y = Math.PI / 2;
  g.add(cloth_);
  g.userData = { cloth: cloth_ };
  return g;
}

export function lavaRock(s = 1) {
  const g = rock(s);
  g.children[0].material = mat('#2a2220');
  return g;
}
