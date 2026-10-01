import { registerSkin,registerEvent } from '../../engine/client/render/registry.js';
import { person } from './ux2-common.js';
registerSkin('uxdoom',c=>person(c,'doom'));
registerEvent('uxstomp',(e,w)=>{w.fx.ring(e.x,e.y,2.8,e.decoy?'#ba9abd':'#f57738',0.5);w.fx.burst(e.x,0.2,e.y,'#ffd782',{n:22,speed:4,size:0.35,life:0.5});});
