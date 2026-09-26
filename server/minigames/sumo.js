import { Minigame } from '../base.js';
import { newId, rand, dist } from '../../engine/server/sim.js';

const R0 = 10;
const RMIN = 4.5;

// An icy platform over the sea. Shove everyone else into the water.
export class IceSumo extends Minigame {
  static id = 'sumo';
  static name = 'Ice Sumo';
  static desc = 'A shrinking ice floe over freezing water. Shove your rivals off — last one standing wins.';
  static controls = 'Right-click to move. Q: Hammer Shove (strong knockback).';
  static duration = 60;
  static ranking = 'survival';

  setup() {
    this.R = R0;
    this.map = { theme: 'ice', floor: { shape: 'disc', r: R0 }, dynamicFloor: true, props: [], bounds: R0 + 8 };
    this.spawnHeroes(this.ringPositions(R0 * 0.6));
    this.shove = { cd: 2.2, radius: 2.8, force: 14 };
    this.shoveName = 'Hammer Shove';
    this.friction = 1.3;
    this.floorId = newId();
  }

  tick(dt) {
    if (this.time > 8) this.R = Math.max(RMIN, this.R - dt * 0.15);
    this.stepHeroes(dt);
    for (const [pid, u] of this.heroes) {
      if (u.alive && Math.hypot(u.x, u.y) > this.R + 0.2) this.eliminate(pid, 'splash');
    }
  }

  botThink(pid, u, mem) {
    const d0 = Math.hypot(u.x, u.y);
    if (d0 > this.R - 2) {
      u.order(-u.x * 0.3, -u.y * 0.3);
      return;
    }
    let target = null;
    let td = Infinity;
    for (const [op, v] of this.heroes) {
      if (op === pid || !v.alive) continue;
      const d = dist(u.x, u.y, v.x, v.y);
      if (d < td) {
        td = d;
        target = v;
      }
    }
    if (!target) return;
    // Approach from the centre side so the shove pushes them outward.
    const tl = Math.hypot(target.x, target.y) || 1;
    u.order(target.x - (target.x / tl) * 1.5 + rand(-0.5, 0.5), target.y - (target.y / tl) * 1.5 + rand(-0.5, 0.5));
    if (td < 2.4 && Math.random() < 0.6) this.doShove(pid);
  }

  worldEnts() {
    return [{ id: this.floorId, k: 'floor', r: Math.round(this.R * 100) / 100, x: 0, y: 0 }];
  }
}
