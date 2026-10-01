import { Minigame } from '../../base.js';
import { rand, dist, clampToRect, round1, round2, wc3, stepUnits, collideUnits, newId } from '../../../engine/server/sim.js';
import { fighter, fightStep, nearest, dealt, Grid, followPath } from './rtskit.js';

// Uther Party 4.0 #49 "Clandestine Kitty" (docs/uther-party/rules-4.0.md).
// A 768x3072 night corridor running north, walled into bays by 46 Ashenvale
// trees. Eight Full Vials lie in a tree-walled alcove at the far north end,
// about 2,600 u from the start. Players are Priestesses of the Moon: speed
// 320, about 50 HP, no attack, one item slot, Shadowmeld (1.5 s fade, hidden
// while standing still) and Charm (125 of about 225 mana, cooldown 20,
// range 700): permanent control of a Doom Guard. Three Doom Guards (1350 HP,
// speed 270, 35-42 chaos: two hits kill) attack-move to a random point every
// 7 s from t=2, and every 2 s each one Cripples (-75 % speed for 10 s, 175
// mana) a random visible priestess within 400. A charmed guard is yours: its
// Cripple and Rain of Fire (6 waves of 25 in 200) are your E and R. Anyone
// can charm it back. Race: bring a vial back into the start circle (8, 7, 6 ...); dying
// drops your vial; the 150 s timer pays 0. Guards keep fighting for their
// controller after the controller finishes or dies.
//
// Simplifications (the engine gives each player one hero):
//  - Your charmed guards follow you and fight rivals and hostile guards near
//    them; their spells are cast from your E / R buttons.
//  - War Stomp and Dispel Magic are left out (four buttons: Charm,
//    Shadowmeld and the guard's Cripple and Rain of Fire). A charmed guard
//    that stomped by itself turned every crowd into a massacre, and a WC3
//    player unit never casts it unordered.
//  - Walking over a vial picks it up (right-click it to walk there).
//  - There is no fog of war beyond Shadowmeld (the original gives no shared
//    vision until a player is out).
const CS = wc3(128);
const COLS = 6;
const ROWS = 24;
const HW = (COLS * CS) / 2;
const HH = (ROWS * CS) / 2;
// Tree cells [col, row] (row 0 = north end), from the map's 46 Ashenvale trees.
const SIDES = [0, 1, 4, 5];
export const TREES = [
  ...[0, 1].flatMap((r) => [0, 1, 2, 3, 4, 5].map((c) => [c, r])),
  ...[2, 3, 4, 10, 16, 22, 23].flatMap((r) => SIDES.map((c) => [c, r])),
  ...[7, 13, 19].flatMap((r) => [2, 3].map((c) => [c, r])),
];
const START = { x: 0, y: wc3(1408), hw: wc3(128), hh: wc3(64) };
const VIALS = { n: 8, x: 0, y: -wc3(1216), hw: wc3(128) };
const PRIESTESS = { speed: wc3(320), r: wc3(15), hp: 50, armor: 3.7, mana: 225, regen: 0.76 };
const CHARM = { cost: 125, cd: 20, range: wc3(700), point: 0.25 };
const MELD = { fade: 1.5 };
const GUARD = { hp: 1350, speed: wc3(270), r: wc3(48), armor: 3, mana: 500, regen: 1.25, acquire: wc3(600), atk: { min: 35, max: 42, type: 'chaos', range: wc3(100), cd: 1.35, point: 0.5 } };
const GUARD_YS = [-512, 256, 768].map((y) => -wc3(y));
const CRIPPLE = { mana: 175, cd: 10, range: wc3(600), ai: wc3(400), dur: 10, mult: 0.25 };
const RAIN = { mana: 125, cd: 8, range: wc3(800), r: wc3(200), waves: 6, dmg: 25, every: 1 };
const PICKUP = wc3(90);

