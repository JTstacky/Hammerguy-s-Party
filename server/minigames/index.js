// Minigame registry.
//  - UTHER: ports of Uther Party 4.0's events, in event order. A party rolls
//    from these, as the original rolls from its list.
//  - EXTRAS: Hammerguy's Party originals from before the ports. They are not
//    rolled but can still be played with ?only=<id>.
import { MortarMayhem } from './mortar.js';
import { KodoStampede } from './kodo.js';
import { CovertKitty } from './up/08-covert.js';
import { BlinkyBear } from './up/27-blinky.js';
import { MinotaurMaze } from './up/32-minotaur.js';
import { TheUnseen } from './up/34-unseen.js';
import { TroubledWaters } from './up/38-troubled.js';
import { DeathTrap } from './up/48-deathtrap.js';
import { WispWheel } from './wisp.js';
import { GolemGauntlet } from './race.js';
import { KingOfTheHill } from './koth.js';
import { GoldRush } from './gold.js';
import { IceSumo } from './sumo.js';
import { SapperTag } from './potato.js';

export const UTHER = [
  MortarMayhem, // #1 Peon Pandemonium
  CovertKitty, // #8 Covert Kitty
  KodoStampede, // #17 Stampede
  BlinkyBear, // #27 Blinky the Bear
  MinotaurMaze, // #32 Minotaur Maze
  TheUnseen, // #34 The Unseen
  TroubledWaters, // #38 Troubled Waters
  WispWheel, // #47 Wheel of Fire
  DeathTrap, // #48 The Death Trap
];

export const EXTRAS = [GolemGauntlet, KingOfTheHill, GoldRush, IceSumo, SapperTag];

export const MINIGAMES = [...UTHER, ...EXTRAS];

// What a party rolls from: the ports once there are enough for a full match.
export const ROLL = UTHER.length >= 8 ? UTHER : MINIGAMES;
