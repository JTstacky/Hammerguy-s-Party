import { Minigame } from '../../base.js';
import { newId, rand, dist, clampToRect, round2, wc3 } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';
import { ringSpots, shuffled, noTies, Obstacles, Nav, goTo, followPaths, between } from './e-common.js';

// Uther Party 4.0 #6 "Way of the Bow" (docs/uther-party/rules-4.0.md).
// A 2560x2560 night glade walled and crossed by Summer Tree Walls. Every
// player is a 5 HP archer (speed 270, collision 31) whose arrow kills in one
// hit: range 800, cooldown 1.5 s, damage point 0.72 s. Nothing auto-attacks
// (acquisition 100, patrol turned into move), so every shot is a click.
// Arrows do not home (engine.md, measured live): at release an arrow is aimed
// at where the target will be if it keeps its velocity, flies straight there
// at about 1000 u/s and hits whoever's circle covers that point. A new order
// during the 0.72 s draw cancels the shot. Units are paused for the first 5 s,
// which count against the 120 s timer. Survival without ties; survivors at
// 120 s share the ante.
const HW = wc3(1280);
const TILE = wc3(128);
const R = wc3(31);
const RANGE = wc3(800);
export const ARROW_SPEED = wc3(1000);
const PAUSE = 5;

// The tree-wall layout, one character per 128 u tile (A = tree), north row first.
export const GRID = [
  '.AAAAAAAAAAAAAAAAAAA',
  'A.......AAAAA......A',
  'A........AAA.......A',
  'A...AA....A....AA..A',
  'A...AAA...A...AAA..A',
  'A....AAA.....AAA...A',
  'A.....A.......A....A',
  'AA........A.......AA',
  'AAA.......A......AAA',
  'AAAAA..AAAAAA..AAAAA',
  'AAA......AA......AAA',
  'AA........A.......AA',
  'A.....A...A...A....A',
  'A....AAA.....AAA...A',
  'A...AAA.......AAA..A',
  'A...AA....A....AA..A',
  'A.........A........A',
  'A.........AA.......A',
  '.A.......AAAA......A',
  '..AAAAAAAAAAAAAAAAA.',
];

// Centre of tile (col, row) in our coordinates (row 0 is north, the top of the screen).
export const tileCenter = (c, r) => [-HW + (c + 0.5) * TILE, -HW + (r + 0.5) * TILE];

export class WayOfTheBow extends Minigame {
  static id = 'bow';
  static name = 'Way of the Bow';
  static desc = 'An archer duel in a night glade. One arrow kills, but arrows fly to where you were going: wait for the release, then change direction. Last archer standing wins.';
  static controls = 'Right-click to move. Right-click an archer to shoot (0.72 s draw). Turn or stop after the release to dodge.';
  static duration = 120;
  static ranking = 'survival';

