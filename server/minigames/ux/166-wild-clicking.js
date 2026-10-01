import { TowerDuel } from './ux6-common.js';

// Ultima-X #166: 0.5 s click windows every 0.75 s, starting at t=8.
export class WildClickingDuel extends TowerDuel {
  static id = 'uxclicking';
  static name = 'Wild Clicking Duel';
  static desc = 'Keep clicking the Arcane Tower. Miss any half-second window and your Shaman is out.';
  static controls = 'Left-click the tower repeatedly or press Q. Touch: tap the tower button.';
  static duration = 120;

  setup() {
    super.setup();
    this.phase = 'wait';
    this.window = -1;
  }

  click(pid) {
    if (this.time < 8 || !this.heroes.get(pid)?.alive) return;
    const cycle = Math.floor((this.time - 8) / 0.75);
    const within = (this.time - 8) - cycle * 0.75;
    if (within < 0.5) this.clicked.add(pid);
  }

  tick() {
    this.stepDuelBots();
    if (this.time < 8) {
      this.phase = this.time >= 4 ? 'ready' : 'wait';
      return;
    }
    this.phase = 'click';
    const cycle = Math.floor((this.time - 8) / 0.75);
    if (cycle > this.window) {
      if (this.window >= 0) for (const pid of this.alive) if (!this.clicked.has(pid)) this.strike(pid, 'got tired and is taking a break.');
      this.clicked.clear();
      this.window = cycle;
      this.ev({ k: 'uxclickwindow', x: 0, y: 0 });
    }
    const within = (this.time - 8) - cycle * 0.75;
    if (within >= 0.5 && this.phase !== 'gap') {
      this.phase = 'gap';
      for (const pid of this.alive) if (!this.clicked.has(pid)) this.strike(pid, 'got tired and is taking a break.');
    }
  }

  shouldBotClick(pid, mem) {
    if (this.time < 8 || this.clicked.has(pid)) return false;
    const cycle = Math.floor((this.time - 8) / 0.75);
    if (mem.cycle !== cycle) {
      mem.cycle = cycle;
      mem.willClick = Math.random() < 0.87 + mem.skill * 0.12;
      mem.delay = 0.08 + (1 - mem.skill) * 0.18 + (pid % 3) * 0.02;
    }
    const within = (this.time - 8) - cycle * 0.75;
    return mem.willClick && within >= mem.delay && within < 0.5;
  }

  hud(pid) {
    const h = super.hud(pid);
    h.label = this.time < 4 ? 'Get ready' : this.time < 8 ? 'Start clicking the tower now!' : 'Keep clicking every window!';
    return h;
  }
}
