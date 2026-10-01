import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { bakeStatic } from '../../engine/client/render/batch.js';

const add=(g,geo,mat,x=0,y=0,z=0)=>{const o=M.mesh(geo,mat,x,y,z);g.add(o);return o;};
const limb=(g,a,b,r,mat)=>add(g,M.tube([a,b],r,r*0.72,8,5),mat);
export function uxHero(color,kind){
  const g=new THREE.Group(),body=new THREE.Group();g.add(body);
  const demon=kind==='dh',naga=kind==='siren'||kind==='myrmidon',ghost=kind==='wraith',orc=kind==='felgrunt';
  const skin=M.mat(demon?'#7669bd':naga?'#2b9aa4':ghost?'#c4e5e3':orc?'#ae3d26':'#e2b489',{roughness:0.65});
  const dark=M.texMat('tex_leather.webp','#2c303d',demon?'#69578f':naga?'#20556b':ghost?'#628080':orc?'#693b2f':'#314575',1);
  const metal=M.plateMat(naga?'#b7bf90':'#a5b6c8');
  const team=M.mat(color,{roughness:0.7,side:THREE.DoubleSide});
  const bone=M.boneMat();
  const legL=new THREE.Group(),legR=new THREE.Group();legL.position.set(0,0.85,0.15);legR.position.set(0,0.85,-0.15);body.add(legL,legR);
  if(naga){
    const tail=add(body,M.tube([[0,0.9,0],[-0.22,0.52,0],[-0.5,0.2,0.1],[-0.95,0.14,0.16]],0.22,0.045,12,8),skin);
    add(body,M.scaled(M.G.cone,0.28,0.22,0.15),team,-0.96,0.15,0.16);
    legL.visible=false;legR.visible=false;
  }else{
    for(const [leg,s] of [[legL,1],[legR,-1]]){limb(leg,[0,0,0],[0.02,-0.43,0],0.12,dark);limb(leg,[0.02,-0.42,0],[0.12,-0.8,0],0.1,metal);add(leg,M.scaled(M.G.sphere,0.2,0.09,0.12),dark,0.18,-0.81,0);}
  }
  add(body,M.lathe([[0.17,0.85],[0.28,1.06],[0.31,1.39],[0.2,1.63],[0.11,1.7]],18),dark);
  add(body,M.blob(0.13,0.16,0.13,{seed:31,amt:0.04}),skin,0.06,1.82,0);
  add(body,M.scaled(M.G.sphere,0.2,0.08,0.24),team,-0.02,1.4,0);
  const armL=new THREE.Group(),armR=new THREE.Group();armL.position.set(0,1.52,0.32);armR.position.set(0,1.52,-0.32);body.add(armL,armR);
  for(const [arm,s] of [[armL,1],[armR,-1]]){limb(arm,[0,0,0],[0.1,-0.33,0.05*s],0.105,skin);limb(arm,[0.1,-0.33,0.05*s],[0.32,-0.56,0.07*s],0.08,metal);add(arm,M.blob(0.16,0.1,0.16,{seed:41+s}),metal,0.01,-0.02,0);}
  const blade=kind==='swordsman'||demon;
  const weapon=new THREE.Group();armR.add(weapon);weapon.position.set(0.35,-0.55,0);
  if(blade){limb(weapon,[0,-0.22,0],[0,0.26,0],0.045,M.leatherMat('#52352b'));add(weapon,new THREE.CylinderGeometry(0.13,0.13,0.04,12),M.goldMat(),0,0.24,0);limb(weapon,[0,0.25,0],[0.08,1.6,0],demon?0.09:0.075,M.silverMat());add(weapon,M.scaled(M.G.cone,0.12,0.3,0.035),M.silverMat(),0.08,1.6,0);}
  if(kind==='myrmidon'){limb(weapon,[0,-0.1,0],[0,1.7,0],0.05,M.goldMat());for(const s of [-1,0,1])limb(weapon,[0,1.36,0],[0.15,1.82,s*0.17],0.045,M.silverMat());}
  if(kind==='wraith'){limb(weapon,[0,-0.1,0],[0,1.7,0],0.045,M.barkMat());add(weapon,M.scaled(M.G.sphere,0.18),M.glowMat('#c6ffff'),0,1.7,0);}
  if(orc){add(body,M.blob(0.22,0.16,0.2,{seed:44}),M.mat('#572522'),0.02,2.0,0);for(const s of [-1,1])limb(body,[0.13,1.73,s*0.06],[0.27,1.78,s*0.16],0.055,bone);add(body,M.blob(0.18,0.12,0.19,{seed:48}),metal,0,0.8,0);}
  if(demon){for(const s of [-1,1]){limb(body,[0.0,1.9,s*0.1],[-0.25,2.28,s*0.22],0.07,bone);limb(body,[-0.25,2.28,s*0.22],[-0.38,2.4,s*0.24],0.035,bone);}add(body,M.scaled(M.G.sphere,0.18,0.05,0.18),M.glowMat('#63ff7e'),0.13,1.82,0);}
  if(naga){for(const s of [-1,1]){limb(body,[-0.02,1.8,s*0.1],[-0.24,2.15,s*0.3],0.055,skin);limb(body,[-0.24,2.15,s*0.3],[-0.46,2.16,s*0.38],0.025,skin);}add(body,M.blob(0.21,0.13,0.2,{seed:53}),team,0,1.64,0);}
  if(ghost){add(body,M.cloth(0.8,1.2,0.15,0.2),team,-0.12,1.12,0);add(body,M.blob(0.22,0.16,0.2,{seed:57}),M.glowMat('#9eeaff'),0,1.85,0);}
  if(kind==='swordsman'){add(body,M.scaled(M.G.sphere,0.2,0.19,0.2),metal,0.02,1.92,0);add(body,M.cloth(0.65,1.0,0.14,0.12),team,-0.17,1.23,0);}
  body.scale.setScalar(1.35);
  const staff=new THREE.Object3D();body.add(staff);
  let flameAcc=0;
  g.userData={body,legL,legR,staff,kind:'hero',anim:[armL,armR,weapon],tick:(dt,v,snap,world)=>{const a=Math.max(0,-staff.rotation.x);armR.rotation.z=a*1.4;armL.rotation.z=a*0.3;if(demon&&snap?.im){flameAcc+=dt*8;while(flameAcc>=1){flameAcc--;world.fx.flame(v.x,0.5,v.z,0.7,0.35,0.04);}}}};
  return g;
}
export function uxScenery(world,items){const g=new THREE.Group();for(const [kind,x,z,s] of items){const o=kind==='pillar'?M.pillar():kind==='rock'?M.rock():kind==='tree'?M.tree():M.torch();o.position.set(x,0,z);o.scale.setScalar(s);g.add(o);}bakeStatic(g);world.mapGroup.add(g);}
export function uiBox(id){let el=document.getElementById(id);if(el)return el;el=document.createElement('div');el.id=id;el.style.cssText='position:absolute;left:50%;bottom:8px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:8px 12px;border:2px solid #ac8a53;border-radius:12px;background:#171617e8;color:#fff;font:bold 17px system-ui;max-width:95vw;z-index:10;pointer-events:auto';document.getElementById('hud').appendChild(el);return el;}
