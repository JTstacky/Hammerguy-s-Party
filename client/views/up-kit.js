// Shared client pieces for the RTS-style Uther Party ports (#42 Spell Breaker
// Blood, #43 Dune Worm Distress, #46 Tower Defense, #49 Clandestine Kitty):
// HP bars and team rings for creatures, a few shape helpers, and the Doom
// Guard, which #42 and #49 both use.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';

// ------------------------------------------------------------------ bars

// A WC3 health bar over a creature, positioned by the world like a hero's.
export function unitBar(v, world, width = 44) {
  const bar = document.createElement('div');
  bar.className = 'unitbar';
  bar.innerHTML = `<div class="hpbar" style="width:${width}px;height:5px"><div class="hpfill"></div></div>`;
  world.overlay.appendChild(bar);
  v.bar = bar;
  v.hpFill = bar.querySelector('.hpfill');
}

export function setBar(v, pct, show = true) {
  v.visibleBar = show;
  if (!v.hpFill) return;
  const f = Math.max(0, Math.min(1, pct / 100));
  if (v.lastPct === pct) return;
  v.lastPct = pct;
  v.hpFill.style.width = `${f * 100}%`;
  v.hpFill.style.background = f > 0.6 ? '#2fdc2f' : f > 0.3 ? '#e8d020' : '#e82020';
}

// A team-coloured selection circle on the ground.
export function teamRing(color, r = 0.8, opacity = 0.75) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.84, r, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  m.position.y = 0.05;
  m.renderOrder = 2;
  return m;
}

// ---------------------------------------------------------------- shapes

// A flat plate from a 2D outline (x right, y up), extruded to `depth` along
// Z and centred on it, with soft bevelled edges: blades, wings, fins, shields.
export function slab(pts, depth = 0.05, bevel = 0.015) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
  sh.lineTo(pts[0][0], pts[0][1]);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

// A smooth outline through control points (Catmull-Rom), for slab().
export function smooth(pts, n = 6, closed = true) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), closed, 'catmullrom', 0.5);
  return curve.getPoints(pts.length * n).map((p) => [p.x, p.y]);
}

// A bat-like wing membrane between finger bones, in the XY plane, root at
// the origin, spreading toward -X (behind) and up.
export function batWing(len = 1.6, h = 1.1) {
  const tips = [
    [-len * 0.35, h],
    [-len * 0.75, h * 0.8],
    [-len, h * 0.35],
    [-len * 0.85, -h * 0.15],
  ];
  const out = [[0, 0.1], [-len * 0.1, h * 0.55]];
  for (let i = 0; i < tips.length; i++) {
    out.push(tips[i]);
    const nx = tips[i + 1] ? (tips[i][0] + tips[i + 1][0]) / 2 + len * 0.06 : -len * 0.45;
    const ny = tips[i + 1] ? (tips[i][1] + tips[i + 1][1]) / 2 - h * 0.08 : -h * 0.05;
    out.push([nx, ny]);
  }
  out.push([-len * 0.15, -0.1]);
  return { geo: slab(out, 0.02, 0.008), tips };
}

