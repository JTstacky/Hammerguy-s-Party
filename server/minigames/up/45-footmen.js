import { Minigame } from '../../base.js';
import { newId, rand, dist, clamp, round2, wc3 } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';
import { pushOutRect, box, arrive, withoutGone, raceLabel } from './race-kit.js';

// Uther Party 4.0 #45 "Flight of the Footmen" (docs/uther-party/rules-4.0.md):
// a U-shaped low-ground track round a cliff plateau at permanent night. Run
// east along the bottom lane, north up the right-hand column and west along
// the top lane to the Circle of Power, 768 u north of where you started.
// Seven towers on the plateau shoot at you: guard towers (23-27 pierce, 0.9 s)
// and, on the way home, two cannon towers (90-111 siege artillery, 2.5 s,
// splash 50/100/125 u at 100/50/10 %). Footmen have 125 HP and armour 2 and
// no attack. Defend (toggle) cuts arrows to 5 % and may reflect them, at 60 %
// speed; it does nothing against cannon shells, which land where you were
// when they were fired. Stand still for 1.5 s and you shadowmeld: towers lose
// you and shoot someone else. Race: 8, 7, 6 ..., 90 s.
//
// Coordinates: arena-centre offsets (dx, dy) map to (wc3(dx), -wc3(dy)).

const Q = (dx, dy) => [wc3(dx), -wc3(dy)];
const HW = wc3(1664);
const HH = wc3(640);
export const FOOTMAN = { speed: wc3(270), r: wc3(15), hp: 125 };
export const ARMOR = 1 - (0.06 * 2) / (1 + 0.06 * 2); // armour 2: 10.7 % less damage
export const DEFEND = { pierce: 0.05, speed: 0.6, reflect: 0.3 };
export const MELD = 1.5;
// Tower collision isn't in the sheet; 48 makes the 440 range reach across a lane.
const TOWER_R = wc3(48);
export const GUARD = { range: wc3(440), cd: 0.9, point: 0.3, missile: wc3(1800), dmg: [23, 27] };
export const CANNON = { range: wc3(440), cd: 2.5, point: 0.3, missile: wc3(700), dmg: [90, 111], splash: [[wc3(50), 1], [wc3(100), 0.5], [wc3(125), 0.1]] };
const FINISH = Q(-1536, 384);
const FINISH_HALF = wc3(64);

// Unwalkable ground (offset rects x0, y0, x1, y1): the plateau and its
// cliffs, the cliff spurs beside the three notches in each lane's inner edge,
// and the four corner tiles.
const CLIFFS_WC3 = [
  [-1800, -256, 1280, 256],
  [-1152, 256, -128, 384],
  [128, 256, 1152, 384],
  [-1152, -384, -128, -256],
  [128, -384, 1152, -256],
];
const CORNERS_WC3 = [
  [-1664, 512, -1536, 640],
  [1536, 512, 1664, 640],
  [-1664, -640, -1536, -512],
  [1536, -640, 1664, -512],
];
const BLOCKS = [...CLIFFS_WC3, ...CORNERS_WC3].map(([x0, y0, x1, y1]) => box(...Q(x0, y0), ...Q(x1, y1)));

const TOWERS = [
  [-896, 192, 'guard'],
  [-384, 192, 'cannon'],
  [-384, -192, 'guard'],
  [384, 192, 'guard'],
  [384, -192, 'guard'],
  [896, 192, 'cannon'],
  [896, -192, 'guard'],
];

// The route a WC3 move order to the finish would path along, kept to the
// outer edge of the track, furthest from the towers.
const ROUTE = [Q(-1300, -590), Q(1490, -590), Q(1490, 590), Q(-1300, 590), FINISH];

