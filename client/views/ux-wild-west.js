// Wild West gives a sharp tower flash as the reaction cue. The server's
// switch sound is paired with a visible signal for muted devices.
import './ux6-common.js';
import { registerEvent } from '../../engine/client/render/registry.js';

registerEvent('uxwestbuzzer', (e, world) => {
  world.fx.flash(e.x, e.y, 3.4, '#fff0a0', 0.5);
  world.fx.ring(e.x, e.y, 4.5, '#f8ba42', 0.5);
  world.fx.sparks(e.x, 3.7, e.y, 24, 4, '#fff4ca');
  world.shake = Math.max(world.shake, 0.3);
});
