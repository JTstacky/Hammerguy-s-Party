import { Minigame } from '../../base.js';
import { Unit, newId, rand, dist, round2, wc3, stepUnits, collideUnits } from '../../../engine/server/sim.js';
import { clampOct, inOct, pushOutSquare, stepMelee, hitEvent } from './creeps-and-walls.js';

// Uther Party 4.0 #15 "Treant Valley" (docs/uther-party/rules-4.0.md): an
// octagonal 1152x1152 clearing with exactly 12 trees in a 2-4-4-2 grid.
// Players are unarmed 25 HP gnolls (speed 270). From t=7, every 10 s while
// there are fewer than 12 treants, a random living tree glows green for 2 s
// and then turns into a treant (speed 220, 15-17 damage, cooldown 1.75,
// range 100, acquisition 200). Every 2.5 s all treants are sent to
// attack-move to a random point in the valley, chasing any gnoll that comes
// within 200. Two hits kill. Last one standing wins; no ties, no timer.
const A = wc3(576);
const D = wc3(896); // the cut corners step along |x| + |y| = 896
const TREES = [
  [-128, 384], [128, 384],
  [-384, 128], [-128, 128], [128, 128], [384, 128],
  [-384, -128], [-128, -128], [128, -128], [384, -128],
  [-128, -384], [128, -384],
].map(([x, y]) => [wc3(x), wc3(y)]);
const TREE_H = wc3(64); // a tree wall blocks its 128x128 tile
const TREANT = { speed: wc3(220), r: wc3(32), hp: 300, range: wc3(100), cd: 1.75, point: 0.5, acquire: wc3(200) };
const GLOW = 2;
const MAX_TREANTS = 12;
const START = 7;

