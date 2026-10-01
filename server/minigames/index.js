// Minigame registry.
//  - UTHER: ports of Uther Party 4.0's events, in event order. A party rolls
//    from these, as the original rolls from its list.
//  - EXTRAS: Hammerguy's Party originals from before the ports. They are not
//    rolled but can still be played with ?only=<id>.
import { MortarMayhem } from './mortar.js';
import { KodoStampede } from './kodo.js';
import { WispWheel } from './wisp.js';
import { GolemGauntlet } from './race.js';
import { KingOfTheHill } from './koth.js';
import { GoldRush } from './gold.js';
import { IceSumo } from './sumo.js';
import { SapperTag } from './potato.js';
import { KaboomRoom } from './up/03-kaboom.js';
import { CleanupCrew } from './up/05-cleanup.js';
import { TreantValley } from './up/15-treant.js';
import { SkeletonSonata } from './up/16-skeleton.js';
import { SpikePit } from './up/20-spikes.js';
import { SalamanderSizzle } from './up/21-salamander.js';

export const UTHER = [
  MortarMayhem, // #1 Peon Pandemonium
  KaboomRoom, // #3 The Kaboom Room
  CleanupCrew, // #5 The Clean-up Crew
  TreantValley, // #15 Treant Valley
  SkeletonSonata, // #16 The Skeleton Sonata
  KodoStampede, // #17 Stampede
  SpikePit, // #20 The Spike Pit
  SalamanderSizzle, // #21 The Salamander Sizzle
  WispWheel, // #47 Wheel of Fire
];

export const EXTRAS = [GolemGauntlet, KingOfTheHill, GoldRush, IceSumo, SapperTag];

export const MINIGAMES = [...UTHER, ...EXTRAS];

// What a party rolls from: the ports once there are enough for a full match.
export const ROLL = UTHER.length >= 8 ? UTHER : MINIGAMES;
