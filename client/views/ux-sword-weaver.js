import * as THREE from 'three';
import { registerSkin, registerMapBuilder, registerEvent, registerTheme, registerView } from '../../engine/client/render/registry.js';
import { uxHero, uxScenery } from './ux1-common.js';
registerSkin('ux-swordsman',c=>uxHero(c,'swordsman'));
registerTheme('ux-sword-stone',{sky:'#9c8290',fog:'#897481',sun:'#ffdbb5',hemi:['#eddbc9','#45323a']},{floor:{tex:'tex_stone.webp',tint:'#bba8aa',color:'#8d7778',units:7},edge:{tex:'tex_dirt.webp',tint:'#765c55',color:'#5b4540',units:5},outer:{tex:'tex_grass.webp',tint:'#6e5855',color:'#594743'},edgeWidth:0.8});
registerMapBuilder('ux-sword',(map,world)=>uxScenery(world,[[-1,-1],[-1,1],[1,-1],[1,1]].map(([x,z])=>['pillar',x*530/54,z*530/54,0.8])));
registerEvent('uxslash',(e,world)=>{world.fx.sparks(e.x,1,e.y,'#f7d97b',12);world.fx.ring(e.x,e.y,100/54,'#ffd177',0.25);});
registerView('uxswordkey',{make(){const key=e=>{if(e.code==='KeyS'&&document.activeElement?.tagName!=='INPUT'&&window.game?.state?.snap?.mg?.id==='swordweaver')window.game.send({t:'cmd',c:'cast',slot:0});};window.addEventListener('keydown',key);this.key=key;return new THREE.Group();},remove(){window.removeEventListener('keydown',this.key);}});
