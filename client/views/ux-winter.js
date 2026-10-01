import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin,registerView,registerMapBuilder } from '../../engine/client/render/registry.js';
import { creature,arena,simpleEntity } from './ux3-common.js';
registerSkin('ux-icicle',color=>{const g=creature(color,'icicle');g.userData.tick=(dt,v,snap)=>{g.userData.body.scale.setScalar(1.5*Math.max(0.2,(snap.hp||0)/50));};return g;});
registerMapBuilder('ux-winter',(map,world)=>{const snow=M.mesh(new THREE.PlaneGeometry(23.5,23.5).rotateX(-Math.PI/2),M.texMat('tex_snow.webp','#cbdbe6','#ffffff',4),0,0.035,0);world.mapGroup.add(snow);arena(world,{halfX:11.85,halfY:11.85,theme:'snow',trees:51});});
registerView('uxspirit',{make(){const g=simpleEntity(M.mat('#bca8ed'),0.42);g.add(M.mesh(new THREE.ConeGeometry(0.42,1.2,12),M.mat('#654982'),0,0.8,0));return g;},update(v,a,b,k,dt,world){v.obj.position.y=0.15+Math.sin(world.time*2+v.x)*0.15;}});
registerView('uxflame',{make(e,world,v){const g=new THREE.Group();const mat=M.mat('#ff6829',{transparent:true,opacity:0.55,depthWrite:false,side:THREE.DoubleSide});const ring=M.mesh(new THREE.RingGeometry(2.75,3.15,48),mat,0,0.08,0);ring.rotation.x=-Math.PI/2;g.add(ring);v.parts={ring,mat,emit:0};return g;},update(v,a,b,k,dt,world){const age=a.a+(b.a-a.a)*k;v.parts.ring.visible=age<1;v.parts.mat.opacity=age<1?0.35+0.25*Math.sin(age*17):0.12;v.parts.emit+=dt*(age<1?0:16);while(v.parts.emit>=1){v.parts.emit--;world.fx.flame(v.x+Math.random()*3-1.5,0.1,v.z+Math.random()*3-1.5,0.3);}},remove(v){v.parts.mat.dispose();}});
