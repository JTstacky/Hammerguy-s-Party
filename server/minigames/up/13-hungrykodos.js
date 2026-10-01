import { Minigame } from '../../base.js';
import { rand, dist, round2, wc3, newId, Unit, stepUnits, collideUnits } from '../../../engine/server/sim.js';
import { TileGrid, followGrid } from './lib-f-grid.js';

// Uther Party 4.0 #13 "Hungry Hungry Kodos" (docs/uther-party/rules-4.0.md).
//  - A walled 1024x1024 square with a block in each inner corner and a
//    2-tile gate in the middle of each side, with a small pen behind it. At
//    6 s every gate opens.
//  - Kodos: 1000 HP draining at 15/s (starved in 66.7 s), speed 220,
//    collision 48, no attack, 0 of 200 mana. Right-clicking a pig or child
//    devours it (range 100, one at a time): digestion does 5 damage/s, so a
//    10 HP pig takes 2 s. A pig is +50 HP (capped at 1000), a child +100 mana.
//  - Q Regurgitate: 100 mana, cooldown 8, range 800: a bolt at a rival kodo
//    for 100 damage and a 2 s stun.
//  - Spawn Base runs at 6 s and then every 10 s: for each player still alive,
//    a 50 % roll for a pig at a random point of a random gate strip, sent to
//    a random point of the arena (none while 10 or more pigs live). A failed
//    roll re-orders the last unit created, as the original's
//    GetLastCreatedUnit bug does (on the first run that is a kodo). From the
//    second run a child is added whenever fewer than 2 exist.
//  - Survival with ties: kodos starving in the same instant share a place.
export const T = wc3(128);
export const ARENA = [
  '#####gg#####',
  '#####gg#####',
  '###......###',
  '##........##',
  '##........##',
  'gg........gg',
  'gg........gg',
  '##........##',
  '##........##',
  '###......###',
  '#####gg#####',
  '#####gg#####',
];
export const KODO = { hp: 1000, drain: 15, speed: wc3(220), r: wc3(48), maxMana: 200 };
export const DEVOUR = { range: wc3(100), dps: 5 };
export const FOOD = { hp: 10, speed: wc3(190), r: wc3(16), pigHeal: 50, childMana: 100, maxPigs: 10, maxChildren: 2 };
export const BOLT = { mana: 100, cd: 8, range: wc3(800), dmg: 100, stun: 2, speed: wc3(1000), castPoint: 0.3 };
export const GATES_OPEN = 6;
const HALF_IN = wc3(512);
// Spawn strips (256x64) just outside each side, in the gate openings.
const STRIPS = [
  [-wc3(128), wc3(128), -wc3(576), -wc3(512)],
  [-wc3(128), wc3(128), wc3(512), wc3(576)],
  [wc3(512), wc3(576), -wc3(128), wc3(128)],
  [-wc3(576), -wc3(512), -wc3(128), wc3(128)],
];

