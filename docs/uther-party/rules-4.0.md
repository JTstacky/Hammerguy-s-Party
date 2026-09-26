# Uther Party 4.0: rule sheets for all 52 minigames

> Rule sheets written from the map's own script (war3map.j), object tables and terrain, one section per minigame.
> Paths such as `up40/bundles/Peon.txt` or `ultx/j.txt` refer to the extraction workspace that `tools/extract.py`,
> `tools/bundle.py` and `tools/bundle_ultx.py` produce from the map files; helper scripts named in the text
> (`g1_layout.py` and similar) were one-off readers of the same data. Distances are WC3 units (1 tile = 128;
> 1 Hammerguy's Party unit is about 54 WC3 units), times are game seconds at Fast speed.

## Uther Party 4.0 rule sheets, group 1 (events 1-9)

Sources: `up40/bundles/<Prefix>.txt`, the framework triggers in `up40/j.txt` (Next Event, Survival/Tie/Race Death, Race Finish, Win/Draw/Finish, Dawn), the
WC3 1.26 base tables (UnitBalance/UnitWeapons/UnitAbilities/AbilityData .slk) for fields the bundle omits, and the arena layouts read from
`war3map.wpm` (terrain pathing) and `war3map.doo` (destructables) with a small script (`g1_layout.py`, next to `notes/`).

Conventions that apply to every game below:
- **Periodic triggers** are registered at map init, so their timers tick even while the trigger is disabled. The first tick after a game
  enables one lands 0 to P seconds later (P = the period), depending on the game clock. "Every 8 s" therefore means "first tick after 0-8 s, then every 8 s".
- **Ante:** Next Event sets ante = 9 - N (N = players in the match). **Survival:** the k-th player out scores 9 - N + (k - 1), and the last one
  alive scores 8 through "Win". **Race** games in this group set ante = 8, so finishers score 8, 7, 6 and so on, while anyone who dies or runs out of time scores 0.
- **Ties** happen only in games that set `udg_Boolean_TiesPossible = true` and enable "Tie Death": units that die in the same instant (the window is
  one `TriggerSleepAction(0)`) all score the same ante. If the last two die together, the game is a Draw and nobody gets the winner's ante. In no-tie
  games, when the last two die in the same instant, the second death processed is declared the winner: "Win" picks a random unit from
  KeyUnits, and at that moment that list still holds the other dying unit.
- **Damage math** uses the 1.26 armor table: siege does 50% to medium armor; pierce does 75% to medium; normal does 150% to medium; chaos does 100% to everything.
- **Player 12** (`Player(11)`, brown) is a `MAP_CONTROL_COMPUTER` slot, but no AI script is ever started for it. Any spell its units cast that the
  script does not order (War Stomp, Rain of Fire, Thunder Clap) would come from WC3's built-in unit behaviour, which the script cannot show.
- "MOD" marks a field this map overrides.

---

### Peon Pandemonium (bundle: Peon, event #1)
- **Goal (in-game text):** "Peon Pandemonium / Survive as long as possible!"
- **Type & scoring:** Survival with ties possible (TiesPossible = true, Tie Death on), so peons killed by the same rock share a rank. There is **no timer**: the game runs until one peon is left (Win) or the last ones die together (Draw).
- **Arena:** `Peon_Pandemonium` is 1024x1024 (8x8 tiles), centre (-1920, 1792). It is a sunken pit (cliff level 2) with cliff walls. The camera is locked to this rect.
  Outside the walls, on level-4 ground behind a ring of 80 line-of-sight blockers (YTlb), are four catapult spawn strips, each 160x1152:
  `Peon_1` east, `Peon_2` north, `Peon_3` west and `Peon_4` south. Each sits 704-864 u from the centre and spans +-576 u along its side.
  The pit holds 5 Barrens Tree Walls (BTtw, 50 HP, destructible by splash). `DestructableRestoreLife` on the rect restores them at the start of every play.
  One peon is created per playing player, 100-300 u from the centre at a random angle.
- **Player unit:** Peon `opeo`: HP 50 (MOD from 250), regen 0.25/s, armor 0 (medium), speed 190, collision 16. It has no attack (MOD) and no abilities (MOD: build/harvest removed).
- **Hazards / opponents:** Player 12 siege units.
  - Units 1-8 spawned are `ncat` "Catapult" (MOD name; base Draenei Demolisher, abilities cleared so it has **no Burning Oil**).
    Damage 81+3d21 = 84-144 siege artillery. Splash: full within 25, 40% within 50, 25% within 150. Cooldown 4.5 s, damage point 0.1, range 2000 (MOD), **projectile speed 400** (MOD from 900), HP 425.
  - Unit 9 onward is `ocat` Demolisher: 71+3d18 = 74-125 (dice MOD 1 to 3), same splash, range and speed. It keeps **Burning Oil** (Abof) with its tech requirement switched off (`checkDep=0`).
    Burning Oil leaves a ground fire of radius 150 for 2.51 s, doing 6 damage per 0.5 s (full) and 3 per 1 s (half); these are the 1.26 defaults.
  - Against a peon (siege x0.5): a catapult direct hit does 42-72 and kills about 91% of the time; the 40% ring does 17-29 and the 25% ring 10.5-18. A demolisher direct hit does 37-62.5 and kills 50% of the time.
  - Spawn: "Peon Spawn" ticks every 8 s, but only while Player 12 has fewer than 30 units. It waits a random 0-2 s, then creates one siege unit at a random
    point of a random strip, facing the centre, and immediately runs "Peon Fire". The cap is 30 units (8 catapults + 22 demolishers), reached after about 4 minutes.
  - "Peon Fire" runs every 2 s (and on each spawn): every siege unit is ordered to `attackground` a uniform random point in the pit, so the effective fire rate is one rock per unit per about 4.5 s.
- **Timeline:** Music Orc3. Peons created, camera locked, tree walls restored, text shown. Survival and Tie Death enabled; AI enabled if any computer player is in the match.
  **Wait 6 s**, then enable Spawn and Fire. The first siege unit appears about 6-16 s in, then roughly one more every 8 s. The first demolisher (9th unit) comes at about 70-80 s.
- **How you lose / win / finish:** You lose when your peon dies to rock or oil damage. The last peon alive wins.
- **Computer-player AI:** Every 4 s, each computer peon is ordered to move to a uniform random point in the pit. It does no dodging.
- **Designer notes:** The centre takes more fire but gives the most warning time, and it loses that edge once there are too many catapults to track. Watch for the oil-throwing demolisher. This was TheZizz's first minigame.
- **Remake notes:**
  1. Slow lobbed rocks: impact point fixed at launch, flight time = distance / 400 (about 1.8-2.5 s to the centre, 0.5-4.4 s overall). Show a landing marker. Existing *Mortar Mayhem* is the closest match.
  2. The spawn ramp is the difficulty curve: +1 launcher every 8 s up to 30, all re-aimed at random points every 2 s.
  3. Two tiers: 8 plain catapults, then demolishers that leave a 2.5 s burning patch (radius 150).
  4. Falloff rings 25/50/150 with factors 1/0.4/0.25. Near misses chip a peon rather than kill it, and it only regens 0.25/s.
  5. Oddities: every siege unit is re-aimed every 2 s while its cooldown is 4.5 s, so a unit often turns toward a new point before firing. All of them re-aim together whenever a new one spawns.
     The line-of-sight blocker ring is moot because Next Event turns fog off. The teleport effect on each spawn is never destroyed (harmless leak).

---

### The Rat Maze (bundle: Rat, event #2)
- **Goal (in-game text):** "The Rat Maze / Get the cheese, and return to your circle!"
- **Type & scoring:** Nominally a Race (ante set to 8), but it is **winner-take-all** in practice. "Rat Finish" removes every rat from KeyUnits *before* running Race Finish, so the first rat home with the cheese scores 8, KeyUnits is empty, and "Finish" ends the game. Everyone else scores 0.
  The timer is **120 s**. On expiry, Race Expire kills all rats and the game is a Draw with nobody scoring. If every rat dies, it is also a Draw. There are no ties.
- **Arena:** `Rat_Maze` is 2432x2432 (19x19 tiles), centre (960, 1728), and the camera is locked to it. The maze has 1-tile (128 u) corridors and 2-tile walls.
  It is point-symmetric (180 degrees). Tile grid from `war3map.wpm`, north up (`#` wall, `.` floor, digit = player N's start/circle, `C` = cheese):
  ```
  ...1...##......6...
  .#####.##.########.
  .#####.##.########.
  5##.............##2
  .##.########.##.##.
  .##.########.##.##.
  .##....##....##....
  .##.##.##.#####.###
  .##.##.##.#####.###
  ....##...C...##....
  ###.#####.##.##.##.
  ###.#####.##.##.##.
  ....##....##....##.
  .##.##.########.##.
  .##.##.########.##.
  4##.............##7
  .########.##.#####.
  .########.##.#####.
  ...8......##...3...
  ```
  Start locations (world): P1 (192,2880), P2 (2112,2496), P3 (1728,576), P4 (-192,960), P5 (-192,2496), P6 (1728,2880), P7 (2112,960), P8 (192,576). Two starts sit on each outer side.
  Each playing player gets a rat on their start location plus their own Circle of Power (`ncop`, invulnerable, scaled to 75%). The Cheese item `ches` is created at the maze centre.
- **Player unit:** Rat `nrat`: HP 15, regen 0.5, speed **270** (MOD from 100), collision 7 (MOD), no attack, 1-slot inventory (Aihn MOD: capacity 1, can use items; drops items on death).
  Picking up the cheese adds a "TalkToMe" marker above the rat and **sets its speed to 190**. Dropping or losing the cheese restores 270.
- **Hazards / opponents:** 5 Spiders `nspr` (Player 12) start on the cheese: one at the centre and one each at +-128 on the x and y axes.
  Spider: HP 200, speed 270 (equal to an empty rat), collision 15 (MOD), bite 10-11 normal (x1.5 vs the rat's medium armor = 15-16.5, so **one bite kills a 15 HP rat**), cooldown 1.35, range 100, acquisition 275 (MOD).
  "Rat Patrol" fires once 4 s in, then every 10 s: each spider gets a `patrol` order to a uniform random point in the maze rect.
  On patrol it walks back and forth and auto-attacks any rat within 275.
- **Timeline:** Music PursuitTheme. Rats, cheese, circles and spiders created. 120 s timer shown. Race Death/Expire and the Rat Finish/Death/Obtain/Lose triggers enabled.
  **Rats can move immediately.** Spiders sit on the cheese until the **4 s** wait ends, then patrol and re-patrol every 10 s. AI enabled at 4 s.
- **How you lose / win / finish:** "Rat Finish" checks every 0.1 s for a unit within **100 u of player k's start location** that holds the cheese and is owned by player k.
  The first such rat wins (8 points) and the game ends. A dying rat drops the cheese where it died, and its owner's circle is killed ("Rat Death").
- **Computer-player AI:** Every 1 s, for each computer rat: if no Player 12 unit is within 600, move to the cheese's position, otherwise flee to its own start.
  If within 72 of an unowned cheese, it is handed the cheese directly (`UnitAddItemSwapped`). If carrying, it moves home.
- **Designer notes:** Read the spiders' movement so you don't get trapped. The cheese slows you dramatically.
- **Remake notes:**
  1. Use the exact 19x19 maze above, with 8 edge starts and the cheese plus 5 guards in the centre.
  2. The carrier drops from 270 to 190 while spiders move at 270, so a carrier can't outrun a spider. A carried cheese drops on death and anyone can pick it up. This is close to *Gold Rush*, but with a single item.
  3. Spiders: patrol to a random point every 10 s and aggro at 275. One bite is lethal.
  4. Winner-take-all with a 120 s timer, and nobody scores on timeout. For the remake, decide whether to keep this or pay 8/7/6 to later returns (the code cannot produce a second finisher).
  5. Bug/oddity: the bot's "go to cheese" uses the item's location even while another rat carries it.

---

### The Kaboom Room (bundle: Kaboom, event #3)
- **Goal (in-game text):** "The Kaboom Room / Survive as long as possible!"
- **Type & scoring:** Survival with ties possible (TiesPossible and Tie Death on). **No timer.**
- **Arena:** `Kaboom_Room` is 1408x1408 (11x11 tiles), centre (3648, 1728), and the camera is locked to it. The room is an octagon (corners cut by cliffs) on flat level-4 floor,
  with four 128x128 pillars 384 u N/S/E/W of the centre. Each player's Goblin Sapper spawns **600 u from the centre** at a random angle.
- **Player unit:** Goblin Sapper `ngsp`: HP **25** (MOD from 100), regen 0.25/s (MOD), speed 270, collision 32, no attack. Its only ability is **Death Damage** (Adda, MOD).
  When it dies it deals **700 within 150 u** and **300 within 250 u** to all ground units, including other players, because the "enemy" target flag was removed.
  Any sapper within 250 of a dying sapper therefore dies too, which allows chain reactions. The trigger adds an explosion effect, sound and a camera quake of 500.
- **Hazards / opponents:**
  - **Fires** (`ewsp` Wisp renamed "Fire"): flying at height 1, speed 350 (MOD), collision 0, invulnerable (Avul).
    Permanent Immolation (ANpi, 1.26 defaults) does **10 damage/s to enemy ground units within 220**. A sapper therefore dies after 3 ticks in range; one pass of a fire usually lands 1-2 ticks.
  - A fire is created at the centre and ordered to a point 900 u away in a random direction. "Kaboom Reset Base" checks every 0.05 s, and any fire at 800 u or more from the centre is teleported back to the centre and sent out on a new random heading.
    Each fire is thus a spoke that sweeps outward from the centre roughly every 2.3 s (800 / 350).
  - Spawn: every 10 s, while Player 12 has fewer than 10 units, wait 0-2 s and add one fire. The cap is **10 fires**, reached about 95-107 s in.
  - **Centre flame:** once it is lit, sappers within 128 u of the centre lose 10 HP every 1 s (trigger damage). Quest: "The middle does not heal you."
- **Timeline:** Music War2IntroMusic. Sappers placed; Survival, Tie Death, Reset Base and Death triggers enabled; AI enabled if needed. **Wait 5 s**, then light the burning centre effect and brazier loop and enable Center Flame and Wisp Spawn.
  The first fire appears about 5-17 s in.
- **How you lose / win / finish:** You lose when your sapper's HP reaches 0, whether from fire ticks, the centre, or a neighbour's explosion. The last sapper standing wins. If the last ones die in the same instant, the game is a Draw.
- **Computer-player AI:** Every 2 s, each computer sapper moves 200-500 u from its position, heading away from the centre +-120 degrees at random.
- **Designer notes:** Anyone who dies explodes and kills those nearby, so avoid weakened players, or use it to kill a leader.
- **Remake notes:**
  1. Radial "spoke" hazards: up to 10 fires shoot out from the centre at 350 u/s to radius 800 and respawn at once with a new heading. Each has a 220 burn aura doing 10/s. This is similar in spirit to *Wisp Wheel*, but with random directions.
  2. Fragile players (25 HP) take chip damage, so HP matters. Show HP bars.
  3. Death explosion: 700 dmg within 150 and 300 within 250 to everyone, which enables chain kills and griefing.
  4. The centre is a 128 u damage zone at 10/s, and it is also where fires spawn.
  5. Oddity: the centre flame effect is created once and never destroyed (Next Event only destroys the *last* created effect). This leaks harmlessly.

---

### Hot Mortar (bundle: Mortar, event #4)
- **Goal (in-game text):** "Hot Mortar / Keep passing the mortar on!"
- **Type & scoring:** Survival, **no ties** (TiesPossible false, no Tie Death), **no timer**. `KeepQuitters = true`, so a leaver's mortar team stays in play.
- **Arena:** `Mortar` is 1536x1536 (12x12 tiles), centre (-1920, -768), and the camera is locked to it. The floor is flat, with a 512x512 raised cliff block in the centre. On its 256x256 plateau stands a **Cannon Tower** `hctw` (Player 12; attack removed, has Pass Mortar).
  There are 32 invisible 128x128 ground pathing blockers (YTpc) in a regular pattern.
  Eight 256x256 spawn squares sit about 690 u from the centre, two per side. `Mortar_k` is used for player slot k, and the units are created neutral, then **handed out at random** by Next Event.
  Offsets from the centre: W (-640, +256) and (-640, -256); N (-256, +640) and (+256, +640); E (+640, +256) and (+640, -256); S (-256, -640) and (+256, -640).
- **Player unit:** Mortar Team `hmtm`: **HP 5** (MOD), speed 270, collision 48 (MOD), `SetUnitExploded` (it gibs on death). Its attack is hidden (showUI off), with acquisition forced to 100.
  **Pass Mortar** (ACtb renamed): 0 mana, **0 cooldown**, range 2000, missile speed 900, 0 stun duration. It can target invulnerable units, and it keeps the base **100 damage** on impact.
  The Mortar Team's cast point is **1.0 s** (MOD) and its backswing 1.1 s. "Mortar Target" converts any unit-target order (for example a right-click on a unit) into Pass Mortar on that unit.
- **Hazards / opponents:** The mortar itself. All mortar teams are **invulnerable and paused** except the current holder.
  - **Pass** ("Mortar Pass", on spell effect): the burning marker is removed and the holder is cleared (`Unit_Important = null`). The caster is paused.
    After waiting distance / 900 s (the flight), the target gets the burning marker, is **unpaused**, is ordered to stop, and becomes the holder. Adjacent squares are about 0.57 s apart; across the arena is about 1.4 s.
  - **Fuse** ("Mortar Detonate"): **uniform random 5-25 s** after the tower's opening throw. At detonation, all mortar teams are made vulnerable and the holder is exploded.
    The explosion is retried at +0.5 s and +1.0 s in case the mortar was in flight. Because everyone is now vulnerable, a Pass Mortar still in flight deals its 100 damage on landing and kills the receiver anyway.
    So **a mortar in the air when the fuse runs out kills whoever it is flying to**, and the thrower is safe once the spell effect has fired. If the fuse expires during the thrower's 1 s wind-up, the thrower dies.
- **Timeline:** Music Human1. Teams created (neutral), set to explode on death, all units paused, tower created at the centre, and all acquisition ranges set to 100.
  "Mortar Start" (at init and after every death): make every unit invulnerable, pause everything, unpause the tower, **wait 4 s**, then the tower throws to a random mortar team and the fuse starts.
  Players pass until detonation. The death runs Survival scoring and "Mortar Death" (disables the old fuse, explosion effect, quake 500, and runs Mortar Start for the next round).
- **How you lose / win / finish:** You lose when you hold the mortar (or it is flying to you) when the fuse ends. One player is eliminated per round, and the last one left wins.
  Expected length: (N - 1) rounds x (4 s pause + 5-25 s fuse).
- **Computer-player AI:** Enabled regardless of whether bots are present. Every 1.5 s, every computer-owned unit is ordered to Pass Mortar to a random mortar team; picking itself just fails. Only the unpaused holder can obey, so a bot passes within about 1.5 s + 1 s wind-up of receiving.
- **Designer notes:** Holding the mortar just long enough lets you snipe a chosen player, but the fuse is random. This was the hardest game to make, and computer players were added to the map largely so it could be tested.
- **Remake notes:**
  1. This is essentially a timed hot potato like *Sapper Tag*, but by lobbing, not touching: pass to any player at any range, flight = distance / 900, and a 1.0 s wind-up.
  2. Only the holder can act; everyone else is frozen. Fuse is uniform 5-25 s per round, with a 4 s pause before each throw from the central tower.
  3. The key rule: if the fuse ends mid-flight, the **receiver** dies. Long cross-arena passes (about 1.4 s) are the sniping tool.
  4. Exactly one elimination per round, with no ties.
  5. Possible bug: `udg_Unit_Focus` (the pass target) is a single global overwritten by *any* unit-target order from anyone. A second target order during the holder's 1 s wind-up could redirect where the marker and control go. Whether paused units can generate that event is unverified.

---

### The Clean-up Crew (bundle: Clean, event #5)
- **Goal (in-game text):** "The Clean-up Crew / Stay on the blight!"
- **Type & scoring:** Survival with ties possible (TiesPossible and Tie Death on). **No timer.**
- **Arena:** `Clean_Crew` is 1664x1664 (13x13 tiles), centre (-1856, -3392). It is a flat, empty square enclosed by cliffs (no destructables), and the camera is locked to it. The time of day is set to 00:00 (night, visual only).
  **Blight:** 3 discs of **radius 512** are centred at random points inside the central 256x256 square, giving a roughly 1,100-1,400 u wide blighted blob.
  Ghouls spawn 0-256 u from the centre with random facing. Four Priests (Player 12) stand at centre (+-700, +-700).
- **Player unit:** Ghoul `ugho`: **HP 50** (MOD from 340), speed 270, collision 31, no attack. Regen **20 HP/s** (MOD from 2), and its regen type stays "blight", so **it only regenerates on blight**.
  "Clean Degrade" removes 1 HP every 0.05 s (**-20 HP/s**) from every ghoul. On blight the net change is 0; off blight a full ghoul dies in **2.5 s**.
  Its only ability is Cannibalize (Acan MOD: 5 HP/s from a corpse, range 50). That still leaves a ghoul off blight at -15/s.
- **Hazards / opponents:** 4 Priests `hmpr`: speed 270, no attack (MOD), mana 400 (starts full), regen 4/s (MOD), Wander (Awan, drifts randomly).
  Their other ability is **Dispel Magic** (Adsm creep version: 75 mana, range 500, **AoE 200**, cooldown 8 s; "Clean Reset" resets the cooldown on every cast).
  "Clean Dispel" runs every 10 s: it picks a uniform random living ghoul and orders a random priest to cast `dispel` on it. The priest walks into range 500 and casts (0.5 s cast point) at the ghoul's position at cast time.
  **Nothing in the script removes blight during play.** The erosion therefore relies on WC3's Dispel Magic clearing blight in its 200 AoE, which is the design the quest describes ("priests will dispel the blight from under you").
  Clearing is constant, one 200-radius hole per 10 s, with no ramp; the shrinking blob is the difficulty curve.
  "Clean Death": **every ghoul that dies leaves a new blight disc of radius 192** at its death spot.
- **Timeline:** Music Undead1. Night. Blight placed, ghouls and priests created. Tie Death, Survival, Degrade, Death and Reset enabled; AI if needed. **Wait 5 s**, then Dispel is enabled. The first dispel order comes 5-15 s in, then every 10 s.
- **How you lose / win / finish:** You lose when your ghoul reaches 0 HP from being off blight too long. The last ghoul alive wins. Simultaneous deaths tie.
- **Computer-player AI:** Every 4 s it picks a random living ghoul; if a computer owns it, it moves 50-200 u in a random direction.
  Also, each time a dispel is ordered, every computer ghoul inside a 650x650 box around the targeted ghoul moves 500-600 u in a random direction. That can easily carry it *off* the blight.
- **Designer notes:** Keep moving. Priests only aim at ghouls' positions, so constant motion helps you escape the cleared spot in time.
- **Remake notes:**
  1. Territory-survival: a blight mask that is safe (0 net HP) versus unsafe (-20 HP/s), with a 2.5 s grace from full HP. A health bar is essential. Closest to *King of the Hill* or *Ice Sumo* (a shrinking safe area).
  2. The shrink is targeted: every 10 s a 200-radius hole is punched at a random player's current position, after a visible priest walk-up. The priest's approach is the tell.
  3. Dead players leave a 192-radius blight island, which is safe ground for others.
  4. Starting blight is the union of 3 random radius-512 discs near the centre.
  5. Oddity: the bot "dodge" moves in a random direction, often straight off the blight.

---

### Way of the Bow (bundle: Way, event #6)
- **Goal (in-game text):** "Way of the Bow / Kill your opponents!"
- **Type & scoring:** Survival, **no ties** (TiesPossible false). **Timer 120 s** ("Time Left"). On expiry, Survival Expire gives **every survivor the current ante** (all survivors tie), kills them, and the game is a Draw with no winner bonus.
- **Arena:** `Way_of_the_Bow` is 2560x2560 (20x20 tiles), centre (1024, -3584), and the camera is locked to it. The time of day is set to 00:00.
  158 Summer Tree Walls (LTlt, 50 HP; archers can't target trees) form a square ring at the edge. Inside is a symmetric pattern: a central cross with gaps, four diagonal clumps and side clumps, which work as cover and chokepoints. Tile grid (`A` tree, `.` open):
  ```
  .AAAAAAAAAAAAAAAAAAA
  A.......AAAAA......A
  A........AAA.......A
  A...AA....A....AA..A
  A...AAA...A...AAA..A
  A....AAA.....AAA...A
  A.....A.......A....A
  AA........A.......AA
  AAA.......A......AAA
  AAAAA..AAAAAA..AAAAA
  AAA......AA......AAA
  AA........A.......AA
  A.....A...A...A....A
  A....AAA.....AAA...A
  A...AAA.......AAA..A
  A...AA....A....AA..A
  A.........A........A
  A.........AA.......A
  .A.......AAAA......A
  ..AAAAAAAAAAAAAAAAA.
  ```
  Archers are created neutral at **radius 1000** from the centre, at angle (slot x 135 - 22.5) degrees: slots 1-8 give 112.5, 247.5, 22.5, 157.5, 292.5, 67.5, 202.5 and 337.5, all facing the centre. Next Event then **hands them out randomly**.
- **Player unit:** Archer `earc`: **HP 5** (MOD from 245), speed 270, collision 31, all abilities removed (no Shadowmeld).
  Attack: 16-18 pierce (x0.75 vs medium = 12-13.5, **one hit kills**), cooldown 1.5 s, damage point 0.72 s, **range 800** (MOD from 500).
  Weapon type is **Missile (Splash)** (MOD from Missile) with no splash radii defined. Projectile speed is not overridden (1.26 archer default).
  Acquisition range is forced to 100 so archers don't auto-shoot at range. "Way Patrol" converts any `patrol` order into a plain `move`, which removes the patrol auto-attack exploit, so you must target shots manually.
- **Hazards / opponents:** Only the other players.
- **Timeline:** Music NightElf1. Night. Archers placed; all units **paused**; camera locked; 120 s timer starts *immediately* (the 5 s freeze counts against it). Survival, Expire and Patrol enabled. **Wait 5 s**, then unpause and enable the AI.
- **How you lose / win / finish:** You lose when you take any arrow. The last archer alive wins. At 120 s, all survivors share the current ante.
- **Computer-player AI:** Every 2 s, each computer archer is ordered to move to a random point in the arena. Then, with 3/4 chance, it gets an `attack` order on a random living unit in the arena (sometimes itself, which fails), which replaces the move.
- **Designer notes:** An arrow aimed at you follows your path, so wait for the release and then change direction. This game has the highest mastery potential. (Quillboar Mile uses "the same dodging mechanics".)
- **Remake notes:**
  1. One-hit-kill ranged duel with a 0.72 s wind-up, 1.5 s cooldown and 800 range, on a tree-cover map with a 120 s cap.
  2. The dodge rule is engine behaviour and not in the script: the only change is `missile` to `msplash` with no splash area. The designer describes arrows that track your path unless you change course after release.
     Measured live (engine.md): the arrow is aimed at release at the target's predicted position (position + velocity x flight time)
     and does not home. Stopping or reversing after the release (0.72 s) always dodged, and so did being mid-turn at the release.
     Holding course, or finishing a turn before the release, got you hit. An arrow already loosed still hits if its archer dies.
     For the remake, aim at the predicted point, fly straight to it, and hit whoever's circle covers it.
  3. No auto-targeting (acquisition 100, patrol blocked): every shot is a deliberate click.
  4. Timeout gives all survivors equal points and there is no Win bonus. Simultaneous mutual kills are not ties; one of them is declared the winner (see conventions).

---

### Roadkill Challenge (bundle: Roadkill, event #7)
- **Goal (in-game text):** "Roadkill Challenge / Reach the end!"
- **Type & scoring:** Race, with ante set to 8 (1st gets 8, 2nd 7, and so on). A finisher is removed with a teleport effect.
  **Timer 90 s** (the quest says "less than 2 minutes"). Race Expire kills everyone left, who score 0. Deaths score 0. When nobody is left, the game is a Finish if someone finished and a Draw otherwise.
- **Arena:** `Roadkill_Challenge` is 1920x1536 (15x12 tiles), centre (576, -768). The camera is bounded to it and starts panned to the start.
  A wall 3 tiles wide (x 384-768) runs from the bottom edge up to y = -256, which splits the course into a **left half** (x -384 to 384) and a **right half** (x 768 to 1536). They connect only across the top strip (y -256 to 0).
  Start: `Roadkill_Start` is 768x128 at the bottom-left (y -1536 to -1408); murlocs spawn at random points in it, facing 90 degrees (north).
  Finish: `Roadkill_Finish` is 128x128 at (1152, -1408), bottom-right, marked by a Circle of Power. **Route:** north up the left half, east across the top, then south down the right half.
- **Player unit:** Murloc Tiderunner `nmrl`: HP 240, speed 270, collision 31 (players block each other), attack disabled (MOD).
- **Hazards / opponents:** 8 Siege Engines `hmtt` (Player 12; collision **0**, MOD, so they pass through everything; abilities removed). Each patrols one horizontal lane:

  | lane (y) | side | patrol x range | speed |
  |---|---|---|---|
  | -1216 | left | 320 to -320 | 220 (default) |
  | -832 | left | 320 to -320 | 280 |
  | -448 | left | 320 to -320 | 340 |
  | -448 | right | 832 to 1472 | 260 |
  | -576 | right | 1472 to 832 | 260 |
  | -960 | right | 832 to 1472 | 280 |
  | -1088 | right | 1472 to 832 | 280 |
  | -1216 | right | 832 to 1472 | 280 |

  The left lanes are 384 apart and get faster going north. The right lanes come as a pair (-448/-576) and a trio (-960/-1088/-1216), each spaced 128, with adjacent cars moving in opposite directions.
  **Kill rule** ("Roadkill Death", every 0.05 s): any key unit within **128 u** (centre distance; the car's collision is 0) of any Siege Engine dies instantly.
  Lanes 128 apart leave no fully safe waiting spot between them. Midway (64 from each lane) you still die if a car passes within about 111 u along x, which matches the "very difficult" gap in the quest.
- **Timeline:** Music IllidansTheme. Units created, cars start patrolling at once, 90 s timer starts. Race Death/Expire, Finish and Death enabled. **Players can move immediately** (no freeze). At 4 s, computer murlocs get their single order.
- **How you lose / win / finish:** Entering `Roadkill_Finish` finishes you and scores the current ante. A car within 128 kills you (0 points). At 90 s, everyone left dies.
- **Computer-player AI:** At 4 s, each computer murloc gets a single `move` to the finish centre and nothing more (no timing logic).
- **Designer notes:** A Frogger clone. Stay clear of other players, who can body-block you and ruin your timing. The final two-car gap fits a murloc, but barely.
- **Remake notes:**
  1. Frogger lanes with the exact table above: U-shaped course, 640 u lanes with patrol ping-pong. Cycle time = 1280 / speed, i.e. 3.8-5.8 s. Race format like *Golem Gauntlet*.
  2. Instant death at 128 u from a car's centre. Cars ignore collision.
  3. Player-player collision (31) matters: blocking is part of the game.
  4. 90 s cap; the placing order gives 8, 7, 6.

---

### Covert Kitty (bundle: Covert, event #8)
- **Goal (in-game text):** "Covert Kitty / Elude the Doom Guards!"
- **Type & scoring:** Race, with ante set to 8. **No timer and no Race Expire.** The day/night clock is the pressure: time starts at **01:00** and runs (UseTimeOfDay on).
  The 1.26 day length is 480 s, so one game hour is 20 s and **dawn at 06:00 comes 100 s in**. After dawn, Shadowmeld stops working.
  "Dawn" freezes the clock at 07:00 (120 s). The game ends only when every huntress has finished or died. Deaths score 0.
- **Arena:** `Covert_Kitty` is 2176x1152 (17x9 tiles), centre (3648, -832), and the camera is bounded to it and starts at the start pen.
  `Covert_Start` is 256x512 at the west end; huntresses spawn at random points in it, facing east.
  `Covert_Finish` is 256x384 at x 4736-4992: a gap in the east tree wall **outside** the camera rect, marked by a Circle of Power.
  33 Summer Tree Walls form partial walls and cover. Tile grid (`B` tree, `A` a decorative doodad, `#` cliff; the finish opening is the right edge, rows 4-6):
  ```
  ...........AB....B#
  ............B....B#
  ..B..BBBBB..B..B.B#
  ..B............B...
  ..B............B...
  ..B............B...
  ...BBBB..B..BBB..B#
  .........B.......B#
  .........B.......B#
  ```
- **Player unit:** Huntress `esen`: **HP 55** (MOD from 600), armor 2, speed **270** (MOD from 350), collision 31, no attack. Its only ability is **Shadowmeld** (Ashm: invisible after standing still for 1.5 s; night only).
- **Hazards / opponents:** 3 Doom Guards `nbal` (Player 12) on the midline at (3520, -832), (3904, -832) and (4288, -832); their guard positions are removed.
  Doom Guard: HP 1350, armor 3, **speed 270 (same as the huntress)**, collision 48, acquisition 600 (night sight 800), mana 500, regen 1.25/s.
  Ground attack (weapon 2): 35-42 chaos, cooldown 1.35, range 128. After the huntress's armor that is about 31-37, so **two hits kill**. Weapon 1 is air-only.
  Abilities: **Cripple** (ACcr: 175 mana, cooldown 10, range 600, **30 s** (MOD from 60), -75% move speed and -50% attack speed).
  They also have Dispel Magic, War Stomp (A006: 250 AoE, 3 s stun, 90 mana) and Rain of Fire, but the script never orders those three.
  The unit type is set to "sapper,summoned". That is irrelevant here; the same unit is reused in Clandestine Kitty.
  - "Covert Patrol": every 7 s, each Doom Guard gets `attack` (attack-move) to a random point in the arena, and it auto-engages visible huntresses within 600 on the way.
  - "Covert Cripple": every 2 s, each Doom Guard is ordered to Cripple a random huntress within 400. Shadowmelded (invisible) huntresses can't be targeted.
    The mana budget is about 2 casts at once, a 3rd after about 20 s, then 1 per 140 s per guard.
- **Timeline:** Music NightElf2. 01:00 night. Units created; Dawn, Race Death, Finish and Cripple enabled. **Players can move immediately.** At **2 s**, Patrol and AI are enabled, and the first patrol tick comes 2-9 s in.
  At 100 s it is dawn and shadowmeld is gone. At 120 s the clock freezes at 07:00 (permanent day).
- **How you lose / win / finish:** Entering `Covert_Finish` is a Race Finish (8, 7, 6...). Being killed by Doom Guard melee means 0 points.
- **Computer-player AI:** Every 0.5 s: if no Doom Guard is within 500, move to the finish; otherwise cast `ambush` (Shadowmeld). Once the time of day is 06:00 or later, all computer huntresses are sent to the finish and the AI turns itself off.
- **Designer notes:** A mad dash can work, but Cripple stops you fast. Ideally wait for others to draw the guards' attention before running. The designer considers it one of the most balanced games.
- **Remake notes:**
  1. Stealth race: stand still for 1.5 s to become invisible, but only until dawn at 100 s. Show the clock.
  2. Guards move at your speed, so the real threat is **Cripple** (-75% speed for 30 s, cast from 400) on a limited mana budget, followed by melee (2 hits).
  3. Guards attack-move to a random arena point every 7 s, with 600 aggro. Crippling others makes them bait.
  4. Add a hard timeout in the remake; the original has none.

---

### The Polymorph Ring (bundle: Polymorph, event #9)
- **Goal (in-game text):** "The Polymorph Ring / Survive as long as possible!" (quest title: "Polymorph Ring")
- **Type & scoring:** Survival, **no ties**, **no timer**.
- **Arena:** `Polymorph_Ring` is 1280x1280 (10x10 tiles), centre (3968, -3584). It is an octagonal room (corners cut by cliffs), flat, with no obstacles, and the camera is locked to it.
  A mass-teleport effect marks the centre. Sorceresses spawn **500 u from the centre** at random angles.
- **Player unit:** Sorceress `hsor`: **HP 5** (MOD from 325), speed **220** (MOD from 270), hover, no attack.
  Mana **400** (starts full, MOD) with **0 regen** (MOD), so spell use is a fixed budget. Slow autocast is off by default (MOD).
  - **Slow** (Aslo MOD): 100 mana, cooldown 8, range 700. It lasts 20 s on normal units and 10 s on hero/resistant targets, with -60% move speed and -25% attack speed.
  - **Invisibility** (Aivs MOD): 300 mana, 10 s, range 300, and can now target **self**.
  - **Polymorph** (ACpy): 200 mana (MOD from 220), cooldown 10, range 500, 25 s. It turns the target into a sheep and affects creeps up to level 5.
  - **Resistant Skin** (ACrk). In WC3 this makes spells use their Hero duration on the unit, so an opponent's Slow lasts 10 s. I believe it also blocks Polymorph, which would stop players sheeping each other, but that is engine behaviour and not verifiable here.
- **Hazards / opponents:** Ancient Sasquatch `nsqa` (Player 12): HP 1200, armor 5, speed **220** (MOD from 320, so the same as a sorceress), acquisition **300** (MOD).
  Attack 61-68 chaos, cooldown 1.35, range 128, which kills in one hit. Its **level is 5** (MOD from 9) precisely so Polymorph can affect it.
  Abilities: Thunder Clap (ACtc: 70 dmg, 250 AoE, 90 mana; not ordered by the script) and Reincarnation (irrelevant, since nobody can damage it).
  - Spawn: every 10 s, while Player 12 has fewer than **8** units, wait 0-5 s and create one Sasquatch at the centre (teleport effect). The cap is 8, and sheeped Sasquatches still count.
  - "Polymorph Patrol" (every 2.5 s, enabled from the start): remove guard positions and give every Sasquatch an `attack` (attack-move) to a random point in the ring.
    Each Sasquatch keeps re-targeting a random spot and bites anything that comes within 300.
- **Timeline:** Music Human2. Sorceresses placed, centre effect, Survival and Patrol enabled. **Wait 5 s**, then Spawn is enabled and the AI turns on if needed. The first Sasquatch arrives about 5-20 s in, and all 8 by about 75-90 s.
- **How you lose / win / finish:** You lose on your first hit (5 HP). The last sorceress alive wins. Mana never regenerates, so the game always ends.
- **Computer-player AI:** Every 2 s, each computer sorceress moves 200-500 u away from the centre, +-120 degrees.
  Then, with 1/2 chance, it casts Slow (1/4 overall) or Polymorph (1/4 overall) on a random unit within 400, which may be an opponent or an invalid target.
- **Designer notes:** Save mana and let others cast. Using magic on opponents is allowed, but make the mana count. Mana never comes back. Slow was added later for depth.
- **Remake notes:**
  1. A fixed mana wallet (400), with no regen: Polymorph 200 (25 s sheep), Slow 100 (-60% speed for 20 s), Invisibility 300 (10 s, self). That allows at most 2 sheeps, 4 slows, or invisibility plus a slow.
  2. Monsters match your speed (220) and one-shot you, so you can't escape without spending magic. Aggro radius is 300, and they wander to random points every 2.5 s.
  3. Ramp: +1 monster every 10-15 s from the centre, up to 8.
  4. It shares the "survive the ramp" shape with *Kodo Stampede*, but the defence is spell-based and there is a spending dilemma: casting helps everyone nearby.
  5. Oddity: the centre effect and the teleport effects on each spawn are never destroyed (harmless leak).


## Uther Party 4.0 — rule sheets, batch g2

Sources: `up40/bundles/<Prefix>.txt` (JASS + object data), `up40/j.txt` (framework), `up40/quests.txt`, `up40/arenas.json` + `up40/arenas/*.png` (pathing/doodad render), `up40/war3mapMisc.txt`, and WC3 1.26 base SLKs (read with `objdecode.py`) for fields the map did not change. "P12" = Player(11), the brown hostile player. "Playing slot" = any of players 1-8 whose slot state is PLAYING (dead players still count). "MODIFIED" = changed by this map. Periodic triggers use timers registered at map load, so the first tick after a trigger is enabled comes after a delay of 0 to one full period, set by how much game time has passed.

Gameplay constants the map overrides (war3mapMisc.txt), which matter below: `MinUnitSpeed=0` (so speeds under 150 really apply), `GuardDistance=MaxGuardDistance=10000` (hostiles chase indefinitely), `CreepCallForHelp=200`.

---

### The Tauren Tragedy (bundle: Tauren, event #10)
- **Goal (in-game text):** "The Tauren Tragedy / Survive as long as possible!" (TRIGSTR_077)
- **Type & scoring:** Survival (Survival Death). Ties are not possible (`TiesPossible` stays false). No time limit: no timer is started and Survival Expire is never enabled, so the game only ends when one tauren is left. Standard ante: first to die gets 9-N, and so on up to 8 for the winner.
- **Arena:** `Tauren_Tragedy` is 1280x1280 (10x10 tiles), centre (-4096,1792). The walkable area is roughly octagonal (the corners are cut off), and about 85% of the rectangle is walkable. The camera is panned to the centre and bounded to the rectangle. An invulnerable **Barracks** (`hbar`, P12, abilities Avul+Abds, collision 144) sits in the centre as a solid obstacle and marks the spawn point. Each tauren is created for its own player at 400 u from the centre in a random direction.
- **Player unit:** Tauren Chieftain `Otch`, set to hero **level 2** with XP suspended. It learns 1 point in Shockwave and 1 point in War Stomp.
  - Speed 270, collision 32. HP ≈ 800 and mana ≈ 240 at level 2. These come from WC3 1.26 attributes, not the dump: STR 25 +3.2/level gives 28 STR, times 25 HP per point, plus 100. INT 15 +1.3/level gives 16 INT, times 15 mana per point. Mana regen is about 0.8/s.
  - Attack: 2d6 + STR, so about 30-40 damage, 2.05 s base cooldown, range 128. Its targets were changed to **`sapper` only**, and footmen are the sapper-type units. So a tauren can melee footmen but can never auto-attack a rival tauren. Acquire range is 128, so it only swings at footmen right next to it.
  - **Shockwave L1** (AOsh): 100 mana, 8 s cooldown, 700 cast range, 75 damage in a line 125 wide that travels 800 u.
  - **War Stomp L1** (AOws): **50 mana** (changed from 90), 6 s cooldown, 25 damage in a 250 radius. It stuns units for 3 s and heroes for 2 s.
  - Both spells also hit rival taurens (everyone is unallied): 75 damage from Shockwave, and 25 damage plus a 2 s stun from War Stomp.
- **Hazards / opponents:** Footman `hfoo` (P12).
  - HP **15** (changed from 420), armour 2, speed 270, 12-13 damage (11+1d2), 1.35 s cooldown, range 90. Acquire range is **1000** (changed), so each footman homes on the nearest tauren anywhere in the arena. They get no scripted orders.
  - **Spawn** runs every **1.5 s** once enabled (from t=7). It creates **one footman per playing slot** at 100 u from the centre in a random direction. That point is inside the barracks footprint, so WC3 pushes them out to its edge.
  - Cap: spawning only happens while P12 has fewer than 50 living units. The barracks counts toward this, so the cap is about 49 footmen. The whole batch spawns after the check, so the count can overshoot by up to N-1.
  - Every P12 unit is set to "explode" on death (a gib effect, no corpse).
- **Timeline:** t=0 Comradeship music; barracks and taurens created; level 2 and skills set; camera; text; Dissipate (dead heroes are removed) and Survival Death enabled → t=7 Spawn enabled, and the AI enabled if any computer player exists → footmen stream out until only one tauren is left → Win.
- **How you lose / win / finish:** Your tauren's HP reaches 0 (footmen, or a rival's Shockwave/War Stomp). The last tauren alive wins.
- **Computer-player AI:** Every 4 s (enabled at t=7), each computer unit moves 200-400 u from its own position. The heading is the angle from the arena centre to the unit, plus or minus 120° at random. So the bots drift outward and kite. They never cast spells.
- **Designer notes:** Use your spells either to survive or to damage opponents. Ration your mana and don't get surrounded. The game was inspired by footman-surround tactics.
- **Remake notes:**
  1. The flood rate scales with the **starting** player count, not the number alive (N footmen per 1.5 s, cap about 49). Late survivors therefore face the full swarm.
  2. Footmen die in one hit and home in from 1000 u. The player's basic attack can only target footmen.
  3. Two spells: a line nuke (75 damage, 125 wide, 800 long, 100 mana, 8 s cooldown) and a stomp (25 damage, 250 radius, stun 3 s on footmen and 2 s on rivals, 50 mana, 6 s cooldown). About 240 mana with 0.8/s regen means mana is the real limit.
  4. Rival players can be shockwaved and stomped, which is the sabotage angle.
  5. There is no existing Hammerguy's Party equivalent. It is a swarm-survival game, closest in feel to Golem Gauntlet's hostiles but in an arena.
  - Oddity: the cap includes the invulnerable barracks.

### Bomb Baldwin (bundle: Bomb, event #11)
- **Goal (in-game text):** "Bomb Baldwin / Find and kill Baldwin!" (TRIGSTR_078)
- **Type & scoring:** **Race**. Ante is set to **8**. Each time a Baldwin dies, the owner of the killing unit scores the current ante (8, 7, 6, …), and their flying machine is removed with a teleport effect. Players who never find a Baldwin score 0. The time limit is **60 s** (a "Time Left" dialog). On expiry, Race Expire kills the remaining flying machines: Finish if anyone scored, otherwise Draw. The 60 s includes the 5 s frozen intro.
- **Arena:** `Bomb_Baldwin` is 1664x1664 (13x13 tiles), centre (-4160,-320). It is an open field (91% walkable, small corner cut-outs) ringed by 47 large **air pathing blockers**, so flyers cannot leave. The camera is bounded to the rectangle.
  - A **Farm** (`hhou`, P12, 500 HP, not invulnerable) sits in the centre as the "house". It is only an obstacle, because the bombs cannot target structures.
  - The flying machines are pre-created as **neutral passive key units**, one per playing slot. Each is 700 u from the centre at angle `slot×135° − 22.5°`, which produces 8 fixed spots 45° apart (22.5°, 67.5°, … 337.5°), facing the centre. Next Event then hands each player a random one.
- **Player unit:** Flying Machine `hgyr`.
  - 200 HP, speed 400, flying height 280, collision 8, acquire range **100** (changed).
  - `weapons=2` (changed) enables **only the second weapon**, the ground bombs: siege missile, **11-12 damage** (dmgplus2 changed 6→10, 1d2), **range 100**, **2.5 s cooldown**, no splash. Its targets were changed to debris, ground, item and ward (structures removed), so it can't hit the farm. The air gun is off, so machines can't hurt each other.
- **Hazards / opponents:** None dangerous. The crowd is neutral hostile and every member has **5 HP**, speed 190, no weapon, and **Wander**:
  - **100 "Not Baldwin"** peasants (`hpea` renamed).
  - **N "Baldwin"** peasants (`h000`), one per flying machine, i.e. one per playing slot. It is identical to hpea (same model and stats); **only the name differs**, and it shows on mouse-over.
  - All of them spawn 50-64 u from the centre (they are pushed out around the farm) and are ordered to move to random points in the arena. After that they wander.
  - Attacking weaponless units makes them run in WC3, and the map sets CreepCallForHelp=200. That emergent behaviour is how "kill one to scatter the group" works; no trigger does it.
- **Timeline:**
  - t=0: TragicConfrontation music; ante 8; flying machines created and added to KeyUnits; **all units paused**; farm; camera; 60 s timer; text; Race Death, Race Expire and Bomb Finish enabled.
  - Sleep 0, then Next Event hands out the machines, and computer players' machines get acquire range 1000.
  - t=5: unpause. 50 decoys, then the N Baldwins, are created. Every neutral-hostile unit so far is recoloured **brown** and ordered to a random point. Then 50 more decoys are created, and all 100 decoys are ordered to random points.
  - t=60: expiry.
- **How you lose / win / finish:** You finish by landing the killing bomb on any Baldwin. Your placing is the order of finishing. You get nothing if time runs out.
- **Computer-player AI:** There is no AI trigger. Computer machines simply get acquire range 1000, so they bomb random peasants all over the field.
- **Designer notes:** Kill a random peasant to scatter the crowd, and check peasants quickly by hovering over them without selecting. The game replaced the unpopular "Uprising".
- **Remake notes:**
  1. Hidden-identity search: a crowd of 100 decoys plus one real target per player, identical except for a name revealed on hover (use a hover or inspect tooltip).
  2. Every peasant dies in one hit. Bombs have short range (100) and a 2.5 s cooldown, so misses cost time.
  3. Decoys scatter when attacked, and the crowd wanders.
  4. Race scoring 8, 7, 6 … with a 60 s cap that includes a 5 s freeze.
  5. Nothing in Hammerguy's Party is like it; it is a new genre (identify-and-strike).
  - Oddity: the second batch of 50 decoys is created **after** the brown recolour, so it keeps the default neutral-hostile team colour while every Baldwin is brown. If that colour differs from brown (it is dark in stock WC3), Baldwins are always in the brown half. This may relate to the changelog note about "special display settings". The farm has 500 HP but nothing can hit it.

### Dark Forest (bundle: Dark, event #12)
- **Goal (in-game text):** "Dark Forest / Survive as long as possible!" (TRIGSTR_080)
- **Type & scoring:** Survival. No ties. No time limit (no timer is started).
- **Arena:** `Dark_Forest` is 1600x1600 (12.5x12.5 tiles), centre (6144,-3584). It is ringed by Northrend tree walls, with about 30 single trees scattered inside in a symmetric X/diamond pattern as obstacles (84 tree destructables in total; 92% walkable). The camera is bounded to the rectangle.
  - The time is set to **00:00** and the clock stays stopped (Next Event turns the day cycle off), so it is permanent midnight.
  - A Mass-Teleport "To" effect is left burning at the centre to mark where monsters appear.
  - Each druid is created for its player at 300 u from the centre in a random direction.
- **Player unit:** Druid of the Talon `edot`.
  - **100 HP** (changed), speed 270, collision 15, **no attack** (changed), **200 mana at start** (changed initial mana; max 200), mana regen 0.67/s. HP regen is 0.5/s at night, and it is always night here.
  - Only ability: **Storm Crow Form** (`Arav`). It costs **50 mana** (WC3 default; the data doesn't say whether turning back is also charged), with 1.05 s cast time, 0 cooldown, and about 1 s to change altitude and land.
  - Crow form `edtm`: **100 HP** (changed), speed **350**, flying height 240, no attack, shares the druid's mana.
- **Hazards / opponents:** All P12, created at the arena centre.
  - **Abomination** `uabo`: 1175 HP, speed **270**, collision 48, **33-39 damage**, 1.9 s cooldown, range 128, acquire range **300** (changed). Its targets are **ground only**, so it kills the druid in about 3 hits and cannot touch the crow.
  - **Gargoyle** `ugar`: 410 HP, speed **350**, flying, `weapons=1` (changed: only the anti-air weapon), **61-70 damage**, 1.4 s cooldown, range 128, acquire range **400** (changed). Its targets are **air only**, so it kills the crow in 2 hits and cannot touch the druid.
  - **Spawn** fires every **15 s** (from t=6) while P12 has fewer than 10 units. It waits a random 0-4 s, creates 1 abomination with a teleport effect, and also creates 1 gargoyle on the **first** spawn (always) or with a **50%** chance afterwards. That is 1.5 monsters per wave on average, capping at 10-11.
  - **Patrol** runs every **4.5 s**: every P12 unit forgets its guard spot and **attack-moves** to a random point in the arena. They roam and engage anything inside their acquire range.
- **Timeline:** t=0 NightElf3 music, midnight, druids, camera, marker effect, Survival Death and Patrol on → t=6 Spawn and AI on → first wave within 0-15 s, plus the 0-4 s delay → waves every 15 s until 10 or more monsters → last druid standing wins.
- **How you lose / win / finish:** Die to abominations while in druid form or to gargoyles while in crow form. The last survivor wins.
- **Computer-player AI:** Every 2 s (from t=6), each computer unit moves 200-500 u outward (heading from the centre, ±120°). Then: if any gargoyle is within 600, it orders "unravenform" (go to ground); otherwise, if any abomination is within 400, it orders "ravenform". It ignores mana.
- **Designer notes:** Abominations are common and slow, while gargoyles are rarer but fast and deadly. Crow form is for emergencies and should be used sparingly. Balancing was hard and the designer hoped there were no crow-form exploits.
- **Remake notes:**
  1. A two-state dodge: ground form is immune to air hunters and air form is immune to ground hunters.
  2. The morph takes about 1 s and costs 50 of 200 mana (regen 0.67/s), so there are only about 4 morphs banked at the start.
  3. Speed parity matters: each form runs exactly as fast as the hunter that can hit it (270 against 270, 350 against 350). You can't outrun your predator, only change what you are.
  4. Hunters spawn at the centre and wander by random attack-move every 4.5 s, with acquire ranges of 300 (abomination) and 400 (gargoyle).
  5. Dark, obstacle-strewn arena.
  - Oddity: the first gargoyle is guaranteed via `GetTriggerExecCount==1`.

### Hungry Hungry Kodos (bundle: Kodos, event #13)
- **Goal (in-game text):** "Hungry Hungry Kodos / Eat the pigs to survive the longest!" (TRIGSTR_082)
- **Type & scoring:** Survival with **ties possible** (`TiesPossible=true`, Tie Death on). Kodos that die in the same instant share a score. If everyone left dies at once it is a Draw. There is no time limit, but starvation (below) is a built-in clock.
- **Arena:** `Hungry_Hungry_Kodos` is 1024x1024 (8x8 tiles), centre (6144,2048). It is a walled square with a 1-tile block in each inner corner. The camera is bounded to it.
  - In the middle of each side there is a closed **gate**, 2 tiles wide (`LTg1`/`LTg3` gate destructables, 2 of each). Behind each gate is a small dead-end pen with line-of-sight blockers (16 in total).
  - The 256x64 spawn strips `Hungry_1..4` lie just outside the arena edges, in the gate openings: north (6016-6272, 2560-2624), south (…1472-1536), east (6656-6720, 1920-2176) and west (5568-5632, …).
  - At t=6, **every LTg1/LTg3 gate on the map is opened**. No other game uses these gates, and none closes them.
  - Each kodo is created for its player at 200 u from the centre in a random direction.
- **Player unit:** Kodo Beast `okod`.
  - **1000 HP with regen −15/s** (changed), so it **starves in 66.7 s** without food. Speed 220, collision 48, **no attack** (changed).
  - Mana: max **200** (changed). Initial mana is blank in the data (inferred 0), and there is no mana regen.
  - Abilities:
    - **Devour** (Adev): range 100, targets ground/enemy/organic/non-hero units up to level 5. Digestion does 5 damage/s (Advc), and the stomach holds cargo size 2.
    - **Regurgitate** `A001` (a Creep Thunder Bolt): **100 mana** (changed from 75), 8 s cooldown, range 800, **100 damage and a 2 s stun** on a rival kodo.
  - Kodos Target trigger: **any target order is turned into "devour" on that target**, so right-clicking a pig eats it.
  - Food rewards (triggers on P12 deaths, credited to the killer):
    - **Pig** ("Piggy" `npig`, 10 HP, speed 190 (changed from 100), Wander): **+50 HP**, with a heal effect.
    - **Child** (`nvlk`, 10 HP, speed 190, Wander): **+100 mana** and no HP.
  - HP is capped at 1000.
- **Hazards / opponents:** Only hunger and rivals' Regurgitate.
  - **Spawn Base** runs every **10 s** (enabled at t=6 and also run once immediately). For **each playing slot that still has a living unit**, Kodos Spawn rolls **50%** to create one pig at a random point in a random gate strip, then orders it to a random point in the arena. There is **no pig spawn while there are 10 or more living pigs**.
  - From the **second** Spawn Base run on (`DifficultyCurve>1`), if fewer than 2 children exist, one child is created in a random gate strip. It gets no move order and just wanders.
  - Expected food is 0.25 pigs per living kodo per 10 s (+12.5 HP), against −150 HP of drain per 10 s, so everyone starves eventually. Games last roughly 70-100 s.
- **Timeline:** t=0 Orc1 music, kodos, camera, triggers (the AI is on immediately), drain starts → t=6 gates open and the first pig rolls (no child) → every 10 s after that: pig rolls, plus a child top-up to 2 → the last kodo alive wins.
- **How you lose / win / finish:** HP reaches 0 from starvation or Regurgitate damage. The last kodo standing wins.
- **Computer-player AI:** Every 2 s, each computer kodo is ordered to devour a **random P12 unit anywhere** (distance ignored). Then, in the same tick, it is ordered to "creepthunderbolt" a **random kodo**, which can be itself. That fails without 100 mana or when self-targeted. When it succeeds it replaces the devour order, and it also passes through Kodos Target, which converts it into a devour attempt on that kodo.
- **Designer notes:** Eating children gives no health but fills mana for Regurgitate, which can decide the game. The designer found it more frantic than intended.
- **Remake notes:**
  1. Constant HP drain of 15/s from 1000, with pig = +50 HP. Food arrives from 4 gated pens on the sides.
  2. Food rate scales with players still alive: a 50% roll each per 10 s, capped at 10 pigs.
  3. Eating takes about 2 s (5 dps against 10 HP), during which the kodo is busy.
  4. Children are a mana pickup (+100). Two of them buy one 100-damage, 2 s-stun bolt at a rival.
  5. Simultaneous starvation ties are expected and supported.
  - Similar to our **Gold Rush** (grab pickups), combined with survival; unrelated to our "Kodo Stampede".
  - **Bug:** in Kodos Spawn, when the 50% roll fails, `GetLastCreatedUnit()` still points at the previously created unit and that unit is ordered to a random point. On the first run at t=6, that unit is the **last player's kodo**, so it can get yanked.
  - **Unverified:** the data seems to let a kodo **devour an enemy kodo** (level 4 ≤ 5, organic, cargo size 2 = stomach capacity 2), and every right-click becomes devour.

### Raider Relay (bundle: Raider, event #14)
- **Goal (in-game text):** "Raider Relay / Reach the end!" (TRIGSTR_084)
- **Type & scoring:** **Race**, ante set to **8**. The finishing unit is the raider (the key unit), which must step into `Raider_Finish`. Time limit **90 s** ("Time Left" dialog). On expiry, the remaining raiders are killed (0 points): Finish if anyone finished, otherwise Draw.
- **Arena:** `Raider_Relay` is 1280x2816 (10x22 tiles), centre (-4224,-3200). The camera starts on the Island and is bounded to the whole course. The course is ringed by air pathing blockers (64). Layout from the pathing render:
  - Two 3-tile ground lanes run north from the bottom corners. The starts are `Raider_Start_1` (-4864..-4480, -4608..-4352) and `Raider_Start_2` (-3968..-3584, same y), each 384x256. Each raider gets a random one.
  - The lanes join in a wide middle band and across the top.
  - The zeppelin pad `Raider_Zeppelin` (256x384, -4352..-4096, -2432..-2048) is a walled pocket at the top centre, entered from above.
  - The goal `Raider_Island` (256x512 at the bottom centre, between the starts) is cut off by walls and **reachable only by air**. `Raider_Finish` is its southern 256x256 (-4352..-4096, -4608..-4352) and is marked by a Circle of Power.
  - A walled **middle platform** in the course centre is also reachable only by air.
- **Player unit:** Raider `orai`.
  - Speed **350**, **25 HP** (changed), armour 1, **no attack** (changed).
  - One ability, **Ensnare** (`ACen`): range 500, 0 mana, 10 s cooldown. It pins the target for **10 s** (5 s on heroes) and pulls air units down to the ground. It can target ground or air enemy/neutral non-heroes, which includes rival raiders and zeppelins.
  - It is **single-use**: Raider Ensnare removes ACen from the caster on "begins casting".
  - Each player also owns a **Goblin Zeppelin** `nzep`, created at a random point on the pad: **25 HP** (changed), speed 270, flying height 280, cargo 8, Load/Unload. It dies with its cargo (Cargo Hold Death).
  - The zeppelin starts **invulnerable, paused and greyed**. When **your raider enters the pad rectangle**, it is unpaused, made vulnerable, given your colour, and flashed.
- **Hazards / opponents:** All P12.
  - **2 bears** (Druid of the Claw bear form `edcm`) at centre (−448,−128) and (+448,−128), i.e. one in each lane at y≈-3328. Each has 810 HP, speed 270, **27-32 damage** (one hit kills a raider), 1.5 s cooldown, range 100, acquire range **400** (changed), and Wander.
  - **4 hippogryphs** `ehip`: 525 HP, speed **400**, **air-only attack of 50-57 damage** (one hit kills a zeppelin), 1.05 s cooldown, range 128, acquire range **300** (changed).
    - One patrols east–west across the full width at y=-3712, from (-4864) to (-3584).
    - One patrols west–east at y=-4224, from (-3584) to (-4864).
    - Two stand still at (-4736,-3968) and (-3712,-3968).
  - The hippogryphs guard the return flight to the Island. Guard distance is 10000, so once they aggro they chase indefinitely.
- **Timeline:** t=0 Orc2 music, ante 8, units, camera, 90 s timer, triggers → t=2 AI on → typical run:
  1. Dodge the bear in your lane on foot (350 against 270).
  2. Reach the pad; the zeppelin activates.
  3. Load the raider.
  4. Fly south about 2200 u through the hippogryph lines (270 against 400).
  5. Unload onto the Island or Finish and step into Finish.
  - It ends when all raiders have finished or died, or at 90 s.
- **How you lose / win / finish:** Finish by the raider entering `Raider_Finish`; units carried as cargo don't trigger the enter event, so you must unload. You are out if:
  - Your raider dies, which also kills your zeppelin (Raider Death).
  - Your zeppelin dies, which kills your raider unless it is inside the Island rectangle (Zeppelin Death, plus the cargo dying with the zeppelin).
- **Computer-player AI:** Every **0.25 s**:
  - Computer raiders on the pad are ordered to "board" their zeppelin; otherwise they move to the pad centre.
  - Raiders on the Island move to the Finish centre.
  - Every computer zeppelin is ordered to "unloadall" at the Finish centre.
  - Separately, any zeppelin death orders **all** computer raiders to move to the Finish.
  - Bots never use Ensnare and just run the lanes past the bears.
- **Designer notes:** Lure the bears, then ensnare them off to the side. The hippogryphs can be handled the same way from the middle platform, but that leaves your zeppelin exposed. The designer admits it may be too hard.
- **Remake notes:**
  1. A two-phase relay: a ground sprint (you are faster than the bears, but one hit kills) → vehicle pickup that only activates when you arrive → a flight through faster air hunters (one hit kills) → drop at an unreachable goal.
  2. One snare per player (10 s root, 500 range) that also grounds flyers, and can be used on rivals' raiders or zeppelins.
  3. Death coupling: rider and vehicle share a fate except once the rider is on the Island.
  4. 90 s limit, race 8, 7, ….
  5. Closest to our **Golem Gauntlet** race, with a vehicle stage added.
  - **Risk:** ACen is removed on `EVENT_PLAYER_UNIT_SPELL_CAST` (before the effect). If WC3 aborts the cast when the ability disappears, the net never fires; verify in-game. The designer's advice assumes it works.
  - **Quirk:** the bot spams "unloadall" at empty (even paused) zeppelins. Whether WC3 moves an empty transport on unloadall is untested.

### Treant Valley (bundle: Treant, event #15)
- **Goal (in-game text):** "Treant Valley / Survive as long as possible!" (TRIGSTR_130)
- **Type & scoring:** Survival. No ties. No time limit.
- **Arena:** `Treant_Valley` is 1152x1152 (9x9 tiles), centre (6336,-1472). It is a roughly octagonal clearing (corners cut) that contains **exactly 12 single "Summer Tree Wall" trees** (`LTlt`) in a symmetric 2-4-4-2 grid. The two rocks in the rectangle are doodads, not destructables.
  - At start **all destructables in the rectangle are restored** to full life, without the birth animation.
  - The camera is bounded to the rectangle.
  - Each gnoll is created for its player at a random 100-400 u from the centre, with random facing.
- **Player unit:** Gnoll `ngno`: **25 HP** (changed), speed **270**, collision 31, **no attack** (changed), no abilities.
- **Hazards / opponents:** Treant `efon` (P12).
  - 300 HP, speed **220**, **15-17 damage** (14+1d3; 2 hits kill a gnoll), 1.75 s cooldown, range 100, acquire range **200** (changed).
  - **Spawn** runs every **10 s** (from t=7) while there are fewer than 12 treants. It picks a random **living** tree in the valley and shows a green lumber glow (TargetArtLumber) on it for **2 s**. Then the tree is killed and a treant appears on its spot.
  - The cap of 12 equals the 12 trees, so the valley ends up with 12 treants and no trees, about 2 minutes in.
  - **Patrol** runs every **2.5 s**: all treants forget their guard spot and **attack-move to a random point** in the valley, chasing gnolls that come within 200.
- **Timeline:** t=0 SadMystery music, gnolls, camera, trees restored, text, Survival Death on, AI on → t=7 Spawn and Patrol on → first glow 0-10 s later, then one new treant every 10 s → the last gnoll wins.
- **How you lose / win / finish:** Two treant hits kill you. The last survivor wins.
- **Computer-player AI:** Every 2 s (from t=0), each computer gnoll moves 200-500 u outward (heading from the centre, ±120°).
- **Designer notes:** Trees glow green briefly before becoming treants. Watch the trees and use your speed advantage. The designer likes it for its simplicity.
- **Remake notes:**
  1. Telegraphed spawns: a 2 s glow on a random remaining tree, then a hunter appears exactly there. Obstacles become enemies, so the safe terrain shrinks.
  2. One spawn every 10 s, with a hard maximum equal to the tree count (12).
  3. Speed gap: player 270 against hunter 220. The hunters' small 200 aggro radius plus a random attack-move every 2.5 s makes them wander rather than hunt.
  4. Two hits kill.
  5. The telegraphing is similar to our **Mortar Mayhem**, and the "arena fills with slow chasers" feel resembles Golem Gauntlet's hazards.
  - No bugs spotted. The special-effect handle is a shared global, but spawns are 10 s apart.

### The Skeleton Sonata (bundle: Skeleton, event #16)
- **Goal (in-game text):** "The Skeleton Sonata / Survive as long as possible!" (TRIGSTR_131)
- **Type & scoring:** Survival. No ties. No time limit.
- **Arena:** `Skeleton_Sonata` is 768x768 (6x6 tiles), centre (6144,128). It is a fully walkable square; the pathing render shows one more walkable tile ring outside the rectangle. The camera is bounded to the rectangle.
  - Time is set to 00:00 (permanent night).
  - The script adds **blight in a 512 radius** around the centre (owned by P12), which covers nearly the whole arena. Undead regenerate on blight.
  - Each priest is created for its player at a random 100-300 u from the centre.
- **Player unit:** Priest `hmpr`.
  - 290 HP, armour 0, speed 270, collision 16, **no attack** (changed).
  - Mana: max **400** (changed), set to **200** at start by the script, regen **4.0/s** (changed).
  - The script removes Wander, leaving one ability: **Dispel Magic** (`Adsm`, creep version). It costs 75 mana, has an **8 s cooldown**, range 500, and area **200**, and deals **200 damage to summoned units**. Skeletons have 180 HP, so they die instantly.
  - Dispel is untargeted by owner, so it clears skeletons near rivals too.
- **Hazards / opponents:** Skeleton Warrior `uske` (P12).
  - 180 HP, speed 270, **14-15 damage** (13+1d2), **2.0 s cooldown**, range 90, armour 1, type summoned/undead, regen 2/s on blight.
  - Each spawn sets the acquire range of every skeleton to **1000**, so they chase the nearest priest.
  - Spawn points are marked by **ghoul corpses**: 4 are placed at random points at start.
  - **Spawn** runs every **2.5 s** (from t=6):
    1. Pick a random corpse.
    2. Create **3 skeletons** on it.
    3. Remove the corpse, with a lightning bolt effect and sound (0.5 s).
    4. Place a new corpse at a random point.
  - That is **1.2 skeletons/s, with no cap**. A priest takes about 20 hits to kill, so each adjacent skeleton removes roughly 7 HP/s.
- **Timeline:** t=0 Undead2 music, midnight, blight, priests, 4 corpses, mana 200, camera, Survival Death, AI → t=6 Spawn on → the swarm grows without limit → the last priest wins.
- **How you lose / win / finish:** Skeletons beat you to 0 HP. The last survivor wins.
- **Computer-player AI:** Every 2 s, each computer priest moves to a random point in the arena. After 1 s it casts "dispel" on a random skeleton within 400 of itself. The cast fails if there is none or the ability is on cooldown.
- **Designer notes:** Mana is not the issue; cooldown is. Dispel only when needed, and try to catch many skeletons in one cast without helping opponents too much. It is one of the designer's favourites.
- **Remake notes:**
  1. One AoE clear (200 radius, instant kill on skeletons) on an 8 s cooldown. With 200/400 mana, +4/s and a 75 cost, it is effectively cooldown-bound.
  2. Uncapped spawns of 3 skeletons every 2.5 s at **telegraphed corpse markers** (4 at a time, each replaced at a random spot after use).
  3. Skeletons are melee (about 7 DPS each against 290 HP), speed 270 like you, and aggro across the whole map. You can't outrun them forever, only clear them.
  4. The clear helps nearby rivals, which is the social tension.
  5. The markers resemble **Mortar Mayhem** telegraphs; no direct equivalent otherwise.
  - Oddity: blight regen (2/s) is irrelevant because dispel does 200 at once. During the 0.5 s lightning there are only 3 corpses.

### Stampede (bundle: Stampede, event #17)
- **Goal (in-game text):** "Stampede / Dodge the stampede as long as possible!" (TRIGSTR_139)
- **Type & scoring:** Survival. No ties. No time limit.
- **Arena:** `Stampede` is a flat walled rectangle, 1408x768 (11x6 tiles), centre (-4032,3584), 100% walkable. The camera is panned to the centre minus 384 x and bounded to the rectangle. Each grunt is created for its player at the centre + (−384, random ±192), facing east. So all players start in the **western half**.
- **Player unit:** Grunt `ogru`: **700 HP**, armour 1, speed 270, collision 31, **no attack** (changed), no abilities.
- **Hazards / opponents:** Beastmasters `Nbst` (P12, no attack (changed), hero level 6, XP suspended), each channelling **Stampede** (`ANst` L1).
  - Stampede stats: 2 lizards/s, lizard collision radius 55, **60 damage** per exploding lizard. The damage radius was changed from 275 to **100**, and the damage delay from 0.2 to **0**. Area 1000. Duration changed from 30 to **300 s**, cooldown to **0**, and cost to **0**.
  - Lizards run in the cast direction and explode on enemies. A grunt survives about 12 lizard hits.
  - **BM #1** is created at the exact centre, facing west. At **t=7** it starts Stampede toward a point 128 u **west**, so lizards charge the players' side.
  - **Spawn** runs every **20 s** (from t=7) while P12 has fewer than 8 units. It waits **15 s**, then creates another BM at the centre x with y = centre ± random 256.
    - The **first extra BM always faces east**.
    - Later ones face east or west with 50% chance each.
    - Each one immediately channels Stampede 128 u ahead of itself.
    - So BM #2 arrives 15-35 s after t=7, then one more every 20 s, up to **8 BMs = 16 lizards/s** from both directions.
  - **Maintain:** whenever any unit's spell ends or finishes, that unit re-casts Stampede at its position + (random ±128, 0), i.e. in a random east/west direction. This matters only after the 300 s channel ends or if a channel is interrupted.
- **Timeline:** t=0 OrcTheme music, grunts, BM #1, camera, Survival Death → t=7 first stampede west, Spawn, Maintain and AI on → about t=22-42 an east-facing BM appears → +1 BM every 20 s (random direction) up to 8 → the last grunt wins.
- **How you lose / win / finish:** Lizard explosions take you to 0 HP. The last survivor wins.
- **Computer-player AI:** Every 2 s (from t=7), each computer grunt moves to its own position + (random ±32, random ±256). It is almost pure vertical jiggling.
- **Designer notes:** The back (behind the first Beastmaster) is a temporary refuge, but soon lizards come from both sides. Staying in the middle is best. The idea came from JuberMAN.
- **Remake notes:**
  1. Emitters in the middle column (x = centre, y ± 256) fire lizard streams along the long axis at 2/s each, 60 damage in a 100 radius, against 700 HP.
  2. The difficulty ramp is emitter count: 1 at t=7, a guaranteed reverse-direction emitter about 15-35 s later, then +1 every 20 s up to 8.
  3. The initial safe zone is behind emitter #1 (the east side), which the second emitter removes.
  4. Grunts are unarmed and rely on dodging alone.
  5. This is essentially our **Kodo Stampede**. Reuse it, but match the two-direction ramp and the "centre column" emitters.
  - The lizard spawn spread inside the 1000 area is WC3-internal and not in the data; follow the designer's "middle is safest" hint.

### Stop and Go (bundle: Stop, event #18)
- **Goal (in-game text):** "Stop and Go / Stop on red, and go on green!" (TRIGSTR_144)
- **Type & scoring:** **Race**, ante set to **8**; the first seal into `Stop_Finish` scores 8, then 7, and so on.
  - There is **no timer**: neither Race Expire nor Timer_TimeLeft is used. Only Race Death is enabled, so the game ends when every seal has finished or died.
  - Effective limit: the time is set to **01:00 with the clock running**, so night lasts until 06:00. That is about **100 s** at WC3's default 480 s day, which the map doesn't override. The Dawn trigger then freezes the clock at 07:00, leaving it day for good. See the note on Shadowmeld below for why this matters.
- **Arena:** `Stop_and_Go` is a straight lane **256x1536 (2x12 tiles)**, centre (-4480,5760), with cliffs on both sides. `Stop_Finish` is the top 256x256 (y 6272-6528), marked by a Circle of Power. The camera is bounded to the lane and starts at the centre −512 y.
  - Each seal is created for its player at x = centre ± random 128 (the full lane width), **y = 5248** (1024 u below the finish line), facing north.
  - **10 Spirit Towers** (`uzg1`, P12) stand outside the walls at x = −4864 and −4096 (±384), y = 5248, 5504, 5760, 6016 and 6272. Each has 550 HP, **27-32 pierce damage, a 1.0 s cooldown, range 700 and acquire range 900**. Together they cover the whole lane.
- **Player unit:** Seal `nsea`.
  - **Speed 75** (changed; MinUnitSpeed=0 keeps it real), **15 HP** (one tower shot kills), collision 7.
  - **Mana 75**, starting at 75, with **no regen**.
  - **Purge** `A007` (a creep purge): 75 mana (**exactly one cast**), range 700, 5 s cooldown. It dispels the target and slows it for **5 s** (the slow wears off over the duration). The unit-pause duration was changed from 0 to **1 s**, and minimum speed is 0, so the target can be stopped completely.
  - **Shadowmeld (Instant)** (`Sshm`): 0.1 s fade, 0.5 s action delay.
  - Nothing in the script protects a seal on red. Only Shadowmeld can: invisible to towers while standing still at night, and moving breaks it.
  - The bot only ever issues "stop" and never a meld order. That implies the meld is automatic, but the data can't confirm it.
- **Hazards / opponents:** The towers. The light cycle is triggers that pause, unpause and recolour all P12 units:
  - **RED:** towers unpaused (they shoot any visible seal) for **5-9 s**.
  - **GREEN:** towers paused for **3-5 s**.
  - **YELLOW:** towers still paused, recoloured yellow as a warning, for **1 s**.
  - Then RED again.
  - The towers' team colour shows the light.
  - The movement window per cycle is green + yellow = **4-6 s**, i.e. 300-450 u, so the 1024 u run takes about **3 cycles (≈30-45 s)**.
- **Timeline:** t=0 LichKingTheme music, ante 8, 01:00 and the clock running, seals, towers, Circle of Power, camera, Race Death, Dawn, Stop Finish and Stop AI on, and **RED immediately** → cycle RED (5-9 s) → GREEN (3-5 s) → YELLOW (1 s) → … → about t≈100 s dawn → frozen at 07:00.
- **How you lose / win / finish:** Enter `Stop_Finish` to finish. You die if a tower shoots you: you are moving, or casting, on red. Once it is day, Shadowmeld stops working, so the next red should kill every remaining seal.
- **Computer-player AI:**
  - On GREEN, computer seals are ordered to move to the Finish centre and the AI trigger is disabled.
  - On YELLOW (and through RED), the AI runs every **0.25 s** and each computer seal has a **25%** chance to "stop". So about 68% have stopped by the time red begins (1 − 0.75⁴).
  - Bots never cast Purge.
- **Designer notes:** Purge is useful but you get only one. Don't cast it on red. The idea is by Mech_1000, from a StarCraft map.
- **Remake notes:**
  1. Red/yellow/green cycle with random durations (5-9 / 3-5 / 1 s). Hazards are active only on red and hit **any moving player**. Standing still means safe.
  2. Very slow walker (75 u/s) with a 1024 u track, so it takes about 3 cycles.
  3. One-shot sabotage (Purge): a 5 s slow ramp plus a 1 s full stop on a rival. Cast range is 700, and casting on red exposes you.
  4. Soft time limit from night ending (about 100 s), after which red kills everyone left. In a remake, make that an explicit timer.
  5. Race scoring 8, 7, …; similar to **Golem Gauntlet** (race).
  - Oddity: the Stop AI trigger is already enabled at init, before the first red.


## Uther Party 4.0 rule sheets, group 3 (Push, Spike, Salamander, Obey, Whack, Horse, Masquerade)

Sources: `up40/bundles/<Prefix>.txt` (trigger JASS, regions, object data), `up40/j.txt` (framework triggers Race Finish / Survival Death / Next Event / Disable), WC3 1.26 SLK/TXT tables (base ability and unit values, gameplay constants), and `war3map.doo` (destructable positions, parsed for this note). All times are game seconds. N = number of playing players. 1 tile = 128 u. "Slot k" = Player k (1-8). Unit speeds are WC3 units/second.

General framework reminders used below: survival games score 9-N for the first death, +1 per later death, 8 for the winner; race games in this group set ante = 8 themselves, so places score 8, 7, 6... regardless of N. The map's `war3mapMisc.txt` sets MinUnitSpeed = 0, which is why speeds under 150 (ogre 75, horse floor 60) work.

---

### Push the Ogre (bundle: Push, event #19)

- **Goal (in-game text):** "Push the Ogre / Get the ogre to your circle!"
- **Type & scoring:** Race (Race Death + Race Expire on; ante set to 8). Getting the ogre into your circle scores the current ante (8, then 7, ...). Your knight is then teleported out, but the round continues for everyone else. Each finish is a separate event, so there are no ties. The timer is 90 s ("Time Left"). When it runs out, every remaining knight is killed and scores 0. A knight killed by gas also scores 0. When no knights remain, the round is "Finished" if anyone scored, otherwise "Draw".
- **Arena:** `Push_the_Ogre` (-2304,3328)-(-768,4864): 1536x1536 u = 12x12 tiles, flat and open (97% walkable), with the camera locked to it. Eight goal rects, `Push_1..8`, are 192x192 u (1.5x1.5 tiles) and form an octagon. Each is exactly 689 u from the centre (-1536,4096). Offsets from the centre: slot 1 (-256,+640), 5 (+256,+640), 2 (+640,+256), 6 (+640,-256), 3 (+256,-640), 7 (-256,-640), 4 (-640,-256), 8 (-640,+256). Each playing slot gets a Circle of Power (`ncop`, invulnerable, collision 16) at its rect centre. Empty slots get no circle. Four single destructible tree-wall tiles stand at (+-512,+-512) from the centre, and gas can destroy them. The Init trigger "restores" destructables in `Peon_Pandemonium`, which is another game's arena. Nothing in the Push arena is restored.
- **Player unit:** Knight (`hkni`), created for the player 200 u from their own circle toward the arena centre, about 489 u from the ogre. Stats: speed 350, HP 835, armor 5, collision 32, attack 30-38 (28+2d5), cooldown 1.4, range 100. Its targets are MODIFIED to "invulnerable,sapper" and its acquisition range to 100. As a result, knights cannot attack each other; they can only swing at the invulnerable ogre, which does nothing. No abilities or items.
- **The ogre:** Ogre Warrior (`nogr`), owned by Player 12, created at the arena centre with its guard position removed. Speed 75 (MODIFIED), collision 48, scale 1.25. It is invulnerable (Avul), has no weapon (MODIFIED), and has Wander (Awan), so it drifts randomly. Its unit type is flagged "sapper", which is what makes it the knights' only legal target. **No trigger ever moves the ogre.** It moves only by wandering and by being body-pushed or blocked by knights through WC3 unit collision.
- **Hazards: the gas.** A loop runs Gas, then Gas 2, then Gas 3, then Gas again:
  1. Wait a random 6.0-8.0 s.
  2. Telegraph: the KodoBeastPuke sound plays and a "!" (TalkToMe) effect appears over the ogre. Bot AI is paused, and computer knights are ordered to move 300-400 u in a **random** direction.
  3. 1.0 s later, a PlagueCloud appears at a point **64 u behind the ogre** (its facing +180 degrees, read at release time). The cloud stays at that point and does not follow the ogre. For 1.5 s, every 0.05 s, every non-Player-12 unit within **192 u** of the point loses 75 HP (1500 HP/s; a knight dies in 12 ticks, about 0.6 s). Destructables within 192 u are destroyed.
  4. The cloud ends, AI resumes, and the loop restarts.

  So there is one gas every 8.5-10.5 s. The first telegraph comes 6-8 s after the round starts. The loop only stops when Push Finish is disabled, which happens at the next game.
- **Timeline:** At t=0: Mainscreen music, ante 8, circles, knights and ogre created, camera set, 90 s timer, Race Death/Expire and Push Death/Finish enabled, gas loop started. At t=3: AI on. At t~6-8: first telegraph. At t~7-9: first gas. At t=90: expiry.
- **How you lose / win / finish:** Push Finish fires when the ogre *enters* any `Push_k` rect. If no circle is within 256 u of the ogre, nothing happens. Otherwise the owner of the circle within 200 u gets the finish (Race Finish: +ante, ante -1, knight removed). Credit goes to the circle's owner no matter who pushed. When a knight dies, "Push Death" removes that player's circle, so the ogre can no longer finish there.
- **Computer-player AI:** Every 3 s (paused during each 2.5 s gas sequence), every unit a bot owns is ordered to move to a point 64 u past the ogre, on the side away from its own circle. In other words, it gets behind the ogre and leans on it; since the collision radii sum to 80 u (32+48), which is more than 64, it presses into the ogre. The circle also receives this order and ignores it. On the telegraph, bots flee in a random direction and can run into the cloud.
- **Designer notes:** Push the obese ogre into your own circle while dodging its periodic gas. The gas comes at random intervals but with a steady rhythm, so anticipate it rather than wait for the cue.
- **Remake notes:**
  1. The ogre is a heavy (radius 48), invulnerable, slow (75 u/s) random wanderer. Knights (350 u/s, radius 32) move it only by shoving. Implement a collision push.
  2. There are 8 goals on an octagon 689 u from the centre. Score when the ogre enters your 192x192 goal. Race places score 8, 7, 6...; the round continues after the first finisher and has a 90 s limit.
  3. Gas every U(6,8)+2.5 s: a 1 s telegraph, then a lethal 192 u cloud 64 u *behind* the ogre for 1.5 s. The pushing position is exactly where the gas lands, which is the core tension.
  4. A dead player's goal disappears.
  5. It resembles Ice Sumo's body-shove physics, but here the pushed body is neutral.
  6. **Bugs:**
     - A finisher's circle is never removed. If the ogre later leaves and re-enters that rect, `Unit_Focus` becomes a random knight of a player who has none (null), and Race Finish still runs. The ante drops by 1, which costs every later finisher a point. The score goes to `GetOwningPlayer(null)`: nobody, or slot 1, depending on how WC3 resolves `GetPlayerId(null)`. Our remake should ignore finished players' goals.
     - The destructable restore targets the wrong arena.
     - Bots flee the gas in random directions.

---

### The Spike Pit (bundle: Spike, event #20)

- **Goal (in-game text):** "The Spike Pit / Stay off the spikes!"
- **Type & scoring:** Survival (Survival Death + Tie Death on; `Boolean_TiesPossible = true`). Players impaled in the same instant share one score. **There is no time limit at all:** no timer is started and Survival Expire is never enabled. The round ends only when one player is left (Win, 8 points) or when everyone dies together (Draw).
- **Arena:** `Spike_Pit` (-3328,5632)-(-1024,6912): 2304x1280 u = 18x10 tiles, with the camera locked to it.
  - It holds 176 "Dungeon Spikes" destructables (`DTsp`), one on every tile centre (x = -3264...-1088, y = 5696...6848, step 128) except the four corners.
  - Spikes are walkable in both states; their pathing texture only marks the ground unbuildable.
  - A living spike is raised and lethal. A dead spike is retracted and safe.
  - At Init, every spike within 400 u of the pit centre is killed, which makes a safe starting disk.
- **Player unit:** Militia (`hmil`), created for the player at a random 50-100 u from the pit centre with a random facing. Speed 270, HP 220 (irrelevant, since death is a KillUnit), collision 15 (MODIFIED, so many units fit in the safe spot), no weapon (MODIFIED), no abilities.
- **Hazards: the moving safe spot.** Trigger Spike Work runs every 0.25 s, starting at t=0:
  1. Point P moves `Real_Speed` u along `Real_Angle`. P starts at the pit centre with speed 0 and a random heading.
  2. `Real_Speed` += 0.2 (the cap of 400 is practically unreachable). After t seconds, P moves 0.8t u per tick, which is **3.2t u/s**: 96 u/s at 30 s, 192 at 60 s, 270 (militia speed) at about 84 s, 384 at 120 s. Reaching the cap of 1600 u/s would take 500 s.
  3. If P is outside the pit rect, its heading is set to point at the pit centre (an abrupt reversal).
  4. The heading gains a random 0-5 degrees every tick. That is always counter-clockwise and averages 10 degrees/s, so one lap takes about 36 s. The loop radius (about v/0.175) grows with speed, so P soon hits the walls and bounces back through the middle.
  5. Every spike within **400 u** of P is killed (retracts).
  6. Every dead spike **at least 512 u** from P is restored and rises with a birth animation. Spikes 400-512 u away keep their current state, which leaves a short safe wake behind P.
  7. Every living spike instantly kills every unit within **128 u** of it.

  In effect, a disk of about 272 u (400-128) around P is guaranteed safe. The trailing edge extends to about 384 u (512-128). There is no warning before a spike rises, and it kills in the same tick.
- **Timeline:** At t=0: DarkVictory music, militia spawn, Spike Work starts. The spot moves from speed 0. At t=2: AI on. After that, play continues until only one player is left.
- **How you lose / win / finish:** You die if you are within 128 u of a raised spike at any 0.25 s check. The last survivor wins.
- **Computer-player AI:** Every 1 s, bots move to a random point within 128 u of P's *current* position. They don't lead the target, so they fall behind as P speeds up.
- **Designer notes:** Stay on the safe spot as it speeds up. Its path is roughly circular, but it turns sharply back toward the middle when it reaches an edge.
- **Remake notes:**
  1. Spikes form an 18x10 grid at 128 u spacing, each raised or lowered. Lower spikes within 400 u of P, raise them again beyond 512 u, and kill anything within 128 u of a raised spike. Tick every 0.25 s.
  2. P's speed ramps linearly at 3.2t u/s. Its heading drifts by U(0,5) degrees per tick (always counter-clockwise), and it points at the centre whenever it leaves the rect.
  3. Tie scoring for deaths in the same tick.
  4. The original ends only through the speed ramp; there is no time cap. It is similar to King of the Hill, but the zone moves and stepping outside it is instant death.
  5. **Oddities:** no timer. The 400/tick speed cap is dead code in practice. The only AI is chasing P's current position.

---

### The Salamander Sizzle (bundle: Salamander, event #21)

- **Goal (in-game text):** "The Salamander Sizzle / Shoot with 'S' and kill your opponents!"
- **Type & scoring:** Survival (Survival Death + Survival Expire). Ties are *not* enabled, so deaths in the same instant get consecutive scores in processing order. The timer is 150 s. When it runs out, every survivor gets the current ante (shared), all are killed, and the result is "Draw". The last salamander alive wins 8.
- **Arena:** `Salamander_Sizzle` (-128,3456)-(1920,5504): 2048x2048 u = 16x16 tiles, with the camera locked to it.
  - **Outer wall:** a roughly circular pen of 60 "Dungeon Tree Wall" destructables (`DTsh`, the "mushrooms", 1 tile each) 960-1190 u from the centre (896,4480). Outside the ring is unwalkable.
  - **Interior cover (28 DTsh):** four straight spokes on the N/S/E/W axes, each 4 blocks from 448 to 832 u out. Four diagonal spokes (NE/NW/SE/SW), each 3 blocks from 453 to 815 u out.
  - **Open centre:** radius about 448 u.
  - Init restores every DTsh on the map to full life.
  - **Spawns:** each playing slot k gets a salamander created for Neutral Passive at 800 u from the centre, at angle (k*135 - 22.5) degrees. That gives the 8 positions at 22.5 + 45j degrees, each in the middle of a wedge between two spokes. Next Event then hands them to players at random.
- **Player unit:** Salamander (`nslr`).
  - Speed 270, turn rate 0.6 (MODIFIED), collision 48, **HP 25** (MODIFIED), regen 0.25, armor 1, no weapon (MODIFIED).
  - **Mana:** 200 max, **starts at 0**, regenerates **10/s** (all MODIFIED). The first shot is ready 7.5 s after spawn. Sustained fire is one shot per 7.5 s, and a full bar (after 20 s) allows two shots back to back.
  - Its only ability is Flame Shot (`A002`, based on Roar; tooltip hotkey S): 75 mana, cooldown 0, instant, with the Roar buff zeroed out.
- **Hazards: fireballs.** Salamander Fire runs on *any* spell effect:
  - The caster is ordered to "stop", so shooting halts you.
  - A Fire unit is created 128 u in front of the caster, along its facing, and ordered to move 3000 u in that direction. It is an `ewsp` wisp reskinned as "Fire": owned by Player 12, coloured yellow, with a fire emitter attached.
  - Fire stats: speed 350 (faster than a salamander), flying at height 0 so it ignores pathing, invulnerable, 120 HP, collision 0.
  - The Fire also has Permanent Immolation (ANpi, base values): 10 damage/s to enemy organic ground units within 220 u. Player 12 is hostile to everyone, so it burns salamanders. Near misses add up: three ticks kill a 25-HP salamander.

  Salamander Burn runs every 0.05 s:
  1. Any salamander with a Fire within 100 u is killed. This includes the shooter.
  2. Each Fire loses 1 HP (20 HP/s, about 19.5 net), so it expires after about 6.1 s and about 2150 u of flight.
  3. A Fire within 100 u of a living destructable is killed.
  4. Every destructable within 100 u of any Fire is killed, including Fires killed in step 3. A fireball that hits a mushroom destroys both, so cover, including the outer ring, erodes for good.
- **Timeline:** At t=0: OrcX1 music, spawn, 150 s timer, Survival Death/Expire and Fire/Burn enabled. At t=5: AI on. At t~7.5: the first shots are possible. At t=150: expiry.
- **How you lose / win / finish:** Touching a fireball (within 100 u) kills you. Immolation (10 dps within 220 u) can also finish you. The last survivor wins; on timeout, all survivors share a score.
- **Computer-player AI:** Every 4 s, each bot moves 100-300 u toward a random *other living* salamander, with +-5 degrees of jitter. After 1 s it has a 50% chance to cast "roar", which fires along its current facing, roughly at that target.
- **Designer notes:** Each fireball costs 75 mana, but mana comes back fast. Use the mushrooms as cover.
- **Remake notes:**
  1. Fireballs are straight skill-shots at 350 u/s. They spawn 128 u ahead, kill anything within 100 u, and last about 6 s. The caster stops when firing.
  2. Mana is 75 per shot out of 200, regenerates 10/s, and starts at 0.
  3. Salamanders have 25 HP, and each fireball carries a 10 dps, 220 u burn aura, so near misses matter.
  4. Cover is destructible: it absorbs fireballs and is destroyed by them. Use 8 spokes plus the ring, with an open centre.
  5. Spawns are on a ring of 8 at r=800, between the spokes, assigned at random. Nothing in the current Hammerguy's Party set is like this; the closest is Mortar Mayhem, which is about dodging projectiles, not player-versus-player.
  6. **Oddities:**
     - The shooter stands inside its own fireball's 220 u burn aura at launch, so it may take one 10-damage tick. Whether that tick lands depends on when WC3's immolation timer fires.
     - Dead Fires may still count in the step-1 enumeration during their 1 s death, so a salamander walking into the spot where a Fire just died could be killed. This is unverified.
     - Simultaneous deaths are not tied.

---

### Obey Archimonde (bundle: Obey, event #22)

- **Goal (in-game text):** "Obey Archimonde / Do what Archimonde tells you!"
- **Type & scoring:** Survival (Survival Death, `TiesPossible = true`). Tie Death is *not* enabled. Instead, Obey's own triggers set `TieAnte = Ante` before killing, so everyone who fails the same command shares one score. **There is no time limit:** no timer and no Survival Expire. The round runs until one player remains (8), or a Draw if all remaining players fail together.
- **Arena:** `Obey_Archimonde` (5632,3456)-(6784,4480): 1152x1024 u = 9x8 tiles, with the camera locked to it.
  - Archimonde (`Uwar`, owned by Player 12, set to hero level 10, scale 1.4, no weapon) is created at (6208,4288), 320 u north of the centre, on a blighted dais at the top that is surrounded by unwalkable ground.
  - The warlock pads `Obey_1..8` are 128x128 each, in two rows of four:
    - y=3840: slots 1, 4, 7, 2 at x = 5696, 6016, 6400, 6720.
    - y=3520: slots 5, 8, 3, 6 at the same x values.
  - Warlocks (facing north) are created for Neutral Passive on the pads of playing slots, then handed to players at random.
- **Player unit:** Fel Orc Warlock (`nchw`).
  - **Speed 0** (MODIFIED; it cannot move), HP 360 with 100 HP/s regen, mana 400 (starts at 400, regen 100/s), no weapon, collision 48.
  - Four abilities, all MODIFIED to **cost 0 and cooldown 0**:
    - Roar (`ACro`, instant, order `roar`, default hotkey R).
    - War Stomp (`Awrs`, instant, order `stomp`, hotkey T). Its area is set to 0, so it affects nobody.
    - Bloodlust (`ACbl`, unit-targeted, can target self, order `bloodlust`). The map's tooltip highlights B.
    - Unholy Frenzy (`ACuf`, unit-targeted, order `unholyfrenzy`, hotkey U).
  - Archimonde has the same four abilities.
- **Hazards: the command loop.**
  - **First Command** (0.25 s periodic; disables itself when it fires): wait 2 s, add 1 to `DifficultyCurve`, then order Archimonde, in sequence:
    - roar;
    - then 50%: stomp;
    - then, if the curve is 5 or more: 1/3 bloodlust (on himself);
    - then, if the curve is 10 or more: 1/4 unholyfrenzy (on himself).

    `Order_Archimonde` records the **last** order issued, which gives these odds:
    - commands 1-4: roar 1/2, stomp 1/2;
    - commands 5-9: roar, stomp and bloodlust 1/3 each;
    - commands 10 and later: each of the four 1/4.

    All 8 players are then added to `PlayerGroup_InTrouble`.
  - **Obey Command:** wait (`Real_Speed` + 0.5) s. Then subtract 0.5 from `Real_Speed` (it starts at 5.0 and stops at 1.0), kill every unit of every player still InTrouble, remove all buffs from all units, and re-enable First Command. The response windows are **5.5, 5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0 s, then 1.5 s** from command 9 on. The gap from one deadline to the next command is about 2.0-2.25 s.
  - **Obey Follow:** *every* no-target or unit-target order issued by a player's units is compared with `Order_Archimonde`. Point orders are not watched.
    - If it matches, you are removed from InTrouble.
    - If it differs, all your units are killed on the spot.

    This check is live the whole time after the 4 s intro:
    - Between commands, the previous command still counts as correct.
    - In the roughly 2 s before the very first command, `Order_Archimonde` is still unset, so *any* order kills.
    - Stop (S), Hold (H), or right-clicking a unit all count as orders and kill you.
    - Right-clicking the ground is a point order, so it is ignored.
  - **Obey Death:** any death plays a lightning bolt and an explosion effect and sets screen shake to 500.
- **Timeline:** At t=0: Doom music, spawn. At t=4: all triggers on, AI too. At t~4.0-4.25: First Command fires, so **command 1 comes at about 6.0-6.25 s**. Early cycles last about 7.5 s; once the window is 1.5 s, cycles last about 3.6 s. Command 9 arrives around t~53 s.
- **How you lose / win / finish:** You lose by giving a wrong order at any time, or by giving no correct order within the window. The last warlock standing wins.
- **Computer-player AI:** Every 1 s, each bot still InTrouble has a 60% chance (`GetRandomInt(1,5)>2`) to issue the matching order, targeting itself for bloodlust or unholy frenzy. It never gives a wrong order. With 1-2 tries in a 1.5 s window, a bot fails that window about 16-40% of the time.
- **Designer notes:** It's Simon Says (a Mario Party staple). Archimonde's repertoire and tempo both grow over the round, and learning the hotkeys matters, especially for the two targeted moves.
- **Remake notes:**
  1. There are 4 moves. Two are instant; two need a target click (self), which adds input friction.
  2. The move set expands at command 5 and again at command 10, with the probabilities above.
  3. Windows shrink from 5.5 to 1.5 s in 0.5 s steps, with a telegraph gap of about 2 s.
  4. Any wrong input eliminates you instantly, even between commands; repeating the last command is safe.
  5. Players who fail together tie.
  6. It is new to Hammerguy's Party.
  7. **Oddities:**
     - Two unused helper functions in Obey Command are leftovers of a "Survival Draw" branch.
     - War Stomp's area is 0.
     - The hero level 10 is cosmetic.
     - The only real clock is the shrinking window.

---

### Whack-a-Fiend (bundle: Whack, event #23)

- **Goal (in-game text):** "Whack-a-Fiend / Kill 10 crypt fiends!"
- **Type & scoring:** Race (Race Death + Race Expire; ante = 8). You finish when your hero **reaches level 3** (`EVENT_PLAYER_HERO_LEVEL` triggers Race Finish). Places score 8, 7, 6..., and a finisher's Mountain King is removed while the others continue. The timer is 90 s. When it runs out, the remaining heroes are killed and score 0. The result is "Draw" if nobody finished.
- **Arena:** `Whack_a_Fiend` (5632,5632)-(6656,6656): 1024x1024 u = 8x8 tiles, flat and 100% walkable, with the camera locked to it.
- **Player unit:** Mountain King (`Hmkg`).
  - **Spawn and setup:** created for the player at a random 100-400 u from the centre. Set to **hero level 2** with Storm Bolt level 1 and Thunder Clap level 1 learned. The **XP handicap is set to 50%** for all players; Next Event resets it.
  - **Level-2 stats** (1.26 hero formulas: STR 24 +3, AGI 11 +1.5, INT 15 +1.5): about 775 HP, about 240 max mana, mana regen about 0.8/s, speed 270, collision 32. Melee damage 29-39 (2d6 + STR 27), base cooldown 2.22 s (about 1.8 s with agility).
  - **Targeting:** targets are MODIFIED to "debris,ground,item,nonhero,structure,ward" and acquisition range to 100. Heroes cannot attack each other, and human-controlled heroes won't chase fiends on their own.
  - **Storm Bolt:** 75 mana, 9 s cooldown, range 600, 100 damage, stun 5 s (3 s on heroes). It can stun rival heroes.
  - **Thunder Clap:** 90 mana, 6 s cooldown, radius 250, 60 damage, 50% move and attack slow for 5 s (3 s on heroes).
  - With this mana, a hero gets only about 3-4 spells per round.
- **Hazards / opponents: the fiends.** Crypt Fiends owned by Player 12.
  - The burrowed form `ucrm` has HP 5 and regen 0 (both MODIFIED) and cannot move. Burrowed fiends are hidden underground; you whack them after they pop up.
  - The surfaced form `ucry` has HP 5, regen 2, speed 270, no weapon, and Burrow as its only ability. Fiends are never given move orders.
  - Fiends are level 3, worth 60 XP (WC3 normal-XP table 25/40/60). The 50% handicap halves that to **30 XP**. Going from level 2 to level 3 takes 300 XP (the XP total goes from 200 to 500), which is **exactly 10 kills**. Any hit or spell kills a fiend.
- **Spawning / schedule:**
  - At t=6, N burrowed fiends appear at uniform random points in the arena and are set to explode on death.
  - Every Player-12 death spawns a new burrowed fiend at a random point, so the population stays at N.
  - **Whack Swap**, every 1 s: one random surfaced fiend burrows and two random burrowed ones surface (the two picks can be the same fiend). The burrow animation takes 1.45 s. Steady state is about N-1 fiends above ground.
- **Timeline:** At t=0: Human3 music, handicap, heroes spawn, 90 s timer, Race Death/Expire. At t~0: bots get acquisition range 1000. At t=6: fiends appear and Kill/Finish/Swap start. At t=90: expiry. That leaves 84 s of hunting.
- **How you lose / win / finish:** The first player to 10 kills (level 3) finishes. Heroes can't realistically die: they can't hit each other and spells lack the damage. The only other outcome is expiry.
- **Computer-player AI:** Bots get acquisition range 1000. Every 1 s, Whack Swap orders them to "stop", so they re-acquire the nearest fiend they can see and attack it. They never cast spells.
- **Designer notes:** Be first to 10 kills. Storm Bolt and Thunder Clap work both for kills and for disabling rivals. TheZizz himself called it "a little too mindless".
- **Remake notes:**
  1. It's whack-a-mole: N targets, 1 goes down and 2 come up each second, and a killed target respawns at a random point. Kills are one hit.
  2. Win at 10 kills; the original implements this as XP to level 3, but a counter is equivalent.
  3. Two abilities: a stun bolt (single target, range 600, stuns rivals for 3 s) and an area clap (radius 250, 50% slow). Mana is scarce.
  4. Race placement scoring. It is similar to Gold Rush (a collection race) with disruption between players.
  5. **Oddities:**
     - Whack Swap's condition "fewer than 16 ghouls (`ugho`)" is always true, because no ghouls exist here; it looks copied from Clean Crew.
     - Thunder Clap multi-kills each give XP, so a hero at 9 kills can finish in one clap.

---

### Horse Race (bundle: Horse, event #24)

- **Goal (in-game text):** "Horse Race / Press 'B' to speed up, but don't overdo it!"
- **Type & scoring:** Race (Race Death + Race Expire; ante = 8). Entering the finish rect scores 8, 7, 6... in order. The timer is **60 s, and it starts during the 6 s pause**, so there are only 54 s of racing. When it runs out, the remaining wizards are killed and score 0. The result is "Draw" if nobody finished.
- **Arena:** `Horse_Race` (-256,5888)-(4736,6912): 4992x1024 u = 39x8 tiles. The camera is locked to it and first pans to (192,6400), near the start line.
  - There are **8 walled lanes**. Continuous walls of "Line of Sight Blocker" destructables (616 in total, each blocking 64x64 u) run along y = 5920, 6048, ..., 6816, from x = -256 to 4608. Each lane is a 64 u corridor, so wizards cannot touch or block each other.
  - Lane centres are y = 5984 + 128k.
  - Start rects `Horse_k` (128x64, centre x=-64): slot 1 at y=6880, 4 at 6752, 7 at 6624, 2 at 6496, 5 at 6368, 8 at 6240, 3 at 6112, 6 at 5984. Hitching posts stand at x=-224 behind the starts.
  - The finish rect `Horse_Finish` spans x = 4480-4736 over the full height. A decorative Circle of Power (`ncp2`, neutral) stands at x=4544 in each used lane.
  - **Distance from the start to the finish line: 4544 u.**
  - Wizards are created for Neutral Passive in the lanes of playing slots and then handed out at random. All neutral-passive units (wizards and circles) are scaled to 60%.
- **Player unit:** Renegade Wizard (`nwzg`), the BanditMage model.
  - Base speed 320 (MODIFIED), collision 16 (MODIFIED), HP 600, no weapon.
  - **Mana 400, starting full, with 0 regen** (MODIFIED).
  - Its only ability is **Speed Boost** (`Absk`, based on Berserk, hotkey B): 100 mana, so **exactly 4 boosts**. Cooldown 1 s, instant. Its attack-speed and damage-taken fields are zeroed and its duration is 0. The +20% move-speed field (`bsk1`) was left at 0.2, so whether it adds a hidden bonus is unclear. The script's speed control is clearly the intended mechanic.
- **Speed model:**
  - **Horse Slow**, every 0.05 s: if the move speed is above 60, subtract 2; otherwise set it to 60. So speed **decays at 40 u/s per second down to a floor of 60 u/s**.
  - **Horse Speed:** any spell cast sets the caster's speed to **320**. This is a reset, not a bonus.
- **Timeline:** At t=0: DarkVictory music, ante 8, spawn, *all units paused*, circles placed, 60 s timer. At t=6: unpause, all wizards are ordered to move to the finish centre (4608,6400), and decay starts from 320. At t=60: expiry.
- **Race math** (from a 0.05 s-step simulation of the map's rules):
  - Coasting from 320 to 60 takes 6.5 s and covers 1235 u; after that the wizard moves at 60 u/s.
  - **With no boosts, a wizard needs 61.7 s, so it cannot finish** within the 54 s and dies at expiry.
  - A single well-timed boost finishes in about 47 s.
  - Boosting every time speed hits the 60 floor finishes in 22.7 s.
  - The **optimum is about 18.4 s**, with boosts evenly spaced every 3.6 s (at roughly 176 u/s).
  - Spamming all 4 boosts at the start (1 s apart) takes about 45.5 s.
  - The map's own bot averages about 24.8 s (range 18.4-40.3 s).
- **How you lose / win / finish:** Entering `Horse_Finish` finishes you in order of arrival. Anyone who hasn't finished at 60 s gets 0.
- **Computer-player AI:** Inside the 0.05 s Horse Slow loop, each bot wizard below 270 u/s has a 1/40 chance per tick to boost. That averages about 2 s after dropping under 270, so bots usually boost at around 190 u/s. After any spell cast, every bot unit is re-ordered to move to the finish.
- **Designer notes:** You get only 4 boosts. Using them too early or too sparingly both lose; it's harder than it looks.
- **Remake notes:**
  1. It's a sawtooth-stamina race: speed resets to 320 on boost and decays 40 u/s per second to a floor of 60. There are 4 boosts with a 1 s cooldown.
  2. The track is 4544 u in separate lanes with no interaction, and the limit is 54 s of real racing (a no-boost run must fail).
  3. Race placement scoring. It is similar to Golem Gauntlet (a race), but it's a pure boost-timing skill test.
  4. **Oddities:**
     - The "horses" are wizard models.
     - The timer includes the 6 s start pause.
     - The Berserk movement field was left at its default.
     - The bot is decent: it uses all boosts by about 13 s.

---

### The Masquerade (bundle: Masquerade, event #25)

- **Goal (in-game text):** "The Masquerade / Feed, and return to your den before sunrise!"
- **Type & scoring:** Survival (Survival Death + Dissipate). **There are no ties and no timer:** the round runs until one vampire is left (8 points). Vampires who starve in the same tick are scored one by one in group-enumeration order. If the last several die together, whoever is processed last "wins", because Win runs as soon as a single key unit remains.
- **Arena:** `Masquerade` (2944,3584)-(4736,5376): 1792x1792 u = 14x14 tiles, with the camera locked to it.
  - The walkable area (79%) is an octagonal town square with obstacles: 4 city buildings (2 horizontal, 2 vertical), 4 small buildings, flower beds, and a central tree ringed by flower beds.
  - **Dens:** `Masquerade_1..8` (1 tile each), all 834 u from the centre (3840,4480). Offsets: slot 1 (-448,+704), 6 (+448,+704), 2 (+704,+448), 7 (+704,-448), 3 (+448,-704), 8 (-448,-704), 4 (-704,-448), 5 (-704,+448).
  - **Villager spawns:** `Masquerade_Spawn_1..8`, in a pinwheel 330-573 u from the centre. Offsets: (-256,+512), (+96,+320), (+512,+256), (+320,-96), (+256,-512), (-96,-320), (-512,-256), (-320,+96).
  - Each playing player gets a **Vampire Den** (`otrb` Troll Burrow, renamed; invulnerable, 1-tile solid footprint, can load units) at their own slot's rect. There is no random handout. Their Dreadlord is created 50 u from the den toward the centre.
- **Player unit:** Dreadlord (`Udre`) at level 1.
  - STR 20 gives **600 max HP, but the script sets HP to 135 at the start**.
  - Speed 270, collision 31 (MODIFIED), melee 22-32 (2d6 + 20), cooldown 1.8 s (about 1.36 s with AGI 16).
  - Acquisition range 100 (MODIFIED).
  - Abilities (MODIFIED): **Invulnerable** (Avul) and **Permanent Invisibility** (Apiv). Vampires can neither see nor hurt each other.
  - Vampiric Aura level 1 (15% life steal) is learned by script.
  - HP regen is negligible: the Undead base regen of 2 only works on blight, and the town isn't blighted.
- **Hazards / opponents:**
  - **Villagers** (`nvl2`, owned by Player 12): speed 190, HP 60, regen 0.5, collision 16. They Wander (Awan, MODIFIED in) and have no weapon. A villager dies in 2-3 hits, about 2.7-4 s.
  - **Feeding:** when a Player-12 unit dies, the **killing unit is healed to 100%** (600). Only the last hitter eats, so kill-stealing works.
  - **Day/night clock:** SetTimeOfDay(19:00) at t=0 (the clock stays frozen until t=4). The DayLength constant of 480 means 20 s per game hour at 100% speed.
    - Night runs at 1000% speed, or **2 s per game hour**.
    - Day runs at 2000% speed, or **1 s per game hour**.
    - Night 1 lasts 22 s (19:00 to 06:00). Each day lasts **12 s**. Every later night lasts **24 s**, so a full cycle is 36 s.
  - **Sunlight**, every 0.05 s while the time is between 06:00 and 18:00:
    - Every Dreadlord loses 2 HP per tick (**40 HP/s, even inside the den**; the loaded unit is still enumerated by type).
    - Every Dreadlord found in the map rect, meaning *not* loaded in a den, loses another 5 per tick (**+100 HP/s, so 140 HP/s outside**).
    - SetUnitLife bypasses invulnerability.
    - Result: a fully fed vampire (600) survives a day in its den with about 120 HP. Outside it dies in about 4.3 s. An unfed vampire (135 HP, or about 120 after a day) dies within about 3-4 s of sunrise even inside the den. **You must feed every night.**
  - **Villager supply:**
    - At t=4, **one villager per vampire** (N) spawns at random spawn rects, so everyone can feed on night 1. The quest text is wrong on this point.
    - At each dusk (18:00), villagers are topped up until the number alive equals (vampires alive - 1).
    - Uneaten villagers carry over and count toward that total.
- **Timeline:**
  - t=0: UndeadVictory music, dens and vampires created, triggers on; bots get acquisition range 2000.
  - t=4: N villagers spawn, the clock starts, AI on.
  - t=4-26: night 1.
  - t=26-38: day 1; the first starvation deaths happen here.
  - t=38: dusk top-up, then night 2 (t=38-62) and day 2 (t=62-74).
  - The 36 s cycle repeats until one vampire is left.
- **How you lose / win / finish:** You die when sunlight or starvation drains your HP to 0. Death kills your den too (Masquerade Death), and Dissipate removes the corpse. The last vampire alive wins.
- **Computer-player AI:**
  - Bot vampires have acquisition range 2000, so they auto-attack the nearest villager anywhere.
  - From 03:00 (6 s before dawn) until 18:00, every 1 s they are ordered to "board" their own den.
  - At dusk, every unit a bot owns gets "unloadall" at its own position, which empties the den.
  - A separate trigger re-selects any unit that receives a no-target order for its owner. This is probably a UI helper so the vampire is re-selected after being unloaded; its intent can't be proven from the code.
- **Designer notes:** Feed at night, get back to your den before sunrise, and don't starve. There is never enough food for everyone, so at least one player goes hungry each night (true from night 2 onward).
- **Remake notes:**
  1. Day/night: 22 s for night 1, then 12 s days and 24 s nights. Drain 40 HP/s by day everywhere, plus 100 HP/s in the open. Max HP 600, starting HP 135, and a kill restores full HP.
  2. Food is capped at (alive - 1) per night after the first night, and uneaten villagers carry over. Only the last hitter eats; villagers are 60 HP, slow (190) wanderers.
  3. Vampires are invisible and invulnerable to each other, so the only interaction is racing for kills and stealing them.
  4. Each player has a personal den; entering it hides you and cuts the drain to 40/s.
  5. It resembles Gold Rush (competition for scarce pickups) with a survival clock.
  6. **Oddities:**
     - Night 1 has N villagers, not N-1.
     - There are no ties, so simultaneous dawn deaths are ordered arbitrarily.
     - There is no timer.


## Uther Party 4.0: minigame rule sheets, group 4

Games covered: Crab Island (#26), Blinky the Bear (#27), The Abombinations (#28), Sleepy Time (#29), Nature's Circle (#30), The Skull of Gul'dan (#31), Minotaur Maze (#32).

Sources: `up40/bundles/<Prefix>.txt` (JASS + object data), `up40/j.txt` (framework triggers), `up40/quests.txt`. For base WC3 1.26 values the map does not override I read the game SLKs directly (AbilityData/UnitBalance/ItemData/MiscGame). The arena layouts come from `war3map.wpm` (terrain pathing) and `war3map.doo` (doodads/destructables), which I decoded myself. The helper scripts are `g4_dump.py` and `g4_layout.py` in `up/`.

Conventions used below:
- **Periodic triggers.** Every `TriggerRegisterTimerEventPeriodic` timer starts at map load. Enabling a trigger later does not reset its timer, so the first tick lands 0 to period seconds after the enable.
- **Damage.** Armor reduction is 0.06·A/(1+0.06·A). The 1.26 damage table from MiscGame.txt, columns light/medium/heavy/fort/normal/hero/divine/unarmored:
  - Normal: 1.0/1.5/1.0/0.7/1/1/.05/1.0
  - Pierce: 2.0/.75/1.0/.35/1/.5/.05/1.5
  - Magic: 1.25/.75/2.0/.35/1/.5/.05/1.0
  - Chaos: 1.0 against everything.
- **Hero stats.** HP = 100 + 25·STR, mana = 15·INT, armor = 0.3·AGI − 2 (MiscGame.txt).
- **Scoring.** "Survival" and "race" scoring work as described in FRAMEWORK.md.

---

### Crab Island (bundle: Crab, event #26)

- **Goal (in-game text):** "Crab Island / Survive as long as possible!"
- **Type & scoring:** Survival. `Survival Death` is enabled and `TiesPossible` stays false, so there are no deliberate ties. **There is no time limit.** `udg_Timer_TimeLeft` is never started and `Survival Expire` is never enabled, so the game runs until only one player owns key units. That player gets `Win` (8 points). There is no special ante handling.
- **Arena:** `Crab_Island` (7680,-4352)-(8960,-3072) is 1280×1280 u (10×10 tiles), centred on (8320,-3712). Camera bounds are this rect.
  - From the pathing map, the dry land is an octagon about 1024×1024 u (x 7808-8832, y -4224..-3200).
  - Around the land is a ring of walkable shallow water 128-256 u wide, reaching the rect edge. Beyond that the terrain is unwalkable.
  - A Sunken Ruins Tree (128×128 blocker) with shrubs stands at the exact centre.
  - Each playing player gets a Banshee, created directly for them 100-300 u from the centre at a random angle (not handed out).
  - A neutral-passive critter `ncrb` "Crab" (15 HP, speed 100) is placed at a random point. The quest log jokes that it holds no secret.
- **Player unit:** `uban` Banshee.
  - Speed 270, **hover**, HP 285, collision 16, armor 0 (unarmored).
  - **Attack disabled** (map sets weapons=0).
  - **Mana 400 at start and max, mana regen 0** (map overrides). Mana is therefore a one-time budget.
  - Abilities (map-set list):
    - `ACps` Possession (creep): 250 mana, 200 range, 1 s cast. Target must be a ground, non-hero, organic enemy/neutral of level 5 or lower. Your banshee body is consumed and you take over the target.
    - `ACam` Anti-magic Shell: 50 mana, 500 range. The map shortens the duration from 90 s to **20 s**.
    - `ACmi` Spell Immunity (passive). Because every Banshee is spell-immune, Possession and AMS can only target crabs, never rival banshees. AMS on a crab makes it immune to Possession, which works as a **denial** tool against other players.
  - Budget: 400 mana = one Possession + 3 AMS, or 8 AMS.
  - On Possession, `Crab Possess` (CHANGE_OWNER event) adds the crab to KeyUnits, gives it Spell Immunity (so nobody can steal it back) and removes Wander.
- **Hazards:** hostile crabs owned by Player(11). Each has Wander, acquisition 500 and sight 1400. They are melee with normal attacks; against the unarmored Banshee that is 100% damage.

  | Unit | Speed | HP | Armor | Damage (cooldown 1.35 s) | Level |
  |---|---|---|---|---|---|
  | `nscb` Shorecrawler | **350** (map) | 240 | 0 | 10-11 | 1 |
  | `nsc2` Limbripper | **320** (map) | 400 | 1 | 14-15 | 3 |
  | `nsc3` Behemoth | 270 | 850 | 3 | 24-27 | 5 |

  - **Spawning** (`Crab Spawn`): every 10 s, but only while Player(11) owns fewer than **30** units.
    - Each spawn is 50/50 a Shorecrawler or a Limbripper.
    - It appears at centre + 640 u at a random angle. That puts it in the shallow-water ring, since the land edge is about 512 u out. A Frost Nova visual plays.
    - If at least **5** melee attackers exist anywhere on the map (the new crab counts, and so do possessed crabs) **and** a 1-in-8 roll succeeds, the new crab is replaced by a **Behemoth**.
  - All three crab types are level 5 or lower, so all can be possessed.
  - Time to kill a lone Banshee, derived: Shorecrawler about 36 s, Limbripper about 27 s, Behemoth about 15 s. Crabs stack.
- **Timeline:**
  - t=0: music War3XMainScreen; banshees and critter created; camera placed; text shown; `Survival Death` and `Crab Possess` on.
  - Wait 5 s: `Crab AI` turns on if any player is a computer, and `Crab Spawn` turns on. The first crab arrives 5-15 s into the game, then one every 10 s.
  - There is no end timer.
- **How you lose / win / finish:** you are out when your last key unit (banshee or possessed crab) dies; you score the current ante. The last player alive wins 8.
- **Computer-player AI:** every 6 s, every unit of a computer player is ordered to "move" to a random point in `Crab_Island`. The AI never uses Possession or AMS.
- **Designer notes:** use Possession wisely and hold out for a big crab to possess.
- **Remake notes:**
  - Endless escalation: one crab per 10 s, capped at 30. Crabs are faster than you (350/320 against 270), wander, and aggro inside 500 u.
  - One-shot "possess" power (250 of a non-regenerating 400 mana, 200 u range, 1 s cast). You become that crab with its current HP. The Behemoth (850 HP, 24-27 damage, 1-in-8 chance once 5 or more crabs exist) is the jackpot.
  - Secondary "shield" power (50 mana, 20 s) that makes a crab un-possessable. Useful to deny rivals.
  - Closest existing HP game: Kodo Stampede (survival, hazards scale over time). The possess mechanic is new.
  - Oddities:
    - (a) There is no time limit, so a stalling player can drag the game out.
    - (b) Survival scoring depends on WC3 firing the change-owner event before the caster's death. If the Banshee's death were processed first, `Survival Death` would score the player out, and the possessed crab could later score again. The code does not guard against this, but the designer's advice implies it works.
    - (c) Possessed crabs are still melee attackers, so they keep counting toward the Behemoth condition.

---

### Blinky the Bear (bundle: Blinky, event #27)

- **Goal (in-game text):** "Blinky the Bear / Reach the end!"
- **Type & scoring:** Race.
  - Ante is set to 8, so the 1st finisher gets 8, the 2nd gets 7, and so on. Finishers are removed with a teleport effect.
  - **Time limit 90 s** (timer dialog "Time Left"). On expiry `Race Expire` kills all remaining bears, which score 0.
  - Dying (`Race Death`) scores 0.
  - Ties are only possible if two units enter the finish at the same instant.
- **Arena:** `Blinky_the_Bear` (9728,-4608)-(11008,-896) is 1280×3712 u (10×29 tiles). Camera bounds are this rect; the camera starts on `Blinky_Start`.
  - `Blinky_Start` (10240,-4480)-(10496,-4224) is 256×256 u. Each Blinky is created directly for its player at a random point here, facing north.
  - `Blinky_Finish` (10240,-1152)-(10496,-896) is 256×256 u and is marked by a Circle of Power.
  - **Leaving the arena rect kills any unit** (`Blinky Death`: leave-rect, KillUnit).
  - Layout, from the pathing map, at 128 u per character (S = start, F = finish, `~` = pond sealed by large pathing blockers, # = unwalkable):

```
 -1024 ....FF....      finish strip, full width, y -1152..-896
 -1152 ....FF....
 -1280 .########.      middle lanes end at -1664; 512 u gap of wall + blocked pond
 -1408 .#~~~~~##.
 -1536 .#~~~~~~#.
 -1664 .########.
 -1792 .##.##.##.      lanes A,B,C,D at x 9728-9856 / 10112-10240 / 10496-10624 / 10880-11008
 -1920 .##.##.##.
 -2048 ###.##.###
 -2176 ###.##.###
 -2304 .##.##.##.
 -2432 .##.##.##.
 -2560 .##.##.##.
 -2688 .########.
 -2816 .########.
 -2944 .##.##.##.
 -3072 .##.##.##.
 -3200 .##.##.##.
 -3328 ###.##.###
 -3456 ###.##.###
 -3584 .##.##.##.
 -3712 .##.##.##.
 -3840 .##.##.##.
 -3968 .########.
 -4096 .########.
 -4224 .##....##.      start pocket x 10112-10624, sealed
 -4352 .##.SS.##.
 -4480 .##.SS.##.
 -4608 .##....##.
```

  - There are four 128 u (1-tile) lanes separated by 256 u (2-tile) walls. Each lane is cut into segments by 256 u wall bands.
  - Outer lanes A and D: segments y [-4608,-3456], [-3200,-2176], [-1920,-896]. The top segment opens straight into the finish strip.
  - Middle lanes B and C: start pocket [-4608,-4096], then [-3840,-2816], then [-2560,-1664]. They end below the sealed pond.
  - The pocket is sealed, so you **must blink** to go anywhere. The 256 u walls sit comfortably inside Blink's 512 range.
  - Derived: from the top of B2/C2 to the finish strip is 512 u of obstacle, plus unit collision. A direct blink is therefore likely just out of reach, and the practical routes finish via lane A or D. This depends on WC3 Blink placing you at the nearest pathable point, so it is not certain.
- **Player unit:** `ngzc` "Blinky" (grizzly bear).
  - Speed 320, **HP 5** (map), collision 31 (map), heavy armor 0, **no attack** (map).
  - Ability `ANbl` Blink, made a non-hero ability at level 1: max range **512**, min range **0**, **cooldown 0.5 s** (base 15 s; the "cooldown reduced" change-log entry), 0 mana.
- **Hazards:** 10 × `nplb` "Envious Earl" (polar bear), Player(11).
  - Speed 300, HP 475, armor 2, amphibious movement.
  - Melee 21-25 damage, cooldown 1.35, range 128. **Acquisition 128** (map). One hit kills Blinky.
  - Each bear is issued a `patrol` along one lane segment at map start, so there is one bear per segment. Offsets are from the arena centre (10368,-2752):

    | Lane (x) | Segment | Start → end, first leg (y) |
    |---|---|---|
    | A (9792) | A1 | -3584 → -4608 |
    | A (9792) | A2 | -2304 → -3200 |
    | A (9792) | A3 | -1920 → -1024 (reaches into the finish strip) |
    | B (10176) | B1 | -2944 → -3840 |
    | B (10176) | B2 | -2560 → -1792 |
    | C (10560) | C1 | -3840 → -2944 |
    | C (10560) | C2 | -1792 → -2560 |
    | D (10944) | D1 | -4608 → -3584 |
    | D (10944) | D2 | -3200 → -2304 |
    | D (10944) | D3 | -1024 → -1920 |

  - Mirror pairs always move in **opposite phase**.
  - Patrol lengths are 768-1024 u, so a round trip at 300 u/s takes about 5-7 s.
  - There is no spawning and no ramp-up.
- **Timeline:**
  - t=0: music OrcVictory, ante 8; bears and the finish circle created; timer 90 s starts; text shown; Race Death, Race Expire, Blinky Death and Blinky Finish on. Players can move immediately.
  - t=3 s: `Blinky AI` turns on if there are computers.
  - End: the Finish trigger fires once every Blinky has finished or died, or at the 90 s expiry.
- **How you lose / win / finish:** you finish when your key unit enters `Blinky_Finish`. You die if a bear hits you or you leave the arena rect, for example by blinking outside it.
- **Computer-player AI:** every 0.5 s, each computer unit is ordered to "move" to the finish centre. Then it is ordered to "blink" to a point 512 u away, at the angle toward the finish ± random 90°. With the 0.5 s cooldown that is effectively a blink every tick. The bot ignores bears and can blink out of bounds (instant death) when it is in an outer lane.
- **Designer notes:** plan your route before stepping onto the field, because there is no time to think once you are moving.
- **Remake notes:**
  - One-hit-kill runner with a short-range teleport (512 u, 0.5 s cooldown, free) as the only way across 256 u walls.
  - Grid of 1-tile lanes, one patrolling guard per lane segment, mirror pairs in anti-phase. Guards are slower than you (300 against 320) but aggro only within 128 u.
  - Out-of-bounds equals death. The 90 s timer; 8/7/6… race payout.
  - Similar to **Golem Gauntlet** (race past patrollers), but movement is blink-driven and the layout is a lane lattice.
  - Oddities:
    - The kill-on-leave rule also applies to bears, but their patrol endpoints sit against walls, so they cannot exit.
    - The AI's random ±90° blinks make bots suicidal in the outer lanes.

---

### The Abombinations (bundle: Abombinations, event #28)

- **Goal (in-game text):** "The Abombinations / Keep away from the Abombinations!"
- **Type & scoring:** Survival with **`TiesPossible = true`**. Players killed in the same explosion (the same instant) share the same, lower ante.
  - **There is no time limit.** No timer is started and `Survival Expire` is not enabled.
  - The last rifleman standing gets `Win` (8).
- **Arena:** `Abombinations` (7680,-1792)-(8704,-768) is 1024×1024 u (8×8 tiles), centred on (8192,-1280). Camera bounds are this rect.
  - It is an enclosed octagon of **blighted** ground (blight flag in the pathing map) with no obstacles.
  - A permanent Mass Teleport "portal" effect sits at the centre, which is where abominations appear.
  - For each playing player a neutral-passive Rifleman is created 384 u from the centre at angle playerId·135° − 22.5° (the 8 slots are 22.5° + k·45°), facing the centre. `Next Event` then hands them out **randomly**.
- **Player unit:** `hrif` Rifleman.
  - Speed 270, HP 535, regen 0.25, medium armor 0.
  - Attack: pierce 18-24 (16+2d4), cooldown 1.5, **instant hit**, **range 2000** (map), so it covers the whole arena. Can target the sapper-classified abominations (map adds "sapper" to its target list).
  - Acquisition range is set to **100** for everyone, then to 2000 for computer players' units.
  - No abilities or items. Riflemen can shoot each other (players are unallied), but that is slow: 75% vs medium armor gives about 34 shots to kill.
- **Hazard:** `u000` "Abombination" (custom, from Abomination), Player(11).
  - Speed **400**, HP **100**, **HP regen −5/s always**, so it self-destructs **20 s** after spawning.
  - Armor 2 (heavy), collision 48, **no attack**. Abilities: Wander, and `Adda` "AOE damage upon death" (map values):

    | Radius | Damage |
    |---|---|
    | ≤150 u | 700 |
    | ≤250 u | 300 (partial radius is the base value) |

  - The map **removed "enemy"** from Adda's targets, so the blast hits every ground unit: all riflemen and other abominations. Chain explosions are possible.
  - A full blast kills a rifleman (535 HP). One partial blast leaves 235 HP; two partials kill.
  - A rifle shot does about 16-21 after armor, so killing one takes about 5 shots from a single rifleman, fewer as it decays.
  - **Spawning:** `Abombinations Spawn` fires every 10 s while Player(11) owns fewer than **10** units.
    - The abomination is created at the arena centre and ordered to `move` targeting a **random rifleman** (a follow order).
    - `GetUnitsOfTypeIdAll('hrif')` can include dead riflemen whose corpses still exist.
  - **Replacement on death:** every Player(11) death triggers `Abombinations Death`. It plays a sound, sets camera quake 500 (about 0.5 s of shake), then waits a random **1-3 s** and runs Spawn again (subject to the same cap).
  - Net effect: population grows by one every 10 s and every death is replaced, so the arena holds about 10 abominations by roughly 100 s.
- **Timeline:**
  - t=0: music Undead3, TiesPossible; riflemen and centre portal created; text shown; Tie Death, Survival Death and Abombinations Death on.
  - After a 0 s wait, computer riflemen get acquisition 2000.
  - t=5 s: Spawn on (first abomination at 5-15 s); AI on.
  - End: when one player remains.
- **How you lose / win / finish:** your rifleman dies, in practice to a blast. The last survivor wins 8. Simultaneous deaths tie.
- **Computer-player AI:** every 4 s, each computer unit is ordered to move 200-400 u toward (angle from centre to self) ± 120°, which is roughly "drift away from the centre". Between moves, its acquisition of 2000 makes it auto-shoot the nearest enemy, whether an abomination or a rival rifleman.
- **Designer notes:** sabotage. Shoot abominations when they are next to your enemies.
- **Remake notes:**
  - Homing bombs with a fixed 20 s fuse (100 HP draining at 5/s). Each spawns at the centre and locks onto a random player at 400 u/s, faster than you (270).
  - Death = explosion: 700 within 150 u (lethal), 300 within 250 u (half your HP). It hits everyone, bombs included, so chain reactions happen.
  - Every player has an arena-wide instant hitscan gun (18-24 per 1.5 s). The core play is detonating bombs near rivals and away from you.
  - Escalation: +1 bomb per 10 s up to 10, and each death is replaced after 1-3 s. Survival with shared placings on simultaneous deaths.
  - Closest existing games: **Sapper Tag** (hot potato) and **Mortar Mayhem**.
  - Oddities:
    - No time limit.
    - Human riflemen have acquisition 100, so they will likely auto-shoot an abomination hugging them and detonate it on themselves.
    - Abominations can be sent after a dead rifleman's corpse; the follow order then probably fails and Wander takes over.

---

### Sleepy Time (bundle: Sleepy, event #29)

- **Goal (in-game text):** "Sleepy Time / Be the first to die!"
- **Type & scoring:** **Reverse survival implemented as a race.**
  - `Sleepy Finish` turns a key unit's **death** into `Race Finish`. The first to die gets **8** (ante set to 8), the next 7, and so on.
  - `KeepWinners = true`, so dead giants stay as corpses.
  - **Time limit 120 s.** On expiry, `Sleepy Expire` disables Sleepy Finish, enables `Race Death` and kills every surviving giant. **Survivors score 0.** If nobody died at all, the result is Draw.
  - Ties are only possible for same-instant deaths.
- **Arena:** `Sleepy_Time` (9728,-256)-(11008,1024) is 1280×1280 u (10×10 tiles), centred on (10368,384). Camera bounds are this rect. Time of day is set to **0:00** (midnight; the clock is frozen by Next Event).
  - Enclosed octagon strewn with 61 non-blocking shrubs.
  - Giants are created neutral-passive 512 u from the centre at angle playerId·135° − 22.5°, facing the centre, and handed out randomly.
  - 10 golems start within 200 u of the centre.
- **Player unit:** `emtg` Mountain Giant.
  - Speed 270, **HP 1600**, **no regeneration** (the map sets regen type to none; the base would regen at night).
  - Armor 4, **medium** armor type, collision 48, **no attack** (map).
  - Ability `Atau` Taunt (base 1.26): area **450**, cooldown **15 s**, 0 mana. It forces nearby enemies to attack you.
  - No items.
- **"Hazard" (actually your tool):** 10 × `ngst` Rock Golem, Player(11).
  - Speed 270, HP 675, armor 4. Melee 29-33, cooldown 1.35, range 100.
  - **Acquisition 100** (map). Abilities: Spell Immunity and Wander (map; Hurl Boulder removed).
  - They wander around and only attack a giant that comes within 100 u, or one that taunts them.
  - Derived damage: normal vs medium is 150%, then ×0.806 for armor 4, giving 35-40 per hit, or about **27.8 DPS per golem**.
  - A giant dies in about **5.8 s** with all 10 golems on it, about 11.5 s with 5, about 58 s with 1. Damage persists because there is no regen.
  - There is no spawning.
- **Timeline:**
  - t=0: music TragicConfrontation, KeepWinners, ante 8, midnight; giants and golems created; timer 120 s; text shown; Sleepy Finish and Sleepy Expire on. Taunt is usable immediately.
  - t=4 s: AI on.
  - End: when all giants are dead, or at 120 s.
- **How you lose / win / finish:** to score you must die, and the sooner the better. Anyone still alive at 120 s scores 0.
- **Computer-player AI:** every 1 s, each computer unit is ordered to move toward a random golem (a follow order, re-picked each second, so it jitters). Then with a 1-in-6 chance it casts `taunt`, which is a no-op while on cooldown.
- **Designer notes:** it goes against every instinct. Taunt at the right moments, when rivals cannot immediately steal the golems back.
- **Remake notes:**
  - Inverted objective: the first death scores most (8/7/6…); surviving the 120 s timer scores 0.
  - You cannot hurt yourself directly. The only lever is a 450 u taunt on a 15 s cooldown that drags nearby neutral golems onto you.
  - Rivals can steal your golems by taunting within 450 u of them. The 15 s cooldown creates the timing game.
  - 1600 HP with no regen, so chip damage accumulates. About 28 DPS per golem, 10 golems. Golems otherwise wander slowly and only aggro inside 100 u.
  - Unique among our games: no existing Hammerguy's Party game uses a "reverse" goal.
  - Oddity: golems are given Spell Immunity (map), yet the design depends on Taunt pulling them. In WC3, Taunt is not blocked by spell immunity. I did not verify this in-engine, but the game would not work otherwise.

---

### Nature's Circle (bundle: Nature, event #30)

- **Goal (in-game text):** "Nature's Circle / Counter and kill your opponents!"
- **Type & scoring:** Survival (last one standing) using `Survival Death`.
  - **Time limit 120 s.** On expiry `Survival Expire` gives every surviving player the same current ante (a tie), kills them, and the result is Draw.
  - `TiesPossible` is false.
- **Arena:** `Nature_Circle` (9728,1536)-(11008,2816) is 1280×1280 u (10×10 tiles), centred on (10368,2176). Camera bounds are this rect. Midnight.
  - Enclosed octagon with 4 trees (Summer Tree Wall, 128×128 blockers) at centre ±384 u on the N/S/E/W axes.
  - Druids are created neutral-passive 512 u from the centre at angle playerId·135° − 22.5°, facing the centre, and handed out randomly.
- **Player unit:** `edoc` "Druid of the Wilds".
  - Speed 270, HP 250, armor 1 (heavy), **no attack** (map).
  - Mana max 100 (map) and starts at 100 (base initial mana).
  - Three form spells, each costing **100 mana**:
    - `A003` Bear Form, hotkey B, order `berserk`
    - `A004` Hawk Form, hotkey W, order `divineshield`
    - `A005` Quillbeast Form, hotkey Q, order `stomp`
  - On `SPELL_CAST`, the caster is **replaced** by the form unit (ReplaceUnit, *relative* method, so the **HP percentage carries over**). The new unit swaps into KeyUnits, is auto-selected, has its **mana set to 0**, and gets acquisition 100 if human-controlled.
  - Each form has the **other two** form spells, max mana 100 and **mana regen 15/s**, so the next transform is ready in **6.7 s**.
  - Because each transform creates a new unit, the listed ability cooldowns (30/60/6 s) never actually apply.
  - You can never revert to the druid.

  | Form | Speed | HP | Armor | Attack | Can hit air |
  |---|---|---|---|---|---|
  | `ngz1` Bear | 320 | 300 | heavy 0 | melee normal 19-21, cd 1.5, range 128 | **No** |
  | `nqb1` Quilbeast | 300 | 200 | medium 0 | ranged pierce 13-15, cd 1.5, range 550 | Yes |
  | `nwe2` Hawk | 350 | 150 | light 3 | ranged magic 21-25, cd 1.5, range 300; splash full damage within 25 u only | Yes |

  - The Hawk is targeted as air and moves as **hover** at height 240 (map changed it from flying), so it cannot cross walls.
- **Counter triangle,** derived from the damage table:

  | Matchup | Damage per hit | Hits to kill | Other side |
  |---|---|---|---|
  | Bear → Quill | 28.5-31.5 | 7 | Quill → Bear: 13-15, 21-22 hits |
  | Quill → Hawk | 22-25 | 7 | Hawk → Quill: 16-19, 12 hits; Quill also outranges it (550 vs 300) |
  | Hawk → Bear | 42-50 | 7 | **Bear cannot retaliate at all** |

  - An untransformed druid is heavy-armored and harmless. A Hawk kills it in 6 hits.
- **Hazards:** none. Players are the only threat.
- **Timeline:**
  - t=0: music NightElfX1, midnight; druids created; timer 120 s; text shown; Survival Death, Survival Expire and the three form triggers on.
  - t=3 s: the script orders one random computer-owned unit to `berserk` (Bear), one to `stomp` (Quill) and one to `divineshield` (Hawk). This seeds the bots' forms.
  - Then `Nature AI` turns on if there are computers.
  - End: when one player remains, or at 120 s.
- **How you lose / win / finish:** you are out when your current form dies. The last player alive wins 8; survivors at 120 s all tie.
- **Computer-player AI:** every 1.5 s, for each computer unit:
  1. If any Quilbeast is within 600 u, cast Bear.
  2. If any Hawk is within 400 u, cast Quill.
  3. If any Bear is within 300 u, cast Hawk.
  4. With a 1-in-5 chance, move to a random point in the circle.

  Attacking is left to normal auto-acquire (the default 500/600 range for bots).
- **Designer notes:** Rock/Paper/Scissors. Bears beat Quillbeasts, Quillbeasts beat Hawks, Hawks beat Bears. Counter your opponents' forms.
- **Remake notes:**
  - Three forms with a strict counter triangle, as numbers above: each winner kills its prey in about 7 hits (about 10 s).
    - A Bear loses about 1/3 of its HP to a Quill in that time.
    - A Quill would lose about 60% to a Hawk in a slugfest, but its 550 range against 300 buys free shots.
    - A Hawk loses nothing to a Bear, which literally cannot target it.
  - Morphing costs all your mana; 15 mana/s means one morph every 6.7 s. HP% is preserved across morphs, and there is no way back to the druid.
  - Distinct stat identities: fast, fragile, flying Hawk (350/150 HP); long-range Quill (550); tanky melee Bear (300 HP).
  - The 120 s timer ends in a tie for all survivors.
  - Nothing in our current list is close. It is an RPS brawl, perhaps "King of the Hill"-adjacent in feel.
  - **Bug in the bot:** each "is a counter nearby" check uses `GetUnitsInRangeOfLocMatching` around the bot's own position without excluding itself. So a bot Quill always sees a Quill (itself) and turns Bear, a bot Bear always sees a Bear and turns Hawk, and a bot Hawk always sees a Hawk and turns Quill. Bots therefore cycle Quill→Bear→Hawk→Quill every time their mana refills (about 6.7 s) instead of countering. Do not copy this.

---

### The Skull of Gul'dan (bundle: Skull, event #31)

- **Goal (in-game text):** "The Skull of Gul'dan / Obtain the skull of Gul'dan, and escape!"
- **Type & scoring:** Race, but **winner-take-all**.
  - Ante is set to 8.
  - When a key unit carrying the Skull (`glsk`) enters `Skull_Finish`, `Skull Finish` first **removes every key unit from the group**, then runs `Race Finish`. The carrier's owner gets **8** and everyone else gets **0**, because the group is now empty and the game Finishes.
  - **Time limit 240 s.** On expiry `Race Expire` kills all heroes; nobody scores, and the result is Draw.
  - Dead heroes are removed (`Dissipate` on, so no revive) and score 0 (`Race Death`). If every hero dies, the result is Draw.
- **Arena:** `Skull` (7680,0)-(9216,3072) is 1536×3072 u (12×24 tiles). Camera bounds are this rect; the camera starts at the finish.
  - All destructables in the rect are restored at start: gate closed, egg sacks, switches. All items in the rect are removed.
  - Layout at 128 u per character:

```
 2944 #####..#####
 2816 ####....####
 2688 #.#...B..###     B  boss spawns at centre+(0,1216) = (8448,2752), on a Shimmering Portal (destroyed when the boss appears)
 2560 ..#......###
 2432 #.##....####
 2304 #####..#####
 2176 .L###..###.R     L/R  foot switches (7808,2176) and (9088,2176) = Skull_Button_Left/Right (128x128)
 2048 ..###.G##...     G  Iron Gate (8448,2112); the map makes it "targeted as structure", so heroes cannot attack it
 1920 ..b##..##.v.     b  Skull_Guard_Left: 2 Bloodfiends     v  Skull_Guard_Right: Vile Tormentor + 2 Succubi
 1792 #...........
 1664 #..........#
 1536 ##........##
 1408 #####..#####
 1280 #####..#####
 1152 ##......####
 1024 #.........d.     d  Sludge Monstrosity at centre+(512,-512) = (8960,1024)
  896 e.s........#     s  Skull_Spider: Giant Spider + 2 Spiders    e  5 Egg Sacks (7712-7840, 800-928)
  768 ee.##..##..#
  640 #####..#####
  512 #.###..####.
  384 ####....####
  256 #.#......###
  128 ..$...F....#     F  Skull_Finish (8384,64)-(8512,192), Circle of Power    $  Goblin Merchant (7936,128)
    0 #..........#
```

  - Heroes are created directly for each player at (8448 ± random 256, 128), facing north.
  - The straight-line distance from the finish to the boss spawn is 2624 u.
- **Player unit:** `Edem` Demon Hunter hero, speed 320, collision 31 (map).
  - Set to **level 3**, XP gain on. Learns Mana Burn L1, Immolation L1 and Evasion L1. Carries one **Potion of Healing**.
  - Derived level-3 stats: STR 23.8 → **≈675 HP**; AGI 25 → armor ≈5.5 and damage ≈27-49 (hero attack type, cooldown 1.7); INT 20 → ≈300 mana. Acquisition 100 (map).
  - The map changed targets to debris/ground/item/ward: heroes **can attack egg sacks** but **not the gate**.
  - Abilities (1.26 L1 values):
    - Mana Burn: 50 mana burned, 300 range, cooldown 7, 50 mana.
    - Immolation: 10 damage/s in 160 u, 25 mana to activate plus 7/s.
    - Evasion: 10%.
  - Metamorphosis becomes learnable if a hero reaches level 6.
  - At start all players are **allied with shared vision** (co-op phase).
- **Economy:** Neutral Aggressive is set to **give bounty**, and gold starts at 0. The Goblin Merchant sells:
  - Potion of Healing: map price 20 g, +250 HP, 20 s cooldown.
  - Potion of Mana: 10 g, +150 mana.
  - The map sets stock replenish to 10 s with no start delay.
- **Enemies:** all Neutral Aggressive, acquisition set to 200.
  - **Every enemy's HP is scaled by the player count:** after a 0 s wait, the NA handicap is raised by +20 percentage points per Demon Hunter, from 100% to 100 + 20·N %. For example, 4 players gives 180% and 8 players gives 260%.
  - Regular creeps:

    | Unit | Location | HP (before scaling) | Armor | Attack | Abilities |
    |---|---|---|---|---|---|
    | Bloodfiend ×2 | left guard | 450 | 1 | chaos 23-26 | Cleave 25% |
    | Vile Tormentor | right guard | 510 | 0 | ranged pierce 31-37, range 500 | Silence |
    | Succubus ×2 | right guard | 400 | 0 | 15-17 | |
    | Giant Spider | spider room | 550 | 1 | 18-21 | Venom, Ensnare |
    | Spider ×2 | spider room | 200 | 0 | 10-11 | acquisition 275 |
    | Sludge Monstrosity | right side of middle hall | 600 | 1 | 24-27 | Slow, cast range 200 (map) |

  - **Hidden treasures:**
    - The Sludge always drops a **Potion of Speed** (+60% move speed, 45 s per SLK).
    - One of the 5 Egg Sacks (15 HP), chosen at random, drops a **Potion of Lesser Invulnerability** (7 s).
    - Each of the other egg sacks has a **1-in-3** chance to release a Spider.
  - **Buttons:** a unit of player 1-8 stepping onto `Skull_Button_Left` or `Skull_Button_Right` "presses" it (kills the switch destructable, plays a door sound). When **both** are pressed, `Skull Boss` runs:
    - AI Initial is disabled and AI Boss enabled.
    - The Iron Gate opens and the Shimmering Portal is destroyed.
    - A **boss** spawns at (8448,2752): 50/50 **Pit Lord** or **Dreadlord**.
      - Level 10. Holds the Skull; the Skull has the map flag "dropped when carrier dies".
      - Pit Lord abilities: Rain of Fire L3, Howl of Terror L3 (−50% damage, 500 u, 15 s), Cleaving Attack L3 (80%, 200 u).
      - Dreadlord abilities: Carrion Swarm L3 (200 per unit, 1000 max, 700 range), Sleep L3 (heroes 15 s), Vampiric Aura L3 (45%).
      - Ultimates were removed by the map.
      - Derived base HP: Pit Lord ≈1450 (STR 54.8), Dreadlord ≈1150 (STR 42.5), both multiplied by the handicap. The map raised both INT gains, to 6.0 and 9.0 per level.
    - **10 s later the boss's acquisition becomes 5000**, so it hunts across the whole cave.
  - **Boss death** (`Skull Boss Death`: any NA hero dying):
    - White flash and camera shake.
    - **All players become enemies** (unallied, vision kept).
    - Two escorts spawn at the two button spots, attack-move to the boss's death point with acquisition 2000:
      - If the boss was the Pit Lord: 2 **Doom Guards** (1350 HP, armor 3, chaos 41-48, Cripple, War Stomp 250 u, Rain of Fire).
      - If it was the Dreadlord: 2 **Infernals** (1500 HP, armor 6, chaos 49-60, Immolation 10/s in 220 u).
    - Both escorts are scaled by the handicap.
  - The Skull carrier gets a "!" (TalkToMe) marker overhead. Any item drop by anyone removes the marker; see Oddities.
- **Timeline:**
  - t=0: music NightElfX1; ante 8; bounty on; allied vision; heroes, creeps, merchant and circle created; destructables restored, items cleared, egg sack picked; timer 240 s.
  - Then the handicap is raised.
  - t=4 s: computer heroes attack-move to a random button, repeated every 10 s.
  - Both buttons pressed: gate opens and the boss appears; 10 s later it aggroes map-wide.
  - Boss dies: free-for-all phase and escorts spawn.
  - The skull is delivered to the finish, or the timer expires at 240 s.
- **How you lose / win / finish:** only the player who carries the Skull into the finish circle scores (8). A carrier who dies drops it for others.
- **Computer-player AI:**
  - Initial phase: every 10 s, attack-move to the centre of a randomly chosen button.
  - Boss phase, every 2 s:
    - If the Skull is unowned (on the ground), move to it. Otherwise attack whichever unit in the cave holds it: the boss, or a rival.
    - If within 72 u of an unowned Skull, it is **given directly** to the bot (UnitAddItem).
    - If the bot holds the Skull, move to the finish.
- **Designer notes:** the largest and most complex minigame. Enemy strength scales with player count, so team up. There are hidden treasures among the creatures, and a shop outside the entrance.
- **Remake notes:**
  - Two-phase structure: **co-op dungeon** (allied, scaled creeps, two guarded pressure plates that must *both* be stepped on to open the boss gate), then **betrayal race** (boss drops the skull, everyone turns hostile, two big demons spawn behind you). The carrier must walk the skull about 2600 u back to the entrance.
  - Winner-take-all 8 points. A 240 s timer where expiry means everyone gets 0.
  - Enemy HP ×(1 + 0.2·players). The boss, randomly Pit Lord or Dreadlord, becomes map-aggro 10 s after appearing.
  - Light economy (kill bounty buys 20 g heals) and two hidden power-ups (invulnerability egg sack, speed potion from the Sludge). Heroes with a small kit (mana burn, immolation aura, evasion) that keep leveling.
  - Nothing like it exists in Hammerguy's Party yet. Consider a simplified version.
  - Oddities:
    - `Skull Lose` destroys the carrier marker on **any** unit's item drop (for example a hero dropping a potion), not just the Skull.
    - The Skull is only ever marked on pickup.
    - The "Skull Obtain" condition compares against `udg_Item_Special`, which is only set when the boss spawns.

---

### Minotaur Maze (bundle: Minotaur, event #32)

- **Goal (in-game text):** "Minotaur Maze / Claim the Shimmerweed!"
- **Type & scoring:** Race. Ante is set to 8.
  - Each Shimmerweed pickup finishes the picker: 1st pickup 8, 2nd 7, and so on.
  - **Time limit 180 s.** On expiry `Race Expire` kills all remaining skinks, which score 0.
  - Being killed scores 0 (`Race Death`).
  - Only one weed exists at a time, so there are no ties.
- **Arena:** `Minotaur_Maze` (7680,3968)-(9088,5376) is 1408×1408 u (11×11 tiles), centred on (8384,4672). Camera bounds are this rect.
  - The maze is built from 299 "Short Wall End" doodads (64×64 blockers) on a **64 u grid**. Corridors and walls are both 64 u wide, and the designer notes there are **no dead ends**.
  - Skinks are created directly for each player within 8 u of the centre (S).
  - The minotaurs start in the four corners (M), at centre ±672.
  - Map below: 1 character = 64 u, top row is y 5376, left column is x 7616; the outer ring is the boundary wall.

```
########################
#M..#.................M#
#.#.#.######.#########.#
#.#...#............#...#
#.#####.########.#.#.###
#.#.....#........#.#...#
#.#.#####.########.#.#.#
#.#.....#.#........#.#.#
#.###.#.#.#.##.#####.#.#
#.....#...#..#.......#.#
###.###.####.#####.#.#.#
#.....#.#...S#...#.#.#.#
#.#.#.#...#....#...#...#
#.#.#.###.#.########.###
#.#.#.#...#..#.........#
#.#.#.#.####.#.#######.#
#.#.#...#......#.....#.#
#.#.#.#.#.######.###.#.#
#.#...#.#..........#...#
#.#####.##########.#.###
#.#.....#..........#...#
#.#.#.###.#.##########.#
#M..#.....#...........M#
########################
```

- **Player unit:** `nskk` Skink.
  - Speed **200**, HP 15, collision 15 (map), **no attack**.
  - Inventory added by the map, used only to pick up the weed. Shimmerweed is made a non-powerup, non-droppable inventory item.
- **Hazards:** 4 × `otau` "Tiny Tauren" (the minotaurs), Player(11).
  - Speed **270**, faster than you. HP 1300, armor 3.
  - Melee 30-36, cooldown 1.9; one hit kills. **Range 64, acquisition 64** (map), collision 16, model scale 0.55.
  - `Minotaur Patrol`: runs once at t=4 s, then every 10 s. Each minotaur gets a `patrol` order to a **random point in the maze rect**, and it attacks any skink that comes within 64 u along the way.
  - No spawning and no ramp-up.
- **Shimmerweed:**
  - The first weed appears at t=4 s at centre + 640 u at a random angle, which is near the outer ring.
  - On any pickup (`Minotaur Obtain`):
    1. A pickup effect plays.
    2. A **new weed is created at a random point anywhere in the rect.** Wall cells are not excluded, so where it ends up is engine-dependent.
    3. All of the picker's items are removed.
    4. The picker finishes (`Race Finish`, removed with the teleport effect).
  - The change log's "winning now requires only 1 piece" is confirmed: a single pickup finishes you.
- **Timeline:**
  - t=0: music PursuitTheme, ante 8; skinks at the centre; minotaurs in the corners; timer 180 s; text shown; Race Death, Race Expire and Minotaur Obtain on. Minotaurs stand idle.
  - t=4 s: weed 1 appears, patrols start (then every 10 s), AI on.
  - Every pickup spawns the next weed.
  - End: when all skinks have finished or died, or at 180 s.
- **How you lose / win / finish:** grab a Shimmerweed to finish (earlier is better). Touching range of a minotaur means death.
- **Computer-player AI:** every 1 s, for each computer unit:
  - If no Player(11) unit is within 400 u, move to the current weed (the last created item).
  - Otherwise, move 256 u directly away from a random minotaur within 400 u.
  - If within 64 u of the weed and it is unowned, the weed is **given directly** to the bot (UnitAddItem), which fires the finish.
- **Designer notes:** the minotaurs are faster than you, so keep your distance and keep watching; the maze deliberately has no dead ends.
- **Remake notes:**
  - Everyone starts together at the centre of a 22×22-cell maze (64 u cells) with no dead ends.
  - A single pickup target is on the field at a time. Each grab finishes one player (8/7/6…) and spawns the next weed at a random spot, so later finishers chase a relocating target.
  - Four hunters, faster than you (270 against 200), roam by picking a random destination every 10 s. They kill only on contact (64 u) because their aggro range is tiny, so hunter movement is predictable.
  - 180 s timer; zero for anyone left.
  - Similar to **Gold Rush** (grab items) crossed with Golem Gauntlet's patrolling threats.
  - Oddities:
    - The respawned weed can be generated inside a wall cell.
    - The first weed ring (radius 640) sits close to the minotaurs' corner starts.


## Uther Party 4.0: rule sheets, batch g5

Sources: `up40/bundles/<Prefix>.txt` (trigger JASS, regions, object data), framework triggers in `up40/j.txt` (Race/Survival/Win/Draw/Next Event), and the WC3 1.26 base SLKs (read through `scratchpad/lookup_g2.py`) for fields the bundles did not carry: stasis-trap data names, hero attributes, armor types, the Aihn inventory override, and gameplay constants. Units: 128 u = 1 tile. Times are game seconds.

**Shared facts for this batch**
- **Race games** (Quillboar, Unseen, Pork, Troubled, Sheep, Doggy) set ante = 8, so finishers score 8, 7, 6... in order. When `udg_Timer_TimeLeft` expires, Race Expire kills every key unit still in play, and those players score 0. If the last key unit dies and nobody has finished, the result is a Draw with no points. Ties can't happen.
- **Survival games** (Destruction, Plague, Ancient): the ante starts at 9 - N. Each death scores the current ante and then raises it by 1, and the last survivor scores 8. None of these games sets `TiesPossible`.
- None of these games pauses players except Destruction, so players can move as soon as Next Event's 1 s fade-in ends.
- Damage figures below apply the 1.26 attack/armor table from `MiscGame.txt`: pierce vs medium 0.75, normal vs medium 1.5, siege vs medium 0.5, hero vs hero 1.0. Armor reduction is 6% per point, diminishing. WC3 measures attack range between collision edges, so reach (centre to centre) = range + both collision radii.
- Gameplay constants from `war3mapMisc.txt`: GuardDistance and MaxGuardDistance = 10000, so creeps that acquire a target never give up the chase. MinUnitSpeed = 0. MaxUnitSpeed stays at the default 400.

---

### Quillboar Mile (bundle: Quillboar, event #33)
- **Goal (in-game text):** "Quillboar Mile / Reach the end!"
- **Type & scoring:** Race. Ante 8. Timer 60 s. On expiry, every pig still running is killed and scores 0. If all pigs die before anyone finishes, it's a Draw.
- **Arena:** `Quillboar_Mile` is 1024×2048 u (8×16 tiles), centre (10496,4352), running north. Camera bounds are this rect, and the camera starts at centre - (0,896).
  - **Start:** each pig is created for its own player at a random point in a 128×64 box centred on (10496,3392), which is 32 u above the south edge, facing north.
  - **Finish:** `Quillboar_Finish`, a 128×128 box at (10496,5248), marked by an invulnerable Circle of Power.
  - **Hunter strips:** `Quillboar_Left_Side` (x 10048–10240) and `Quillboar_Right_Side` (x 10752–10944), both spanning y 3840–4992 (192×1152 u). They leave a 512 u (4-tile) corridor between them.
  - Straight start-to-finish distance is about 1856 u.
- **Player unit:** `npig` "Piggy".
  - Speed 190 (map; base 100), HP 10 (map; base 15), collision 15, medium armor 0, no attack.
  - The script removes its Wander ability (`Awan`) so it doesn't move on its own. No items.
- **Hazards / opponents:** 6 `nqbh` Quillboar Hunters owned by Player 12. 3 spawn at random points in the left strip facing east, and 3 in the right strip facing west. The positions are re-rolled every game.
  - Stats: speed 0 (map, so they're immobile turrets), HP 375, collision 31 (map).
  - Weapon: pierce 21–25 (20+1d5), cooldown 1.6 s, damage point 0.6 s, range 400 (map; base 500), acquisition 400 (map).
  - Projectile: speed 400 (map; base 1500). The weapon type was changed to **missile (splash)** with no splash radii set.
  - One quill kills: 21–25 × 0.75 = 15.8–18.8 against the pig's 10 HP.
  - Reach is 400+31+15 ≈ 446 u, so every hunter covers the full corridor width. The hunters simply auto-fire at any pig in reach. There are no spawns and no ramp-up.
- **Dodging:** no script logic handles it. The designer says quills "follow your path" and can be thrown off by changing course. The data change behind this is msplash with zero area plus a slow projectile, the same setup Way of the Bow uses for its archers (`earc` is also msplash with no splash radii). The archer test in engine.md shows msplash aims at the target's predicted position at release and does not home, so a change of course after release dodges.
- **Timeline:**
  - t0: OrcVictory music, ante 8, pigs, hunters and circle created, camera set, 60 s timer and "Time Left" dialog, message shown. Race Death, Race Expire and Quillboar Finish are enabled, and the hunters are live immediately.
  - t4: computer pigs are ordered to move to the finish.
  - t5: Quillboar AI is enabled.
  - t60: expiry.
- **How you lose / win / finish:** a pig killed by a quill is out (Race Death). A key unit entering `Quillboar_Finish` triggers Race Finish: it scores the ante and is removed with a teleport effect. The game ends when no pigs are left, as Finish if anyone finished and Draw otherwise.
- **Computer-player AI:** every 1 s, each computer pig moves 100 u at a random angle between 0° and 180° (a sideways or forward jink, never backwards). After 0.2 s it is re-ordered to the finish centre, so each jink is only about 38 u of drift. The AI never considers the quills.
- **Designer notes:** Run home through the hunters. Keep changing course or the quills will follow your path ("Archer Training").
- **Remake notes:**
  1. An 8×16-tile vertical dash of about 10 s at 190 u/s past 6 fixed turrets, 3 per side at random heights.
  2. Turret numbers: 1.6 s cooldown, 0.6 s wind-up, a slow 400 u/s quill, one-hit kill, about 446 u reach.
  3. Quills must be dodgeable by turning. Implement them as projectiles aimed at the pig's position (or led position) at fire time with a tiny hit radius, not as perfect homing.
  4. 60 s limit, race scoring 8/7/6...
  - Closest existing game: Golem Gauntlet (race), with a turret-dodge layer.
  - Oddity: the bot's random jink is its only dodge logic.

### The Unseen (bundle: Unseen, event #34)
- **Goal (in-game text):** "The Unseen / Evade hidden enemies and reach the end!"
- **Type & scoring:** Race. Ante 8. Timer 90 s. On expiry, Witch Doctors still in play are killed and score 0. Draw if nobody finishes.
- **Arena:** `Unseen` is 2304×768 u (18×6 tiles), centre (8448,6528). Camera bounds are this rect, and the camera starts at (7424,6528). Time of day is fixed at 0:00 (night; the clock stays off).
  - **Start:** each Witch Doctor is created for its own player at a random point in a 256×512 box centred on (7424,6528), covering x 7296–7552, facing east.
  - **Guard zone:** `Unseen_Center`, x 7744–9152 (1408×768 u, 11×6 tiles).
  - **Finish:** `Unseen_Finish`, a 128×128 box at (9472,6528) with a Circle of Power.
  - Start-to-finish is 2048 u, about 7.6 s at 270.
- **Player unit:** `odoc` Witch Doctor.
  - Speed 270, **HP 5** (map), collision 16, unarmored, **no weapon** (map).
  - Mana 200, starting full (map `umpi` = 200), with **0 regen** (map).
  - **Sentry Ward** (`Aeye`): 50 mana, cast range 500. The ward lasts **10 s** (map; base 600). The ward unit `oeye` has 200 HP, sight 500 (map; base 1600) and Detector `Adt1` range 500 (map; base 1100), so it reveals invisible units within 500.
  - **Stasis Trap** (`Asta`): 100 mana, cast range 500.
    - Activation delay 5 s (map; base 10). Field names come from AbilityMetaData: Sta1 = Activation Delay.
    - Detection radius 250 and detonation radius 400.
    - Stun duration 6 s (Sta4, base value).
    - Dur 150, which is presumably the trap's lifetime.
  - Mana budget: 4 wards, or 2 traps, or 1 trap and 2 wards.
- **Hazards / opponents:** 20 `ndrf` Draenei Guardians owned by Player 12. They spawn at random points in `Unseen_Center` with random facing and are ordered to `holdposition`, so they never move.
  - They have **Permanent Invisibility** (`Apiv`, map-added) and can only be seen inside a sentry ward's detection.
  - Stats: HP 240, large armor 1. Attack: normal 10–11, cooldown 1.35 s, damage point 0.33 s, range 100, acquisition 100 (map).
  - Reach is about 132 u centre to centre. Any hit kills a Witch Doctor.
  - Density: 20 discs of radius 132 (about 1.09 M u²) over a 1.08 M u² zone, so roughly 64% of the zone is covered (random-placement estimate).
  - Guards also attack wards or traps within reach, since their targets include wards.
- **Timeline:**
  - t0: Tension music, ante 8, time of day 0:00. Witch Doctors, 20 held guards and the circle are created. Camera set, 90 s timer and dialog, message shown. Race Death, Race Expire and Unseen Finish are enabled.
  - t4: Unseen AI is enabled.
  - t90: expiry.
- **How you lose / win / finish:** one guard hit kills you (Race Death). Entering `Unseen_Finish` triggers Race Finish.
- **Computer-player AI:** every 0.5 s, for each computer Witch Doctor:
  - If any Player-12 unit is within 200, it moves 256 u directly away from a random one of them. The script reads the invisible guards' positions, so the bot effectively sees them.
  - Otherwise it moves toward the finish.
  - Then, with a 1-in-16 chance per tick, it casts a Sentry Ward 256 u ahead toward the finish, ±45°.
  - It never uses Stasis Trap.
- **Designer notes:** Invisible blades guard the path. Wards are cheap but short-lived; stasis traps cost more but are stronger. Don't plant traps where guards can smash them.
- **Remake notes:**
  1. About 20 invisible, stationary, one-hit guards with a ~130 u reach, laid out randomly in an 11×6-tile band.
  2. Reveal tool: 50 mana, reveals a 500 radius for 10 s. Stun tool: 100 mana, arms after 5 s, trips at 250, stuns every guard within 400 for 6 s.
  3. 200 mana with no regen; the Witch Doctor has 5 HP and 270 speed.
  4. Night lighting, 90 s limit.
  - Closest existing game: Golem Gauntlet (race through hazards), but here the hazards are hidden.
  - **Discrepancy:** the quest log says wards last 5 s, but the object data says 10 s.

### Destruction's Dance (bundle: Destruction, event #35)
- **Goal (in-game text):** "Destruction's Dance / Use speed and finesse to kill your opponents!"
- **Type & scoring:** Survival free-for-all (Survival Death and Survival Expire). Timer **120 s**; it starts counting during the 5 s opening pause. On expiry, every survivor scores the current ante, all heroes are killed, and the result is a Draw. No ties flag.
- **Arena:** `Destruction_Dance` is 1024×1024 u (8×8 tiles), centre (10496,6400). Camera bounds are this rect.
  - Heroes are pre-created as **neutral passive** 400 u from the centre, at angle (slot × 135° - 22.5°) for each playing slot. That gives 8 spots 45° apart, facing the centre.
  - Next Event hands the heroes out at random, so your spot is random.
- **Player unit:** `Obla` Blademaster hero.
  - XP gain is disabled: `SuspendHeroXPBJ(false)` means "disable experience gain".
  - Speed 320, collision 32.
  - **HP 250**: base 25 (map; base 100) + STR 9 (map; base 18) × 25.
  - **Armor 5.2**: -2 + AGI 24 × 0.3, about 24% reduction.
  - **Attack:** hero-type 26–48 (2d12 + 24 AGI). Cooldown **3.0 s** (map; base 1.77) ÷ 1.48 from AGI, so about **2.03 s**. Damage point 0.33 s, range 100 (164 u reach), acquisition 100 (map).
  - Net damage per hit is about 20–37, average about 28, so it takes roughly **9 hits** to kill. Regen is about 0.7 HP/s.
  - Mana is 240 (INT 16 × 15), regenerating about 0.8/s.
  - The map removes all Blademaster hero skills. The only ability is `A000` **Blink**, used at level 1: max range 400, min 0, **cooldown 0**, **2 mana**, cast point 0 (map).
- **Order rewriting (the core mechanic):**
  - *Destruction Move:* every point order other than `blink` (right-click on ground, move, attack-move, patrol) is re-issued as `blink` to that point. **Heroes never walk.** Each click teleports up to 400 u toward the click.
  - *Destruction Attack:* every unit-target order other than `attack` (for example, right-clicking an enemy) becomes `blink` to 32 u from the target on your side, followed immediately by `attack` on the target.
  - Explicit A-click `attack` orders are left alone, so the hero walks up and swings normally.
  - Caveat: the blink and the attack are issued back to back. The map sets cast point to 0, presumably so the blink resolves first. The quest advice ("blink in, strike, blink out") implies it works.
- **Hazards / opponents:** only the other players.
- **Timeline:**
  - t0: OrcTheme music, heroes created, **all units paused**, camera set, 120 s timer, message shown. Dissipate (removes dead heroes), Survival Death, Survival Expire, Move and Attack are enabled. After a 0 s wait, computer heroes get acquisition 2000.
  - t5: units unpaused.
  - t120: expiry.
- **How you lose / win / finish:** your hero reaching 0 HP knocks you out and scores the ante. The last hero standing wins with 8.
- **Computer-player AI:** there is no AI trigger. Bots only get acquisition 2000, so they auto-attack the nearest hero. Auto-acquired attacks don't raise issued-order events, so bots presumably walk and melee rather than blink. That's an engine detail and isn't verified.
- **Designer notes:** Blink costs almost nothing and has no cooldown. Blink in, strike, and blink out before the target can retaliate.
- **Remake notes:**
  1. Movement is teleport-only: each click blinks up to 400 u, with no cooldown, 2 mana, and a 240-mana pool.
  2. Clicking an enemy blinks you adjacent and starts a swing.
  3. Swings are slow and heavy: one every ~2 s, ~28 average damage against 250 HP, which encourages hit-and-run.
  4. 8×8-tile arena, 120 s, and survivors tie on timeout.
  - No existing Hammerguy's Party game matches this. It is closest to Ice Sumo or King of the Hill in being an arena brawl.

### Pork the Piggy (bundle: Pork, event #36)
- **Goal (in-game text):** "Pork the Piggy / Be the first to skewer the piggy!"
- **Type & scoring:** a race scored by kills. Each pig kill runs Race Finish for the killer: they score the ante (8, then 7...) and their hunter is removed. Timer 90 s. On expiry, remaining hunters are killed and score 0. Draw if nobody kills a pig. Each player can score at most once.
- **Arena:** `Pork_the_Piggy` is 1024×1024 u (8×8 tiles), centre (-4352,-5632). Camera bounds are this rect.
  - Hunters are pre-created as **neutral passive** in a row at y = centre - 448, which is 64 u from the south edge. x = centre + (-576 + 128 × slot) for each playing slot, so they stand 128 u apart, facing north.
  - Next Event hands them out at random.
- **Player unit:** `ohun` "Troll Hunter" (Headhunter).
  - **Invulnerable** (Avul, map), collision 48 (map).
  - Weapon: **artillery** (map; base missile), pierce 23–27, cooldown **2.31 s**, damage point 0.31 s, range **20000** (map), full-damage splash radius **10** (map).
  - The trigger sets acquisition to 100 for humans and 2000 for computers.
  - One spear kills a pig: 23–27 × 0.75 = 17–20 against 15 HP.
  - Projectile speed is the Headhunter default, which isn't in the extracted data.
  - *Pork Ground Target:* **every point order is replaced by `attackground`** at that point. Hunters never move, and right-clicking the ground throws a spear there. The attack-ground order keeps throwing at that point every 2.31 s.
  - *Pork Unit Target:* **every unit-target order becomes `attackground`** at the target's current position. You can't lock onto the pig, so you have to lead it.
- **Hazards / opponents (the target):** `nfbr` "Barbeque Piggy", owned by Player 12.
  - Speed **100**, HP 15, collision 16, no attack.
  - It spawns within 128 of the centre and moves 400 u in a random direction.
  - *Pork Patrol*, every 4 s: picks a random point in the arena. If that point is less than 400 from the pig, it goes 400 u toward the arena centre instead. The pig is effectively always moving at 100 u/s and changes direction every 4 s or less.
  - *Pork Kill:* the killer must be a key unit. Race Finish runs, then after 2 s a new pig appears within 256 of the centre with a blink effect and moves 400 u in a random direction.
- **Timeline:**
  - t0: Orc2 music, ante 8, hunters, first pig, camera, 90 s timer, message. Race Death and Race Expire are enabled, along with Patrol, Ground Target, Unit Target and Kill.
  - After a 0 s wait, computer hunters get acquisition 2000.
  - t90: expiry.
- **How you lose / win / finish:** land the killing spear to score and leave. When everyone has scored, the game ends with Finish.
- **Computer-player AI:** there is no AI trigger. Bots use acquisition 2000 and auto-attack the pig directly, which bypasses the order rewrite, every 2.31 s. Artillery aims at a ground point, so bots can miss a moving pig too.
- **Designer notes:** You can't target the pig directly; the spear lands exactly where you click, so anticipate its path.
- **Remake notes:**
  1. Stationary throwers in a row; a click lobs a spear to a ground point, with a ~10 u hit radius plus the pig's body.
  2. The pig moves at 100 u/s, re-plans every 4 s, and each leg is at least 400 u. One hit kills it.
  3. 2.31 s reload.
  4. Each kill removes that thrower; a new pig appears at the centre 2 s later.
  5. 90 s limit.
  - New to Hammerguy's Party; think of it as Mortar Mayhem where you are the mortar.
  - **Oddity:** Ground Target listens to all players, so it also catches the pig's own scripted `move` orders from Patrol and Kill and tries to turn them into `attackground`. The pig has no weapon, so that replacement is presumably rejected and the move goes ahead; the quest text confirms the pig wanders.

### The Plague (bundle: Plague, event #37)
- **Goal (in-game text):** "The Plague / Avoid contact with the plague!"
- **Type & scoring:** Survival free-for-all, scored by Survival Death. **There is no time limit**: no timer is started and Survival Expire is never enabled. The game lasts until one acolyte remains.
- **Arena:** `Plague` is 1280×1280 u (10×10 tiles), centre (-4224,-8064). Camera bounds are this rect. Time of day is fixed at 0:00 (night). Each acolyte is created for its own player at a random point 100–300 u from the centre with random facing.
- **Player unit:** `uaco` Acolyte.
  - Speed 220, **HP 25** (map), **no regen** (map), collision 15 (map), medium armor 0.
  - It **has an attack**: normal 9–10, cooldown 2.5 s, range 90, acquisition 90 (map). It auto-attacks anything within about 90 u, and 2 hits kill another acolyte (13.5–15 each).
  - Its acolyte abilities don't matter here.
- **Hazards / opponents:**
  - **Patient zero:** one extra acolyte for Player 12, spawned 100–300 u from the centre. It is not a key unit. The script kills it at t=6.
  - *Plague Decay:* whenever **any** corpse starts to decay, it is replaced by a `nzom` Zombie with the same owner, at full HP. The zombie plays "birth", gets an Animate Dead effect and is selected for its owner. Computer-owned zombies get acquisition 2000. WC3 fires the decay event a few seconds after death; the acolyte death animation is 3 s.
    - Patient zero's zombie therefore appears around t≈9–11.
    - **Every dead player's acolyte rises as a zombie that player controls.**
    - The map changed the zombie's death type to 3 (decays), so a killed zombie rises again at full HP.
  - **Zombie stats:** speed **220** (map; base 270), which equals acolyte speed. HP 240, regen 0.5, collision 31. Attack: normal 10–11, cooldown 1.35 s, damage point 0.3 s, range 100, acquisition 100 (map). Each hit does 15–16.5, so **2 hits kill an acolyte**.
  - Patient zero's zombie gets no orders. It idles until something comes within about 100 u, then chases indefinitely because of the 10000 guard distance.
- **Timeline:**
  - t0: UndeadX1 music, night, acolytes and patient zero created, camera, message. Survival Death and Plague Decay are enabled, plus Plague AI if any player is a computer.
  - t6: patient zero is killed.
  - About t9–11: the first zombie rises.
- **How you lose / win / finish:** your acolyte dying (to zombies or other acolytes) scores the ante, and you continue as a zombie. The last acolyte wins with 8.
- **Computer-player AI:** every 4 s, each unit a computer owns (its acolyte and later its zombie) moves 200–400 u in the centre-to-unit direction ±120°, mostly outward. Computer zombies otherwise hunt with acquisition 2000, but the 4 s random move keeps interrupting them.
- **Designer notes:** Escape the plague you started. Once dead you become a zombie; you've lost, but you can still eliminate a leading player.
- **Remake notes:**
  1. Infection tag: dead players become controllable zombies, which gives them something to do after elimination.
  2. Zombie speed equals player speed (220), so catches come from cornering and pincers.
  3. Contact isn't instant death: it takes 2 hits about 1.35 s apart.
  4. Small 10×10-tile night arena; the NPC patient zero is released at 6 s.
  5. Add a time limit; the original has none, so two good runners can stall forever.
  - Closest existing game: Sapper Tag (tag / hot potato).
  - Oddities:
    - No timeout.
    - Killed zombies respawn.
    - Acolytes can kill each other directly (2 hits), which is possibly unintended.
    - The decay trigger reacts to every decaying unit on the map.

### Troubled Waters (bundle: Troubled, event #38)
- **Goal (in-game text):** "Troubled Waters / Reach the end!"
- **Type & scoring:** Race. Ante 8. Timer 90 s. On expiry, remaining crabs are killed and score 0. Draw if nobody finishes.
- **Arena:** `Troubled_Waters` is 3968×384 u (31×3 tiles), centre (-2880,-6848). Camera bounds are the whole track; the camera starts on the start box.
  - **Lanes:** 3 lanes, each 128 u (1 tile), centred at y -6976, -6848 and -6720.
  - **Start:** `Troubled_Start`, x -4864 to -4736, full track height (128×384). Each crab is created for its own player at a random point there, facing east.
  - **Finish:** `Troubled_Finish`, x -1408 to -1152 (256×384), with a Circle of Power at scale 2. The track continues 256 u past the finish.
  - Start to finish is about 3392 u, about 17 s at 200.
- **Player unit:** `nhmc` Hermit Crab. Speed 200 (map; base 100), HP 15, collision 15, no attack.
- **Hazards / opponents:** `h005` "Tidal Wave", owned by Player 12. It's a custom unit based on the Water Elemental: flying, collision 0, no weapon, waterfall model.
  - *Spawn*, every 2.5 s starting at t=2.5: 2 waves at x = -1024 (256 u east of the finish centre), each in a random lane. If both pick the same lane, the second is deleted. So each row has 1 wave (probability 1/3) or 2 waves (2/3), and **at least one lane is always open**.
  - *Movement:* every 0.05 s, every wave is shifted 16 u west with `SetUnitPosition`, which is **320 u/s** and bypasses the speed cap. Rows are 800 u apart.
  - *Death:* every 0.05 s, any key unit with a wave within **64 u** is killed. That's the lane half-width, so a wave covers its whole lane.
  - The first row reaches the start box at about t=14.3. A crab running east meets a row about every 1.54 s (closing speed 520). Switching lanes (128 u) takes 0.64 s.
- **Timeline:**
  - t0: NagaTheme music, ante 8, crabs and circle created, camera, 90 s timer, message. Race Death, Race Expire, Finish, Death, Spawn and Dissipate are enabled.
  - t2.5: the first row spawns.
  - t4: computer crabs are ordered straight to the finish.
  - t90: expiry.
- **How you lose / win / finish:** coming within 64 u of a wave kills you. Entering `Troubled_Finish` triggers Race Finish.
- **Computer-player AI:** there is no AI trigger. The only bot logic is one straight "move to finish" order at t=4, with no lane choice, so bots survive only by luck.
- **Designer notes:** Three lanes and at least one is always free, so look ahead. Get a running start before the waves pile up. The quest's change log says wave speed and frequency were reduced; the current values are 320 u/s every 2.5 s.
- **Remake notes:**
  1. A 31×3-tile lane runner.
  2. Rows every 2.5 s at 320 u/s, 800 u apart, blocking 1–2 of the 3 lanes with at least one always free.
  3. The crab moves at 200 u/s; the kill radius is exactly the lane half-width (64).
  4. First rows spawn at the finish end, so running early means crossing fewer rows.
  5. 90 s limit.
  - Closest existing game: Kodo Stampede (dodging an oncoming herd).
  - **Bug:** `Troubled Dissipate` removes units of type `'hwat'` that leave the track, but the waves are `'h005'`. Waves are never cleaned up; they keep sliding west past the start box toward the map edge (x ≈ -5120) until Next Event. That's a unit leak with no gameplay effect, since the pile stays more than 64 u from the start box.

### The Sheep Shearers (bundle: Sheep, event #39)
- **Goal (in-game text):** "The Sheep Shearers / Reach the end!"
- **Type & scoring:** Race. Ante 8. Timer 90 s. On expiry, remaining sheep are killed and score 0. Draw if nobody finishes.
- **Arena:** `Sheep_Shearers` is 2048×1024 u (16×8 tiles), centre (-2048,-5632). Camera bounds are this rect.
  - **Blade loop:** a rectangle through four 64×64 corner regions: C1 (-2816,-5376) top-left, C2 (-1280,-5376) top-right, C3 (-2816,-5888) bottom-left and C4 (-1280,-5888) bottom-right. It measures 1536×512 u (12×4 tiles), with a perimeter of 4096.
  - **Start:** each sheep picks `Sheep_Start_Left` (x -2432 to -2176) or `Sheep_Start_Right` (x -1920 to -1664) with a 50/50 chance per player. Both span y -5184 to -5120, just above the top edge of the loop. Sheep face south.
  - **Finish:** `Sheep_Finish`, a 128×128 box at (-2048,-5888), **the midpoint of the loop's bottom edge, right on the blade path**. It has a Circle of Power.
  - Start to finish is about 672 u vertically.
- **Player unit:** `nshe` Sheep. Speed 200 (map; base 100, matching "greatly increased" in the change log), HP 15, collision 15.
- **Hazards / opponents:** 2 `e000` "Sheep Shearer" blades, owned by Player 12. They are custom units from the wisp `ewsp`: hover, fly height 50, **speed 400** (the WC3 maximum), collision 0, a glaive model at scale 2.
  - **Direction:** chosen at random at the start. Clockwise is C1→C2→C4→C3; counter-clockwise is the reverse.
  - **Starting positions:** blade A starts at the bottom middle (on the finish) and blade B at the top middle. Both run the same way, so they stay half a loop apart. **The top-middle crossing and the bottom-middle finish are swept at the same instant.**
  - **Timing:** a lap takes 10.24 s, so each point on the loop is swept every 5.12 s. The kill disc passes a point in 0.8 s.
  - **Corner triggers:** entering a corner region sends the blade (`patrol`) to the next corner in the current direction. Leaving a corner stores it in UserData.
  - *Sheep Swap*, every 15 s: wait a random 0–5 s, flip the direction, and send both blades back (`move`) to the corner they last left. From there they continue the new way, so reversals land around 15–20 s, 30–35 s and so on.
  - *Sheep Death*, every 0.05 s: any key unit within **160 u** of a blade dies. That makes a 320 u-wide lethal disc wherever the blade is.
- **Geometry:**
  - Sheep start 32–96 u above the top kill band (y -5536 to -5216). Crossing it straight takes 1.6 s.
  - The interior between the bands is only 192 u.
  - To enter the finish box (top edge at y -5824), you must already be 96 u inside the bottom band (which starts at y -5728).
- **Timeline:**
  - t0: Mainscreen music, ante 8, direction chosen, sheep, circle and 2 blades created, camera, 90 s timer, message. Race Death, Race Expire, Corner 1–8, Death, Swap and Finish are enabled.
  - t2: computer sheep are ordered straight to the finish.
  - The first reversal comes somewhere between 15 and 20 s.
- **How you lose / win / finish:** coming within 160 u of a blade kills you. Entering `Sheep_Finish` triggers Race Finish.
- **Computer-player AI:** there is no AI trigger, only the single move-to-finish order at t=2.
- **Designer notes:** The blades reverse periodically, so move right after they switch. Running against oncoming blades gives you less time. Two blades were needed because of the engine's speed limit.
- **Remake notes:**
  1. A 12×4-tile rectangular loop with 2 blades kept opposite each other, 400 u/s, kill radius 160.
  2. Reversal every 15 s plus a random 0–5 s.
  3. Start outside the loop and finish on the far edge of the loop, which forces two timed crossings.
  4. Sheep 200 u/s, 90 s limit.
  - Closest existing game: Wisp Wheel (a rotating hazard). The finish-on-the-track twist is what makes it distinct.

### Doggy Hell (bundle: Doggy, event #40)
- **Goal (in-game text):** "Doggy Hell / Fetch the stick, and return to the circle of power!"
- **Type & scoring:** Race (fetch and return). Ante 8. Timer **120 s**. On expiry, remaining dogs are killed and score 0. Draw if nobody finishes.
- **Arena:** `Doggy_Hell` is 1536×1536 u (12×12 tiles), centre (-1792,-8192). Camera bounds are this rect; the camera starts on the start box.
  - The maze is 13 lava rectangles. Entering any of them kills a unit of players 1–8, with a fire effect.
  - **Outer ring:** Doggy_1 (north), Doggy_2 (south), Doggy_3 (west) and Doggy_4 (east), each 1 tile thick. The interior left inside is x -2368 to -1216, y -8768 to -7616 (9×9 tiles).
  - **Side bars:** Doggy_5 (x -2496 to -1984) and Doggy_6 (x -1600 to -1088), both at y -8256 to -8128. They run from the side walls toward the middle.
  - **Long bars:** Doggy_7 (y -8000 to -7872) and Doggy_8 (y -8512 to -8384), both spanning x -2240 to -1344 (7 tiles).
  - **Stubs:** Doggy_9 and Doggy_10 (x -2240 to -2112 and -1472 to -1344, y -8000 to -7744) rise from bar 7 to form a ⊓ around the sticks. Doggy_11 and Doggy_12 (same x, y -8640 to -8384) drop from bar 8 to form a ⊔ around the start.
  - **Spine:** Doggy_13 (x -1856 to -1728, y -8512 to -7872) links bar 8 to bar 7.
  - **Resulting maze:** every corridor is exactly 1 tile (128 u) wide, in a symmetric serpentine (left or right side). One way is about 2900 u, about 15 s at 190. The route runs:
    1. Start ⊔ to the bottom corridor.
    2. Up the outer column.
    3. Along the row between bar 8 and bar 5/6.
    4. Through one of the two 1-tile gaps beside the spine at mid-height.
    5. Along the row between bar 5/6 and bar 7.
    6. Up the outer column to the top corridor.
    7. Down into the ⊓ to the sticks.
  - **Start / finish:** `Doggy_Start`, a 128×128 box at (-1792,-8640), with a Circle of Power.
  - **Sticks:** **always 8** Ironwood Branches (`iwbr`), at random points in the start box shifted +896 in y. That puts them at x -1856 to -1728, y -7808 to -7680, inside the ⊓. On the ground they show the generic item-sack model.
- **Player unit:** `ndog` Doggy for humans.
  - Speed 190, HP 15, collision 15 (map).
  - It has the map's unit inventory `Aihn`, **overridden to 1 slot** with item use allowed, so a dog carries one stick. It drops the stick on death.
  - Computer players get `n000`, which is identical except its movement type is **fly** at height 0.
- **Hazards / opponents:** 10 `umtw` Meat Wagons, owned by Player 12, invulnerable, collision 0. Each sits on a lava wall or bar and is ordered to `attackground` a fixed point 768 u ahead. All 10 targets are corridor chokepoints (C = centre):
  - C+(-640,0), facing east → (-1664,-8192): the right spine gap.
  - C+(640,0), facing west → (-1920,-8192): the left spine gap.
  - C+(∓320,-640), facing north → (-2112 / -1472, -8064): the rows between bar 5/6 and bar 7.
  - C+(∓320,640), facing south → (-2112 / -1472, -8320): the rows between bar 8 and bar 5/6.
  - C+(∓256,256), facing east / west → (-1280 / -2304, -7936): the outer columns beside bar 7.
  - C+(∓256,-256), facing east / west → (-1280 / -2304, -8448): the outer columns beside bar 8.
  - The route passes 5 shelled chokepoints each way.
  - **Weapon:** artillery, siege 71–88. Full-damage splash radius **64** (map; base 25), with no half or quarter radius. **Cooldown 2.0 s** (map; base 4), damage point 0.7 s. Splash hits **ground** units only.
  - One shell kills: 71–88 × 0.5 = 35–44 against 15 HP. A radius of 64 covers the whole corridor width.
  - The artillery projectile speed isn't in the extracted data.
  - *Doggy Obtain:* the first time **any** unit picks up **any** item, every wagon is replaced by `u001`, identical except **cooldown 1.5 s**. The new wagon is re-aimed at the same spot, and the trigger disables itself.
- **Timeline:**
  - t0: BloodElfTheme music, ante 8, dogs, 8 sticks and circle created, wagons created and **firing from t0**, camera, 120 s timer, message. Race Death, Race Expire, Lava, Obtain and Finish are enabled.
  - t4: Doggy AI is enabled if any player is a computer.
  - First stick pickup: the wagons speed up.
  - t120: expiry.
- **How you lose / win / finish:** entering lava or being hit by a shell kills you (Race Death). Entering `Doggy_Start` **while carrying a stick** removes the item in slot 1 and triggers Race Finish.
- **Computer-player AI:** every 1 s:
  - A bot with no stick moves toward a random item in the arena. A bot with a stick moves to the start.
  - Any item within 64 u is added to its inventory by script, because flying units can't pick items up.
  - Because the bots fly, they ignore pathing and travel in a straight line. The straight line from start to sticks crosses lava bar Doggy_8 128 u after leaving the box, so **computer dogs die about 0.7 s after the AI starts (t≈5.7).**
  - Flying does make them immune to the wagons, since splash only hits ground units, but the lava kills them regardless. This apparent bug hasn't been verified in-game.
- **Designer notes:** A "Bound"-style maze. The wagons look easy, but their attack speed rises once someone grabs a stick.
- **Remake notes:**
  1. A tile-accurate serpentine lava maze (rectangles listed above) with 1-tile corridors and instant death.
  2. 10 fixed artillery chokepoints with a 64 radius, firing every 2.0 s and every 1.5 s after the first pickup. Players pass by timing the gaps between shells.
  3. Fetch and return: 8 sticks, one per dog, dropped on death.
  4. Dog 190 u/s, 120 s limit.
  - Closest existing games: Mortar Mayhem (artillery) combined with Golem Gauntlet (race).
  - A remake needs its own pathfinding bots, since the original bots suicide.

### Ancient Punisher (bundle: Ancient, event #41)
- **Goal (in-game text):** "Ancient Punisher / Get a cloak, and hide!"
- **Type & scoring:** Survival, scored by Survival Death, with Dissipate removing dead heroes. **There is no time limit**: no timer and no Survival Expire. The game lasts until one Dark Ranger remains.
- **Arena:** `Ancient_Punisher` is 1152×1152 u (9×9 tiles), centre (320,-6080). Camera bounds are this rect.
  - Dark Rangers are pre-created as **neutral passive** 448 u from the centre, at angle slot × 135° - 22.5° (an octagon), facing the centre. Next Event hands them out at random.
  - The Ancient starts at the centre, created as a rooted structure.
- **Day/night clock:** the time of day is set to 7:00 at start. At t=4 the clock starts at **2000%**. With DayLength 480 and 24 hours per day, that is **1 game-hour per second, a full day every 24 s**. Night runs from 18:00 to 6:00.
- **Player unit:** `Nbrn` Dark Ranger hero.
  - Speed **320**, **HP 30**: base 5 (map) + STR 1 (map) × 25.
  - Armor 4.3, with its armor **type changed to medium** (map; base hero).
  - **No weapon** (map) and no skills.
  - Inventory is the map's `Aihn`: **1 slot**, item use allowed.
- **Items:**
  - **Cloak of Shadows** (`clsd`) grants Shadowmeld (`Ashm`): **invisible at night while standing still**, fading in over 1.5 s. Moving or acting breaks it.
  - **Gerard's Lost Ledger** (`ledg`) is the dud.
  - On the ground, both use the same generic item-sack model.
- **Hazards / opponents:** `etrp` "Ancient Punisher", an Ancient Protector owned by Player 12.
  - Speed **320** (map; base 40), turn rate 0.4, **collision 144**, HP 600, acquisition **2000** (map), which covers the whole arena.
  - **Uprooted melee weapon:** normal 26–33, cooldown 1.5 s, damage point 0.4 s, range 128. Its reach is about **300 u** centre to centre.
  - Each hit deals 26–33 × 1.5 (vs medium) × ~0.8 (armor) = 31–39, which is always at least 30, so **one hit kills**.
  - **Rooted boulder weapon:** its targets are set to *none* (map), so the Ancient is harmless while rooted.
  - It has no detection, so it can't see shadowmelded units.
  - Its speed equals the players'.
- **Timeline** (t = game seconds; each later phase repeats every 24 s):
  - t0: ArthasTheme music, time of day 7:00, heroes and Ancient created, camera, message. Dissipate, Survival Death, Root, Remove, Spawn and Uproot are enabled.
  - t4 (7:00): the clock runs at 20×; AI is enabled.
  - t≈5 (**8:00**), *Ancient Spawn*: one cloak per surviving player at a random spot 128–512 u from the centre. The last cloak is then deleted and a ledger is placed at a random spot 128–512 u from the centre. That leaves **N_alive - 1 cloaks plus 1 decoy**.
  - t≈15 (**18:00**, dusk), *Ancient Uproot*: the Ancient unroots and hunts.
  - t≈25 (**4:00**), *Ancient Root*: it is ordered to `root` at the centre, walks back and roots. It doesn't attack on the way.
  - t≈27 (**6:00**, dawn), *Ancient Remove*: dispel effect on every player, each slot-1 item is dropped, and then **every item on the map is deleted**.
  - t≈29 (8:00): new items spawn and the cycle repeats. Each cycle has about 10 s to grab an item (8:00–18:00) and about 10 s of hunting (18:00–4:00).
- **How you lose / win / finish:** caught by the Ancient means death and scores the ante. The last survivor wins with 8. With no clock, the game only ends through eliminations.
- **Computer-player AI:** every 2 s:
  - Each computer Dark Ranger moves to a random cloak lying in the arena, re-picked each tick.
  - Any item within 72 u (searched in a 144×144 box) is added by script. That can be the ledger, since there's no type check.
  - Because it keeps getting move orders while any cloak remains on the ground, a cloaked bot never stands still.
  - With no cloaks on the ground, `GetItemLoc(null)` returns (0,0), so the bot walks toward the map origin, which puts it against the arena's north edge.
- **Designer notes:** Grab a cloak and hide in the dark. One item is always a fake. Be ready the moment the items appear.
- **Remake notes:**
  1. A 24 s day/night cycle: items at 8:00, hunt from 18:00 to 4:00, items wiped at 6:00.
  2. Alive - 1 cloaks plus one identical-looking decoy, so exactly one player is exposed each night (musical chairs).
  3. A cloak means invisible only while standing still at night, after a 1.5 s fade.
  4. The hunter matches player speed (320), has a huge body (radius 144), about 300 u reach and one-hit kills, and returns to the centre to root.
  5. Add a round limit; the original has none, so a player who can out-kite a same-speed hunter for 10 s per night can drag the game on indefinitely.
  - No existing Hammerguy's Party game is similar.
  - Oddity: the bot AI prevents its own Shadowmeld while cloaks remain on the ground.


## Uther Party 4.0 — minigame rule sheets, group 6

Spellbreaker, Dune, Tides, Flight, Tower, Wheel, Death, Clandestine (events #42–#49).

Sources: `up40/bundles/*.txt` (JASS + object data), `up40/j.txt` (framework triggers), `war3map.wpm`/`w3e`/`doo`/`w3b` (arena pathing, cliffs, destructables, decoded for this note), and the 1.26 SLKs in `w3data/game/Units` for base values the bundles don't list.

Conventions used throughout:
- Damage figures are "base + dice": `dmgBase=12, 1d3` means 13–15.
- Armor multiplier is `1 - 0.06a/(1+0.06a)`.
- Attack-vs-armor factors are the 1.26 MiscGame table:
  - normal: vs medium 1.5, vs fort 0.7
  - pierce: vs medium 0.75, vs heavy 1.0
  - siege and chaos: 1.0
- Hero HP is base + 25/STR, hero mana is 15/INT, and hero mana regen is 0.05/INT.
- Next Event freezes the day/night clock (`UseTimeOfDayBJ(false)`, 12:00). A game that calls `SetTimeOfDay(0)` without `UseTimeOfDayBJ(true)` therefore stays at midnight for the whole game.

---

### Spell Breaker Blood (bundle: Spellbreaker, event #42)

- **Goal (in-game text):** "Spell Breaker Blood / Use summons to kill your opponents!"
- **Type & scoring:** Survival.
  - Survival Death and Survival Expire are on; `TiesPossible` stays false.
  - Timer is 240 s. On expiry every living Spell Breaker gets the current ante (all survivors tie) and all are killed.
  - `Spellbreaker Death`: when a player's Spell Breaker dies, every unit that player owns is killed too, including controlled summons.
- **Arena:** `Spell_Breaker_Blood`, 1024×1024 (8×8 tiles), centre (1920,-5888). Camera is bounded to it.
  - Flat, with 128×128 cliff notches in the 4 corners.
  - A Demon Gate (`ndmg`) sits at the centre. It is owned by P12, has Avul, and the map gave it `8x8SimpleSolid` pathing, so it blocks a 256×256 square.
  - Time is set to 00:00 (permanent night, because the clock is frozen).
  - Players are set UNALLIED *without* shared vision, so fog matters.
  - Spell Breakers are created as **Neutral Passive** on a radius-400 ring around the centre, at angles `id*135-22.5` (8 slots spaced 45°). Next Event then hands one out to each player at random.
- **Player unit:** `hspt` Spell Breaker.
  - Movement and defence:
    - Speed 300, collision 31.
    - **HP 200** (base 600), armor 3 (medium).
  - Attack:
    - 13–15 normal, missile, range 250, cooldown 1.9.
    - Acquire range 250 (modified).
  - Mana: **500 max, starts at 0, regen 5.0/s** (all modified; base 250/75/0.8). Full mana takes 100 s.
  - **Control Magic (`Acmg`)** is the core ability:
    - Cast range 700, cooldown 5, Duration field 60.
    - Base data: the mana charged is **45% of the target summon's *current* HP** (`Cmg2`=0.45, `Cmg3` "charge for current life"=1). The listed cost field is 25.
    - The map raised the level cap (`Nch1`) from 5 to **10** so the level-8 Infernal and Doom Guard qualify.
    - It targets summoned units only. Every spawned creature has the `summoned` type.
  - Spell Steal (`Asps`):
    - 75 mana, cooldown 3, range 700. It moves a buff between units (for example, stealing an enemy's Bloodlust).
    - Its default autocast was removed (`udaa=_`).
  - Magic Immunity (`Amim`).
  - Feedback (`Afbk`): each hit burns 20 mana from a unit that has mana and deals that amount as bonus damage. This only matters against another Spell Breaker.
- **Hazards / opponents:** P12 summons appear at gate centre +(0,-64), which is inside the solid gate block, so they are nudged out, with a teleport effect.
  - **Spawn cadence:**
    - Enabled 5 s after start, then fires on a periodic 7 s event. The timer phase is set at map init, so the first spawn comes 0–7 s after enabling.
    - Each spawn first sleeps a random 0–2 s.
    - A spawn is skipped while **≥30 living units** are inside the arena rect. That count includes the breakers and the gate.
  - **Type roll:** `DifficultyCurve` goes up by 1 per spawn (cap 7), then `n = Random(1, Random(1, DC))`.
    - If DC>5, with probability 5/6 the roll is replaced by `Random(1,5)`.
    - If a live Infernal or Doom Guard is already in the arena, `n = Random(1,5)` (at most one big creature at a time).
    - Resulting odds at DC=7: 1:23%, 2:21%, 3:19%, 4:19%, 5:18%, **6 (Infernal): 0.7%, 7 (Doom Guard): 0.3%**.
    - Spawns 1–5 are almost all scarabs and skeletons.
  - **Spawn table** (control cost at 45% of full HP):

    | n | Unit | HP | Attack | Notes | Control cost |
    |---|---|---|---|---|---|
    | 1 | `ucs1` Carrion Scarab L1 | 140 | 8–9 melee | speed 270 | 63 |
    | 2 | `uske` Skeleton Warrior | 180 | 14–15, cooldown 2 | | 81 |
    | 3 | `ucs2` Carrion Scarab L2 | 275 | 15–18 | can burrow | 124 |
    | 4 | `uskm` Skeletal Mage | 230 | 11–12 pierce, range 500 | autocasts Bloodlust `ACbb`, map-modified to **0 mana**: +40% attack rate, +25% move, 40 s, cooldown 8 | 104 |
    | 5 | `ucsC` burrowed Carrion Scarab L3 | 410 | none | **immobile**; a controller can unburrow it into `ucs3` (22–27 dmg, speed 270) | 185 |
    | 6 | `ninf` Infernal | 1500 | 49–60 chaos | armor 6, speed 320, Permanent Immolation 10 dps in 220 | **675 > 500 max**: must be damaged below ~1111 HP first |
    | 7 | `nbal` Doom Guard | 1350 | 35–42 chaos melee | Cripple, Dispel, War Stomp, Rain of Fire | **608**: also needs damage first |

  - Hostile summons auto-acquire nearby breakers (acquire range 500–700). Guard distance in the map's misc constants is 10000, so they chase indefinitely.
- **Timeline:**
  1. t0: BloodElfTheme plays, time set to night.
  2. Breakers and gate are created, a 240 s timer starts, and players are unallied.
  3. t5: spawning is enabled.
  4. Summons trickle in about every 7–9 s until the 30-unit cap is reached.
  5. The game ends when one breaker is left (Win) or the timer expires.
- **How you lose / win / finish:** You lose when your Spell Breaker dies; your army dies with it. The last breaker standing gets the top ante.
- **Computer-player AI:** Every 4 s, each unit a bot owns moves 200–400 u toward (angle from centre to unit) ±120°, i.e. random outward wandering. Bots **never cast Control Magic**.
- **Designer notes:** Bend the demons to your will. The huge creatures wreck small minions but are rare and mana-hungry, so saving mana for one is a gamble.
- **Remake notes:**
  - Mechanics to reproduce:
    - A "mind-control" spell whose cost is 45% of the target's current HP, with 0 starting mana, 5 mana/s regen and a 500 cap. This makes wearing a creature down before stealing it the key skill.
    - Neutral hostile minions spawn from a central gate, from weak to strong, with a population cap of 30.
    - Rare boss spawns (about 1% per spawn) that cost more than full mana.
    - Owner death kills your whole army.
    - 240 s survival.
  - Closest existing game: none; it is a unique RTS-lite.
  - Oddities:
    - The spawn point is inside the gate's solid pathing.
    - The `ucsC` spawn is a harmless burrowed immobile scarab that still counts toward the cap.
    - Bots cannot play the core mechanic.

### Dune Worm Distress (bundle: Dune, event #43)

- **Goal (in-game text):** "Dune Worm Distress / Dig a home, and keep away from the predator!"
- **Type & scoring:** Survival (only Survival Death is enabled).
  - **No timer**: the game runs until one worm is left.
  - No ties.
- **Arena:** `Dune_Worm_Distress`, 1792×1792 (14×14 tiles), centre (640,-8064), flat, with cliff notches in the corners.
  - Filled with a **14×14 grid of Rock Chunks (`DTrc`) at 128 u spacing**: x -192…1472, y -8896…-7232, 188 rocks.
  - The 4 corners are missing, and there is a **2×2 hole at the centre** (x 576–704, y -8128…-8000). That hole is the only open space at start.
  - Each rock has 4×4 pathing (128×128), so the field is solid rock.
  - The map sets rock HP to **5** (in `w3b`, from 250).
  - Rocks are fully restored at init.
  - A MassTeleport "portal" effect marks the centre until the predator arrives.
- **Player unit:** `ndwm` Dune Worm, created for each player within 100 u of centre.
  - **Speed 100**, **HP 15**, collision 7, medium armor 0.
  - Bite: 12–13 normal, cooldown 1.35, range 90, acquire range 90. It can target debris, so **one bite destroys a rock** (5 HP). Worms dig tunnels 128 wide.
  - A bite also one-shots another worm (normal ×1.5 vs medium beats 15 HP). Players are unallied, so worms can kill each other.
  - Race is set to human and it builds `h001` **Barricade**:
    - Costs 100 lumber, 0 gold; build time 10 s.
    - HP 100, armor 5 fortified, 4×4 solid pathing, TrollBurrow model. Tooltip: "Provides cover from the predator."
  - Every player is given **100 lumber**, which is exactly one barricade.
  - It has Repair (Human). With 0 lumber left, repairs should be blocked, since repair costs resources.
- **Hazards / opponents:** `nowb` Wildkin (P12) appears at the centre at **t=40 s**.
  - Speed 300, HP 550, collision 48.
  - Melee 19–22, cooldown 1.35, range 128, acquire range 500. It one-shots a worm.
  - It **cannot damage rocks** (attack-move ignores debris), but it attacks barricades (structures). By the numbers it breaks one in 9–10 hits, about 12–13 s (normal ×0.7 × 0.77 armor).
  - Every 4 s, with 50% chance, it is re-ordered to **attack-move to the position of a random living unit** in the arena other than itself (worm or barricade).
- **Timeline:**
  1. t0: ArthasTheme plays; lumber is set to 100.
  2. Worms are created at the centre and rocks are restored.
  3. 40 s of free digging and building.
  4. t40: the Wildkin spawns at the centre, the portal effect is removed, and 4 s retargeting starts.
  5. The game ends when ≤1 worm is left.
- **How you lose / win / finish:** Your worm dies. The last worm alive wins.
- **Computer-player AI:** Every 2 s, bots move to a point 256 u from centre at their current bearing ±45°. 1 s later they attack a random rock within a 256×256 box around themselves. Bots never build.
- **Designer notes:**
  - Tunnel away and plug your tunnel with a barricade. The predator can't dig but can chew barricades, so keep distance.
  - The changelog says the Wildkin AI was made more aggressive.
- **Remake notes:**
  - Mechanics to reproduce:
    - A destructible tile grid that only players can eat (1 bite per tile, about 1.35 s per bite plus 128 u of movement at 100 u/s).
    - One buildable plug per player (10 s build, 100 HP).
    - A fast predator (300 vs 100) arriving at 40 s and retargeting a random unit every ~8 s on average.
  - It is similar in spirit to a chaser-survival game but has no current analog. Gold Rush's grid code might help.
  - Oddities:
    - No time limit, so a game could last long if a worm is unreachable. It can't be sealed without a barricade, because its tunnel stays open.
    - Worms can bite each other.

### Tides of Darkness (bundle: Tides, event #44)

- **Goal (in-game text):** "Tides of Darkness / Kill one enemy ship!"
- **Type & scoring:** **Race** (ante set to 8).
  - `Tides Kill`: any death whose *killer* is a player frigate runs Race Finish for that frigate. The owner gets the ante, ante -1, and the ship is teleported out.
  - A frigate killed by the orcs is removed and scores 0.
  - Timer 120 s; Race Expire kills everyone still at sea (0 pts).
  - If nobody scored and all are dead, it's a Draw.
- **Arena:** `Tides_of_Darkness`, 2048×1920 (16×15 tiles), centre (3328,-8000). It is open sea, deep in the middle with shallow patches at the SW and NE corners, plus a few land tiles in the corners. Camera is bounded to it.
  - Players start near `Tides_Start` (SW, (2528,-8736)).
    - A Neutral Passive invulnerable Human Shipyard sits there as decoration.
    - Each frigate spawns at a random point of the 192×192 start rect, offset +128…256 in both x and y, facing 45°.
  - The orc base is `Tides_Spawn` (NE, (4096,-7296)), with an invulnerable P12 Goblin Shipyard.
  - Players are set **ALLIED with shared vision**, so they fight as a team.
- **Player unit:** `hdes` Human Frigate.
  - Speed 350, turn rate 0.2 (slow to turn), collision 48, float.
  - **HP 200** (base 575), armor 0, small/light armor.
  - Attack:
    - **55–69 normal**, cooldown 1.5, range 600.
    - The weapon type was changed to **artillery** (from homing missile-splash), with **projectile speed 600**.
    - Splash 25/35/50 at 100%/30%/10%.
    - Shells land where the target was, so moving ships **dodge** them.
  - 3–4 hits kill a ship.
  - **Acquire range set to 100**, so human-controlled ships don't auto-engage and must be ordered. Bots get 2000 after 4 s.
- **Hazards / opponents:** `odes` Orc Destroyers (P12), with identical stats (200 HP, artillery 55–69, range 600, speed 350).
  - **Starting count:** one per playing player. Each spawns at a random point in the spawn rect offset -128…-256 in x and y, facing 225°.
  - Their acquire range is 650 until t=4, then **2000** (whole arena).
  - **Reinforcement:** every 10 s, +1 destroyer if P12 owns <8 units. The shipyard counts, so the steady-state cap is 7 destroyers. The initial count can exceed that with 8 players.
  - **Evasion AI:**
    - Whenever an orc unit is attacked (at attack start), it moves 50–300 u away from the attacker (±90°).
    - Every 3 s, each orc ship with a player within 800 moves 50–300 u away from a random such enemy (±90°).
    - Net effect: they kite at about 600–800 and sidestep shells.
- **Timeline:**
  1. t0: War2IntroMusic; ante 8; the teams and both fleets are created; 120 s timer.
  2. The Race Death, Expire, Spawn, Orc-AI and Kill triggers are on.
  3. t4: acquire ranges are raised and the bot AI turns on.
- **How you lose / win / finish:**
  - Land the killing blow on any orc ship, and you finish and exit.
  - Only the last hit counts, so allies compete for last hits.
  - Being sunk or timing out scores 0.
- **Computer-player AI:** Every 3 s:
  - If no orc is within 800, attack-move to a random P12 unit's position (possibly the invulnerable shipyard).
  - Otherwise, move 50–300 u away from a random orc within 800 (±90°).
- **Designer notes:** A team game rather than a free-for-all. Dodge fire, but don't hang back too long or you lose allied support.
- **Remake notes:**
  - Mechanics to reproduce:
    - Slow, dodgeable, ground-targeted shells (range 600, speed 600, tiny 25–50 splash) on both sides.
    - 200 HP, meaning 3–4 hits.
    - Enemies that sidestep when fired upon.
    - Players on one team, where the kill credit (last hit) is the finish line.
    - A 10 s reinforcement trickle capped at 7.
  - It is a mirror of Mortar Mayhem's dodging, but with you firing too.
  - Oddities:
    - Kill credit is last-hit only.
    - A splash that kills two orcs credits only one, because the ship is removed at the first.

### Flight of the Footmen (bundle: Flight, event #45)

- **Goal (in-game text):** "Flight of the Footmen / Reach the end, but defend when you have to!"
- **Type & scoring:** **Race** (ante 8).
  - Entering `Flight_Finish` (128×128 at (3072,-5376), marked by a Circle of Power) runs Race Finish.
  - Timer **90 s**; Race Expire kills stragglers; death scores 0.
- **Arena:** `Flight_of_the_Footmen`, 3328×1280 (26×10 tiles), centre (4608,-5760).
  - From wpm/w3e: a **U-shaped low-ground track** wrapped around a cliff **plateau** (cliff level 2) that fills the middle band (y ≈ -5500…-6000, x 2944…5760).
    - Bottom lane: y ≈ -6400…-6050.
    - Right-hand connector column: x 5888…6272.
    - Top lane: y ≈ -5500…-5120.
  - Players spawn at the finish rect offset -768 in y: (3008…3136, -6208…-6080), bottom-left, facing east. The finish is directly 768 u north, but the cliff separates them.
  - The route is: east along the bottom lane → north up the right column → west along the top lane. That is about 6,700 u, roughly 25 s at full speed.
  - Time is set to 00:00 and frozen, so it is permanent night and **Shadowmeld always works**.
- **Player unit:** `h002` Footman.
  - Speed 270, collision 15, **HP 125** (base 420), armor 2 heavy.
  - **No attack** (weapons disabled).
  - **Defend (`Adef`, modified):**
    - Takes **5% of piercing damage** (base 50%).
    - Movement drops to **60%** (base 30%), i.e. 162 u/s.
    - Base 30% chance to reflect piercing attacks.
    - It does **not** reduce siege damage.
  - **Shadowmeld (`Ashm`):** invisible while standing still, with a 1.5 s fade. Towers lose you and retarget.
- **Hazards / opponents:** 7 P12 towers on the plateau, at arena-centre offsets. The upper row sits at y -5568 and covers the top lane; the lower row sits at y -5952 and covers the bottom lane.

  | Offset | Tower |
  |---|---|
  | (-896,+192) | Guard |
  | (-384,+192) | **Cannon** |
  | (-384,-192) | Guard |
  | (+384,+192) | Guard |
  | (+384,-192) | Guard |
  | (+896,+192) | **Cannon** |
  | (+896,-192) | Guard |

  - The bottom lane faces 3 Guard Towers; the top (return) lane faces 2 Guard + 2 Cannon.
  - Guard Tower `hgtw`:
    - 23–27 pierce, cooldown 0.9, **range 440** (modified), acquire range 700, projectile 1800.
    - About 20.5–24 per arrow after armor, so a footman dies to ~6 arrows (~5 s).
    - With Defend it does about 1 per arrow.
  - Cannon Tower `h003`:
    - 90–111 siege **artillery**, cooldown 2.5, range 440, projectile 700.
    - Splash 50/100/125 at 100/50/10%.
    - About 80–99 per hit, so **2 hits kill**. Defend doesn't help; you must dodge or meld.
  - Towers keep shooting their current target, so the leader draws fire until they meld or die.
- **Timeline:**
  1. t0: Human3 music; ante 8; night.
  2. Footmen and towers are created; 90 s timer.
  3. t4: bots are ordered to run.
- **How you lose / win / finish:** Reach the finish circle (8, 7, 6, … by arrival order). Dying or timing out scores 0.
- **Computer-player AI:** At t=4, one move order to the finish centre. Bots never Defend or Shadowmeld.
- **Designer notes:**
  - Whoever runs first eats the fire; if they meld, the next player gets targeted, so be ready to Defend.
  - The changelog says footman HP was raised.
- **Remake notes:**
  - Mechanics to reproduce:
    - A U-track with towers on an unreachable centre island.
    - Arrow towers that Defend (5% damage, 60% speed) neutralises, and cannons it doesn't, with dodgeable shells.
    - Stand-still stealth that makes towers switch targets.
    - Towers lock onto the first runner.
    - 90 s race, 125 HP.
  - It is close to Golem Gauntlet (race) plus a hazard layer.
  - Oddity: the bottom (outbound) lane has no cannons, so the danger ramps up on the way home.

### Tower Defense (bundle: Tower, event #46)

- **Goal (in-game text):** "Tower Defense / Complete your tower!"
- **Type & scoring:** **Race** (ante 8).
  - `EVENT_PLAYER_UNIT_CONSTRUCT_FINISH`: the owner's peasants are removed from KeyUnits and deleted, the finished tower becomes the focus of Race Finish (ante, ante-1), and the tower is teleported away.
  - Timer **150 s**; Race Expire kills all remaining peasants (0 pts).
  - `Tower Death`: if your Arcane Tower (still under construction) dies, **all your units die**. You score 0, and it triggers a 500 camera quake plus a gate-death explosion.
- **Arena:** `Tower_Defense`, 2048×2048 (16×16 tiles), centre (7680,-6144), flat with corner notches.
  - Eight 64×64 build spots `Tower_1…8` form an octagon at radius ~487 around the centre:
    - T1 (7232,-5952)
    - T2 (7872,-5696)
    - T3 (8128,-6336)
    - T4 (7488,-6592)
    - T5 (7488,-5696)
    - T6 (8128,-5952)
    - T7 (7872,-6592)
    - T8 (7232,-6336)
  - Player k owns spot k.
  - Empty slots get a pre-built Neutral Passive Arcane Tower.
  - Every player gets **100 lumber**, enough for one tower.
- **Player units:** 8 × `h004` Peasant per player, on a 128 u ring around their spot.
  - Speed 190, HP 220, collision 7, medium armor 0.
  - Attack 5–6, **chaos** (modified), cooldown 2.
  - Builds `hatw` Arcane Tower:
    - 100 lumber, 0 gold.
    - **Build time 240 s** (base 50), HP 700.
    - The map set gold/lumber repair cost to 0, so **power-building with extra peasants is free**. Repair's Powerbuild Rate is 0.6.
  - A single peasant cannot finish within 150 s. Using all 8 is the whole game: by the 0.6 rate that is about 240/(1+7×0.6) ≈ 46 s; the exact engine formula is not in the script.
  - **The script auto-issues the build order** for one random peasant per player at t≈0.
- **Hazards / opponents:** One `Hamg` Archmage per spot (all 8, Neutral Hostile), placed 448 u outward from the spot, facing it.
  - **Speed 0** (immobile), attack range and acquire range **450**, so it reaches the construction and the nearer peasants.
  - Set to hero level 3 with Water Elemental L1 and Brilliance Aura L1 learned, mana 110. HP ~625 (200 base + 25×STR 17).
  - Attack 27–33 hero, about 1.5 s cooldown. That is roughly 7–9 hits (~12 s) per peasant.
  - Paused for the first 5 s.
  - t≈17: every Archmage casts Water Elemental:
    - 525 HP, 18–22 pierce (×0.75 vs peasants), range 300, lasts 60 s.
    - Costs 125 mana, which it has regenerated to by then.
  - t≈37: every Archmage is ordered to cast **Blizzard** at a point 256 u toward the arena centre, which is on top of your build site.
- **Timeline:**
  1. t0: Human1 music, ante 8, lumber, peasants, Archmages, 150 s timer; build orders go out.
  2. t5: Archmages unpaused.
  3. t17: Water Elementals.
  4. t37: Blizzard order.
  5. The game ends when every player has finished or been eliminated, or at 150 s.
- **How you lose / win / finish:**
  - Finish your tower (first = 8 pts).
  - Losing the construction, all 8 peasants, or running out the timer scores 0.
- **Computer-player AI:** None beyond the automatic build order. There is no `Tower AI` trigger, so bots never power-build.
- **Designer notes:**
  - Build with every peasant, as every second counts. The Archmage attacks peasants first, then starts casting.
  - The changelog says the timer was increased and spells now follow a consistent pattern.
- **Remake notes:**
  - Mechanics to reproduce:
    - A shared-effort build bar: 240 s solo, with extra workers adding 0.6× each.
    - A stationary turret enemy per player that shoots workers within 450 and the building.
    - A timed add at 17 s (tanky elemental) and an AoE at 37 s.
    - If your building dies, you're out.
  - It resembles a co-op "channel under fire" and has no existing analog.
  - **Bug:** Blizzard (`AHbz`, map-modified to cost 25, range 450) is **never learned**. Only Water Elemental and Brilliance Aura are selected, so the t=37 "blizzard" order most likely does nothing. The intended third attack wave is dead code.

### Wheel of Fire (bundle: Wheel, event #47)

- **Goal (in-game text):** "Wheel of Fire / Survive as long as possible!"
- **Type & scoring:** Survival with **`TiesPossible` = true** (Tie Death is on, so simultaneous deaths share a score).
  - **No timer**: it runs until ≤1 satyr is left. If the last satyrs die together, it's a Draw.
- **Arena:** `Wheel_of_Fire`, 1280×1280 (10×10 tiles), centre (8448,-8320).
  - The square has stepped cliff cut-outs at the corners (384×128 + 128×256 each), roughly an octagon.
  - The farthest walkable point is ~700 u from the centre, inside the wheel's 704 reach, so **no safe spot exists**.
  - Satyrs spawn at a random point in one of 4 random 256×256 rects centred at (±384, ±384) from the centre, on the diagonals between spokes.
- **Player unit:** `nsat` Satyr Trickster.
  - Speed 270, HP 240, collision 31. Satyrs can body-block each other.
  - **No attack.**
  - **Mana 75, starting 75, regen 0**, so there is exactly **one Purge**.
  - Purge (`ACpu`, modified): 75 mana, range 700, cast point 0.5.
    - It slashes the target's movement speed, which recovers over **2 s** (base 5).
    - It is meant to be cast on an opponent to stall them into the fire.
- **Hazards:** 21 invulnerable "Fire" units (`ewsp` wisps with a TownBurningFire effect, flying height 0; Permanent Immolation removed, so no damage aura).
  - 1 fixed fire at the centre.
  - 4 spokes × 5 fires at radii 128, 256, 384, 512, 640, at angles `A*90 + Real_Angle`.
  - **Every 0.05 s**, any satyr within **64 u** of any fire is killed (`KillUnit`). Each spoke is a chain of kill circles from the centre to radius 704.
  - **Rotation (per 0.05 s tick):**
    - `Rate += 0.01` until 10.
    - `Speed ±= Rate/1000` (deg/tick; the sign follows `Clockwise`, randomised at start).
    - `Angle += Speed`.
  - The wheel starts still and accelerates as ω ≈ 0.04·t² °/s:
    - 4°/s at 10 s
    - 16°/s at 20 s
    - 40°/s at 31.6 s
  - When |Speed| ≥ 2°/tick (40°/s), `Wheel Reverse`:
    - waits `DifficultyCurve+1` seconds (1, 2, 3, … growing each cycle), during which the wheel keeps accelerating;
    - then flips direction and increments DC.
  - It re-arms once |Speed| ≤ 1 (20°/s).
  - After t=50 s the angular acceleration is a constant **4°/s²**.
  - Simulated schedule:

    | Reversal | Triggered at | Peak |
    |---|---|---|
    | 1 | 31.6 s | 42°/s |
    | 2 | 56 s | 48°/s |
    | 3 | 80 s | 52°/s |
    | 4 | 106 s | 56°/s |
    | 5 | 134 s | 60°/s |
    | 6 | 164 s | 64°/s |
    | 7 | 196 s | 68°/s |

    Each cycle, the peak grows by ~4°/s and the cycle gets ~2 s longer.
  - Spoke-tip speed at 42°/s is ~470 u/s, versus the satyr's 270. A satyr keeps pace only inside radius ≈ 270/ω (≈370 u at 42°/s), where the sector is narrower.
- **Timeline:**
  1. t0: Doom music; satyrs and fires are placed; motion starts immediately from rest.
  2. The first reversal is around 32 s; it oscillates with growing peaks until one satyr remains.
- **How you lose / win / finish:** Touch (within 64 of) any fire and you die. The last satyr alive wins.
- **Computer-player AI:** Every 0.05 s (inside the motion trigger), a bot satyr with any P12 unit within 200 moves 256 u directly away from a random fire within 200. Bots never Purge.
- **Designer notes:** Run with the wheel. Purge is strong but its cast time can get you killed.
- **Remake notes:**
  - This is **the source of our Wisp Wheel**.
  - Mechanics to reproduce:
    - 4 spokes of 5 hazards at 128 u spacing plus a centre hazard, with kill radius 64 checked at 20 Hz.
    - Quadratic spin-up to 40°/s, then reversals with a growing overshoot (wait = 1, 2, 3 … s) and 4°/s² braking.
    - Random initial direction.
    - One-shot slow on an opponent (2 s recovery).
    - No timer; ties allowed.
  - **Oddity:** kill circles of radius 64 spaced 128 apart are only *tangent*. That leaves pinch points at r = 64/192/320/448/576 where the band is near zero width, so a precise crossing can slip through between two 0.05 s checks. This holds if range enumeration uses unit origins; if WC3 adds the satyr's 31 collision, the band is solid.

### The Death Trap (bundle: Death, event #48)

- **Goal (in-game text):** "The Death Trap / Reach the end!"
- **Type & scoring:** **Race** (ante 8).
  - Entering `Death_Finish` (128×128 at (7360,-8320), marked by a Circle of Power) finishes.
  - Timer **90 s**; Race Expire kills stragglers.
- **Arena:** `Death_Trap`, 2432×1280 (19×10 tiles), centre (6208,-8320). Camera starts at centre -1024 in x.
  - A grid maze of **6×3 solid 256×256 pillars** (doodad pathing) separated by **128 u-wide lanes**:
    - 4 horizontal lanes at y -7744, -8128, -8512, -8896.
    - 7 vertical lanes at x 5056 + 384k.
  - **40 Spike destructables (`DTsp`, SpikeBarrier model)** sit one in the middle of each lane segment. They form a checkerboard lattice at x 5056 + 192k, y -8896 + 192m with k+m odd.
  - Lane intersections have no spike and are safe (192 u from the nearest spike).
  - Missing spikes, so free segments:
    - next to both starts: the top/bottom-lane segment at x 5248, and the left-lane segments at y -7936 and -8704;
    - the finish segment (7360,-8320).
  - Spikes use "Unbuildable" pathing: they do not block movement; they only kill.
  - Trolls start in `Death_Start_1` (top-left corner, (5056,-7744)) or `Death_Start_2` (bottom-left corner, (5056,-8896)), chosen randomly per player, facing east.
  - The shortest routes cross about 6–7 spiked segments.
- **Player unit:** `nftr` Forest Troll. Speed 270, collision 7, HP 300 (irrelevant), no attack.
- **Hazards:**
  - **Every 0.1 s**, every *standing* spike kills all units within **64 u** (the full half-width of a lane, so a raised spike seals its segment).
  - Spikes start **all raised** and `Death Work` runs from t=0.
  - From t=5 s, every **2.5 s** (periodic, phase set at map init), **each spike independently** is restored (rises, with birth animation) or killed (lowers) with **50/50** odds.
  - Crossing one segment's 128 u kill zone takes ~0.5 s. One lane step (384 u) takes ~1.4 s.
- **Timeline:**
  1. t0: OrcX1 music, ante 8, trolls, finish circle, 90 s timer; bots are told to run.
  2. t5: toggling begins.
  3. The game ends when all trolls have finished or died, or at 90 s.
- **How you lose / win / finish:** Be within 64 of a raised spike and you die. Reach the circle to finish (8, 7, …).
- **Computer-player AI:**
  - At start and after every toggle, bots are ordered to move to the finish.
  - Every 0.1 s, a bot stops if **any** raised spike is within 160 u, even ones on lanes it won't use. It then waits for the next toggle; very cautious and slow.
- **Designer notes:**
  - Pure timing: wait at junctions and go when your next spike drops.
  - The changelog says the spikes now fluctuate more slowly.
- **Remake notes:**
  - Mechanics to reproduce:
    - A pillar grid with 128-wide lanes and one hazard per lane segment.
    - Hazards re-rolled independently 50/50 every 2.5 s (not a pattern).
    - Safe intersections.
    - All hazards up for the first 5 s.
    - Kill radius 64 checked at 10 Hz.
    - 90 s race.
  - It is similar to Golem Gauntlet (race) with a toggling-hazard floor.
  - Oddity: a spike rising under you kills instantly, with no telegraph. The birth animation is cosmetic.

### Clandestine Kitty (bundle: Clandestine, event #49)

- **Goal (in-game text):** "Clandestine Kitty / Obtain a vial, and return to safety!"
- **Type & scoring:** **Race** (ante 8).
  - Entering `Clandestine_Start` (256×128 at (10368,-8576), with a Circle of Power) **while carrying a Full Vial** finishes. The vial is removed and the priestess is teleported out.
  - Timer **150 s**; Race Expire kills the rest.
  - After a player dies or finishes, they give shared vision to everyone. Their **charmed Doom Guards stay under their control** and keep acting.
- **Arena:** `Clandestine_Kitty`, a 768×3072 corridor (6×24 tiles) running north-south, centre (10368,-7168), flat. Camera starts at the start rect.
  - **46 Ashenvale trees** (x 10048…10688, 128 spacing) give line-of-sight cover:
    - two full rows capping the north end (y -5696, -5824);
    - paired side clumps at y -8640/-8512, -6976, -6208…-5952;
    - centre pairs at y -8096, -7328, -6560.
  - **8 Full Vials** (`bzbf`, always 8) spawn at random in a 256×256 box at (10368,-5952), a tree-walled alcove at the far north end, about 2,600 u from start.
  - Players are UNALLIED **without** shared vision.
  - Time is set to 00:00 and frozen, so it is permanent night.
- **Player unit:** `Emoo` Priestess of the Moon (hero, level 1, XP suspended).
  - **Speed 320**, collision 15.
  - **HP ~50** (base HP set to 25, STR set to 1). Hero armor ~3.7.
  - **No attack.**
  - Only 1 item slot (`Aihn`, 1 slot, can drop on death).
  - **Charm (`ACch`)**: permanent control of a non-hero enemy.
    - The level cap was raised from 6 to **8** so it works on Doom Guards.
    - Cost 125, cooldown 20, range 700, cast point 0.25.
    - Mana comes from INT 15, about 225 max and 0.76/s regen: roughly one charm up front, a second about 30+ s later.
  - **Shadowmeld** (always usable at night): 1.5 s fade.
- **Hazards / opponents:** 3 `nbal` Doom Guards (P12) at (10368, -7680 / -6912 / -6400).
  - HP 1350, speed 270, melee 35–42 chaos, cooldown 1.35. Two hits kill a priestess.
  - Mana 500, regen 1.25.
  - Guard positions are removed.
  - From t=2 s, every 7 s, all P12 guards **attack-move to a random point** in the corridor.
  - Every 2 s, each P12 guard is ordered to **Cripple** a random priestess within 400:
    - −75% move speed (to 80 u/s), 10 s on heroes;
    - 175 mana, cooldown 10.
  - Once charmed, a guard's kit is yours:
    - Cripple.
    - Dispel Magic: 200 dmg to summoned units (Doom Guards are summoned-type), AoE 200, 75 mana.
    - War Stomp: 25 dmg and 2 s hero stun in 250, 90 mana.
    - Rain of Fire: 6 waves × 25 in 200, 125 mana. Two waves kill a priestess.
  - Others can charm it back.
- **Timeline:**
  1. t0: NightElf1 music, ante 8, midnight, priestesses at start, guards, vials, 150 s timer.
  2. Cripple AI on.
  3. t2: patrols and bot AI start.
- **How you lose / win / finish:** Return home with a vial (8, 7, …). Dying drops your vial. Timeout scores 0.
- **Computer-player AI** (every 0.75 s):
  - If no living hostile Doom Guard is within 500:
    - with a vial: move home;
    - without one: attack-move to a random vial on the ground.
  - Otherwise: Shadowmeld.
  - Bots are **handed** any unowned item within 64 u (scripted pickup). Bots never Charm.
  - There is a dawn branch (time ≥ 6:00 → rush and disable) — see Oddities.
- **Designer notes:** The Doom Guard's spells all have a use here. Cast them fast, because someone will probably steal him back.
- **Remake notes:**
  - Mechanics to reproduce:
    - A long corridor fetch-and-return.
    - Fragile, unarmed, fast runners with stand-still stealth.
    - Wandering heavy guards that slow you.
    - A charm that converts a guard into your personal spell kit (slow, stun, AoE fire, anti-summon), which others can steal.
    - Controllers keep their charmed guards after they finish or die.
    - 150 s.
  - No close analog.
  - **Oddity:** the clock is frozen at 00:00, because Next Event suspends time of day and this game never resumes it. As a result:
    - the enabled `Dawn` trigger (fires at 7:00) never fires;
    - the AI's "time ≥ 6:00 → rush and disable" branch is **unreachable**.
  - If that branch ever ran, it would disable the AI and strand bots without their return logic.


## Uther Party 4.0: Battle / Fel / Sea (events 50-52) and Free Play

Everything below comes from `up40/j.txt` (war3map.j), the bundles in `up40/bundles/`, the map's object
data, and the WC3 1.26 base SLKs/Blizzard.j in the extracted game data. Derived numbers such as hero HP from
STR or armour reduction use the 1.26 gameplay constants: 25 HP/STR, 15 mana/INT, 0.05 regen per STR/INT,
armour 0.3/AGI with base -2, 2 % attack speed per AGI, armour reduction 0.06·a/(1+0.06·a), and the Siege
table (light 100 %, medium 50 %, large/heavy 100 %, fortified 150 %, hero 50 %). "u" = WC3 units (128 u = 1 tile).

### How events 50-52 can start (applies to all three)

- `Set Variables` fills `udg_Triggers_Events[1..52]`: 50 = `gg_trg_Battle_Initialization`, 51 = `gg_trg_Fel_Initialization`,
  52 = `gg_trg_Sea_Initialization`.
- `Filter` (the normal match picker) does `n = GetRandomInt(1,49) + GetRandomInt(0,49)`, then `n -= 49` if `n > 49`. That
  always gives 1..49, and the distribution is uniform: each value is reached by exactly 50 of the 2,450 (a, b) pairs. The pick
  is re-rolled if `GetTriggerExecCount(udg_Triggers_Events[n]) == 1`. **50-52 can never come out of Filter.**
- The only other code that indexes `udg_Triggers_Events` is `Free Activate`:
  `set udg_Integer_Number = GetUnitUserData(GetEnteringUnit())` then `TriggerExecute(udg_Triggers_Events[udg_Integer_Number])`.
  User data 50/51/52 is set only on three Free Play "tokens": the Pandaren Brewmaster (50, always spawned by `Free Spawn`),
  the Fel Orc Peon (51, created by `Free Bloodlust` or by `Free Spawn` once unlocked) and the Sea Captain (52, created by
  `Free Select` or by `Free Spawn` once unlocked).
- `gg_trg_Battle/Fel/Sea_Initialization` are referenced nowhere else apart from `Set Variables` and their own `InitTrig_`.
- None of the three has a quest-log entry in `quests.txt`.

So Battle, Fel and Sea are **post-match Free Play games only**: the champion always has Battle, and Fel and Sea are hidden unlocks.
The mechanism is described in the Free Play section at the end.

---

### Battle for the Bottle (bundle: Battle, event #50)

- **Reachable in normal play?** No. It runs only when the Free Play champion walks the Brewmaster token (user data 50) onto the Free Switch.
  That token is spawned on every Free Play screen, so in Free Play the game is always available.
- **Goal (in-game text):** `|cffffcc00Battle for the Bottle|r / Kill your opponents!` (TRIGSTR_317). Timer label "Time Left" (TRIGSTR_316).
- **Type & scoring:** Survival free-for-all brawl. Initialization enables `Dissipate`, `Survival Death`, `Survival Expire` and `Battle Death`.
  - `udg_Boolean_TiesPossible` stays false and `Tie Death` is not enabled, so **no ties**: brewmasters that die in the same
    instant still get sequential ante values.
  - Last survivor gets ante 8 via `Win` and the message "X won!".
  - Time limit is **180 s**: `StartTimerBJ(udg_Timer_TimeLeft, false, 180.00)`, started at init, so it includes the 5 s freeze.
    On expiry `Survival Expire` gives every survivor the current ante (they tie), kills all key units, then runs `Draw`.
  - No special ante handling (ante = 9 - players). In Free Play the scores are cosmetic, see Free Play.
- **Arena:** `Tauren_Tragedy` (the arena of event 10, The Tauren Tragedy).
  - Rect (-4736,1152)-(-3456,2432) = 1280 x 1280 u = 10 x 10 tiles, centre (-4096,1792).
  - About 85 % walkable: a rounded square with the corners cut by 1-2 tiles of cliff. There are 2 Fall Tree Walls on the rim.
  - Camera is bounded to the same rect and panned to its centre.
  - **Start positions:** one Brewmaster per *playing* slot i (1-8) at centre + 500 u, angle (135·i - 22.5)°, facing the centre.
    The angles are P1 112.5°, P2 247.5°, P3 22.5°, P4 157.5°, P5 292.5°, P6 67.5°, P7 202.5°, P8 337.5°: a ring of 8 spots
    45° apart, neighbours 383 u apart.
  - The units are created as Neutral Passive and then handed out by `Free Activate` with
    `GroupPickRandomUnit(...)`, so **which spot a player gets is random**.
- **Player unit:** `Npbm` Pandaren Brewmaster (hero), set to level 2 with `SetHeroLevelBJ(u, 2, false)`, learning Breath of Fire L1 and Drunken Haze L1.
  - XP is frozen: `SuspendHeroXPBJ(false, u)` means `SuspendHeroXP(u, true)` in Blizzard.j, so there is **no levelling**
    and both skill points are already spent.
  - Map overrides (MODIFIED): base HP 25 (was 100), HP regen 0 (was 0.25), damage base 10 (was 0), acquisition range 100, STR 11 (was 22).
    Unchanged base values: STR +3/lvl, AGI 14 +1.5, INT 15 +1.5, primary STR, armour 1, speed 270, collision 32, melee range 100,
    cooldown 2.22, dice 2d6, attack type Hero, turn 0.6, 6-slot hero inventory (AInv).
  - Derived at level 2 (STR 14, AGI 15.5, INT 16.5):
    - HP 25 + 14·25 = **375**, regen 0.7/s.
    - Mana 16·15 = **240**, regen about 0.81/s.
    - Damage 10 + 14 (primary STR) + 2d6 = **26-36**. Cooldown 2.22/1.30 = **about 1.71 s**. Armour about 1 - 2 + 0.3·15.5 = 3.65.
    - Hero attack vs hero armour is 100 %, and 3.65 armour takes off about 18 %, so an average hit lands about 25 → **about 15 hits to kill**.
  - **Breath of Fire (ANbf L1):** 70 mana, 10 s cooldown, cast range 375.
    - Cone from 125 u wide to 300 u wide (final area), 375 u long.
    - 65 damage, capped at 520 total.
    - Units under Drunken Haze are set on fire for 7 damage/s for 5 s.
  - **Drunken Haze (ANdh L1):** 70 mana, 12 s cooldown, range 550, radius 200.
    - Lasts 12 s, but only **5 s on heroes**, so 5 s on everything here.
    - 45 % chance to miss and -15 % move speed. Attack speed is unchanged and attacks are not prevented.
  - The hero also has Drunken Brawler and Storm, Earth and Fire in its list, but has no points left to learn them.
- **Hazards / opponents:** only the other Brewmasters (all players are unallied, with shared vision). Map-wide effects:
  - **Rune of Mana** (`rman`): the `Battle Spawn` trigger fires every **10 s** and places one at centre + random(0..500) u at a random angle.
    Polar placement makes them centre-biased. It is a power-up used on pickup: `APmr` gives +125 mana to friendly units within 1200,
    which here means only yourself. Runes are never removed, so they pile up until someone takes them.
  - **"Drunk" camera:** `CameraSetTargetNoiseForPlayer(p, 800, 100)` for every player from t = 5 s. A player's noise is cleared
    when their Brewmaster dies, and everyone's is cleared when at most 1 key unit remains.
  - **Screen flashes:** `Battle Filter` runs every **3.25 s**.
    - It rolls random R, G, B (0-100 %) and a transparency of 0-50 %.
    - `CinematicFadeBJ` fades OUT over 1.5 s to that colour through `White_mask.blp`. Transparency 0-50 % means the screen ends
      **50-100 % opaque** with a random tint.
    - It waits 1.5 s, then fades back IN over 1.5 s.
    - `CinematicFadeCommonBJ` calls `EnableUserUI(false)` on every fade, and the UI only comes back when a fade-in finishes. So the
      HUD is hidden about 3.0 s out of every 3.25 s.
    - The filter is disabled when at most 1 Brewmaster remains. If that happens mid-cycle it returns before fading back in.
- **Timeline:**
  1. **t = 0 (Initialization):**
     - Music `NightElfX1`. Create the Brewmasters (neutral passive), add them to KeyUnits, level 2, learn both skills.
     - `PauseAllUnitsBJ(true)`. Pan and bound the camera. Start the 180 s timer with its dialog. Show the goal text.
     - Enable Dissipate, Survival Death, Survival Expire and Battle Death.
  2. **`TriggerSleepAction(0)`:** `Free Activate` hands each playing player a random Brewmaster, pans cameras, selects the units
     and fades in over 1 s. Init then resumes and sets **acquisition range 500** on units owned by computer players.
  3. **t = 5 s (`PolledWait 5`):** camera noise on for all. Enable `Battle Filter` and `Battle Spawn`, unpause all, and enable
     `Battle AI` if any slot is a computer.
     - The periodic timers keep their phase from map start, so the first rune comes 0-10 s after enabling and the first flash 0-3.25 s after.
  4. **Deaths:** `Survival Death` scores the dead player (it is registered before `Battle Death`, so it runs first), then
     `Battle Death` removes the unit from KeyUnits and clears that player's camera noise. `Dissipate` removes the dead hero when it becomes revivable.
  5. **End:** one Brewmaster left → `Win`, or t = 180 s → `Survival Expire` → `Draw`.
- **How you lose / win / finish:** you are out when your Brewmaster dies. The last Brewmaster alive wins, scoring ante 8.
  At 180 s all survivors share the current ante and the round is a Draw.
- **Computer-player AI (`Battle AI`, every 4 s):**
  - Order every computer-owned unit to `move` to `GetRandomLocInRect(Tauren_Tragedy)`.
  - Then, for every computer-owned unit, any item in the arena within 150 u of it is given to it instantly
    (`UnitAddItemSwapped`), so the bot "vacuums" nearby runes.
  - Bots never cast spells. They fight only through auto-acquire (range 500) when idle between move orders.
- **Remake notes:**
  1. Brawl round: up to 8 fighters on a ring r = 500 (about 3.9 tiles) in a 10 x 10-tile rounded arena, shuffled spawns,
     5 s frozen start, 180 s limit, last alive = 8 pts and timeout = everyone alive ties. None of our current games is a
     straight melee FFA; it plays like King of the Hill without the hill.
  2. Fighter: 375 HP, speed 270, melee 26-36 every about 1.7 s, 0.7 HP/s regen, about 18 % damage reduction.
     Two skills on the same 240-mana pool (0.8/s regen): **Breath of Fire** (cone 375 long, 125 → 300 wide, 65 dmg, 10 s cd,
     70 mana) and **Drunken Haze** (radius-200 blob thrown up to 550, 5 s: 45 % miss and -15 % speed, 12 s cd, 70 mana).
     Combo: BoF on a hazed target adds 7 dps for 5 s.
  3. Mana runes every 10 s, centre-biased (random radius 0-500), +125 mana on touch, and they never expire.
  4. The "drunk" presentation (camera sway, a random tinted flash every 3.25 s that reaches 50-100 % opacity, HUD hidden
     during fades) is the game's identity. Reproduce it with a softer cap, because the original is close to blinding.
  5. Oddities: human Brewmasters have acquisition 100 (they won't chase), bots 500. XP is frozen. Survival scoring has no tie handling.
  6. Bot: re-roll a random destination every 4 s, grab runes within 150, never cast.

---

### Fel Orc Fiasco (bundle: Fel, event #51)

- **Reachable in normal play?** No (see the top section). It runs only in Free Play, after the champion unlocks the Fel Orc Peon
  token (user data 51) with the Bloodlust code and then walks it onto the Free Switch.
- **Goal (in-game text):** `|cffffcc00Fel Orc Fiasco|r / Survive as long as possible!` (TRIGSTR_555). No timer dialog.
- **Type & scoring:** Survival with **ties possible** (`udg_Boolean_TiesPossible = true`, `Tie Death` + `Survival Death` enabled).
  Peons that die in the same instant share the same ante.
  - **No time limit:** no timer is started and `Survival Expire` is not enabled. The round ends only when at most 1 peon is alive.
    If the last peons die together, the result is `Draw`.
  - No special ante handling.
  - It is a harder variant of **Peon Pandemonium** (event 1): it reuses Peon's `Peon Fire` and `Peon AI` triggers and replaces
    `Peon Spawn` with its own `Fel Spawn`.
- **Arena:** `Peon_Pandemonium` (the arena of event 1).
  - Rect (-2432,1280)-(-1408,2304) = 1024 x 1024 u = 8 x 8 tiles, centre (-1920,1792), about 91 % walkable and buildable.
  - `arenas.json` counts 5 Barrens Tree Walls (in the pit's corners) and 80 line-of-sight blockers within the rect plus a 256 u margin.
    All destructables in the rect are restored to full life at init. Catapults can target and splash trees.
  - Camera is bounded to the arena.
  - The catapults stand in four 160 x 1152 strips, each 192 u outside the arena's edges:
    - `Peon_1` east (-1216,1216)-(-1056,2368)
    - `Peon_2` north (-2496,2496)-(-1344,2656)
    - `Peon_3` west (-2784,1216)-(-2624,2368)
    - `Peon_4` south (-2496,928)-(-1344,1088)
  - **Start positions:** each playing player's peon is created directly for that player at centre + random 100-300 u at a random angle.
- **Player unit:** `ncpn` Fel Orc Peon.
  - 50 HP (MODIFIED), regen 1/s, armour 0, **armour type medium** (overridden). Speed 190, collision 16, acquisition 100.
  - Attack: 6 + 1d2 chaos, cooldown 3, range 90. Its targets were changed to **debris, item, structure, ward**, so it cannot hit
    units, only buildings such as other players' burrows.
  - Ability: Repair (`Arep`: 35 % of cost, 1.5x build time).
  - Build list: **Fel Orc Burrow `ocbw`**.
  - Initialization sets **lumber = 100 for players 1-8** (gold stays 0).
- **Fel Orc Burrow (`ocbw`, map-edited):**
  - 0 gold, **75 lumber**, **10 s** build, **200 HP**, armour 2 (large), footprint 6 x 6 pathing cells (192 x 192 u).
  - Tooltip changed to "Provides cover from catapult fire."
  - Abilities: Cargo Hold (Burrow) with capacity **4 of your own units** (load range 120), Battle Stations (Chaos, calls your
    units within 2000), Stand Down, plus inert Spiked Barricades, Reinforced Burrows and Blight Dispel.
  - The map set its weapons to 0 (base 1: in the base game garrisoned Fel peons shoot from it), so it is a **pure shelter**.
  - Lumber allows exactly one burrow (25 left). A full 200 HP repair would cost 0.35 × 75 ≈ 26 lumber, so you can top up about 95 % once.
  - Catapult splash hits structures: a direct hit does 75-129 to it after armour, a 50-150 u graze 19-32.
  - Unverified: whether a garrisoned peon dies or pops out when its burrow falls is WC3 engine behaviour, not something the script shows.
- **Hazards / opponents (Player 12):**
  - `ncat` "Catapult": 425 HP. Attack 81 + 3d21 = **84-144 siege**, cooldown 4.5, **range 2000** (map, base 1150), minimum range 250.
    Artillery **projectile speed 400** (map), damage point 0.1, turn 0.4.
    Splash: full ≤ 25 u, 40 % ≤ 50 u, 25 % ≤ 150 u. Splash hits ground units, structures, trees and walls with no friend/foe filter.
  - `ocat` Demolisher: same except **71 + 3d18 = 74-125**, plus Burning Oil (`Abof`, requirement check disabled by the map).
    It leaves a 150 u burning patch for about 2.5 s (1 s on heroes) that deals 6 dmg per 0.5 s (full zone) or 3 dmg per 1 s (half zone).
    These are the WC3 base field values (the map did not change them), read with the Flame Strike field meanings.
  - Against the peon (siege vs medium = 50 %):
    - Catapult: direct 42-72 kills a 50 HP peon **91 %** of the time (3d21 ≥ 19). 25-50 u: 17-29. 50-150 u: 10.5-18.
    - Demolisher: direct 37-62.5 (kills 50 %) plus the fire.
  - **Spawn (`Fel Spawn`):** every **1.0 s**, if Player 12 owns fewer than 30 units, one siege unit appears at a uniform random
    point in a random one of the 4 strips, facing the centre, with a Mass Teleport effect.
    - It is `ocat` if Player 12 already owns ≥ 26 units, otherwise `ncat`. That gives **26 catapults then 4 demolishers, 30 total**,
      full about 30 s after spawning starts.
    - For comparison, Peon Pandemonium spawns every 8 s plus a 0-2 s delay and switches to demolishers from the 9th unit.
  - **Aiming (`Peon Fire`):** every **2.0 s**, and also right after every spawn, *every* Player 12 unit gets `attackground` at a
    uniform random point in `Peon_Pandemonium`.
    - Unverified side effect: re-aiming every 1-2 s against a 4.5 s cooldown may sometimes cancel a shot before its 0.1 s damage point.
- **Timeline:**
  1. **t = 0:**
     - Music `Orc3`. Ties on. `udg_Regions_Current[1..4] = Peon_1..4`. Lumber 100. Create the peons and add them to KeyUnits.
     - Camera pan and bounds. Restore destructables. Show the goal text.
     - Enable `Tie Death` and `Survival Death`, and `Peon AI` if there are computers.
     - **Units are not paused**, so players can move (and start a burrow) immediately.
  2. **t = 5 s:** enable `Fel Spawn` (1 s) and `Peon Fire` (2 s). The first catapult appears within about 1 s.
  3. **t ≈ 5-35 s:** one siege unit per second. Each spawn also re-aims the whole battery.
  4. **After that:** 30 guns re-aimed every 2 s, which works out to roughly 30/4.5 ≈ 6.7 shells/s into a 64-tile arena.
     Estimate: a standing peon takes about one 25 % graze every 2 s, so staying mobile or burrowed matters.
  5. **End:** when at most one player still owns a peon, `Win` (or `Draw` if everyone died together).
- **How you lose / win / finish:** you lose when your peon dies (score = current ante, shared with anyone dying that instant).
  The last peon alive wins with ante 8. There is no expiry.
- **Computer-player AI (`Peon AI`, every 4 s):** every unit owned by a computer player is ordered to `move` to a random point in
  `Peon_Pandemonium`. That is all: bots never build or use burrows.
- **Remake notes:**
  1. It is essentially our **Mortar Mayhem** turned up. Reuse its shell model: 4 off-arena gun lines 1.5 tiles outside an
     8 x 8-tile pit, **+1 gun/s up to 30** (26 normal, then 4 "oil" guns), every gun re-aimed at a random pit point every 2 s,
     4.5 s reload, slow 400 u/s arcing shells.
  2. Damage vs 50 HP (regen 1/s): ≤ 25 u 42-72 (usually lethal), ≤ 50 u 17-29, ≤ 150 u 10.5-18. The oil variant does
     37-62 and leaves a 150 u fire patch for about 2.5 s (about 12 dps in the core).
  3. New mechanic: **one bunker per player**. 75 of 100 "wood", 10 s build, 200 HP, holds only its owner, not a turret.
     It can be repaired once, and it can be chipped by enemy peons (7-8 dmg every 3 s).
  4. No time limit and ties allowed. In a remake add a hard cap, because bunkering can drag a round out.
  5. Bot: random wander target every 4 s, no bunker use.

---

### Sea Combat (bundle: Sea, event #52)

- **Reachable in normal play?** No (see the top section). It runs only in Free Play, after the Sea Captain token (user data 52)
  has been unlocked by *selecting* a hidden Circle of Power and then walked onto the Free Switch.
- **Goal (in-game text):** `|cffffcc00Sea Combat|r / Kill your opponents!` (TRIGSTR_616). Timer label "Time Left" (TRIGSTR_615).
- **Type & scoring:** Survival FFA. Only `Survival Death` and `Survival Expire` are enabled, with **no ties** (TiesPossible false).
  - Time limit **120 s**, started at init (includes the 5 s freeze). On expiry all survivors share the current ante, then `Draw`.
  - Last ship afloat gets ante 8 via `Win`.
- **Arena:** `Tides_of_Darkness` (the arena of event 44, Tides of Darkness).
  - Rect (2304,-8960)-(4352,-7040) = 2048 x 1920 u = 16 x 15 tiles, centre (3328,-8000).
  - The pathing map shows 99 % of it floatable: open deep water, with shallow patches in the NE and SW corners and only the
    extreme corner cells dry. Camera is bounded to the rect.
  - **Start positions:** one battleship per playing slot i at centre + **896 u**, angle (135·i - 22.5)° (same 8-spot ring as
    Battle, neighbours 686 u apart, opposite spots 1792 u apart), facing the centre.
  - Ships are created Neutral Passive and handed out randomly by `Free Activate`.
- **Player unit:** `hbsh` Human Battleship. The map changed only HP: **400** (base 1000).
  - Armour 5, type large/heavy, no regen. Speed 270 (float movement), **turn rate 0.1** (very slow), collision 48, sight 1600.
  - Attack: **75 + 3d10 = 78-105 siege artillery**, cooldown **2.0**, **range 900**, damage point 0.3, projectile speed 900.
  - Splash: full ≤ 100 u, **50 % ≤ 150 u**, **25 % ≤ 250 u**. Splash targets are ground, structure, debris, tree, wall,
    **enemy, neutral**, so **no friendly or self damage**.
  - After armour (×0.769): direct 60-81 (average about 70), so **about 6 direct hits** to sink.
  - Initialization sets **acquisition range 100** on every ship (object value 900), so ships effectively don't auto-target:
    players must order attacks.
- **Hazards / opponents:** only the other ships. No spawns, no environment effects.
- **Timeline:**
  1. **t = 0:**
     - Music `War2IntroMusic`. Create ships (neutral passive) and add them to KeyUnits. Acquisition range 100.
     - `PauseAllUnitsBJ(true)`. Camera pan and bounds. 120 s timer with its dialog. Goal text.
     - Enable `Survival Death` and `Survival Expire`.
     - (`Free Activate` then hands out ships, pans, selects and fades in over 1 s.)
  2. **t = 5 s:** unpause all. Enable `Sea AI` (2 s) if there are computers.
  3. **End:** one ship left → `Win`. At 120 s → `Survival Expire` → `Draw`.
- **How you lose / win / finish:** sunk = out, scoring the current ante. The last ship scores 8. At the time limit, survivors tie.
- **Computer-player AI (`Sea AI`, every 2 s):**
  - Every computer-owned ship is ordered to `move` to a random point in the rect.
  - Then, with probability 3/4 (`GetRandomInt(1,4) != 1`), the same ship is ordered to `attack` a random *alive* unit in the
    rect. That replaces the move order.
  - The random pick can be the bot's own ship, in which case the order fails and it keeps moving. It can also be another bot.
- **Remake notes:**
  1. Artillery duel on an open 16 x 15-tile sea. Ring start r = 896 (7 tiles), 5 s freeze, 120 s limit, survival scoring
     (8 for last afloat, timeout = everyone alive ties).
  2. Boat: 400 HP, speed 270 with **very sluggish turning**, lobbed shot every 2 s at up to 900 u.
     Damage 60-81 on a direct hit, 50 % inside 150 u, 25 % inside 250 u, no friendly fire.
     Artillery aims at a spot, not a unit, so sidestepping is the skill.
  3. Manual targeting: auto-acquire is only 100 u, so a remake should require an aim or target input rather than auto-fire.
  4. Bot: new random destination every 2 s, and 75 % of the time instead targets a random living ship (possibly itself, which is a no-op).
  5. None of our current games is a ranged duel. The closest mechanic is Mortar Mayhem's lobbed shells, here aimed by players.

---

### Free Play (bundle: Free)

**How it starts.**
- After the last regular game, `Next Event` runs `Game End`:
  - The champion is the highest scorer. Ties trigger extra Tie-Breaker games first.
  - Sets `udg_Boolean_GameIsOver = true` and `udg_Integer_GameLength = 0`.
  - Reuses `udg_Integer_GamesPlayed` as a **free-games counter** = `(champion's score / 10) + 3` (integer division).
    Examples: 64 pts (8 wins out of 8) → 9, 50-59 → 8, 40-49 → 7, and never fewer than 3.
- `Outro` then plays a short cinematic in Clean Crew:
  - Uther plus the champion's avatar. The avatar is an Arthas (`Hart`), or a Tauren Chieftain if the champion is named "Marn".
  - Credits music.
  - Sets the leaderboard label to "Free Games Left: N" and camera bounds to `Clean_Crew`.
  - Executes `Free Initialization`.

**The selection room (`Free Initialization` + `Free Spawn`).**
- Arena: the **Clean-up Crew** arena (event 5), `Clean_Crew` rect (-2688,-4224)-(-1024,-2560) = 1664 x 1664 u = 13 x 13 tiles,
  fully walkable, centre (-1856,-3392). All players' cameras are panned and bounded there, and its blight is cleared.
- **Free Switch** = region `Free_Switch` (-1920,-2688)-(-1792,-2560), a 128 x 128 u (1 tile) square at the **top-centre edge**
  of the room, 768 u north of the centre. A walkable **Foot Switch** destructable (`DTfp`, cinematic floor-plate model) is
  created on it as the visual.
- Text: `|cffffcc00Free Play|r / The champion may now select a mini-game.` (TRIGSTR_307) followed by blank lines (TRIGSTR_310).
- `Free Spawn` creates one **token per mini-game, all owned by the champion** (`udg_Player_Winner`). Every token's unit user data =
  its event number, and all tokens are then set to move speed 300, invulnerable, with Wander removed and the "stand victory"
  animation. Positions relative to the room centre:
  - IDs 1-49 fill a 7 x 7 grid, 192 u apart. Columns x = -576, -384, -192, 0, 192, 384, 576. Rows y = +576 (IDs 1-7),
    +384 (8-14), +192 (15-21), 0 (22-28), -192 (29-35), -384 (36-42), -576 (43-49).
  - Bottom row y = -768: **51 Fel Orc Peon at x = -576** (only once unlocked), **50 Pandaren Brewmaster at x = 0** (always),
    **52 Sea Captain at x = +576** (only once unlocked).

| ID | token | game | ID | token | game |
|---|---|---|---|---|---|
| 1 | Peon `opeo` | Peon Pandemonium | 27 | Blinky `ngzc` (Blink removed) | Blinky the Bear |
| 2 | Rat `nrat` | The Rat Maze | 28 | Rifleman `hrif` | The Abombinations |
| 3 | Goblin Sapper `ngsp` | The Kaboom Room | 29 | Mountain Giant `emtg` | Sleepy Time |
| 4 | Mortar Team `hmtm` | Hot Mortar | 30 | Druid of the Wilds `edoc`* (forms removed) | Nature's Circle |
| 5 | Ghoul `ugho` | The Clean-up Crew | 31 | Demon Hunter `Edem` (L3, Mana Burn/Immolation/Evasion) | The Skull of Gul'dan |
| 6 | Archer `earc` | Way of the Bow | 32 | Tiny Tauren `otau` | Minotaur Maze |
| 7 | Murloc Tiderunner `nmrl` | Roadkill Challenge | 33 | Piggy `npig` | Quillboar Mile |
| 8 | Huntress `esen` | Covert Kitty | 34 | Witch Doctor `odoc`* | The Unseen |
| 9 | Sorceress `hsor`* | Polymorph Ring | 35 | Blademaster `Obla` (Blink removed) | Destruction's Dance |
| 10 | Tauren Chieftain `Otch`* (L2, Shockwave + War Stomp) | The Tauren Tragedy | 36 | Troll Hunter `ohun` | Pork the Piggy |
| 11 | Baldwin `h000`* | Bomb Baldwin | 37 | Acolyte `uaco`* | The Plague |
| 12 | Druid of the Talon `edot`* (Storm Crow Form `Arav` removed) | Dark Forest | 38 | Hermit Crab `nhmc`* | Troubled Waters |
| 13 | Kodo Beast `o000` | Hungry Hungry Kodos | 39 | Sheep `nshe`* | The Sheep Shearers |
| 14 | Wolf Rider `orai` | Raider Relay | 40 | Doggy `ndog`* | Doggy Hell |
| 15 | Gnoll `ngno` | Treant Valley | 41 | Dark Ranger `Nbrn` | Ancient Punisher |
| 16 | Skeleton `uske`* | The Skeleton Sonata | 42 | Spell Breaker `hspt` | Spellbreaker Blood |
| 17 | Beastmaster `Nbst` (L6, 3x Summon Bear, 3x Summon Quilbeast) | Stampede | 43 | Dune Worm `ndwm` | Dune Worm Distress |
| 18 | Seal `nsea` | Stop and Go | 44 | Buccaneer `Hapm` | Tides of Darkness |
| 19 | Ogre Warrior `nogr` | Push the Ogre | 45 | Footman `h002` | Flight of the Footmen |
| 20 | Militia `hmil`* | The Spike Pit | 46 | Archmage `H006` (L3) | Tower Defense |
| 21 | Salamander `nslr` | The Salamander Sizzle | 47 | Satyr Trickster `nsat` | Wheel of Fire |
| 22 | Archimonde `Uwar` (L10) | Obey Archimonde | 48 | Forest Troll `nftr` | The Death Trap |
| 23 | Crypt Fiend `ucry`* (Burrow removed) | Whack-a-Fiend | 49 | Priestess of the Moon `Emoo` | Clandestine Kitty |
| 24 | Renegade Wizard `nwzg`* (Speed Boost removed) | Horse Race | 50 | Pandaren Brewmaster `Npbm` (L2) | **Battle for the Bottle** |
| 25 | Dreadlord `Udre`* (Vampiric Aura) | The Masquerade | 51 | Fel Orc Peon `ncpn` | **Fel Orc Fiasco** (unlock) |
| 26 | Spider Crab Limbripper `nsc2`* | Crab Island | 52 | Sea Captain `hcth` | **Sea Combat** (unlock) |

\* = also added to `udg_UnitGroup_Bloodlust` (16 units, see below).

- Other players get **no units** in the room: they just watch.
- `Free Initialization` also adds all `opeo` (the Peon token) to `udg_UnitGroup_KeyUnits`. This looks vestigial: the token is
  removed at selection and ghost group entries are skipped by `ForGroup`.
- If the champion is a **computer**, after `PolledWait(5)` one random champion unit is ordered to walk to the switch centre, so a bot picks at random.

**Selecting a game (`Free Activate`).**
- Event: any unit entering `Free_Switch`. Condition: the trigger is enabled and the entering unit's user data > 0, which is true
  for every token.
- It disables itself, plays `BattleNetDoorsStereo2`, sets `udg_Integer_Number = user data`, and **decrements the free-games counter**.
  It kills the Foot Switch, fades out to white over 4 s, sets the label to "Free Games Left: N", and waits 4 s.
- Then it does the same clean-up as `Next Event`:
  - Remove all units, items and the switch. Run `Disable`, which also turns off Free Activate, Free Bloodlust and Free Select.
  - Fog off, gold and lumber 0, everyone unallied with shared vision, clock stopped at 12:00.
  - Clear KeepQuitters, KeepWinners and TiesPossible. **ante = 9 - playing players**. Camera bounds reset.
- **It zeroes every player's score and the leaderboard values** (`udg_Integers_Scores[1..8] = 0`).
- It runs `TriggerExecute(udg_Triggers_Events[n])`, gives each playing player one random Neutral Passive key unit, pans cameras
  to the key units, selects them, and fades in over 1 s.
- There is **no "already played" check**, so games can repeat.
- When that game ends:
  - `Win`, `Draw` and `Finish` do *not* increment the counter while `GameIsOver`. They show "X won!", "Draw!" or "Finished!".
  - `Next Event` runs. If `GameIsOver` and the counter is 0 → `Free Play End`. Otherwise → `Free Initialization` again, which
    rebuilds the room with fresh tokens.

**How many free games / how it ends.** Exactly `(champion score / 10) + 3` games are played, one per trip to the switch.
- The per-game scores are cosmetic (reset at every pick, never read again).
- `Free Play End` stops music, plays `UtherReturns` and disables the P1-P8 quit triggers.
- `CustomVictoryBJ(champion)`. Every other player gets `CustomDefeatBJ` with "Thanks for playing!" (TRIGSTR_426), and the map ends.

**`Free Bloodlust`: unlocks Fel Orc Fiasco (#51).**
- Enabled on each room visit while `udg_Booleans_Miscellaneous[1] == false`.
- Event: any unit issuing a *target* order `"bloodlust"`. Only the Archimonde token (ID 22, `Uwar`, with Roar/War Stomp/Bloodlust/Unholy Frenzy)
  has Bloodlust. The map's `ACbl` costs 0 mana, has 0 cooldown and range 600, and its targets include invulnerable, friendly
  and self (organic only), so the invulnerable tokens can be targeted.
- Each order's target is checked against `udg_UnitGroup_Bloodlust`, which `Free Spawn` fills with **16 tokens**:
  IDs 9, 10, 11, 12, 16, 20, 23, 24, 25, 26, 30, 34, 37, 38, 39, 40. These are the Sorceress, Tauren Chieftain, Baldwin,
  Druid of the Talon, Skeleton, Militia, Crypt Fiend, Renegade Wizard, Dreadlord, Spider Crab, Druid of the Wilds, Witch Doctor,
  Acolyte, Hermit Crab, Sheep and Doggy.
  - **Target in the group:** plays "GoodJob" and removes it from the group.
  - **Target not in the group** (any other token, Archimonde himself, or a token already done): plays **Sargeras' laugh** and
    **disables the trigger for this room visit**. It re-arms on the next visit, with a fresh group.
  - When the group is empty: disable, play `UtherReturns`, set `Booleans_Miscellaneous[1] = true`, and teleport in a
    **Fel Orc Peon token** (user data 51) at centre + (-576, -768), speed 300, invulnerable. From then on `Free Spawn` recreates
    it on every visit.
  - The script gives no hint about *why* those 16. It is a secret "combination" the champion has to know.

**`Free Select`: unlocks Sea Combat (#52).**
- Enabled while `udg_Booleans_Miscellaneous[2] == false`.
- While Sea is still locked, `Free Spawn` creates a **Circle of Power** (`ncop`, Neutral Passive, invulnerable) at
  `Roadkill_Challenge` centre + (0, 640) = **(576, -128)**, and stores it in `udg_Unit_Important`.
  That is inside the Roadkill Challenge arena, **not** in the room.
- Event: a selection event for Players 1-8. Condition: the selected unit is that circle. **Any** player can trigger it, not just the champion.
- When fired:
  - Kill the circle, play `UtherReturns`, set `Booleans_Miscellaneous[2] = true`.
  - Create a **Sea Captain token** (user data 52) for the champion at centre + (+576, -768), speed 300, invulnerable,
    "stand victory", with a teleport effect.
  - `Free Spawn` recreates it on later visits.
- **How a player is meant to click the circle is not in the script.** It is about 1600 u east and about 2430 u north of the
  NE corner of the Clean Crew camera box. The default camera shows only about 1100 u north of its target, per the camera fit
  in this project's earlier scratchpad `camera.json`. So it is not on screen with the normal camera.
- Presumably it is found by tilting or rotating the camera, or not at all. **Unverified**: treat Sea Combat as a deep secret,
  or effectively unreachable.

**Remake notes (Free Play).**
1. "Champion's Pick" encore: after the match the winner gets `floor(score/10) + 3` bonus rounds. Encore rounds score nothing.
2. The winner picks by physically walking one of 49+ mascot tokens (one per game, 7 x 7 grid, 192 u spacing) onto a 1-tile
   pressure plate at the top of a 13 x 13-tile room. Everyone else spectates. A bot champion picks at random after 5 s.
3. Any game can be picked any number of times. Every pick fully resets the board and the ante, as between normal rounds.
4. Hidden content: one always-on bonus game (Battle for the Bottle) plus two secret unlocks that persist for the session.
   - A "code": buff exactly 16 specific tokens with one caster token, and one wrong target locks it until the next visit.
   - A hidden clickable object outside the room.
   Good fit for a remake easter egg, with Fel Orc Fiasco as the prize for a Mortar Mayhem "hard mode".
