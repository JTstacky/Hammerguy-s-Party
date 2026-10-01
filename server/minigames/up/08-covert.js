import { newId, rand, dist, round1, round2, wc3, collideUnits, stepUnits, pick } from '../../../engine/server/sim.js';
import { WalkGrid, GridRace, toServer, rectFromWc3, randIn, creep, meleeStep, creepSnap, pathTo, followPath } from './walkgrid.js';
import { treesAroundRect } from '../props.js';

// Uther Party 4.0 #8 "Covert Kitty" (docs/uther-party/rules-4.0.md): a
// 2176x1152 night meadow broken up by Summer Tree Walls. Huntresses (55 HP,
// armor 2, speed 270, collision 31) run from the west pen to a gap in the east
// treeline. Three Doom Guards (speed 270, collision 48) attack-move to a
// random point every 7 s and engage any visible huntress within 600; two hits
// (35-42 chaos, about 31-37 after armor) kill. Every 2 s each guard tries to
// Cripple a random visible huntress within 400 (175 of its 500 mana, regen
// 1.25/s, cooldown 10 s): -75 % move speed for 30 s. Shadowmeld hides a
// huntress who stands still for 1.5 s, but only at night: the clock starts at
// 01:00, one game hour is 20 s, dawn at 06:00 (100 s) ends it.
//
// The original has no timer: the game ends when every huntress has finished
// or died. As the sheet's remake notes suggest, a hard cap is added: 150 s (dawn plus 50 s).
const CX = 3648;
const CY = -832;
const conv = toServer(CX, CY);
export const LAYOUT = [
  '...........AB....B#',
  '............B....B#',
  '..B..BBBBB..B..B.B#',
  '..B............B...',
  '..B............B...',
  '..B............B...',
  '...BBBB..B..BBB..B#',
  '.........B.......B#',
  '.........B.......B#',
];
const CELL = wc3(128);
export const HUNTRESS = { speed: wc3(270), r: wc3(31), hp: 55 };
export const ARMOR = 1 - (0.06 * 2) / (1 + 0.06 * 2);
export const GUARD = { speed: wc3(270), r: wc3(48), hp: 1350 };
export const GUARD_ATTACK = { range: wc3(128), cd: 1.35, point: 0.5 };
export const ACQUIRE = wc3(600);
export const CRIPPLE = { cost: 175, cd: 10, range: wc3(400), dur: 30, slow: 0.25, point: 0.3 };
export const MANA = 500;
export const REGEN = 1.25;
export const MELD_FADE = 1.5;
export const DAWN = 100;
export const SIGHT_NIGHT = wc3(800);
export const SIGHT_DAY = wc3(1800);
export const FREEZE = 120;
const HOUR = 20;
// Skilled bots hide while a free guard is (or in 1 s will be) within 1000,
// or one busy with someone else is within 450.
const BOT_NEAR = wc3(1000);
const BOT_BUSY = wc3(450);

export class CovertKitty extends GridRace {
  static id = 'covert';
  static name = 'Covert Kitty';
  static desc = 'Elude the Doom Guards! Sneak across the moonlit meadow to the gap in the far treeline. Stand still to Shadowmeld and vanish, but only until dawn. The guards are as fast as you, and their Cripple slows you to a crawl.';
  static controls = 'Right-click to move. Q: Shadowmeld (stand still for 1.5 s to turn invisible; night only, moving ends it).';
  static duration = 150;
  static timer = false;
  static ranking = 'race';

