import { Minigame } from '../../base.js';
import { newId, rand, dist, round2, wc3, wrapAngle } from '../../../engine/server/sim.js';
import { treesAroundRect } from '../props.js';
import { W, ringSpots, shuffled, noTies, Obstacles, Nav, goTo, followPaths, nearest, idle, clampOct, between, armorMult, typeMult, stopOnLostTarget } from './e-common.js';

// Uther Party 4.0 #30 "Nature's Circle" (docs/uther-party/rules-4.0.md).
// Rock, paper, scissors in a 1280x1280 glade. Everyone starts as an unarmed
// Druid of the Wilds (250 HP, 100 mana) with three forms, each costing all
// 100 mana: Quillbeast (Q), Hawk (W) and Bear (E). A form keeps your HP
// percentage, has the other two forms, and regains mana at 15/s, so the next
// morph is ready in 6.7 s; there is no way back to the druid. Bears maul
// quillbeasts but cannot hit the hovering hawk; quillbeasts outrange and
// shred hawks; hawks' magic tears bears apart. The numbers come from the WC3
// 1.26 damage table (attack type vs armour type, 6 % per armour point).
// Survival with no ties; survivors at 120 s share the ante.
const HW = wc3(640);
const CUT = wc3(181);
const TILE = wc3(128);
const R = wc3(32);
export const FORMS = {
  druid: { name: 'Druid', hp: 250, speed: wc3(270), armor: 1, arm: 'heavy', atk: null, regen: 0 },
  bear: { name: 'Bear', hp: 300, speed: wc3(320), armor: 0, arm: 'heavy', regen: 15, atk: { type: 'normal', min: 19, max: 21, cd: 1.5, range: wc3(128), point: 0.5, missile: 0, air: false } },
  quill: { name: 'Quillbeast', hp: 200, speed: wc3(300), armor: 0, arm: 'medium', regen: 15, atk: { type: 'pierce', min: 13, max: 15, cd: 1.5, range: wc3(550), point: 0.5, missile: wc3(900), air: true } },
  hawk: { name: 'Hawk', hp: 150, speed: wc3(350), armor: 3, arm: 'light', regen: 15, air: true, atk: { type: 'magic', min: 21, max: 25, cd: 1.5, range: wc3(300), point: 0.4, missile: wc3(1000), air: true } },
};
export const MORPH_COST = 100;

export class NaturesCircle extends Minigame {
  static id = 'nature';
  static name = "Nature's Circle";
  static desc = 'Rock, paper, scissors. Turn into a Bear, a Quillbeast or a Hawk: bears beat quillbeasts, quillbeasts beat hawks, hawks beat bears. Each change costs all your mana. Counter your opponents! Last one standing wins.';
  static controls = 'Right-click a rival to attack. Q: Quillbeast. W: Hawk. E: Bear. Changing form costs 100 mana (6.7 s to refill) and keeps your HP %.';
  static duration = 120;
  static ranking = 'survival';

  setup() {
    this.obs = new Obstacles();
    const props = [];
    for (const [ox, oy] of [[0, 384], [0, -384], [384, 0], [-384, 0]]) {
      const [x, y] = W(ox, oy);
      this.obs.box(x - TILE / 2, y - TILE / 2, x + TILE / 2, y + TILE / 2);
      props.push({ t: 'tree', x, y, s: 1.25 });
    }
    this.nav = new Nav(this.obs, HW, HW, TILE / 2, R, (x, y) => Math.abs(x) + Math.abs(y) <= 2 * HW - CUT - R * 1.5);
    this.map = { theme: 'glade', floor: { shape: 'rect', w: HW * 2, h: HW * 2 }, props: [...props, ...treesAroundRect(HW + 0.5, HW + 0.5, 0.42, 2.2)], bounds: HW + 3, build: ['nature'], cut: round2(CUT) };
    this.mana = new Map(this.pids.map((p) => [p, MORPH_COST]));
    const morph = (form, name, icon, desc) => ({
      name, icon, desc, kind: 'instant', cd: 0,
      available: (pid) => this.heroes.get(pid)?.form !== form && this.mana.get(pid) >= MORPH_COST,
      cast: (pid, u) => this.morph(pid, u, form),
    });
    this.abilities = [
      morph('quill', 'Quillbeast Form', '🦔', 'Quillbeast: 200 HP, ranged 550. Beats hawks, loses to bears.'),
      morph('hawk', 'Hawk Form', '🦅', 'Hawk: 150 HP, fast, hovers. Beats bears (they cannot hit you), loses to quillbeasts.'),
      morph('bear', 'Bear Form', '🐻', 'Bear: 300 HP, melee. Beats quillbeasts, cannot hit hawks.'),
    ];
    // Druids stand 512 u from the centre (slot x 135 - 22.5 degrees), handed out at random.
    this.spawnHeroes(shuffled(ringSpots(this.pids.length, 512)), { hp: FORMS.druid.hp, r: R, speed: FORMS.druid.speed });
    for (const u of this.heroes.values()) this.setForm(u, 'druid', 1);
    this.shots = [];
    this.seeded = false;
  }

