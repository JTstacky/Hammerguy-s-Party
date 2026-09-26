// Shared simulation helpers: Warcraft III-style "click to move" units with a
// separate knockback velocity that decays with friction, plus unit-unit
// collision. Used by every Hammerguy's Party minigame.
//
// Distances are Hammerguy units: 1 unit ≈ 54 WC3 units (speed 5 ≈ 270 u/s).

let nextId = 1;
export const newId = () => nextId++;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
export const round1 = (v) => Math.round(v * 10) / 10;
export const round2 = (v) => Math.round(v * 100) / 100;
export const wrapAngle = (a) => {
  a = (a + Math.PI) % (Math.PI * 2);
  return (a < 0 ? a + Math.PI * 2 : a) - Math.PI;
};

// WC3 unit scale: convert WC3 distances and speeds to Hammerguy units.
export const WU = 54;
export const wc3 = (u) => u / WU;

// Warcraft III movement model, measured with an instrumented map in WC3 1.26a
// (see docs/uther-party/engine.md and Arcane Arena's docs/wc3-observations.md).
//  - Each unit has its own 0.03 s logic step, at a phase of its own, so a new
//    order waits 0-0.03 s for the unit's next step.
//  - On each step the logical heading turns by at most the Turn Rate (radians
//    per step, no easing). The Propulsion Window (60°) is tested against the
//    heading BEFORE that step's turn; if it passes, the unit walks during the
//    step along the NEW heading. So a 90° turn starts walking on step 2 and a
//    180° turn on step 5 (turn rate 0.6).
//  - Walking is at full speed at once, with no acceleration, and stops dead
//    about 11 WC3 units short of the clicked point. A new order stops
//    translation immediately, even one in the same direction.
//  - The model on screen (GetUnitFacing) is a separate, slower display facing:
//    0.07 rad, then 0.14 rad, then at most min(turnRate, 0.2) rad per step,
//    easing out. After a 180° order the unit visibly walks backwards briefly.
export const WC3 = {
  STEP: 0.03,
  DISPLAY_MAX: 0.2,
  DISPLAY_RAMP: [0.07, 0.14],
  DEFAULT_TURN_RATE: 0.6,
  DEFAULT_PROP_WINDOW: (60 * Math.PI) / 180,
  ARRIVE: wc3(11),
};

export class Unit {
  constructor({ kind, owner = null, x = 0, y = 0, r = 0.6, speed = 5, hp = 0 }) {
    this.id = newId();
    this.kind = kind;
    this.owner = owner;
    this.x = x;
    this.y = y;
    this.r = r;
    this.speed = speed;
    this.speedMult = 1;
    this.vx = 0; // knockback velocity
    this.vy = 0;
    this.mx = 0; // last movement velocity (for bots / rendering)
    this.my = 0;
    this.heading = 0; // logical heading: decides where the unit walks
    this.facing = 0; // display facing: what the model shows
    this.dispSteps = 0;
    this.stepT = Math.random() * WC3.STEP; // this unit's own step phase
    this.walking = false;
    this.turnRate = WC3.DEFAULT_TURN_RATE; // radians per 0.03 s step (object editor "Turn Rate")
    this.propWindow = WC3.DEFAULT_PROP_WINDOW;
    this.faceTo = null; // angle to turn toward without walking (e.g. before a cast)
    this.target = null; // {x, y} move order
    this.alive = true;
    this.hp = hp;
    this.maxHp = hp;
    this.regen = 0;
    this.stun = 0;
    this.kbResist = 1; // multiplier on knockback received
    this.mass = 1;
    this.solid = true;
    this.flags = {};
  }

  // Sets both facings at once (spawning).
  setFacing(a) {
    this.heading = a;
    this.facing = a;
  }

  order(x, y) {
    this.target = { x, y };
    this.faceTo = null;
    this.walking = false;
  }

  // Moves the destination of an order already under way without WC3's stop.
  // Used when orders are re-issued continuously (a touch joystick, held
  // right-click), which would otherwise stutter. The next step still turns the
  // heading and tests the propulsion window as usual.
  steer(x, y) {
    if (!this.target) return this.order(x, y);
    this.target = { x, y };
    this.faceTo = null;
  }