export class ClandestineKitty extends Minigame {
  static id = 'kitty';
  static name = 'Clandestine Kitty';
  static desc = 'Obtain a vial, and return to safety! Sneak up the dark corridor to the vials and bring one back past the Doom Guards. Charm a guard to wield its spells; rivals can charm it back. First home wins.';
  static controls = 'Right-click to move. Q, then click a Doom Guard: Charm. W: Shadowmeld (stand still to hide). E, then click a rival: Cripple. R, then click the ground: Rain of Fire (E and R need a charmed guard).';
  static duration = 150;
  static ranking = 'race';

  setup() {
    this.grid = new Grid(COLS, ROWS, CS, -HW, -HH);
    for (const [c, r] of TREES) this.grid.set(c, r, 1);
    this.map = {
      theme: 'kittynight', floor: { shape: 'rect', w: HW * 2, h: HH * 2 }, bounds: HH + 2, build: ['kittycorridor'],
      trees: TREES.map(([c, r]) => this.grid.center(c, r).map(round2)), start: [START.x, round2(START.y), round2(START.hw), round2(START.hh)], cs: round2(CS),
      props: this.borderTrees(),
    };
    const guardOnly = (pid) => this.guards.some((g) => g.alive && g.owner === pid);
    this.abilities = [
      {
        name: 'Charm', icon: '💜', kind: 'unit', cd: CHARM.cd, range: CHARM.range, castPoint: CHARM.point,
        desc: 'Permanent control of a Doom Guard: 125 mana, range 700. Rivals can charm it back.',
        available: (pid) => this.mana.get(pid) >= CHARM.cost,
        pickTarget: (pid, u, x, y) => this.pickGuard(pid, u, x, y),
        cast: (pid, u, tgt) => this.charm(pid, u, tgt.u),
      },
      { name: 'Shadowmeld', icon: '🌙', kind: 'instant', cd: 0, desc: 'Fade into the night over 1.5 s. Guards cannot see you while you stand still.', cast: (pid, u) => this.meld(u) },
      {
        name: 'Cripple (your guard)', icon: '🦴', kind: 'unit', cd: 1, range: CRIPPLE.range,
        desc: 'Your Doom Guard cripples a rival: -75% move speed for 10 s. 175 of the guard\'s mana.',
        available: guardOnly,
        pickTarget: (pid, u, x, y) => this.pickRival(pid, x, y),
        cast: (pid, u, tgt) => this.guardSpell(pid, { spell: 'cripple', u: tgt.u, x: tgt.x, y: tgt.y }),
      },
      {
        name: 'Rain of Fire (your guard)', icon: '☄️', kind: 'point', cd: 1, range: RAIN.range,
        desc: 'Your Doom Guard calls 6 waves of fire, 25 damage each in 200 u. Two waves kill a priestess. 125 of the guard\'s mana.',
        available: guardOnly,
        cast: (pid, u, tgt) => this.guardSpell(pid, { spell: 'rain', x: tgt.x, y: tgt.y }),
      },
    ];
    // Priestesses start in the start rect at the south end.
    this.spawnHeroes(this.pids.map(() => [rand(-START.hw, START.hw) * 0.8, START.y + rand(-START.hh, START.hh) * 0.6]), { speed: PRIESTESS.speed, r: PRIESTESS.r, hp: PRIESTESS.hp, facing: -Math.PI / 2 });
    for (const [, u] of this.heroes) {
      u.skin = 'priestess';
      u.def = 'hero';
      u.armor = PRIESTESS.armor;
      u.vial = null;
      u.meld = -1; // <0 not melded; counts the fade up to 1.5, then hidden
      u.crip = 0;
    }
    this.mana = new Map(this.pids.map((p) => [p, PRIESTESS.mana]));
    this.guards = GUARD_YS.map((y) => {
      const g = fighter({ kind: 'doomguard', x: 0, y, r: GUARD.r, speed: GUARD.speed, hp: GUARD.hp, atk: { ...GUARD.atk }, def: 'heavy', armor: GUARD.armor, acquire: GUARD.acquire, facing: Math.PI / 2 });
      g.mana = GUARD.mana;
      g.cds = { cripple: 0, rain: 0 };
      g.dest = null;
      return g;
    });
    this.vials = Array.from({ length: VIALS.n }, () => ({ id: newId(), x: rand(-VIALS.hw, VIALS.hw) * 0.9, y: VIALS.y + rand(-wc3(128), wc3(60)), holder: null }));
    this.rains = [];
    this.patrolT = 2;
    this.crippleT = 0;
  }

