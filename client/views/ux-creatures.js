// Creatures for the first Ultima-X ports: the Mosquito Swarm's mosquitoes and
// Ogre Mauler, Tornado Naga Madness's tornado and Ghostly Gambit's banshees.
// Models face +x. Skins list their moving parts in userData (anim) and pose
// them from userData.tick, so bakeModel leaves those parts alone.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { pose } from './e-common.js';

const add = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });

// A giant mosquito (the "Mosquito" is a wyvern model at scale 0.2): a slim
// banded abdomen in the team colour, a hunched thorax, a long needle
// proboscis, dangling legs and two pairs of glassy wings that buzz. It flies.
export function mosquito(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 1.2;
  g.add(body);
  const shell = M.mat('#3a3328', { roughness: 0.45, metalness: 0.25 });
  const team = M.mat(color, { roughness: 0.5 });
  const eye = M.mat('#c0261a', { roughness: 0.25, emissive: '#5a0a05', emissiveIntensity: 0.6 });
  const wingMat = new THREE.MeshStandardMaterial({ color: '#dfeef0', transparent: true, opacity: 0.38, roughness: 0.2, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
  body.add(M.mesh(M.blob(0.17, 0.15, 0.15, { seed: 61, amt: 0.05, detail: 2 }), shell, 0.08, 0, 0));
  // Abdomen: segments shrinking backwards, alternating shell and team colour.
  for (let i = 0; i < 4; i++) {
    const s = 0.13 - i * 0.018;
    body.add(M.mesh(M.scaled(M.G.sphere, s * 1.25, s, s), i % 2 ? shell : team, -0.12 - i * 0.14, -0.03 - i * 0.025, 0));
  }
  const head = new THREE.Group();
  head.position.set(0.28, 0.02, 0);
  head.add(M.mesh(M.scaled(M.G.sphere, 0.08), shell));
  for (const s of [1, -1]) head.add(M.mesh(M.scaled(M.G.sphere, 0.05), eye, 0.03, 0.02, 0.055 * s));
  head.add(M.mesh(M.tube([[0.05, -0.02, 0], [0.22, -0.08, 0], [0.42, -0.2, 0]], 0.014, 0.004, 6, 5), shell));
  body.add(head);
  for (const s of [1, -1]) {
    for (let i = 0; i < 3; i++) {
      const x = 0.15 - i * 0.09;
      body.add(M.mesh(M.tube([[x, -0.05, 0.05 * s], [x + 0.05, -0.2, 0.2 * s], [x - 0.04 + i * 0.03, -0.55, 0.26 * s]], 0.012, 0.006, 6, 5), shell));
    }
  }
  const wing = (s, back) => {
    const w = new THREE.Group();
    w.position.set(back ? -0.02 : 0.08, 0.1, 0.05 * s);
    const leaf = M.mesh(M.scaled(M.G.sphere, back ? 0.16 : 0.22, 0.01, 0.07), wingMat, back ? -0.08 : -0.1, 0, 0.22 * s * (back ? 0.8 : 1));
    leaf.rotation.y = s * (back ? 0.9 : 0.55);
    w.add(leaf);
    return w;
  };
  const wings = [wing(1, false), wing(-1, false), wing(1, true), wing(-1, true)];
  wings.forEach((w) => body.add(w));
  Object.assign(g.userData, { body, anim: wings, kind: 'hero' });
  let t = Math.random() * 10;
  g.userData.tick = pose((dt) => {
    t += dt;
    const flap = Math.sin(t * 60) * 0.55;
    wings.forEach((w, i) => { w.rotation.x = (i % 2 ? -1 : 1) * (0.25 + flap * (i < 2 ? 1 : 0.8)); });
    body.position.y = 1.2 + Math.sin(t * 3.1) * 0.08;
  });
  return g;
}

// Ogre Mauler (nogm, scale 3): a hulking two-legged ogre with a pot belly,
// small tusked head sunk between the shoulders, a loincloth and a spiked club.
export function ogreMauler() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = M.mat('#8f9a5a', { roughness: 0.8 });
  const skinDark = M.mat('#6b7444', { roughness: 0.85 });
  const cloth = M.leatherMat('#c8b090');
  const bone = M.mat('#efe6cc', { roughness: 0.5 });
  const wood = M.barkMat();
  const iron = M.mat('#5c5c60', { metalness: 0.6, roughness: 0.4 });
  for (const s of [1, -1]) {
    body.add(M.mesh(M.tube([[0, 0.95, 0.3 * s], [0.05, 0.5, 0.34 * s], [0, 0.1, 0.32 * s]], 0.2, 0.16, 6, 8), skin));
    body.add(M.mesh(M.blob(0.2, 0.08, 0.15, { seed: 70, detail: 1 }), skinDark, 0.08, 0.05, 0.32 * s));
  }
  body.add(M.mesh(M.blob(0.62, 0.62, 0.58, { seed: 71, amt: 0.06 }), skin, 0.05, 1.45, 0));
  body.add(M.mesh(M.blob(0.5, 0.45, 0.5, { seed: 72, amt: 0.05 }), skin, 0.18, 1.15, 0));
  body.add(M.mesh(M.lathe([[0.62, 0], [0.66, 0.15], [0.62, 0.32], [0.5, 0.4]], 16), cloth, 0, 0.75, 0));
  body.add(M.mesh(M.blob(0.66, 0.35, 0.62, { seed: 73, amt: 0.08 }), skinDark, -0.05, 1.95, 0));
  const head = new THREE.Group();
  head.position.set(0.35, 2.05, 0);
  head.add(M.mesh(M.blob(0.28, 0.26, 0.27, { seed: 74, amt: 0.06, detail: 2 }), skin));
  head.add(M.mesh(M.blob(0.16, 0.08, 0.2, { seed: 75, detail: 1 }), skinDark, 0.12, 0.12, 0));
  for (const s of [1, -1]) {
    const tusk = M.mesh(M.scaled(M.G.cone, 0.035, 0.16, 0.035), bone, 0.24, -0.08, 0.1 * s);
    tusk.rotation.z = -0.3;
    head.add(tusk);
    head.add(M.mesh(M.scaled(M.G.sphere, 0.03), M.mat('#ffcf40', { emissive: '#803000', emissiveIntensity: 0.4 }), 0.24, 0.08, 0.1 * s));
  }
  body.add(head);
  // The left arm hangs; the right one carries the club and swings it.
  body.add(M.mesh(M.tube([[0.1, 1.95, -0.62], [0.2, 1.45, -0.78], [0.35, 1.05, -0.72]], 0.18, 0.15, 6, 8), skin));
  const arm = new THREE.Group();
  arm.position.set(0.1, 1.95, 0.62);
  arm.add(M.mesh(M.tube([[0, 0, 0], [0.15, -0.45, 0.12], [0.4, -0.75, 0.08]], 0.18, 0.15, 6, 8), skin));
  const club = new THREE.Group();
  club.position.set(0.45, -0.8, 0.08);
  club.add(M.mesh(M.tube([[0, 0, 0], [0.3, 0.45, 0], [0.55, 1.1, 0]], 0.08, 0.2, 6, 8), wood));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const sp = M.mesh(M.scaled(M.G.cone, 0.04, 0.16, 0.04), iron, 0.45 + Math.cos(a) * 0.17, 0.9, Math.sin(a) * 0.17);
    sp.rotation.set(Math.sin(a) * 1.4, 0, -Math.cos(a) * 1.4);
    club.add(sp);
  }
  arm.add(club);
  body.add(arm);
  g.userData.body = body;
  g.userData.arm = arm;
  return g;
}

