import { Minigame } from '../../base.js';
import { Unit, stepUnits, collideUnits, rand, dist, round2, wc3, unitSnap, pick, newId } from '../../../engine/server/sim.js';
import { W, noTies, Obstacles, Nav, goTo, followPaths, nearest, idle, clampOct, dice, stopOnLostTarget } from './e-common.js';

// Uther Party 4.0 #25 "The Masquerade" (docs/uther-party/rules-4.0.md).
// A 14x14-tile town square at night. Every player is an invisible,
// invulnerable Dreadlord (max 600 HP, starting at 135, speed 270) with a den
// of their own on a ring 834 u from the centre. Killing a villager (60 HP,
// speed 190, wanders) heals the killer to full; only the last hitter eats.
// Vampiric Aura steals 15 % of damage dealt. The clock starts at 19:00 at
// t=4: nights run 2 s per game hour, days 1 s per hour (night 1 is 22 s, then
// 12 s days and 24 s nights). By day every Dreadlord loses 40 HP/s, and
// another 100 HP/s if not inside its den. N villagers come at t=4; at each
// dusk the town is topped up to (vampires alive - 1). Vampires cannot see or
// hurt each other. Survival with no ties and no timer.
const HW = wc3(896);
const CUT = wc3(400);
const TILE = wc3(128);
const R = wc3(31);
export const MAX_HP = 600;
export const START_HP = 135;
const DEN_REACH = (TILE / 2) * 1.45;
// Den offsets per player slot (1-8), from the map's Masquerade_1..8 rects.
const DENS = [[-448, 704], [704, 448], [448, -704], [-704, -448], [-704, 448], [448, 704], [704, -448], [-448, -704]];
const SPAWNS = [[-256, 512], [96, 320], [512, 256], [320, -96], [256, -512], [-96, -320], [-512, -256], [-320, 96]];
// City buildings (x0, y0, x1, y1 in WC3 offsets) in a pinwheel round the centre tree.
const BUILDINGS = [
  [-320, 576, -192, 704], [0, 384, 192, 704],
  [576, 128, 704, 256], [384, -192, 704, 0],
  [192, -704, 320, -576], [-192, -704, 0, -384],
  [-704, -256, -576, -128], [-704, 0, -384, 192],
];
export const VILL = { hp: 60, regen: 0.5, r: wc3(16), speed: wc3(190) };

