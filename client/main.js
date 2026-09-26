// Hammerguy's Party client entry.
import { startApp } from '../engine/client/app.js';
import { PartyHud } from './hud.js';
import { meta } from '../meta.js';

startApp({
  ...meta,
  tagline: 'A party of chaotic minigames for up to 10 friends. Inspired by the classic Warcraft III map Uther Party.',
  blurb: 'Minigames are drawn at random. Place well to earn points; the most points after the last game wins.',
  namePlaceholder: 'Hammerguy',
  pills: ['🐂 <b>Stampedes, mortars, races…</b> — 8 minigames and counting', '🔨 <b>Hammer shove</b> — knock your friends out of the way'],
  keysHelp: [
    '<b>Right-click</b> move (hold to keep moving)',
    '<b>Q</b> minigame ability (when there is one)',
    '<b>S</b> stop',
    '<b>Space</b> centre camera · <b>Y</b> lock camera',
    '<b>Wheel</b> zoom · <b>Arrows</b> pan',
    '<b>Enter</b> chat',
  ],
  quickCast: false,
  Hud: PartyHud,
  slots: {
    slotForKey: (e) => (e.code === 'KeyQ' ? 0 : -1),
    action(i, snap) {
      if (i !== 0 || !snap.ability || snap.phase !== 'play') return null;
      if (snap.ability.cd > 0) return { error: true };
      return { send: { t: 'cmd', c: 'cast' } };
    },
  },
  menuMap: { theme: 'grass', floor: { shape: 'disc', r: 14 }, bounds: 40, props: [] },
  menuZoom: 30,
  gameZoom: 28,
  p2p: {
    prefix: 'tenggames-hammerguys-party',
    createWorker: () => new Worker(new URL('./host-worker.js', import.meta.url), { type: 'module' }),
  },
  otherGame: { title: 'Arcane Arena', href: '/arcane-arena/' },
  homeHref: '/',
});
