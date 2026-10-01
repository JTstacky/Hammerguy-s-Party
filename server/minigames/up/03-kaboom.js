import { Minigame } from '../../base.js';
import { newId, rand, dist, round2, wc3, clamp } from '../../../engine/server/sim.js';
import { clampOct, inOct, pushOutSquare } from './creeps-and-walls.js';

// Uther Party 4.0 #3 "The Kaboom Room" (docs/uther-party/rules-4.0.md): an
// octagonal 1408x1408 room with four pillars 384 u from the centre. Players
// are 25 HP goblin sappers. Fire wisps fly out of the centre at 350 u/s in
// random directions; at 800 u they are put back in the middle and sent out
// again. Each burns everyone within 220 for 10 a second (Permanent
// Immolation). From t=5 the centre burns for 10 HP a second within 128 u,
// and one more fire arrives every 10 s (after a 0-2 s wait) up to 10. A dying
// sapper explodes: 700 within 150 and 300 within 250 to every sapper, so
// deaths chain. Deaths in the same instant tie. No timer.
//
// Ranges of trigger enumerations (the centre flame) are to unit centres;
// ability areas (Immolation, Death Damage) include the victim's collision
// size, as measured for splash in engine.md.
const A = wc3(704); // half-size of the room
const D = wc3(1040); // the cut corners: |x| + |y| <= 1040
const SPAWN_R = wc3(600);
const PILLARS = [[0, 384], [0, -384], [384, 0], [-384, 0]].map(([x, y]) => [wc3(x), wc3(y)]);
const PILLAR_H = wc3(64);
const FIRE_SPEED = wc3(350);
const FIRE_OUT = wc3(900);
const FIRE_RESET = wc3(800);
const IMMO_R = wc3(220);
const IMMO_DMG = 10;
const CENTRE_R = wc3(128);
const CENTRE_DMG = 10;
const MAX_FIRES = 10;
const BLAST = [[wc3(150), 700], [wc3(250), 300]];
const LIGHT_T = 5;

