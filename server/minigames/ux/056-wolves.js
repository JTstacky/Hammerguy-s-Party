import { Minigame } from '../../base.js';
import { Unit, wc3, rand, round2, stepUnits, dist } from '../../../engine/server/sim.js';

// Uther Party Ultima-X #56 "Rampage With Wolves" (docs/uther-party/rules-ultima-x.md).
//
// Sheep fetch a patch of grass from the pocket at the far north of the camp
// and carry it back to the Circle of Power in the south, past 28 hungry
// wolves that wander the whole camp. Any sheep within 80 of a wolf dies (and
// drops its grass). Race: 8, 7, 6 ... to sheep that bring grass home.
//
// The layout, in WC3 coordinates (north is +Y, drawn at the top):
//  - southern field: x 7710-9185, y 30-1090, the starts and the circle in it;
//  - a wall of trees at y 1090-1250 with a 640 gate (x 8130-8770);
//  - northern field: y 1250-2300;
//  - a 700-wide corridor north (x 8114-8814, y 2300-3070) to the grass
//    pocket (8384,2720)-(8544,2848).
//  - The wolves' camp (7744,576)-(9056,2272) spans both fields; they start
//    at random points in it and are sent to random points in it.
// Simplifications: the walls are straight; the gate wall is drawn as trees.
// The original's computers get no sheep; our bots play (cautiously).

const CX = 8448;
const CY = 1550;
const P = (X, Y) => [wc3(X - CX), -wc3(Y - CY)];
const [FX0] = P(7710, 0);
const [FX1] = P(9185, 0);
const [, SOUTH] = P(0, 30);
const [, WALL_S] = P(0, 1090);
const [, WALL_N] = P(0, 1250);
const [, FIELD_N] = P(0, 2300);
const [, NORTH] = P(0, 3070);
const [GATE0] = P(8130, 0);
const [GATE1] = P(8770, 0);
const [COR0] = P(8114, 0);
const [COR1] = P(8814, 0);
const CAMP = { x0: P(7744, 0)[0], x1: P(9056, 0)[0], y0: P(0, 2272)[1], y1: P(0, 576)[1] };
const GRASS = { x0: P(8384, 0)[0], x1: P(8544, 0)[0], y0: P(0, 2848)[1], y1: P(0, 2720)[1] };
const FINISH = { x0: P(8320, 0)[0], x1: P(8480, 0)[0], y0: P(0, 224)[1], y1: P(0, 96)[1] };
const CIRCLE = P(8400, 160);

export const WOLVES = { sheepSpeed: wc3(190), sheepHp: 15, sheepR: wc3(15), wolfSpeed: wc3(350), wolfR: wc3(32), kill: wc3(80), count: 28, grass: 8, redirect: 2, pause: 4 };
export const LAYOUT = { SOUTH, NORTH, WALL_S, WALL_N, FIELD_N, GATE0, GATE1, COR0, COR1, CAMP, GRASS, FINISH, CIRCLE, FX0, FX1 };

// Where a sheep (or wolf) may stand.
export function walkable(x, y) {
  if (y > SOUTH || y < NORTH) return false;
  if (y < FIELD_N) return x >= COR0 && x <= COR1; // the corridor to the grass
  if (x < FX0 || x > FX1) return false;
  if (y > WALL_N && y < WALL_S) return x >= GATE0 && x <= GATE1; // the gate
  return true;
}

const inRect = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
const randIn = (r) => [rand(r.x0, r.x1), rand(r.y0, r.y1)];

// A random walkable point of the wolves' camp.
function campPoint() {
  for (;;) {
    const [x, y] = randIn(CAMP);
    if (walkable(x, y)) return [x, y];
  }
}

// Undo a step into a wall, sliding along it where possible.
function keepOut(u, px, py) {
  if (walkable(u.x, u.y)) return;
  if (walkable(u.x, py)) u.y = py;
  else if (walkable(px, u.y)) u.x = px;
  else {
    u.x = px;
    u.y = py;
  }
}

export class RampageWithWolves extends Minigame {
  static id = 'wolves';
  static name = 'Rampage With Wolves';
  static desc = 'Fetch grass from the pocket in the far north and bring it back to the Circle of Power in the south. 28 hungry wolves roam the camp: come within 80 of one and you are eaten.';
  static controls = 'Right-click or use the joystick to run. Touch a grass patch to pick it up (you carry one), then run it back to the circle.';
  static duration = 120;
  static ranking = 'race';