  borderTrees() {
    const props = [];
    for (let y = -HH - 2; y <= HH + 2; y += 1.6) {
      for (const s of [-1, 1]) {
        props.push({ t: 'tree', x: s * (HW + rand(0.9, 1.6)), y: y + rand(-0.4, 0.4), s: rand(0.95, 1.3) });
        props.push({ t: 'tree', x: s * (HW + rand(2.6, 4.2)), y: y + rand(-0.6, 0.6), s: rand(1.1, 1.5) });
      }
    }
    for (let x = -HW - 3; x <= HW + 3; x += 1.6) {
      props.push({ t: 'tree', x: x + rand(-0.3, 0.3), y: HH + rand(1, 1.8), s: rand(1, 1.3) });
      props.push({ t: 'tree', x: x + rand(-0.3, 0.3), y: -HH - rand(1, 1.8), s: rand(1, 1.3) });
    }
    return props;
  }

  // ------------------------------------------------------------ abilities

  pickGuard(pid, u, x, y) {
    const g = nearest(this.guards, x, y, 2, (v) => v.owner !== pid);
    if (!g || dist(u.x, u.y, g.x, g.y) - g.r > CHARM.range) return null;
    return { x: g.x, y: g.y, u: g };
  }

  charm(pid, u, g) {
    if (!g?.alive || g.owner === pid || this.mana.get(pid) < CHARM.cost) {
      this.acd.get(pid)[0] = 0;
      return;
    }
    this.mana.set(pid, this.mana.get(pid) - CHARM.cost);
    g.owner = pid;
    g.tgt = null;
    g.swing = null;
    g.cmd = null;
    g.chan = null;
    g.path = null;
    g.stop();
    this.ev({ k: 'kittycharm', x1: round2(u.x), y1: round2(u.y), x2: round2(g.x), y2: round2(g.y), u: g.id });
  }

  meld(u) {
    if (u.meld < 0) u.meld = 0;
    u.stop();
    u.path = null;
  }

  pickRival(pid, x, y) {
    const v = nearest([...this.heroes.values()], x, y, 2, (h) => h.owner !== pid && !h.finished && this.visible(h));
    return v ? { x: v.x, y: v.y, u: v } : null;
  }

  // The best of your guards for the job: in range if possible, with the mana.
  guardSpell(pid, order) {
    const cost = order.spell === 'cripple' ? CRIPPLE.mana : RAIN.mana;
    const mine = this.guards.filter((g) => g.alive && g.owner === pid && g.mana >= cost && g.cds[order.spell] <= 0 && !g.chan);
    const u = this.heroes.get(pid);
    if (!mine.length) {
      this.ev({ k: 'txt', x: round1(u.x), y: round1(u.y), s: 'Your guard needs mana', c: '#8fb8ff', to: pid });
      return;
    }
    mine.sort((a, b) => dist(a.x, a.y, order.x, order.y) - dist(b.x, b.y, order.x, order.y));
    const g = mine[0];
    g.cmd = order;
    g.tgt = null;
  }

  // Can guard g see priestess h? Not while she is melded, and not through
  // trees: the Ashenvale trees block line of sight, as in WC3.
  seen(g, h) {
    return this.visible(h) && this.grid.clearLine(g.x, g.y, h.x, h.y, 0);
  }

  visible(h) {
    return h.alive && !h.finished && !(h.meld >= MELD.fade);
  }

  // ------------------------------------------------------------ guards

  guardEnemies(g) {
    const list = [];
    for (const [pid, h] of this.heroes) if (pid !== g.owner && this.seen(g, h)) list.push(h);
    for (const v of this.guards) if (v !== g && v.alive && v.owner !== g.owner) list.push(v);
    return list;
  }

