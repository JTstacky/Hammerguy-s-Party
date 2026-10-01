import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin,registerMapBuilder } from '../../engine/client/render/registry.js';
import { humanoid,arena } from './ux3-common.js';
registerSkin('ux-assassin',color=>humanoid(color,'assassin'));
registerMapBuilder('ux-assassin',(map,world)=>{const g=arena(world,{halfX:13,halfY:12.7,theme:'stone',pillars:4,rocks:0});const glow=M.mat('#9a365a',{emissive:'#6b1732',emissiveIntensity:0.65});for(const sx of [-1,1])for(const sz of [-1,1])g.add(M.mesh(new THREE.SphereGeometry(0.45,12,8),glow,sx*12.5,0.5,sz*12.2));});
