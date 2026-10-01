import { Minigame } from '../../base.js';
import { newId, rand, dist, clamp, round2, wc3 } from '../../../engine/server/sim.js';
import { arrive, withoutGone, ordinal } from './race-kit.js';

// Uther Party 4.0 #18 "Stop and Go" (docs/uther-party/rules-4.0.md): a
// 256x1536 lane between cliffs, watched by ten Spirit Towers. A traffic light
// cycles RED (5-9 s) -> GREEN (3-5 s) -> YELLOW (1 s) -> RED, starting on red.
// On red the towers shoot (27-32 pierce, 1.0 s, range 700) any seal they can
// see, and one bolt kills a 15 HP seal. A seal standing still at night
// shadowmelds and the towers can't see it; moving or casting breaks the meld.
// Seals crawl at 75 u/s, so the 1024 u run takes about three cycles. Each has
// one Purge (range 700): it dispels the target (breaking its meld), stops it
// for 1 s and slows it for 5 s. Night ends about 100 s in; after that nobody
// can hide, so the next red finishes the game. Race: 8, 7, 6 ... No timer.
//
// Coordinates: WC3 (x, y) maps to (wc3(x + 4480), -wc3(y - 5760)).

const P = (x, y) => [wc3(x + 4480), -wc3(y - 5760)];
const LANE_HW = wc3(128);
const HH = wc3(768);
export const SEAL = { speed: wc3(75), r: wc3(7), hp: 15 };
const FINISH_Y = P(0, 6272)[1]; // the bottom edge of Stop_Finish
const FINISH_C = P(-4480, 6400);
export const TOWER = { range: wc3(700), col: wc3(48), cd: 1.0, point: 0.3, missile: wc3(900), dmg: [27, 32] };
export const CYCLE = { red: [5, 9], green: [3, 5], yellow: [1, 1] };
export const MELD_DELAY = 0.6; // Shadowmeld (Instant): 0.5 s action delay + 0.1 s fade
export const NIGHT = 100; // 01:00 to 06:00 at WC3's 480 s day
const PURGE = { range: wc3(700), stop: 1, slow: 5 };

export class StopAndGo extends Minigame {
  static id = 'stopgo';
  static name = 'Stop and Go';
  static desc = 'Stop on red, and go on green! Creep your seal up the lane to the circle. On red the spirit towers shoot anything that moves; stand still and you melt into the night. You get one Purge to stall a rival. When dawn comes there is nowhere left to hide.';
  static controls = 'Right-click to move, S to stop. Q, then click a rival: Purge (once) stops them for 1 s and slows them for 5 s. Casting breaks your cover too.';
  static duration = 200;
  static timer = false;
  static ranking = 'race';

  setup() {
    const towers = [];
    for (const x of [-4864, -4096]) for (const y of [5248, 5504, 5760, 6016, 6272]) towers.push(P(x, y));
    this.map = {
      theme: 'night',
      floor: { shape: 'rect', w: LANE_HW * 2, h: HH * 2 },
      props: [],
      build: ['stopgo'],
      sg: { hw: round2(LANE_HW), hh: round2(HH), finish: round2(FINISH_Y), towers: towers.map((t) => t.map(round2)) },
      bounds: HH + 2,
    };
    this.abilities = [
      {
        name: 'Purge',
        icon: '🌀',
        desc: 'Stops a rival for 1 s, then slows them for 5 s, and strips their shadowmeld. Once per game. Casting breaks your own meld.',
        kind: 'unit',
        charges: 1,
        cd: 5,
        range: PURGE.range,
        castPoint: 0.3,
        pickTarget: (pid, u, x, y) => this.pickRival(pid, u, x, y),
        cast: (pid, u, tgt) => this.purge(u, tgt.u),
      },
    ];
    // Seals start 1024 u below the finish line, anywhere across the lane, facing north.
    this.spawnHeroes(this.pids.map(() => [rand(-LANE_HW + SEAL.r, LANE_HW - SEAL.r), P(0, 5248)[1]]), { ...SEAL, facing: -Math.PI / 2 });
    for (const u of this.heroes.values()) u.skin = 'seal';
    for (const u of this.heroes.values()) {
      u.meld = MELD_DELAY; // they start standing still, already hidden
      u.purgeT = null;
    }
    this.towers = towers.map(([x, y]) => ({ id: newId(), x, y, f: x < 0 ? 0 : Math.PI, cd: rand(0, 0.5), wind: -1, tgt: null }));
    this.bolts = [];
    this.light = 'red';
    this.lightT = rand(...CYCLE.red);
    this.aiT = 0;
    this.skyId = newId();
    this.copId = newId();
  }