  walkTo(g, x, y) {
    const gl = g.goal;
    if (gl && g.path && this.time - gl.t < 0.5 && Math.abs(gl.x - x) < 0.4 && Math.abs(gl.y - y) < 0.4) return;
    g.goal = { x, y, t: this.time };
    g.path = this.grid.findPath(g.x, g.y, x, y, { r: g.r * 0.7 });
  }

  castGuard(g) {
    const o = g.cmd;
    if (o.spell === 'cripple') {
      if (!o.u.alive || o.u.finished) return (g.cmd = null);
      if (dist(g.x, g.y, o.u.x, o.u.y) > CRIPPLE.range) return this.walkTo(g, o.u.x, o.u.y);
      g.stop();
      g.path = null;
      g.cmd = null;
      this.cripple(g, o.u);
      return;
    }
    if (dist(g.x, g.y, o.x, o.y) > RAIN.range) return this.walkTo(g, o.x, o.y);
    g.stop();
    g.path = null;
    g.cmd = null;
    g.mana -= RAIN.mana;
    g.cds.rain = RAIN.cd;
    g.chan = { x: o.x, y: o.y, waves: RAIN.waves, t: 0.4 };
    this.ev({ k: 'kittyrain', x: round2(o.x), y: round2(o.y), r: round2(RAIN.r), u: g.id });
  }

  cripple(g, h) {
    g.mana -= CRIPPLE.mana;
    g.cds.cripple = CRIPPLE.cd;
    h.crip = CRIPPLE.dur;
    this.ev({ k: 'kittycripple', x1: round2(g.x), y1: round2(g.y), x2: round2(h.x), y2: round2(h.y), u: h.id });
  }

  stepGuard(g, dt) {
    if (!g.alive) return;
    g.mana = Math.min(GUARD.mana, g.mana + GUARD.regen * dt);
    for (const k in g.cds) if (g.cds[k] > 0) g.cds[k] -= dt;
    if (g.stun > 0) {
      g.chan = null;
      return;
    }
    // Rain of Fire: a channel of 6 waves, one a second.
    if (g.chan) {
      g.chan.t -= dt;
      if (g.chan.t <= 0) {
        g.chan.t += RAIN.every;
        g.chan.waves--;
        this.ev({ k: 'kittywave', x: round2(g.chan.x), y: round2(g.chan.y), r: round2(RAIN.r) });
        for (const [, h] of this.heroes) if (h.alive && !h.finished && h.owner !== g.owner && dist(h.x, h.y, g.chan.x, g.chan.y) <= RAIN.r + h.r) this.hurt(h, RAIN.dmg);
        for (const v of this.guards) if (v.alive && v !== g && dist(v.x, v.y, g.chan.x, g.chan.y) <= RAIN.r + v.r) this.hurt(v, RAIN.dmg);
        if (g.chan.waves <= 0) g.chan = null;
      }
      return;
    }
    if (g.cmd) return this.castGuard(g);
    if (g.tgt && (!g.tgt.alive || (g.tgt.kind === 'paladin' && !this.seen(g, g.tgt)) || g.tgt.owner === g.owner)) {
      // Lost from sight: a P12 guard goes to where it last saw her.
      if (g.owner == null && g.tgt.alive && g.tgt.kind === 'paladin' && !g.tgt.finished) g.dest = [g.tgt.x, g.tgt.y];
      g.tgt = null;
    }
    const busy = fightStep(g, dt, { hit: this.hit, move: (u, x, y) => this.walkTo(u, x, y), missiles: [], ev: (e) => this.ev(e) });
    if (busy) return;
    // Charmed: follow your priestess while she's in the game.
    const h = g.owner != null ? this.heroes.get(g.owner) : null;
    if (h?.alive && !h.finished) {
      if (dist(g.x, g.y, h.x, h.y) > wc3(220)) this.walkTo(g, h.x - Math.cos(h.heading) * wc3(150), h.y - Math.sin(h.heading) * wc3(150));
      else if (g.path) {
        g.path = null;
        g.stop();
      }
    } else if (g.owner == null && g.dest) {
      this.walkTo(g, g.dest[0], g.dest[1]);
      if (dist(g.x, g.y, g.dest[0], g.dest[1]) < 1) g.dest = null;
    }
  }