  setup() {
    this.map = {
      theme: 'grass',
      floor: { shape: 'rect', w: FX1 - FX0 + 6, h: SOUTH - NORTH + 6 },
      props: treeWalls(),
      bounds: Math.max(FX1, SOUTH) + 4,
      build: ['uxwolves'],
      wolves: { CIRCLE, GRASS, FIELD_N, COR0, COR1 },
      follow: true,
    };
    // Fixed starts: slot i at (7850 + 150 (i-1), 260), facing north.
    this.spawnHeroes(this.pids.map((_, i) => P(7850 + 150 * i, 260)), { hp: WOLVES.sheepHp, speed: WOLVES.sheepSpeed, r: WOLVES.sheepR, facing: -Math.PI / 2 });
    for (const u of this.heroes.values()) {
      u.skin = 'uxsheep';
      u.carry = false;
    }
    // Always 8 patches, whatever the number of players.
    this.grass = Array.from({ length: WOLVES.grass }, (_, i) => {
      const [x, y] = randIn(GRASS);
      return { id: 50000 + i, x, y, taken: false };
    });
    this.wolves = Array.from({ length: WOLVES.count }, () => {
      const [x, y] = campPoint();
      const w = new Unit({ kind: 'uxwolf', x, y, speed: WOLVES.wolfSpeed, r: WOLVES.wolfR });
      w.wander = rand(0, 9);
      return w;
    });
    this.redirect = WOLVES.redirect;
    this.dropId = 60000;
  }

  command(pid, m) {
    if (this.time >= WOLVES.pause) super.command(pid, m);
  }

