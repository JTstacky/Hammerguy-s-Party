import { Minigame } from '../../base.js';
import { Unit, newId, rand, dist, round2, wc3, stepUnits, collideUnits, clampToRect } from '../../../engine/server/sim.js';

// Uther Party 4.0 #44 "Tides of Darkness" (docs/uther-party/rules-4.0.md):
// the players' frigates (allied, sharing vision) start in the south-west of an
// open sea, the orc destroyers in the north-east. Land the killing blow on any
// orc ship and you finish (8, 7, 6 ...) and sail out; sunk ships score 0.
// 120 s timer.
//  - Frigates and destroyers are identical: 200 HP, speed 350, turn rate 0.2,
//    collision 48. Artillery 55-69, cooldown 1.5, range 600, shell speed 600,
//    splash 25/35/50 u at 100/30/10 %. Shells fly to where the target was at
//    the release, so a moving ship dodges them.
//  - Players' acquisition is 100 (they must order attacks); bots get 2000 at
//    t=4. The orcs' is 650, then 2000 from t=4.
//  - One destroyer per player to start; every 10 s one more while Player 12
//    owns fewer than 8 units (the shipyard counts, so at most 7).
//  - Orc evasion: attacked (at the attack's start), a destroyer sails 50-300 u
//    away from its attacker (+-90 deg). Every 3 s each one with a player ship
//    within 800 sails 50-300 u away from a random one of them.
//  - Bots, every 3 s: no orc within 800 -> attack-move to a random Player 12
//    unit (maybe the shipyard); otherwise sail 50-300 u away from one.
// Remake: the splash only hurts the other side, and the frigates' damage
// point (not in the extracted data) is taken as 0.3 s.
const HW = wc3(1024);
const HH = wc3(960);
const START = { x: wc3(-800), y: wc3(736) };
const SPAWN = { x: wc3(768), y: wc3(-704) };
const SHIP_R = wc3(48);
const SPEED = wc3(350);
const HP = 200;
const TURN = 0.2;
const RANGE = wc3(600);
const COOLDOWN = 1.5;
const DMG_POINT = 0.3;
const SHELL_SPEED = wc3(600);
const DMG = [55, 69];
const SPLASH = [[wc3(25), 1], [wc3(35), 0.3], [wc3(50), 0.1]];
const YARD_R = wc3(110);
const MAX_P12 = 8;
const AI_ON = 4;

export class TidesOfDarkness extends Minigame {
  static id = 'tides';
  static name = 'Tides of Darkness';
  static desc = 'Kill one enemy ship! Your frigates sail together against the orc fleet. Only the killing blow counts: land it and you are out with the points. Shells land where a ship was, so keep moving to dodge.';
  static controls = 'Right-click to sail. Right-click an orc ship to fire on it. Your ship turns slowly.';
  static duration = 120;
  static ranking = 'race';

  setup() {
    this.map = { theme: 'tides_sea', floor: { shape: 'rect', w: HW * 2, h: HH * 2 }, props: [], bounds: Math.max(HW, HH) + 2, build: ['tides_sea'], yards: [{ ...START, orc: 0 }, { ...SPAWN, orc: 1 }] };
    const off = () => wc3(rand(-96, 96) + rand(128, 256));
    this.spawnHeroes(this.pids.map(() => [START.x + off(), START.y - off()]), { hp: HP, speed: SPEED, r: SHIP_R, turnRate: TURN, facing: -Math.PI / 4 });
    for (const u of this.heroes.values()) {
      u.skin = 'tides_frigate';
      initShip(u);
    }
    this.orcs = [];
    for (let i = 0; i < this.pids.length; i++) this.spawnOrc();
    this.yard = { id: newId(), x: SPAWN.x, y: SPAWN.y, r: YARD_R, alive: true, yard: true };
    this.shells = [];
    this.dealt = new Map(this.pids.map((p) => [p, 0]));
    this.spawnT = rand(0, 10);
    this.orcAiT = rand(0, 3);
  }

