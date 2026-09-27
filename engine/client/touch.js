// Touch controls for phones and tablets. WC3 has none, so this maps its mouse
// orders onto thumbs and sends the same commands the mouse does:
//  - A fixed joystick in the bottom-left corner is the only way to move.
//    Holding it steers the hero toward a point just ahead of it ('steer'
//    orders, re-sent while held); letting go stops. Touching anywhere else
//    never moves the hero.
//  - A tap elsewhere is only for targets: the target of a spell waiting for
//    one, or a creature or rival to attack (WC3's right-click on a unit). The
//    tap picks the nearest unit on screen, so a thumb doesn't need to be exact.
//  - Ability buttons fire on touch-down (hud-base.js), so they work while
//    the other thumb is on the joystick.
//  - No zoom: each game fixes the camera. The camera always follows the hero.

import * as THREE from 'three';
import { unlockAudio } from './audio.js';

const STICK_R = 56; // px: knob travel
const GRAB_R = 100; // px: how far from the stick's centre a touch still grabs it
const DEAD = 10; // px: dead zone
const AHEAD = 2; // world units: how far ahead of the hero a steer order points
const RESEND = 100; // ms between steer orders while the stick is held
const TAP_MS = 300;
const TAP_PX = 16;
const PICK_PX = 44; // px: how near a unit's on-screen body a tap must land to target it

export class TouchControls {
  constructor(input) {
    this.input = input;
    this.world = input.world;
    this.stick = null; // { id, x, y, dir, sent, last }
    this.taps = new Map(); // other touches: id -> { x, y, x0, y0, t0 }
    document.body.classList.add('touch');

    this.el = document.createElement('div');
    this.el.id = 'joy';
    this.el.innerHTML = '<div class="joy-base"><div class="joy-knob"></div></div>';
    document.getElementById('hud').appendChild(this.el);
    this.base = this.el.firstChild;
    this.knob = this.base.firstChild;
    this.place();
    window.addEventListener('resize', () => this.place());

    const c = this.world.canvas;
    // Stop the browser from scrolling, zooming or firing mouse events for touches.
    c.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    this.el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    c.addEventListener('pointerdown', (e) => this.down(e));
    this.base.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e, true));
    setInterval(() => this.tick(), RESEND);
  }

  // The stick's fixed centre: bottom-left, clear of the notch.
  place() {
    const safe = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-left')) || 0;
    this.cx = Math.max(96, safe + 92);
    this.cy = innerHeight - Math.min(116, innerHeight * 0.3);
    this.base.style.transform = `translate(${this.cx}px, ${this.cy}px)`;
  }

  get active() {
    return this.input.active;
  }

  down(e) {
    if (e.pointerType === 'mouse') return;
    unlockAudio();
    this.world.follow = true;
    if (!this.stick && Math.hypot(e.clientX - this.cx, e.clientY - this.cy) < GRAB_R) {
      this.stick = { id: e.pointerId, x: e.clientX, y: e.clientY, dir: null, sent: false, last: 0 };
      this.el.classList.add('on');
      this.move(e);
      return;
    }
    this.taps.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
  }

  move(e) {
    const s = this.stick;
    if (s && e.pointerId === s.id) {
      let dx = e.clientX - this.cx;
      let dy = e.clientY - this.cy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_R) {
        dx *= STICK_R / len;
        dy *= STICK_R / len;
      }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const dir = len > DEAD ? Math.atan2(dy, dx) : null;
      // Send at once on a real change of direction; otherwise tick() keeps it going.
      const turned = dir != null && (s.dir == null || Math.abs(Math.atan2(Math.sin(dir - s.dir), Math.cos(dir - s.dir))) > 0.2);
      const centred = dir == null && s.dir != null;
      s.dir = dir;
      if (centred && s.sent) {
        // Back in the dead zone: stop, as letting go does.
        if (this.active) this.input.send({ t: 'cmd', c: 'stop' });
        s.sent = false;
      } else if (turned && performance.now() - s.last > 50) this.steer();
      return;
    }
    const f = this.taps.get(e.pointerId);
    if (f) {
      f.x = e.clientX;
      f.y = e.clientY;
    }
  }

  up(e, cancelled = false) {
    const s = this.stick;
    if (s && e.pointerId === s.id) {
      this.stick = null;
      this.el.classList.remove('on');
      this.knob.style.transform = '';
      if (s.sent && this.active) this.input.send({ t: 'cmd', c: 'stop' });
      return;
    }
    const f = this.taps.get(e.pointerId);
    if (!f) return;
    this.taps.delete(e.pointerId);
    if (cancelled || !this.active) return;
    const quick = performance.now() - f.t0 < TAP_MS && Math.hypot(f.x - f.x0, f.y - f.y0) < TAP_PX;
    if (!quick) return;
    const p = this.world.screenToGround(f.x, f.y);
    if (!p) return;
    const inp = this.input;
    if (inp.targeting) {
      inp.castAt(inp.targeting, p);
      inp.cancelTarget();
      return;
    }
    // Attack games: a tap on a creature or rival is an attack order on it
    // (the server checks it can be attacked). It never moves the hero.
    if (!inp.getSnap()?.attack) return;
    const u = this.unitAt(f.x, f.y);
    if (u) {
      inp.send({ t: 'cmd', c: 'attack', x: +u.obj.position.x.toFixed(2), y: +u.obj.position.z.toFixed(2) });
      this.world.fx.ring(u.obj.position.x, u.obj.position.z, 0.9, '#ff3030', 0.4);
    }
  }

  // The unit whose body (projected at chest height) is nearest the tap.
  unitAt(sx, sy) {
    const rect = this.world.canvas.getBoundingClientRect();
    let best = null;
    let bd = PICK_PX;
    for (const v of this.world.views.values()) {
      if (v.id === this.world.myUnit || !v.obj?.visible) continue;
      if (!v.obj.userData?.kind && !v.hpFill && !v.def?.unit) continue; // not a unit
      tmp.copy(v.obj.position);
      tmp.y += 1;
      tmp.project(this.world.camera);
      const d = Math.hypot(rect.left + ((tmp.x + 1) / 2) * rect.width - sx, rect.top + ((1 - tmp.y) / 2) * rect.height - sy);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
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
    if (this.stick) this.steer();
  }
}

const tmp = new THREE.Vector3();
