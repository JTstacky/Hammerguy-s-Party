// Ultima-X #161: the existing archer and forest with drunken camera sway.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { registerView, registerMapBuilder } from '../../engine/client/render/registry.js';

registerView('uxdrunkfx', {
  make(e, world, v) {
    const tint = document.createElement('div');
    tint.style.cssText = 'position:fixed;inset:0;pointer-events:none;opacity:0;z-index:3;';
    world.overlay.appendChild(tint);
    v.tint = tint;
    v.on = !!e.a;
    v.phase = e.c * Math.PI * 2;
    v.cam = (camera, dt, w) => {
      if (!v.on || w.time < 5) return;
      const t = w.time + v.phase;
      camera.position.x += Math.sin(t * 2.1) * 0.55 + Math.sin(t * 5.4) * 0.18;
      camera.position.z += Math.cos(t * 1.7) * 0.5 + Math.sin(t * 4.1) * 0.17;
      camera.position.y += Math.sin(t * 2.7) * 0.18;
      camera.lookAt(w.focus);
      camera.rotateZ(Math.sin(t * 1.6) * 0.045);
    };
    world.cameraFx.add(v.cam);
    return new THREE.Group();
  },
  update(v, a, b, k, dt, world) {
    v.on = !!b.a;
    if (!v.on || b.t < 5) { v.tint.style.opacity = '0'; return; }
    const cycle = (b.t - 5) / 3.25;
    const index = Math.floor(cycle);
    if (index !== v.index) {
      v.index = index;
      const hue = (index * 137 + Math.floor(b.c * 360)) % 360;
      v.tint.style.background = `hsl(${hue} 85% 60%)`;
      v.alpha = 0.2 + (index % 3) * 0.09;
    }
    const phase = (cycle - index) * 3.25;
    v.tint.style.opacity = String((phase < 1.5 ? phase / 1.5 : phase < 3 ? (3 - phase) / 1.5 : 0) * v.alpha);
  },
  remove(v, world) {
    v.tint.remove();
    world.cameraFx.delete(v.cam);
  },
});

registerMapBuilder('uxdrunkglade', (map, world) => {
  const scene = new THREE.Group();
  const gold = M.goldMat();
  const stone = M.triMat('tex_boulder.webp', '#535269', '#8d88a1', 0.7);
  const r = map.floor.w * 0.42;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    scene.add(M.mesh(M.blob(0.36, 0.55, 0.36, { seed: i + 200, amt: 0.1 }), stone, x, 0.35, z));
    scene.add(M.mesh(M.tube([[x, 0.65, z], [x, 1.5, z]], 0.035, 0.03), gold));
  }
  bakeStatic(scene);
  world.mapGroup.add(scene);
});
