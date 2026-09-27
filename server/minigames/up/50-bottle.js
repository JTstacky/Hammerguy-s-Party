import { Minigame } from '../../base.js';
import { newId, rand, dist, shuffle, round1, round2, wc3, clamp } from '../../../engine/server/sim.js';

// Uther Party 4.0 #50 "Battle for the Bottle" (docs/uther-party/rules-4.0.md).
// A Free Play game in the original; here it joins the normal roll.
//
// A drunken free-for-all between level-2 Pandaren Brewmasters (played as
// hammerguys) in The Tauren Tragedy's arena: a 1280 x 1280 square with its
// corners cut by cliffs. Everyone has 375 HP, a 26-36 melee hit every 1.71 s,
// and two spells on a 240-mana pool:
//  - Q Breath of Fire: a cone 375 long, 125 -> 300 wide, 65 damage; hazed
//    victims also burn for 7/s for 5 s.
//  - W Drunken Haze: a flask thrown at a rival (range 550) that hazes
//    everyone within 200 for 5 s: 45 % of their attacks miss, -15 % speed.
// A Rune of Mana (+125 mana) appears every 10 s, up to 500 from the centre,
// and stays until someone walks over it. The screen flashes a random tint
// every 3.25 s and the camera sways (softened client side).
// Last one standing wins; at the time limit every survivor ties.
//
// Scoring: survival with no ties, as the original (TiesPossible is false):
// brewmasters dying in the same instant still get sequential antes, so
// deathGroups() is overridden to keep every death on its own.
//
// Simplifications:
//  - The 180 s timer includes the original's 5 s frozen start, which our
//    6 s intro countdown replaces, so the playable time is 175 s.
//  - Runes are picked up by walking onto them (WC3 needs a right-click on the item).
//  - Damage point of the melee swing (not in the sheet) is taken as 0.3 s;
//    Breath of Fire's wave is assumed to travel at 1000 u/s and the Haze
//    flask at 1000 u/s.
//  - Spawn angles use WC3's orientation (north is up on screen).

const DEG = Math.PI / 180;
const HW = wc3(640); // half of the 1280 x 1280 arena
const CUT = wc3(960); // corners cut by cliffs: walkable while |x| + |y| <= 960 u
const START_R = wc3(500);

export const BREW = {
  hp: 375,
  regen: 0.7,
  mana: 240,
  manaRegen: 0.81,
  speed: wc3(270),
  r: wc3(32),
  // Hero attack vs hero armour 3.65: 1 - 0.06a / (1 + 0.06a).
  armour: 1 - (0.06 * 3.65) / (1 + 0.06 * 3.65),
  range: wc3(100),
  cd: 2.22 / 1.3, // base cooldown / (1 + 15.5 AGI x 2 %)
  point: 0.3,
  acqBot: wc3(500),
  acqHuman: wc3(100),
};
export const BOF = { mana: 70, cd: 10, len: wc3(375), w0: wc3(125), w1: wc3(300), dmg: 65, cap: 520, speed: wc3(1000), burn: 7, burnT: 5, castPoint: 0.3 };
export const HAZE = { mana: 70, cd: 12, range: wc3(550), r: wc3(200), dur: 5, miss: 0.45, slow: 0.15, speed: wc3(1000), castPoint: 0.3 };
export const RUNE = { every: 10, maxR: wc3(500), mana: 125, touch: wc3(40), vacuum: wc3(150) };
export const FLASH_EVERY = 3.25;
export const AI_EVERY = 4;

// 26-36: base 10 + 14 (STR at level 2) + 2d6.
const rollHit = () => 24 + 1 + Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6);

export class BattleForTheBottle extends Minigame {
  static id = 'bottle';
  static name = 'Battle for the Bottle';
  static desc = 'A drunken brawl in the Tauren arena. Club your rivals, breathe fire, throw Drunken Haze, and grab the mana runes. The screen will not stop spinning. Last one standing wins.';
  static controls = 'Right-click a rival to attack. Q: Breath of Fire (cone, burns hazed rivals). W, then click a rival: Drunken Haze (they miss 45 % of their swings). Walk over runes for mana.';
  static duration = 175;
  static ranking = 'survival';

