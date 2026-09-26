// Touch controls for phones and tablets. WC3 has none, so this maps its mouse
// orders onto thumbs and sends the same commands the mouse does:
//  - Left side: a floating joystick. Holding it steers the hero toward a point
//    just ahead of it ('steer' orders, re-sent while held); letting go stops.
//  - Right side: a tap is a right-click (move there), or the target of a
//    spell waiting for one. Holding keeps moving toward the finger. Two
//    fingers pinch to zoom.
//  - The command card becomes big thumb buttons (CSS: body.touch).
// The camera always follows the hero on touch.

import { unlockAudio } from './audio.js';

const STICK_ZONE = 0.42; // left fraction of the screen that starts the joystick
const STICK_R = 56; // px: knob travel
const DEAD = 10; // px: dead zone
const AHEAD = 2; // world units: how far ahead of the hero a steer order points
const RESEND = 100; // ms between steer orders while the stick is held
const TAP_MS = 250;
const TAP_PX = 14;

export class TouchControls {
  constructor(input) {
    this.input = input;
    this.world = input.world;
    this.stick = null; // { id, ox, oy, x, y, dir, sent, last }
    this.fingers = new Map(); // right-side touches: id -> { x, y, x0, y0, t0, hold }
    this.pinch = null;
    document.body.classList.add('touch');

    this.el = document.createElement('div');
    this.el.id = 'joy';
    this.el.innerHTML = '<div class="joy-base"><div class="joy-knob"></div></div>';
    document.getElementById('hud').appendChild(this.el);
    this.base = this.el.firstChild;
    this.knob = this.base.firstChild;

    const c = this.world.canvas;
    // Stop the browser from scrolling, zooming or firing mouse events for touches.
    c.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    c.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e, true));
    setInterval(() => this.tick(), RESEND);
  }

  get active() {
    return this.input.active;
  }

  down(e) {
    if (e.pointerType === 'mouse') return;
    unlockAudio();
    this.world.follow = true;
    if (!this.stick && e.clientX < innerWidth * STICK_ZONE && !this.input.targeting) {
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY, dir: null, sent: false, last: 0 };
      this.el.classList.add('on');
      this.base.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      this.knob.style.transform = '';
      return;
    }
    const f = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), hold: false };
    this.fingers.set(e.pointerId, f);
    if (this.fingers.size === 2) {
      // Second finger: pinch zoom, and neither finger counts as a tap.
      const [a, b] = [...this.fingers.values()];
      this.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: this.world.zoom };
      for (const g of this.fingers.values()) g.hold = 'pinch';
    }
  }

  move(e) {
    const s = this.stick;
    if (s && e.pointerId === s.id) {
      s.x = e.clientX;
      s.y = e.clientY;
      let dx = s.x - s.ox;
      let dy = s.y - s.oy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_R) {
        dx *= STICK_R / len;
        dy *= STICK_R / len;
      }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const dir = len > DEAD ? Math.atan2(dy, dx) : null;
      // Send at once on a real change of direction; otherwise tick() keeps it going.
      const turned = dir != null && (s.dir == null || Math.abs(Math.atan2(Math.sin(dir - s.dir), Math.cos(dir - s.dir))) > 0.2);
      s.dir = dir;
      if (turned && performance.now() - s.last > 50) this.steer();
      return;
    }
    const f = this.fingers.get(e.pointerId);
    if (!f) return;
    f.x = e.clientX;
    f.y = e.clientY;
    if (this.pinch && this.fingers.size === 2) {
      const [a, b] = [...this.fingers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      this.world.zoom = Math.max(14, Math.min(64, this.pinch.z0 * (this.pinch.d0 / d)));
    }
  }

  up(e, cancelled = false) {
    const s = this.stick;
    if (s && e.pointerId === s.id) {
      this.stick = null;
      this.el.classList.remove('on');
      this.base.style.transform = '';
      this.knob.style.transform = '';
      if (s.sent && this.active) this.input.send({ t: 'cmd', c: 'stop' });
      return;
    }
    const f = this.fingers.get(e.pointerId);
    if (!f) return;
    this.fingers.delete(e.pointerId);
    if (this.fingers.size < 2) this.pinch = null;
    if (cancelled || f.hold || !this.active) return;
    const quick = performance.now() - f.t0 < TAP_MS && Math.hypot(f.x - f.x0, f.y - f.y0) < TAP_PX;
    if (!quick && !this.input.targeting) return;
    const p = this.world.screenToGround(f.x, f.y);
    if (!p) return;
    const inp = this.input;
    if (inp.targeting) {
      inp.castAt(inp.targeting, p);
      inp.cancelTarget();
    } else {
      inp.moveTo(p);
    }
  }

  // Steers the hero toward a point just ahead of it in the stick's direction.
  // Screen right is world +x and screen down is world +z (the camera has no yaw).
  steer() {
    const s = this.stick;
    const me = this.world.myView();
    if (!s || s.dir == null || !me || !this.active) return;
    const x = me.obj.position.x + Math.cos(s.dir) * AHEAD;
    const y = me.obj.position.z + Math.sin(s.dir) * AHEAD;
    this.input.send({ t: 'cmd', c: 'steer', x: +x.toFixed(2), y: +y.toFixed(2) });
    s.sent = true;
    s.last = performance.now();
  }

  tick() {
    if (this.stick) return this.steer();
    // A held finger on the right keeps moving toward it, like held right-click.
    if (this.fingers.size !== 1 || this.input.targeting || !this.active) return;
    const f = [...this.fingers.values()][0];
    if (f.hold === 'pinch' || performance.now() - f.t0 < TAP_MS) return;
    const p = this.world.screenToGround(f.x, f.y);
    if (!p) return;
    this.input.moveTo(p, !f.hold, f.hold ? 'steer' : 'move');
    f.hold = true;
  }
}