export class TreantValley extends Minigame {
  static id = 'treant';
  static name = 'Treant Valley';
  static desc = 'The trees of the valley wake up one by one: a tree glows green, then a treant steps out and starts to roam. Two hits and you are out, but you are faster than they are. Survive as long as possible!';
  static controls = 'Right-click to move. You are a 25 HP gnoll (speed 270); treants walk at 220 and hit for 15-17.';
  static duration = 300;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'grass', floor: { shape: 'disc', r: wc3(640) }, props: valleyEdge(), bounds: A + 1, valley: { a: round2(A), d: round2(D) } };
    // Gnolls: 25 HP, speed 270, collision 31, 100-400 u from the centre, random facing.
    this.spawnHeroes(
      this.pids.map(() => {
        for (;;) {
          const a = rand(0, Math.PI * 2);
          const r = wc3(rand(100, 400));
          const [x, y] = [Math.cos(a) * r, Math.sin(a) * r];
          if (!TREES.some(([tx, ty]) => Math.abs(x - tx) < TREE_H + wc3(31) && Math.abs(y - ty) < TREE_H + wc3(31))) return [x, y];
        }
      }),
      { hp: 25 },
    );
    for (const u of this.heroes.values()) u.skin = 'gnoll';
    for (const u of this.heroes.values()) u.setFacing(rand(-Math.PI, Math.PI));
    this.trees = TREES.map(([x, y]) => ({ id: newId(), x, y, alive: true, glow: -1 }));
    this.treants = [];
    this.spawnT = rand(0, 10); // counted from t=7
    this.patrolT = rand(0, 2.5);
  }

  tick(dt) {
    if (this.time >= START) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT += 10;
        const growing = this.trees.filter((t) => t.glow >= 0).length;
        const living = this.trees.filter((t) => t.alive && t.glow < 0);
        if (this.treants.length + growing < MAX_TREANTS && living.length) {
          const t = living[Math.floor(Math.random() * living.length)];
          t.glow = 0;
          this.ev({ k: 'treeglow', x: round2(t.x), y: round2(t.y) });
        }
      }
      this.patrolT -= dt;
      if (this.patrolT <= 0) {
        this.patrolT += 2.5;
        for (const c of this.treants) {
          c.victim = null;
          c.dest = this.randomPoint();
          if (!c.swing) c.order(c.dest.x, c.dest.y);
        }
      }
    }
    for (const t of this.trees) {
      if (t.glow < 0) continue;
      t.glow += dt;
      if (t.glow >= GLOW) {
        t.glow = -1;
        t.alive = false;
        this.spawnTreant(t);
      }
    }
    for (const c of this.treants) this.stepTreant(c, dt);

    this.stepHeroes(dt);
    stepUnits(this.treants, dt);
    const all = [...this.heroes.values(), ...this.treants];
    collideUnits(all);
    for (const u of all) {
      if (!u.alive) continue;
      for (const t of this.trees) if (t.alive) pushOutSquare(u, t.x, t.y, TREE_H);
      clampOct(u, A, D);
    }
  }

  randomPoint() {
    for (;;) {
      const x = rand(-A, A);
      const y = rand(-A, A);
      if (inOct(x, y, A, D, 0.5)) return { x, y };
    }
  }

  spawnTreant(t) {
    const c = new Unit({ kind: 'vtreant', x: t.x, y: t.y, r: TREANT.r, speed: TREANT.speed, hp: TREANT.hp });
    c.turnRate = 0.5;
    c.setFacing(rand(-Math.PI, Math.PI));
    c.atk = { range: TREANT.range, cd: TREANT.cd, point: TREANT.point };
    c.atkT = 0;
    c.victim = null;
    c.dest = null;
    this.treants.push(c);
    this.ev({ k: 'treantrise', x: round2(t.x), y: round2(t.y), tree: t.id });
  }

  // Attack-move: walk to the patrol point, but take on any gnoll within 200.
  stepTreant(c, dt) {
    if (!c.victim && !c.swing) {
      let best = null;
      let bd = TREANT.acquire;
      for (const u of this.heroes.values()) {
        if (!u.alive) continue;
        const d = dist(c.x, c.y, u.x, u.y);
        if (d <= bd) {
          bd = d;
          best = u;
        }
      }
      if (best) c.victim = best;
    }
    if (c.victim && !c.victim.alive) {
      c.victim = null;
      if (c.dest) c.order(c.dest.x, c.dest.y);
    }
    if (c.victim || c.swing) stepMelee(c, dt, (cc, v) => this.treantHit(v), (cc) => this.ev({ k: 'swing', u: cc.id }));
    else if (c.atkT > 0) c.atkT -= dt;
  }

  treantHit(v) {
    hitEvent(this, v);
    // 14 + 1d3 normal damage.
    this.damage(v.owner, 14 + 1 + Math.floor(Math.random() * 3), 'death');
  }

  // The original's bots walk 200-500 u outward (±120°) every 2 s. Better bots
  // also keep their distance from treants and glowing trees.
  botThink(pid, u, mem) {
    mem.wander = (mem.wander ?? rand(0, 2)) - 0.22;
    const near = this.dangerAt(u.x, u.y);
    if (near > 0.2 && Math.random() < mem.skill) {
      let best = null;
      let bs = near;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        for (const r of [1.5, 3, 4.5]) {
          const x = u.x + Math.cos(a) * r;
          const y = u.y + Math.sin(a) * r;
          if (!inOct(x, y, A, D, 0.8) || this.blocked(x, y)) continue;
          const s = this.dangerAt(x, y) + r * 0.02;
          if (s < bs) {
            bs = s;
            best = [x, y];
          }
        }
      }
      if (best) {
        u.order(best[0], best[1]);
        mem.wander = 1;
        return;
      }
    }
    if (mem.wander <= 0) {
      mem.wander = 2;
      const a = Math.atan2(u.y, u.x) + (rand(-120, 120) * Math.PI) / 180;
      const r = wc3(rand(200, 500));
      const x = u.x + Math.cos(a) * r;
      const y = u.y + Math.sin(a) * r;
      if (Math.random() > mem.skill || (inOct(x, y, A, D, 0.8) && this.dangerAt(x, y) < 0.2)) u.order(x, y);
    }
  }

  blocked(x, y) {
    return this.trees.some((t) => t.alive && Math.abs(x - t.x) < TREE_H + 0.6 && Math.abs(y - t.y) < TREE_H + 0.6);
  }

  dangerAt(x, y) {
    let s = 0;
    for (const c of this.treants) {
      const d = dist(x, y, c.x, c.y);
      if (d < 7) s += (7 - d) / 7;
    }
    for (const t of this.trees) if (t.glow >= 0 && dist(x, y, t.x, t.y) < 4) s += 0.5;
    return s;
  }

  hud() {
    return { label: `Treants: ${this.treants.length} / ${MAX_TREANTS}` };
  }

  worldEnts() {
    const ents = [];
    for (const t of this.trees) if (t.alive) ents.push({ id: t.id, k: 'vtree', x: round2(t.x), y: round2(t.y), g: t.glow >= 0 ? round2(t.glow / GLOW) : undefined });
    for (const c of this.treants) {
      const e = { id: c.id, k: 'vtreant', x: round2(c.x), y: round2(c.y), f: round2(c.facing) };
      if (c.mx || c.my) e.mv = 1;
      ents.push(e);
    }
    return ents;
  }
}

// Forest round the clearing, following its octagon.
function valleyEdge() {
  const props = [];
  for (let x = -A - 8; x <= A + 8; x += 2.6) {
    for (let y = -A - 8; y <= A + 8; y += 2.6) {
      const px = x + rand(-0.7, 0.7);
      const py = y + rand(-0.7, 0.7);
      if (inOct(px, py, A + 1.4, D + 1.4)) continue;
      if (inOct(px, py, A + 6, D + 6) && Math.random() < 0.85) props.push({ t: 'tree', x: px, y: py, s: rand(0.85, 1.4) });
    }
  }
  // A few bushes and rocks along the foot of the treeline.
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2);
    let r = A;
    while (inOct(Math.cos(a) * r, Math.sin(a) * r, A + 0.5, D + 0.5)) r += 0.2;
    props.push({ t: Math.random() < 0.7 ? 'bush' : 'rock', x: Math.cos(a) * (r + 0.3), y: Math.sin(a) * (r + 0.3), s: rand(0.45, 0.8) });
  }
  return props;
}

export const TREANT_VALLEY = { A, D, TREES, TREE_H, TREANT, GLOW, MAX_TREANTS, START };
