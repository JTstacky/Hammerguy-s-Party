import { Minigame } from '../../base.js';
import { newId, rand, dist, round2, wc3, shuffle, wrapAngle } from '../../../engine/server/sim.js';
import { pushOutSquare } from './creeps-and-walls.js';

// Uther Party 4.0 #21 "The Salamander Sizzle" (docs/uther-party/rules-4.0.md):
// a round pen walled by giant mushrooms (Dungeon Tree Walls), with eight
// spokes of mushroom cover and an open centre. Players are salamanders: 25 HP,
// speed 270, collision 48, mana 0 of 200 at the start, +10/s. Flame Shot
// (75 mana) stops you and launches a fire 128 u ahead along your facing that
// flies straight on at 350 u/s. Every 0.05 s: any salamander within 100 of a
// fire dies (the shooter too), each fire loses 1 HP of 120 (so it lasts about
// 6.1 s), a fire within 100 of a living mushroom dies, and every mushroom
// within 100 of a fire is destroyed. Fires also burn 10/s within 220
// (Permanent Immolation). 150 s timer: survivors then share the ante. No ties.
//
// Trigger distances (the 100 u checks) are to unit centres: a fire born
// 128 u ahead of its 48-collision shooter does not kill it. Immolation, an
// ability area, includes the victim's collision size (engine.md).

// The pen as read from the map (docs/uther-party/arenas/Salamander_Sizzle.png):
// 20x20 tiles of 128 u, the arena centre on the corner between the middle four.
// Y = a mushroom (60 in the outer ring, 28 in the spokes).
const LAYOUT = [
  '....................',
  '......YYYYYYYY......',
  '....YY...Y....YY....',
  '...Y.....Y......Y...',
  '..Y.Y....Y.....Y.Y..',
  '..Y..Y...Y....Y..Y..',
  '.Y....Y..Y...Y....Y.',
  '.Y.....Y....Y.....Y.',
  '.Y................Y.',
  '.YYYYYY......YYYYYY.',
  '.Y................Y.',
  '.Y................Y.',
  '.Y.....Y....Y.....Y.',
  '.Y....Y..Y...Y....Y.',
  '..Y..Y...Y....Y..Y..',
  '..Y.Y....Y.....Y.Y..',
  '...Y.....Y......Y...',
  '....YY...Y....YY....',
  '......YYYYYYYY......',
  '....................',
];
export const BLOCKS = [];
LAYOUT.forEach((row, j) => [...row].forEach((c, i) => c === 'Y' && BLOCKS.push([wc3((i - 9.5) * 128), wc3((9.5 - j) * 128)])));
const BLOCK_H = wc3(64);
const PEN_R = wc3(1150); // outside the ring is unwalkable
const SPAWN_R = wc3(800);
const SAL = { hp: 25, regen: 0.25, speed: wc3(270), r: wc3(48) };
const MANA = { max: 200, regen: 10, cost: 75 };
const FIRE = { speed: wc3(350), ahead: wc3(128), range: wc3(3000), hp: 120, regen: 0.5, kill: wc3(100), immoR: wc3(220), immo: 10 };
const BURN_TICK = 0.05;

