import { MortarMayhem } from '../mortar.js';
import { newId, rand, dist, clampToRect, round1, round2, wc3, clamp, unitSnap } from '../../../engine/server/sim.js';

// Uther Party 4.0 #51 "Fel Orc Fiasco" (docs/uther-party/rules-4.0.md).
// A Free Play game in the original; here it joins the normal roll.
//
// Peon Pandemonium (#1, mortar.js) turned up, in the same 1024 x 1024 pit
// with siege engines on the four banks:
//  - From t = 5 s one siege engine arrives every second while there are
//    fewer than 30: catapults, then demolishers (burning oil) once 26 stand.
//  - Every 2 s, and right after every arrival, every engine is re-aimed at a
//    random point in the pit. 4.5 s reload, rocks fly at 400 u/s, splash
//    100 / 40 / 25 % within 25 / 50 / 150 u of the victim's edge.
//  - Fel Orc Peons: 50 HP, 1 HP/s regen, speed 190, medium armour (siege 50 %).
// New here: every peon has 100 lumber and can build ONE Fel Orc Burrow
// (75 lumber, 10 s, 200 HP, armour 2) that shelters only its owner. Rocks hit
// burrows too (full siege damage through the armour). Peons can chip enemy
// burrows (6-8 chaos every 3 s) and repair their own (35 % of the cost for
// full HP, at 1.5x the build time).
// Survival with ties (peons dying in the same instant share the ante). No
// timer in the original; a 300 s cap is added, as the remake notes suggest.
//
// Controls: Q Build Burrow (click a spot), W Enter / Leave Burrow (or
// right-click your burrow), E Repair, right-click an enemy burrow to attack it.
//
// Simplifications:
//  - The peon disappears into its burrow while building (the orc way) and
//    comes out when it is done; if the site is destroyed first, it pops out.
//  - A garrisoned peon pops out when its burrow falls (the sheet leaves this
//    unverified). A right-click while garrisoned leaves the burrow and walks there.
//  - Units standing on a new building site are pushed off it.
//  - The peon's attack damage point (not in the sheet) is taken as 0.3 s.
//  - Bots: the original's only order is a random walk every 4 s. They also
//    dodge incoming rocks (as in our Peon Pandemonium), and half of them
//    build and use a burrow so the mechanic shows up in bot games.

const HW = wc3(512);
const BANK_NEAR = wc3(704);
const BANK_FAR = wc3(864);
const BANK_SPAN = wc3(576);
const TIERS = [
  [wc3(25), 1],
  [wc3(50), 0.4],
  [wc3(150), 0.25],
];
const OIL_R = wc3(150);

export const FEL = { spawnStart: 5, spawnEvery: 1, fireEvery: 2, max: 30, demoFrom: 26, hp: 50, regen: 1, speed: wc3(190), r: wc3(16), lumber: 100 };
export const BURROW = {
  cost: 75,
  build: 10,
  hp: 200,
  startHp: 20, // WC3 buildings start at 10 % and gain HP as they go up
  half: wc3(96), // 6 x 6 pathing cells = 192 x 192
  armour: 1 - (0.06 * 2) / (1 + 0.06 * 2),
  load: wc3(120),
  reach: wc3(90),
  repairCost: 0.35,
  repairTime: 1.5,
};
export const PEON_ATTACK = { range: wc3(90), cd: 3, point: 0.3 };

export class FelOrcFiasco extends MortarMayhem {
  static id = 'fel';
  static name = 'Fel Orc Fiasco';
  static desc = 'Peon Pandemonium, only worse: a new catapult arrives every second, up to thirty. Dodge the rocks, or spend your lumber on a burrow to hide in until it is smashed. Last peon standing wins.';
  static controls = 'Right-click to move. Q, then click: build a burrow (75 lumber, 10 s). W: enter or leave it. E: repair it. Right-click an enemy burrow to attack it.';
  static duration = 300;
  static timer = false;
  static ranking = 'survival';

  get peonSkin() {
    return 'felpeon';
  }

