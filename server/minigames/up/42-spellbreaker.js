import { Minigame } from '../../base.js';
import { rand, dist, clampToRect, round1, round2, wc3, shuffle, stepUnits, collideUnits, newId } from '../../../engine/server/sim.js';
import { fighter, fightStep, stepMissiles, missileSnap, nearest, pushOutRect, dealt, roll } from './rtskit.js';
import { treesAroundRect } from '../props.js';

// Uther Party 4.0 #42 "Spell Breaker Blood" (docs/uther-party/rules-4.0.md).
// A 1024x1024 night arena with cliff notches in the corners and a solid Demon
// Gate (256x256) in the middle. Every player is a Spell Breaker: 200 HP,
// speed 300, a 13-15 normal glaive (range 250, cooldown 1.9), 0 of 500 mana
// at 5 per second, magic immunity and Feedback (hits burn 20 mana from a
// rival breaker as bonus damage). From t=5, every 7 s (each after a random
// 0-2 s), the gate spawns a hostile summon while fewer than 30 units are in
// the arena. The roll follows the map's DifficultyCurve: mostly scarabs and
// skeletons, a Skeletal Mage with 0-mana Bloodlust, a harmless burrowed
// scarab, and rarely (0.7 % / 0.3 %) an Infernal or a Doom Guard, at most one
// big one at a time. Control Magic (range 700, cooldown 5) takes any summon
// that isn't yours, for 45 % of its CURRENT HP in mana, so wearing a creature
// down first makes it cheap. When a breaker dies, their whole army dies.
// Survival, 240 s; at the timer every survivor ties.
//
// Simplifications (the engine gives each player one hero):
//  - Army control: your summons follow you in a loose formation, attack
//    whatever you right-click (focus fire), and otherwise auto-acquire
//    enemies near them, as WC3 units do when idle.
//  - A controlled burrowed scarab unburrows by itself (1 s) instead of
//    through a separate Burrow button.
//  - Unit stats the sheet doesn't list (cooldowns, collision sizes, armour
//    types, missile speeds) use the WC3 1.26 base units as best known.
//  - Doom Guards use War Stomp by themselves; Cripple, Dispel and Rain of
//    Fire are left out (a Doom Guard spawns 0.3 % of the time).
//  - There is no fog of war (the original unallies without shared vision).
//  - Bots: the original's bots only wander outward every 4 s and never cast
//    Control Magic. Ours wander the same way but also take cheap summons now
//    and then, so a bot can build a small army and put up a fight.
const HW = wc3(512);
const NOTCH = wc3(128);
const GATE = wc3(128); // half size of the solid gate block
const RING = wc3(400);
const MANA_MAX = 500;
const MANA_REGEN = 5;
const CM = { range: wc3(700), cd: 5, frac: 0.45 };
const STEAL = { range: wc3(700), cd: 3, cost: 75 };
const CAP = 30;
const ACQUIRE = wc3(600);
const HERO_ACQUIRE = wc3(250);

