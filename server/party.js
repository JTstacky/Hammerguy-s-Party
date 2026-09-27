// Hammerguy's Party — a minigame party inspired by the classic Warcraft III
// map Uther Party. Up to 10 players (the original took 8) play a run of
// randomly selected minigames, 8 by default as in the original. Each minigame
// pays points by Uther Party's ante rules (Minigame.payouts). Most points wins;
// tied leaders play tie-breaker minigames among themselves, as in the original.

import { shuffle, round1 } from '../engine/server/sim.js';
import { MINIGAMES, ROLL } from './minigames/index.js';

const INTRO_TIME = 6;
const RESULTS_TIME = 6;
const MAX_TIEBREAKS = 3;

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
    this.tiebreak = 0;
    this.tieWinner = null;
    if (settings.only && MINIGAMES.some((m) => m.id === settings.only)) this.queue = Array(this.total).fill(MINIGAMES.find((m) => m.id === settings.only));
    this.nextGame();
  }

  nextGame(pids = this.pids) {
    if (!this.queue.length) this.queue = shuffle([...ROLL]);
    let Game = this.queue.shift();
    const tie = pids !== this.pids;
    // A tie-breaker needs a game that one of the tied players is sure to win.
    if (tie && Game.ranking !== 'survival') {
      const alt = this.queue.findIndex((G) => G.ranking === 'survival');
      if (alt >= 0) [Game] = this.queue.splice(alt, 1, Game);
    }
    if (!tie) this.index++;
    this.mg = new Game(this, pids);
    this.mg.setup();
    const meta = this.mg.meta;
    this.mapInfo = { ...this.mg.map, v: ++this.mapV,
      mg: { id: meta.id, name: meta.name, desc: meta.desc, controls: meta.controls },
      abilities: this.mg.abilityDefs(),
    };
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
        if (this.index < this.total) this.nextGame();
        else {
          const tied = this.tiedLeaders();
          if (tied.length > 1 && this.tiebreak < MAX_TIEBREAKS) {
            this.tiebreak++;
            this.msg(`Tie-breaker! ${tied.map((p) => this.room.nameOf(p)).join(', ')} play for the win.`);
            this.nextGame(tied);
          } else this.finish();
        }
      }
    }
  }

  endGame() {
    const groups = this.mg.ranking();
    const pays = this.mg.payouts();
    const results = [];
    let place = 0;
    for (const g of groups) {
      for (const pid of g) {
        // Tie-breakers decide the winner only; they pay no points.
        const pts = this.tiebreak ? 0 : pays.get(pid) || 0;
        this.points.set(pid, this.points.get(pid) + pts);
        results.push({ id: pid, place: place + 1, pts });
      }
      place += g.length;
    }
    if (this.tiebreak && groups[0]?.length === 1) this.tieWinner = groups[0][0];
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

  // Players tied for the most points, unless a tie-breaker already split them.
  tiedLeaders() {
    if (this.tieWinner != null) return [this.tieWinner];
    const top = Math.max(...this.points.values());
    return this.pids.filter((p) => this.points.get(p) === top);
  }

  standings() {
    const w = this.tieWinner;
    return this.pids.map((id) => ({ id, score: this.points.get(id) })).sort((a, b) => b.score - a.score || (b.id === w) - (a.id === w));
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
      // Games with no timer in the original show the time played instead.
      timer: round1(this.phase !== 'play' ? this.timer : meta.timer === false ? this.mg.time : Math.max(0, meta.duration - this.mg.time)),
      elapsed: this.phase === 'play' && meta.timer === false ? 1 : undefined,
      index: this.index,
      total: this.total,
      tiebreak: this.tiebreak || undefined,
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
