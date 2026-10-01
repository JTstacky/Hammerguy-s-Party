// Bomb Baldwin (#11): the Flying Machine skin, the peasant crowd (drawn as
// instanced meshes), the "Baldwin" / "Not Baldwin" name shown when you point
// at a peasant (or hold a finger on one), the bombs and the farm.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';
import { blobShadow, emit } from './lib-f-cliffs.js';
import { dwarf, ironMat, brassMat, skinMat, mergeByMaterial } from './lib-f-units.js';

const FLY = 2.4; // flying height drawn (WC3's 280 would leave the camera)

// ------------------------------------------------------------ flying machine

// The WC3 Flying Machine (gyrocopter): a dwarf in an open brass-and-wood
// frame under a big two-bladed rotor, a tail boom with a small prop, landing
// skids and a pair of bomb racks.
function flyingMachine(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const wood = M.texMat('tex_wood.webp', '#7a5230', '#ffffff');
  const team = M.mat(color, { roughness: 0.5, metalness: 0.2 });
  const brass = brassMat();
  const iron = ironMat();
  // Hull: a rounded tub painted in the owner's colour.
  body.add(M.mesh(M.lathe([[0.001, -0.25], [0.32, -0.2], [0.4, 0.05], [0.36, 0.18], [0.001, 0.18]], 14).rotateZ(Math.PI / 2).scale(1.5, 1, 1), team, 0.05, 0, 0));
  body.add(M.mesh(new THREE.TorusGeometry(0.36, 0.035, 5, 16).rotateY(Math.PI / 2), brass, 0.05, 0.12, 0));
  // Engine block behind the pilot.
  body.add(M.mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.35, 12), iron, -0.3, 0.25, 0));
  body.add(M.mesh(M.tube([[-0.38, 0.4, 0.1], [-0.42, 0.65, 0.12], [-0.4, 0.8, 0.1]], 0.05, 0.06, 4, 6), iron));
  // Pilot.
  const pilot = dwarf(color, { beard: '#c87a34' });
  pilot.g.position.set(0.05, -0.15, 0);
  pilot.g.scale.setScalar(0.8);
  body.add(pilot.g);
  // Goggles.
  for (const s of [1, -1]) body.add(M.mesh(M.scaled(M.G.sphere, 0.04), M.glowMat('#ffe8a0'), 0.21, 0.55, 0.05 * s));
  // Mast and main rotor.
  body.add(M.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 6), brass, -0.15, 0.65, 0));
  const rotor = new THREE.Group();
  rotor.position.set(-0.15, 1.03, 0);
  rotor.add(M.mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 10), brass));
  for (const s of [1, -1]) {
    const blade = M.mesh(M.scaled(M.G.box, 1.25, 0.02, 0.14), wood, 0.66 * s, 0.03, 0);
    blade.rotation.x = 0.15 * s;
    rotor.add(blade);
  }
  body.add(rotor);
  // Tail boom and tail prop.
  body.add(M.mesh(M.tube([[-0.3, 0.1, 0], [-0.75, 0.18, 0], [-1.1, 0.3, 0]], 0.05, 0.035, 4, 6), wood));
  body.add(M.mesh(M.scaled(M.G.box, 0.22, 0.24, 0.03), team, -1.08, 0.38, 0));
  const tail = new THREE.Group();
  tail.position.set(-1.1, 0.32, 0.05);
  for (const s of [1, -1]) tail.add(M.mesh(M.scaled(M.G.box, 0.03, 0.3, 0.06), wood, 0, 0.15 * s, 0));
  body.add(tail);
  // Skids and bomb racks.
  for (const s of [1, -1]) {
    body.add(M.mesh(M.tube([[0.5, -0.32, 0.28 * s], [0.1, -0.4, 0.3 * s], [-0.45, -0.38, 0.28 * s]], 0.025, 0.025, 4, 5), iron));
    body.add(M.mesh(M.tube([[0.1, -0.15, 0.2 * s], [0.1, -0.4, 0.29 * s]], 0.02, 0.02, 2, 4), iron));
    body.add(M.mesh(M.lathe([[0.001, -0.18], [0.08, -0.1], [0.09, 0.08], [0.05, 0.18], [0.001, 0.2]], 8).rotateZ(Math.PI / 2), M.mat('#2a2a30', { metalness: 0.5, roughness: 0.4 }), 0.0, -0.18, 0.36 * s));
  }
  body.scale.setScalar(1.55);
  const shadow = blobShadow(0.9);
  g.add(shadow);
  g.userData = {
    body,
    anim: [rotor, tail, shadow],
    kind: 'hero',
    tick(dt, v, b, world) {
      rotor.rotation.y += dt * 28;
      tail.rotation.z += dt * 30;
      if (b.dead) return;
      // Hover with a bob; pitch forward while flying, rock back on a drop.
      body.position.y = FLY + Math.sin(world.time * 3 + v.id) * 0.1;
      const want = b.mv ? -0.18 : 0;
      body.rotation.z += (want - body.rotation.z) * Math.min(1, dt * 5);
      if (b.fx?.includes('casting')) body.rotation.z = 0.12;
      if (emit(v, 'exh', 5, dt)) world.fx.smokePuff(v.x - Math.cos(v.f || 0) * 0.6, FLY + 1.2, v.z - Math.sin(v.f || 0) * 0.6, '#5a5450', 0.4, 0.8, 0.3);
    },
  };
  return g;
}
registerSkin('flyingmachine', flyingMachine);

