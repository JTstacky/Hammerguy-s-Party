// The Unseen (#34): the invisible Draenei Guardians (drawn only when one of
// your Sentry Wards detects them, and then shimmering like a detected
// invisible unit in WC3), the Sentry Ward, the Stasis Trap and their effects.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerEvent } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { fxTexture } from '../../engine/client/render/effects.js';
import { bakeModel } from './walkgrid-art.js';

// A Draenei Guardian: a tall, hoofed warrior with blue skin, face tendrils,
// bronze plate and a long curved blade held ready. Faces +X.
export function guardian() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = M.mat('#6f7cc8', { roughness: 0.6 });
  const skinDark = M.mat('#4a5494', { roughness: 0.65 });
  const bronze = M.texMat('tex_plate.webp', '#8a6a3a', '#d8a868', 1, { metalness: 0.6, roughness: 0.4 });
  const cloth = M.mat('#3a2a5a', { roughness: 0.85, side: THREE.DoubleSide });
  const steel = M.silverMat();
  for (const s of [1, -1]) {
    const hip = new THREE.Group();
    hip.position.set(0, 0.95, 0.17 * s);
    hip.add(M.mesh(M.tube([[0, 0, 0], [0.14, -0.35, 0], [-0.1, -0.65, 0], [0.02, -0.9, 0]], 0.12, 0.06, 10, 10), skin));
    hip.add(M.mesh(M.blob(0.1, 0.06, 0.08, { seed: 90 + s, detail: 2 }), M.mat('#222', { roughness: 0.4 }), 0.05, -0.92, 0));
    body.add(hip);
  }
  const skirt = M.mesh(M.cloth(0.5, 0.55, 0.2, 0.05), cloth, 0.05, 0.75, 0);
  skirt.rotation.y = Math.PI;
  body.add(skirt);
  body.add(M.mesh(M.lathe([[0.22, 0.9], [0.28, 1.1], [0.34, 1.35], [0.3, 1.55], [0.16, 1.66], [0.08, 1.7]]), bronze));
  for (const s of [1, -1]) {
    const p = M.mesh(new THREE.SphereGeometry(0.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), bronze, 0, 1.55, 0.32 * s);
    p.rotation.x = 0.55 * s;
    body.add(p);
    body.add(M.mesh(M.scaled(M.G.cone, 0.05, 0.22, 0.05), bronze, -0.02, 1.72, 0.38 * s));
  }
  // Head: long face, glowing eyes, tendrils hanging from the chin, crest.
  const head = new THREE.Group();
  head.position.set(0.08, 1.85, 0);
  head.add(M.mesh(M.blob(0.16, 0.2, 0.15, { seed: 93, detail: 2 }), skin, 0, 0, 0));
  for (const s of [1, -1]) head.add(M.mesh(M.scaled(M.G.sphere, 0.03), M.glowMat('#c8f0ff'), 0.13, 0.04, 0.06 * s));
  for (let i = 0; i < 4; i++) {
    const z = (i - 1.5) * 0.05;
    head.add(M.mesh(M.tube([[0.1, -0.12, z], [0.14, -0.3, z * 1.3], [0.06, -0.48, z * 1.6]], 0.025, 0.006, 8, 6), skinDark));
  }
  head.add(M.mesh(M.tube([[-0.05, 0.15, 0], [-0.18, 0.3, 0], [-0.35, 0.28, 0]], 0.06, 0.015, 8, 8), bronze));
  body.add(head);
  // Arms and the blade.
  const arms = [];
  for (const s of [1, -1]) {
    const a = new THREE.Group();
    a.position.set(0.02, 1.5, 0.36 * s);
    a.add(M.mesh(M.tube([[0, 0, 0], [0.12, -0.3, 0.05 * s], [0.34, -0.42, 0.02 * s]], 0.08, 0.06, 8, 8), skin));
    a.add(M.mesh(M.blob(0.07, 0.07, 0.07, { seed: 94, detail: 2 }), skinDark, 0.37, -0.43, 0));
    arms.push(a);
    body.add(a);
  }
  const blade = new THREE.Group();
  blade.position.set(0.37, -0.43, 0);
  blade.add(M.mesh(M.tube([[0, -0.15, 0], [0, 0.15, 0]], 0.03, 0.03, 2, 6), M.leatherMat()));
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.quadraticCurveTo(0.18, 0.5, 0.05, 1.15);
  sh.quadraticCurveTo(0.02, 0.6, -0.07, 0.05);
  sh.lineTo(0, 0);
  const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 2, curveSegments: 12 });
  bg.translate(0, 0.15, -0.01);
  blade.add(M.mesh(bg, steel));
  blade.add(M.mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 12).rotateY(Math.PI / 2), bronze, 0, 0.15, 0));
  blade.rotation.z = -0.35;
  arms[0].add(blade);
  body.scale.setScalar(1.05);
  g.userData = { body, arms, blade };
  return g;
}

