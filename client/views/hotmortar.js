// Hot Mortar (#4): the Mortar Team skin, the Cannon Tower on its raised
// block, the flying mortar, the burning marker over the holder and the pens.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';
import { cliffField, cliffMaterial, emit } from './lib-f-cliffs.js';
import { dwarf, ironMat, brassMat } from './lib-f-units.js';

const PLATEAU = 1.6; // height of the central block's top

// ------------------------------------------------------------ mortar team

// The WC3 Mortar Team: two dwarves with a squat iron mortar on a wooden
// sledge. The gunner (left) walks the team; the loader hugs a shell.
function mortarTeam(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const wood = M.texMat('tex_wood.webp', '#7a5230', '#ffffff');
  // Sledge with two iron wheels.
  body.add(M.mesh(M.scaled(M.G.box, 0.8, 0.1, 0.5), wood, 0.25, 0.2, 0));
  for (const z of [0.2, -0.2]) body.add(M.mesh(M.scaled(M.G.box, 0.9, 0.08, 0.07), wood, 0.25, 0.12, z));
  for (const z of [0.3, -0.3]) {
    const w = M.mesh(new THREE.TorusGeometry(0.15, 0.04, 5, 14), ironMat(), 0.2, 0.17, z);
    body.add(w);
    body.add(M.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8).rotateX(Math.PI / 2), brassMat(), 0.2, 0.17, z));
  }
  // The mortar: a fat bell of iron on trunnions, tilting up to fire.
  const barrel = new THREE.Group();
  barrel.position.set(0.3, 0.42, 0);
  barrel.add(M.mesh(M.lathe([[0.2, -0.18], [0.24, -0.1], [0.2, 0.1], [0.19, 0.3], [0.23, 0.36], [0.17, 0.38], [0.14, 0.0]], 14), M.mat('#3c3c44', { metalness: 0.75, roughness: 0.35 })));
  barrel.add(M.mesh(new THREE.TorusGeometry(0.205, 0.025, 5, 14).rotateX(Math.PI / 2), brassMat(), 0, 0.08, 0));
  barrel.add(M.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.56, 8).rotateX(Math.PI / 2), brassMat()));
  barrel.rotation.z = -0.85; // leaning toward +X
  body.add(barrel);
  body.add(M.mesh(M.scaled(M.G.box, 0.12, 0.25, 0.5), wood, 0.3, 0.33, 0));
  // Crew.
  const gunner = dwarf(color, { beard: '#b8682c' });
  gunner.g.position.set(-0.35, 0, 0.36);
  body.add(gunner.g);
  const loader = dwarf(color, { beard: '#e8e0d0' });
  loader.g.position.set(-0.3, 0, -0.38);
  loader.g.rotation.y = 0.3;
  body.add(loader.g);
  // The loader's shell, held in front.
  const shell = M.mesh(M.scaled(M.G.sphere, 0.13), M.mat('#26262a', { metalness: 0.5, roughness: 0.4 }), 0.24, -0.22, -0.2);
  loader.armR.add(shell);
  body.scale.setScalar(1.25);
  const legs2 = [loader.legL, loader.legR];
  g.userData = {
    body,
    legL: gunner.legL,
    legR: gunner.legR,
    staff: gunner.armR,
    anim: [barrel, loader.legL, loader.legR, loader.armR, loader.armL, gunner.armL],
    kind: 'hero',
    tick(dt, v, b, world) {
      // Aim: the barrel rises during the 1 s wind-up and kicks on the shot.
      const casting = b.fx?.includes('casting');
      v.aim = Math.max(0, Math.min(1, (v.aim || 0) + dt * (casting ? 1.6 : -2)));
      if (v.wasCasting && !casting) v.kick = 0.25;
      v.wasCasting = casting;
      v.kick = Math.max(0, (v.kick || 0) - dt);
      barrel.rotation.z = -0.85 + v.aim * 0.35 - Math.sin((v.kick / 0.25) * Math.PI) * 0.25;
      legs2[0].rotation.z = -gunner.legL.rotation.z;
      legs2[1].rotation.z = -gunner.legR.rotation.z;
      loader.armR.rotation.z = 0.6 + v.aim * 0.4;
      loader.armL.rotation.z = 0.5;
      gunner.armL.rotation.z = casting ? 0.9 : Math.sin(world.time * 2) * 0.05;
    },
  };
  return g;
}
registerSkin('mortarteam', mortarTeam);

