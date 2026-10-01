import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';

const add=(g,geo,mat,x=0,y=0,z=0)=>{g.add(M.mesh(geo,mat,x,y,z));};
const orb=(g,sx,sy,sz,mat,x=0,y=0,z=0,seed=1)=>add(g,M.blob(sx,sy,sz,{seed,amt:0.07,detail:2}),mat,x,y,z);
const tube=(g,pts,r,mat)=>add(g,M.tube(pts,r,r*0.5,8,7),mat);
const bone=M.boneMat(), eye=M.glowMat('#ffe870');

export function beast(color,kind){
  const g=new THREE.Group(),body=new THREE.Group();g.add(body);const team=M.mat(color,{roughness:0.8}),dark=M.furMat('#4b3b37'),pale=M.triMat('tex_snow.webp','#e5e5da','#ffffff',1.3),hide=M.hideMat();
  const insect=kind==='mosquito'; const spider=kind==='spider'||kind==='den'; const wolf=kind==='wolf'; const sheep=kind==='sheep';
  const len=insect?0.65:spider?0.85:wolf?1.6:1.3;
  const coat=sheep?pale:spider?M.mat('#342b45',{roughness:0.7}):insect?M.mat('#69945a',{metalness:0.3}):dark;
  orb(body,len*0.5,spider?0.28:0.42,spider?0.52:0.36,coat,0,spider?0.55:0.85,0,11);
  if(sheep) for(let i=0;i<12;i++){const a=i*2.4;orb(body,0.25,0.24,0.24,pale,Math.cos(a)*0.48,1.05+Math.sin(a*2)*0.18,Math.sin(a)*0.25,20+i);}
  if(sheep)orb(body,0.42,0.1,0.32,team,-0.05,1.34,0,48);
  orb(body,wolf?0.37:0.28,0.27,0.25,spider?coat:hide,len*0.48,spider?0.65:1.04,0,13);
  for(const s of [-1,1]){
    const legs=spider||insect?4:2;
    for(let j=0;j<legs;j++){
      const x=spider?(j-1.5)*0.25:(j===0?0.48:-0.45);const z=s*(spider?0.35:0.23);
      if(spider||insect)tube(body,[[x,0.72,z],[x+(j-1.5)*0.16,0.95,s*0.72],[x+(j-1.5)*0.24,0.07,s*1.03]],0.045,spider?dark:hide);
      else tube(body,[[x,0.72,z],[x+0.05,0.34,z],[x+0.12,0.08,z]],0.1,sheep?hide:dark);
    }
    orb(body,0.05,0.045,0.05,eye,len*0.65,spider?0.76:1.12,s*0.19,50);
    if(wolf)tube(body,[[0.65,1.17,s*0.15],[0.57,1.5,s*0.24],[0.75,1.4,s*0.2]],0.08,dark);
    if(sheep)tube(body,[[0.6,1.16,s*0.16],[0.66,1.32,s*0.27],[0.77,1.19,s*0.2]],0.07,hide);
  }
  if(insect){for(const s of [-1,1]){const wing=M.mesh(M.scaled(M.G.sphere,0.55,0.025,0.22),M.mat('#b6d9d0',{transparent:true,opacity:0.75,side:THREE.DoubleSide}),-0.1,1.15,s*0.36);wing.rotation.y=s*0.5;body.add(wing);}tube(body,[[0.3,0.83,0],[0.7,0.8,0],[1.05,0.74,0]],0.025,dark);}
  if(spider){orb(body,0.5,0.4,0.46,coat,-0.55,0.6,0,14);for(const s of [-1,1])tube(body,[[0.58,0.57,s*0.13],[0.94,0.45,s*0.17]],0.055,bone);}
  if(wolf)tube(body,[[-0.75,1.0,0],[-1.1,1.2,0],[-1.3,1.42,0]],0.13,dark);
  const band=M.mesh(new THREE.TorusGeometry(spider?0.48:0.39,0.06,6,18).rotateX(Math.PI/2),team,0,spider?0.66:0.88,0);body.add(band);
  const staff=new THREE.Group();body.add(staff);
  body.scale.setScalar(insect?0.8:spider?0.95:wolf?1.05:0.85);
  g.userData={body,staff,kind:'hero',anim:[],tick(dt,v,snap,world){body.position.y=Math.sin(world.time*(insect?15:8)+v.id)*0.045+(insect?1.3:0);if(snap.bur)body.scale.y=0.45;else body.scale.y=1;}};
  return g;
}

