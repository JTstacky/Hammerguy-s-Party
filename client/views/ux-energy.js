import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin,registerView,registerMapBuilder } from '../../engine/client/render/registry.js';
import { creature,arena } from './ux3-common.js';
registerSkin('ux-dragon',color=>creature(color,'dragon'));
registerMapBuilder('ux-energy',(map,world)=>arena(world,{halfX:12,halfY:10.8,theme:'stone',pillars:12}));
registerView('uxbolt',{make(e,world,v){const g=new THREE.Group();g.add(M.mesh(new THREE.IcosahedronGeometry(0.45,2),M.mat('#9ee9ff',{emissive:'#55c5ff',emissiveIntensity:2}),0,0.75,0));v.parts={emit:0};return g;},update(v,a,b,k,dt,world){const s=a.s+(b.s-a.s)*k;v.obj.scale.setScalar(0.8+s/1200);v.parts.emit+=dt*(s>=50?35:5);while(v.parts.emit>=1){v.parts.emit--;world.fx.sparks(v.x,0.75,v.z,'#8cddff',1);}}});
