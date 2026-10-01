import { newId, rand, dist, round1, round2, wc3, pick, wrapAngle, clamp } from '../../../engine/server/sim.js';
import { WalkGrid, GridRace, toServer, rectFromWc3, randIn, creep, meleeStep, pathTo } from './walkgrid.js';
import { treesAroundRect } from '../props.js';

// Uther Party 4.0 #34 "The Unseen" (docs/uther-party/rules-4.0.md): a
// 2304x768 field at midnight. Witch doctors (speed 270, 5 HP, 200 mana with
// no regen) must cross an 11x6-tile band held by 20 invisible Draenei
// Guardians that never move and kill anything they can reach (range 100,
// about 132 u centre to centre). Two spells: Sentry Ward (50 mana, range 500,
// lasts 10 s, reveals invisible units within 500 to its owner) and Stasis
// Trap (100 mana, range 500, arms after 5 s, trips when a guard comes within
// 250 and stuns every guard within 400 for 6 s). Guards also smash wards and
// traps in reach. 90 s limit.
//
// Assumption: the trap trips on and stuns the guards only (whether it would
// also catch rival witch doctors is not in the sheet).
const CX = 8448;
const CY = 6528;
const conv = toServer(CX, CY);
const HW = wc3(1152);
const HH = wc3(384);
const CELL = wc3(64);
// 64 u pathing cells; the six blocked 128 u squares are the corners and the
// middle of the long sides.
const LAYOUT = Array.from({ length: 12 }, (_, r) =>
  Array.from({ length: 36 }, (_, c) => ((r < 2 || r > 9) && (c < 2 || c > 33 || c === 17 || c === 18) ? '#' : '.')).join(''),
);
export const DOC = { speed: wc3(270), r: wc3(16), hp: 5 };
export const MANA = 200;
export const WARD = { cost: 50, range: wc3(500), life: 10, sight: wc3(500), hp: 200 };
export const TRAP = { cost: 100, range: wc3(500), arm: 5, trip: wc3(250), blast: wc3(400), stun: 6, life: 150, hp: 100 };
export const GUARD = { r: wc3(16), hp: 240 };
export const GUARD_ATTACK = { range: wc3(100), cd: 1.35, point: 0.33 };
export const N_GUARDS = 20;
const BOT_START = 4;

export class TheUnseen extends GridRace {
  static id = 'unseen';
  static name = 'The Unseen';
  static desc = 'Evade hidden enemies and reach the end! Twenty invisible guardians stand somewhere between you and the circle, and one blow kills. Sentry Wards show them to you for 10 seconds; Stasis Traps stun them. You have 200 mana and it does not come back.';
  static controls = 'Right-click to move. Q: Sentry Ward (50 mana, reveals hidden guards near it). W: Stasis Trap (100 mana, arms after 5 s, stuns guards near it for 6 s).';
  static duration = 90;
  static ranking = 'race';