// A naga tornado: a twisting funnel of grey-green wind with debris caught in
// it and a ring of dust where it touches the water.
export function tornado() {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  g.add(spin);
  const layers = [];
  for (let i = 0; i < 3; i++) {
    const prof = [];
    for (let k = 0; k <= 10; k++) {
      const y = k * 0.38;
      prof.push([0.18 + Math.pow(k / 10, 1.6) * (1.5 + i * 0.25) + Math.sin(k * 1.3 + i) * 0.05, y]);
    }
    const mesh = M.mesh(M.lathe(prof, 24), new THREE.MeshBasicMaterial({ color: ['#9fb5ad', '#7d958c', '#c8dcd4'][i], transparent: true, opacity: [0.42, 0.3, 0.22][i], depthWrite: false, side: THREE.DoubleSide }));
    mesh.rotation.y = i * 1.3;
    layers.push(mesh);
    spin.add(mesh);
  }
  // Spiral bands of dust wound round the funnel: they read from straight above.
  const band = M.mat('#d8e4dc', { roughness: 1, transparent: true, opacity: 0.75 });
  for (let j = 0; j < 3; j++) {
    const pts = [];
    for (let k = 0; k <= 24; k++) {
      const h = k * 0.15;
      const r = 0.2 + Math.pow(h / 3.6, 1.6) * 1.7;
      const a = j * 2.09 + k * 0.5;
      pts.push([Math.cos(a) * r, h, Math.sin(a) * r]);
    }
    const b = M.mesh(M.tube(pts, 0.05, 0.11, 48, 5), band);
    layers.push(b);
    spin.add(b);
  }
  const debris = [];
  const dirt = M.mat('#6a5a44', { roughness: 0.9 });
  for (let i = 0; i < 10; i++) {
    const d = M.mesh(M.blob(0.07 + (i % 3) * 0.03, 0.05, 0.06, { seed: 80 + i, detail: 1 }), dirt);
    d.userData.h = 0.3 + (i / 10) * 3.2;
    d.userData.a = i * 2.4;
    debris.push(d);
    spin.add(d);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.5, 32).rotateX(-Math.PI / 2), add('#e8f4ee', 0.25));
  ring.position.y = 0.05;
  g.add(ring);
  g.userData = { layers, debris, ring, spin };
  return g;
}

