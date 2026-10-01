import { Minigame } from '../../base.js';
import { wc3, round2, rand } from '../../../engine/server/sim.js';

// Ultima-X #73. Shield order, not raw survival time, determines the result.
export const MILTON = { barrelHp: 13, hitInterval: 2, shieldCd: 3 };
const OFFSETS = [[0, 256], [128, 128], [256, 0], [160, -128], [0, -256], [-160, -128], [-256, 0], [-128, 160]];

export class MiltonsMisery extends Minigame {
  static id = 'uxmilton';
  static name = "Milton's Misery";
  static desc = 'Raise your shield as late as you dare, before Milton blows the barrel.';
  static controls = 'Q raises your shield once. Watch the barrel HP: the fatal threshold is hidden.';
  static duration = 80;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'grass', floor: { shape: 'rect', w: wc3(1120), h: wc3(992) }, build: ['uxmilton'], bounds: wc3(700) };
    this.abilities = [{ name: 'Activate Shield', icon: '🛡️', desc: 'Save yourself from the blast. Last to shield wins.', kind: 'instant', cd: MILTON.shieldCd,
      cast: (pid, u) => {
        if (this.time < 7 || this.exploded || u.saved != null) return;
        u.saved = MILTON.barrelHp - this.barrelHp;
        this.ev({ k: 'uxshield', x: round2(u.x), y: round2(u.y), n: u.saved });
      } }];
    this.spawnHeroes(this.pids.map((_, i) => OFFSETS[i].map(wc3)), { hp: 220, speed: 0, r: wc3(16) });
    for (const u of this.heroes.values()) u.skin = 'uxpeasant';
    this.barrelHp = MILTON.barrelHp;
    this.threshold = Math.floor(rand(1, 11));
    this.nextHit = 6.5;
    this.exploded = false;
    this.nextSort = Infinity;
  }

  command(pid, m) {
    if (m.c === 'cast') super.command(pid, m);
  }

  hitBarrel() {
    const before = this.barrelHp;
    this.barrelHp--;
    this.ev({ k: 'uxbarrelhit', x: 0, y: 0, hp: this.barrelHp });
    if (this.time >= 7 && before === this.threshold) this.blast();
  }

  blast() {
    this.exploded = true;
    this.ev({ k: 'boom', x: 0, y: 0, r: 5, s: 'fire', big: true });
    for (const [pid, u] of this.heroes) if (u.alive && u.saved == null) this.eliminate(pid);
    this.nextSort = this.time + 2;
  }

  sortShielders() {
    const live = [...this.heroes].filter(([, u]) => u.alive);
    if (live.length <= 1) { this.done = true; return; }
    const min = Math.min(...live.map(([, u]) => u.saved ?? -1));
    for (const [pid, u] of live) if ((u.saved ?? -1) === min) this.eliminate(pid);
    this.nextSort += 2;
    if (this.alive.length <= 1) this.done = true;
  }

  tick(dt) {
    this.stepHeroes(dt);
    if (!this.exploded && this.time >= this.nextHit) {
      this.hitBarrel();
      this.nextHit += MILTON.hitInterval;
    }
    if (this.exploded && this.time >= this.nextSort) this.sortShielders();
  }

  botThink(pid, u, mem) {
    if (this.time < 7 || this.exploded || u.saved != null) return;
    const hits = MILTON.barrelHp - this.barrelHp;
    // Different risk appetites; even a cautious bot waits for a visible cue.
    mem.desired ??= 1 + Math.floor(Math.random() * 4 + mem.skill * 4);
    const desired = mem.desired;
    if (hits >= desired && this.acd.get(pid)[0] <= 0) this.useAbility(pid, 0, u.x, u.y);
  }

  hud(pid) { const u = this.heroes.get(pid); return { label: `Barrel HP: ${this.barrelHp} ${u?.saved != null ? `· Saved at ${u.saved}` : this.exploded ? '· BOOM!' : '· Shield before it explodes'}` }; }
  worldEnts() { return [{ id: 73001, k: 'uxbarrel', x: 0, y: 0, hp: this.barrelHp, ex: this.exploded ? 1 : 0 }]; }
}
