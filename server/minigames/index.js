// Minigame registry.
//  - UTHER: ports of Uther Party 4.0's events, in event order. A party rolls
//    from these, as the original rolls from its list.
//  - ULTIMA_X: the games Uther Party vUltima-X adds (events 31 Domination and
//    51-78, then the hidden events 159-169), in event order. Their files are
//    server/minigames/ux/NNN-slug.js. Every port rolls.
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
import { WayOfTheBow } from './up/06-bow.js';
import { TaurenTragedy } from './up/10-tauren.js';
import { Masquerade } from './up/25-masquerade.js';
import { Abombinations } from './up/28-abom.js';
import { NaturesCircle } from './up/30-nature.js';
import { DestructionsDance } from './up/35-dance.js';
import { BattleForTheBottle } from './up/50-bottle.js';
import { FelOrcFiasco } from './up/51-fel.js';
import { SeaCombat } from './up/52-sea.js';

export const UTHER = [
  MortarMayhem, // #1 Peon Pandemonium
  WayOfTheBow, // #6 Way of the Bow
  TaurenTragedy, // #10 The Tauren Tragedy
  KodoStampede, // #17 Stampede
  Masquerade, // #25 The Masquerade
  Abombinations, // #28 The Abombinations
  NaturesCircle, // #30 Nature's Circle
  DestructionsDance, // #35 Destruction's Dance
  WispWheel, // #47 Wheel of Fire
  BattleForTheBottle, // #50 Battle for the Bottle (Free Play in the original)
  FelOrcFiasco, // #51 Fel Orc Fiasco (Free Play in the original)
  SeaCombat, // #52 Sea Combat (Free Play in the original)
];

export const ULTIMA_X = [];

export const EXTRAS = [GolemGauntlet, KingOfTheHill, GoldRush, IceSumo, SapperTag];

export const MINIGAMES = [...UTHER, ...ULTIMA_X, ...EXTRAS];

// What a party rolls from: every port (4.0 and Ultima-X), as Ultima-X rolls
// from all of its events.
export const PORTS = [...UTHER, ...ULTIMA_X];
export const ROLL = PORTS.length >= 8 ? PORTS : MINIGAMES;
