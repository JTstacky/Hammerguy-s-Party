import { Minigame } from '../../base.js';
import { Unit, rand, dist, clampToRect, round1, round2, wc3, stepUnits, collideUnits, newId } from '../../../engine/server/sim.js';
import { fighter, fightStep, stepMissiles, missileSnap, nearest, pushOutRect, dealt } from './rtskit.js';
import { treesAroundRect } from '../props.js';

// Uther Party 4.0 #46 "Tower Defense" (docs/uther-party/rules-4.0.md).
// A 2048x2048 field with eight 64x64 build spots on an octagon about 487 u
// from the centre; player k owns spot k, empty spots get a finished neutral
// tower. Each player has 8 peasants (speed 190, 220 HP, 5-6 chaos) on a
// 128 u ring round their spot and 100 lumber: one Arcane Tower (700 HP,
// build time 240 s). At t=0 one random peasant starts it. Power-building is
// free: each extra builder adds 0.6x, so all eight take about 46 s. An
// immobile Archmage stands 448 u outward from every spot (range 450, 27-33
// hero damage, about 1.5 s), shooting the nearest peasant first and the
// construction when no peasant is in range. Archmages wake at t=5 and summon a
// Water Elemental (525 HP, 18-22 pierce, range 300, 60 s) at t=17. Race:
// finishing your tower pays 8, 7, 6 ...; losing the construction or all
// peasants, or the 150 s timer, pays 0.
//
// Simplifications (the engine gives each player one hero):
//  - Your hero is one peasant (the one that starts the tower); the other
//    seven are its crew. Right-click your tower to build it yourself.
//    Q "Power Build" sends every peasant to build; W "Rally" pulls the crew
//    off the tower to follow you and attack what you attack.
//  - If your hero peasant dies, another of your peasants takes over.
//  - The exact WC3 power-build formula isn't in the script: 1 + 0.6 per
//    extra builder, as the sheet estimates (about 46 s for eight).
//  - Construction HP starts at 10 % and rises with progress, as in WC3.
//  - The t=37 Blizzard order is left out: the map never teaches the
//    Archmages Blizzard, so in the original it does nothing either.
//  - Bots: the original's bots never power-build (one peasant can't finish
//    in 150 s). Ours power-build after a reaction delay, so they can place.
const HALF = wc3(1024);
const NOTCH = wc3(128);
const TOWER_HALF = wc3(64);
// Build spots T1..T8 relative to the centre (WC3 y flipped: north is up).
const SPOTS = [
  [-448, -192],
  [192, -448],
  [448, 192],
  [-192, 448],
  [-192, -448],
  [448, -192],
  [192, 448],
  [-448, 192],
].map(([x, y]) => [wc3(x), wc3(y)]);
const PEASANT = { speed: wc3(190), hp: 220, r: wc3(7), atk: { min: 5, max: 6, type: 'chaos', range: wc3(90), cd: 2, point: 0.43 } };
const TOWER = { hp: 700, build: 240, power: 0.6, armor: 5 };
const ARCHMAGE = { out: wc3(448), hp: 625, r: wc3(32), wake: 5, atk: { min: 27, max: 33, type: 'hero', range: wc3(450), cd: 1.5, point: 0.55, missile: wc3(900), art: 'bolt' }, armor: 3 };
const ELEMENTAL = { at: 17, hp: 525, life: 60, speed: wc3(220), r: wc3(32), atk: { min: 18, max: 22, type: 'pierce', range: wc3(300), cd: 1.5, point: 0.5, missile: wc3(900), art: 'bolt' }, armor: 1, acquire: wc3(500) };
const BUILD_REACH = wc3(40);

export class TowerDefense extends Minigame {
  static id = 'tower';
  static name = 'Tower Defense';
  static desc = 'Complete your tower! One peasant alone needs 240 s, but every extra builder adds 60%. Get the whole crew on it while the Archmage and his Water Elemental shoot at you. First tower up wins.';
  static controls = 'Right-click your tower to build it. Q: Power Build (the whole crew builds). W: Rally (the crew follows you and attacks what you right-click).';
  static duration = 150;
  static ranking = 'race';

