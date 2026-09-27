// The Orc Peon (`opeo`): the player unit of Peon Pandemonium, and, red-skinned,
// the Fel Orc Peon (`ncpn`) of Fel Orc Fiasco. A hunched, big-shouldered
// worker with a bald head, long ears and tusks, a cloth kilt and a leather
// shoulder pad, carrying a pick. Team colour on the kilt sash and armband.

import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerSkin } from '../../engine/client/render/registry.js';

const { mesh, blob, tube, lathe, cloth, mat, G, scaled } = M;

export function peon(color, { hide = '#76a03c', kiltColor = '#b08858' } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(1.3);
  g.add(body);
  const skin = mat(hide, { roughness: 0.6 });
  const cloth_ = M.texMat('tex_leather.webp', kiltColor, kiltColor, 1, { roughness: 0.95, side: THREE.DoubleSide });
  const leather = M.leatherMat('#a07048');
  const team = mat(color, { roughness: 0.85, side: THREE.DoubleSide });
  const tusk = mat('#efe6cc', { roughness: 0.5 });
  const eye = mat('#1a0e06', { roughness: 0.3 });
  const wood = M.texMat('tex_wood.webp', '#7a5530', '#c49a60');
  const iron = mat('#5c5f66', { metalness: 0.7, roughness: 0.4 });

  // Short bowed legs and big bare feet.
  const leg = (s) => {
    const hip = new THREE.Group();
    hip.position.set(-0.02, 0.5, 0.14 * s);
    hip.add(mesh(tube([[0, 0, 0], [0.05, -0.2, 0.03 * s], [0.02, -0.4, 0.02 * s]], 0.1, 0.075, 6, 10), skin));
    hip.add(mesh(blob(0.15, 0.06, 0.09, { seed: 40 + s, amt: 0.08 }), skin, 0.07, -0.45, 0.02 * s));
    hip.add(mesh(new THREE.CylinderGeometry(0.08, 0.085, 0.07, 10), leather, 0.02, -0.34, 0.02 * s));
    return hip;
  };
  const legL = leg(1);
  const legR = leg(-1);

  // Hunched torso: a broad back and chest leaning forward over a pot belly.
  const torso = mesh(blob(0.3, 0.34, 0.3, { seed: 44, amt: 0.06 }), skin, 0.02, 0.85, 0);
  torso.rotation.z = -0.35;
  const belly = mesh(blob(0.22, 0.2, 0.24, { seed: 45, amt: 0.04 }), skin, 0.1, 0.66, 0);
  const shoulders = mesh(blob(0.24, 0.16, 0.4, { seed: 46, amt: 0.07 }), skin, -0.06, 1.04, 0);
  // Kilt: a wrapped cloth skirt with a team sash, a rope belt and a front flap.
  const kilt = mesh(lathe([[0.2, 0.62], [0.23, 0.52], [0.27, 0.36], [0.29, 0.3]], 20), cloth_);
  kilt.scale.z = 1.15;
  const sash = mesh(new THREE.TorusGeometry(0.215, 0.04, 8, 24).rotateX(Math.PI / 2), team, 0.01, 0.6, 0);
  sash.scale.z = 1.15;
  const flap = mesh(cloth(0.2, 0.34, 0.03, -0.03), team, 0.22, 0.46, 0);
  flap.rotation.y = Math.PI;
  // One leather shoulder pad (left), trimmed in team colour, with a strap
  // across the chest.
  const pad = mesh(new THREE.SphereGeometry(0.13, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), leather, -0.05, 1.1, 0.3);
  pad.rotation.x = 0.5;
  const padRim = mesh(new THREE.TorusGeometry(0.125, 0.022, 6, 20).rotateX(Math.PI / 2), team, -0.05, 1.1, 0.3);
  padRim.rotation.x = 0.5;
  const strap = mesh(tube([[-0.12, 1.2, 0.28], [0.2, 0.98, 0.05], [0.12, 0.7, -0.2]], 0.03, 0.03, 10, 5), leather);

  // Long, thick arms hanging forward; wrist wraps; a team armband.
  const arm = (s, reach) => {
    const a = new THREE.Group();
    a.add(mesh(tube([[-0.05, 1.08, 0.36 * s], [0.08 + reach * 0.05, 0.86, 0.42 * s], [0.18 + reach * 0.12, 0.66, 0.34 * s]], 0.085, 0.07, 8, 10), skin));
    a.add(mesh(new THREE.CylinderGeometry(0.078, 0.08, 0.07, 10), team, 0.06, 0.92, 0.41 * s));
    a.add(mesh(new THREE.CylinderGeometry(0.068, 0.07, 0.09, 10), leather, 0.17 + reach * 0.12, 0.69, 0.35 * s));
    a.add(mesh(blob(0.085, 0.08, 0.08, { seed: 47 + s }), skin, 0.21 + reach * 0.13, 0.6, 0.33 * s));
    return a;
  };

  // Head thrust forward below the shoulders: heavy brow, underbite with
  // tusks, long pointed ears, a bald scalp with a small top-knot.
  const head = new THREE.Group();
  head.position.set(0.27, 1.18, 0);
  head.scale.setScalar(1.25);
  head.add(mesh(blob(0.15, 0.15, 0.14, { seed: 48, amt: 0.05 }), skin, 0, 0.04, 0));
  head.add(mesh(blob(0.12, 0.09, 0.14, { seed: 49, amt: 0.05 }), skin, 0.07, -0.07, 0)); // jaw
  head.add(mesh(blob(0.05, 0.03, 0.12, { seed: 51, amt: 0.04 }), skin, 0.12, 0.09, 0)); // brow
  for (const s of [1, -1]) {
    head.add(mesh(scaled(G.sphere, 0.022), eye, 0.14, 0.05, 0.055 * s));
    const t = mesh(new THREE.ConeGeometry(0.022, 0.09, 8), tusk, 0.16, -0.04, 0.07 * s);
    t.rotation.z = -0.25;
    head.add(t);
    const ear = mesh(new THREE.ConeGeometry(0.05, 0.26, 8), skin, -0.02, 0.08, 0.16 * s);
    ear.rotation.x = s * 1.25;
    ear.rotation.z = 0.35;
    head.add(ear);
  }
  head.add(mesh(blob(0.045, 0.06, 0.045, { seed: 50 }), mat('#1c140c', { roughness: 0.9 }), -0.08, 0.18, 0));

  // The pick, held low in the right hand; it is the "staff" the cast
  // animation raises.
  const pick = new THREE.Group();
  pick.position.set(0.34, 0.6, -0.34);
  pick.add(mesh(tube([[0, -0.2, 0], [0.01, 0.3, 0], [0.02, 0.75, 0]], 0.03, 0.026, 6, 8), wood));
  const headP = mesh(tube([[0.02, 0.7, -0.26], [0.03, 0.8, -0.1], [0.03, 0.82, 0.1], [0.02, 0.72, 0.26]], 0.03, 0.012, 12, 8), iron);
  pick.add(headP, mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 10), leather, 0.02, 0.78, 0));

  body.add(legL, legR, torso, belly, shoulders, kilt, sash, flap, pad, padRim, strap, arm(1, 0), arm(-1, 1), head, pick);
  g.userData = { body, staff: pick, legL, legR, kind: 'hero' };
  return g;
}

registerSkin('peon', (color) => peon(color));
registerSkin('felpeon', (color) => peon(color, { hide: '#9c3426', kiltColor: '#6a5040' }));
