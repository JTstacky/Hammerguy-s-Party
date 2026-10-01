import { Minigame } from '../../base.js';
import { Unit, stepUnits, collideUnits, newId, rand, dist, shuffle, round2, wc3 } from '../../../engine/server/sim.js';
import { meleeStep, avoidObstacles } from './d-common.js';

// Uther Party 4.0 #41 "Ancient Punisher" (docs/uther-party/rules-4.0.md).
// Musical chairs with a tree. Everyone is an unarmed Dark Ranger (30 HP,
// speed 320) in a 1152x1152 glade round a rooted Ancient Protector. The clock
// runs at 1 game-hour per second from t=4 (7:00), a full day every 24 s:
//  - 8:00: one item per surviving player appears 128-512 u from the centre,
//    but one of them is Gerard's Lost Ledger, a dud: alive - 1 Cloaks of
//    Shadows and 1 decoy, all in identical sacks. One item slot each.
//  - 18:00 (dusk): the Ancient uproots and hunts (speed 320, collision 144,
//    reach about 300, one hit kills, sees the whole glade).
//  - 4:00: it walks back to the centre and roots, harmless again.
//  - 6:00 (dawn): everyone's item is dropped and every item is deleted.
// A cloak makes you invisible at night while you stand still, after a 1.5 s
// fade; the Ancient cannot see you. Last ranger standing wins.
//
// Deviations:
//  - The original has no time limit; this one stops after 300 s (about 12
//    nights) and the survivors then share the ante.
//  - Q drops your item, so a ranger stuck with the ledger can swap it (WC3
//    lets you drop an item from the inventory).
//  - You pick an item up by walking onto it.
//  - The original computer rangers keep walking to cloaks on the ground (so
//    they never stand still) and walk to the map origin when there are none.
//    Ours grab the nearest sack, swap a ledger with some skill, stand still in
//    a quiet spot by nightfall, and run from the Ancient when exposed.
const HALF = wc3(576);
const CUT = wc3(1024); // octagon: one-tile corners cut off
const STONE_R = wc3(56);
const STONES = [[0, 320], [0, -320], [320, 0], [-320, 0]];
const RANGER = { hp: 30, speed: wc3(320), r: wc3(32) };
export const ANCIENT = { r: wc3(144), speed: wc3(320), turnRate: 0.4, weapon: { range: wc3(128), cd: 1.5, point: 0.4, dmg: [31, 39] } };
export const FADE = 1.5;
const PICKUP_R = wc3(48);
const DURATION = 300;
const UPROOT_TIME = 1;
const ROOT_TIME = 1.5;

// Hour of the day at game time t: 7:00 until t=4, then one hour per second.
export const hourAt = (t) => 7 + Math.max(0, t - 4);
const isNight = (h) => {
  const d = ((h % 24) + 24) % 24;
  return d >= 18 || d < 6;
};

export class AncientPunisher extends Minigame {
  static id = 'ancient';
  static name = 'Ancient Punisher';
  static desc = 'Get a cloak, and hide! Sacks appear at 8:00, one fewer cloak than players, and one sack is a useless ledger. At dusk the Ancient uproots and hunts. A cloaked ranger standing still in the dark is invisible to it. Last one standing wins.';
  static controls = 'Right-click to move; walk onto a sack to pick it up. Q: drop your item. At night, stand still with a cloak to vanish.';
  static duration = DURATION;
  static timer = false;
  static ranking = 'survival';

