import { Minigame } from '../../base.js';
import { dist, round2, wc3, clampToRect } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';
import { ringSpots, shuffled, noTies, nearest, idle, dice, armorMult, stopOnLostTarget } from './e-common.js';

// Uther Party 4.0 #35 "Destruction's Dance" (docs/uther-party/rules-4.0.md).
// Blademasters in a 1024x1024 ring (250 HP, armour 5.2, speed 320) who can
// only Blink: every point order becomes a Blink of up to 400 u (2 mana, no
// cooldown, cast point 0; 240 mana, +0.8/s), and right-clicking a rival
// blinks you to 32 u from it on your side and attacks. Swings are slow and
// heavy (26-48 hero damage, one every 2.03 s, damage point 0.33 s), so blink
// in, strike and blink out. Units are paused for the first 5 s of the 120 s
// timer. Survival without ties; survivors at 120 s share the ante. Computer
// blademasters only have acquisition 2000, so they walk up and melee.
const HW = wc3(512);
const R = wc3(32);
export const BLINK = { range: wc3(400), cost: 2, near: wc3(32) };
export const BM = { hp: 250, regen: 0.7, armor: 5.2, mana: 240, manaRegen: 0.8, speed: wc3(320) };
const PAUSE = 5;
const STEER_GAP = 0.3; // held right-click / joystick: at most one blink per 0.3 s

export class DestructionsDance extends Minigame {
  static id = 'dance';
  static name = "Destruction's Dance";
  static desc = 'Blademasters who cannot walk, only blink. Click to blink up to 400 u; click a rival to blink beside them and strike. Blink in, strike, blink out. Last one standing wins.';
  static controls = 'Right-click to blink (2 mana). Right-click a rival to blink to them and attack. Swings are slow: hit and run.';
  static duration = 120;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'dance', floor: { shape: 'rect', w: HW * 2, h: HW * 2 }, props: treesAroundRect(HW + 0.5, HW + 0.5, 0.45, 2.2), bounds: HW + 3, build: ['dance'] };
    this.attack = { range: wc3(100), cd: 2.03, point: 0.33, missile: 0, art: 'axe' };
    this.spawnHeroes(shuffled(ringSpots(this.pids.length, 400)), { hp: BM.hp, regen: BM.regen, r: R, speed: BM.speed });
    for (const u of this.heroes.values()) {
      u.skin = 'blademaster';
      u.lastBlink = -1;
    }
    this.mana = new Map(this.pids.map((p) => [p, BM.mana]));
  }

  // 2d12 + 24 hero damage against armour 5.2 (hero vs hero is 100 %).
  attackHit(pid, u, tgt) {
    this.ev({ k: 'hit', x: round2(tgt.x), y: round2(tgt.y) });
    this.damage(tgt.owner, (dice(2, 12) + 24) * armorMult(BM.armor));
  }

  // Blink toward (x, y), at most 400 u. Returns false without the mana.
  blink(pid, u, x, y) {
    const m = this.mana.get(pid);
    if (m < BLINK.cost) {
      this.ev({ k: 'sfx', s: 'error', to: pid });
      return false;
    }
    let dx = x - u.x;
    let dy = y - u.y;
    const d = Math.hypot(dx, dy);
    if (d > BLINK.range) {
      dx *= BLINK.range / d;
      dy *= BLINK.range / d;
    }
    this.mana.set(pid, m - BLINK.cost);
    const x0 = u.x;
    const y0 = u.y;
    u.x += dx;
    u.y += dy;
    clampToRect(u, HW, HW);
    if (d > 0.01) u.setFacing(Math.atan2(dy, dx));
    u.stop();
    u.swing = null;
    u.lastBlink = this.time;
    this.ev({ k: 'blink', x1: round2(x0), y1: round2(y0), x2: round2(u.x), y2: round2(u.y) });
    return true;
  }

  command(pid, m) {
    if (this.time < PAUSE) return;
    const u = this.heroes.get(pid);
    if (!u?.alive) return;
    const x = +m.x || 0;
    const y = +m.y || 0;
    if (m.c === 'move') {
      const tgt = this.attackTargetAt(pid, x, y);
      if (tgt) {
        // Destruction Attack: blink to 32 u from the target on your side, then attack it.
        const d = dist(u.x, u.y, tgt.x, tgt.y);
        if (d > tgt.r + u.r + BLINK.near) {
          const k = (d - tgt.r - u.r - BLINK.near) / d;
          this.blink(pid, u, u.x + (tgt.x - u.x) * k, u.y + (tgt.y - u.y) * k);
        }
        u.attackOrder = tgt;
        return;
      }
      // Destruction Move: every point order is re-issued as Blink.
      u.attackOrder = null;
      this.blink(pid, u, x, y);
      return;
    }
    if (m.c === 'steer') {
      if (this.time - u.lastBlink < STEER_GAP) return;
      u.attackOrder = null;
      this.blink(pid, u, x, y);
      return;
    }
    if (m.c === 'stop') {
      u.attackOrder = null;
      u.swing = null;
      u.stop();
      return;
    }
    super.command(pid, m);
  }

  tick(dt) {
    for (const [pid, m] of this.mana) this.mana.set(pid, Math.min(BM.mana, m + BM.manaRegen * dt));
    // Computer heroes get acquisition 2000: they go for the nearest hero on foot.
    if (this.time >= PAUSE) {
      for (const pid of this.bots.keys()) {
        const u = this.heroes.get(pid);
        if (!idle(u)) continue;
        const v = nearest(u, this.attackables(pid), wc3(2000));
        if (v) u.attackOrder = v;
      }
    }
    stopOnLostTarget(this.heroes.values(), () => this.stepHeroes(dt));
    for (const u of this.heroes.values()) if (u.alive) clampToRect(u, HW, HW);
  }

  // There is no AI trigger: only the acquisition range above.
  botThink() {}

  hud(pid) {
    const m = this.mana.get(pid);
    if (m == null) return null;
    return { label: this.time < PAUSE ? `Ready... ${Math.ceil(PAUSE - this.time)}` : `Mana ${Math.floor(m)} / ${BM.mana}` };
  }
}

noTies(DestructionsDance);
