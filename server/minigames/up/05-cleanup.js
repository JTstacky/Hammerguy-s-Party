import { Minigame } from '../../base.js';
import { Unit, newId, rand, dist, round2, wc3, clamp, clampToRect, stepUnits } from '../../../engine/server/sim.js';

// Uther Party 4.0 #5 "The Clean-up Crew" (docs/uther-party/rules-4.0.md): a
// flat 1664x1664 square at night. Players are ghouls with 50 HP that lose
// 1 HP every 0.05 s (-20/s) everywhere and regenerate 20/s only on blight, so
// off the blight a full ghoul dies in 2.5 s. The blight starts as three
// radius-512 discs centred in the middle 256x256. From t=5, every 10 s a
// random priest (of four at the corners, ±700) is sent to cast Dispel Magic
// on a random ghoul: it walks into range 500, turns and, after its 0.5 s cast
// point, clears the blight within 200 of where the ghoul stood when the cast
// began. Each ghoul that dies leaves a new blight disc of radius 192. Deaths
// in the same instant tie. No timer.
//
// Deviation: the ghoul's Cannibalize (5 HP/s from a corpse) is left out.
// Corpses lie on the fresh blight disc their death leaves, where a ghoul is
// already at a net 0, so it changes nothing in play.
const H = wc3(832);
const START_R = wc3(512);
const DEATH_R = wc3(192);
const DISPEL_R = wc3(200);
const DISPEL_RANGE = wc3(500);
const CAST_POINT = 0.5;
const HP = 50;
const REGEN = 20;
const PRIEST_AT = wc3(700);

