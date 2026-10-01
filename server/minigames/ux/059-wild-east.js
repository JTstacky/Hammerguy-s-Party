import { TowerDuel } from './ux6-common.js';
import { rand, round2 } from '../../../engine/server/sim.js';

// Ultima-X #59: the tower accepts premature selections from t=4.
export class WildEastDuel extends TowerDuel {
  static id = 'uxeast';
  static name = 'Wild East Duel';
  static desc = 'Count the announced seconds from BEGIN, then click the tower. The smallest timing error wins.';
  static controls = 'Left-click the tower or press Q. Click after the announced seconds pass from BEGIN.';
  static duration = 90;

  setup() {
    super.setup();
    this.target = Math.floor(rand(4, 11));
    this.errors = new Map();
    this.sortAt = 25;
    this.phase = 'wait';
  }

  click(pid) {
    if (this.time < 4 || this.time >= 23 || this.clicked.has(pid)) return;
    const elapsed = Math.max(0, this.time - 8);
    const error = Math.abs(elapsed - this.target);
    this.clicked.add(pid);
    this.errors.set(pid, error);
    const sign = elapsed >= this.target ? '+' : '-';
    const result = `Stopped at ${elapsed.toFixed(2)}  ${sign}${error.toFixed(2)}`;
    const u = this.heroes.get(pid);
    this.ev({ k: 'txt', x: round2(u.x), y: round2(u.y), s: result, c: '#ffe3a1' });
    this.party.msg(`${this.party.room.nameOf(pid)} ${result}`);
  }

  tick(dt) {
    this.stepDuelBots();
    if (this.time >= 4 && this.phase === 'wait') this.phase = 'preview';
    if (this.time >= 8 && this.phase === 'preview') {
      this.phase = 'begin';
      this.ev({ k: 'sfx', s: 'switch' });
      this.ev({ k: 'uxeastbegin', x: 0, y: 0 });
    }
    if (this.time >= 23 && this.phase === 'begin') {
      this.phase = 'sort';
      for (const pid of this.alive) if (!this.clicked.has(pid)) this.strike(pid, 'never clicked at all!');
    }
    if (this.phase === 'sort' && this.time >= this.sortAt) {
      this.sortAt += 3;
      const living = this.alive;
      if (living.length) {
        const worst = Math.max(...living.map((pid) => this.errors.get(pid)));
        for (const pid of living) if (this.errors.get(pid) === worst) this.strike(pid, `had a margin error of ${worst.toFixed(2)}`);
      }
    }
  }

  shouldBotClick(pid, mem) {
    if (this.clicked.has(pid) || this.time < 8) return false;
    const offset = (1 - mem.skill) * 2.2 + ((pid * 17) % 7) * 0.09 - 0.65;
    return this.time >= 8 + this.target + offset;
  }

  hud(pid) {
    const h = super.hud(pid);
    h.label = this.phase === 'begin' ? `BEGIN · ${this.target} seconds` : this.phase === 'preview' ? `Click after ${this.target} seconds from BEGIN` : this.phase === 'sort' ? 'Comparing timing errors' : 'Get ready to count';
    return h;
  }
}