  tick(dt) {
    if (this.time < WOLVES.pause) return;
    const before = new Map([...this.heroes.values()].map((u) => [u, [u.x, u.y]]));
    this.stepHeroes(dt);
    for (const [u, [px, py]] of before) if (u.alive) keepOut(u, px, py);
    this.stepWolves(dt);
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.finished) continue;
      if (!u.carry) {
        for (const g of this.grass) {
          if (g.taken || dist(u.x, u.y, g.x, g.y) > wc3(60)) continue;
          g.taken = true;
          u.carry = true;
          this.ev({ k: 'uxgrass', x: round2(g.x), y: round2(g.y) });
          break;
        }
      }
      if (u.carry && inRect(FINISH, u.x, u.y)) {
        u.carry = false;
        this.finish(pid);
        continue;
      }
      for (const w of this.wolves) {
        if (dist(u.x, u.y, w.x, w.y) > WOLVES.kill) continue;
        // The grass drops where the sheep died.
        if (u.carry) this.grass.push({ id: this.dropId++, x: u.x, y: u.y, taken: false });
        u.carry = false;
        this.eliminate(pid, 'death');
        break;
      }
    }
  }

  // Wolves wander (short hops round where they are, as WC3's Wander does) and
  // every 2 s one random wolf is sent to a random point of the camp.
  stepWolves(dt) {
    this.redirect -= dt;
    if (this.redirect <= 0) {
      this.redirect += WOLVES.redirect;
      const w = this.wolves[Math.floor(Math.random() * this.wolves.length)];
      w.order(...campPoint());
      w.wander = rand(3, 6);
    }
    for (const w of this.wolves) {
      w.wander -= dt;
      if (w.wander > 0) continue;
      // WC3 Wander: now and then, a short trot; often the wolf just stands.
      w.wander = rand(4, 9);
      if (Math.random() < 0.5) continue;
      for (let i = 0; i < 8; i++) {
        const a = rand(0, Math.PI * 2);
        const r = wc3(rand(100, 300));
        const x = w.x + Math.cos(a) * r;
        const y = w.y + Math.sin(a) * r;
        if (inRect(CAMP, x, y) && walkable(x, y)) {
          w.order(x, y);
          break;
        }
      }
    }
    const before = this.wolves.map((w) => [w.x, w.y]);
    stepUnits(this.wolves, dt);
    this.wolves.forEach((w, i) => keepOut(w, before[i][0], before[i][1]));
  }

  // Bots: up the middle through the gate and the corridor to the grass, then
  // back. They stop and back off when a wolf is close and heading their way,
  // as the designer's advice says ("know when to stop and keep your distance").
  botThink(pid, u, mem) {
    mem.caution ??= rand(1.3, 2.4);
    const goal = this.waypoint(u);
    if (!goal) return;
    // Try 16 headings (and standing still): predict every wolf's position over
    // the next 0.6 s from its move order, and take the heading that keeps the
    // most room while still making progress towards the goal.
    const look = [0.2, 0.45, 0.7, 1];
    const wolfAt = (w, t) => {
      if (!w.target) return [w.x, w.y];
      const d = dist(w.x, w.y, w.target.x, w.target.y);
      const k = Math.min(1, (WOLVES.wolfSpeed * t) / (d || 1));
      return [w.x + (w.target.x - w.x) * k, w.y + (w.target.y - w.y) * k];
    };
    const near = this.wolves.filter((w) => dist(u.x, u.y, w.x, w.y) < 9);
    const toGoal = Math.atan2(goal[1] - u.y, goal[0] - u.x);
    let best = null;
    let bestScore = -Infinity;
    for (let i = -1; i < 16; i++) {
      const a = i < 0 ? 0 : toGoal + (i * Math.PI) / 8;
      const sp = i < 0 ? 0 : WOLVES.sheepSpeed;
      let room = Infinity;
      for (const t of look) {
        const x = u.x + Math.cos(a) * sp * t;
        const y = u.y + Math.sin(a) * sp * t;
        if (!walkable(x, y)) room = Math.min(room, 0);
        for (const w of near) {
          const [wx, wy] = wolfAt(w, t);
          room = Math.min(room, dist(x, y, wx, wy) - WOLVES.kill - (w.target ? 0 : 0.6 * t));
        }
      }
      if (room <= 0.25) continue;
      const progress = i < 0 ? 0 : Math.cos(a - toGoal);
      const score = Math.min(room, mem.caution) * 2 + progress * 1.8;
      if (score > bestScore) {
        bestScore = score;
        best = i < 0 ? null : a;
      }
    }
    if (bestScore === -Infinity) best = toGoal + Math.PI; // nothing is safe: run
    if (best == null) return u.stop();
    if (Math.abs(best - toGoal) < 0.01 && dist(u.x, u.y, goal[0], goal[1]) < 2) return u.order(goal[0], goal[1]);
    u.order(u.x + Math.cos(best) * 1.5, u.y + Math.sin(best) * 1.5);
  }

  // The next point on the way: line up with the gate (or the corridor)
  // before going through it, so a bot never presses into the walls.
  waypoint(u) {
    const lane = ((u.owner * 0.618) % 1) * 2 - 1;
    const gx = clamp(u.x, GATE0 + 0.9, GATE1 - 0.9) * 0.4 + ((GATE0 + GATE1) / 2 + lane * ((GATE1 - GATE0) / 2 - 1)) * 0.6;
    const cx = clamp(u.x, COR0 + 0.7, COR1 - 0.7);
    const inGate = Math.abs(u.x - gx) < 0.3;
    const inCor = Math.abs(u.x - cx) < 0.3;
    if (!u.carry) {
      if (u.y > WALL_S) return inGate ? [gx, WALL_N - 1] : [gx, WALL_S + 1];
      if (u.y > FIELD_N + 0.2) return inCor ? [cx, FIELD_N - 1] : [cx, FIELD_N + 1];
      const g = this.grass.filter((v) => !v.taken).sort((p, q) => dist(u.x, u.y, p.x, p.y) - dist(u.x, u.y, q.x, q.y))[0];
      return g ? [g.x, g.y] : null;
    }
    if (u.y < FIELD_N + 0.2) return [cx, FIELD_N + 1.2];
    if (u.y < WALL_S + 0.2) return inGate ? [gx, WALL_S + 1.2] : [gx, WALL_N - 1];
    return CIRCLE;
  }

  progress(pid) {
    const u = this.heroes.get(pid);
    const span = SOUTH - NORTH;
    return u.carry ? 2 + (u.y - NORTH) / span : (SOUTH - u.y) / span;
  }

  hud(pid) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return null;
    return { label: u.carry ? 'Grass in your mouth: back to the circle in the south!' : 'Fetch grass from the pocket in the north' };
  }

  worldEnts() {
    const ents = this.wolves.map((w) => ({ id: w.id, k: 'uxwolf', x: round2(w.x), y: round2(w.y), f: round2(w.facing), mv: w.target ? 1 : undefined }));
    for (const g of this.grass) if (!g.taken) ents.push({ id: g.id, k: 'uxgrass', x: round2(g.x), y: round2(g.y) });
    return ents;
  }

  heroEnts(pid) {
    return super.heroEnts(pid).map((e) => (this.heroes.get(e.o)?.carry ? { ...e, carry: 1 } : e));
  }
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Tree walls round the walkable ground: the field edges, the gate wall and
// the corridor sides.
function treeWalls() {
  const props = [];
  const tree = (x, y) => props.push({ t: 'tree', x: x + rand(-0.3, 0.3), y: y + rand(-0.3, 0.3), s: rand(0.9, 1.3) });
  for (let y = FIELD_N; y <= SOUTH + 1; y += 2) {
    tree(FX0 - 1, y);
    tree(FX1 + 1, y);
  }
  for (let x = FX0 - 1; x <= FX1 + 1; x += 2) {
    tree(x, SOUTH + 1.2);
    if (x < COR0 - 0.8 || x > COR1 + 0.8) tree(x, FIELD_N - 1);
  }
  for (let y = NORTH - 1; y <= FIELD_N; y += 2) {
    tree(COR0 - 1, y);
    tree(COR1 + 1, y);
  }
  for (let x = COR0 - 1; x <= COR1 + 1; x += 2) tree(x, NORTH - 1.2);
  // The gate wall: two rows of pines, open between GATE0 and GATE1.
  for (let x = FX0; x <= FX1; x += 1.6) {
    if (x > GATE0 - 0.6 && x < GATE1 + 0.6) continue;
    tree(x, WALL_S - 0.8);
    tree(x + 0.8, WALL_N + 0.8);
  }
  return props;
}
