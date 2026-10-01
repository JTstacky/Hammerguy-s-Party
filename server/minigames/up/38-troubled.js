import { newId, rand, round2, wc3, clamp } from '../../../engine/server/sim.js';
import { GridRace, toServer, rectFromWc3, randIn } from './walkgrid.js';

// Uther Party 4.0 #38 "Troubled Waters" (docs/uther-party/rules-4.0.md): a
// 3968x384 track of three 128 u lanes running east. Hermit crabs (speed 200,
// 15 HP, collision 15) start at the west end and race to the circle near the
// east end. Every 2.5 s from t=2.5, two tidal waves appear 256 u past the
// finish, each in a random lane (a duplicate lane is dropped, so at least one
// lane is always open), and slide west 16 u every 0.05 s (320 u/s). Anyone
// within 64 u of a wave dies (checked every 0.05 s). 90 s limit.
//
// Bots: the original has no AI trigger, only one "move to finish" order at
// t=4, so its bots live by luck. Ours get the same late start but pick a clear
// lane, so they finish sometimes.
const CX = -2880;
const CY = -6848;
const conv = toServer(CX, CY);
const HW = wc3(1984);
const HH = wc3(192);
export const LANES = [-6720, -6848, -6976].map((Y) => conv(0, Y)[1]); // north, middle, south
export const CRAB = { speed: wc3(200), r: wc3(15), hp: 15 };
export const WAVE_X = conv(-1024, 0)[0];
export const STEP = wc3(16);
export const TICK = 0.05;
export const KILL_R = wc3(64);
export const PERIOD = 2.5;
const BOT_START = 4;

export class TroubledWaters extends GridRace {
  static id = 'troubled';
  static name = 'Troubled Waters';
  static desc = 'Reach the end! Scuttle down a three-lane channel as rows of tidal waves roll toward you. Every row leaves at least one lane open: look ahead and switch lanes in time.';
  static controls = 'Right-click to move. A wave kills anything in its lane.';
  static duration = 90;
  static ranking = 'race';

  setup() {
    this.map = {
      theme: 'troubled',
      floor: { shape: 'rect', w: HW * 2, h: HH * 2 },
      props: shoreProps(),
      bounds: HW,
      build: ['troubled'],
      lanes: LANES.map(round2),
      finish: [round2(conv(-1280, 0)[0]), 0],
    };
    this.startRect = rectFromWc3(conv, -4864, -7040, -4736, -6656);
    this.finishRect = rectFromWc3(conv, -1408, -7040, -1152, -6656);
    this.goal = { x: (this.finishRect.x0 + this.finishRect.x1) / 2, y: 0 };
    const m = CRAB.r;
    const s = this.startRect;
    this.spawnHeroes(this.pids.map(() => randIn({ x0: s.x0 + m, x1: s.x1 - m, y0: s.y0 + m, y1: s.y1 - m })), { ...CRAB, facing: 0 });
    for (const u of this.heroes.values()) u.skin = 'hermitcrab';
    this.waves = [];
    this.spawnT = PERIOD;
    this.acc = 0;
    this.circleId = newId();
  }

  tick(dt) {
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT += PERIOD;
      const a = Math.floor(Math.random() * 3);
      const b = Math.floor(Math.random() * 3);
      this.spawnWave(a);
      if (b !== a) this.spawnWave(b);
    }
    this.stepRace(dt);
    for (const u of this.heroes.values()) {
      if (!u.alive || u.finished) continue;
      u.x = clamp(u.x, -HW + u.r, HW - u.r);
      u.y = clamp(u.y, -HH + u.r, HH - u.r);
    }
    for (const [pid, u] of this.heroes) if (u.alive && !u.finished && this.inRect(u, this.finishRect)) this.finish(pid);
    this.acc += dt;
    while (this.acc >= TICK) {
      this.acc -= TICK;
      for (const w of this.waves) w.x -= STEP;
      for (const [pid, u] of this.heroes) {
        if (!u.alive || u.finished) continue;
        if (this.waves.some((w) => Math.hypot(w.x - u.x, w.y - u.y) <= KILL_R)) this.eliminate(pid, 'drown');
      }
    }
    // The original never cleans its waves up (they slide off the map); ours go once past the start.
    this.waves = this.waves.filter((w) => w.x > -HW - 3);
  }

  spawnWave(lane) {
    this.waves.push({ id: newId(), x: WAVE_X, y: LANES[lane], lane });
  }

  // Look ahead along each lane: time until the next wave reaches us while we
  // run east (closing speed 520 u/s); keep to a lane that stays clear.
  botThink(pid, u, mem) {
    if (this.time < BOT_START) return;
    if (Math.random() > mem.skill + 0.4) {
      if (!u.target) u.order(this.goal.x, u.y);
      return;
    }
    const close = u.speed + STEP / TICK;
    const clear = LANES.map((ly) => {
      let t = Infinity;
      for (const w of this.waves) {
        if (Math.abs(w.y - ly) > 0.1) continue;
        const gap = w.x - u.x;
        if (gap < -KILL_R - u.r) continue;
        t = Math.min(t, Math.max(0, (gap - KILL_R - u.r) / close));
      }
      return t;
    });
    const cur = LANES.reduce((bi, ly, i) => (Math.abs(ly - u.y) < Math.abs(LANES[bi] - u.y) ? i : bi), 0);
    // Moving one lane over (128 u) takes 0.64 s.
    let best = cur;
    if (clear[cur] < 1.0) {
      let bt = -1;
      LANES.forEach((ly, i) => {
        const cost = Math.abs(ly - u.y) / u.speed;
        const margin = clear[i] - cost;
        if (Math.abs(i - cur) === 2 && clear[1] < cost * 0.6) return; // can't cross a blocked middle lane
        if (margin > bt) {
          bt = margin;
          best = i;
        }
      });
    }
    const ly = LANES[best];
    if (best === cur && Math.abs(u.y - ly) < 0.15) u.steer(this.goal.x + 2, ly);
    else if (Math.abs(u.y - ly) > 0.05) {
      // Sidestep across (with a little forward drift if there is time).
      const fwd = clear[best] > 1.2 ? 0.6 : 0;
      u.steer(u.x + fwd, ly);
    } else u.steer(this.goal.x + 2, ly);
  }

  hud() {
    return null;
  }

  worldEnts() {
    const ents = this.waves.map((w) => ({ id: w.id, k: 'tidalwave', x: round2(w.x), y: round2(w.y), f: Math.PI }));
    ents.push({ id: this.circleId, k: 'powercircle', x: round2(this.goal.x), y: 0, f: 0, s: 2 });
    return ents;
  }
}

// Rocks, coral and driftwood on the banks.
function shoreProps() {
  const props = [];
  for (let x = -HW - 3; x <= HW + 3; x += rand(1.5, 3.2)) {
    props.push({ t: 'rock', x: x + rand(-0.5, 0.5), y: HH + rand(1.2, 2.8), s: rand(0.4, 1) });
    if (Math.random() < 0.5) props.push({ t: 'bush', x: x + rand(-0.8, 0.8), y: HH + rand(3, 5), s: rand(0.6, 1) });
    if (Math.random() < 0.3) props.push({ t: 'tree', x: x + rand(-0.8, 0.8), y: HH + rand(5, 8), s: rand(0.8, 1.3) });
    if (Math.random() < 0.35) props.push({ t: 'rock', x: x + rand(-0.5, 0.5), y: -HH - rand(1.5, 3.5), s: rand(0.5, 1.4) });
  }
  return props;
}
