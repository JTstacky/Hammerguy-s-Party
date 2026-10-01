import { Minigame } from '../../base.js';
import { wc3, round2, rand } from '../../../engine/server/sim.js';

// Ultima-X #72. The shared market makes each trade change every broker's quote.
export const STOCK = { startGold: 100, startPrice: 5, buyRise: 3, sellFall: 2, buyCd: 0.35, sellCd: 0.2, session: 50 };
export const STOCK_NAMES = ['Human', 'Orc', 'Undead', 'Night Elf'];

export class WallStreetTraffic extends Minigame {
  static id = 'uxstock';
  static name = 'Wall Street Traffic';
  static desc = 'Buy and sell four shared stock indexes. Only your cash counts when the quarter closes.';
  static controls = 'Use the market panel to buy or sell. Stock prices change on every trade and every four seconds.';
  static duration = 58;
  static ranking = 'score';

  setup() {
    this.map = { theme: 'uxexchange', floor: { shape: 'rect', w: wc3(1152), h: wc3(1024) }, build: ['uxstock'], bounds: wc3(750) };
    const xs = [-wc3(384), -wc3(128), wc3(160), wc3(416)];
    this.spawnHeroes(this.pids.map((_, i) => [xs[i % 4], i < 4 ? -wc3(192) : -wc3(416)]), { hp: 60, speed: 0, r: wc3(16) });
    for (const u of this.heroes.values()) u.skin = 'uxbroker';
    this.prices = [5, 5, 5, 5];
    this.lastIndex = [5, 5, 5, 5];
    this.indexChange = [0, 0, 0, 0];
    this.gold = new Map(this.pids.map((p) => [p, STOCK.startGold]));
    this.shares = new Map(this.pids.map((p) => [p, [0, 0, 0, 0]]));
    this.tradeCd = new Map(this.pids.map((p) => [p, Array(8).fill(0)]));
    this.nextUpdate = 4;
    this.closed = false;
  }

  trade(pid, index, sell = false) {
    if (this.time < 4 || this.time >= 55 || !this.heroes.get(pid)?.alive || index < 0 || index > 3) return false;
    const cds = this.tradeCd.get(pid);
    const slot = index + (sell ? 4 : 0);
    if (cds[slot] > 0) return false;
    const owned = this.shares.get(pid);
    const price = this.prices[index];
    if (sell) {
      if (owned[index] < 1) return false;
      owned[index]--;
      this.gold.set(pid, this.gold.get(pid) + price);
      this.prices[index] = Math.max(1, price - STOCK.sellFall);
      cds[slot] = STOCK.sellCd;
    } else {
      if (this.gold.get(pid) < price) return false;
      owned[index]++;
      this.gold.set(pid, this.gold.get(pid) - price);
      this.prices[index] = price + STOCK.buyRise;
      cds[slot] = STOCK.buyCd;
    }
    this.ev({ k: 'uxtrade', x: round2(this.heroes.get(pid).x), y: round2(this.heroes.get(pid).y), s: sell ? 'SELL' : 'BUY' });
    return true;
  }

  command(pid, m) {
    if (m.c === 'trade') this.trade(pid, Number(m.index), !!m.sell);
  }

  marketUpdate() {
    for (let i = 0; i < 4; i++) {
      if (Math.random() < 1 / 3) this.prices[i] = Math.max(1, this.prices[i] + 5 - Math.floor(rand(1, 16)));
      this.indexChange[i] = this.prices[i] - this.lastIndex[i];
      this.lastIndex[i] = this.prices[i];
    }
  }

  tick(dt) {
    this.stepHeroes(dt);
    for (const cds of this.tradeCd.values()) for (let i = 0; i < 8; i++) cds[i] = Math.max(0, cds[i] - dt);
    while (this.time >= this.nextUpdate && this.nextUpdate <= 54) {
      this.marketUpdate();
      this.nextUpdate += 4;
    }
    if (this.time >= 55 && !this.closed) {
      this.closed = true;
      for (const pid of this.pids) this.scores.set(pid, this.gold.get(pid));
      this.done = true;
    }
  }

  botThink(pid, u, mem) {
    if (this.time < 4 || this.time >= 55) return;
    const own = this.shares.get(pid);
    const i = (pid + Math.floor(this.time / (2 + mem.skill))) % 4;
    // Hold a small position when prices are low; sell rallies, and liquidate
    // everything before expiry because unsold shares have no score value.
    if (this.time > 47) {
      const j = own.findIndex((n) => n > 0);
      if (j >= 0) this.trade(pid, j, true);
    } else if (own[i] > 0 && (this.prices[i] >= 9 || own[i] > 3)) this.trade(pid, i, true);
    else if (this.prices[i] < 13 && this.gold.get(pid) > this.prices[i] + 12) this.trade(pid, i);
  }

  hud(pid) { return { label: `Gold: ${this.gold.get(pid)} · Quarter ${Math.max(0, Math.ceil(54 - this.time))}s` }; }
  worldEnts(pid) { return [{ id: 72001, k: 'uxmarket', x: 0, y: 0,
    p: this.prices.slice(), d: this.indexChange.slice(), g: this.gold.get(pid), h: this.shares.get(pid).slice(),
    o: this.pids.map((p) => [p, ...this.shares.get(p)]), t: Math.max(0, round2(55 - this.time)) }]; }
}