  stop() {
    this.target = null;
    this.walking = false;
  }

  // True once the logical heading points at `angle` (within `tol` radians).
  facingAt(angle, tol = 1e-4) {
    return Math.abs(wrapAngle(angle - this.heading)) < tol;
  }

  // One 0.03 s logic step: turn the heading, gate walking on the window.
  logicStep() {
    if (this.stun > 0) {
      this.walking = false;
    } else if (this.target) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      if (Math.hypot(dx, dy) <= WC3.ARRIVE) {
        this.target = null;
        this.walking = false;
      } else {
        const diff = wrapAngle(Math.atan2(dy, dx) - this.heading);
        this.walking = Math.abs(diff) <= this.propWindow + 1e-9;
        this.heading = wrapAngle(this.heading + clamp(diff, -this.turnRate, this.turnRate));
      }
    } else if (this.faceTo != null) {
      const diff = wrapAngle(this.faceTo - this.heading);
      this.heading = Math.abs(diff) <= this.turnRate ? this.faceTo : wrapAngle(this.heading + Math.sign(diff) * this.turnRate);
    }
    // The model chases the heading, slower and eased.
    const rem = wrapAngle(this.heading - this.facing);
    if (Math.abs(rem) < 0.01) {
      this.facing = this.heading;
      this.dispSteps = 0;
    } else {
      const cap = Math.min(WC3.DISPLAY_RAMP[this.dispSteps] ?? WC3.DISPLAY_MAX, WC3.DISPLAY_MAX, Math.max(this.turnRate, 0.01));
      const step = Math.min(cap, Math.max(Math.abs(rem) * 0.65, 0.01));
      this.facing = wrapAngle(this.facing + Math.sign(rem) * step);
      this.dispSteps++;
    }
  }

  knock(dx, dy, force) {
    const l = Math.hypot(dx, dy) || 1;
    this.vx += (dx / l) * force * this.kbResist;
    this.vy += (dy / l) * force * this.kbResist;
  }

  get kbSpeed() {
    return Math.hypot(this.vx, this.vy);
  }
}

// Moves every living unit one tick. `friction` is the exponential decay rate
// of knockback velocity; `linear` a constant deceleration so knockback ends.
export function stepUnits(units, dt, { friction = 2.4, linear = 1.2, controlLoss = true } = {}) {
  for (const u of units) {
    if (!u.alive) continue;
    if (u.stun > 0) u.stun -= dt;
    if (u.regen && u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.regen * dt);

    u.stepT -= dt;
    while (u.stepT <= 0) {
      u.stepT += WC3.STEP;
      u.logicStep();
    }

    // Walking: full speed along the heading, no acceleration.
    u.mx = 0;
    u.my = 0;
    if (u.walking && u.target && u.stun <= 0) {
      // Heavy knockback reduces how much control you have (shove games).
      const sp = u.speed * u.speedMult * (controlLoss ? clamp(1 - u.kbSpeed / 18, 0.25, 1) : 1);
      u.mx = Math.cos(u.heading) * sp;
      u.my = Math.sin(u.heading) * sp;
      u.x += u.mx * dt;
      u.y += u.my * dt;
      if (dist(u.x, u.y, u.target.x, u.target.y) <= WC3.ARRIVE) {
        u.target = null;
        u.walking = false;
      }
    }
    // Shuffling round on the spot (for the walk animation).
    u.turning = !u.walking && (u.target != null || u.faceTo != null || Math.abs(wrapAngle(u.heading - u.facing)) > 0.05);

    // Knockback.
    const s = u.kbSpeed;
    if (s > 0) {
      u.x += u.vx * dt;
      u.y += u.vy * dt;
      const decay = Math.exp(-friction * dt);
      const ns = Math.max(0, s * decay - linear * dt);
      const k = ns / s;
      u.vx *= k;
      u.vy *= k;
    }
  }
}