  setup() {
    const used = this.pids.map((_, i) => SPOTS[i % SPOTS.length]);
    const neutral = SPOTS.filter((s) => !used.includes(s));
    const props = treesAroundRect(HALF + 1, HALF + 1, 0.45, 2.4);
    this.map = { theme: 'grass', floor: { shape: 'rect', w: HALF * 2, h: HALF * 2 }, props, bounds: HALF + 3, build: ['tdfield'], notch: round2(NOTCH), spots: SPOTS.map(([x, y]) => [round2(x), round2(y)]), neutral: neutral.map(([x, y]) => [round2(x), round2(y)]), th: round2(TOWER_HALF) };
    this.abilities = [
      { name: 'Power Build', icon: '🔨', kind: 'instant', cd: 1, desc: 'Every peasant goes to build your tower. Each extra builder adds 60% build speed.', cast: (pid) => this.setMode(pid, 'build') },
      { name: 'Rally', icon: '🚩', kind: 'instant', cd: 1, desc: 'Your crew stops building and follows you, attacking whatever you right-click.', cast: (pid) => this.setMode(pid, 'follow') },
    ];
    this.towers = new Map();
    this.crews = new Map(); // pid -> [Unit] (not including the hero)
    this.solid = []; // [x0, y0, x1, y1] blocks: towers
    for (const [x, y] of neutral) this.solid.push([x - TOWER_HALF, y - TOWER_HALF, x + TOWER_HALF, y + TOWER_HALF]);
    // Peasants on a 128 u ring round their spot; one random one is the builder (hero).
    const heroPos = [];
    this.pids.forEach((pid, i) => {
      const [sx, sy] = used[i];
      const ring = Array.from({ length: 8 }, (_, k) => {
        const a = (k / 8) * Math.PI * 2 + 0.3;
        return [sx + Math.cos(a) * wc3(128), sy + Math.sin(a) * wc3(128)];
      });
      const pick = Math.floor(Math.random() * 8);
      heroPos.push(ring[pick]);
      const crew = ring.filter((_, k) => k !== pick).map(([x, y]) => this.makePeasant(pid, x, y, Math.atan2(sy - y, sx - x)));
      this.crews.set(pid, crew);
      const tw = { id: newId(), kind: 'tower', owner: pid, x: sx, y: sy, r: TOWER_HALF, hp: TOWER.hp * 0.1, maxHp: TOWER.hp, prog: 0, alive: true, placed: false, def: 'fort', armor: TOWER.armor, done: false };
      this.towers.set(pid, tw);
    });
    this.spawnHeroes(heroPos, { speed: PEASANT.speed, r: PEASANT.r, hp: PEASANT.hp });
    for (const [pid, u] of this.heroes) {
      this.dressPeasant(u);
      u.skin = 'peasant';
      u.build = true; // the script's automatic build order
      const tw = this.towers.get(pid);
      u.setFacing(Math.atan2(tw.y - u.y, tw.x - u.x));
    }
    this.attack = { range: PEASANT.atk.range }; // right-click targets
    // One Archmage per spot, 448 u outward, facing it.
    this.mages = SPOTS.map(([sx, sy]) => {
      const d = Math.hypot(sx, sy);
      const x = sx + (sx / d) * ARCHMAGE.out;
      const y = sy + (sy / d) * ARCHMAGE.out;
      const m = fighter({ kind: 'archmage', x, y, r: ARCHMAGE.r, speed: 0, hp: ARCHMAGE.hp, atk: { ...ARCHMAGE.atk }, def: 'hero', armor: ARCHMAGE.armor, acquire: ARCHMAGE.atk.range, facing: Math.atan2(sy - y, sx - x) });
      m.home = [x, y];
      return m;
    });
    this.elementals = [];
    this.missiles2 = [];
    this.summoned = false;
  }

  makePeasant(pid, x, y, facing) {
    const u = new Unit({ kind: 'tdpeasant', owner: pid, x, y, r: PEASANT.r, speed: PEASANT.speed, hp: PEASANT.hp });
    u.setFacing(facing);
    this.dressPeasant(u);
    u.mode = 'idle';
    return u;
  }

  dressPeasant(u) {
    u.atk = { ...PEASANT.atk };
    u.def = 'medium';
    u.armor = 0;
    u.atkCd = 0;
    u.haste = 1;
    u.swing = null;
    u.tgt = null;
  }

  peasants(pid) {
    const h = this.heroes.get(pid);
    return [...(h?.alive && !h.finished && !h.gone ? [h] : []), ...(this.crews.get(pid) || []).filter((c) => c.alive)];
  }

  setMode(pid, mode) {
    for (const c of this.crews.get(pid) || []) {
      if (!c.alive) continue;
      c.mode = mode;
      c.tgt = null;
      c.swing = null;
      c.stop();
    }
    const h = this.heroes.get(pid);
    if (mode === 'build' && h?.alive) {
      h.build = true;
      h.attackOrder = null;
    }
  }