// The spawn table (n = 1..7). Melee range 100 unless noted.
const MELEE = wc3(100);
export const SUMMONS = {
  1: { t: 'scarab1', name: 'Carrion Scarab', hp: 140, speed: wc3(270), r: wc3(16), def: 'medium', armor: 1, atk: { min: 8, max: 9, type: 'normal', range: MELEE, cd: 2, point: 0.5 } },
  2: { t: 'skeleton', name: 'Skeleton Warrior', hp: 180, speed: wc3(270), r: wc3(16), def: 'medium', armor: 1, atk: { min: 14, max: 15, type: 'normal', range: MELEE, cd: 2, point: 0.56 } },
  3: { t: 'scarab2', name: 'Carrion Scarab', hp: 275, speed: wc3(270), r: wc3(24), def: 'medium', armor: 2, atk: { min: 15, max: 18, type: 'normal', range: MELEE, cd: 2, point: 0.5 } },
  4: { t: 'mage', name: 'Skeletal Mage', hp: 230, speed: wc3(270), r: wc3(16), def: 'medium', armor: 0, atk: { min: 11, max: 12, type: 'pierce', range: wc3(500), cd: 2, point: 0.5, missile: wc3(900), art: 'bolt' } },
  5: { t: 'burrow', name: 'Carrion Scarab (burrowed)', hp: 410, speed: 0, r: wc3(32), def: 'medium', armor: 3, atk: null },
  6: { t: 'infernal', name: 'Infernal', hp: 1500, speed: wc3(320), r: wc3(48), def: 'heavy', armor: 6, atk: { min: 49, max: 60, type: 'chaos', range: MELEE, cd: 1.8, point: 0.5 } },
  7: { t: 'doom', name: 'Doom Guard', hp: 1350, speed: wc3(270), r: wc3(48), def: 'heavy', armor: 3, atk: { min: 35, max: 42, type: 'chaos', range: MELEE, cd: 1.35, point: 0.5 } },
};
// A burrowed scarab, unburrowed by its controller (ucs3).
const SCARAB3 = { t: 'scarab3', speed: wc3(270), atk: { min: 22, max: 27, type: 'normal', range: MELEE, cd: 2, point: 0.5 } };
const BLOODLUST = { dur: 40, cd: 8, range: wc3(600), rate: 1.4, move: 1.25 };
const IMMOLATION = { dps: 10, r: wc3(220) };
const STOMP = { r: wc3(250), dmg: 25, stun: 2, mana: 90, cd: 6 };

// The Random(1, Random(1, DC)) roll with the late-game and one-big-at-a-time rules.
export function rollSummon(dc, bigAlive) {
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  let n = ri(1, ri(1, dc));
  if (dc > 5 && Math.random() < 5 / 6) n = ri(1, 5);
  if (bigAlive) n = ri(1, 5);
  return n;
}

export class SpellBreakerBlood extends Minigame {
  static id = 'spellbreaker';
  static name = 'Spell Breaker Blood';
  static desc = 'Use summons to kill your opponents! Demons pour from the gate. Control Magic steals one for 45% of its current HP in mana, so hurt it first. Your army follows you and dies with you. Last breaker standing wins.';
  static controls = 'Right-click to move or attack (your army attacks with you). Q, then click a summon: Control Magic. W, then click a Bloodlusted enemy: Spell Steal.';
  static duration = 240;
  static ranking = 'survival';

  setup() {
    const props = treesAroundRect(HW + 1.2, HW + 1.2, 0.5, 2.2);
    this.map = { theme: 'sbnight', floor: { shape: 'rect', w: HW * 2, h: HW * 2 }, props, bounds: HW + 3, build: ['sbarena'], notch: round2(NOTCH), gate: round2(GATE) };
    this.abilities = [
      {
        name: 'Control Magic', icon: '🌀', kind: 'unit', cd: CM.cd, range: CM.range, castPoint: 0.3,
        desc: 'Take control of a summoned unit that is not yours. Costs 45% of its current HP in mana, so wound it first. Range 700.',
        pickTarget: (pid, u, x, y) => this.pickSummon(pid, u, x, y, (c) => c.owner !== pid),
        cast: (pid, u, tgt) => this.controlMagic(pid, u, tgt.u),
      },
      {
        name: 'Spell Steal', icon: '✨', kind: 'unit', cd: STEAL.cd, range: STEAL.range, castPoint: 0.3,
        desc: 'Steal Bloodlust from an enemy unit and give it to your nearest summon. 75 mana, range 700.',
        pickTarget: (pid, u, x, y) => this.pickSummon(pid, u, x, y, (c) => c.owner !== pid && c.bl > 0),
        cast: (pid, u, tgt) => this.spellSteal(pid, u, tgt.u),
      },
    ];
    // Breakers stand on a radius-400 ring at angles id*135-22.5, handed out at random.
    const slots = this.pids.map((_, i) => {
      const a = ((i * 135 - 22.5) * Math.PI) / 180;
      return [Math.cos(a) * RING, -Math.sin(a) * RING];
    });
    shuffle(slots);
    this.spawnHeroes(slots, { hp: 200, speed: wc3(300), r: wc3(31) });
    for (const [, u] of this.heroes) {
      u.skin = 'spellbreaker';
      u.def = 'medium';
      u.armor = 3;
      u.setFacing(Math.atan2(-u.y, -u.x));
    }
    this.attack = { range: wc3(250), cd: 1.9, point: 0.3, missile: wc3(1100), art: 'axe' };
    this.mana = new Map(this.pids.map((p) => [p, 0]));
    this.units = [];
    this.cmissiles = [];
    this.dc = 0;
    this.spawnAt = 5 + rand(0, 7); // the periodic timer's phase is set at map init
    this.pendingSpawns = [];
    this.thinkT = 0;
    this.gateId = newId();
  }

