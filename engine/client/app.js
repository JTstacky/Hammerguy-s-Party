// Generic client app: menu → lobby → game. Each game calls startApp() with
// its config (title, HUD class, hotkeys, colours…). The simulation is
// authoritative on the host; this wires network messages to the 3D world,
// the HUD and the input handler.

import './style.css';
import { Net } from './net.js';
import { World, escapeHtml } from './render/world.js';
import { Input } from './input.js';
import { play, unlockAudio, toggleMute, isMuted } from './audio.js';
import { renderShell } from './shell.js';
import { IS_TOUCH, PHONE, CONTROLS, setControls } from './device.js';
import { PLAYER_COLORS } from '../shared/constants.js';

const $ = (id) => document.getElementById(id);

// A fixed camera distance that frames the arena on a landscape screen (the
// view is about 1.6x wider than tall), with a little of the surroundings.
// Games that scroll (follow: true) stay close; a map can set its own zoom.
function fitZoom(map) {
  const f = map.floor;
  if (!f) return null;
  const hw = f.shape === 'disc' ? f.r : f.w / 2;
  const hh = f.shape === 'disc' ? f.r : f.h / 2;
  const z = Math.max(hw, hh * 1.6) + 6;
  return Math.round(Math.min(map.follow ? 26 : 32, Math.max(22, z)));
}
// ?only=<minigame id> makes every game in the party that minigame (practice).
// Read at load: hosting rewrites the URL.
const ONLY = new URLSearchParams(location.search).get('only') || undefined;

// Restore map-scoped metadata before rendering or resolving input actions.
export function restoreSnapshot(snap, map) {
  if (!map?.mg) return snap;
  return { ...snap, mg: map.mg, abilities: (snap.abilities || []).map((a, i) => ({ ...map.abilities[i], ...a })) };
}

