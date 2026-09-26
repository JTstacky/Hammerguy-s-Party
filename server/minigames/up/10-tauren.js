import { Minigame } from '../../base.js';
import { Unit, stepUnits, collideUnits, rand, dist, round2, wc3, wrapAngle } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';
import { noTies, Obstacles, nearest, idle, clampOct, dice, armorMult, wAng, stopOnLostTarget } from './e-common.js';

// Uther Party 4.0 #10 "The Tauren Tragedy" (docs/uther-party/rules-4.0.md).
// A 1280x1280 octagonal clearing with an invulnerable barracks in the middle.
// Every player is a level 2 Tauren Chieftain (about 800 HP, 240 mana with
// 0.8/s regen, speed 270) with Shockwave (Q: 100 mana, 8 s, 75 damage along
// an 800 u line 125 wide) and War Stomp (W: 50 mana, 6 s, 25 damage within
// 250, stuns footmen 3 s and taurens 2 s). Both spells hit rival taurens too.
// From t=7 the barracks sends out one 15 HP footman per starting player every
// 1.5 s while fewer than 50 of its units live (the barracks counts). Footmen
// home on the nearest tauren from 1000 u and hit for 12-13. A tauren's own
// attack (30-40, every 2.05 s, range 128) can only target footmen, and it
// swings on its own only at footmen right next to it (acquisition 128).
// Survival with no ties and no timer: the last tauren standing wins.
const HW = wc3(640);
const CUT = wc3(320); // the octagon's cut corners
const BARRACKS_R = wc3(144);
const MANA = 240;
const MANA_REGEN = 0.05 * 16; // INT 16
const ARMOR = 3; // hero armour from AGI 11 at level 2 (the sheet does not list it)
export const SHOCK = { cost: 100, cd: 8, range: wc3(700), len: wc3(800), half: wc3(125) / 2, speed: wc3(1050), dmg: 75 };
export const STOMP = { cost: 50, cd: 6, r: wc3(250), dmg: 25, stunUnit: 3, stunHero: 2 };
export const FOOT = { hp: 15, r: wc3(16), speed: wc3(270), range: wc3(90), cd: 1.35, point: 0.5, acquire: wc3(1000) };
const CAP = 50;

