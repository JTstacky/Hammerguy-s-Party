import { Minigame } from '../../base.js';
import { newId, rand, round2, wc3 } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';

// Ultima-X #75: each selected foreign sludge replaces its four diagonal neighbours.
const HALF = wc3(512);
const STEP = wc3(100 / Math.SQRT2);
const LIMIT = 7;

export class OverNineThousand extends Minigame {
  static id = 'ux-nine';
  static name = 'Over Nine Thousand';
  static desc = 'Click rival or neutral sludges to multiply. Three neighbours become yours and one stays neutral.';
  static controls = 'Click or tap a sludge you do not own. Most sludges after twenty seconds wins.';
  static duration = 25;
  static ranking = 'score';

  setup() {
    this.predict = false;
    this.map = { theme: 'stone', floor: { shape: 'rect', w: HALF * 2, h: HALF * 2 },
      props: treesAroundRect(HALF, HALF, 0.25), build: ['uxninewall'], bounds: HALF + 3 };
    this.sludges = new Map();
    this.spawnHeroes(this.pids.map(() => [0, 0]), { hp: 1 });
    for (const u of this.heroes.values()) {
      u.alive = false;
      u.hidden = true;
    }
    this.seeded = false;
  }

  site(x, y) {
    return `${x},${y}`;
  }

  put(x, y, owner) {
    if (Math.abs(x) > LIMIT || Math.abs(y) > LIMIT) return;
    const key = this.site(x, y);
    this.sludges.set(key, { id: newId(), x, y, owner });
  }

  click(pid, x, y) {
    if (this.time < 5 || this.time >= 25) return false;
    let nearest = null;
    let best = wc3(40);
    for (const s of this.sludges.values()) {
      if (s.owner === pid) continue;
      const d = Math.hypot(x - s.x * STEP, y - s.y * STEP);
      if (d < best) { best = d; nearest = s; }
    }
    if (!nearest) return false;
    this.sludges.delete(this.site(nearest.x, nearest.y));
    const neutral = Math.floor(rand(0, 4));
    [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([dx, dy], i) =>
      this.put(nearest.x + dx, nearest.y + dy, i === neutral ? null : pid));
    for (const [owner, count] of this.counts()) this.scores.set(owner, count);
    this.ev({ k: 'uxninesplit', x: round2(x), y: round2(y) });
    return true;
  }

  command(pid, m) {
    if (m.c === 'move' || m.c === 'attack' || m.c === 'select') this.click(pid, +m.x || 0, +m.y || 0);
  }

  tick(dt) {
    if (!this.seeded && this.time >= 5) {
      this.seeded = true;
      this.put(0, 0, null);
    }
    for (const [pid, bot] of this.bots) {
      bot.think -= dt;
      if (bot.think <= 0) {
        bot.think = rand(0.15, 0.3);
        this.botThink(pid, null, bot.mem);
      }
    }
  }

  counts() {
    const result = new Map(this.pids.map((pid) => [pid, 0]));
    for (const s of this.sludges.values()) if (result.has(s.owner)) result.set(s.owner, result.get(s.owner) + 1);
    return result;
  }

  ranking() {
    const counts = this.counts();
    const groups = [];
    for (const pid of [...this.pids].sort((a, b) => counts.get(b) - counts.get(a))) {
      const score = counts.get(pid);
      const previous = groups[groups.length - 1];
      if (previous && counts.get(previous[0]) === score) previous.push(pid);
      else groups.push([pid]);
    }
    return groups;
  }

  payouts() {
    const counts = this.counts();
    const holders = this.pids.filter((p) => counts.get(p) > 0);
    const points = new Map(this.pids.map((p) => [p, 8 - holders.length]));
    let ante = 9 - holders.length;
    const values = [...new Set(holders.map((p) => counts.get(p)))].sort((a, b) => a - b);
    for (const value of values) {
      const tied = holders.filter((p) => counts.get(p) === value);
      for (const p of tied) points.set(p, values.length === 1 && tied.length === 1 ? 8 : ante);
      ante += tied.length;
    }
    if (values.length && holders.filter((p) => counts.get(p) === values.at(-1)).length === 1)
      points.set(holders.find((p) => counts.get(p) === values.at(-1)), 8);
    return points;
  }

  botThink(pid, u, mem) {
    if (this.time < 5 || this.time >= 25) return;
    mem.next ??= 5 + rand(0.2, 0.8);
    if (this.time < mem.next) return;
    mem.next = this.time + rand(0.35, 0.85) / mem.skill;
    const options = [...this.sludges.values()].filter((s) => s.owner !== pid);
    options.sort((a, b) => Number(b.owner != null) - Number(a.owner != null) + rand(-0.5, 0.5));
    if (options[0]) this.click(pid, options[0].x * STEP, options[0].y * STEP);
  }

  heroEnts() { return []; }
  hud(pid) { return { label: `Sludges: ${this.counts().get(pid)} · ${this.time < 5 ? 'Ready...' : 'Click rivals!'}` }; }
  worldEnts() { return [...this.sludges.values()].map((s) => ({ id: s.id, k: 'uxsludge', x: round2(s.x * STEP), y: round2(s.y * STEP), o: s.owner })); }
}
