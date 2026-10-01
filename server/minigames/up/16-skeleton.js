import { Minigame } from '../../base.js';
import { Unit, newId, rand, dist, round2, wc3, stepUnits, collideUnits, clamp } from '../../../engine/server/sim.js';
import { pushOutSquare, stepMelee, hitEvent } from './creeps-and-walls.js';

// Uther Party 4.0 #16 "The Skeleton Sonata" (docs/uther-party/rules-4.0.md):
// a small 768x768 square (plus one walkable tile ring round it, corners cut)
// at midnight, blighted. Players are priests: 290 HP, speed 270, collision 16,
// mana 200 of 400 at the start, +4/s, and one spell, Dispel Magic (75 mana,
// cooldown 8 s, range 500, area 200), which destroys every skeleton in the
// area (200 damage to summoned units; skeletons have 180) including the ones
// chasing rivals. From t=6, every 2.5 s one of the four ghoul corpses raises
// 3 skeleton warriors (180 HP, speed 270, 14-15 damage every 2 s, range 90)
// and is struck away by lightning; 0.5 s later a new corpse lies at a random
// spot. Skeletons hunt the nearest priest within 1000. The swarm grows with
// no cap. Last one standing wins; no ties, no timer.
const HALF = wc3(384); // the arena the camera shows
const WALK = wc3(512); // one more walkable tile all round
const CORNER = wc3(448); // the ring's corner tiles are cliffs
const TILE_H = wc3(64);
const DISPEL = { cost: 75, cd: 8, range: wc3(500), r: wc3(200), castPoint: 0.5, dmg: 200 };
const MANA = { max: 400, start: 200, regen: 4 };
const SKEL = { hp: 180, speed: wc3(270), r: wc3(16), range: wc3(90), cd: 2.0, point: 0.5, acquire: wc3(1000) };
const START = 6;
const PERIOD = 2.5;

