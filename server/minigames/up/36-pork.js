import { Minigame } from '../../base.js';
import { Unit, newId, rand, dist, round2, wc3, stepUnits, clampToRect } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';

// Uther Party 4.0 #36 "Pork the Piggy" (docs/uther-party/rules-4.0.md).
//  - A 1024x1024 pen. The hunters stand still in a row 64 u from the south
//    edge, 128 u apart, facing north. They are invulnerable and never move.
//  - Every order is rewritten to "attack ground": a right-click on the ground
//    throws a spear at that point, and keeps throwing there every 2.31 s; a
//    right-click on the pig throws at the spot the pig stands on now. You have
//    to lead it.
//  - Spears are artillery: damage point 0.31 s, full damage within 10 u of the
//    impact plus the pig's body (collision 16). One spear kills (15 HP).
//  - The Barbeque Piggy walks at 100 u/s. Every 4 s it picks a random point in
//    the pen; one closer than 400 u is replaced by 400 u toward the centre.
//  - A kill is a race finish: 8, 7, 6 ... and the hunter leaves. A new pig
//    appears within 256 u of the centre 2 s later. 90 s timer.
//  - Bots auto-attack the pig directly, which throws at where it is at the
//    release: they do not lead it, so they often miss (as in the original).
// Deviation: the Headhunter's projectile speed is not in the extracted data;
// we use 1000 u/s, the common WC3 value for thrown spears and arrows.
const HW = wc3(512);
const ROW_Y = wc3(448); // south is +y on screen
const SPACING = wc3(128);
const HUNTER_R = wc3(48);
const PIG_SPEED = wc3(100);
const PIG_R = wc3(16);
const PIG_HP = 15;
const COOLDOWN = 2.31;
const DMG_POINT = 0.31;
const SPLASH = wc3(10);
const SPEAR_SPEED = wc3(1000);
const LEG = wc3(400);
const PATROL = 4;
const RESPAWN = 2;
const SPEAR_DMG = [23, 27]; // pierce, x0.75 against the pig: 17-20 > 15 HP

export class PorkThePiggy extends Minigame {
  static id = 'pork';
  static name = 'Pork the Piggy';
  static desc = 'Be the first to skewer the piggy! You stand still and throw spears at the ground where you click: the spear lands exactly there, so lead the pig. Each hunter can score once.';
  static controls = 'Right-click (tap) the ground to throw a spear there; it keeps throwing every 2.31 s. S stops.';
  static duration = 90;
  static ranking = 'race';

  setup() {
    this.map = {
      theme: 'grass',
      floor: { shape: 'rect', w: HW * 2, h: HW * 2 },
      props: [...treesAroundRect(HW, HW, 0.5, 2.6)],
      bounds: HW + 3,
      build: ['pork_pen'],
    };
    // Row of 8 slots; players take the first N, handed out at random.
    const slots = Array.from({ length: this.pids.length }, (_, i) => [wc3(-576 + 128 * (i + 1)), ROW_Y]);
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    this.spawnHeroes(slots, { speed: 0, r: HUNTER_R, facing: -Math.PI / 2 });
    for (const u of this.heroes.values()) {
      u.aim = null; // {x, y} or {pig: true} (bots)
      u.atkCd = 0;
      u.wind = -1;
      u.skin = 'pork_hunter'; // Troll Headhunter (ohun)
    }
    this.spears = [];
    this.pig = null;
    this.pigT = 0; // respawn countdown
    this.patrolT = PATROL;
    this.spawnPig(wc3(128));
  }

  spawnPig(within) {
    const a = rand(0, Math.PI * 2);
    const r = rand(0, within);
    const pig = new Unit({ kind: 'pig', x: Math.cos(a) * r, y: Math.sin(a) * r, r: PIG_R, speed: PIG_SPEED, hp: PIG_HP });
    pig.setFacing(rand(-Math.PI, Math.PI));
    const h = rand(0, Math.PI * 2);
    pig.order(clampIn(pig.x + Math.cos(h) * LEG), clampIn(pig.y + Math.sin(h) * LEG));
    this.pig = pig;
    this.ev({ k: 'pork_blink', x: round2(pig.x), y: round2(pig.y) });
  }

  // Pork Patrol: a random point in the pen, or 400 u toward the centre if that point is too close.
  patrol() {
    const pig = this.pig;
    if (!pig?.alive) return;
    const x = rand(-HW, HW);
    const y = rand(-HW, HW);
    if (dist(x, y, pig.x, pig.y) >= LEG) return pig.order(x, y);
    const d = Math.hypot(pig.x, pig.y);
    const a = d > 0.01 ? Math.atan2(-pig.y, -pig.x) : rand(0, Math.PI * 2);
    pig.order(clampIn(pig.x + Math.cos(a) * LEG), clampIn(pig.y + Math.sin(a) * LEG));
  }

