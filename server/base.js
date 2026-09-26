// Base class for Hammerguy's Party minigames. Each player controls a
// hammer-wielding paladin (a "hammerguy") with right-click movement; some games add a "Q" ability.
// A minigame produces a ranking (groups of tied player ids, best first) that
// the party turns into points.

import { Unit, stepUnits, collideUnits, dist, rand, round1, round2, unitSnap } from '../engine/server/sim.js';

export const SHOVE = { cd: 3, radius: 2.6, force: 11 };

export class Minigame {
  // Subclasses define: static id, name, desc, controls, duration, ranking ('survival'|'race'|'score')
  constructor(party, pids) {
    this.party = party;
    this.pids = pids;
    this.heroes = new Map(); // pid -> Unit
    this.time = 0;
    this.done = false;
    this.elimOrder = []; // [{pid, t}]
    this.finishOrder = [];
    this.scores = new Map(pids.map((p) => [p, 0]));
    this.cds = new Map(pids.map((p) => [p, 0]));
    this.bots = new Map(pids.filter((p) => party.room.isBot(p)).map((p) => [p, { think: rand(0, 0.3), mem: { skill: rand(0.45, 0.9) } }]));
    this.shove = null; // set to {cd, radius, force} to enable the Q ability
    this.friction = 2.4;
  }

  get meta() {
    return this.constructor;
  }

  // Spawn one paladin per player at the given positions.
  spawnHeroes(positions, opts = {}) {
    this.pids.forEach((pid, i) => {
      const [x, y] = positions[i % positions.length];
      const u = new Unit({ kind: 'paladin', owner: pid, x, y, r: 0.55, speed: opts.speed || 5 });
      u.facing = opts.facing ?? Math.atan2(-y, -x);
      this.heroes.set(pid, u);
    });
  }

  ringPositions(radius) {
    const n = this.pids.length;
    const off = rand(0, Math.PI * 2);
    return this.pids.map((_, i) => {
      const a = off + (i / n) * Math.PI * 2;
      return [Math.cos(a) * radius, Math.sin(a) * radius];
    });
  }

  gridPositions(cx, cy, spacing = 2) {
    const n = this.pids.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    return this.pids.map((_, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      return [cx + (c - (cols - 1) / 2) * spacing, cy + (r - (rows - 1) / 2) * spacing];
    });
  }

  get alive() {
    return [...this.heroes.entries()].filter(([, u]) => u.alive).map(([pid]) => pid);
  }

  eliminate(pid, how = 'death') {
    const u = this.heroes.get(pid);
    if (!u || !u.alive) return;
    u.alive = false;
    u.target = null;
    this.elimOrder.push({ pid, t: this.time });
    this.ev({ k: how, x: round1(u.x), y: round1(u.y), u: u.id });
    this.party.msg(`${this.party.room.nameOf(pid)} is out!`, this.party.room.colorOf(pid));
  }

  finish(pid) {
    if (this.finishOrder.includes(pid)) return;
    this.finishOrder.push(pid);
    const u = this.heroes.get(pid);
    u.target = null;
    u.finished = true;
    const place = this.finishOrder.length;
    this.ev({ k: 'txt', x: round1(u.x), y: round1(u.y), s: ['1st!', '2nd!', '3rd!'][place - 1] || `${place}th`, c: '#ffd700' });
    this.ev({ k: 'sfx', s: 'win', to: pid });
  }

  addScore(pid, n, x, y) {
    this.scores.set(pid, (this.scores.get(pid) || 0) + n);
    if (x != null) this.ev({ k: 'txt', x: round1(x), y: round1(y), s: `+${n}`, c: '#ffd700' });
  }

  command(pid, m) {
    const u = this.heroes.get(pid);
    if (!u || !u.alive || u.finished) return;
    if (m.c === 'move') u.order(+m.x || 0, +m.y || 0);
    else if (m.c === 'stop') u.stop();
    else if (m.c === 'cast' && this.shove) this.doShove(pid);
  }