  setup() {
    const [x0, y0] = conv(7296, 6912);
    this.grid = new WalkGrid(LAYOUT, { cell: CELL, x0, y0, blocked: '#' });
    const torches = [conv(7680, 6528), conv(9216, 6528)].map(([x, y]) => ({ t: 'torch', x, y }));
    this.map = {
      theme: 'night',
      floor: { shape: 'rect', w: HW * 2, h: HH * 2 },
      props: [...treesAroundRect(HW, HH, 0.42, 2.2), ...torches],
      bounds: HW,
      build: ['upmaze'],
      maze: this.grid.snap({ style: 'rocks' }),
    };
    this.zone = rectFromWc3(conv, 7744, 6144, 9152, 6912);
    this.finishRect = rectFromWc3(conv, 9408, 6464, 9536, 6592);
    this.goal = { x: (this.finishRect.x0 + this.finishRect.x1) / 2, y: 0 };
    this.mana = new Map(this.pids.map((p) => [p, MANA]));
    this.wards = [];
    this.traps = [];
    this.abilities = [
      {
        name: 'Sentry Ward',
        icon: '👁',
        desc: 'Plants a ward that shows you hidden guards within 500 for 10 seconds. 50 mana.',
        kind: 'point',
        range: WARD.range,
        castPoint: 0.3,
        cd: 0,
        pickTarget: (pid, u, x, y) => this.inReach(u, x, y, WARD.range),
        available: (pid) => this.mana.get(pid) >= WARD.cost,
        cast: (pid, u, tgt) => this.plantWard(pid, tgt),
      },
      {
        name: 'Stasis Trap',
        icon: '🗿',
        desc: 'Plants a trap that arms after 5 s. When a guard comes within 250 it goes off and stuns every guard within 400 for 6 s. 100 mana.',
        kind: 'point',
        range: TRAP.range,
        castPoint: 0.3,
        cd: 0,
        pickTarget: (pid, u, x, y) => this.inReach(u, x, y, TRAP.range),
        available: (pid) => this.mana.get(pid) >= TRAP.cost,
        cast: (pid, u, tgt) => this.plantTrap(pid, tgt),
      },
    ];
    const st = rectFromWc3(conv, 7296, 6272, 7552, 6784);
    const m = DOC.r;
    this.spawnHeroes(this.pids.map(() => randIn({ x0: st.x0 + m, x1: st.x1 - m, y0: st.y0 + m, y1: st.y1 - m })), { ...DOC, facing: 0 });
    for (const u of this.heroes.values()) u.skin = 'witchdoctor';
    // 20 held guards at random points of the centre zone, random facing.
    this.guards = [];
    while (this.guards.length < N_GUARDS) {
      const [x, y] = randIn({ x0: this.zone.x0 + GUARD.r, x1: this.zone.x1 - GUARD.r, y0: this.zone.y0 + GUARD.r, y1: this.zone.y1 - GUARD.r });
      if (!this.grid.fits(x, y, GUARD.r) || this.guards.some((g) => dist(g.x, g.y, x, y) < GUARD.r * 2)) continue;
      const g = creep('guardian', x, y, { speed: 0, r: GUARD.r, hp: GUARD.hp, facing: rand(-Math.PI, Math.PI) });
      g.victim = null;
      this.guards.push(g);
    }
    this.circleId = newId();
  }

  inReach(u, x, y, range) {
    const d = dist(u.x, u.y, x, y);
    if (d > range) {
      // Out of range: WC3 walks into range first; here the spell lands at the edge of its reach.
      x = u.x + ((x - u.x) / d) * range;
      y = u.y + ((y - u.y) / d) * range;
    }
    [x, y] = [clamp(x, -HW + 0.2, HW - 0.2), clamp(y, -HH + 0.2, HH - 0.2)];
    return { x, y };
  }

  plantWard(pid, tgt) {
    if (this.mana.get(pid) < WARD.cost) return;
    this.mana.set(pid, this.mana.get(pid) - WARD.cost);
    this.wards.push({ id: newId(), o: pid, x: tgt.x, y: tgt.y, r: wc3(16), t: WARD.life, hp: WARD.hp, alive: true });
    this.ev({ k: 'wardup', x: round2(tgt.x), y: round2(tgt.y), o: pid });
  }

  plantTrap(pid, tgt) {
    if (this.mana.get(pid) < TRAP.cost) return;
    this.mana.set(pid, this.mana.get(pid) - TRAP.cost);
    this.traps.push({ id: newId(), o: pid, x: tgt.x, y: tgt.y, r: wc3(16), t: 0, hp: TRAP.hp, alive: true });
    this.ev({ k: 'wardup', x: round2(tgt.x), y: round2(tgt.y), o: pid, trap: 1 });
  }

  tick(dt) {
    this.stepRace(dt);
    for (const u of this.heroes.values()) {
      if (!u.alive || u.finished) continue;
      u.x = clamp(u.x, -HW + u.r, HW - u.r);
      u.y = clamp(u.y, -HH + u.r, HH - u.r);
      // Held guards are solid: walk round them.
      for (const g of this.guards) {
        const d = dist(u.x, u.y, g.x, g.y);
        const min = (u.r + g.r) * 0.8;
        if (d < min) {
          const k = min / (d || 0.01);
          u.x = g.x + (u.x - g.x) * k;
          u.y = g.y + (u.y - g.y) * k;
        }
      }
    }
    for (const [pid, u] of this.heroes) if (u.alive && !u.finished && this.inRect(u, this.finishRect)) this.finish(pid);
    for (const w of this.wards) {
      w.t -= dt;
      if (w.t <= 0) w.alive = false;
    }
    for (const tr of this.traps) {
      tr.t += dt;
      if (tr.t >= TRAP.life) tr.alive = false;
      if (!tr.alive || tr.t < TRAP.arm) continue;
      if (this.guards.some((g) => dist(g.x, g.y, tr.x, tr.y) <= TRAP.trip + g.r)) {
        tr.alive = false;
        this.ev({ k: 'stasis', x: round2(tr.x), y: round2(tr.y), r: round2(TRAP.blast) });
        for (const g of this.guards) {
          if (dist(g.x, g.y, tr.x, tr.y) <= TRAP.blast + g.r) {
            g.stun = TRAP.stun;
            g.swing = null;
            g.victim = null;
          }
        }
      }
    }
    this.stepGuards(dt);
    this.wards = this.wards.filter((w) => w.alive);
    this.traps = this.traps.filter((t) => t.alive);
  }

