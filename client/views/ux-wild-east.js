// Wild East opens with the tower's chimes. The Shamans stay frozen while
// players count the shown number of seconds from this visual cue.
import './ux6-common.js';
import { registerEvent } from '../../engine/client/render/registry.js';

registerEvent('uxeastbegin', (e, world) => {
  world.fx.flash(e.x, e.y, 2.4, '#b7e7ff', 0.5);
  world.fx.ring(e.x, e.y, 3.6, '#f6ca62', 0.8);
  world.fx.sparks(e.x, 3.4, e.y, 18, 3, '#aeeeff');
  world.shake = Math.max(world.shake, 0.18);
});