  command(pid, m) {
    const u = this.heroes.get(pid);
    if (!u || !u.alive || u.finished) return;
    if (m.c === 'stop') {
      u.aim = null;
      u.wind = -1;
      u.faceTo = null;
      return;
    }
    if (m.c !== 'move' && m.c !== 'steer') return;
    let x = +m.x || 0;
    let y = +m.y || 0;
    // A right-click on the pig becomes attack-ground at its current position.
    const pig = this.pig;
    if (pig?.alive && dist(x, y, pig.x, pig.y) < pig.r + 0.9) {
      x = pig.x;
      y = pig.y;
    }
    u.aim = { x, y };
  }

  aimPoint(u) {
    if (!u.aim) return null;
    if (u.aim.pig) return this.pig?.alive ? { x: this.pig.x, y: this.pig.y } : null;
    return u.aim;
  }

  tick(dt) {
    this.patrolT -= dt;
    if (this.patrolT <= 0) {
      this.patrolT += PATROL;
      this.patrol();
    }
    if (!this.pig) {
      this.pigT -= dt;
      if (this.pigT <= 0) this.spawnPig(wc3(256));
    }
    if (this.pig) {
      stepUnits([this.pig], dt);
      clampToRect(this.pig, HW, HW);
    }
    for (const [pid, u] of this.heroes) {
      if (u.finished) continue;
      if (u.atkCd > 0) u.atkCd -= dt;
      const p = this.aimPoint(u);
      if (u.wind >= 0) {
        u.wind += dt;
        if (u.wind >= DMG_POINT) {
          u.wind = -1;
          if (p) this.throwSpear(pid, u, p);
        }
        continue;
      }
      if (!p) {
        u.faceTo = null;
        continue;
      }
      const ang = Math.atan2(p.y - u.y, p.x - u.x);
      u.faceTo = ang;
      if (u.atkCd > 0 || !u.facingAt(ang, 0.2)) continue;
      u.atkCd = COOLDOWN;
      u.wind = 0;
      this.ev({ k: 'swing', u: u.id });
    }
    this.stepHeroes(dt);
    for (const s of this.spears) {
      s.t += dt;
      if (s.t >= s.flight) this.land(s);
    }
    this.spears = this.spears.filter((s) => !s.done);
  }

  throwSpear(pid, u, p) {
    const d = dist(u.x, u.y, p.x, p.y);
    this.spears.push({ id: newId(), pid, sx: u.x, sy: u.y, x: p.x, y: p.y, t: 0, flight: Math.max(0.15, d / SPEAR_SPEED), dmg: rand(SPEAR_DMG[0], SPEAR_DMG[1]) * 0.75 });
    this.ev({ k: 'sfx', s: 'thrust' });
  }

  land(s) {
    s.done = true;
    const pig = this.pig;
    const hit = pig?.alive && dist(pig.x, pig.y, s.x, s.y) <= SPLASH + pig.r;
    this.ev({ k: 'pork_land', x: round2(s.x), y: round2(s.y), hit: hit ? 1 : undefined });
    if (!hit) return;
    const u = this.heroes.get(s.pid);
    // Pork Kill: only a hunter still in play can score (a finished one has left).
    if (!u || u.finished) return;
    pig.hp -= s.dmg;
    if (pig.hp > 0) return;
    pig.alive = false;
    this.ev({ k: 'pork_kill', x: round2(pig.x), y: round2(pig.y), f: round2(pig.facing) });
    this.pig = null;
    this.pigT = RESPAWN;
    this.finish(s.pid);
    u.aim = null;
    u.wind = -1;
    u.solid = false;
    this.ev({ k: 'tele', x1: round2(u.x), y1: round2(u.y), x2: round2(u.x), y2: round2(u.y) });
  }

  // Bots have acquisition 2000 and attack the pig itself (no order rewrite).
  botThink(pid, u) {
    u.aim = this.pig?.alive ? { pig: true } : null;
  }

  hud(pid) {
    const u = this.heroes.get(pid);
    if (!u) return null;
    if (u.finished) return { label: 'Skewered! You are done.' };
    return { label: u.atkCd > 0 ? `Reloading ${u.atkCd.toFixed(1)} s` : 'Spear ready' };
  }

  // Finished hunters leave the pen.
  heroEnts(pid) {
    return super.heroEnts(pid).filter((e) => !this.heroes.get(e.o)?.finished);
  }

  worldEnts(pid) {
    const ents = [];
    const pig = this.pig;
    if (pig) ents.push({ id: pig.id, k: 'pork_pig', x: round2(pig.x), y: round2(pig.y), f: round2(pig.facing), mv: pig.mx || pig.my ? 1 : undefined });
    for (const s of this.spears) ents.push({ id: s.id, k: 'pork_spear', x: round2(s.x), y: round2(s.y), sx: round2(s.sx), sy: round2(s.sy), t: round2(s.t / s.flight), fl: round2(s.flight) });
    const me = this.heroes.get(pid);
    if (me && !me.finished && me.aim && !me.aim.pig) ents.push({ id: `aim${pid}`, k: 'pork_aim', x: round2(me.aim.x), y: round2(me.aim.y) });
    return ents;
  }
}

function clampIn(v) {
  return Math.max(-HW + PIG_R, Math.min(HW - PIG_R, v));
}

