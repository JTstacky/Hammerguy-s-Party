import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin, registerView, registerMapBuilder, registerTheme } from '../../engine/client/render/registry.js';
import { uxHero, uxScenery } from './ux1-common.js';
registerSkin('ux-siren',c=>uxHero(c,'siren'));registerSkin('ux-myrmidon',c=>uxHero(c,'myrmidon'));
registerTheme('ux-basin',{sky:'#8aaead',fog:'#6e9a9f',sun:'#e1f6ec',hemi:['#d8e7cf','#225163']},{floor:{tex:'tex_stone.webp',tint:'#7caba4',color:'#568685',units:11},edge:{tex:'tex_dirt.webp',tint:'#6a8a7b',color:'#4e726e',units:7},outer:{tex:'tex_grass.webp',tint:'#688c75',color:'#4d7662'},edgeWidth:1});
registerMapBuilder('ux-tornado',(map,world)=>{
  uxScenery(world,[['rock',108/54,-273/54,3],['rock',-1100/54,-520/54,2.2],['rock',-29,14,1.1],['rock',30,-14,1.1]]);
  const overhead=(camera,dt,w)=>{
    if(!w.map?.build?.includes('ux-tornado')){w.cameraFx.delete(overhead);return;}
    camera.position.set(0,54,0.5);
    camera.lookAt(0,0,0);
  };
  world.cameraFx.add(overhead);
});
registerView('uxtornado',{make(){const g=new THREE.Group();const mat=M.mat('#e0f0ed',{transparent:true,opacity:0.65,side:THREE.DoubleSide});for(let i=0;i<4;i++){const o=M.mesh(new THREE.ConeGeometry(0.35+i*0.18,0.8,16,1,true),mat,0,0.4+i*0.6,0);o.rotation.z=Math.PI;g.add(o);}g.scale.setScalar(1.8);this.acc=0;return g;},update(v,a,b,k,dt,world){v.obj.rotation.y+=dt*8;this.acc+=dt*14;while(this.acc>=1){this.acc--;world.fx.smokePuff(v.x,0.8,v.z,'#d8f4ee',0.45,0.5);}}});
registerView('uxmurgul',{make(){const g=new THREE.Group();g.add(M.mesh(M.blob(0.27,0.35,0.18,{seed:77}),M.hideMat('#6d9e78'),0,0.5,0));g.add(M.mesh(M.blob(0.2,0.18,0.16,{seed:78}),M.hideMat('#7cb488'),0.08,0.9,0));g.scale.setScalar(1.5);return g;}});
