import { Minigame } from '../base.js';
import { newId, rand, dist, clampToRect, round2, wc3 } from '../../engine/server/sim.js';

// Uther Party 4.0 #1 "Peon Pandemonium" (docs/uther-party/rules-4.0.md):
// a sunken 1024x1024 pit with siege engines on the four banks around it. Every
// 8 s another one arrives (up to 30); every 2 s all of them are re-aimed at
// random points in the pit. The first 8 are catapults, later ones are
// demolishers whose rocks leave burning oil. Rocks fly to a fixed point at
// 400 u/s and splash for 100 % / 40 % / 25 % of one damage roll within
// 25 / 50 / 150 u of the victim's edge (measured live, engine.md).
const HW = wc3(512);
const BANK_NEAR = wc3(704);
const BANK_FAR = wc3(864);
const BANK_SPAN = wc3(576);
const ROCK_SPEED = wc3(400);
const TIERS = [
  [wc3(25), 1],
  [wc3(50), 0.4],
  [wc3(150), 0.25],
];
const OIL_R = wc3(150);
const MAX_SIEGE = 30;
// Siege damage does 50 % to the peon's medium armour.
const CATAPULT = { base: 81, dice: 3, sides: 21 };
const DEMOLISHER = { base: 71, dice: 3, sides: 18 };

export class MortarMayhem extends Minigame {
  static id = 'mortar';
  static name = 'Mortar Mayhem';
  static desc = 'Catapults on the banks lob rocks into the pit, and more arrive every few seconds. Watch the rocks and keep moving. Last one standing wins.';
  static controls = 'Right-click to move. You have 50 HP: near misses only hurt, direct hits kill.';
  static duration = 300;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.map = {
      theme: 'dirt',
      floor: { shape: 'rect', w: HW * 2, h: HW * 2 },
      props: [...banks()],
      bounds: BANK_FAR + 3,
    };
    // Peons (HP 50, regen 0.25/s, speed 190, collision 16) start 100-300 u from the centre.
    this.spawnHeroes(
      this.pids.map(() => {
        const a = rand(0, Math.PI * 2);
        const r = wc3(rand(100, 300));
        return [Math.cos(a) * r, Math.sin(a) * r];
      }),
      { speed: wc3(190), r: wc3(16), hp: 50, regen: 0.25 },
    );
    this.siege = [];
    this.rocks = [];
    this.oil = [];
    this.spawnT = 6 + rand(0, 2);
    this.fireT = 2;
  }

  tick(dt) {
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 8 + rand(0, 2);
      if (this.siege.length < MAX_SIEGE) {
        this.spawnSiege();
        this.aimAll();
      }
    }
    this.fireT -= dt;
    if (this.fireT <= 0) {
      this.fireT += 2;
      this.aimAll();
    }
    for (const s of this.siege) this.stepSiege(s, dt);

    this.stepHeroes(dt);
    for (const [, u] of this.heroes) if (u.alive) clampToRect(u, HW, HW);

    for (const r of this.rocks) {
      r.t += dt;
      if (r.t >= r.flight) this.land(r);
    }
    this.rocks = this.rocks.filter((r) => !r.dead);

    for (const o of this.oil) {
      o.t -= dt;
      o.tick -= dt;
      if (o.tick <= 0) {
        o.tick += 0.5;
        for (const [pid, u] of this.heroes) if (u.alive && dist(u.x, u.y, o.x, o.y) <= OIL_R + u.r) this.damage(pid, 6, 'death');
      }
    }
    this.oil = this.oil.filter((o) => o.t > 0);
  }

  spawnSiege() {
    const side = Math.floor(rand(0, 4));
    const along = rand(-BANK_SPAN, BANK_SPAN);
    const out = rand(BANK_NEAR, BANK_FAR);
    const [x, y] = [
      [out, along],
      [along, out],
      [-out, along],
      [along, -out],
    ][side];
    const demo = this.siege.length >= 8;
    this.siege.push({ id: newId(), x, y, f: Math.atan2(-y, -x), demo, cd: 0, aim: null, wind: -1 });
    this.ev({ k: 'tele', x1: round2(x), y1: round2(y), x2: round2(x), y2: round2(y) });
  }

  aimAll() {
    for (const s of this.siege) s.aim = { x: rand(-HW, HW), y: rand(-HW, HW) };
  }

  stepSiege(s, dt) {
    s.cd -= dt;
    if (!s.aim) return;
    // Siege engines turn slowly toward the point before they can fire.
    const want = Math.atan2(s.aim.y - s.y, s.aim.x - s.x);
    let diff = want - s.f;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const turn = 0.3 / 0.03; // Demolisher turn rate 0.3 rad per step
    s.f += Math.max(-turn * dt, Math.min(turn * dt, diff));
    if (s.wind >= 0) {
      s.wind += dt;
      // Damage point 0.1 s, then the rock is released.
      if (s.wind >= 0.1) {
        s.wind = -1;
        this.launch(s);
      }
    } else if (s.cd <= 0 && Math.abs(diff) < 0.05) {
      s.wind = 0;
      s.cd = 4.5;
    }
  }

  launch(s) {
    const { x, y } = s.aim;
    // Measured: attack event to impact = d / 399.7 - 0.365 s (release is 0.1 s in).
    const d = dist(s.x, s.y, x, y);
    const flight = Math.max(0.25, d / ROCK_SPEED - 0.465);
    const w = s.demo ? DEMOLISHER : CATAPULT;
    let dmg = w.base;
    for (let i = 0; i < w.dice; i++) dmg += 1 + Math.floor(Math.random() * w.sides);
    this.rocks.push({ id: newId(), sx: s.x, sy: s.y, x, y, t: 0, flight, dmg: dmg * 0.5, oil: s.demo });
    this.ev({ k: 'sfx', s: 'mortar' });
  }

  land(r) {
    r.dead = true;
    let hit = false;
    for (const [pid, u] of this.heroes) {
      if (!u.alive) continue;
      const d = dist(u.x, u.y, r.x, r.y) - u.r;
      const tier = TIERS.find(([rad]) => d <= rad);
      if (tier) {
        hit = true;
        this.damage(pid, r.dmg * tier[1], 'death');
      }
    }
    // Only rocks that hit someone shake the camera.
    this.ev({ k: 'boom', s: r.oil ? 'fire' : 'rock', x: round2(r.x), y: round2(r.y), r: TIERS[2][0], c: r.oil ? '#ff7a20' : '#c0a080', big: hit ? 1 : undefined });
    if (r.oil) this.oil.push({ id: newId(), x: r.x, y: r.y, t: 2.51, tick: 0.5 });
  }

  inDanger(x, y, margin) {
    return this.rocks.some((r) => r.flight - r.t < 1.6 && dist(x, y, r.x, r.y) < TIERS[1][0] + margin) || this.oil.some((o) => dist(x, y, o.x, o.y) < OIL_R + margin);
  }

  botThink(pid, u, mem) {
    if (Math.random() > mem.skill) return; // bots sometimes react late
    if (!this.inDanger(u.x, u.y, 0.5)) {
      if (u.target && this.inDanger(u.target.x, u.target.y, 0.4)) u.stop();
      return;
    }
    let best = null;
    let bd = Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      for (const r of [1, 2, 3]) {
        const x = u.x + Math.cos(a) * r;
        const y = u.y + Math.sin(a) * r;
        if (Math.abs(x) > HW - 0.5 || Math.abs(y) > HW - 0.5 || this.inDanger(x, y, 0.5)) continue;
        if (r < bd) {
          bd = r;
          best = [x, y];
        }
      }
    }
    if (best) u.order(best[0], best[1]);
  }

  worldEnts() {
    const ents = this.siege.map((s) => ({ id: s.id, k: 'catapult', x: round2(s.x), y: round2(s.y), f: round2(s.f), demo: s.demo ? 1 : undefined, fire: s.wind >= 0 ? 1 : undefined }));
    for (const r of this.rocks) ents.push({ id: r.id, k: 'lob', x: round2(r.x), y: round2(r.y), sx: round2(r.sx), sy: round2(r.sy), t: round2(r.t / r.flight), r: round2(TIERS[1][0]), r2: round2(TIERS[2][0]), oil: r.oil ? 1 : undefined });
    for (const o of this.oil) ents.push({ id: o.id, k: 'oil', x: round2(o.x), y: round2(o.y), r: round2(OIL_R), t: round2(o.t) });
    return ents;
  }
}