export class SalamanderSizzle extends Minigame {
  static id = 'salamander';
  static name = 'The Salamander Sizzle';
  static desc = 'Every salamander can spit a fireball straight ahead. Touch one and you are toast, and they scorch anyone close by. Giant mushrooms give cover, but each one only stops a single fireball. Shoot and kill your opponents!';
  static controls = 'Right-click to move. Q: Flame Shot (75 mana) fires along your facing and stops you. Mana refills at 10 a second.';
  static duration = 150;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'undercroft', floor: { shape: 'disc', r: wc3(1180) }, props: [], build: ['salamander'], bounds: wc3(1024) + 1, blocks: BLOCKS.map(([x, y]) => [round2(x), round2(y)]), bh: round2(BLOCK_H) };
    this.abilities = [
      {
        name: 'Flame Shot',
        icon: '🔥',
        desc: 'Launches a fireball along your facing (75 mana). Anything it touches dies; mushrooms stop it.',
        kind: 'instant',
        cd: MANA.cost / MANA.regen, // shown as the wait for mana
        available: (pid) => (this.mana.get(pid) ?? 0) >= MANA.cost,
        cast: (pid, u) => this.shoot(pid, u),
      },
    ];
    // Eight spots at 800 u, mid-way between the spokes, handed out at random.
    const spots = shuffle(Array.from({ length: 8 }, (_, j) => ((22.5 + 45 * j) * Math.PI) / 180));
    this.spawnHeroes(
      this.pids.map((_, i) => [Math.cos(spots[i % 8]) * SPAWN_R, Math.sin(spots[i % 8]) * SPAWN_R]),
      { hp: SAL.hp, regen: SAL.regen, r: SAL.r, speed: SAL.speed },
    );
    for (const u of this.heroes.values()) u.skin = 'salamander';
    this.mana = new Map(this.pids.map((p) => [p, 0]));
    this.blocks = BLOCKS.map(() => true);
    this.fires = [];
    this.burnT = 0;
    this.blocksId = newId();
    this.aiOn = 5;
  }

  tick(dt) {
    for (const [pid, m] of this.mana) {
      const nm = Math.min(MANA.max, m + MANA.regen * dt);
      this.mana.set(pid, nm);
      // The button's sweep shows the wait until the next shot is affordable.
      this.acd.get(pid)[0] = Math.max(0, (MANA.cost - nm) / MANA.regen);
    }
    this.stepHeroes(dt);
    for (const u of this.heroes.values()) {
      if (!u.alive) continue;
      this.blocks.forEach((alive, i) => alive && pushOutSquare(u, BLOCKS[i][0], BLOCKS[i][1], BLOCK_H));
      const d = Math.hypot(u.x, u.y);
      if (d > PEN_R - u.r) {
        u.x *= (PEN_R - u.r) / d;
        u.y *= (PEN_R - u.r) / d;
      }
    }
    for (const f of this.fires) {
      const step = Math.min(FIRE.speed * dt, f.go);
      f.x += Math.cos(f.a) * step;
      f.y += Math.sin(f.a) * step;
      f.go -= step;
      // Permanent Immolation, on each fire's own 1 s clock.
      f.immo -= dt;
      if (f.immo <= 0) {
        f.immo += 1;
        for (const [pid, u] of this.heroes) if (u.alive && dist(u.x, u.y, f.x, f.y) <= FIRE.immoR + u.r) this.damage(pid, FIRE.immo, 'burn');
      }
    }
    this.burnT -= dt;
    while (this.burnT <= 0) {
      this.burnT += BURN_TICK;
      this.burn();
    }
    this.fires = this.fires.filter((f) => !f.dead);
  }

  // "Salamander Fire": the caster is stopped and a fire appears 128 u ahead of it.
  shoot(pid, u) {
    this.mana.set(pid, this.mana.get(pid) - MANA.cost);
    u.stop();
    const a = u.facing;
    const f = { id: newId(), x: u.x + Math.cos(a) * FIRE.ahead, y: u.y + Math.sin(a) * FIRE.ahead, a, go: FIRE.range, hp: FIRE.hp, immo: 1 };
    this.fires.push(f);
    this.ev({ k: 'flameshot', x: round2(f.x), y: round2(f.y), f: round2(a) });
  }

  // One tick of "Salamander Burn".
  burn() {
    for (const [pid, u] of this.heroes) {
      if (u.alive && this.fires.some((f) => !f.dead && dist(u.x, u.y, f.x, f.y) <= FIRE.kill)) this.eliminate(pid, 'burn');
    }
    for (const f of this.fires) {
      if (f.dead) continue;
      f.hp = f.hp - 1 + FIRE.regen * BURN_TICK;
      if (f.hp <= 0.405) this.killFire(f, false);
    }
    const hitters = [];
    for (const f of this.fires) {
      if (f.dead && !f.justDied) continue;
      if (!f.dead && this.blocks.some((alive, i) => alive && dist(f.x, f.y, BLOCKS[i][0], BLOCKS[i][1]) <= FIRE.kill)) this.killFire(f, true);
      hitters.push(f);
    }
    for (const f of hitters) {
      this.blocks.forEach((alive, i) => {
        if (alive && dist(f.x, f.y, BLOCKS[i][0], BLOCKS[i][1]) <= FIRE.kill) {
          this.blocks[i] = false;
          this.ev({ k: 'shroomburn', x: round2(BLOCKS[i][0]), y: round2(BLOCKS[i][1]) });
        }
      });
      f.justDied = false;
    }
  }

  killFire(f, hit) {
    f.dead = true;
    f.justDied = true;
    this.ev({ k: 'salfiredie', x: round2(f.x), y: round2(f.y), hit: hit ? 1 : undefined });
  }

  // The original's bots: every 4 s (from t=5) walk 100-300 u toward a random
  // rival (±5°), and 1 s later fire with a 50 % chance. Better bots square up
  // to their target before firing and sidestep fireballs coming at them.
  botThink(pid, u, mem) {
    if (this.time < this.aiOn) return;
    const dodge = this.incoming(u);
    if (dodge && Math.random() < mem.skill) {
      u.order(dodge[0], dodge[1]);
      mem.aim = null;
      return;
    }
    if (mem.aim) {
      const v = mem.aim;
      if (!v.alive) {
        mem.aim = null;
        return;
      }
      const ang = Math.atan2(v.y - u.y, v.x - u.x);
      if (Math.abs(wrapAngle(ang - u.facing)) < 0.08) {
        this.useAbility(pid, 0, 0, 0);
        mem.aim = null;
      } else {
        u.stop();
        u.faceTo = ang;
      }
      return;
    }
    mem.walk = (mem.walk ?? rand(0, 1)) - 0.22;
    if (mem.fireIn != null) {
      mem.fireIn -= 0.22;
      if (mem.fireIn <= 0) {
        mem.fireIn = null;
        if (Math.random() < 0.5 && this.mana.get(pid) >= MANA.cost) {
          if (Math.random() < mem.skill && mem.target?.alive) mem.aim = mem.target;
          else this.useAbility(pid, 0, 0, 0);
        }
      }
    }
    if (mem.walk <= 0) {
      mem.walk = 4;
      mem.fireIn = 1;
      const rivals = [...this.heroes.values()].filter((v) => v !== u && v.alive);
      if (!rivals.length) return;
      const v = rivals[Math.floor(Math.random() * rivals.length)];
      mem.target = v;
      const a = Math.atan2(v.y - u.y, v.x - u.x) + (rand(-5, 5) * Math.PI) / 180;
      const r = wc3(rand(100, 300));
      u.order(u.x + Math.cos(a) * r, u.y + Math.sin(a) * r);
    }
  }

  // A fireball whose path will pass close in the next 1.5 s: step aside.
  incoming(u) {
    for (const f of this.fires) {
      const dx = u.x - f.x;
      const dy = u.y - f.y;
      const along = dx * Math.cos(f.a) + dy * Math.sin(f.a);
      if (along < -1 || along > FIRE.speed * 1.5) continue;
      const side = -dx * Math.sin(f.a) + dy * Math.cos(f.a);
      if (Math.abs(side) > FIRE.kill + u.r + wc3(160)) continue;
      const s = side >= 0 ? 1 : -1;
      const x = u.x - Math.sin(f.a) * s * 3.5;
      const y = u.y + Math.cos(f.a) * s * 3.5;
      if (Math.hypot(x, y) < PEN_R - 1.5) return [x, y];
      return [u.x + Math.sin(f.a) * s * 3.5, u.y - Math.cos(f.a) * s * 3.5];
    }
    return null;
  }

  hud(pid) {
    return { label: `Mana ${Math.floor(this.mana.get(pid) ?? 0)} / ${MANA.max}` };
  }

  worldEnts() {
    let s = '';
    for (let i = 0; i < this.blocks.length; i += 4) {
      let n = 0;
      for (let b = 0; b < 4; b++) if (this.blocks[i + b]) n |= 1 << b;
      s += n.toString(16);
    }
    const ents = [{ id: this.blocksId, k: 'shrooms', x: 0, y: 0, up: s }];
    for (const f of this.fires) ents.push({ id: f.id, k: 'sfire', x: round2(f.x), y: round2(f.y), f: round2(f.a) });
    return ents;
  }
}

export const SALAMANDER = { BLOCK_H, PEN_R, SPAWN_R, SAL, MANA, FIRE };
