import { registerSkin,registerMapBuilder } from '../../engine/client/render/registry.js';
import { humanoid,creature,arena } from './ux3-common.js';
registerSkin('ux-furbolg',color=>humanoid(color,'furbolg'));
for(const k of ['chicken','crab','frog','racoon','rabbit'])registerSkin(`ux-${k}`,color=>creature(color,k));
registerMapBuilder('ux-hexxing',(map,world)=>arena(world,{halfX:10,halfY:10.5,theme:'grass',trees:3,rocks:0}));