export class TaurenTragedy extends Minigame {
  static id = 'tauren';
  static name = 'The Tauren Tragedy';
  static desc = 'Footmen pour out of the barracks without end. Shockwave and War Stomp them, ration your mana, and do not get surrounded. Your spells hurt the other taurens too. Last tauren standing wins.';
  static controls = 'Right-click to move or attack a footman. Q: Shockwave (click a point). W: War Stomp. Both cost mana.';
  static duration = 600;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.obs = new Obstacles().circle(0, 0, BARRACKS_R);
    this.map = { theme: 'grass', floor: { shape: 'rect', w: HW * 2, h: HW * 2 }, props: treesAroundRect(HW, HW, 0.4, 2.2), bounds: HW + 3, build: ['tauren'], cut: round2(CUT) };
    this.attack = { range: wc3(128), cd: 2.05, point: 0.3, missile: 0, art: 'axe' };
    this.mana = new Map(this.pids.map((p) => [p, MANA]));
    this.abilities = [
      {
        name: 'Shockwave', icon: '💥', kind: 'point', cd: SHOCK.cd, range: SHOCK.range, castPoint: 0.3,
        desc: 'A wave of force 800 long: 75 damage to every footman and tauren in its path. 100 mana.',
        available: (pid) => this.mana.get(pid) >= SHOCK.cost,
        pickTarget: (pid, u, x, y) => ({ x, y }),
        cast: (pid, u, tgt) => this.shockwave(pid, u, tgt),
      },
      {
        name: 'War Stomp', icon: '🦶', kind: 'instant', cd: STOMP.cd, castPoint: 0.3,
        desc: '25 damage around you; stuns footmen for 3 s and taurens for 2 s. 50 mana.',
        available: (pid) => this.mana.get(pid) >= STOMP.cost,
        cast: (pid, u) => this.warStomp(pid, u),
      },
    ];
    // Each tauren starts 400 u from the centre in a random direction.
    this.spawnHeroes(
      this.pids.map(() => {
        const a = rand(0, Math.PI * 2);
        return [Math.cos(a) * wc3(400), Math.sin(a) * wc3(400)];
      }),
      { hp: 800, r: wc3(32), speed: wc3(270), regen: 0.25 + 0.05 * 28 },
    );
    for (const u of this.heroes.values()) u.skin = 'tauren';
    this.footmen = [];
    this.waves = [];
    // Spawn is periodic from map load, so its first tick after t=7 lands 0-1.5 s later.
    this.spawnT = rand(0, 1.5);
  }

  attackables() {
    return this.footmen.filter((f) => f.alive);
  }

  attackHit(pid, u, f) {
    this.ev({ k: 'hit', x: round2(f.x), y: round2(f.y) });
    // 2d6 + 28 STR, normal vs heavy armour 2: always more than 15.
    this.hurtFoot(f, (dice(2, 6) + 28) * armorMult(2));
  }

  hurtFoot(f, dmg) {
    if (!f.alive) return;
    f.hp -= dmg;
    if (f.hp <= 0) {
      f.alive = false;
      // Every P12 unit is set to explode on death.
      this.ev({ k: 'gib', x: round2(f.x), y: round2(f.y) });
    }
  }

  shockwave(pid, u, tgt) {
    this.mana.set(pid, this.mana.get(pid) - SHOCK.cost);
    const a = Math.atan2(tgt.y - u.y, tgt.x - u.x) || u.heading;
    this.waves.push({ pid, x0: u.x, y0: u.y, a, d: 0, hit: new Set() });
    this.ev({ k: 'shockwave', x: round2(u.x), y: round2(u.y), f: round2(a), len: round2(SHOCK.len), sp: round2(SHOCK.speed) });
  }

  warStomp(pid, u) {
    this.mana.set(pid, this.mana.get(pid) - STOMP.cost);
    this.ev({ k: 'warstomp', x: round2(u.x), y: round2(u.y), r: round2(STOMP.r) });
    for (const f of this.footmen) {
      if (!f.alive || dist(u.x, u.y, f.x, f.y) > STOMP.r + f.r) continue;
      f.stun = STOMP.stunUnit;
      f.swing = null;
      this.hurtFoot(f, STOMP.dmg);
    }
    for (const [op, v] of this.heroes) {
      if (op === pid || !v.alive || dist(u.x, u.y, v.x, v.y) > STOMP.r + v.r) continue;
      this.stunHero(v, STOMP.stunHero);
      this.damage(op, STOMP.dmg);
    }
  }

  stunHero(v, t) {
    v.stun = Math.max(v.stun, t);
    v.swing = null;
    v.cast = null;
  }

  stepWaves(dt) {
    for (const w of this.waves) {
      const d0 = w.d;
      w.d = Math.min(SHOCK.len, w.d + SHOCK.speed * dt);
      const ca = Math.cos(w.a);
      const sa = Math.sin(w.a);
      const hitIf = (v) => {
        const along = (v.x - w.x0) * ca + (v.y - w.y0) * sa;
        const side = Math.abs(-(v.x - w.x0) * sa + (v.y - w.y0) * ca);
        return along >= d0 - v.r && along <= w.d + v.r && side <= SHOCK.half + v.r;
      };
      for (const f of this.footmen) {
        if (!f.alive || w.hit.has(f) || !hitIf(f)) continue;
        w.hit.add(f);
        this.hurtFoot(f, SHOCK.dmg);
      }
      for (const [op, v] of this.heroes) {
        if (op === w.pid || !v.alive || w.hit.has(v) || !hitIf(v)) continue;
        w.hit.add(v);
        this.damage(op, SHOCK.dmg);
      }
      if (w.d >= SHOCK.len) w.done = true;
    }
    this.waves = this.waves.filter((w) => !w.done);
  }

  spawnFootmen() {
    const living = this.footmen.filter((f) => f.alive).length;
    if (living + 1 >= CAP) return;
    // One per playing slot at the start, even after players are out.
    for (let i = 0; i < this.pids.length; i++) {
      const a = rand(0, Math.PI * 2);
      const r = BARRACKS_R + FOOT.r + 0.05;
      const f = new Unit({ kind: 'footman', x: Math.cos(a) * r, y: Math.sin(a) * r, r: FOOT.r, speed: FOOT.speed, hp: FOOT.hp });
      f.setFacing(a);
      f.atkCd = 0;
      f.retarget = 0;
      this.footmen.push(f);
    }
  }

  // Footmen: acquisition 1000, so each goes for the nearest tauren and fights it.
  stepFootmen(dt) {
    const taurens = [...this.heroes.values()].filter((u) => u.alive);
    for (const f of this.footmen) {
      if (!f.alive) continue;
      if (f.atkCd > 0) f.atkCd -= dt;
      if (f.stun > 0) continue;
      if (f.swing) {
        f.swing.t += dt;
        if (f.swing.t >= FOOT.point) {
          const t = f.swing.tgt;
          f.swing = null;
          if (t.alive) {
            this.ev({ k: 'hit', x: round2(t.x), y: round2(t.y) });
            this.damage(t.owner, (11 + dice(1, 2)) * armorMult(ARMOR));
          }
        }
        continue;
      }
      f.retarget -= dt;
      if (!f.tgt?.alive || f.retarget <= 0) {
        f.retarget = rand(0.8, 1.2);
        f.tgt = nearest(f, taurens, FOOT.acquire);
      }
      const t = f.tgt;
      if (!t) {
        f.stop();
        continue;
      }
      const gap = dist(f.x, f.y, t.x, t.y) - f.r - t.r;
      if (gap > FOOT.range) {
        if (f.target) f.steer(t.x, t.y);
        else f.order(t.x, t.y);
        continue;
      }
      f.stop();
      const ang = Math.atan2(t.y - f.y, t.x - f.x);
      if (Math.abs(wrapAngle(ang - f.heading)) > 0.35) {
        f.faceTo = ang;
        continue;
      }
      f.faceTo = null;
      if (f.atkCd > 0) continue;
      f.atkCd = FOOT.cd;
      f.swing = { t: 0, tgt: t };
    }
  }

  tick(dt) {
    if (this.time >= 7) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT += 1.5;
        this.spawnFootmen();
      }
    }
    for (const [pid, m] of this.mana) this.mana.set(pid, Math.min(MANA, m + MANA_REGEN * dt));
    // Acquisition 128: an idle tauren swings at a footman right next to it.
    for (const u of this.heroes.values()) {
      if (!idle(u)) continue;
      const f = nearest(u, this.footmen, wc3(128));
      if (f) u.attackOrder = f;
    }
    // A stunned tauren can neither swing nor cast.
    for (const u of this.heroes.values()) {
      if (u.stun > 0) {
        u.swing = null;
        u.cast = null;
      }
    }
    this.stepFootmen(dt);
    stepUnits(this.footmen, dt);
    stopOnLostTarget(this.heroes.values(), () => this.stepHeroes(dt));
    this.stepWaves(dt);
    const all = [...this.heroes.values(), ...this.footmen.filter((f) => f.alive)];
    collideUnits(all);
    for (const u of all) {
      if (!u.alive) continue;
      this.obs.push(u);
      clampOct(u, HW, CUT);
    }
    this.footmen = this.footmen.filter((f) => f.alive);
  }

  // The original AI (from t=7): every 4 s, walk 200-400 u from where you are,
  // heading away from the centre give or take up to 120 degrees. It never casts.
  botThink(pid, u, mem) {
    if (this.time < 7) return;
    mem.next ??= this.time + rand(0, 4);
    if (this.time < mem.next) return;
    mem.next += 4;
    const a = Math.atan2(u.y, u.x) + wAng(rand(-120, 120));
    const d = wc3(rand(200, 400));
    u.attackOrder = null;
    u.order(u.x + Math.cos(a) * d, u.y + Math.sin(a) * d);
  }

  hud(pid) {
    const m = this.mana.get(pid);
    return m == null ? null : { label: `Mana ${Math.floor(m)} / ${MANA}` };
  }

  worldEnts() {
    const ents = [];
    for (const f of this.footmen) {
      const e = { id: f.id, k: 'footman', x: round2(f.x), y: round2(f.y), f: round2(f.facing) };
      if (f.mx || f.my) e.mv = 1;
      if (f.swing) e.sw = 1;
      if (f.stun > 0) e.st = 1;
      ents.push(e);
    }
    return ents;
  }
}

noTies(TaurenTragedy);
