import { Minigame } from '../../base.js';
import { wc3, dist, round2, rand, clamp } from '../../../engine/server/sim.js';

// Ultima-X #71: the 11 by 11 terrain matrix is copied from the map.
export const ELEMENT_GRID = [
  'ISSSSISSSSI', 'SRGGRGRGGRS', 'SGRGGIGGRGS', 'SGGRIRIRGGS',
  'SRGIRRRIGRS', 'IGIRRMRRIGI', 'SRGIRRRIGRS', 'SGGRIRIRGGS',
  'SGRGGIGGRGS', 'SRGGRGRGGRS', 'ISSSSISSSSI',
];
export const ELEM = { halfX: wc3(688), halfY: wc3(672), tile: wc3(128), aoe: wc3(400) };
export function terrainAt(x, y) {
  const c = Math.floor(x / ELEM.tile + 5.5);
  const r = Math.floor(y / ELEM.tile + 5.5);
  return ELEMENT_GRID[clamp(r, 0, 10)][clamp(c, 0, 10)];
}

export class ElementalClash extends Minigame {
  static id = 'uxelemental';
  static name = 'Elemental Clash';
  static desc = 'Fight as a Geomancer. Your Elemental spell changes with the tile beneath you.';
  static controls = 'Right-click to attack or move. Q casts the terrain spell beneath you.';
  static duration = 150;
  static ranking = 'survival';

  setup() {
    this.map = { theme: 'uxelements', floor: { shape: 'rect', w: ELEM.halfX * 2, h: ELEM.halfY * 2 }, build: ['uxelemental'], bounds: ELEM.halfX + 4 };
    this.abilities = [{ name: 'Elemental', icon: '🌎', desc: 'Soil heals; ice armours; grass roots; rock stuns; marble channels Starfall.',
      kind: 'instant', cd: 4, castPoint: 0.3, cast: (pid, u) => this.element(pid, u) }];
    this.attack = { range: wc3(250), cd: 0.5, point: 0.25, dmg: 16, missile: 0, art: 'bolt' };
    this.spawnHeroes(this.pids.map((_, i) => {
      const a = i * Math.PI / 4;
      return [Math.cos(a) * wc3(500), Math.sin(a) * wc3(500)];
    }), { hp: 500, speed: wc3(250), r: wc3(32) });
    for (const u of this.heroes.values()) u.skin = 'uxgeomancer';
  }

  element(pid, u) {
    const tile = terrainAt(u.x, u.y);
    this.ev({ k: 'uxelement', x: round2(u.x), y: round2(u.y), e: tile });
    if (tile === 'S') { u.hp = Math.min(500, u.hp + 100); return; }
    if (tile === 'I') { u.armourUntil = this.time + 15; return; }
    if (tile === 'M') { u.starfall = { wait: 1, pulse: 0 }; return; }
    for (const [op, v] of this.heroes) {
      if (op === pid || !v.alive || dist(u.x, u.y, v.x, v.y) > ELEM.aoe) continue;
      if (tile === 'G') { v.root = Math.max(v.root || 0, 3); v.rootSource = pid; v.rootPulse = 0; }
      if (tile === 'R') { this.damage(op, 75); v.stun = Math.max(v.stun, 1); v.starfall = null; }
    }
  }

  attackHit(pid, u, tgt) {
    const op = tgt.owner;
    if (!tgt.alive || op === pid) return;
    const reduced = tgt.armourUntil > this.time ? 16 / (1 + 0.06 * 15.3) : 16;
    this.damage(op, reduced);
    if (tgt.armourUntil > this.time) u.speedMult = 0.6;
    this.ev({ k: 'hit', x: round2(tgt.x), y: round2(tgt.y) });
  }

  command(pid, m) {
    if (this.time < 5) return;
    const u = this.heroes.get(pid);
    if (u?.starfall && (m.c === 'move' || m.c === 'steer' || m.c === 'stop' || m.c === 'cast')) u.starfall = null;
    super.command(pid, m);
  }

  tick(dt) {
    if (this.time < 5) return;
    this.stepHeroes(dt);
    for (const [pid, u] of this.heroes) {
      if (!u.alive) continue;
      u.x = clamp(u.x, -ELEM.halfX + 0.5, ELEM.halfX - 0.5);
      u.y = clamp(u.y, -ELEM.halfY + 0.5, ELEM.halfY - 0.5);
      if (u.root > 0) {
        u.root -= dt;
        u.rootPulse += dt;
        u.speedMult = 0;
        while (u.rootPulse >= 0.1) { u.rootPulse -= 0.1; this.damage(pid, 3); }
      } else u.speedMult = 1;
      const star = u.starfall;
      if (!star) continue;
      if (u.stun > 0) { u.starfall = null; continue; }
      u.stop();
      star.wait -= dt;
      if (star.wait > 0) continue;
      star.pulse += dt;
      while (star.pulse >= 1) {
        star.pulse -= 1;
        for (const [op, v] of this.heroes) if (op !== pid && v.alive && dist(u.x, u.y, v.x, v.y) < wc3(1000)) this.damage(op, 50);
        this.ev({ k: 'uxstarfall', x: round2(u.x), y: round2(u.y) });
      }
    }
  }

  botThink(pid, u, mem) {
    const foes = [...this.heroes.values()].filter((v) => v.alive && v !== u);
    if (!foes.length) return;
    const v = foes[Math.floor(rand(0, foes.length))];
    const tile = terrainAt(u.x, u.y);
    if (this.acd.get(pid)[0] <= 0 && ((tile === 'S' && u.hp < 390) || (tile === 'M' && !u.starfall) || (tile === 'I' && u.armourUntil < this.time + 5) || dist(u.x, u.y, v.x, v.y) < ELEM.aoe)) this.useAbility(pid, 0, u.x, u.y);
    else if (dist(u.x, u.y, v.x, v.y) < wc3(300)) u.attackOrder = v;
    else u.order(v.x, v.y);
  }

  hud(pid) { const u = this.heroes.get(pid); return { label: `Terrain: ${u ? ({ S: 'Soil / Heal', I: 'Ice / Armour', G: 'Grass / Roots', R: 'Rock / Boulder', M: 'Marble / Starfall' })[terrainAt(u.x, u.y)] : ''}` }; }
}
