import { Minigame } from '../../base.js';
import { newId, rand, dist, clamp, round2, wc3 } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';
import { pushOutRect, box, arrive, withoutGone, raceLabel } from './race-kit.js';

// Uther Party 4.0 #33 "Quillboar Mile" (docs/uther-party/rules-4.0.md): a
// 1024x2048 run north past six Quillboar Hunters, three at random heights in
// each side strip. The hunters never move; they throw slow quills (400 u/s,
// 1.6 s cooldown, 0.6 s wind-up, reach 400 + 31 + 15 u) at the nearest pig,
// and one quill kills a 10 HP pig. Quills are "missile (splash)" with no
// splash, which WC3 aims at where the target will be if it holds its course
// (engine.md, Way of the Bow): change course after the throw and it misses.
// Race: 8, 7, 6 ..., 60 s.
//
// Coordinates: arena-centre offsets (dx, dy) map to (wc3(dx), -wc3(dy)).

const Q = (dx, dy) => [wc3(dx), -wc3(dy)];
const HW = wc3(512);
const HH = wc3(1024);
export const PIG = { speed: wc3(190), r: wc3(15), hp: 10 };
export const HUNTER = { r: wc3(31), range: wc3(400), cd: 1.6, point: 0.6, missile: wc3(400), dmg: [21, 25] };
// Hit test at the aim point: the victim's collision circle must cover it.
const HIT_SLOP = wc3(4);
const FINISH = Q(0, 896);
const FINISH_HALF = wc3(64);

// Tree clumps from the arena's pathing (128x128 each, centre offsets): a
// broken hedge along both sides of the corridor, and the corner clumps.
const CLUMPS = [
  ...[520, 327, 133, -60, -253, -447].flatMap((y) => [[-192, y], [192, y]]),
  [-256, 714], [256, 714], [-256, -640], [256, -640],
  [-448, 964], [448, 964], [-448, 778], [448, 778], [-448, -770], [448, -770], [-448, -960], [448, -960],
];
const BLOCKS = CLUMPS.map(([x, y]) => box(...Q(x - 64, y - 64), ...Q(x + 64, y + 64)));

export class QuillboarMile extends Minigame {
  static id = 'quillboar';
  static name = 'Quillboar Mile';
  static desc = 'Reach the end! Run your piggy up the mile past the quillboar hunters. Their quills are slow and aimed at where you are heading, so keep changing course and they sail past. One quill and you are bacon.';
  static controls = 'Right-click to move. Zig-zag: a quill flies to where you would be if you ran straight on.';
  static duration = 60;
  static ranking = 'race';

