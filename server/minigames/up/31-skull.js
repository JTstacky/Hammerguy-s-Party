import { Minigame } from '../../base.js';
import { Unit, newId, rand, dist, round2, wc3, stepUnits, collideUnits } from '../../../engine/server/sim.js';

// Uther Party 4.0 #31 "The Skull of Gul'dan" (docs/uther-party/rules-4.0.md):
// the biggest event. A 1536x3072 cave, entrance and finish circle in the
// south, the boss room in the north behind an iron gate.
//  - Co-op phase: players are allied. Guards stand by two foot switches; when
//    heroes have stood on BOTH, the gate opens and a boss appears (50/50 Pit
//    Lord or Dreadlord) carrying the Skull. 10 s later it hunts the whole cave.
//  - When the boss dies everyone turns hostile, the Skull drops, and two big
//    demons (Doom Guards for the Pit Lord, Infernals for the Dreadlord) spawn
//    at the switches and march on the spot where it died.
//  - Winner takes all: carry the Skull into the finish circle for 8 points;
//    everyone else scores 0. 240 s timer; expiry is a draw (all 0). Dead
//    heroes do not revive.
//  - Every enemy's HP is raised by 20 % per player (NA handicap 100 + 20N %).
//  - Heroes are level-3 Demon Hunters: 675 HP, speed 320, armour 5.5, 27-49
//    hero damage every 1.7 s, 300 mana. Mana Burn (Q: 50 mana, range 300,
//    cooldown 7, burns 50 mana as damage), Immolation (W: 25 mana, then 7/s;
//    10 damage/s within 160), Evasion 10 %. One Potion of Healing to start.
//  - Kills pay bounty. The Goblin Merchant by the entrance sells Potions of
//    Healing (20 g, +250 HP) and Mana (10 g, +150 mana).
//  - Hidden treasures: the Sludge Monstrosity drops a Potion of Speed; one of
//    the five egg sacks a Potion of Lesser Invulnerability (7 s); the other
//    sacks release a spider 1 time in 3.
//  - Bots: every 10 s attack-move to a random switch; once the boss is out,
//    every 2 s go for the Skull: pick it up, attack whoever holds it, or carry
//    it home. A bot within 72 u of the Skull is given it.
// Remake simplifications:
//  - Items: E drinks a Potion of Healing, R uses your other potion (mana,
//    speed or invulnerability). Right-click an item to pick it up. Right-click
//    the merchant to buy: a Potion of Healing, or a Potion of Mana if you
//    cannot afford one. Stock is unlimited.
//  - No hero levels or XP. Creep abilities are reduced to the ones that shape
//    the fight: Bloodfiend cleave, Sludge slow; boss spells: Pit Lord cleave,
//    Rain of Fire and Howl of Terror; Dreadlord Vampiric Aura, Carrion Swarm
//    and Sleep; Infernal immolation. Silence, Ensnare and Venom are left out.
//  - Bots drink a Potion of Healing when badly hurt and burn Immolation in
//    fights, and step out of Rain of Fire (the original's bots never used
//    items or spells).
const GRID = [
  '#####..#####', // 2944
  '####....####',
  '#.#......###', // 2688: boss spawn (B) at the centre of this row
  '..#......###',
  '#.##....####',
  '#####..#####', // 2304
  '..###..###..', // 2176: foot switches
  '..###..##...', // 2048: the gate (cols 5-6)
  '...##..##...', // 1920: the guards
  '#...........',
  '#..........#',
  '##........##', // 1536
  '#####..#####',
  '#####..#####',
  '##......####', // 1152
  '#...........', // 1024: Sludge Monstrosity
  '...........#', // 896: spider room, egg sacks
  '...##..##..#',
  '#####..#####', // 640
  '#.###..####.',
  '####....####',
  '#.#......###', // 256
  '...........#', // 128: merchant, finish circle
  '#..........#', // 0
];
const COLS = 12;
const ROWS = 24;
const TILE = wc3(128);
const W = COLS * TILE;
const H = ROWS * TILE;
const GATE_ROW = 7;
const GATE_COLS = [5, 6];
// WC3 (x, y) in the rect (7680,0)-(9216,3072) to ours (north is -y).
const P = (wx, wy) => ({ x: wc3(wx - 8448), y: -wc3(wy - 1536) });
export const SPOTS = {
  start: P(8448, 128),
  finish: P(8448, 128),
  merchant: P(7936, 128),
  boss: P(8448, 2752),
  buttonL: P(7808, 2176),
  buttonR: P(9088, 2176),
  gate: P(8448, 2112),
  guardL: P(7936, 1920),
  guardR: P(9024, 1920),
  spider: P(7936, 960),
  sludge: P(8960, 1024),
};
const FINISH_HALF = wc3(64);
const BUTTON_HALF = wc3(64);
const EGGS = [P(7712, 928), P(7712, 832), P(7776, 768), P(7840, 832), P(7808, 896)];
const PICKUP = wc3(100);
const BOT_GIVE = wc3(72);
const SHOP_R = wc3(250);
const TIME = 240;

