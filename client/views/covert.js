// Covert Kitty (#8): the Doom Guards, the night that turns to day at dawn,
// Shadowmeld and Cripple. The Summer Tree Walls come from the 'upmaze'
// builder; a shadowmelded rival is simply not in your snapshot, and your own
// hero shows see-through ('invis').
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerEvent } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { bakeModel } from './walkgrid-art.js';

// A Doom Guard: a towering demon on goat legs with a hide of dark red,
// black iron plate, sweeping horns, fel-green eyes, bat wings and a great
// runed blade. Faces +X.
export function doomGuard() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const hide = M.triMat('tex_hide.webp', '#7a2a22', '#e07860', 1.2);
  const dark = M.triMat('tex_hide.webp', '#3a1612', '#a05040', 1.4);
  const iron = M.texMat('tex_plate.webp', '#3a3438', '#6a6068', 1, { metalness: 0.7, roughness: 0.45 });
  const horn = M.mat('#2a2220', { roughness: 0.45 });
  const fel = M.glowMat('#7aff4a');
  const legs = [];
  for (const s of [1, -1]) {
    const hip = new THREE.Group();
    hip.position.set(0, 1.35, 0.3 * s);
    hip.add(M.mesh(M.tube([[0, 0.05, 0], [0.28, -0.45, 0.03 * s], [-0.15, -0.9, 0.03 * s], [0.02, -1.3, 0]], 0.22, 0.1, 12, 10), hide));
    hip.add(M.mesh(M.blob(0.14, 0.1, 0.12, { seed: 100 + s, detail: 2 }), horn, 0.06, -1.32, 0));
    hip.add(M.mesh(M.blob(0.2, 0.2, 0.2, { seed: 102, detail: 2 }), iron, 0.26, -0.45, 0.04 * s));
    legs.push(hip);
    body.add(hip);
  }
  const lean = new THREE.Group();
  lean.position.set(0, 1.35, 0);
  lean.rotation.z = -0.12;
  body.add(lean);
  lean.add(M.mesh(M.blob(0.38, 0.3, 0.42, { seed: 104, detail: 2 }), dark, 0, 0.15, 0));
  lean.add(M.mesh(M.blob(0.55, 0.55, 0.62, { seed: 105, amt: 0.08, detail: 2 }), hide, 0.05, 0.75, 0));
  lean.add(M.mesh(M.blob(0.42, 0.3, 0.55, { seed: 106, amt: 0.06, detail: 2 }), iron, 0.2, 0.72, 0));
  const skirt = M.mesh(new THREE.CylinderGeometry(0.34, 0.5, 0.45, 12, 1, true), iron, 0.02, 0.05, 0);
  lean.add(skirt);
  for (const s of [1, -1]) {
    const p = M.mesh(M.blob(0.3, 0.2, 0.3, { seed: 107, detail: 2 }), iron, 0, 1.18, 0.62 * s);
    lean.add(p);
    for (let i = 0; i < 3; i++) lean.add(M.mesh(M.scaled(M.G.cone, 0.06, 0.32, 0.06), horn, -0.12 + i * 0.12, 1.4, 0.66 * s));
  }
  // Head: heavy brow, jaw, tusks, horns sweeping back and up, fel eyes.
  const head = new THREE.Group();
  head.position.set(0.32, 1.45, 0);
  head.add(M.mesh(M.blob(0.25, 0.26, 0.24, { seed: 110, detail: 2 }), hide, 0, 0, 0));
  head.add(M.mesh(M.blob(0.2, 0.12, 0.2, { seed: 111, detail: 2 }), dark, 0.12, -0.16, 0));
  for (const s of [1, -1]) {
    head.add(M.mesh(M.scaled(M.G.sphere, 0.045), fel, 0.22, 0.05, 0.1 * s));
    head.add(M.mesh(M.tube([[0.2, -0.2, 0.1 * s], [0.28, -0.08, 0.13 * s], [0.26, 0.02, 0.12 * s]], 0.035, 0.008, 6, 6), M.boneMat()));
    head.add(M.mesh(M.tube([[0.02, 0.15, 0.14 * s], [-0.1, 0.4, 0.3 * s], [-0.4, 0.55, 0.36 * s], [-0.62, 0.42, 0.3 * s], [-0.66, 0.2, 0.26 * s]], 0.09, 0.015, 18, 10), horn));
  }
  lean.add(head);
  // Wings: bone struts with a ragged membrane, folded half open behind.
  const wings = [];
  const membrane = M.mat('#5a1a18', { roughness: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
  for (const s of [1, -1]) {
    const w = new THREE.Group();
    w.position.set(-0.35, 1.2, 0.35 * s);
    const tips = [[-0.5, 1.3, 0.6], [-1.1, 0.9, 1.0], [-1.3, 0.2, 0.9], [-0.9, -0.3, 0.5]];
    for (const [x, y, z] of tips) w.add(M.mesh(M.tube([[0, 0, 0], [x * 0.5, y * 0.6 + 0.2, z * 0.5 * s], [x, y, z * s]], 0.045, 0.012, 8, 6), horn));
    const shp = new THREE.BufferGeometry();
    const pts = [[0, 0, 0], ...tips.map(([x, y, z]) => [x, y, z * s])];
    const verts = [];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const mid = [(a[0] + b[0]) / 2 + 0.12, (a[1] + b[1]) / 2 + 0.05, (a[2] + b[2]) / 2 * 0.92];
      verts.push(...pts[0], ...a, ...mid, ...pts[0], ...mid, ...b);
    }
    shp.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    shp.computeVertexNormals();
    w.add(M.mesh(shp, membrane));
    wings.push(w);
    lean.add(w);
  }
  // Arms: the right hand holds the blade, the left is clawed.
  const arms = [];
  for (const s of [1, -1]) {
    const a = new THREE.Group();
    a.position.set(0.05, 1.05, 0.66 * s);
    a.add(M.mesh(M.tube([[0, 0, 0], [0.15, -0.4, 0.08 * s], [0.45, -0.6, 0.04 * s]], 0.17, 0.12, 10, 10), hide));
    a.add(M.mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.28, 12).rotateZ(Math.PI / 2 - 0.5), iron, 0.3, -0.52, 0.05 * s));
    a.add(M.mesh(M.blob(0.12, 0.12, 0.12, { seed: 112, detail: 2 }), dark, 0.5, -0.62, 0));
    arms.push(a);
    lean.add(a);
  }
  const blade = new THREE.Group();
  blade.position.set(0.5, -0.62, 0);
  blade.add(M.mesh(M.tube([[0, -0.25, 0], [0, 0.2, 0]], 0.04, 0.04, 2, 6), M.leatherMat('#806060')));
  blade.add(M.mesh(M.scaled(M.G.box, 0.12, 0.08, 0.5), iron, 0, 0.22, 0));
  const sh = new THREE.Shape();
  sh.moveTo(-0.09, 0);
  sh.lineTo(0.1, 0);
  sh.quadraticCurveTo(0.2, 0.9, 0.05, 1.7);
  sh.lineTo(-0.03, 1.55);
  sh.quadraticCurveTo(-0.14, 0.8, -0.09, 0);
  const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 2, curveSegments: 10 });
  bg.translate(0, 0.25, -0.015);
  bg.rotateY(Math.PI / 2);
  blade.add(M.mesh(bg, M.mat('#4a4448', { metalness: 0.8, roughness: 0.3 })));
  const rune = M.mesh(M.scaled(M.G.box, 0.012, 1.1, 0.05), fel, 0, 0.95, 0);
  blade.add(rune);
  blade.rotation.z = -0.6;
  arms[0].add(blade);
  for (const s of [-1]) for (let i = -1; i <= 1; i++) arms[1].add(M.mesh(M.scaled(M.G.cone, 0.03, 0.14, 0.03).rotateZ(-Math.PI / 2), horn, 0.62, -0.64, i * 0.05));
  body.add(M.mesh(M.tube([[-0.4, 1.3, 0], [-0.9, 0.9, 0.1], [-1.2, 0.35, 0.2], [-1.35, 0.1, 0.1]], 0.1, 0.02, 14, 8), hide));
  body.scale.setScalar(1.2);
  g.userData = { body, legs, arms, wings, lean, blade, rune };
  return g;
}

