// Client-side prediction for the player's own hammerguy, so it reacts the
// moment an order is given instead of a network round trip later. Same
// approach (and interface) as Arcane Arena's predictor:
//
// Each snapshot carries the hero's exact movement state (`me.pr`, from the
// minigame's predictState) and the sequence number of the last order the
// host handled. From that state the client re-runs the host's own steps
// (stepUnits, the same code), with the orders the host hasn't handled yet
// replayed at the moment they will reach it, up to the time the host will be
// handling an order given now. Anything the client can't foresee (a shove, a
// collision, a kodo) arrives in the next snapshot; the difference is blended
// out over a few frames, or snapped if it is a jump.
//
// Walking is predicted, and so is the start of an ability that needs no
// target picking (the hero stops, turns and stands for the cast point); the
// host flags which those are. Abilities that target a unit, and attacks,
// start when the host says so.

import { Unit, stepUnits, wrapAngle, clampToRect, clampToCircle } from '../server/sim.js';
import { TICK_RATE } from '../shared/constants.js';

const STEP = 1 / TICK_RATE; // one host tick
const MAX_STEPS = 24; // never simulate more than 0.8 s ahead
const SNAP_DIST = 3; // metres: a bigger correction is a jump, not drift
const BLEND = 12; // how fast a correction is blended out (per second)

export class Predictor {
  constructor() {
    this.seq = 0;
    this.log = []; // recent orders: { q, m, at } (local send time)
    this.rtts = [];
    this.rtt = 0.1;
    this.ahead = null; // how far ahead the hero is shown; eases toward rtt
    this.base = null; // { pr, tick }
    this.used = null; // the base last frame's prediction was made from
    this.unit = new Unit({ kind: 'predict' });
    this.err = { x: 0, y: 0 };
    this.out = { x: 0, y: 0, f: 0, moving: false, turning: false };
  }

  // Tags an outgoing order with a sequence number and remembers it.
  order(m) {
    if (m.t !== 'cmd') return m;
    m.q = ++this.seq;
    this.log.push({ q: m.q, m, at: performance.now() / 1000 });
    if (this.log.length > 64) this.log.shift();
    return m;
  }

  // A new snapshot: measure the round trip and rebase.
  snapshot(snap) {
    const pr = snap.me?.pr;
    if (!pr) {
      this.base = this.used = null;
      return;
    }
    const acked = this.log.find((o) => o.q === pr.sq);
    if (acked && pr.sk != null && acked.sk == null) {
      // The host says which tick the order first took part in: the exact
      // lead is measured in frame(), where the host's clock is known.
      acked.sk = pr.sk;
      (this.leads ||= []).push(acked);
    } else if (acked && !acked.rtt && pr.sk == null) {
      // Send to "handled and reported" is the round trip plus up to a
      // snapshot interval of waiting; the smallest recent sample is closest.
      acked.rtt = performance.now() / 1000 - acked.at;
      this.rtts.push(acked.rtt);
      if (this.rtts.length > 20) this.rtts.shift();
      this.rtt = Math.min(...this.rtts);
    }
    this.base = { pr, tick: snap.tk };
  }

  // The predicted hero for this frame, or null. `serverNow` is the host's
  // clock as best known (local time minus the clock offset).
  frame(serverNow, dt) {
    const b = this.base;
    if (!b) return null;
    const localToHost = serverNow - performance.now() / 1000;
    if (this.leads?.length) {
      // How long after it was sent (in host time) an order takes part in a
      // tick: the lead the prediction must run ahead by.
      for (const o of this.leads) this.rtts.push(o.sk * STEP - (o.at + localToHost));
      this.leads.length = 0;
      while (this.rtts.length > 20) this.rtts.shift();
      this.rtt = Math.max(0, Math.min(...this.rtts));
    }
    // Show the hero as it will be when an order given now lands. The lead
    // eases toward a changed round trip so the hero never skips.
    if (this.ahead == null) this.ahead = this.rtt;
    else this.ahead += Math.max(-0.25 * dt, Math.min(0.25 * dt, this.rtt - this.ahead));
    const at = serverNow + this.ahead;
    const cur = this.simulate(b, at, localToHost);
    if (this.used && this.used !== b) {
      // A new snapshot moved the prediction: keep the hero where it was
      // shown and blend the difference out, unless it is a jump.
      const old = this.simulate(this.used, at, localToHost);
      this.err.x += old.x - cur.x;
      this.err.y += old.y - cur.y;
      if (Math.hypot(this.err.x, this.err.y) > SNAP_DIST) this.err.x = this.err.y = 0;
    }
    this.used = b;
    const k = Math.exp(-BLEND * dt);
    this.err.x *= k;
    this.err.y *= k;
    const o = this.out;
    o.x = cur.x + this.err.x;
    o.y = cur.y + this.err.y;
    o.f = cur.f;
    o.moving = cur.moving;
    o.turning = cur.turning;
    return o;
  }

