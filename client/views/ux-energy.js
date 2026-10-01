import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin, registerView, registerMapBuilder } from '../../engine/client/render/registry.js';
import { creature, arena } from './ux3-common.js';

registerSkin('ux-dragon', (color) => creature(color, 'dragon'));
registerMapBuilder('ux-energy', (map, world) => arena(world, { halfX: 12, halfY: 10.8, theme: 'stone', pillars: 12 }));

const add = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });

// The Energy Bolt: a wisp of crackling light. At rest (pushable) it idles over
// a green ring; moving it flares up, throws sparks and its ring turns red.
registerView('uxbolt', {
  make(e, world, v) {
    const g = new THREE.Group();
    const core = M.mesh(new THREE.IcosahedronGeometry(0.32, 2), M.glowMat('#f4fdff'), 0, 0.8, 0);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 12), add('#5cc8ff', 0.45));
    const haze = new THREE.Mesh(new THREE.SphereGeometry(1.0, 18, 12), add('#2a7dff', 0.18));
    glow.position.y = haze.position.y = 0.8;
    // Lightning arcs: thin jagged loops that flicker round the core.
    const arcs = [];
    for (let i = 0; i < 3; i++) {
      const pts = [];
      for (let k = 0; k <= 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        const r = 0.5 + (k % 2 ? 0.12 : -0.05);
        pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a * 2) * 0.12, Math.sin(a) * r));
      }
      const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#cff4ff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, toneMapped: false }));
      arc.position.y = 0.8;
      arc.rotation.set(i * 1.1, i * 0.7, i * 0.4);
      arcs.push(arc);
      g.add(arc);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 40).rotateX(-Math.PI / 2), add('#6bff8a', 0.55));
    ring.position.y = 0.04;
    g.add(core, glow, haze, ring);
    v.parts = { emit: 0, glow, haze, ring, arcs, t: Math.random() * 10 };
    return g;
  },
  update(v, a, b, k, dt, world) {
    const s = a.s + (b.s - a.s) * k;
    const p = v.parts;
    const live = s >= 50;
    p.t += dt * (live ? 14 : 4);
    const pulse = 1 + Math.sin(p.t) * 0.08;
    p.glow.scale.setScalar((live ? 1.25 : 1) * pulse);
    p.haze.scale.setScalar((live ? 1.4 : 1) * pulse);
    p.glow.material.opacity = live ? 0.65 : 0.4;
    p.ring.material.color.set(live ? '#ff5a3a' : '#6bff8a');
    p.ring.material.opacity = live ? 0.35 : 0.5 + Math.sin(p.t * 0.8) * 0.15;
    p.arcs.forEach((arc, i) => {
      arc.rotation.x += dt * (live ? 9 : 2) * (i + 1);
      arc.rotation.y += dt * (live ? 7 : 1.5);
      arc.visible = Math.sin(p.t * (3 + i)) > (live ? -0.6 : 0.2);
    });
    p.emit += dt * (live ? 30 : 3);
    while (p.emit >= 1) {
      p.emit--;
      world.fx.sparks(v.x, 0.8, v.z, live ? '#bfefff' : '#8cddff', 1);
    }
  },
});