  setup() {
    super.setup();
    for (const u of this.heroes.values()) u.regen = FEL.regen;
    // Both triggers are enabled at t = 5 s; these count down from then.
    this.spawnT = rand(0, FEL.spawnEvery);
    this.fireT = rand(0, FEL.fireEvery);
    this.lumber = new Map(this.pids.map((p) => [p, FEL.lumber]));
    this.burrows = [];
    this.goals = new Map(); // pid -> { type: 'build' | 'enter' | 'repair', ... }
    this.repairing = new Map(); // pid -> burrow
    this.attack = { range: PEON_ATTACK.range, cd: PEON_ATTACK.cd, point: PEON_ATTACK.point, dmg: 0, missile: 0 };
    this.abilities = [
      {
        name: 'Build Burrow',
        icon: '🛖',
        desc: `A Fel Orc Burrow: ${BURROW.cost} lumber, ${BURROW.build} s, ${BURROW.hp} HP. Shelters only you from the rocks.`,
        kind: 'point',
        range: wc3(400),
        available: (pid) => this.lumber.get(pid) >= BURROW.cost && !this.burrowOf(pid) && !this.heroes.get(pid).hidden,
        pickTarget: (pid, u, x, y) => this.siteAt(x, y),
        cast: (pid, u, tgt) => this.orderBuild(pid, u, tgt.x, tgt.y),
      },
      {
        name: 'Enter / Leave Burrow',
        icon: '🚪',
        desc: 'Hide in your burrow (or come out). Rocks cannot touch you inside, but they can smash the burrow.',
        kind: 'instant',
        available: (pid) => !!this.burrowOf(pid)?.built,
        cast: (pid, u) => this.toggleBurrow(pid, u),
      },
      {
        name: 'Repair',
        icon: '🔨',
        desc: `Repair your burrow: full HP costs ${BURROW.cost * BURROW.repairCost} lumber and takes ${BURROW.build * BURROW.repairTime} s.`,
        kind: 'instant',
        available: (pid) => {
          const b = this.burrowOf(pid);
          return !!b?.built && b.hp < BURROW.hp && this.lumber.get(pid) > 0.01 && !this.heroes.get(pid).hidden;
        },
        cast: (pid, u) => this.orderRepair(pid, u),
      },
    ];
    for (const pid of this.pids) this.acharges.set(pid, this.abilities.map(() => null));
  }

  burrowOf(pid) {
    return this.burrows.find((b) => b.owner === pid && b.alive);
  }

  // Build sites stay whole inside the pit.
  siteAt(x, y) {
    const m = HW - BURROW.half;
    return { x: clamp(x, -m, m), y: clamp(y, -m, m) };
  }