  setup() {
    this.obs = new Obstacles();
    const props = [];
    GRID.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch !== 'A') return;
        const [x, y] = tileCenter(c, r);
        this.obs.box(x - TILE / 2, y - TILE / 2, x + TILE / 2, y + TILE / 2);
        props.push({ t: 'tree', x: x + rand(-0.15, 0.15), y: y + rand(-0.15, 0.15), s: rand(0.95, 1.2) });
      });
    });
    this.nav = new Nav(this.obs, HW, HW, TILE / 2, R);
    this.map = { theme: 'glade', floor: { shape: 'rect', w: HW * 2, h: HW * 2 }, props: [...props, ...treesAroundRect(HW + 1, HW + 1, 0.35, 2)], bounds: HW + 3 };
    // Pierce 16-18 x 0.75 against medium armour: 12-13.5, and archers have 5 HP.
    this.attack = { range: RANGE, cd: 1.5, point: 0.72, missile: 0, art: 'arrow' };
    // Archers are created on a 1000 u ring (slot x 135 - 22.5 degrees) and handed out at random.
    this.spawnHeroes(shuffled(ringSpots(this.pids.length, 1000)), { hp: 5, r: R, speed: wc3(270) });
    for (const u of this.heroes.values()) {
      u.skin = 'archer';
      u.path = [];
    }
    this.arrows = [];
  }

  command(pid, m) {
    if (this.time < PAUSE) return;
    const u = this.heroes.get(pid);
    if (!u?.alive) return;
    if (m.c === 'move' || m.c === 'steer' || m.c === 'stop') {
      const x = +m.x || 0;
      const y = +m.y || 0;
      const tgt = m.c === 'move' ? this.attackTargetAt(pid, x, y) : null;
      this.order(u, m.c, x, y, tgt);
      return;
    }
    super.command(pid, m);
  }

  // Any new order during the draw cancels the shot (engine.md: AI re-orders cancelled arrows).
  order(u, c, x, y, tgt) {
    if (u.swing && tgt !== u.swing.tgt) {
      u.swing = null;
      u.atkCd = 0;
    }
    u.path = [];
    if (tgt) {
      u.attackOrder = tgt;
      return;
    }
    u.attackOrder = null;
    if (c === 'move') goTo(this.nav, u, x, y);
    else if (c === 'steer') u.steer(x, y);
    else u.stop();
  }

  // The draw finished: loose an arrow at the predicted point.
  attackHit(pid, u, tgt) {
    this.loose(pid, u, tgt);
  }

  loose(pid, u, tgt) {
    let t = dist(u.x, u.y, tgt.x, tgt.y) / ARROW_SPEED;
    let px = tgt.x;
    let py = tgt.y;
    for (let i = 0; i < 4; i++) {
      px = tgt.x + tgt.mx * t;
      py = tgt.y + tgt.my * t;
      t = dist(u.x, u.y, px, py) / ARROW_SPEED;
    }
    const a = { id: newId(), pid, sx: u.x, sy: u.y, tx: px, ty: py, x: u.x, y: u.y, t: 0, flight: Math.max(t, 0.02) };
    this.arrows.push(a);
    this.ev({ k: 'sfx', s: 'thrust' });
    return a;
  }

  tick(dt) {
    followPaths(this.heroes.values());
    this.stepHeroes(dt);
    for (const u of this.heroes.values()) {
      if (!u.alive) continue;
      this.obs.push(u);
      clampToRect(u, HW - TILE * 0.5, HW - TILE * 0.5);
    }
    for (const a of this.arrows) {
      a.t += dt;
      const k = Math.min(1, a.t / a.flight);
      a.x = a.sx + (a.tx - a.sx) * k;
      a.y = a.sy + (a.ty - a.sy) * k;
      if (k >= 1) this.land(a);
    }
    this.arrows = this.arrows.filter((a) => !a.done);
  }

  land(a) {
    a.done = true;
    for (const [pid, v] of this.heroes) {
      if (!v.alive || pid === a.pid) continue;
      if (dist(v.x, v.y, a.tx, a.ty) <= v.r) {
        this.ev({ k: 'hit', x: round2(a.tx), y: round2(a.ty) });
        this.damage(pid, between(16, 18) * 0.75, 'death');
        return;
      }
    }
    this.ev({ k: 'bowmiss', x: round2(a.tx), y: round2(a.ty), f: round2(Math.atan2(a.ty - a.sy, a.tx - a.sx)) });
  }

  // The original AI: every 2 s, move to a random point in the arena; then, with
  // a 3/4 chance, attack a random living archer instead (itself included, which fails).
  botThink(pid, u, mem) {
    if (this.time < PAUSE) return;
    mem.next ??= this.time + rand(0, 2);
    if (this.time < mem.next) return;
    mem.next += 2;
    const x = rand(-HW, HW);
    const y = rand(-HW, HW);
    let tgt = null;
    if (Math.random() < 0.75) {
      const alive = [...this.heroes.values()].filter((v) => v.alive);
      const v = alive[Math.floor(Math.random() * alive.length)];
      if (v && v !== u) tgt = v;
    }
    this.order(u, 'move', x, y, tgt);
  }

  hud() {
    return { label: this.time < PAUSE ? `Ready... ${Math.ceil(PAUSE - this.time)}` : `Archers left: ${this.alive.length}` };
  }

  worldEnts() {
    return this.arrows.map((a) => ({ id: a.id, k: 'bowarrow', x: round2(a.x), y: round2(a.y), f: round2(Math.atan2(a.ty - a.sy, a.tx - a.sx)), p: round2(a.t / a.flight), d: round2(dist(a.sx, a.sy, a.tx, a.ty)) }));
  }
}

noTies(WayOfTheBow);