  stepGuards(dt) {
    for (const g of this.guards) {
      if (g.atkCd > 0) g.atkCd -= dt;
      if (g.stun > 0) {
        g.stun -= dt;
        continue;
      }
      // Hold position: attack whatever is in reach, nearest first.
      if (!g.swing && (!g.victim || !this.stillThere(g, g.victim))) {
        g.victim = null;
        let bd = Infinity;
        for (const t of this.targets()) {
          const gap = dist(g.x, g.y, t.x, t.y) - g.r - t.r;
          if (gap <= GUARD_ATTACK.range && gap < bd) {
            bd = gap;
            g.victim = t;
          }
        }
      }
      meleeStep(this, g, g.victim, dt, GUARD_ATTACK, (t) => this.strike(g, t), false);
      // Turning on the spot toward the victim (hold position never walks).
      g.target = null;
      if (g.faceTo != null) {
        const diff = wrapAngle(g.faceTo - g.heading);
        const step = Math.min(Math.abs(diff), (g.turnRate / 0.03) * dt);
        g.heading = wrapAngle(g.heading + Math.sign(diff) * step);
        g.facing = g.heading;
      }
    }
  }

  stillThere(g, t) {
    return t.alive && !t.finished && dist(g.x, g.y, t.x, t.y) - g.r - t.r <= GUARD_ATTACK.range;
  }

  targets() {
    const out = [];
    for (const u of this.heroes.values()) if (u.alive && !u.finished) out.push(u);
    for (const w of this.wards) if (w.alive) out.push(w);
    for (const t of this.traps) if (t.alive) out.push(t);
    return out;
  }

  strike(g, t) {
    this.ev({ k: 'hit', x: round2(t.x), y: round2(t.y) });
    const dmg = 10 + Math.floor(Math.random() * 2);
    if (this.heroes.get(t.owner) === t) return this.damage(t.owner, dmg, 'death');
    t.hp -= dmg;
    if (t.hp <= 0) {
      t.alive = false;
      this.ev({ k: 'fizzle', x: round2(t.x), y: round2(t.y), c: '#9fd0ff' });
    }
  }

  // A guard is visible to a player inside the detection of one of their wards.
  seenBy(pid, g) {
    return this.wards.some((w) => w.o === pid && dist(w.x, w.y, g.x, g.y) <= WARD.sight);
  }

  // The original AI, every 0.5 s: with a guard (whose position the script
  // reads, invisible or not) within 200, move 256 u straight away from a
  // random one; otherwise head for the finish. A 1-in-16 chance per tick of
  // a Sentry Ward 256 u ahead toward the finish, +-45 degrees. No traps.
  //
  // That bot rarely gets through (the guards cover about 64 % of the band),
  // so only the least skilled bots play it. The others plan a path that keeps
  // clear of every guard's reach and, when the band is sealed, plant a
  // Stasis Trap by the nearest guard and run through while it is stunned.
  botThink(pid, u, mem) {
    if (this.time < BOT_START) return;
    mem.t = (mem.t ?? rand(0, 0.5)) - 0.25;
    if (mem.t > 0) return;
    mem.t = 0.5;
    if (mem.skill >= 0.5) return this.planBot(pid, u, mem);
    const near = this.guards.filter((g) => dist(g.x, g.y, u.x, u.y) <= wc3(200));
    if (near.length) {
      const g = pick(near);
      const d = dist(g.x, g.y, u.x, u.y) || 0.01;
      u.path = null;
      u.order(u.x + ((u.x - g.x) / d) * wc3(256), u.y + ((u.y - g.y) / d) * wc3(256));
    } else {
      u.path = null;
      u.order(this.goal.x, this.goal.y);
    }
    if (Math.random() < 1 / 16 && this.mana.get(pid) >= WARD.cost) {
      const a = Math.atan2(this.goal.y - u.y, this.goal.x - u.x) + rand(-Math.PI / 4, Math.PI / 4);
      this.useAbility(pid, 0, u.x + Math.cos(a) * wc3(256), u.y + Math.sin(a) * wc3(256));
    }
  }