export class KaboomRoom extends Minigame {
  static id = 'kaboom';
  static name = 'The Kaboom Room';
  static desc = 'Fire wisps shoot out of the burning centre in random directions and scorch everyone near their path. You are a fragile goblin sapper: when one dies it explodes and takes its neighbours with it. Survive as long as possible!';
  static controls = 'Right-click to move. You have 25 HP. Fires burn 10 a second within 220; the middle burns too. Keep clear of weakened sappers!';
  static duration = 300;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'undercroft', floor: { shape: 'disc', r: wc3(760) }, props: [], build: ['kaboom'], bounds: A + 1, room: { a: round2(A), d: round2(D), p: PILLARS.map(([x, y]) => [round2(x), round2(y)]), ph: round2(PILLAR_H) } };
    // Goblin Sapper: HP 25, regen 0.25/s, speed 270, collision 32, 600 u from the centre at a random angle.
    this.spawnHeroes(
      this.pids.map(() => {
        const a = rand(0, Math.PI * 2);
        return [Math.cos(a) * SPAWN_R, Math.sin(a) * SPAWN_R];
      }),
      { hp: 25, regen: 0.25, r: wc3(32) },
    );
    for (const u of this.heroes.values()) u.skin = 'goblinsapper';
    this.fires = [];
    this.lit = false;
    // Periodic timers tick from map load: the first tick after enabling lands 0-P s later.
    this.spawnT = rand(0, 10); // counted from t=5
    this.pendingFire = [];
    this.centreT = rand(0, 1);
    this.resetT = 0;
    this.blasts = [];
    this.centreId = newId();
  }

  tick(dt) {
    if (!this.lit && this.time >= LIGHT_T) {
      this.lit = true;
      this.ev({ k: 'sfx', s: 'boom' });
    }
    if (this.lit) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT += 10;
        if (this.fires.length + this.pendingFire.length < MAX_FIRES) this.pendingFire.push(rand(0, 2));
      }
      this.pendingFire = this.pendingFire.map((t) => t - dt);
      while (this.pendingFire.length && this.pendingFire[0] <= 0) {
        this.pendingFire.shift();
        this.addFire();
      }
      this.centreT -= dt;
      if (this.centreT <= 0) {
        this.centreT += 1;
        for (const [pid, u] of this.heroes) if (u.alive && Math.hypot(u.x, u.y) <= CENTRE_R) this.damage(pid, CENTRE_DMG, 'kaboom');
      }
    }

    // Fires fly straight out; "Kaboom Reset Base" (every 0.05 s) sends any at 800+ back to the centre.
    for (const f of this.fires) {
      const step = Math.min(FIRE_SPEED * dt, Math.max(0, f.go));
      f.x += Math.cos(f.a) * step;
      f.y += Math.sin(f.a) * step;
      f.go -= step;
    }
    this.resetT -= dt;
    while (this.resetT <= 0) {
      this.resetT += 0.05;
      for (const f of this.fires) if (Math.hypot(f.x, f.y) >= FIRE_RESET) this.sendOut(f);
    }
    // Permanent Immolation: each fire burns on its own 1 s clock.
    for (const f of this.fires) {
      f.immo -= dt;
      if (f.immo > 0) continue;
      f.immo += 1;
      for (const [pid, u] of this.heroes) if (u.alive && dist(u.x, u.y, f.x, f.y) <= IMMO_R + u.r) this.damage(pid, IMMO_DMG, 'kaboom');
    }

    this.stepHeroes(dt);
    for (const [, u] of this.heroes) {
      if (!u.alive) continue;
      for (const [x, y] of PILLARS) pushOutSquare(u, x, y, PILLAR_H);
      clampOct(u, A, D);
    }
  }

  addFire() {
    const f = { id: newId(), x: 0, y: 0, a: 0, go: 0, immo: 1 };
    this.sendOut(f);
    this.fires.push(f);
    this.ev({ k: 'kfire', x: 0, y: 0 });
  }

  sendOut(f) {
    f.x = 0;
    f.y = 0;
    f.a = rand(-Math.PI, Math.PI);
    f.go = FIRE_OUT;
    f.jump = (f.jump || 0) + 1; // lets the client snap instead of sliding back
  }

  // Death Damage: every sapper that dies blows up. Chained deaths happen in the
  // same instant, so they tie.
  eliminate(pid, how = 'kaboom') {
    const u = this.heroes.get(pid);
    if (!u?.alive) return;
    super.eliminate(pid, 'kaboom');
    this.blasts.push(u);
    if (this.blasting) return;
    this.blasting = true;
    while (this.blasts.length) {
      const b = this.blasts.shift();
      for (const [op, v] of this.heroes) {
        if (!v.alive) continue;
        const d = dist(b.x, b.y, v.x, v.y) - v.r;
        const tier = BLAST.find(([r]) => d <= r);
        if (tier) this.damage(op, tier[1], 'kaboom');
      }
    }
    this.blasting = false;
    void how;
  }

  // Bots follow the original: every 2 s walk 200-500 u away from the centre
  // (±120°). Better bots also step out of the path of fires coming their way
  // and keep off the burning middle.
  botThink(pid, u, mem) {
    mem.wander = (mem.wander ?? rand(0, 2)) - 0.22;
    const danger = this.threat(u.x, u.y, 0.6);
    if (danger && Math.random() < mem.skill) {
      const best = this.safest(u, mem);
      if (best) {
        u.order(best[0], best[1]);
        mem.wander = 1.2;
        return;
      }
    }
    if (mem.wander <= 0) {
      mem.wander = 2;
      const a = Math.atan2(u.y, u.x) + (rand(-120, 120) * Math.PI) / 180;
      const r = wc3(rand(200, 500));
      const x = clamp(u.x + Math.cos(a) * r, -A + 1, A - 1);
      const y = clamp(u.y + Math.sin(a) * r, -A + 1, A - 1);
      if (Math.random() > mem.skill || !this.threat(x, y, 0.4)) u.order(x, y);
    }
  }

  // How dangerous a spot is over the next second: fires whose path passes
  // near it, the centre flame, and weakened sappers that may explode.
  threat(x, y, margin) {
    if (this.lit && Math.hypot(x, y) < CENTRE_R + 1) return 3;
    let t = 0;
    for (const f of this.fires) {
      for (let s = 0; s <= 1.2; s += 0.2) {
        const left = Math.min(f.go, FIRE_SPEED * s);
        const fx = f.x + Math.cos(f.a) * left;
        const fy = f.y + Math.sin(f.a) * left;
        if (dist(x, y, fx, fy) < IMMO_R + wc3(32) + margin) {
          t += 1.2 - s;
          break;
        }
      }
      // A fire about to reset starts again from the centre.
      if (f.go < FIRE_SPEED * 0.6 && Math.hypot(x, y) < wc3(350)) t += 0.5;
    }
    for (const [, v] of this.heroes) if (v.alive && v.hp < 12 && dist(x, y, v.x, v.y) < wc3(260) + margin && !(v.x === x && v.y === y)) t += 0.4;
    return t;
  }

  safest(u, mem) {
    let best = null;
    let bs = this.threat(u.x, u.y, 0.3);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      for (const r of [1.5, 3, 4.5]) {
        const x = u.x + Math.cos(a) * r;
        const y = u.y + Math.sin(a) * r;
        if (!inOct(x, y, A, D, 0.8)) continue;
        const s = this.threat(x, y, 0.3) + r * 0.05 + (mem.skill < 0.6 ? Math.random() * 0.5 : 0);
        if (s < bs) {
          bs = s;
          best = [x, y];
        }
      }
    }
    return best;
  }

  hud() {
    return { label: this.lit ? `Fires: ${this.fires.length}` : 'The centre ignites soon...' };
  }

  worldEnts() {
    const ents = this.fires.map((f) => ({ id: f.id, k: 'kfire', x: round2(f.x), y: round2(f.y), f: round2(f.a), j: f.jump }));
    ents.push({ id: this.centreId, k: 'kcentre', x: 0, y: 0, on: this.lit ? 1 : 0, r: round2(CENTRE_R) });
    return ents;
  }
}

export const KABOOM = { A, D, PILLARS, PILLAR_H, FIRE_SPEED, FIRE_RESET, IMMO_R, CENTRE_R, BLAST };
