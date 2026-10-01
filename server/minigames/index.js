// Minigame registry.
//  - UTHER: ports of Uther Party 4.0's events, in event order. A party rolls
//    from these, as the original rolls from its list.
//  - EXTRAS: Hammerguy's Party originals from before the ports. They are not
//    rolled but can still be played with ?only=<id>.
import { MortarMayhem } from './mortar.js';
import { KodoStampede } from './kodo.js';
import { WispWheel } from './wisp.js';
import { ObeyArchimonde } from './up/22-obey.js';
import { WhackAFiend } from './up/23-whack.js';
import { CrabIsland } from './up/26-crab.js';
import { SkullOfGuldan } from './up/31-skull.js';
import { PorkThePiggy } from './up/36-pork.js';
import { TidesOfDarkness } from './up/44-tides.js';
import { GolemGauntlet } from './race.js';
import { KingOfTheHill } from './koth.js';
import { GoldRush } from './gold.js';
import { IceSumo } from './sumo.js';
import { SapperTag } from './potato.js';

export const UTHER = [
  MortarMayhem, // #1 Peon Pandemonium
  KodoStampede, // #17 Stampede
  ObeyArchimonde, // #22 Obey Archimonde
  WhackAFiend, // #23 Whack-a-Fiend
  CrabIsland, // #26 Crab Island
  SkullOfGuldan, // #31 The Skull of Gul'dan
  PorkThePiggy, // #36 Pork the Piggy
  TidesOfDarkness, // #44 Tides of Darkness
  WispWheel, // #47 Wheel of Fire
];

export const EXTRAS = [GolemGauntlet, KingOfTheHill, GoldRush, IceSumo, SapperTag];

export const MINIGAMES = [...UTHER, ...EXTRAS];

// What a party rolls from: the ports once there are enough for a full match.
export const ROLL = UTHER.length >= 8 ? UTHER : MINIGAMES;
