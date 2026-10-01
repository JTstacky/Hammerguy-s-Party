import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { bakeStatic } from '../../engine/client/render/batch.js';

const m=(g,mat,x=0,y=0,z=0)=>M.mesh(g,mat,x,y,z);
const orb=(sx,sy,sz,mat,x,y,z,seed=1)=>m(M.blob(sx,sy,sz,{seed,amt:0.045}),mat,x,y,z);
const cone=(r,h,mat,x,y,z)=>m(new THREE.ConeGeometry(r,h,12),mat,x,y,z);
export function humanoid(color,kind){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);body.scale.setScalar(kind==='villager'?1.35:1.55);
  const team=M.mat(color,{roughness:0.65,side:THREE.DoubleSide});
  const face=M.hideMat?.('#bca586')||M.mat('#cba47e');
  const leather=M.leatherMat('#795437'),iron=M.plateMat('#75828d'),gold=M.goldMat(),dark=M.mat('#302a32');
  const robe=M.texMat('tex_leather.webp',kind==='assassin'?'#41405b':kind==='tinker'?'#ae793b':kind==='furbolg'?'#785c3c':'#6d5b4c', '#c1a276');
  const leg=(s)=>{const p=new THREE.Group();p.position.set(0,0.48,s*0.17);p.add(orb(0.13,0.25,0.13,kind==='furbolg'?M.furMat('#77634c'):robe,0,-0.2,0,4+s));p.add(orb(0.19,0.09,0.14,dark,0.09,-0.43,0,8+s));return p;};
  const legL=leg(1),legR=leg(-1);body.add(legL,legR);
  body.add(orb(kind==='furbolg'?0.42:0.29,0.42,kind==='furbolg'?0.38:0.27,kind==='furbolg'?M.furMat('#73573d'):robe,0,0.91,0,11));
  body.add(m(M.lathe([[0.2,0.77],[0.3,0.63],[0.33,0.35]],18),robe));
  body.add(m(M.cloth(0.25,0.52,0.04),team,0.29,0.68,0));
  const head=new THREE.Group();head.position.set(0.1,1.42,0);body.add(head);
  head.add(orb(kind==='furbolg'?0.29:0.19,kind==='furbolg'?0.28:0.2,kind==='furbolg'?0.3:0.19,kind==='furbolg'?M.furMat('#947450'):face,0,0,0,12));
  for(const s of [-1,1]){
    head.add(orb(0.04,0.04,0.03,M.mat('#161622'),0.16,0.04,s*0.11,14+s));
    if(kind==='furbolg')head.add(orb(0.11,0.11,0.09,M.furMat('#5f412c'),-0.11,0.17,s*0.24,16+s));
  }
  if(kind==='assassin'){
    head.add(m(new THREE.SphereGeometry(0.225,16,10,0,Math.PI*2,0,Math.PI/2),dark,0,0.04,0));
    for(const s of [-1,1])body.add(cone(0.12,0.32,iron,-0.06,1.22,s*0.33));
    const cape=m(M.cloth(0.56,0.92,0.1),team,-0.24,0.83,0);body.add(cape);
    body.add(m(M.tube([[0.34,0.8,-0.3],[0.65,0.52,-0.3],[0.93,0.43,-0.3]],0.035,0.01,10,6),iron));
  }else if(kind==='tinker'){
    head.add(m(new THREE.CylinderGeometry(0.23,0.2,0.16,16),iron,0,0.17,0));
    body.add(orb(0.32,0.35,0.16,leather,-0.28,0.91,0,22));
    for(const s of [-1,1])body.add(m(new THREE.TorusGeometry(0.12,0.035,7,16),gold,-0.32,0.91,s*0.17));
  }else if(kind==='villager'){
    head.add(cone(0.23,0.3,M.mat('#735039'),-0.04,0.19,0));
    body.add(m(M.tube([[-0.3,0.95,0],[0.24,1.1,0.22]],0.04,0.04,7,6),leather));
  }else if(kind==='furbolg'){
    head.add(orb(0.24,0.14,0.2,M.furMat('#ad8c5e'),0.21,-0.08,0,20));
    for(const s of [-1,1])body.add(orb(0.18,0.25,0.18,M.furMat('#73563b'),0.05,0.99,s*0.38,30+s));
    body.add(m(M.tube([[0.18,0.77,-0.37],[0.55,0.46,-0.43],[0.8,0.39,-0.43]],0.07,0.05,8,8),M.barkMat('#79562f')));
  }
  const staff=new THREE.Group();body.add(staff);
  root.userData={body,legL,legR,staff,kind:'hero'};return root;
}