export function startApp(cfg) {
  const transport = new URLSearchParams(location.search).get('transport') || import.meta.env?.VITE_TRANSPORT || 'p2p';
  renderShell({ ...cfg, p2p: transport === 'p2p' });
  const store = (k, v) => {
    try {
      if (v === undefined) return localStorage.getItem(`${cfg.id}-${k}`);
      localStorage.setItem(`${cfg.id}-${k}`, v);
    } catch {}
    return null;
  };

  const state = { myId: null, code: null, lobby: null, snap: null, inGame: false, colorPickOpen: false };

  const world = new World($('view'), $('overlay'));
  world.spellColors = cfg.spellColors || {};
  const net = new Net(onMessage, onStatus, { transport, p2p: cfg.p2p });
  const send = (m) => net.send(m);
  const isHost = () => state.lobby && state.lobby.host === state.myId;
  const players = () => state.lobby?.players || [];

  const hud = new cfg.Hud({ send, onSlot: (i) => input.useSlot(i), isHost, getPlayers: players, myId: () => state.myId });
  const input = new Input({
    world,
    send,
    slots: cfg.slots,
    getSnap: () => state.snap,
    getMyId: () => state.myId,
    onChatKey: toggleChat,
    onMenu: () => ($('options').hidden = !$('options').hidden),
  });
  // WC3's default is hotkey, then click the target; a game can default to quick-cast.
  const quick = store('quick');
  input.quickCast = quick != null ? quick !== '0' : cfg.quickCast !== false;
  world.onMessage = (e) => addChat(e.text, { color: e.c, system: !e.c });

  function showBackdrop() {
    world.setMap(cfg.menuMap);
    world.follow = false;
    world.myUnit = null;
    world.zoom = cfg.menuZoom ?? 34;
  }
  showBackdrop();
  window.addEventListener('resize', () => world.resize());

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!state.inGame) {
      const t = now / 1000;
      world.focus.set(Math.cos(t * 0.05) * 4, 0, Math.sin(t * 0.05) * 4);
      cfg.menuFx?.(world, dt);
    }
    input.frame();
    world.render(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ----------------------------------------------------------- menu

  $('name').value = store('name') || '';
  const urlCode = new URLSearchParams(location.search).get('room');
  if (urlCode) $('code').value = urlCode.toUpperCase();

  function myName() {
    const n = $('name').value.trim().slice(0, 16) || `${cfg.namePlaceholder}${Math.floor(Math.random() * 900 + 100)}`;
    store('name', n);
    return n;
  }

  // On phones, go fullscreen and landscape on the first menu button (it needs a tap).
  // iPhones don't allow either; the portrait overlay covers that case.
  // (Touchscreen laptops and desktops only go fullscreen from the button.)
  function phoneScreen(force = false) {
    if (!(PHONE || (force && IS_TOUCH)) || document.fullscreenElement) return;
    document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })
      .then(() => screen.orientation?.lock?.('landscape'))
      .catch(() => {});
  }

  $('create').onclick = () => {
    unlockAudio();
    phoneScreen();
    play('click');
    net.connect({ t: 'create', name: myName() });
  };
  $('join').onclick = () => {
    unlockAudio();
    const code = $('code').value.trim().toUpperCase();
    if (code.length !== 4) return toast('Enter a 4-letter game code.');
    phoneScreen();
    play('click');
    net.connect({ t: 'join', code, name: myName() });
  };
  $('code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('join').click();
  });
  $('name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') ($('code').value.trim() ? $('join') : $('create')).click();
  });

  // ---------------------------------------------------------- lobby

  $('copylink').onclick = async () => {
    const url = `${location.origin}${location.pathname}?room=${state.code}`;
    try {
      await navigator.clipboard.writeText(url);
      $('copylink').textContent = 'Copied!';
    } catch {
      prompt('Share this link:', url);
    }
    setTimeout(() => ($('copylink').textContent = 'Copy invite link'), 1500);
  };
  $('leave').onclick = () => leaveToMenu();
  $('addbot').onclick = () => send({ t: 'addBot' });
  $('start').onclick = () => {
    unlockAudio();
    send({ t: 'start', only: ONLY });
  };
  $('players').addEventListener('click', (e) => {
    const kick = e.target.closest('[data-kick]');
    if (kick) return send({ t: 'kick', id: +kick.dataset.kick });
    if (e.target.closest('.swatch.mine')) {
      state.colorPickOpen = !state.colorPickOpen;
      renderLobby();
    }
    const pick = e.target.closest('[data-color]');
    if (pick) {
      state.colorPickOpen = false;
      send({ t: 'color', slot: +pick.dataset.color });
    }
  });
  $('modeopts').addEventListener('click', (e) => {
    const b = e.target.closest('[data-opt]');
    if (b && isHost()) send({ t: 'settings', ...state.lobby.settings, [b.dataset.opt]: +b.dataset.val });
  });

  function leaveToMenu() {
    net.close();
    try {
      sessionStorage.removeItem(`${cfg.id}-seat`);
    } catch {}
    state.lobby = null;
    state.myId = null;
    state.inGame = false;
    input.active = false;
    hud.reset();
    showBackdrop();
    history.replaceState(null, '', location.pathname);
    showScreen('menu');
  }

  function renderLobby() {
    const L = state.lobby;
    if (!L) return;
    $('roomcode').textContent = L.code;
    $('pcount').textContent = `(${L.players.length}/10)`;
    const used = new Set(L.players.map((p) => p.slot));
    $('players').innerHTML = L.players.map((p) => {
      const c = PLAYER_COLORS[p.slot];
      const mine = p.id === state.myId;
      return `<li style="--c:${c.hex}"><span class="swatch ${mine ? 'mine' : ''}" title="${mine ? 'Change colour' : c.name}"></span>
        <span class="nm">${escapeHtml(p.name)}</span>
        ${p.id === L.host ? '<span class="tagx">host</span>' : ''}${p.bot ? '<span class="tagx">bot</span>' : ''}${mine ? '<span class="tagx">you</span>' : ''}${!p.connected ? '<span class="tagx">offline</span>' : ''}
        ${isHost() && !mine ? `<button class="kick" data-kick="${p.id}" title="Remove">✕</button>` : ''}</li>
        ${mine && state.colorPickOpen ? `<div class="colorpick">${PLAYER_COLORS.map((pc, i) => (used.has(i) ? '' : `<i data-color="${i}" style="background:${pc.hex}" title="${pc.name}"></i>`)).join('')}</div>` : ''}`;
    }).join('');
    $('modeopts').innerHTML = cfg.options.map((o) => `<span>${o.label}:</span>${o.values.map((v) => `<button class="btn small ${L.settings[o.key] === v ? 'sel' : ''}" data-opt="${o.key}" data-val="${v}" ${isHost() ? '' : 'disabled'}>${v}</button>`).join('')}`).join('');
    $('addbot').hidden = !isHost();
    $('start').hidden = !isHost();
    $('waithost').hidden = isHost();
    $('hostnote').hidden = !net.isHost;
    world.colors = Object.fromEntries(L.players.map((p) => [p.id, PLAYER_COLORS[p.slot].hex]));
    world.names = Object.fromEntries(L.players.map((p) => [p.id, p.name]));
  }

  // -------------------------------------------------------- network

  function onMessage(m) {
    switch (m.t) {
      case 'welcome':
        state.myId = m.id;
        state.code = m.code;
        try {
          sessionStorage.setItem(`${cfg.id}-seat`, m.code);
        } catch {}
        world.myId = m.id;
        history.replaceState(null, '', `?room=${m.code}${transport !== 'p2p' && new URLSearchParams(location.search).get('transport') ? `&transport=${transport}` : ''}`);
        break;
      case 'lobby':
        state.lobby = m;
        renderLobby();
        if (!m.inGame && !state.inGame) showScreen('lobby');
        break;
      case 'start':
        state.inGame = true;
        state.snap = null;
        state.map = null;
        hud.reset();
        showScreen('game');
        world.follow = true;
        world.zoom = cfg.gameZoom ?? 30;
        break;
      case 'map':
        state.map = m.map;
        // Each game fixes its own camera distance (WC3 maps did), sized to its arena.
        world.zoom = m.map.zoom ?? fitZoom(m.map) ?? cfg.gameZoom ?? 30;
        world.setMap(m.map);
        world.follow = true;
        break;
      case 'snap':
        if (!state.inGame) return;
        state.snap = restoreSnapshot(m, state.map);
        world.pushSnapshot(state.snap);
        hud.update(state.snap);
        input.active = m.phase === 'play' || m.phase === 'shop';
        break;
      case 'end':
        state.inGame = false;
        state.snap = null;
        input.active = false;
        input.cancelTarget();
        hud.reset();
        showBackdrop();
        showScreen('lobby');
        break;
      case 'chat':
        addChat(m.system ? m.text : `${m.name}: ${m.text}`, { color: m.system ? null : m.c, system: m.system, name: m.name, text: m.text });
        break;
      case 'error':
        toast(m.text, m.text.length > 80 ? 9000 : 3500);
        play('error');
        if (m.fatal && !state.inGame) {
          const code = $('code').value;
          leaveToMenu();
          $('code').value = code; // keep the code so "Join" is one tap away
        }
        break;
      case 'kicked':
        toast('You were removed from the game.');
        leaveToMenu();
        break;
      case 'hostLeft':
        toast('The host has left, so the game has ended.');
        leaveToMenu();
        break;
    }
  }

  function onStatus(s) {
    if (s === 'connecting') toast('Connecting to the host…', 20000);
    else if (s === 'reconnecting' || (s === 'closed' && state.myId)) toast('Connection lost — reconnecting…', 20000);
    else if (s === 'open' && $('toast').dataset.status) $('toast').hidden = true;
    $('toast').dataset.status = s === 'connecting' || s === 'reconnecting' || s === 'closed' ? '1' : '';
  }

  // Warn a host before closing the tab that runs everyone's game.
  window.addEventListener('beforeunload', (e) => {
    if (net.isHost && state.lobby && state.lobby.players.some((p) => !p.bot && p.id !== state.myId)) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // ------------------------------------------------------ ui helpers

  function showScreen(name) {
    $('menu').hidden = name !== 'menu';
    $('lobby').hidden = name !== 'lobby';
    $('hud').hidden = name !== 'game';
    $('overlay').hidden = name !== 'game';
    document.body.classList.toggle('inlobby', name !== 'game');
    $('chat').hidden = name === 'menu';
  }

  function addChat(text, { color, system, name, text: body } = {}) {
    const el = document.createElement('div');
    if (system) el.className = 'sys';
    if (name && body != null) {
      el.innerHTML = `<b style="color:${color}">${escapeHtml(name)}:</b> ${escapeHtml(body)}`;
    } else {
      el.textContent = text;
      if (color) el.style.color = color;
    }
    const log = $('chatlog');
    log.appendChild(el);
    while (log.children.length > 12) log.firstChild.remove();
    setTimeout(() => el.classList.add('fade'), 12000);
  }

  function toggleChat() {
    const inp = $('chatinput');
    if (inp.hidden) {
      if ($('menu').hidden === false) return;
      inp.hidden = false;
      inp.focus();
      $('chatlog').querySelectorAll('.fade').forEach((e) => e.classList.remove('fade'));
    } else {
      const text = inp.value.trim();
      if (text) send({ t: 'chat', text });
      inp.value = '';
      inp.hidden = true;
      inp.blur();
    }
  }

  let toastTimer;
  function toast(text, ms = 3500) {
    const t = $('toast');
    t.textContent = text;
    t.hidden = false;
    delete t.dataset.status;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), ms);
  }

  // Fullscreen toggle for phones and tablets (not iPhone Safari, which has no API for it).
  const fullBtn = $('fullbtn');
  if (IS_TOUCH && document.fullscreenEnabled) {
    fullBtn.hidden = false;
    fullBtn.onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      else phoneScreen(true);
    };
    document.addEventListener('fullscreenchange', () => {
      fullBtn.classList.toggle('on', !!document.fullscreenElement);
      fullBtn.title = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
      setTimeout(() => world.resize(), 100);
    });
  }

  // Options modal.
  $('hud-menu').onclick = () => ($('options').hidden = false);
  $('opt-close').onclick = () => ($('options').hidden = true);
  if ($('opt-quick')) {
    $('opt-quick').checked = input.quickCast;
    $('opt-quick').onchange = (e) => {
      input.quickCast = e.target.checked;
      store('quick', e.target.checked ? '1' : '0');
    };
  }
  $('opt-mute').checked = isMuted();
  $('opt-mute').onchange = () => toggleMute();
  $('menu-options').onclick = () => ($('options').hidden = false);

  // Controls: touch (phone layout) or mouse and keyboard. Switching rebuilds
  // the page, so it reloads at once unless that would end a game you host
  // for other people (guests who reload rejoin their seat automatically).
  $('opt-controls').value = CONTROLS;
  $('opt-controls').onchange = (e) => {
    const note = $('opt-controls-note');
    if (!setControls(e.target.value)) {
      note.hidden = true;
      return;
    }
    const hostingOthers = net.isHost && state.lobby?.players.some((p) => !p.bot && p.id !== state.myId);
    if (hostingOthers) {
      note.textContent = 'Saved. It takes effect when you reload the page; you are hosting, so wait until the game is over.';
      note.hidden = false;
    } else location.reload();
  };

  // Handy for debugging from the console.
  window.game = { send, state, world, net };

  showScreen('menu');
  // A refresh mid-game (same tab) rejoins automatically; the saved token
  // gets the old seat back. Invite links just pre-fill the code.
  let seat = null;
  try {
    seat = sessionStorage.getItem(`${cfg.id}-seat`);
  } catch {}
  if (urlCode && seat === urlCode.toUpperCase() && $('name').value) $('join').click();
  else if (urlCode) $('name').focus();
}
