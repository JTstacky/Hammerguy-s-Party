import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin, registerView, registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';
import { beast } from './ux2-common.js';
import { bakeModel } from '../../engine/client/render/batch.js';
registerSkin('uxsheep',c=>beast(c,'sheep'));
registerView('uxwolf',{make(){return bakeModel(beast('#bd5744','wolf'));}});
registerView('uxgrass',{make(){const g=new THREE.Group();g.add(M.mesh(M.blob(0.22,0.1,0.2,{seed:4}),M.mat('#45b838'),0,0.12,0));for(let i=0;i<5;i++){const a=i*1.26;g.add(M.mesh(M.tube([[0,0.1,0],[Math.cos(a)*0.13,0.42,Math.sin(a)*0.13]],0.025,0.005),M.mat('#83e049')));}return g;}});
registerEvent('uxgrass',(e,w)=>w.fx.burst(e.x,0.3,e.y,'#79df46',{n:12,speed:2,size:0.15,life:0.5}));
// The Circle of Power in the south and the grass pocket in the north.
registerMapBuilder('uxwolves', (map, world) => {
  const W = map.wolves;
  const [cx, cz] = W.CIRCLE;
  const g = new THREE.Group();
  const gold = M.goldMat();
  for (const [inner, outer, y] of [[0.72, 0.83, 0.05], [1.03, 1.13, 0.06]]) g.add(M.mesh(new THREE.RingGeometry(inner, outer, 40).rotateX(-Math.PI / 2), gold, cx, y, cz));
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    g.add(M.mesh(M.scaled(M.G.sphere, 0.09, 0.18, 0.09), M.glowMat('#ffd66a'), cx + Math.cos(a) * 0.9, 0.19, cz + Math.sin(a) * 0.9));
  }
  // A lush meadow in the pocket where the grass grows.
  const gx = (W.GRASS.x0 + W.GRASS.x1) / 2;
  const gz = (W.GRASS.y0 + W.GRASS.y1) / 2;
  const meadow = M.mesh(new THREE.CircleGeometry(2.4, 32).rotateX(-Math.PI / 2), M.mat('#5fae3a', { roughness: 0.9 }), gx, 0.02, gz);
  g.add(meadow);
  world.mapGroup.add(g);
});