  spawnOrc() {
    const off = () => wc3(rand(-96, 96) + rand(128, 256));
    const o = new Unit({ kind: 'odes', x: SPAWN.x - off(), y: SPAWN.y + off(), r: SHIP_R, speed: SPEED, hp: HP });
    o.turnRate = TURN;
    o.setFacing((3 * Math.PI) / 4);
    initShip(o);
    this.orcs.push(o);
    this.ev({ k: 'tides_splash', x: round2(o.x), y: round2(o.y), big: 1 });
    return o;
  }

  isPlayerShip(s) {
    return s.kind === 'paladin';
  }

  enemiesOf(s) {
    if (this.isPlayerShip(s)) return this.orcs.filter((o) => o.alive);
    return [...this.heroes.values()].filter((u) => u.alive && !u.finished);
  }

  acqRange(s) {
    if (this.isPlayerShip(s)) return this.bots.has(s.owner) && this.time >= AI_ON ? wc3(2000) : wc3(100);
    return this.time >= AI_ON ? wc3(2000) : wc3(650);
  }

  command(pid, m) {
    const u = this.heroes.get(pid);
    if (!u?.alive || u.finished) return;
    if (m.c === 'move' || m.c === 'steer') {
      const x = +m.x || 0;
      const y = +m.y || 0;
      const t = this.orcs.find((o) => o.alive && dist(x, y, o.x, o.y) < o.r + 0.9);
      if (t && m.c === 'move') {
        u.attackOrder = t;
        return;
      }
      if (m.c === 'move') this.cancelAttack(u);
      if (u.wind < 0) return m.c === 'move' ? u.order(x, y) : u.steer(x, y);
      u.queued = { x, y };
      return;
    }
    if (m.c === 'stop') {
      this.cancelAttack(u);
      u.stop();
    }
  }

  cancelAttack(s) {
    s.attackOrder = null;
    s.wind = -1;
    s.queued = null;
  }