  setup() {
    this.map = {
      theme: 'dirt',
      floor: { shape: 'rect', w: HW * 2, h: HW * 2 },
      props: arenaRim(),
      build: ['bottle'],
      bounds: HW + 3,
    };
    this.mana = new Map(this.pids.map((p) => [p, BREW.mana]));
    this.attack = { range: BREW.range, cd: BREW.cd, point: BREW.point, dmg: 0, missile: 0 };
    this.abilities = [
      {
        name: 'Breath of Fire',
        icon: '🔥',
        desc: `Breathes a cone of fire: ${BOF.dmg} damage. Hazed rivals catch fire (${BOF.burn}/s for ${BOF.burnT} s). ${BOF.mana} mana.`,
        kind: 'point',
        cd: BOF.cd,
        range: BOF.len,
        castPoint: BOF.castPoint,
        available: (pid) => this.mana.get(pid) >= BOF.mana,
        cast: (pid, u, tgt) => this.breathOfFire(pid, u, tgt),
      },
      {
        name: 'Drunken Haze',
        icon: '🍺',
        desc: `Throws brew at a rival: everyone within ${HAZE.r} u misses ${HAZE.miss * 100} % of their attacks and is ${HAZE.slow * 100} % slower for ${HAZE.dur} s. ${HAZE.mana} mana.`,
        kind: 'unit',
        cd: HAZE.cd,
        range: HAZE.range,
        castPoint: HAZE.castPoint,
        available: (pid) => this.mana.get(pid) >= HAZE.mana,
        pickTarget: (pid, u, x, y) => this.pickHazeTarget(pid, u, x, y),
        cast: (pid, u, tgt) => this.throwHaze(pid, u, tgt.u),
      },
    ];
    // One brewmaster per playing slot i at centre + 500 at (135 i - 22.5)°,
    // handed out to the players at random.
    const spots = shuffle(this.pids.map((_, i) => {
      const a = (135 * (i + 1) - 22.5) * DEG;
      return [Math.cos(a) * START_R, -Math.sin(a) * START_R];
    }));
    this.spawnHeroes(spots, { hp: BREW.hp, regen: BREW.regen, r: BREW.r, speed: BREW.speed });
    this.hazed = new Map(); // pid -> seconds left
    this.burning = new Map(); // pid -> seconds left
    this.waves = [];
    this.flasks = [];
    this.runes = [];
    this.pending = new Map(); // pid -> rival to throw Haze at once in range
    this.statusIds = new Map(this.pids.map((p) => [p, newId()]));
    this.fxId = newId();
    // The periodic triggers keep their phase from map start.
    this.runeT = rand(0, RUNE.every);
    this.flashT = rand(0, FLASH_EVERY);
    this.aiT = rand(0, AI_EVERY);
  }

  // Keeps a hero inside the square and off the cliffs in its corners.
  clampArena(u) {
    u.x = clamp(u.x, -HW + u.r, HW - u.r);
    u.y = clamp(u.y, -HW + u.r, HW - u.r);
    const over = Math.abs(u.x) + Math.abs(u.y) - (CUT - u.r * Math.SQRT2);
    if (over > 0) {
      u.x -= Math.sign(u.x) * over / 2;
      u.y -= Math.sign(u.y) * over / 2;
    }
  }

  inArena(x, y, m = 0) {
    return Math.abs(x) <= HW - m && Math.abs(y) <= HW - m && Math.abs(x) + Math.abs(y) <= CUT - m;
  }

  command(pid, m) {
    const u = this.heroes.get(pid);
    if (u && m.c !== 'cast') {
      u.autoAcq = false;
      this.pending.delete(pid);
    }
    super.command(pid, m);
  }