  setup() {
    this.stones = STONES.map(([x, y]) => ({ x: wc3(x), y: wc3(-y), r: STONE_R }));
    this.map = {
      theme: 'ancient',
      floor: { shape: 'rect', w: HALF * 2, h: HALF * 2 },
      props: [],
      half: round2(HALF),
      cut: round2(CUT),
      stones: this.stones.map((s) => [round2(s.x), round2(s.y)]),
      build: ['ancient'],
      bounds: HALF + 2,
    };
    this.abilities = [{
      name: 'Drop Item',
      icon: '🎒',
      desc: 'Drops the item you are carrying (to swap a useless ledger for a cloak).',
      kind: 'instant',
      cd: 0.5,
      available: (pid) => !!this.heroes.get(pid)?.item,
      cast: (pid, u) => this.drop(u),
    }];
    // Pre-placed 448 u from the centre at slot * 135 - 22.5 degrees, facing it, handed out at random.
    const slots = shuffle([...Array(8).keys()]);
    this.spawnHeroes(this.pids.map((_, i) => {
      const a = ((slots[i % 8] * 135 - 22.5) * Math.PI) / 180;
      return [Math.cos(a) * wc3(448), -Math.sin(a) * wc3(448)];
    }), { hp: RANGER.hp, speed: RANGER.speed, r: RANGER.r });
    for (const u of this.heroes.values()) {
      u.skin = 'ranger';
      u.item = null;
      u.stillT = 0;
    }
    const a = new Unit({ kind: 'ancient', x: 0, y: 0, r: ANCIENT.r, speed: ANCIENT.speed, hp: 600 });
    a.turnRate = ANCIENT.turnRate;
    a.weapon = ANCIENT.weapon;
    a.atkCd = 0;
    a.mode = 'rooted';
    a.modeT = 0;
    a.mass = 20;
    this.ancient = a;
    this.items = [];
    this.lastHour = hourAt(0);
    this.clockId = newId();
  }

  get hour() {
    return hourAt(this.time);
  }

  night() {
    return isNight(this.hour);
  }

  // Invisible to the Ancient (and to rivals): cloaked, night, still for 1.5 s.
  hidden(u) {
    return u.alive && u.item?.type === 'cloak' && this.night() && u.stillT >= FADE;
  }

  // Crossing hour `h` (mod 24) between the last tick and this one.
  crossed(h) {
    const a = this.lastHour;
    const b = this.hour;
    const k = Math.ceil((a - h) / 24);
    const at = h + 24 * k;
    return at > a && at <= b;
  }

  tick(dt) {
    if (this.crossed(8)) this.spawnItems();
    if (this.crossed(18)) this.setMode('uproot');
    if (this.crossed(4)) this.setMode('return');
    if (this.crossed(6)) this.dawn();
    this.lastHour = this.hour;

    this.stepAncient(dt);
    this.stepHeroes(dt);
    const heroes = [...this.heroes.values()];
    collideUnits([...heroes, this.ancient]);
    for (const u of [...heroes, this.ancient]) {
      if (!u.alive) continue;
      avoidObstacles(u, this.stones);
      this.confine(u);
    }
    for (const [pid, u] of this.heroes) {
      if (!u.alive) continue;
      // Moving or acting breaks Shadowmeld.
      if (u.mx || u.my || u.cast || u.target) u.stillT = 0;
      else u.stillT += dt;
      if (!u.item) {
        const it = this.items.find((i) => dist(i.x, i.y, u.x, u.y) <= PICKUP_R + u.r * 0.5 && !(i.droppedBy === pid && dist(i.x, i.y, u.x, u.y) < wc3(90)));
        if (it) this.pickUp(u, it);
      }
    }
    for (const it of this.items) if (it.droppedBy != null && !this.heroes.get(it.droppedBy)?.alive) it.droppedBy = null;
  }

  setMode(m) {
    const a = this.ancient;
    a.mode = m;
    a.modeT = 0;
    a.atkTarget = null;
    a.swing = null;
    a.stop();
    this.ev({ k: m === 'uproot' ? 'apuproot' : 'aproot', x: round2(a.x), y: round2(a.y) });
  }