export class SkeletonSonata extends Minigame {
  static id = 'skeleton';
  static name = 'The Skeleton Sonata';
  static desc = 'Skeletons claw their way out of ghoul corpses, three at a time, and never stop coming. Your Dispel Magic turns every skeleton near the spot to dust, including the ones after your rivals. Survive as long as possible!';
  static controls = 'Right-click to move. Q, then click: Dispel Magic (75 mana, 8 s cooldown) destroys all skeletons within 200.';
  static duration = 300;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'sonata', floor: { shape: 'rect', w: WALK * 2, h: WALK * 2 }, props: graveyardEdge(), build: ['sonata'], bounds: HALF + 1, sonata: { walk: round2(WALK), corner: round2(CORNER), tile: round2(TILE_H) } };
    this.abilities = [
      {
        name: 'Dispel Magic',
        icon: '✨',
        desc: 'Destroys every skeleton within 200 of the target point (theirs too). 75 mana.',
        kind: 'point',
        cd: DISPEL.cd,
        range: DISPEL.range,
        castPoint: DISPEL.castPoint,
        available: (pid) => (this.mana.get(pid) ?? 0) >= DISPEL.cost,
        cast: (pid, u, tgt) => this.dispel(pid, u, tgt.x, tgt.y),
      },
    ];
    // Priests: 290 HP, speed 270, collision 16, 100-300 u from the centre.
    this.spawnHeroes(
      this.pids.map(() => {
        const a = rand(0, Math.PI * 2);
        const r = wc3(rand(100, 300));
        return [Math.cos(a) * r, Math.sin(a) * r];
      }),
      { hp: 290, r: wc3(16) },
    );
    for (const u of this.heroes.values()) u.skin = 'humanpriest';
    this.mana = new Map(this.pids.map((p) => [p, MANA.start]));
    this.skels = [];
    this.corpses = [];
    for (let i = 0; i < 4; i++) this.addCorpse();
    this.pendingCorpses = [];
    this.walkCast = new Map(); // pid -> {x, y}: walking into range to cast, as WC3 does
    this.spawnT = rand(0, PERIOD); // counted from t=6
  }

  // A Dispel ordered out of range walks into range first, then casts.
  useAbility(pid, slot, x, y) {
    const u = this.heroes.get(pid);
    if (!u?.alive || u.cast || !this.abilities[slot]) return;
    if ((this.acd.get(pid)?.[slot] || 0) > 0 || !this.abilities[slot].available(pid)) return;
    if (dist(u.x, u.y, x, y) > DISPEL.range) {
      this.walkCast.set(pid, { x, y });
      u.order(x, y);
      return;
    }
    this.walkCast.delete(pid);
    super.useAbility(pid, slot, x, y);
  }

  command(pid, m) {
    if (m.c === 'move' || m.c === 'steer' || m.c === 'stop') this.walkCast.delete(pid);
    super.command(pid, m);
  }

  addCorpse() {
    this.corpses.push({ id: newId(), x: rand(-HALF, HALF), y: rand(-HALF, HALF), f: rand(-Math.PI, Math.PI) });
  }

  tick(dt) {
    for (const [pid, m] of this.mana) if (this.heroes.get(pid).alive) this.mana.set(pid, Math.min(MANA.max, m + MANA.regen * dt));
    if (this.time >= START) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT += PERIOD;
        if (this.corpses.length) {
          const i = Math.floor(Math.random() * this.corpses.length);
          const c = this.corpses[i];
          this.corpses.splice(i, 1);
          for (let k = 0; k < 3; k++) this.spawnSkel(c.x + rand(-0.3, 0.3), c.y + rand(-0.3, 0.3));
          this.ev({ k: 'sonataraise', x: round2(c.x), y: round2(c.y) });
          this.pendingCorpses.push(0.5);
        }
      }
    }
    this.pendingCorpses = this.pendingCorpses.map((t) => t - dt);
    while (this.pendingCorpses.length && this.pendingCorpses[0] <= 0) {
      this.pendingCorpses.shift();
      this.addCorpse();
    }

    for (const s of this.skels) this.stepSkel(s, dt);
    for (const [pid, w] of this.walkCast) {
      const u = this.heroes.get(pid);
      if (!u.alive) this.walkCast.delete(pid);
      else if (dist(u.x, u.y, w.x, w.y) <= DISPEL.range) {
        this.walkCast.delete(pid);
        super.useAbility(pid, 0, w.x, w.y);
      } else if (u.target) u.steer(w.x, w.y);
      else u.order(w.x, w.y);
    }
    this.stepHeroes(dt);
    stepUnits(this.skels, dt);
    const all = [...this.heroes.values(), ...this.skels];
    collideUnits(all);
    for (const u of all) if (u.alive) this.keepIn(u);
    this.skels = this.skels.filter((s) => s.alive);
  }

  keepIn(u) {
    u.x = clamp(u.x, -WALK + u.r, WALK - u.r);
    u.y = clamp(u.y, -WALK + u.r, WALK - u.r);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) pushOutSquare(u, sx * CORNER, sy * CORNER, TILE_H);
  }

  spawnSkel(x, y) {
    const s = new Unit({ kind: 'sonataskel', x, y, r: SKEL.r, speed: SKEL.speed, hp: SKEL.hp });
    s.setFacing(rand(-Math.PI, Math.PI));
    s.atk = { range: SKEL.range, cd: SKEL.cd, point: SKEL.point };
    s.atkT = 0;
    s.victim = null;
    s.retarget = rand(0.5, 1.5);
    this.skels.push(s);
  }

  // Skeletons hunt the nearest priest (acquisition 1000, set on every spawn).
  stepSkel(s, dt) {
    s.retarget -= dt;
    if (!s.swing && (!s.victim?.alive || s.retarget <= 0)) {
      s.retarget = rand(1, 2);
      let best = null;
      let bd = SKEL.acquire;
      for (const u of this.heroes.values()) {
        if (!u.alive) continue;
        const d = dist(s.x, s.y, u.x, u.y);
        if (d <= bd) {
          bd = d;
          best = u;
        }
      }
      // Creeps stick to the unit they are hitting.
      if (!s.victim?.alive || (best && best !== s.victim && dist(s.x, s.y, s.victim.x, s.victim.y) - s.r - s.victim.r > SKEL.range)) s.victim = best;
      if (!s.victim) s.stop();
    }
    stepMelee(s, dt, (c, v) => {
      hitEvent(this, v);
      this.damage(v.owner, 13 + 1 + Math.floor(Math.random() * 2), 'death');
    }, (c) => this.ev({ k: 'swing', u: c.id }));
  }

  dispel(pid, u, x, y) {
    this.mana.set(pid, this.mana.get(pid) - DISPEL.cost);
    let n = 0;
    for (const s of this.skels) {
      if (!s.alive || dist(s.x, s.y, x, y) > DISPEL.r + s.r) continue;
      s.hp -= DISPEL.dmg;
      if (s.hp <= 0) {
        s.alive = false;
        n++;
      }
    }
    this.ev({ k: 'sdispel', x: round2(x), y: round2(y), r: round2(DISPEL.r), px: round2(u.x), py: round2(u.y), n });
  }

  // The original's bots: every 2 s walk to a random point, then 1 s later
  // Dispel a random skeleton within 400. Better bots walk to the emptiest
  // spot they can see and aim at the thickest knot of skeletons near them.
  botThink(pid, u, mem) {
    mem.walk = (mem.walk ?? rand(0, 2)) - 0.22;
    if (mem.walk <= 0) {
      mem.walk = 2;
      mem.castIn = 1;
      let best = [rand(-HALF, HALF), rand(-HALF, HALF)];
      if (Math.random() < mem.skill) {
        let bs = Infinity;
        for (let i = 0; i < 12; i++) {
          const p = [clamp(u.x + rand(-5, 5), -HALF, HALF), clamp(u.y + rand(-5, 5), -HALF, HALF)];
          const s = this.crowd(p[0], p[1], 4) + this.crowd((u.x + p[0]) / 2, (u.y + p[1]) / 2, 2.5) * 0.5;
          if (s < bs) {
            bs = s;
            best = p;
          }
        }
      }
      u.order(best[0], best[1]);
    }
    if (mem.castIn != null) {
      mem.castIn -= 0.22;
      if (mem.castIn > 0) return;
      mem.castIn = null;
      const near = this.skels.filter((s) => s.alive && dist(u.x, u.y, s.x, s.y) <= wc3(400));
      if (!near.length) return;
      let tgt = near[Math.floor(Math.random() * near.length)];
      if (Math.random() < mem.skill) {
        let bn = 0;
        for (const s of near) {
          const n = this.crowd(s.x, s.y, DISPEL.r);
          if (n > bn) {
            bn = n;
            tgt = s;
          }
        }
        // Keep the spell for a real crowd, unless they are already on us.
        if (bn < 3 && this.crowd(u.x, u.y, 2) < 2) return;
      }
      this.useAbility(pid, 0, tgt.x, tgt.y);
    }
  }

  crowd(x, y, r) {
    let n = 0;
    for (const s of this.skels) if (s.alive && dist(x, y, s.x, s.y) <= r) n++;
    return n;
  }

  hud(pid) {
    const m = this.mana.get(pid);
    return { label: `Mana ${Math.floor(m ?? 0)} / ${MANA.max} · Skeletons: ${this.skels.length}` };
  }

  worldEnts() {
    const ents = this.corpses.map((c) => ({ id: c.id, k: 'gcorpse', x: round2(c.x), y: round2(c.y), f: round2(c.f) }));
    for (const s of this.skels) {
      const e = { id: s.id, k: 'sonataskel', x: round2(s.x), y: round2(s.y), f: round2(s.facing) };
      if (s.mx || s.my) e.mv = 1;
      ents.push(e);
    }
    return ents;
  }
}

// Boulders round the little square (the map builder adds dead trees and headstones).
function graveyardEdge() {
  const props = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 + rand(-0.05, 0.05);
    const r = WALK * 1.25 + rand(1, 5);
    if (Math.random() < 0.45) props.push({ t: 'rock', x: Math.cos(a) * r, y: Math.sin(a) * r, s: rand(0.6, 1.2) });
  }
  return props;
}

export const SONATA = { HALF, WALK, CORNER, DISPEL, MANA, SKEL, START, PERIOD };