  command(pid, m) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return;
    if (m.c !== 'cast') {
      this.goals.delete(pid);
      this.repairing.delete(pid);
      if (u.hidden) {
        // A garrisoned peon takes no orders; a right-click unloads it and walks there.
        if (m.c === 'move' && !this.burrowOf(pid)?.building) {
          this.leaveBurrow(pid, u);
          u.order(+m.x || 0, +m.y || 0);
        }
        return;
      }
      if (m.c === 'move') {
        const b = this.burrowOf(pid);
        if (b?.built && Math.abs(+m.x - b.x) < BURROW.half + 0.3 && Math.abs(+m.y - b.y) < BURROW.half + 0.3) {
          u.attackOrder = null;
          this.goals.set(pid, { type: 'enter', b });
          u.order(b.x, b.y);
          return;
        }
      }
    } else if (u.hidden && (m.slot ?? 0) !== 1 && m.spell !== 's1') return;
    super.command(pid, m);
  }

  orderBuild(pid, u, x, y) {
    if (this.burrowOf(pid) || this.lumber.get(pid) < BURROW.cost) return;
    if (this.burrows.some((b) => b.alive && Math.abs(b.x - x) < BURROW.half * 2 && Math.abs(b.y - y) < BURROW.half * 2)) {
      this.ev({ k: 'txt', x: round1(x), y: round1(y), s: 'Cannot build there', c: '#ffcc00' });
      return;
    }
    if (this.edgeDist(u, { x, y }) <= BURROW.reach) this.startBuild(pid, u, x, y);
    else {
      this.goals.set(pid, { type: 'build', x, y });
      u.order(x, y);
    }
  }

  // Distance from a unit's edge to a burrow footprint's edge.
  edgeDist(u, b) {
    const dx = Math.max(0, Math.abs(u.x - b.x) - BURROW.half);
    const dy = Math.max(0, Math.abs(u.y - b.y) - BURROW.half);
    return Math.hypot(dx, dy) - u.r;
  }

  startBuild(pid, u, x, y) {
    if (this.burrows.some((b) => b.alive && Math.abs(b.x - x) < BURROW.half * 2 && Math.abs(b.y - y) < BURROW.half * 2)) return;
    this.lumber.set(pid, this.lumber.get(pid) - BURROW.cost);
    const b = { id: newId(), kind: 'burrow', owner: pid, x, y, r: BURROW.half, hp: BURROW.startHp, maxHp: BURROW.hp, alive: true, prog: 0, building: true, built: false, inside: pid };
    this.burrows.push(b);
    this.hide(u, b);
    this.ev({ k: 'sfx', s: 'smack' });
  }

  hide(u, b) {
    u.hidden = true;
    u.solid = false;
    u.stop();
    u.attackOrder = null;
    u.swing = null;
    u.x = b.x;
    u.y = b.y;
    b.inside = u.owner;
  }

  // Pops a peon out on the side of the burrow facing the pit's centre.
  unhide(u, b) {
    u.hidden = false;
    u.solid = true;
    if (b.inside === u.owner) b.inside = null;
    const a = Math.atan2(-b.y, -b.x) || 0;
    const k = BURROW.half + u.r + 0.1;
    const s = Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
    u.x = b.x + (Math.cos(a) / s) * k;
    u.y = b.y + (Math.sin(a) / s) * k;
    u.setFacing(a);
    clampToRect(u, HW, HW);
  }

  toggleBurrow(pid, u) {
    const b = this.burrowOf(pid);
    if (!b?.built) return;
    if (u.hidden) return this.leaveBurrow(pid, u);
    if (this.edgeDist(u, b) <= BURROW.load) this.enterBurrow(pid, u, b);
    else {
      this.goals.set(pid, { type: 'enter', b });
      u.order(b.x, b.y);
    }
  }

  enterBurrow(pid, u, b) {
    this.hide(u, b);
    this.ev({ k: 'sfx', s: 'smack' });
  }

  leaveBurrow(pid, u) {
    const b = this.burrows.find((x) => x.inside === pid && x.alive);
    if (b && !b.building) this.unhide(u, b);
  }

  orderRepair(pid, u) {
    const b = this.burrowOf(pid);
    if (!b?.built) return;
    if (this.edgeDist(u, b) <= BURROW.reach) this.startRepair(pid, u, b);
    else {
      this.goals.set(pid, { type: 'repair', b });
      u.order(b.x, b.y);
    }
  }

  startRepair(pid, u, b) {
    u.stop();
    u.attackOrder = null;
    this.repairing.set(pid, b);
  }

  stepGoals() {
    for (const [pid, g] of this.goals) {
      const u = this.heroes.get(pid);
      if (!u.alive || u.hidden || (g.b && !g.b.alive)) {
        this.goals.delete(pid);
        continue;
      }
      const d = g.b ? this.edgeDist(u, g.b) : this.edgeDist(u, g);
      const reach = g.type === 'enter' ? BURROW.load : BURROW.reach;
      if (d > reach) {
        if (!u.target) u.order(g.b ? g.b.x : g.x, g.b ? g.b.y : g.y);
        continue;
      }
      this.goals.delete(pid);
      if (g.type === 'build') {
        if (!this.burrowOf(pid) && this.lumber.get(pid) >= BURROW.cost) this.startBuild(pid, u, g.x, g.y);
      } else if (g.type === 'enter') this.enterBurrow(pid, u, g.b);
      else this.startRepair(pid, u, g.b);
    }
  }

  stepBurrows(dt) {
    if (this.burrowFell) {
      // Drop fallen burrows (orders still holding one see alive === false).
      this.burrowFell = false;
      let n = 0;
      for (const b of this.burrows) if (b.alive) this.burrows[n++] = b;
      this.burrows.length = n;
    }
    for (const b of this.burrows) {
      if (!b.alive || !b.building) continue;
      b.prog += dt;
      b.hp = Math.min(BURROW.hp, b.hp + ((BURROW.hp - BURROW.startHp) / BURROW.build) * dt);
      if (b.prog >= BURROW.build) {
        b.building = false;
        b.built = true;
        const u = this.heroes.get(b.owner);
        if (u?.alive && u.hidden) this.unhide(u, b);
        this.ev({ k: 'txt', x: round1(b.x), y: round1(b.y), s: 'Burrow ready', c: '#ffd700' });
      }
    }
    for (const [pid, b] of this.repairing) {
      const u = this.heroes.get(pid);
      const lumber = this.lumber.get(pid);
      if (!u.alive || !b.alive || b.hp >= BURROW.hp || lumber <= 0.001 || this.edgeDist(u, b) > BURROW.reach + 0.2) {
        this.repairing.delete(pid);
        continue;
      }
      const full = BURROW.build * BURROW.repairTime;
      const hp = Math.min(BURROW.hp - b.hp, (BURROW.hp / full) * dt, (lumber / (BURROW.cost * BURROW.repairCost)) * BURROW.hp);
      b.hp += hp;
      this.lumber.set(pid, Math.max(0, lumber - (hp / BURROW.hp) * BURROW.cost * BURROW.repairCost));
      u.faceTo = Math.atan2(b.y - u.y, b.x - u.x);
    }
  }

  hurtBurrow(b, dmg) {
    if (!b.alive || dmg <= 0) return;
    b.hp -= dmg;
    if (dmg >= 1) this.ev({ k: 'dmg', x: round1(b.x), y: round1(b.y), n: Math.round(dmg) });
    if (b.hp > 0) return;
    b.alive = false;
    b.hp = 0;
    this.burrowFell = true;
    this.ev({ k: 'burrowfall', x: round2(b.x), y: round2(b.y), r: round2(BURROW.half) });
    for (const u of this.heroes.values()) {
      if (u.alive && u.hidden && b.inside === u.owner) {
        u.hidden = false;
        u.solid = true;
        b.inside = null;
      }
    }
    for (const [pid, rb] of this.repairing) if (rb === b) this.repairing.delete(pid);
  }

  attackables(pid) {
    return this.burrows.filter((b) => b.alive && b.owner !== pid);
  }

  // Peons can only hit buildings: 6 + 1d2 chaos, through the burrow's armour.
  attackHit(pid, u, tgt) {
    if (!tgt.alive || tgt.kind !== 'burrow') return;
    this.ev({ k: 'hit', x: round1(tgt.x), y: round1(tgt.y) });
    this.hurtBurrow(tgt, (7 + Math.floor(Math.random() * 2)) * BURROW.armour);
  }

  spawnSiege() {
    const side = Math.floor(rand(0, 4));
    const along = rand(-BANK_SPAN, BANK_SPAN);
    const out = rand(BANK_NEAR, BANK_FAR);
    const [x, y] = [
      [out, along],
      [along, out],
      [-out, along],
      [along, -out],
    ][side];
    const demo = this.siege.length >= FEL.demoFrom;
    this.siege.push({ id: newId(), x, y, f: Math.atan2(-y, -x), demo, cd: 0, aim: null, wind: -1 });
    this.ev({ k: 'tele', x1: round2(x), y1: round2(y), x2: round2(x), y2: round2(y) });
  }

  tick(dt) {
    if (this.time >= FEL.spawnStart) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT += FEL.spawnEvery;
        if (this.siege.length < FEL.max) {
          this.spawnSiege();
          this.aimAll();
        }
      }
      this.fireT -= dt;
      if (this.fireT <= 0) {
        this.fireT += FEL.fireEvery;
        this.aimAll();
      }
    }
    for (const s of this.siege) this.stepSiege(s, dt);

    this.stepGoals();
    this.stepBurrows(dt);
    this.stepHeroes(dt);
    for (const u of this.heroes.values()) {
      if (!u.alive) continue;
      if (u.hidden) {
        const b = this.burrows.find((x) => x.inside === u.owner && x.alive);
        if (b) {
          u.x = b.x;
          u.y = b.y;
        }
        continue;
      }
      clampToRect(u, HW, HW);
      for (const b of this.burrows) if (b.alive) pushOut(u, b);
    }

    for (const r of this.rocks) {
      r.t += dt;
      if (r.t >= r.flight) this.land(r);
    }
    this.rocks = this.rocks.filter((r) => !r.dead);

    for (const o of this.oil) {
      o.t -= dt;
      o.tick -= dt;
      if (o.tick <= 0) {
        o.tick += 0.5;
        for (const [pid, u] of this.heroes) if (u.alive && !u.hidden && dist(u.x, u.y, o.x, o.y) <= OIL_R + u.r) this.damage(pid, 6, 'death');
      }
    }
    this.oil = this.oil.filter((o) => o.t > 0);
  }

  // A rock lands: peons in the open take the splash at 50 % (medium armour),
  // burrows the full siege roll through their armour, both by distance to
  // their edge. Garrisoned peons are safe.
  land(r) {
    r.dead = true;
    let hit = false;
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.hidden) continue;
      const d = dist(u.x, u.y, r.x, r.y) - u.r;
      const tier = TIERS.find(([rad]) => d <= rad);
      if (tier) {
        hit = true;
        this.damage(pid, r.dmg * tier[1], 'death');
      }
    }
    for (const b of this.burrows) {
      if (!b.alive) continue;
      const d = Math.hypot(Math.max(0, Math.abs(r.x - b.x) - BURROW.half), Math.max(0, Math.abs(r.y - b.y) - BURROW.half));
      const tier = TIERS.find(([rad]) => d <= rad);
      if (tier) {
        hit = true;
        this.hurtBurrow(b, r.dmg * 2 * BURROW.armour * tier[1]);
      }
    }
    this.ev({ k: 'boom', s: r.oil ? 'fire' : 'rock', x: round2(r.x), y: round2(r.y), r: TIERS[2][0], c: r.oil ? '#ff7a20' : '#c0a080', big: hit ? 1 : undefined });
    if (r.oil) this.oil.push({ id: newId(), x: r.x, y: r.y, t: 2.51, tick: 0.5 });
  }

  botThink(pid, u, mem) {
    if (u.hidden) return;
    mem.builder ??= Math.random() < 0.5;
    mem.wander ??= this.time + rand(0, 4);
    const b = this.burrowOf(pid);
    if (mem.builder && !this.goals.has(pid)) {
      if (!b && this.lumber.get(pid) >= BURROW.cost) {
        // Give up after a few blocked sites.
        mem.tries = (mem.tries || 0) + 1;
        if (mem.tries > 4) mem.builder = false;
        const s = this.siteAt(u.x + rand(-2, 2), u.y + rand(-2, 2));
        return this.useAbility(pid, 0, s.x, s.y);
      }
      if (b?.built && b.hp > BURROW.hp * 0.25) return this.useAbility(pid, 1, u.x, u.y);
    }
    if (this.goals.has(pid)) return;
    const before = u.target;
    super.botThink(pid, u, mem);
    // "Peon AI": a new random point in the pit every 4 s.
    if (this.time >= mem.wander) {
      mem.wander = this.time + 4;
      if (u.target === before) {
        const x = rand(-HW + 0.5, HW - 0.5);
        const y = rand(-HW + 0.5, HW - 0.5);
        if (!this.inDanger(x, y, 0.3)) u.order(x, y);
      }
    }
  }

  heroEnts() {
    const ents = [];
    for (const u of this.heroes.values()) {
      if (u.hidden && u.alive) continue;
      const fx = [];
      if ((u.cast && u.cast.t >= 0) || u.swing || this.repairing.has(u.owner)) fx.push('casting');
      ents.push(unitSnap(u, fx.length ? { fx } : {}));
    }
    return ents;
  }

  hud(pid) {
    const b = this.burrowOf(pid);
    const u = this.heroes.get(pid);
    let s = `Lumber ${Math.floor(this.lumber.get(pid) ?? 0)}`;
    if (b?.building) s += ` · Burrow ${Math.floor((b.prog / BURROW.build) * 100)} %`;
    else if (b) s += ` · Burrow ${Math.ceil(b.hp)} HP${u?.hidden ? ' (inside)' : ''}`;
    return { label: s };
  }

  worldEnts(pid) {
    const ents = super.worldEnts(pid);
    const repairing = new Set(this.repairing.values());
    for (const b of this.burrows) {
      if (!b.alive) continue;
      ents.push({ id: b.id, k: 'burrow', x: round2(b.x), y: round2(b.y), o: b.owner, hp: Math.ceil(b.hp), mhp: BURROW.hp, b: b.building ? round2(b.prog / BURROW.build) : 1, g: b.inside != null ? 1 : undefined, rp: repairing.has(b) ? 1 : undefined });
    }
    return ents;
  }
}

// Pushes a walking peon out of a burrow's square footprint along the shallowest axis.
function pushOut(u, b) {
  const px = BURROW.half + u.r - Math.abs(u.x - b.x);
  const py = BURROW.half + u.r - Math.abs(u.y - b.y);
  if (px <= 0 || py <= 0) return;
  if (px < py) u.x += Math.sign(u.x - b.x || 1) * px;
  else u.y += Math.sign(u.y - b.y || 1) * py;
}
