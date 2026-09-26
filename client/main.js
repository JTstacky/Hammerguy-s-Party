// Hammerguy's Party client entry.
import { startApp } from '../engine/client/app.js';
import { PartyHud } from './hud.js';
import { meta } from '../meta.js';
import './views/index.js';

startApp({
  ...meta,
  tagline: 'A party of chaotic minigames for up to 10 friends. Inspired by the classic Warcraft III map Uther Party.',
  blurb: 'Eight minigames are drawn at random. Every place scores, as in the original: the last one standing, or the first one home, gets 8 points. Most points after the last game wins.',
  namePlaceholder: 'Hammerguy',
  pills: ['🐂 <b>Stampedes, mortars, races…</b> — 8 minigames and counting', '🔨 <b>Warcraft III feel</b> — movement and scoring measured in the real game'],
  keysHelp: [
    '<b>Right-click</b> move (hold to keep moving)',
    '<b>Q W E R</b> minigame abilities (targeted ones then need a left-click)',
    '<b>Right-click</b> a creature or rival to attack it (in games with attacks)',
    '<b>S</b> stop',
    '<b>Space</b> centre camera · <b>Y</b> lock camera',
    '<b>Arrows</b> pan',
    '<b>Enter</b> chat',
  ],
  touchHelp: [
    '<b>Joystick</b> (bottom left) move · let go to stop',
    '<b>Ability buttons</b> (bottom right) · targeted ones: tap the button, then tap the target',
    '<b>Tap</b> a creature or rival to attack it (in games with attacks)',
  ],
  quickCast: false,
  Hud: PartyHud,
  slots: {
    slotForKey: (e) => ['KeyQ', 'KeyW', 'KeyE', 'KeyR'].indexOf(e.code),
    action(i, snap) {
      const a = snap.abilities ? snap.abilities[i] : i === 0 ? snap.ability : null;
      if (!a || snap.phase !== 'play') return null;
      if (a.cd > 0 || a.empty) return { error: true };
      // Targeted spells (Purge) are cast WC3 style: hotkey, then click a unit.
      if (a.target) return { target: `s${i}`, name: a.name, range: a.range };
      return { send: { t: 'cmd', c: 'cast', slot: i } };
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
