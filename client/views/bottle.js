// Visuals for Uther Party 4.0 #50 "Battle for the Bottle"
// (server/minigames/up/50-bottle.js): the Tauren arena's cut corners and
// autumn trees, Runes of Mana, the Drunken Haze brew jug, Breath of Fire,
// haze and burn effects on the fighters, and the "drunk" screen: a random
// tinted flash every 3.25 s and a swaying camera (both softened from the
// original, which was close to blinding).

import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';

// How strong the effects are compared with the original. The flash there
// reaches 50-100 % opacity; here it peaks at 35 % of that.
const FLASH_CAP = 0.35;
const SWAY = 0.9; // camera drift in world units (the original's noise is ~15)
const ROLL = 0.035; // radians of camera roll

// ------------------------------------------------------------ map

// A deciduous "Fall Tree Wall" tree: a gnarled trunk under a round crown of
// orange and red leaves.
function autumnTree(s = 1, seed = 1) {
  const g = new THREE.Group();
  const bark = M.barkMat();
  g.add(M.mesh(M.lathe([[0.26 * s, 0], [0.2 * s, 0.3 * s], [0.15 * s, 1.3 * s], [0.1 * s, 2.1 * s]], 10), bark));
  for (const [dx, dz, h] of [[0.5, 0.2, 1.6], [-0.4, 0.35, 1.7], [0.05, -0.5, 1.8]]) {
    g.add(M.mesh(M.tube([[0, 1.2 * s, 0], [dx * 0.5 * s, 1.5 * s, dz * 0.5 * s], [dx * s, h * s, dz * s]], 0.09 * s, 0.04 * s, 6, 6), bark));
  }
  const tints = ['#ffffff', '#ffe4d4', '#fff4dc'];
  const leaves = (i) => M.triMat('tex_bottle_leaves.webp', ['#c4621e', '#b8401c', '#d8962a'][i % 3], tints[i % 3], 0.7, { roughness: 0.95 });
  const crowns = [[0, 2.5, 0, 1.25], [0.6, 2.2, 0.35, 0.85], [-0.55, 2.25, 0.3, 0.8], [0.1, 2.15, -0.6, 0.85], [0.05, 3.05, 0.05, 0.75]];
  crowns.forEach(([x, y, z, r], i) => {
    g.add(M.mesh(M.blob(r * s, r * 0.8 * s, r * s, { seed: seed * 13 + i, amt: 0.16, freq: 3.2 }), leaves(i + seed), x * s, y * s, z * s));
  });
  g.rotation.y = seed * 1.7;
  return g;
}

registerMapBuilder('bottle', (map, world) => {
  const HW = map.floor.w / 2;
  const CUT = HW * 1.5; // |x| + |y| <= 960 u of the 640 u half-width
  // The cut corners: a raised cliff shelf with a rounded, rocky face.
  const cliff = M.triMat('tex_boulder.webp', '#7a6a58', '#c8b49c', 0.6);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const sh = new THREE.Shape();
    const e = HW + 3;
    // The chamfer is pushed out by the bevel so the cliff foot sits on the pathing line.
    const c = CUT - HW + 0.8;
    sh.moveTo(sx * c, sy * HW);
    sh.lineTo(sx * HW, sy * c);
    sh.lineTo(sx * e, sy * c);
    sh.lineTo(sx * e, sy * e);
    sh.lineTo(sx * c, sy * e);
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.55, bevelSegments: 4, curveSegments: 4 });
    geo.rotateX(Math.PI / 2); // shape XY -> ground XZ, extruded downward
    geo.translate(0, 0.95, 0);
    const m = M.mesh(geo, cliff);
    world.mapGroup.add(m);
  }
  // The Fall Tree Walls: three autumn trees on the rim, where the map has them.
  const t = HW / 5; // one tile
  for (const [i, [x, y]] of [[4.5, -2.5], [-4.5, 2.5], [2.5, 4.5]].entries()) {
    const tr = autumnTree(1.15, i + 1);
    // They block pathing in the original; stand them on the cliff shelf.
    const k = Math.max(1, (CUT + 0.9 * t) / (Math.abs(x * t) + Math.abs(y * t)));
    tr.position.set(x * t * k, 1.2, y * t * k);
    world.mapGroup.add(tr);
  }
  // A ring of autumn trees among the pines outside.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.2;
    const r = HW * 1.45 + 2 + (i % 3) * 1.4;
    const tr = autumnTree(1 + (i % 4) * 0.12, i + 4);
    tr.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    world.mapGroup.add(tr);
  }
});

// ------------------------------------------------------------ rune of mana

