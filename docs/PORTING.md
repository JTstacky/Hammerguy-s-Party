# Porting an Uther Party 4.0 minigame

The goal is the original game as it played in Warcraft III: same rules,
numbers, timeline, hazards, arena shape, scoring and bot behaviour, with the
contestant as a hammerguy unless the game needs another form. Match the source,
not a reinterpretation.

## Sources (read these first)

- `docs/uther-party/rules-4.0.md`: one rule sheet per event. It gives the goal,
  scoring, arena, units with exact stats, hazards, timeline, bot logic,
  designer notes and remake notes. This is the spec.
- `docs/uther-party/catalog.json`: one record per game (`n`, type, timer,
  key numbers, `remake_fit`).
- `docs/uther-party/arenas/<Name>.png`: the arena rendered from the map's
  pathing and terrain. Black is unwalkable, shading is cliff level and dots are
  trees and other destructables. Copy the layout.
- `docs/uther-party/engine.md`: measured WC3 behaviour (movement, collision,
  melee commits on swing start, arrows lead their target and do not home,
  artillery and splash).
- Existing ports to copy from:
  - `server/minigames/mortar.js` (#1 Peon Pandemonium)
  - `server/minigames/kodo.js` (#17 Stampede)
  - `server/minigames/wisp.js` (#47 Wheel of Fire)
  - their views in `engine/client/render/world.js`
  - their tests in `test/ports.test.js`

Scale: 1 hammerguy unit = 54 WC3 units. Use `wc3(u)` from
`engine/server/sim.js` for every distance and speed in the sheet
(`wc3(270)` is a paladin's speed). Times are seconds, the same as WC3.

## Files for a game (only add your own; don't edit shared engine files)

| File | What |
|---|---|
| `server/minigames/up/NN-slug.js` | The game: `export class X extends Minigame` with `static id = 'slug'`, `name` (the original name), `desc`, `controls`, `duration`, `timer` (`false` if the original has none), `ranking` |
| `client/views/slug.js` | Its visuals: models, entity views, events, theme and map builders, registered through `engine/client/render/registry.js` |
| `test/up-slug.test.js` | Tests of the key numbers and rules from the sheet |
| `server/minigames/index.js` | Add your import and put the class in the `UTHER` list, in event order |
| `client/views/index.js` | Add `import './slug.js';` |

`NN` is the event number, zero-padded (`07-roadkill.js`). The slug is short,
lowercase and unique (`roadkill`, `ratmaze`).

## Server API (`server/base.js`, `engine/server/sim.js`)

- `setup()`: build `this.map` and spawn things. `tick(dt)` runs at 30 Hz and
  calls `this.stepHeroes(dt)`, which runs bots, attacks, movement, casts and
  collision.
- **Heroes:**
  - Spawn them with `this.spawnHeroes(positions, { hp, speed, r, facing, turnRate })`. The defaults are the WC3 paladin's stats.
  - Contestants in the original with other stats (a peon's 190 speed, a rat) get those stats.
  - `u.skin = 'rat'` changes a hero's look; register the skin client side. Use a skin only when the look matters to play (disguise, forms, polymorph, vehicles).
- **Ranking** (`static ranking`):
  - `'survival'`: `this.eliminate(pid)` / `this.damage(pid, n)`; ante payouts are automatic.
  - `'race'`: `this.finish(pid)` pays 8, 7, 6 ... For winner-take-all, set `this.done = true` after the first finish.
  - `'score'`: `this.addScore(pid, n)`.
  - Reverse or special scoring: override `ranking()` / `payouts()` in your class, and say so in the file header.
- **Abilities** (Q W E R): `this.abilities = [{ name, icon, desc, kind: 'instant'|'point'|'unit', cd, charges, range, castPoint, pickTarget(pid,u,x,y), cast(pid,u,tgt), available(pid) }]`.
  - Set them before `spawnHeroes`, so charges get set up.
  - Targeted kinds turn to face first, like WC3. The HUD, hotkeys and touch buttons pick them up automatically.
  - Older single-ability games use `this.shove` / `this.spell`.
- **Attacks:**
  - Set `this.attack = { range, cd, point, dmg, missile: speedOr0, art: 'arrow'|'axe'|'bolt'|'rock'|'fire' }`. A right-click (or tap) on an attackable unit then orders an attack.
  - Override `attackables(pid)` to add creatures: `Unit`s with `hp`, `r` and `alive`.
  - Override `attackHit(pid, u, tgt)` / `onUnitKilled(unit, pid)` for special rules.
- **Other units:**
  - Keep your own arrays of `Unit`s or plain objects.
  - Move them with `stepUnits` or your own code, and collide with `collideUnits`.
  - Send them to clients from `worldEnts(pid)` as `{ id, k: 'yourkind', x, y, f, ...small extra fields }`. Keep snapshots small: round with `round2` and send only what the view needs.
- **Events:** `this.ev({ k: 'kind', x, y, ... })` fires one-shot effects on every client.
  - Built-in kinds: `boom` (with `s: 'rock'|'fire'|'kodo'`, `r`, `big`), `death`, `burn`, `squish`, `splash`, `txt`, `dmg`, `sfx` (`s`: sound name), `purge`, `shove`, `swing`, `hit`.
  - Your own kinds go through `registerEvent`.
- **HUD:** `hud(pid)` may return `{ label: 'Cheese: carried by Arthus' }` (shown in the top bar). `static timer = false` shows time played instead of a countdown.
- **Map:** `{ theme, floor: { shape: 'rect', w, h } | { shape: 'disc', r }, props: [...], bounds, build: ['yourbuilder'], follow }`.
  - Themes: `grass`, `dirt`, `stone`, `night`, `ice`, `lava`, or register your own.
  - Props: `tree`, `bush`, `rock`, `pillar`, `torch`, `moonwell`, `goldmine`, `flag` (`{ t, x, y, s }`). The helpers are in `server/minigames/props.js`.
  - Walls, mazes, cliffs, water and so on go in a registered map builder.
  - Keep hard map edges natural: blended ground, treelines and rocks, not boxes (see `terrain.js`).
- **Bots are required.** 51 of the 52 originals have bot logic; port it from the sheet's bot section. Implement `botThink(pid, u, mem)`, which runs every 0.15-0.3 s. Bots must be able to finish or survive plausibly.

## Client API (`engine/client/render/registry.js`)

```js
import * as THREE from 'three';
import * as M from '../../engine/client/render/models.js';
import { registerView, registerSkin, registerEvent, registerTheme, registerMapBuilder } from '../../engine/client/render/registry.js';

registerView('spider', {
  make(e, world, v) { const g = spiderModel(); v.parts = { legs: g.userData.legs }; return g; },
  update(v, a, b, k, dt, world) { /* v.x, v.z, v.f interpolated; position and rotation already set */ },
});
```

- **Models** (`models.js` exports):
  - Shapes: `blob(sx,sy,sz,{seed,amt,freq})` (organic lumps), `tube(points, r0, r1)` (limbs, horns, hafts), `lathe(profile)` (bodies, helmets, pots), `cloth(w,h,bend,sway)` (capes, banners), `axeBlade`, `mesh`, `scaled`, `G`.
  - Materials: `mat`, `texMat(file, base, tint, repeat)`, `triMat(file, base, tint, scale)` (triplanar, for blobs), `glowMat`, `boulderMat`, `furMat`, `hideMat`, `leatherMat`, `plateMat`, `goldMat`, `silverMat`, `barkMat`, `boneMat`.
  - Reusable models: `paladin`, `warhammer`, `kodo`, `beastmaster`, `catapult`, `tree`, `bush`, `rock`, `pillar`, `torch`, `goldmine`.
  - Models face +X, and y = 0 is the ground.
- **Quality bar:** this is Warcraft III, not programmer art.
  - Smooth-shaded, textured, readable silhouettes from the high RTS camera.
  - Creatures must show which way they face.
  - Scale matches the sheet's collision size, and models are drawn bigger than their collision, as in WC3.
  - No bare boxes, no flat shading, no untextured single-colour blobs for anything large.
- **Textures** in `client/public/fx/`:
  - Ground: `tex_grass`, `tex_dirt`, `tex_stone`, `tex_nightgrass`, `tex_snow`.
  - Materials: `tex_boulder`, `tex_wood`, `tex_fur`, `tex_hide`, `tex_leather`, `tex_plate`, `tex_bark`, `tex_needles`.
  - Effects: `fx_*`.
  - Tint them to get variety. If a game truly needs a new texture, see `art/gen.sh` (gpt-image-2 through `codex-imagegen`; generate into a folder without spaces or apostrophes) and `art/process.py`. Two at most per batch, named `tex_<slug>_*`.
- **Effects** (`world.fx`): `flame`, `smokePuff`, `dustCloud`, `debrisBurst`, `sparks`, `glow`, `explosion(x,z,r)`, `scorch`, `shockwave`, `ring`, `burst`, `trail`, `flash`. Also `world.shake = 0.3`. Emit continuous particles with a rate x dt accumulator, never per frame.
- **Controls:**
  - Every game must work with mouse (right-click move/attack, Q-R, left-click targets) and with touch (joystick, tap = right-click, ability buttons).
  - No camera zoom. Use `map.follow` / `gameZoom` only as the existing games do.

## Testing

- `npm test` runs every test. `test/smoke.test.js` plays every registered game to the end with 2, 4 and 8 bots and must pass.
- Add `test/up-slug.test.js` with the sheet's key numbers: speeds, radii, damage, timings, scoring edge cases.
- `npx vite build` must succeed. Don't use the shared browser pane; the lead reviews visuals.
- Engine changes: if a game needs one, don't edit shared files. Work round it inside your game and list the request in your report.
