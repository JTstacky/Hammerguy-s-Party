import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin, registerView, registerEvent, registerMapBuilder } from '../../engine/client/render/registry.js';
import { beast } from './ux2-common.js';
import { bakeModel } from '../../engine/client/render/batch.js';
registerSkin('uxsheep',c=>beast(c,'sheep'));
registerView('uxwolf',{make(){return bakeModel(beast('#bd5744','wolf'));}});
registerView('uxgrass',{make(){const g=new THREE.Group();g.add(M.mesh(M.blob(0.22,0.1,0.2,{seed:4}),M.mat('#45b838'),0,0.12,0));for(let i=0;i<5;i++){const a=i*1.26;g.add(M.mesh(M.tube([[0,0.1,0],[Math.cos(a)*0.13,0.42,Math.sin(a)*0.13]],0.025,0.005),M.mat('#83e049')));}return g;}});
registerEvent('uxgrass',(e,w)=>w.fx.burst(e.x,0.3,e.y,'#79df46',{n:12,speed:2,size:0.15,life:0.5}));