export function spinTornado(g, dt, t) {
  const { layers, debris, ring, spin } = g.userData;
  layers.forEach((l, i) => { l.rotation.y += dt * (6 + i * 2.5); });
  spin.rotation.z = Math.sin(t * 1.7) * 0.06;
  spin.rotation.x = Math.cos(t * 1.3) * 0.06;
  debris.forEach((d) => {
    d.userData.a += dt * (5 - d.userData.h);
    const r = 0.3 + (d.userData.h / 3.6) * 1.6;
    d.position.set(Math.cos(d.userData.a) * r, d.userData.h, Math.sin(d.userData.a) * r);
    d.rotation.x += dt * 4;
  });
  ring.rotation.y -= dt * 3;
  ring.scale.setScalar(1 + Math.sin(t * 5) * 0.08);
}

// A banshee: a hooded, translucent spirit whose robe trails into wisps, with
// glowing eyes and long reaching arms. Neutral banshees are pale; players'
// banshees are washed in their colour. Banshees bob as they float.
export function banshee(color, neutral = false) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const tint = new THREE.Color(neutral ? '#cfe6f0' : color).lerp(new THREE.Color('#e6f4ff'), neutral ? 0 : 0.35);
  // A crowd of neutral banshees must bake (bakeModel skips see-through
  // materials), so theirs glow instead of letting the ground show through.
  const robe = neutral
    ? new THREE.MeshStandardMaterial({ color: tint, roughness: 0.4, emissive: '#6a9ab0', emissiveIntensity: 0.45, side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({ color: tint, transparent: true, opacity: 0.62, roughness: 0.4, emissive: tint, emissiveIntensity: 0.25, side: THREE.DoubleSide, depthWrite: false });
  const inner = M.mat('#1a2030', { roughness: 0.8 });
  const eyes = M.glowMat(neutral ? '#bff6ff' : '#ffffff');
  // Robe: a flared, wavy-hemmed bell narrowing into the hood.
  const prof = [[0.05, 0.25], [0.36, 0.3], [0.42, 0.45], [0.34, 0.8], [0.25, 1.15], [0.2, 1.4], [0.04, 1.45]];
  body.add(M.mesh(M.lathe(prof, 20), robe));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    body.add(M.mesh(M.tube([[Math.cos(a) * 0.35, 0.32, Math.sin(a) * 0.35], [Math.cos(a + 0.4) * 0.3, 0.12, Math.sin(a + 0.4) * 0.3], [Math.cos(a + 0.8) * 0.12, -0.02, Math.sin(a + 0.8) * 0.12]], 0.07, 0.01, 6, 5), robe));
  }
  // Hood with a dark face and two glowing eyes.
  body.add(M.mesh(M.blob(0.22, 0.24, 0.21, { seed: 91, amt: 0.05, detail: 2 }), robe, 0, 1.62, 0));
  body.add(M.mesh(M.scaled(M.G.sphere, 0.12, 0.15, 0.14), inner, 0.12, 1.58, 0));
  for (const s of [1, -1]) {
    body.add(M.mesh(M.scaled(M.G.sphere, 0.03, 0.02, 0.025), eyes, 0.24, 1.62, 0.06 * s));
    body.add(M.mesh(M.tube([[0.02, 1.38, 0.22 * s], [0.25, 1.2, 0.32 * s], [0.48, 1.12, 0.22 * s]], 0.06, 0.02, 8, 6), robe));
  }
  if (!neutral) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), add(tint.getStyle(), 0.12));
    light.position.y = 1.0;
    body.add(light);
  }
  body.position.y = 0.25;
  // Neutral banshees come in crowds: nothing is referenced, so a bake merges
  // the whole model, and their view bobs the root instead.
  if (neutral) return g;
  Object.assign(g.userData, { body, kind: 'hero' });
  let t = Math.random() * 10;
  g.userData.tick = pose((dt) => {
    t += dt;
    body.position.y = 0.25 + Math.sin(t * 2.2) * 0.08;
    body.rotation.x = Math.sin(t * 1.3) * 0.04;
  });
  return g;
}
