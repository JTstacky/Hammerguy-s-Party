import { Minigame } from '../../base.js';
import { Unit, stepUnits, collideUnits, rand, dist, shuffle, round2, wc3 } from '../../../engine/server/sim.js';
import { meleeStep, gap } from './d-common.js';

// Uther Party 4.0 #29 "Sleepy Time" (docs/uther-party/rules-4.0.md).
// Be the FIRST to die. Everyone is an unarmed Mountain Giant (1600 HP, no
// regeneration, speed 270, collision 48) in a 1280x1280 octagon at midnight
// with 10 wandering Rock Golems (speed 270, 35-40 per hit after armour, every
// 1.35 s, acquisition only 100). Your one tool is Taunt (radius 450, cooldown
// 15 s), which drags every golem near you onto you, including the ones beating
// on a rival.
//
// Special scoring (overrides the base class, which treats deaths as losses):
// the original turns each giant's death into a Race Finish, so this game is
// ranked as a race. The first to die is 1st and scores 8, the next 7, and so
// on (finish order = death order). At 120 s the survivors are killed and score
// 0; if nobody died at all everyone scores 0 (the original's Draw). Survivors
// are ranked among themselves by damage taken.
const HALF = wc3(640);
const CUT = wc3(1152); // octagon: |x| + |y| <= 1152 (one-tile corners cut off)
const GIANT = { hp: 1600, speed: wc3(270), r: wc3(48) };
export const TAUNT = { radius: wc3(450), cd: 15 };
export const GOLEM = { hp: 675, speed: wc3(270), r: wc3(32), acquire: wc3(100), weapon: { range: wc3(100), cd: 1.35, point: 0.5, dmg: [35, 40] } };
const GOLEMS = 10;
const DURATION = 120;

export class SleepyTime extends Minigame {
  static id = 'sleepy';
  static name = 'Sleepy Time';
  static desc = 'Be the first to die! Rock golems wander the glade and only swing at giants who come very close. Taunt pulls every golem around you onto you, even ones pounding a rival. The first giant to fall scores the most; anyone still standing at the end scores nothing.';
  static controls = 'Right-click to move. Q: Taunt (radius 450, every 15 s) makes nearby golems attack you.';
  static duration = DURATION;
  static ranking = 'race';

  setup() {
    this.map = {
      theme: 'sleepy',
      floor: { shape: 'rect', w: HALF * 2, h: HALF * 2 },
      props: shrubs(),
      half: round2(HALF),
      cut: round2(CUT),
      build: ['sleepy'],
      bounds: HALF + 2,
    };
    this.abilities = [{
      name: 'Taunt',
      icon: '😤',
      desc: 'Forces every golem within 450 to attack you, even ones busy with another giant. Cooldown 15 s.',
      kind: 'instant',
      cd: TAUNT.cd,
      cast: (pid, u) => this.taunt(u),
    }];
    // Giants 512 u from the centre at slot * 135 - 22.5 degrees, facing it, handed out at random.
    const slots = shuffle([...Array(8).keys()]);
    this.spawnHeroes(this.pids.map((_, i) => {
      const a = (((slots[i % 8] * 135 - 22.5) % 360) * Math.PI) / 180;
      return [Math.cos(a) * wc3(512), -Math.sin(a) * wc3(512)];
    }), { hp: GIANT.hp, speed: GIANT.speed, r: GIANT.r });
    for (const u of this.heroes.values()) u.skin = 'giant';
    this.golems = [];
    for (let i = 0; i < GOLEMS; i++) {
      const a = rand(0, Math.PI * 2);
      const r = wc3(rand(0, 200));
      const g = new Unit({ kind: 'rockgolem', x: Math.cos(a) * r, y: Math.sin(a) * r, r: GOLEM.r, speed: GOLEM.speed, hp: GOLEM.hp });
      g.weapon = GOLEM.weapon;
      g.atkCd = 0;
      g.wanderT = rand(1, 4);
      g.setFacing(rand(0, Math.PI * 2));
      this.golems.push(g);
    }
    this.aiT = 4 + rand(0, 1);
  }

  taunt(u) {
    this.ev({ k: 'taunt', x: round2(u.x), y: round2(u.y), r: round2(TAUNT.radius), u: u.id });
    for (const g of this.golems) {
      if (dist(g.x, g.y, u.x, u.y) - g.r <= TAUNT.radius) {
        g.atkTarget = u;
        if (g.swing && g.swing.tgt !== u) g.swing = null;
      }
    }
  }

  inside(x, y, r = 0) {
    return Math.abs(x) <= HALF - r && Math.abs(y) <= HALF - r && Math.abs(x) + Math.abs(y) <= CUT - r * 1.41;
  }

