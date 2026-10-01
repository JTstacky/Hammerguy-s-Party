// Troubled Waters (#38): a sandy shallows channel beside the open sea, the
// tidal waves that roll down its lanes, and the drowning effect.
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerEvent, registerTheme, registerMapBuilder } from '../../engine/client/render/registry.js';
import { play } from '../../engine/client/audio.js';
import { fxTexture } from '../../engine/client/render/effects.js';
import { waterSurface, noise3, lowRock, bakeModel, bakeStatic } from './walkgrid-art.js';

registerTheme(
  'troubled',
  { sky: '#8ec4dc', fog: '#a8d0e0', floor: ['#d8c8a0', 30, {}], sun: '#fff4e0', hemi: ['#d8f0ff', '#6a6040'], sunI: 2.5 },
  {
    floor: { tex: 'tex_dirt.webp', tint: '#f4e8cc', color: '#d8c8a0', units: 6 },
    edge: { tex: 'tex_dirt.webp', tint: '#c8b898', color: '#a89878', units: 5 },
    outer: { tex: 'tex_grass.webp', tint: '#b8c49c', color: '#5a7a3a' },
    edgeWidth: 1.2,
  },
);

registerMapBuilder('troubled', (map, world) => {
  const f = map.floor;
  // The shallows over the whole channel: sand shows through.
  const shallow = waterSurface(f.w + 1.2, f.h + 0.6, { tile: 5, tint: '#e8fbff', opacity: 0.62, flow: [-0.05, 0.012] });
  shallow.position.y = 0.07;
  world.mapGroup.add(shallow);
  // The open sea along the north side, deep and dark.
  const sea = waterSurface(f.w + 120, 60, { tile: 7, tint: '#7fb0c0', flow: [-0.02, 0.03] });
  sea.position.set(0, 0.05, -f.h / 2 - 1.1 - 30);
  world.mapGroup.add(sea);
  // A strip of wet sand and foam where the sea meets the channel.
  const deco = new THREE.Group();
  const foamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', map: fxTexture('fx_flare.webp'), transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false });
  for (let x = -f.w / 2 - 6; x < f.w / 2 + 6; x += 1.4) {
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.9).rotateX(-Math.PI / 2), foamMat);
    foam.position.set(x + noise3(x, 1, 2) * 0.4, 0.08, -f.h / 2 - 1.1 + noise3(x, 3, 1) * 0.25);
    deco.add(foam);
  }
  // Rocks where the channel wall meets the sea.
  for (let x = -f.w / 2 - 4; x < f.w / 2 + 4; x += 1.1) {
    const r = lowRock(0.35 + (noise3(x * 2, 5, 1) * 0.5 + 0.5) * 0.45, Math.round(x * 3));
    r.position.set(x, -0.05, -f.h / 2 - 0.75 + noise3(x, 7, 3) * 0.2);
    deco.add(r);
  }
  // The start line: a row of driftwood stakes.
  const sx = -f.w / 2;
  for (let z = -f.h / 2; z <= f.h / 2; z += 0.9) {
    deco.add(M.mesh(M.tube([[sx - 0.3, 0, z], [sx - 0.32, 0.5, z + 0.03], [sx - 0.3, 0.9, z]], 0.07, 0.05, 4, 8), M.barkMat()));
  }
  world.mapGroup.add(bakeStatic(deco));
});

// A tidal wave: a curling sheet of water as wide as its lane, a foaming crest
// and spray, rolling toward +X (the server faces it west).
function tidalWave() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const W = 2.5;
  // Profile of the wave in the XY plane, from the back foot to the curl's lip.
  const prof = [[-1.3, 0], [-0.9, 0.5], [-0.4, 1.2], [0.1, 1.9], [0.55, 2.3], [0.95, 2.25], [1.15, 1.9], [1.05, 1.55]];
  const nu = prof.length - 1;
  const nz = 10;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= nu * 4; i++) {
    const t = i / 4;
    const a = Math.min(nu - 1, Math.floor(t));
    const f = t - a;
    const p = [prof[a][0] + (prof[a + 1][0] - prof[a][0]) * f, prof[a][1] + (prof[a + 1][1] - prof[a][1]) * f];
    for (let j = 0; j <= nz; j++) {
      const z = (j / nz - 0.5) * W;
      const edge = 1 - Math.pow(Math.abs(j / nz - 0.5) * 2, 3) * 0.35;
      pos.push(p[0] + Math.sin(z * 2.1 + t) * 0.06, p[1] * edge, z);
      uv.push(j / nz, t / nu);
    }
  }
  const row = nz + 1;
  for (let i = 0; i < nu * 4; i++) for (let j = 0; j < nz; j++) {
    const a = i * row + j;
    idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const water = M.texMat('tex_troubled_water.webp', '#2a8a9a', '#c8f4ff', 1, { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88, side: THREE.DoubleSide, emissive: '#0a3a48', emissiveIntensity: 0.5 });
  const sheet = new THREE.Mesh(geo, water);
  sheet.castShadow = true;
  body.add(sheet);
  // Foam: the crest and the churning foot.
  const foam = M.mat('#f4fbff', { roughness: 0.6, emissive: '#6a8a96', emissiveIntensity: 0.3 });
  const crest = M.mesh(M.blob(0.3, 0.22, W * 0.5, { seed: 4, amt: 0.25, freq: 5, detail: 2 }), foam, 0.95, 2.2, 0);
  const foot = M.mesh(M.blob(0.45, 0.2, W * 0.52, { seed: 7, amt: 0.3, freq: 4, detail: 2 }), foam, 1.1, 0.15, 0);
  body.add(crest, foot);
  for (const s of [1, -1]) body.add(M.mesh(M.blob(0.35, 0.8, 0.25, { seed: 9 + s, amt: 0.3, freq: 4, detail: 2 }), foam, 0.2, 0.9, (W / 2) * s));
  g.userData = { body, crest, foot, W };
  return g;
}

registerView('tidalwave', {
  make(e, world, v) {
    const g = bakeModel(tidalWave());
    v.parts = g.userData;
    v.phase = Math.random() * 6;
    return g;
  },
  update(v, a, b, k, dt, world) {
    const P = v.parts;
    const t = world.time + v.phase;
    P.body.scale.set(1, 1 + Math.sin(t * 5) * 0.06, 1);
    P.crest.rotation.x = Math.sin(t * 7) * 0.1;
    P.foot.scale.set(1 + Math.sin(t * 9) * 0.1, 1, 1);
    // Spray off the crest and spume at the foot, trailing behind as it runs.
    const fx = -Math.cos(v.f);
    v.acc = (v.acc || 0) + dt * 26;
    while (v.acc >= 1) {
      v.acc -= 1;
      const z = (Math.random() - 0.5) * P.W;
      const lip = 1.0;
      world.fx.trail(v.x - fx * lip, 2.1 + Math.random() * 0.4, v.z + z, '#e8faff', 0.55, 0.5, 0.35);
      if (Math.random() < 0.5) world.fx.smokePuff(v.x - fx * 1.2, 0.3, v.z + z, '#d8f0f8', 0.8, 0.6, 0.35);
    }
  },
});

registerEvent('drown', (e, world) => {
  world.fx.burst(e.x, 0.3, e.y, '#bfe8ff', { n: 40, speed: 5, size: 0.6, life: 0.8, up: 1.8, grav: 12, additive: false });
  world.fx.ring(e.x, e.y, 1.8, '#ffffff', 0.6, 0.1);
  play('splash');
});