export class Masquerade extends Minigame {
  static id = 'masquerade';
  static name = 'The Masquerade';
  static desc = 'You are a vampire at a masquerade. Feed on the villagers by night, then get back to your den before sunrise, or the sun burns you away. There is never enough food for everyone. Last vampire standing wins.';
  static controls = 'Right-click a villager to feed on it (the killing blow heals you to full). Right-click your den to hide in it; right-click anywhere to leave.';
  static duration = 900;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.obs = new Obstacles();
    const bld = BUILDINGS.map(([x0, y0, x1, y1]) => {
      const [ax, ay] = W(x0, y0);
      const [bx, by] = W(x1, y1);
      this.obs.box(ax, ay, bx, by);
      return [round2(Math.min(ax, bx)), round2(Math.min(ay, by)), round2(Math.max(ax, bx)), round2(Math.max(ay, by))];
    });
    this.obs.circle(0, 0, wc3(112));
    this.dens = new Map();
    this.pids.forEach((pid, i) => {
      const [x, y] = W(...DENS[i % 8]);
      this.dens.set(pid, { id: newId(), pid, x, y, alive: true });
      this.obs.box(x - TILE / 2, y - TILE / 2, x + TILE / 2, y + TILE / 2, pid);
    });
    this.nav = new Nav(this.obs, HW, HW, TILE / 2, R, (x, y) => Math.abs(x) + Math.abs(y) <= 2 * HW - CUT - R * 1.5);
    this.map = {
      theme: 'masquerade',
      floor: { shape: 'rect', w: HW * 2, h: HW * 2 },
      props: [],
      bounds: HW + 3,
      build: ['masquerade'],
      buildings: bld,
      cut: round2(CUT),
    };
    this.attack = { range: wc3(100), cd: 1.36, point: 0.55, missile: 0, art: 'axe' };
    // Each Dreadlord starts 50 u from its den toward the centre.
    this.spawnHeroes(
      this.pids.map((pid) => {
        const d = this.dens.get(pid);
        const l = Math.hypot(d.x, d.y);
        return [d.x - (d.x / l) * (TILE / 2 + R + wc3(50)), d.y - (d.y / l) * (TILE / 2 + R + wc3(50))];
      }),
      { hp: MAX_HP, r: R, speed: wc3(270) },
    );
    for (const u of this.heroes.values()) {
      u.skin = 'dreadlord';
      u.hp = START_HP;
      u.path = [];
    }
    this.villagers = [];
    this.hour = 19;
    this.started = false;
    this.sunAcc = 0;
    this.clockId = newId();
  }

  get isDay() {
    return this.hour >= 6 && this.hour < 18;
  }

  attackables() {
    return this.villagers.filter((v) => v.alive);
  }

  attackHit(pid, u, v) {
    if (!v.alive) return;
    const dmg = dice(2, 6) + 20;
    this.ev({ k: 'bite', x: round2(v.x), y: round2(v.y) });
    // Vampiric Aura level 1: 15 % of the damage heals the attacker.
    if (u.alive) u.hp = Math.min(u.maxHp, u.hp + dmg * 0.15);
    v.hp -= dmg;
    if (v.hp <= 0) {
      v.alive = false;
      this.ev({ k: 'death', x: round2(v.x), y: round2(v.y) });
      // Feeding: the unit that killed a villager is healed to 100 %.
      if (u.alive) {
        u.hp = u.maxHp;
        this.ev({ k: 'feed', x: round2(u.x), y: round2(u.y), to: pid });
      }
    }
  }

  spawnVillagers(n) {
    for (let i = 0; i < n; i++) {
      const [sx, sy] = W(...pick(SPAWNS));
      const v = new Unit({ kind: 'villager', x: sx + rand(-1, 1), y: sy + rand(-1, 1), r: VILL.r, speed: VILL.speed, hp: VILL.hp });
      v.regen = VILL.regen;
      v.setFacing(rand(-Math.PI, Math.PI));
      v.path = [];
      v.wander = rand(0.5, 2);
      this.villagers.push(v);
      this.ev({ k: 'tele', x1: round2(v.x), y1: round2(v.y), x2: round2(v.x), y2: round2(v.y) });
    }
  }

  // --- dens

  nearOwnDen(pid, x, y) {
    const d = this.dens.get(pid);
    return d && Math.abs(x - d.x) < TILE * 0.75 && Math.abs(y - d.y) < TILE * 0.75;
  }

  enterDen(u) {
    const d = this.dens.get(u.owner);
    u.inDen = true;
    u.goDen = false;
    u.solid = false;
    u.stop();
    u.path = [];
    u.attackOrder = null;
    u.swing = null;
    u.x = d.x;
    u.y = d.y;
    this.ev({ k: 'denin', x: round2(d.x), y: round2(d.y), to: u.owner });
  }

  leaveDen(u, tx, ty) {
    const d = this.dens.get(u.owner);
    let a = Math.atan2(ty - d.y, tx - d.x);
    if (!Number.isFinite(a) || (tx === d.x && ty === d.y)) a = Math.atan2(-d.y, -d.x);
    // Unload beside the den on the side of the click (or toward the centre).
    const out = TILE * 0.72 + u.r + 0.05;
    const k = Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
    u.x = d.x + (Math.cos(a) / k) * out;
    u.y = d.y + (Math.sin(a) / k) * out;
    u.setFacing(a);
    u.inDen = false;
    u.solid = true;
  }

  goToDen(u) {
    const d = this.dens.get(u.owner);
    u.attackOrder = null;
    u.goDen = true;
    const l = Math.hypot(d.x, d.y) || 1;
    // Walk to the front of the den (the side facing the square).
    goTo(this.nav, u, d.x - (d.x / l) * (TILE / 2 + u.r), d.y - (d.y / l) * (TILE / 2 + u.r));
  }

  command(pid, m) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return;
    if (m.c === 'move' || m.c === 'steer' || m.c === 'stop') {
      const x = +m.x || 0;
      const y = +m.y || 0;
      if (u.inDen) {
        if (m.c === 'stop' || this.nearOwnDen(pid, x, y)) return;
        this.leaveDen(u, x, y);
      }
      u.goDen = false;
      u.path = [];
      if (m.c === 'move' && this.nearOwnDen(pid, x, y)) return this.goToDen(u);
      const tgt = m.c === 'move' ? this.attackTargetAt(pid, x, y) : null;
      if (u.swing && tgt !== u.swing.tgt) u.swing = null;
      u.attackOrder = tgt;
      if (tgt) return;
      if (m.c === 'move') goTo(this.nav, u, x, y);
      else if (m.c === 'steer') u.steer(x, y);
      else u.stop();
      return;
    }
    super.command(pid, m);
  }

  // --- clock

  stepClock(dt) {
    if (this.time < 4) return;
    if (!this.started) {
      this.started = true;
      // One villager per vampire on night 1.
      this.spawnVillagers(this.pids.length);
    }
    const before = this.hour;
    this.hour += dt * (this.isDay ? 1 : 0.5);
    if (this.hour >= 24) this.hour -= 24;
    if (before < 18 && this.hour >= 18) this.dusk();
    if (before < 6 && this.hour >= 6) {
      this.ev({ k: 'dawn' });
      this.party.msg('The sun rises! Hide in your den.', '#ffd24a');
    }
  }

  dusk() {
    const want = this.alive.length - 1;
    const have = this.villagers.filter((v) => v.alive).length;
    if (want > have) this.spawnVillagers(want - have);
    this.ev({ k: 'dusk' });
    this.party.msg('Night falls. Feed!', '#b080ff');
    // Bots: "unloadall" empties their den.
    for (const [pid] of this.bots) {
      const u = this.heroes.get(pid);
      if (u?.alive && u.inDen) this.leaveDen(u, 0, 0);
    }
  }

  // Sunlight, every 0.05 s from 06:00 to 18:00: 2 HP from every Dreadlord,
  // and 5 more from those not in a den. It bypasses invulnerability.
  stepSun(dt) {
    this.sunAcc += dt;
    while (this.sunAcc >= 0.05) {
      this.sunAcc -= 0.05;
      if (!this.isDay || !this.started) continue;
      for (const [pid, u] of this.heroes) {
        if (!u.alive) continue;
        u.hp -= 2 + (u.inDen ? 0 : 5);
        if (u.hp <= 0) this.starve(pid, u);
      }
    }
  }

  starve(pid, u) {
    u.hp = 0;
    const d = this.dens.get(pid);
    if (u.inDen) {
      u.x = d.x;
      u.y = d.y + TILE;
    }
    u.inDen = false;
    this.eliminate(pid, 'burn');
    // Masquerade Death: the den goes with its vampire.
    d.alive = false;
    this.obs.boxes = this.obs.boxes.filter((b) => b.tag !== pid);
    this.ev({ k: 'dencollapse', x: round2(d.x), y: round2(d.y) });
  }

  // --- villagers wander (Awan)

  stepVillagers(dt) {
    for (const v of this.villagers) {
      if (!v.alive) continue;
      v.wander -= dt;
      if (v.wander <= 0 && !v.target && !v.path.length) {
        v.wander = rand(2, 6);
        const a = rand(0, Math.PI * 2);
        const d = wc3(rand(100, 400));
        const x = v.x + Math.cos(a) * d;
        const y = v.y + Math.sin(a) * d;
        if (Math.abs(x) + Math.abs(y) < 2 * HW - CUT - 1 && Math.abs(x) < HW - 0.6 && Math.abs(y) < HW - 0.6) goTo(this.nav, v, x, y);
      }
    }
  }

  tick(dt) {
    this.stepClock(dt);
    // Acquisition: 100 for players, 2000 for computer vampires.
    for (const [pid, u] of this.heroes) {
      if (u.inDen || u.goDen || !idle(u)) continue;
      const v = nearest(u, this.villagers, this.bots.has(pid) ? wc3(2000) : wc3(100));
      if (v) u.attackOrder = v;
    }
    this.stepVillagers(dt);
    followPaths(this.heroes.values());
    followPaths(this.villagers);
    stepUnits(this.villagers.filter((v) => v.alive), dt);
    stopOnLostTarget(this.heroes.values(), () => this.stepHeroes(dt));
    const all = [...this.heroes.values(), ...this.villagers];
    collideUnits(all.filter((u) => u.alive));
    for (const u of all) {
      if (!u.alive || u.inDen) continue;
      this.obs.push(u);
      clampOct(u, HW, CUT);
    }
    for (const [pid, u] of this.heroes) {
      if (u.alive && u.goDen && !u.inDen) {
        const d = this.dens.get(pid);
        if (dist(u.x, u.y, d.x, d.y) <= DEN_REACH + u.r + 0.35) this.enterDen(u);
        else if (!u.target && !u.path.length) this.goToDen(u);
      }
    }
    this.stepSun(dt);
    this.villagers = this.villagers.filter((v) => v.alive);
  }

  // The original AI: from 03:00 until dusk, board your den every second; at
  // dusk the den is emptied. Otherwise acquisition 2000 hunts the nearest villager.
  botThink(pid, u, mem) {
    if (!this.started) return;
    mem.next ??= this.time + rand(0, 1);
    if (this.time < mem.next) return;
    mem.next += 1;
    const h = this.hour;
    if (h >= 3 && h < 18 && !u.inDen && !u.goDen) this.goToDen(u);
  }

  hud(pid) {
    const u = this.heroes.get(pid);
    const h = this.hour;
    const toDawn = h >= 18 ? (24 - h + 6) * 2 : (6 - h) * 2;
    const clock = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
    let s = !this.started ? 'Dusk falls...' : this.isDay ? `☀ ${clock} Day: dusk in ${Math.ceil(18 - h)} s` : `☾ ${clock} Night: dawn in ${Math.ceil(toDawn)} s`;
    if (u?.alive) s += `  |  HP ${Math.ceil(u.hp)} / ${MAX_HP}${u.inDen ? '  (in your den)' : ''}`;
    return { label: s };
  }

  // Rival vampires are invisible: each player sees only their own Dreadlord
  // (faded, as WC3 shows your invisible units), and none while it hides in its den.
  heroEnts(pid) {
    const me = this.heroes.get(pid);
    const spectator = !me || !me.alive;
    const ents = [];
    for (const [hp, u] of this.heroes) {
      if (u.inDen && u.alive) continue;
      if (hp !== pid && (!u.alive || !spectator)) continue;
      const fx = ['invis'];
      if (u.swing) fx.push('casting');
      ents.push(unitSnap(u, { fx }));
    }
    return ents;
  }

  worldEnts(pid) {
    const ents = [];
    for (const v of this.villagers) {
      const e = { id: v.id, k: 'villager', x: round2(v.x), y: round2(v.y), f: round2(v.facing) };
      if (v.mx || v.my) e.mv = 1;
      ents.push(e);
    }
    for (const d of this.dens.values()) {
      if (!d.alive) continue;
      const e = { id: d.id, k: 'vden', x: round2(d.x), y: round2(d.y), f: round2(Math.atan2(-d.y, -d.x)), o: d.pid };
      if (d.pid === pid && this.heroes.get(pid)?.inDen) e.occ = 1;
      ents.push(e);
    }
    ents.push({ id: this.clockId, k: 'masqclock', x: 0, y: 0, h: round2(this.started ? this.hour : 19) });
    return ents;
  }
}

noTies(Masquerade);
