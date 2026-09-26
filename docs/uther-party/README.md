# Uther Party, researched from the source

Everything here comes from the two Warcraft III maps themselves, **Uther Party 4.0 Official** (52 minigames, by Karl.Alen & Shanekarl12)
and **Uther Party vUltima-X** (78 minigames in the random roll plus secret extras). Each was unpacked (script, object data, terrain, pathing,
strings) and read directly. Uther Party 4.0 was also played live in Warcraft III 1.26a with a logging copy of the map that records every unit
10-33 times a second. That confirmed the scoring rules and measured the engine behaviour the minigames depend on.

Newer releases add no minigames. Ultima-X **Fix 0.68** ([epicwar.com/maps/339173](https://www.epicwar.com/maps/339173/)) is a
bug-fix release of the same game list; its changelog is in the script header. A 0.69 is listed at
[wc3maps.com/map/355446](https://wc3maps.com/map/355446), but its download was truncated and would not open.

| File | What it is |
|---|---|
| [`rules-4.0.md`](rules-4.0.md) | A rule sheet for every 4.0 minigame: goal, scoring, arena, units with exact stats, hazards, timeline, bot logic, designer notes and remake notes |
| [`rules-ultima-x.md`](rules-ultima-x.md) | The same for the 38 Ultima-X games that are not in 4.0, plus the Free Play secrets and the unused debug switch |
| [`engine.md`](engine.md) | Warcraft III engine behaviour measured in the live game: movement, collision, melee, missiles, artillery and splash |
| [`catalog.json`](catalog.json) | One record per minigame (90 in total): type, timer, core mechanic, key numbers, bots, remake fit and closest existing game |
| [`arenas/`](arenas) | 49 arena maps rendered from the 4.0 pathing and terrain data. Black is unwalkable, shading shows cliff level, and dots are trees and other destructables |
| [`tools/`](tools) | The extraction scripts and the instrumented-map builder (see *How this was made*) |

## How a match works (verified live)

- **A match is 8 minigames.** The *Filter* trigger rolls from 1-49 without repeats. Games 50-52 (Battle for the Bottle, Fel Orc Fiasco
  and Sea Combat) are Free Play only. In Ultima-X the roll covers 1-78.
- **Scoring uses an "ante".** Each game starts with ante = 9 - N (N = players).
  - **Survival:** each death pays the dying player the current ante, and then the ante goes up by 1. The last player standing gets 8.
    With 8 players the payouts are 1, 2, ... 8. Players who die in the same instant share the lower value, and the ante still rises once per death.
    If the timer runs out, every survivor gets the current ante and nobody gets the winner's 8.
  - **Race:** the game sets ante = 8, and each finisher takes the ante before it drops by 1 (8, 7, 6 ...). Anyone who dies or is still
    running at the buzzer gets 0.
  - **Winner-take-all** games (The Rat Maze, The Skull of Gul'dan) empty the list of contestants when the first one finishes, so only that player scores.
  - Live check, Peon Pandemonium with 8 computer players: the ante went 1, 2, 3 ... 8 and the eight players scored 1 to 8 in death order.
    The Rat Maze paid 8 to the first rat home and nothing to anyone else.
- **End of match:** most points wins. Tied leaders play Tie-Breaker games among themselves. The champion then gets
  (score / 10) + 3 **Free Play** games, picked by walking a token onto a switch. Fel Orc Fiasco and Sea Combat are secret picks there, and
  Ultima-X hides nine more games behind spell-casting puzzles in the Free Play lobby.
- **Contestants and hazards:** players 1-8 are the contestants, one unit each. Brown (player 12, "Uther's Staff") owns the hazards and
  is a computer slot with no AI of its own: all hazard behaviour is scripted. In 4.0, 51 of the 52 games have trigger-based bot logic
  for computer contestants. In Ultima-X none of the 38 new games has any.

## Engine behaviour that matters for a remake

Measured in the live game; details, numbers and method are in [engine.md](engine.md).

- **Movement:** units reach full speed instantly, with no acceleration, and stand still during an attack's wind-up.
  Hammerguy's Party's movement model already matches this.
- **Collision:** units steer around each other with a 40-50 u sidestep and lose only 0.1-0.3 s. They may overlap by 20-30 % of
  their combined radii while passing, and **idle units are never shoved**. Hammerguy's Party's `collideUnits` pushes overlapping units apart,
  so a walking hero can shove an idle one. That is fine for Warlock but not how Uther Party plays.
- **Crowds are slow:** eight units crossing through the same centre took 50-120 % longer than a straight walk.
- **Melee commits:** an abomination (range 128) started its swing at a fleeing peon 255 u away (centre to centre), and the hit still
  landed 0.5 s later at 350 u. A melee hit is decided when the swing starts, not when it lands.
- **Arrows lead their target and do not home:** the Way of the Bow archer's "missile (splash)" arrow is aimed at release
  (0.72 s into the draw) at where the target will be if it keeps its velocity, and it flies to that point.
  - Never hit: runners that stopped (0 of 8) or reversed (0 of 38) after the release, and runners still mid-turn at
    the release (0 of 44).
  - Hit: runners that reversed early enough to finish turning before the release (36 of 36), or stood still at it
    (35 of 40).
  - The video shows an arrow passing over a paladin that had stopped. Frames: [img/arrow-misses-stopped-target.jpg](img/arrow-misses-stopped-target.jpg).
  An arrow already in the air still hits after its archer dies.
- **Equal speed escapes melee only in a straight line:** a melee pursuer as fast as its prey never got a swing in while the
  prey ran straight. When the prey stopped or circled, 6 of 7 swings connected.
- **Artillery:** catapult rocks fly at exactly 400 u/s (about 7.4 Hammerguy's Party units/s). Splash tiers are exactly
  1 / 0.4 / 0.25 of one damage roll per rock. The tier radii (25 / 50 / 150) are measured to the victim's edge, not its centre.

## Recommendations for Hammerguy's Party

1. **Use the original scoring.** Replace `PLACE_POINTS = [3, 2, 1]` with the ante rules, which give everyone points and make every
   place count:
   ```js
   // groups: tied player ids, best first (what Minigame.ranking() already returns)
   // survival/score: points = 9 - N + (players ranked below the group); winner gets 8, last gets 9 - N
   // race: finishers 8, 7, 6 ... in finishing order; anyone who did not finish gets 0
   ```
   Keep the 8-game match, add a tie-breaker game for tied leaders, and consider a short Free Play round for the champion.
2. **Make hazards behave like WC3.** Mortar shells should fly at a fixed speed (7.4 u/s), so shells aimed far away give more warning.
   Splash damage should use tiers measured to the victim's edge. Melee hazards should commit to a hit when the swing starts.
   Archers should aim at the target's predicted position at release and not re-aim in flight, so a change of course
   after the release dodges.
3. **Softer collision for minigames:** let moving units steer around idle ones instead of pushing them, except in games built on
   shoving, such as Push the Ogre and Ice Sumo.
4. **Next minigames to build.** These fit the one-paladin-plus-Q model, are unlike the existing eight, and work for 2-8 players.
   The full shortlist reasoning is in `catalog.json` (`remake_fit`, `hp_match`).

   | Original | Why |
   |---|---|
   | Obey Archimonde (4.0 #22) | Simon Says: repeat the order with the matching key inside a window that shrinks from 5.5 s to 1.5 s. Nothing like it exists yet |
   | Push the Ogre (4.0 #19) | Shove a slow ogre into your own goal while dodging the gas it drops behind itself. Existing collision code does most of it |
   | The Spike Pit (4.0 #20) | Stay inside a safe disc that wanders and speeds up (3.2t u/s). Everything else kills |
   | Stop and Go (4.0 #18) | Red light, green light, with a single Purge to stall a rival |
   | Horse Race (4.0 #24) | Speed decays constantly, and each of four boosts resets it to 320; timing them is the game (optimum about 18.4 s) |
   | Sleepy Time (4.0 #29) | Be the first to die: taunt the wandering golems onto yourself and away from rivals |
   | The Plague (4.0 #37) | Infection tag where dead players come back as zombies they control, so nobody sits out |
   | The Salamander Sizzle (4.0 #21) | Fireballs along your facing destroy mushroom cover; a mana economy limits spam |
   | One Bomb Too Many (Ultima-X #66) | Bomberman mines: 5 s fuse, 300 u blast that hurts the owner too, chains within 400 u |
   | Energy Blitz (Ultima-X #65) | Walk into a resting ball to launch it; it bounces off walls and damages by its speed |
   | Keep Away! (Ultima-X #69) | A sapper chases the nearest player and gains 25 u/s every second; Q is a 650 u blink |
   | Stomp of Doom (Ultima-X #58) | Invisible stompers find each other by the flash each stomp gives off. Needs per-player visibility |

   Existing games and their originals: Kodo Stampede ≈ Stampede (#17); Mortar Mayhem ≈ Peon Pandemonium (#1) and Hot Mortar's
   artillery; Wisp Wheel ≈ Wheel of Fire (#47) and The Kaboom Room (#3); Sapper Tag ≈ Hot Mortar (#4); Golem Gauntlet ≈ the
   "Reach the end!" races (Roadkill, Quillboar Mile, Troubled Waters, The Sheep Shearers).

## Live tour results

<!-- TOUR -->
All 52 Uther Party 4.0 minigames were played with 8 computer contestants and the logging map, one after another (`-cl tour`, 150 s cap). "Decided" is the time from the start to the last payout, or to the last contestant leaving play. "Paid" is how many of the 8 players scored. Computer players are weak at races: in several of them they all died within seconds, so nobody scored. That is a fact about the bots, not the game.

| # | Game | Type | Decided | How it ended | Paid | Notes |
|---|---|---|---|---|---|---|
| 1 | Peon Pandemonium | survival | 75 s | played to the end | 8 | first death at +29 s |
| 2 | The Rat Maze | winner-take-all | 29 s | played to the end | 1 | first death at +12 s; 120 s timer |
| 3 | The Kaboom Room | survival | 43 s | played to the end | 8 | first death at +31 s |
| 4 | Hot Mortar | survival | 136 s | played to the end | 8 | first death at +27 s |
| 5 | The Clean-up Crew | survival | 54 s | played to the end | 8 | first death at +14 s |
| 6 | Way of the Bow | survival | 14 s | played to the end | 8 | first death at +8 s; 120 s timer |
| 7 | Roadkill Challenge | race | 8 s | played to the end | 0 | first death at +5 s; 90 s timer |
| 8 | Covert Kitty | race | 100 s | played to the end | 1 | first death at +15 s |
| 9 | The Polymorph Ring | survival | 45 s | played to the end | 8 | first death at +35 s |
| 10 | The Tauren Tragedy | survival | 89 s | played to the end | 8 | first death at +63 s |
| 11 | Bomb Baldwin | race | 56 s | played to the end | 4 | first death at +60 s; 60 s timer |
| 12 | Dark Forest | survival | 101 s | played to the end | 8 | first death at +91 s |
| 13 | Hungry Hungry Kodos | survival | 83 s | played to the end | 8 | first death at +63 s |
| 14 | Raider Relay | race | 22 s | played to the end | 2 | first death at +5 s; 90 s timer |
| 15 | Treant Valley | survival | 40 s | played to the end | 8 | first death at +15 s |
| 16 | The Skeleton Sonata | survival | 83 s | played to the end | 8 | first death at +68 s |
| 17 | Stampede | survival | 64 s | played to the end | 8 | first death at +51 s |
| 18 | Stop and Go | race | 44 s | played to the end | 8 | nobody died |
| 19 | Push the Ogre | race | 51 s | played to the end | 2 | first death at +21 s; 90 s timer |
| 20 | The Spike Pit | survival | 84 s | played to the end | 8 | first death at +56 s |
| 21 | The Salamander Sizzle | survival | 28 s | played to the end | 8 | first death at +19 s; 150 s timer |
| 22 | Obey Archimonde | survival | 70 s | played to the end | 8 | first death at +58 s |
| 23 | Whack-a-Fiend | race | 68 s | played to the end | 8 | nobody died; 90 s timer; the computer players never moved |
| 24 | Horse Race | race | 21 s | played to the end | 8 | nobody died; 60 s timer |
| 25 | The Masquerade | survival | 141 s | played to the end | 8 | first death at +33 s |
| 26 | Crab Island | survival | 150 s | stopped at 150 s | 3 | first death at +58 s; stopped by the 150 s cap |
| 27 | Blinky the Bear | race | 15 s | played to the end | 3 | first death at +8 s; 90 s timer |
| 28 | The Abombinations | survival | 40 s | played to the end | 8 | first death at +16 s |
| 29 | Sleepy Time | reverse-race | 90 s | played to the end | 4 | first death at +48 s; 120 s timer |
| 30 | Nature's Circle | survival | 120 s | played to the end | 8 | first death at +80 s; 120 s timer |
| 31 | The Skull of Gul'dan | winner-take-all | 102 s | played to the end | 0 | first death at +69 s; 240 s timer |
| 32 | Minotaur Maze | race | 61 s | played to the end | 5 | first death at +12 s; 180 s timer |
| 33 | Quillboar Mile | race | 18 s | played to the end | 8 | nobody died; 60 s timer |
| 34 | The Unseen | race | 43 s | played to the end | 0 | first death at +8 s; 90 s timer |
| 35 | Destruction's Dance | survival | 29 s | played to the end | 8 | first death at +23 s; 120 s timer |
| 36 | Pork the Piggy | race | 75 s | played to the end | 7 | first death at +90 s; 90 s timer; the computer players never moved |
| 37 | The Plague | survival | 48 s | played to the end | 8 | first death at +22 s |
| 38 | Troubled Waters | race | 12 s | played to the end | 0 | first death at +9 s; 90 s timer |
| 39 | The Sheep Shearers | race | 6 s | played to the end | 0 | first death at +4 s; 90 s timer |
| 40 | Doggy Hell | race | 28 s | played to the end | 0 | first death at +14 s; 120 s timer |
| 41 | Ancient Punisher | survival | 45 s | played to the end | 8 | first death at +18 s |
| 42 | Spell Breaker Blood | survival | 136 s | played to the end | 8 | first death at +70 s; 240 s timer |
| 43 | Dune Worm Distress | survival | 50 s | played to the end | 8 | first death at +41 s |
| 44 | Tides of Darkness | race | 41 s | played to the end | 1 | first death at +14 s; 120 s timer |
| 45 | Flight of the Footmen | race | 39 s | played to the end | 0 | first death at +23 s; 90 s timer |
| 46 | Tower Defense | race | 20 s | played to the end | 0 | first death at +8 s; 150 s timer |
| 47 | Wheel of Fire | survival | 24 s | played to the end | 8 | first death at +19 s |
| 48 | The Death Trap | race | 65 s | played to the end | 8 | nobody died; 90 s timer |
| 49 | Clandestine Kitty | race | 56 s | played to the end | 1 | first death at +11 s; 150 s timer |
| 50 | Battle for the Bottle | survival | 150 s | stopped at 150 s | 5 | first death at +48 s; 180 s timer; stopped by the 150 s cap |
| 51 | Fel Orc Fiasco | survival | 38 s | played to the end | 8 | first death at +9 s |
| 52 | Sea Combat | survival | 38 s | played to the end | 8 | first death at +15 s; 120 s timer |
<!-- /TOUR -->

## All minigames

Fit: 1 = fits the one-paladin-plus-Q model directly, 2 = needs a new unit or a modest new mechanic, 3 = needs a system
Hammerguy's Party does not have (typing, building, economy, possession). Types are what the code actually does, which is
sometimes not what the in-game text says.

<!-- TABLES -->
### 4.0

| # | Game | Type | Timer | What you do | Fit | Closest in Hammerguy's Party |
|---|---|---|---|---|---|---|
| 1 | Peon Pandemonium | survival | none | Dodge slow lobbed catapult rocks aimed at random pit points; launchers ramp up to 30 and later ones leave burning oil; last peon alive wins. | 1 | Mortar Mayhem |
| 2 | The Rat Maze | winner-take-all | 120 s | Run a maze to the single central cheese and carry it home past patrolling one-bite spiders; carrying slows you; first rat home wins everything. | 2 | Gold Rush |
| 3 | The Kaboom Room | survival | none | Dodge fire wisps that shoot out from the centre in random directions and burn nearby; a dying sapper explodes and can chain-kill neighbours. | 1 | Wisp Wheel |
| 4 | Hot Mortar | survival | none | Only the holder can act: lob the mortar to any rival before a hidden 5-25 s fuse ends; whoever holds it or is receiving it dies. | 2 | Sapper Tag |
| 5 | The Clean-up Crew | survival | none | Stay on shrinking blight where you regenerate; off it you lose 20 HP/s; priests punch 200-radius holes at random players every 10 s. | 1 | Ice Sumo |
| 6 | Way of the Bow | survival | 120 s | Archer duel among tree cover: click to fire one-hit-kill arrows with a 0.72 s wind-up; change direction after release to dodge; last archer standing wins. | 2 | - |
| 7 | Roadkill Challenge | race | 90 s | Frogger: cross a U-shaped course of lanes where siege engines patrol back and forth; any car within 128 u kills you instantly. | 1 | Golem Gauntlet |
| 8 | Covert Kitty | race | none | Sneak across a tree-strewn field to the exit past roaming Doom Guards; stand still 1.5 s to vanish until dawn at 100 s; Cripple then melee kills. | 2 | Golem Gauntlet |
| 9 | The Polymorph Ring | survival | none | Survive speed-matched one-hit Sasquatches spawning from the centre by spending a fixed 400-mana wallet on Slow, Polymorph and self-Invisibility. | 2 | Kodo Stampede |
| 10 | The Tauren Tragedy | survival | none | Hold out against an ever-growing footman swarm from a central barracks using Shockwave, War Stomp and melee; the spells also hit rival taurens. | 2 | - |
| 11 | Bomb Baldwin | race | 60 s | Fly over a wandering crowd of 100 identical peasants, hover to find the ones named Baldwin and bomb one; each Baldwin kill finishes you in order. | 2 | - |
| 12 | Dark Forest | survival | none | Swap between druid and storm crow to dodge roaming hunters: abominations only hit ground, gargoyles only hit air, each as fast as its prey form. | 1 | - |
| 13 | Hungry Hungry Kodos | survival | none | Starving kodos lose 15 HP/s; right-click pigs to eat them for 50 HP and children for mana to fire a stunning bolt at rivals. | 2 | Gold Rush |
| 14 | Raider Relay | race | 90 s | Sprint past a bear, board your zeppelin, fly through faster hippogryphs and unload onto an air-only island finish; one snare per player. | 2 | Golem Gauntlet |
| 15 | Treant Valley | survival | none | Dodge slow treants that burst one by one from glowing trees; two hits kill, but you outrun them 270 to 220. | 1 | Mortar Mayhem |
| 16 | The Skeleton Sonata | survival | none | Skeletons pour endlessly from marked corpses and chase you; a 200-radius Dispel on an 8 s cooldown wipes nearby skeletons, including those near rivals. | 1 | - |
| 17 | Stampede | survival | none | Dodge exploding lizard streams charging along the arena from centre-column Beastmasters that grow from one to eight, soon from both directions. | 1 | Kodo Stampede |
| 18 | Stop and Go | race | none | Creep a very slow seal up a lane toward the finish, moving only on green; towers shoot any visible moving seal on red. | 1 | Golem Gauntlet |
| 19 | Push the Ogre | race | 90 s | Body-shove a slow invulnerable ogre into your own goal circle while dodging the lethal gas cloud it releases right behind itself. | 1 | Ice Sumo |
| 20 | The Spike Pit | survival | none | Stay inside a safe spot that wanders and accelerates across a spike grid; any raised spike within 128 u kills instantly. | 1 | King of the Hill |
| 21 | The Salamander Sizzle | survival | 150 s | Fire straight fireballs along your facing that kill within 100 u and burn anyone nearby; mushroom cover blocks fireballs and is destroyed by them. | 1 | - |
| 22 | Obey Archimonde | survival | none | Simon Says: repeat Archimonde's order with the matching hotkey inside a shrinking window; any wrong order at any time kills you. | 2 | - |
| 23 | Whack-a-Fiend | race | 90 s | Whack-a-mole: hit crypt fiends as they pop up; first to 10 kills finishes, with a stun bolt and slowing clap to disrupt rivals. | 1 | Gold Rush |
| 24 | Horse Race | race | 60 s | Race down a private lane where speed decays constantly; each of your four boosts resets speed to 320, so timing them decides the race. | 1 | Golem Gauntlet |
| 25 | The Masquerade | survival | none | Kill villagers at night to refill HP, then hide in your den before day; sunlight drains 140 HP/s outside, and food is always short. | 2 | Gold Rush |
| 26 | Crab Island | survival | none | Hold out against an escalating crab horde; spend limited mana to possess a crab and become it, or shield crabs to deny rivals. | 3 | Kodo Stampede |
| 27 | Blinky the Bear | race | 90 s | Blink across wall bands through a lattice of one-tile lanes past patrolling polar bears; one hit or leaving the arena kills. | 2 | Golem Gauntlet |
| 28 | The Abombinations | survival | none | Shoot homing abominations with an arena-wide gun so they explode next to rivals, not you; each blast kills within 150 u and chains. | 2 | Sapper Tag |
| 29 | Sleepy Time | reverse-race | 120 s | Be the first to die: taunt wandering rock golems onto your giant so they beat you to death before rivals steal them away. | 1 | - |
| 30 | Nature's Circle | survival | 120 s | Rock-paper-scissors brawl: morph into bear, quillbeast or hawk, each strong against one form, and fight rivals; mana refills a morph every 6.7 s. | 2 | - |
| 31 | The Skull of Gul'dan | winner-take-all | 240 s | Co-op dungeon: press two plates to free a boss and kill it, then everyone turns hostile racing to carry the skull out; only the carrier scores. | 3 | - |
| 32 | Minotaur Maze | race | 180 s | Navigate a tight maze to grab the single Shimmerweed, which respawns elsewhere after each pickup, while faster minotaurs roam and kill on contact. | 2 | Gold Rush |
| 33 | Quillboar Mile | race | 60 s | Dash up a corridor past six fixed quillboar turrets whose slow quills kill in one hit; keep changing course to make them miss. | 1 | Golem Gauntlet |
| 34 | The Unseen | race | 90 s | Cross a band of 20 invisible stationary guards to the finish, using short-lived sentry wards to reveal them or stasis traps to stun them. | 2 | Golem Gauntlet |
| 35 | Destruction's Dance | survival | 120 s | Blademasters can only blink: each click teleports up to 400 u, and clicking a rival blinks you beside them and swings; hit and run. | 2 | - |
| 36 | Pork the Piggy | race | 90 s | From a fixed spot, throw spears at ground points to lead and hit a wandering pig; each kill finishes the thrower and a new pig spawns. | 1 | Mortar Mayhem |
| 37 | The Plague | survival | none | Run from zombies that match your speed; each dead player rises as a zombie they control and hunts the survivors; two hits kill. | 1 | Sapper Tag |
| 38 | Troubled Waters | race | 90 s | Run a three-lane track toward the finish while rows of tidal waves sweep toward you, always leaving at least one lane open. | 1 | Kodo Stampede |
| 39 | The Sheep Shearers | race | 90 s | Cross a rectangular loop swept by two fast blades that reverse every 15-20 s, and stop on its far edge where the finish sits. | 1 | Wisp Wheel |
| 40 | Doggy Hell | race | 120 s | Walk a one-tile serpentine lava maze to fetch a stick and bring it home, timing gaps in fixed artillery that shells five chokepoints each way. | 1 | Mortar Mayhem |
| 41 | Ancient Punisher | survival | none | Musical chairs: grab one of too few cloaks by day, then stand still at night to stay invisible while the Ancient hunts; one item is a fake. | 2 | - |
| 42 | Spell Breaker Blood | survival | 240 s | Mind-control summons pouring from a central gate, paying mana equal to 45% of their current HP, and turn your growing army on rivals. | 3 | - |
| 43 | Dune Worm Distress | survival | none | Bite tunnels through a solid rock grid for 40 s and plug them with your one barricade before a fast Wildkin arrives to hunt worms. | 3 | - |
| 44 | Tides of Darkness | race | 120 s | Allied frigates fight evasive orc destroyers with slow, dodgeable artillery; landing the killing blow on any orc ship finishes you. | 2 | Mortar Mayhem |
| 45 | Flight of the Footmen | race | 90 s | Run a U-shaped track under towers: toggle Defend to shrug off arrows at 60% speed, dodge cannon shells, and stand still to vanish. | 1 | Golem Gauntlet |
| 46 | Tower Defense | race | 150 s | Power-build an Arcane Tower with all eight peasants while an immobile Archmage and his Water Elemental shoot your workers and the construction. | 3 | - |
| 47 | Wheel of Fire | survival | none | Run with four spinning spokes of fire that accelerate and reverse with growing peaks; touching any fire kills; one Purge slows a rival. | 1 | Wisp Wheel |
| 48 | The Death Trap | race | 90 s | Cross a pillar grid whose lane segments each hold a spike that rises or drops at random every 2.5 s; wait at safe junctions. | 2 | Golem Gauntlet |
| 49 | Clandestine Kitty | race | 150 s | Sneak up a long corridor for a vial and bring it back past crippling Doom Guards; charm a guard to use its spells, which rivals can steal. | 3 | - |
| 50 | Battle for the Bottle | survival | 180 s | Drunken melee free-for-all between Brewmasters using Breath of Fire and Drunken Haze, grabbing mana runes, under camera sway and blinding colour flashes. | 2 | - |
| 51 | Fel Orc Fiasco | survival | none | Harder Peon Pandemonium: dodge a fast-growing catapult barrage, optionally building one burrow shelter that holds only you. | 2 | Mortar Mayhem |
| 52 | Sea Combat | survival | 120 s | Battleship artillery duel on open sea: order lobbed shots at rivals every 2 s and sidestep theirs despite very sluggish turning. | 2 | Mortar Mayhem |

### Ultima-X only

| # | Game | Type | Timer | What you do | Fit | Closest in Hammerguy's Party |
|---|---|---|---|---|---|---|
| 31 | Domination | survival | 150 s | Demon Hunters toggle a 250-radius burn aura and use a range-300 disable to switch rivals' auras off; standing near burning enemies kills you. | 2 | - |
| 51 | The Sword Weaver | survival | 150 s | Melee brawl: press S to slash a 100-radius circle 150 u ahead for 75 damage every 0.35 s; corner zappers punish camping. | 1 | - |
| 52 | Mule Race | race | 50 s | Mash a key to add speed to your mule as it auto-walks to the finish; speed never decays, so early tapping pays most. | 1 | Golem Gauntlet |
| 53 | Tornado Naga Madness (also: Reversed) | survival | none | Dodge a multiplying swarm of bouncing tornadoes, some aimed at players, in an open basin; a tornado's centre kills within 100 u. | 1 | Kodo Stampede |
| 54 | The Grim Reapage | race | 150 s | Invisible one-hit wraiths hunt wandering children for XP and ambush each other; killed wraiths revive after 10 s; first to 300 XP wins. | 2 | - |
| 55 | Typing Terror (also: Typing Catastrophe) | survival | none | Type Mannoroth's random string in chat within 5.5 s; strings grow by two characters each round and any other message kills you. | 3 | - |
| 56 | Rampage With Wolves (also: Hyper Canine) | race | 120 s | Sheep run north past 28 wandering wolves to grab grass and carry it back to the circle; any wolf within 80 u kills. | 1 | Golem Gauntlet |
| 57 | Tower Attack (also: Take your time, Doby) | survival | 210 s | Build short-lived arrow, siege and magic towers that counter each other to kill rival builders; your 25 HP builder dies easily. | 3 | - |
| 58 | Stomp of Doom (also: At least 100 Stomps of Doom) | survival | 150 s | Permanently invisible stompers hunt each other; a stomp kills everyone within 150 u but flashes your position, and decoy flashes mislead. | 2 | - |
| 59 | Wild East Duel | score | none | Count silently and click the tower when you think the shown N seconds have passed since BEGIN; the largest errors are eliminated first. | 1 | - |
| 60 | Mosquito Swarm | survival | none | Mosquitoes lose 25 HP/s and must bite a huge regenerating ogre to heal, while it swats its current attacker for 200. | 1 | - |
| 61 | Ghostly Gambit | survival | none | Immobile ghosts drain 20 HP/s; jump into an unclaimed neutral banshee within 250 u to reset to 100 HP, using that body up. | 2 | - |
| 62 | The Soul Exchange | survival | 150 s | Melee brawl without regen where a 3 s channelled swap trades your battered body for a rival's healthier one, cooldown included. | 2 | - |
| 63 | Winter's Equinox | survival | none | Dodge telegraphed flame strikes cast at random points by a growing number of invulnerable spirits; blink away and avoid lingering fire. | 1 | Mortar Mayhem |
| 64 | The Assassin's Cove (also: The Assassin's Creed) | survival | 150 s | One-shot back-stab duel: blink behind a rival and Assassinate from their 90-degree rear cone; arena edges and corners chip you. | 2 | - |
| 65 | Energy Blitz (also: Energy Madden, Energy Within) | survival | 180 s | Walk into a resting energy ball to launch it along your facing; it bounces off walls and damages any dragon it touches by its current speed. | 1 | - |
| 66 | One Bomb Too Many (also: One Bomb was enough) | survival | 150 s | Lay timed mines that explode after 5 s, killing everyone within 300 u including you and chaining to other mines within 400 u. | 1 | - |
| 67 | Hexxing Havoc | survival | 150 s | Everyone morphs into random critters every 5-8 s while one rotating player becomes the Furbolg hunter, the only unit that can attack. | 2 | Sapper Tag |
| 68 | A Taxing Situation | survival | none | Sealed-bid rounds: secretly pay 1, 5 or 10 gold from a 100-gold wallet each 20 s round; the cheapest bidders die. | 3 | - |
| 69 | Keep Away! (also: How I wish you were here) | survival | none | A sapper chases the nearest player, gaining 25 u/s every second; it explodes within 120 u, killing that player, then respawns slow. | 1 | Sapper Tag |
| 70 | Strike and Light Galore (also: how do i shot lightning?) | survival | 120 s | Anonymous seers use a 350 u knockback bolt and a rooting Purge to push rivals out of a fenced ring that shrinks at two players. | 2 | Ice Sumo |
| 71 | Elemental Clash (also: Unstable Elements) | survival | 150 s | Brawl on a tiled floor where E casts a different spell depending on the tile you stand on: heal, armour, roots, boulder stun or Starfall. | 2 | - |
| 72 | Wall Street Traffic | score | 50 s | Trade four shared stocks with buy and sell buttons; buys push a price up 3, sells down 2, with random drift every 4 s; most gold wins. | 3 | - |
| 73 | Milton's Misery | score | none | Chicken: Milton hits a 13 HP barrel every 2 s until a hidden threshold; raise your one-shot shield as late as you dare before it blows. | 1 | - |
| 74 | Fetch! | survival | 150 s | Reverse tag: the slow Child must pass its curse with a 1 s cast before fast invulnerable felhounds bite it; the Child's death eliminates its owner. | 2 | Sapper Tag |
| 75 | Over Nine Thousand | score | 25 s | Click foreign sludges on a diagonal lattice: each click clears one and spawns three of yours plus one neutral on its diagonal neighbours. | 2 | - |
| 76 | Lost & Found | survival | none | In darkness with 250 u vision, flee a growing horde of slow invulnerable zerglings; lightning briefly reveals the map and dead players become hunters. | 2 | - |
| 77 | Titanic Panic (also: One does not simply ram into Mordor) | survival | 150 s | Bumper boats: anything within 100 u of the point 125 u ahead of your bow takes 100 damage and is knocked 270 u; leaving the arena kills. | 1 | Ice Sumo |
| 78 | Great Naval Enmity | survival | 150 s | Battleships lob shells with travel time and a charged Big One at rivals; lead moving targets and keep clear of sinking ships' death bursts. | 2 | Mortar Mayhem |
| 159 | Bad Fur Day | race | 130 s | Drive an invulnerable, slow-turning car to run over fast wandering rabbits; each kill gives 13 XP and the first to level (16 kills) finishes. | 2 | Gold Rush |
| 161 | Drink and Bow | survival | 160 s | Drunk Way of the Bow: a one-hit-kill archer duel with manual targeting under heavy camera wobble and random colour flashes every 3.25 s. | 2 | - |
| 162 | Chicken Stampede | survival | none | Dodge streams of fast exploding chickens from Beastmasters that appear every 4 s up to 12, each firing north, south, east or west. | 1 | Kodo Stampede |
| 163 | Sick Peon Pandemonium | reverse-race | none | Inverted Peon Pandemonium: run into randomly aimed catapult impacts to die first; death order scores 8, 7, 6 and the last survivor least. | 1 | Mortar Mayhem |
| 164 | Piggy Pandemonium | survival | none | One-hit pigs dodge spears and shells from a ring of invulnerable throwers that grows every 1.5 s, plus one aimed shot every 1.5 s. | 1 | Mortar Mayhem |
| 166 | Wild Clicking Duel | survival | none | Keep clicking the tower: at least one click inside every 0.5 s window, repeating every 0.75 s; anyone who misses a window is out. | 1 | - |
| 167 | ??? | survival | none | Helpless peons stand in a tiny mock DotA lane while two creep armies walk in and kill them in slow motion; last peon alive wins. | 1 | - |
| 168 | Underground Run | race | 60 s | Race a long U-course while draining 13.3 HP/s; burrowing heals fully but costs about 1.45 s each way; dodge wide patrolling spiders. | 1 | Golem Gauntlet |
| 169 | Wild West Duel | survival | none | Reaction duel: after a random 4-9 s delay a buzzer sounds; clicking early kills you, and the slowest clicker each round is eliminated. | 1 | - |
<!-- /TABLES -->

## How this was made

- **Unpacking:** `tools/mpq.py` reads the map archives. `extract.py` dumps every file. `objects.py` computes the effective stats of
  every unit and ability the script uses: WC3 1.26 base tables plus the map's own changes, or the map's merged SLK tables for Ultima-X.
  `bundle.py` / `bundle_ultx.py` cut the script into one bundle per minigame, with its strings, regions and object data.
  `arenas.py` renders the arena images from `war3map.wpm` (pathing), `war3map.w3e` (terrain) and `war3map.doo` (destructables).
- **Rule sheets:** written from those bundles, one minigame at a time, with each claim traced to the script or object data.
- **Live instrumentation:** `tools/instrumentation/build_up.py` splices a logger (`cl_globals.j`, `cl_funcs.j`, `cl_funcs2.j`) into a
  copy of the map and saves it as "Uther Party 4.0 CL". The original map is never modified. `jcheck.py` checks the spliced
  JASS for syntax errors before the map is written. The copy:
  - opens the brown slot to a human, so you can spectate as the hazard owner with 8 computer contestants
    (`w3i_players.py` patches the lobby slot data);
  - records positions, orders, attack starts, damage, deaths, spell events, scores, ante and the timer to `Logs\claude_up_N.txt` through Preload;
  - takes chat commands:

    | Command | Effect |
    |---|---|
    | `-cl lab` | Go to an empty test arena |
    | `-cl go N` | Start minigame N now |
    | `-cl tour A B` | Play games A to B in order, one log file per game |
    | `-cl cap S` | End any game after S seconds |
    | `-cl rate X` | Sample every unit every X seconds (default 0.1) |
    | `-cl follow` | Camera follows the contestants |
    | `-cl bot` | Brown's units wander and try every order, to exercise games that need a human |
    | `-cl exp all` / `two` / `dodge2` | Run the engine experiments (artillery, missiles, collision, chase / dodge, chase2, orphan / dodge follow-up) |
    | `-cl free` | Jump to Free Play |
    | `-cl dump` | Write the log now |

  `clog_up.py` parses the logs. `exp_up.py` and `exp2_up.py` analyse the experiments. `tour_up.py` summarises each game
  of a tour and can write `tour.json` for the field guide (`gen_guide.py` with `guide_template.html`). `build_ultx.py` builds the same
  logging copy of Ultima-X. That map has no file list and two encrypted files, so `mpq_inplace.py` patches it in place, with
  `ultx_names.py` supplying the file names.
- Play the CL map as a **LAN game** ("Local Area Network"). Single-player WC3 pauses whenever its window loses focus; a LAN game keeps running.
  In the lobby, choose **Team 2** in your own row to move into the brown slot. Then set the eight guest slots to Computer.
- **Limits found the hard way:**
  - Preload keeps only the first 259 characters of each string, so the logger flushes at 250.
  - WC3 never frees a string. At the default sample rate, a 50-minute tour exhausted the string table and crashed the game
    ("Not enough memory", `String2HandleReg`). Use `-cl rate 0.4` for long tours, or restart between blocks of games.
  - The map file is locked while it is open in a lobby or game.
  - Starting a second copy of Warcraft III leaves the lobby's Start button dead.
- The source scripts contain paths from the machine they were written on (the WC3 install, the unpacked game data for
  `jcheck.py`). Adjust them before running.