// Detected invisible units are see-through, like WC3's.
function ghostly(obj, opacity) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.transparent = true;
    o.material.opacity = opacity;
    o.material.depthWrite = false;
    o.castShadow = false;
  });
}

registerView('guardian', {
  make(e, world, v) {
    const g = bakeModel(guardian());
    ghostly(g, 0.55);
    v.parts = g.userData;
    world.fx.glow(e.x, 1.2, e.y, '#9fd0ff', 1.6, 0.4);
    const stars = new THREE.Group();
    for (let i = 0; i < 3; i++) stars.add(M.mesh(new THREE.OctahedronGeometry(0.1), M.glowMat('#bfe8ff'), Math.cos(i * 2.1) * 0.35, 2.5, Math.sin(i * 2.1) * 0.35));
    stars.visible = false;
    g.add(stars);
    v.parts.stars = stars;
    return g;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    const t = world.time;
    if (v.castT > 0) v.castT -= dt;
    v.raise = Math.max(0, Math.min(1, (v.raise || 0) + dt * (b.sw ? 6 : -4)));
    const cut = v.castT > 0 ? Math.sin((v.castT / 0.3) * Math.PI) : 0;
    P.arms[0].rotation.z = v.raise * 1.3 - cut * 1.2;
    P.body.position.y = b.st ? 0 : Math.sin(t * 2 + v.id) * 0.03;
    P.stars.visible = !!b.st;
    if (b.st) P.stars.rotation.y = t * 3;
    // The shimmer of a detected invisible unit.
    if (Math.random() < dt * 6) world.fx.trail(v.x + (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 1.6, v.z + (Math.random() - 0.5) * 0.8, '#a8d8ff', 0.3, 0.5, 0.1);
  },
});

// A Sentry Ward: a carved post topped by a glowing eye, with its owner's
// detection circle round it. Fades in its last second.
function sentryWard() {
  const g = new THREE.Group();
  g.add(M.mesh(M.tube([[0, 0, 0], [0.02, 0.6, 0], [0, 1.2, 0]], 0.07, 0.05, 6, 8), M.barkMat()));
  g.add(M.mesh(M.blob(0.14, 0.08, 0.14, { seed: 71, detail: 2 }), M.boulderMat(), 0, 0.05, 0));
  for (const s of [1, -1]) g.add(M.mesh(M.tube([[0, 1.1, 0], [0.05, 1.25, 0.14 * s], [0.02, 1.45, 0.18 * s]], 0.03, 0.008, 6, 6), M.boneMat()));
  g.add(M.mesh(M.tube([[0, 0.7, 0], [-0.1, 0.62, 0.05], [-0.14, 0.45, 0.06]], 0.02, 0.012, 6, 6), M.mat('#a02018')));
  const eye = M.mesh(M.scaled(M.G.sphere, 0.13), M.glowMat('#7fe8ff'), 0, 1.32, 0);
  g.add(eye);
  const pupil = M.mesh(M.scaled(M.G.sphere, 0.05), M.mat('#0a1a24'), 0.1, 1.32, 0);
  g.add(pupil);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7fe8ff', transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }));
  ring.position.y = 0.06;
  ring.visible = false;
  g.add(ring);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#4fa8c8', transparent: true, opacity: 0.06, depthWrite: false }));
  fill.position.y = 0.05;
  fill.visible = false;
  g.add(fill);
  g.userData = { eye, pupil, ring, fill };
  return g;
}

registerView('sentryward', {
  make(e, world, v) {
    const g = bakeModel(sentryWard());
    v.parts = g.userData;
    if (e.r) {
      v.parts.ring.visible = v.parts.fill.visible = true;
      v.parts.ring.scale.set(e.r, 1, e.r);
      v.parts.fill.scale.set(e.r, 1, e.r);
    }
    return g;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    v.obj.rotation.y = 0;
    const t = world.time;
    // The eye looks round.
    const look = t * 1.3 + v.id;
    P.pupil.position.set(Math.cos(look) * 0.1, 1.32, Math.sin(look) * 0.1);
    const fade = Math.min(1, (b.t ?? 10) / 1);
    P.eye.scale.setScalar(0.4 + 0.6 * fade);
    P.ring.material.opacity = 0.35 * fade;
    P.fill.material.opacity = 0.06 * fade;
    if (Math.random() < dt * 4) world.fx.trail(v.x, 1.35, v.z, '#9ff0ff', 0.25, 0.6, 0.15);
  },
});

// The Stasis Trap: a squat stone totem with a rune that lights when armed.
function stasisTotem() {
  const g = new THREE.Group();
  const stone = M.triMat('tex_boulder.webp', '#6a6a72', '#b8b8c8', 1.4);
  g.add(M.mesh(M.lathe([[0.2, 0], [0.22, 0.1], [0.16, 0.5], [0.18, 0.62], [0.1, 0.72], [0.01, 0.74]], 12), stone));
  for (const s of [1, -1]) g.add(M.mesh(M.tube([[0, 0.55, 0.15 * s], [0.02, 0.7, 0.26 * s], [0, 0.85, 0.28 * s]], 0.04, 0.01, 6, 6), M.boneMat()));
  const rune = M.mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 16).rotateY(Math.PI / 2), M.glowMat('#6ab8ff'), 0.19, 0.35, 0);
  g.add(rune);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#4a9aff', map: fxTexture('fx_flare.webp'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  glow.position.y = 0.05;
  g.add(glow);
  g.userData = { rune, glow };
  return g;
}

