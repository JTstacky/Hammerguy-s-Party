// Every pulse starts a new half-second selection window. A small ring makes
// the timing readable even when the sound is off on a phone.
import './ux6-common.js';
import { registerEvent } from '../../engine/client/render/registry.js';

registerEvent('uxclickwindow', (e, world) => {
  world.fx.ring(e.x, e.y, 1.8, '#6bddff', 0.45);
  world.fx.glow(e.x, 3.5, e.y, '#9beaff', 0.8, 0.3);
});
