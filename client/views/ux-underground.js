import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { bakeStatic,bakeModel } from '../../engine/client/render/batch.js';
import { registerSkin,registerView,registerEvent,registerMapBuilder } from '../../engine/client/render/registry.js';
import { beast } from './ux2-common.js';
registerSkin('uxspider',c=>beast(c,'spider'));
registerView('uxden',{make(){const g=bakeModel(beast('#b93a2e','den'));g.scale.setScalar(1.6);return g;}});
registerEvent('uxburrow',(e,w)=>w.fx.dustCloud(e.x,e.y,0.9,'#5b485b',12));
registerMapBuilder('uxunderground',(map,world)=>{const g=new THREE.Group(),stone=M.boulderMat();const hw=map.floor.w/2,hh=map.floor.h/2;for(let x=-hw+1;x<hw-3;x+=1.8){for(const z of [-hh+5.3,hh-5.3]){const r=M.rock(0.85);r.position.set(x,0,z);g.add(r);}}for(let z=-hh+5;z<hh-5;z+=1.8){for(const x of [-hw+0.3,hw-0.3]){const r=M.rock(0.9);r.position.set(x,0,z);g.add(r);}}const ring=M.mesh(new THREE.RingGeometry(0.8,1.25,32).rotateX(-Math.PI/2),M.glowMat('#a55cff'),-hw+1.85,0.08,hh-2.45);g.add(ring);bakeStatic(g);world.mapGroup.add(g);});