registerView('stasistrap', {
  make(e, world, v) {
    const g = bakeModel(stasisTotem());
    v.parts = g.userData;
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.obj.rotation.y = world.time * 0.2;
    const armed = !!b.armed;
    const pulse = 0.5 + Math.sin(world.time * 5) * 0.5;
    v.parts.rune.scale.setScalar(armed ? 1 + pulse * 0.2 : 0.7);
    v.parts.rune.material.color.set(armed ? '#8ad0ff' : '#36506a');
    v.parts.glow.material.opacity = armed ? 0.25 + pulse * 0.25 : 0.05;
  },
});

registerEvent('wardup', (e, world) => {
  world.fx.burst(e.x, 0.6, e.y, e.trap ? '#6ab8ff' : '#9ff0ff', { n: 18, speed: 2.5, size: 0.4, life: 0.5 });
  world.fx.dustCloud(e.x, e.y, 0.5, '#4a4a58', 4);
  play('shield');
});

// The trap goes off: a blue shockwave and crackle over the stun area.
registerEvent('stasis', (e, world) => {
  world.fx.shockwave(e.x, e.y, e.r, '#8ad0ff', 0.6);
  world.fx.flash(e.x, e.y, e.r, '#6ab8ff', 0.4);
  world.fx.ring(e.x, e.y, e.r, '#bfe8ff', 0.7);
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * e.r;
    world.fx.bolt(e.x, e.y, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, '#bfe8ff');
  }
  play('zap');
});