  // ------------------------------------------------------------ building

  // The point next to the tower where a builder stands.
  buildSpot(u, tw) {
    let dx = u.x - tw.x;
    let dy = u.y - tw.y;
    // Bots crowd the side of the tower away from their Archmage, out of its 450 range.
    if (this.bots.has(u.owner) && this.bots.get(u.owner).mem.skill > 0.6) {
      const d = Math.hypot(tw.x, tw.y) || 1;
      dx = dx * 0.35 - (tw.x / d) * 1.5;
      dy = dy * 0.35 - (tw.y / d) * 1.5;
    }
    const m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
    const k = (TOWER_HALF + u.r + wc3(12)) / m;
    return [tw.x + dx * k, tw.y + dy * k];
  }

  rectGap(u, tw) {
    const cx = Math.max(tw.x - TOWER_HALF, Math.min(tw.x + TOWER_HALF, u.x));
    const cy = Math.max(tw.y - TOWER_HALF, Math.min(tw.y + TOWER_HALF, u.y));
    return dist(u.x, u.y, cx, cy) - u.r;
  }

  // Walk to the tower; returns true while standing at it, building.
  stepBuilder(u, tw) {
    if (!tw.alive || tw.done) return false;
    if (this.rectGap(u, tw) > BUILD_REACH) {
      const [bx, by] = this.buildSpot(u, tw);
      if (!u.target || dist(u.target.x, u.target.y, bx, by) > 0.3) u.order(bx, by);
      return false;
    }
    if (u.target) u.stop();
    u.faceTo = Math.atan2(tw.y - u.y, tw.x - u.x);
    return true;
  }

  stepBuild(dt) {
    for (const pid of this.pids) {
      const tw = this.towers.get(pid);
      if (!tw.alive || tw.done) continue;
      let builders = 0;
      const h = this.heroes.get(pid);
      if (h.alive && h.build && !h.cast && this.stepBuilder(h, tw)) builders++;
      for (const c of this.crews.get(pid)) if (c.alive && c.mode === 'build' && c.stun <= 0 && this.stepBuilder(c, tw)) builders++;
      tw.builders = builders;
      if (!builders) continue;
      if (!tw.placed) {
        tw.placed = true;
        this.solid.push([tw.x - TOWER_HALF, tw.y - TOWER_HALF, tw.x + TOWER_HALF, tw.y + TOWER_HALF]);
        this.ev({ k: 'tdplace', x: round2(tw.x), y: round2(tw.y) });
      }
      const rate = (1 + TOWER.power * (builders - 1)) / TOWER.build;
      const before = tw.prog;
      tw.prog = Math.min(1, tw.prog + rate * dt);
      tw.hp = Math.min(tw.maxHp, tw.hp + (tw.prog - before) * tw.maxHp * 0.9);
      if (tw.prog >= 1) this.complete(pid, tw);
    }
  }

  // Construct Finish: the peasants are removed, the tower is a Race Finish and is teleported away.
  complete(pid, tw) {
    tw.done = true;
    this.finish(pid);
    for (const c of this.crews.get(pid)) c.alive = false;
    this.ev({ k: 'tele', x1: round2(tw.x), y1: round2(tw.y), x2: round2(tw.x), y2: round2(tw.y) });
    this.ev({ k: 'tddone', x: round2(tw.x), y: round2(tw.y), o: pid });
    tw.alive = false;
    this.solid = this.solid.filter((s) => s[0] !== tw.x - TOWER_HALF || s[1] !== tw.y - TOWER_HALF);
  }

  // ------------------------------------------------------------ combat

  attackables(pid) {
    const list = [...this.mages, ...this.elementals].filter((v) => v.alive);
    for (const op of this.pids) {
      if (op === pid) continue;
      list.push(...this.peasants(op));
      const tw = this.towers.get(op);
      if (tw.alive && tw.placed) list.push(tw);
    }
    return list;
  }

  command(pid, m) {
    const u = this.heroes.get(pid);
    if (!u?.alive || u.finished) return;
    // A right-click on your own tower builds it.
    if (m.c === 'move' || m.c === 'steer') {
      const tw = this.towers.get(pid);
      if (tw.alive && Math.abs(+m.x - tw.x) < TOWER_HALF + 0.5 && Math.abs(+m.y - tw.y) < TOWER_HALF + 0.5) {
        if (!u.build) u.stop();
        u.build = true;
        u.attackOrder = null;
        return;
      }
    }
    if (m.c === 'move' || m.c === 'stop' || m.c === 'steer') u.build = false;
    super.command(pid, m);
  }