// The banks outside the pit: a tumbled rim of boulders of mixed sizes, a
// second broken row behind, and torches at the corners.
function banks() {
  const props = [];
  const edge = HW + 1.1;
  for (let i = -9; i <= 9; i++) {
    const a = (i / 9) * (HW + 0.6) + rand(-0.35, 0.35);
    for (const [nx, ny] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const out = edge + rand(-0.35, 0.5);
      const px = nx ? nx * out : a;
      const py = ny ? ny * out : a;
      props.push({ t: 'rock', x: px, y: py, s: rand(0.7, 1.3) });
      if (Math.random() < 0.55) props.push({ t: 'rock', x: px + nx * rand(1.3, 2.2) + (ny ? rand(-0.8, 0.8) : 0), y: py + ny * rand(1.3, 2.2) + (nx ? rand(-0.8, 0.8) : 0), s: rand(0.8, 1.5) });
      if (Math.random() < 0.3) props.push({ t: 'rock', x: px - nx * rand(0.6, 1) + (ny ? rand(-0.5, 0.5) : 0), y: py - ny * rand(0.6, 1) + (nx ? rand(-0.5, 0.5) : 0), s: rand(0.25, 0.45) });
    }
  }
  for (const [x, y] of [
    [edge, edge],
    [-edge, edge],
    [edge, -edge],
    [-edge, -edge],
  ]) props.push({ t: 'torch', x, y });
  return props;
}