  // ------------------------------------------------------------ spawning

  livingInArena() {
    return this.alive.length + 1 + this.units.filter((c) => c.alive).length; // + the gate
  }

  tickSpawns(dt) {
    if (this.time >= this.spawnAt) {
      this.spawnAt += 7;
      this.pendingSpawns.push(rand(0, 2));
    }
    this.pendingSpawns = this.pendingSpawns.map((t) => t - dt);
    while (this.pendingSpawns.length && this.pendingSpawns[0] <= 0) {
      this.pendingSpawns.shift();
      if (this.livingInArena() >= CAP) continue;
      this.dc = Math.min(7, this.dc + 1);
      const big = this.units.some((c) => c.alive && (c.t === 'infernal' || c.t === 'doom'));
      this.spawn(rollSummon(this.dc, big));
    }
  }

  spawn(n) {
    const S = SUMMONS[n];
    // The spawn point (gate centre + (0,-64)) is inside the gate's solid
    // block, so the unit is nudged out of its south side.
    const c = fighter({ kind: 'sbunit', x: rand(-0.4, 0.4), y: GATE + S.r + 0.05, r: S.r, speed: S.speed, hp: S.hp, atk: S.atk && { ...S.atk }, def: S.def, armor: S.armor, acquire: ACQUIRE, facing: Math.PI / 2 });
    c.t = S.t;
    c.bl = 0;
    c.blCd = rand(0, 2);
    c.mana = S.t === 'doom' ? 500 : 0;
    c.stompCd = 0;
    c.immoT = 1;
    this.units.push(c);
    this.ev({ k: 'sbgate', x: round2(c.x), y: round2(c.y), big: n >= 6 ? 1 : undefined });
    if (n >= 6) this.ev({ k: 'sfx', s: 'bigboom' });
    return c;
  }

  // ------------------------------------------------------------ abilities

  pickSummon(pid, u, x, y, ok) {
    const c = nearest(this.units, x, y, 1.6, ok);
    if (!c) return null;
    if (dist(u.x, u.y, c.x, c.y) - c.r > CM.range) return null;
    return { x: c.x, y: c.y, u: c };
  }

  controlMagic(pid, u, c) {
    const refund = () => (this.acd.get(pid)[0] = 0);
    if (!c?.alive || c.owner === pid || !u.alive) return refund();
    const cost = Math.ceil(CM_COST(c));
    if (this.mana.get(pid) < cost) {
      this.ev({ k: 'txt', x: round1(u.x), y: round1(u.y), s: `Needs ${cost} mana`, c: '#8fb8ff', to: pid });
      return refund();
    }
    this.mana.set(pid, this.mana.get(pid) - cost);
    c.owner = pid;
    c.tgt = null;
    c.swing = null;
    c.stop();
    c.path = null;
    if (c.t === 'burrow') c.unburrow = 1;
    this.ev({ k: 'sbcontrol', x1: round2(u.x), y1: round2(u.y), x2: round2(c.x), y2: round2(c.y), u: c.id });
  }

  spellSteal(pid, u, c) {
    const refund = () => (this.acd.get(pid)[1] = 0);
    if (!c?.alive || !(c.bl > 0) || this.mana.get(pid) < STEAL.cost) return refund();
    const mine = nearest(this.units, c.x, c.y, wc3(700), (v) => v.owner === pid && v.atk);
    if (!mine) return refund();
    this.mana.set(pid, this.mana.get(pid) - STEAL.cost);
    mine.bl = c.bl;
    c.bl = 0;
    this.ev({ k: 'sbsteal', x1: round2(c.x), y1: round2(c.y), x2: round2(mine.x), y2: round2(mine.y) });
  }