// Unit-unit collision.
//  - WC3 units do not push each other. A walking unit steers around the unit
//    in its way (a 40-50 WC3-unit sidestep, losing 0.1-0.3 s), idle units are
//    never shoved, and passing units may overlap by 20-30 % of their combined
//    collision radii.
//  - Knocked units (shoves, explosions) are script motion, not walking: they
//    push apart and pass on part of their momentum, so a flying hammerguy can
//    bowl another one over.
export const PASS_OVERLAP = 0.25;
const KNOCKED = 1.5;

export function collideUnits(units) {
  for (let i = 0; i < units.length; i++) {
    const a = units[i];
    if (!a.alive || !a.solid) continue;
    for (let j = i + 1; j < units.length; j++) {
      const b = units[j];
      if (!b.alive || !b.solid) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const full = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= full * full) continue;
      const d = Math.sqrt(d2) || 0.001;
      const nx = d2 ? dx / d : 1;
      const ny = d2 ? dy / d : 0;
      if (a.kbSpeed > KNOCKED || b.kbSpeed > KNOCKED) {
        knockedCollision(a, b, nx, ny, full - d);
        continue;
      }
      const minD = full * (1 - PASS_OVERLAP);
      if (d >= minD) continue;
      const overlap = minD - d;
      const aw = a.walking;
      const bw = b.walking;
      if (aw && !bw) sidestep(a, -nx, -ny, overlap);
      else if (bw && !aw) sidestep(b, nx, ny, overlap);
      else if (aw && bw) {
        sidestep(a, -nx, -ny, overlap / 2);
        sidestep(b, nx, ny, overlap / 2);
      } else {
        // Two idle units overlapping (after a knockback): ease them apart.
        const s = Math.min(overlap, 0.05) / 2;
        a.x -= nx * s;
        a.y -= ny * s;
        b.x += nx * s;
        b.y += ny * s;
      }
    }
  }
}

// Moves a walking unit out of the way along (ox, oy), the direction away from
// the other unit, and slides it sideways past it rather than stalling.
function sidestep(u, ox, oy, overlap) {
  const hx = Math.cos(u.heading);
  const hy = Math.sin(u.heading);
  // Component of the push that is sideways to the unit's heading.
  const along = ox * hx + oy * hy;
  let sx = ox - along * hx;
  let sy = oy - along * hy;
  const sl = Math.hypot(sx, sy);
  if (sl < 0.2) {
    // Dead head-on: pick a side (stable per unit) and step round.
    const side = u.id % 2 ? 1 : -1;
    sx = -hy * side;
    sy = hx * side;
  } else {
    sx /= sl;
    sy /= sl;
  }
  u.x += ox * overlap + sx * overlap * 0.6;
  u.y += oy * overlap + sy * overlap * 0.6;
}

function knockedCollision(a, b, nx, ny, overlap) {
  const tm = a.mass + b.mass;
  a.x -= nx * overlap * (b.mass / tm);
  a.y -= ny * overlap * (b.mass / tm);
  b.x += nx * overlap * (a.mass / tm);
  b.y += ny * overlap * (a.mass / tm);
  const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (rel > 2) {
    const imp = rel * 0.6;
    a.vx -= nx * imp * (b.mass / tm);
    a.vy -= ny * imp * (b.mass / tm);
    b.vx += nx * imp * (a.mass / tm);
    b.vy += ny * imp * (a.mass / tm);
  }
}

export function clampToRect(u, hw, hh) {
  u.x = clamp(u.x, -hw + u.r, hw - u.r);
  u.y = clamp(u.y, -hh + u.r, hh - u.r);
}

export function clampToCircle(u, R) {
  const d = Math.hypot(u.x, u.y);
  const max = R - u.r;
  if (d > max) {
    u.x *= max / d;
    u.y *= max / d;
  }
}

export function unitSnap(u, extra = {}) {
  const s = { id: u.id, k: u.kind, x: round2(u.x), y: round2(u.y), f: round2(u.facing) };
  if (u.owner != null) s.o = u.owner;
  if (u.maxHp) {
    s.hp = Math.ceil(u.hp);
    s.mhp = u.maxHp;
  }
  if (!u.alive) s.dead = 1;
  if (u.mx || u.my) s.mv = 1;
  else if (u.turning) s.tn = 1;
  return Object.assign(s, extra);
}