  hurt(tgt, amount) {
    if (!tgt.alive || amount <= 0) return;
    if (tgt.owner != null && (this.finishOrder.includes(tgt.owner) || tgt.gone)) return;
    tgt.hp -= amount;
    if (amount >= 1) this.ev({ k: 'dmg', x: round1(tgt.x), y: round1(tgt.y), n: Math.round(amount) });
    if (tgt.hp > 0) return;
    tgt.hp = 0;
    tgt.alive = false;
    if (tgt.kind === 'tower') return this.towerDeath(tgt.owner);
    this.ev({ k: 'death', x: round1(tgt.x), y: round1(tgt.y), u: tgt.id });
    if (tgt.owner != null && (tgt.kind === 'paladin' || tgt.kind === 'tdpeasant')) this.peasantDied(tgt.owner, tgt);
  }

  // The hero peasant fell: the next peasant takes over. No peasants left: out.
  peasantDied(pid, u) {
    const hero = this.heroes.get(pid);
    if (u === hero) {
      const crew = this.crews.get(pid);
      const next = crew.find((c) => c.alive && c.mode === 'build') || crew.find((c) => c.alive);
      if (next) {
        crew.splice(crew.indexOf(next), 1);
        next.id = newId(); // a new entity, so clients rebuild it as the hero
        next.kind = 'paladin';
        next.skin = 'peasant';
        next.build = next.mode === 'build' || hero.build;
        next.attackOrder = null;
        this.heroes.set(pid, next);
        return;
      }
      hero.gone = true;
    }
    if (!this.peasants(pid).length) this.knockOut(pid);
  }

  knockOut(pid) {
    const h = this.heroes.get(pid);
    if (this.elimOrder.some((e) => e.pid === pid)) return;
    h.gone = false;
    h.alive = true;
    this.eliminate(pid);
    const tw = this.towers.get(pid);
    if (tw.alive) {
      tw.alive = false;
      this.solid = this.solid.filter((s) => s[0] !== tw.x - TOWER_HALF || s[1] !== tw.y - TOWER_HALF);
      if (tw.placed) this.ev({ k: 'tdcollapse', x: round2(tw.x), y: round2(tw.y) });
    }
  }

  // Tower Death: the construction falls and every unit of its owner dies with it.
  towerDeath(pid) {
    const tw = this.towers.get(pid);
    this.solid = this.solid.filter((s) => s[0] !== tw.x - TOWER_HALF || s[1] !== tw.y - TOWER_HALF);
    this.ev({ k: 'tdcollapse', x: round2(tw.x), y: round2(tw.y), big: 1 });
    for (const c of this.crews.get(pid)) {
      if (c.alive) {
        c.alive = false;
        this.ev({ k: 'death', x: round1(c.x), y: round1(c.y), u: c.id });
      }
    }
    const h = this.heroes.get(pid);
    h.hp = 0;
    if (this.elimOrder.some((e) => e.pid === pid)) return;
    h.gone = false;
    h.alive = true;
    this.eliminate(pid);
  }

  isHero(v) {
    return v.kind === 'paladin';
  }

  hit = (src, tgt, base) => {
    if (!tgt.alive) return;
    this.ev({ k: 'hit', x: round1(tgt.x), y: round1(tgt.y) });
    this.hurt(tgt, dealt(base, src.atk.type, tgt.def, tgt.armor));
  };

  // Heroes attack with the rtskit cycle too (their 5-6 chaos).
  stepAttacks(dt) {
    for (const [, u] of this.heroes) {
      if (!u.alive || u.finished || u.gone) continue;
      if (u.attackOrder && !u.attackOrder.alive) u.attackOrder = null;
      if (u.swing && u.swing.tgt !== u.attackOrder) u.swing = null;
      u.tgt = u.attackOrder;
      if (!u.tgt && !u.swing) {
        if (u.atkCd > 0) u.atkCd -= dt;
        continue;
      }
      if (u.cast) continue;
      fightStep(u, dt, { hit: this.hit, move: (w, x, y) => (w.target ? w.steer(x, y) : w.order(x, y)), missiles: this.missiles2, ev: (e) => this.ev(e) });
      if (u.tgt === null) u.attackOrder = null;
    }
  }