  // ------------------------------------------------------------ combat

  attackables(pid) {
    const list = [...this.heroes.values()].filter((v) => v.alive && v.owner !== pid);
    for (const c of this.units) if (c.alive && c.owner !== pid) list.push(c);
    return list;
  }

  isHero(v) {
    return v.kind === 'paladin' && this.heroes.get(v.owner) === v;
  }

  // Enemies of a unit owned by `owner` (null = the gate's Player 12).
  enemiesOf(owner) {
    const list = [];
    for (const [pid, h] of this.heroes) if (h.alive && pid !== owner) list.push(h);
    for (const c of this.units) if (c.alive && c.owner !== owner) list.push(c);
    return list;
  }

  // A breaker's glaive: 13-15 normal, plus Feedback against a breaker with mana.
  attackHit(pid, u, tgt) {
    let dmg = dealt(roll(13, 15), 'normal', tgt.def, tgt.armor);
    if (this.isHero(tgt)) {
      const burn = Math.min(20, this.mana.get(tgt.owner) || 0);
      if (burn > 0) {
        this.mana.set(tgt.owner, this.mana.get(tgt.owner) - burn);
        dmg += burn;
        this.ev({ k: 'sbfeedback', x: round1(tgt.x), y: round1(tgt.y) });
      }
    }
    this.ev({ k: 'hit', x: round1(tgt.x), y: round1(tgt.y) });
    this.hurt(tgt, dmg, pid);
  }

  hurt(tgt, amount, byPid = null) {
    if (!tgt.alive || amount <= 0) return;
    if (this.isHero(tgt)) return this.damage(tgt.owner, amount);
    tgt.hp -= amount;
    if (amount >= 1) this.ev({ k: 'dmg', x: round1(tgt.x), y: round1(tgt.y), n: Math.round(amount) });
    if (tgt.hp <= 0) {
      tgt.hp = 0;
      tgt.alive = false;
      this.ev({ k: 'sbdie', x: round1(tgt.x), y: round1(tgt.y), t: tgt.t });
    }
  }

  // Spellbreaker Death: every unit the player owns dies with their breaker.
  eliminate(pid, how) {
    super.eliminate(pid, how);
    for (const c of this.units) {
      if (c.alive && c.owner === pid) {
        c.alive = false;
        this.ev({ k: 'sbdie', x: round1(c.x), y: round1(c.y), t: c.t });
      }
    }
  }

  unitHit = (src, tgt, base) => {
    const type = src.atk?.type || 'normal';
    this.ev({ k: 'hit', x: round1(tgt.x), y: round1(tgt.y) });
    this.hurt(tgt, dealt(base, type, tgt.def, tgt.armor));
  };

  // Summon brains, a few times a second.
  think(c) {
    if (c.unburrow > 0 || !c.atk) return;
    if (c.owner == null) {
      // Player 12: acquire the nearest player unit within 600 and chase it forever.
      if (!c.tgt?.alive) c.tgt = nearest(this.enemiesOf(null), c.x, c.y, c.acquire);
      return;
    }
    const hero = this.heroes.get(c.owner);
    if (!hero?.alive) return;
    // Focus fire: the army attacks what its breaker attacks.
    const focus = hero.attackOrder?.alive ? hero.attackOrder : null;
    if (focus && focus.owner !== c.owner) {
      c.tgt = focus;
      return;
    }
    const far = dist(c.x, c.y, hero.x, hero.y);
    if (c.tgt?.alive && far < wc3(900) && dist(c.x, c.y, c.tgt.x, c.tgt.y) < c.acquire * 1.5) return;
    c.tgt = null;
    // Idle: acquire enemies near the unit (and not too far from the breaker).
    if (far < wc3(700) && !(hero.walking && hero.target)) {
      c.tgt = nearest(this.enemiesOf(c.owner), c.x, c.y, wc3(500));
      if (c.tgt) return;
    }
    // Follow the breaker in a loose ring.
    const idx = this.units.filter((v) => v.owner === c.owner && v.alive).indexOf(c);
    const a = idx * 2.4 + hero.heading + Math.PI;
    const rr = wc3(110) + wc3(28) * Math.sqrt(idx + 1);
    const fx = hero.x + Math.cos(a) * rr;
    const fy = hero.y + Math.sin(a) * rr;
    if (dist(c.x, c.y, fx, fy) > wc3(90)) {
      if (c.target) c.steer(fx, fy);
      else c.order(fx, fy);
    }
  }

