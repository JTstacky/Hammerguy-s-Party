import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { registerSkin,registerEvent,registerMapBuilder } from '../../engine/client/render/registry.js';
import { person } from './ux2-common.js';
registerSkin('uxrevenant',c=>person(c,'revenant'));
registerEvent('uxswap',(e,w)=>{for(const [x,y] of [[e.x1,e.y1],[e.x2,e.y2]]){w.fx.glow(x,1,y,'#70d9ff',2,0.6);w.fx.ring(x,y,1.3,'#d6f6ff',0.5);}for(const [id,pid] of [[e.id1,e.o1],[e.id2,e.o2]]){const v=w.views.get(id);if(!v)continue;const color=w.colors[pid]||'#cccccc';v.owner=pid;if(v.sel){v.sel.material.color.set(pid===w.myId?'#30ff30':color);v.sel.material.opacity=pid===w.myId?0.95:0.55;}const name=v.bar?.querySelector('.uname');if(name){name.textContent=w.names[pid]||'';name.style.color=color;}}});
registerMapBuilder('uxsoul',(map,world)=>{const g=new THREE.Group(),water=M.texMat('tex_shallows.webp','#3c7888','#c8ffff',1,{roughness:0.2,metalness:0.1,emissive:'#1d5a6a',emissiveIntensity:0.6});for(const [x,z,sx,sz] of [[-6,-5,2.8,1.1],[7,4,2.5,1.3],[-8,7,1.5,0.8],[4,-8,2,1]]){const p=M.mesh(new THREE.CircleGeometry(1,30).rotateX(-Math.PI/2),water,x,0.035,z);p.scale.set(sx,1,sz);g.add(p);}bakeStatic(g,{castShadow:false});world.mapGroup.add(g);});