// Merge a few indexed or non-indexed geometries (position, normal, uv) into one.
export function mergeGeos(geos) {
  // A tiny merge (position/normal/uv), enough for a few blobs.
  let count = 0;
  let icount = 0;
  for (const gg of geos) {
    count += gg.attributes.position.count;
    icount += gg.index ? gg.index.count : gg.attributes.position.count;
  }
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const idx = new Uint32Array(icount);
  let o = 0;
  let io = 0;
  for (const gg of geos) {
    pos.set(gg.attributes.position.array, o * 3);
    nor.set(gg.attributes.normal.array, o * 3);
    if (gg.attributes.uv) uv.set(gg.attributes.uv.array, o * 2);
    const src = gg.index ? gg.index.array : [...Array(gg.attributes.position.count).keys()];
    for (let i = 0; i < src.length; i++) idx[io + i] = src[i] + o;
    o += gg.attributes.position.count;
    io += src.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

// A cached unlit glow material (M.glowMat makes a new one per call).
const glowCache = new Map();
export function glow(color) {
  if (!glowCache.has(color)) glowCache.set(color, M.glowMat(color));
  return glowCache.get(color);
}

export const emissive =(color, e, k = 1, opts = {}) => M.mat(color, { emissive: e, emissiveIntensity: k, ...opts });

// Fel fire / arcane glow, drawn additively.
export function glowSprite(color, size = 1, opacity = 0.8) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  return m;
}

// ------------------------------------------------------------ Doom Guard

// A Doom Guard (nbal): a towering red-skinned demon on backward-jointed
// legs, with ram horns, black iron plate, burning eyes, leathery wings and a
// great notched sword held forward, so it reads its facing from above.
// About 3 units tall for a 48-unit collision. `accent` tints the war-paint
// sash (a controller's team colour).
export function doomGuard(accent = null) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = M.triMat('tex_hide.webp', '#8a2418', '#d25a40', 1.4, { roughness: 0.6 });
  const skinDark = M.triMat('tex_hide.webp', '#5a140c', '#a03a26', 1.4, { roughness: 0.65 });
  const iron = M.texMat('tex_plate.webp', '#3a3434', '#847872', 1, { metalness: 0.6, roughness: 0.4 });
  const horn = M.mat('#8a7458', { roughness: 0.45 });
  const eye = glow('#7dff3a');
  const legs = [];
  for (const s of [1, -1]) {
    const hip = new THREE.Group();
    hip.position.set(-0.1, 1.3, 0.3 * s);
    // Thigh forward, shin back, then a tall hoof: digitigrade.
    hip.add(M.mesh(M.tube([[0, 0, 0], [0.28, -0.35, 0.03 * s], [0.18, -0.7, 0.04 * s]], 0.2, 0.13, 8, 10), skin));
    hip.add(M.mesh(M.tube([[0.18, -0.7, 0.04 * s], [-0.12, -1.0, 0.04 * s], [-0.05, -1.22, 0.04 * s]], 0.12, 0.08, 8, 10), skinDark));
    hip.add(M.mesh(M.lathe([[0.001, 0], [0.11, 0.01], [0.1, 0.1], [0.06, 0.16]], 12), horn, -0.02, -1.3, 0.04 * s));
    hip.add(M.mesh(M.scaled(M.G.sphere, 0.16, 0.13, 0.15), iron, 0.24, -0.38, 0.05 * s));
    legs.push(hip);
    body.add(hip);
  }
  // Torso: a broad chest over a narrow waist, leaning forward.
  const torso = new THREE.Group();
  torso.position.set(0, 1.35, 0);
  torso.rotation.z = -0.18;
  body.add(torso);
  torso.add(M.mesh(M.blob(0.34, 0.3, 0.3, { seed: 91, amt: 0.05 }), skin, 0, 0.12, 0));
  torso.add(M.mesh(M.blob(0.58, 0.46, 0.62, { seed: 92, amt: 0.06 }), skin, 0.06, 0.62, 0));
  torso.add(M.mesh(M.blob(0.3, 0.22, 0.46, { seed: 93, amt: 0.05 }), skinDark, 0.22, 0.5, 0));
  // Iron: a belt with a skull buckle, spiked pauldrons.
  const belt = M.mesh(new THREE.TorusGeometry(0.33, 0.07, 8, 24).rotateX(Math.PI / 2), iron, 0, 0.2, 0);
  belt.scale.set(1, 1, 1.05);
  torso.add(belt);
  torso.add(M.mesh(M.blob(0.09, 0.09, 0.08, { seed: 94 }), M.boneMat(), 0.33, 0.2, 0));
  if (accent) {
    const sash = M.mesh(M.cloth(0.28, 0.5, 0.05), M.mat(accent, { side: THREE.DoubleSide, roughness: 0.8 }), 0.34, 0.0, 0);
    sash.rotation.y = Math.PI;
    torso.add(sash);
  }
  for (const s of [1, -1]) {
    const p = M.mesh(new THREE.SphereGeometry(0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), iron, 0, 0.92, 0.46 * s);
    p.rotation.x = 0.6 * s;
    p.scale.set(0.95, 0.65, 0.85);
    torso.add(p);
    for (let k = 0; k < 3; k++) {
      const sp = M.mesh(M.scaled(M.G.cone, 0.05, 0.26, 0.05), horn, -0.12 + k * 0.12, 1.12 - Math.abs(k - 1) * 0.04, 0.55 * s);
      sp.rotation.x = 0.4 * s;
      torso.add(sp);
    }
  }
  // Head: heavy brow, glowing eyes, jaw, and ram horns sweeping back.
  const head = new THREE.Group();
  head.position.set(0.32, 1.12, 0);
  torso.add(head);
  head.add(M.mesh(M.blob(0.2, 0.2, 0.19, { seed: 95 }), skin, 0, 0, 0));
  head.add(M.mesh(M.blob(0.15, 0.1, 0.16, { seed: 96 }), skinDark, 0.12, -0.12, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.scaled(M.G.sphere, 0.04, 0.03, 0.04), eye, 0.17, 0.04, 0.08 * s));
    head.add(M.mesh(M.tube([[0.02, 0.12, 0.12 * s], [-0.05, 0.3, 0.25 * s], [-0.28, 0.32, 0.32 * s], [-0.36, 0.12, 0.28 * s], [-0.26, -0.02, 0.22 * s]], 0.07, 0.015, 16, 10), horn));
    head.add(M.mesh(M.scaled(M.G.cone, 0.02, 0.07, 0.02).rotateZ(Math.PI), M.boneMat(), 0.2, -0.16, 0.05 * s));
  }
  // Wings: membranes on finger bones, half folded behind the shoulders.
  const wings = [];
  const wmat = M.mat('#3e0c08', { side: THREE.DoubleSide, roughness: 0.7, emissive: '#200000', emissiveIntensity: 0.3 });
  for (const s of [1, -1]) {
    const w = new THREE.Group();
    w.position.set(-0.25, 0.95, 0.3 * s);
    const { geo, tips } = batWing(1.5, 1.05);
    const mem = M.mesh(geo, wmat);
    w.add(mem);
    for (const [tx, ty] of tips) w.add(M.mesh(M.tube([[0, 0.1, 0], [tx * 0.5, ty * 0.6 + 0.1, 0], [tx, ty, 0]], 0.035, 0.012, 6, 6), skinDark));
    w.rotation.y = 0.6 * s;
    w.rotation.x = -0.25 * s;
    wings.push(w);
    torso.add(w);
  }
  // Arms: the sword arm thrust forward, the other clawed.
  const arm = (s, fwd) => {
    const a = new THREE.Group();
    a.position.set(0.05, 0.88, 0.58 * s);
    a.add(M.mesh(M.tube([[0, 0, 0], [0.15 + fwd * 0.15, -0.35, 0.05 * s], [0.35 + fwd * 0.3, -0.55, 0]], 0.14, 0.1, 8, 10), skin));
    a.add(M.mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.2, 12), iron, 0.3 + fwd * 0.28, -0.5, 0));
    a.add(M.mesh(M.blob(0.1, 0.1, 0.1, { seed: 97 }), skinDark, 0.4 + fwd * 0.32, -0.6, 0));
    torso.add(a);
    return a;
  };
  const swordArm = arm(-1, 1);
  arm(1, 0.2);
  const sword = new THREE.Group();
  sword.position.set(0.72, -0.62, 0);
  const blade = smooth([[0, -0.08], [1.25, -0.1], [1.55, 0.02], [1.2, 0.14], [0.85, 0.06], [0.7, 0.16], [0.35, 0.1], [0, 0.08]], 4);
  sword.add(M.mesh(slab(blade, 0.05, 0.02), M.mat('#6a6a72', { metalness: 0.85, roughness: 0.28 }), 0.1, 0, 0));
  sword.add(M.mesh(slab([[0.3, -0.02], [1.2, -0.03], [1.2, 0.03], [0.3, 0.02]], 0.06, 0.005), glow('#ff5a1a'), 0.1, 0, 0));
  sword.add(M.mesh(M.scaled(M.G.box, 0.08, 0.42, 0.1), iron, 0.08, 0, 0));
  sword.add(M.mesh(M.tube([[-0.3, 0, 0], [0.05, 0, 0]], 0.04, 0.04, 2, 8), M.leatherMat('#6a4030'), 0, 0, 0));
  sword.rotation.z = -0.35;
  sword.rotation.x = Math.PI / 2;
  swordArm.add(sword);
  // A tail.
  body.add(M.mesh(M.tube([[-0.25, 1.3, 0], [-0.7, 0.9, 0.1], [-1.0, 0.5, -0.1], [-1.2, 0.3, 0.05]], 0.1, 0.02, 14, 8), skinDark));
  body.scale.setScalar(1.12);
  g.userData = { body, legs, wings, sword: swordArm, head, kind: 'beast' };
  return g;
}