  stepSummon(c, dt) {
    if (!c.alive) return;
    if (c.unburrow > 0) {
      c.unburrow -= dt;
      if (c.unburrow <= 0) {
        c.t = SCARAB3.t;
        c.speed = SCARAB3.speed;
        c.atk = { ...SCARAB3.atk };
        this.ev({ k: 'sbunburrow', x: round2(c.x), y: round2(c.y) });
      }
      return;
    }
    if (c.bl > 0) c.bl -= dt;
    c.haste = c.bl > 0 ? BLOODLUST.rate : 1;
    c.speedMult = c.bl > 0 ? BLOODLUST.move : 1;
    fightStep(c, dt, {
      hit: this.unitHit,
      move: (u, x, y) => (u.target ? u.steer(x, y) : u.order(x, y)),
      missiles: this.cmissiles,
      ev: (e) => this.ev(e),
    });
    // Skeletal Mage: autocast Bloodlust (0 mana) on a friendly summon in a fight.
    if (c.t === 'mage') {
      c.blCd -= dt;
      if (c.blCd <= 0) {
        const tgt = nearest(this.units, c.x, c.y, BLOODLUST.range, (v) => v.owner === c.owner && v.atk && !(v.bl > 0) && (v.tgt || v === c));
        if (tgt) {
          tgt.bl = BLOODLUST.dur;
          c.blCd = BLOODLUST.cd;
          this.ev({ k: 'sbbloodlust', x: round2(tgt.x), y: round2(tgt.y), u: tgt.id });
        } else c.blCd = 0.5;
      }
    }
    // Infernal: Permanent Immolation, 10 per second to enemies within 220.
    // Spell damage: magic-immune Spell Breakers don't take it.
    if (c.t === 'infernal') {
      c.immoT -= dt;
      if (c.immoT <= 0) {
        c.immoT += 1;
        for (const v of this.units) if (v.alive && v !== c && v.owner !== c.owner && dist(v.x, v.y, c.x, c.y) <= IMMOLATION.r + v.r) this.hurt(v, IMMOLATION.dps);
      }
    }
    // Doom Guard: War Stomp when enemy summons crowd it (breakers are immune).
    if (c.t === 'doom') {
      c.mana = Math.min(500, c.mana + 1.25 * dt);
      c.stompCd -= dt;
      if (c.stompCd <= 0 && c.mana >= STOMP.mana) {
        const hit = this.units.filter((v) => v.alive && v.owner !== c.owner && dist(v.x, v.y, c.x, c.y) <= STOMP.r + v.r);
        if (hit.length >= 2) {
          c.mana -= STOMP.mana;
          c.stompCd = STOMP.cd;
          this.ev({ k: 'shove', x: round1(c.x), y: round1(c.y), r: round2(STOMP.r) });
          for (const v of hit) {
            v.stun = STOMP.stun;
            this.hurt(v, STOMP.dmg);
          }
        }
      }
    }
  }

  // WC3 heroes auto-acquire enemies that come within their acquisition range when idle.
  autoAcquire() {
    for (const [pid, u] of this.heroes) {
      if (!u.alive) continue;
      // An auto-acquired target is let go once it gets well away (a WC3 unit gives up the chase).
      if (u.autoAtk && u.attackOrder && (u.attackOrder !== u.autoAtk || !u.autoAtk.alive || dist(u.x, u.y, u.autoAtk.x, u.autoAtk.y) > wc3(650))) {
        if (u.attackOrder === u.autoAtk) {
          u.attackOrder = null;
          u.stop();
        }
        u.autoAtk = null;
      }
      if (u.attackOrder || u.target || u.cast || u.swing) continue;
      const t = nearest(this.attackables(pid), u.x, u.y, HERO_ACQUIRE + u.r);
      if (t) u.attackOrder = u.autoAtk = t;
    }
  }