export class HungryKodos extends Minigame {
  static id = 'hungrykodo';
  static name = 'Hungry Hungry Kodos';
  static desc = 'Eat the pigs to survive the longest! Your kodo starves a little every second. Pigs come in through the gates: each one eaten is +50 HP. Children fill your mana for Regurgitate, a bolt that hurts and stuns a rival. Last kodo standing wins.';
  static controls = 'Right-click a pig or child (or Q, then click it) to eat it. W, then click a rival kodo: Regurgitate (100 mana) for 100 damage and a 2 s stun.';
  static duration = 300;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.grid = new TileGrid(ARENA, T, { solid: (ch) => ch === '#' || ch === 'g' });
    this.map = {
      theme: 'dirt',
      floor: { shape: 'rect', w: HALF_IN * 2, h: HALF_IN * 2 },
      props: [],
      bounds: 3,
      build: ['hungrykodo'],
      grid: ARENA,
      T: round2(T),
    };
    this.mana = new Map(this.pids.map((p) => [p, 0]));
    // No attacks; the flag makes touch taps on a unit arrive as 'attack' orders.
    this.attack = { range: 0, cd: 1e9 };
    this.abilities = [
      {
        name: 'Devour', icon: '🐷', desc: 'Eat a pig (+50 HP) or a child (+100 mana). Right-clicking one does the same. Digesting takes 2 s; one at a time.',
        kind: 'unit', cd: 0, range: wc3(3000), castPoint: 0,
        available: (pid) => !this.stomach.has(pid),
        pickTarget: (pid, u, x, y) => {
          const f = this.foodAt(x, y);
          return f ? { x: f.x, y: f.y, u: f } : null;
        },
        cast: (pid, u, tgt) => {
          this.devour.set(pid, tgt.u);
          u.order(tgt.u.x, tgt.u.y);
        },
      },
      {
        name: 'Regurgitate', icon: '🤮', desc: 'Spit a bolt at a rival kodo: 100 damage and a 2 s stun. 100 mana, range 800.',
        kind: 'unit', cd: BOLT.cd, range: BOLT.range, castPoint: BOLT.castPoint,
        available: (pid) => this.mana.get(pid) >= BOLT.mana,
        pickTarget: (pid, u, x, y) => this.pickKodo(pid, u, x, y),
        cast: (pid, u, tgt) => this.bolt(pid, u, tgt.u),
      },
    ];
    this.spawnHeroes(this.pids.map(() => {
      const a = rand(0, Math.PI * 2);
      return [Math.cos(a) * wc3(200), Math.sin(a) * wc3(200)];
    }), { hp: KODO.hp, speed: KODO.speed, r: KODO.r });
    for (const u of this.heroes.values()) u.skin = 'hkodo';
    this.food = []; // pigs and children
    this.bolts = [];
    this.stomach = new Map(); // pid -> { unit, left }
    this.devour = new Map(); // pid -> unit being chased
    this.pendingBolt = new Map(); // pid -> kodo to bolt once in range
    this.lastCreated = [...this.heroes.values()].pop();
    this.spawnRuns = 0;
    this.nextSpawn = GATES_OPEN;
    this.periodic = GATES_OPEN + rand(0, 10);
    this.gateId = newId();
    this.gatesOpen = false;
  }

  attackables() {
    return [];
  }

  pickKodo(pid, u, x, y) {
    let best = null;
    let bd = 2;
    for (const [op, v] of this.heroes) {
      if (op === pid || !v.alive) continue;
      const d = dist(x, y, v.x, v.y) - v.r;
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best ? { x: best.x, y: best.y, u: best } : null;
  }

  foodAt(x, y) {
    let best = null;
    let bd = 1.1;
    for (const f of this.food) {
      if (!f.alive || f.eaten) continue;
      const d = dist(x, y, f.x, f.y) - f.r;
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  // "Kodos Target": a right-click on food is a Devour order.
  command(pid, m) {
    const u = this.heroes.get(pid);
    if (!u?.alive || u.stun > 0) return;
    if (m.c === 'move' || m.c === 'steer' || m.c === 'stop') this.pendingBolt.delete(pid);
    // "Kodos Target": a right-click (or a touch tap, 'attack') on food is a
    // Devour order.
    if (m.c === 'move' || m.c === 'attack') {
      const f = this.foodAt(+m.x || 0, +m.y || 0);
      if (f) {
        this.devour.set(pid, f);
        if (!u.cast) u.order(f.x, f.y);
        return;
      }
      if (m.c === 'attack') return;
    }
    if (m.c === 'move' || m.c === 'stop') this.devour.delete(pid);
    if (m.c === 'cast' && (m.slot === 1 || m.spell === 's1')) {
      // Out of range: walk into range first, as a WC3 unit does.
      const tgt = this.pickKodo(pid, u, +m.x || 0, +m.y || 0);
      if (tgt && dist(u.x, u.y, tgt.x, tgt.y) > BOLT.range && this.abilities[1].available(pid) && !(this.acd.get(pid)[1] > 0)) {
        this.pendingBolt.set(pid, tgt.u);
        this.devour.delete(pid);
        u.order(tgt.x, tgt.y);
        return;
      }
    }
    super.command(pid, m);
  }

  bolt(pid, u, v) {
    if (!v?.alive || this.mana.get(pid) < BOLT.mana) return;
    this.mana.set(pid, this.mana.get(pid) - BOLT.mana);
    this.bolts.push({ id: newId(), x: u.x, y: u.y, tgt: v, pid });
    this.ev({ k: 'sfx', s: 'drain' });
  }

  spawnFood(kind) {
    const s = STRIPS[Math.floor(Math.random() * 4)];
    const f = new Unit({ kind, x: rand(s[0], s[1]), y: rand(s[2], s[3]), r: FOOD.r, speed: FOOD.speed, hp: FOOD.hp });
    f.setFacing(Math.atan2(-f.y, -f.x));
    f.idle = rand(0.5, 3);
    this.food.push(f);
    this.lastCreated = f;
    return f;
  }

  randomArenaPoint() {
    return [rand(-HALF_IN, HALF_IN) * 0.9, rand(-HALF_IN, HALF_IN) * 0.9];
  }

  spawnBase() {
    this.spawnRuns++;
    for (const pid of this.pids) {
      if (!this.heroes.get(pid).alive) continue;
      const pigs = this.food.filter((f) => f.kind === 'pig' && f.alive).length;
      if (pigs >= FOOD.maxPigs) continue;
      if (Math.random() < 0.5) {
        const p = this.spawnFood('pig');
        p.order(...this.randomArenaPoint());
      } else if (this.lastCreated?.alive) {
        this.lastCreated.order(...this.randomArenaPoint());
      }
    }
    if (this.spawnRuns > 1 && this.food.filter((f) => f.kind === 'child' && f.alive).length < FOOD.maxChildren) this.spawnFood('child');
  }

  tick(dt) {
    if (!this.gatesOpen && this.time >= GATES_OPEN) {
      this.gatesOpen = true;
      for (let r = 0; r < ARENA.length; r++) for (let c = 0; c < ARENA[r].length; c++) if (ARENA[r][c] === 'g') this.grid.open.add(c + ',' + r);
      this.ev({ k: 'sfx', s: 'shove' });
    }
    if (this.nextSpawn != null && this.time >= this.nextSpawn) {
      this.nextSpawn = null;
      this.spawnBase();
    }
    if (this.time >= this.periodic) {
      this.periodic += 10;
      this.spawnBase();
    }
    // Starvation.
    for (const [pid, u] of this.heroes) {
      if (!u.alive) continue;
      u.hp -= KODO.drain * dt;
      if (u.hp <= 0) {
        u.hp = 0;
        this.eliminate(pid, 'hkstarve');
      }
    }
    this.stepDevour(dt);
    this.stepFood(dt);
    for (const [pid, v] of this.pendingBolt) {
      const u = this.heroes.get(pid);
      if (!u.alive || !v.alive || u.stun > 0) {
        this.pendingBolt.delete(pid);
        continue;
      }
      if (dist(u.x, u.y, v.x, v.y) <= BOLT.range) {
        this.pendingBolt.delete(pid);
        u.stop();
        this.useAbility(pid, 1, v.x, v.y);
      } else u.steer(v.x, v.y);
    }
    for (const u of this.heroes.values()) followGrid(u, this.grid, dt);
    this.stepHeroes(dt);
    const all = [...this.heroes.values(), ...this.food.filter((f) => !f.eaten)];
    collideUnits(all);
    for (const u of all) if (u.alive) this.grid.collide(u);
    this.stepBolts(dt);
  }

  stepDevour(dt) {
    for (const [pid, f] of this.devour) {
      const u = this.heroes.get(pid);
      if (!u.alive || !f.alive || f.eaten || this.stomach.has(pid)) {
        this.devour.delete(pid);
        continue;
      }
      if (u.cast || u.stun > 0) continue;
      const gap = dist(u.x, u.y, f.x, f.y) - u.r - f.r;
      if (gap > DEVOUR.range) {
        u.steer(f.x, f.y);
        continue;
      }
      // Swallowed whole.
      this.devour.delete(pid);
      u.stop();
      f.eaten = true;
      f.stop();
      this.stomach.set(pid, { unit: f, left: f.hp });
      this.ev({ k: 'hkgulp', x: round2(f.x), y: round2(f.y), u: u.id });
    }
    for (const [pid, s] of this.stomach) {
      const u = this.heroes.get(pid);
      if (!u.alive) {
        this.stomach.delete(pid);
        s.unit.alive = false;
        continue;
      }
      s.left -= DEVOUR.dps * dt;
      s.unit.x = u.x;
      s.unit.y = u.y;
      if (s.left > 0) continue;
      this.stomach.delete(pid);
      s.unit.alive = false;
      if (s.unit.kind === 'pig') {
        u.hp = Math.min(KODO.hp, u.hp + FOOD.pigHeal);
        this.ev({ k: 'hkheal', x: round2(u.x), y: round2(u.y), s: `+${FOOD.pigHeal}` });
      } else {
        this.mana.set(pid, Math.min(KODO.maxMana, this.mana.get(pid) + FOOD.childMana));
        this.ev({ k: 'hkmana', x: round2(u.x), y: round2(u.y) });
      }
    }
  }

  stepFood(dt) {
    for (const f of this.food) {
      if (!f.alive || f.eaten || f.target) continue;
      f.idle -= dt;
      if (f.idle > 0) continue;
      f.idle = rand(1, 4);
      const a = rand(0, Math.PI * 2);
      const d = wc3(rand(100, 350));
      f.order(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d);
    }
    const live = this.food.filter((f) => f.alive && !f.eaten);
    for (const f of live) followGrid(f, this.grid, dt, false);
    stepUnits(live, dt);
    this.food = this.food.filter((f) => f.alive);
  }

  stepBolts(dt) {
    for (const b of this.bolts) {
      const t = b.tgt;
      const d = dist(b.x, b.y, t.x, t.y);
      const step = BOLT.speed * dt;
      if (d <= step || !t.alive) {
        b.done = true;
        if (!t.alive) continue;
        this.ev({ k: 'hkbolthit', x: round2(t.x), y: round2(t.y) });
        t.stun = Math.max(t.stun, BOLT.stun);
        t.cast = null;
        this.damage(t.owner, BOLT.dmg, 'hkstarve');
        continue;
      }
      b.x += ((t.x - b.x) / d) * step;
      b.y += ((t.y - b.y) / d) * step;
      b.f = Math.atan2(t.y - b.y, t.x - b.x);
    }
    this.bolts = this.bolts.filter((b) => !b.done);
  }

  // Computer kodos, every 2 s: devour a random P12 unit anywhere, then
  // Regurgitate a random kodo (itself included, which fails, as does
  // having less than 100 mana).
  botThink(pid, u, mem) {
    if (this.time < (mem.next ?? 0)) return;
    mem.next = this.time + 2;
    const food = this.food.filter((f) => f.alive && !f.eaten);
    if (food.length && !this.stomach.has(pid)) {
      const f = food[Math.floor(Math.random() * food.length)];
      this.command(pid, { c: 'move', x: f.x, y: f.y });
    }
    const kodos = this.alive;
    const to = kodos[Math.floor(Math.random() * kodos.length)];
    if (to === pid || this.mana.get(pid) < BOLT.mana) return;
    const v = this.heroes.get(to);
    this.command(pid, { c: 'cast', slot: 1, x: v.x, y: v.y });
  }

  hud(pid) {
    const s = this.stomach.get(pid);
    return { label: `Mana ${Math.floor(this.mana.get(pid) ?? 0)} / ${KODO.maxMana}${s ? ` · digesting a ${s.unit.kind}` : ''}` };
  }

  heroEnts(pid) {
    return super.heroEnts(pid).map((e) => {
      const owner = e.o;
      if (this.stomach.has(owner)) e.fx = [...(e.fx || []), 'full'];
      if (this.heroes.get(owner)?.stun > 0) e.fx = [...(e.fx || []), 'stun'];
      return e;
    });
  }

  worldEnts() {
    const ents = [{ id: this.gateId, k: 'hkgates', x: 0, y: 0, open: this.gatesOpen ? 1 : undefined }];
    for (const f of this.food) {
      if (f.eaten || !f.alive) continue;
      const e = { id: f.id, k: f.kind === 'pig' ? 'hkpig' : 'hkchild', x: round2(f.x), y: round2(f.y), f: round2(f.facing) };
      if (f.mx || f.my) e.mv = 1;
      ents.push(e);
    }
    for (const b of this.bolts) ents.push({ id: b.id, k: 'hkbolt', x: round2(b.x), y: round2(b.y), f: round2(b.f || 0) });
    return ents;
  }
}
