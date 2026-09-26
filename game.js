// Hammerguy's Party — game definition used by the room host (Node server or
// the hosting player's browser).
import { HammerguysParty } from './server/party.js';
import { meta } from './meta.js';

export const gameDef = {
  ...meta,
  Game: HammerguysParty,
  options: Object.fromEntries(meta.options.map((o) => [o.key, o.values])),
};