  tick(dt) {
    const alive = this.alive;
    this.runeT -= dt;
    if (this.runeT <= 0) {
      this.runeT += RUNE.every;
      this.spawnRune();
    }
    // The filter stops once at most one brewmaster is left.
    if (alive.length > 1) {
      this.flashT -= dt;
      if (this.flashT <= 0) {
        this.flashT += FLASH_EVERY;
        const c = [0, 1, 2].map(() => Math.round(rand(0, 255)).toString(16).padStart(2, '0')).join('');
        // Transparency 0-50 %: the screen ends 50-100 % covered.
        this.ev({ k: 'bflash', c: `#${c}`, a: round2(1 - rand(0, 0.5)) });
      }
    }
    this.aiT -= dt;
    if (this.aiT <= 0) {
      this.aiT += AI_EVERY;
      this.battleAI();
    }

    for (const pid of alive) this.mana.set(pid, Math.min(BREW.mana, this.mana.get(pid) + BREW.manaRegen * dt));
    for (const [pid, t] of this.hazed) {
      if (t - dt <= 0 || !this.heroes.get(pid).alive) this.hazed.delete(pid);
      else this.hazed.set(pid, t - dt);
    }
    for (const [pid, u] of this.heroes) u.speedMult = this.hazed.has(pid) ? 1 - HAZE.slow : 1;
    for (const [pid, t] of this.burning) {
      if (!this.heroes.get(pid).alive || t <= 0) {
        this.burning.delete(pid);
        continue;
      }
      this.burning.set(pid, t - dt);
      this.damage(pid, BOF.burn * Math.min(dt, t), 'burn');
    }

    this.acquire();
    this.stepPending();
    this.stepHeroes(dt);
    for (const [, u] of this.heroes) if (u.alive) this.clampArena(u);

    this.stepWaves(dt);
    this.stepFlasks(dt);
    for (const [pid, u] of this.heroes) {
      if (!u.alive) continue;
      for (const r of this.runes) if (!r.taken && dist(u.x, u.y, r.x, r.y) <= u.r + RUNE.touch) this.takeRune(pid, r);
    }
    this.runes = this.runes.filter((r) => !r.taken);
  }

  spawnRune() {
    const a = rand(0, Math.PI * 2);
    const r = rand(0, RUNE.maxR);
    this.runes.push({ id: newId(), x: Math.cos(a) * r, y: Math.sin(a) * r });
  }

  takeRune(pid, r) {
    r.taken = true;
    this.mana.set(pid, Math.min(BREW.mana, this.mana.get(pid) + RUNE.mana));
    this.ev({ k: 'runepick', x: round1(r.x), y: round1(r.y) });
    this.ev({ k: 'txt', x: round1(r.x), y: round1(r.y), s: `+${RUNE.mana} mana`, c: '#6fb4ff' });
  }

  // WC3 auto-acquisition: an idle brewmaster attacks a rival who comes within
  // its acquisition range (500 for computers, 100 for players) and gives up
  // the chase once they get well away.
  acquire() {
    for (const [pid, u] of this.heroes) {
      if (!u.alive) continue;
      const acq = this.bots.has(pid) ? BREW.acqBot : BREW.acqHuman;
      if (u.attackOrder && u.autoAcq) {
        const t = u.attackOrder;
        if (!t.alive || dist(u.x, u.y, t.x, t.y) - u.r - t.r > acq + wc3(250)) {
          u.attackOrder = null;
          u.autoAcq = false;
          u.stop();
        }
        continue;
      }
      if (u.attackOrder || u.target || u.cast || u.swing || this.pending.has(pid)) continue;
      let best = null;
      let bd = acq;
      for (const [op, v] of this.heroes) {
        if (op === pid || !v.alive) continue;
        const d = dist(u.x, u.y, v.x, v.y) - u.r - v.r;
        if (d <= bd) {
          bd = d;
          best = v;
        }
      }
      if (best) {
        u.attackOrder = best;
        u.autoAcq = true;
      }
    }
  }

  // Missed melee swings while hazed; hits roll 26-36 through hero armour.
  attackHit(pid, u, tgt) {
    if (!tgt.alive) return;
    if (this.hazed.has(pid) && Math.random() < HAZE.miss) {
      this.ev({ k: 'txt', x: round1(tgt.x), y: round1(tgt.y), s: 'miss', c: '#e8e0c0' });
      return;
    }
    this.ev({ k: 'hit', x: round1(tgt.x), y: round1(tgt.y) });
    this.damage(tgt.owner, rollHit() * BREW.armour);
  }

