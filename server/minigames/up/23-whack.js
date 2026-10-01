import { Minigame } from '../../base.js';
import { Unit, newId, rand, dist, round2, wc3, clampToRect } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';

// Uther Party 4.0 #23 "Whack-a-Fiend" (docs/uther-party/rules-4.0.md):
// whack-a-mole in a flat 1024x1024 field. From t=6 there are N crypt fiends
// (N = players), all burrowed. Every second one surfaced fiend burrows (a
// 1.45 s animation) and two random burrowed ones surface. Any hit kills one
// (5 HP); it explodes and a new burrowed one appears at a random point. The
// first hero to 10 kills (level 2 -> 3 at 30 XP each) finishes; 8, 7, 6 ...
// 90 s timer.
//  - Heroes are level-2 Mountain Kings: 775 HP, speed 270, collision 32, melee
//    29-39 every 1.8 s, about 240 mana regenerating 0.8/s. Heroes cannot
//    attack each other, and auto-attack only fiends within 100 u.
//  - Storm Bolt (Q): 75 mana, cooldown 9, range 600, 100 damage; stuns a rival
//    hero for 3 s. Thunder Clap (W): 90 mana, cooldown 6, radius 250, 60
//    damage and a 50 % move and attack slow for 3 s on heroes.
//  - Bots have acquisition 1000; every second they re-acquire the nearest
//    surfaced fiend. They never cast.
// Remake: the Mountain Kings are hammerguys. A spell ordered from out of
// range walks into range first, as in WC3.
const HW = wc3(512);
const HERO_R = wc3(32);
const FIEND_R = wc3(32);
const MANA_MAX = 240;
const MANA_REGEN = 0.8;
const KILLS = 10;
const START = 6;
const BURROW = 1.45;
const RISE = 0.5;
const BOLT = { mana: 75, cd: 9, range: wc3(600), dmg: 100, stun: 3, speed: wc3(1000) };
const CLAP = { mana: 90, cd: 6, r: wc3(250), dmg: 60, slow: 3 };
const HUMAN_ACQ = wc3(100);
const BOT_ACQ = wc3(1000);

export class WhackAFiend extends Minigame {
  static id = 'whack';
  static name = 'Whack-a-Fiend';
  static desc = 'Kill 10 crypt fiends! They pop out of the ground and burrow again. First to 10 kills wins. Storm Bolt and Thunder Clap kill fiends, and stun or slow your rivals.';
  static controls = 'Right-click a fiend to attack it. Q Storm Bolt (then click a fiend or a rival), W Thunder Clap. Mana is scarce.';
  static duration = 90;
  static ranking = 'race';

  setup() {
    this.map = { theme: 'grass', floor: { shape: 'rect', w: HW * 2, h: HW * 2 }, props: treesAroundRect(HW, HW, 0.5, 2.6), bounds: HW + 3 };
    this.attack = { range: wc3(100), cd: 1.8, point: 0.35, dmg: 34, missile: 0 };
    this.abilities = [
      {
        name: 'Storm Bolt', icon: '⚡', desc: 'Hurls a hammer: 100 damage, kills a fiend, stuns a rival for 3 s. 75 mana.', kind: 'unit', cd: BOLT.cd, range: BOLT.range, castPoint: 0.35,
        available: (pid) => this.mana.get(pid) >= BOLT.mana,
        pickTarget: (pid, u, x, y) => this.pickBoltTarget(pid, u, x, y),
        cast: (pid, u, tgt) => this.stormBolt(pid, u, tgt.u),
      },
      {
        name: 'Thunder Clap', icon: '💥', desc: 'Slams the ground: 60 damage within 250, kills fiends, slows rivals by half for 3 s. 90 mana.', kind: 'instant', cd: CLAP.cd, castPoint: 0.35,
        available: (pid) => this.mana.get(pid) >= CLAP.mana,
        cast: (pid, u) => this.thunderClap(pid, u),
      },
    ];
    this.spawnHeroes(
      this.pids.map(() => {
        const a = rand(0, Math.PI * 2);
        const r = wc3(rand(100, 400));
        return [Math.cos(a) * r, Math.sin(a) * r];
      }),
      { hp: 775, r: HERO_R },
    );
    for (const u of this.heroes.values()) u.skin = 'whack_mk'; // Mountain King (Hmkg)
    this.mana = new Map(this.pids.map((p) => [p, MANA_MAX]));
    this.kills = new Map(this.pids.map((p) => [p, 0]));
    this.slowT = new Map();
    this.fiends = [];
    this.bolts = [];
    this.pending = new Map(); // pid -> {slot, u}: a spell waiting to get into range
    this.swapT = START + rand(0, 1);
    this.botT = rand(0, 1);
  }