function manaRune() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const stone = M.triMat('tex_boulder.webp', '#4a5a7a', '#9ab0d8', 1.4);
  // A rounded rune stone, carved on its face, floating over a glow.
  const tablet = M.mesh(M.lathe([[0.001, -0.08], [0.34, -0.07], [0.4, -0.02], [0.4, 0.03], [0.33, 0.08], [0.001, 0.09]], 20), stone);
  tablet.rotation.x = Math.PI / 2;
  body.add(tablet);
  const sigil = new THREE.Group();
  const glow = M.glowMat('#7fc8ff');
  sigil.add(M.mesh(new THREE.TorusGeometry(0.27, 0.025, 6, 32), glow));
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.09 : 0.21;
    if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  sigil.add(M.mesh(new THREE.ShapeGeometry(star), glow));
  for (const z of [0.092, -0.092]) {
    const s = sigil.clone();
    s.position.z = z;
    body.add(s);
  }
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#3a8cff', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = 0.05;
  g.add(halo);
  g.userData = { body, halo };
  return g;
}

registerView('manarune', {
  make(e, world, v) {
    const g = manaRune();
    v.parts = g.userData;
    world.fx.glow(e.x, 1, e.y, '#8fd0ff', 3, 0.5);
    return g;
  },
  update(v, a, b, k, dt, world) {
    const t = world.time + v.id;
    v.parts.body.position.y = 1 + Math.sin(t * 2.2) * 0.12;
    v.parts.body.rotation.y = t * 1.4;
    v.parts.halo.material.opacity = 0.28 + Math.sin(t * 3) * 0.08;
    if (Math.random() < 0.25) world.fx.trail(v.x + (Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.8, v.z + (Math.random() - 0.5) * 0.6, '#9fd8ff', 0.3, 0.6, 0.1);
    return true;
  },
});

registerEvent('runepick', (e, world) => {
  world.fx.burst(e.x, 1, e.y, '#8fd0ff', { n: 30, speed: 3, size: 0.5, life: 0.6 });
  world.fx.ring(e.x, e.y, 1.6, '#6fb4ff', 0.5);
  world.fx.glow(e.x, 1.2, e.y, '#8fd0ff', 3, 0.4);
  play('shield');
});

// ------------------------------------------------------------ drunken haze

function brewJug() {
  const g = new THREE.Group();
  const clay = M.triMat('tex_boulder.webp', '#8a5530', '#e0a070', 2.2);
  g.add(M.mesh(M.lathe([[0.001, -0.2], [0.14, -0.19], [0.2, -0.1], [0.2, 0.02], [0.13, 0.12], [0.07, 0.16], [0.08, 0.22], [0.001, 0.23]], 16), clay));
  g.add(M.mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.08, 10), M.texMat('tex_wood.webp', '#7a5230'), 0, 0.26, 0));
  const handle = M.mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 14, Math.PI * 1.2), clay, 0.16, 0.03, 0);
  handle.rotation.z = -Math.PI * 0.6;
  g.add(handle);
  g.add(M.mesh(new THREE.TorusGeometry(0.2, 0.018, 6, 20).rotateX(Math.PI / 2), M.mat('#3a2a1a'), 0, -0.04, 0));
  return g;
}

registerView('flask', {
  make() {
    const g = new THREE.Group();
    const jug = brewJug();
    jug.position.y = 1.5;
    g.add(jug);
    g.userData = { jug };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const j = v.obj.userData.jug;
    j.rotation.z += dt * 14;
    if (Math.random() < 0.6) world.fx.trail(v.x, 1.5, v.z, '#e8b040', 0.3, 0.4, 0.2);
  },
});

registerEvent('haze', (e, world) => {
  const fx = world.fx;
  fx.burst(e.x, 1.2, e.y, '#e8c060', { n: 26, speed: 4, size: 0.45, life: 0.6, additive: false, grav: 6 });
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * e.r;
    fx.smokePuff(e.x + Math.cos(a) * r, 0.6, e.y + Math.sin(a) * r, i % 2 ? '#a8a040' : '#c8a060', 1.6, 1.8, 0.45);
  }
  fx.ring(e.x, e.y, e.r, '#e8d070', 0.5);
  play('splash');
});

// Haze and fire on a fighter: bubbling brew fumes round the head, flames on the body.
registerView('brewfx', {
  make() {
    return new THREE.Group();
  },
  update(v, a, b, k, dt, world) {
    const fx = world.fx;
    const acc = (v.acc ??= { hz: 0, bn: 0 });
    if (b.hz) {
      acc.hz += dt * 7;
      while (acc.hz >= 1) {
        acc.hz -= 1;
        const ang = Math.random() * Math.PI * 2;
        fx.smokePuff(v.x + Math.cos(ang) * 0.4, 2.1, v.z + Math.sin(ang) * 0.4, Math.random() < 0.5 ? '#b0a848' : '#d0a860', 0.8, 1.1, 0.4);
        fx.trail(v.x + Math.cos(ang) * 0.5, 2.3, v.z + Math.sin(ang) * 0.5, '#f0d860', 0.25, 0.6, 0.2);
      }
    }
    if (b.bn) {
      acc.bn += dt * 20;
      while (acc.bn >= 1) {
        acc.bn -= 1;
        fx.flame(v.x, 0.5 + Math.random() * 1.2, v.z, 0.8, 0.45, 0.35);
      }
    }
  },
});