registerView('doomguard', {
  make(e, world, v) {
    const g = bakeModel(doomGuard());
    v.parts = g.userData;
    return g;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    const t = world.time;
    const moving = !!b.mv;
    v.walk = (v.walk || 0) + dt * (moving ? 8.5 : 0);
    P.body.position.y = moving ? Math.abs(Math.sin(v.walk)) * 0.08 : 0;
    P.legs[0].rotation.z = moving ? Math.sin(v.walk) * 0.5 : 0;
    P.legs[1].rotation.z = moving ? -Math.sin(v.walk) * 0.5 : 0;
    P.wings.forEach((w, i) => (w.rotation.x = (i ? -1 : 1) * (0.1 + Math.sin(t * 1.6 + v.id) * 0.12)));
    if (v.castT > 0) v.castT -= dt;
    v.raise = Math.max(0, Math.min(1, (v.raise || 0) + dt * (b.sw ? 4 : -4)));
    const cut = v.castT > 0 ? Math.sin((v.castT / 0.3) * Math.PI) : 0;
    v.chan = Math.max(0, Math.min(1, (v.chan || 0) + dt * (b.cs ? 5 : -4)));
    P.arms[0].rotation.z = Math.sin(v.walk) * (moving ? 0.25 : 0) + v.raise * 1.5 - cut * 1.3;
    P.arms[1].rotation.z = -Math.sin(v.walk) * (moving ? 0.25 : 0) + v.chan * 1.6;
    // Fel embers off the blade, more while it swings or he casts.
    const rate = 3 + v.raise * 20 + v.chan * 25;
    v.acc = (v.acc || 0) + dt * rate;
    const wp = new THREE.Vector3();
    while (v.acc >= 1) {
      v.acc -= 1;
      (v.chan > 0.3 ? P.arms[1] : P.blade).getWorldPosition(wp);
      world.fx.trail(wp.x + (Math.random() - 0.5) * 0.4, wp.y + Math.random() * (v.chan > 0.3 ? 0.4 : 1.4), wp.z + (Math.random() - 0.5) * 0.4, '#7aff4a', 0.4, 0.5, 0.15);
    }
  },
});

