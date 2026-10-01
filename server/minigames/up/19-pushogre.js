import { Minigame } from '../../base.js';
import { newId, rand, dist, clamp, round2, wc3, wrapAngle } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';
import { pushOutRect, box, arrive, withoutGone, raceLabel } from './race-kit.js';

// Uther Party 4.0 #19 "Push the Ogre" (docs/uther-party/rules-4.0.md): a flat
// 1536x1536 field with eight 192x192 goals on an octagon 689 u out, one
// Circle of Power per playing slot. In the middle wanders a fat, invulnerable,
// unarmed ogre (speed 75, collision 48). Knights (350 u/s, collision 32, 835
// HP) can only move it by walking into it. Get it into your own goal: the
// owner of the goal it enters scores, whoever pushed. Every U(6,8) s the ogre
// retches (a 1 s telegraph) and then a plague cloud sits 64 u behind it for
// 1.5 s: 75 damage every 0.05 s to every knight within 192 u, which kills in
// 0.6 s, and it fells the tree tiles too. A dead knight's goal is gone.
// Race: 8, 7, 6 ..., 90 s.
//
// Coordinates: arena-centre offsets (dx, dy) map to (wc3(dx), -wc3(dy)).

const Q = (dx, dy) => [wc3(dx), -wc3(dy)];
const HW = wc3(768);
export const KNIGHT = { speed: wc3(350), r: wc3(32), hp: 835 };
export const OGRE = { speed: wc3(75), r: wc3(48) };
export const GOAL_HALF = wc3(96);
export const GAS = { telegraph: 1, dur: 1.5, tick: 0.05, dmg: 75, r: wc3(192), behind: wc3(64), wait: [6, 8] };
// The share of a knight's overlap the ogre gives way by when a knight walks
// into it (the rest holds the knight back). Not in the data; tuned so a knight
// leaning on it moves it at roughly a third of a knight's pace.
const YIELD = 0.35;

// Goal centres by slot 1-8.
export const GOALS = [
  [-256, 640],
  [640, 256],
  [256, -640],
  [-640, -256],
  [256, 640],
  [640, -256],
  [-256, -640],
  [-640, 256],
].map(([x, y]) => Q(x, y));

const CORNERS = [
  [-768, -768],
  [640, -768],
  [-768, 640],
  [640, 640],
].map(([x, y]) => box(...Q(x, y), ...Q(x + 128, y + 128)));

export class PushTheOgre extends Minigame {
  static id = 'pushogre';
  static name = 'Push the Ogre';
  static desc = 'Get the ogre to your circle! The fat ogre only moves when someone walks into him. Shove him into your own circle, but watch out: every few seconds he retches and a deadly plague cloud billows out behind him, right where the pushers stand.';
  static controls = 'Right-click to move: walk into the ogre to push him. When the "!" appears over him, get away from his back end.';
  static duration = 90;
  static ranking = 'race';

  setup() {
    this.goals = this.pids.map((pid, i) => ({ id: newId(), pid, x: GOALS[i % 8][0], y: GOALS[i % 8][1], on: true }));
    this.trees = [
      [-512, -512],
      [512, -512],
      [-512, 512],
      [512, 512],
    ].map(([x, y]) => {
      const [cx, cy] = Q(x, y);
      return { id: newId(), x: cx, y: cy, alive: true, b: box(cx - wc3(64), cy - wc3(64), cx + wc3(64), cy + wc3(64)) };
    });
    this.map = {
      theme: 'grass',
      floor: { shape: 'rect', w: HW * 2, h: HW * 2 },
      props: treesAroundRect(HW, HW, 0.45, 2.2),
      build: ['pushogre'],
      po: { corners: CORNERS.map((b) => [b.x0, b.y0, b.x1, b.y1].map(round2)), half: round2(GOAL_HALF) },
      bounds: HW + 2,
    };
    // Knights appear 200 u from their own circle, toward the centre.
    this.spawnHeroes(
      this.goals.map((g) => {
        const d = Math.hypot(g.x, g.y);
        return [g.x - (g.x / d) * wc3(200), g.y - (g.y / d) * wc3(200)];
      }),
      KNIGHT,
    );
    for (const u of this.heroes.values()) u.skin = 'knight';
    this.ogre = { id: newId(), x: 0, y: 0, r: OGRE.r, f: rand(-Math.PI, Math.PI), heading: 0, tgt: null, rest: rand(1, 3), moving: false };
    this.ogre.heading = this.ogre.f;
    this.gas = { phase: 'wait', t: rand(...GAS.wait), x: 0, y: 0, tick: 0 };
    this.cloudId = newId();
  }