// ------------------------------------------------------------ peasants

// The WC3 Peasant (team colour on the shirt): one geometry per material,
// drawn for the whole crowd as instanced meshes.
const LOW = new THREE.SphereGeometry(1, 10, 8);
let peasantParts = null;
function peasantTemplate() {
  if (peasantParts) return peasantParts;
  const g = new THREE.Group();
  const add = (geo, m, x, y, z) => g.add(M.mesh(geo, m, x, y, z));
  const cloth = M.mat('#c8a878', { roughness: 0.85 });
  const trousers = M.mat('#6a4a2c', { roughness: 0.85 });
  const team = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 });
  const skin = skinMat();
  const hair = M.mat('#6a4020', { roughness: 0.9 });
  for (const s of [1, -1]) add(M.tube([[0, 0.45, 0.1 * s], [0.02, 0.2, 0.1 * s], [0, 0.0, 0.1 * s]], 0.08, 0.07, 2, 6), trousers, 0, 0, 0);
  add(M.lathe([[0.001, 0.4], [0.21, 0.42], [0.23, 0.6], [0.2, 0.85], [0.001, 0.88]], 10), cloth, 0, 0, 0);
  // Team-coloured tabard front and back.
  add(M.scaled(M.G.box, 0.06, 0.36, 0.26), team, 0.19, 0.64, 0);
  add(M.scaled(M.G.box, 0.06, 0.36, 0.26), team, -0.19, 0.64, 0);
  add(new THREE.TorusGeometry(0.21, 0.025, 4, 12).rotateX(Math.PI / 2), M.leatherMat(), 0, 0.5, 0);
  add(M.scaled(LOW, 0.13, 0.14, 0.13), skin, 0.02, 1.0, 0);
  add(M.scaled(LOW, 0.135, 0.08, 0.135), hair, -0.01, 1.07, 0);
  for (const s of [1, -1]) add(M.tube([[0.02, 0.82, 0.22 * s], [0.1, 0.62, 0.25 * s], [0.18, 0.5, 0.22 * s]], 0.06, 0.05, 3, 6), cloth, 0, 0, 0);
  // A pick over the shoulder.
  add(M.tube([[-0.1, 0.5, -0.25], [0.05, 0.9, -0.26], [0.15, 1.15, -0.26]], 0.025, 0.025, 2, 5), M.barkMat(), 0, 0, 0);
  add(M.scaled(M.G.box, 0.05, 0.05, 0.4), ironMat(), 0.15, 1.15, -0.26);
  g.scale.setScalar(1.15);
  peasantParts = mergeByMaterial(g).map((p) => ({ ...p, team: p.material === team }));
  return peasantParts;
}