  stepCrew(dt) {
    for (const pid of this.pids) {
      const hero = this.heroes.get(pid);
      const crew = this.crews.get(pid);
      crew.forEach((c, idx) => {
        if (!c.alive) return;
        if (c.mode === 'follow' && hero.alive && !hero.gone) {
          const focus = hero.attackOrder?.alive ? hero.attackOrder : null;
          if (focus) c.tgt = focus;
          else if (c.tgt && !c.tgt.alive) c.tgt = null;
          if (!c.tgt) {
            c.swing = null;
            const a = idx * 0.9 + hero.heading + Math.PI;
            const rr = wc3(60) + wc3(18) * Math.sqrt(idx + 1);
            const fx = hero.x + Math.cos(a) * rr;
            const fy = hero.y + Math.sin(a) * rr;
            if (dist(c.x, c.y, fx, fy) > wc3(50)) (c.target ? c.steer(fx, fy) : c.order(fx, fy));
            if (c.atkCd > 0) c.atkCd -= dt;
            return;
          }
          fightStep(c, dt, { hit: this.hit, move: (w, x, y) => (w.target ? w.steer(x, y) : w.order(x, y)), missiles: this.missiles2, ev: (e) => this.ev(e) });
        } else if (c.atkCd > 0) c.atkCd -= dt;
      });
    }
  }

  // Archmages: paused for 5 s, then shoot the nearest peasant in range, or a
  // construction if no peasant is; Water Elemental at t=17.
  stepMages(dt) {
    if (!this.summoned && this.time >= ELEMENTAL.at) {
      this.summoned = true;
      for (const m of this.mages) {
        if (!m.alive) continue;
        const a = m.heading;
        const e = fighter({ kind: 'tdelemental', x: m.x + Math.cos(a) * wc3(110), y: m.y + Math.sin(a) * wc3(110), r: ELEMENTAL.r, speed: ELEMENTAL.speed, hp: ELEMENTAL.hp, atk: { ...ELEMENTAL.atk }, def: 'heavy', armor: ELEMENTAL.armor, acquire: ELEMENTAL.acquire, facing: a });
        e.life = ELEMENTAL.life;
        this.elementals.push(e);
        this.ev({ k: 'tdsummon', x: round2(e.x), y: round2(e.y), m: m.id });
      }
    }
    const players = () => this.pids.flatMap((p) => this.peasants(p));
    const towers = () => [...this.towers.values()].filter((t) => t.alive && t.placed && !t.done);
    for (const m of this.mages) {
      if (!m.alive) continue;
      if (this.time < ARCHMAGE.wake) continue;
      m.thinkT = (m.thinkT || 0) - dt;
      if (m.thinkT <= 0) {
        m.thinkT = 0.4;
        const inRange = (v) => dist(m.x, m.y, v.x, v.y) - m.r - v.r <= m.atk.range;
        if (!m.tgt?.alive || !inRange(m.tgt) || m.tgt.kind === 'tower') m.tgt = nearest(players(), m.x, m.y, 99, inRange) || (m.tgt?.alive && m.tgt.kind === 'tower' && inRange(m.tgt) ? m.tgt : nearest(towers(), m.x, m.y, 99, inRange));
      }
      fightStep(m, dt, { hit: this.hit, move: () => (m.tgt = null), missiles: this.missiles2, ev: (e) => this.ev(e) });
    }
    for (const e of this.elementals) {
      if (!e.alive) continue;
      e.life -= dt;
      if (e.life <= 0) {
        e.alive = false;
        this.ev({ k: 'tdunsummon', x: round2(e.x), y: round2(e.y) });
        continue;
      }
      e.thinkT = (e.thinkT || 0) - dt;
      if (e.thinkT <= 0) {
        e.thinkT = 0.5;
        if (!e.tgt?.alive || e.tgt.kind === 'tower') e.tgt = nearest(players(), e.x, e.y, e.acquire) || (e.tgt?.alive ? e.tgt : nearest(towers(), e.x, e.y, e.acquire));
      }
      fightStep(e, dt, { hit: this.hit, move: (w, x, y) => (w.target ? w.steer(x, y) : w.order(x, y)), missiles: this.missiles2, ev: (ev) => this.ev(ev) });
    }
  }