  breathOfFire(pid, u, tgt) {
    this.mana.set(pid, this.mana.get(pid) - BOF.mana);
    const a = Math.atan2(tgt.y - u.y, tgt.x - u.x);
    this.waves.push({ pid, x: u.x, y: u.y, a, d: 0, total: 0, hit: new Set([pid]) });
    this.ev({ k: 'bof', x: round2(u.x), y: round2(u.y), a: round2(a), len: round2(BOF.len), w0: round2(BOF.w0), w1: round2(BOF.w1), sp: round2(BOF.speed) });
    this.ev({ k: 'sfx', s: 'boom' });
  }

  // The wave sweeps out at its speed and hits each unit once when it passes,
  // if the unit is inside the widening cone.
  stepWaves(dt) {
    for (const w of this.waves) {
      w.d = Math.min(BOF.len, w.d + BOF.speed * dt);
      const cx = Math.cos(w.a);
      const cy = Math.sin(w.a);
      for (const [pid, v] of this.heroes) {
        if (!v.alive || w.hit.has(pid) || w.total >= BOF.cap) continue;
        const rx = v.x - w.x;
        const ry = v.y - w.y;
        const along = rx * cx + ry * cy;
        if (along < -v.r || along > w.d + v.r) continue;
        const k = clamp(along / BOF.len, 0, 1);
        const half = (BOF.w0 + (BOF.w1 - BOF.w0) * k) / 2;
        if (Math.abs(rx * cy - ry * cx) > half + v.r) continue;
        w.hit.add(pid);
        const dmg = Math.min(BOF.dmg, BOF.cap - w.total);
        w.total += dmg;
        this.damage(pid, dmg, 'burn');
        if (this.hazed.has(pid)) this.burning.set(pid, BOF.burnT);
      }
      if (w.d >= BOF.len) w.done = true;
    }
    this.waves = this.waves.filter((w) => !w.done);
  }