  guardThink(g) {
    if (!g.alive || g.cmd || g.chan) return;
    // Attack-move / idle acquisition: the nearest visible enemy within 600.
    if (!g.tgt) {
      const e = nearest(this.guardEnemies(g), g.x, g.y, g.acquire);
      if (e) g.tgt = e;
    }
  }

  // "Clandestine Patrol" every 7 s: each P12 guard attack-moves to a random point.
  patrol() {
    for (const g of this.guards) {
      if (!g.alive || g.owner != null) continue;
      let p;
      for (let k = 0; k < 20; k++) {
        p = [rand(-HW + 0.6, HW - 0.6), rand(-HH + 0.6, HH - 0.6)];
        const [i, j] = this.grid.cellOf(p[0], p[1]);
        if (!this.grid.blocked(i, j)) break;
      }
      g.dest = p;
      g.tgt = null;
      g.path = null;
    }
  }

  // "Clandestine Cripple" every 2 s: each P12 guard cripples a random visible priestess within 400.
  crippleAI() {
    for (const g of this.guards) {
      if (!g.alive || g.owner != null || g.chan || g.stun > 0 || g.mana < CRIPPLE.mana || g.cds.cripple > 0) continue;
      const pool = [...this.heroes.values()].filter((h) => this.seen(g, h) && dist(h.x, h.y, g.x, g.y) <= CRIPPLE.ai);
      if (pool.length) this.cripple(g, pool[Math.floor(Math.random() * pool.length)]);
    }
  }

  // ------------------------------------------------------------ damage

  hit = (src, tgt, base) => {
    this.ev({ k: 'hit', x: round1(tgt.x), y: round1(tgt.y) });
    this.hurt(tgt, dealt(base, src.atk.type, tgt.def, tgt.armor));
  };

  hurt(tgt, amount) {
    if (!tgt.alive || amount <= 0) return;
    if (tgt.kind === 'paladin') {
      if (tgt.finished) return;
      this.damage(tgt.owner, amount);
      return;
    }
    tgt.hp -= amount;
    if (amount >= 1) this.ev({ k: 'dmg', x: round1(tgt.x), y: round1(tgt.y), n: Math.round(amount) });
    if (tgt.hp <= 0) {
      tgt.alive = false;
      this.ev({ k: 'death', x: round1(tgt.x), y: round1(tgt.y), u: tgt.id });
    }
  }

  // Dying drops your vial.
  eliminate(pid, how) {
    const u = this.heroes.get(pid);
    if (u?.vial) {
      u.vial.holder = null;
      u.vial.x = u.x;
      u.vial.y = u.y;
      u.vial = null;
    }
    super.eliminate(pid, how);
  }

  // ------------------------------------------------------------ tick

  command(pid, m) {
    const u = this.heroes.get(pid);
    super.command(pid, m);
    if (!u?.alive || u.finished) return;
    if ((m.c === 'move' || m.c === 'steer') && u.target && !u.cast) {
      u.path = this.grid.findPath(u.x, u.y, +m.x || 0, +m.y || 0, { r: u.r });
      u.stop();
    } else if (m.c === 'stop') u.path = null;
  }