  setup() {
    this.hunters = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const [x, y] = Q(side * rand(256 + 31, 448 - 31), rand(-512 + 31, 640 - 31));
        this.hunters.push({ id: newId(), x, y, f: side < 0 ? 0 : Math.PI, cd: 0, wind: -1, tgt: null });
      }
    }
    this.map = {
      theme: 'grass',
      floor: { shape: 'rect', w: HW * 2, h: HH * 2 },
      props: [...treesAroundRect(HW, HH, 0.45, 2.2), ...CLUMPS.map(([x, y]) => {
        const [cx, cy] = Q(x, y);
        return { t: 'tree', x: cx + rand(-0.2, 0.2), y: cy + rand(-0.2, 0.2), s: rand(0.8, 1.0) };
      })],
      build: ['quillboar'],
      qb: { finish: FINISH.map(round2), half: round2(FINISH_HALF), strips: [[-448, -256], [256, 448]].map(([a, b]) => [round2(wc3(a)), round2(wc3(b))]), sy: [round2(Q(0, 640)[1]), round2(Q(0, -512)[1])] },
      bounds: HH + 1,
    };
    // Pigs start anywhere in a 128x64 box 32 u above the south edge, facing north.
    this.spawnHeroes(this.pids.map(() => Q(rand(-64 + 15, 64 - 15), rand(-992, -928))), { ...PIG, facing: -Math.PI / 2 });
    for (const u of this.heroes.values()) u.skin = 'piggy';
    this.quills = [];
    this.aiT = 5;
    this.copId = newId();
  }

  tick(dt) {
    this.stepHeroes(dt);
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.finished) continue;
      u.x = clamp(u.x, -HW + u.r, HW - u.r);
      u.y = clamp(u.y, -HH + u.r, HH - u.r);
      for (const b of BLOCKS) pushOutRect(u, b);
      for (const h of this.hunters) {
        const d = dist(u.x, u.y, h.x, h.y);
        const min = u.r + HUNTER.r;
        if (d < min) {
          u.x = h.x + ((u.x - h.x) / (d || 0.01)) * min;
          u.y = h.y + ((u.y - h.y) / (d || 0.01)) * min;
        }
      }
      if (Math.abs(u.x - FINISH[0]) <= FINISH_HALF && Math.abs(u.y - FINISH[1]) <= FINISH_HALF) arrive(this, pid);
    }
    for (const h of this.hunters) this.stepHunter(h, dt);
    for (const q of this.quills) {
      const d = dist(q.x, q.y, q.tx, q.ty);
      const step = HUNTER.missile * dt;
      if (d <= step) {
        q.done = true;
        this.land(q);
        continue;
      }
      q.x += ((q.tx - q.x) / d) * step;
      q.y += ((q.ty - q.y) / d) * step;
    }
    this.quills = this.quills.filter((q) => !q.done);

    // Computer pigs: at 4 s, off to the finish; from 5 s, every 1 s a 100 u
    // jink at a random angle between east and west through north, then back
    // on course 0.2 s later.
    if (this.time >= 4 && !this.sent) {
      this.sent = true;
      for (const [pid] of this.bots) this.heroes.get(pid).order(...FINISH);
    }
    if (this.time >= this.aiT) {
      this.aiT += 1;
      for (const [pid, b] of this.bots) {
        const u = this.heroes.get(pid);
        if (!u.alive || u.finished) continue;
        const a = rand(0, Math.PI);
        u.order(u.x + Math.cos(a) * wc3(100), u.y - Math.sin(a) * wc3(100));
        b.mem.back = this.time + 0.2;
      }
    }
  }

  // Bots go back on course 0.2 s after each jink (see tick). The original's
  // random jink is their only dodge; ours also notice some of the quills
  // thrown at them (the more skilled, the more) and sidestep after a
  // reaction delay, as the designer tells players to.
  botThink(pid, u, mem) {
    if (mem.dodge != null && this.time >= mem.dodge) {
      mem.dodge = null;
      const side = Math.random() < 0.5 ? 1 : -1;
      const a = -Math.PI / 2 + side * rand(0.9, 1.4);
      u.order(u.x + Math.cos(a) * wc3(80), u.y + Math.sin(a) * wc3(80));
      mem.back = this.time + 0.25;
      return;
    }
    if (mem.back != null && this.time >= mem.back) {
      mem.back = null;
      u.order(...FINISH);
    }
  }

  stepHunter(h, dt) {
    if (h.cd > 0) h.cd -= dt;
    const reach = (u) => dist(h.x, h.y, u.x, u.y) <= HUNTER.range + HUNTER.r + u.r;
    if (h.wind >= 0) {
      h.wind += dt;
      if (h.tgt) h.f = Math.atan2(h.tgt.y - h.y, h.tgt.x - h.x);
      if (h.wind >= HUNTER.point) {
        h.wind = -1;
        if (h.tgt?.alive && !h.tgt.finished) this.throwQuill(h, h.tgt);
      }
      return;
    }
    if (!(h.tgt?.alive && !h.tgt.finished && reach(h.tgt))) {
      h.tgt = null;
      let bd = Infinity;
      for (const u of this.heroes.values()) {
        if (!u.alive || u.finished || !reach(u)) continue;
        const d = dist(h.x, h.y, u.x, u.y);
        if (d < bd) {
          bd = d;
          h.tgt = u;
        }
      }
    }
    if (!h.tgt) return;
    h.f = Math.atan2(h.tgt.y - h.y, h.tgt.x - h.x);
    if (h.cd <= 0) {
      h.cd = HUNTER.cd;
      h.wind = 0;
      this.ev({ k: 'swing', u: h.id });
    }
  }

  // Aim where the pig will be when the quill arrives if it keeps its current
  // velocity (a few fixed-point steps of the flight time).
  throwQuill(h, u) {
    let tx = u.x;
    let ty = u.y;
    for (let i = 0; i < 4; i++) {
      const t = dist(h.x, h.y, tx, ty) / HUNTER.missile;
      tx = u.x + u.mx * t;
      ty = u.y + u.my * t;
    }
    const dmg = (HUNTER.dmg[0] + Math.floor(Math.random() * (HUNTER.dmg[1] - HUNTER.dmg[0] + 1))) * 0.75;
    this.quills.push({ id: newId(), x: h.x, y: h.y, sx: h.x, sy: h.y, tx, ty, dmg });
    const b = this.bots.get(u.owner);
    if (b && Math.random() < b.mem.skill * 0.8) b.mem.dodge = this.time + rand(0.15, 0.4);
    this.ev({ k: 'sfx', s: 'boomerang' });
  }

  land(q) {
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.finished) continue;
      if (dist(u.x, u.y, q.tx, q.ty) <= u.r + HIT_SLOP) {
        this.ev({ k: 'hit', x: round2(u.x), y: round2(u.y) });
        this.damage(pid, q.dmg, 'death');
        return;
      }
    }
    this.ev({ k: 'quillmiss', x: round2(q.tx), y: round2(q.ty), f: round2(Math.atan2(q.ty - q.sy, q.tx - q.sx)) });
  }

  progress(pid) {
    return -this.heroes.get(pid).y;
  }

  heroEnts(pid) {
    return withoutGone(this, super.heroEnts(pid));
  }

  worldEnts() {
    const ents = this.hunters.map((h) => ({ id: h.id, k: 'quillboar', x: round2(h.x), y: round2(h.y), f: round2(h.f), w: h.wind >= 0 ? round2(h.wind / HUNTER.point) : undefined }));
    ents.push({ id: this.copId, k: 'cop', x: round2(FINISH[0]), y: round2(FINISH[1]), s: 1, r: 1.1 });
    for (const q of this.quills) ents.push({ id: q.id, k: 'quill', x: round2(q.x), y: round2(q.y), f: round2(Math.atan2(q.ty - q.sy, q.tx - q.sx)), p: round2(1 - dist(q.x, q.y, q.tx, q.ty) / (dist(q.sx, q.sy, q.tx, q.ty) || 1)) });
    return ents;
  }

  hud(pid) {
    return { label: raceLabel(this, pid) };
  }
}
