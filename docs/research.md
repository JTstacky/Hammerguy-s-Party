# Research notes: the original Uther Party

These notes come from unpacking the original map `UtherParty.w3x` by TheZizz (and the later Uther Party 2 v0.4d and Ultima-V), taken from the GitLab archive `TheBestPlan/warcraft3-maps`.

## Structure and scoring

**Scoring.**

- A match is **8 games** drawn at random from 49, with no repeats.
- A tie at the end adds a Tie-Breaker game.
- The winner then gets "Free Play" games.
- Each game has an "ante":
  - In survival games, the first player to die gets `9 - players` points, and the ante rises by 1 with each death.
  - In race games, the ante starts at 8 and falls by 1 with each finisher.
- In practice, **1st place = 8 points, 2nd = 7, and so on.**

**Some of the minigames:**

| Name | Goal |
|---|---|
| Stampede | Dodge the stampede |
| Hot Mortar | Keep passing the mortar on (hot potato) |
| Wheel of Fire | Survive the spinning wheel of fire |
| The Kaboom Room | Survive; dying players explode |
| Hungry Hungry Kodos | Eat the pigs |
| The Abombinations | Keep away from the Abominations |
| Push the Ogre | Get the ogre to your circle |
| The Sheep Shearers | Reach the end |
| Stop and Go | Stop on red, go on green |
| The Salamander Sizzle | Shoot your opponents |

## How Hammerguy's Party compares

- **Scoring:** the original gives 1st place 8 points, 2nd place 7, and so on. Hammerguy's Party currently gives 3 / 2 / 1 to the top three. Switching to the original ante would bring it closer.
- **Minigames:** ours are recreations rather than copies, and some map directly onto originals:
  - Kodo Stampede ≈ Stampede
  - Sapper Tag ≈ Hot Mortar
  - Wisp Wheel ≈ Wheel of Fire
  - Golem Gauntlet ≈ The Abombinations / race games
- **Units:** Uther (`Huth`) is the unmodified WC3 Uther: speed 270, turn rate 0.6, propulsion window 60°, collision 32.