  setForm(u, form, pct) {
    const F = FORMS[form];
    u.form = form;
    u.gen = (u.gen || 0) + 1;
    u.skin = form === 'druid' ? 'nc_druid' : `nc_${form}`;
    u.maxHp = F.hp;
    u.hp = Math.max(1, F.hp * pct);
    u.speed = F.speed;
    u.path = [];
  }

  // ReplaceUnit: a new unit with the same HP percentage and no mana. Orders
  // (its own and everyone's attacks on the old unit) are lost.
  morph(pid, u, form) {
    if (!u.alive || u.form === form) return;
    this.mana.set(pid, 0);
    this.setForm(u, form, u.hp / u.maxHp);
    u.stop();
    u.attackOrder = null;
    u.swing = null;
    for (const v of this.heroes.values()) {
      if (v.attackOrder === u) v.attackOrder = null;
      if (v.swing?.tgt === u) v.swing = null;
    }
    this.ev({ k: 'morph', x: round2(u.x), y: round2(u.y), s: form });
  }

  canHit(u, v) {
    const A = FORMS[u.form].atk;
    return !!A && v.alive && v !== u && (A.air || !FORMS[v.form].air);
  }

  attackables(pid) {
    const u = this.heroes.get(pid);
    return [...this.heroes.values()].filter((v) => v.owner !== pid && v.alive && (!u || this.canHit(u, v)));
  }

  // Per-form attacks: walk into range, face, wind up (damage point), then hit
  // or loose a homing missile, as the base attack does with one weapon.
  stepAttacks(dt) {
    for (const [pid, u] of this.heroes) {
      if (u.atkCd > 0) u.atkCd -= dt;
      const A = FORMS[u.form]?.atk;
      if (u.swing) {
        u.swing.t += dt;
        if (u.swing.t >= A.point) {
          const t = u.swing.tgt;
          u.swing = null;
          if (A.missile) this.shots.push({ id: newId(), x: u.x, y: u.y, tgt: t, gen: t.gen, pid, A, m: u.form });
          else if (t.alive) this.hit(pid, A, t);
        }
        continue;
      }
      const t = u.attackOrder;
      if (!t || !A) continue;
      if (!u.alive || !this.canHit(u, t)) {
        u.attackOrder = null;
        continue;
      }
      const gap = dist(u.x, u.y, t.x, t.y) - u.r - t.r;
      if (gap > A.range) {
        if (u.target) u.steer(t.x, t.y);
        else u.order(t.x, t.y);
        continue;
      }
      if (u.target) u.stop();
      const ang = Math.atan2(t.y - u.y, t.x - u.x);
      if (Math.abs(wrapAngle(ang - u.heading)) > 0.35) {
        u.faceTo = ang;
        continue;
      }
      u.faceTo = null;
      if (u.atkCd > 0) continue;
      u.atkCd = A.cd;
      u.swing = { t: 0, tgt: t };
      this.ev({ k: 'swing', u: u.id });
    }
    for (const s of this.shots) {
      const t = s.tgt;
      // A missile whose target was replaced (it changed form) or died is lost.
      if (!t.alive || t.gen !== s.gen) {
        s.done = true;
        continue;
      }
      const d = dist(s.x, s.y, t.x, t.y);
      const step = s.A.missile * dt;
      s.f = Math.atan2(t.y - s.y, t.x - s.x);
      if (d <= step) {
        s.done = true;
        this.hit(s.pid, s.A, t);
        continue;
      }
      s.x += ((t.x - s.x) / d) * step;
      s.y += ((t.y - s.y) / d) * step;
    }
    this.shots = this.shots.filter((s) => !s.done);
  }