  get night() {
    return this.time < NIGHT;
  }

  // A seal the towers can see: anyone not melded (always, once it is day).
  visible(u) {
    return u.alive && !u.finished && !(this.night && u.meld >= MELD_DELAY);
  }

  setLight(l) {
    this.light = l;
    this.lightT = rand(...CYCLE[l]);
    this.ev({ k: 'sglight', l });
    if (l === 'green') {
      // Stop AI, on green: every computer seal moves to the finish centre.
      for (const [pid] of this.bots) {
        const u = this.heroes.get(pid);
        if (u.alive && !u.finished) u.order(FINISH_C[0], FINISH_C[1]);
      }
    }
  }

  tick(dt) {
    this.lightT -= dt;
    if (this.lightT <= 0) this.setLight(this.light === 'red' ? 'green' : this.light === 'green' ? 'yellow' : 'red');
    if (this.time >= NIGHT && !this.dawned) {
      this.dawned = true;
      this.ev({ k: 'txt', x: 0, y: 0, s: 'Dawn! Nowhere to hide.', c: '#ffd890' });
    }

    // Purge: paused for 1 s, then the slow wears off over 5 s.
    for (const u of this.heroes.values()) {
      if (u.purgeT == null) continue;
      u.purgeT += dt;
      u.speedMult = clamp(u.purgeT / PURGE.slow, 0, 1);
      if (u.purgeT >= PURGE.slow) {
        u.purgeT = null;
        u.speedMult = 1;
      }
    }

    this.stepHeroes(dt);
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.finished) continue;
      u.x = clamp(u.x, -LANE_HW + u.r, LANE_HW - u.r);
      u.y = clamp(u.y, -HH + u.r, HH - u.r);
      // Shadowmeld: idle (no order, not casting) for the delay.
      const idle = !u.target && !u.cast;
      u.meld = idle ? u.meld + dt : 0;
      if (u.y <= FINISH_Y) arrive(this, pid);
    }

    // Yellow and red: each computer seal still moving has a 25 % chance per
    // 0.25 s to stop. Ours range from 25 % for the clumsiest bots to 40 % for
    // the sharpest, so a table of bots doesn't all get shot.
    if (this.light !== 'green') {
      this.aiT -= dt;
      if (this.aiT <= 0) {
        this.aiT += 0.25;
        for (const [pid, b] of this.bots) {
          const u = this.heroes.get(pid);
          if (u.alive && !u.finished && u.target && Math.random() < 0.25 + 0.15 * clamp((b.mem.skill - 0.45) / 0.45, 0, 1)) u.stop();
        }
      }
    } else this.aiT = 0;

    for (const t of this.towers) this.stepTower(t, dt);
    for (const b of this.bolts) {
      const tx = b.tgt.x - b.x;
      const ty = b.tgt.y - b.y;
      const d = Math.hypot(tx, ty);
      const step = TOWER.missile * dt;
      if (d <= step || !b.tgt.alive || b.tgt.finished) {
        b.done = true;
        if (b.tgt.alive && !b.tgt.finished) {
          this.ev({ k: 'sghit', x: round2(b.tgt.x), y: round2(b.tgt.y) });
          this.damage(b.tgt.owner, b.dmg, 'death');
        }
        continue;
      }
      b.x += (tx / d) * step;
      b.y += (ty / d) * step;
      b.f = Math.atan2(ty, tx);
    }
    this.bolts = this.bolts.filter((b) => !b.done);
  }

  // Towers are paused except on red. On red they keep their target while
  // they can see it and it is in range, and otherwise take the nearest seal
  // they can see.
  stepTower(t, dt) {
    if (t.cd > 0) t.cd -= dt;
    if (this.light !== 'red') {
      t.wind = -1;
      return;
    }
    const reach = (u) => dist(t.x, t.y, u.x, u.y) <= TOWER.range + TOWER.col + u.r;
    if (t.wind >= 0) {
      t.wind += dt;
      if (t.wind >= TOWER.point) {
        t.wind = -1;
        // An attack on a target that vanished (melded) is lost.
        if (t.tgt && this.visible(t.tgt) && reach(t.tgt)) {
          const dmg = rand(TOWER.dmg[0], TOWER.dmg[1] + 1) * 0.75;
          this.bolts.push({ id: newId(), x: t.x, y: t.y, tgt: t.tgt, dmg: Math.floor(dmg), d0: dist(t.x, t.y, t.tgt.x, t.tgt.y) || 1 });
          this.ev({ k: 'sfx', s: 'zap' });
        }
      }
      return;
    }
    if (!(t.tgt && this.visible(t.tgt) && reach(t.tgt))) {
      t.tgt = null;
      let bd = Infinity;
      for (const u of this.heroes.values()) {
        if (!this.visible(u) || !reach(u)) continue;
        const d = dist(t.x, t.y, u.x, u.y);
        if (d < bd) {
          bd = d;
          t.tgt = u;
        }
      }
    }
    if (!t.tgt) return;
    t.f = Math.atan2(t.tgt.y - t.y, t.tgt.x - t.x);
    if (t.cd <= 0) {
      t.cd = TOWER.cd;
      t.wind = 0;
    }
  }

  pickRival(pid, u, x, y) {
    let best = null;
    let bd = 2.5;
    for (const [op, v] of this.heroes) {
      if (op === pid || !v.alive || v.finished) continue;
      // Shadowmelded seals are invisible to their rivals: they can't be targeted.
      if (this.night && v.meld >= MELD_DELAY) continue;
      const d = dist(x, y, v.x, v.y);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    if (!best || dist(u.x, u.y, best.x, best.y) > PURGE.range + u.r + best.r) return null;
    return { x: best.x, y: best.y, u: best };
  }

  purge(u, v) {
    u.meld = 0;
    if (!v?.alive || v.finished) return;
    this.ev({ k: 'purge', x1: round2(u.x), y1: round2(u.y), x2: round2(v.x), y2: round2(v.y), u: v.id, d: PURGE.slow });
    v.meld = 0;
    v.stun = PURGE.stop;
    v.purgeT = 0;
    v.speedMult = 0;
  }

  // Computer seals are driven by the light (setLight and the 0.25 s loop in
  // tick), as in the original; they never cast Purge.
  botThink() {}

  progress(pid) {
    return -this.heroes.get(pid).y;
  }

  heroEnts(pid) {
    const ents = withoutGone(this, super.heroEnts(pid));
    for (const e of ents) {
      const u = this.heroes.get(e.o);
      if (!u) continue;
      const fx = (e.fx || []).filter((f) => f !== 'slow');
      if (this.night && u.meld >= MELD_DELAY && u.alive && !u.finished) fx.push('invis');
      if (u.purgeT != null) fx.push('slow');
      if (fx.length) e.fx = fx;
      else delete e.fx;
    }
    return ents;
  }

  worldEnts() {
    const ents = this.towers.map((t) => ({ id: t.id, k: 'spirittower', x: round2(t.x), y: round2(t.y), f: round2(t.f), l: this.light[0], fire: t.wind >= 0 ? 1 : undefined }));
    for (const b of this.bolts) ents.push({ id: b.id, k: 'sgbolt', x: round2(b.x), y: round2(b.y), f: round2(b.f || 0), p: round2(clamp(1 - dist(b.x, b.y, b.tgt.x, b.tgt.y) / b.d0, 0, 1)) });
    ents.push({ id: this.copId, k: 'cop', x: round2(FINISH_C[0]), y: round2(FINISH_C[1]), s: 1, r: 1.8 });
    // Night fading into dawn (for the lighting).
    ents.push({ id: this.skyId, k: 'sgsky', x: 0, y: 0, d: round2(clamp((this.time - (NIGHT - 12)) / 12, 0, 1)), l: this.light[0] });
    return ents;
  }

  hud(pid) {
    const u = this.heroes.get(pid);
    const lamp = { red: 'RED: stand still!', green: 'GREEN: go!', yellow: 'YELLOW: stop now!' }[this.light];
    const night = this.night ? `night ends in ${Math.ceil(NIGHT - this.time)} s` : 'dawn: nowhere to hide';
    if (u?.finished) return { label: `Home! ${ordinal(this.finishOrder.indexOf(pid) + 1)} place · ${lamp}` };
    return { label: `${lamp} · ${night}` };
  }
}
