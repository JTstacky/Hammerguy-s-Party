import { WayOfTheBow } from '../up/06-bow.js';
import { newId, round2, wc3 } from '../../../engine/server/sim.js';

// Ultima-X #161 shares Way of the Bow's arena and archer, but the arrows
// home at 900 WC3 u/s and every living player sees drunken camera effects.
export class DrinkAndBow extends WayOfTheBow {
  static id = 'ux-drinkbow';
  static name = 'Drink and Bow';
  static desc = 'A one-arrow archer duel under dizzying camera wobble and colour flashes.';
  static controls = 'Right-click to move; right-click or tap a rival to fire. Q-R are unused.';
  static duration = 160;

  setup() {
    super.setup();
    this.attack.missile = wc3(900);
    this.attack.dmg = 17;
    this.fxId = newId();
    this.tintSeed = Math.random();
    this.map.build = [...(this.map.build || []), 'uxdrunkglade'];
  }

  // Homing missile damage is greater than the archer's five HP even after
  // the original medium-armour 75 percent multiplier.
  attackHit(pid, u, tgt) {
    if (tgt?.alive) this.damage(tgt.owner, 17 * 0.75);
  }

  worldEnts(pid) {
    return [{ id: this.fxId, k: 'uxdrunkfx', x: 0, y: 0,
      a: this.heroes.get(pid)?.alive ? 1 : 0,
      t: round2(this.time), c: round2(this.tintSeed) }];
  }
}