  pickHazeTarget(pid, u, x, y) {
    let best = null;
    let bd = 2.5;
    for (const [op, v] of this.heroes) {
      if (op === pid || !v.alive) continue;
      const d = dist(x, y, v.x, v.y);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    if (!best) return null;
    // Out of range: walk toward the rival and throw once in range, as WC3 does.
    if (dist(u.x, u.y, best.x, best.y) > HAZE.range) {
      this.pending.set(pid, best);
      u.attackOrder = null;
      u.order(best.x, best.y);
      return null;
    }
    return { x: best.x, y: best.y, u: best };
  }

  stepPending() {
    for (const [pid, v] of this.pending) {
      const u = this.heroes.get(pid);
      if (!u.alive || !v.alive || this.mana.get(pid) < HAZE.mana) {
        this.pending.delete(pid);
        continue;
      }
      if (dist(u.x, u.y, v.x, v.y) <= HAZE.range) {
        this.pending.delete(pid);
        u.stop();
        this.useAbility(pid, 1, v.x, v.y);
      } else u.steer(v.x, v.y);
    }
  }

  throwHaze(pid, u, v) {
    this.mana.set(pid, this.mana.get(pid) - HAZE.mana);
    this.flasks.push({ id: newId(), pid, x: u.x, y: u.y, sx: u.x, sy: u.y, v, lx: v.x, ly: v.y, t: 0 });
  }

  stepFlasks(dt) {
    for (const f of this.flasks) {
      if (f.v.alive) {
        f.lx = f.v.x;
        f.ly = f.v.y;
      }
      const dx = f.lx - f.x;
      const dy = f.ly - f.y;
      const d = Math.hypot(dx, dy);
      const step = HAZE.speed * dt;
      f.t += dt;
      if (d <= step) {
        f.done = true;
        this.hazeBurst(f.pid, f.lx, f.ly);
        continue;
      }
      f.x += (dx / d) * step;
      f.y += (dy / d) * step;
      f.f = Math.atan2(dy, dx);
    }
    this.flasks = this.flasks.filter((f) => !f.done);
  }

  hazeBurst(pid, x, y) {
    this.ev({ k: 'haze', x: round2(x), y: round2(y), r: round2(HAZE.r) });
    for (const [op, v] of this.heroes) {
      if (op === pid || !v.alive) continue;
      if (dist(x, y, v.x, v.y) <= HAZE.r + v.r) this.hazed.set(op, HAZE.dur);
    }
  }

  // "Battle AI", every 4 s for every computer brewmaster: move to a random
  // point of the arena rect, and take any rune within 150 of it. They never
  // cast; they fight through auto-acquisition when they stop.
  battleAI() {
    for (const pid of this.bots.keys()) {
      const u = this.heroes.get(pid);
      if (!u?.alive) continue;
      u.attackOrder = null;
      u.autoAcq = false;
      const x = rand(-HW, HW);
      const y = rand(-HW, HW);
      if (u.cast) u.cast.queued = { x, y };
      else u.order(x, y);
      for (const r of this.runes) if (!r.taken && dist(u.x, u.y, r.x, r.y) <= RUNE.vacuum) this.takeRune(pid, r);
    }
  }

  // Deaths never tie in this game (see the header).
  deathGroups() {
    return this.elimOrder.map((e) => [e.pid]);
  }

  hud(pid) {
    const m = this.mana.get(pid);
    if (m == null || !this.heroes.get(pid)?.alive) return null;
    return { label: `Mana ${Math.floor(m)} / ${BREW.mana}${this.hazed.has(pid) ? ' · hazed' : ''}` };
  }

  worldEnts() {
    const ents = [{ id: this.fxId, k: 'bottlefx', x: 0, y: 0, on: this.alive.length > 1 ? 1 : undefined }];
    for (const r of this.runes) ents.push({ id: r.id, k: 'manarune', x: round2(r.x), y: round2(r.y) });
    for (const f of this.flasks) ents.push({ id: f.id, k: 'flask', x: round2(f.x), y: round2(f.y), f: round2(f.f || 0) });
    for (const [pid, u] of this.heroes) {
      if (!u.alive) continue;
      const hz = this.hazed.has(pid);
      const bn = this.burning.has(pid);
      if (hz || bn) ents.push({ id: this.statusIds.get(pid), k: 'brewfx', x: round2(u.x), y: round2(u.y), hz: hz ? 1 : undefined, bn: bn ? 1 : undefined });
    }
    return ents;
  }
}

// The Tauren Tragedy's rim: a ring of cliff rocks round the square, the cliffs
// filling the four cut corners, and the three autumn trees of its Fall Tree Walls.
function arenaRim() {
  const props = [];
  const edge = HW + 0.9;
  for (let i = -8; i <= 8; i++) {
    const a = (i / 8) * (HW - 0.5) + rand(-0.3, 0.3);
    for (const [nx, ny] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const out = edge + rand(-0.2, 0.6);
      const px = nx ? nx * out : a;
      const py = ny ? ny * out : a;
      if (Math.abs(px) + Math.abs(py) < CUT + 0.8) props.push({ t: 'rock', x: px, y: py, s: rand(0.8, 1.4) });
      if (Math.random() < 0.6) props.push({ t: 'tree', x: px + nx * rand(2.2, 4.5), y: py + ny * rand(2.2, 4.5), s: rand(0.9, 1.4) });
      if (Math.random() < 0.5) props.push({ t: 'tree', x: px + nx * rand(5, 8), y: py + ny * rand(5, 8), s: rand(1, 1.5) });
    }
  }
  // Cliff masses in the cut corners.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const t = rand(-1, 1);
      const off = rand(0.3, 2.2);
      const along = (CUT / 2) * (1 + t * 0.5);
      props.push({ t: 'rock', x: sx * (along + off * 0.7), y: sy * (CUT - along + off * 0.7), s: rand(1.1, 1.8) });
    }
  }
  return props;
}
