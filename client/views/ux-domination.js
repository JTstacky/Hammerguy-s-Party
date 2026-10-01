import * as THREE from 'three';
import { registerSkin, registerMapBuilder, registerEvent, registerTheme, registerView } from '../../engine/client/render/registry.js';
import { uxHero, uxScenery } from './ux1-common.js';
registerSkin('ux-dh',c=>uxHero(c,'dh'));
registerTheme('ux-fog',{sky:'#cdd6d8',fog:'#aebfc1',sun:'#fff5e8',hemi:['#ecf5ed','#465250']},{floor:{tex:'tex_stone.webp',tint:'#a8aa9d',color:'#777c79',units:8},edge:{tex:'tex_dirt.webp',tint:'#8f987d',color:'#5d6558',units:5},outer:{tex:'tex_grass.webp',tint:'#7d8977',color:'#657168'},edgeWidth:1});
registerMapBuilder('ux-domination',(map,world)=>{uxScenery(world,[['pillar',-284/54,236/54,2.3],['pillar',228/54,-276/54,2.3],['rock',-11,-10,1.1],['rock',12,10,1.2]]);});
registerEvent('uxflame',(e,world)=>{world.fx.burst(e.x,0.6,e.y,'#72ff42',{n:12,speed:2,size:0.35,life:0.45});});
registerView('uxdhkeys',{make(){let mx=innerWidth/2,my=innerHeight/2;const move=e=>{mx=e.clientX;my=e.clientY;};const key=e=>{if(document.activeElement?.tagName==='INPUT'||window.game?.state?.snap?.mg?.id!=='domination')return;if(e.code==='KeyI'){e.preventDefault();window.game.send({t:'cmd',c:'cast',slot:0});}if(e.code==='KeyU'){e.preventDefault();const p=window.game.world.screenToGround(mx,my);if(p)window.game.send({t:'cmd',c:'cast',slot:1,x:p.x,y:p.y});}};window.addEventListener('pointermove',move);window.addEventListener('keydown',key);this.move=move;this.key=key;return new THREE.Group();},remove(){window.removeEventListener('pointermove',this.move);window.removeEventListener('keydown',this.key);}});
