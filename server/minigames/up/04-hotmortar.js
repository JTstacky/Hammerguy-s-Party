import { Minigame } from '../../base.js';
import { rand, dist, round2, wc3, shuffle, newId, clamp } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';

// Uther Party 4.0 #4 "Hot Mortar" (docs/uther-party/rules-4.0.md).
//  - Mortar teams (HP 5, speed 270, collision 48) stand in eight 256x256
//    pens round a 1536x1536 field, handed out at random. A Cannon Tower on a
//    raised block in the centre opens each round.
//  - Only the holder can act; everyone else is paused. Pass Mortar: any
//    rival (range 2000), turn to face, 1.0 s cast point, then the mortar
//    flies at 900 u/s. On landing the receiver becomes the holder.
//    Right-clicking a rival passes to it ("Mortar Target" turns any unit
//    order into Pass Mortar); Q does the same for a clicked rival.
//  - "Mortar Start" (at the start and after every death): everyone paused
//    and invulnerable, wait 4 s, the tower throws to a random team and a
//    hidden fuse of uniform 5-25 s starts.
//  - At the fuse: the holder explodes; if the mortar is in the air, the
//    receiver dies when it lands (everyone is vulnerable by then). A thrower
//    still in its 1 s wind-up is the holder, so it dies.
//  - Survival, one death per round, no ties, no timer.
export const PEN = wc3(256);
export const HW = wc3(768);
export const TEAM = { hp: 5, speed: wc3(270), r: wc3(48) };
export const MISSILE = wc3(900);
export const CAST_POINT = 1.0;
export const RANGE = wc3(2000);
export const FUSE = [5, 25];
export const PAUSE = 4;
// Mortar_1..8 (WC3 offsets from the centre, north up), used in slot order.
const SPOTS = [[-640, 256], [256, 640], [640, -256], [-256, -640], [-256, 640], [640, 256], [256, -640], [-640, -256]].map(([x, y]) => [wc3(x), wc3(-y)]);