  // A pathing grid (32 u cells) where every guard that will be awake within
  // `soon` seconds blocks its reach plus a margin.
  dangerGrid(soon, exclude = null, k = 1) {
    const s = wc3(32);
    const cols = Math.ceil((HW * 2) / s);
    const rows = Math.ceil((HH * 2) / s);
    const reach = (GUARD.r + GUARD_ATTACK.range + DOC.r + wc3(28)) * k;
    const awake = this.guards.filter((g) => g.stun < soon && !exclude?.has(g));
    const lines = [];
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < cols; c++) {
        const x = -HW + (c + 0.5) * s;
        const y = -HH + (r + 0.5) * s;
        const [gc, gr] = this.grid.cellOf(x, y);
        line += this.grid.blocked(gc, gr) || awake.some((g) => dist(g.x, g.y, x, y) < reach) ? '#' : '.';
      }
      lines.push(line);
    }
    return new WalkGrid(lines, { cell: s, x0: -HW, y0: -HH, blocked: '#' });
  }

  // Guards busy hacking at a ward or trap that will last a while yet: they
  // keep at it, so a doctor can pass them.
  busyGuards() {
    const lasts = (t) => t.alive && t.hp > 25 && (!this.wards.includes(t) || t.t > 1.5);
    return new Set(this.guards.filter((g) => g.victim && (this.wards.includes(g.victim) || this.traps.includes(g.victim)) && lasts(g.victim)));
  }

  planBot(pid, u, mem) {
    const busy = this.busyGuards();
    const G = this.dangerGrid(2.5, busy);
    const pts = G.path(u.x, u.y, this.goal.x, this.goal.y, u.r);
    const end = pts[pts.length - 1];
    const through = end && dist(end.x, end.y, this.goal.x, this.goal.y) < 0.3;
    // Sealed in with no trap left to open it (none of ours or anyone's
    // pending): after a short wait, chance it along the plain way. A guard
    // that has just swung needs 1.35 s before the next, so a stream of
    // doctors gets some through.
    if (mem.chance) return;
    if (!through && this.mana.get(pid) < TRAP.cost && !this.traps.length) {
      mem.sealedT = (mem.sealedT || 0) + 0.5;
      // A guard that has just swung (at someone else) cannot strike again
      // for a moment: slip past it.
      const spent = new Set(this.guards.filter((g) => g.atkCd > 0.9 || g.stun > 1.5));
      if (spent.size) {
        const D = this.dangerGrid(2.5, spent);
        const way = D.path(u.x, u.y, this.goal.x, this.goal.y, u.r);
        const last = way[way.length - 1];
        if (last && dist(last.x, last.y, this.goal.x, this.goal.y) < 0.3) {
          const first = way.shift();
          u.path = way;
          u.pathGrid = D;
          if (u.target) u.steer(first.x, first.y);
          else u.order(first.x, first.y);
          return;
        }
      }
      mem.chanceAt ??= 3 + rand(0, 4);
      if (mem.sealedT > mem.chanceAt) {
        // The way that brushes the fewest guards' reach.
        mem.chance = true;
        for (const k of [0.8, 0.6, 0.45]) {
          const D = this.dangerGrid(2.5, null, k);
          const way = D.path(u.x, u.y, this.goal.x, this.goal.y, u.r);
          const last = way[way.length - 1];
          if (last && dist(last.x, last.y, this.goal.x, this.goal.y) < 0.3) {
            const first = way.shift();
            u.path = way;
            u.pathGrid = D;
            u.order(first.x, first.y);
            return;
          }
        }
        u.pathGrid = null;
        pathTo(u, this.grid, this.goal.x, this.goal.y);
        return;
      }
    } else mem.sealedT = 0;
    if (through) {
      const first = pts.shift();
      u.path = pts;
      u.pathGrid = G;
      if (u.target) u.steer(first.x, first.y);
      else u.order(first.x, first.y);
      return;
    }
    // Sealed. Walk to the safe spot nearest the finish and wait there, and
    // trap the guard in front if a trap is affordable and none is pending.
    if (end && (!u.target || dist(u.target.x, u.target.y, end.x, end.y) > 0.5)) {
      u.path = pts.slice(1);
      u.pathGrid = G;
      if (pts.length) u.order(pts[0].x, pts[0].y);
    }
    // A ward planted at a guard's feet keeps it busy (it hacks at the ward
    // for the ward's whole life): the cheapest way to open a gap.
    if (this.mana.get(pid) >= WARD.cost && !(mem.decoyT > this.time)) {
      const cands = this.guards.filter((g) => g.stun <= 0 && !busy.has(g) && dist(g.x, g.y, u.x, u.y) < WARD.range + wc3(150)).sort((p, q) => dist(p.x, p.y, u.x, u.y) - dist(q.x, q.y, u.x, u.y)).slice(0, 6);
      for (const g of cands) {
        const d = dist(g.x, g.y, u.x, u.y) || 0.01;
        const off = g.r + wc3(16) + wc3(40);
        const wx = g.x + ((u.x - g.x) / d) * off;
        const wy = g.y + ((u.y - g.y) / d) * off;
        if (dist(u.x, u.y, wx, wy) > WARD.range) continue;
        const G2 = this.dangerGrid(2.5, new Set([...busy, g]));
        const p2 = G2.path(u.x, u.y, this.goal.x, this.goal.y, u.r);
        const e2 = p2[p2.length - 1];
        if (e2 && dist(e2.x, e2.y, this.goal.x, this.goal.y) < 0.3) {
          mem.decoyT = this.time + 1.5;
          this.useAbility(pid, 0, wx, wy);
          return;
        }
      }
    }
    // Wait for a trap already set (anyone's) to go off.
    if (this.traps.some((t) => t.t < TRAP.arm + 1) || this.mana.get(pid) < TRAP.cost) return;
    // Try a trap 200 u in front of each nearby guard: the first spot whose
    // stun would open a way through is the one to use.
    const near = this.guards.filter((g) => g.stun <= 0).sort((p, q) => dist(p.x, p.y, u.x, u.y) - dist(q.x, q.y, u.x, u.y)).slice(0, 8);
    let spot = null;
    for (const g of near) {
      const d = dist(g.x, g.y, u.x, u.y) || 0.01;
      const tx = g.x + ((u.x - g.x) / d) * wc3(200);
      const ty = g.y + ((u.y - g.y) / d) * wc3(200);
      if (dist(u.x, u.y, tx, ty) > TRAP.range) continue;
      spot ??= [tx, ty];
      const hit = new Set(this.guards.filter((h) => dist(h.x, h.y, tx, ty) <= TRAP.blast + h.r));
      const G2 = this.dangerGrid(2.5, hit);
      const p2 = G2.path(u.x, u.y, this.goal.x, this.goal.y, u.r);
      const e2 = p2[p2.length - 1];
      if (e2 && dist(e2.x, e2.y, this.goal.x, this.goal.y) < 0.3) {
        spot = [tx, ty];
        break;
      }
    }
    if (spot) this.useAbility(pid, 1, spot[0], spot[1]);
  }

  abilitiesSnap(pid) {
    const list = super.abilitiesSnap(pid);
    const mana = this.mana.get(pid) ?? 0;
    [WARD.cost, TRAP.cost].forEach((cost, i) => {
      if (!list[i]) return;
      list[i].left = Math.floor(mana / cost);
      list[i].empty = mana < cost;
    });
    return list;
  }

  hud(pid) {
    const m = this.mana.get(pid);
    return m == null ? null : { label: `Mana ${Math.floor(m)} / ${MANA}` };
  }

  worldEnts(pid) {
    const ents = [];
    for (const g of this.guards) {
      if (!this.seenBy(pid, g)) continue;
      const e = { id: g.id, k: 'guardian', x: round2(g.x), y: round2(g.y), f: round2(g.facing) };
      if (g.swing) e.sw = 1;
      if (g.stun > 0) e.st = 1;
      ents.push(e);
    }
    for (const w of this.wards) ents.push({ id: w.id, k: 'sentryward', x: round2(w.x), y: round2(w.y), f: 0, o: w.o, t: round1(w.t), r: pid === w.o ? round2(WARD.sight) : undefined });
    for (const t of this.traps) ents.push({ id: t.id, k: 'stasistrap', x: round2(t.x), y: round2(t.y), f: 0, o: t.o, armed: t.t >= TRAP.arm ? 1 : undefined });
    ents.push({ id: this.circleId, k: 'powercircle', x: round2(this.goal.x), y: 0, f: 0, s: 1 });
    return ents;
  }
}
