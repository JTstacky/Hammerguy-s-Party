import { TowerDuel } from './ux6-common.js';
import { rand } from '../../../engine/server/sim.js';

// Ultima-X #169: false starts die; last reaction in each round dies.
export class WildWestDuel extends TowerDuel {
  static id = 'uxwest';
  static name = 'Wild West Duel';
  static desc = 'Wait for the buzzer, then click the tower. An early click or the slowest reaction loses.';
  static controls = 'Left-click the tower after the sound, or press Q. Touch: tap the tower button.';
  static duration = 180;

  setup() {
    super.setup();
    this.phase = 'wait';
    this.roundStart = 4;
    this.buzzAt = 4 + rand(4, 9);
    this.endAt = this.buzzAt + 5;
    this.nextAt = this.endAt + 2;
  }

  click(pid) {
    if (this.time < this.roundStart || this.time >= this.endAt || this.clicked.has(pid)) return;
    if (this.time < this.buzzAt) return this.strike(pid, 'clicked too early!');
    const remaining = this.alive.filter((p) => !this.clicked.has(p));
    if (remaining.length <= 1) return this.strike(pid, `was the slowest with a reflex time of ${(this.time - this.buzzAt).toFixed(1)} seconds!`);
    this.clicked.add(pid);
    this.party.msg(`${this.party.room.nameOf(pid)} reacted in ${(this.time - this.buzzAt).toFixed(1)} seconds.`);
  }

  tick() {
    this.stepDuelBots();
    if (this.time >= this.buzzAt && this.phase === 'wait') {
      this.phase = 'go';
      this.ev({ k: 'sfx', s: 'switch' });
      this.ev({ k: 'uxwestbuzzer', x: 0, y: 0 });
      this.ev({ k: 'boom', s: 'fire', x: 0, y: 0, r: 1 });
    }
    if (this.time >= this.endAt && this.phase === 'go') {
      this.phase = 'gap';
      for (const pid of this.alive) if (!this.clicked.has(pid)) this.strike(pid, 'never clicked at all!');
    }
    if (this.time >= this.nextAt && this.alive.length > 1) {
      this.clicked.clear();
      this.roundStart = this.time;
      this.buzzAt = this.time + rand(4, 9);
      this.endAt = this.buzzAt + 5;
      this.nextAt = this.endAt + 2;
      this.phase = 'wait';
    }
  }

  shouldBotClick(pid, mem) {
    if (this.phase !== 'go' || this.clicked.has(pid)) return false;
    return this.time >= this.buzzAt + 0.18 + (1 - mem.skill) * 1.5 + (pid % 3) * 0.08;
  }

  hud(pid) {
    const h = super.hud(pid);
    h.label = this.phase === 'go' ? 'LEFT-CLICK IT NOW!' : this.phase === 'gap' ? 'Next round soon' : 'Wait for the buzzer';
    return h;
  }
}
