// The Footman (`h002`): the player unit of Flight of the Footmen. Steel plate
// and mail, an open-faced helm with a nasal guard, a team tabard and a round
// shield painted in team colour with a gold lion-crest boss, a short sword.
// Defend swings the shield up in front of him (tick() reads the 'defend' fx).

import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin } from '../../engine/client/render/registry.js';

const { mesh, tube, lathe, cloth, mat, G, scaled } = M;

export function footman(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(1.3);
  g.add(body);
  const steel = M.plateMat();
  const gold = M.goldMat();
  const team = mat(color, { roughness: 0.8, side: THREE.DoubleSide });
  const mail = mat('#9aa0aa', { roughness: 0.5, metalness: 0.5 });
  const skin = mat('#e8b896', { roughness: 0.7 });
  const leather = M.leatherMat('#a07048');
  const dark = mat('#141414');

  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(0, 0.6, 0.12 * s);
    hip.add(mesh(tube([[0, 0, 0], [0.02, -0.24, 0], [0, -0.48, 0]], 0.1, 0.08, 6, 8), mail));
    hip.add(mesh(scaled(G.sphere, 0.075), steel, 0.05, -0.26, 0));
    hip.add(mesh(scaled(G.sphere, 0.12, 0.07, 0.09), leather, 0.05, -0.55, 0));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);

  const torso = mesh(lathe([[0.2, 0.58], [0.24, 0.7], [0.27, 0.88], [0.28, 1.02], [0.24, 1.14], [0.12, 1.22], [0.07, 1.24]], 18), steel);
  torso.scale.set(0.9, 1, 1.15);
  const skirt = mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.24, 18, 1, true), mail, 0, 0.58, 0);
  skirt.scale.z = 1.1;
  const tabard = mesh(cloth(0.3, 0.7, 0.06), team, 0.26, 0.62, 0);
  tabard.rotation.y = Math.PI;
  const back = mesh(cloth(0.3, 0.6, 0.06), team, -0.25, 0.66, 0);
  const belt = mesh(new THREE.TorusGeometry(0.255, 0.03, 6, 22).rotateX(Math.PI / 2), leather, 0, 0.72, 0);
  belt.scale.z = 1.12;
  const face = mesh(scaled(G.sphere, 0.12), skin, 0.05, 1.33, 0);
  const helm = mesh(lathe([[0.15, 1.26], [0.16, 1.34], [0.16, 1.42], [0.13, 1.5], [0.06, 1.55], [0.01, 1.56]], 18), steel, -0.02, 0, 0);
  const cheek = mesh(new THREE.CylinderGeometry(0.155, 0.15, 0.14, 18, 1, true, Math.PI * 0.25, Math.PI * 1.5), steel, -0.02, 1.33, 0);
  const nasal = mesh(scaled(G.box, 0.025, 0.12, 0.03), steel, 0.155, 1.36, 0);
  const crest = mesh(scaled(G.box, 0.26, 0.04, 0.025), gold, -0.03, 1.53, 0);
  const pauld = (s) => {
    const p = mesh(new THREE.SphereGeometry(0.15, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), steel, 0, 1.1, 0.3 * s);
    p.rotation.x = 0.5 * s;
    return p;
  };
  const trim = (s) => {
    const t = mesh(new THREE.TorusGeometry(0.145, 0.02, 5, 18).rotateX(Math.PI / 2), team, 0, 1.1, 0.3 * s);
    t.rotation.x = 0.5 * s;
    return t;
  };

  // Shield arm (left): a group so Defend can swing it in front.
  const shieldArm = new THREE.Group();
  shieldArm.position.set(0, 1.08, 0.33);
  shieldArm.add(mesh(tube([[0, 0, 0], [0.06, -0.2, 0.04], [0.14, -0.34, 0.02]], 0.08, 0.07, 6, 8), mail));
  const shield = new THREE.Group();
  shield.position.set(0.16, -0.32, 0.12);
  const disc = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 22).rotateX(Math.PI / 2), team);
  const rim = mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 26), steel);
  const boss = mesh(scaled(G.sphere, 0.09, 0.09, 0.05), gold, 0, 0, 0.03);
  const band = mesh(scaled(G.box, 0.05, 0.56, 0.02), gold, 0, 0, 0.03);
  shield.add(disc, rim, boss, band);
  shieldArm.add(shield);

  // Sword arm (right): the "staff" a cast raises.
  const swordArm = new THREE.Group();
  swordArm.position.set(0, 1.08, -0.33);
  swordArm.add(mesh(tube([[0, 0, 0], [0.08, -0.2, -0.04], [0.18, -0.32, -0.02]], 0.08, 0.07, 6, 8), mail));
  swordArm.add(mesh(scaled(G.sphere, 0.07), steel, 0.2, -0.33, -0.02));
  swordArm.add(mesh(scaled(G.box, 0.04, 0.03, 0.18), gold, 0.24, -0.3, -0.02));
  const blade = mesh(tube([[0.24, -0.3, -0.02], [0.4, -0.12, -0.02], [0.56, 0.06, -0.02]], 0.035, 0.01, 4, 4), M.silverMat());
  swordArm.add(blade);

  body.add(legL, legR, torso, skirt, tabard, back, belt, face, helm, cheek, nasal, crest, pauld(1), pauld(-1), trim(1), trim(-1), shieldArm, swordArm);
  // Rest and Defend poses for the shield arm (no allocation per frame).
  let k = 0;
  g.userData = {
    body, legL, legR, staff: swordArm, anim: [shieldArm, shield], kind: 'hero',
    tick(dt, v, b) {
      const on = (b.fx || []).includes('defend') && !b.dead;
      k += ((on ? 1 : 0) - k) * Math.min(1, dt * 10);
      // Rest: shield on the left side. Defend: raised in front, face forward.
      shieldArm.rotation.set(-0.15 * (1 - k), 0.5 * k, 0);
      shield.position.set(0.16 + 0.37 * k, -0.32 + 0.16 * k, 0.12 - 0.21 * k);
      shield.rotation.set(0, 0.25 + 0.82 * k, 0);
    },
  };
  // Rest pose until the first tick.
  g.userData.tick(1, {}, {});
  return g;
}

registerSkin('footman', (color) => footman(color));
