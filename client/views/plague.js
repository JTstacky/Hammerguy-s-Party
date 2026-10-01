// Uther Party #37 The Plague: a blighted graveyard at night. Acolytes (hero
// skin) and the zombies they rise as, patient zero, the blight on the ground
// and the eight obelisks.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerTheme, registerMapBuilder } from '../../engine/client/render/registry.js';
import { fxTexture } from '../../engine/client/render/effects.js';
import { play } from '../../engine/client/audio.js';
import { bakeView, bakeScenery, clothMat, fleshMat, stoneMat, groundGlow, emit, glow } from './d-kit.js';

const P12 = '#8a5a2a'; // Player 12's brown

registerTheme('plague',
  { sky: '#0c0a18', fog: '#120e20', floor: ['#34402e', 30, { blades: true }], sun: '#b0a8ff', hemi: ['#5a5898', '#101010'], sunI: 1.3 },
  {
    floor: { tex: 'tex_grass.webp', tint: '#8ea490', color: '#34402e', units: 8 },
    edge: { tex: 'tex_nightgrass.webp', tint: '#8a90a0', color: '#243024', units: 6 },
    outer: { tex: 'tex_nightgrass.webp', tint: '#7a7890', color: '#1c2420', units: 11 },
    edgeWidth: 1.2,
  });

// The blight, read off the arena at half-tile (64 u) resolution: P = blight, # = blocked.
const BLIGHT = [
  '###...............##',
  '##.PP....PP....PP.##',
  '...PP.##.PP.##.PP..#',
  '.PPPP.##.PP.##.PPPP#',
  '.PPPP....PP....PPPP.',
  '.....PP..PPPPPP.....',
  '..##.PP..PPPPPP.##..',
  '..##.PPPPPPPP...##..',
  '.....PPPPPPPP.......',
  '.PPPPPPPPPPPPPPPPPP.',
  '.PPPPPPPPPPPPPPPPPP.',
  '.......PPPPPPPP.....',
  '..##...PPPPPPPP.##..',
  '..##.PPPPPP..PP.##..',
  '.....PPPPPP..PP.....',
  '.PPPP....PP....PPPP.',
  '.PPPP.##.PP.##.PPPP.',
  '##.PP.##.PP.##.PP...',
  '##.PP....PP....PP.##',
  '##................##',
];

function blightMask() {
  const S = 320;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  const cell = S / 20;
  g.fillStyle = '#fff';
  // Round blobs per cell, blurred, give the creeping edge of WC3 blight.
  g.filter = 'blur(5px)';
  BLIGHT.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch !== 'P') return;
    g.beginPath();
    g.arc((i + 0.5) * cell, (j + 0.5) * cell, cell * (0.78 + Math.random() * 0.12), 0, Math.PI * 2);
    g.fill();
  }));
  g.filter = 'none';
  const t = new THREE.CanvasTexture(c);
  return t;
}

// An undead obelisk: a tapering black stone needle with glowing green runes and a skull.
function obelisk() {
  const g = new THREE.Group();
  const stone = stoneMat('#6a6878');
  g.add(M.mesh(M.lathe([[1.05, 0], [1.05, 0.25], [0.85, 0.35], [0.8, 0.5], [0.01, 0.52]], 4), stone));
  const needle = M.mesh(M.lathe([[0.55, 0.4], [0.5, 1.2], [0.36, 3.0], [0.2, 3.8], [0.01, 4.3]], 4), stone);
  needle.rotation.y = Math.PI / 4;
  g.add(needle);
  const rune = glow('#7dff6a');
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const r = M.mesh(M.scaled(M.G.box, 0.05, 0.9, 0.12), rune, Math.cos(a) * 0.42, 1.9, Math.sin(a) * 0.42);
    r.rotation.y = -a;
    g.add(r);
  }
  const skull = M.mesh(M.blob(0.2, 0.2, 0.18, { seed: 5 }), M.boneMat(), 0.52, 1.0, 0);
  g.add(skull);
  for (const s of [1, -1]) g.add(M.mesh(M.scaled(M.G.sphere, 0.04), glow('#7dff6a'), 0.7, 1.02, 0.07 * s));
  g.add(groundGlow(1.8, '#40ff50', 0.2));
  return g;
}

