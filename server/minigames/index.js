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
import { RatMaze } from './up/02-ratmaze.js';
import { HotMortar } from './up/04-hotmortar.js';
import { PolymorphRing } from './up/09-polyring.js';
import { BombBaldwin } from './up/11-baldwin.js';
import { HungryKodos } from './up/13-hungrykodos.js';
import { RaiderRelay } from './up/14-raider.js';
import { ObeyArchimonde } from './up/22-obey.js';
import { WhackAFiend } from './up/23-whack.js';
import { CrabIsland } from './up/26-crab.js';
import { SkullOfGuldan } from './up/31-skull.js';
import { PorkThePiggy } from './up/36-pork.js';
import { TidesOfDarkness } from './up/44-tides.js';
import { SpellBreakerBlood } from './up/42-spellbreaker.js';
import { DuneWorm } from './up/43-dune.js';
import { TowerDefense } from './up/46-tower.js';
import { ClandestineKitty } from './up/49-kitty.js';
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
import { KaboomRoom } from './up/03-kaboom.js';
import { CleanupCrew } from './up/05-cleanup.js';
import { TreantValley } from './up/15-treant.js';
import { SkeletonSonata } from './up/16-skeleton.js';
import { SpikePit } from './up/20-spikes.js';
import { SalamanderSizzle } from './up/21-salamander.js';
import { DarkForest } from './up/12-darkforest.js';
import { SleepyTime } from './up/29-sleepy.js';
import { ThePlague } from './up/37-plague.js';
import { SheepShearers } from './up/39-sheep.js';
import { DoggyHell } from './up/40-doggy.js';
import { AncientPunisher } from './up/41-ancient.js';
import { RampageWithWolves } from './ux/056-wolves.js';
import { TowerAttack } from './ux/057-tower.js';
import { StompOfDoom } from './ux/058-stomp.js';
import { MosquitoSwarm } from './ux/060-mosquito.js';
import { GhostlyGambit } from './ux/061-ghostly.js';
import { SoulExchange } from './ux/062-soul.js';
import { UndergroundRun } from './ux/168-underground.js';
import { Domination } from './ux/031-domination.js';
import { SwordWeaver } from './ux/051-sword-weaver.js';
import { MuleRace } from './ux/052-mule-race.js';
import { TornadoNaga } from './ux/053-tornado-naga.js';
import { GrimReapage } from './ux/054-grim-reapage.js';
import { TypingTerror } from './ux/055-typing-terror.js';

export const UTHER = [
  MortarMayhem, // #1 Peon Pandemonium
  RatMaze, // #2 The Rat Maze
  KaboomRoom, // #3 The Kaboom Room
  HotMortar, // #4 Hot Mortar
  CleanupCrew, // #5 The Clean-up Crew
  WayOfTheBow, // #6 Way of the Bow
  Roadkill, // #7 Roadkill Challenge
  CovertKitty, // #8 Covert Kitty
  PolymorphRing, // #9 The Polymorph Ring
  TaurenTragedy, // #10 The Tauren Tragedy
  BombBaldwin, // #11 Bomb Baldwin
  DarkForest, // #12 Dark Forest
  HungryKodos, // #13 Hungry Hungry Kodos
  RaiderRelay, // #14 Raider Relay
  TreantValley, // #15 Treant Valley
  SkeletonSonata, // #16 The Skeleton Sonata
  KodoStampede, // #17 Stampede
  StopAndGo, // #18 Stop and Go
  PushTheOgre, // #19 Push the Ogre
  SpikePit, // #20 The Spike Pit
  SalamanderSizzle, // #21 The Salamander Sizzle
  ObeyArchimonde, // #22 Obey Archimonde
  WhackAFiend, // #23 Whack-a-Fiend
  HorseRace, // #24 Horse Race
  Masquerade, // #25 The Masquerade
  CrabIsland, // #26 Crab Island
  BlinkyBear, // #27 Blinky the Bear
  Abombinations, // #28 The Abombinations
  SleepyTime, // #29 Sleepy Time
  NaturesCircle, // #30 Nature's Circle
  SkullOfGuldan, // #31 The Skull of Gul'dan
  MinotaurMaze, // #32 Minotaur Maze
  QuillboarMile, // #33 Quillboar Mile
  TheUnseen, // #34 The Unseen
  DestructionsDance, // #35 Destruction's Dance
  PorkThePiggy, // #36 Pork the Piggy
  ThePlague, // #37 The Plague
  TroubledWaters, // #38 Troubled Waters
  SheepShearers, // #39 The Sheep Shearers
  DoggyHell, // #40 Doggy Hell
  AncientPunisher, // #41 Ancient Punisher
  SpellBreakerBlood, // #42 Spell Breaker Blood
  DuneWorm, // #43 Dune Worm Distress
  TidesOfDarkness, // #44 Tides of Darkness
  FlightOfTheFootmen, // #45 Flight of the Footmen
  TowerDefense, // #46 Tower Defense
  WispWheel, // #47 Wheel of Fire
  DeathTrap, // #48 The Death Trap
  ClandestineKitty, // #49 Clandestine Kitty
  BattleForTheBottle, // #50 Battle for the Bottle (Free Play in the original)
  FelOrcFiasco, // #51 Fel Orc Fiasco (Free Play in the original)
  SeaCombat, // #52 Sea Combat (Free Play in the original)
];

export const ULTIMA_X = [
  Domination, // #31 Domination
  SwordWeaver, // #51 The Sword Weaver
  MuleRace, // #52 Mule Race
  TornadoNaga, // #53 Tornado Naga Madness
  GrimReapage, // #54 The Grim Reapage
  TypingTerror, // #55 Typing Terror
  RampageWithWolves, // #56 Rampage With Wolves
  TowerAttack, // #57 Tower Attack
  StompOfDoom, // #58 Stomp of Doom
  MosquitoSwarm, // #60 Mosquito Swarm
  GhostlyGambit, // #61 Ghostly Gambit
  SoulExchange, // #62 The Soul Exchange
  UndergroundRun, // #168 Underground Run (hidden in the original)
];

export const EXTRAS = [GolemGauntlet, KingOfTheHill, GoldRush, IceSumo, SapperTag];

export const MINIGAMES = [...UTHER, ...ULTIMA_X, ...EXTRAS];

// What a party rolls from: every port (4.0 and Ultima-X), as Ultima-X rolls
// from all of its events.
export const PORTS = [...UTHER, ...ULTIMA_X];
export const ROLL = PORTS.length >= 8 ? PORTS : MINIGAMES;
