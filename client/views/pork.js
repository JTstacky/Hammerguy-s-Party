// Pork the Piggy (#36): the Barbeque Piggy, thrown spears, the attack-ground
// marker and the split-rail fence round the pen.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { play } from '../../engine/client/audio.js';

// A low-poly sphere for a skin's small parts (eyes, studs, knuckles).
const LOW_SPHERE = new THREE.SphereGeometry(1, 10, 8);

// The Troll Headhunter (`ohun`), the player unit: a tall, stooped, lanky
// blue-skinned troll with a red mohawk, a long nose, swept-back ears and big
// upturned tusks, in a leather loincloth with a bone necklace and a spiked
// shoulder pad, a throwing spear raised in his right hand and more on his
// back. Team colour on the loincloth, the arm wraps and the spear bindings.
// Faces +X.
export function headhunter(color) {
  const { mesh, blob, tube, cloth, mat, G, scaled } = M;
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(1.35);
  g.add(body);
  const skin = mat('#5ea8cc', { roughness: 0.55 });
  const hairM = mat('#e2401e', { roughness: 0.85 });
  const tusk = M.boneMat();
  const leather = M.leatherMat('#b08050');
  const team = mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  const eye = mat('#ffe060', { roughness: 0.3, emissive: '#806010', emissiveIntensity: 0.6 });
  const wood = M.texMat('tex_wood.webp', '#6a4a28', '#d0a870');
  const iron = mat('#9aa0a8', { metalness: 0.7, roughness: 0.35 });

  // Long thin legs, knees forward, big two-toed feet.
  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(-0.02, 0.72, 0.13 * s);
    hip.add(mesh(tube([[0, 0, 0], [0.12, -0.3, 0.02 * s], [0.02, -0.68, 0]], 0.08, 0.05, 8, 8), skin));
    hip.add(mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.09, 10), leather, 0.03, -0.58, 0));
    for (const z of [-0.035, 0.035]) hip.add(mesh(blob(0.09, 0.035, 0.04, { seed: 90 + s, detail: 1 }), skin, 0.1, -0.7, z));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);

  // Hunched lean torso, a leather belt and a team loincloth.
  const torso = mesh(blob(0.2, 0.3, 0.24, { seed: 92, amt: 0.05 }), skin, 0.04, 1.08, 0);
  torso.rotation.z = -0.35;
  const hips = mesh(blob(0.17, 0.12, 0.2, { seed: 93, amt: 0.04, detail: 2 }), leather, 0, 0.78, 0);
  const belt = mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 20).rotateX(Math.PI / 2), leather, 0, 0.82, 0);
  belt.scale.z = 1.15;
  const loinF = mesh(cloth(0.18, 0.4, 0.03, -0.04), team, 0.17, 0.62, 0);
  loinF.rotation.y = Math.PI;
  const loinB = mesh(cloth(0.2, 0.42, 0.04, 0.06), team, -0.17, 0.62, 0);
  // A bone necklace and a spiked leather pad on the left shoulder.
  const neck = mesh(new THREE.TorusGeometry(0.15, 0.018, 5, 18).rotateX(Math.PI / 2 - 0.4), leather, 0.12, 1.3, 0);
  const teeth = [];
  for (let i = 0; i < 5; i++) {
    const a = -0.8 + i * 0.4;
    const t = mesh(new THREE.ConeGeometry(0.022, 0.08, 6), tusk, 0.12 + Math.cos(a) * 0.15, 1.24, Math.sin(a) * 0.15);
    t.rotation.z = Math.PI;
    teeth.push(t);
  }
  const pad = mesh(new THREE.SphereGeometry(0.14, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), leather, -0.02, 1.32, 0.24);
  pad.rotation.x = 0.5;
  const spikes = [0, 1].map((i) => {
    const sp = mesh(new THREE.ConeGeometry(0.03, 0.18, 6), tusk, -0.05 + i * 0.08, 1.42, 0.3);
    sp.rotation.x = 0.5;
    return sp;
  });
  // Spears in a sling across the back.
  const quiver = new THREE.Group();
  quiver.position.set(-0.22, 1.05, 0);
  quiver.rotation.x = 0.5;
  for (const z of [-0.04, 0.04]) {
    quiver.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.2, 6), wood, 0, 0, z));
    quiver.add(mesh(new THREE.ConeGeometry(0.04, 0.16, 6), iron, 0, 0.66, z));
  }
  // Long arms: the left hangs, the right raises the spear.
  const arm = (s, pts) => {
    const a = new THREE.Group();
    a.add(mesh(tube(pts, 0.065, 0.05, 8, 8), skin));
    const w = pts[pts.length - 2];
    a.add(mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.08, 10), team, w[0], w[1], w[2]));
    const h = pts[pts.length - 1];
    a.add(mesh(blob(0.06, 0.06, 0.05, { seed: 94 + s, detail: 2 }), skin, h[0], h[1], h[2]));
    return a;
  };
  const armL = arm(1, [[0.0, 1.3, 0.24], [0.08, 1.02, 0.32], [0.18, 0.82, 0.3], [0.24, 0.72, 0.28]]);
  const armR = arm(-1, [[0.0, 1.3, -0.24], [-0.06, 1.48, -0.34], [0.04, 1.66, -0.32], [0.1, 1.72, -0.3]]);
  // Head thrust forward: a long nose, big upturned tusks, swept-back ears,
  // glowing eyes and a red mohawk.
  const head = new THREE.Group();
  head.position.set(0.3, 1.38, 0);
  head.add(mesh(blob(0.12, 0.12, 0.11, { seed: 96, amt: 0.05, detail: 2 }), skin, 0, 0.02, 0));
  head.add(mesh(blob(0.11, 0.07, 0.1, { seed: 97, amt: 0.05, detail: 2 }), skin, 0.08, -0.07, 0));
  const nose = mesh(tube([[0.1, 0.03, 0], [0.18, 0.0, 0], [0.22, -0.05, 0]], 0.035, 0.018, 6, 6), skin);
  head.add(nose);
  for (const s of [1, -1]) {
    head.add(mesh(scaled(LOW_SPHERE, 0.02), eye, 0.11, 0.05, 0.045 * s));
    head.add(mesh(tube([[0.12, -0.09, 0.06 * s], [0.18, -0.06, 0.1 * s], [0.2, 0.04, 0.12 * s]], 0.026, 0.006, 8, 6), tusk));
    head.add(mesh(tube([[-0.02, 0.04, 0.1 * s], [-0.14, 0.08, 0.2 * s], [-0.28, 0.12, 0.26 * s]], 0.045, 0.006, 8, 6), skin));
  }
  for (let i = 0; i < 5; i++) {
    const sp = mesh(new THREE.ConeGeometry(0.04, 0.2 - Math.abs(i - 1.5) * 0.03, 6), hairM, 0.06 - i * 0.07, 0.17 - i * 0.012, 0);
    sp.rotation.z = 0.3 + i * 0.15;
    head.add(sp);
  }

  // The throwing spear, raised overhand: the "staff" the attack animation
  // swings. Team-colour binding behind the head.
  const spear = new THREE.Group();
  spear.position.set(0.1, 1.72, -0.3);
  spear.rotation.z = -1.25;
  spear.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.5, 6), wood));
  spear.add(mesh(new THREE.ConeGeometry(0.05, 0.22, 6), iron, 0, 0.85, 0));
  spear.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 8), team, 0, 0.72, 0));
  for (const s of [1, -1]) {
    const f = mesh(scaled(G.box, 0.008, 0.12, 0.05), hairM, 0, -0.68, 0.025 * s);
    spear.add(f);
  }

  body.add(legL, legR, torso, hips, belt, loinF, loinB, neck, ...teeth, pad, ...spikes, quiver, armL, armR, head, spear);
  g.userData = { body, staff: spear, legL, legR, kind: 'hero' };
  return g;
}

