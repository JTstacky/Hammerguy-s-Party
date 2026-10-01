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
import { WayOfTheBow } from './up/06-bow.js';
import { TaurenTragedy } from './up/10-tauren.js';
import { Masquerade } from './up/25-masquerade.js';
import { Abombinations } from './up/28-abom.js';
import { NaturesCircle } from './up/30-nature.js';
import { DestructionsDance } from './up/35-dance.js';
import { BattleForTheBottle } from './up/50-bottle.js';
import { FelOrcFiasco } from './up/51-fel.js';
import { SeaCombat } from './up/52-sea.js';
import { Roadkill } from './up/07-roadkill.js';
import { StopAndGo } from './up/18-stopgo.js';
import { PushTheOgre } from './up/19-pushogre.js';
import { HorseRace } from './up/24-horserace.js';
import { QuillboarMile } from './up/33-quillboar.js';
import { FlightOfTheFootmen } from './up/45-footmen.js';

export const UTHER = [
  MortarMayhem, // #1 Peon Pandemonium
  WayOfTheBow, // #6 Way of the Bow
  Roadkill, // #7 Roadkill Challenge
  CovertKitty, // #8 Covert Kitty
  TaurenTragedy, // #10 The Tauren Tragedy
  KodoStampede, // #17 Stampede
  StopAndGo, // #18 Stop and Go
  PushTheOgre, // #19 Push the Ogre
  HorseRace, // #24 Horse Race
  Masquerade, // #25 The Masquerade
  BlinkyBear, // #27 Blinky the Bear
  Abombinations, // #28 The Abombinations
  NaturesCircle, // #30 Nature's Circle
  MinotaurMaze, // #32 Minotaur Maze
  QuillboarMile, // #33 Quillboar Mile
  TheUnseen, // #34 The Unseen
  DestructionsDance, // #35 Destruction's Dance
  TroubledWaters, // #38 Troubled Waters
  FlightOfTheFootmen, // #45 Flight of the Footmen
  WispWheel, // #47 Wheel of Fire
  DeathTrap, // #48 The Death Trap
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
