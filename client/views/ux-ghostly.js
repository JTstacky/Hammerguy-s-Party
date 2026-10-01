import { registerSkin,registerView,registerEvent } from '../../engine/client/render/registry.js';
import { banshee } from './ux-creatures.js';
registerSkin('uxghost', (c) => banshee(c));
// Forty neutral banshees: baked per material; the view bobs the whole model.
registerView('uxneutralghost', {
  bake: true,
  make() { return banshee(null, true); },
  update(v, a, b, k, dt, world) {
    v.t ??= Math.random() * 10;
    v.obj.position.y = Math.sin(world.time * 2.2 + v.t) * 0.08;
  },
});
registerEvent('uxpossess',(e,w)=>{w.fx.glow(e.x1,1,e.y1,'#84baff',1.3,0.5);w.fx.glow(e.x2,1,e.y2,'#b3f4ff',1.7,0.6);});