registerMapBuilder('plague', (map, world) => {
  const scen = new THREE.Group(); // static scenery, merged per material
  const H = map.half;
  // Blight: a purple-black dirt layer masked to the arena's pattern.
  const mat = new THREE.MeshStandardMaterial({ color: '#5a4a6a', transparent: true, depthWrite: false, roughness: 0.95 });
  fxTexture('tex_hide.webp', (t) => {
    const tt = t.clone();
    tt.repeat.set(5, 5);
    tt.needsUpdate = true;
    mat.map = tt;
    mat.color.set('#c0a0e8');
    mat.needsUpdate = true;
  }, { repeat: true });
  mat.alphaMap = blightMask();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, H * 2).rotateX(-Math.PI / 2), mat);
  plane.position.y = 0.03;
  plane.receiveShadow = true;
  plane.renderOrder = 1;
  world.mapGroup.add(plane);
  for (const [x, y] of map.pillars) {
    const o = obelisk();
    o.position.set(x, 0, y);
    o.rotation.y = Math.random() * 6;
    world.mapGroup.add(o);
  }
  // Cut corners: gravestones and rubble.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const r = M.rock(0.5 + Math.random() * 0.4);
      r.position.set(sx * (H - 0.8 - Math.random() * 1.2), 0, sy * (H - 0.8 - Math.random() * 1.2));
      scen.add(r);
    }
  }
  // An iron graveyard fence round the edge, and dead trees beyond it.
  const iron = M.mat('#2a2a30', { metalness: 0.6, roughness: 0.5 });
  const fence = new THREE.Group();
  const E = H + 0.4;
  for (let a = -E; a <= E; a += 0.55) {
    for (const [x, z] of [[a, -E], [a, E], [-E, a], [E, a]]) {
      if (Math.abs(x) + Math.abs(z) > map.cut + 0.9) continue;
      fence.add(M.mesh(M.scaled(M.G.cyl, 0.035, 1.1, 0.035), iron, x, 0.55, z));
      fence.add(M.mesh(M.scaled(M.G.cone, 0.07, 0.18, 0.07), iron, x, 1.18, z));
    }
  }
  scen.add(fence);
  const bark = M.texMat('tex_bark.webp', '#3a3036', '#9a8a98', 1);
  for (let i = 0; i < 26; i++) {
    const side = i % 4;
    const a = (Math.random() - 0.5) * 2 * (H + 4);
    const o = H + 2 + Math.random() * 4;
    const [x, z] = [[a, -o], [a, o], [-o, a], [o, a]][side];
    const t = new THREE.Group();
    t.add(M.mesh(M.tube([[0, 0, 0], [0.1, 1.2, 0.05], [-0.1, 2.4, 0], [0.05, 3.2, 0.1]], 0.22, 0.06, 10, 8), bark));
    for (let b = 0; b < 4; b++) {
      const ang = Math.random() * 6.28;
      const y = 1.4 + b * 0.45;
      t.add(M.mesh(M.tube([[0, y, 0], [Math.cos(ang) * 0.6, y + 0.35, Math.sin(ang) * 0.6], [Math.cos(ang) * 1.1, y + 0.4, Math.sin(ang) * 1.1]], 0.07, 0.015, 6, 6), bark));
    }
    t.position.set(x, 0, z);
    t.scale.setScalar(0.9 + Math.random() * 0.5);
    scen.add(t);
  }
  world.mapGroup.add(bakeScenery(scen));
  const glow = new THREE.PointLight('#8aff70', 6, 26, 1.6);
  glow.position.set(0, 6, 0);
  world.mapGroup.add(glow);
});

// ------------------------------------------------------------ acolyte

