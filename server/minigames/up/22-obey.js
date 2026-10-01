import { Minigame } from '../../base.js';
import { newId, rand, dist, round2, wc3, shuffle } from '../../../engine/server/sim.js';

// Uther Party 4.0 #22 "Obey Archimonde" (docs/uther-party/rules-4.0.md):
// Simon Says. Warlocks (speed 0) stand on 8 pads in two rows facing
// Archimonde's dais. Every command he gives, each player must repeat it with
// the matching ability inside the window, or die when it closes. Any other
// order at any time kills on the spot (Stop, a right-click on a unit, the
// wrong ability; also any order before his first command). Right-clicking the
// ground is a point order and is ignored.
//  - Command 1 comes 2 s after the first 0.25 s tick after t=4 (so 6.0-6.25 s),
//    then 2 s (+0-0.25 s) after every deadline.
//  - Commands 1-4: roar or stomp; 5-9: roar, stomp or bloodlust; 10+: all four
//    (the last of the chained rolls wins, as in the trigger).
//  - Windows: 5.5, 5.0 ... 1.5 s (from command 9 on).
//  - Everyone who misses the same window dies in the same instant and ties.
//  - No time limit (duration is only a safety cap).
//  - Bots: one global AI tick per second; each bot still in trouble has a 60 %
//    chance to give the right order. They never give a wrong one.
// Remake: the contestants are hammerguys, abilities are on Q W E R (the
// original hotkeys were R, T, B, U), and the HUD names the command he gave.
const PAD_X = [-512, -192, 192, 512].map(wc3);
const ROW1 = wc3(128); // y = 3840, 128 u south of the centre
const ROW2 = wc3(448); // y = 3520
// Pads by slot 1-8: the top row holds slots 1, 4, 7, 2 and the bottom row 5, 8, 3, 6.
const PADS = {
  1: [PAD_X[0], ROW1], 4: [PAD_X[1], ROW1], 7: [PAD_X[2], ROW1], 2: [PAD_X[3], ROW1],
  5: [PAD_X[0], ROW2], 8: [PAD_X[1], ROW2], 3: [PAD_X[2], ROW2], 6: [PAD_X[3], ROW2],
};
export const ARCHI = { x: 0, y: -wc3(320) };
const WARLOCK_R = wc3(48);
export const ORDERS = ['roar', 'stomp', 'bloodlust', 'unholyfrenzy'];
const NAMES = { roar: 'Roar', stomp: 'War Stomp', bloodlust: 'Bloodlust', unholyfrenzy: 'Unholy Frenzy' };
export const TRIGGERS_ON = 4;
const FIRST_WAIT = 2;
const START_SPEED = 5;

export class ObeyArchimonde extends Minigame {
  static id = 'obey';
  static name = 'Obey Archimonde';
  static desc = 'Do what Archimonde tells you! When he roars, stomps, bloodlusts or frenzies, do the same before time runs out. Any other order kills you, even between commands. The windows get shorter. Last one standing wins.';
  static controls = 'You cannot move. Q Roar, W War Stomp, E Bloodlust, R Unholy Frenzy (E and R: then click yourself). Never press S or right-click a unit!';
  static duration = 600;
  static timer = false;
  static ranking = 'survival';

  setup() {
    const hw = wc3(576);
    const hh = wc3(512);
    this.map = { theme: 'obey', floor: { shape: 'rect', w: hw * 2, h: hh * 2 }, props: [], bounds: hw + 2, build: ['obey_hall'], archi: ARCHI };
    this.abilities = [
      { name: 'Roar', icon: '🗣️', desc: 'Do it when Archimonde roars.', kind: 'instant', cast() {} },
      { name: 'War Stomp', icon: '🦶', desc: 'Do it when Archimonde stomps.', kind: 'instant', cast() {} },
      { name: 'Bloodlust', icon: '🩸', desc: 'Cast on yourself when Archimonde casts Bloodlust.', kind: 'unit', range: wc3(600), cast() {} },
      { name: 'Unholy Frenzy', icon: '💀', desc: 'Cast on yourself when Archimonde casts Unholy Frenzy.', kind: 'unit', range: wc3(600), cast() {} },
    ];
    const slots = shuffle(Array.from({ length: this.pids.length }, (_, i) => PADS[(i % 8) + 1]));
    this.spawnHeroes(slots, { speed: 0, r: WARLOCK_R, facing: -Math.PI / 2 });
    for (const u of this.heroes.values()) u.skin = 'obey_warlock'; // Fel Orc Warlock (nchw)
    this.archiId = newId();
    this.order = null; // Order_Archimonde: the last command given
    this.curve = 0; // DifficultyCurve: commands given so far
    this.speed = START_SPEED; // Real_Speed
    this.inTrouble = new Set();
    this.nextCmd = TRIGGERS_ON + Math.ceil(rand(0.001, 1) * 4) * 0.25 + FIRST_WAIT;
    this.deadline = null;
    this.cmdT = -1; // time of the last command (for the animation)
    this.buffs = new Map(); // pid -> Set of buffs until the next deadline
    this.aiT = TRIGGERS_ON + rand(0, 1);
  }

  get live() {
    return this.time >= TRIGGERS_ON;
  }

  tick(dt) {
    if (this.nextCmd != null && this.time >= this.nextCmd) this.giveCommand();
    if (this.deadline != null && this.time >= this.deadline) this.closeWindow();
    if (this.time >= this.aiT) {
      this.aiT += 1;
      this.botsAct();
    }
    this.stepHeroes(dt);
  }

