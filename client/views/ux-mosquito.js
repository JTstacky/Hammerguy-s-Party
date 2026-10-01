import { registerSkin, registerView } from '../../engine/client/render/registry.js';
import { mosquito, ogreMauler } from './ux-creatures.js';

registerSkin('uxmosquito', (c) => mosquito(c));
// The Ogre Mauler crawls after its victim; its club arm sways while it waits.
registerView('uxogre', {
  bake: true,
  make() {
    const g = ogreMauler();
    g.scale.setScalar(1.45);
    return g;
  },
  update(v, a, b, k, dt, world) {
    const arm = v.obj.userData.arm;
    v.t = (v.t || 0) + dt;
    arm.rotation.z = Math.sin(v.t * 1.6) * 0.12;
    v.obj.userData.body.position.y = Math.sin(v.t * 2.2) * 0.03;
  },
});