function acolyte(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const robe = M.texMat('tex_leather.webp', '#1c1a22', '#4a4458', 1, { roughness: 0.8 });
  const hood = M.texMat('tex_leather.webp', '#1c1a22', '#3a3448', 1, { roughness: 0.8, side: THREE.DoubleSide });
  // (Robe, hood and skin are cached materials; team colour comes from clothMat.)
  const skin = M.mat('#b8b0a0', { roughness: 0.6 });
  const team = clothMat(color);
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  for (const [leg, s] of [[legL, 1], [legR, -1]]) {
    leg.position.set(0, 0.45, 0.1 * s);
    leg.add(M.mesh(M.tube([[0, 0, 0], [0.02, -0.25, 0], [0.04, -0.42, 0]], 0.07, 0.06, 4, 8), robe));
    leg.add(M.mesh(M.blob(0.1, 0.05, 0.07, { seed: 3 }), M.mat('#2a2024'), 0.06, -0.44, 0));
    body.add(leg);
  }
  // Long robe, hood with a shadowed face and two eyes.
  body.add(M.mesh(M.lathe([[0.36, 0.08], [0.3, 0.3], [0.24, 0.7], [0.23, 1.0], [0.26, 1.15], [0.14, 1.3]], 20), robe));
  const trim = M.mesh(new THREE.TorusGeometry(0.35, 0.03, 6, 24).rotateX(Math.PI / 2), team, 0, 0.1, 0);
  const sash = M.mesh(M.cloth(0.16, 0.8, 0.03), team, 0.24, 0.72, 0);
  sash.rotation.y = Math.PI;
  const belt = M.mesh(new THREE.TorusGeometry(0.24, 0.03, 6, 20).rotateX(Math.PI / 2), clothMat(color, 0.6), 0, 0.82, 0);
  body.add(trim, sash, belt);
  const head = new THREE.Group();
  head.position.set(0.02, 1.4, 0);
  head.add(M.mesh(M.lathe([[0.18, -0.12], [0.2, 0.02], [0.18, 0.16], [0.1, 0.27], [0.01, 0.3]], 18), hood));
  head.add(M.mesh(M.scaled(M.G.sphere, 0.13, 0.14, 0.13), M.mat('#050408'), 0.07, 0, 0));
  for (const s of [1, -1]) head.add(M.mesh(M.scaled(M.G.sphere, 0.03), glow('#ff5a40'), 0.19, 0.02, 0.05 * s));
  head.add(M.mesh(M.tube([[-0.12, 0.2, 0], [-0.3, 0.1, 0], [-0.36, -0.1, 0]], 0.08, 0.03, 6, 8), hood));
  body.add(head);
  // Arms, and a curved ritual dagger.
  const staff = new THREE.Group();
  staff.position.set(0.12, 0.85, -0.28);
  staff.add(M.mesh(M.tube([[0, 0, 0], [0.02, -0.08, 0], [0.04, -0.14, 0]], 0.02, 0.02, 2, 5), M.mat('#3a2420')));
  staff.add(M.mesh(M.tube([[0.04, -0.14, 0], [0.12, -0.3, 0], [0.24, -0.36, 0]], 0.025, 0.004, 8, 5), M.silverMat()));
  body.add(M.mesh(M.tube([[0, 1.15, -0.24], [0.1, 1.0, -0.3], [0.14, 0.86, -0.28]], 0.06, 0.05, 6, 8), robe));
  body.add(M.mesh(M.scaled(M.G.sphere, 0.05), skin, 0.14, 0.85, -0.28));
  body.add(M.mesh(M.tube([[0, 1.15, 0.24], [0.08, 0.98, 0.3], [0.1, 0.84, 0.26]], 0.06, 0.05, 6, 8), robe));
  body.add(M.mesh(M.scaled(M.G.sphere, 0.05), skin, 0.1, 0.83, 0.26));
  body.add(staff);
  body.scale.setScalar(1.3);
  g.userData = { body, staff, legL, legR, kind: 'hero' };
  return g;
}

// ------------------------------------------------------------ zombie