  // First Command: roar; then 50 % stomp; then (curve >= 5) 1/3 bloodlust; then (curve >= 10) 1/4 frenzy.
  giveCommand() {
    this.nextCmd = null;
    this.curve++;
    let o = 'roar';
    if (Math.random() < 0.5) o = 'stomp';
    if (this.curve >= 5 && Math.random() < 1 / 3) o = 'bloodlust';
    if (this.curve >= 10 && Math.random() < 1 / 4) o = 'unholyfrenzy';
    this.order = o;
    this.cmdT = this.time;
    for (const pid of this.alive) this.inTrouble.add(pid);
    this.deadline = this.time + this.speed + 0.5;
    this.ev({ k: 'obey_cmd', o, n: this.curve, x: ARCHI.x, y: ARCHI.y });
  }

  // Obey Command: the window closes. Everyone still in trouble dies in the same instant.
  closeWindow() {
    this.deadline = null;
    this.speed = Math.max(1, this.speed - 0.5);
    for (const pid of [...this.inTrouble]) this.kill(pid);
    this.inTrouble.clear();
    this.buffs.clear();
    // First Command runs again on its next 0.25 s tick, then waits 2 s.
    this.nextCmd = this.time + Math.ceil(rand(0.001, 1) * 4) * 0.25 + FIRST_WAIT;
  }

  kill(pid) {
    this.inTrouble.delete(pid);
    this.eliminate(pid, 'obey_death');
  }

  // Obey Follow: every no-target or unit-target order is checked against Archimonde's.
  issue(pid, o, targetPid = pid) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return;
    if (ORDERS.includes(o)) {
      this.ev({ k: 'obey_do', o, u: u.id, x: round2(u.x), y: round2(u.y) });
      this.ev({ k: 'swing', u: u.id });
      if (o === 'bloodlust' || o === 'unholyfrenzy') {
        if (!this.buffs.has(targetPid)) this.buffs.set(targetPid, new Set());
        this.buffs.get(targetPid).add(o);
      } else if (o === 'roar') {
        if (!this.buffs.has(pid)) this.buffs.set(pid, new Set());
        this.buffs.get(pid).add('roar');
      }
    }
    if (!this.live) return;
    if (o === this.order) this.inTrouble.delete(pid);
    else this.kill(pid);
  }

  command(pid, m) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return;
    if (m.c === 'cast') {
      const slot = slotOf(m);
      const o = ORDERS[slot];
      if (slot < 2) return this.issue(pid, o);
      // Unit-targeted: a click that finds no unit is refused (no order is issued).
      const t = this.warlockAt(+m.x || 0, +m.y || 0, 1.3);
      if (t == null) return;
      return this.issue(pid, o, t);
    }
    if (m.c === 'stop') return this.issue(pid, 'stop');
    // A right-click on a unit is a unit-target "smart" order; on the ground it is a point order and ignored.
    if (m.c === 'move') {
      const x = +m.x || 0;
      const y = +m.y || 0;
      if (this.warlockAt(x, y, 0) != null || dist(x, y, ARCHI.x, ARCHI.y) < wc3(90)) this.issue(pid, 'smart');
    }
  }

  // The warlock under a click: within its collision radius plus `slack`.
  warlockAt(x, y, slack) {
    let best = null;
    let bd = Infinity;
    for (const [pid, v] of this.heroes) {
      if (!v.alive) continue;
      const d = dist(x, y, v.x, v.y);
      if (d < v.r + slack && d < bd) {
        bd = d;
        best = pid;
      }
    }
    return best;
  }

  botsAct() {
    if (!this.order) return;
    for (const pid of this.bots.keys()) {
      if (!this.inTrouble.has(pid)) continue;
      // GetRandomInt(1, 5) > 2
      if (Math.floor(Math.random() * 5) + 1 > 2) this.issue(pid, this.order, pid);
    }
  }

  hud(pid) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return null;
    if (!this.order) return { label: this.live ? 'Wait for his command. Do nothing yet!' : 'Archimonde is about to speak…' };
    const name = NAMES[this.order];
    if (this.inTrouble.has(pid)) return { label: `Archimonde: ${name}! Obey!` };
    return { label: `✓ ${name}. Wait for the next command.` };
  }

  worldEnts() {
    const ents = [{ id: this.archiId, k: 'obey_archimonde', x: ARCHI.x, y: ARCHI.y, f: round2(Math.PI / 2), o: this.order || undefined, n: this.curve, ct: this.cmdT >= 0 ? round2(this.time - this.cmdT) : undefined, w: this.deadline != null ? round2(this.deadline - this.time) : undefined }];
    for (const [pid, set] of this.buffs) {
      const u = this.heroes.get(pid);
      if (!u?.alive) continue;
      ents.push({ id: `ob${u.id}`, k: 'obey_buff', x: round2(u.x), y: round2(u.y), b: [...set].join(',') });
    }
    // The pads, lit for players still standing.
    for (const [pid, u] of this.heroes) ents.push({ id: `op${u.id}`, k: 'obey_pad', x: round2(u.x), y: round2(u.y), o: pid, dead: u.alive ? undefined : 1, t: this.inTrouble.has(pid) ? 1 : undefined });
    return ents;
  }
}

function slotOf(m) {
  if (Number.isInteger(m.slot)) return Math.max(0, Math.min(3, m.slot));
  const r = /^s([0-3])$/.exec(String(m.spell ?? ''));
  return r ? +r[1] : 0;
}
