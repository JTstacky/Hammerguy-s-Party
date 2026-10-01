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
import { DarkForest } from './up/12-darkforest.js';
import { SleepyTime } from './up/29-sleepy.js';
import { ThePlague } from './up/37-plague.js';
import { SheepShearers } from './up/39-sheep.js';
import { DoggyHell } from './up/40-doggy.js';
import { AncientPunisher } from './up/41-ancient.js';

export const UTHER = [
  MortarMayhem, // #1 Peon Pandemonium
  DarkForest, // #12 Dark Forest
  KodoStampede, // #17 Stampede
  SleepyTime, // #29 Sleepy Time
  ThePlague, // #37 The Plague
  SheepShearers, // #39 The Sheep Shearers
  DoggyHell, // #40 Doggy Hell
  AncientPunisher, // #41 Ancient Punisher
  WispWheel, // #47 Wheel of Fire
];

export const EXTRAS = [GolemGauntlet, KingOfTheHill, GoldRush, IceSumo, SapperTag];

export const MINIGAMES = [...UTHER, ...EXTRAS];

// What a party rolls from: the ports once there are enough for a full match.
export const ROLL = UTHER.length >= 8 ? UTHER : MINIGAMES;