export function person(color,kind){
  const g=new THREE.Group(),body=new THREE.Group();g.add(body);const team=M.mat(color,{roughness:0.7}),cloth=M.leatherMat(kind==='doom'?'#3e2e2e':'#51647b'),skin=M.mat(kind==='ghost'?'#8bb5ca':kind==='revenant'?'#6d8ba5':'#dfc493'),metal=M.plateMat();
  const ghost=kind==='ghost',doom=kind==='doom';
  const leg=(s)=>{const p=new THREE.Group();p.position.set(-0.05,0.82,s*0.16);tube(p,[[0,0,0],[0.07,-0.37,0],[0.1,-0.76,0]],doom?0.14:0.09,cloth);return p;};
  const legL=leg(1),legR=leg(-1);body.add(legL,legR);
  orb(body,doom?0.42:0.3,0.46,doom?0.3:0.24,cloth,0,1.22,0,61);
  orb(body,0.22,0.22,0.2,skin,0.13,1.82,0,62);
  for(const s of [-1,1]){tube(body,[[0,1.52,s*0.28],[0.15,1.12,s*0.4],[0.24,0.95,s*0.38]],doom?0.13:0.08,skin);orb(body,0.045,0.025,0.03,eye,0.3,1.84,s*0.11,63);if(doom)tube(body,[[0.05,2.0,s*0.12],[-0.05,2.27,s*0.23],[0.04,2.42,s*0.3]],0.09,bone);}
  const cape=M.mesh(M.cloth(0.55,0.75,0.08,0.08),team,-0.25,1.22,0);body.add(cape);
  if(kind==='builder'){orb(body,0.25,0.1,0.25,metal,0.1,2.02,0,64);tube(body,[[0.35,1.0,-0.35],[0.9,1.15,-0.35]],0.065,M.barkMat());}
  if(kind==='revenant'){for(const s of [-1,1]){orb(body,0.21,0.11,0.21,metal,0,1.55,s*0.3,65);tube(body,[[0.22,1.0,s*0.36],[0.55,0.9,s*0.36],[0.9,1.1,s*0.36]],0.07,M.glowMat('#91eaff'));}}
  if(ghost){body.position.y=0.2;const tail=M.mesh(M.lathe([[0.0,0],[0.17,0.15],[0.3,0.5],[0.24,0.9]],16),team,0,0.12,0);body.add(tail);}
  const staff=new THREE.Group();body.add(staff);body.scale.setScalar(doom?1.6:ghost?1.1:1.2);
  g.userData={body,legL,legR,staff,kind:'hero',anim:[cape],tick(dt,v,snap,world){cape.rotation.x=Math.sin(world.time*3+v.id)*0.08;if(ghost)body.position.y=0.18+Math.sin(world.time*4+v.id)*0.08;if(kind==='revenant'&&cape.userData.owner!==snap.o){cape.userData.owner=snap.o;cape.material=M.mat(world.colors[snap.o]||'#cccccc',{roughness:0.7});}}};
  return g;
}

export function tower(type,color){const g=new THREE.Group(),base=M.boulderMat(),team=M.mat(color),metal=M.plateMat();const h=type==='magic'?2.4:type==='siege'?1.7:2.1;
  add(g,M.lathe([[0.48,0],[0.52,0.3],[0.42,h*0.8],[0.55,h]],12),base);
  add(g,new THREE.TorusGeometry(0.5,0.09,6,16).rotateX(Math.PI/2),team,0,h*0.75,0);
  if(type==='magic')orb(g,0.35,0.38,0.35,M.glowMat('#9f69ff'),0,h+0.32,0,80);
  else if(type==='siege'){tube(g,[[0,h,0],[0.5,h+0.12,0],[0.9,h+0.2,0]],0.15,metal);orb(g,0.18,0.18,0.18,metal,0.85,h+0.2,0,81);}
  else {for(const s of [-1,1])tube(g,[[0,h,s*0.28],[0.5,h+0.2,s*0.3],[0.8,h+0.18,s*0.25]],0.055,M.barkMat());}
  return g;}

export function simpleView(make,update){return{make(e,world,v){const g=make(e,world);v.parts=g.userData;return g;},update};}