registerSkin('pork_hunter', (color) => headhunter(color));

const pigSkin = () => M.triMat('tex_hide.webp', '#e8a49a', '#ffd0c8', 1.6, { roughness: 0.6 });

// A barnyard pig: a round pink body, a big head with a flat snout, floppy
// ears, short legs with dark trotters and a corkscrew tail. Faces +X.
export function pigModel() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const skin = pigSkin();
  const dark = M.mat('#6a3a34', { roughness: 0.5 });
  const pinkDeep = M.mat('#d8807a', { roughness: 0.55 });
  body.add(M.mesh(M.blob(0.52, 0.36, 0.36, { seed: 91, amt: 0.05 }), skin, 0, 0.5, 0));
  body.add(M.mesh(M.blob(0.3, 0.27, 0.28, { seed: 92, amt: 0.05 }), skin, 0.5, 0.58, 0));
  const snout = M.mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.14, 18).rotateZ(Math.PI / 2), pinkDeep, 0.78, 0.53, 0);
  body.add(snout);
  body.add(M.mesh(new THREE.CircleGeometry(0.115, 18).rotateY(Math.PI / 2), M.mat('#e89890'), 0.852, 0.53, 0));
  for (const s of [1, -1]) {
    body.add(M.mesh(M.scaled(M.G.sphere, 0.022, 0.035, 0.022), dark, 0.856, 0.53, 0.045 * s));
    body.add(M.mesh(M.scaled(M.G.sphere, 0.035), M.mat('#120a08', { roughness: 0.2 }), 0.7, 0.68, 0.14 * s));
    const ear = M.mesh(M.blob(0.12, 0.03, 0.09, { seed: 93 }), skin, 0.5, 0.82, 0.16 * s);
    ear.rotation.set(0.5 * s, 0, -0.7);
    body.add(ear);
  }
  const legs = [];
  for (const [x, z] of [[0.28, 0.2], [0.28, -0.2], [-0.3, 0.2], [-0.3, -0.2]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.38, z);
    hip.add(M.mesh(M.tube([[0, 0, 0], [0.01, -0.18, 0], [0, -0.32, 0]], 0.08, 0.055, 4, 8), skin));
    hip.add(M.mesh(M.scaled(M.G.sphere, 0.06, 0.05, 0.06), dark, 0, -0.34, 0));
    legs.push(hip);
    body.add(hip);
  }
  const tail = [];
  for (let i = 0; i <= 12; i++) {
    const a = i * 0.9;
    tail.push([-0.5 - i * 0.012, 0.6 + Math.sin(a) * 0.05 + i * 0.006, Math.cos(a) * 0.05]);
  }
  body.add(M.mesh(M.tube(tail, 0.025, 0.012, 24, 6), skin));
  body.scale.setScalar(1.25);
  g.userData = { body, legs };
  return g;
}

