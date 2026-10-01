import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { bakeStatic } from '../../engine/client/render/batch.js';
import { registerSkin, registerView, registerMapBuilder, registerTheme, VIEWS } from '../../engine/client/render/registry.js';
import { uxHero, uiBox } from './ux1-common.js';
registerSkin('ux-felgrunt',c=>uxHero(c,'felgrunt'));
registerTheme('ux-fel',{sky:'#542b26',fog:'#6c3830',sun:'#ffb274',hemi:['#e1a579','#382523']},{floor:{tex:'tex_stone.webp',tint:'#9a7060',color:'#6d504b',units:7},edge:{tex:'tex_dirt.webp',tint:'#633a32',color:'#482e2a',units:5},outer:{tex:'tex_dirt.webp',tint:'#5a3830',color:'#39231f'},edgeWidth:0.9});
registerMapBuilder('ux-typing',(map,world)=>{const g=new THREE.Group(),stone=M.boulderMat(),rim=M.goldMat();for(const z of [-352/54,-128/54])for(const x of [-384/54,-128/54,160/54,416/54]){g.add(M.mesh(M.scaled(M.G.cyl,1.2,0.4,1.2),stone,x,0.18,z));g.add(M.mesh(new THREE.TorusGeometry(1.1,0.07,8,24).rotateX(Math.PI/2),rim,x,0.4,z));}const stageZ=-9.2;g.add(M.mesh(M.scaled(M.G.cyl,4.7,1.8,1.6),stone,0,0.8,stageZ));const lord=new THREE.Group();lord.add(M.mesh(M.blob(1.2,1.1,0.8,{seed:101}),M.hideMat('#a06b53'),0,2.6,0));lord.add(M.mesh(M.blob(0.7,0.62,0.6,{seed:102}),M.hideMat('#96654c'),0.35,3.65,0));for(const s of [-1,1]){lord.add(M.mesh(M.tube([[0.15,3.6,s*0.4],[0,4.6,s*1],[-0.6,4.95,s*1.2]],0.16,0.04),M.boneMat()));lord.add(M.mesh(M.blob(0.6,0.22,0.4,{seed:103+s}),M.plateMat(),-0.2,3.1,s*1));}lord.position.z=stageZ;g.add(lord);bakeStatic(g);world.mapGroup.add(g);});
registerView('uxtypingui',{make(){const el=uiBox('ux-typing-ui');el.style.flexWrap='wrap';el.style.justifyContent='center';el.innerHTML='<span style="white-space:nowrap">Mannoroth: <b data-word>wait…</b></span><input aria-label="Type Mannoroth’s word" autocapitalize="off" autocomplete="off" spellcheck="false" style="font:18px monospace;width:min(180px,35vw);padding:6px;border-radius:5px"><button type="button" style="font:bold 16px system-ui;padding:6px 12px;background:#e4a75d;border:0;border-radius:6px">Submit</button><span data-timer></span>';const input=el.querySelector('input');const submit=()=>{window.game?.send({t:'cmd',c:'type',text:input.value});input.value='';input.focus();};el.querySelector('button').addEventListener('click',submit);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.stopPropagation();e.preventDefault();submit();}});this.el=el;this.input=input;this.word=el.querySelector('[data-word]');this.timer=el.querySelector('[data-timer]');this.lastRound=-1;this.lastLeft=-1;return new THREE.Group();},update(v,a,b,k,dt,world){if(this.lastRound!==b.round){this.lastRound=b.round;this.input.value='';this.word.textContent=b.word||'wait…';}if(this.lastLeft!==b.left){this.lastLeft=b.left;this.timer.textContent=b.word?`${b.left.toFixed(1)}s`:'';}},remove(){this.el?.remove();}});
const typingUI=VIEWS.get('uxtypingui');
const makeTypingUI=typingUI.make,removeTypingUI=typingUI.remove;
typingUI.make=function(...args){const obj=makeTypingUI.apply(this,args);const chat=document.getElementById('chatinput');this.chatKey=e=>{if(e.key==='Enter'&&chat.value.trim())window.game?.send({t:'cmd',c:'type',text:chat.value.trim()});};chat.addEventListener('keydown',this.chatKey,true);return obj;};
typingUI.remove=function(...args){document.getElementById('chatinput')?.removeEventListener('keydown',this.chatKey,true);removeTypingUI.apply(this,args);};
registerMapBuilder('ux-mannoroth-details',(map,world)=>{
  const g=new THREE.Group(),flesh=M.hideMat('#a86e50'),steel=M.plateMat(),horn=M.boneMat(),dark=M.leatherMat('#3b2924');
  g.position.z=-9.2;
  for(const s of [-1,1]){
    g.add(M.mesh(M.tube([[-0.05,3.3,s*0.7],[-0.55,2.7,s*1.3],[-0.5,1.8,s*1.5]],0.29,0.18),flesh));
    g.add(M.mesh(M.blob(0.5,0.26,0.45,{seed:120+s}),steel,-0.2,3.2,s*0.9));
    g.add(M.mesh(M.scaled(M.G.cone,0.18,0.6,0.18),horn,-0.48,3.45,s*1.1));
    for(let i=0;i<3;i++)g.add(M.mesh(M.scaled(M.G.cone,0.1,0.42,0.09),horn,-0.5+i*0.14,1.55,s*(1.35+i*0.1)));
    g.add(M.mesh(M.scaled(M.G.sphere,0.13,0.08,0.12),M.glowMat('#ffe15e'),0.92,3.75,s*0.28));
    g.add(M.mesh(M.tube([[-0.7,3.35,s*0.45],[-1.4,4.0,s*1.2],[-1.8,4.6,s*1.5]],0.14,0.015),dark));
  }
  g.add(M.mesh(M.blob(0.38,0.16,0.38,{seed:127}),dark,0.66,3.42,0));
  g.add(M.mesh(M.scaled(M.G.cone,0.14,0.48,0.11),horn,0.98,3.15,0.24));
  g.add(M.mesh(M.scaled(M.G.cone,0.14,0.48,0.11),horn,0.98,3.15,-0.24));
  bakeStatic(g);g.position.z=0;world.mapGroup.add(g);
});