export function creature(color,kind){
  if(['assassin','tinker','furbolg','villager'].includes(kind))return humanoid(color,kind);
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);body.scale.setScalar(kind==='dragon'?1.7:kind==='icicle'?1.5:1.65);
  const team=M.mat(color,{roughness:0.55}),eye=M.mat('#101820'),ivory=M.mat('#e7e3c3');
  const coats={dragon:M.hideMat?.('#69935e')||M.mat('#69935e'),chicken:M.furMat('#dfc98b'),crab:M.plateMat('#bd5d48'),frog:M.hideMat?.('#72ac56')||M.mat('#72ac56'),racoon:M.furMat('#6d6a62'),rabbit:M.furMat('#e2d7be'),icicle:M.mat('#a9eaff',{metalness:0.2,roughness:0.25})};
  const coat=coats[kind]||team;
  if(kind==='icicle'){
    const glow=M.mat('#d7f9ff',{emissive:'#5bd5ff',emissiveIntensity:1.2,roughness:0.18});
    body.add(orb(0.38,0.44,0.38,glow,0,0.94,0,40));
    body.add(orb(0.25,0.3,0.25,team,0.1,1.06,0,41));
    for(const s of [-1,1]){
      const wing=orb(0.16,0.38,0.12,coat,-0.21,0.96,s*0.44,42+s);wing.rotation.x=s*0.35;body.add(wing);
      body.add(cone(0.1,0.5,glow,-0.32,0.57,s*0.2));
    }
    body.add(orb(0.07,0.07,0.06,ivory,0.42,1.04,0,45));
  }else{
    const big=kind==='dragon',crab=kind==='crab';body.add(orb(big?0.57:crab?0.46:0.34,big?0.32:0.26,big?0.3:crab?0.39:0.25,coat,0,0.54,0,41));
    body.add(orb(big?0.34:0.24,0.22,big?0.27:0.22,coat,big?0.49:0.25,0.69,0,42));
    for(const s of [-1,1]){
      body.add(orb(0.045,0.045,0.04,eye,big?0.7:0.43,0.76,s*0.15,43+s));
      if(kind==='rabbit')body.add(orb(0.08,0.3,0.06,coat,0.23,1.08,s*0.17,45+s));
      if(kind==='crab')body.add(orb(0.16,0.12,0.17,team,0.47,0.45,s*0.38,47+s));
      if(big){body.add(cone(0.16,0.43,team,-0.1,1.0,s*0.28));body.add(m(M.tube([[-0.4,0.55,s*0.16],[-0.85,0.42,s*0.18],[-1.15,0.28,s*0.19]],0.12,0.02,8,6),coat));}
    }
    body.add(m(M.cloth(big?0.44:0.28,0.2,0.02),team,0.06,0.81,0));
    if(kind==='chicken')body.add(cone(0.11,0.25,M.mat('#e54a35'),0.26,0.96,0));
    if(kind==='frog')for(const s of [-1,1])body.add(orb(0.14,0.1,0.13,coat,-0.22,0.25,s*0.31,51+s));
  }
  const legL=new THREE.Group(),legR=new THREE.Group();body.add(legL,legR);
  root.userData={body,legL,legR,kind:'hero'};return root;
}

export function arena(world,{halfX,halfY,theme,trees=0,pillars=0,rocks=1}){
  const group=new THREE.Group();world.mapGroup.add(group);
  const edge=M.boulderMat(theme==='snow'?'#8b9aab':theme==='water'?'#526778':'#5c5a50');
  const wood=M.barkMat('#544634'),leaf=M.texMat('tex_needles.webp',theme==='snow'?'#c2d1cc':'#475a40','#d0d8d2');
  const seed=(i)=>{const v=Math.sin(i*91.7+1.2)*43758.5;return v-Math.floor(v);};
  for(let i=0;i<Math.round(96*rocks);i++){
    const a=i/96*Math.PI*2,r=1+seed(i)*0.13,x=Math.cos(a)*halfX*r,z=Math.sin(a)*halfY*r;
    group.add(orb(0.35+seed(i+4)*0.65,0.25+seed(i+5)*0.4,0.35+seed(i+6)*0.65,edge,x,0.05,z,i));
  }
  for(let i=0;i<trees;i++){
    const side=i%3,x=side===0?-halfX+0.5:side===1?halfX-0.5:(seed(i+5)*2-1)*halfX;
    const z=side===2?halfY-0.4:(seed(i+7)*2-1)*halfY;
    group.add(m(new THREE.CylinderGeometry(0.12,0.18,1.2,8),wood,x,0.6,z));
    group.add(cone(0.62,1.3,leaf,x,1.5,z));group.add(cone(0.47,1.05,leaf,x,2.05,z));
  }
  for(let i=0;i<pillars;i++){const a=i*2*Math.PI/pillars,x=Math.cos(a)*(halfX-1.7),z=Math.sin(a)*(halfY-1.7);
    group.add(m(new THREE.CylinderGeometry(0.3,0.38,2.0,10),edge,x,1,z));group.add(cone(0.47,0.5,edge,x,2.25,z));
  }
  bakeStatic(group);return group;
}

export function simpleEntity(material,scale=0.3){const g=new THREE.Group();g.add(m(M.blob(scale,scale,scale,{seed:22,amt:0.02}),material,0,scale+0.1,0));return g;}