  tick(dt) {
    this.stepGas(dt);
    this.stepOgre(dt);
    this.stepHeroes(dt);
    this.bodyPush();
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.finished) continue;
      this.keepIn(u);
    }
    this.keepIn(this.ogre);
    // Push Finish: the ogre enters a goal whose owner is still in the race.
    const o = this.ogre;
    for (const g of this.goals) {
      const inside = Math.abs(o.x - g.x) <= GOAL_HALF && Math.abs(o.y - g.y) <= GOAL_HALF;
      if (inside && !g.inside && g.on) {
        const u = this.heroes.get(g.pid);
        if (u?.alive && !u.finished) {
          g.on = false;
          g.scored = true;
          arrive(this, g.pid);
          this.ev({ k: 'txt', x: round2(g.x), y: round2(g.y), s: 'GOAL!', c: '#ffd700' });
        }
      }
      g.inside = inside;
    }
  }

  keepIn(u) {
    u.x = clamp(u.x, -HW + u.r, HW - u.r);
    u.y = clamp(u.y, -HW + u.r, HW - u.r);
    for (const b of CORNERS) pushOutRect(u, b);
    for (const t of this.trees) if (t.alive) pushOutRect(u, t.b);
  }

  // Wander (Awan): now and then the ogre ambles to a nearby point. Pushing
  // doesn't turn him; only his own walking does, so his back is where his
  // last stroll came from.
  stepOgre(dt) {
    const o = this.ogre;
    if (!o.tgt) {
      o.rest -= dt;
      if (o.rest <= 0) {
        const a = rand(-Math.PI, Math.PI);
        const r = wc3(rand(100, 300));
        o.tgt = { x: clamp(o.x + Math.cos(a) * r, -HW + 2, HW - 2), y: clamp(o.y + Math.sin(a) * r, -HW + 2, HW - 2) };
      }
      o.moving = false;
      return;
    }
    const want = Math.atan2(o.tgt.y - o.y, o.tgt.x - o.x);
    const diff = wrapAngle(want - o.f);
    o.f = wrapAngle(o.f + clamp(diff, -dt * 6, dt * 6));
    const d = dist(o.x, o.y, o.tgt.x, o.tgt.y);
    o.moving = Math.abs(diff) < 1;
    if (o.moving) {
      const step = Math.min(d, OGRE.speed * dt);
      o.x += Math.cos(o.f) * step;
      o.y += Math.sin(o.f) * step;
    }
    if (d < 0.2) {
      o.tgt = null;
      o.rest = rand(2, 5);
    }
  }

  // Unit collision between the knights and the ogre. A knight walking into
  // him shoves him along; an idle knight in his way just blocks.
  bodyPush() {
    const o = this.ogre;
    for (const u of this.heroes.values()) {
      if (!u.alive || !u.solid) continue;
      const full = u.r + OGRE.r;
      const dx = o.x - u.x;
      const dy = o.y - u.y;
      const d = Math.hypot(dx, dy);
      if (d >= full) continue;
      const nx = d > 1e-6 ? dx / d : 1;
      const ny = d > 1e-6 ? dy / d : 0;
      const over = full - d;
      const k = u.walking ? YIELD : 0.5;
      o.x += nx * over * k;
      o.y += ny * over * k;
      u.x -= nx * over * (1 - k);
      u.y -= ny * over * (1 - k);
      if (u.walking && o.tgt) {
        // Being shoved interrupts his stroll.
        o.tgt = null;
        o.rest = rand(1, 3);
      }
    }
  }

  stepGas(dt) {
    const g = this.gas;
    g.t -= dt;
    if (g.phase === 'wait' && g.t <= 0) {
      g.phase = 'warn';
      g.t = GAS.telegraph;
      this.ev({ k: 'ogrewarn', u: this.ogre.id, x: round2(this.ogre.x), y: round2(this.ogre.y) });
      // Computer knights run 300-400 u in a random direction. The original
      // doesn't care which (a known bug: they often run into the cloud); ours
      // re-roll, the more skilled the more often, a run that ends in it.
      const o = this.ogre;
      const cx = o.x - Math.cos(o.f) * GAS.behind;
      const cy = o.y - Math.sin(o.f) * GAS.behind;
      for (const [pid, b] of this.bots) {
        const u = this.heroes.get(pid);
        if (!u.alive || u.finished) continue;
        let x;
        let y;
        for (let i = 0; i < 8; i++) {
          const a = rand(-Math.PI, Math.PI);
          const r = wc3(rand(300, 400));
          x = clamp(u.x + Math.cos(a) * r, -HW + 1, HW - 1);
          y = clamp(u.y + Math.sin(a) * r, -HW + 1, HW - 1);
          if (dist(x, y, cx, cy) > GAS.r + 1 || Math.random() > 0.5 + b.mem.skill) break;
        }
        u.order(x, y);
      }
    } else if (g.phase === 'warn' && g.t <= 0) {
      // The cloud sits 64 u behind him (his facing + 180°) and stays put.
      const o = this.ogre;
      g.phase = 'gas';
      g.t = GAS.dur;
      g.x = o.x - Math.cos(o.f) * GAS.behind;
      g.y = o.y - Math.sin(o.f) * GAS.behind;
      g.tick = 0;
      this.ev({ k: 'ogregas', x: round2(g.x), y: round2(g.y), r: round2(GAS.r), d: GAS.dur });
      for (const t of this.trees) {
        if (t.alive && dist(t.x, t.y, g.x, g.y) <= GAS.r + wc3(64)) {
          t.alive = false;
          this.ev({ k: 'treefall', x: round2(t.x), y: round2(t.y) });
        }
      }
    } else if (g.phase === 'gas') {
      g.tick -= dt;
      while (g.tick <= 0 && g.t > 0) {
        g.tick += GAS.tick;
        for (const [pid, u] of this.heroes) {
          if (!u.alive || u.finished || dist(u.x, u.y, g.x, g.y) > GAS.r) continue;
          u.hp -= GAS.dmg;
          if (u.hp <= 0) {
            u.hp = 0;
            this.eliminate(pid, 'death');
            // Push Death: a dead knight's circle is removed.
            const goal = this.goals.find((q) => q.pid === pid);
            if (goal) goal.on = false;
          }
        }
      }
      if (g.t <= 0) {
        g.phase = 'wait';
        g.t = rand(...GAS.wait);
      }
    }
  }

  // Push AI. The original orders each computer knight, every 3 s from t=3
  // and not during a gas sequence, to a point 64 u past the ogre on the side
  // away from its own circle, where it leans on him and WC3's pathing shoves
  // him along. Ours does the same thing continuously: get round behind him
  // (flanking if it would push the wrong way), then walk through him toward
  // the goal.
  botThink(pid, u, mem) {
    if (this.gas.phase !== 'wait' || this.time < 3) return;
    if (Math.random() > 0.35 + mem.skill) return;
    const o = this.ogre;
    const g = this.goals.find((q) => q.pid === pid);
    const gl = dist(o.x, o.y, g.x, g.y) || 1;
    // A bot whose goal is far down the list of live goals nearest the ogre
    // often hangs back rather than joining a hopeless tug of war.
    const rank = this.goals.filter((q) => q.on && q !== g && dist(o.x, o.y, q.x, q.y) < gl).length;
    if (rank >= 2 && Math.random() < 0.6) {
      if (u.target && dist(u.x, u.y, o.x, o.y) < KNIGHT.r + OGRE.r + 0.6) u.stop();
      return;
    }
    const ux = (g.x - o.x) / gl;
    const uy = (g.y - o.y) / gl;
    const rx = u.x - o.x;
    const ry = u.y - o.y;
    const rl = Math.hypot(rx, ry) || 1;
    const along = (rx * ux + ry * uy) / rl;
    const reach = KNIGHT.r + OGRE.r;
    let tx;
    let ty;
    if (along < -0.85 && rl < reach + 0.6) {
      tx = o.x + ux * 2.5;
      ty = o.y + uy * 2.5;
    } else if (along < -0.3) {
      tx = o.x - ux * (reach + 0.1);
      ty = o.y - uy * (reach + 0.1);
    } else {
      const side = rx * -uy + ry * ux >= 0 ? 1 : -1;
      tx = o.x - uy * side * (reach + 0.9) - ux * 0.6;
      ty = o.y + ux * side * (reach + 0.9) - uy * 0.6;
    }
    if (u.target) u.steer(tx, ty);
    else u.order(tx, ty);
  }

  progress(pid) {
    const g = this.goals.find((q) => q.pid === pid);
    return -dist(this.ogre.x, this.ogre.y, g.x, g.y);
  }

  heroEnts(pid) {
    return withoutGone(this, super.heroEnts(pid));
  }

  worldEnts() {
    const o = this.ogre;
    const ents = [{ id: o.id, k: 'ogre', x: round2(o.x), y: round2(o.y), f: round2(o.f), mv: o.moving ? 1 : undefined, w: this.gas.phase === 'warn' ? 1 : undefined }];
    for (const g of this.goals) ents.push({ id: g.id, k: 'cop', x: round2(g.x), y: round2(g.y), o: g.pid, s: g.on ? 1 : g.scored ? 2 : 0, r: 1.5 });
    for (const t of this.trees) if (t.alive) ents.push({ id: t.id, k: 'pushtree', x: round2(t.x), y: round2(t.y) });
    if (this.gas.phase === 'gas') ents.push({ id: this.cloudId, k: 'plaguecloud', x: round2(this.gas.x), y: round2(this.gas.y), r: round2(GAS.r), t: round2(this.gas.t) });
    return ents;
  }

  hud(pid) {
    return { label: raceLabel(this, pid) };
  }
}
