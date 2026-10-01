import { MortarMayhem } from '../mortar.js';
import { rand, wc3 } from '../../../engine/server/sim.js';

// Ultima-X #163 reverses Peon Pandemonium: death is the finish line.
export class SickPeonPandemonium extends MortarMayhem {
  static id = 'uxsickpeon';
  static name = 'Sick Peon Pandemonium';
  static desc = 'Run into the catapult impacts. The first peon to die takes first place.';
  static controls = 'Right-click to move into falling rocks. Death finishes your race.';
  static duration = 300;
  static timer = false;
  static ranking = 'race';

  get peonSkin() { return 'uxsickpeon'; }

  setup() {
    super.setup();
    for (const u of this.heroes.values()) {
      u.hp = u.maxHp = 150;
      u.speed = wc3(190);
    }
    // The stock spawn trigger enables at t=6, fires every 8 s, then waits
    // another random 0-2 s before creating the first catapult.
    this.spawnT = 14 + rand(0, 2);
    this.fireT = 8;
    this.map.theme = 'night';
  }

  damage(pid, amount, how = 'death') {
    const u = this.heroes.get(pid);
    if (!u?.alive) return;
    u.hp -= amount;
    if (u.hp <= 0) {
      u.hp = 0;
      this.finish(pid);
      u.alive = false;
      this.ev({ k: how, x: u.x, y: u.y, u: u.id });
    }
  }

  botThink(pid, u, mem) {
    let target = null;
    let d = Infinity;
    for (const r of this.rocks) {
      const z = Math.hypot(u.x - r.x, u.y - r.y);
      if (z < d && r.flight - r.t > 0.3) { d = z; target = r; }
    }
    if (target && Math.random() < mem.skill) u.order(target.x, target.y);
    else if (!u.target) u.order((Math.random() - 0.5) * wc3(500), (Math.random() - 0.5) * wc3(500));
  }

  isDone() { return this.finishOrder.length >= this.pids.length || super.isDone(); }
}