// A troll hunting spear: a long ash shaft, a leaf-shaped stone head, a
// binding of leather and two feathers. Along +X.
function spearModel() {
  const g = new THREE.Group();
  g.add(M.mesh(M.tube([[-0.8, 0, 0], [0, 0, 0], [0.62, 0, 0]], 0.028, 0.024, 3, 6), M.texMat('tex_wood.webp', '#7a5a38', '#e0c8a8')));
  const head = M.mesh(M.lathe([[0.001, 0], [0.06, 0.06], [0.055, 0.16], [0.001, 0.3]], 8), M.mat('#9aa0a6', { metalness: 0.5, roughness: 0.4 }), 0.6, 0, 0);
  head.rotation.z = -Math.PI / 2;
  head.scale.set(1, 1, 0.45);
  g.add(head);
  g.add(M.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 8).rotateZ(Math.PI / 2), M.leatherMat(), 0.56, 0, 0));
  for (const s of [1, -1]) {
    const f = M.mesh(M.blob(0.12, 0.012, 0.04, { seed: 94 }), M.mat('#e8e0d0', { side: THREE.DoubleSide }), -0.72, 0.02 * s, 0.03 * s);
    f.rotation.x = 0.5 * s;
    g.add(f);
  }
  return g;
}

registerView('pork_pig', {
  bake: true,
  make(e, world, v) {
    const g = pigModel();
    v.parts = g.userData;
    return g;
  },
  update(v, a, b, k, dt) {
    const moving = !!b.mv;
    v.walk = (v.walk || 0) + dt * (moving ? 14 : 0);
    v.parts.body.position.y = moving ? Math.abs(Math.sin(v.walk)) * 0.05 : 0;
    v.parts.legs.forEach((l, i) => (l.rotation.z = moving ? Math.sin(v.walk + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.5 : 0));
  },
});

registerView('pork_spear', {
  bake: true,
  make(e, world, v) {
    const g = new THREE.Group();
    const spear = spearModel();
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.25, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false }));
    shadow.scale.set(2.4, 1, 0.6);
    g.add(spear, shadow);
    // Kept whole by bakeModel: the spear and shadow are repositioned every frame.
    g.userData.spear = spear;
    g.userData.shadow = shadow;
    v.parts = { spear, shadow };
    return g;
  },
  update(v, a, b, k) {
    // Artillery with the Headhunter's low arc: a parabola from the thrower's hand to the clicked point.
    const t = Math.min(1, Math.max(0, a.t + (b.t - a.t) * k));
    const d = Math.hypot(b.x - b.sx, b.y - b.sy);
    const h = (tt) => 1.5 * (1 - tt) + 0.2 * tt + 4 * Math.max(0.6, d * 0.12) * tt * (1 - tt);
    const px = b.sx + (b.x - b.sx) * t;
    const pz = b.sy + (b.y - b.sy) * t;
    const o = v.obj;
    o.position.set(0, 0, 0);
    o.rotation.set(0, 0, 0);
    const s = v.parts.spear;
    s.position.set(px, h(t), pz);
    const yaw = Math.atan2(b.y - b.sy, b.x - b.sx);
    const slope = (h(Math.min(1, t + 0.02)) - h(Math.max(0, t - 0.02))) / (0.04 * Math.max(d, 0.1));
    s.rotation.set(0, -yaw, Math.atan(slope));
    v.parts.shadow.position.set(px, 0.04, pz);
    v.parts.shadow.rotation.y = -yaw;
  },
});