// ------------------------------------------------------------ cannon tower

function cannonTower() {
  const g = new THREE.Group();
  const stone = M.texMat('tex_stone.webp', '#9a968c', '#e8e4dc', 1);
  const wood = M.texMat('tex_wood.webp', '#7a5230', '#ffffff');
  const roof = M.mat('#2c4a8a', { roughness: 0.6 });
  g.add(M.mesh(M.lathe([[1.0, 0], [0.95, 0.4], [0.82, 1.6], [0.9, 1.7], [0.9, 1.9], [0.001, 1.9]], 18), stone));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(M.mesh(M.scaled(M.G.box, 0.26, 0.24, 0.2), stone, Math.cos(a) * 0.82, 2.0, Math.sin(a) * 0.82));
  }
  // A door and blue banners (Alliance colours).
  g.add(M.mesh(M.scaled(M.G.box, 0.08, 0.6, 0.4), wood, 0.97, 0.3, 0));
  for (const a of [Math.PI / 2, -Math.PI / 2]) {
    const b = M.mesh(M.cloth(0.4, 0.7, 0.02), M.mat('#2c4a8a', { side: THREE.DoubleSide }), Math.cos(a) * 0.9, 1.35, Math.sin(a) * 0.9);
    b.rotation.y = -a;
    g.add(b);
  }
  const top = new THREE.Group();
  top.position.y = 1.9;
  top.add(M.mesh(M.lathe([[0.45, 0], [0.4, 0.25], [0.001, 0.3]], 14), roof, -0.15, 0, 0));
  const cannon = M.mesh(M.lathe([[0.16, 0], [0.14, 0.2], [0.11, 0.9], [0.14, 0.95], [0.001, 0.95]], 12), M.mat('#3c3c44', { metalness: 0.75, roughness: 0.35 }));
  cannon.rotation.z = -Math.PI / 2 + 0.5;
  cannon.position.set(0.05, 0.3, 0);
  top.add(cannon);
  g.add(top);
  return { g, top };
}

registerView('hmtower', {
  make(e, world, v) {
    const t = cannonTower();
    v.parts = t;
    return t.g;
  },
  update(v, a, b, k, dt) {
    v.obj.rotation.y = 0;
    v.obj.position.y = PLATEAU - 0.05;
    const want = -(b.f || 0);
    v.parts.top.rotation.y += (want - v.parts.top.rotation.y) * Math.min(1, dt * 4);
  },
});

// ------------------------------------------------------------ the mortar

registerView('hmshell', {
  make(e, world, v) {
    const g = new THREE.Group();
    g.add(M.mesh(M.scaled(M.G.sphere, 0.26), M.mat('#26262a', { metalness: 0.5, roughness: 0.4 })));
    g.add(M.mesh(M.scaled(M.G.sphere, 0.12), M.glowMat('#ffb030'), 0.18, 0.12, 0));
    return g;
  },
  update(v, a, b, k, dt, world) {
    const t = a.t + ((b.t ?? a.t) - a.t) * k;
    const sx = b.sx;
    const sz = b.sy;
    const x = sx + (v.x - sx) * t;
    const z = sz + (v.z - sz) * t;
    const span = Math.hypot(v.x - sx, v.z - sz);
    const fromTower = Math.hypot(sx, sz) < 0.5;
    const y0 = fromTower ? PLATEAU + 2.3 : 1.0;
    const y = y0 + (1.0 - y0) * t + 4 * (2 + span * 0.18) * t * (1 - t);
    v.obj.position.set(x, y, z);
    v.obj.rotation.y = world.time * 6;
    for (let n = emit(v, 'trail', 40, dt); n > 0; n--) world.fx.trail(x, y, z, Math.random() < 0.5 ? '#ff8a20' : '#ffd060', 0.5, 0.35, 0.1);
    if (emit(v, 'smoke', 10, dt)) world.fx.smokePuff(x, y, z, '#4a4440', 0.6, 0.8, 0.4);
  },
});

