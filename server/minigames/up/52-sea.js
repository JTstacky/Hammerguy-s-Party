import { Minigame } from '../../base.js';
import { newId, rand, dist, shuffle, clampToRect, round2, wc3, pick } from '../../../engine/server/sim.js';

// Uther Party 4.0 #52 "Sea Combat" (docs/uther-party/rules-4.0.md).
// A Free Play game in the original; here it joins the normal roll.
//
// An artillery duel between Human Battleships on the open sea of Tides of
// Darkness (2048 x 1920). Ships start on a ring 896 from the centre at
// (135 i - 22.5)°, handed out at random, facing the centre.
//  - Battleship: 400 HP, armour 5 (x0.769), speed 270, turn rate 0.1 (very
//    sluggish), collision 48, no regen. The hero's look is swapped for a ship
//    with u.skin = 'battleship'.
//  - Cannon: 75 + 3d10 siege, every 2.0 s, range 900, damage point 0.3, the
//    shell flies at 900 u/s to where the target WAS at the release (artillery
//    aims at a spot), splash 100 % / 50 % / 25 % within 100 / 150 / 250 u of
//    the victim's edge, never hurting the firing ship.
//  - Acquisition is set to 100, so ships do not pick targets themselves:
//    right-click a rival (or Q: attack a spot of sea) to open fire.
// Survival with no ties (TiesPossible is false): ships sinking together still
// get sequential antes. Last ship afloat wins; at the time limit every
// survivor ties.
//
// Simplifications:
//  - The 120 s timer includes the original's 5 s frozen start, which our
//    6 s intro countdown replaces, so the playable time is 115 s.
//  - The shallows in the NE and SW corners are only visual (ships float
//    there anyway), and the few dry corner cells are ignored.
//  - The shell's flight time is distance / 900 (no measured launch offset).

const DEG = Math.PI / 180;
const HW = wc3(1024);
const HH = wc3(960);
const START_R = wc3(896);

export const SHIP = { hp: 400, speed: wc3(270), turnRate: 0.1, r: wc3(48), armour: 1 - (0.06 * 5) / (1 + 0.06 * 5) };
export const GUN = {
  range: wc3(900),
  cd: 2.0,
  point: 0.3,
  speed: wc3(900),
  base: 75,
  dice: 3,
  sides: 10,
  tiers: [
    [wc3(100), 1],
    [wc3(150), 0.5],
    [wc3(250), 0.25],
  ],
  facing: 0.35, // radians off target that still lets a ship fire
};
export const AI_EVERY = 2;

export class SeaCombat extends Minigame {
  static id = 'sea';
  static name = 'Sea Combat';
  static desc = 'Battleships on the open sea. Their cannons lob shells at where a ship was, not where it is going, so keep moving and lead nobody. Last ship afloat wins.';
  static controls = 'Right-click to sail. Right-click a rival ship to fire on it every 2 s (range 900). Q, then click: bombard a spot of sea.';
  static duration = 115;
  static ranking = 'survival';

  setup() {
    this.map = {
      theme: 'sea',
      floor: { shape: 'rect', w: HW * 2, h: HH * 2 },
      props: shore(),
      build: ['sea'],
      bounds: HW + 2,
    };
    this.abilities = [
      {
        name: 'Attack Ground',
        icon: '💥',
        desc: 'Bombard a spot of sea with every shot until you give another order. Sail into range first if it is too far.',
        kind: 'point',
        range: GUN.range,
        cast: (pid, u, tgt) => this.orderAttack(u, { x: tgt.x, y: tgt.y }),
      },
    ];
    const spots = shuffle(this.pids.map((_, i) => {
      const a = (135 * (i + 1) - 22.5) * DEG;
      return [Math.cos(a) * START_R, -Math.sin(a) * START_R];
    }));
    this.spawnHeroes(spots, { hp: SHIP.hp, r: SHIP.r, speed: SHIP.speed, turnRate: SHIP.turnRate });
    for (const u of this.heroes.values()) {
      u.skin = 'battleship';
      u.gunCd = 0;
      u.wind = null;
    }
    this.shells = [];
    this.fxId = newId();
    this.aiT = rand(0, AI_EVERY);
  }

  orderAttack(u, o) {
    u.attackOrder = o;
    if (u.wind && u.wind.o !== o) u.wind = null;
  }