function zombie(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const flesh = fleshMat('#d8ffb8');
  const rot = fleshMat('#b0c890');
  const rags = clothMat(color, 0.75);
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  for (const [leg, s] of [[legL, 1], [legR, -1]]) {
    leg.position.set(-0.05, 0.62, 0.14 * s);
    leg.add(M.mesh(M.tube([[0, 0, 0], [0.06, -0.3, 0.02 * s], [0.02, -0.58, 0]], 0.09, 0.06, 6, 8), flesh));
    leg.add(M.mesh(M.blob(0.12, 0.05, 0.08, { seed: 20 }), rot, 0.06, -0.6, 0));
    body.add(leg);
  }
  // Hunched forward, arms reaching.
  const torso = new THREE.Group();
  torso.position.set(0, 0.62, 0);
  torso.rotation.z = -0.35;
  torso.add(M.mesh(M.blob(0.24, 0.36, 0.28, { seed: 21, amt: 0.1 }), flesh, 0, 0.42, 0));
  // Torn shirt in team colour, ribs showing through.
  const shirt = M.mesh(new THREE.LatheGeometry([[0.27, 0.12], [0.3, 0.3], [0.3, 0.5], [0.25, 0.68]].map(([r, y]) => new THREE.Vector2(r, y)), 16, 0, Math.PI * 1.4), rags);
  shirt.rotation.y = 0.6;
  torso.add(shirt);
  for (let i = 0; i < 3; i++) torso.add(M.mesh(M.tube([[0.2, 0.3 + i * 0.1, -0.15], [0.29, 0.32 + i * 0.1, 0], [0.2, 0.3 + i * 0.1, 0.15]], 0.02, 0.02, 6, 5), M.boneMat()));
  const head = new THREE.Group();
  head.position.set(0.18, 0.88, 0);
  head.add(M.mesh(M.blob(0.16, 0.16, 0.15, { seed: 22 }), flesh));
  const jaw = M.mesh(M.blob(0.1, 0.05, 0.1, { seed: 23 }), rot, 0.1, -0.13, 0);
  jaw.rotation.z = -0.3;
  head.add(jaw);
  for (const s of [1, -1]) head.add(M.mesh(M.scaled(M.G.sphere, 0.03), glow('#e8ff60'), 0.14, 0.03, 0.06 * s));
  head.add(M.mesh(M.blob(0.12, 0.05, 0.12, { seed: 24, amt: 0.3, freq: 6 }), M.mat('#2a2418'), -0.02, 0.13, 0));
  torso.add(head);
  const arm = (s) => {
    const a = new THREE.Group();
    a.position.set(0.05, 0.66, 0.3 * s);
    a.add(M.mesh(M.tube([[0, 0, 0], [0.3, 0.02, 0.05 * s], [0.58, 0.08, 0.02 * s]], 0.07, 0.05, 6, 8), flesh));
    for (let f = -1; f <= 1; f++) a.add(M.mesh(M.tube([[0.58, 0.08, 0.02 * s + f * 0.03], [0.7, 0.04, 0.02 * s + f * 0.04]], 0.018, 0.008, 3, 5), rot));
    torso.add(a);
    return a;
  };
  arm(1);
  const staff = arm(-1);
  body.add(torso);
  body.scale.setScalar(1.35);
  g.userData = { body, staff, legL, legR, kind: 'hero' };
  return g;
}

registerSkin('acolyte', acolyte);
registerSkin('zombie', zombie);

// Patient zero (Player 12) and its zombie.
function npcView(make) {
  return {
    make(e, world, v) {
      const o = bakeView(make(P12));
      v.parts = o.userData;
      return o;
    },
    update(v, a, b, k, dt, world) {
      const P = v.parts;
      const moving = !!b.mv && !b.dead;
      v.walk = (v.walk || 0) + dt * (moving ? 11 : 0);
      P.body.position.y = moving ? Math.abs(Math.sin(v.walk)) * 0.06 : 0;
      P.legL.rotation.z = moving ? Math.sin(v.walk) * 0.5 : 0;
      P.legR.rotation.z = moving ? -Math.sin(v.walk) * 0.5 : 0;
      v.raise = Math.max(0, Math.min(1, (v.raise || 0) + dt * (b.sw ? 6 : -5)));
      P.staff.rotation.x = -v.raise * 0.9;
      if (b.dead) {
        v.deadT = (v.deadT || 0) + dt;
        P.body.rotation.z = Math.min(Math.PI / 2, v.deadT * 4);
      } else {
        v.deadT = 0;
        P.body.rotation.z = 0;
      }
    },
  };
}
registerView('placolyte', npcView(acolyte));
registerView('plzombie', npcView(zombie));

// A corpse rising: green mist and the Animate Dead flash.
registerEvent('plrise', (e, world) => {
  world.fx.burst(e.x, 0.4, e.y, '#6aff50', { n: 30, speed: 2.5, size: 0.6, life: 0.9, up: 1.6 });
  for (let i = 0; i < 5; i++) world.fx.smokePuff(e.x, 0.3, e.y, '#3a5a30', 1.2, 1.6, 0.45);
  world.fx.glow(e.x, 1, e.y, '#8aff60', 3, 0.5);
  world.fx.ring(e.x, e.y, 1.4, '#6aff50', 0.5);
  play('drain');
});
