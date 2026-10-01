import { Minigame } from '../../base.js';
import { newId, round2, wc3 } from '../../../engine/server/sim.js';

// All three tower games freeze their Shamans. A click is delivered by the
// game's tower overlay or Q; walking orders cannot move the paused unit.
export class TowerDuel extends Minigame {
  static duration = 180;
  static timer = false;
  static ranking = 'survival';

  setup() {
    const east = this.constructor.id === 'uxeast';
    const half = wc3(east ? 768 : 832);
    this.map = {
      theme: east ? 'dirt' : 'stone',
      floor: { shape: 'rect', w: half * 2, h: half * 2 },
      bounds: half + 2,
      build: ['ux6towerarena'],
      props: [],
      follow: false,
    };
    const radius = wc3(east ? 560 : 400);
    this.abilities = [{ name: 'Click Tower', icon: '⚡', desc: 'Select the Arcane Tower.', kind: 'instant', cd: 0, cast: (pid) => this.click(pid) }];
    this.spawnHeroes(this.pids.map((_, i) => {
      const a = 2 * Math.PI * i / this.pids.length + Math.PI / 8;
      return [Math.cos(a) * radius, Math.sin(a) * radius];
    }), { hp: 335, speed: 0, r: wc3(16) });
    for (const u of this.heroes.values()) {
      u.skin = 'uxshaman';
      u.speed = 0;
    }
    this.predict = false;
    this.tower = { id: newId(), x: 0, y: 0 };
    this.clicked = new Set();
  }

  command(pid, m) {
    if (!this.heroes.get(pid)?.alive) return;
    if (m.c === 'uxclick' || m.c === 'cast' || ((m.c === 'move' || m.c === 'attack') && Math.hypot(+m.x || 0, +m.y || 0) < 2)) this.click(pid);
  }

  click() {}

  botThink(pid, u, mem) {
    if (this.shouldBotClick(pid, mem)) this.click(pid);
  }

  stepDuelBots() {
    for (const [pid, bot] of this.bots) {
      const u = this.heroes.get(pid);
      if (u?.alive) this.botThink(pid, u, bot.mem);
    }
  }

  shouldBotClick() { return false; }

  worldEnts() {
    return [{ id: this.tower.id, k: 'ux6tower', x: 0, y: 0, f: 0 }];
  }

  hud(pid) {
    return { label: this.message || 'Click the Arcane Tower', ux6: this.constructor.id, phase: this.phase || '', target: this.target ?? null, clicked: this.clicked.has(pid) ? 1 : 0 };
  }

  strike(pid, message) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return;
    this.eliminate(pid, 'death');
    this.ev({ k: 'ux6lightning', x: round2(u.x), y: round2(u.y) });
    this.ev({ k: 'boom', s: 'fire', x: round2(u.x), y: round2(u.y), r: 1.2, big: 1 });
    this.party.msg(`${this.party.room.nameOf(pid)} ${message}`);
  }
}
