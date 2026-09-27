// Base class for Hammerguy's Party minigames. Each player controls a
// hammer-wielding paladin (a "hammerguy") with right-click movement; some games add a "Q" ability.
// A minigame decides how many points each player earns using Uther Party's
// "ante" rules (see payouts()).

import { Unit, stepUnits, collideUnits, dist, rand, round1, round2, unitSnap, wc3, newId } from '../engine/server/sim.js';

export const SHOVE = { cd: 3, radius: 2.6, force: 11 };

// Uther Party's player unit is a Paladin: speed 270, turn rate 0.6, collision 31.
export const PALADIN = { speed: wc3(270), r: wc3(31), turnRate: 0.6 };

export class Minigame {
  // Subclasses define: static id, name, desc, controls, duration, ranking ('survival'|'race'|'score').
  // `duration` is the in-game timer. Survival games with no timer in the
  // original set `static timer = false`, and `duration` is only a safety cap.
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
    this.spell = null; // or a targeted spell: {name, icon, desc, cd, charges, range, castPoint, cast(pid, u, x, y)}
    // Or up to four abilities on Q W E R (see useAbility). Each:
    //   { name, icon, desc, kind: 'instant' | 'point' | 'unit', cd, charges, range, castPoint,
    //     pickTarget(pid, u, x, y) -> {x, y, u?} | null, cast(pid, u, tgt), available(pid) -> bool }
    // 'instant' fires at once (or after castPoint) on the caster; 'point' and 'unit' turn
    // to face the target first, WC3 style. Per-player cooldowns and charges are kept here.
    this.abilities = [];
    this.acd = new Map(pids.map((p) => [p, [0, 0, 0, 0]]));
    this.acharges = new Map();
    // WC3 attacks: right-click on something attackable to attack it (see stepAttacks).
    //   { range, cd, point (damage point, s), dmg, missile (speed, or 0 for melee), art }
    this.attack = null;
    this.missiles = [];
    this.charges = new Map();
    this.friction = 2.4;
  }

  get meta() {
    return this.constructor;
  }

  // Spawn one paladin per player at the given positions. `opts` carries the
  // original unit's stats: speed, r (collision), hp, regen, turnRate.
  spawnHeroes(positions, opts = {}) {
    this.pids.forEach((pid, i) => {
      const [x, y] = positions[i % positions.length];
      const u = new Unit({ kind: 'paladin', owner: pid, x, y, r: opts.r ?? PALADIN.r, speed: opts.speed ?? PALADIN.speed, hp: opts.hp || 0 });
      u.turnRate = opts.turnRate ?? PALADIN.turnRate;
      u.regen = opts.regen || 0;
      u.setFacing(opts.facing ?? Math.atan2(-y, -x));
      this.heroes.set(pid, u);
    });
    if (this.spell?.charges) for (const pid of this.pids) this.charges.set(pid, this.spell.charges);
    for (const pid of this.pids) this.acharges.set(pid, this.abilities.map((a) => a.charges ?? null));
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
    u.walking = false;
    u.cast = null;
    this.elimOrder.push({ pid, t: this.time });
    this.ev({ k: how, x: round1(u.x), y: round1(u.y), u: u.id });
    this.party.msg(`${this.party.room.nameOf(pid)} is out!`, this.party.room.colorOf(pid));
  }

  // Deals damage to a hero with HP; kills it at 0.
  damage(pid, amount, how = 'death') {
    const u = this.heroes.get(pid);
    if (!u?.alive || amount <= 0) return;
    u.hp -= amount;
    if (amount >= 1) this.ev({ k: 'dmg', x: round1(u.x), y: round1(u.y), n: Math.round(amount) });
    if (u.hp <= 0) {
      u.hp = 0;
      this.eliminate(pid, how);
    }
  }

  finish(pid) {
    if (this.finishOrder.includes(pid)) return;
    this.finishOrder.push(pid);
    const u = this.heroes.get(pid);
    u.target = null;
    u.walking = false;
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
    if (m.c === 'attack') {
      // Touch: a tap on a unit. Attacks it if it can be attacked; never moves.
      const tgt = this.attack ? this.attackTargetAt(pid, +m.x || 0, +m.y || 0) : null;
      if (tgt) {
        u.attackOrder = tgt;
        if (u.cast) u.cast.queued = null;
      }
      return;
    }
    if (this.attack && (m.c === 'move' || m.c === 'stop')) {
      // A right-click on something attackable is an attack order; anything else cancels it.
      const tgt = m.c === 'move' ? this.attackTargetAt(pid, +m.x || 0, +m.y || 0) : null;
      u.attackOrder = tgt;
      if (tgt) {
        if (u.cast) u.cast.queued = null;
        return;
      }
    } else if (m.c === 'steer') u.attackOrder = null;
    if (m.c === 'move' || m.c === 'steer' || m.c === 'stop') {
      // Orders given during a cast point wait for it: a right-click does not cancel it.
      if (u.cast) u.cast.queued = m.c === 'stop' ? 'stop' : { x: +m.x || 0, y: +m.y || 0 };
      else if (m.c === 'move') u.order(+m.x || 0, +m.y || 0);
      else if (m.c === 'steer') u.steer(+m.x || 0, +m.y || 0);
      else u.stop();
    } else if (m.c === 'cast') {
      if (this.abilities.length) return this.useAbility(pid, slotOf(m), +m.x || 0, +m.y || 0);
      if (this.shove) this.doShove(pid);
      else if (this.spell) this.castSpell(pid, +m.x || 0, +m.y || 0);
    }
  }

  // A targeted spell, WC3 style: turn to face the target without walking, start
  // the cast on the step after the heading reaches it, stand still for the cast
  // point, then the effect.
  castSpell(pid, x, y) {
    const u = this.heroes.get(pid);
    const sp = this.spell;
    if (!u?.alive || u.cast || (this.cds.get(pid) || 0) > 0) return;
    if (sp.charges && !(this.charges.get(pid) > 0)) return;
    const tgt = sp.pickTarget ? sp.pickTarget(pid, u, x, y) : { x, y };
    if (!tgt) return;
    u.stop();
    u.cast = { tgt, angle: Math.atan2(tgt.y - u.y, tgt.x - u.x), t: -1 };
    u.faceTo = u.cast.angle;
  }

  // Uses ability `slot` (0-3 = Q W E R) at the clicked point.
  useAbility(pid, slot, x, y) {
    const u = this.heroes.get(pid);
    const ab = this.abilities[slot];
    if (!ab || !u?.alive || u.cast) return;
    if ((this.acd.get(pid)?.[slot] || 0) > 0) return;
    const left = this.acharges.get(pid)?.[slot];
    if (left != null && left <= 0) return;
    if (ab.available && !ab.available(pid)) return;
    if (ab.kind === 'instant' || ab.kind === 'self') {
      const tgt = { x: u.x, y: u.y, u };
      if (!ab.castPoint) return this.finishAbility(pid, u, ab, slot, tgt);
      u.stop();
      u.cast = { tgt, angle: u.heading, t: 0, ab, slot };
      return;
    }
    const tgt = ab.pickTarget ? ab.pickTarget(pid, u, x, y) : { x, y };
    if (!tgt) return;
    u.stop();
    u.attackOrder = null;
    u.cast = { tgt, angle: Math.atan2(tgt.y - u.y, tgt.x - u.x), t: -1, ab, slot };
    u.faceTo = u.cast.angle;
  }

  finishAbility(pid, u, ab, slot, tgt) {
    this.acd.get(pid)[slot] = ab.cd || 0;
    const ch = this.acharges.get(pid);
    if (ch && ch[slot] != null) ch[slot]--;
    ab.cast(pid, u, tgt);
  }

  stepCasts(dt) {
    for (const [pid, u] of this.heroes) {
      const c = u.cast;
      if (!c || !u.alive) continue;
      const sp = c.ab || this.spell;
      if (!sp) continue;
      if (c.t < 0) {
        // Keep facing a moving unit target while turning.
        if (c.tgt.u) {
          c.angle = Math.atan2(c.tgt.u.y - u.y, c.tgt.u.x - u.x);
          u.faceTo = c.angle;
        }
        // A moving unit target shifts a little between steps; close enough counts.
        if (u.facingAt(c.angle, c.tgt.u ? 0.08 : 1e-4)) {
          c.t = 0;
          u.faceTo = null;
        }
        continue;
      }
      c.t += dt;
      if (c.t < (sp.castPoint || 0)) continue;
      u.cast = null;
      if (c.ab) this.finishAbility(pid, u, c.ab, c.slot, c.tgt);
      else {
        this.cds.set(pid, sp.cd || 0);
        if (sp.charges) this.charges.set(pid, this.charges.get(pid) - 1);
        sp.cast(pid, u, c.tgt);
      }
      if (c.queued === 'stop') u.stop();
      else if (c.queued) u.order(c.queued.x, c.queued.y);
    }
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
  // Everything a hero may attack: other living heroes by default. Games with
  // attackable creatures override this to add them (units with hp).
  attackables(pid) {
    return [...this.heroes.values()].filter((v) => v.alive && v.owner !== pid);
  }

  // The attackable unit under a right-click, if any (a generous click radius).
  attackTargetAt(pid, x, y) {
    let best = null;
    let bd = Infinity;
    for (const v of this.attackables(pid)) {
      const d = dist(x, y, v.x, v.y) - v.r;
      if (d < 0.9 && d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  // WC3 attack orders: walk into range, turn to face, then swing. The hit is
  // decided when the swing starts (engine.md: melee commits), and lands after
  // the damage point; ranged attacks fire a homing missile then.
  stepAttacks(dt) {
    const A = this.attack;
    if (!A) return;
    for (const [pid, u] of this.heroes) {
      if (u.atkCd > 0) u.atkCd -= dt;
      if (u.swing) {
        u.swing.t += dt;
        if (u.swing.t >= (A.point ?? 0.3)) {
          const tgt = u.swing.tgt;
          u.swing = null;
          if (A.missile) this.missiles.push({ id: newId(), x: u.x, y: u.y, tgt, pid, speed: A.missile, art: A.art || 'arrow' });
          else if (tgt.alive) this.attackHit(pid, u, tgt);
        }
        continue;
      }
      const t = u.attackOrder;
      if (!t) continue;
      if (!u.alive || !t.alive || u.cast) {
        if (!t.alive) u.attackOrder = null;
        continue;
      }
      const gap = dist(u.x, u.y, t.x, t.y) - u.r - t.r;
      if (gap > (A.range ?? 0.4)) {
        if (u.target) u.steer(t.x, t.y);
        else u.order(t.x, t.y);
        continue;
      }
      if (u.target) u.stop();
      const ang = Math.atan2(t.y - u.y, t.x - u.x);
      if (!u.facingAt(ang, 0.35)) {
        u.faceTo = ang;
        continue;
      }
      u.faceTo = null;
      if (u.atkCd > 0) continue;
      u.atkCd = A.cd ?? 1.5;
      u.swing = { t: 0, tgt: t };
      this.ev({ k: 'swing', u: u.id });
    }
    for (const m of this.missiles) {
      const tx = m.tgt.x - m.x;
      const ty = m.tgt.y - m.y;
      const d = Math.hypot(tx, ty);
      const step = m.speed * dt;
      if (d <= step || !m.tgt.alive) {
        m.done = true;
        if (m.tgt.alive) this.attackHit(m.pid, this.heroes.get(m.pid), m.tgt);
        continue;
      }
      m.x += (tx / d) * step;
      m.y += (ty / d) * step;
      m.f = Math.atan2(ty, tx);
    }
    this.missiles = this.missiles.filter((m) => !m.done);
  }

  // An attack lands. Heroes take damage through damage(); other units lose hp
  // and call onUnitKilled when it runs out. Games override for special rules.
  attackHit(pid, u, tgt) {
    const dmg = this.attack.dmg ?? 10;
    this.ev({ k: 'hit', x: round1(tgt.x), y: round1(tgt.y) });
    if (tgt.kind === 'paladin' && this.heroes.get(tgt.owner) === tgt) return this.damage(tgt.owner, dmg);
    tgt.hp -= dmg;
    if (dmg >= 1) this.ev({ k: 'dmg', x: round1(tgt.x), y: round1(tgt.y), n: Math.round(dmg) });
    if (tgt.hp <= 0 && tgt.alive) {
      tgt.alive = false;
      this.onUnitKilled(tgt, pid);
    }
  }

  onUnitKilled(unit) {
    this.ev({ k: 'death', x: round1(unit.x), y: round1(unit.y), u: unit.id });
  }

  missileEnts() {
    return this.missiles.map((m) => ({ id: m.id, k: 'missile', x: round2(m.x), y: round2(m.y), f: round2(m.f || 0), m: m.art }));
  }

  stepHeroes(dt) {
    for (const [pid, cd] of this.cds) if (cd > 0) this.cds.set(pid, cd - dt);
    for (const cds of this.acd.values()) for (let i = 0; i < 4; i++) if (cds[i] > 0) cds[i] -= dt;
    for (const [pid, b] of this.bots) {
      const u = this.heroes.get(pid);
      if (!u?.alive || u.finished) continue;
      b.think -= dt;
      if (b.think <= 0) {
        b.think = rand(0.15, 0.3);
        if (!u.cast) this.botThink(pid, u, b.mem);
      }
    }
    const list = [...this.heroes.values()];
    this.stepAttacks(dt);
    stepUnits(list, dt, { friction: this.friction });
    this.stepCasts(dt);
    collideUnits(list);
  }

  botThink() {}

  // Returns groups of player ids, best first.
  ranking() {
    const kind = this.meta.ranking;
    if (kind === 'score') return this.scoreGroups().reverse();
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
    return groups.concat(this.deathGroups().reverse());
  }

  // Eliminations grouped by instant (same tick), first out first.
  deathGroups() {
    const groups = [];
    let lastT = null;
    for (const e of this.elimOrder) {
      if (lastT != null && Math.abs(e.t - lastT) < 0.02) groups[groups.length - 1].push(e.pid);
      else groups.push([e.pid]);
      lastT = e.t;
    }
    return groups;
  }

  // Score groups, lowest first.
  scoreGroups() {
    const sorted = [...this.scores.entries()].sort((a, b) => a[1] - b[1]);
    const groups = [];
    let last = null;
    for (const [pid, sc] of sorted) {
      if (last !== null && Math.abs(sc - last) < 1e-6) groups[groups.length - 1].push(pid);
      else groups.push([pid]);
      last = sc;
    }
    return groups;
  }

  // Points per player, following Uther Party 4.0 (verified live):
  //  - Survival: the ante starts at 9 - N. Each death pays the dying player the
  //    current ante, then the ante rises by 1 per death; players out in the same
  //    instant share the lower value. The last one standing gets 8. If the timer
  //    runs out, every survivor gets the current ante and nobody gets the 8.
  //  - Race: finishers get 8, 7, 6 ... in order; anyone who died or did not
  //    finish gets 0.
  //  - Score games (not in the original) pay like survival, lowest score first.
  payouts() {
    const n = this.pids.length;
    const pts = new Map(this.pids.map((p) => [p, 0]));
    const kind = this.meta.ranking;
    if (kind === 'race') {
      this.finishOrder.forEach((p, i) => pts.set(p, Math.max(0, 8 - i)));
      return pts;
    }
    let ante = 9 - n;
    const pay = (g) => {
      for (const p of g) pts.set(p, Math.max(0, ante));
      ante += g.length;
    };
    if (kind === 'score') {
      const groups = this.scoreGroups();
      const top = groups.pop();
      groups.forEach(pay);
      for (const p of top) pts.set(p, top.length === 1 || n === 1 ? 8 : Math.max(0, ante));
      return pts;
    }
    this.deathGroups().forEach(pay);
    const alive = this.alive;
    if (alive.length === 1 && !this.timedOut) pts.set(alive[0], 8);
    else for (const p of alive) pts.set(p, Math.max(0, ante));
    return pts;
  }

  progress() {
    return 0;
  }

  isDone() {
    if (this.done) return true;
    if (this.time >= this.meta.duration) {
      this.timedOut = true;
      return true;
    }
    if (this.meta.ranking === 'survival') {
      const a = this.alive.length;
      return this.pids.length > 1 ? a <= 1 : a === 0;
    }
    if (this.meta.ranking === 'race') return this.finishOrder.length + this.elimOrder.length >= this.pids.length;
    return false;
  }

  heroEnts(pid) {
    const ents = [];
    for (const [hp, u] of this.heroes) {
      const fx = [];
      if (u.finished) fx.push('finished');
      if ((u.cast && u.cast.t >= 0) || u.swing) fx.push('casting');
      if (u.speedMult < 0.95) fx.push('slow');
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

  abilityDefs() {
    if (this.abilities.length) return this.abilities.map((ab, i) => ({ name: ab.name, key: 'QWER'[i], max: ab.cd || 1, icon: ab.icon, desc: ab.desc, target: ab.kind === 'point' || ab.kind === 'unit', range: ab.range }));
    if (this.shove) return [{ name: this.shoveName || 'Holy Shove', key: 'Q', max: this.shove.cd, icon: '🔨', desc: 'Knock back nearby hammerguys.' }];
    const sp = this.spell;
    return sp ? [{ name: sp.name, key: 'Q', max: sp.cd || 1, icon: sp.icon, desc: sp.desc, target: true, range: sp.range }] : [];
  }

  abilitiesSnap(pid) {
    if (!this.abilities.length) {
      if (!this.shove && !this.spell) return [];
      const cd = round2(Math.max(0, this.cds.get(pid) || 0));
      if (this.shove) return [{ cd }];
      const left = this.spell.charges ? this.charges.get(pid) || 0 : null;
      return [{ cd, left, empty: left === 0 }];
    }
    const cds = this.acd.get(pid) || [];
    const ch = this.acharges.get(pid) || [];
    return this.abilities.map((ab, i) => {
      const left = ch[i] ?? null;
      const off = ab.available ? !ab.available(pid) : false;
      return { cd: round2(Math.max(0, cds[i] || 0)), left, empty: left === 0 || off };
    });
  }

  snapshot(pid) {
    return {
      ents: [...this.heroEnts(pid), ...this.worldEnts(pid), ...this.missileEnts()],
      hud: this.hud(pid),
      scores: this.meta.ranking === 'score' ? Object.fromEntries([...this.scores].map(([k, v]) => [k, Math.floor(v)])) : null,
      abilities: this.abilitiesSnap(pid),
      attack: this.attack ? 1 : undefined,
    };
  }

  ev(e) {
    this.party.ev(e);
  }
}


// Ability slot from a cast command: {slot: 1} or {spell: 's1'}; slot 0 otherwise.
function slotOf(m) {
  if (Number.isInteger(m.slot)) return Math.max(0, Math.min(3, m.slot));
  const r = /^s([0-3])$/.exec(String(m.spell ?? ''));
  return r ? +r[1] : 0;
}