  stepAncient(dt) {
    const a = this.ancient;
    a.modeT += dt;
    if (a.mode === 'uproot' && a.modeT >= UPROOT_TIME) a.mode = 'hunt';
    if (a.mode === 'hunt') {
      if (a.atkTarget && (this.hidden(a.atkTarget) || !a.atkTarget.alive)) a.atkTarget = null;
      // Acquisition 2000 covers the glade: the nearest ranger it can see.
      if (!a.swing && (!a.atkTarget || a.modeT % 0.5 < dt)) {
        let best = null;
        let bd = Infinity;
        for (const u of this.heroes.values()) {
          if (!u.alive || this.hidden(u)) continue;
          const d = dist(a.x, a.y, u.x, u.y);
          if (d < bd) {
            bd = d;
            best = u;
          }
        }
        if (best !== a.atkTarget) {
          a.atkTarget = best;
          if (!best) a.stop();
        }
      }
      if (meleeStep(a, dt, (att, u) => this.smash(u)) === 'swing') this.ev({ k: 'apswing', u: a.id });
    } else if (a.mode === 'return') {
      // Walks back to the centre without attacking, then roots.
      if (dist(a.x, a.y, 0, 0) > wc3(20)) {
        if (!a.target) a.order(0, 0);
      } else {
        a.stop();
        a.mode = 'rooting';
        a.modeT = 0;
      }
    } else if (a.mode === 'rooting' && a.modeT >= ROOT_TIME) a.mode = 'rooted';
    stepUnits([a], dt);
  }

  smash(u) {
    if (!u.alive || this.hidden(u)) return;
    this.ev({ k: 'apsmash', x: round2(u.x), y: round2(u.y) });
    this.damage(u.owner, u.hp + 1, 'squish');
    if (u.item) this.drop(u);
  }

  spawnItems() {
    const n = this.alive.length;
    if (n < 2) return;
    const spot = () => {
      const a = rand(0, Math.PI * 2);
      const r = wc3(rand(128, 512));
      return [Math.cos(a) * r, Math.sin(a) * r];
    };
    for (let i = 0; i < n; i++) {
      const [x, y] = spot();
      this.items.push({ id: newId(), x, y, type: i < n - 1 ? 'cloak' : 'ledger' });
    }
    this.ev({ k: 'apitems' });
  }

  // Dawn: a dispel on everyone, items dropped, then every item on the map deleted.
  dawn() {
    for (const u of this.heroes.values()) {
      if (!u.alive) continue;
      u.item = null;
      this.ev({ k: 'apdispel', x: round2(u.x), y: round2(u.y) });
    }
    this.items = [];
  }

  pickUp(u, it) {
    this.items = this.items.filter((i) => i !== it);
    u.item = it;
    it.droppedBy = null;
    this.ev({ k: 'appick', x: round2(it.x), y: round2(it.y), to: u.owner });
  }

  drop(u) {
    if (!u.item) return;
    const it = u.item;
    u.item = null;
    it.x = u.x;
    it.y = u.y;
    it.droppedBy = u.owner;
    this.items.push(it);
  }

  confine(u) {
    u.x = Math.max(-HALF + u.r, Math.min(HALF - u.r, u.x));
    u.y = Math.max(-HALF + u.r, Math.min(HALF - u.r, u.y));
    const over = Math.abs(u.x) + Math.abs(u.y) - (CUT - u.r * 1.41);
    if (over > 0) {
      u.x -= (Math.sign(u.x) * over) / 2;
      u.y -= (Math.sign(u.y) * over) / 2;
    }
  }