  obstacles(u) {
    for (const [x0, y0, x1, y1] of this.solid) pushOutRect(u, x0, y0, x1, y1);
    const lim = HALF - NOTCH;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) pushOutRect(u, sx > 0 ? lim : -HALF - 1, sy > 0 ? lim : -HALF - 1, sx > 0 ? HALF + 1 : -lim, sy > 0 ? HALF + 1 : -lim);
    clampToRect(u, HALF, HALF);
  }

  tick(dt) {
    this.stepHeroes(dt);
    this.stepCrew(dt);
    this.stepBuild(dt);
    this.stepMages(dt);
    const crew = [...this.crews.values()].flat().filter((c) => c.alive);
    const els = this.elementals.filter((e) => e.alive);
    const mages = this.mages.filter((m) => m.alive);
    stepUnits([...crew, ...els, ...mages], dt);
    const heroes = [...this.heroes.values()].filter((h) => h.alive && !h.finished && !h.gone);
    const all = [...heroes, ...crew, ...els, ...mages];
    collideUnits(all);
    for (const m of this.mages) [m.x, m.y] = m.home;
    for (const u of [...heroes, ...crew, ...els]) this.obstacles(u);
    this.missiles2 = stepMissiles(this.missiles2, dt, this.hit);
    this.elementals = this.elementals.filter((e) => e.alive);
  }

  progress(pid) {
    return this.towers.get(pid).prog;
  }

  // The original has no bot AI past the automatic build order. Ours
  // power-build after a reaction delay (see the header).
  botThink(pid, u, mem) {
    mem.power ??= this.time + rand(1, 3) + rand(0, 8) * (1 - mem.skill);
    if (this.time >= mem.power && !mem.done) {
      mem.done = true;
      this.useAbility(pid, 0, u.x, u.y);
    }
  }

  heroEnts(pid) {
    const out = [];
    for (const e of super.heroEnts(pid)) {
      const h = [...this.heroes.values()].find((u) => u.id === e.id);
      if (!h || h.gone || h.finished) continue;
      if (h.swing) (e.fx ??= []).push('casting');
      if (h.build && this.towers.get(h.owner).alive && this.rectGap(h, this.towers.get(h.owner)) <= BUILD_REACH) e.b = 1;
      out.push(e);
    }
    return out;
  }

  hud(pid) {
    const tw = this.towers.get(pid);
    const n = this.peasants(pid).length;
    if (tw.done) return { label: '🏰 Tower complete!' };
    if (!tw.alive) return { label: '💥 Your tower fell' };
    const eta = tw.builders ? Math.ceil(((1 - tw.prog) * TOWER.build) / (1 + TOWER.power * (tw.builders - 1))) : null;
    return { label: `🏰 ${Math.floor(tw.prog * 100)}% · 🔨 ${tw.builders || 0} building · 👷 ${n}/8${eta ? ` · ${eta} s left` : ''}` };
  }

  worldEnts() {
    const ents = [];
    for (const [pid, crew] of this.crews) {
      for (const c of crew) {
        if (!c.alive) continue;
        const tw = this.towers.get(pid);
        const e = { id: c.id, k: 'tdpeasant', o: pid, x: round2(c.x), y: round2(c.y), f: round2(c.facing), h: Math.ceil((100 * c.hp) / c.maxHp) };
        if (c.mx || c.my) e.mv = 1;
        if (c.swing) e.sw = 1;
        if (c.mode === 'build' && tw.alive && this.rectGap(c, tw) <= BUILD_REACH) e.b = 1;
        ents.push(e);
      }
    }
    for (const tw of this.towers.values()) if (tw.alive && tw.placed) ents.push({ id: tw.id, k: 'tdtower', o: tw.owner, x: round2(tw.x), y: round2(tw.y), p: round2(tw.prog), h: Math.ceil((100 * tw.hp) / tw.maxHp), n: tw.builders || 0 });
    for (const m of this.mages) ents.push({ id: m.id, k: 'tdarchmage', x: round2(m.x), y: round2(m.y), f: round2(m.facing), h: Math.max(0, Math.ceil((100 * m.hp) / m.maxHp)), sw: m.swing ? 1 : undefined, dead: m.alive ? undefined : 1, z: this.time < ARCHMAGE.wake ? 1 : undefined });
    for (const e of this.elementals) ents.push({ id: e.id, k: 'tdelemental', x: round2(e.x), y: round2(e.y), f: round2(e.facing), h: Math.ceil((100 * e.hp) / e.maxHp), mv: e.mx || e.my ? 1 : undefined, sw: e.swing ? 1 : undefined, l: round1(e.life) });
    for (const m of this.missiles2) ents.push(missileSnap(m));
    return ents;
  }
}

export const TD = { SPOTS, PEASANT, TOWER, ARCHMAGE, ELEMENTAL, TOWER_HALF, BUILD_REACH };