  setup() {
    const [x0, y0] = conv(2560, -256);
    this.grid = new WalkGrid(LAYOUT, { cell: CELL, x0, y0, blocked: 'B#' });
    const HW = wc3(1344);
    const HH = wc3(576);
    const deco = [];
    LAYOUT.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === 'A') {
        const [x, y] = this.grid.centerOf(c, r);
        deco.push({ t: 'rock', x, y, s: 0.55 }, { t: 'bush', x: x + 0.6, y: y + 0.4, s: 0.7 });
      }
    }));
    this.map = {
      theme: 'night',
      floor: { shape: 'rect', w: HW * 2, h: HH * 2 },
      props: [...treesAroundRect(HW, HH, 0.5, 1.7).filter((p) => !(p.x > HW - 1 && Math.abs(p.y) < wc3(260))), ...deco],
      bounds: HW,
      build: ['upmaze'],
      maze: this.grid.snap({ style: 'trees' }),
    };
    this.finishRect = rectFromWc3(conv, 4736, -1024, 4992, -640);
    this.goal = { x: (this.finishRect.x0 + this.finishRect.x1) / 2, y: 0 };
    this.abilities = [
      {
        name: 'Shadowmeld',
        icon: '🌙',
        desc: 'Stand still for 1.5 s to turn invisible until you move. Night only (dawn comes at 06:00).',
        kind: 'instant',
        cd: 0,
        available: () => this.time < DAWN,
        cast: (pid, u) => this.meld(u),
      },
    ];
    const st = rectFromWc3(conv, 2560, -1088, 2816, -576);
    const m = HUNTRESS.r;
    this.spawnHeroes(this.pids.map(() => randIn({ x0: st.x0 + m, x1: st.x1 - m, y0: st.y0 + m, y1: st.y1 - m })), { ...HUNTRESS, facing: 0 });
    for (const u of this.heroes.values()) u.skin = 'huntress';
    this.guards = [3520, 3904, 4288].map((X) => {
      const [x, y] = conv(X, CY);
      const g = creep('doomguard', x, y, { ...GUARD, facing: Math.PI });
      g.mana = MANA;
      g.crippleCd = 0;
      g.dest = null;
      g.victim = null;
      g.casting = null;
      g.repath = 0;
      return g;
    });
    // Patrol starts at 2 s; its periodic timer runs from map init, so the
    // first tick lands 0-7 s after that.
    this.patrolT = 2 + rand(0, 7);
    this.crippleT = rand(0, 2);
    this.skyId = newId();
    this.circleId = newId();
  }

  // Time of day in hours: 01:00 at the start, 20 s per hour, frozen at 07:00.
  get hours() {
    return 1 + Math.min(this.time, FREEZE) / HOUR;
  }

  meld(u) {
    if (this.time >= DAWN || !u.alive) return;
    u.stop();
    u.path = null;
    u.meld = { t: 0 };
    this.ev({ k: 'meld', u: u.id, x: round1(u.x), y: round1(u.y) });
  }

  hidden(u) {
    return !!(u.meld && u.meld.t >= MELD_FADE && this.time < DAWN);
  }

  tick(dt) {
    // Shadowmeld: any movement breaks it; dawn ends it.
    for (const u of this.heroes.values()) {
      if (!u.meld) continue;
      if (!u.alive || u.finished || u.target || u.walking || this.time >= DAWN) u.meld = null;
      else u.meld.t += dt;
    }
    if (this.time >= DAWN && !this.dawned) {
      this.dawned = true;
      this.ev({ k: 'sfx', s: 'intro' });
      this.party.msg('Dawn breaks. Shadowmeld no longer works!');
    }
    if (this.time >= 2) {
      this.patrolT -= dt;
      if (this.patrolT <= 0) {
        this.patrolT += 7;
        for (const g of this.guards) this.attackMove(g);
      }
    }
    this.crippleT -= dt;
    if (this.crippleT <= 0) {
      this.crippleT += 2;
      for (const g of this.guards) this.tryCripple(g);
    }
    for (const u of this.heroes.values()) {
      if (u.crippled > 0) {
        u.crippled -= dt;
        u.speedMult = u.crippled > 0 ? CRIPPLE.slow : 1;
      }
    }
    this.stepRace(dt);
    this.stepGuards(dt);
    const all = [...this.heroes.values(), ...this.guards];
    collideUnits(all.filter((u) => !u.finished));
    for (const u of all) if (u.alive && !u.finished) this.grid.push(u);
    for (const [pid, u] of this.heroes) if (u.alive && !u.finished && this.inRect(u, this.finishRect)) this.finish(pid);
  }

  // Trees block sight in WC3. A huntress is visible to the guards (shared
  // vision) when one of them has a clear line to her within sight range.
  visibleHuntresses() {
    if (this.visT === this.time) return this.visList;
    const sight = this.time < DAWN ? SIGHT_NIGHT : SIGHT_DAY;
    this.visT = this.time;
    this.visList = [...this.heroes.values()].filter((u) => u.alive && !u.finished && !this.hidden(u) && this.guards.some((g) => dist(g.x, g.y, u.x, u.y) <= sight && this.los(g.x, g.y, u.x, u.y)));
    return this.visList;
  }

  // Line of sight: no tree or cliff cell on the segment.
  los(ax, ay, bx, by) {
    const G = this.grid;
    const d = Math.hypot(bx - ax, by - ay);
    const n = Math.ceil(d / (G.s * 0.25));
    for (let i = 1; i < n; i++) {
      const [c, r] = G.cellOf(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n);
      if (G.inside(c, r) && G.blocked(c, r)) return false;
    }
    return true;
  }

  attackMove(g) {
    const [x, y] = this.grid.nearestFit(rand(-wc3(1088), wc3(1088)), rand(-wc3(576), wc3(576)), g.r);
    g.dest = { x, y };
    // A new order replaces the chase; the guard re-acquires on the way (the
    // nearest visible huntress within 600, possibly the same one).
    if (!g.casting && !g.swing) {
      g.victim = null;
      pathTo(g, this.grid, x, y);
    }
  }

  // "Covert Cripple": order a Cripple on a random visible huntress within 400.
  tryCripple(g) {
    if (g.casting || g.crippleCd > 0 || g.mana < CRIPPLE.cost) return;
    const near = this.visibleHuntresses().filter((u) => dist(u.x, u.y, g.x, g.y) <= CRIPPLE.range);
    if (!near.length) return;
    const v = pick(near);
    // The cast order replaces whatever the guard was doing.
    g.casting = { tgt: v, t: 0 };
    g.victim = null;
    g.swing = null;
    g.path = null;
    g.stop();
    g.faceTo = Math.atan2(v.y - g.y, v.x - g.x);
  }

  stepGuards(dt) {
    for (const g of this.guards) {
      g.mana = Math.min(MANA, g.mana + REGEN * dt);
      if (g.crippleCd > 0) g.crippleCd -= dt;
      if (g.atkCd > 0) g.atkCd -= dt;
      if (g.casting) {
        const c = g.casting;
        const v = c.tgt;
        if (!v.alive || v.finished || this.hidden(v)) {
          g.casting = null;
          g.faceTo = null;
        } else {
          const ang = Math.atan2(v.y - g.y, v.x - g.x);
          g.faceTo = ang;
          if (Math.abs(Math.atan2(Math.sin(ang - g.heading), Math.cos(ang - g.heading))) < 0.1) c.t += dt;
          if (c.t >= CRIPPLE.point) {
            g.casting = null;
            g.faceTo = null;
            g.mana -= CRIPPLE.cost;
            g.crippleCd = CRIPPLE.cd;
            v.crippled = CRIPPLE.dur;
            v.speedMult = CRIPPLE.slow;
            this.ev({ k: 'cripple', x1: round1(g.x), y1: round1(g.y), x2: round1(v.x), y2: round1(v.y), u: v.id });
            // Idle after the cast: it acquires the nearest huntress in range below.
          }
        }
      }
      if (!g.casting) {
        // Engage the nearest visible huntress within acquisition range.
        if (g.victim && (!g.victim.alive || g.victim.finished || this.hidden(g.victim))) g.victim = null;
        if (!g.victim && !g.swing) {
          let bd = Infinity;
          for (const u of this.visibleHuntresses()) {
            const d = dist(u.x, u.y, g.x, g.y);
            if (d <= ACQUIRE && d < bd) {
              bd = d;
              g.victim = u;
            }
          }
          if (g.victim) {
            g.path = null;
            g.repath = 0;
          }
        }
        if (g.victim || g.swing) {
          const res = meleeStep(this, g, g.victim, dt, GUARD_ATTACK, (t) => this.strike(g, t), false);
          if (res === 'idle' && g.victim) {
            g.repath -= dt;
            if (g.repath <= 0 || !g.path) {
              g.repath = 0.3;
              pathTo(g, this.grid, g.victim.x, g.victim.y);
            }
          } else if (res === 'idle' && !g.victim && g.dest) pathTo(g, this.grid, g.dest.x, g.dest.y);
        } else if (g.dest && !g.target && !g.path) {
          if (dist(g.x, g.y, g.dest.x, g.dest.y) < 0.5) g.dest = null;
          else pathTo(g, this.grid, g.dest.x, g.dest.y);
        }
      }
      followPath(g, this.grid);
    }
    stepUnits(this.guards, dt);
  }

  strike(g, u) {
    const dmg = (35 + Math.floor(Math.random() * 8)) * ARMOR;
    this.ev({ k: 'hit', x: round2(u.x), y: round2(u.y) });
    this.ev({ k: 'felhit', x: round2(u.x), y: round2(u.y) });
    this.damage(u.owner, dmg, 'death');
  }

  // The original AI, every 0.5 s: with no Doom Guard within 500, run for the
  // finish; otherwise Shadowmeld. From 06:00 all bots run for the finish.
  // Bots use that rule with better judgement (the original rule loses every
  // huntress about 30% of the time with 6 bots; this, about 5%): they hide
  // while a guard is within 1000 or heading their way (guards busy chasing
  // someone else only count when close, so others draw them off, as the
  // designer advises), and once chased they keep running, since a guard is
  // no faster. In practice they wait out the night and rush at dawn
  // together, which the guards' six Cripples cannot all stop.
  botThink(pid, u, mem) {
    mem.t = (mem.t ?? rand(0, 0.5)) - 0.25;
    if (mem.t > 0) return;
    mem.t = 0.5;
    if (this.time >= DAWN || this.guards.some((g) => g.victim === u || g.casting?.tgt === u)) {
      if (!u.target || u.meld) this.moveTo(pid, this.goal.x, this.goal.y);
      return;
    }
    const near = this.guards.some((g) => {
      const d = dist(g.x, g.y, u.x, u.y);
      if (g.victim && g.victim !== u) return d <= BOT_BUSY;
      return Math.min(d, dist(...this.guardAt(g, 1), u.x, u.y)) <= BOT_NEAR;
    });
    if (!near) {
      if (!u.target || u.meld) this.moveTo(pid, this.goal.x, this.goal.y);
    } else if (!u.meld) this.useAbility(pid, 0, u.x, u.y);
  }

  // Where a guard will be in t seconds if it keeps to its current route.
  guardAt(g, t) {
    const pts = [];
    if (g.target) pts.push(g.target);
    if (g.path) pts.push(...g.path);
    let x = g.x;
    let y = g.y;
    let left = g.speed * t;
    for (const p of pts) {
      const d = dist(x, y, p.x, p.y);
      if (d >= left) return [x + ((p.x - x) * left) / d, y + ((p.y - y) * left) / d];
      left -= d;
      x = p.x;
      y = p.y;
    }
    return [x, y];
  }

  // Shadowmelded huntresses are invisible to everyone else.
  heroEnts(pid) {
    return super.heroEnts(pid).filter((e) => {
      const u = this.heroes.get(e.o);
      if (!u) return true;
      if (this.hidden(u)) {
        if (e.o !== pid) return false;
        (e.fx ||= []).push('invis');
      } else if (u.meld) (e.fx ||= []).push('melding');
      return true;
    });
  }

  hud() {
    const h = this.hours;
    const hh = Math.floor(h);
    const mm = Math.floor((h - hh) * 60);
    const clock = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    return { label: this.time < DAWN ? `🌙 ${clock} · dawn in ${Math.ceil(DAWN - this.time)} s` : `☀ ${clock} · no more hiding` };
  }

  worldEnts() {
    const ents = this.guards.map((g) => creepSnap(g, 'doomguard', g.casting ? { cs: 1 } : {}));
    ents.push({ id: this.skyId, k: 'covertsky', x: 0, y: 0, f: 0, h: round2(this.hours) });
    ents.push({ id: this.circleId, k: 'powercircle', x: round2(this.goal.x), y: 0, f: 0, s: 1.5 });
    return ents;
  }
}