// Animates a Doom Guard view: stride, wing breathing, sword swing.
export function animDoomGuard(v, U, b, dt, t) {
  const moving = b.mv && !b.dead;
  v.walk = (v.walk || 0) + dt * (moving ? 8 : 0);
  U.legs.forEach((l, i) => (l.rotation.z = moving ? Math.sin(v.walk + i * Math.PI) * 0.45 : 0));
  U.body.position.y = moving ? Math.abs(Math.sin(v.walk)) * 0.07 : Math.sin(t * 1.6) * 0.02;
  U.wings.forEach((w, i) => (w.rotation.y = (i ? -1 : 1) * (0.6 + Math.sin(t * (b.ch ? 7 : 1.8)) * (b.ch ? 0.35 : 0.08))));
  if (v.castT > 0) v.castT -= dt;
  const sw = v.castT > 0 ? Math.sin((v.castT / 0.3) * Math.PI) : 0;
  U.sword.rotation.z = -sw * 1.2 + (b.ch ? -0.9 : 0);
  if (b.dead) {
    v.deadT = (v.deadT || 0) + dt;
    U.body.rotation.z = Math.min(Math.PI / 2, v.deadT * 3);
    v.obj.position.y = -Math.min(2, Math.max(0, v.deadT - 1) * 0.8);
  }
}
