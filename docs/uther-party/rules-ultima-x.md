# Uther Party Ultima-X: rule sheets for the minigames not in 4.0

> Rule sheets written from the map's own script (war3map.j), object tables and terrain, one section per minigame.
> Paths such as `up40/bundles/Peon.txt` or `ultx/j.txt` refer to the extraction workspace that `tools/extract.py`,
> `tools/bundle.py` and `tools/bundle_ultx.py` produce from the map files; helper scripts named in the text
> (`g1_layout.py` and similar) were one-off readers of the same data. Distances are WC3 units (1 tile = 128;
> 1 Hammerguy's Party unit is about 54 WC3 units), times are game seconds at Fast speed.

## Uther Party Ultima-X — framework notes (differences from 4.0)

Read FRAMEWORK.md first; Ultima-X uses the same framework (KeyUnits, Survival Death / Race Finish / ante,
Win / Draw / Finish, Next Event, Tie Death, Survival Expire, Race Expire). Differences seen so far:
- Script was run through an optimizer: no "// Trigger:" comments; integer literals are often hex ($A = 10,
  $F = 15 i.e. Player($F) = Player 16?? no: Player($B) = Player(11) = "Player 12" brown; Player($F) = Player(15)
  = neutral passive in 1.26 (bj_PLAYER_NEUTRAL_EXTRA is 14, PLAYER_NEUTRAL_PASSIVE is 15, PLAYER_NEUTRAL_AGGRESSIVE is 12));
  Player(-1+(i)) = player i (1-based). Trigger setup (events such as TriggerRegisterTimerEventPeriodic, periods,
  DisableTrigger at init) is inlined into main(); each bundle shows it as "setup (inlined in main)".
- Filter: rolls GetRandomInt(1, udg_Integer_TotalofGames) with TotalofGames = 78, re-rolling games already played.
  Table entries 159-169 exist but are outside the roll (reachable only if something else executes them).
- Survival Death: same ante logic; one extra conditional 5 s sleep before Win (check Trig_Survival_Death_Func011C if relevant).
- Leaderboard is stored in udg_Leaderboard_Scores.
- The full script is ultx/j.txt (LF line endings). The map's own merged object tables are in ultx/Units/*.slk and *.txt;
  ultx/objects_units.txt and ultx/objects_abils.txt are compact effective-value dumps.
- Quest-log texts (designer descriptions, advice, change lists): ultx/quests.txt.


## Uther Party Ultima-X: events 31, 51-57 (games not in 4.0)

Sources: `ultx/bundles/031_DH, 051..057`, `ultx/j.txt` (framework triggers, Free Play secrets, cameras), the map's merged
SLKs/TXTs in `ultx/Units/` (AbilityData DataA.. fields, UnitBalance, UnitWeapons `weapsOn`, build lists), `ultx/war3mapMisc.txt`,
`ultx/war3map.w3e` + `.wpm` (walkable pathing, rendered at 64 u resolution), `ultx/quests.txt`.

Shared facts:
- Map constants: **MinUnitSpeed 0, MaxUnitSpeed 525**; everything else is WC3 1.26 default (hero HP = HP + 25*STR, hero armour
  = def - 2 + 0.3*AGI, armour reduction 0.06a/(1+0.06a), default damage table, hero XP table 200/500/900...).
- `weapons=0` in the bundles means `weapsOn=0`: the unit has **no normal attack**.
- **None of these 8 games has computer-player bot logic** (no `MAP_CONTROL_COMPUTER` check, no AI script anywhere in the map).
  Computer slots only get default engine auto-acquire.
- Games that create the key units for neutral passive (DH, Sword Weave, Mule, Typing) get them handed out by Next Event with
  `GroupPickRandomUnit`, so **which slot/lane/pedestal you get is random**. Games that create units for Player(i) directly
  (Tornado, Grim, Wolves, Tower Attack) have **fixed per-slot starts**.
- Next Event sets every pair of players "unallied with shared vision"; only Grim overrides this.
- Periodic triggers are registered at map init, so the first tick after a game enables them lands 0..period later.
- Secret variants (second titles) are armed in the post-match **Free Play** lobby by `Free Secret Variants`: casting a specific
  spell on the matching display unit sets a `udg_Secret_*` flag; the game's Initialization reads (and usually clears) it, and
  Next Event clears all flags when `Boolean_GameIsOver`. They never occur in a normal 8-game match.

---

### Domination (Ultima-X bundle: DH, event #31)
- **Goal (in-game text):** "Domination — Kill all your opponents! Immolate to damage. Mana Burn to disable."
- **Type & scoring:** survival (Survival Death + Survival Expire; `Dissipate` removes dead heroes). No ties flag. 150 s timer
  started at game start (5 s of it frozen). On expiry every survivor gets the current ante (shared), survivors are killed, Draw.
- **Arena:** region `Demon_Hunter` (7328,-10880)-(8448,-9728) = 1120 x 1152 u (8.75 x 9 tiles), centre (7888,-10304); camera
  panned to centre and bounded to the rect. Pathing: a rounded rectangle that fills the rect, with **two solid ~256 x 256 u
  (2x2 tile) pillars** centred about (-284,+236) (NW) and (+228,-276) (SE) from centre. Heavy white fog weather (FDwh).
  Starts: 8 points on a **radius-200** circle, angle i*135-22.5 deg (112.5, 247.5, 22.5, 157.5, 292.5, 67.5, 202.5, 337.5),
  so adjacent points are 153 u apart; random assignment (neutral hand-out).
- **Player unit:** Demon Hunter `Edem`: speed 320, turn 0.5, collision 31, **100 HP** (STR 0 so levels add nothing),
  **no regen** (regenType none), mana 4, **no attack**. Hero XP gain is disabled (`SuspendHeroXPBJ(false)` = disable).
  - **Immolation** (AEim L1, hotkey I): toggle, 0 cost, 0 mana drain, 0 buffer, 0 cooldown; **10 damage per second** to enemy
    ground organic units within **250**.
  - **Mana Burn** (AEmb L1, hotkey U): unit target, range **300**, 0 cooldown, 0 cost, burns **0** mana (does nothing itself).
    Trigger `DH_Spell`: on its spell effect the target is ordered `unimmolation` (852178) = **its Immolation switches off**.
    Target can re-enable at once (no cooldown). Cast point 0.3 s.
- **Hazards / mechanics:** none besides players. Everyone is mutually hostile, so standing within 250 of N immolating enemies
  costs 10*N HP/s. Mana Burn range (300) exceeds Immolation radius (250).
- **Timeline:** T0 music, fog, spawn + pause, camera, 150 s timer, text; enable Dissipate / Survival Death / Survival Expire /
  DH_Spell. T+5 s unpause, sound.
- **How you lose / win / finish:** die -> survival ante (1st out = 9-N ... winner 8). Last DH alive wins. Timeout: survivors share.
- **Computer-player AI:** none; computer DHs stand idle (no weapon, immolation off) and burn to death.
- **Designer notes:** Illidan was split by the Skull of Oc'tal and the copies fight; "use the hotkeys (U & I)"; added
  "because we all missed the Demon Hunter" (the old Demon Hunter game was replaced by Underground Burrow).
- **Remake notes:**
  1. Toggle aura: 10 dps, r=250, enemies only, free and permanent while on. Nominal kill time 10 s on 100 HP (WC3 hero
     spell-damage reduction, if it applies to Immolation, stretches this to ~13-14 s; flag).
  2. "Disable" = instant targeted off-switch, range 300, no cooldown, spammable; the victim must press I again.
  3. Starts are tightly packed (radius 200) so each DH begins inside two neighbours' auras.
  4. Two pillars to break line/approach; no attacks, no regen, no XP.

### The Sword Weaver (Ultima-X bundle: Sword_Weave, event #51)
- **Goal (in-game text):** "The Sword Weaver — Kill all your opponents! Press "S" to weave your sword."
- **Type & scoring:** survival (Survival Death + Survival Expire, Dissipate). No ties flag. 150 s timer from game start
  (first 5 s frozen); expiry: survivors share the current ante, Draw.
- **Arena:** `Destruction_Dance` (10016,5920)-(10976,6880) = 960 x 960 u (7.5 x 7.5 tiles), centre (10496,6400); pathing is an
  open square exactly this size with walls around. Camera bounded to it. Starts: radius **400**, angle i*135-22.5 deg, random
  assignment. Four **Bumpers** at 750 u from centre on the diagonals (45/135/225/315 deg) = (+-530,+-530), i.e. ~70 u outside
  each corner of the square (corners at +-480).
- **Player unit:** Paladin `Harf` (Arthas-with-sword model, scale 1.1, animations at **200 % time scale**): speed 350, turn 0.6,
  collision 32, **475 HP** (100 + 15 STR*25), regen ~1.0/s (0.25 + 15*0.05), armour 3.9 (-19 % damage), **no normal attack**,
  hero XP disabled.
  - **Sword Attack** (`A00A`, Roar base, no target, hotkey S, **cooldown 0.35 s**, 0 cost, no buff): trigger plays "attack 1",
    takes the point **150 u in front** of the caster (facing) and deals **75 damage** (ATTACK_TYPE_MELEE/normal, armour applies
    -> ~61 to a Paladin) to every unit within **100** of that point. The caster is never hit (150 > 100). ~8 hits kill.
    Unit cast point 0.5 s; whether the 200 % time scale shortens it is an engine question (flag).
- **Hazards / mechanics:** Bumper `h009` (Player 12): invulnerable, locust, speed 0, attack 51-52 **pierce**, instant,
  range 90, cooldown 1 s, acquire 1000. Only a Paladin hugging a corner is in reach (~116 u centre-to-bumper vs 90 + 32
  collision): ~21 damage per second after hero pierce 50 % and armour. Blood splash on death (cosmetic).
- **Timeline:** T0 music, spawn Paladins + 4 Bumpers, pause, camera, timer, text; enable triggers. T+5 s unpause.
- **How you lose / win / finish:** standard survival; last Paladin wins, timeout ties survivors.
- **Computer-player AI:** none; computer Paladins cannot attack (no weapon) and never cast, so they are free kills.
- **Designer notes:** no quest-log entry exists for this game.
- **Remake notes:**
  1. Melee "swing" = circle r=100 centred 150 ahead, 75 dmg, 0.35 s cooldown (plus ~0.5 s cast point) - facing matters.
  2. 475 HP, 3.9 armour -> 8 swings to kill; ~1 HP/s regen.
  3. Square 960 arena; corner zappers (~21 dps) punish corner camping.
  4. No XP / levels; no normal attacks.

### Mule Race (Ultima-X bundle: Mule, event #52)
- **Goal (in-game text):** "Mule Race — Press 'DOWN ARROW' key as fast as you can to speed up!"
- **Type & scoring:** race. **Ante forced to 8**: 1st 8, 2nd 7, ... regardless of player count. 50 s timer from game start;
  Race Expire kills unfinished mules (0 pts). Race Death enabled. Finishers are processed one at a time (no ties).
- **Arena:** `Horse_Race` (-256,5888)-(4736,6912) = 4992 x 1024 u (39 x 8 tiles), a straight open track. 8 lane starts
  (128 x 64 rects, centre x = -64), y centres top->bottom: Horse_1 6880, Horse_4 6752, Horse_7 6624, Horse_2 6496, Horse_5 6368,
  Horse_8 6240, Horse_3 6112, Horse_6 5984 (128 apart). Mules are made for neutral in slot order and handed out randomly, so
  lanes are random. Finish: `Horse_Finish` (4480,5888)-(4736,6912) 256 x 1024 (full width). A Circle of Power (scale 60 %)
  marks each used lane at x = 4544. Camera bounded to the track, first panned to (192,6400), then after 2 s **locked to your
  own mule** (target controller).
- **Player unit:** Mule `hrdh` (pack horse, scaled to 60 %): **base speed 1**, turn 0.5, collision 16, 100 HP, no attack.
  At start every mule is ordered to **move to the finish centre (4608,6400)**, so lanes converge; path to the finish edge is
  ~4545-4570 u.
- **Hazards / mechanics:** each DOWN-arrow **press** (key-down event, players 1-8) adds **+3.9 speed** to your mule. **No decay**;
  only the engine cap 525 (reached after 135 presses). A multiboard shows "Speed: X km/h" (speed/10, first 4 characters).
  Each press spawns an item-glow effect whose style marks the tier (<200, >=200, >=300, >=400, >=500 speed).
- **Timeline:** T0 ante 8, spawn, pause, circles, camera, 50 s timer, text, enable Race Death/Expire. T+2 s camera lock,
  enable Mule_Finish, gold set to 100 (unused leftover), multiboards. T+6 s unpause, move order, gunshot, **key presses start
  counting** -> ~44 s of racing.
- **How you lose / win / finish:** entering `Horse_Finish` -> Race Finish (score, teleport-out). All finished -> Finish; at 50 s
  the rest die with 0.
- **Computer-player AI:** none; computer mules crawl at 1 u/s and always score 0.
- **Designer notes:** the mules lack enthusiasm - tap Down as fast as you can; "Blatant ripoff Horse Race!" (idea by leggomyazneggo).
- **Remake notes:**
  1. speed = 1 + 3.9 * presses, cap 525, never decays -> early tapping is worth the most.
  2. Tapping r/s gives distance ~ t + 1.95 r t^2: 5/s finishes in ~22 s, 10/s in ~15 s; ~1.2/s sustained is the minimum.
  3. Mules auto-walk to one shared point (converging lanes); nothing stops a player right-clicking to steer (unprotected).
  4. Fixed 8/7/6... payout, 44 s effective window, 0 for non-finishers.

### Tornado Naga Madness (Ultima-X bundle: Tornado, event #53)
- **Goal (in-game text):** "Tornado Naga Madness — Avoid the Tornado and try to survive!" Secret variant adds a purple
  "R e v e r s e d" line (flag `Secret_Reverse_Siren`, armed by casting Purge on the Free Play Naga Siren; cleared here).
- **Type & scoring:** survival **with ties** (`TiesPossible` + Tie Death: nagas dying in the same instant share a score).
  **No timer at all** (no Survival Expire): runs until one naga (Win) or none (Draw) remains.
- **Arena:** `Tornado` (4960,-13056)-(8064,-11488) = 3104 x 1568 u (24.25 x 12.25 tiles), centre (6512,-12272): a shallow-water
  basin filling the rect, one ~300 x 200 rock just south of centre (~(6620,-12545)) and a lump in the SW. **Fixed overhead
  camera**: bounds `Tornado_Camera` 96 x 96 at (6448,-12176) and camera setup `Naga` re-applied every 0.5 s (target
  (6596,-12175), distance 3890.6, angle of attack 268.8 = near straight down, FOV 70) - the whole basin always in view.
  Starts fixed per slot: radius 800 at angle 45*i (P1 45 deg ... P8 0 deg); slots 2 and 6 land just outside the basin and are
  nudged to its top/bottom edge.
- **Player unit:** per player a coin flip between Naga Siren `nnsw` and Naga Myrmidon `nmyr` - gameplay identical: speed 370,
  collision 12, **no attack**. HP irrelevant (deaths are scripted kills).
- **Hazards / mechanics:**
  - **Tornado** `ntor` (Player 12): speed 220, flying, collision 0, no attack. Every 0.15 s any naga (and any Mur'gul) within
    **100 of a tornado's centre** is killed.
  - Start: 1 tornado at centre heading 5000 u toward angle 22*rand(1..15) deg. When a tornado leaves the rect it is sent 5000 u
    toward a random point in the rect (bounce).
  - **Every 5 s**, for each existing tornado: if the map has <10 tornadoes it always spawns a copy at its position; otherwise
    (<50) with 1/3 chance. The copy flies straight toward where a **random surviving naga** is at that moment.
    Growth 1->2->4->8->~11->... **cap 50** (reached ~60 s in).
  - 15 **Mur'gul Slaves** `nmpe` (Player 12, speed 400, collision 16, no attack) patrol between their random spawn and a random
    point in the rect - moving body-blockers; tornadoes kill them and they are not replaced.
- **Timeline:** T0 ties on, spawn nagas, 1 tornado, 15 Mur'guls, pause, camera, text. T+4 s unpause, variant check, enable
  Survival Death, Tornado_Kills, Tie Death, Tornado_Spawn, Tornado_Mantain.
- **How you lose / win / finish:** touched by a tornado centre -> survival ante; last naga wins.
- **Reversed variant:** every point order by a non-Player-12 unit is re-issued to the point mirrored through the unit (same
  distance, opposite direction); target orders become "move to own position".
- **Computer-player AI:** none; computer nagas stand still until a tornado reaches them.
- **Designer notes:** a tornado forecast panics the naga; learn the pattern, don't get trapped, "it's the origin of the tornado
  that kills"; an "omg run!" dodgeball game (idea by SoulBurner).
- **Remake notes:** kill disc r=100 at the tornado centre; 220 speed vs your 370; population doubling each 5 s to 10 then
  +1/3 per tornado to 50; spawned tornadoes aimed at a random living player; bounce-back at the rect edge; no time limit.

### The Grim Reapage (Ultima-X bundle: Grim, event #54)
- **Goal (in-game text):** "The Grim Reapage — Be the first to level up. Press "W" to cloak."
- **Type & scoring:** race to **hero level 3**, **ante forced to 8** (8, 7, 6 ... in levelling order). 150 s timer (6 s frozen);
  on expiry (`Grim_Expire`): Finish if anyone levelled, else Draw; respawns stop and every unfinished wraith is killed (0 pts).
  No Race Death (dead wraiths stay in the race while waiting to revive).
- **Arena:** `Push_the_Ogre` (-2176,3456)-(-864,4736) = 1312 x 1280 u (10.25 x 10 tiles), centre (-1520,4096); walkable
  floor is an open octagon ~1536 x 1536 slightly larger than the camera rect. Midnight (0:00, clock frozen), heavy rain.
  **All players unallied with NO shared vision** (only game here that does this). Starts fixed: radius 400 at 45*i deg.
- **Player unit:** Wraith `E001` hero (white Draenei model): speed 320, collision 32, **10 HP**, attack 16 (hero type),
  cooldown 1.7, range 100, **acquire range 100**, regen 0.5 at night. Set to **level 2** (200 XP). **XP handicap 0 %** for all
  players, so normal kill XP is off; only the scripted grants below count (the game relies on AddHeroXP ignoring the handicap).
  **Night Merge** (`A00D`, Wind Walk base, hotkey W): 0 mana, **cooldown 5 s**, lasts **60 s** on heroes, 0.9 s fade,
  +10 % speed (352), +40 backstab; attacking breaks it. Auto-cast at start and on every respawn.
- **Hazards / mechanics:**
  - **Children** `nvlk` (Player 12): one per playing player, spawned at random points in the rect at T+6 s; speed 190, 10 HP,
    no attack, wander. Each kid death: killer **+25 XP**, a replacement kid spawns at a random point (kid count constant).
  - **Wraith killed:** killer **+40 XP**; the victim revives **10 s** later at a random point, re-cloaked, camera panned + selected
    (removed instead if its owner left).
  - Level 3 = 500 XP (WC3 default table) -> **300 XP needed**: 12 kids, or e.g. 5 wraiths + 4 kids.
  - Levelling fires `Whack_Finish` (reused from Whack-a-Fiend): Race Finish, teleport-out.
- **Timeline:** T0 rain, ante 8, spawn wraiths, alliances, XP handicap 0, level 2, add Night Merge, pause, camera, midnight,
  150 s timer, text. T+6 s cloak order, spawn kids, unpause, cloak again, enable Whack_Finish / Grim_Kill / Grim_Respawn_All.
- **How you lose / win / finish:** first to level wins 8; later levellers 7, 6 ...; the rest score 0 at 150 s.
- **Computer-player AI:** none; computer wraiths only swing at something that walks within 100 u.
- **Designer notes:** immortal reapers hunt a camp of kids; stay hidden, ambush wraiths that are killing kids, re-hide right after
  a kill; "Having a revival option troubled me ... But it worked"; "I -really- like this one."
- **Remake notes:** 1-hit kills everywhere (10 HP vs 16 dmg); invisibility with 5 s re-cloak and reveal-on-attack; +25 kid /
  +40 wraith XP, 300 XP to win; 10 s respawn at random spot; no shared vision; fixed 8/7/6 payout.

### Typing Terror / Typing Catastrophe (Ultima-X bundle: Typing_Terror, event #55)
- **Goal (in-game text):** "Typing Terror — Type what Mannoroth tells you! (DO NOT TYPE ANYTHING ELSE)". Title becomes
  **"Typing Catastrophe"** when `Secret_Bloodlust_Mannoroth` is set (Bloodlust cast on the Free Play Mannoroth); that variant
  adds symbols/digits to the pool. (This init does not clear the flag; Next Event does.)
- **Type & scoring:** survival **with ties** (TiesPossible + Tie Death; everyone killed at the same deadline shares one score).
  **No timer**: rounds continue until <=1 player remains (Win) or all remaining fail together (Draw, shared score).
- **Arena:** `Obey_Archimonde` (5696,3424)-(6848,4448) = 1152 x 1024 u (9 x 8 tiles), camera bounded to it. Eight 128 x 128
  pedestals `Obey_1..8` in two rows (y 3744 and 3520; x 5888, 6144, 6432, 6688); Fel Orc Grunts assigned randomly to them.
  Mannoroth (Pit Lord `Nman`, level 10, scale 1.7, Player 12) stands on a raised platform at (6272,4256). **Every unit stays
  paused all game** - pure scenery.
- **Player unit:** Fel Orc Grunt `nchg` - an avatar only (never unpaused).
- **Hazards / mechanics (chat input):**
  - Round loop: 0-0.25 s tick, wait 2 s, length L += 2 (L starts at -1 -> **1, 3, 5, 7, 9 ... characters**), build a random
    lower-case string, mark all 8 slots "in trouble", show "Mannoroth: type <string>" for 5 s, then a **5.5 s window**
    (Real_Speed 5 + 0.5; it **never shrinks**). At the deadline everyone still in trouble is killed. Next string ~2-2.25 s later
    (cycle ~7.6 s; first string ~6.1 s after start).
  - Every chat message from players 1-8: lower-cased; if it equals the current string you are safe this round (flash effect);
    **anything else kills all your units instantly** - including chat between rounds (only the previous string is still safe).
  - Pool: "abcdefgihklmnopqrstuvwyz" with index 1..len-1, so **23 letters: no j, x, z**. Catastrophe pool adds
    `@#$%^&";234567890~\` (the final `?` is never picked; no `1`) = 43 characters.
  - Deaths: lightning bolt + explosion + camera quake 500.
- **Timeline:** T0 ties on, L = -1, spawn grunts + Mannoroth, camera, pause, text. T+4 s enable Survival Death, Tie Death and
  the typing triggers; first string at ~T+6.1 s.
- **How you lose / win / finish:** wrong message or deadline -> eliminated (survival ante, simultaneous = shared); last typist wins.
- **Computer-player AI:** none; computers never chat, so all die together at the end of round 1 (shared score).
- **Designer notes:** Mannoroth's twisted gibberish-typing game; check spelling early, later only the fastest keyboards survive;
  "one of those YAY! or Not this one! games".
- **Remake notes:** string length 2n-1 with a fixed 5.5 s window; case-insensitive exact match; any other message = death;
  23-letter pool (no j/x/z), 43-char hard pool; batch eliminations share a rank.

### Rampage With Wolves / Hyper Canine (Ultima-X bundle: Wolves, event #56)
- **Goal (in-game text):** "Rampage With Wolves — Fetch the grass, and return to the circle of power! Avoid the Wolves."
  **"Hyper Canine"** is the variant when `Secret_Bloodlust_Wolf` is set (Bloodlust cast on the Free Play wolf; cleared here).
- **Type & scoring:** race, **ante forced to 8** (8, 7, 6 ...). 120 s timer from game start (4 s frozen); Race Expire kills the
  rest (0 pts); Race Death: eaten sheep score 0; when no sheep remain -> Finish (someone scored) or Draw.
- **Arena:** camp `Wolfy_Camp` (7744,576)-(9056,2272) = 1312 x 1696 u (10.25 x 13.25 tiles), camera bounded to it. Grass zone
  `Wolfy_Item` (8384,2720)-(8544,2848) 160 x 128 to the north; goal `Wolfy_Finish` (8320,96)-(8480,224) 160 x 128 to the south
  with a Circle of Power at (8400,160). Pathing: southern field (y ~30-1090, x ~7710-9185), a **640 u gate** at y ~1120-1185
  (x ~8130-8770), northern field (y ~1250-2300), a ~700 u corridor north to the grass pocket (y ~2330-3070). Round trip
  ~5,150 u (~27 s at sheep speed).
  Starts fixed: slot i at (7850 + 150*(i-1), 260), facing north.
- **Player unit:** Sheep `nshe`: speed 190, 15 HP, collision 15, no attack, **1 inventory slot** (drops its item on death).
- **Hazards / mechanics:**
  - **8 Patches of Grass** (`I000`) at random points in `Wolfy_Item` - always 8, regardless of player count.
  - **28 Hungry Wolves** `nwlt` (Player 12) at random points in the camp: speed 350, collision 32, scale 0.75, no attack,
    Wander. Every **2 s** (Hyper Canine: every **0.25 s**) one random wolf is ordered to move to a random point in the camp.
  - Every 0.05 s any sheep within **80** of a wolf is killed (grass drops where it died).
  - Entering `Wolfy_Finish` while holding grass: grass removed, Race Finish (score, teleport-out).
- **Timeline:** T0 music, ante 8, rain, variant text/trigger, spawn sheep, grass, wolves, pause, circle, 120 s timer, camera.
  T+4 s enable Race Death / Expire / Finished / Kills, unpause.
- **Computer-player AI:** **computers get no sheep** (spawn only for MAP_CONTROL_USER) - they sit the game out with 0.
- **Designer notes:** winter sheep need the grass up north past the wolves; "know when to stop and keep your distance";
  inspired by Run Kitty Run / Dodge the Sheep.
- **Remake notes:** proximity death r=80 every 0.05 s; 28 wanderers plus one random redirect per 2 s (0.25 s hard); carry-one
  item, drops on death; fixed 8/7/6 payout; 120 s.

### Tower Attack / Take your time, Doby (Ultima-X bundle: Tower_Attack, event #57)
- **Goal (in-game text):** "Tower Attack — Build towers to kill your opponents." Variant **"Take your time, Doby"** (flag
  `Secret_Cripple_Tower`, armed by casting Cripple on the Free Play Tower Builder; cleared here) only changes the timer.
- **Type & scoring:** survival (Survival Death + Survival Expire), no ties flag. Timer **210 s** (variant **900 s**) from game
  start (3 s frozen); expiry: survivors share the current ante, Draw. When a builder dies, Survival Death also **kills all of that
  player's structures**.
- **Arena:** `Push_the_Ogre` (same as Grim: 1312 x 1280 camera rect inside an open ~1536 octagon). Time 7:00.
  Starts fixed: radius **800** at 45*i deg, i.e. on the arena rim (orthogonal slots nudged inside the wall).
- **Player unit:** Tower Builder `nhew` (High Elf peasant): speed 190, **25 HP** (medium armour 0), collision 16, **no attack**.
  Repair (standard). **Anti-Magic Shield** (`A01C`, hotkey A, cooldown **20 s**): War Stomp base with 0 damage and a 0.01 s stun
  (cosmetic); trigger spawns a dummy that casts Anti-magic Shell on the builder: **10 s magic immunity** (Magic Towers can't hurt it).
- **Towers** (0 gold, 0 lumber, no food; builder race human so it presumably stands and builds; build list also names `o003`,
  which doesn't exist in the map):

  | Tower (hotkey) | Build | Life after built | HP / armour | Attack | Range (acquire) | Notes |
  |---|---|---|---|---|---|---|
  | Arrow `o005` (A) | 6 s | 26 s | 20 unarmoured | 4 pierce / 1 s | 225 (250) | air+ground; **Spell Immunity** |
  | Siege `h00A` (S) | 14 s | 34 s | 20 heavy | 6 siege / 1.5 s, splash 50/100/125 (100/50/10 %) | 550 (600) | ground only, missile 300 |
  | Magic `o002` (M) | 11 s | 31 s | 10 unarmoured | 2 magic / 1.75 s | 800 (900) | air+ground |

  Shots to kill (1.26 table): Arrow kills Magic 2, Siege 5, Arrow 4, builder 9. Siege kills Arrow 3, Magic 2, Siege 4, builder 9.
  Magic kills Siege 5, Magic 5, builder 17, **Arrow never** (spell immune), shielded builder never. Siege splash lists no
  enemy-only flag, so it probably hurts your own stuff too.
- **Hazards / mechanics:** `Tower_Stop` - any structure given **Stop** is removed on the spot (gold-coin effect, no refund);
  `Tower_Time` - timed life starts when construction finishes.
- **Timeline:** T0 spawn, pause, camera, 7:00, timer, text. T+3 s enable Survival Death/Expire, Tower_Ability/Stop/Time, unpause.
- **How you lose / win / finish:** builder dies (your towers die with it); last builder wins; timeout ties survivors.
- **Computer-player AI:** none; computer builders idle and die to whatever towers get built in range.
- **Designer notes:** egocentric elf peasants bet on who survives a field full of towers; Arrow shocks Magic, Siege assaults Arrow,
  Magic snipes Siege; "in honor of those Preschool maps".
- **Remake notes:** rock-paper-scissors via range (800 > 550 > 225) and armour; towers are temporary (26/34/31 s) so rebuilding is
  constant; 25 HP builders; 10 s / 20 s-cooldown anti-magic self-shield; Stop = delete own tower.


## Uther Party Ultima-X: events 58-65 (games not in 4.0)

Sources: `ultx/bundles/058..065`, `ultx/j.txt`, the map's merged SLKs in `ultx/Units/` (ability data fields decoded with
the 1.26 AbilityMetaData), `ultx/war3mapMisc.txt`, `ultx/war3map.w3e/.wpm/.doo` (terrain, pathing, destructables),
`ultx/quests.txt`. Map constants that matter here: **MinUnitSpeed = 0, MaxUnitSpeed = 525** (war3mapMisc.txt), so
`SetUnitMoveSpeed` can hold any value 0..525. Damage tables are the 1.26 defaults (pierce: light/"small" 200 %, hero 50 %;
chaos 100 % vs everything); armour reduction 0.06a/(1+0.06a); hero armour = def - 2 + 0.3*AGI.
None of these eight games has a computer-player AI trigger (no `MAP_CONTROL_COMPUTER` check in any of them).
"Periodic" triggers are registered at map init, so the first tick after a game enables them lands anywhere in 0..period.
Survival scoring, Tie Death and Survival Expire are the framework triggers (see FRAMEWORK.md). Secret variants are armed in
Free Play by `Free Secret Variants` (casting a specific spell on the matching Free Play display unit) and are cleared by Next Event.

---

### Stomp of Doom / At least 100 Stomps of Doom (Ultima-X bundle: Stomp_of_Doom, event #58)
- **Goal (in-game text):** "Stomp of Doom — Stomp to kill your opponents." Secret variant title: "At least 100 Stomps of Doom"
  (armed by casting Bloodlust on the Free Play Doom Stomper; `udg_Secret_Bloodlust_Stomp`).
- **Type & scoring:** survival (Survival Death + Survival Expire). Ties not enabled (`TiesPossible` stays false). 150 s timer
  (started 0.5 s into the game, so ~146.5 s of play); on expiry all survivors share the current ante. No ante tricks.
- **Arena:** `Destruction_Dance` 960 x 960 u (7.5 x 7.5 tiles), flat, fully walkable, no doodads. Camera locked to it. Night (time 19:00).
  Player i spawns 450 u from centre at angle 45*i deg (P1 45, P2 90 ... P8 360), facing centre (neighbours 344 u apart).
- **Player unit:** Doom Stomper `n001` (Doom Guard model, scale 0.8): speed 200, turn 0.4, collision 48, 1000 HP, regen 0.5,
  **no attack** (weapons disabled). Has **Ghost (Agho): permanent invisibility**; players are all mutual enemies with no detection,
  so you never see opponents. Ability **Stomp of Doom** `A00F` (War Stomp base): no target, radius 150, 5000 damage (one-shots),
  3 s stun, cooldown 10 s, no mana, unit cast point 0.5 s. Given only when the game unpauses.
- **Hazards / mechanics:**
  - *Visible:* every spell effect puts a WarStomp flash at the caster's position (0.05 s then destroyed) — the only way to locate an
    invisible stomper.
  - *Harass (decoys):* every 4 s, 25 % chance, a fake WarStomp flash at a random point 300-500 u from centre (random angle),
    destroyed after 2 s. Points past 480 u on the axes lie outside the arena.
  - *Deathmatch:* every 2 s, if exactly 2 living units are in the arena: "DEATH MATCH MODE!", every stomper loses A00F, gains
    **Stomp of Ultimate Doom** `A00H` (same stats, **cooldown 1.5 s**) and speed becomes default+100 = **300**. Fires once.
- **Timeline:** t0 music, time 19:00, units created, text. t0.5 pause all, 150 s timer. t3.5 unpause, add A00F, roar sound,
  Deathmatch check enabled (so a 2-player game goes Deathmatch within ~2 s). Secret variant: Deathmatch is executed at t3.5.
- **How you lose / win / finish:** you die when inside an enemy stomp's 150 radius. Last stomper alive wins; timer expiry = shared draw.
- **Computer-player AI:** none. Computer stompers stand still and never stomp.
- **Designer notes:** You are permanently invisible and only your stomp flash is seen, so every stomp gives your position away.
- **Remake notes:**
  1. Invisible players; a stomp shows a flash at the stomper for everyone; stomp = instant kill within 150 u, 10 s cooldown.
  2. Random decoy flashes (25 % every 4 s, ring 300-500 u, 2 s).
  3. Duel mode at 2 alive: cooldown 1.5 s, speed 200 -> 300.
  4. Secret variant starts in duel mode.
  5. Oddity: harass destroys `bj_lastCreatedEffect` after 2 s, which a real stomp may have overwritten (effect leak, cosmetic only).

---

### Wild East Duel (Ultima-X bundle: Clock, event #59)
- **Goal (in-game text):** "Wild East Duel — LEFT-Click the tower as soon as you believe the time has passed up."
  Floating text over the tower: "Click me after N seconds have passed!", then "BEGIN".
- **Type & scoring:** timing contest, scored as survival (Survival Death + **Tie Death, TiesPossible = true**). No timer, no expiry.
  Players are eliminated worst-first, so the smallest error scores highest; equal errors die together and share a score.
- **Arena:** `Mortar` (Hot Mortar's arena) 1536 x 1536 u (12 x 12 tiles). Tower at centre. Shamans at the centres of the 256 x 256
  sub-regions Mortar_1..8: (-2560,-512), (-1664,-128), (-1280,-1024), (-2176,-1408), (-2176,-128), (-1280,-512), (-1664,-1408),
  (-2560,-1024), facing centre. Shamans are created for neutral-passive and **handed out at random** by Next Event, so the seat is random.
- **Player unit:** Shaman `oshm` (335 HP). **Paused for the whole game** — nothing to control. The only input is selecting the
  Arcane Tower `hatw` (owned by Player 12, paused).
- **Mechanics:**
  - `N = GetRandomInt(4, 10)` whole seconds, shown in red.
  - At BEGIN a counter `Real_Reflex` starts: +0.01 every 0.01 s periodic event (a tick counter, not a clock).
  - Your first selection of the tower while you are still "in trouble" records `value = counter`, `error = |counter - N|`,
    sign "+" if late or exact, "-" if early; floating text "Stopped at 7.23  +0.23" (each number cut to 4 characters) above
    your shaman. One click per player (you leave the InTrouble force).
  - Every death also triggers the Typing Terror death effect: lightning bolt + explosion + camera quake 500.
- **Timeline:** t0 text, everything paused. t4 tower text "Click me after N seconds..."; **the click trigger is already live from t4**
  (a click before BEGIN records 0.00, i.e. error N, the worst possible early error). t8 "BEGIN", switch sound, thunderclap,
  counter runs. t23 (BEGIN+15 s) counter stops; every player who never clicked is killed ("X never clicked at all!") and the tower
  dies. t25 **Sort**: find the largest error among living shamans; kill everyone with exactly that error ("X had a margin error of E").
  Repeat every 3 s while more than 1 shaman lives.
- **How you lose / win / finish:** worst error dies first; the last shaman (smallest error) wins. If the final players tie exactly,
  all die at once and the game is a Draw (they still share the tie score).
- **Computer-player AI:** none. Computer players never click, so they die at BEGIN+15 s tied for last.
- **Designer notes:** Stand still, hover over the tower and count aloud. Reworked because in the old version only the host could win.
- **Remake notes:**
  1. Hidden target 4-10 s, one click per player, window 15 s after BEGIN; measure real elapsed time (the original is a
     0.01 s tick counter and drifts under load).
  2. Non-clickers all die first, tied. Then eliminate largest |error| one tier every 3 s, exact ties die together.
  3. Show "Stopped at X  +/-E" after each click (public).
  4. Oddities: clicks during the 4 s preview (before BEGIN) are accepted and score error = N. A player killed earlier whose stored
     error equals the current worst is "killed" again (harmless extra message).

---

### Mosquito Swarm (Ultima-X bundle: Mosqui, event #60)
- **Goal (in-game text):** "Mosquito Swarm — Be the last one standing. Attack the ogre to recover HP!"
- **Type & scoring:** survival; **TiesPossible = true** (mosquitoes dying on the same drain tick share a score). **No timer**
  (Survival Expire not enabled): the game runs until one mosquito is left.
- **Arena:** `Push_the_Ogre` 1312 x 1280 u (~10 x 10 tiles), flat, open (4 tree walls + 2 shrubs in the rect; irrelevant to fliers).
  Player i spawns 400 u from centre at angle 45*i, facing centre. The ogre stands at the centre.
- **Player unit:** "Mosquito" `owyv` (wyvern model, scale 0.2): **flying** (height 240), speed 350, turn 0.4, collision 8, 1000 HP,
  regen 0. Attack: 1 damage (0 + 1d1), pierce, range 130, cooldown 0.35 s but damage point 0.6 s (so a real hit about every 0.6 s),
  targets ground only (mosquitoes cannot hit each other). Ability **Mosquito Bite** `S000` (item life steal, AIva): **heals 10x the
  damage dealt**. Against the ogre (armour type light: pierce 200 %) each hit does 2 damage and heals **+20 HP**.
- **Hazards:**
  - *Drain:* every 1 s every mosquito loses 25 HP (`SetWidgetLife`, can kill). Unfed life = 40 s.
  - *Ogre Mauler* `nogm` (Player 12, scale 3): 5000 HP, **regen 500/s** (effectively unkillable), speed 30, turn 0.1, melee
    200 damage (normal vs light 100 %), range 80, cooldown 3.5 s, targets air, acquisition range 100. It fights back against
    attackers with WC3's default response; 5 hits kill a full mosquito.
- **Timeline:** t0 units, pause, text. t3 unpause, drain + Survival/Tie Death enabled, ogre sound.
- **How you lose / win / finish:** HP reaches 0 from drain or ogre. Last mosquito alive wins.
- **Computer-player AI:** none. Computer mosquitoes idle (acquisition 100, they start 400 u away), never feed, and die after ~40 s.
- **Designer notes:** The ogre strikes back hard; let someone else take the hit, then swarm in, and fly off when you are the target
  so the ogre switches to someone else.
- **Remake notes:**
  1. HP drain 25/s from 1000; each bite on the ogre +20 HP at about 1 bite / 0.6 s (net roughly +8 HP/s while biting; flag:
     the effective attack rate depends on WC3's cooldown vs damage-point rule).
  2. The ogre is invulnerable in practice, crawls at 30 u/s, and swings 200 every 3.5 s at its current attacker (reach 80 vs your 130).
  3. Mosquitoes cannot hurt each other; the only interaction is ogre aggro.
  4. No time limit.

---

### Ghostly Gambit (Ultima-X bundle: Ghostly, event #61)
- **Goal (in-game text):** "Ghostly Gambit — Be the last one standing. Right-click neutral banshees to regain HP!"
- **Type & scoring:** survival; **TiesPossible = true**. **No timer.**
- **Arena:** `Destruction_Dance` 960 x 960 u (7.5 x 7.5 tiles), flat and empty. Midnight. 8 player ghosts are made for neutral-passive
  at 400 u from centre, angle `135*i - 22.5` (i = 1..8, giving the 8 points 22.5 + 45k in star order), facing centre, then
  **handed out at random**. **40 extra neutral ghosts** at uniform random points (random facing).
- **Player unit:** Ghost `ngh1` (banshee): **speed 1** (basically immobile; map min speed is 0), hover, collision 16, 100 HP,
  regen 0, 250 mana, **mana regen 0**, no attack. After the intro your ghost gets Spell Immunity `ACmi`, **Possession** `A00I`
  and is tinted to 30 % (dark = player-owned).
  **Possession** `A00I` (Firebolt base, 0 damage, 0.01 s stun): range 250, **cost 250 mana (= one cast per body)**, cooldown 0,
  targets neutral/enemy organic units; unit cast point 0.5 s. Enemy players' ghosts are spell immune, so only neutral banshees
  can be taken.
- **Mechanics:**
  - *Possess (on spell effect):* the target becomes yours, joins KeyUnits, gets ACmi + A00I + dark tint and is selected; the old body
    is **removed** (no death, it does not return to the pool). A dummy fires a cosmetic missile (2 chaos damage) at the new body.
  - *Restrict:* any target or point order you give is rewritten into a Possession order on the clicked unit, so right-click = possess
    and you cannot walk.
  - *HP Leech:* every 1 s every key unit loses 20 HP -> any body lasts at most 5 ticks (4-5 s). Fresh neutral bodies have 100 HP.
- **Timeline:** t0 ghosts, pause, text. t5 abilities added, unpause, Possess/Restrict/Tie Death on. t7 Leech starts.
- **How you lose / win / finish:** your body hits 0 HP from the leech (no neutral banshee within 250 u, or you were too slow).
  Last player standing wins; simultaneous deaths share a score. The pool (40) only shrinks, so the game always ends.
- **Computer-player AI:** none. Computer ghosts never possess and die on the 5th leech tick (~t12).
- **Designer notes:** Plan possessions to cut opponents off from the remaining ghosts, and possess quickly before your health runs out.
- **Remake notes:**
  1. Static pieces; the "move" is to jump into an unclaimed neutral within 250 u, which resets you to 100 HP and uses that neutral up.
  2. Drain 20 HP/s on a global 1 s tick; 0.5 s cast.
  3. 40 neutral + N player pieces in a 960 u square; about 10 pieces within 250 u at the start, sparse late.
  4. Player bodies cannot be taken (immune). Old bodies vanish.
  5. Oddity: Restrict also rewrites the dummy's attack order (the rewrite fails, so the attack still happens).

---

### The Soul Exchange (Ultima-X bundle: Soul, event #62)
- **Goal (in-game text):** "The Soul Exchange — Survive as long as possible!"
- **Type & scoring:** survival; no ties. **150 s timer** started at t0 (5 s of it is the intro, so 145 s of play); on expiry the
  survivors share the ante.
- **Arena:** `Crab_Island` 1280 x 1280 u (10 x 10 tiles): open, walkable (99 %), a 128 x 128 blocker at the centre, shallow water
  patches, lily pads and shrubs (non-blocking). Player i spawns 600 u from centre at angle 45*i, random facing.
- **Player unit:** Ice Revenant `nrvi` (scale 1.3): speed 300, hover, collision 31, **250 HP, regen 0**, armour 4 (large).
  Attack 25-29 chaos (after armour ~20-23), range 128 (melee), cooldown 1.35 s, damage point 0.6. Ability **Soul Displace** `A00J`
  (Finger of Death base, 0 damage): unit target, range 600, **casting time 3 s** (plus cast point 0.5), **cooldown 10 s**, no mana;
  targets any non-hero unit (no allegiance flag set).
- **Mechanics (on spell effect):** the caster's body and the target's body **swap owners** (colours swap too); each player gets their
  new body selected and the camera snapped to it. HP, position and **cooldowns stay with the body**, so you take their HP and their
  cooldown state, and they get your battered body with a fresh 10 s cooldown. Visuals only: blink flashes on both, a 0-damage
  chain lightning from a dummy, Finger of Death lightning.
- **Timeline:** t0 units, timer, text, pause. t5 unpause, go.
- **How you lose / win / finish:** whoever owns a revenant when it dies is scored. Last owner alive wins; at 150 s everyone alive ties.
- **Computer-player AI:** none; computer revenants only auto-attack enemies inside acquisition range (500).
- **Designer notes:** Let yourself get beaten, then swap into whoever has the most health. (The idea came from beta-testing Ghostly
  Gambit when player banshees lacked spell immunity.)
- **Remake notes:**
  1. Melee brawl, 250 HP, no regen, ~21 damage per 1.35 s.
  2. Swap = 3 s stationary channel at range 600 (interruptible by moving), then the two players exchange bodies.
  3. Cooldown belongs to the body: taking a ready body lets you chain-swap.
  4. Ownership, not the unit, decides who is eliminated.
  5. 150 s time limit, draw for survivors.

---

### Winter's Equinox (Ultima-X bundle: Icicle, event #63)
- **Goal (in-game text):** "Winter's Equinox — Survive as long as possible!"
- **Type & scoring:** survival; **TiesPossible = true**. **No timer** (runs until one is left).
- **Arena:** `Icicle` 1280 x 1280 u (10 x 10 tiles), flat snow, midnight. 45 Snowy Tree Walls (WTst) plus 6 Northrend Canopy Trees
  line the top, left and right edges; 4 Thorny Vines doodads (blocking, 4x4 pathing) at (-4672,-9472), (-3776,-9472), (-4736,-9792),
  (-4736,-10240). All destructables in the rect are restored at start (Flame Strike can burn trees). Player i spawns 200 u from
  centre at angle 45*i.
- **Player unit:** Icicle `h00D` (wisp model): speed 270, collision 31, **50 HP, regen 0**, armour 2, no attack.
  **Blink** `A00P`: up to 400 u, cooldown 3 s, free. Size = HP: every 2 s scale is set to HP*3 % (150 % at full, 30 % at 10 HP).
- **Hazards:** "Spirit" `H00F` (Blood Elf hero model, scale 0.6, **invulnerable**, speed 100, Player 12) with **Flame Strike** `AHfs`
  (map-modified): casting time 1 s (the ember "signal" shows at the target during it), radius 170, range 2000, no cooldown or mana.
  Damage: 5 per 0.33 s (~15/s, per-target cap 90) in the pillar, then 2 per 1 s from lingering flames; total effect duration 9 s
  (full-damage phase uses the 2.67 s field; standard Flame Strike behaviour). Standing in the pillar kills a full icicle in ~3.3 s.
  - *Cast:* every 1.6 s every Spirit is ordered to Flame Strike a uniform random point in the arena (~one strike per Spirit per 1.6 s).
  - *Spawn:* every 15 s, if fewer than 8 Spirits exist, one more appears at a random point.
- **Timeline:** t0 units, trees restored, pause. t5 unpause, first Spirit spawns and strikes at once. One more Spirit every 15 s
  (the first extra lands 0-15 s after t5 because the periodic timer runs from map init), so 8 Spirits by about t95-t110, then
  about 5 strikes per second.
- **How you lose / win / finish:** HP 0 from flames. Last icicle wins; same-instant deaths tie.
- **Computer-player AI:** none; computer icicles stand still until burned.
- **Designer notes:** Run as soon as you see the flame signal; the other icicles' size shows how well they are doing. (Survival
  version of "Ice Core" from FriendlyWarlord's Pyramid Escape.)
- **Remake notes:**
  1. Random telegraphed AoE circles (170 u, 1 s warning) from a growing number of invulnerable casters (1 + 1 per 15 s, max 8,
     one strike each per 1.6 s).
  2. Lingering fire zones that last several seconds.
  3. 50 HP, no regen; body size shows HP.
  4. 400 u blink, 3 s cooldown.
  5. No time limit.

---

### The Assassin's Cove / The Assassin's Creed (Ultima-X bundle: Rogue, event #64)
- **Goal (in-game text):** "The Assassin's Cove — Kill your opponents. Stand behind them and Assassinate them."
  Secret variant (Cripple cast on the Free Play assassin): "The Assassin's Creed — ... Stand in front of them and Assassinate them."
- **Type & scoring:** survival; no ties; **150 s timer** from t0 (145 s of play), survivors share on expiry. Dissipate on (dead heroes removed).
- **Arena:** `Rogue` 1408 x 1376 u (11 x 10.75 tiles), flat and open, midnight. Player i spawns 500 u from centre at angle 45*i, random facing.
  **Edge "bumpers"** (Player 12, invulnerable, unselectable, immobile), all targeting ground:
  - 4 corner Bumpers `h009` (visible orb) at (-4784,-11088), (-3520,-11072), (-3552,-12336), (-4784,-12368): 51-52 pierce, range 90, every 1 s.
  - 40 invisible Moving Bumpers `h00H` (despite the name they never move): 10 per side at 130 u spacing, running from each corner
    (top edge eastward, right edge southward, bottom edge westward, left edge northward), 11-12 pierce, range 50, every 1 s.
    Pierce vs hero is 50 %, so an assassin (armour ~4) takes ~21 per corner shot and ~4.5 per edge shot.
- **Player unit:** Assassin `Ewar` (Warden hero model): speed 320, turn 0.4, collision 32, **100 HP, regen 0**, no attack.
  **Assassinate** `A00Q` (Purge base): unit target, range 100, **cooldown 3 s**, cast point 0.25, can target enemies **or yourself**.
  **Blink** `A00O`: up to 500 u, cooldown 5 s, free.
- **Mechanics (on spell effect):** self-target = you die ("-suicide-"). Otherwise, compare facings (the caster has just turned to face
  the target, so this is really a position test):
  - Cove: kill if `casterFacing` is in `[targetFacing-45, targetFacing+45]` (you are behind them in a 90 deg cone): "Success!", else "Miss".
  - Creed: kill if `casterFacing` is in `[targetFacing+135, targetFacing+225]` (face to face).
- **Timeline:** t0 units, bumpers, timer, pause. t5 unpause, ability live.
- **How you lose / win / finish:** assassinated, killed by bumpers, or suicide. Last assassin wins; expiry = shared.
- **Computer-player AI:** none; computer assassins stand still (easy back-stabs).
- **Designer notes:** An attack only works from behind: blink behind and strike; wardens busy chasing others are good targets.
- **Remake notes:**
  1. One-shot back-stab: range 100, 90 deg rear cone, 3 s cooldown, a miss still costs the cooldown.
  2. 500 u blink, 5 s cooldown.
  3. Damaging edges (light chip damage) and corners (heavy damage).
  4. 150 s limit.
  5. **Bug:** facings are 0..360 with no wrap-around. In Cove the cone is clipped when the target faces within 45 deg of east (0/360).
     In Creed, a target facing more than 225 deg **cannot be killed at all**, and one facing 135-225 has a clipped cone. Use proper
     angle differences in a remake unless you want to reproduce this.

---

### Energy Blitz / Energy Madden / Energy Within (Ultima-X bundle: Energy, event #65; quest title "Electrical Blitz")
- **Goal (in-game text):** "Energy Blitz — Kill your opponents. Attack by pushing the Energy Bolt."
  Secret variants (armed in Free Play on the Snap Dragon): **Madden** (bloodlust) = 4 extra bolts; **Within** = invisible dragons
  ("Electrical Bolt"), exclusive with Madden; **Reversed** (independent, can stack): point orders are mirrored through your unit
  and target orders are cancelled.
- **Type & scoring:** survival; no ties; **180 s timer** from t0 (175 s of play), survivors share on expiry.
- **Arena:** `Energy` 1408 x 1280 u (11 x 10 tiles), walled box. Walkable floor about x -2560..-1280, y -10624..-9472 (1280 x 1152).
  4 bounce strips: top `Energy_1`, left `Energy_2`, bottom `Energy_3`, right `Energy_4`. The bolt bounces inside
  x -2510..-1394, y -10510..-9554 (~1116 x 956). Dragons are created for neutral-passive 500 u from centre at 45*i (random facing)
  and **handed out at random**.
- **Player unit:** Snap Dragon `nsnp`: speed 350, turn 0.5, collision 32, **500 HP, regen 1/s**, no attack, no abilities
  (Within: Ghost = permanent invisibility).
- **The Energy Bolt `h00G`** (Player 12, locust, invulnerable; a wisp orb). Its "speed" is stored as its move speed (0..525):
  - *Move (every 0.05 s):* decelerate by -10 if speed >= 400, -5 if >= 100, else -1.5. If speed >= 50 it moves speed/5 u along its
    facing (= 4 x speed u/s) with a spark effect; if it is outside the arena it steers toward the centre instead. Below 50 it is at rest.
  - *Bounce:* entering a strip replaces the bolt 50 u inside the strip edge with a mirrored facing (360-f for top/bottom, 180-f for
    left/right), same speed.
  - *Contact (every 0.1 s, radius 150 bolt-to-dragon):* if speed >= 50, each dragon in range **loses HP equal to the current speed**
    (red number shown), speed -100 per dragon hit, and **all bolt contact checks pause for 0.5 s**. If speed < 50 (at rest), a dragon
    in range **pushes** it: the bolt reappears 155 u in front of that dragon, aimed along the dragon's facing, speed **500**
    (if several are in range, the last one enumerated wins).
  - One push travels ~4,200 u (~5 s: 0.55 s above 400, 2.95 s from 400 to 100, 1.5 s down to 50). A hit straight after a push
    does ~490, so two quick hits kill.
  - A 2nd bolt appears at the centre at t60 (lightning strike) unless the game is over. Madden starts with 4 extra bolts 200 u from
    centre at 45/135/225/315 deg (5 total, 6 after t60).
- **Timeline:** t0 units, timers (60 s, 180 s), text, pause. t5 unpause (Reversed announced here), bolt physics on. The first bolt sits
  at the centre until someone pushes it. t60 second bolt.
- **How you lose / win / finish:** HP 0 from bolt hits. Last dragon alive wins; expiry = shared.
- **Computer-player AI:** none; idle computer dragons only "push" a bolt that happens to stop within 150 u of them.
- **Designer notes:** Walls reflect the ball at the mirror angle, and you can only push it when no sparks are coming off it (at rest).
  "It is that Speedball map."
- **Remake notes:**
  1. Push-to-launch ball: at rest (<50) touching it (150 u) launches it 500 along your facing.
  2. Moving ball damages anyone within 150 by its current speed and loses 100 per hit, then a global 0.5 s immunity.
  3. Stepped friction (-200/s, -100/s, -30/s bands); displacement 4 x speed per second; reflective walls.
  4. Second ball at 60 s; 180 s limit.
  5. Oddities: the 0.5 s lockout is global (in Madden one hit freezes every bolt's contacts); push has no owner, so a bolt can hit its pusher after a bounce.


## Uther Party Ultima-X: events 66-71 (Tinker, Peril, Tax, Keep, Strike, Elem)

Sources are `ultx/bundles/066-071`, `ultx/j.txt`, the map's merged SLKs (`ultx/Units/*.slk`, read with
`objdecode.py`), `war3map.w3e/.wpm/.doo` for arena layout, and `ultx/quests.txt`. Derived hero numbers use the
1.26 constants: 25 HP per STR, 0.3 armour per AGI (base -2), 2 % attack speed per AGI, and +1 damage per primary
attribute point. Heroes spawn at level 1. "u" means WC3 units (128 u = 1 tile), and "P12" is Player(11), the brown
scripted owner.

**Common to all six.** None of these games has an `<X> AI` trigger. The only `MAP_CONTROL_COMPUTER` checks in the
script belong to other games, so computer players just stand still (units with a weapon still auto-acquire). All six
use Survival scoring: the first player out gets `9-N` and the winner gets 8.

**Title variants are Free Play secrets.** `Free Secret Variants` sets a flag when the champion casts a spell on a
game's display unit in Free Play: Bloodlust (852101), Drunken Haze (852585), Purge (852111) or Cripple (852189).
`Next Event` clears the flags when you return to the Free Play hub. "Reverse" and "Drunk" are modifiers, not new titles:
- **Reverse:** every point order is mirrored through the ordering unit, and every unit-target order becomes "move to self".
- **Drunk:** camera noise of 800/100, and a random colour flash every 3.25 s.

---

### One Bomb Too Many / One Bomb was enough (Ultima-X bundle: Tinker, event #66)
- **Goal (in-game text):** "One Bomb Too Many: Kill your opponents. Your mines blow up in 3 seconds." The variant reads "One Bomb was enough … Your mines blow up in 10 seconds." You get the variant only if the Free Play champion cast Bloodlust on the Tinker (`udg_Secret_Bloodlust_Tinker`). Otherwise the normal version runs.
- **Type & scoring:** Survival with `TiesPossible=true` and Tie Death, so players killed in the same instant share one ante. The timer is 150 s, and it starts before the 5 s freeze, so you get about 145 s of play. When it runs out, Survival Expire gives every survivor the current ante (they tie).
- **Arena:** `Bombing_Zone` is (-2528,-12800)-(-1120,-11328): 1408×1472 u, about 11×11.5 tiles, centred on (-1824,-12064). The camera is locked to it. Most of the floor is walkable shallow water (heavy rain, water tinted 50 %). There are 8 destructible Northrend trees (`NTtw`, 50 HP) that block movement. Their life is restored at the start, and mines blow them up. Tinkers spawn 500 u from the centre at 45°·slot, as neutral units, and `Next Event` then hands them out to players at random.
- **Player unit:** Demolition Specialist (`Ntin`, a hero) with 270 speed, turn rate 0.6 and collision 32. HP is 100 + 19 STR×25 = **575**. It has no attack. It has one ability, **Mine** (`A00T`, hotkey I, base Silence):
  - point target, range 325, cooldown 0.5 s, no mana cost; the Tinker's cast point is 0.53 s;
  - on spell effect, the script creates a Timed Mine for P12 at the target point, with a random facing;
  - side effect (inferred, not tested): Silence's own 50-radius area still applies, so an enemy hero within 50 u of the target point should be silenced for 8.5 s and unable to lay mines.
- **Hazards / mechanics:**
  - **Timed Mine** (`n003`): 25 HP with -5 HP/s regeneration, so it dies after **5 s**. The tooltip and briefing both say 3 s.
    - When it dies, its `Amnx` ability deals 2000 damage to enemies within 300 u. That is an instant kill, including your own Tinker, because P12 owns every mine.
    - `Tinker_Mine` then kills every other `n003` within **400 u**, which makes a chain reaction. It also kills destructables within 200 u and adds screen-shake (+200 for the first mine, +100 per chained mine).
  - **Deathmatch** (normal version only): every 2 s the script checks whether exactly 2 Tinkers are alive. Once they are, it shows "DEATH MATCH MODE!" and then drops one P12 timed mine at a random point in `Bombing_Zone` every 1.4 s.
  - **Variant:** "Big Timed Mine" (`n00D`, scale 3) with 40 HP at -5/s, so it lasts **8 s** (the text says 10). It deals 2000 damage within 600 u, chains to other big mines within 600 u, and destroys trees within 600 u. The variant has no deathmatch.
- **Timeline:**
  1. Units spawn and the camera locks.
  2. The mine triggers switch on (and deathmatch polling in the normal version).
  3. Everything is frozen for 5 s.
  4. Units unpause. Any Reverse or Drunk modifier is applied now.
  5. Play until one Tinker is left or the clock runs out.
- **How you lose / win / finish:** You lose when a mine explosion kills your Tinker. The last Tinker alive wins. If the last two die in the same blast, it is a draw.
- **Computer-player AI:** None. A computer Tinker never lays mines.
- **Designer notes:** "Chain reactions hurt." The original idea was proximity mines that turned invisible after 3 s; Ancanus switched to timed mines to get more action.
- **Remake notes:**
  - Mine placement: range 325, 0.5 s cooldown, about 0.5 s cast.
  - Fuse 5 s, lethal radius 300, chain radius 400 (all mines, whoever placed them).
  - Mines hurt everyone, including the player who placed them.
  - 2-player deathmatch rain: one random mine every 1.4 s.
  - Destructible cover (trees).
  - Bugs to keep in mind:
    - The deathmatch spawn effect is drawn at stale `udg_Temp_Position` (a removed location), so there is no telegraph at the real spawn point.
    - In a 2-player start, deathmatch can begin during the 5 s freeze, while the Tinkers are paused.

### Hexxing Havoc (Ultima-X bundle: Peril, event #67)
- **Goal (in-game text):** "Hexxing Havoc: Kill your opponents. The units randomly morph into critters."
- **Type & scoring:** Survival. Ties are not enabled. There is a 150 s "Time Left" timer, which includes the 5 s freeze, and when it expires every survivor ties.
- **Arena:** `Polymorph_Peril` is (-544,-10848)-(544,-9696): 1088×1152 u, 8.5×9 tiles, centred on (0,-10272). The walkable floor is about 1024×1024 with 3 tiny blockers. Time of day is 17:00 with weather `MEds`. Starting Furbolgs stand 400 u from the centre at angle `slot·135−22.5`, so the 8 points sit at 22.5°+45k in scrambled order. They are then handed out at random.
- **Player unit:** Start is Furbolg (`nfrl`): 550 HP, speed 300, 18-21 damage. It exists only during the frozen intro, because the first morph runs the moment units unpause.
  - Critters, picked uniformly from 5, and none of them can attack. All five have 0.5 HP/s regeneration (Racoon 0.1), medium armour and collision 0:

    | Critter | HP | Speed | Armour | Ability |
    |---|---|---|---|---|
    | Chicken | 50 | 200 | 0 | none |
    | Crab | 75 | 90 | 3 (large) | none |
    | Frog | 50 | 120 | 0 | Jump |
    | Racoon | 35 | 150 | 0 | Bandit Instinct |
    | Rabbit | 50 | 100 | 0 | Bite |

    - **Jump** (Frog, Blink): max 400, cooldown 3.
    - **Bandit Instinct** (Racoon): 25 % evasion.
    - **Bite** (Rabbit, Storm Bolt base): 1 damage and a **3 s stun**, range 70, cooldown 20.
  - **Hunter Furbolg** (`n007`): 100 HP, speed 150, armour 2 (large), attack 11-14 normal, cooldown 1.35 s, range 100, acquisition 500. Normal damage against medium armour is ×1.5, so it takes about 3 hits to kill a 50-HP critter and about 7 hits for the Crab.
- **Hazards / mechanics:**
  - **`Peril_Morph`**: it runs once at unpause, then periodically. The period is `GetRandomReal(5,8)`, rolled **once at map load**, so it is fixed for the whole session. Each morph does this:
    1. Pick a random living unit that is not the hunter Furbolg, and remember its owner.
    2. Replace every key unit with a random critter, keeping its HP %.
    3. After 0.05 s, turn the remembered owner's new critter into the hunter Furbolg, again keeping HP %.

    So exactly one player hunts at a time. The previous hunter is never picked twice in a row, and with 2 players the role simply alternates.
  - **`Peril_Frog`**: every point order issued by any unit is re-issued as a Blink to the same point. Only the Frog owns Blink, so right-clicking makes the frog hop up to 400 u, then walk while Jump is on cooldown. For other units the re-issue presumably fails silently and they keep their move order.
- **Timeline:**
  1. Spawn, freeze, start the timer.
  2. After 5 s, unpause and morph immediately.
  3. Morph again every 5-8 s (the fixed period) until one player is left or the time runs out.
- **How you lose / win / finish:** You lose when your critter or Furbolg dies, which only a hunter Furbolg can cause. The last player alive wins.
- **Computer-player AI:** None. A computer's hunter still auto-attacks critters within 500 when idle.
- **Designer notes:** Only the Furbolg attacks, but each critter has a perk: speed, defence, evasion, jump or a biting stun.
- **Remake notes:**
  - One "hunter" token rotates every P ∈ [5,8] s. P is random but constant for the session, and it is never the same player twice in a row.
  - HP % carries across morphs.
  - The five critter kits from the table above.
  - Move-click means jump for the Frog.
  - Oddity: the hunter's morph effect plays at the last critter's position, not at the new hunter.

### A Taxing Situation (Ultima-X bundle: Tax, event #68)
- **Goal (in-game text):** "A Taxing Situation: Pay enough tax to appease the lord, don't be the cheapest, or else! You only have 100 gold to last through the whole game."
- **Type & scoring:** Survival run in rounds, like a blind auction.
  - `TiesPossible=true` and Tie Death, so everyone who ties for cheapest dies together and shares one ante.
  - `DoNotEndImmediately=true`, which adds a 5 s pause before Win or Draw.
  - There is no overall time limit. If every remaining player ties, all of them die and the game ends in a Draw.
- **Arena:** `Obey_Archimonde` is (5696,3424)-(6848,4448): 1152×1024 u, 9×8 tiles. 8 immobile villagers stand in 128-u pads (`Obey_1-8`) arranged in two rows of four:
  - y = 3744: x = 5888, 6144, 6432, 6688
  - y = 3520: the same four x values
  - All face north, and they are handed to players at random.
  - Lord Garithos (`Hlgr`, a P12 prop) stands at centre+(0,320) = (6272,4256).
- **Player unit:** Villager (`nvil`) with speed 0. It has three instant, zero-cooldown buttons:
  - **One Gold** (R, Roar base)
  - **Five Gold** (C, Thunder Clap base)
  - **Ten Gold** (T, War Stomp base)

  Each cast moves that much from your gold into `Paying[i]`, but only if you have at least that much. Every player's gold is set to 100 once, and it carries over between rounds. A private multiboard ("Paying:") shows only your own current bid.
- **Hazards / mechanics (`Tax_Judge`, when the 20 s "Payment due" timer runs out):**
  1. Bidding closes. The script works out `cap = min(100, Paying[i])` over living, playing players.
  2. +2 s: a gold pile appears and Garithos says one of 31 random quips.
  3. +2.5 s: every living player with `Paying ≤ cap` is announced as having "only payed a measly amount of N".
  4. +2.5 s: Garithos says one of 12 threats.
  5. +2 s: he plays his attack animation.
  6. +0.2 s: every player in trouble is killed (Holy Bolt and fire effects).
  7. If exactly one player is left, +3 s: "X managed to get a final payment of N".
  8. +3 s: bids reset to 0.
  9. If 2 or more players are alive: "The rest of you! … get paying!" and a new 20 s round starts. A full cycle takes 32.2 s.
- **Timeline:** Intro, then a 4 s wait, then bidding opens with a 20 s timer, then judging (about 12 s), and repeat.
- **How you lose / win / finish:** You lose by being the cheapest bidder, which includes tying for cheapest. Once your gold is gone you can only bid 0. The last player alive wins.
- **Computer-player AI:** None. A computer never pays, so it bids 0 and dies in round 1, together with any human who also paid 0.
- **Designer notes:** You do not have to bid the most, only avoid bidding the least, so budget the 100 gold across rounds. Timer-driven games were painful to implement.
- **Remake notes:**
  - Hidden sealed bids of 1, 5 or 10, from a 100-gold wallet that covers the whole game.
  - Every tie for lowest is eliminated together.
  - 20 s bidding and about 12 s of reveal theatre per round.
  - All players tied means a Draw.
  - The script spells it "payed".

### Keep Away! (Ultima-X bundle: Keep, event #69)
- **Goal (in-game text):** "Keep Away! Survive as long as possible! Stay away from the sapper." The variant title "How I wish you were here" would remove shared vision and give every Mathog Ghost (permanent invisibility). However, `udg_Secret_Invis_Keep` is never set to true anywhere in the script, so **that variant cannot be reached**. The Reverse and Drunk modifiers can be reached by casting Purge or Drunken Haze on the Mathog in Free Play.
- **Type & scoring:** Survival with no ties flag and **no time limit**.
- **Arena:** `Keep_Away` is (-608,-12800)-(1152,-11296): 1760×1504 u, 13.75×11.75 tiles, centred on (272,-12048).
  - The floor is an open walkable box of about 1500×1270, surrounded by an unwalkable wall and sitting about 130 u inside the rect.
  - Time of day is 05:00.
  - Mathogs spawn directly for each player, 300 u from the centre at 45°·slot, facing the centre. The sapper starts at the centre.
- **Player unit:** Mathog (`omtg`) with 340 HP, speed 240, collision 32 and no attack. Its ability is **Blink** (`A012`): range 0-650, **cooldown 3 s**, no mana cost, 0.001 s cast point.
- **Hazards / mechanics:** The sapper "Bomb Away" (`n00B`, P12) has 100 HP, collision 16 and a **base speed of 10**.
  - **`Keep_Roll`**, every 0.1 s: order the sapper to move to the current position of the **Mathog nearest to it**. While live, speed goes up by 2.5 per tick (+25 u/s each second), up to the engine maximum of about 522 (the map's `MaxUnitSpeed` is 525). It passes the Mathog's 240 speed after about 9 s and hits the cap after about 20.5 s.
  - **`Keep_Explode`**, every 0.05 s: if any `n00B` is within **120 u** of a Mathog, that happens:
    1. The Mathog dies, and the sapper is killed with an explosion and screen-shake of 1000.
    2. A new sapper spawns at a random point within 500 u of the centre.
    3. The new sapper is paused for **3 s**, and its speed starts again at 10.
  - **`Keep_Death`**: a unit owned by a *human* player that leaves the rect is killed. You can't walk out, so this targets Blinking past the wall, where the nearest walkable spot can belong to another arena ("Improved blink mechanism" in the change log).
- **Timeline:**
  1. Spawn. There is **no freeze**, so players can move during the 6 s intro.
  2. At 6 s, the chase and the explosion checks start.
  3. Each kill starts the respawn cycle (3 s pause, speed reset).
  4. Play until one Mathog is left.
- **How you lose / win / finish:** You lose if the sapper gets within 120 u of you, or if you are a human who ends up outside the rect. The last Mathog alive wins.
- **Computer-player AI:** None. A computer Mathog never moves, and it is exempt from the leave-rect kill.
- **Designer notes:** The sapper always chases the nearest felorc, so use that (stay farther away than the others).
- **Remake notes:**
  - Pure-pursuit chaser that retargets every 0.1 s, speed 10 + 25·t (capped around 522).
  - Kill radius 120.
  - Respawn within 500 of the centre with a 3 s freeze and speed reset.
  - Players have a 650-range Blink on a 3 s cooldown.
  - The spawn is not protected: a new sapper can appear within 120 u of someone.
  - Because the check does not skip dead sappers, one pass can kill two players, and that can leave an orphaned, permanently paused sapper that acts as a static kill zone.

### Strike and Light Galore / how do i shot lightning? (Ultima-X bundle: Strike, event #70)
- **Goal (in-game text):** "Strike and Light Galore: Kill your opponents by pushing them into the fence." The title "how do i shot lightning?" is used when the champion cast Bloodlust on the Seer in Free Play. That variant also **forces deathmatch mode from the first second**.
- **Type & scoring:** Survival with no ties flag. There is a 120 s timer that includes the 5 s freeze, and when it expires the survivors tie. For anonymity, every player is renamed "Seer" and coloured brown, including in the "won!" message, until the next event.
- **Arena:** Kill zone `Galore` is (1600,-10880)-(2720,-9824): 1120×1056 u, 8.75×8.25 tiles, centred on (2160,-10352). `Galore_DM` is 960×896, centred on (2144,-10368). The floor is flat and walkable well beyond the rect.
  - The fence is Magical Pen Walls (`XTmx`, 256×64 pathing): 46 in total.
  - Normal mode shows the outer ring: 18 walls at y = -10912 and -9760, and at x = 1568.
  - The x = 2720 column lies exactly on Galore's east edge, so it is treated as "inside" and killed with the inner set. The east fence is therefore probably missing in normal mode. The kill line is the same either way.
  - Seers spawn 200 u from the centre at 45°·slot and are handed out at random.
- **Player unit:** Seer (`O003`, a hero) with speed 250, turn rate 3 (instant turning), collision 10, HP 75+25 = **100**, regeneration about 5/s, and **no attack**. Abilities:
  - **Chain Lightning** (C): range 900, cooldown 5, 1 damage, 1 target, instant cast. On spell effect the target is **teleported 350 u straight away from the caster** (`SetUnitPosition`, so it lands on the nearest pathable spot).
  - **Purge** (G): range 900, cooldown 6, 5 s duration on heroes, "hero pause" 1 s, movement update frequency 2. The target is effectively rooted, then its speed recovers. The exact curve is WC3's own Purge.
- **Hazards / mechanics:**
  - Leaving `Galore` kills you (`Strike_Die`).
  - **Deathmatch** starts the first time exactly 2 Seers are alive (checked on any death), or at unpause if exactly 2 players started or the Bloodlust variant is active. It shows "DEATH MATCH MODE!" and then:
    1. Hides the outer walls and raises the 28 inner walls.
    2. Moves anyone outside `Galore_DM` 256 u toward its centre.
    3. From then on, leaving `Galore_DM` kills.
- **Timeline:**
  1. Spawn, rename players, freeze for 5 s.
  2. Force deathmatch if applicable; apply Drunk if set.
  3. Unpause and fight until one Seer is left or the time runs out.
- **How you lose / win / finish:** You lose when you are pushed (or walk) out of the active rect. The last Seer wins.
- **Computer-player AI:** None. Computer Seers stand still.
- **Designer notes:** Purge them so they can't run, then lightning them out. The designer jokes that the leader will appreciate the anonymity.
- **Remake notes:**
  - Knockback of 350 u along the caster→target line, instantly, on a 5 s cooldown.
  - A 5 s slow/root on a 6 s cooldown, both with range 900 (basically global).
  - The ring shrinks from 1120×1056 to 960×896 at 2 players left.
  - Everyone is anonymous and looks the same.

### Elemental Clash / Unstable Elements (Ultima-X bundle: Elem, event #71)
- **Goal (in-game text):** "Elemental Clash: Kill your opponents! Press "E" to cast a spell, depending on the terrain." "Unstable Elements" is used after the champion casts Cripple on the Elemental display unit in Free Play.
- **Type & scoring:** Survival with no ties flag. There is a 150 s timer that includes the 5 s freeze, and when it expires the survivors tie. XP handicap is 0 %, so heroes never level.
- **Arena:** `Elemental_Clash` is (5472,-11072)-(6848,-9728): 1376×1344 u, 10.75×10.5 tiles, centred on (6160,-10400). The floor is flat, about 1500² walkable, inside a wall.
  - Terrain grid: each letter is one tile point (x 5504→6784, y -9728 at the top to -11008 at the bottom), and it covers the 128 u cell centred on that point. Legend: S = soil `Ydtr`, I = ice `Idki`, G = grass `Lgrs`, R = rock `Lrok`, M = marble `Yblm`.
    ```
    I S S S S I S S S S I
    S R G G R G R G G R S
    S G R G G I G G R G S
    S G G R I R I R G G S
    S R G I R R R I G R S
    I G I R R M R R I G I
    S R G I R R R I G R S
    S G G R I R I R G G S
    S G R G G I G G R G S
    S R G G R G R G G R S
    I S S S S I S S S S I
    ```
  - There is an extra outer ring of soil (a few plain `Ydrt` tiles have no spell). **Marble is a single cell** at (6144,-10368).
  - Geomancers spawn 500 u from the centre at 45°·slot (on the grass/rock ring), owned directly by each player.
- **Player unit:** Geomancer (`H00J`, a hero) with speed 250, **500 HP** (475 + 25), 0 HP/s regeneration, armour about 0.3, and collision 32.
  - Attack: 13-19 instant (normal weapon type) at **range 250**, cooldown 0.5 s, about 28 dps. Acquisition range is forced to 100.
  - Three cosmetic orbs.
  - **Elemental** (E, War Stomp base, cooldown 4 s) triggers on SPELL_CAST, and its effect depends on the tile under the caster:
    - **Soil:** Holy Light on yourself, +100 HP.
    - **Ice:** Frost Armor on yourself, +15 armour for 15 s. Melee attackers are slowed for 5 s, and the 250-range attack counts as melee.
    - **Grass:** Entangling Roots on every enemy within 400 u: immobilised for 3 s (hero duration) and 30 dps, 90 damage in total.
    - **Rock:** Hurl Boulder on every enemy within 400 u: 75 damage and a 1 s stun.
    - **Marble:** Starfall is granted and channelled: 1 s cast time, then 50 damage per second to every enemy within 1000 u. It lasts until you are interrupted, and the ability is removed when the cast ends.
  - These spells are cast by a 2 s dummy unit that belongs to the caster.
- **Hazards / mechanics:** In the **Unstable** variant, every E press rotates all arena tiles: soil→marble, ice→soil, grass→ice, rock→grass, marble→rock. Rings of Mark-of-Chaos effects are drawn around the caster.
- **Timeline:**
  1. Spawn, freeze for 5 s.
  2. Unpause and fight until one player is left or the time runs out.
- **How you lose / win / finish:** You lose when your hero dies. The last player alive wins.
- **Computer-player AI:** None. A computer's hero only auto-attacks enemies that come within 100 u.
- **Designer notes:** The advice lists the terrain→spell table. If someone starts channelling Starfall, stand on rock next to them and stun them.
- **Remake notes:**
  - The terrain-keyed ability and the tile map above.
  - The numbers for each of the five effects.
  - Starfall channel that can be broken by a stun.
  - 250-range auto-attack at about 28 dps against 500 HP.
  - Possible exploit (inferred, not tested): because the effect fires on SPELL_CAST (before the cooldown is paid), ordering Stop during the 0.3 s cast point might skip the cooldown. The Starfall re-order may also cancel the E cooldown.


## Uther Party Ultima-X: rule sheets, events #72 to #78 (not in 4.0)

These sheets come from `ultx/bundles/072_Stock` to `078_X`, the framework triggers in `ultx/j.txt` and the map's merged SLK tables.

Framework reminders:
- Next Event gives every player shared vision (alliance state 1, "unallied + vision"), freezes the day/night clock (`UseTimeOfDayBJ(false)`), sets the time to 12:00, resets `TiesPossible` and `DoNotEndImmediately` to false, and sets ante to 9−N.
- A trigger started with `TriggerExecute` runs until its first wait. Next Event then hands out the neutral-passive (`Player(15)`) key units at random, one per playing player. Stock and Fetch rely on this.
- None of these seven games has a computer-player trigger. `MAP_CONTROL_COMPUTER` is never tested for them and no AI script is started, so a computer's units only follow stock WC3 behaviour: auto-acquire and nothing else.
- Periodic events are registered at map load. Their phase is therefore relative to map start, not to the minigame. The first tick after a game enables the trigger can come anywhere from 0 s to one full period later.

---

### Wall Street Traffic (Ultima-X bundle: Stock, event #72)
- **Goal (in-game text):** "Wall Street Traffic / Earn more gold than your opponents to win. / Be sure to sell all your stocks before time runs out!"
- **Type & scoring:** Gold ranking, resolved by survival-style elimination.
  - `TiesPossible` and `DoNotEndImmediately` are both true.
  - The 50 s "Quarter ends" timer (`Temp_Timer`) runs Stock_Expire, which repeats elimination rounds. In each round every alive player whose gold equals the current minimum is killed. They share the tie ante through Tie Death, and the ante rises by 1.
  - The last player standing gets 8. Survival Death waits 5 s before Win.
  - Unsold shares are worth **0**; they only appear in the "had a total of X gold and Y unsold stocks" message.
- **Arena:** Reuses the Obey arena.
  - Camera bounds: `Obey_Archimonde`, 1152×1024 u (9×8 tiles), centre (6272,3936).
  - Eight 128×128 broker slots `Obey_1..8` form two rows of four: y = 3744 and y = 3520, x = 5888 / 6144 / 6432 / 6688.
  - Brokers are created for Player 15 in slot i for each playing player i, then **handed out at random**, so your slot is random.
  - Four "index" units (Player 12, invulnerable, decorative) stand at y = 4032: Footman = Human (x 5952), Witch Doctor = Orc (6176), Acolyte = Undead (6400), Dryad = Night Elf (6592).
- **Player unit:** `n00F` Stock Broker.
  - Speed 0 (immobile), HP 60, no attack.
  - 8 Channel-based, no-target, instant abilities:
    - Buy Human, Orc, Undead or NE stock (`A01L`, `A01M`, `A01N`, `A01O`): cooldown **0.35 s** each.
    - Sell Human, Orc, Undead or NE stock (`A01P`, `A01S`, `A01R`, `A01Q`): cooldown **0.2 s** each.
  - Each ability has its own cooldown, so you can alternate between stocks.
- **Mechanics:**
  - Every playing slot starts with **100 gold**. All four prices start at **5**. Your portfolio multiboard shows your share counts.
  - **Buy:** requires gold ≥ price. You pay the current price, get +1 share, then that stock's price rises by **+3**. With too little gold you get "Not enough gold." and a stop order.
  - **Sell:** requires at least 1 share. You receive the current price, get −1 share, then the price falls by **−2** (minimum 1). Without a share you get "You do not own that stock."
  - The market is **shared**: everyone's trades move the same four prices.
  - **Stock_Update** runs once at unpause, then every 4 s. It first computes the average of the four prices. Then each stock, with a 1/3 chance, changes by `5 − rand(1..15)`: uniform −10..+4, mean −3, so prices drift down. Prices are clamped to ≥ 1.
  - The floating text shows "Index: <price> ±<change since last update>" (green + or red −).
  - Index-unit animation: "death" if the price is ≥ 5 below the pre-update average, "victory" if ≥ 5 above, otherwise "attack".
- **Timeline:**
  - t0: brokers, index units and text created; everyone paused.
  - t4: unpause, first price update, 50 s timer starts, trading enabled.
  - Timer expiry +1 s: trading is still possible during this second. Then updates stop, all units are paused, and the eliminations begin.
  - Each round: find the minimum gold among alive players (cap 1000), print each such player's total, wait 2 s, kill them with an impale effect, wait 3 s, repeat.
  - When one broker remains, its total is printed 3 s later.
- **How you lose / win / finish:** Less gold than everyone else at the close means you go first. Most gold wins. An all-way tie on gold ends in Draw.
- **Computer-player AI:** None. A computer broker never trades and keeps 100 gold.
- **Designer notes:** The market dips and rebounds unpredictably. Buy low and sell high, and expect a crash in the last seconds when everyone dumps.
- **Remake notes:**
  1. Four shared prices start at 5. A buy costs p and moves the price +3; a sell pays p and moves it −2; the floor is 1.
  2. The random walk runs every 4 s: 1/3 chance of +4..−10 per stock.
  3. Start with 100 gold. The session is 50 s (plus a 1 s grace period); rank by gold only.
  4. **Pump-and-dump is profitable by design.** Buying n shares and then selling all n nets +0.5n²+2.5n (for example buy at 5, sell at 8 = +3). The profit is only lost if others sell into you.
  5. Bug: Level starts at 1000. If **every** surviving player has more than 1000 gold, nobody matches the minimum, no one is eliminated, and the round loops forever. Cap it or use a true minimum.
  6. Show each player's holdings and a per-stock ticker.

### Milton's Misery (Ultima-X bundle: Milton, event #73)
- **Goal (in-game text):** "Milton's Misery / Be the last one to activate your shield! / Activate it before the bomb goes off."
- **Type & scoring:** A "chicken" survival game with `TiesPossible` true. There is no timer.
  - Unshielded players die together in the blast and share the lowest ante.
  - After that, shielded players are eliminated every 2 s, earliest shield first. Equal values die together.
  - The last shielder gets 8. If the last group all shares the same value, the result is a Draw.
- **Arena:**
  - The barrel sits in `Bomb`, a 96×96 rect centred at (3952,−10256). **Camera bounds are this 96×96 rect**, so the view is locked on the barrel.
  - Player i stands in `Bomb_Copy_i` (96×96), at these offsets from the barrel:
    - 1: (0,+256)
    - 2: (+128,+128)
    - 3: (+256,0)
    - 4: (+160,−128)
    - 5: (0,−256)
    - 6: (−160,−128)
    - 7: (−256,0)
    - 8: (−128,+160)
  - Everyone faces the barrel.
  - `Milton` (1120×992) is only used to scatter 15 fire effects after the blast and to count survivors. The area is forest with trees.
- **Player unit:** `h00N` Scared Peasant.
  - Speed 0, HP 220, scale 0.7, no attack.
  - Activate Shield (`A019`, War Stomp base): instant, no damage or stun, cooldown 3 s.
- **Hazards / mechanics:**
  - `n00H` Barrel of Explosive: HP **13**, no regen, Player 12.
  - `h00O` Milton Waddams (Player 12) spawns 100 u north of the barrel. At t=6 he is ordered to attack it: 1 chaos damage per hit, cooldown 2 s, damage point 0.433 s.
  - Detonation threshold r = rand(**1..10**), rolled at t=7 and hidden.
  - On every damage event, the barrel's pre-hit HP is compared with r. If they are equal, it explodes.
  - The "!!!" text over the barrel grows (size 30 − 1.5·HP) and shifts from green to red as HP drops, so players can read HP but not r.
  - Casting the shield once Save is enabled (t=7) removes you from the DANGER group, pauses you, and adds a mana-shield effect.
    - Your value is set to `13 − current barrel HP`, i.e. the number of hits so far.
    - "Saved at N" is shown.
- **Timeline:**
  - t0: spawn and message. Units are not paused. Shield casts before t=7 do nothing except start the 3 s cooldown.
  - t6: Milton starts hitting. The first hit lands at about t=6.5, before the Kill check is enabled at t=7, so HP is 12 when it goes live.
  - After that, one hit about every 2 s. The explosion comes on hit #(14−r), roughly t≈12.5 s (r=10) to t≈30.5 s (r=1).
  - Blast: every DANGER unit (unshielded peasants and Milton) dies, the barrel dies, quake 800, 15 fires.
  - +2 s: Sort kills everyone holding the lowest non-zero value.
  - Then every 2 s until at most 1 peasant is alive.
- **How you lose / win / finish:** You lose if you never shield or if you shield earlier than the others. The latest value wins. The winner's value can be at most 13−r, which means shielding within the 2 s window before the fatal hit.
- **Computer-player AI:** None. A computer never shields and always dies in the blast.
- **Designer notes:** Milton has gone postal. Raise your shield as late as you dare: the blast kills the unshielded first, then the earliest shielders.
- **Remake notes:**
  1. Hidden threshold r ∈ 1..10 on a 13-HP barrel. Hits come every 2 s and the explosion fires on the hit when HP = r.
  2. One-shot shield; your score is hits-so-far.
  3. Eliminate by ascending shield time every 2 s, with shared ranks for ties.
  4. A visible HP / colour cue on the bomb.
  5. Edge case: a value of 0 (shielding at full HP) is treated as "never ranked". That player can never be sorted out, and two such players would make Sort loop forever. It is unreachable in practice only because hit 1 lands before Save is enabled.

### Fetch! (Ultima-X bundle: Fetch, event #74)
- **Goal (in-game text):** "Fetch! / Felhounds: Kill the child. / Child: Use pass ability to tag someone else."
- **Type & scoring:** Hot-potato survival.
  - `TiesPossible` is false.
  - Only the Child can die. Its death eliminates its owner through Survival Death.
  - Timer **150 s** ("Time Left"). On Survival Expire, every surviving player gets the same ante and the result is a Draw.
- **Arena:**
  - `Dark_Forest`: 1600×1600 u (12.5×12.5 tiles), centre (6144,−3584), camera bounds.
  - A walled clearing with about 30 single trees in a symmetric pillar pattern.
  - Permanent night (time 0:00, clock frozen).
  - 8 hounds spawn 400 u from the centre at 22.5° + k·45°, facing the centre. They are created for Player 15 and **given out at random**.
  - Units are never paused.
- **Player unit:**
  - `nfel` Fel Hound:
    - Speed **350**, **invulnerable** (Avul), collision 31.
    - Attack: 50 chaos (49+1d1), cooldown 1.35 s, range 100, acquisition 100.
  - `nvk2` Child:
    - Speed **190**, HP **15**, collision 16, no attack. One bite kills.
    - Pass (`A01A`, Storm Bolt base): unit target, range 2000, **casting time 1 s**, cooldown 0, no mana, 0.01 s stun, 0 damage. Missile speed 700 (visual only).
  - Players are renamed "Fel Hound" (colour index 12, which is outside the 1.24 palette — check how it renders). The child's owner becomes "Child" (pink); dead players become "R.I.P" (grey).
- **Mechanics:**
  - **Pass** fires on spell effect, after the 1 s cast:
    1. After 0.01 s, if the caster is dead, the pass is aborted.
    2. Otherwise the caster instantly becomes a fel hound.
    3. After `distance/1400` s (at most about 1.4 s), the target becomes the Child at full 15 HP. There is **no invulnerability after a pass**.
    4. If the target's owner has left, a random hound becomes the Child instead.
    - During the transfer delay no child exists.
  - **Child death:** 2 s later a random hound becomes the Child, invulnerable for 3 s.
- **Timeline:**
  - t0: hounds spawn, free movement.
  - t4: a random hound becomes the Child (invulnerable until t7).
  - Chase and pass until 1 player is left or t=150.
- **How you lose / win / finish:** Your child is bitten, which eliminates you. The last player left wins (8). Everyone alive at 150 s ties.
- **Computer-player AI:** None. Computer hounds only auto-bite a child within 100 u. A computer child never passes.
- **Designer notes:** One child with the talisman among felhounds. Don't loiter next to other hounds, or you may be turned into the child right beside them.
- **Remake notes:**
  1. Speeds 350 vs 190 and a one-bite kill make the pass the only escape.
  2. The pass needs a 1 s stand-still cast and 2000 range. The swap happens at distance/1400 s.
  3. The passer becomes a fast hound instantly, while the receiver gets no spawn protection. Passing into a pack is the kill move.
  4. After a death, the next child is random with 3 s of invulnerability.
  5. 150 s cap with shared survival.
  6. Oddity: the visual missile (700 u/s) is slower than the scripted swap (1400 u/s).

### Over Nine Thousand (Ultima-X bundle: Nine, event #75)
- **Goal (in-game text):** "Over Nine Thousand / Click sludges to create of your own. / Player with the most after 20 seconds wins."
- **Type & scoring:** Count ranking, scored by hand in Nine_Expire. There are no key units.
  - Timer **25 s**. The first sludge only appears at t=5, which gives the "20 seconds" in the text. `TiesPossible` is true.
  - At expiry, brown sludges are removed. k = players owning at least 1 sludge, and ante = 9−k.
  - Players with no sludges get **ante−1 = 8−k** each: "didn't get any sludges at all!".
  - Then every 2.5 s, everyone holding the lowest count gets the tie ante (9 − players still holding sludges) and their sludges explode.
  - When no sludges remain, Finish runs. The most sludges gets 8.
- **Arena:**
  - `Abombinations`: 1024×1024 u (8×8 tiles), centre (8192,−1280). A walled empty room with chamfered corners.
  - A fixed top-down camera (angle of attack 268.8°, distance 1700, FOV 70) is re-applied every 0.5 s.
- **Player unit:** None. Input is **selecting (clicking) any unit you don't own**.
- **Mechanics:**
  - `h00P` Sludge: immobile, HP 500, armor 5, collision 40, no attack. It is only a board piece.
  - At t=5, one brown (Player 12) sludge appears at the centre.
  - **Click** on an enemy or brown sludge:
    1. Your selection is cleared and the clicked sludge is removed.
    2. At the 4 points 100 u away at 45° / 135° / 225° / 315°, any unit within 20 u is removed.
    3. A new sludge is placed at each point. One random point gets a **brown** sludge; the other **3 are yours**.
  - All sludges therefore sit on a diagonal lattice with 100 u neighbour spacing, about 100 sites in the room. A click empties the clicked site and overwrites its 4 diagonal neighbours, stealing opponents' pieces.
  - You can't click your own sludges.
- **Timeline:**
  - t0: camera, timer, message.
  - t5: seed sludge appears.
  - t5–25: clicking.
  - t25: scoring rounds every 2.5 s.
- **How you lose / win / finish:** Fewest sludges ranks lowest; most wins.
- **Computer-player AI:** None. A computer never clicks, so it scores as a zero-sludge player.
- **Designer notes:** The sludge quadruplicates when touched. Click where the leader's colour dominates.
- **Remake notes:**
  1. A diagonal-lattice board of about 100 cells. Clicking a foreign piece clears it, gives you 3 of its 4 diagonal neighbours, and turns 1 random neighbour neutral.
  2. 20 s of frantic clicking.
  3. Rank by count, sharing ranks on equal counts.
  4. Oddity: zero-piece players all get 8−k regardless of how many of them there are, which is more generous than normal survival ties.
  5. Near walls WC3 may nudge pieces off-lattice. A remake should clip to the board.

### Lost & Found (Ultima-X bundle: Lost, event #76)
- **Goal (in-game text):** "Lost & Found / Survive as long as possible!"
- **Type & scoring:** Survival. **No timer and no expiry**; `TiesPossible` is false. The game lasts until one marine remains, who gets 8.
- **Arena:**
  - `Push_the_Ogre`: 1312×1280 u (about 10×10 tiles), centre (−1520,4096), camera bounds.
  - Open walled floor (walkable about 128 u past the rect) with 4 lamps near the corners and 2 shrubs. Destructables in the rect are restored first.
  - Marines spawn 400 u from the centre at 45°·i for player i.
  - Night, heavy rain, fog of war + black mask on. **Players are fully unallied, so vision is not shared.**
- **Player unit:** `u007` "Lost" (Marine model).
  - Speed **240**, HP **15**, **no regen** (regenType none), no attack, collision 15.
  - Sight 800 by day, **250 at night** (it is always night).
  - All players are renamed "Marine" (light blue).
- **Hazards:**
  - `u008` "Found" (zergling):
    - Speed **150**, **invulnerable**, collision 15.
    - Attack: normal 7–8 (×1.5 vs medium armour = **10.5–12**), cooldown **5 s**, range 90, acquisition 500.
    - Night sight 1500.
    - Two bites kill a marine, and damage never heals.
  - **Lost_Spawn** runs every 4 s:
    - One Player-12 zergling spawns at a random point in the rect.
    - Every Player-12 zergling is ordered to attack its **nearest living marine**.
    - Lightning: a thunder sound, a 0.5 s white flash (50% transparency), and fog / black mask **off for 0.2 s**, revealing the map.
  - **Lost_Decay:** when a dead marine's corpse starts to decay (about 3 s death animation + 2 s), it is replaced by a full-HP zergling **owned by the dead player**. The player is renamed "Thing" (aqua) and can hunt the survivors.
- **Timeline:**
  - t0: setup, paused.
  - t2: unpause and spawns begin. Spawns continue every 4 s forever, adding 15 zerglings per minute plus one per dead player.
- **How you lose / win / finish:** Two bites and you're out. The last marine alive wins.
- **Computer-player AI:** None. A computer marine stands still. Its revived zergling only auto-attacks within 500 u.
- **Designer notes:** Lights-out survival. Your vision is tiny, so use the lightning flashes to plan an escape route.
- **Remake notes:**
  1. Darkness with about 250 u personal vision and a full-map reveal of 0.2 s every 4 s.
  2. An ever-growing horde of slow (150) unkillable hunters that retarget the nearest player every 4 s. You outrun them at 240.
  3. 2-hit death with no regen.
  4. Dead players respawn as controllable hunters.
  5. Add a time cap; the original can stall.

### Titanic Panic / One does not simply ram into Mordor (Ultima-X bundle: Titan, event #77)
- **Goal (in-game text):** "Titanic Panic / Kill your opponents by ramming into them!"
  - The alternative title "One does not simply ram into Mordor" (same subtitle) is shown when `udg_Invis_Boat` is true. That variant adds full unally and makes every boat invisible (Ghost).
  - A separate "Reversed" mode (`udg_Reverse_Boat`) mirrors point orders through the unit and cancels target orders.
  - **Both flags are only ever set to false in the Ultima-X script**, so only Titanic Panic can occur. The variants are dead code.
- **Type & scoring:** Survival with `TiesPossible` true. Timer **150 s**; at Survival Expire the survivors share the ante (Draw).
- **Arena:**
  - `Titanic`: 1888×1664 u (14.75×13 tiles), centre (2768,−12256), camera bounds.
  - An enclosed lake with about 5 rocky/iceberg islands (NW, two in NE, a large SW block, SE).
  - Night, heavy rain.
  - Boats start 400 u from the centre at `i·135−22.5°` for player i, facing the centre.
  - **Leaving the rect is instant death** (Titan_Death, explosion).
- **Player unit:** `hbot` Bumper Boat.
  - Speed **320**, turn rate 0.4, float, collision 30, HP **500**, no regen, no attack.
  - Unstuck (`A01F`): casting time 1 s, cooldown 3 s. Teleports the boat 200 u toward the arena centre.
- **Mechanics (Titan_Damage, every 0.66 s, all living boats):**
  - The contact point is **125 u ahead** of the boat's facing. Every unit within **100 u** of it is hit, even if the rammer is not moving.
  - Victim: **−100 HP** (set directly). Rammer: **+15 HP**.
  - The victim is knocked **270 u along the rammer's facing** in a 1.0 s parabolic arc (peak height = distance/1.3). During the arc it is paused and has no pathing.
  - The rammer recoils **70 u straight back**, also over 1.0 s.
  - **On landing**, each jumper deals **300 damage** (normal attack type) to enemy ground units within **50 u** of its arc's end point: 300 u ahead for the victim, 100 u behind for the rammer. These are the chain reactions.
  - Arcs ignore pathing, so boats land on islands or shore and get stuck; Unstuck is the fix.
- **Timeline:**
  - t0: spawn, paused, 150 s timer.
  - t5: unpause.
  - The game ends at the last boat alive or at t=150.
- **How you lose / win / finish:** HP reaches 0, or you are knocked out of the rect.
- **Computer-player AI:** None. A computer boat sits facing the centre but still rams anything that drifts 25–225 u in front of it.
- **Designer notes:** Bumper boats. Bump ships into other ships, because chain reactions work great. Hitting others heals you a little. Getting stuck happens often.
- **Remake notes:**
  1. Ram cone of 125 u ahead with 100 u radius, ticking every 0.66 s: −100 to the victim, +15 to the rammer.
  2. 270 u knockback along the rammer's heading, with 70 u recoil.
  3. 300 splash damage in a 50 u radius at each landing point.
  4. The arena edge is a kill line; islands are obstacles; 150 s cap.
  5. Oddity: the knockback helper (`CastWrap` → JST) swaps its arguments. The designer passed damage 50 / area 300 but got **300 damage in a 50 u radius**.

### Great Naval Enmity (Ultima-X bundle: X, event #78)
- **Goal (in-game text):** "Great Naval Enmity / Fire missiles to sink your opponents!"
- **Type & scoring:** Survival.
  - `TiesPossible` is false, so ships that sink at the same moment get sequential antes.
  - Timer **150 s**. At Survival Expire the survivors share the ante.
- **Arena:**
  - `Tides_of_Darkness`: 2048×1920 u (16×15 tiles), centre (3328,−8000), camera bounds.
  - An open lake with small shallows and wreck obstacles near the NE and SW corners.
  - Daytime.
  - Ships start **800 u** from the centre at `i·135−22.5°`, facing the centre.
- **Player unit:** `hbsh` Human Battleship.
  - Speed **300**, turn rate 1.0, float, collision 48, HP **700**, armor 0 (large), no regen, no normal attack.
  - **Fire** (`A01K`): point target, range 1200, cooldown **1 s**, instant cast.
    - The ship spawns a dummy mortar (1 s life) that attack-grounds the target point.
    - The shell flies at 400 u/s (up to 3 s) and deals siege damage: **300** within 25 u, **150** within 150 u, **45** within 250 u.
    - The ability's Silence base only affects organic targets, so ships are unaffected. Treat this as an assumption.
  - **The Big One** (`A00R`): point target, range 1200, **4 s casting time** (the ship must stand still; moving cancels), then 2 s follow-through with other abilities disabled, cooldown **20 s**.
    - The shell flies at 250 u/s (up to 4.8 s).
    - Damage: **901** within 125 u, **450** within 400 u, **135** within 750 u.
    - Quake at launch and on impact.
  - Splash has no allegiance filter, so it probably also hurts the firer's ship if close enough.
- **Hazards:** When a ship sinks, 6 shells (Player 15) fire from the wreck to points 280 u away every 60°. Each deals 300/150/45 splash, so ships near a sinking ship take heavy damage.
- **Timeline:**
  - t0: spawn, paused.
  - t5: unpause; abilities go live.
  - The game ends at the last ship alive or at t=150.
- **How you lose / win / finish:** Your ship sinks (700 HP: three direct Fire hits, or one Big One). The last ship afloat wins.
- **Computer-player AI:** None. A computer ship never fires.
- **Designer notes:** Warhead-armed battleships duel. Time The Big One carefully: a hit cripples the target, but being caught during its cast is fatal. The game was built to replace Titanic Panic under patch 1.24.
- **Remake notes:**
  1. Lobbed shells with travel time (400 u/s): 300/150/45 falloff, 1 s cooldown, so shots must be led against ships moving at 300 u/s.
  2. Big One: 4 s telegraphed root, 20 s cooldown, one-shot core damage, 750 u outer ring.
  3. The death burst of 6 shells punishes staying close to a sinking ship.
  4. 700 HP, open lake, 150 s cap.
  5. Consider friendly-fire splash on the shooter.


## Uther Party Ultima-X — hidden / extra minigames (events 159-169)

Source: `ultx/j.txt` (optimized war3map.j), `ultx/bundles/1xx_*.txt`, `ultx/objects_*.txt`, `ultx/Units/*.slk|txt`,
`ultx/regions.txt`, `ultx/war3mapMisc.txt`, `ultx/war3map.wpm` (static pathing, used once for the Burrow course).
Line numbers below refer to `ultx/j.txt`. 128 u = 1 tile. "P12" = Player(11) (brown, hostile script player);
"neutral passive" = Player($F) = Player(15).

### How events 159-169 can be started (applies to every game below)

Evidence, in full:

- Table (Initialization, l.4081-4090): `udg_Triggers_Events[$9F..$A9]` = 159 Bad_Fur, 160 Fel, 161 Drink,
  162 Stampede_Initialization_Copy, 163 Peon_Initialization_Copy, 164 Peon_Initialization_Copy_2,
  166 Clicking, 167 Defense, 168 Burrow, 169 Buzzer. **Index 165 is never assigned** (a gap in the table).
- **Normal roll: no.** `Filter` (l.4398) rolls `GetRandomInt(1, udg_Integer_TotalofGames)`, and TotalofGames is
  hard-set to 78 (l.2294 and main l.21226). Nothing else writes it. No player-count switch.
- **Tie-breaker: no.** Tie-breakers call the same `Filter` (it only adds "re-roll 7 and 68 while in a tie-breaker").
- **The only other `TriggerExecute(udg_Triggers_Events[...])`** is in `Free_Activate` (l.19212). This is the **Free Play**
  lobby after the match. When a unit enters region `Free_Switch` (-1920,-2688)-(-1792,-2560), `Free_Activate` runs table
  entry `GetUnitUserData(enteringUnit)`. The unit must have UserData > 0, or be the "Random Game" unit, which runs Filter.
  The unit's UserData is therefore the game number.
- Free Play itself: after the 8-game match (and any tie-breakers), `Game_End` sets GameIsOver. It also sets the free-game
  count to `winnerScore/10 + 3`. `Outro` and `Next Event` then run `Free_Initialization`, which runs `Free_Spawn`.
  Free_Spawn builds a 9x9 grid (192 u spacing) of "display units" in region Clean_Crew
  (-2688,-4224)-(-1024,-2560), centre (-1856,-3392). All are owned by **the champion** (`udg_Player_Winner`), and each has
  UserData = 1..78 for games 1-78. Free_Spawn then makes every champion unit 300 speed, removes Wander, turns pathing
  off and plays "stand victory". The switch sits in the empty top-centre grid slot, centre (0,+768).
  Only the champion's units can be walked onto the switch. If the champion leaves, `Free_Check` picks a random human
  player and respawns the lobby.
- **Units with UserData 159-169 exist only through secret actions in the lobby.** They come from `Free_Spawn`,
  `Free_Secret_Variants` (EVENT_PLAYER_UNIT_ISSUED_TARGET_ORDER, so issuing the cast order is enough),
  `Free_Secret_Kill_games` and `Free_Secret_Click`:

| # | Game | How the champion creates a unit with that UserData |
|---|---|---|
| 159 | Bad Fur Day | Kill the champion's own Rabbit (`udg_Free_Rabbit`, random point in Clean_Crew). A "Car" (H00B, UserData $9F) appears where it died. |
| 161 | Drink and Bow | Order Drunken Haze (852585) onto the Archer display unit (#6 Way of the Bow). The Pandaren Brewmaster display unit (#50) has ANdh learned, and ANdh targets allow friendly units. |
| 162 | Chicken Stampede | Order Bloodlust (852101) onto the Beastmaster display unit (#17). It is replaced by 'Orex' with UserData $A2. The caster is the Warlock display unit (#22, Uwar), which has creep Bloodlust ACbl (friend-targetable, 0 mana). |
| 163 | Sick Peon Pandemonium | Order Cripple (852189) onto the Peon display unit (#1). The caster is the Warlock (#22), which has Scri (Cripple, friend-targetable). |
| 164 | Piggy Pandemonium | Order Cripple onto the Troll Hunter display unit (#36 Pork the Piggy). |
| 166 | Wild Clicking Duel | The champion selects the hidden Shaman (`udg_Free_Shaman`) 25 times. Its UserData changes from 169 to $A6, and it turns blue-tinted and 150 % size. |
| 167 | ??? (Defense) | **Unreachable.** No `SetUnitUserData(..,$A7)` exists and nothing else executes `gg_trg_Defense_Initialization`. Dead content. |
| 168 | Underground Run | Walk the hidden Underground Spider (u002, UserData $A8) onto the switch. It is created at (-2000,-4600), tinted 30/30/30 at 50 % transparency, in pose "stand alternate". |
| 169 | Wild West Duel | Walk the hidden Shaman (oshm, UserData $A9) onto the switch without the 25 clicks. It is created at (-2000,-4500), same dark tint. |

The two hidden units sit 276-376 u south of the lobby camera bound (the camera's minimum y is -4224). They can only be
seen at the bottom edge of the screen with the camera scrolled all the way down. The secret-variant flags are reset in
`Next Event` only when GameIsOver. Any free game resets all scores to 0 first (`Free_Activate`), so Free Play scores
are cosmetic, and each free game uses up one of the champion's free games. The `DEBUG` trigger (see the last section)
jumps straight to this lobby.

---

### Bad Fur Day (Ultima-X bundle: Bad_Fur, event #159)
- **How it can be reached:** Free Play only: kill the champion's Rabbit, then walk the Car that appears onto the switch
  (`Free_Secret_Kill_games`, l.19260).
- **Goal (in-game text):** "Bad Fur Day / Be the first to level up. / Run over rabbits to kill them."
- **Type & scoring:** Race.
  - `udg_Integer_Ante=8`, and each finisher takes the ante then lowers it by 1 (1st 8, 2nd 7, ...). The finish trigger is
    `Whack_Finish`: any EVENT_PLAYER_HERO_LEVEL for players 1-8 runs `Race_Finish`.
  - Finishers' Cars are removed with a teleport effect. Ties are impossible except in the same instant.
  - Time limit: 130 s timer (started at t=0, so about 124 s of play). On expiry `Race_Expire` kills every remaining Car
    (KillUnit ignores their invulnerability). Those players score 0. The result is "Finished!" if anyone levelled,
    otherwise Draw.
- **Arena:** Push_the_Ogre (-2176,3456)-(-864,4736), 1312 x 1280 u (10.25 x 10 tiles), centre (-1520,4096).
  - Cars start 400 u from the centre at angle 45°·i for player slot i (1..8), facing the centre.
  - Camera is locked to the region. Time of day is 0:00 (night), with heavy Ashenvale rain ('RAhr') over the whole map.
- **Player unit:** "Car" H00B, a hero (Meat Wagon model).
  - Speed 250, turn rate 0.1 (very slow turning, car-like), collision 40, HP 100, armor 2.
  - No attack (weapons off). Invulnerable (Avul).
  - A00G "Process" ("Enables you to run over bunnies"): Permanent Immolation (base 'Apig'). 60 damage per tick to
    ground/enemy/neutral/organic units within 100 u. Tick is probably the 0.5 s Dur field. Either way one tick kills a
    rabbit, so rabbits die on contact.
  - XP handicap is set to 0 % for players 1-8, so no normal kill XP.
- **Hazards / opponents / mechanics:**
  - 10 Rabbits ('necr', P12): HP 15, speed 855, which the map's MaxUnitSpeed=525 caps to 525. Collision 16, Wander
    (Awan), no attack. They gib on death (SetUnitExploded).
  - `Bad_Fur_Kill` fires on any P12 unit death. It gives `AddHeroXP(13)` to the killer and spawns one new rabbit at a
    random point in the arena, so there are always 10 rabbits.
  - Level 2 needs the default 200 XP (not overridden in war3mapMisc.txt), so it takes **16 kills** (13·16 = 208).
  - "Handicap 0 % + AddHeroXP" is the same pattern the regular game The Grim Reapage (#54) uses with Whack_Finish, so
    AddHeroXP evidently ignores the handicap.
- **Timeline:**
  - t=0: music Undead1, rain, cars created and added to KeyUnits, XP handicap 0, everything paused, 130 s timer, text.
  - t=6: 10 rabbits spawn and everything unpauses. Enabled: Bad_Fur_Kill, Race_Death, Race_Expire, Whack_Finish.
- **How you lose / win / finish:** Your Car's first level-up finishes you (8, 7, ...). Anyone not levelled at 130 s
  scores 0. Nobody can die otherwise (Cars are invulnerable).
- **Computer-player AI:** None (no AI trigger). A computer's Car idles and only kills rabbits that wander into its 100 u aura.
- **Remake notes:**
  - Race to 16 "roadkills". Each kill respawns a critter at a random spot, keeping 10 alive.
  - Vehicle handling is the point: speed 250 with very low turn rate 0.1, against rabbits running ~525 with random wander.
  - Kill radius is about 100 u + collision. Cars can't be hurt; they only compete for rabbits (and body-block each other, collision 40).
  - 130 s limit. Placement scoring 8/7/6...
  - It is a re-skin of Whack-a-Fiend's level-up race (#23). It looks complete.

### Drink and Bow (Ultima-X bundle: Drink, event #161)
- **How it can be reached:** Free Play only: Drunken Haze onto the Archer display unit (#6). "Drunk" variant of Way of the Bow (#6).
- **Goal (in-game text):** "Drink and Bow / Kill your opponents!"
- **Type & scoring:** Survival.
  - `Survival_Death` with Ante = 9 − N from Next Event / Free_Activate. First to die gets 9−N, the winner 8.
  - Ties are not shared (TiesPossible false): same-instant deaths get consecutive values.
  - 160 s timer (about 155 s of play). On expiry `Survival_Expire` gives every survivor the current ante (all tied),
    then kills them, then Draw.
- **Arena:** Way_of_the_Bow (-256,-4864)-(2304,-2304), 2560 x 2560 u (20 x 20 tiles), centre (1024,-3584).
  - One Archer per playing slot i, 1000 u from the centre at angle (i·135 − 22.5)°, facing the centre:
    P1 112.5°, P2 247.5°, P3 22.5°, P4 157.5°, P5 292.5°, P6 67.5°, P7 202.5°, P8 337.5°.
  - Archers are created for neutral passive and handed out randomly (Next Event / Free_Activate), so your spot is random.
  - Neighbouring spots are 765 u apart (chord at 45°), inside archer range. Night (SetTimeOfDay 0).
- **Player unit:** Archer 'earc'.
  - Speed 270, collision 31, **HP 5**.
  - Attack 15+1d3 pierce (16-18; 75 % vs its medium armor is still more than 5), so one arrow kills.
  - Range 800, cooldown 1.5, attack point 0.72, homing missile at 900 speed.
  - Acquire range set to 100, so no auto-shooting at range. Brewmaster "drunk" effect overhead.
  - `Drink_Patrol` converts any Patrol order (851990) into a Move to the same point, so patrol cannot be used to
    auto-acquire.
- **Hazards / opponents / mechanics:** Only the other players. "Drunk" effects start at unpause:
  - `CameraSetTargetNoiseForPlayer(800, 100)` for everyone: a heavy wobbling camera.
  - `Battle_Filter` every 3.25 s: a white-mask fade to a random tint (RGB 0-100 %, transparency 0-50 %) over 1.5 s,
    then back over 1.5 s.
  - `Battle_Death`: when your archer dies, your camera noise is cleared. When ≤1 key unit remains, noise is cleared for
    all and the colour flashes stop. (It runs after Survival_Death, which is registered first, so scoring is unaffected.)
- **Timeline:** t=0: music NightElf1, archers, paused, 160 s timer, text, Survival_Death/Expire + Drink_Patrol enabled.
  t=5: unpause, Battle_Filter + Battle_Death, camera noise, sound.
- **How you lose / win / finish:** Your archer dies, and you score the current ante. Last archer alive wins. At 160 s
  all survivors tie.
- **Computer-player AI:** None. A computer's archer (acquire 100) stands still and only shoots enemies that come within
  100 u.
- **Remake notes:**
  - One-shot duel: 5 HP, 16-18 damage, 800 range, 1.5 s cooldown, 0.72 s wind-up, homing arrows at 900.
  - No auto-targeting beyond 100 u, so you must target manually.
  - Drunk layer: strong screen wobble (magnitude 800) plus random colour flashes every 3.25 s (1.5 s in, 1.5 s out).
    Removed per player on death.
  - 160 s limit (Way of the Bow is 120 s).
  - Complete.

### Chicken Stampede (Ultima-X bundle: Stampede_Initialization_Copy, event #162)
- **How it can be reached:** Free Play only: Bloodlust onto the Beastmaster display unit (#17). Variant of Stampede (#17).
- **Goal (in-game text):** "Chicken Stampede: / Dodge the stampede as long as possible!"
- **Type & scoring:** Survival (`Survival_Death` only), Ante 9 − N, winner 8. Ties are not shared.
  **No timer and no expiry**: it lasts until one grunt is left.
- **Arena:** Stampede (-4736,3200)-(-3328,3968), 1408 x 768 u (11 x 6 tiles), centre (-4032,3584).
  - Grunts spawn at (centre.x − 384, centre.y + U(−192,192)), i.e. x = −4416, facing east.
  - Camera pans to (centre.x − 384, centre.y), bounds = region.
- **Player unit:** Grunt 'ogru': speed 270, collision 31, HP 700, armor 1 (large), **no attack** (weapons off).
- **Hazards / opponents / mechanics:**
  - "Beastmaster" 'Orex' (P12, Rexxar model at 0.5 scale): speed 320, collision 4, HP 100, no attack, set to level 6
    with A00C.
  - A00C "Stampede (BLOOD)" (base ANst, level 1): 3 beasts/s, beast collision radius 20, **25 damage** per beast in a
    **100 radius**, damage delay 0. Area 1000, cast range 300, channel 300 s, 0 cooldown / 0 mana.
    Beast missile art is **EasterChicken**, missile speed 600.
    The stock Stampede (#17) uses ANst at 2 beasts/s, radius 55, 60 damage, speed 500.
  - Standard WC3 Stampede behaviour: beasts spawn spread across the AoE and charge in the cast direction, exploding on the
    first enemy (approximate; engine-defined).
  - Beastmaster #1 at the centre faces west and casts toward (centre.x − 128, centre.y), i.e. at the grunts.
  - `Stampede_Spawn_Copy`, every 4 s while P12 owns < 12 units:
    - Wait 3 s.
    - Spawn another Beastmaster at (centre.x, centre.y + U(−256,256)) facing 90·U{1..4}° (N/W/S/E), with a teleport effect.
    - It casts Stampede at the point 128 u ahead of its facing.
    - The if/else on "one 'Nbst' exists or coin flip" has two identical branches (leftover).
  - `Stampede_Maintain_Copy`: whenever any unit's spell ends or finishes, it re-casts Stampede toward its own position
    + (U(−128,128), 0), i.e. due east or west.
  - About 28 chicken hits kill a 700 HP grunt (700/25, before armor).
- **Timeline:**
  - t=0: music OrcTheme, grunts, Beastmaster #1, text, Survival_Death.
  - t=7: spawn and maintain triggers enabled, #1 starts casting, chicken sound.
  - Then +1 Beastmaster about every 4 s (first within 3-7 s), up to 12 P12 units at about t≈50 s.
    That is up to 36 chickens/s from four directions.
- **How you lose / win / finish:** Your grunt dies and scores the ante. The last grunt standing wins.
  All remaining dying in one instant is a Draw.
- **Computer-player AI:** None. Computer grunts stand still.
- **Remake notes:**
  - Dodge streams of fast exploding chickens: 600 u/s, 25 damage in a 100 radius, 3 per second per caster.
  - Casters ramp from 1 to 12, one every 4 s. Each new stream points N, S, E or W at random (the stock game only alternates E/W every 20 s).
  - Tanky 700 HP runners with no attack. The arena is short on the N/S axis (768 u), so N/S streams cross it quickly.
  - No time limit.
  - Complete but clearly a quick copy (identical if/else branches).

### Sick Peon Pandemonium (Ultima-X bundle: Peon_Initialization_Copy, event #163)
(The bundle file also contains the Copy_2 functions because of name matching. The #163 initializer is the "Sick Peon"
one.)
- **How it can be reached:** Free Play only: Cripple onto the Peon display unit (#1 Peon Pandemonium).
- **Goal (in-game text):** "Sick Peon Pandemonium: / Be the first one to die!"
- **Type & scoring:** Reverse race: **dying is finishing.**
  - `Sleepy_Finish` sends a dying key unit to `Race_Finish` with `udg_Integer_Ante=8`: first to die 8, then 7, ...,
    last survivor 9 − N. Everyone scores. TiesPossible is set, but Race_Finish ignores it, so no shared scores.
  - `Sleepy_Expire` is enabled, but **no timer is started**, so it never fires. No time limit: the game ends only when
    every peon is dead ("Finished!").
- **Arena:** Peon_Pandemonium (-2432,1280)-(-1408,2304), 1024 x 1024 u (8 x 8 tiles), centre (-1920,1792).
  - Blighted (P12). Destructables in it are restored to full life.
  - Peons start at polar(centre, U(100,300), U(0,360)).
  - Shooter spawn strips (udg_Regions_Current[1..4]) are 1152 x 160 u, 192-352 u outside each side:
    Peon_1 east (-1216,1216)-(-1056,2368), Peon_2 north (-2496,2496)-(-1344,2656),
    Peon_3 west (-2784,1216)-(-2624,2368), Peon_4 south (-2496,928)-(-1344,1088).
- **Player unit:** "Sick Peon" o001: speed 190, collision 16, HP 150, regen 0.25, armor 0 (medium), no attack.
  Curse effect on the head.
- **Hazards / opponents / mechanics:** This uses the stock game's `Peon_Spawn` plus `Peon_Fire_Copy`.
  - `Peon_Spawn`, every 8 s while P12 owns < 30 units:
    - Wait U(0,2) s.
    - Spawn a 'Catapult' (ncat) if P12 owns < 8 units, otherwise a 'Demolisher' (ocat, has Burning Oil).
      Position is a random point in a random strip, facing the centre.
    - All P12 units then attack-ground (851984) random arena points.
    - Catapult/Demolisher: 425 HP, 81+3d21 siege (84-144), cooldown 4.5, range 2000, artillery at 400 u/s.
      Splash: full 25, 40 % at 50, 25 % at 150.
    - If the lobby's `Secret_Slow_Peon` flag is also set (Slow cast on a Peon display unit), catapults become n004
      "Catapult (Slow)": cooldown 1.0, projectile speed 100.
  - `Peon_Fire_Copy`, every 2 s: every P12 unit is re-ordered to attack-ground a random arena point.
  - With the default damage table (siege vs medium 50 %) a direct hit does 42-72, so about 3 direct hits kill a peon.
    Assumption: the table is not overridden in war3mapMisc.txt.
- **Timeline:**
  - t=0: music Orc3, peons, blight, text. Sleepy_Finish/Tie_Death/Sleepy_Expire enabled.
  - t=6: Peon_Spawn + Peon_Fire_Copy enabled, narrator sound.
  - +1 catapult per ~8 s, cap 30 (about 240 s).
- **How you lose / win / finish:** Get killed as early as possible (8 points for the first death). The last peon alive
  gets the fewest points, and the game waits for it to die.
- **Computer-player AI:** None. Computer peons stand still, so they tend to die late (bad in this game).
- **Remake notes:**
  - Inverted Peon Pandemonium: run into randomly aimed catapult impacts. Shots land at random points every 2-4.5 s.
    Artillery lands on the ground, so hits are luck plus positioning.
  - Shooters are outside the arena on all 4 sides; 1 more every 8 s, first 8 catapults then demolishers with burning oil.
  - Placement = order of death, 8, 7, ...
  - No time limit: a peon hiding far from impacts stalls the game. Consider adding a timer.
  - Complete, but the missing timer looks like an oversight (Sleepy_Expire is enabled for a timer that is never started).

### Piggy Pandemonium (Ultima-X bundle: Peon_Initialization_Copy_2, event #164)
- **How it can be reached:** Free Play only: Cripple onto the Troll Hunter display unit (#36 Pork the Piggy).
- **Goal (in-game text):** "Piggy Pandemonium / Survive as long as possible!"
- **Type & scoring:** Survival, Ante 9 − N, winner 8.
  - **Ties shared** (TiesPossible + Tie_Death): pigs dying in the same instant all get the lower value.
    Everyone remaining dying together is a Draw.
  - **No timer / no expiry.**
- **Arena:** same as Sick Peon: 1024 x 1024 u (8 x 8 tiles), centre (-1920,1792), the same four shooter strips outside.
  Pigs start at polar(centre, U(100,300), U(0,360)). Not blighted; destructables restored.
- **Player unit:** "Piggy" npig: speed 190, collision 15, **HP 10**, armor 0 (medium), no attack.
  - It has **Wander (Awan)**, so an idle player pig may wander on its own.
- **Hazards / opponents / mechanics:**
  - `Peon_Spawn_Copy_2`, every 1.5 s while P12 owns < 60 units:
    - Wait U(0,2) s.
    - Spawn a "Troll Hunter" (ohun) if P12 owns < 40, otherwise a Demolisher (ocat). Random strip point, facing the
      centre, teleport effect.
    - Then run Peon_Fire_Copy_2.
    - Rate is about 1 per 1.5 s: about 40 hunters by t≈65 s, 60 shooters by t≈95 s.
  - Troll Hunter (ohun): **invulnerable**, 350 HP, speed 270, collision 48.
    - Attack 22+1d5 pierce (23-27; 75 % vs medium is 17-20, more than 10), cooldown 2.31, **range 20000**.
    - Artillery projectile at 1200 u/s, splash full 10. Artillery lands where it was aimed, so pigs can dodge.
  - Demolisher: 84-144 siege, splash 25/50/150. Even its 25 % outer splash kills a pig.
  - `Peon_Fire_Copy_2`, every 2 s: all P12 units attack-ground random arena points.
    Its extra "attack a random 'opeo'" order has no target (no peons exist; copy leftover).
  - `Peon_Target`, every 1.5 s: one random P12 unit is ordered to attack a random non-P12 unit inside the arena, i.e.
    a pig (aimed shots).
  - `SetGameSpeed(MAP_SPEED_SLOW)` is called **without** unlocking the locked speed. Other games unlock, wait 0.05,
    set, wait, lock. So this probably has no effect.
- **Timeline:** t=0: music Orc3, (slow speed attempt), pigs, text, Tie_Death + Survival_Death.
  t=6: spawner, Fire_Copy_2 and Peon_Target on, sound.
- **How you lose / win / finish:** Any hit kills your pig and you score the ante. The last pig alive wins.
- **Computer-player AI:** None; the pig's Wander ability is the only "movement" a computer pig gets.
- **Remake notes:**
  - One-hit-kill dodge game with fast-growing fire: invulnerable spear throwers ring the arena, +1 every ~1.5 s up to
    40, then demolishers up to 60.
  - Random barrages every 2 s plus one aimed shot at a random pig every 1.5 s. Spears fly at 1200 and land where aimed.
  - Shared scores for simultaneous deaths.
  - No time limit, but it ends quickly by design.
  - Oddities: player pigs have Wander; the leftover "attack peon" order; a slow-speed call that probably does nothing.
    Otherwise complete.

### Wild Clicking Duel (Ultima-X bundle: Clicking, event #166)
- **How it can be reached:** Free Play only: select the hidden Shaman 25 times (UserData 169 → 166), then walk it onto
  the switch.
- **Goal (in-game text):** "Wild Clicking Duel / Do not stop LEFT-Clicking the Tower." Then at t=4:
  "Please start clicking the tower now."
- **Type & scoring:** Survival, Ante 9 − N, winner 8.
  - Ties shared (TiesPossible + Tie_Death): everyone who misses in the same check gets the same, lower score.
  - **No timer**: two diligent players could click forever.
- **Arena:** Bomb_Baldwin (-4992,-1152)-(-3328,512), 1664 x 1664 u (13 x 13 tiles), centre (-4160,-320).
  - Arcane Tower (hatw, P12) at the centre is `udg_Click_Unit`.
  - One Shaman per playing slot i at 400 u, angle (45·i − 22.5)°, facing the centre. Created neutral and handed out
    randomly.
  - **All units stay paused all game** (PauseAllUnitsBJ(true), never undone). Music stopped.
- **Player unit:** Shaman 'oshm' (paused; only its existence matters): HP 335, collision 16.
  Abilities Purge + a unit inventory in this map.
- **Hazards / opponents / mechanics:** Input is clicking (selecting) the tower.
  - `Clicking_Bugger` loop (started at t=8, re-executes itself while enabled):
    1. Every player owning a Shaman is put "in trouble".
    2. Wait 0.5 s.
    3. Every player still in trouble loses: their Shaman is killed (scored by Survival_Death), with a building-explosion
       effect. The Shaman is removed and a "Bored Shaman" (o006) is created for them. Message: "<name> got tired and is
       now taking a break." (3 s).
    4. Wait 0.25 s, then repeat.
  - `Clicking_Save`: a selection event on the tower by a player in trouble takes them out of trouble.
  - So you need at least one tower click inside every 0.5 s window, and windows repeat every 0.75 s. Clicks in the
    0.25 s gap do nothing.
    - Relies on WC3 firing the select event on every click of an already-selected unit. The lobby's 25-click secret
      relies on the same.
    - WC3 waits are imprecise online.
  - Bored Shaman (o006), cosmetic toys:
    - Fireworks A00S (Flare base, cooldown 0.2, range 99999): 5 flare effects in a 120 u circle for 10 s.
    - Throw Flowers A01U (Healing Spray base, heals 0, range 400): 1-5 random flower doodad models in a 30 u circle for 20 s.
- **Timeline:** t=0: shamans, tower, pause, text, Survival_Death. t=4: "Please start clicking the tower now." t=8: loop
  starts, and Tie_Death, Save, Firework and Flower triggers are enabled.
- **How you lose / win / finish:** Miss a 0.5 s window and you are out. The last clicker wins. If everyone left misses
  the same check, it is a Draw.
- **Computer-player AI:** None. Computers never click and are eliminated at the first check (t≈8.5 s).
- **Remake notes:**
  - Endurance clicking: at least 1 click on the target per 0.5 s window (0.75 s cycle). Missing players are eliminated
    together and share the score.
  - No time limit; consider adding one, or shrinking the window.
  - Bug: the Bored Shaman is created at the location of a Shaman that was just removed. `GetUnitLoc(null)` gives
    **(0,0)**, far outside the locked camera. The intended "loser gets a firework/flower toy in place" almost certainly
    never showed.
  - `udg_Integer_ShamanClicks` is reset here but unused (it belongs to the lobby secret).

### ??? — DotA joke (Ultima-X bundle: Defense, event #167)
- **How it can be reached:** **Never in the shipped map.** Table entry 167 exists, but no unit is ever given
  UserData $A7, and nothing else executes the trigger.
- **Goal (in-game text):** Title "???" with no objective line. The second line is an all-caps Swedish quote of the
  chorus of Basshunter's song "DotA", stored with mojibake ("HÃR" for "HÄR"). Not reproduced here.
- **Type & scoring (if it ran):** Survival (`Survival_Death` only), Ante 9 − N, no ties, **no timer**.
- **Arena:** region DotA (-4416,-13280)-(-4064,-12992), 352 x 288 u (2.75 x 2.25 tiles), centre (-4240,-13136). The camera
  is locked to this tiny box, so the view is essentially fixed.
  - Player peons start 50 u from the centre at (slot·135 − 22.5)°, facing (far-away) Destruction_Dance.
- **Player unit:** Peon 'opeo': speed 190, collision 16, HP 50, no attack.
- **Hazards / opponents / mechanics:** A mock DotA lane, all owned by P12.
  - West "Sentinel", recoloured red (units within 300 of centre − (650,0)):
    - Tree of Life (etol) at centre − (600,0): 1300 HP, 40+1d10.
    - 2 Treants (efon) at centre − (400,0): 300 HP, 14+1d3.
    - 1 Archer at centre − (400,0).
  - East "Scourge", recoloured green:
    - Necropolis (unpl) at centre + (600,0): no attack.
    - 3 invulnerable Cultists (u004) at centre + (400,0): 25 HP, 9+1d2, speed 240.
  - All units get acquire range 100. The game speed is unlocked, set to SLOWEST and relocked.
  - After 2 s the acquire range becomes 1000 (archer sound). Both "armies" (same owner, so not fighting each other)
    then walk in and kill the peons.
- **Timeline:** t=0 setup and text; t≈0.1 SLOWEST speed; t≈2 the creeps engage.
- **How you lose / win / finish:** The last peon alive wins.
- **Computer-player AI:** None.
- **Remake notes:** Joke / unfinished and unreachable. If remade:
  - Helpless peons in the middle of a two-sided creep lane; last survivor wins.
  - The whole thing runs in slow motion.
  - Lowest priority.

### Underground Run (Ultima-X bundle: Burrow, event #168)
The quest log lists it as a regular game, "Underground Burrow" ("Race to the finish, burrowing to heal yourself";
"This game replaced Demon Hunter"), but in Ultima-X it is reachable only through the lobby secret.
- **How it can be reached:** Free Play only: walk the hidden dark Underground Spider at (-2000,-4600) onto the switch.
- **Goal (in-game text):** "Underground Run / Reach the end, burrowing to heal yourself! / Press "B" to burrow."
- **Type & scoring:** Race.
  - Ante 8 (1st 8, 2nd 7, ...). Finishers are removed (teleport).
  - Dying (`Race_Death`) scores 0.
  - 60 s timer (started before the 5 s pause, so about 55 s of play). Expiry kills everyone left, who score 0.
    "Finished!" if anyone finished, else Draw.
- **Arena:** Flight_of_the_Footmen (2944,-6400)-(6272,-5120), 3328 x 1280 u (26 x 10 tiles). This is Flight of the
  Footmen's course, blighted, at noon, with 10 burning-fire emitters at random points.
  - Start: random point in box (3008..3136, −6208..−6080), west end of the bottom lane. Camera pans there.
  - Finish: region Flight_Finish (3008,-5440)-(3136,-5312), 128 x 128, with a Circle of Power at (3072,-5376). It is at
    the west end of the top lane, only 768 u north of the start.
  - The static pathing map shows a walled middle band (tower pockets). The course is therefore a **U**: east ~3000 u
    along the bottom lane (about 250 u wide), north ~1000 u at the east end (x≈5900-6230), west ~3000 u along the top
    lane. About 7000+ u in total, about 24 s of pure running at 300.
- **Player unit:** "Underground Spider" u002 (Crypt Fiend at 0.5 scale).
  - Speed 300, collision 10, **HP 125, regen 0**. No attack (weapons off).
  - A008 "Burrow" (Abur base, hotkey B): morph to u003, 1.45 s morph duration, 0 cooldown, 0 mana.
    The burrowed form has 150 max HP and cannot move.
- **Hazards / opponents / mechanics:**
  - **Health drain** `Burrow_Damage`: every 0.15 s, each spider in `udg_Temp_UGroup` loses 2 HP (13.3 HP/s). A full
    125 HP lasts **9.4 s**. Death at 0 HP.
  - `Burrow_Health`: on SPELL_CAST of A008, set life to 100 % and remove the unit from the drain group. The same ability
    id toggles, so burrowing and unburrowing both heal fully.
  - `Burrow_Unburrow`: any point or target order to a u002 (e.g. a move) puts it back in the drain group. After
    unburrowing you do not drain until you give your next order.
  - 10 "Den Spiders" (nspg, P12): HP 240, speed 270, **collision 60**, no attack. They start at random arena points and
    patrol to another random point: moving body-blockers in a narrow lane.
  - `Burrow_Boom` every 0.7 s, cosmetic, rolls 1-8:
    - 1-2: building explosion + camera quake 500 (about 0.5 s).
    - 3/5: impale dust. 4: doom death. 6: quake only. 7-8: nothing.
- **Timeline:**
  - t=0: music Undead3, spiders (fire pillar effect), blight, fire emitters, Circle of Power, 10 Den Spiders patrolling,
    60 s timer, text, paused.
  - t=5: unpause, sounds, fire-rock effect on spiders. Race_Death, Race_Expire, drain, boom, heal and unburrow triggers
    and Flight_Finish enabled.
- **How you lose / win / finish:** Enter the finish region to place (8, 7, ...). Drain death or timeout scores 0.
- **Computer-player AI:** None. A computer spider starts in the drain group and dies at about t≈14 s.
- **Remake notes:**
  - Drain-race: −13.3 HP/s (2 HP per 0.15 s) on a 125 HP unit, so you must stop and "burrow" at least twice on a
    ~7000 u U-course at speed 300.
  - Burrow/unburrow each fully heal, but the morph costs ~1.45 s each way. Designer advice: burrow as late as possible.
  - Moving obstacles: 10 wide (collision 60) patrolling spiders in ~250 u lanes.
  - 60 s limit (55 s effective), placement 8/7/6...
  - Complete. It is a reskin of Flight of the Footmen's course, and reachable only by the secret.

### Wild West Duel (Ultima-X bundle: Buzzer, event #169)
- **How it can be reached:** Free Play only: walk the hidden dark Shaman at (-2000,-4500) onto the switch (without the 25
  clicks, which turn it into Clicking).
- **Goal (in-game text):** "Wild West Duel / LEFT-Click the tower AFTER you hear the sound." At the buzzer:
  "LEFT-CLICK IT NOW!" (red, 3 s).
- **Type & scoring:** Elimination rounds, survival scoring. Ante 9 − N, winner 8.
  - Ties shared (TiesPossible + Tie_Death). **No timer**; rounds continue until one player is left.
- **Arena:** identical to Wild Clicking Duel: Bomb_Baldwin 1664² u (13 x 13 tiles), Arcane Tower at the centre
  (`udg_Click_Unit`). Shamans at 400 u, angle (45·i − 22.5)°, handed out randomly. Everything paused all game;
  music stopped.
- **Player unit:** Shaman (paused), HP 335. Only selection matters.
- **Hazards / opponents / mechanics (per round):**
  1. `Buzzer_Activate`: wait U(4, 9) s. Then start the reflex timer (`Buzzer_Timer`: +0.01 every 0.01 s), set
     Click_Please = true, play a thunderclap effect on the tower, show the text and play the "Switch" sound.
  2. `Buzzer_Click` (tower selected by a player "in trouble"):
     - Before the buzzer, the clicker's unit is killed: "<name> clicked too early!".
     - After the buzzer, if more than one player is still in trouble, the clicker is safe (removed from trouble,
       spirit-walker effect).
     - If the clicker is the last one in trouble, they are killed: "<name> was the slowest one with a reflex time of
       X.X seconds!" (the first 3 characters of R2S).
  3. `Buzzer_Aftermath`: 5 s after the buzzer, Click_Please goes false and the timer resets. Anyone still in trouble is
     killed: "<name> never clicked at all!".
  4. Wait 2 s. Everyone with a living Shaman is put back in trouble. If more than 1 player remains, the next round
     starts; otherwise the loop stops.
  - `Typing_Terror_Death` (reused) on every death: lightning bolt + explosion effects at the corpse, camera quake 500,
    and the owner is removed from trouble.
  - Clicks while not "in trouble" (the first 4 s, the 2 s gap after a round, or after being safe) are ignored.
- **Timeline:** t=0: setup, pause, text, Survival_Death. t=4: Tie_Death, Activate, Click and Typing_Terror_Death
  enabled, and round 1 starts (buzzer at t≈8-13). Each round lasts about 4-9 s + 5 s + 2 s.
- **How you lose / win / finish:** Click early, click last, or don't click within 5 s. Normally one elimination per round.
  The last player standing wins.
- **Computer-player AI:** None. Computers never click and die in round 1 ("never clicked at all!").
- **Remake notes:**
  - Reaction duel: random 4-9 s delay, then an audio and visual cue.
  - A false start kills you. After the cue, the slowest clicker (the last one remaining) dies, and so does anyone who
    doesn't click within 5 s.
  - Show the loser's reflex time to 0.1 s.
  - 2 s pause between rounds.
  - Complete.

---

### Secret / debug content

#### DEBUG trigger (l.3076) and when it runs
- `Initialization` ends with `if udg_Boolean_DEBUG then set udg_Integers_Scores[1]=60 ; TriggerExecute(gg_trg_DEBUG)`,
  otherwise it plays the intro (l.3975).
- `udg_Boolean_DEBUG` is declared `false` (l.233) and **is never assigned anywhere**, so DEBUG never runs in the shipped
  map.
- What it would do:
  - Runs `Disable` and turns fog/black mask off.
  - Sets Player 1 as `udg_Player_Winner`, `udg_Boolean_GameIsOver = true` and `udg_Integer_GamesPlayed = 999`.
  - Sets camera bounds to Clean_Crew and creates the "Game 1 of 8" leaderboard.
  - Runs `Next Event`, which (GameIsOver) goes straight to `Free_Initialization`.
  - Result: an instant Free Play sandbox with Player 1 as champion and 999 free games. The author's test harness for
    picking any game, including the secret ones.
- Other DEBUG hooks:
  - `Set_Variables` defeats all 12 players if DEBUG is on and Player 1's name is not "Ancanus" (author lock).
  - `Game_End` skips the Outro and free-game award.
  - `Intro_Body`, `Intro_End` and `Camera` are skipped.

#### Cursed Lich (Free_Lich_* chain, Free Play lobby only)
Objects spawned by `Free_Spawn` every lobby:
- Item **I001 "???"** (Runed Bracers icon) at region Lich (-1616,-4944), about 720 u south of the lobby camera bound.
- Item **I002 "Ring of Loathing"** at Mortar_4's centre (-2176,-1408), north of the lobby.
- A Circle of Power "This space for rent" (n00E, owned by Player 1) in region Power (-2688,-4224)-(-2592,-4128). This is
  the empty bottom-left grid slot.

Steps (all from `j.txt` l.18777-19047 and `Free_Secret_Variants` Func040):
1. **Summon** (`Free_Lich_Create`): any unit casts Thunder Clap (AHtc), War Stomp (AOws) or AOw2 while inside the
   200 x 200 box centred at Clean_Crew centre + (−768,−768) = (−2624,−4160), i.e. on the "space for rent" corner.
   The Mountain King (#23) and Tauren Chieftain (#10) display units have these.
   - Creates a **Lich** ('Ulic', unit name "A102CKAJ", has an inventory) for the champion, paused, with a lightning bolt,
     a green orb overhead and 20 fading thunder sounds.
   - Sets `udg_Lich_Activated` (never reset) and enables steps 3 and 7.
2. **Give it I001, then Purge it** (Purge order 852111 on the Lich; the Shaman display unit #59 has Aprg).
   - If it holds I001: `Boolean_Lich = true` (GoodJob sound), else QuestFailed.
   - Either way `Free_Lich` starts: every 0.7 s the Lich is replaced by a random creep for 0.35 s, then turned back into
     the Lich and re-paused.
3. **Chat code "18346"** (exact match, champion only, **one attempt**):
   - After a successful step 2: "Cursed Lich: ....What was that? ...Can anyone hear me?". A red dream-filter pulses
     every 0.8 s, time is set to midnight and step 4 is enabled.
   - Otherwise: "Cursed Lich: ....zxcv." and the chain is dead until the next lobby.
4. **Blizzard** (ACbz; Frost Revenant display unit #62) with its target point within 200 u of the Lich:
   - The flicker stops, the Lich freezes and step 5 is enabled.
   - Success sound only if it was in Lich form at that moment. You must time it against the 0.7 s flicker.
5. **Breath of Fire** (ANbf; Pandaren Brewmaster #50) targeted within 200 u:
   - If it is the Lich: Sargeras roar, "Finally! I'm free! But... I feel I'm missing something." `Boolean_Lich4` is
     set, a **10 s** door timer starts, and `Free_Lich_8` makes the Lich play "stand channel" every 3 s when it is in
     the Power region or within 100 u of the Ring.
   - If it is a creep: "..." (fail).
   - Either way the Lich is unpaused and becomes controllable by the champion.
6. **Within 10 s, break the Lever** (the DTlv destructable at Free_Lever) → `Free_Lich_6`:
   - "It seems you broke something!" reveals a hidden destructable (type 'OTds', placed at (−1792,−3456) at
     **z = −1491**, underground, and hidden at map start) and pauses the door timer.
   - Before step 5 the lever only says "Nothing seems to happen."
   - If the timer runs out: "You hear the sound of a door being shut." (sets `Boolean_Lich5 = false`).
7. **Walk the Lich onto the glowing switch** (`Free_Lich_5`):
   - Freed: it dies with "Blast, my one weakness, Glowing switches! If only I had gotten my lucky ring." A red,
     70 %-transparent wandering ghost Lich (neutral passive) appears on the switch.
   - Not freed: it explodes, "*splat*".
   - The Lich has UserData 0, so it never starts a game.
- **The Ring can't be kept:** `Free_Lich_7` takes the Ring of Loathing away from any unit that picks it up and blinks it
  to a random point in the lobby.
- **Killing the Lich:** "If that's how you deal with things, I don't want to play with you anymore."
- **Assessment: unfinished easter egg; it unlocks no minigame and awards nothing.**
  - `Boolean_Lich5` (the "door") and the revealed OTds destructable are never read or used again.
  - The "lucky ring" step has no payoff.
  - `Free_Activate` disables `Free_Lich_6` and nothing re-enables it, so the lever step only works in the **first**
    Free Play lobby.
  - The Lich's odd unit name "A102CKAJ" may be meant as a clue for the code. Unverified.

#### Other lobby secrets (not in scope, for reference)
The same `Free_Secret_Variants` trigger sets about 45 `udg_Secret_*` flags for variants of regular games (Drunk_*,
Slow_*, Invis_*, Cripple_*, Reverse_*, Bloodlust_*). They are keyed by casting Drunken Haze, Slow, Invisibility,
Cripple, Purge or Bloodlust on specific display units. Two examples:
- Slow on the Archer: "Matrix's Arrow-Time" #6.
- Slow on the Beastmaster: "There is No Stampede" #17.

Bloodlust on the Peon display unit turns it into a Chaos Peon with UserData 160 (Fel, not covered here).