// Unit stats. dmg: [min, max]; atk: attack type; missile: speed or 0 (melee).
const HERO = { name: 'Demon Hunter', hp: 675, mana: 300, manaRegen: 1, regen: 1, speed: wc3(320), r: wc3(31), armor: 5.5, dmg: [27, 49], atk: 'hero', cd: 1.7, point: 0.3, range: wc3(100), acq: wc3(100) };
const CREEPS = {
  bloodfiend: { name: 'Bloodfiend', hp: 450, armor: 1, dmg: [23, 26], atk: 'chaos', cd: 1.35, point: 0.4, range: wc3(100), speed: wc3(270), r: wc3(32), bounty: 26, cleave: [0.25, wc3(150)] },
  tormentor: { name: 'Vile Tormentor', hp: 510, armor: 0, dmg: [31, 37], atk: 'pierce', cd: 1.75, point: 0.4, range: wc3(500), missile: wc3(900), speed: wc3(270), r: wc3(32), bounty: 30, mana: 400 },
  succubus: { name: 'Succubus', hp: 400, armor: 0, dmg: [15, 17], atk: 'normal', cd: 1.35, point: 0.4, range: wc3(100), speed: wc3(270), r: wc3(24), bounty: 22, mana: 250 },
  giantspider: { name: 'Giant Spider', hp: 550, armor: 1, dmg: [18, 21], atk: 'normal', cd: 1.35, point: 0.45, range: wc3(100), speed: wc3(270), r: wc3(40), bounty: 26 },
  spider: { name: 'Spider', hp: 200, armor: 0, dmg: [10, 11], atk: 'normal', cd: 1.35, point: 0.4, range: wc3(100), speed: wc3(270), r: wc3(20), bounty: 10, acq: wc3(275) },
  sludge: { name: 'Sludge Monstrosity', hp: 600, armor: 1, dmg: [24, 27], atk: 'normal', cd: 1.6, point: 0.5, range: wc3(100), speed: wc3(200), r: wc3(44), bounty: 28, slow: true },
  egg: { name: 'Egg Sack', hp: 15, armor: 0, dmg: null, speed: 0, r: wc3(24), bounty: 0 },
  pitlord: { name: 'Pit Lord', hp: 1450, armor: 7, dmg: [58, 72], atk: 'hero', cd: 1.8, point: 0.45, range: wc3(100), speed: wc3(270), r: wc3(48), bounty: 100, mana: 600, boss: true, cleave: [0.8, wc3(200)] },
  dreadlord: { name: 'Dreadlord', hp: 1150, armor: 6, dmg: [45, 55], atk: 'hero', cd: 1.6, point: 0.4, range: wc3(100), speed: wc3(300), r: wc3(36), bounty: 100, mana: 800, boss: true, vamp: 0.45 },
  doomguard: { name: 'Doom Guard', hp: 1350, armor: 3, dmg: [41, 48], atk: 'chaos', cd: 1.4, point: 0.5, range: wc3(100), speed: wc3(270), r: wc3(48), bounty: 50, acq: wc3(2000) },
  infernal: { name: 'Infernal', hp: 1500, armor: 6, dmg: [49, 60], atk: 'chaos', cd: 1.8, point: 0.5, range: wc3(100), speed: wc3(190), r: wc3(48), bounty: 50, acq: wc3(2000), immo: true },
};
// 1.26 attack table against the two armour types in play (heroes: hero; creeps: medium).
const ATK_VS = { hero: { hero: 1, medium: 1 }, normal: { hero: 1, medium: 1.5 }, pierce: { hero: 0.5, medium: 0.75 }, chaos: { hero: 1, medium: 1 }, spell: { hero: 1, medium: 1 } };
const armorMult = (a) => (a >= 0 ? 1 - (0.06 * a) / (1 + 0.06 * a) : 2 - 0.94 ** -a);
const MANA_BURN = { mana: 50, burn: 50, range: wc3(300), cd: 7 };
const IMMO = { on: 25, drain: 7, dps: 10, r: wc3(160) };
// Boss spell mana costs (WC3 1.26 hero spells; assumed constant across
// levels) and an assumed mana regeneration, so Mana Burn starves the boss.
const BOSS_MANA = { rof: 75, howl: 75, swarm: 110, sleep: 50, regen: 1.5 };
const POTION = { heal: 250, mana: 150, speed: 45, invul: 7 };

export class SkullOfGuldan extends Minigame {
  static id = 'skull';
  static name = "The Skull of Gul'dan";
  static desc = "Obtain the skull of Gul'dan, and escape! Work together through the cave: stand on both switches to open the gate, then slay the demon who holds the Skull. Then it is every hero for himself: carry the Skull back to the circle at the entrance. Winner takes all.";
  static controls = 'Right-click to move, attack, pick up items and buy at the goblin. Q Mana Burn (then click), W Immolation on/off, E Healing Potion, R other potion.';
  static duration = TIME;
  static ranking = 'race';

  setup() {
    const n = this.pids.length;
    this.scale = 1 + 0.2 * n;
    this.gateOpen = false;
    this.ffa = false;
    this.map = { theme: 'skull_cave', floor: { shape: 'rect', w: W, h: H }, props: [], bounds: H / 2 + 2, build: ['skull_cave'], grid: GRID, tile: TILE, gate: { row: GATE_ROW, cols: GATE_COLS }, spots: SPOTS };
    this.abilities = [
      {
        name: 'Mana Burn', icon: '🔥', desc: 'Burns 50 mana from an enemy, dealing as much damage. Range 300. 50 mana.', kind: 'unit', cd: MANA_BURN.cd, range: MANA_BURN.range, castPoint: 0.3,
        available: (pid) => this.heroes.get(pid).mana >= MANA_BURN.mana,
        pickTarget: (pid, u, x, y) => this.pickEnemy(pid, u, x, y, MANA_BURN.range),
        cast: (pid, u, tgt) => this.manaBurn(u, tgt.u),
      },
      {
        name: 'Immolation', icon: '🌋', desc: 'Toggle: burns enemies within 160 for 10 damage a second. 25 mana, then 7 mana a second.', kind: 'instant', cd: 0.5,
        available: (pid) => this.heroes.get(pid).immo || this.heroes.get(pid).mana >= IMMO.on,
        cast: (pid, u) => this.toggleImmo(u),
      },
      {
        name: 'Potion of Healing', icon: '🧪', desc: 'Restores 250 HP. Buy more from the goblin merchant (20 gold).', kind: 'instant', cd: 20,
        available: (pid) => this.heroes.get(pid).inv.heal > 0,
        cast: (pid, u) => this.drink(u, 'heal'),
      },
      {
        name: 'Potion', icon: '⚗️', desc: 'Drinks your other potion: Mana (+150 mana), Speed (+60 % speed, 45 s) or Lesser Invulnerability (7 s).', kind: 'instant', cd: 1,
        available: (pid) => !!this.otherPotion(this.heroes.get(pid)),
        cast: (pid, u) => this.drink(u, this.otherPotion(u)),
      },
    ];
    this.spawnHeroes(this.pids.map(() => [SPOTS.start.x + wc3(rand(-256, 256)), SPOTS.start.y]), { hp: HERO.hp, speed: HERO.speed, r: HERO.r, regen: HERO.regen, facing: -Math.PI / 2 });
    for (const u of this.heroes.values()) {
      this.initFighter(u, HERO, 'hero');
      u.mana = HERO.mana;
      u.inv = { heal: 1, mana: 0, speed: 0, invul: 0, skull: false };
      u.gold = 0;
      u.immo = false;
      u.skin = 'skull_dh'; // Demon Hunter (Edem)
    }
    this.creeps = [];
    const camp = (type, spot, n2, spread, campId) => {
      for (let i = 0; i < n2; i++) this.spawnCreep(type, spot.x + rand(-spread, spread), spot.y + rand(-spread, spread) * 0.6, campId);
    };
    camp('bloodfiend', SPOTS.guardL, 2, 1, 'L');
    this.spawnCreep('tormentor', SPOTS.guardR.x, SPOTS.guardR.y, 'R');
    camp('succubus', SPOTS.guardR, 2, 1.2, 'R');
    this.spawnCreep('giantspider', SPOTS.spider.x, SPOTS.spider.y, 'S');
    camp('spider', SPOTS.spider, 2, 1, 'S');
    this.spawnCreep('sludge', SPOTS.sludge.x, SPOTS.sludge.y, 'D');
    const lucky = Math.floor(Math.random() * EGGS.length);
    EGGS.forEach((p, i) => {
      const e = this.spawnCreep('egg', p.x, p.y, 'E');
      e.treasure = i === lucky;
    });
    this.items = [];
    this.missiles = [];
    this.fires = []; // Rain of Fire
    this.pressed = { L: false, R: false };
    this.boss = null;
    this.bossT = 0;
    this.skullHolder = null; // unit carrying the Skull (boss or hero)
    this.fieldCache = new Map();
    this.aiT = 4;
  }

