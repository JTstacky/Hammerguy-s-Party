import { Minigame } from '../../base.js';
import { Unit, stepUnits, collideUnits, newId, rand, dist, round2, wc3 } from '../../../engine/server/sim.js';
import { meleeStep, avoidObstacles, clampRect, outwardPoint } from './d-common.js';

// Uther Party 4.0 #12 "Dark Forest" (docs/uther-party/rules-4.0.md).
// A 1600x1600 Northrend clearing at permanent midnight, ringed by tree walls
// with 32 single trees in an X/diamond pattern. Everyone is a Druid of the
// Talon (100 HP, speed 270, no attack) with Storm Crow Form: 50 of 200 mana
// (regen 0.67/s), 1.05 s cast, and the crow runs at 350. Hunters appear at the
// centre every 15 s (from t=6, after a random 0-4 s wait) while there are fewer
// than 10: an abomination (speed 270, ground only, 33-39 per 1.9 s, acquire 300)
// and, on the first wave always and later half the time, a gargoyle (speed 350,
// air only, 61-70 per 1.4 s, acquire 400). Every 4.5 s each hunter attack-moves
// to a random point. Each form is exactly as fast as the hunter that can hit
// it: you cannot outrun your predator, only change what you are. Last druid
// standing wins; no time limit.
//
// Deviation: the sheet leaves open whether turning back from crow form costs
// mana; both directions cost 50 here (the sheet's "about 4 morphs banked").
const HW = wc3(768); // inside the tree walls
const TREE_R = wc3(56);
const DRUID = { hp: 100, speed: wc3(270), r: wc3(15) };
const CROW_SPEED = wc3(350);
const MANA = { max: 200, start: 200, regen: 0.67, cost: 50 };
const MORPH_CAST = 1.05;
const HP_REGEN = 0.5; // night regen, and it is always night here
export const ABOM = { hp: 1175, speed: wc3(270), r: wc3(48), acquire: wc3(300), turnRate: 0.4, weapon: { range: wc3(128), cd: 1.9, point: 0.5, dmg: [33, 39] } };
export const GARGOYLE = { hp: 410, speed: wc3(350), r: wc3(24), acquire: wc3(400), turnRate: 0.6, weapon: { range: wc3(128), cd: 1.4, point: 0.5, dmg: [61, 70] } };
const MAX_HUNTERS = 10;
const SPAWN_EVERY = 15;
const PATROL_EVERY = 4.5;
const AI_EVERY = 2;

// The single trees inside the walls (WC3 units from the centre, read from the arena).
const TREES = [
  [-704, -704], [0, -704], [704, -704],
  [-320, -576], [320, -576],
  [-192, -448], [192, -448],
  [-576, -320], [-64, -320], [64, -320], [576, -320],
  [-448, -192], [448, -192],
  [-320, -64], [320, -64],
  [-704, 0], [704, 0],
  [-320, 64], [320, 64],
  [-448, 192], [448, 192],
  [-576, 320], [-64, 320], [64, 320], [576, 320],
  [-192, 448], [192, 448],
  [-320, 576], [320, 576],
  [-704, 704], [0, 704], [704, 704],
];

