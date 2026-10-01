import { Minigame } from '../../base.js';
import { newId, rand, dist, clampToRect, round2, wc3 } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';
import { noTies } from '../up/e-common.js';

// Ultima-X #76: darkness, a lightning reveal every four seconds, and an
// invulnerable pack that always picks the nearest living marine.
const HW = wc3(656);
const HH = wc3(640);
const PAUSE = 2;
const SPAWN = 4;
const BITE = wc3(90);

export class LostAndFound extends Minigame {
  static id = 'ux-lost';
  static name = 'Lost & Found';
  static desc = 'Flee the growing pack in darkness. Lightning briefly reveals the whole arena.';
  static controls = 'Right-click or use the joystick to flee. Dead marines return as hunters.';
  static duration = 180; // The original has no cap; a cap prevents endless stalemates.
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'night', floor: { shape: 'rect', w: HW * 2, h: HH * 2 },
      props: [...treesAroundRect(HW, HH, 0.14), ...[[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([x, y]) =>
        ({ t: 'torch', x: x * (HW - 1), y: y * (HH - 1) }))], build: ['uxlostlamps'], bounds: HW + 3 };
    this.spawnHeroes(this.pids.map((_, i) => {
      const a = i * Math.PI / 4;
      return [Math.cos(a) * wc3(400), Math.sin(a) * wc3(400)];
    }), { hp: 15, speed: wc3(240), r: wc3(15) });
    for (const u of this.heroes.values()) u.skin = 'uxmarine';
    this.hunters = [];
    this.visionId = newId();
    this.nextSpawn = PAUSE + SPAWN;
    this.revealUntil = 0;
    this.deadAt = new Map();
  }

  command(pid, m) {
    const u = this.heroes.get(pid);
    if (u?.alive) {
      if (this.time >= PAUSE) super.command(pid, m);
      return;
    }
    const hunter = this.hunters.find((h) => h.owner === pid);
    if (hunter && (m.c === 'move' || m.c === 'attack')) hunter.order(+m.x || 0, +m.y || 0);
  }

  spawnHunter(x, y, owner = null) {
    const h = { id: newId(), x, y, owner, tx: x, ty: y, cd: 0, f: 0, botT: 0 };
    h.order = (tx, ty) => { h.tx = tx; h.ty = ty; };
    this.hunters.push(h);
  }

  eliminate(pid, how = 'death') {
    super.eliminate(pid, how);
    this.deadAt.set(pid, this.time + 5);
  }

  tick(dt) {
    if (this.time < PAUSE) return;
    this.stepHeroes(dt);
    for (const [, u] of this.heroes) if (u.alive) clampToRect(u, HW, HH);
    for (const [pid, at] of this.deadAt) {
      if (this.time < at) continue;
      const u = this.heroes.get(pid);
      this.spawnHunter(u.x, u.y, pid);
      this.deadAt.delete(pid);
    }
    if (this.time >= this.nextSpawn) {
      this.nextSpawn += SPAWN;
      this.spawnHunter(rand(-HW, HW), rand(-HH, HH));
      this.revealUntil = this.time + 0.2;
      this.ev({ k: 'uxlostflash' });
      for (const h of this.hunters) this.retarget(h);
    }
    for (const h of this.hunters) {
      h.cd = Math.max(0, h.cd - dt);
      if (h.owner != null && this.bots.has(h.owner)) {
        h.botT -= dt;
        if (h.botT <= 0) {
          h.botT = rand(0.15, 0.3);
          this.retarget(h);
        }
      }
      const dx = h.tx - h.x;
      const dy = h.ty - h.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01) {
        const step = Math.min(d, wc3(150) * dt);
        h.x += dx / d * step;
        h.y += dy / d * step;
        h.f = Math.atan2(dy, dx);
      }
      clampToRect(h, HW, HH);
      if (h.cd > 0) continue;
      for (const [pid, u] of this.heroes) {
        if (!u.alive || dist(h.x, h.y, u.x, u.y) > BITE + u.r) continue;
        this.damage(pid, rand(10.5, 12), 'death');
        h.cd = 5;
        break;
      }
    }
  }

  retarget(h) {
    let best = null;
    let bd = Infinity;
    for (const u of this.heroes.values()) {
      if (!u.alive) continue;
      const d = dist(h.x, h.y, u.x, u.y);
      if (d < bd) { bd = d; best = u; }
    }
    if (best) h.order(best.x, best.y);
  }

  botThink(pid, u, mem) {
    let vx = 0;
    let vy = 0;
    for (const h of this.hunters) {
      const d = dist(u.x, u.y, h.x, h.y);
      if (d < wc3(360)) {
        vx += (u.x - h.x) / Math.max(d * d, 0.2);
        vy += (u.y - h.y) / Math.max(d * d, 0.2);
      }
    }
    if (Math.hypot(vx, vy) > 0.01) u.order(u.x + vx * 30, u.y + vy * 30);
    else if (!u.target || Math.random() < 0.2) u.order(rand(-HW * mem.skill, HW * mem.skill), rand(-HH, HH));
  }

  // Rival locations are hidden outside 250 WC3 units except during lightning.
  heroEnts(pid) {
    const mine = this.heroes.get(pid);
    if (this.time < this.revealUntil || !mine?.alive) return super.heroEnts(pid);
    return super.heroEnts(pid).filter((e) => e.owner === pid || dist(e.x, e.y, mine.x, mine.y) <= wc3(250));
  }

  worldEnts(pid) {
    const mine = this.heroes.get(pid);
    const visible = this.hunters.filter((h) => this.time < this.revealUntil || !mine?.alive || dist(h.x, h.y, mine.x, mine.y) < wc3(250))
      .map((h) => ({ id: h.id, k: 'uxhunter', x: round2(h.x), y: round2(h.y), f: round2(h.f), o: h.owner }));
    visible.push({ id: this.visionId, k: 'uxvision', x: round2(mine?.x || 0), y: round2(mine?.y || 0),
      reveal: this.time < this.revealUntil ? 1 : 0, alive: mine?.alive ? 1 : 0 });
    return visible;
  }

  hud() { return { label: `Marines left: ${this.alive.length} · Hunters: ${this.hunters.length}` }; }
}

noTies(LostAndFound);