  // ------------------------------------------------------------ units

  initFighter(u, st, side) {
    u.st = st;
    u.side = side;
    u.atkOrder = null;
    u.atkCd = 0;
    u.swing = null;
    u.goal = null;
    u.attackMove = false;
    u.navT = 0;
    u.sleep = 0;
    u.slowT = 0;
    u.howlT = 0;
    u.invulT = 0;
    u.speedT = 0;
  }

  spawnCreep(type, x, y, camp = null) {
    const st = CREEPS[type];
    const c = new Unit({ kind: 'creep', x, y, r: st.r, speed: st.speed, hp: Math.round(st.hp * this.scale) });
    c.type = type;
    c.camp = camp;
    c.home = { x, y };
    c.mana = st.mana || 0;
    c.setFacing(Math.PI / 2);
    c.turnRate = 0.5;
    this.initFighter(c, st, 'creep');
    c.acq = st.acq || wc3(200);
    c.spellT = rand(4, 8);
    if (type === 'egg') c.solid = true;
    this.creeps.push(c);
    return c;
  }

  get fighters() {
    return [...this.heroes.values(), ...this.creeps];
  }

  enemies(a, b) {
    if (!a.alive || !b.alive || a === b || b.finished) return false;
    if (a.side === 'creep' && b.side === 'creep') return false;
    if (a.side === 'hero' && b.side === 'hero') return this.ffa;
    return true;
  }

  // ------------------------------------------------------------ pathing