export class FlightOfTheFootmen extends Minigame {
  static id = 'footmen';
  static name = 'Flight of the Footmen';
  static desc = 'Reach the end, but defend when you have to! Run the U-shaped track round the tower plateau to the circle. Raise your shield (Defend) to shrug off arrows at the cost of speed, dodge the cannon shells, and stand still to melt into the night: the towers then pick on someone else.';
  static controls = 'Right-click to move. Q: Defend on/off (arrows do 5 %, you move at 60 %). Stand still 1.5 s to shadowmeld. Cannon shells land where you were: keep moving.';
  static duration = 90;
  static ranking = 'race';

  setup() {
    this.map = {
      theme: 'night',
      floor: { shape: 'rect', w: HW * 2, h: HH * 2 },
      props: treesAroundRect(HW, HH, 0.4, 2.4),
      build: ['footmen'],
      ff: { cliffs: CLIFFS_WC3.map(([x0, y0, x1, y1]) => [...Q(x0, y0), ...Q(x1, y1)].map(round2)), finish: FINISH.map(round2), half: round2(FINISH_HALF), hw: round2(HW), hh: round2(HH) },
      bounds: HW + 2,
    };
    this.abilities = [
      {
        name: 'Defend',
        icon: '🛡️',
        desc: 'Toggle. Arrows do 5 % damage (and 30 % bounce back), but you move at 60 % speed. No help against cannon shells.',
        kind: 'instant',
        cd: 0.3,
        cast: (pid, u) => this.toggleDefend(u),
      },
    ];
    // Footmen start 768 u south of the finish, in a 128x128 box, facing east.
    this.spawnHeroes(this.pids.map(() => Q(-1536 + rand(-64 + 15, 64 - 15), -384 + rand(-64 + 15, 64 - 15))), { ...FOOTMAN, facing: 0 });
    for (const u of this.heroes.values()) u.skin = 'footman';
    for (const u of this.heroes.values()) {
      u.defend = false;
      u.still = 0;
      u.defId = newId();
    }
    this.towers = TOWERS.map(([x, y, kind]) => {
      const [tx, ty] = Q(x, y);
      return { id: newId(), kind, x: tx, y: ty, f: ty < 0 ? -Math.PI / 2 : Math.PI / 2, cd: rand(0, 0.5), wind: -1, tgt: null };
    });
    this.arrows = [];
    this.shells = [];
    this.copId = newId();
  }

  toggleDefend(u) {
    u.defend = !u.defend;
    u.speedMult = u.defend ? DEFEND.speed : 1;
    u.still = 0; // using an ability breaks Shadowmeld
    this.ev({ k: 'ffdefend', u: u.id, on: u.defend ? 1 : 0, x: round2(u.x), y: round2(u.y) });
  }

  melded(u) {
    return u.still >= MELD;
  }

  visible(u) {
    return u.alive && !u.finished && !this.melded(u);
  }