  newFiend() {
    const f = new Unit({ kind: 'fiend', x: rand(-HW + FIEND_R, HW - FIEND_R), y: rand(-HW + FIEND_R, HW - FIEND_R), r: FIEND_R, speed: 0, hp: 5 });
    f.setFacing(rand(-Math.PI, Math.PI));
    f.state = 'under';
    f.t = 0;
    f.solid = false;
    this.fiends.push(f);
    return f;
  }

  // Surfaced fiends (and ones still playing the burrow animation) can be hit.
  hittable(f) {
    return f.alive && (f.state === 'up' || f.state === 'down');
  }

  attackables() {
    return this.fiends.filter((f) => this.hittable(f));
  }

  tick(dt) {
    if (this.time >= START && !this.started) {
      this.started = true;
      for (let i = 0; i < this.pids.length; i++) this.newFiend();
    }
    // Whack Swap: one surfaced fiend burrows and two burrowed ones surface.
    if (this.started && this.time >= this.swapT) {
      this.swapT += 1;
      const up = this.fiends.filter((f) => f.alive && f.state === 'up');
      if (up.length) {
        const f = up[Math.floor(Math.random() * up.length)];
        f.state = 'down';
        f.t = 0;
      }
      for (let i = 0; i < 2; i++) {
        const under = this.fiends.filter((f) => f.alive && (f.state === 'under' || f.state === 'rise'));
        if (!under.length) break;
        const f = under[Math.floor(Math.random() * under.length)];
        if (f.state === 'under') {
          f.state = 'rise';
          f.t = 0;
          this.ev({ k: 'whack_rise', x: round2(f.x), y: round2(f.y) });
        }
      }
    }
    for (const f of this.fiends) {
      f.t += dt;
      if (f.state === 'rise' && f.t >= RISE) {
        f.state = 'up';
        f.solid = true;
      } else if (f.state === 'down' && f.t >= BURROW) {
        f.state = 'under';
        f.solid = false;
      }
    }
    // Mana, slows and the half-speed attack of slowed heroes.
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.finished) continue;
      this.mana.set(pid, Math.min(MANA_MAX, this.mana.get(pid) + MANA_REGEN * dt));
      const s = this.slowT.get(pid) || 0;
      if (s > 0) {
        this.slowT.set(pid, s - dt);
        u.speedMult = 0.5;
        if (u.atkCd > 0) u.atkCd += dt / 2;
      } else u.speedMult = 1;
      this.stepPending(pid, u);
      this.autoAcquire(pid, u);
    }
    if (this.started) {
      this.botT -= dt;
      if (this.botT <= 0) {
        this.botT += 1;
        for (const pid of this.bots.keys()) this.botAcquire(pid);
      }
    }
    this.stepHeroes(dt);
    const solidFiends = this.fiends.filter((f) => f.alive && f.solid);
    for (const [, u] of this.heroes) {
      if (!u.alive) continue;
      clampToRect(u, HW, HW);
      for (const f of solidFiends) {
        const d = dist(u.x, u.y, f.x, f.y);
        const min = (u.r + f.r) * 0.8;
        if (d < min && d > 0.001) {
          u.x = f.x + ((u.x - f.x) / d) * min;
          u.y = f.y + ((u.y - f.y) / d) * min;
        }
      }
    }
    this.stepBolts(dt);
    this.fiends = this.fiends.filter((f) => f.alive);
  }

  // Heroes that are stunned do nothing: no swings, no spells.
  stepAttacks(dt) {
    const held = [];
    for (const u of this.heroes.values()) {
      if (u.stun > 0 && u.attackOrder) {
        held.push([u, u.attackOrder]);
        u.attackOrder = null;
      }
    }
    super.stepAttacks(dt);
    for (const [u, o] of held) u.attackOrder = o;
  }

  useAbility(pid, slot, x, y) {
    const u = this.heroes.get(pid);
    if (!u || u.stun > 0 || u.finished) return;
    this.pending.delete(pid);
    const ab = this.abilities[slot];
    if (ab?.kind === 'unit') {
      // Out of range: walk until it is in range, then cast (WC3 behaviour).
      const t = this.pickBoltTarget(pid, u, x, y, true);
      if (!t) return;
      if (dist(u.x, u.y, t.x, t.y) - u.r - t.r > ab.range) {
        if ((this.acd.get(pid)?.[slot] || 0) > 0 || !ab.available(pid)) return;
        this.pending.set(pid, { slot, u: t });
        u.attackOrder = null;
        u.order(t.x, t.y);
        return;
      }
    }
    super.useAbility(pid, slot, x, y);
  }

  stepPending(pid, u) {
    const p = this.pending.get(pid);
    if (!p) return;
    const t = p.u;
    const alive = t.kind === 'fiend' ? this.hittable(t) : t.alive && !t.finished;
    if (!alive || u.stun > 0) {
      this.pending.delete(pid);
      if (u.target) u.stop();
      return;
    }
    if (dist(u.x, u.y, t.x, t.y) - u.r - t.r <= this.abilities[p.slot].range) {
      this.pending.delete(pid);
      super.useAbility(pid, p.slot, t.x, t.y);
    } else u.steer(t.x, t.y);
  }

  command(pid, m) {
    if (m.c !== 'cast') this.pending.delete(pid);
    const u = this.heroes.get(pid);
    if (u?.stun > 0 && m.c === 'cast') return;
    super.command(pid, m);
  }

  // A fiend or a rival hero under the click (Storm Bolt).
  pickBoltTarget(pid, u, x, y, anyRange = false) {
    let best = null;
    let bd = 1.4;
    const cands = [...this.attackables(), ...[...this.heroes.values()].filter((v) => v.alive && !v.finished && v.owner !== pid)];
    for (const v of cands) {
      const d = dist(x, y, v.x, v.y) - v.r;
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    if (!best) return null;
    if (!anyRange && dist(u.x, u.y, best.x, best.y) - u.r - best.r > BOLT.range + 0.3) return null;
    return anyRange ? best : { x: best.x, y: best.y, u: best };
  }

  stormBolt(pid, u, tgt) {
    this.mana.set(pid, this.mana.get(pid) - BOLT.mana);
    this.bolts.push({ id: newId(), pid, x: u.x, y: u.y, tgt, f: u.heading });
    this.ev({ k: 'sfx', s: 'thrust' });
  }

  stepBolts(dt) {
    for (const b of this.bolts) {
      const t = b.tgt;
      const gone = t.kind === 'fiend' ? !this.hittable(t) : !t.alive || t.finished;
      if (gone) {
        b.done = true;
        this.ev({ k: 'whack_boltfizz', x: round2(b.x), y: round2(b.y) });
        continue;
      }
      const dx = t.x - b.x;
      const dy = t.y - b.y;
      const d = Math.hypot(dx, dy);
      const step = BOLT.speed * dt;
      b.f = Math.atan2(dy, dx);
      if (d <= step + t.r * 0.5) {
        b.done = true;
        this.ev({ k: 'whack_bolthit', x: round2(t.x), y: round2(t.y) });
        if (t.kind === 'fiend') this.hitFiend(b.pid, t);
        else this.stunHero(t, BOLT.stun, BOLT.dmg);
        continue;
      }
      b.x += (dx / d) * step;
      b.y += (dy / d) * step;
    }
    this.bolts = this.bolts.filter((b) => !b.done);
  }

  stunHero(v, dur, dmg) {
    v.stun = Math.max(v.stun, dur);
    v.stop();
    v.swing = null;
    v.cast = null;
    this.pending.delete(v.owner);
    this.damage(v.owner, dmg);
  }

  thunderClap(pid, u) {
    this.mana.set(pid, this.mana.get(pid) - CLAP.mana);
    this.ev({ k: 'whack_clap', x: round2(u.x), y: round2(u.y), r: round2(CLAP.r) });
    for (const f of this.attackables()) if (dist(u.x, u.y, f.x, f.y) <= CLAP.r + f.r) this.hitFiend(pid, f);
    for (const [op, v] of this.heroes) {
      if (op === pid || !v.alive || v.finished || dist(u.x, u.y, v.x, v.y) > CLAP.r + v.r) continue;
      this.slowT.set(op, CLAP.slow);
      this.damage(op, CLAP.dmg);
    }
  }

  // Any hit kills a fiend (5 HP).
  attackHit(pid, u, tgt) {
    this.ev({ k: 'hit', x: round2(tgt.x), y: round2(tgt.y) });
    this.hitFiend(pid, tgt);
  }

  hitFiend(pid, f) {
    if (!this.hittable(f)) return;
    f.alive = false;
    this.onUnitKilled(f, pid);
  }

  onUnitKilled(f, pid) {
    // Fiends explode on death; a new burrowed one takes its place.
    this.ev({ k: 'whack_pop', x: round2(f.x), y: round2(f.y) });
    this.newFiend();
    const u = this.heroes.get(pid);
    if (!u || u.finished || !u.alive) return;
    const k = this.kills.get(pid) + 1;
    this.kills.set(pid, k);
    this.ev({ k: 'txt', x: round2(f.x), y: round2(f.y), s: `${k}`, c: '#ffe066' });
    if (k >= KILLS) {
      this.finish(pid);
      u.solid = false;
      u.attackOrder = null;
      this.pending.delete(pid);
      this.ev({ k: 'whack_levelup', x: round2(u.x), y: round2(u.y) });
    }
  }

  // Acquisition: an idle hero attacks a surfaced fiend within range on its own
  // (100 u for players, 1000 u for bots).
  autoAcquire(pid, u) {
    if (u.target || u.attackOrder || u.cast || u.swing || u.stun > 0 || this.pending.has(pid)) return;
    const f = this.nearestFiend(u, this.bots.has(pid) ? BOT_ACQ : HUMAN_ACQ);
    if (f) u.attackOrder = f;
  }

  nearestFiend(u, range) {
    let best = null;
    let bd = range;
    for (const f of this.attackables()) {
      const d = dist(u.x, u.y, f.x, f.y) - u.r - f.r;
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  // Whack Swap orders bots to stop every second, so they re-acquire the nearest fiend.
  botAcquire(pid) {
    const u = this.heroes.get(pid);
    if (!u?.alive || u.finished || u.cast || u.swing || u.stun > 0) return;
    const f = this.nearestFiend(u, BOT_ACQ);
    u.attackOrder = f;
    if (!f && u.target) u.stop();
  }

  progress(pid) {
    return this.kills.get(pid) || 0;
  }

  hud(pid) {
    const u = this.heroes.get(pid);
    if (!u) return null;
    if (u.finished) return { label: 'Level 3! You are done.' };
    return { label: `Kills ${this.kills.get(pid)}/${KILLS} · Mana ${Math.floor(this.mana.get(pid))}` };
  }

  heroEnts(pid) {
    return super.heroEnts(pid)
      .filter((e) => !this.heroes.get(e.o)?.finished)
      .map((e) => {
        const u = this.heroes.get(e.o);
        if (u?.stun > 0) e.fx = [...(e.fx || []), 'stun'];
        return e;
      });
  }

  worldEnts() {
    const ents = [];
    for (const f of this.fiends) {
      if (f.state === 'under') continue;
      ents.push({ id: f.id, k: 'whack_fiend', x: round2(f.x), y: round2(f.y), f: round2(f.facing), s: f.state === 'up' ? undefined : f.state, t: round2(f.t) });
    }
    for (const b of this.bolts) ents.push({ id: b.id, k: 'whack_bolt', x: round2(b.x), y: round2(b.y), f: round2(b.f) });
    for (const [pid, u] of this.heroes) if (u.alive && u.stun > 0 && !u.finished) ents.push({ id: `st${u.id}`, k: 'whack_stun', x: round2(u.x), y: round2(u.y), o: pid });
    return ents;
  }
}
