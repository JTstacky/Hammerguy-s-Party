# WC3 engine facts measured in Uther Party 4.0 (instrumented copy, 1.26a, game speed Fast)

Measured with the "Uther Party 4.0 CL" build: the original map plus a logger that samples every unit
every 0.03 s during experiments (0.1 s otherwise) and records orders, attack starts (EVENT_PLAYER_UNIT_ATTACKED),
damage, deaths and spell events with millisecond timestamps. Units were spawned by script in the empty
Tower Defense arena. Runs:

| Run | Command | Raw logs | Analysis |
|---|---|---|---|
| 2 | `-cl exp all` | `logs_up_run2/claude_up_1.txt` | `exp_up.py` |
| 4 | `-cl exp two` | `logs_up_run4_exp` | `exp2_up.py` |
| 5 | `-cl exp dodge2`, filmed at 30 fps | `logs_up_run5` | `exp2_up.py` |

`bow_up.py` checks the dodge rule against real Way of the Bow games.

## Movement
- Units reach full speed immediately and stop immediately. There is no acceleration: a peon ordered to move covers
  1.5 u in the first 0.026 s tick and 5.5-6 u (= 190 u/s) in every 0.03 s tick after that.
- Measured speeds match the object data exactly: peon 190, abomination 267-270, paladin 270.
- A unit stands still for the whole damage point (wind-up) of an attack. The abomination stopped for 0.5 s (its dmgpt) and then walked on.

## Unit-unit collision (two paladins, collision 31 each; eight peons, collision 16)
| Case | What happened |
|---|---|
| Enemy paladins walking head-on (10 u offset) | Pass each other. One sidesteps about 40 u, the other barely moves. Closest centre distance 44.5 u. About 0.3 s lost over 800 u. |
| Same owner, head-on | Same result: sidestep about 40 u, closest 67.9 u, about 0.3 s lost. |
| Walking past an idle enemy paladin | Passed at 57.5 u centre distance with no deviation at all (less than 31 + 31 = 62). Idle unit not shoved. |
| Walking past an idle own paladin | Sidestep about 45 u, closest 50.6 u, no measurable time lost. Idle unit not shoved. |
| Eight peons of 8 players swapping sides through the centre of a 300 u circle | Paths 632-990 u instead of 600; arrival 4.7-7.0 s instead of 3.2 s. The crowd in the middle costs 50-120 % extra time. |

- Enemy versus ally made no difference to steering. Units do not push each other: they steer around, and they
  are allowed to overlap by about 20-30 % of the sum of their collision radii while passing.

## Melee attacks (abomination: range 128, collision 48, dmgpt 0.5, speed 270, vs fleeing peon: speed 190, collision 16)
- The swing started with the target 255 u away centre-to-centre (edge-to-edge about 191 u, well over the 128 range),
  while the peon was running away.
- The hit landed 0.5 s later, when the peon was 350 u away. Once a melee swing starts, it connects unless the target
  gets out of range plus the attack's "range motion buffer" (250 by default) before the damage point.
- Remake rule: a melee hit connects if the target is within range + collisions + about 60 u when the swing starts.
  After that it is locked in, so outrunning a faster melee unit is impossible once it has started swinging.
- Equal speed (run 4): an abomination (270) chasing a mortal paladin (270) that runs straight away never got to swing
  in 4.7 s. Once the paladin stopped, it swung twice and hit twice. It started each swing at 204-207 u centre
  distance (range 128 + collisions 48 + 31 = 207). While the paladin circled at radius 350, the pursuer cut the corner:
  5 swings, 4 hits, with the fifth still in progress when the trial ended. Each started at 137-233 u, and each landed
  0.50 s after it started. For the remake, an equally fast runner is safe only while running straight. Any turn lets
  the chaser close in.
- WC3 units refuse to attack an invulnerable target. The attack order is dropped and the unit does nothing.

## Ranged missiles (Way of the Bow archer `earc`: weapon type "missile (splash)" with no splash radius, range 800, dmgpt 0.72)

**Result: these arrows do not home.** At release the arrow is aimed at the point where the target will be if it keeps
its current velocity, and it lands on that point. A target that holds its course is hit. A target that changes its
velocity between the release and the impact (stopping, turning, reversing) is missed. A target still turning at the
release, which has no settled velocity yet, is also missed. This is the designer's advice ("wait for the release,
then change direction").

- **Controlled tests.** An archer 400 u away (800 u in the first set) shot at a runner crossing its line of fire. The
  runner changed course a fixed time after each attack started; the release is at +0.72 s. Hits per attack:

| change of course, s after the attack started | 0.4 | 0.5 | 0.55 | 0.6 | 0.65 | 0.7 | 0.8 | 0.9 | 1.0 |
|---|---|---|---|---|---|---|---|---|---|
| paladin (270) reverses, 400 u (run 4) | 5/5 | 5/5 | | 0/5 | | 0/5 | 0/5 | 0/5 | 0/5 |
| paladin reverses, 800 u (run 4) | 5/5 | 5/5 | | 0/5 | | 0/5 | 0/5 | 0/5 | 0/5 |
| paladin reverses, 400 u (run 5) | | 4/4 | 4/4 | 0/4 | 0/4 | 0/4 | | 0/4 | |
| knight (350) reverses, 400 u (run 5) | | 4/4 | 4/4 | 0/4 | 0/4 | 0/4 | | 0/4 | |
| paladin stops for 0.5 s, then reverses (run 5) | | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | | 0/4 | |
| knight stops for 0.5 s, then reverses (run 5) | | 4/4 | 3/4 | 2/4 | 2/4 | 4/4 | | 0/4 | |

  Only arrows that had time to land before the trial ended are counted. In total:

  | runner's move | hits |
  |---|---|
  | reversed early (0.4-0.55 s) | 36 of 36 |
  | still turning at the release (reversed 0.6-0.7 s) | 0 of 44 |
  | reversed after the release | 0 of 38 |
  | stopped before the release | 35 of 40 |
  | stopped after the release | 0 of 8 |
  - **Reversing:** there is a sharp threshold between 0.55 and 0.60 s, the same for a hero and a plain knight.
    Before it the turn is finished at the release, the new velocity is aimed at correctly, and the arrow hits. After
    it the runner is still turning at the release, or turns after it, and the arrow misses.
  - **Stopping:** stopping before the release is harmless, because a standing target is aimed at correctly. The
    knight's few misses there came when it set off again just before impact. Stopping after the release (0.9 s)
    missed every time. A homing missile could not miss a target standing still. That is the decisive test.
- **Video.** The run 5 recording shows the paladin stopping 0.9 s into the draw. The arrow then flies in at head height,
  to the spot the paladin would have reached walking on, passes over it and vanishes. It never curves toward where the
  paladin actually stands. Frames: [img/arrow-misses-stopped-target.jpg](img/arrow-misses-stopped-target.jpg) (30 fps, read left to right).
- **Timing.** Hits landed 1.12-1.26 s after the attack started at 400 u, and about 1.55-1.62 s after at 800 u. That fits
  the release at +0.72 s and an arrow speed of about 1000 u/s.
- **Earlier knight test (run 2).** A knight weaving back and forth at random was hit 7 of 7 times. Its two reversals after
  a release came only 0.13-0.15 s before impact, too late to move it off the aim point. Hits landed up to 360 u from
  where the knight stood at the release, which is the lead in the aim.
- **Real play (Way of the Bow, 26 attacks in two tour games):** 11 hits.
  - Most misses have one of these causes:
    - the target changed course after the release;
    - the target was already dead;
    - the AI gave the archer a new order during its draw (0.41-0.70 s), which cancels the shot before release.
  - A few misses had no order involved. Their targets were probably walking around trees; Way of the Bow is played among
    tree cover, and pathing turns a unit without a new order.
- **Dead archers.** An arrow already released still hits after its archer dies. With the shooter killed 0.8 s after the
  attack started (earc, nhea) or 0.4 s after (ohun), 9 of 9 arrows hit, at 1.12 / 1.00 / 0.69 s after the attack started.
- The attack cooldown stretched from 1.5 s to 1.56-1.65 s while the archer had to turn to follow the moving target.
- **Remake rule:** at release, aim at target position + target velocity × flight time, and fly the arrow to that point.
  Hit whoever's collision circle covers it (radius about 31 for a hero). Do not re-aim in flight. Units should turn
  before they move off, which takes about 0.15-0.2 s for a reversal, so a well-timed turn is a dodge.

## Artillery (Uther Party catapult `ncat`: projectile speed 400, splash 25/50/150 with factors 1/0.4/0.25, dmgpt 0.1)
- Flight time measured from the attack event to the damage, against a held peon at distance d:

| d | 600 | 900 | 1200 | 1500 | 1800 |
|---|---|---|---|---|---|
| attack event to damage (s) | 1.136 | 1.886 | 2.637 | 3.388 | 4.138 |

  A least-squares fit gives delay = d / 399.7 - 0.365 s, so the rock really flies at 400 u/s. The constant offset
  (about 146 u of path) is the launch point being in front of the catapult plus the impact point.
- Delay from the order to the attack event: 0.015-0.168 s (turning to face the target).
- Splash tiers are exact: every unit in a tier takes the same fraction of that rock's rolled damage
  (for example 56.5 / 22.6 / 14.13 = 1 / 0.4 / 0.25). The damage is rolled once per rock, not per victim.
- The tier radii include the victim's collision radius. With the rock landing on the centre point:

| Peon centre distance | Tier |
|---|---|
| 0 | full |
| 50.1 and 50.6 | 0.4 (radius 50) |
| 67.9 to 164.7 | 0.25 (radius 150) |
| 175.0 | not hit |

  This fits radius + 16 (peon collision). For the remake: hit if distance <= radius + victim radius.
- A catapult with a unit in acquisition range (2000) fires at it on its own before any attack-ground order arrives.
  The first rock of the ring test hit the nearest peon because of this.

## Unit stats as the engine reports them (GetUnitState / GetUnitMoveSpeed at spawn)
Paladin (Hart/Huth) 650 HP, 270, turn 0.6, prop window 60°, acquire 500. Peon 50 HP, 190. Knight 800 HP, 350, turn 0.5.
Abomination 1080 HP, 270, turn 0.4, acquire 300. Satyr Trickster 240 HP, 270. Archer 5 HP, 270, acquire 800. Fire wisp (Kaboom) 120 HP, 350.