// Night into day: blends the lighting from the 'night' theme to a morning
// sky between 05:30 and 06:30 (dawn at 06:00 on the server's clock).
registerView('covertsky', {
  make(e, world, v) {
    v.save = {
      bg: world.scene.background?.clone(),
      fog: world.scene.fog?.color.clone(),
      sun: world.sun.color.clone(),
      sunI: world.sun.intensity,
      hemi: world.hemi.color.clone(),
      ground: world.hemi.groundColor.clone(),
    };
    v.day = {
      bg: new THREE.Color('#9ab8d8'),
      fog: new THREE.Color('#b0c4d4'),
      sun: new THREE.Color('#ffe2b8'),
      sunI: 2.4,
      hemi: new THREE.Color('#dde8ff'),
      ground: new THREE.Color('#3a4a28'),
    };
    return new THREE.Group();
  },
  update(v, a, b, k, dt, world) {
    const h = b.h ?? 1;
    const d = Math.max(0, Math.min(1, (h - 5.5) / 1));
    const s = v.save;
    const D = v.day;
    if (s.bg && world.scene.background?.isColor) world.scene.background.copy(s.bg).lerp(D.bg, d);
    if (s.fog && world.scene.fog) world.scene.fog.color.copy(s.fog).lerp(D.fog, d);
    world.sun.color.copy(s.sun).lerp(D.sun, d);
    world.sun.intensity = s.sunI + (D.sunI - s.sunI) * d;
    world.hemi.color.copy(s.hemi).lerp(D.hemi, d);
    world.hemi.groundColor.copy(s.ground).lerp(D.ground, d);
  },
  remove(v, world) {
    const s = v.save;
    if (s.bg && world.scene.background?.isColor) world.scene.background.copy(s.bg);
    if (s.fog && world.scene.fog) world.scene.fog.color.copy(s.fog);
    world.sun.color.copy(s.sun);
    world.sun.intensity = s.sunI;
    world.hemi.color.copy(s.hemi);
    world.hemi.groundColor.copy(s.ground);
  },
});

// Shadowmeld: a soft violet mist settles round the huntress.
registerEvent('meld', (e, world) => {
  world.fx.burst(e.x, 0.8, e.y, '#8a6aff', { n: 16, speed: 1.2, size: 0.6, life: 1.2, up: 0.3, grav: 0 });
  world.fx.ring(e.x, e.y, 1, '#b8a0ff', 1.2);
  play('windwalk');
});

// Cripple: a dark green curse streaks from the guard to its victim.
registerEvent('cripple', (e, world) => {
  world.fx.glow(e.x1, 2.2, e.y1, '#7aff4a', 2, 0.35);
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    world.fx.trail(e.x1 + (e.x2 - e.x1) * t, 2 - t * 1.2, e.y1 + (e.y2 - e.y1) * t, '#4aff3a', 0.5, 0.4 + t * 0.3, 0.1);
  }
  world.fx.burst(e.x2, 0.8, e.y2, '#2a8a1a', { n: 22, speed: 2, size: 0.5, life: 0.8, additive: false });
  world.fx.ring(e.x2, e.y2, 1.1, '#5aff3a', 0.5);
  play('drain');
});

registerEvent('felhit', (e, world) => {
  world.fx.burst(e.x, 1, e.y, '#6aff3a', { n: 14, speed: 3, size: 0.45, life: 0.4 });
});
