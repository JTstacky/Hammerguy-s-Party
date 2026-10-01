import { Minigame } from '../../base.js';
import { newId, clamp, round2, wc3, shuffle } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';
import { arrive, withoutGone, ordinal } from './race-kit.js';

// Uther Party 4.0 #24 "Horse Race" (docs/uther-party/rules-4.0.md): eight
// walled 64 u lanes down a 4992x1024 track, one runner per lane, so nobody can
// touch anybody. Speed is a sawtooth: every 0.05 s it drops by 2 u/s (40 u/s
// per second) down to a floor of 60, and Speed Boost resets it to 320. You
// get exactly four boosts (100 of 400 mana, 1 s cooldown). The runners are
// held for the first 6 s, which the 60 s timer includes. Coasting, a runner
// never makes the 4544 u (61.7 s); well-spaced boosts finish in about 18 s.
// Race: 8, 7, 6 ... by arrival.
//
// Coordinates: WC3 (x, y) maps to (wc3(x - 2240), -wc3(y - 6400)).

const P = (x, y) => [wc3(x - 2240), -wc3(y - 6400)];
const HW = wc3(2496);
const HH = wc3(512);
export const HORSE = { top: 320, floor: 60, drop: 2, tick: 0.05, boosts: 4, cd: 1, r: wc3(16) };
export const START_X = -64;
export const FINISH_X = 4480;
export const PAUSE = 6;
const WALL_END = P(4608 + 32, 0)[0];
const LANE_FREE = wc3(32) - HORSE.r; // half the 64 u corridor, less the runner's collision
// Lane centre (WC3 y) by slot 1-8.
const SLOT_Y = [6880, 6496, 6112, 6752, 6368, 5984, 6624, 6240];

export class HorseRace extends Minigame {
  static id = 'horserace';
  static name = 'Horse Race';
  static desc = "Press Q to speed up, but don't overdo it! Everyone runs in a private lane. Your speed drains away the whole time, and each of your four boosts resets it to full. Space them well: too early or too late and you won't make it.";
  static controls = 'Q: Speed Boost (4 uses) resets your speed to full. You run on your own after the start; right-click only steers.';
  static duration = 60;
  static ranking = 'race';

  setup() {
    const lanes = shuffle(SLOT_Y.slice(0, Math.min(8, this.pids.length)));
    this.map = {
      theme: 'grass',
      floor: { shape: 'rect', w: HW * 2, h: HH * 2 },
      props: treesAroundRect(HW, HH, 0.35, 2.4),
      build: ['horserace'],
      hr: {
        walls: Array.from({ length: 8 }, (_, j) => round2(P(0, 5920 + 128 * j)[1])),
        x0: round2(P(-256, 0)[0]),
        x1: round2(P(4608, 0)[0]),
        finish: round2(P(FINISH_X, 0)[0]),
        start: round2(P(START_X, 0)[0]),
        posts: round2(P(-224, 0)[0]),
        lanes: lanes.map((y) => round2(P(0, y)[1])),
      },
      bounds: HW + 2,
    };
    this.abilities = [
      {
        name: 'Speed Boost',
        icon: '🐎',
        desc: 'Resets your speed to full (320). Four uses. It drains again at once.',
        kind: 'instant',
        charges: HORSE.boosts,
        cd: HORSE.cd,
        available: () => this.time >= PAUSE,
        cast: (pid, u) => this.boost(pid, u),
      },
    ];
    // Up to eight lanes; a ninth or tenth player shares one (the original has 8 slots).
    this.laneOf = new Map(this.pids.map((pid, i) => [pid, P(0, lanes[i % lanes.length])[1]]));
    this.spawnHeroes(this.pids.map((pid) => [P(START_X, 0)[0], this.laneOf.get(pid)]), { speed: wc3(HORSE.top), r: HORSE.r, facing: 0 });
    for (const u of this.heroes.values()) u.skin = 'renegade';
    this.ws = new Map(this.pids.map((p) => [p, HORSE.top])); // speed in WC3 u/s
    // Runners in the same lane (only past 8 players) pass through each other.
    if (this.pids.length > 8) for (const u of this.heroes.values()) u.solid = false;
    this.acc = 0;
    this.started = false;
    this.cops = lanes.map((y) => ({ id: newId(), x: P(4544, 0)[0], y: P(0, y)[1] }));
  }

  boost(pid, u) {
    this.ws.set(pid, HORSE.top);
    u.speed = wc3(HORSE.top);
    this.ev({ k: 'hrboost', u: u.id, x: round2(u.x), y: round2(u.y) });
    // Horse Speed: after any cast, the computer runners are sent on to the finish.
    for (const [bp] of this.bots) this.runOn(bp);
  }

  runOn(pid) {
    const u = this.heroes.get(pid);
    if (u?.alive && !u.finished) u.order(P(4608, 0)[0], this.laneOf.get(pid));
  }

  tick(dt) {
    if (this.time < PAUSE) return; // everyone is paused for the first 6 s
    if (!this.started) {
      this.started = true;
      for (const pid of this.pids) this.runOn(pid);
      this.ev({ k: 'sfx', s: 'start' });
    }
    // Horse Slow, every 0.05 s, with the computer players' boost roll inside it.
    this.acc += dt;
    while (this.acc >= HORSE.tick) {
      this.acc -= HORSE.tick;
      for (const [pid, u] of this.heroes) {
        if (!u.alive || u.finished) continue;
        const s = this.ws.get(pid);
        this.ws.set(pid, s > HORSE.floor ? s - HORSE.drop : HORSE.floor);
        u.speed = wc3(this.ws.get(pid));
        if (this.bots.has(pid) && this.ws.get(pid) < 270 && Math.random() < 1 / 40) this.useAbility(pid, 0, u.x, u.y);
      }
    }
    this.stepHeroes(dt);
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.finished) continue;
      u.x = clamp(u.x, -HW + u.r, HW - u.r);
      if (u.x < WALL_END) {
        const ly = this.laneOf.get(pid);
        u.y = clamp(u.y, ly - LANE_FREE, ly + LANE_FREE);
      } else u.y = clamp(u.y, -HH + u.r, HH - u.r);
      if (u.x >= P(FINISH_X, 0)[0]) arrive(this, pid);
    }
  }

  // Computer runners are driven from tick (the Horse Slow loop), as in the original.
  botThink() {}

  progress(pid) {
    return this.heroes.get(pid).x;
  }

  heroEnts(pid) {
    const ents = withoutGone(this, super.heroEnts(pid));
    for (const e of ents) {
      e.fx = (e.fx || []).filter((f) => f !== 'slow');
      if (!e.fx.length) delete e.fx;
      const s = this.ws.get(e.o);
      if (s != null) e.ws = s; // for the dust and the speed gauge
    }
    return ents;
  }

  hud(pid) {
    const u = this.heroes.get(pid);
    if (!u) return null;
    if (u.finished) return { label: `Home! ${ordinal(this.finishOrder.indexOf(pid) + 1)} place` };
    if (this.time < PAUSE) return { label: `Get ready... ${Math.ceil(PAUSE - this.time)}` };
    const left = this.acharges.get(pid)?.[0] ?? 0;
    return { label: `Speed ${this.ws.get(pid)} · ${left} boost${left === 1 ? '' : 's'} left` };
  }

  worldEnts() {
    return this.cops.map((c) => ({ id: c.id, k: 'cop', x: round2(c.x), y: round2(c.y), s: 1, r: 0.75 }));
  }
}