export class HotMortar extends Minigame {
  static id = 'hotmortar';
  static name = 'Hot Mortar';
  static desc = 'Keep passing the mortar on! Only the team holding it can act. A hidden fuse of 5 to 25 seconds is burning: whoever holds the mortar when it runs out, or is about to catch it, is blown up. Last team standing wins.';
  static controls = 'While you hold the mortar: right-click a rival (or Q, then click one) to lob it to them. It takes 1 second to aim, and long throws stay in the air longer.';
  static duration = 400;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.map = {
      theme: 'grass',
      floor: { shape: 'rect', w: HW * 2, h: HW * 2 },
      props: treesAroundRect(HW, HW, 0.4, 2.2),
      bounds: 6,
      build: ['hotmortar'],
      pens: SPOTS.slice(0, Math.min(8, this.pids.length)).map(([x, y]) => [round2(x), round2(y)]),
      pen: round2(PEN),
    };
    this.abilities = [
      {
        name: 'Pass Mortar',
        icon: '💣',
        desc: 'Lob the mortar to a rival. 1 second to aim; it flies at 900 speed. Only the holder can throw.',
        kind: 'unit',
        cd: 0,
        range: RANGE,
        castPoint: CAST_POINT,
        pickTarget: (pid, u, x, y) => this.pickTeam(pid, x, y),
        available: (pid) => this.holder === pid,
        cast: (pid, u, tgt) => this.throwFrom(u, tgt.u),
      },
    ];
    this.attack = { range: 0, cd: 1e9 };
    const spots = shuffle(this.pids.map((_, i) => SPOTS[i % 8]));
    this.pen = new Map(this.pids.map((p, i) => [p, spots[i]]));
    this.spawnHeroes(spots, { hp: TEAM.hp, speed: TEAM.speed, r: TEAM.r });
    for (const u of this.heroes.values()) {
      u.skin = 'mortarteam';
      u.setFacing(Math.atan2(-u.y, -u.x));
    }
    this.towerId = newId();
    this.towerF = 0;
    this.holder = null; // pid
    this.flight = null; // { id, sx, sy, to: pid, t, dur, lethal }
    this.fuse = null; // seconds left, hidden
    this.startT = PAUSE; // "Mortar Start" wait
    this.markerId = newId();
    this.botT = rand(0, 1.5);
  }

  pickTeam(pid, x, y) {
    let best = null;
    let bd = 2.2;
    for (const [op, v] of this.heroes) {
      if (op === pid || !v.alive) continue;
      const d = dist(x, y, v.x, v.y) - v.r;
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best ? { x: best.x, y: best.y, u: best } : null;
  }

  // Only the holder obeys orders; a right-click on a rival is a pass.
  command(pid, m) {
    if (pid !== this.holder) return;
    // A right-click or a tap ('attack', touch) on a rival passes to it.
    if (m.c === 'move' || m.c === 'attack') {
      const tgt = this.pickTeam(pid, +m.x || 0, +m.y || 0);
      if (tgt) {
        const u = this.heroes.get(pid);
        if (!u.cast) this.useAbility(pid, 0, tgt.x, tgt.y);
        return;
      }
      if (m.c === 'attack') return;
    }
    super.command(pid, m);
  }

  // Nothing is attacked here; the attack flag only makes touch taps on a
  // unit reach command() as 'attack' orders.
  attackables() {
    return [];
  }

  throwFrom(u, v) {
    if (!v?.alive) return;
    this.launch(u.x, u.y, v.owner);
    this.holder = null;
    u.stop();
    this.ev({ k: 'sfx', s: 'mortar' });
  }

  launch(sx, sy, to) {
    const v = this.heroes.get(to);
    const d = dist(sx, sy, v.x, v.y);
    this.flight = { id: newId(), sx, sy, to, t: 0, dur: d / MISSILE, lethal: false };
  }

  towerThrow() {
    const alive = this.alive;
    if (!alive.length) return;
    const to = alive[Math.floor(Math.random() * alive.length)];
    const v = this.heroes.get(to);
    this.towerF = Math.atan2(v.y, v.x);
    this.launch(0, 0, to);
    this.fuse = rand(FUSE[0], FUSE[1]);
    this.ev({ k: 'hmfire', x: round2(Math.cos(this.towerF) * 1.2), y: round2(Math.sin(this.towerF) * 1.2) });
    this.ev({ k: 'sfx', s: 'mortar' });
  }

  tick(dt) {
    if (this.startT != null) {
      this.startT -= dt;
      if (this.startT <= 0) {
        this.startT = null;
        this.towerThrow();
      }
    }
    if (this.fuse != null) {
      this.fuse -= dt;
      if (this.fuse <= 0) this.detonate();
    }
    const f = this.flight;
    if (f) {
      f.t += dt;
      if (f.t >= f.dur) this.land();
    }
    this.botPass(dt);
    this.stepHeroes(dt);
    for (const [pid, u] of this.heroes) {
      if (!u.alive) continue;
      // Everyone but the holder is paused.
      if (pid !== this.holder && !u.cast) {
        u.stop();
        u.faceTo = null;
      }
      const [px, py] = this.pen.get(pid);
      const m = PEN / 2 - u.r;
      u.x = clamp(u.x, px - m, px + m);
      u.y = clamp(u.y, py - m, py + m);
    }
  }

  land() {
    const f = this.flight;
    this.flight = null;
    const v = this.heroes.get(f.to);
    if (!v.alive) return;
    if (f.lethal) {
      this.explode(f.to);
      return;
    }
    this.holder = f.to;
    v.stop();
    this.ev({ k: 'hmcatch', x: round2(v.x), y: round2(v.y) });
    this.ev({ k: 'sfx', s: 'tag', to: f.to });
  }

  detonate() {
    this.fuse = null;
    if (this.holder != null) this.explode(this.holder);
    else if (this.flight) this.flight.lethal = true; // lands for its 100 damage on a vulnerable target
  }

  explode(pid) {
    const u = this.heroes.get(pid);
    this.holder = null;
    this.flight = null;
    this.fuse = null;
    u.cast = null;
    this.eliminate(pid, 'hmboom');
    // "Mortar Death": the next round starts after the usual 4 s.
    if (this.alive.length > 1) this.startT = PAUSE;
  }

  // Every 1.5 s every computer unit is ordered to pass to a random mortar
  // team (itself included, which fails); only the unpaused holder obeys.
  botPass(dt) {
    this.botT -= dt;
    if (this.botT > 0) return;
    this.botT += 1.5;
    const pid = this.holder;
    if (pid == null || !this.bots.has(pid)) return;
    const u = this.heroes.get(pid);
    if (u.cast) return;
    const teams = this.alive;
    const to = teams[Math.floor(Math.random() * teams.length)];
    if (to === pid) return;
    const v = this.heroes.get(to);
    this.useAbility(pid, 0, v.x, v.y);
  }

  hud() {
    if (this.startT != null) return { label: `Next throw in ${Math.ceil(this.startT)}` };
    if (this.flight) return { label: `Mortar flying to ${this.party.room.nameOf(this.flight.to)}` };
    if (this.holder != null) return { label: `Mortar: ${this.party.room.nameOf(this.holder)}` };
    return null;
  }

  worldEnts() {
    const ents = [{ id: this.towerId, k: 'hmtower', x: 0, y: 0, f: round2(this.towerF) }];
    const f = this.flight;
    if (f) {
      const v = this.heroes.get(f.to);
      ents.push({ id: f.id, k: 'hmshell', x: round2(v.x), y: round2(v.y), sx: round2(f.sx), sy: round2(f.sy), t: round2(Math.min(1, f.t / f.dur)) });
    }
    if (this.holder != null) {
      const u = this.heroes.get(this.holder);
      ents.push({ id: this.markerId, k: 'hmmarker', x: round2(u.x), y: round2(u.y), o: this.holder, c: u.cast && u.cast.t >= 0 ? round2(u.cast.t / CAST_POINT) : undefined });
    }
    return ents;
  }
}