export class CleanupCrew extends Minigame {
  static id = 'cleanup';
  static name = 'The Clean-up Crew';
  static desc = 'You are a ghoul, and ghouls only heal on the blight. Off it you are dead in 2.5 seconds. Priests keep walking up to someone and dispelling the blight from under them. Stay on the blight!';
  static controls = 'Right-click to move. Watch for the priest coming your way and step off the spot he is dispelling.';
  static duration = 300;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'night', floor: { shape: 'rect', w: H * 2, h: H * 2 }, props: rimRocks(H), build: ['cleanup'], bounds: H + 1 };
    // Blight as an ordered list of discs: [1, x, y, r] adds blight, [0, x, y, r] clears it.
    // A point is blighted if the last disc covering it added blight.
    this.blight = [];
    for (let i = 0; i < 3; i++) this.blight.push([1, wc3(rand(-128, 128)), wc3(rand(-128, 128)), START_R]);
    this.blightId = newId();
    // Ghouls: HP 50, speed 270, collision 31, 0-256 u from the centre, random facing.
    this.spawnHeroes(
      this.pids.map(() => {
        const a = rand(0, Math.PI * 2);
        const r = wc3(rand(0, 256));
        return [Math.cos(a) * r, Math.sin(a) * r];
      }),
      { hp: HP },
    );
    for (const u of this.heroes.values()) u.skin = 'ghoul';
    for (const u of this.heroes.values()) u.setFacing(rand(-Math.PI, Math.PI));
    this.priests = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sy]) => {
      const p = new Unit({ kind: 'cpriest', x: sx * PRIEST_AT, y: sy * PRIEST_AT, r: wc3(16), speed: wc3(270) });
      p.setFacing(Math.atan2(-sy, -sx));
      p.wanderT = rand(1, 4);
      p.job = null;
      return p;
    });
    this.degradeT = 0;
    this.dispelT = 5 + rand(0, 10);
  }

  isBlight(x, y) {
    for (let i = this.blight.length - 1; i >= 0; i--) {
      const [add, bx, by, r] = this.blight[i];
      if ((x - bx) ** 2 + (y - by) ** 2 <= r * r) return add === 1;
    }
    return false;
  }

  tick(dt) {
    // Regeneration (blight only), then "Clean Degrade": -1 HP every 0.05 s.
    for (const u of this.heroes.values()) if (u.alive && this.isBlight(u.x, u.y)) u.hp = Math.min(HP, u.hp + REGEN * dt);
    this.degradeT -= dt;
    while (this.degradeT <= 0) {
      this.degradeT += 0.05;
      for (const [pid, u] of this.heroes) {
        if (!u.alive) continue;
        u.hp -= 1;
        if (u.hp <= 0.405) {
          u.hp = 0;
          this.eliminate(pid, 'death');
        }
      }
    }

    // "Clean Dispel": every 10 s (from t=5) a random priest goes for a random living ghoul.
    this.dispelT -= dt;
    if (this.dispelT <= 0) {
      this.dispelT += 10;
      const alive = [...this.heroes.values()].filter((u) => u.alive);
      if (alive.length) {
        const v = alive[Math.floor(Math.random() * alive.length)];
        const p = this.priests[Math.floor(Math.random() * 4)];
        p.job = { v, cast: -1 };
        this.onDispelOrdered(v);
      }
    }
    for (const p of this.priests) this.stepPriest(p, dt);

    this.stepHeroes(dt);
    stepUnits(this.priests, dt);
    for (const u of this.heroes.values()) if (u.alive) clampToRect(u, H, H);
    for (const p of this.priests) clampToRect(p, H, H);
  }

  stepPriest(p, dt) {
    const j = p.job;
    if (!j) {
      // Wander: drift to a random nearby spot now and then.
      p.wanderT -= dt;
      if (p.wanderT <= 0) {
        p.wanderT = rand(2, 5);
        p.order(clamp(p.x + rand(-4, 4), -H + 1, H - 1), clamp(p.y + rand(-4, 4), -H + 1, H - 1));
      }
      return;
    }
    if (j.cast < 0) {
      if (!j.v.alive) {
        p.job = null;
        p.stop();
        return;
      }
      if (dist(p.x, p.y, j.v.x, j.v.y) > DISPEL_RANGE) {
        if (p.target) p.steer(j.v.x, j.v.y);
        else p.order(j.v.x, j.v.y);
        return;
      }
      // In range: stop and turn to face the ghoul, then start the cast.
      p.stop();
      const ang = Math.atan2(j.v.y - p.y, j.v.x - p.x);
      p.faceTo = ang;
      if (!p.facingAt(ang, 0.08)) return;
      p.faceTo = null;
      j.cast = 0;
      j.x = j.v.x;
      j.y = j.v.y;
      this.ev({ k: 'cleandispelcast', x: round2(j.x), y: round2(j.y), r: round2(DISPEL_R), u: p.id, d: CAST_POINT });
      return;
    }
    j.cast += dt;
    if (j.cast < CAST_POINT) return;
    this.blight.push([0, j.x, j.y, DISPEL_R]);
    this.ev({ k: 'cleandispel', x: round2(j.x), y: round2(j.y), r: round2(DISPEL_R), px: round2(p.x), py: round2(p.y) });
    p.job = null;
    p.wanderT = rand(1, 3);
  }

  eliminate(pid, how) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return;
    super.eliminate(pid, how);
    // "Clean Death": the fallen ghoul leaves a patch of blight.
    this.blight.push([1, u.x, u.y, DEATH_R]);
    this.ev({ k: 'blightgrow', x: round2(u.x), y: round2(u.y), r: round2(DEATH_R) });
  }

  // The original's bots: when a dispel is ordered, every computer ghoul in a
  // 650x650 box round the target runs 500-600 u in a random direction. Here
  // better bots pick a direction that ends on blight.
  onDispelOrdered(v) {
    for (const [pid, b] of this.bots) {
      const u = this.heroes.get(pid);
      if (!u?.alive || Math.abs(u.x - v.x) > wc3(325) || Math.abs(u.y - v.y) > wc3(325)) continue;
      const to = this.pickMove(u, wc3(500), wc3(600), b.mem.skill);
      if (to) u.order(to[0], to[1]);
    }
  }

  pickMove(u, r0, r1, skill) {
    let fallback = null;
    for (let i = 0; i < 10; i++) {
      const a = rand(-Math.PI, Math.PI);
      const r = rand(r0, r1);
      const x = clamp(u.x + Math.cos(a) * r, -H + 0.6, H - 0.6);
      const y = clamp(u.y + Math.sin(a) * r, -H + 0.6, H - 0.6);
      fallback ??= [x, y];
      if (Math.random() > skill) return [x, y]; // the original's random dodge
      if (this.safeSpot(x, y) && this.pathOnBlight(u.x, u.y, x, y)) return [x, y];
    }
    return fallback;
  }

  pathOnBlight(x0, y0, x1, y1) {
    const n = Math.ceil(dist(x0, y0, x1, y1) / 0.8);
    for (let i = 1; i <= n; i++) if (!this.isBlight(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return false;
    return true;
  }

  // Blight with a little margin, away from any dispel about to land.
  safeSpot(x, y) {
    if (!this.isBlight(x, y)) return false;
    for (const [dx, dy] of [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]]) if (!this.isBlight(x + dx, y + dy)) return false;
    for (const p of this.priests) if (p.job && p.job.cast >= 0 && dist(x, y, p.job.x, p.job.y) < DISPEL_R + 0.9) return false;
    return true;
  }

  nearestSafe(u) {
    for (let r = 0.8; r < 14; r += 0.8) {
      const off = rand(0, Math.PI * 2);
      for (let i = 0; i < 16; i++) {
        const a = off + (i / 16) * Math.PI * 2;
        const x = u.x + Math.cos(a) * r;
        const y = u.y + Math.sin(a) * r;
        if (Math.abs(x) < H - 0.6 && Math.abs(y) < H - 0.6 && this.safeSpot(x, y)) return [x, y];
      }
    }
    return null;
  }

  botThink(pid, u, mem) {
    // Every 4 s the original nudges one random ghoul 50-200 u if a computer owns it.
    mem.nudge = (mem.nudge ?? rand(0, 4)) - 0.22;
    // Off the blight, or standing where a dispel is about to land: head for the nearest safe blight.
    if (!this.safeSpot(u.x, u.y) && Math.random() < mem.skill + 0.15) {
      if (!(u.target && this.safeSpot(u.target.x, u.target.y))) {
        const to = this.nearestSafe(u);
        if (to) u.order(to[0], to[1]);
      }
      return;
    }
    // A priest on his way: keep moving about, as the designer advises.
    if (!u.target && this.priests.some((p) => p.job?.v === u) && Math.random() < mem.skill * 0.3) {
      const to = this.pickMove(u, wc3(150), wc3(350), mem.skill);
      if (to) u.order(to[0], to[1]);
      return;
    }
    if (mem.nudge <= 0) {
      mem.nudge = 4;
      const to = this.pickMove(u, wc3(50), wc3(200), mem.skill);
      if (to) u.order(to[0], to[1]);
    }
  }

  hud(pid) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return null;
    return { label: this.isBlight(u.x, u.y) ? 'On the blight' : 'OFF THE BLIGHT!' };
  }

  worldEnts() {
    const ents = [{ id: this.blightId, k: 'cleanblight', x: 0, y: 0, ops: this.blight.map(([a, x, y, r]) => [a, round2(x), round2(y), round2(r)]), h: round2(H) }];
    for (const p of this.priests) {
      const e = { id: p.id, k: 'cpriest', x: round2(p.x), y: round2(p.y), f: round2(p.facing) };
      if (p.mx || p.my) e.mv = 1;
      if (p.job && p.job.cast >= 0) e.cast = 1;
      ents.push(e);
    }
    return ents;
  }
}

// Cliffs round the square: a tumbled rim of boulders.
function rimRocks(h) {
  const props = [];
  for (let i = -10; i <= 10; i++) {
    const a = (i / 10) * (h + 0.4);
    for (const [nx, ny] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const out = h + 1.2 + rand(-0.3, 0.6);
      const px = nx ? nx * out : a + rand(-0.4, 0.4);
      const py = ny ? ny * out : a + rand(-0.4, 0.4);
      props.push({ t: 'rock', x: px, y: py, s: rand(0.9, 1.6) });
      if (Math.random() < 0.6) props.push({ t: 'rock', x: px + nx * rand(1.4, 2.4), y: py + ny * rand(1.4, 2.4), s: rand(1.1, 1.9) });
    }
  }
  return props;
}

export const CLEANUP = { H, START_R, DEATH_R, DISPEL_R, DISPEL_RANGE, CAST_POINT, HP, REGEN };