// WC3's burning "Mortar" marker over the team that holds it.
registerView('hmmarker', {
  make(e, world, v) {
    const g = new THREE.Group();
    const bomb = new THREE.Group();
    bomb.add(M.mesh(M.scaled(M.G.sphere, 0.3), M.mat('#26262a', { metalness: 0.5, roughness: 0.4 })));
    bomb.add(M.mesh(M.tube([[0, 0.25, 0], [0.05, 0.4, 0.02], [0.12, 0.48, 0]], 0.03, 0.02, 4, 5), M.mat('#d8c8a0')));
    bomb.position.y = 3.0;
    g.add(bomb);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.35, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff7020', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    ring.position.y = 0.07;
    g.add(ring);
    v.parts = { bomb, ring };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const p = v.parts;
    v.obj.rotation.y = 0;
    p.bomb.position.y = 3.0 + Math.sin(world.time * 5) * 0.12;
    p.bomb.rotation.y = world.time * 2;
    const aim = b.c ?? 0;
    p.ring.scale.setScalar(1 + Math.sin(world.time * 8) * 0.04 - aim * 0.25);
    p.ring.material.opacity = 0.5 + aim * 0.4;
    for (let n = emit(v, 'fuse', 26, dt); n > 0; n--) world.fx.flame(v.x + 0.12, 3.5, v.z, 0.45, 0.4, 0.05);
    if (emit(v, 'spark', 8, dt)) world.fx.sparks(v.x + 0.12, 3.5, v.z, 2, 2, '#ffd070');
  },
});

registerEvent('hmfire', (e, world) => {
  world.fx.smokePuff(e.x, PLATEAU + 2.4, e.y, '#d8d0c8', 1.6, 1.2, 0.6);
  world.fx.glow(e.x, PLATEAU + 2.4, e.y, '#ffb040', 2, 0.2);
});

registerEvent('hmcatch', (e, world) => {
  world.fx.sparks(e.x, 1.2, e.y, 14, 4, '#ffb040');
  world.fx.ring(e.x, e.y, 1.3, '#ff8020', 0.4);
});

// "SetUnitExploded": the team is blown to bits.
registerEvent('hmboom', (e, world) => {
  world.fx.explosion(e.x, e.y, 2.2);
  world.fx.debrisBurst(e.x, e.y, 14, 7);
  world.fx.flash(e.x, e.y, 3, '#ffa040', 0.4);
  for (let i = 0; i < 6; i++) world.fx.smoke(e.x, 0.6, e.y, '#3a3230', 2, 1.6);
  world.shake = Math.max(world.shake || 0, 0.45);
});

// ------------------------------------------------------------ arena

function penBorder(world, x, z, s, stone) {
  const h = s / 2;
  const kerb = (w, d, px, pz) => {
    const m = M.mesh(M.scaled(M.G.box, w, 0.14, d), stone, px, 0.05, pz);
    m.castShadow = false;
    world.mapGroup.add(m);
  };
  kerb(s + 0.24, 0.24, x, z - h);
  kerb(s + 0.24, 0.24, x, z + h);
  kerb(0.24, s, x - h, z);
  kerb(0.24, s, x + h, z);
  for (const [dx, dz] of [[-h, -h], [h, -h], [-h, h], [h, h]]) {
    world.mapGroup.add(M.mesh(M.lathe([[0.16, 0], [0.13, 0.4], [0.16, 0.45], [0.001, 0.5]], 8), stone, x + dx, 0, z + dz));
  }
}

registerMapBuilder('hotmortar', (map, world) => {
  // The raised block: a 2x2-tile plateau whose cliffs fall away over a tile.
  const T = map.pen / 2;
  const cells = ['......', '......', '..##..', '..##..', '......', '......'];
  const mat = cliffMaterial({ top: 'tex_grass.webp', topTint: '#c8d8b0', rockTint: '#e0d8c8' });
  world.mapGroup.add(cliffField({ cells, T, H: PLATEAU, ramp: T * 0.6, margin: 0, res: 0.25, material: mat, outside: true, lumps: 0.15 }));
  const stone = M.texMat('tex_stone.webp', '#9a968c', '#d8d4cc', 1);
  for (const [x, y] of map.pens || []) penBorder(world, x, y, map.pen, stone);
  // A few barrels and crates of powder by the tower.
  const wood = M.texMat('tex_wood.webp', '#7a5230', '#ffffff');
  for (const [x, z] of [[4.6, 3.9], [-4.4, -4.2], [4.2, -4.5]]) {
    const b = M.mesh(M.lathe([[0.25, 0], [0.3, 0.3], [0.25, 0.6], [0.001, 0.6]], 10), wood, x, 0, z);
    world.mapGroup.add(b);
    world.mapGroup.add(M.mesh(M.scaled(M.G.box, 0.45, 0.45, 0.45), wood, x + 0.55, 0.22, z + 0.2));
  }
});