  tick(dt) {
    // Reinforcements every 10 s while Player 12 owns fewer than 8 units (shipyard included).
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT += 10;
      if (this.orcs.filter((o) => o.alive).length + 1 < MAX_P12) this.spawnOrc();
    }
    this.orcAiT -= dt;
    if (this.orcAiT <= 0) {
      this.orcAiT += 3;
      this.orcKite();
    }
    const ships = [...this.heroes.values(), ...this.orcs];
    for (const s of ships) if (s.alive && !s.finished) this.stepShip(s, dt);
    this.stepHeroes(dt);
    stepUnits(this.orcs, dt);
    const all = ships.filter((s) => s.alive && !s.finished);
    collideUnits(all);
    for (const s of all) {
      clampToRect(s, HW, HH);
      for (const y of this.map.yards) {
        const d = dist(s.x, s.y, y.x, y.y);
        const min = YARD_R + s.r;
        if (d < min && d > 0.001) {
          s.x = y.x + ((s.x - y.x) / d) * min;
          s.y = y.y + ((s.y - y.y) / d) * min;
        }
      }
    }
    for (const sh of this.shells) {
      sh.t += dt;
      if (sh.t >= sh.flight) this.land(sh);
    }
    this.shells = this.shells.filter((s) => !s.done);
    this.orcs = this.orcs.filter((o) => o.alive);
  }

  // WC3 attack for a ship: sail into range, turn to face, stand still for the
  // damage point, then lob a shell at where the target is now.
  stepShip(s, dt) {
    if (s.atkCd > 0) s.atkCd -= dt;
    if (s.wind >= 0) {
      s.wind += dt;
      if (s.wind >= DMG_POINT) {
        s.wind = -1;
        const t = s.attackOrder;
        if (t?.alive && !t.finished) this.fire(s, t);
        if (s.queued) {
          s.order(s.queued.x, s.queued.y);
          s.attackOrder = null;
          s.queued = null;
        }
      }
      return;
    }
    let t = s.attackOrder;
    if (t && (!t.alive || t.finished)) t = s.attackOrder = null;
    // Idle ships acquire the nearest enemy in acquisition range.
    if (!t && !s.target) {
      const e = this.nearestEnemy(s, this.acqRange(s));
      if (e) t = s.attackOrder = e;
    }
    if (!t) return;
    const gap = dist(s.x, s.y, t.x, t.y) - s.r - t.r;
    if (gap > RANGE) {
      if (s.target) s.steer(t.x, t.y);
      else s.order(t.x, t.y);
      return;
    }
    if (s.target) s.stop();
    const ang = Math.atan2(t.y - s.y, t.x - s.x);
    if (!s.facingAt(ang, 0.3)) {
      s.faceTo = ang;
      return;
    }
    s.faceTo = null;
    if (s.atkCd > 0) return;
    s.atkCd = COOLDOWN;
    s.wind = 0;
    this.ev({ k: 'tides_fire', u: s.id, x: round2(s.x), y: round2(s.y), f: round2(ang) });
    // The attacked orc sails 50-300 u away from its attacker, give or take 90 degrees.
    if (!this.isPlayerShip(t)) this.evade(t, s);
  }

  nearestEnemy(s, range) {
    let best = null;
    let bd = range;
    for (const e of this.enemiesOf(s)) {
      const d = dist(s.x, s.y, e.x, e.y) - s.r - e.r;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  evade(o, from) {
    const a = Math.atan2(o.y - from.y, o.x - from.x) + rand(-Math.PI / 2, Math.PI / 2);
    const d = wc3(rand(50, 300));
    this.cancelAttack(o);
    o.order(clamp(o.x + Math.cos(a) * d, HW - o.r), clamp(o.y + Math.sin(a) * d, HH - o.r));
  }

  orcKite() {
    for (const o of this.orcs) {
      if (!o.alive) continue;
      const near = this.enemiesOf(o).filter((u) => dist(u.x, u.y, o.x, o.y) <= wc3(800));
      if (near.length) this.evade(o, near[Math.floor(Math.random() * near.length)]);
    }
  }

  fire(s, t) {
    const d = dist(s.x, s.y, t.x, t.y);
    this.shells.push({ id: newId(), src: s, pid: this.isPlayerShip(s) ? s.owner : null, sx: s.x, sy: s.y, x: t.x, y: t.y, t: 0, flight: Math.max(0.2, d / SHELL_SPEED), dmg: rand(DMG[0], DMG[1]), orc: this.isPlayerShip(s) ? undefined : 1 });
    this.ev({ k: 'sfx', s: 'mortar' });
  }

  land(sh) {
    sh.done = true;
    const victims = sh.pid == null ? [...this.heroes.values()].filter((u) => u.alive && !u.finished) : this.orcs.filter((o) => o.alive);
    let hit = false;
    for (const v of victims) {
      const d = dist(v.x, v.y, sh.x, sh.y) - v.r;
      const tier = SPLASH.find(([r]) => d <= r);
      if (!tier) continue;
      hit = true;
      const dmg = sh.dmg * tier[1];
      if (sh.pid == null) {
        this.damage(v.owner, dmg, 'tides_sink');
        continue;
      }
      v.hp -= dmg;
      this.dealt.set(sh.pid, (this.dealt.get(sh.pid) || 0) + dmg);
      this.ev({ k: 'dmg', x: round2(v.x), y: round2(v.y), n: Math.round(dmg) });
      if (v.hp <= 0) this.orcSunk(v, sh.pid);
    }
    this.ev({ k: 'tides_splash', x: round2(sh.x), y: round2(sh.y), hit: hit ? 1 : undefined });
  }

  orcSunk(o, pid) {
    o.alive = false;
    this.ev({ k: 'tides_sink', x: round2(o.x), y: round2(o.y), f: round2(o.facing), orc: 1 });
    // Tides Kill: the killing frigate finishes and sails out.
    const u = this.heroes.get(pid);
    if (!u?.alive || u.finished) return;
    this.finish(pid);
    this.cancelAttack(u);
    u.stop();
    u.solid = false;
    this.ev({ k: 'tele', x1: round2(u.x), y1: round2(u.y), x2: round2(u.x), y2: round2(u.y) });
  }

  botThink(pid, u, mem) {
    if (this.time < AI_ON) return;
    mem.next ??= AI_ON + rand(0, 3);
    if (this.time < mem.next) return;
    mem.next += 3;
    const near = this.orcs.filter((o) => o.alive && dist(o.x, o.y, u.x, u.y) <= wc3(800));
    if (!near.length) {
      // Attack-move to a random Player 12 unit (possibly the invulnerable shipyard).
      const p12 = [...this.orcs.filter((o) => o.alive), this.yard];
      const t = p12[Math.floor(Math.random() * p12.length)];
      this.cancelAttack(u);
      u.order(t.x, t.y);
      u.attackMove = true;
      return;
    }
    // Added: focus the weakest destroyer in range (bots share the kill race,
    // but a wounded ship is the quickest kill).
    if (u.wind < 0) {
      let weak = null;
      for (const o of near) if (dist(o.x, o.y, u.x, u.y) - o.r - u.r <= RANGE && (!weak || o.hp < weak.hp)) weak = o;
      if (weak && weak !== u.attackOrder && (!u.attackOrder || weak.hp < u.attackOrder.hp)) {
        u.attackOrder = weak;
      }
    }
    // Added: kite only between shots, so the dodge does not throw away a wind-up.
    if (u.wind >= 0 || u.atkCd < 0.5) {
      mem.next = this.time + 0.3;
      return;
    }
    const o = near[Math.floor(Math.random() * near.length)];
    const a = Math.atan2(u.y - o.y, u.x - o.x) + rand(-Math.PI / 2, Math.PI / 2);
    const d = wc3(rand(50, 300));
    this.cancelAttack(u);
    u.order(clamp(u.x + Math.cos(a) * d, HW - u.r), clamp(u.y + Math.sin(a) * d, HH - u.r));
  }

  // Bots attack-move: an enemy in acquisition range interrupts the move.
  stepHeroes(dt) {
    for (const [pid, u] of this.heroes) {
      if (!u.attackMove || !u.alive || u.finished) continue;
      if (!u.target) {
        u.attackMove = false;
        continue;
      }
      const e = this.nearestEnemy(u, this.acqRange(u));
      if (e && this.bots.has(pid) && dist(u.x, u.y, e.x, e.y) - u.r - e.r <= RANGE) {
        u.attackMove = false;
        u.stop();
        u.attackOrder = e;
      }
    }
    super.stepHeroes(dt);
  }

  progress(pid) {
    return this.dealt.get(pid) || 0;
  }

  hud(pid) {
    const u = this.heroes.get(pid);
    if (!u) return null;
    if (u.finished) return { label: 'Enemy ship sunk! You are done.' };
    return { label: `Orc ships: ${this.orcs.filter((o) => o.alive).length}` };
  }

  heroEnts(pid) {
    return super.heroEnts(pid).filter((e) => !this.heroes.get(e.o)?.finished);
  }

  worldEnts() {
    const ents = this.orcs.filter((o) => o.alive).map((o) => ({ id: o.id, k: 'tides_destroyer', x: round2(o.x), y: round2(o.y), f: round2(o.facing), hp: Math.ceil(o.hp), mhp: HP, mv: o.mx || o.my ? 1 : undefined }));
    for (const s of this.shells) ents.push({ id: s.id, k: 'tides_shell', x: round2(s.x), y: round2(s.y), sx: round2(s.sx), sy: round2(s.sy), t: round2(s.t / s.flight), orc: s.orc });
    return ents;
  }
}

function initShip(s) {
  s.attackOrder = null;
  s.atkCd = 0;
  s.wind = -1;
  s.queued = null;
}

function clamp(v, m) {
  return Math.max(-m, Math.min(m, v));
}