// Each peasant is an entity with an empty marker object (for interpolation
// and touch picking); the crowd view draws them all.
registerView('peasant', {
  unit: true,
  make(e, world, v) {
    v.bald = !!e.b;
    v.dark = !!e.d;
    v.ph = Math.random() * 6;
    return new THREE.Group();
  },
  update(v, a, b, k, dt) {
    v.mv = !!b.mv;
    v.walk = (v.walk || v.ph) + dt * (v.mv ? 11 : 0);
  },
});

const BROWN = new THREE.Color('#5c3008');
const BLACK = new THREE.Color('#202022');
const MAX = 140;
const tm = new THREE.Matrix4();
const tq = new THREE.Quaternion();
const tp = new THREE.Vector3();
const ts = new THREE.Vector3(1, 1, 1);
const up = new THREE.Vector3(0, 1, 0);
const pv = new THREE.Vector3();

registerView('bbcrowd', {
  make(e, world, v) {
    const g = new THREE.Group();
    v.meshes = peasantTemplate().map((p) => {
      const m = new THREE.InstancedMesh(p.geo, p.material, MAX);
      m.castShadow = true;
      m.receiveShadow = true;
      m.count = 0;
      m.frustumCulled = false;
      m.userData.team = p.team;
      g.add(m);
      return m;
    });
    // Pointing at a peasant shows its name, as WC3's mouse-over tooltip did.
    const tip = document.createElement('div');
    tip.style.cssText = 'position:absolute;transform:translate(-50%,-100%);padding:2px 8px;border-radius:4px;background:rgba(0,0,0,0.75);font:bold 13px sans-serif;white-space:nowrap;pointer-events:none;display:none;z-index:5';
    world.overlay.appendChild(tip);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe060', transparent: true, opacity: 0.85, depthWrite: false }));
    ring.position.y = 0.06;
    ring.visible = false;
    g.add(ring);
    v.ptr = { x: 0, y: 0, t: -1e9, hold: false };
    const move = (ev) => {
      v.ptr.x = ev.clientX;
      v.ptr.y = ev.clientY;
      v.ptr.t = performance.now();
    };
    const down = (ev) => {
      move(ev);
      if (ev.pointerType === 'touch') v.ptr.hold = true;
    };
    const upH = () => {
      v.ptr.hold = false;
      v.ptr.t = performance.now() - 2000; // fade soon after the finger lifts
    };
    world.canvas.addEventListener('pointermove', move);
    world.canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', upH);
    v.cleanup = () => {
      world.canvas.removeEventListener('pointermove', move);
      world.canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', upH);
      tip.remove();
      for (const m of v.meshes) m.dispose();
    };
    v.tip = tip;
    v.ring = ring;
    return g;
  },
  update(v, a, b, k, dt, world) {
    v.obj.position.set(0, 0, 0);
    v.obj.rotation.y = 0;
    let n = 0;
    const crowd = [];
    for (const p of world.views.values()) {
      if (p.k !== 'peasant' || !p.obj.visible || n >= MAX) continue;
      crowd.push(p);
      const hop = p.mv ? Math.abs(Math.sin(p.walk)) * 0.1 : 0;
      tp.set(p.obj.position.x, hop, p.obj.position.z);
      tq.setFromAxisAngle(up, p.obj.rotation.y);
      tm.compose(tp, tq, ts);
      for (const m of v.meshes) {
        m.setMatrixAt(n, tm);
        if (m.userData.team) m.setColorAt(n, p.dark ? BLACK : BROWN);
      }
      n++;
    }
    for (const m of v.meshes) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    // Name tooltip.
    const live = v.ptr.hold || performance.now() - v.ptr.t < 2500;
    let best = null;
    if (live) {
      const gp = world.screenToGround(v.ptr.x, v.ptr.y);
      let bd = 0.8;
      if (gp) {
        for (const p of crowd) {
          const d = Math.hypot(p.obj.position.x - gp.x, p.obj.position.z - gp.y);
          if (d < bd) {
            bd = d;
            best = p;
          }
        }
      }
    }
    v.ring.visible = !!best;
    if (!best) {
      v.tip.style.display = 'none';
      return;
    }
    v.ring.position.x = best.obj.position.x;
    v.ring.position.z = best.obj.position.z;
    v.ring.material.color.set(best.bald ? '#ffd700' : '#ffffff');
    pv.set(best.obj.position.x, 1.8, best.obj.position.z).project(world.camera);
    const rect = world.canvas.getBoundingClientRect();
    const orect = world.overlay.getBoundingClientRect();
    v.tip.style.left = `${rect.left - orect.left + ((pv.x + 1) / 2) * rect.width}px`;
    v.tip.style.top = `${rect.top - orect.top + ((1 - pv.y) / 2) * rect.height}px`;
    v.tip.style.display = 'block';
    const txt = best.bald ? 'Baldwin' : 'Not Baldwin';
    if (v.tip.textContent !== txt) {
      v.tip.textContent = txt;
      v.tip.style.color = best.bald ? '#ffd700' : '#ffffff';
    }
  },
  remove(v) {
    v.cleanup?.();
  },
});