  doShove(pid) {
    const u = this.heroes.get(pid);
    if (!u?.alive || this.cds.get(pid) > 0) return;
    const sh = this.shove;
    this.cds.set(pid, sh.cd);
    this.ev({ k: 'shove', x: round1(u.x), y: round1(u.y), r: sh.radius });
    for (const [, v] of this.heroes) {
      if (v === u || !v.alive) continue;
      const d = dist(u.x, u.y, v.x, v.y);
      if (d < sh.radius + v.r) v.knock(v.x - u.x || 0.01, v.y - u.y, sh.force * (1 - 0.35 * (d / sh.radius)));
    }
  }

  // Standard per-tick hero update. Subclasses call this from tick().
  stepHeroes(dt) {
    for (const [pid, cd] of this.cds) if (cd > 0) this.cds.set(pid, cd - dt);
    for (const [pid, b] of this.bots) {
      const u = this.heroes.get(pid);
      if (!u?.alive || u.finished) continue;
      b.think -= dt;
      if (b.think <= 0) {
        b.think = rand(0.15, 0.3);
        this.botThink(pid, u, b.mem);
      }
    }
    const list = [...this.heroes.values()];
    stepUnits(list, dt, { friction: this.friction });
    collideUnits(list);
  }

  botThink() {}

  // Returns groups of player ids, best first.
  ranking() {
    const kind = this.meta.ranking;
    if (kind === 'score') {
      const sorted = [...this.scores.entries()].sort((a, b) => b[1] - a[1]);
      const groups = [];
      let last = null;
      for (const [pid, sc] of sorted) {
        if (last !== null && Math.abs(sc - last) < 1e-6) groups[groups.length - 1].push(pid);
        else groups.push([pid]);
        last = sc;
      }
      return groups;
    }
    if (kind === 'race') {
      const groups = this.finishOrder.map((p) => [p]);
      const rest = this.pids.filter((p) => !this.finishOrder.includes(p));
      rest.sort((a, b) => this.progress(b) - this.progress(a));
      for (const p of rest) groups.push([p]);
      return groups;
    }
    // survival: survivors tie for first, then later eliminations rank higher.
    const groups = [];
    const alive = this.alive;
    if (alive.length) groups.push(alive);
    const elim = [...this.elimOrder].reverse();
    for (const e of elim) {
      const g = groups[groups.length - 1];
      const prev = g && elim.find((x) => x.pid === g[0]);
      if (prev && Math.abs(prev.t - e.t) < 0.05) g.push(e.pid);
      else groups.push([e.pid]);
    }
    return groups;
  }

  progress() {
    return 0;
  }

  isDone() {
    if (this.done || this.time >= this.meta.duration) return true;
    if (this.meta.ranking === 'survival') {
      const a = this.alive.length;
      return this.pids.length > 1 ? a <= 1 : a === 0;
    }
    if (this.meta.ranking === 'race') return this.finishOrder.length === this.pids.length;
    return false;
  }

  heroEnts(pid) {
    const ents = [];
    for (const [hp, u] of this.heroes) {
      const fx = [];
      if (u.finished) fx.push('finished');
      if (this.party.hasBomb?.(hp)) fx.push('bomb');
      const extra = fx.length ? { fx } : {};
      ents.push(unitSnap(u, extra));
    }
    return ents;
  }

  // Subclasses return extra non-hero entities.
  worldEnts() {
    return [];
  }

  hud() {
    return null;
  }

  snapshot(pid) {
    const cd = this.cds.get(pid) || 0;
    return {
      ents: [...this.heroEnts(pid), ...this.worldEnts(pid)],
      hud: this.hud(pid),
      scores: this.meta.ranking === 'score' ? Object.fromEntries([...this.scores].map(([k, v]) => [k, Math.floor(v)])) : null,
      ability: this.shove ? { name: this.shoveName || 'Holy Shove', key: 'Q', cd: round2(Math.max(0, cd)), max: this.shove.cd } : null,
    };
  }

  ev(e) {
    this.party.ev(e);
  }
}