  // ---- computer rangers (see the header for how they differ from the original)
  botThink(pid, u, mem) {
    const h = ((this.hour % 24) + 24) % 24;
    const a = this.ancient;
    const hunting = a.mode === 'hunt' || a.mode === 'uproot';
    // A ledger: drop it and look for a cloak, if the bot twigs and there is time.
    if (u.item?.type === 'ledger' && h < 17 && Math.random() < mem.skill * 0.3) {
      this.useAbility(pid, 0, u.x, u.y);
      mem.spot = null;
      return;
    }
    if (u.item?.type === 'cloak') {
      if (hunting && !this.hidden(u) && u.stillT < 0.3 && dist(u.x, u.y, a.x, a.y) < wc3(420) && Math.random() < 0.5) return this.flee(u, mem);
      // Be standing still in a quiet spot well before dusk.
      if (!mem.spot) mem.spot = this.quietSpot(u);
      if (dist(u.x, u.y, mem.spot[0], mem.spot[1]) > wc3(24)) {
        if (!u.target) u.order(mem.spot[0], mem.spot[1]);
      } else if (u.target) u.stop();
      return;
    }
    mem.spot = null;
    if (this.items.length && !hunting) {
      let best = null;
      let bd = Infinity;
      for (const it of this.items) {
        if (it.droppedBy === pid) continue;
        const d = dist(u.x, u.y, it.x, it.y) * (0.7 + Math.random() * 0.6 * (1 - mem.skill));
        if (d < bd) {
          bd = d;
          best = it;
        }
      }
      if (best) {
        if (!u.target || dist(u.target.x, u.target.y, best.x, best.y) > 0.1) u.order(best.x, best.y);
        return;
      }
    }
    if (hunting) this.flee(u, mem);
  }

  // Run round the Ancient: away from it, sliding along the walls.
  flee(u, mem) {
    const a = this.ancient;
    let fx = u.x - a.x;
    let fy = u.y - a.y;
    const d = Math.hypot(fx, fy) || 1;
    fx /= d;
    fy /= d;
    // Circle rather than back into a corner: add a sideways component.
    const side = (mem.side ??= Math.random() < 0.5 ? 1 : -1);
    let tx = fx + -fy * side * 0.9;
    let ty = fy + fx * side * 0.9;
    const px = u.x + tx * 3;
    const py = u.y + ty * 3;
    if (Math.abs(px) > HALF - 1 || Math.abs(py) > HALF - 1 || Math.abs(px) + Math.abs(py) > CUT - 1.5) {
      mem.side = -side;
      tx = fx - -fy * side * 0.9;
      ty = fy - fx * side * 0.9;
    }
    u.order(u.x + tx * 3, u.y + ty * 3);
  }

  quietSpot(u) {
    let best = null;
    let bs = -Infinity;
    for (let i = 0; i < 12; i++) {
      const a = rand(0, Math.PI * 2);
      const r = wc3(rand(200, 480));
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (Math.abs(x) + Math.abs(y) > CUT - 1) continue;
      let s = -dist(u.x, u.y, x, y) * 0.3;
      for (const v of this.heroes.values()) if (v !== u && v.alive) s += Math.min(4, dist(v.x, v.y, x, y));
      if (s > bs) {
        bs = s;
        best = [x, y];
      }
    }
    return best || [u.x, u.y];
  }

  hud(pid) {
    const u = this.heroes.get(pid);
    const h = Math.floor(((this.hour % 24) + 24) % 24);
    const clock = `${String(h).padStart(2, '0')}:00`;
    let item = 'No item';
    if (u?.item) item = u.item.type === 'cloak' ? (this.hidden(u) ? 'Cloak: hidden' : 'Cloak of Shadows') : "Gerard's Lost Ledger (useless!)";
    return { label: `${clock} · ${item}` };
  }

  heroEnts(pid) {
    const out = [];
    for (const e of super.heroEnts(pid)) {
      const u = [...this.heroes.values()].find((h) => h.id === e.id);
      if (u && this.hidden(u)) {
        if (u.owner !== pid) continue; // invisible to everyone else
        (e.fx ||= []).push('invis');
      }
      if (u && !u.alive) continue; // Dissipate removes dead rangers
      out.push(e);
    }
    return out;
  }

  worldEnts() {
    const a = this.ancient;
    const ents = [{ id: a.id, k: 'ancient', x: round2(a.x), y: round2(a.y), f: round2(a.facing), m: a.mode, mt: round2(a.modeT), mv: a.mx || a.my ? 1 : undefined, sw: a.swing ? 1 : undefined }];
    ents.push({ id: this.clockId, k: 'apclock', x: 0, y: 0, h: round2(this.hour) });
    for (const it of this.items) ents.push({ id: it.id, k: 'apsack', x: round2(it.x), y: round2(it.y) });
    return ents;
  }
}