  walkable(c, r) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
    if (GRID[r][c] === '#') return false;
    if (!this.gateOpen && r === GATE_ROW && GATE_COLS.includes(c)) return false;
    return true;
  }

  tileOf(x, y) {
    return [Math.floor((x + W / 2) / TILE), Math.floor((y + H / 2) / TILE)];
  }

  centre(c, r) {
    return { x: -W / 2 + (c + 0.5) * TILE, y: -H / 2 + (r + 0.5) * TILE };
  }

  freeAt(x, y) {
    const [c, r] = this.tileOf(x, y);
    return this.walkable(c, r);
  }

  // Line of sight for a unit of radius `r`: the segment and both its edges stay on walkable tiles.
  los(x0, y0, x1, y1, r) {
    const d = dist(x0, y0, x1, y1);
    if (d < 0.01) return true;
    const nx = (-(y1 - y0) / d) * r * 0.9;
    const ny = ((x1 - x0) / d) * r * 0.9;
    const n = Math.ceil(d / 0.4);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      if (!this.freeAt(x, y) || !this.freeAt(x + nx, y + ny) || !this.freeAt(x - nx, y - ny)) return false;
    }
    return true;
  }

  // Distance field (in steps) to a goal tile, 8-way without cutting corners.
  field(gc, gr) {
    const key = `${gc},${gr},${this.gateOpen ? 1 : 0}`;
    let f = this.fieldCache.get(key);
    if (f) return f;
    f = new Float32Array(COLS * ROWS).fill(Infinity);
    const q = [[gc, gr]];
    f[gr * COLS + gc] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const [c, r] = q[qi];
      const d0 = f[r * COLS + c];
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (!dc && !dr) continue;
          const nc = c + dc;
          const nr = r + dr;
          if (!this.walkable(nc, nr)) continue;
          if (dc && dr && (!this.walkable(c + dc, r) || !this.walkable(c, r + dr))) continue;
          const nd = d0 + (dc && dr ? 1.414 : 1);
          if (nd < f[nr * COLS + nc]) {
            f[nr * COLS + nc] = nd;
            q.push([nc, nr]);
          }
        }
      }
    }
    this.fieldCache.set(key, f);
    return f;
  }

  // The next point to walk to on the way to `goal`: the goal itself if it is
  // in sight, else the farthest tile centre in sight along the shortest path.
  waypoint(u, goal) {
    if (this.los(u.x, u.y, goal.x, goal.y, u.r)) return goal;
    let [gc, gr] = this.tileOf(goal.x, goal.y);
    if (!this.walkable(gc, gr)) [gc, gr] = this.nearestFree(gc, gr);
    const f = this.field(gc, gr);
    let [c, r] = this.tileOf(u.x, u.y);
    if (!this.walkable(c, r) || f[r * COLS + c] === Infinity) {
      const [fc, fr] = this.nearestFree(c, r, f);
      return this.centre(fc, fr);
    }
    let best = null;
    for (let k = 0; k < 10 && f[r * COLS + c] > 0; k++) {
      let nb = null;
      let nd = f[r * COLS + c];
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          const v = f[(r + dr) * COLS + (c + dc)];
          if ((dc || dr) && this.walkable(c + dc, r + dr) && v < nd) {
            nd = v;
            nb = [c + dc, r + dr];
          }
        }
      }
      if (!nb) break;
      [c, r] = nb;
      const p = this.centre(c, r);
      if (k === 0 || this.los(u.x, u.y, p.x, p.y, u.r)) best = p;
      else break;
    }
    return best || goal;
  }

  nearestFree(c, r, f = null) {
    let best = [c, r];
    let bd = Infinity;
    for (let dc = -3; dc <= 3; dc++) {
      for (let dr = -3; dr <= 3; dr++) {
        const nc = c + dc;
        const nr = r + dr;
        if (!this.walkable(nc, nr) || (f && f[nr * COLS + nc] === Infinity)) continue;
        const d = dc * dc + dr * dr;
        if (d < bd) {
          bd = d;
          best = [nc, nr];
        }
      }
    }
    return best;
  }

  // Walk units with a destination along their path.
  navigate(u, dt) {
    if (!u.goal || u.stun > 0 || u.sleep > 0) return;
    if (u.swing || u.cast) return;
    u.navT -= dt;
    if (u.navT > 0 && u.target) return;
    u.navT = 0.12;
    if (dist(u.x, u.y, u.goal.x, u.goal.y) < 0.25) {
      u.goal = null;
      u.stop();
      return;
    }
    const wp = this.waypoint(u, u.goal);
    if (u.target) u.steer(wp.x, wp.y);
    else u.order(wp.x, wp.y);
  }

  moveTo(u, x, y, attackMove = false) {
    u.goal = { x, y };
    u.attackMove = attackMove;
    u.navT = 0;
  }

  // Push units out of wall tiles (and the closed gate).
  pushOut(u) {
    const [c0, r0] = this.tileOf(u.x, u.y);
    for (let c = c0 - 1; c <= c0 + 1; c++) {
      for (let r = r0 - 1; r <= r0 + 1; r++) {
        if (this.walkable(c, r)) continue;
        const x0 = -W / 2 + c * TILE;
        const y0 = -H / 2 + r * TILE;
        const cx = Math.max(x0, Math.min(x0 + TILE, u.x));
        const cy = Math.max(y0, Math.min(y0 + TILE, u.y));
        const dx = u.x - cx;
        const dy = u.y - cy;
        const d = Math.hypot(dx, dy);
        if (d >= u.r) continue;
        if (d > 1e-6) {
          u.x = cx + (dx / d) * u.r;
          u.y = cy + (dy / d) * u.r;
        } else {
          // Centre inside the wall: out through the nearest free side.
          const opts = [[u.x - x0 + u.r, -1, 0], [x0 + TILE - u.x + u.r, 1, 0], [u.y - y0 + u.r, 0, -1], [y0 + TILE - u.y + u.r, 0, 1]].filter(([, sx, sy]) => this.walkable(c + sx, r + sy)).sort((a, b) => a[0] - b[0]);
          if (opts.length) {
            u.x += opts[0][1] * opts[0][0];
            u.y += opts[0][2] * opts[0][0];
          }
        }
      }
    }
  }

  // ------------------------------------------------------------ commands

  command(pid, m) {
    const u = this.heroes.get(pid);
    if (!u?.alive || u.finished) return;
    if (m.c === 'cast') {
      if (u.stun > 0 || u.sleep > 0) return;
      return super.command(pid, m);
    }
    if (m.c === 'stop') {
      u.goal = null;
      u.atkOrder = null;
      u.pickup = null;
      u.shop = false;
      return u.cast ? (u.cast.queued = 'stop') : u.stop();
    }
    if (m.c !== 'move' && m.c !== 'steer') return;
    const x = +m.x || 0;
    const y = +m.y || 0;
    if (m.c === 'move') {
      u.pickup = null;
      u.shop = false;
      // Right-click priority: an enemy, an item, the merchant, the ground.
      const t = this.fighters.filter((v) => this.enemies(u, v) && dist(x, y, v.x, v.y) < v.r + 0.8).sort((a, b) => dist(x, y, a.x, a.y) - dist(x, y, b.x, b.y))[0];
      if (t) {
        u.atkOrder = t;
        u.goal = null;
        return;
      }
      const it = this.items.find((i) => dist(x, y, i.x, i.y) < 1);
      u.atkOrder = null;
      if (it) {
        u.pickup = it;
        return this.moveTo(u, it.x, it.y);
      }
      if (dist(x, y, SPOTS.merchant.x, SPOTS.merchant.y) < 1.4) {
        u.shop = true;
        return this.moveTo(u, SPOTS.merchant.x, SPOTS.merchant.y + 1.2);
      }
    }
    this.moveTo(u, x, y);
  }

  useAbility(pid, slot, x, y) {
    const u = this.heroes.get(pid);
    if (!u || u.stun > 0 || u.sleep > 0) return;
    super.useAbility(pid, slot, x, y);
  }

  pickEnemy(pid, u, x, y, range) {
    const t = this.fighters.filter((v) => this.enemies(u, v) && dist(x, y, v.x, v.y) < v.r + 1.2).sort((a, b) => dist(x, y, a.x, a.y) - dist(x, y, b.x, b.y))[0];
    if (!t || dist(u.x, u.y, t.x, t.y) - u.r - t.r > range + 0.5) return null;
    return { x: t.x, y: t.y, u: t };
  }

  // ------------------------------------------------------------ tick

  tick(dt) {
    // Buttons, gate and boss.
    if (!this.gateOpen) {
      for (const u of this.heroes.values()) {
        if (!u.alive) continue;
        for (const [k, s] of [['L', SPOTS.buttonL], ['R', SPOTS.buttonR]]) {
          if (!this.pressed[k] && Math.abs(u.x - s.x) < BUTTON_HALF && Math.abs(u.y - s.y) < BUTTON_HALF) {
            this.pressed[k] = true;
            this.ev({ k: 'skull_button', x: round2(s.x), y: round2(s.y) });
          }
        }
      }
      if (this.pressed.L && this.pressed.R) this.openGate();
    }
    if (this.boss && this.bossT > 0) {
      this.bossT -= dt;
      if (this.bossT <= 0) this.boss.acq = wc3(5000);
    }
    if (this.time >= this.aiT) {
      this.aiT += this.boss || this.ffa ? 2 : 10;
      this.botsPlan();
    }
    for (const u of this.fighters) if (u.alive && !u.finished) this.stepBuffs(u, dt);
    for (const u of this.fighters) if (u.alive && !u.finished) this.stepFighter(u, dt);
    for (const u of this.fighters) if (u.alive && !u.finished) this.navigate(u, dt);
    this.stepHeroes(dt);
    stepUnits(this.creeps, dt);
    const all = this.fighters.filter((v) => v.alive && !v.finished);
    collideUnits(all);
    for (const u of all) this.pushOut(u);
    this.stepMissiles(dt);
    this.stepFires(dt);
    this.stepItems();
    this.creeps = this.creeps.filter((c) => c.alive);
    // Winner takes all: the Skull carried into the finish circle.
    const h = this.skullHolder;
    if (h?.side === 'hero' && h.alive && Math.abs(h.x - SPOTS.finish.x) < FINISH_HALF + h.r * 0.5 && Math.abs(h.y - SPOTS.finish.y) < FINISH_HALF + h.r * 0.5) {
      this.finish(h.owner);
      this.done = true;
      this.ev({ k: 'skull_win', x: round2(h.x), y: round2(h.y) });
    }
  }

  openGate() {
    this.gateOpen = true;
    this.ev({ k: 'skull_gate', x: SPOTS.gate.x, y: SPOTS.gate.y });
    const type = Math.random() < 0.5 ? 'pitlord' : 'dreadlord';
    const b = this.spawnCreep(type, SPOTS.boss.x, SPOTS.boss.y, 'B');
    b.setFacing(Math.PI / 2);
    b.acq = wc3(200);
    this.boss = b;
    this.bossT = 10;
    this.skullHolder = b;
    this.ev({ k: 'skull_boss', x: round2(b.x), y: round2(b.y), t: type });
    this.party.msg(`The gate opens! A ${CREEPS[type].name} holds the Skull of Gul'dan.`, '#b060ff');
  }

  stepBuffs(u, dt) {
    for (const k of ['sleep', 'slowT', 'howlT', 'invulT', 'speedT']) if (u[k] > 0) u[k] = Math.max(0, u[k] - dt);
    u.speedMult = (u.slowT > 0 ? 0.4 : 1) * (u.speedT > 0 ? 1.6 : 1);
    if (u.speed * u.speedMult > wc3(400)) u.speedMult = wc3(400) / u.speed;
    if (u.sleep > 0) {
      u.stop();
      u.swing = null;
    }
    if (u.side === 'hero') {
      u.mana = Math.min(HERO.mana, u.mana + HERO.manaRegen * dt);
      if (u.immo) {
        u.mana -= IMMO.drain * dt;
        if (u.mana <= 0) {
          u.mana = 0;
          u.immo = false;
        }
      }
    }
    // Immolation (heroes) and the Infernals' permanent immolation: a tick every second.
    if (u.immo || u.st.immo) {
      u.immoT = (u.immoT ?? 1) - dt;
      if (u.immoT <= 0) {
        u.immoT += 1;
        const r = u.st.immo ? wc3(220) : IMMO.r;
        for (const v of this.fighters) if (this.enemies(u, v) && dist(u.x, u.y, v.x, v.y) <= r + v.r) this.hurt(u, v, IMMO.dps, 'spell');
      }
    }
  }

  // WC3 attack for any fighter: acquire, chase along the path, turn, swing.
  stepFighter(u, dt) {
    if (u.atkCd > 0) u.atkCd -= dt;
    if (u.stun > 0 || u.sleep > 0 || !u.st.dmg) return;
    if (u.swing) {
      u.swing.t += dt;
      if (u.swing.t >= u.st.point) {
        const t = u.swing.tgt;
        u.swing = null;
        if (t.alive) {
          if (u.st.missile) this.missiles.push({ id: newId(), src: u, x: u.x, y: u.y, tgt: t, speed: u.st.missile });
          else this.attackLand(u, t);
        }
      }
      return;
    }
    if (u.cast) return;
    if (u.dodgeT > 0) {
      u.dodgeT -= dt;
      return;
    }
    let t = u.atkOrder;
    if (t && !this.enemies(u, t)) t = u.atkOrder = null;
    if (!t && (!u.goal || u.attackMove) && !u.pickup && !u.shop) {
      t = this.nearestEnemy(u, u.acq ?? u.st.acq ?? HERO.acq);
      if (t) u.atkOrder = t;
    }
    if (!t) return;
    // Bots flank a cleaving boss: one standing in the cleave around the boss's
    // victim steps round to the far side (added AI; the original bots clump).
    if (t.st?.boss && t.st.cleave && u.side === 'hero' && this.bots.has(u.owner)) {
      const v = t.atkOrder;
      if (v && v !== u && v.alive && dist(u.x, u.y, v.x, v.y) <= t.st.cleave[1] + u.r) {
        const a = Math.atan2(t.y - v.y, t.x - v.x) + rand(-0.6, 0.6);
        const d = t.r + u.r + u.st.range * 0.6;
        const [x, y] = [t.x + Math.cos(a) * d, t.y + Math.sin(a) * d];
        if (this.freeAt(x, y)) {
          u.dodgeT = 0.8;
          this.moveTo(u, x, y);
          return;
        }
      }
    }
    // Bosses cast their spells while fighting.
    if (u.st.boss) this.bossSpells(u, t, dt);
    const gap = dist(u.x, u.y, t.x, t.y) - u.r - t.r;
    if (gap > u.st.range) {
      u.goal = { x: t.x, y: t.y };
      return;
    }
    u.goal = null;
    if (u.target) u.stop();
    const ang = Math.atan2(t.y - u.y, t.x - u.x);
    if (!u.facingAt(ang, 0.35)) {
      u.faceTo = ang;
      return;
    }
    u.faceTo = null;
    if (u.atkCd > 0) return;
    u.atkCd = u.st.cd;
    u.swing = { t: 0, tgt: t };
    this.ev({ k: 'swing', u: u.id });
  }

  nearestEnemy(u, range) {
    let best = null;
    let bd = range;
    for (const v of this.fighters) {
      if (!this.enemies(u, v) || v.type === 'egg') continue;
      const d = dist(u.x, u.y, v.x, v.y) - u.r - v.r;
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  roll(u) {
    const [a, b] = u.st.dmg;
    return a + Math.random() * (b - a);
  }

  attackLand(u, t) {
    let dmg = this.roll(u) * (u.howlT > 0 ? 0.5 : 1);
    if (t.side === 'hero' && Math.random() < 0.1) {
      this.ev({ k: 'txt', x: round2(t.x), y: round2(t.y), s: 'miss', c: '#ffffff' });
      return;
    }
    this.ev({ k: 'hit', x: round2(t.x), y: round2(t.y) });
    const done = this.hurt(u, t, dmg, u.st.atk);
    if (u.st.vamp) u.hp = Math.min(u.maxHp, u.hp + done * u.st.vamp);
    if (u.st.cleave) {
      const [k, r] = u.st.cleave;
      for (const v of this.fighters) if (v !== t && this.enemies(u, v) && dist(t.x, t.y, v.x, v.y) <= r + v.r) this.hurt(u, v, dmg * k, u.st.atk);
    }
    if (u.st.slow && t.side === 'hero' && Math.random() < 0.25) {
      t.slowT = 10;
      this.ev({ k: 'skull_slow', u: t.id, x: round2(t.x), y: round2(t.y) });
    }
  }

  // Deals damage after armour and the attack table. Returns what was dealt.
  hurt(src, t, amount, atk) {
    if (!t.alive || t.invulT > 0) return 0;
    const armorType = t.side === 'hero' ? 'hero' : 'medium';
    const armor = t.side === 'hero' ? HERO.armor : t.st.armor;
    const dmg = atk === 'spell' ? amount : amount * (ATK_VS[atk]?.[armorType] ?? 1) * armorMult(armor);
    if (dmg <= 0) return 0;
    if (t.sleep > 0) t.sleep = 0;
    // A creep that is hit, and its campmates, fight back.
    if (t.side === 'creep' && src) {
      if (!t.atkOrder && src.side === 'hero') t.atkOrder = src;
      if (t.camp) for (const c of this.creeps) if (c.camp === t.camp && c.alive && !c.atkOrder && src.side === 'hero') c.atkOrder = src;
    } else if (t.side === 'hero' && src && !t.atkOrder && !t.goal && this.enemies(t, src)) t.atkOrder = src;
    if (t.side === 'hero') {
      this.damage(t.owner, dmg, 'death');
      if (!t.alive) this.heroDied(t, src);
      return dmg;
    }
    t.hp -= dmg;
    if (dmg >= 1) this.ev({ k: 'dmg', x: round2(t.x), y: round2(t.y), n: Math.round(dmg) });
    if (t.hp <= 0) this.creepDied(t, src);
    return dmg;
  }

  heroDied(u, src) {
    u.immo = false;
    if (this.skullHolder === u) this.dropSkull(u);
    if (src?.side === 'hero') src.gold += 50;
  }

  creepDied(c, src) {
    c.alive = false;
    this.ev({ k: 'skull_die', x: round2(c.x), y: round2(c.y), t: c.type, f: round2(c.facing) });
    if (src?.side === 'hero' && c.st.bounty) {
      src.gold += c.st.bounty;
      this.ev({ k: 'txt', x: round2(c.x), y: round2(c.y), s: `+${c.st.bounty}`, c: '#ffd700', to: src.owner });
    }
    if (c.type === 'sludge') this.dropItem('speed', c.x, c.y);
    if (c.type === 'egg') {
      if (c.treasure) this.dropItem('invul', c.x, c.y);
      else if (Math.random() < 1 / 3) {
        const s = this.spawnCreep('spider', c.x, c.y, 'E');
        if (src?.side === 'hero') s.atkOrder = src;
      }
    }
    if (c === this.boss) this.bossDied(c);
  }

  bossDied(b) {
    this.boss = null;
    this.ffa = true;
    this.dropSkull(b);
    this.ev({ k: 'skull_bossdeath', x: round2(b.x), y: round2(b.y) });
    this.party.msg('The demon falls! Every hero for himself: take the Skull to the circle!', '#ff5050');
    const esc = b.type === 'pitlord' ? 'doomguard' : 'infernal';
    for (const s of [SPOTS.buttonL, SPOTS.buttonR]) {
      const e = this.spawnCreep(esc, s.x, s.y, null);
      e.acq = wc3(2000);
      this.moveTo(e, b.x, b.y, true);
      this.ev({ k: 'skull_summon', x: round2(s.x), y: round2(s.y), t: esc });
    }
    for (const u of this.heroes.values()) u.atkOrder = null;
  }

  // ------------------------------------------------------------ missiles, spells, items

  stepMissiles(dt) {
    for (const m of this.missiles) {
      const t = m.tgt;
      if (!t.alive) {
        m.done = true;
        continue;
      }
      const d = dist(m.x, m.y, t.x, t.y);
      const step = m.speed * dt;
      m.f = Math.atan2(t.y - m.y, t.x - m.x);
      if (d <= step) {
        m.done = true;
        this.attackLand(m.src, t); // a missile in flight still lands if its shooter died
        continue;
      }
      m.x += ((t.x - m.x) / d) * step;
      m.y += ((t.y - m.y) / d) * step;
    }
    this.missiles = this.missiles.filter((m) => !m.done);
  }

  manaBurn(u, t) {
    if (!t?.alive) return;
    u.mana -= MANA_BURN.mana;
    const burn = Math.min(MANA_BURN.burn, t.mana || 0);
    t.mana = (t.mana || 0) - burn;
    this.ev({ k: 'skull_manaburn', x1: round2(u.x), y1: round2(u.y), x2: round2(t.x), y2: round2(t.y) });
    if (burn > 0) this.hurt(u, t, burn, 'spell');
  }

  toggleImmo(u) {
    if (u.immo) u.immo = false;
    else if (u.mana >= IMMO.on) {
      u.mana -= IMMO.on;
      u.immo = true;
      u.immoT = 1;
    }
  }

  otherPotion(u) {
    return ['invul', 'speed', 'mana'].find((k) => u.inv[k] > 0) || null;
  }

  drink(u, kind) {
    if (!kind || !(u.inv[kind] > 0)) return;
    u.inv[kind]--;
    if (kind === 'heal') u.hp = Math.min(u.maxHp, u.hp + POTION.heal);
    else if (kind === 'mana') u.mana = Math.min(HERO.mana, u.mana + POTION.mana);
    else if (kind === 'speed') u.speedT = POTION.speed;
    else if (kind === 'invul') u.invulT = POTION.invul;
    this.ev({ k: 'skull_potion', x: round2(u.x), y: round2(u.y), t: kind });
  }

  bossSpells(b, t, dt) {
    b.mana = Math.min(b.st.mana, b.mana + BOSS_MANA.regen * dt);
    b.spellT -= dt;
    if (b.spellT > 0) return;
    const heroes = [...this.heroes.values()].filter((h) => h.alive && !h.finished);
    const near = heroes.filter((h) => dist(h.x, h.y, b.x, b.y) < wc3(800));
    if (!near.length) return;
    const pick = (a, b2) => {
      const first = Math.random() < 0.6 ? a : b2;
      const second = first === a ? b2 : a;
      return b.mana >= BOSS_MANA[first] ? first : b.mana >= BOSS_MANA[second] ? second : null;
    };
    const spell = b.type === 'pitlord' ? pick('rof', 'howl') : pick('swarm', 'sleep');
    if (!spell) {
      b.spellT = 1;
      return;
    }
    b.mana -= BOSS_MANA[spell];
    if (b.type === 'pitlord') {
      if (spell === 'rof') {
        // Rain of Fire on a hero: six waves a second apart, 200 u radius.
        const v = near[Math.floor(Math.random() * near.length)];
        this.fires.push({ id: newId(), x: v.x, y: v.y, r: wc3(200), waves: 6, t: 0.6, src: b });
        this.ev({ k: 'skull_rof', x: round2(v.x), y: round2(v.y), r: round2(wc3(200)) });
      } else {
        // Howl of Terror: heroes within 500 deal half damage for 15 s.
        for (const h of heroes) if (dist(h.x, h.y, b.x, b.y) <= wc3(500)) h.howlT = 15;
        this.ev({ k: 'skull_howl', x: round2(b.x), y: round2(b.y), r: round2(wc3(500)) });
      }
      b.spellT = rand(9, 13);
    } else {
      if (spell === 'swarm') {
        // Carrion Swarm: a widening wave toward the target, 200 to each hero in it.
        const a = Math.atan2(t.y - b.y, t.x - b.x);
        for (const h of heroes) {
          const dx = h.x - b.x;
          const dy = h.y - b.y;
          const along = dx * Math.cos(a) + dy * Math.sin(a);
          const side = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
          if (along > 0 && along < wc3(700) && side < wc3(100) + along * 0.25 + h.r) this.hurt(b, h, 200, 'spell');
        }
        this.ev({ k: 'skull_swarm', x: round2(b.x), y: round2(b.y), f: round2(a) });
      } else {
        // Sleep on a hero other than the one it is fighting (15 s, broken by damage).
        const others = near.filter((h) => h !== t);
        const v = (others.length ? others : near)[Math.floor(Math.random() * (others.length || near.length))];
        v.sleep = 15;
        v.stop();
        v.goal = null;
        v.atkOrder = null;
        v.swing = null;
        this.ev({ k: 'skull_sleep', u: v.id, x: round2(v.x), y: round2(v.y) });
      }
      b.spellT = rand(8, 12);
    }
  }

  stepFires(dt) {
    for (const f of this.fires) {
      f.t -= dt;
      if (f.t > 0) continue;
      f.t = 1;
      f.waves--;
      this.ev({ k: 'skull_rofwave', x: round2(f.x), y: round2(f.y), r: round2(f.r) });
      for (const h of this.heroes.values()) if (h.alive && !h.finished && dist(h.x, h.y, f.x, f.y) <= f.r + h.r) this.hurt(f.src, h, 40, 'spell');
      if (f.waves <= 0) f.done = true;
    }
    this.fires = this.fires.filter((f) => !f.done);
  }

  dropItem(type, x, y) {
    const it = { id: newId(), type, x: x + rand(-0.3, 0.3), y: y + rand(-0.3, 0.3) };
    if (!this.freeAt(it.x, it.y)) [it.x, it.y] = [x, y];
    this.items.push(it);
    return it;
  }

  dropSkull(holder) {
    if (holder.inv) holder.inv.skull = false;
    this.skullHolder = null;
    const it = this.dropItem('skull', holder.x, holder.y);
    this.ev({ k: 'skull_drop', x: round2(it.x), y: round2(it.y) });
  }

  give(u, it) {
    this.items = this.items.filter((i) => i !== it);
    if (u.pickup === it) u.pickup = null;
    if (it.type === 'skull') {
      u.inv.skull = true;
      this.skullHolder = u;
      this.ev({ k: 'skull_pickup', x: round2(u.x), y: round2(u.y), s: 1 });
      this.party.msg(`${this.party.room.nameOf(u.owner)} has the Skull of Gul'dan!`, this.party.room.colorOf(u.owner));
    } else {
      u.inv[it.type]++;
      this.ev({ k: 'skull_pickup', x: round2(u.x), y: round2(u.y) });
    }
  }

  stepItems() {
    for (const u of this.heroes.values()) {
      if (!u.alive || u.finished) continue;
      if (u.pickup) {
        if (!this.items.includes(u.pickup)) u.pickup = null;
        else if (dist(u.x, u.y, u.pickup.x, u.pickup.y) <= PICKUP + u.r) this.give(u, u.pickup);
      }
      if (u.shop && dist(u.x, u.y, SPOTS.merchant.x, SPOTS.merchant.y) <= SHOP_R) {
        u.shop = false;
        u.goal = null;
        u.stop();
        const kind = u.gold >= 20 ? 'heal' : u.gold >= 10 ? 'mana' : null;
        if (kind) {
          u.gold -= kind === 'heal' ? 20 : 10;
          u.inv[kind]++;
          this.ev({ k: 'sfx', s: 'buy', to: u.owner });
          this.ev({ k: 'txt', x: round2(u.x), y: round2(u.y), s: kind === 'heal' ? 'Potion of Healing' : 'Potion of Mana', c: '#ffd700' });
        } else this.ev({ k: 'txt', x: round2(u.x), y: round2(u.y), s: 'Not enough gold', c: '#ff8080' });
      }
    }
  }

  // ------------------------------------------------------------ bots

  botsPlan() {
    // One switch is picked for the whole AI group each time.
    const button = Math.random() < 0.5 ? SPOTS.buttonL : SPOTS.buttonR;
    for (const pid of this.bots.keys()) {
      const u = this.heroes.get(pid);
      if (!u?.alive || u.finished || u.sleep > 0) continue;
      if (!this.boss && !this.ffa) {
        // AI Initial: attack-move to a random switch.
        if (!u.atkOrder) this.moveTo(u, button.x, button.y, true);
        continue;
      }
      // AI Boss: the Skull on the ground -> go to it; held -> attack the holder; ours -> home.
      const skull = this.items.find((i) => i.type === 'skull');
      if (u.inv.skull) {
        u.atkOrder = null;
        this.moveTo(u, SPOTS.finish.x, SPOTS.finish.y);
      } else if (skull) {
        u.atkOrder = null;
        u.pickup = skull;
        this.moveTo(u, skull.x, skull.y);
      } else if (this.skullHolder?.alive) {
        const h = this.skullHolder;
        if (this.ffa && h.side === 'hero' && dist(u.x, u.y, h.x, h.y) > wc3(700)) {
          // Added: a rival carrier far away is cut off at the finish circle
          // instead of chased through the demons.
          u.atkOrder = null;
          this.moveTo(u, SPOTS.finish.x + rand(-1.5, 1.5), SPOTS.finish.y - wc3(300), true);
        } else {
          u.atkOrder = h;
          u.goal = null;
        }
      }
    }
  }

  botThink(pid, u) {
    // Given the Skull within 72 u.
    const skull = this.items.find((i) => i.type === 'skull');
    if (skull && dist(u.x, u.y, skull.x, skull.y) <= BOT_GIVE + u.r) this.give(u, skull);
    if (u.hp < u.maxHp * 0.35 && u.inv.heal > 0 && !(this.acd.get(pid)[2] > 0)) this.useAbility(pid, 2, u.x, u.y);
    // The other potion: invulnerability when nearly dead, speed with the
    // Skull, mana when dry.
    const other = this.otherPotion(u);
    if (other && !(this.acd.get(pid)[3] > 0) && ((other === 'invul' && u.hp < u.maxHp * 0.25) || (other === 'speed' && u.inv.skull) || (other === 'mana' && u.mana < MANA_BURN.mana))) this.useAbility(pid, 3, u.x, u.y);
    // Step out of Rain of Fire.
    const fire = this.fires.find((f) => dist(u.x, u.y, f.x, f.y) < f.r + u.r + 0.3);
    if (fire && !(u.dodgeT > 0)) {
      const a = Math.atan2(u.y - fire.y, u.x - fire.x) + rand(-0.4, 0.4);
      const d = fire.r + u.r + 0.8;
      let [x, y] = [fire.x + Math.cos(a) * d, fire.y + Math.sin(a) * d];
      if (!this.freeAt(x, y)) [x, y] = [fire.x - Math.cos(a) * d, fire.y - Math.sin(a) * d];
      u.dodgeT = 1.2;
      u.swing = null;
      this.moveTo(u, x, y);
    }
    // Mana Burn on a caster in range (the boss above all): damage, and fewer
    // Rains of Fire, Carrion Swarms and Sleeps.
    if (!u.cast && !(u.dodgeT > 0) && u.mana >= MANA_BURN.mana && !(this.acd.get(pid)[0] > 0)) {
      const t = this.fighters.find((v) => v.alive && v.mana >= 10 && this.enemies(u, v) && (v.st.boss || v.side === 'creep') && dist(u.x, u.y, v.x, v.y) <= MANA_BURN.range + v.r);
      if (t) this.useAbility(pid, 0, t.x, t.y);
    }
    // Immolation while something is close enough to burn.
    const close = this.fighters.some((v) => this.enemies(u, v) && v.type !== 'egg' && dist(u.x, u.y, v.x, v.y) < wc3(260));
    if (close !== u.immo && (u.immo || u.mana >= IMMO.on + 40) && !u.cast) this.useAbility(pid, 1, u.x, u.y);
  }

  progress(pid) {
    return this.heroes.get(pid)?.inv?.skull ? 1 : 0;
  }

  // ------------------------------------------------------------ snapshots

  hud(pid) {
    const u = this.heroes.get(pid);
    if (!u) return null;
    const h = this.skullHolder;
    const who = !h ? (this.items.some((i) => i.type === 'skull') ? 'on the ground!' : 'somewhere in the cave') : h.side === 'hero' ? (h === u ? 'YOU have it! Run to the circle!' : `carried by ${this.party.room.nameOf(h.owner)}`) : `held by the ${h.st.name}`;
    const stage = this.gateOpen ? '' : ` · Switches ${+this.pressed.L + +this.pressed.R}/2`;
    return { label: `Gold ${Math.floor(u.gold)} · Mana ${Math.floor(u.mana)}${stage} · Skull: ${who}` };
  }

  abilitiesSnap(pid) {
    const out = super.abilitiesSnap(pid);
    const u = this.heroes.get(pid);
    if (!u?.inv) return out;
    out[1].name = u.immo ? 'Immolation (on)' : 'Immolation';
    out[2].left = u.inv.heal;
    const k = this.otherPotion(u);
    const N = { mana: ['Potion of Mana', '💧'], speed: ['Potion of Speed', '👟'], invul: ['Potion of Lesser Invulnerability', '✨'] };
    if (k) {
      out[3].name = N[k][0];
      out[3].icon = N[k][1];
      out[3].left = u.inv[k];
    } else out[3].left = 0;
    return out;
  }

  heroEnts(pid) {
    return super.heroEnts(pid).map((e) => {
      const u = this.heroes.get(e.o);
      const fx = e.fx || [];
      if (u.invulT > 0) fx.push('invuln');
      if (u.speedT > 0) fx.push('dash');
      if (fx.length) e.fx = fx;
      return e;
    });
  }

  worldEnts() {
    const ents = [];
    for (const c of this.creeps) {
      if (!c.alive) continue;
      ents.push({ id: c.id, k: 'skull_creep', t: c.type, x: round2(c.x), y: round2(c.y), f: round2(c.facing), hp: Math.ceil(c.hp), mhp: c.maxHp, mv: c.mx || c.my ? 1 : undefined, sw: c.swing ? 1 : undefined, sk: this.skullHolder === c ? 1 : undefined, sl: c.sleep > 0 ? 1 : undefined });
    }
    // Immolation, Sleep and the carried Skull, drawn by the game's view.
    for (const u of this.heroes.values()) {
      if (u.alive && (u.immo || u.sleep > 0 || u.inv.skull)) ents.push({ id: `hf${u.id}`, k: 'skull_herofx', x: round2(u.x), y: round2(u.y), im: u.immo ? 1 : undefined, sl: u.sleep > 0 ? 1 : undefined, sk: u.inv.skull ? 1 : undefined });
    }
    for (const m of this.missiles) ents.push({ id: m.id, k: 'missile', x: round2(m.x), y: round2(m.y), f: round2(m.f || 0), m: 'fire' });
    for (const it of this.items) ents.push({ id: it.id, k: 'skull_item', t: it.type, x: round2(it.x), y: round2(it.y) });
    for (const f of this.fires) ents.push({ id: f.id, k: 'skull_fire', x: round2(f.x), y: round2(f.y), r: round2(f.r) });
    ents.push({ id: 'gate', k: 'skull_gate', x: SPOTS.gate.x, y: SPOTS.gate.y, open: this.gateOpen ? 1 : undefined });
    ents.push({ id: 'btnL', k: 'skull_switch', x: SPOTS.buttonL.x, y: SPOTS.buttonL.y, on: this.pressed.L ? 1 : undefined });
    ents.push({ id: 'btnR', k: 'skull_switch', x: SPOTS.buttonR.x, y: SPOTS.buttonR.y, on: this.pressed.R ? 1 : undefined });
    if (!this.gateOpen) ents.push({ id: 'portal', k: 'skull_portal', x: SPOTS.boss.x, y: SPOTS.boss.y });
    ents.push({ id: 'finish', k: 'skull_finish', x: SPOTS.finish.x, y: SPOTS.finish.y });
    ents.push({ id: 'merchant', k: 'skull_merchant', x: SPOTS.merchant.x, y: SPOTS.merchant.y - 0.2, f: round2(-Math.PI / 2) });
    return ents;
  }

  debugStats() {
    return `gate=${this.gateOpen} ffa=${this.ffa} boss=${this.boss?.type ?? '-'} holder=${this.skullHolder?.side ?? '-'} creeps=${this.creeps.length} items=${this.items.map((i) => i.type).join('/')} hp=${[...this.heroes.values()].map((u) => Math.round(u.hp)).join(',')} pos=${[...this.heroes.values()].map((u) => `${u.x.toFixed(0)},${u.y.toFixed(0)}`).join(' ')}`;
  }
}