// ------------------------------------------------------------ breath of fire

// The wave sweeps out over len / speed seconds, spraying flames across the
// widening cone as it goes.
registerEvent('bof', (e, world) => {
  const fx = world.fx;
  const dir = { x: Math.cos(e.a), z: Math.sin(e.a) };
  const side = { x: -dir.z, z: dir.x };
  const dur = e.len / e.sp;
  let front = 0;
  fx.transients.push({
    obj: new THREE.Group(),
    t: 0,
    dur: dur + 0.05,
    update: (kk) => {
      const now = Math.min(e.len, (kk * (dur + 0.05) / dur) * e.len);
      const n = Math.round((now - front) * 24);
      for (let i = 0; i < n; i++) {
        const d = front + ((i + Math.random()) / Math.max(1, n)) * (now - front);
        const half = (e.w0 + (e.w1 - e.w0) * (d / e.len)) / 2;
        const s = (Math.random() * 2 - 1) * half;
        const x = e.x + dir.x * d + side.x * s;
        const z = e.y + dir.z * d + side.z * s;
        fx.sp.flames.spawn(x, 0.6 + Math.random() * 0.5, z, { vx: dir.x * 3, vy: 1.2, vz: dir.z * 3, size: 1.9 + d * 0.2, grow: 0.9, life: 0.6, frame: 0, anim: 16, rot: Math.random() - 0.5, spin: 0.3, fadeIn: 0.05 });
        if (Math.random() < 0.15) fx.smokePuff(x, 1.2, z, '#2e2826', 1.1, 1.2, 0.35);
      }
      front = now;
    },
  });
  fx.glow(e.x + dir.x * 1.2, 1.4, e.y + dir.z * 1.2, '#ffa040', 3, 0.35);
  fx.flash(e.x + dir.x * e.len * 0.5, e.y + dir.z * e.len * 0.5, e.len, '#ff8030', dur + 0.2);
});

// ------------------------------------------------------------ drunk screen

let flash = null;
registerEvent('bflash', (e) => {
  flash = { c: e.c, a: e.a * FLASH_CAP, t: 0 };
});

registerView('bottlefx', {
  make(e, world, v) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;inset:0;pointer-events:none;opacity:0;mix-blend-mode:normal;';
    world.overlay.appendChild(div);
    v.div = div;
    v.on = !!e.on;
    flash = null;
    // Sway the camera after the world has placed it (CameraSetTargetNoise).
    const orig = world.updateCamera;
    v.origCam = orig;
    world.updateCamera = function (dt) {
      orig.call(this, dt);
      const me = this.myView();
      const want = v.on && me && !(me.deadT > 0) ? 1 : 0;
      v.sway = (v.sway || 0) + (want - (v.sway || 0)) * Math.min(1, dt * 1.5);
      if (v.sway < 0.01) return;
      const t = this.time;
      const s = v.sway;
      this.camera.position.x += (Math.sin(t * 0.83) + 0.5 * Math.sin(t * 1.91 + 1)) * SWAY * s;
      this.camera.position.z += (Math.sin(t * 0.67 + 2) + 0.5 * Math.sin(t * 1.53)) * SWAY * 0.7 * s;
      this.camera.position.y += Math.sin(t * 1.1 + 4) * SWAY * 0.4 * s;
      this.camera.lookAt(this.focus);
      this.camera.rotateZ(Math.sin(t * 0.9 + 0.5) * ROLL * s);
    };
    return new THREE.Group();
  },
  update(v, a, b, k, dt) {
    v.on = !!b.on;
    if (flash) {
      // Fade out to the tint over 1.5 s, then back in over 1.5 s.
      flash.t += dt;
      const t = flash.t;
      const w = t < 1.5 ? t / 1.5 : t < 3 ? 1 - (t - 1.5) / 1.5 : 0;
      v.div.style.background = flash.c;
      v.div.style.opacity = String(Math.max(0, w) * flash.a);
      if (t >= 3) flash = null;
    } else v.div.style.opacity = '0';
    return true;
  },
  remove(v, world) {
    v.div.remove();
    world.updateCamera = v.origCam;
    flash = null;
  },
});
