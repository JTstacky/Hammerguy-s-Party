import { Minigame } from '../../base.js';
import { Unit, newId, rand, dist, round2, wc3, stepUnits, collideUnits, clampToRect } from '../../../engine/server/sim.js';

// Uther Party 4.0 #26 "Crab Island" (docs/uther-party/rules-4.0.md): survive
// on a small island while hostile crabs wade in from the shallows, one every
// 10 s while there are fewer than 30. They are faster than you, wander, chase
// anything within 500 u and never give up. Last one standing wins; no timer.
//  - You are a Banshee: 285 HP, speed 270, collision 16, no attack, 400 mana
//    that never regenerates.
//  - Possession (Q, 250 mana, range 200, 1 s cast): take over a crab, keeping
//    its current HP. You become that crab: its speed, its bite, and spell
//    immunity so nobody can steal it back.
//  - Anti-magic Shell (W, 50 mana, range 500, 20 s): a shielded crab cannot be
//    possessed. Use it to deny rivals the big one.
//  - Crabs (cooldown 1.35 s, melee): Shorecrawler 350 speed, 240 HP, 10-11;
//    Limbripper 320, 400 HP, armour 1, 14-15; Behemoth 270, 850 HP, armour 3,
//    24-27. Each spawn is 50/50 a Shorecrawler or a Limbripper, 640 u from
//    the centre; once there are 5 or more melee attackers (possessed crabs
//    count) it is a Behemoth 1 time in 8.
//  - A neutral critter crab (15 HP, speed 100) wanders the island.
// Remake:
//  - The player is a Banshee until it possesses a crab (then that crab's look).
//  - Bots: the original AI only moves bots to a random point every 6 s and
//    never casts. Here about a quarter of bots also possess a nearby crab
//    when badly hurt, and a possessed crab bites back; the rest wander as in
//    the original, which keeps bot games to one or two minutes.
//  - A spell ordered out of range walks into range first, as in WC3.
//  - No timer in the original; `duration` is only a safety cap.
const HW = wc3(640);
const LAND_R = wc3(512);
const SPAWN_R = wc3(640);
const TREE_R = wc3(72);
const BANSHEE = { speed: wc3(270), r: wc3(16), hp: 285, mana: 400 };
const POSSESS = { mana: 250, range: wc3(200), castPoint: 1 };
const SHELL = { mana: 50, range: wc3(500), dur: 20 };
export const CRABS = {
  shore: { name: 'Shorecrawler', speed: wc3(350), hp: 240, armor: 0, dmg: [10, 11], r: wc3(24) },
  limb: { name: 'Limbripper', speed: wc3(320), hp: 400, armor: 1, dmg: [14, 15], r: wc3(32) },
  behemoth: { name: 'Behemoth', speed: wc3(270), hp: 850, armor: 3, dmg: [24, 27], r: wc3(48) },
  critter: { name: 'Crab', speed: wc3(100), hp: 15, armor: 0, dmg: null, r: wc3(12) },
};
const ATK = { range: wc3(100), cd: 1.35, point: 0.4 };
const ACQ = wc3(500);
const MAX_P11 = 30;
const SPAWN_EVERY = 10;
const SPAWN_ON = 5;

const armorMult = (a) => 1 - (0.06 * a) / (1 + 0.06 * a);

