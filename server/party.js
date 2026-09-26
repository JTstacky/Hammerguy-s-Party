// Hammerguy's Party — a minigame party inspired by the classic Warcraft III
// map Uther Party. Up to 10 players (the original took 8) play a run of
// randomly selected minigames. Placing well earns points; most points wins.

import { shuffle, round1 } from '../engine/server/sim.js';
import { MINIGAMES } from './minigames/index.js';

const INTRO_TIME = 6;
const RESULTS_TIME = 6;
const PLACE_POINTS = [3, 2, 1];

export class HammerguysParty {
  constructor(room, settings) {
    this.room = room;
    this.mode = 'party';
    this.total = settings.games || 8;
    this.pids = room.playerList().map((p) => p.id);
    this.points = new Map(this.pids.map((p) => [p, 0]));
    this.events = [];
    this.over = false;
    this.index = 0;
    this.mapV = 0;
    this.queue = [];
    if (settings.only && MINIGAMES.some((m) => m.id === settings.only)) this.queue = Array(this.total).fill(MINIGAMES.find((m) => m.id === settings.only));
    this.nextGame();
  }

  nextGame() {
    if (!this.queue.length) this.queue = shuffle([...MINIGAMES]);
    const Game = this.queue.shift();
    this.index++;
    this.mg = new Game(this, this.pids);
    this.mg.setup();
    this.mapInfo = { ...this.mg.map, v: ++this.mapV };
    this.phase = 'intro';
    this.timer = INTRO_TIME;
    this.lastResults = null;
    this.ev({ k: 'sfx', s: 'intro' });
  }

  tick(dt) {
    if (this.phase === 'over') return;
    this.timer -= dt;
    if (this.phase === 'intro') {
      if (this.timer <= 3 && Math.ceil(this.timer) !== Math.ceil(this.timer + dt)) this.ev({ k: 'sfx', s: 'beep' });
      if (this.timer <= 0) {
        this.phase = 'play';
        this.ev({ k: 'sfx', s: 'start' });
      }
    } else if (this.phase === 'play') {
      this.mg.time += dt;
      this.mg.tick(dt);
      if (this.mg.isDone()) this.endGame();
    } else if (this.phase === 'results') {
      if (this.timer <= 0) {
        if (this.index >= this.total) this.finish();
        else this.nextGame();
      }
    }
  }

  endGame() {
    const groups = this.mg.ranking();
    const results = [];
    let place = 0;
    for (const g of groups) {
      const pts = PLACE_POINTS[place] || 0;
      for (const pid of g) {
        this.points.set(pid, this.points.get(pid) + pts);
        results.push({ id: pid, place: place + 1, pts });
      }
      place += g.length;
    }
    this.lastResults = results;
    this.phase = 'results';
    this.timer = RESULTS_TIME;
    const winners = groups[0] || [];
    this.msg(`${winners.map((p) => this.room.nameOf(p)).join(', ')} won ${this.mg.meta.name}!`, winners.length === 1 ? this.room.colorOf(winners[0]) : null);
    this.ev({ k: 'sfx', s: 'win' });
  }

  finish() {
    this.phase = 'over';
    this.over = true;
    const s = this.standings();
    this.msg(`${this.room.nameOf(s[0].id)} is the life of the party!`, this.room.colorOf(s[0].id));
    this.ev({ k: 'sfx', s: 'victory' });
  }

  standings() {
    return this.pids.map((id) => ({ id, score: this.points.get(id) })).sort((a, b) => b.score - a.score);
  }

  command(pid, m) {
    if (this.phase === 'play') this.mg.command(pid, m);
  }

  units() {
    return [...(this.mg?.heroes.values() || [])];
  }

  hasBomb(pid) {
    return this.mg?.bombHolder === pid;
  }

  onLeave() {}

  snapshot(pid) {
    const mgSnap = this.mg.snapshot(pid);
    const meta = this.mg.meta;
    const snap = {
      mode: 'party',
      phase: this.phase,
      timer: round1(this.phase === 'play' ? Math.max(0, meta.duration - this.mg.time) : this.timer),
      index: this.index,
      total: this.total,
      mg: { id: meta.id, name: meta.name, desc: meta.desc, controls: meta.controls },
      points: Object.fromEntries(this.points),
      alive: Object.fromEntries(this.pids.map((p) => [p, this.mg.heroes.get(p)?.alive ?? false])),
      me: { uid: this.mg.heroes.get(pid)?.id },
      ...mgSnap,
    };
    if (this.lastResults && this.phase !== 'play') snap.results = this.lastResults;
    if (this.phase === 'over') snap.standings = this.standings();
    return snap;
  }

  msg(text, c) {
    this.ev({ k: 'msg', text, c });
  }

  ev(e) {
    this.events.push(e);
  }
}