  confine(u) {
    u.x = Math.max(-HALF + u.r, Math.min(HALF - u.r, u.x));
    u.y = Math.max(-HALF + u.r, Math.min(HALF - u.r, u.y));
    const over = Math.abs(u.x) + Math.abs(u.y) - (CUT - u.r * 1.41);
    if (over > 0) {
      u.x -= (Math.sign(u.x) * over) / 2;
      u.y -= (Math.sign(u.y) * over) / 2;
    }
  }

  tick(dt) {
    if (this.time >= DURATION) {
      // Sleepy Expire: every giant still standing is killed and scores 0.
      for (const pid of this.alive) this.eliminate(pid, 'death');
      return;
    }
    // Computer players: every 1 s from t=4, follow a random golem, and taunt one time in six.
    if (this.time >= 4) {
      this.aiT -= dt;
      if (this.aiT <= 0) {
        this.aiT += 1;
        for (const [pid, u] of this.heroes) {
          if (!this.bots.has(pid) || !u.alive) continue;
          const g = this.golems[Math.floor(Math.random() * this.golems.length)];
          u.order(g.x, g.y);
          if (Math.random() < 1 / 6) this.useAbility(pid, 0, u.x, u.y);
        }
      }
    }
    for (const g of this.golems) {
      if (g.atkTarget && !g.atkTarget.alive) g.atkTarget = null;
      if (!g.atkTarget && !g.swing) {
        // Acquisition 100: only a giant that comes right up to it.
        let best = null;
        let bd = GOLEM.acquire;
        for (const u of this.heroes.values()) {
          if (!u.alive) continue;
          const d = gap(g, u);
          if (d < bd) {
            bd = d;
            best = u;
          }
        }
        if (best) g.atkTarget = best;
        else {
          // Wander: short random strolls when idle.
          g.wanderT -= dt;
          if (g.wanderT <= 0 && !g.target) {
            g.wanderT = rand(2, 5);
            for (let i = 0; i < 6; i++) {
              const a = rand(0, Math.PI * 2);
              const d = wc3(rand(100, 350));
              const x = g.x + Math.cos(a) * d;
              const y = g.y + Math.sin(a) * d;
              if (this.inside(x, y, g.r)) {
                g.order(x, y);
                break;
              }
            }
          }
        }
      }
      if (meleeStep(g, dt, (a, u, dmg) => this.golemHit(a, u, dmg)) === 'swing') this.ev({ k: 'rgswing', u: g.id });
    }
    stepUnits(this.golems, dt);
    this.stepHeroes(dt);
    collideUnits([...this.heroes.values(), ...this.golems]);
    for (const u of [...this.heroes.values(), ...this.golems]) if (u.alive) this.confine(u);
  }

  golemHit(g, u, dmg) {
    if (!u.alive) return;
    this.ev({ k: 'hit', x: round2(u.x), y: round2(u.y) });
    u.hp -= dmg;
    this.ev({ k: 'dmg', x: round2(u.x), y: round2(u.y), n: Math.round(dmg) });
    if (u.hp <= 0) this.sleep(u.owner);
  }

  // A giant's death is its Race Finish.
  sleep(pid) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return;
    u.hp = 0;
    u.alive = false;
    this.finish(pid);
    this.ev({ k: 'death', x: round2(u.x), y: round2(u.y), u: u.id });
    const place = this.finishOrder.length;
    this.party.msg(`${this.party.room.nameOf(pid)} is fast asleep (${place === 1 ? '1st' : place === 2 ? '2nd' : place === 3 ? '3rd' : `${place}th`}).`, this.party.room.colorOf(pid));
    for (const g of this.golems) if (g.atkTarget === u) g.atkTarget = null;
  }

  // Survivors rank among themselves by how close to death they got.
  progress(pid) {
    const u = this.heroes.get(pid);
    return u ? 1 - Math.max(0, u.hp) / u.maxHp : 0;
  }


  hud() {
    const asleep = this.finishOrder.length;
    return { label: asleep ? `Asleep: ${asleep} · next scores ${Math.max(0, 8 - asleep)}` : 'First to fall scores 8' };
  }

  worldEnts() {
    return this.golems.map((g) => {
      const e = { id: g.id, k: 'rockgolem', x: round2(g.x), y: round2(g.y), f: round2(g.facing) };
      if (g.mx || g.my) e.mv = 1;
      if (g.swing) e.sw = 1;
      if (g.atkTarget) e.ag = 1;
      return e;
    });
  }
}

// 61 non-blocking shrubs strewn over the glade.
function shrubs() {
  const props = [];
  let n = 0;
  while (n < 61) {
    const x = rand(-HALF + 0.5, HALF - 0.5);
    const y = rand(-HALF + 0.5, HALF - 0.5);
    if (Math.abs(x) + Math.abs(y) > CUT - 1) continue;
    props.push({ t: 'bush', x: round2(x), y: round2(y), s: round2(rand(0.35, 0.6)) });
    n++;
  }
  return props;
}