export class DarkForest extends Minigame {
  static id = 'darkforest';
  static name = 'Dark Forest';
  static desc = 'Survive as long as possible! Abominations hunt the ground and gargoyles hunt the air, each exactly as fast as its prey. Druid or Storm Crow: change what you are before they reach you. Last one standing wins.';
  static controls = 'Right-click to move. Q: Storm Crow Form / back to druid (50 mana, 1 s cast). Abominations cannot touch a crow; gargoyles cannot touch a druid.';
  static duration = 300;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.trees = TREES.map(([x, y]) => ({ x: wc3(x), y: wc3(-y), r: TREE_R }));
    this.map = {
      theme: 'darkforest',
      floor: { shape: 'rect', w: HW * 2, h: HW * 2 },
      props: [],
      trees: this.trees.map((t) => [round2(t.x), round2(t.y)]),
      hw: round2(HW),
      build: ['darkforest'],
      bounds: HW + 3,
    };
    this.abilities = [{
      name: 'Storm Crow Form',
      icon: '🐦',
      desc: 'Take to the air as a storm crow (speed 350), safe from abominations but not gargoyles. Cast again to land as a druid. 50 mana, 1.05 s cast.',
      kind: 'instant',
      cd: 0,
      castPoint: MORPH_CAST,
      available: (pid) => (this.heroes.get(pid)?.mana ?? 0) >= MANA.cost,
      cast: (pid, u) => this.morph(u),
    }];
    // Each druid starts 300 u from the centre in a random direction.
    this.spawnHeroes(this.pids.map(() => {
      const a = rand(0, Math.PI * 2);
      return [Math.cos(a) * wc3(300), Math.sin(a) * wc3(300)];
    }), { hp: DRUID.hp, speed: DRUID.speed, r: DRUID.r, regen: HP_REGEN });
    for (const u of this.heroes.values()) {
      u.skin = 'druid';
      u.mana = MANA.start;
      u.air = false;
    }
    this.hunters = [];
    this.portalId = newId();
    this.spawnT = 6 + rand(0, SPAWN_EVERY);
    this.pendingSpawns = [];
    this.waves = 0;
    this.patrolT = rand(0, PATROL_EVERY);
    this.aiT = 6 + rand(0, AI_EVERY);
  }

  // Storm Crow Form, both ways. The form changes when the cast completes.
  morph(u) {
    if (u.mana < MANA.cost) return;
    u.mana -= MANA.cost;
    u.air = !u.air;
    u.skin = u.air ? 'crow' : 'druid';
    u.speed = u.air ? CROW_SPEED : DRUID.speed;
    this.ev({ k: 'dfmorph', x: round2(u.x), y: round2(u.y), air: u.air ? 1 : 0 });
    // Hunters that can no longer reach it let go.
    for (const h of this.hunters) if (h.atkTarget === u && !this.canHit(h, u)) h.atkTarget = null;
  }

  canHit(h, u) {
    return u.alive && (h.air ? u.air : !u.air);
  }

  spawnWave() {
    this.waves++;
    const mk = (S, air, kind) => {
      const a = rand(0, Math.PI * 2);
      const h = new Unit({ kind, x: Math.cos(a) * 0.3, y: Math.sin(a) * 0.3, r: S.r, speed: S.speed, hp: S.hp });
      h.air = air;
      h.turnRate = S.turnRate;
      h.weapon = S.weapon;
      h.acquire = S.acquire;
      h.atkCd = 0;
      h.setFacing(a);
      this.hunters.push(h);
      this.attackMove(h);
    };
    mk(ABOM, false, 'dfabom');
    // The first wave always brings a gargoyle (GetTriggerExecCount == 1), later ones half the time.
    if (this.waves === 1 || Math.random() < 0.5) mk(GARGOYLE, true, 'gargoyle');
    this.ev({ k: 'dfportal', x: 0, y: 0 });
  }

  // Patrol: forget the target and attack-move to a random point in the arena.
  attackMove(h) {
    h.atkTarget = null;
    h.dest = { x: rand(-HW, HW), y: rand(-HW, HW) };
    h.order(h.dest.x, h.dest.y);
  }

  acquire(h) {
    let best = null;
    let bd = h.acquire;
    for (const u of this.heroes.values()) {
      if (!this.canHit(h, u)) continue;
      const d = dist(h.x, h.y, u.x, u.y) - u.r;
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    return best;
  }

  tick(dt) {
    for (const u of this.heroes.values()) if (u.alive) u.mana = Math.min(MANA.max, u.mana + MANA.regen * dt);
    // Spawn: every 15 s from t=6, after a random 0-4 s wait, while there are fewer than 10.
    if (this.time >= 6) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT += SPAWN_EVERY;
        this.pendingSpawns.push(rand(0, 4));
      }
    }
    this.pendingSpawns = this.pendingSpawns.map((t) => t - dt);
    while (this.pendingSpawns.length && this.pendingSpawns[0] <= 0) {
      this.pendingSpawns.shift();
      if (this.hunters.length < MAX_HUNTERS) this.spawnWave();
    }
    this.patrolT -= dt;
    if (this.patrolT <= 0) {
      this.patrolT += PATROL_EVERY;
      for (const h of this.hunters) this.attackMove(h);
    }
    // Computer players: every 2 s from t=6.
    if (this.time >= 6) {
      this.aiT -= dt;
      if (this.aiT <= 0) {
        this.aiT += AI_EVERY;
        for (const [pid, u] of this.heroes) if (this.bots.has(pid) && u.alive) this.botOrder(pid, u);
      }
    }

    for (const h of this.hunters) {
      if (h.atkTarget && !this.canHit(h, h.atkTarget)) h.atkTarget = null;
      if (!h.atkTarget && !h.swing) {
        const t = this.acquire(h);
        if (t) h.atkTarget = t;
        else if (!h.target && h.dest) h.order(h.dest.x, h.dest.y);
      }
      const hadTarget = h.atkTarget;
      if (meleeStep(h, dt, (a, t, dmg) => this.hunterHit(a, t, dmg)) === 'swing') this.ev({ k: 'dfswing', u: h.id });
      // Target lost (dead or morphed): carry on with the attack-move.
      if (hadTarget && !h.atkTarget && !h.swing && h.dest) h.order(h.dest.x, h.dest.y);
    }
    stepUnits(this.hunters, dt);

    this.stepHeroes(dt);
    const heroes = [...this.heroes.values()];
    const ground = heroes.filter((u) => !u.air);
    collideUnits([...ground, ...this.hunters.filter((h) => !h.air)]);
    collideUnits([...heroes.filter((u) => u.air), ...this.hunters.filter((h) => h.air)]);
    for (const u of [...ground, ...this.hunters.filter((h) => !h.air)]) if (u.alive) avoidObstacles(u, this.trees);
    for (const u of [...heroes, ...this.hunters]) if (u.alive) clampRect(u, HW, HW);
  }

  hunterHit(h, u, dmg) {
    if (!this.canHit(h, u)) return;
    this.ev({ k: 'hit', x: round2(u.x), y: round2(u.y) });
    this.damage(u.owner, dmg);
  }

  // The original AI (every 2 s): move 200-500 u outward (from the centre, +-120
  // degrees); then land if a gargoyle is within 600, else take off if an
  // abomination is within 400. It ignores mana: the order just fails.
  botOrder(pid, u) {
    if (u.cast) return;
    const [x, y] = outwardPoint(u, wc3(200), wc3(500), HW - 0.5);
    u.order(x, y);
    const near = (kind, r) => this.hunters.some((h) => h.kind === kind && dist(h.x, h.y, u.x, u.y) <= wc3(r));
    if (near('gargoyle', 600)) {
      if (u.air) this.useAbility(pid, 0, u.x, u.y);
    } else if (near('dfabom', 400)) {
      if (!u.air) this.useAbility(pid, 0, u.x, u.y);
    }
  }

  hud(pid) {
    const u = this.heroes.get(pid);
    if (!u) return null;
    return { label: `Mana ${Math.floor(u.mana)} / ${MANA.max} · ${u.air ? 'Storm Crow' : 'Druid'} · Hunters ${this.hunters.length}` };
  }

  worldEnts() {
    const ents = [{ id: this.portalId, k: 'dfportal', x: 0, y: 0 }];
    for (const h of this.hunters) {
      const e = { id: h.id, k: h.kind, x: round2(h.x), y: round2(h.y), f: round2(h.facing) };
      if (h.mx || h.my) e.mv = 1;
      if (h.swing) e.sw = 1;
      ents.push(e);
    }
    return ents;
  }
}