  tick(dt) {
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.finished) continue;
      this.mana.set(pid, Math.min(PRIESTESS.mana, this.mana.get(pid) + PRIESTESS.regen * dt));
      if (u.crip > 0) u.crip -= dt;
      u.speedMult = u.crip > 0 ? CRIPPLE.mult : 1;
      followPath(u);
    }
    if (this.time >= 2) {
      this.patrolT -= dt;
      if (this.patrolT <= 0) {
        this.patrolT += 7;
        this.patrol();
      }
    }
    this.crippleT -= dt;
    if (this.crippleT <= 0) {
      this.crippleT += 2;
      this.crippleAI();
    }
    this.thinkT = (this.thinkT || 0) - dt;
    if (this.thinkT <= 0) {
      this.thinkT = 0.3;
      for (const g of this.guards) this.guardThink(g);
    }
    this.stepHeroes(dt);
    for (const g of this.guards) {
      this.stepGuard(g, dt);
      followPath(g);
    }
    const guards = this.guards.filter((g) => g.alive);
    stepUnits(guards, dt);
    const heroes = [...this.heroes.values()].filter((h) => h.alive && !h.finished);
    const all = [...heroes, ...guards];
    collideUnits(all);
    for (const u of all) {
      this.grid.pushOut(u);
      clampToRect(u, HW, HH);
    }
    for (const u of heroes) {
      // Shadowmeld: fades in while standing still, broken by moving.
      if (u.meld >= 0) {
        if (u.walking || u.target || u.path) u.meld = -1;
        else u.meld += dt;
      }
      if (!u.vial) {
        const v = this.vials.find((w) => !w.holder && dist(w.x, w.y, u.x, u.y) <= PICKUP + u.r);
        if (v) {
          v.holder = u.owner;
          u.vial = v;
          this.ev({ k: 'sfx', s: 'coin', to: u.owner });
        }
      } else if (Math.abs(u.x - START.x) <= START.hw && Math.abs(u.y - START.y) <= START.hh) {
        this.vials = this.vials.filter((w) => w !== u.vial);
        u.vial = null;
        this.finish(u.owner);
        this.ev({ k: 'tele', x1: round2(u.x), y1: round2(u.y), x2: round2(u.x), y2: round2(u.y) });
      }
    }
  }

  progress(pid) {
    const u = this.heroes.get(pid);
    if (!u.alive) return -1;
    return u.vial ? 2 - dist(u.x, u.y, START.x, START.y) / (HH * 2) : 1 - dist(u.x, u.y, VIALS.x, VIALS.y) / (HH * 2);
  }

  // The original bot hides from any hostile guard within 500. In a corridor this
  // narrow three patrolling guards are nearly always that close, so ours only
  // hide from a guard that is hunting them, is within 400, or is closing in.
  threatens(g, u, pid) {
    if (!g.alive || g.owner === pid) return false;
    // A rival's guard only matters once it is after us.
    if (g.owner != null) return g.tgt === u;
    const d = dist(g.x, g.y, u.x, u.y);
    if (d > wc3(800)) return false;
    // Hide early: before the guard can see us, and not from a guard behind trees.
    if (!this.grid.clearLine(g.x, g.y, u.x, u.y, 0)) return d <= wc3(300);
    if (g.tgt === u || d <= wc3(550)) return true;
    return (g.mx * (u.x - g.x) + g.my * (u.y - g.y)) / (d || 1) > g.speed * 0.3;
  }

  // Original AI, every 0.75 s: no hostile Doom Guard within 500 -> go home
  // with a vial, or attack-move to a random vial on the ground; otherwise Shadowmeld.
  botThink(pid, u, mem) {
    if (this.time < 2) return;
    mem.next ??= 0;
    if (this.time < mem.next) return;
    mem.next = this.time + 0.4 + 0.35 * (1 - mem.skill);
    // Ours (not the original's): charm a hostile guard that comes within range.
    if (this.mana.get(pid) >= CHARM.cost && (this.acd.get(pid)[0] || 0) <= 0 && !u.cast) {
      const g = nearest(this.guards, u.x, u.y, CHARM.range, (v) => v.owner == null && dist(v.x, v.y, u.x, u.y) > wc3(150));
      if (g && Math.random() < 0.5 + 0.5 * mem.skill) {
        u.meld = -1;
        return this.useAbility(pid, 0, g.x, g.y);
      }
    }
    // A guard already hunting us from afar: outrun it (320 vs 270) instead of
    // fading in front of it.
    const hunter = this.guards.find((g) => g.alive && g.tgt === u && dist(g.x, g.y, u.x, u.y) > wc3(200));
    if (hunter && u.crip <= 0) {
      const away = Math.sign(u.y - hunter.y) || 1;
      const y = Math.max(-HH + 1, Math.min(HH - 1, u.y + away * wc3(500)));
      mem.goal = null;
      u.meld = -1;
      u.path = this.grid.findPath(u.x, u.y, u.x, y, { r: u.r });
      u.stop();
      return;
    }
    // Wait under the start's tree cover for a gap before the dash north (or,
    // with a vial, before leaving the alcove).
    const cover = (!u.vial && u.y > START.y - wc3(300)) || (u.vial && u.y < VIALS.y + wc3(200));
    const gap = this.guards.every((g) => !g.alive || g.owner != null || dist(g.x, g.y, u.x, u.y) > wc3(1000) || (g.mx * (u.x - g.x) + g.my * (u.y - g.y) < 0 && dist(g.x, g.y, u.x, u.y) > wc3(700)));
    const threat = (cover && !gap) || this.guards.some((g) => this.threatens(g, u, pid));
    if (threat) {
      if (u.meld < 0) this.useAbility(pid, 1, u.x, u.y);
      return;
    }
    let goal;
    if (u.vial) goal = [START.x, START.y];
    else {
      if (!mem.vial || mem.vial.holder != null || !this.vials.includes(mem.vial)) {
        const free = this.vials.filter((v) => v.holder == null);
        mem.vial = free.length ? free[Math.floor(Math.random() * free.length)] : null;
      }
      if (!mem.vial) return;
      goal = [mem.vial.x, mem.vial.y];
    }
    if (!u.path || !mem.goal || dist(mem.goal[0], mem.goal[1], goal[0], goal[1]) > 0.5 || (!u.target && !u.walking)) {
      mem.goal = goal;
      u.meld = -1;
      u.path = this.grid.findPath(u.x, u.y, goal[0], goal[1], { r: u.r });
      u.stop();
    }
  }

  heroEnts(pid) {
    const ents = [];
    for (const e of super.heroEnts(pid)) {
      const h = [...this.heroes.values()].find((u) => u.id === e.id);
      if (h.finished) continue;
      const fx = e.fx || [];
      if (h.meld >= MELD.fade) fx.push('invis');
      else if (h.meld >= 0) e.fade = round2(h.meld / MELD.fade);
      if (h.crip > 0) fx.push('slow');
      if (h.stun > 0) fx.push('stun');
      if (fx.length) e.fx = fx;
      if (h.vial) e.vial = 1;
      // Rivals don't see a melded priestess at all (only her owner does, faded).
      if (h.meld >= MELD.fade && h.owner !== pid) continue;
      ents.push(e);
    }
    return ents;
  }

  hud(pid) {
    const u = this.heroes.get(pid);
    const g = this.guards.filter((v) => v.alive && v.owner === pid);
    const gm = g.length ? ` · 😈 ${g.length} (${g.map((v) => Math.floor(v.mana)).join('/')} mana)` : '';
    return { label: `💧 ${Math.floor(this.mana.get(pid))} / ${PRIESTESS.mana}${u.vial ? ' · 🧪 Vial!' : ''}${gm}` };
  }

  worldEnts() {
    const ents = [];
    for (const v of this.vials) if (v.holder == null) ents.push({ id: v.id, k: 'kittyvial', x: round2(v.x), y: round2(v.y) });
    for (const g of this.guards) {
      const e = { id: g.id, k: 'kittyguard', x: round2(g.x), y: round2(g.y), f: round2(g.facing), h: Math.max(0, Math.ceil((100 * g.hp) / g.maxHp)) };
      if (g.owner != null) e.o = g.owner;
      if (!g.alive) e.dead = 1;
      if (g.mx || g.my) e.mv = 1;
      if (g.swing) e.sw = 1;
      if (g.chan) e.ch = 1;
      if (g.stun > 0) e.st = 1;
      ents.push(e);
    }
    return ents;
  }
}

export const KITTY = { CS, COLS, ROWS, HW, HH, START, VIALS, PRIESTESS, CHARM, GUARD, CRIPPLE, RAIN, PICKUP };