  shipAt(pid, x, y) {
    let best = null;
    let bd = 1.2;
    for (const [op, v] of this.heroes) {
      if (op === pid || !v.alive) continue;
      const d = dist(x, y, v.x, v.y) - v.r;
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  command(pid, m) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return;
    if (m.c === 'move') {
      const v = this.shipAt(pid, +m.x || 0, +m.y || 0);
      if (v) {
        if (u.attackOrder?.u !== v) this.orderAttack(u, { u: v });
        if (u.cast) u.cast.queued = null;
        return;
      }
    }
    if (m.c !== 'cast') {
      u.attackOrder = null;
      u.wind = null;
    }
    super.command(pid, m);
  }

  tick(dt) {
    this.aiT -= dt;
    if (this.aiT <= 0) {
      this.aiT += AI_EVERY;
      this.seaAI();
    }
    this.stepGuns(dt);
    this.stepHeroes(dt);
    for (const u of this.heroes.values()) if (u.alive) clampToRect(u, HW, HH);
    for (const s of this.shells) {
      s.t += dt;
      if (s.t >= s.flight) this.land(s);
    }
    this.shells = this.shells.filter((s) => !s.dead);
  }

  // WC3 attack orders for artillery: sail into range, turn to face, then a
  // 0.3 s wind-up standing still, and the shell goes to the target's spot at
  // the release. An attack-ground order keeps firing at its spot.
  stepGuns(dt) {
    for (const [pid, u] of this.heroes) {
      if (u.gunCd > 0) u.gunCd -= dt;
      if (!u.alive) continue;
      const o = u.attackOrder;
      if (u.wind) {
        if (u.wind.o !== o || (o.u && !o.u.alive)) u.wind = null;
        else {
          u.wind.t += dt;
          if (u.wind.t >= GUN.point) {
            u.wind = null;
            this.fire(pid, u, o.u ? o.u.x : o.x, o.u ? o.u.y : o.y);
          }
          continue;
        }
      }
      if (!o || u.cast) continue;
      if (o.u && !o.u.alive) {
        u.attackOrder = null;
        continue;
      }
      const tx = o.u ? o.u.x : o.x;
      const ty = o.u ? o.u.y : o.y;
      const gap = dist(u.x, u.y, tx, ty) - u.r - (o.u ? o.u.r : 0);
      if (gap > GUN.range) {
        if (u.target) u.steer(tx, ty);
        else u.order(tx, ty);
        continue;
      }
      if (u.target) u.stop();
      const ang = Math.atan2(ty - u.y, tx - u.x);
      if (!u.facingAt(ang, GUN.facing)) {
        u.faceTo = ang;
        continue;
      }
      u.faceTo = null;
      if (u.gunCd > 0) continue;
      u.gunCd = GUN.cd;
      u.wind = { t: 0, o };
    }
  }

  fire(pid, u, x, y) {
    let dmg = GUN.base;
    for (let i = 0; i < GUN.dice; i++) dmg += 1 + Math.floor(Math.random() * GUN.sides);
    const d = dist(u.x, u.y, x, y);
    const f = Math.atan2(y - u.y, x - u.x);
    const mx = u.x + Math.cos(f) * u.r * 1.6;
    const my = u.y + Math.sin(f) * u.r * 1.6;
    this.shells.push({ id: newId(), pid, sx: mx, sy: my, x, y, t: 0, flight: Math.max(0.2, d / GUN.speed), dmg: dmg * SHIP.armour });
    this.ev({ k: 'cannon', x: round2(mx), y: round2(my), f: round2(f), u: u.id });
  }

  land(s) {
    s.dead = true;
    let hit = false;
    for (const [pid, v] of this.heroes) {
      if (!v.alive || pid === s.pid) continue;
      const d = dist(v.x, v.y, s.x, s.y) - v.r;
      const tier = GUN.tiers.find(([rad]) => d <= rad);
      if (tier) {
        hit = true;
        this.damage(pid, s.dmg * tier[1], 'sink');
      }
    }
    this.ev({ k: 'seahit', x: round2(s.x), y: round2(s.y), r: round2(GUN.tiers[2][0]), hit: hit ? 1 : undefined });
  }

  // "Sea AI", every 2 s for every computer ship: sail to a random point of
  // the rect, and 3 times in 4 attack a random living unit there instead
  // (which may be itself, and then it just keeps sailing).
  seaAI() {
    const living = [...this.heroes.values()].filter((v) => v.alive);
    for (const pid of this.bots.keys()) {
      const u = this.heroes.get(pid);
      if (!u?.alive) continue;
      u.attackOrder = null;
      u.wind = null;
      u.order(rand(-HW, HW), rand(-HH, HH));
      if (Math.floor(rand(1, 5)) !== 1) {
        const v = pick(living);
        if (v && v !== u) {
          u.stop();
          this.orderAttack(u, { u: v });
        }
      }
    }
  }

  deathGroups() {
    return this.elimOrder.map((e) => [e.pid]);
  }

  hud(pid) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return null;
    const o = u.attackOrder;
    const tgt = o?.u ? `firing on ${this.party.room.nameOf(o.u.owner)}` : o ? 'bombarding' : 'guns idle';
    return { label: `${tgt} · ${u.gunCd > 0 ? `reload ${u.gunCd.toFixed(1)} s` : 'loaded'}` };
  }

  worldEnts() {
    const ents = [{ id: this.fxId, k: 'seafx', x: 0, y: 0 }];
    for (const s of this.shells) ents.push({ id: s.id, k: 'shell', x: round2(s.x), y: round2(s.y), sx: round2(s.sx), sy: round2(s.sy), t: round2(s.t / s.flight), r: round2(GUN.tiers[1][0]) });
    return ents;
  }
}

// The coast round the bay: rocks at the waterline and trees on the land behind.
function shore() {
  const props = [];
  const step = 2.2;
  for (const [len, fixed, horiz] of [[HW, HH, true], [HW, -HH, true], [HH, HW, false], [HH, -HW, false]]) {
    for (let a = -len - 1; a <= len + 1; a += step) {
      const s = Math.sign(fixed);
      const out = Math.abs(fixed) + rand(0.9, 1.6);
      const p = (o, j = 0) => (horiz ? { x: a + j, y: s * o } : { x: s * o, y: a + j });
      // Rocks scattered along the (irregular) waterline, sometimes in pairs.
      if (Math.random() < 0.4) {
        props.push({ t: 'rock', ...p(out + rand(-0.4, 2.2), rand(-1, 1)), s: rand(0.5, 1.4) });
        if (Math.random() < 0.35) props.push({ t: 'rock', ...p(out + rand(0.2, 2.6), rand(-1.6, 1.6)), s: rand(0.35, 0.8) });
      }
      props.push({ t: 'tree', ...p(out + rand(2.5, 4), rand(-0.6, 0.6)), s: rand(0.9, 1.4) });
      if (Math.random() < 0.6) props.push({ t: 'tree', ...p(out + rand(5, 8), rand(-1, 1)), s: rand(1, 1.5) });
    }
  }
  return props;
}