  obstacles(u) {
    const lim = HW - NOTCH;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) pushOutRect(u, sx > 0 ? lim : -HW - 1, sy > 0 ? lim : -HW - 1, sx > 0 ? HW + 1 : -lim, sy > 0 ? HW + 1 : -lim);
    pushOutRect(u, -GATE, -GATE, GATE, GATE);
    clampToRect(u, HW, HW);
  }

  tick(dt) {
    for (const [pid, m] of this.mana) if (this.heroes.get(pid).alive) this.mana.set(pid, Math.min(MANA_MAX, m + MANA_REGEN * dt));
    this.tickSpawns(dt);
    this.autoAcquire();
    this.stepHeroes(dt);
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = 0.25;
      for (const c of this.units) if (c.alive) this.think(c);
    }
    for (const c of this.units) this.stepSummon(c, dt);
    const live = this.units.filter((c) => c.alive);
    stepUnits(live, dt);
    const all = [...[...this.heroes.values()].filter((h) => h.alive), ...live];
    collideUnits(all);
    for (const u of all) this.obstacles(u);
    this.cmissiles = stepMissiles(this.cmissiles, dt, this.unitHit);
    // Corpses stay a moment for their death animation.
    this.units = this.units.filter((c) => c.alive || (c.deadT = (c.deadT || 0) + dt) < 2.5);
  }

  // Original AI: every 4 s each bot unit wanders 200-400 u outward, at the
  // bearing from the centre +-120 deg. Idle breakers auto-attack what comes close.
  botThink(pid, u, mem) {
    mem.next ??= this.time + rand(0, 4);
    const mana = this.mana.get(pid);
    // Ours (not the original's): take a summon now and then when it's cheap enough.
    if (Math.random() < 0.025 * mem.skill && (this.acd.get(pid)[0] || 0) <= 0) {
      const c = nearest(this.units, u.x, u.y, CM.range, (v) => v.owner !== pid && CM_COST(v) <= mana && (v.atk || v.t === 'burrow'));
      if (c) return this.useAbility(pid, 0, c.x, c.y);
    }
    if (this.time < mem.next) return;
    mem.next = this.time + 4;
    const a = Math.atan2(u.y, u.x) + rand(-1, 1) * ((120 * Math.PI) / 180);
    const d = wc3(rand(200, 400));
    const x = Math.max(-HW + 1, Math.min(HW - 1, u.x + Math.cos(a) * d));
    const y = Math.max(-HW + 1, Math.min(HW - 1, u.y + Math.sin(a) * d));
    u.attackOrder = null;
    u.order(x, y);
  }


  hud(pid) {
    const army = this.units.filter((c) => c.alive && c.owner === pid).length;
    return { label: `🔷 Mana ${Math.floor(this.mana.get(pid))} / ${MANA_MAX} · Army ${army}` };
  }

  worldEnts() {
    const ents = [{ id: this.gateId, k: 'sbdemongate', x: 0, y: 0 }];
    for (const c of this.units) {
      const e = { id: c.id, k: 'sbunit', t: c.t, x: round2(c.x), y: round2(c.y), f: round2(c.facing), h: Math.max(0, Math.ceil((100 * c.hp) / c.maxHp)) };
      if (c.owner != null) e.o = c.owner;
      if (!c.alive) e.dead = 1;
      if (c.mx || c.my) e.mv = 1;
      if (c.swing) e.sw = 1;
      if (c.bl > 0) e.bl = 1;
      if (c.stun > 0) e.st = 1;
      if (c.unburrow > 0) e.ub = 1;
      ents.push(e);
    }
    for (const m of this.cmissiles) ents.push(missileSnap(m));
    return ents;
  }
}

// Control Magic's price: 45 % of the target's current life.
export function CM_COST(c) {
  return c.hp * CM.frac;
}

export const SB = { HW, GATE, NOTCH, CM, MANA_MAX, MANA_REGEN, CAP };