  // Runs the hero from a snapshot's state to host time `at`, applying the
  // orders the host hadn't handled yet when they reach it.
  simulate(base, at, localToHost) {
    const u = this.load(base.pr);
    const t0 = base.tick * STEP;
    const span = Math.max(0, at - t0);
    const steps = Math.min(MAX_STEPS, Math.floor(span / STEP));
    const frac = Math.min(1, span / STEP - steps);
    const lead = this.rtt;
    const log = this.log;
    let i = 0;
    while (i < log.length && log[i].q <= base.pr.sq) i++;
    const r = {};
    // One step past `at`, so the hero is drawn between the two steps it falls
    // between, as the host's own motion is.
    for (let n = 0; n <= steps; n++) {
      // The host handles an order that arrives during a tick just before it.
      const tNext = t0 + (n + 1) * STEP;
      while (i < log.length && log[i].at + localToHost + lead <= tNext + 1e-6) this.apply(u, log[i++].m, base.pr);
      if (n === steps) {
        r.x = u.x;
        r.y = u.y;
        r.f = u.facing;
      }
      this.step(u, base.pr);
    }
    r.x += (u.x - r.x) * frac;
    r.y += (u.y - r.y) * frac;
    r.f += wrapAngle(u.facing - r.f) * frac;
    r.moving = !!(u.mx || u.my);
    r.turning = !!u.turning;
    return r;
  }

  // ------------------------------------------------ the host's rules, mirrored

  load(pr) {
    const u = this.unit;
    u.x = pr.x;
    u.y = pr.y;
    u.r = pr.r;
    u.heading = pr.h;
    u.facing = pr.f;
    u.dispSteps = pr.ds || 0;
    u.stepT = pr.ph;
    u.walking = !!pr.w;
    u.target = pr.t ? { x: pr.t[0], y: pr.t[1] } : null;
    u.faceTo = pr.ft;
    u.vx = pr.v[0];
    u.vy = pr.v[1];
    u.speed = pr.sp;
    u.speedMult = 1;
    u.turnRate = pr.tr;
    u.propWindow = pr.pw;
    u.stun = pr.st;
    u.alive = true;
    u.pc = pr.c ? { ...pr.c } : null;
    u.ready = pr.ca ? pr.ca.map((a) => !!a?.[2]) : [];
    u.mx = u.my = 0;
    return u;
  }

  // Minigame.command, for walking orders and the casts the host says can be
  // predicted (see Minigame.predictableCasts).
  apply(u, m, pr) {
    const x = +m.x || 0;
    const y = +m.y || 0;
    if (m.c === 'cast') return this.cast(u, m, x, y, pr);
    if (m.c !== 'move' && m.c !== 'steer' && m.c !== 'stop') return;
    if (u.pc) u.pc.q = m.c === 'stop' ? 'stop' : { x, y };
    else if (m.c === 'move') u.order(x, y);
    else if (m.c === 'steer') u.steer(x, y);
    else u.stop();
  }

  // Minigame.useAbility / castSpell: stop, turn to face the point if the
  // ability needs it, then stand for the cast point.
  cast(u, m, x, y, pr) {
    const slot = Number.isInteger(m.slot) ? m.slot : +(/^s([0-3])$/.exec(String(m.spell ?? ''))?.[1] ?? 0);
    const a = pr.ca?.[slot];
    if (!a || !u.ready[slot] || u.pc) return;
    u.ready[slot] = false;
    u.stop();
    if (a[1]) {
      const angle = Math.atan2(y - u.y, x - u.x);
      u.pc = { a: angle, t: -1, cp: a[0], tol: 1e-4, q: null };
      u.faceTo = angle;
    } else u.pc = { a: u.heading, t: 0, cp: a[0], tol: 1e-4, q: null };
  }

  // Minigame.stepHeroes for one hero: stepUnits, then stepCasts, then the
  // minigame's arena clamp.
  step(u, pr) {
    stepUnits([u], STEP, { friction: pr.fr });
    const c = u.pc;
    if (c) {
      if (c.t < 0) {
        if (u.facingAt(c.a, c.tol)) {
          c.t = 0;
          u.faceTo = null;
        }
      } else {
        c.t += STEP;
        if (c.t >= c.cp) {
          u.pc = null;
          if (c.q === 'stop') u.stop();
          else if (c.q) u.order(c.q.x, c.q.y);
        }
      }
    }
    if (pr.b?.[0] === 'r') clampToRect(u, pr.b[1], pr.b[2]);
    else if (pr.b?.[0] === 'c') clampToCircle(u, pr.b[1]);
  }
}
