import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin,registerView,registerEvent } from '../../engine/client/render/registry.js';
import { person } from './ux2-common.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
registerSkin('uxghost',c=>person(c,'ghost'));
registerView('uxneutralghost',{make(){const g=new THREE.Group(),pale=M.mat('#b6d7e3',{roughness:0.48}),robe=M.leatherMat('#354354');g.add(M.mesh(M.lathe([[0,0.1],[0.23,0.25],[0.31,0.75],[0.22,1.2],[0.13,1.5]],16),pale));g.add(M.mesh(M.blob(0.2,0.25,0.19,{seed:3,detail:2}),robe,0,1.28,0));g.add(M.mesh(M.blob(0.18,0.18,0.17,{seed:4,detail:2}),pale,0.12,1.72,0));for(const s of [-1,1]){g.add(M.mesh(M.tube([[0,1.35,s*0.22],[0.15,1.05,s*0.34],[0.23,0.8,s*0.35]],0.06,0.025),pale));g.add(M.mesh(M.scaled(M.G.sphere,0.025,0.02,0.02),robe,0.29,1.75,s*0.08));}bakeStatic(g);return g;}});
registerEvent('uxpossess',(e,w)=>{w.fx.glow(e.x1,1,e.y1,'#84baff',1.3,0.5);w.fx.glow(e.x2,1,e.y2,'#b3f4ff',1.7,0.6);});