  tick(dt) {
    this.stepHeroes(dt);
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.finished) continue;
      u.x = clamp(u.x, -HW + u.r, HW - u.r);
      u.y = clamp(u.y, -HH + u.r, HH - u.r);
      for (const b of BLOCKS) pushOutRect(u, b);
      u.still = !u.target && !u.cast ? u.still + dt : 0;
      if (Math.abs(u.x - FINISH[0]) <= FINISH_HALF && Math.abs(u.y - FINISH[1]) <= FINISH_HALF) arrive(this, pid);
    }
    for (const t of this.towers) this.stepTower(t, dt);
    this.stepArrows(dt);
    for (const s of this.shells) {
      s.t += dt;
      if (s.t >= s.flight) this.landShell(s);
    }
    this.shells = this.shells.filter((s) => !s.done);
  }

  // Towers keep their target while they can see it and it is in range, and
  // otherwise take the nearest footman they can see.
  stepTower(t, dt) {
    const W = t.kind === 'cannon' ? CANNON : GUARD;
    if (t.cd > 0) t.cd -= dt;
    const reach = (u) => dist(t.x, t.y, u.x, u.y) <= W.range + TOWER_R + u.r;
    if (t.wind >= 0) {
      t.wind += dt;
      if (t.wind >= W.point) {
        t.wind = -1;
        if (t.tgt && this.visible(t.tgt)) this.fire(t, t.tgt);
      }
      return;
    }
    if (!(t.tgt && this.visible(t.tgt) && reach(t.tgt))) {
      t.tgt = null;
      let bd = Infinity;
      for (const u of this.heroes.values()) {
        if (!this.visible(u) || !reach(u)) continue;
        const d = dist(t.x, t.y, u.x, u.y);
        if (d < bd) {
          bd = d;
          t.tgt = u;
        }
      }
    }
    if (!t.tgt) return;
    t.f = Math.atan2(t.tgt.y - t.y, t.tgt.x - t.x);
    if (t.cd <= 0) {
      t.cd = W.cd;
      t.wind = 0;
    }
  }

  fire(t, u) {
    if (t.kind === 'cannon') {
      // Artillery: the shell flies to where the footman stood at the release.
      const d = dist(t.x, t.y, u.x, u.y);
      const dmg = (CANNON.dmg[0] + Math.floor(Math.random() * (CANNON.dmg[1] - CANNON.dmg[0] + 1))) * ARMOR;
      this.shells.push({ id: newId(), sx: t.x, sy: t.y, x: u.x, y: u.y, t: 0, flight: Math.max(0.2, d / CANNON.missile), dmg });
      this.ev({ k: 'ffcannon', x: round2(t.x), y: round2(t.y), f: round2(t.f) });
    } else {
      const dmg = (GUARD.dmg[0] + Math.floor(Math.random() * (GUARD.dmg[1] - GUARD.dmg[0] + 1))) * ARMOR;
      this.arrows.push({ id: newId(), x: t.x, y: t.y, tgt: u, dmg, from: t, d0: dist(t.x, t.y, u.x, u.y) || 1 });
    }
  }

  stepArrows(dt) {
    for (const a of this.arrows) {
      if (a.back) {
        // A reflected arrow flies back to its tower and does nothing there.
        const d = dist(a.x, a.y, a.from.x, a.from.y);
        const step = GUARD.missile * dt;
        if (d <= step) {
          a.done = true;
          continue;
        }
        a.f = Math.atan2(a.from.y - a.y, a.from.x - a.x);
        a.x += Math.cos(a.f) * step;
        a.y += Math.sin(a.f) * step;
        continue;
      }
      const u = a.tgt;
      const d = dist(a.x, a.y, u.x, u.y);
      const step = GUARD.missile * dt;
      if (d <= step || !u.alive || u.finished) {
        if (!u.alive || u.finished) {
          a.done = true;
          continue;
        }
        if (u.defend && Math.random() < DEFEND.reflect) {
          a.back = true;
          this.ev({ k: 'reflect', x: round2(u.x), y: round2(u.y) });
          continue;
        }
        a.done = true;
        const dmg = a.dmg * (u.defend ? DEFEND.pierce : 1);
        this.ev({ k: 'hit', x: round2(u.x), y: round2(u.y) });
        this.damage(u.owner, dmg, 'death');
        continue;
      }
      a.f = Math.atan2(u.y - a.y, u.x - a.x);
      a.x += Math.cos(a.f) * step;
      a.y += Math.sin(a.f) * step;
    }
    this.arrows = this.arrows.filter((a) => !a.done);
  }

  // Splash measured to each footman's edge, as WC3 does (see engine.md).
  landShell(s) {
    s.done = true;
    let hit = false;
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.finished) continue;
      const d = dist(u.x, u.y, s.x, s.y) - u.r;
      const tier = CANNON.splash.find(([r]) => d <= r);
      if (!tier) continue;
      hit = true;
      this.damage(pid, s.dmg * tier[1], 'death');
    }
    this.ev({ k: 'boom', s: 'fire', x: round2(s.x), y: round2(s.y), r: round2(CANNON.splash[2][0] * 1.6), big: hit ? 1 : undefined });
  }

  // At 4 s every computer footman gets one move to the finish, which WC3
  // paths round the plateau; they never Defend or Shadowmeld. Ours follow
  // the same route, and the bots also raise their shield under arrow fire
  // and drop it to sprint clear of incoming shells (an addition so bots can
  // finish; the sharper the bot, the quicker it reacts).
  botThink(pid, u, mem) {
    if (this.time < 4) return;
    mem.i ??= 0;
    const [tx, ty] = ROUTE[mem.i];
    if (mem.i < ROUTE.length - 1 && dist(u.x, u.y, tx, ty) < 1.6) mem.i++;
    const [nx, ny] = ROUTE[mem.i];
    if (u.target) u.steer(nx, ny);
    else u.order(nx, ny);
    if (Math.random() < mem.skill + 0.2) {
      // Shield up under arrow fire; drop it to sprint clear of an incoming shell.
      const shot = this.arrows.some((a) => a.tgt === u && !a.back) || this.towers.some((t) => t.kind === 'guard' && t.tgt === u);
      const shell = this.shells.some((sh) => dist(sh.x, sh.y, u.x, u.y) < wc3(200));
      const want = shot && !shell;
      if (want !== u.defend && (this.acd.get(pid)?.[0] || 0) <= 0) this.useAbility(pid, 0, u.x, u.y);
    }
  }

  progress(pid) {
    const u = this.heroes.get(pid);
    const [cx] = Q(1280, 0);
    if (u.y > 0 && u.x < cx) return u.x;
    if (u.x >= cx) return 100 + (HH - u.y);
    return 200 - u.x;
  }

  heroEnts(pid) {
    const ents = withoutGone(this, super.heroEnts(pid));
    for (const e of ents) {
      const u = this.heroes.get(e.o);
      if (!u) continue;
      const fx = (e.fx || []).filter((f) => f !== 'slow');
      if (this.melded(u) && u.alive && !u.finished) fx.push('invis');
      if (u.defend) fx.push('defend');
      if (fx.length) e.fx = fx;
      else delete e.fx;
    }
    return ents;
  }

  worldEnts() {
    const ents = this.towers.map((t) => ({ id: t.id, k: t.kind === 'cannon' ? 'cannontower' : 'guardtower', x: round2(t.x), y: round2(t.y), f: round2(t.f), fire: t.wind >= 0 ? 1 : undefined }));
    ents.push({ id: this.copId, k: 'cop', x: round2(FINISH[0]), y: round2(FINISH[1]), s: 1, r: 1.1 });
    for (const a of this.arrows) {
      // p: 0 at the tower, 1 at the footman (a reflected arrow runs it backwards).
      const toTower = dist(a.x, a.y, a.from.x, a.from.y);
      ents.push({ id: a.id, k: 'ffarrow', x: round2(a.x), y: round2(a.y), f: round2(a.f || 0), p: round2(clamp(toTower / (a.d0 || 1), 0, 1)) });
    }
    for (const s of this.shells) ents.push({ id: s.id, k: 'ffshell', x: round2(s.x), y: round2(s.y), sx: round2(s.sx), sy: round2(s.sy), t: round2(s.t / s.flight), r: round2(CANNON.splash[1][0]) });
    for (const [, u] of this.heroes) {
      if (u.defend && u.alive && !u.finished) ents.push({ id: u.defId, k: 'ffshield', x: round2(u.x), y: round2(u.y), f: round2(u.facing), u: u.id });
    }
    return ents;
  }

  hud(pid) {
    const u = this.heroes.get(pid);
    const extra = u && u.alive && !u.finished ? (this.melded(u) ? ' · hidden in the dark' : u.defend ? ' · Defend on' : '') : '';
    return { label: raceLabel(this, pid) + extra };
  }
}