registerView('pork_aim', {
  bake: true,
  make() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff5030', transparent: true, opacity: 0.7, depthWrite: false }));
    ring.position.y = 0.05;
    const cross = new THREE.Group();
    for (const r of [Math.PI / 4, -Math.PI / 4]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.06).rotateX(-Math.PI / 2), ring.material);
      bar.rotation.y = r;
      bar.position.y = 0.05;
      cross.add(bar);
    }
    g.add(ring, cross);
    g.userData.ring = ring;
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.obj.userData.ring.scale.setScalar(1 + Math.sin(world.time * 6) * 0.1);
  },
});

registerEvent('pork_land', (e, world) => {
  world.fx.dustCloud(e.x, e.y, 0.35, '#8a7a58', 4);
  if (e.hit) world.fx.sparks(e.x, 0.5, e.y, 8, 3, '#ffe0c0');
  else play('hit');
});

registerEvent('pork_kill', (e, world) => {
  world.fx.burst(e.x, 0.6, e.y, '#ffb0a8', { n: 26, speed: 4, size: 0.5, life: 0.7 });
  world.fx.dustCloud(e.x, e.y, 0.6, '#8a7a58', 6);
  world.fx.text(e.x, 1.6, e.y, 'Squeee!', '#ffc0c8', true);
  // The pig keels over where it was skewered.
  const pig = pigModel();
  pig.position.set(e.x, 0, e.y);
  pig.rotation.y = -(e.f || 0);
  pig.userData.body.rotation.x = Math.PI / 2;
  pig.userData.body.position.y = 0.3;
  world.scene.add(pig);
  world.fx.transients.push({ obj: pig, t: 0, dur: 2.5, update: (kk) => (pig.position.y = -Math.max(0, kk - 0.6) * 1.2) });
  play('squish');
});

registerEvent('pork_blink', (e, world) => {
  world.fx.glow(e.x, 1, e.y, '#c8a0ff', 3, 0.5);
  world.fx.burst(e.x, 0.8, e.y, '#b890ff', { n: 26, speed: 3, size: 0.5, life: 0.6 });
  world.fx.ring(e.x, e.y, 1.4, '#c8a0ff', 0.5);
  play('teleport');
});

// A split-rail fence round the pen.
registerMapBuilder('pork_pen', (map, world) => {
  const hw = map.floor.w / 2 + 0.5;
  // Static scenery (the whole fence), merged per material at the end.
  const G = new THREE.Group();
  const wood = M.texMat('tex_wood.webp', '#6a4a2c', '#d8c0a0');
  const post = M.lathe([[0.1, 0], [0.1, 1.05], [0.07, 1.15], [0.001, 1.18]], 8);
  const add = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(1, Math.round(len / 2.2));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = M.mesh(post, wood, x1 + (x2 - x1) * t + (Math.random() - 0.5) * 0.1, 0, z1 + (z2 - z1) * t + (Math.random() - 0.5) * 0.1);
      p.rotation.z = (Math.random() - 0.5) * 0.08;
      G.add(p);
      if (i === n) break;
      const tt = (i + 1) / n;
      for (const y of [0.45, 0.85]) {
        const sag = 0.04 + Math.random() * 0.04;
        const a = [x1 + (x2 - x1) * t, y, z1 + (z2 - z1) * t];
        const bb = [x1 + (x2 - x1) * tt, y + (Math.random() - 0.5) * 0.06, z1 + (z2 - z1) * tt];
        G.add(M.mesh(M.tube([a, [(a[0] + bb[0]) / 2, y - sag, (a[2] + bb[2]) / 2], bb], 0.045, 0.045, 4, 6), wood));
      }
    }
  };
  add(-hw, -hw, hw, -hw);
  add(-hw, -hw, -hw, hw);
  add(hw, -hw, hw, hw);
  add(-hw, hw, hw, hw);
  bakeStatic(G);
  world.mapGroup.add(G);
});
