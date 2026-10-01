import { Minigame } from '../../base.js';
import { Unit, wc3, rand, round2, stepUnits, dist } from '../../../engine/server/sim.js';
import { rim } from './ux2-common.js';

export const WOLVES = { sheepSpeed: wc3(190), sheepHp: 15, sheepR: wc3(15), wolfSpeed: wc3(350), wolfR: wc3(32), kill: wc3(80), count: 28, grass: 8, redirect: 2, pause: 4 };
const HW = wc3(656), SOUTH = -wc3(1000), NORTH = wc3(1560), GATE = wc3(320);
export class RampageWithWolves extends Minigame {
  static id = 'wolves'; static name = 'Rampage With Wolves';
  static desc = 'Fetch grass from the northern pocket and return to the southern Circle of Power. Hungry wolves kill sheep they catch.';
  static controls = 'Right-click or use the joystick to run. Touch a grass patch to carry it back to the circle.';
  static duration = 120; static ranking = 'race';
  setup() {
    const hw = HW, hh = wc3(1540);
    const props=rim(hw,hh,'tree');
    for(const y of [wc3(90),wc3(220)])for(let x=-HW;x<=HW;x+=wc3(95))if(Math.abs(x)>GATE)props.push({t:'tree',x,y,s:0.9});
    this.map = { theme: 'grass', floor: { shape: 'rect', w: hw * 2, h: hh * 2 }, props, bounds: hh + 3, build:['uxwolves'], goalY:SOUTH };
    this.spawnHeroes(this.pids.map((_, i) => [-wc3(550) + i * wc3(150), SOUTH]), { hp: WOLVES.sheepHp, speed: WOLVES.sheepSpeed, r: WOLVES.sheepR });
    for (const u of this.heroes.values()) { u.skin = 'uxsheep'; u.carry = false; u.setFacing(Math.PI / 2); }
    this.grass = Array.from({ length: WOLVES.grass }, (_, i) => ({ id: 50000 + i, x: rand(-wc3(75), wc3(75)), y: rand(wc3(1470), wc3(1530)), taken: false }));
    this.wolves = Array.from({ length: WOLVES.count }, (_, i) => new Unit({ kind: 'uxwolf', x: i < 26 ? (i % 2 ? 1 : -1) * rand(HW * 0.82, HW) : rand(-GATE,GATE), y: rand(wc3(250), NORTH - 1), speed: WOLVES.wolfSpeed, r: WOLVES.wolfR }));
    for (const w of this.wolves) { w.wander = rand(0, 2); w.skin = null; }
    this.redirect = WOLVES.redirect;
  }
  command(pid, m) { if (this.time >= WOLVES.pause) super.command(pid, m); }
  tick(dt) {
    if (this.time < WOLVES.pause) return;
    this.stepHeroes(dt);
    this.redirect -= dt;
    if (this.redirect <= 0) { this.redirect += WOLVES.redirect; const w = this.wolves[Math.floor(rand(0, this.wolves.length))]; w.order(Math.sign(w.x) * rand(HW * 0.65, HW), rand(wc3(220), NORTH)); }
    for (const w of this.wolves) {
      w.wander -= dt;
      if (w.wander <= 0 || !w.target) { w.wander = rand(1, 4); w.order(Math.sign(w.x) * rand(HW * 0.65, HW), rand(wc3(220), NORTH)); }
    }
    stepUnits(this.wolves, dt);
    for (const w of this.wolves) { w.x = Math.max(-HW, Math.min(HW, w.x)); w.y = Math.max(SOUTH, Math.min(NORTH, w.y)); }
    for (const [pid, u] of this.heroes) {
      if (!u.alive || u.finished) continue;
      u.x = Math.max(-HW + u.r, Math.min(HW - u.r, u.x)); u.y = Math.max(SOUTH - wc3(100), Math.min(NORTH, u.y));
      if (u.y > wc3(90) && u.y < wc3(220) && Math.abs(u.x) > GATE) u.y = u.y < wc3(155) ? wc3(90) : wc3(220);
      if (!u.carry) for (const g of this.grass) if (!g.taken && dist(u.x, u.y, g.x, g.y) < wc3(65)) { g.taken = true; u.carry = true; this.ev({ k: 'uxgrass', x: round2(u.x), y: round2(u.y) }); break; }
      if (u.carry && Math.abs(u.x) < wc3(80) && u.y < SOUTH + wc3(35)) { u.carry = false; this.finish(pid); continue; }
      for (const w of this.wolves) if (dist(u.x, u.y, w.x, w.y) <= WOLVES.kill) { if (u.carry) { this.grass.push({ id: 60000 + pid, x: u.x, y: u.y, taken: false }); u.carry = false; } this.eliminate(pid, 'death'); break; }
    }
  }
  botThink(pid, u, mem) {
    const target = u.carry ? { x: 0, y: SOUTH } : this.grass.find((g) => !g.taken);
    if (!target) return;
    let x = target.x, y = target.y;
    if (u.y < wc3(90) && y > wc3(220) || u.y > wc3(220) && y < wc3(90)) { if (Math.abs(u.x) > GATE - 0.4) { x = rand(-GATE * 0.6, GATE * 0.6); y = wc3(155); } }
    let wolf = null, nearest = wc3(180);
    for (const w of this.wolves) { const d=dist(u.x,u.y,w.x,w.y); if(d<nearest){nearest=d;wolf=w;} }
    if (wolf) x = Math.max(-HW+0.5,Math.min(HW-0.5,u.x+Math.sign(u.x-wolf.x||(pid%2?1:-1))*wc3(190)));
    u.order(x, y);
  }
  progress(pid) { const u = this.heroes.get(pid); return u.carry ? 2 + (NORTH - u.y) / (NORTH - SOUTH) : (u.y - SOUTH) / (NORTH - SOUTH); }
  hud(pid) { return { label: this.heroes.get(pid)?.carry ? 'Grass in your mouth — return south!' : 'Reach the northern grass pocket' }; }
  worldEnts() { return [...this.wolves.map((w) => ({ id: w.id, k: 'uxwolf', x: round2(w.x), y: round2(w.y), f: round2(w.facing) })), ...this.grass.filter((g) => !g.taken).map((g) => ({ id: g.id, k: 'uxgrass', x: round2(g.x), y: round2(g.y) }))]; }
  heroEnts(pid) { return super.heroEnts(pid).map((e) => ({ ...e, carry: this.heroes.get(e.o)?.carry ? 1 : undefined })); }
}