// A siege bomb lands.
registerEvent('bbomb', (e, world) => {
  world.fx.explosion(e.x, e.y, 0.9, { scorch: true });
  world.fx.debrisBurst(e.x, e.y, 6, 4);
});

// ------------------------------------------------------------ farm

function farm() {
  const g = new THREE.Group();
  const stone = M.texMat('tex_stone.webp', '#9a968c', '#e0dcd4', 1);
  const wood = M.texMat('tex_wood.webp', '#7a5230', '#ffffff');
  const thatch = M.texMat('tex_wood.webp', '#c8a050', '#f8d878', 2);
  g.add(M.mesh(M.scaled(M.G.box, 2.4, 0.3, 2.0), stone, 0, 0.15, 0));
  // Whitewashed walls with dark timber framing.
  g.add(M.mesh(M.scaled(M.G.box, 2.1, 1.0, 1.7), M.mat('#e4d8bc', { roughness: 0.9 }), 0, 0.8, 0));
  for (const x of [-1.05, 0, 1.05]) for (const z of [0.86, -0.86]) g.add(M.mesh(M.scaled(M.G.box, 0.1, 1.0, 0.04), wood, x, 0.8, z));
  for (const z of [0.86, -0.86]) g.add(M.mesh(M.scaled(M.G.box, 2.15, 0.1, 0.04), wood, 0, 1.25, z));
  // Pitched thatch roof.
  const sh = new THREE.Shape();
  sh.moveTo(-1.35, 0);
  sh.lineTo(0, 1.1);
  sh.lineTo(1.35, 0);
  sh.lineTo(-1.35, 0);
  const roof = new THREE.ExtrudeGeometry(sh, { depth: 2.3, bevelEnabled: false });
  roof.translate(0, 0, -1.15);
  roof.rotateY(Math.PI / 2);
  g.add(M.mesh(roof, thatch, 0, 1.3, 0));
  g.add(M.mesh(M.scaled(M.G.box, 0.35, 1.0, 0.35), stone, 0.6, 2.1, 0.55));
  g.add(M.mesh(M.scaled(M.G.box, 0.06, 0.6, 0.45), M.mat('#4a3020'), 1.06, 0.6, 0));
  for (const z of [0.5, -0.5]) g.add(M.mesh(M.scaled(M.G.box, 0.05, 0.3, 0.3), M.mat('#ffe8a0', { emissive: '#806020' }), 1.06, 0.95, z));
  // Haystacks and a fence stub.
  for (const [x, z] of [[-1.6, 1.3], [1.7, -1.1]]) g.add(M.mesh(M.blob(0.45, 0.4, 0.45, { seed: 171, amt: 0.15, detail: 2 }), thatch, x, 0.3, z));
  g.scale.setScalar(1.35);
  return g;
}

registerMapBuilder('baldwin', (map, world) => {
  world.mapGroup.add(farm());
});
