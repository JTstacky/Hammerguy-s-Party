import { Minigame } from '../../base.js';
import { newId, rand, dist, round2, wc3, clamp, clampToRect } from '../../../engine/server/sim.js';

// Uther Party 4.0 #20 "The Spike Pit" (docs/uther-party/rules-4.0.md): a
// 2304x1280 pit with a spike on every 128 u tile centre except the four
// corners (176). Every 0.25 s an invisible point P moves Real_Speed u along
// its heading; the speed grows by 0.2 each tick (3.2t u/s, 270 at about 84 s),
// the heading turns 0-5° counter-clockwise, and P turns back toward the centre
// whenever it leaves the pit. Spikes within 400 of P retract, spikes 512 or
// more away rise again, and every raised spike kills anyone within 128. The
// spikes near the centre start retracted. Deaths in the same tick tie. No
// timer: the ramp ends it.
const HW = wc3(1152);
const HH = wc3(640);
const STEP = wc3(128);
const LOWER_R = wc3(400);
const RAISE_R = wc3(512);
const KILL_R = wc3(128);
const TICK = 0.25;
const ACCEL = 0.2; // WC3 units per tick, per tick
const DEG = Math.PI / 180;

export const SPIKES = (() => {
  const out = [];
  for (let j = 0; j < 10; j++) {
    for (let i = 0; i < 18; i++) {
      if ((i === 0 || i === 17) && (j === 0 || j === 9)) continue;
      out.push([wc3(-1088 + 128 * i), wc3(-576 + 128 * j)]);
    }
  }
  return out;
})();

export class SpikePit extends Minigame {
  static id = 'spikes';
  static name = 'The Spike Pit';
  static desc = 'Spikes cover the floor of the pit, except round one moving spot where they sink into the ground. The spot wanders and gets faster and faster, and the spikes shoot up again behind it. Stay off the spikes!';
  static controls = 'Right-click to move. A raised spike within reach kills you at once, so stay where the spikes are down.';
  static duration = 300;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'undercroft', floor: { shape: 'rect', w: HW * 2, h: HH * 2 }, props: [], build: ['spikes'], bounds: HW + 1, spikes: { hw: round2(HW), hh: round2(HH), step: round2(STEP) } };
    // Militia: speed 270, collision 15, 50-100 u from the centre, random facing.
    this.spawnHeroes(
      this.pids.map(() => {
        const a = rand(0, Math.PI * 2);
        const r = wc3(rand(50, 100));
        return [Math.cos(a) * r, Math.sin(a) * r];
      }),
      { r: wc3(15) },
    );
    for (const u of this.heroes.values()) u.skin = 'militia';
    for (const u of this.heroes.values()) u.setFacing(rand(-Math.PI, Math.PI));
    this.up = SPIKES.map(([x, y]) => Math.hypot(x, y) > LOWER_R);
    this.p = { x: 0, y: 0, speed: 0, a: rand(0, Math.PI * 2) }; // speed in WC3 units per tick
    this.workT = rand(0, TICK);
    this.gridId = newId();
  }

  tick(dt) {
    this.stepHeroes(dt);
    for (const u of this.heroes.values()) if (u.alive) clampToRect(u, HW, HH);
    this.workT -= dt;
    while (this.workT <= 0) {
      this.workT += TICK;
      this.spikeWork();
    }
  }

  // One tick of the original's "Spike Work" trigger.
  spikeWork() {
    const P = this.p;
    P.x += Math.cos(P.a) * wc3(P.speed);
    P.y += Math.sin(P.a) * wc3(P.speed);
    P.speed = Math.min(400, P.speed + ACCEL);
    if (Math.abs(P.x) > HW || Math.abs(P.y) > HH) P.a = Math.atan2(-P.y, -P.x);
    P.a += rand(0, 5) * DEG;
    let rose = 0;
    SPIKES.forEach(([x, y], i) => {
      const d = dist(x, y, P.x, P.y);
      if (d <= LOWER_R) this.up[i] = false;
      else if (d >= RAISE_R && !this.up[i]) {
        this.up[i] = true;
        rose++;
      }
    });
    if (rose) this.ev({ k: 'sfx', s: 'smack' });
    const dead = [];
    for (const [pid, u] of this.heroes) {
      if (!u.alive) continue;
      if (SPIKES.some(([x, y], i) => this.up[i] && dist(x, y, u.x, u.y) <= KILL_R)) dead.push(pid);
    }
    for (const pid of dead) this.eliminate(pid, 'spikeimpale');
  }

  // The original's bots: every 1 s walk to a random point within 128 of P's
  // current position. They do not lead it, so they fall behind as it speeds
  // up; better bots here lead it a little.
  botThink(pid, u, mem) {
    mem.t = (mem.t ?? rand(0, 1)) - 0.22;
    const safeHere = this.safeAt(u.x, u.y);
    if (mem.t > 0 && safeHere) return;
    mem.t = 1;
    const P = this.p;
    const v = wc3(P.speed) / TICK; // units per second
    const lead = Math.random() < mem.skill ? 0.6 * mem.skill : 0;
    const a = rand(0, Math.PI * 2);
    const r = wc3(rand(0, 128));
    const x = clamp(P.x + Math.cos(P.a) * v * lead + Math.cos(a) * r, -HW + 0.5, HW - 0.5);
    const y = clamp(P.y + Math.sin(P.a) * v * lead + Math.sin(a) * r, -HH + 0.5, HH - 0.5);
    u.order(x, y);
  }

  safeAt(x, y) {
    return !SPIKES.some(([sx, sy], i) => this.up[i] && dist(sx, sy, x, y) <= KILL_R + 0.4);
  }

  worldEnts() {
    // Raised spikes as a hex bit string (176 bits).
    let s = '';
    for (let i = 0; i < this.up.length; i += 4) {
      let n = 0;
      for (let b = 0; b < 4; b++) if (this.up[i + b]) n |= 1 << b;
      s += n.toString(16);
    }
    return [{ id: this.gridId, k: 'spikegrid', x: 0, y: 0, up: s }];
  }
}

export const SPIKE_PIT = { HW, HH, LOWER_R, RAISE_R, KILL_R, TICK, ACCEL };
