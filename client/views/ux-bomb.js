import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin,registerView,registerMapBuilder } from '../../engine/client/render/registry.js';
import { humanoid,arena } from './ux3-common.js';
registerSkin('ux-tinker',color=>humanoid(color,'tinker'));
registerMapBuilder('ux-bomb',(map,world)=>{const water=M.mesh(new THREE.PlaneGeometry(25.5,26.6).rotateX(-Math.PI/2),M.texMat('tex_shallows.webp','#34404a','#ffffff',4,{roughness:0.3,metalness:0.1}),0,0.02,0);world.mapGroup.add(water);arena(world,{halfX:13,halfY:13.6,theme:'water'});});
registerView('uxmine',{make(e,world,v){const g=new THREE.Group(),shell=M.mat('#484c40'),fuse=M.mat('#ff8b2e',{emissive:'#ff491c',emissiveIntensity:0.7});g.add(M.mesh(new THREE.DodecahedronGeometry(0.35,1),shell,0,0.31,0));g.add(M.mesh(new THREE.SphereGeometry(0.1,8,6),fuse,0,0.65,0));v.parts={emit:0};return g;},update(v,a,b,k,dt,world){const age=a.a+(b.a-a.a)*k;v.obj.scale.setScalar(1+0.09*Math.sin(age*12));v.parts.emit+=dt*(age>3?9:2);while(v.parts.emit>=1){v.parts.emit--;world.fx.sparks(v.x,0.68,v.z,'#ffa72c',1);}}});
registerView('uxtree',{make(){const g=new THREE.Group();g.add(M.mesh(new THREE.CylinderGeometry(0.16,0.23,1.5,8),M.barkMat('#544c3b'),0,0.75,0));g.add(M.mesh(new THREE.ConeGeometry(0.75,1.6,12),M.texMat('tex_needles.webp','#7b9f96','#d8e5dc'),0,1.8,0));return g;}});
