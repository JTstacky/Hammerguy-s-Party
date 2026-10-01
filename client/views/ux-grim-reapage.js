import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin, registerView, registerMapBuilder, registerTheme } from '../../engine/client/render/registry.js';
import { uxHero, uxScenery } from './ux1-common.js';
registerSkin('ux-wraith',c=>uxHero(c,'wraith'));
registerTheme('ux-grim-night',{sky:'#101824',fog:'#253048',sun:'#a5b9cf',hemi:['#a7b8d7','#19212b']},{floor:{tex:'tex_nightgrass.webp',tint:'#72869a',color:'#344454',units:8},edge:{tex:'tex_stone.webp',tint:'#65727e',color:'#303b44',units:5},outer:{tex:'tex_nightgrass.webp',tint:'#4a5b61',color:'#233039'},edgeWidth:1.1});
registerMapBuilder('ux-grim',(map,world)=>uxScenery(world,[['tree',-12,-10,1.2],['tree',12,-10,1.3],['tree',-12,10,1],['tree',12,10,1],['rock',-8,11,1.4],['rock',8,-11,1.3]]));
registerView('uxkid',{make(){const g=new THREE.Group(),skin=M.mat('#b9a387'),cloth=M.texMat('tex_leather.webp','#856447','#a88455');g.add(M.mesh(M.blob(0.18,0.3,0.16,{seed:90}),cloth,0,0.52,0));g.add(M.mesh(M.blob(0.14,0.15,0.14,{seed:91}),skin,0,0.98,0));g.add(M.mesh(M.blob(0.15,0.07,0.15,{seed:92}),M.furMat('#6d5542'),-0.02,1.12,0));return g;}});
registerView('uxgrimkey',{make(){const key=e=>{if(e.code==='KeyW'&&document.activeElement?.tagName!=='INPUT'&&window.game?.state?.snap?.mg?.id==='grimreapage')window.game.send({t:'cmd',c:'cast',slot:0});};window.addEventListener('keydown',key);this.key=key;return new THREE.Group();},remove(){window.removeEventListener('keydown',this.key);}});
