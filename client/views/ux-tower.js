import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin, registerView, registerEvent } from '../../engine/client/render/registry.js';
import { person,tower } from './ux2-common.js';
registerSkin('uxbuilder',c=>person(c,'builder'));
registerView('uxtower',{make(e,world,v){const g=tower(e.type,world.colors[e.o]||'#d9a843');v.full=g.scale.y;return g;},update(v,a,b,k){v.obj.scale.y=Math.max(0.2,1-(b.b||0)*0.7);}});
registerEvent('uxbuild',(e,w)=>w.fx.dustCloud(e.x,e.y,0.8,'#cab989',8));
registerEvent('uxtowershot',(e,w)=>{w.fx.sparks(e.tx,0.9,e.ty,8,2,e.type==='magic'?'#c491ff':'#ffca75');});
