import { Minigame } from '../../base.js';
import { wc3, dist, clamp, round2, rand } from '../../../engine/server/sim.js';

// Ultima-X #70. All Seers share the same appearance and name.
export const STRIKE = { outerX: wc3(560), outerY: wc3(528), innerX: wc3(480), innerY: wc3(448), push: wc3(350), range: wc3(900) };

export class StrikeAndLightGalore extends Minigame {
  static id = 'uxstrike';
  static name = 'Strike and Light Galore';
  static desc = 'Purge and blast anonymous Seers beyond the magical fence. The ring shrinks for the final two.';
  static controls = 'Right-click to move. Q then click a Seer for Chain Lightning; W then click one to Purge.';
  static duration = 120;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'uxpen', floor: { shape: 'rect', w: STRIKE.outerX * 2 + 5, h: STRIKE.outerY * 2 + 5 },
      build: ['uxstrike'], bounds: STRIKE.outerX + 4 };
    const target = (pid, u, x, y) => {
      let best = null;
      for (const [op, v] of this.heroes) {
        if (op !== pid && v.alive && dist(v.x, v.y, x, y) < v.r + 0.9 && dist(u.x, u.y, v.x, v.y) <= STRIKE.range) best = v;
      }
      return best ? { x: best.x, y: best.y, u: best } : null;
    };
    this.abilities = [
      { name: 'Chain Lightning', icon: '⚡', desc: 'Push a Seer 350 WC3 units away.', kind: 'unit', range: STRIKE.range, cd: 5,
        pickTarget: target, cast: (pid, u, t) => {
          const v = t.u;
          if (!v.alive) return;
          const a = Math.atan2(v.y - u.y, v.x - u.x);
          v.x += Math.cos(a) * STRIKE.push;
          v.y += Math.sin(a) * STRIKE.push;
          v.hp = Math.max(1, v.hp - 1);
          this.ev({ k: 'uxlightning', x: round2(u.x), y: round2(u.y), tx: round2(v.x), ty: round2(v.y) });
          this.checkEdges();
        } },
      { name: 'Purge', icon: '🌀', desc: 'Root and slow a Seer for 5 seconds.', kind: 'unit', range: STRIKE.range, cd: 6,
        pickTarget: target, cast: (pid, u, t) => { if (t.u.alive) { t.u.purged = 5; this.ev({ k: 'purge', x: round2(t.u.x), y: round2(t.u.y) }); } } },
    ];
    this.spawnHeroes(this.pids.map((_, i) => {
      const a = i * Math.PI / 4;
      return [Math.cos(a) * wc3(200), Math.sin(a) * wc3(200)];
    }), { hp: 100, speed: wc3(250), r: wc3(10), turnRate: 3, regen: 5 });
    for (const u of this.heroes.values()) u.skin = 'uxseer';
    this.dm = this.pids.length <= 2;
  }

  checkEdges() {
    const hx = this.dm ? STRIKE.innerX : STRIKE.outerX;
    const hy = this.dm ? STRIKE.innerY : STRIKE.outerY;
    for (const [pid, u] of this.heroes) {
      if (u.alive && (Math.abs(u.x) > hx || Math.abs(u.y) > hy)) this.eliminate(pid);
    }
    if (!this.dm && this.alive.length === 2) {
      this.dm = true;
      for (const u of this.heroes.values()) {
        if (!u.alive) continue;
        u.x = clamp(u.x, -STRIKE.innerX + 0.2, STRIKE.innerX - 0.2);
        u.y = clamp(u.y, -STRIKE.innerY + 0.2, STRIKE.innerY - 0.2);
      }
      this.ev({ k: 'uxdeathmatch', x: 0, y: 0 });
    }
  }

  command(pid, m) {
    if (this.time < 5) return;
    super.command(pid, m);
  }

  tick(dt) {
    if (this.time < 5) return;
    for (const u of this.heroes.values()) {
      if (u.purged > 0) {
        u.purged -= dt;
        u.speedMult = u.purged > 4 ? 0 : Math.max(0, 1 - u.purged / 5);
      } else u.speedMult = 1;
    }
    this.stepHeroes(dt);
    this.checkEdges();
  }

  botThink(pid, u, mem) {
    const hx = this.dm ? STRIKE.innerX : STRIKE.outerX;
    const hy = this.dm ? STRIKE.innerY : STRIKE.outerY;
    const foes = [...this.heroes.values()].filter((v) => v.alive && v !== u);
    if (!foes.length) return;
    const v = foes[Math.floor(rand(0, foes.length))];
    if (this.acd.get(pid)[1] <= 0 && Math.random() < mem.skill * 0.22) this.useAbility(pid, 1, v.x, v.y);
    else if (this.acd.get(pid)[0] <= 0 && Math.random() < 0.5) this.useAbility(pid, 0, v.x, v.y);
    else u.order(clamp(u.x + rand(-3, 3), -hx + 1.3, hx - 1.3), clamp(u.y + rand(-3, 3), -hy + 1.3, hy - 1.3));
  }

  hud() { return { label: this.time < 5 ? `Seers ready in ${Math.ceil(5 - this.time)}` : this.dm ? 'DEATH MATCH MODE!' : `Seers left: ${this.alive.length}` }; }
  worldEnts() { return [{ id: 70001, k: 'uxstrikezone', x: 0, y: 0, d: this.dm ? 1 : 0 }]; }
}