export class CrabIsland extends Minigame {
  static id = 'crab';
  static name = 'Crab Island';
  static desc = 'Survive as long as possible! Crabs crawl out of the sea, faster than you and more every 10 s. Spend your mana wisely: possess a crab to become it, or shield one so nobody else can. Hold out for a big one. Last one standing wins.';
  static controls = 'Right-click to move. Q Possession (then click a crab: 250 of your 400 mana), W Anti-magic Shell (then click a crab: 50 mana). As a crab, right-click to bite.';
  static duration = 900;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'crab_isle', floor: { shape: 'disc', r: LAND_R * 1.06 }, props: [], bounds: HW + 2, build: ['crab_isle'], hw: HW, land: LAND_R, tree: TREE_R };
    this.abilities = [
      {
        name: 'Possession', icon: '👻', desc: 'Take over a crab within 200 and become it, keeping its HP (1 s cast). 250 mana.', kind: 'unit', range: POSSESS.range, castPoint: POSSESS.castPoint,
        available: (pid) => !this.heroes.get(pid)?.form && this.mana.get(pid) >= POSSESS.mana,
        pickTarget: (pid, u, x, y) => this.pickCrab(x, y, u, POSSESS.range, true),
        cast: (pid, u, tgt) => this.possess(pid, u, tgt.u),
      },
      {
        name: 'Anti-magic Shell', icon: '🛡️', desc: 'Shields a crab for 20 s: it cannot be possessed. 50 mana.', kind: 'unit', range: SHELL.range, castPoint: 0.3,
        available: (pid) => !this.heroes.get(pid)?.form && this.mana.get(pid) >= SHELL.mana,
        pickTarget: (pid, u, x, y) => this.pickCrab(x, y, u, SHELL.range, false),
        cast: (pid, u, tgt) => this.shell(pid, tgt.u),
      },
    ];
    this.attack = { range: ATK.range, cd: ATK.cd, point: ATK.point, dmg: 0, missile: 0 };
    this.spawnHeroes(
      this.pids.map(() => {
        const a = rand(0, Math.PI * 2);
        const r = wc3(rand(100, 300));
        return [Math.cos(a) * r, Math.sin(a) * r];
      }),
      { speed: BANSHEE.speed, r: BANSHEE.r, hp: BANSHEE.hp },
    );
    for (const u of this.heroes.values()) {
      u.form = null;
      u.skin = 'crab_banshee'; // Banshee (uban) until she possesses a crab
    }
    this.mana = new Map(this.pids.map((p) => [p, BANSHEE.mana]));
    this.crabs = [];
    this.pending = new Map();
    const a = rand(0, Math.PI * 2);
    const r = rand(wc3(150), LAND_R - 1);
    this.newCrab('critter', Math.cos(a) * r, Math.sin(a) * r, false);
    this.spawnT = SPAWN_ON + rand(0, SPAWN_EVERY);
    this.botT = SPAWN_ON + rand(0, 6);
  }

  newCrab(type, x, y, hostile = true) {
    const T = CRABS[type];
    const c = new Unit({ kind: 'crab', x, y, r: T.r, speed: T.speed, hp: T.hp });
    c.type = type;
    c.hostile = hostile;
    c.setFacing(Math.atan2(-y, -x));
    c.turnRate = 0.5;
    c.tgt = null;
    c.atkCd = 0;
    c.swing = null;
    c.shieldT = 0;
    c.wanderT = rand(1, 4);
    this.crabs.push(c);
    return c;
  }

  // Player 11's units: its living crabs.
  get hostiles() {
    return this.crabs.filter((c) => c.alive && c.hostile);
  }

  // Crab Spawn: every 10 s while Player 11 owns fewer than 30 units.
  spawnCrab() {
    if (this.hostiles.length >= MAX_P11) return;
    const a = rand(0, Math.PI * 2);
    let type = Math.random() < 0.5 ? 'shore' : 'limb';
    const melee = this.hostiles.length + 1 + [...this.heroes.values()].filter((u) => u.alive && u.form && CRABS[u.form].dmg).length;
    if (melee >= 5 && Math.random() < 1 / 8) type = 'behemoth';
    const c = this.newCrab(type, Math.cos(a) * SPAWN_R, Math.sin(a) * SPAWN_R);
    clampToRect(c, HW, HW);
    this.ev({ k: 'crab_nova', x: round2(c.x), y: round2(c.y), big: type === 'behemoth' ? 1 : undefined });
  }

  tick(dt) {
    if (this.time >= this.spawnT) {
      this.spawnT += SPAWN_EVERY;
      this.spawnCrab();
    }
    for (const c of this.crabs) {
      if (!c.alive) continue;
      if (c.shieldT > 0) c.shieldT -= dt;
      if (c.hostile) this.stepCrab(c, dt);
      else this.wander(c, dt);
    }
    for (const [pid, u] of this.heroes) {
      if (!u.alive) continue;
      this.stepPending(pid, u);
      this.autoAcquire(pid, u);
    }
    this.stepHeroes(dt);
    stepUnits(this.crabs, dt);
    const all = [...this.heroes.values(), ...this.crabs].filter((v) => v.alive);
    collideUnits(all);
    for (const v of all) {
      clampToRect(v, HW, HW);
      const d = Math.hypot(v.x, v.y);
      const min = TREE_R + v.r;
      if (d < min) {
        if (d < 0.001) [v.x, v.y] = [min, 0];
        else [v.x, v.y] = [(v.x * min) / d, (v.y * min) / d];
      }
    }
    this.crabs = this.crabs.filter((c) => c.alive);
  }

  // A hostile crab: chase what it has acquired (never giving up), else acquire
  // a player unit within 500, else wander.
  stepCrab(c, dt) {
    if (c.atkCd > 0) c.atkCd -= dt;
    if (c.swing) {
      c.swing.t += dt;
      if (c.swing.t >= ATK.point) {
        const t = c.swing.tgt;
        c.swing = null;
        if (t.alive) this.bite(c, t);
      }
      return;
    }
    let t = c.tgt;
    if (t && !t.alive) t = c.tgt = null;
    if (!t) {
      t = c.tgt = this.nearestPlayerUnit(c, ACQ);
      if (!t) return this.wander(c, dt);
    }
    const gap = dist(c.x, c.y, t.x, t.y) - c.r - t.r;
    if (gap > ATK.range) {
      if (c.target) c.steer(t.x, t.y);
      else c.order(t.x, t.y);
      return;
    }
    if (c.target) c.stop();
    const ang = Math.atan2(t.y - c.y, t.x - c.x);
    if (!c.facingAt(ang, 0.35)) {
      c.faceTo = ang;
      return;
    }
    c.faceTo = null;
    if (c.atkCd > 0) return;
    c.atkCd = ATK.cd;
    // Melee commits when the swing starts (engine.md).
    c.swing = { t: 0, tgt: t };
  }

  wander(c, dt) {
    c.wanderT -= dt;
    if (c.wanderT > 0) return;
    c.wanderT = rand(2, 5);
    const a = rand(0, Math.PI * 2);
    const d = wc3(rand(100, 300));
    const lim = c.hostile ? HW - c.r : LAND_R;
    c.order(Math.max(-lim, Math.min(lim, c.x + Math.cos(a) * d)), Math.max(-lim, Math.min(lim, c.y + Math.sin(a) * d)));
  }

  nearestPlayerUnit(c, range) {
    let best = null;
    let bd = range;
    for (const u of this.heroes.values()) {
      if (!u.alive) continue;
      const d = dist(c.x, c.y, u.x, u.y) - c.r - u.r;
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    return best;
  }

  rollDmg(type, targetArmor) {
    const [a, b] = CRABS[type].dmg;
    return (a + Math.floor(Math.random() * (b - a + 1))) * armorMult(targetArmor);
  }

  armorOf(v) {
    return v.kind === 'crab' ? CRABS[v.type].armor : v.form ? CRABS[v.form].armor : 0;
  }

  bite(c, t) {
    const dmg = this.rollDmg(c.type, this.armorOf(t));
    this.ev({ k: 'crab_bite', x: round2(t.x), y: round2(t.y) });
    if (t.kind === 'paladin') this.damage(t.owner, dmg, 'crab_death');
  }

  // Players' crabs bite with their crab's damage.
  attackHit(pid, u, tgt) {
    if (!u.form || !CRABS[u.form].dmg) return;
    const dmg = this.rollDmg(u.form, this.armorOf(tgt));
    this.ev({ k: 'crab_bite', x: round2(tgt.x), y: round2(tgt.y) });
    if (tgt.kind === 'paladin') return this.damage(tgt.owner, dmg, 'crab_death');
    tgt.hp -= dmg;
    if (dmg >= 1) this.ev({ k: 'dmg', x: round2(tgt.x), y: round2(tgt.y), n: Math.round(dmg) });
    if (tgt.hp <= 0 && tgt.alive) {
      tgt.alive = false;
      this.ev({ k: 'crab_die', x: round2(tgt.x), y: round2(tgt.y), t: tgt.type, f: round2(tgt.facing) });
    }
    // A bitten crab bites back.
    if (tgt.alive && tgt.hostile && !tgt.tgt) tgt.tgt = u;
  }

  // Only a possessed crab can attack: hostile crabs, the critter and rivals.
  attackables(pid) {
    const me = this.heroes.get(pid);
    if (!me?.form || !CRABS[me.form].dmg) return [];
    return [...this.crabs.filter((c) => c.alive), ...[...this.heroes.values()].filter((v) => v.alive && v !== me)];
  }

  // An idle possessed crab attacks hostile crabs within its acquisition range.
  autoAcquire(pid, u) {
    if (!u.form || !CRABS[u.form].dmg || u.target || u.attackOrder || u.cast || u.swing) return;
    let best = null;
    let bd = ACQ;
    for (const c of this.hostiles) {
      const d = dist(u.x, u.y, c.x, c.y) - u.r - c.r;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    if (best) u.attackOrder = best;
  }

  // Possession and the shell can only target crabs that are not possessed.
  pickCrab(x, y, u, range, forPossession, anyRange = false) {
    let best = null;
    let bd = 1.3;
    for (const c of this.crabs) {
      if (!c.alive) continue;
      const d = dist(x, y, c.x, c.y) - c.r;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    if (!best) return null;
    if (forPossession && best.shieldT > 0) return null;
    if (!anyRange && dist(u.x, u.y, best.x, best.y) - u.r - best.r > range + 0.3) return null;
    return anyRange ? best : { x: best.x, y: best.y, u: best };
  }

  useAbility(pid, slot, x, y) {
    const u = this.heroes.get(pid);
    const ab = this.abilities[slot];
    if (!u?.alive || !ab || u.cast) return;
    this.pending.delete(pid);
    if (!ab.available(pid)) return;
    const c = this.pickCrab(x, y, u, ab.range, slot === 0, true);
    if (!c || (slot === 0 && c.shieldT > 0)) return;
    if (dist(u.x, u.y, c.x, c.y) - u.r - c.r > ab.range) {
      // Out of range: walk into range first.
      this.pending.set(pid, { slot, c });
      u.attackOrder = null;
      u.order(c.x, c.y);
      return;
    }
    super.useAbility(pid, slot, c.x, c.y);
  }

  stepPending(pid, u) {
    const p = this.pending.get(pid);
    if (!p) return;
    const c = p.c;
    if (!c.alive || u.form || (p.slot === 0 && c.shieldT > 0)) {
      this.pending.delete(pid);
      if (u.target) u.stop();
      return;
    }
    if (dist(u.x, u.y, c.x, c.y) - u.r - c.r <= this.abilities[p.slot].range) {
      this.pending.delete(pid);
      super.useAbility(pid, p.slot, c.x, c.y);
    } else u.steer(c.x, c.y);
  }

  command(pid, m) {
    if (m.c !== 'cast') this.pending.delete(pid);
    super.command(pid, m);
  }

  // The banshee flies into the crab; the player now owns it with its current HP.
  possess(pid, u, c) {
    if (!c?.alive || c.shieldT > 0 || u.form || this.mana.get(pid) < POSSESS.mana) {
      this.ev({ k: 'crab_fizzle', x: round2(u.x), y: round2(u.y) });
      return;
    }
    this.mana.set(pid, this.mana.get(pid) - POSSESS.mana);
    this.ev({ k: 'crab_possess', x1: round2(u.x), y1: round2(u.y), x2: round2(c.x), y2: round2(c.y) });
    c.alive = false;
    const T = CRABS[c.type];
    u.form = c.type;
    u.skin = `crab_${c.type}`;
    u.x = c.x;
    u.y = c.y;
    u.setFacing(c.facing);
    u.r = T.r;
    u.speed = T.speed;
    u.hp = Math.max(1, c.hp);
    u.maxHp = T.hp;
    u.stop();
    // Crabs that were chasing the victim forget it; anything chasing the banshee keeps chasing the crab.
    for (const o of this.crabs) if (o.tgt === c) o.tgt = null;
  }

  shell(pid, c) {
    if (!c?.alive) return;
    this.mana.set(pid, this.mana.get(pid) - SHELL.mana);
    c.shieldT = SHELL.dur;
    this.ev({ k: 'crab_shell', x: round2(c.x), y: round2(c.y) });
  }

  // Original AI: every 6 s, move to a random point on the island; it never
  // uses Possession or AMS. Added: about a quarter of bots dive into the
  // biggest nearby crab when badly hurt, so bots are not all sitting ducks.
  botThink(pid, u, mem) {
    if (this.time < SPAWN_ON) return;
    if (!u.form && this.mana.get(pid) >= POSSESS.mana && !this.pending.has(pid)) {
      // Each bot decides once whether (and how badly hurt) it will dive.
      mem.dive ??= Math.random() < 0.75 ? 0 : rand(0.25, 0.45);
      const hurt = u.hp < u.maxHp * mem.dive;
      let best = null;
      let score = 0;
      for (const c of this.crabs) {
        if (!c.alive || c.shieldT > 0 || c.type === 'critter') continue;
        const d = dist(u.x, u.y, c.x, c.y);
        if (d > wc3(450)) continue;
        const s = CRABS[c.type].hp * (c.hp / CRABS[c.type].hp) - d * 20;
        if (s > score) {
          score = s;
          best = c;
        }
      }
      if (best && hurt) {
        this.useAbility(pid, 0, best.x, best.y);
        return;
      }
    }
    if (u.form) return; // a crab: bites whatever comes (auto-acquire)
    if (this.time < (mem.next ?? 0)) return;
    mem.next = this.time + 6;
    const a = rand(0, Math.PI * 2);
    const r = rand(0, HW);
    u.order(Math.cos(a) * r, Math.sin(a) * r);
  }

  hud(pid) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return null;
    if (u.form) return { label: `You are a ${CRABS[u.form].name} (${Math.ceil(u.hp)} HP)` };
    return { label: `Banshee · Mana ${Math.floor(this.mana.get(pid))}` };
  }

  worldEnts() {
    const ents = [];
    for (const c of this.crabs) {
      if (!c.alive) continue;
      ents.push({ id: c.id, k: 'crab_crab', t: c.type, x: round2(c.x), y: round2(c.y), f: round2(c.facing), mv: c.mx || c.my ? 1 : undefined, sw: c.swing ? 1 : undefined, sh: c.shieldT > 0 ? 1 : undefined });
    }
    return ents;
  }
}