  hit(pid, A, t) {
    const F = FORMS[t.form];
    const dmg = between(A.min, A.max) * typeMult(A.type, F.arm) * armorMult(F.armor);
    this.ev({ k: 'hit', x: round2(t.x), y: round2(t.y) });
    this.damage(t.owner, dmg);
  }

  command(pid, m) {
    const u = this.heroes.get(pid);
    if (!u?.alive) return;
    if (m.c === 'move') {
      u.path = [];
      const tgt = this.attackTargetAt(pid, +m.x || 0, +m.y || 0);
      if (tgt) {
        u.attackOrder = tgt;
        return;
      }
      if (u.swing) u.swing = null;
      u.attackOrder = null;
      return goTo(this.nav, u, +m.x || 0, +m.y || 0);
    }
    if (m.c === 'steer' || m.c === 'stop') {
      u.path = [];
      u.swing = null;
    }
    super.command(pid, m);
  }

  tick(dt) {
    for (const [pid, m] of this.mana) {
      const u = this.heroes.get(pid);
      this.mana.set(pid, Math.min(MORPH_COST, m + (FORMS[u.form].regen || 0) * dt));
    }
    // t=3: the script seeds the computers' forms, one Bear, one Quillbeast, one Hawk.
    if (!this.seeded && this.time >= 3) {
      this.seeded = true;
      const bots = shuffled([...this.bots.keys()]).filter((p) => this.heroes.get(p).alive);
      ['bear', 'quill', 'hawk'].forEach((form, i) => {
        if (bots[i] != null) this.useAbility(bots[i], ['quill', 'hawk', 'bear'].indexOf(form), 0, 0);
      });
    }
    // Acquisition: 100 for players, the default (about 600) for computers.
    for (const [pid, u] of this.heroes) {
      if (!idle(u) || !FORMS[u.form].atk) continue;
      const v = nearest(u, this.attackables(pid), this.bots.has(pid) ? wc3(600) : wc3(100));
      if (v) u.attackOrder = v;
    }
    followPaths(this.heroes.values());
    stopOnLostTarget(this.heroes.values(), () => this.stepHeroes(dt));
    for (const u of this.heroes.values()) {
      if (!u.alive) continue;
      this.obs.push(u);
      clampOct(u, HW, CUT);
    }
  }

  // The original AI, every 1.5 s from t=3: a Quillbeast within 600 -> Bear; a
  // Hawk within 400 -> Quillbeast; a Bear within 300 -> Hawk; and 1 time in 5
  // walk to a random point. The original's checks also counted the bot
  // itself, which made bots cycle forms blindly; here they look at others only.
  botThink(pid, u, mem) {
    if (this.time < 3) return;
    mem.next ??= this.time + rand(0, 1.5);
    if (this.time < mem.next) return;
    mem.next += 1.5;
    const near = (form, r) => [...this.heroes.values()].some((v) => v !== u && v.alive && v.form === form && dist(u.x, u.y, v.x, v.y) <= wc3(r));
    const slot = { quill: 0, hawk: 1, bear: 2 };
    if (near('quill', 600)) this.useAbility(pid, slot.bear, 0, 0);
    else if (near('hawk', 400)) this.useAbility(pid, slot.quill, 0, 0);
    else if (near('bear', 300)) this.useAbility(pid, slot.hawk, 0, 0);
    if (Math.random() < 0.2) {
      const a = rand(0, Math.PI * 2);
      const r = rand(0, HW - 1);
      u.attackOrder = null;
      goTo(this.nav, u, Math.cos(a) * r, Math.sin(a) * r);
    }
  }

  hud(pid) {
    const u = this.heroes.get(pid);
    if (!u) return null;
    return { label: `${FORMS[u.form].name}  |  Mana ${Math.floor(this.mana.get(pid))} / ${MORPH_COST}` };
  }

  worldEnts() {
    return this.shots.map((s) => ({ id: s.id, k: 'ncshot', x: round2(s.x), y: round2(s.y), f: round2(s.f || 0), m: s.m }));
  }
}

noTies(NaturesCircle);
