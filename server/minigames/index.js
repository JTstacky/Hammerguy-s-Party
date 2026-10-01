// Minigame registry.
//  - UTHER: ports of Uther Party 4.0's events, in event order. A party rolls
//    from these, as the original rolls from its list.
//  - EXTRAS: Hammerguy's Party originals from before the ports. They are not
//    rolled but can still be played with ?only=<id>.
import { MortarMayhem } from './mortar.js';
import { KodoStampede } from './kodo.js';
import { WispWheel } from './wisp.js';
import { RatMaze } from './up/02-ratmaze.js';
import { HotMortar } from './up/04-hotmortar.js';
import { PolymorphRing } from './up/09-polyring.js';
import { BombBaldwin } from './up/11-baldwin.js';
import { HungryKodos } from './up/13-hungrykodos.js';
import { RaiderRelay } from './up/14-raider.js';
import { GolemGauntlet } from './race.js';
import { KingOfTheHill } from './koth.js';
import { GoldRush } from './gold.js';
import { IceSumo } from './sumo.js';
import { SapperTag } from './potato.js';

export const UTHER = [
  MortarMayhem, // #1 Peon Pandemonium
  RatMaze, // #2 The Rat Maze
  HotMortar, // #4 Hot Mortar
  PolymorphRing, // #9 The Polymorph Ring
  BombBaldwin, // #11 Bomb Baldwin
  HungryKodos, // #13 Hungry Hungry Kodos
  RaiderRelay, // #14 Raider Relay
  KodoStampede, // #17 Stampede
  WispWheel, // #47 Wheel of Fire
];

export const EXTRAS = [GolemGauntlet, KingOfTheHill, GoldRush, IceSumo, SapperTag];

export const MINIGAMES = [...UTHER, ...EXTRAS];

// What a party rolls from: the ports once there are enough for a full match.
export const ROLL = UTHER.length >= 8 ? UTHER : MINIGAMES;
