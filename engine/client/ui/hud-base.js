// Shared HUD plumbing, laid out like Warcraft III's: a multiboard in the
// top-right, messages in the lower-left, and a bottom console with the unit
// info panel and the command card. Each game subclasses HudBase and fills
// the panels from its own snapshots.

import { PLAYER_COLORS } from '../../shared/constants.js';
import { escapeHtml } from '../render/world.js';
import { IS_TOUCH } from '../device.js';

export const $ = (id) => document.getElementById(id);
export { escapeHtml };

export function fmtTime(t) {
  t = Math.max(0, Math.ceil(t));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

// Rewrites mouse-and-keyboard control hints for touch screens.
export function controlsText(t) {
  if (!IS_TOUCH || !t) return t;
  return t
    .replace(/Right-click to move/g, 'Use the joystick to move')
    .replace(/Q, then click (a|an|the) /g, 'Tap the ability, then tap $1 ')
    .replace(/Q: /g, 'Ability button: ');
}

export function hpColor(frac) {
  return frac > 0.6 ? '#2fdc2f' : frac > 0.3 ? '#e8d020' : '#e82020';
}

export class HudBase {
  constructor({ send, onSlot, isHost, getPlayers, myId }) {
    this.send = send;
    this.onSlot = onSlot;
    this.isHost = isHost;
    this.getPlayers = getPlayers;
    this.myId = myId;
    this.cache = {};
    this.tooltip = $('tooltip');
    let touchedAt = 0;
    $('cmdcard').addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      const b = e.target.closest('[data-slot]');
      if (!b) return;
      e.preventDefault();
      touchedAt = performance.now();
      this.onSlot(+b.dataset.slot);
    });
    $('cmdcard').addEventListener('click', (e) => {
      if (performance.now() - touchedAt < 800) return;
      const b = e.target.closest('[data-slot]');
      if (b) this.onSlot(+b.dataset.slot);
    });
    $('centercard').addEventListener('click', (e) => {
      if (e.target.closest('#to-lobby')) this.send({ t: 'toLobby' });
    });
    document.addEventListener('mouseover', (e) => {
      if (IS_TOUCH) return;
      const el = e.target.closest?.('[data-tip]');
      if (!el) return this.hideTip();
      const [kind, id, lvl] = el.dataset.tip.split(':');
      const html = kind === 'text' ? decodeURIComponent(id) : this.tooltipFor(kind, id, +lvl);
      if (html) this.showTip(html, el);
      this.tipKey = el.dataset.tip;
    });
  }

  // Games override this for their own tooltip kinds (spells, items…).
  tooltipFor() {
    return '';
  }

  showTip(html, el) {
    const t = this.tooltip;
    t.innerHTML = html;
    t.hidden = false;
    const r = el.getBoundingClientRect();
    const tr = t.getBoundingClientRect();
    const x = Math.min(window.innerWidth - tr.width - 8, Math.max(8, r.left + r.width / 2 - tr.width / 2));
    let y = r.top - tr.height - 8;
    if (y < 8) y = r.bottom + 8;
    t.style.left = `${x}px`;
    t.style.top = `${y}px`;
  }

  hideTip() {
    this.tooltip.hidden = true;
    this.tipKey = null;
  }

  reset() {
    this.cache = {};
    this.commandKey = null;
    this.commandCells = null;
    for (const id of ['topbar', 'multiboard', 'cmdcard', 'unitinfo', 'centercard', 'shop']) $(id).innerHTML = '';
    $('shop').hidden = true;
    $('centercard').hidden = true;
    this.hideTip();
  }

  set(id, html) {
    if (this.cache[id] === html) return;
    this.cache[id] = html;
    $(id).innerHTML = html;
    // The hovered button was just replaced: keep the tooltip on its successor
    // if the same button is still there, otherwise (a new minigame) hide it.
    if (this.tipKey) {
      const el = [...document.querySelectorAll('[data-tip]')].find((x) => x.dataset.tip === this.tipKey);
      if (!el) this.hideTip();
      else if (!el.matches(':hover')) this.hideTip();
    }
  }

  playerRow(id) {
    const p = this.getPlayers().find((q) => q.id === +id);
    return { name: escapeHtml(p?.name ?? '?'), color: p ? PLAYER_COLORS[p.slot].hex : '#ccc', bot: p?.bot, connected: p?.connected };
  }

  // Sets the centre card (intro / results / game over). Empty hides it.
  setCenter(html) {
    const cc = $('centercard');
    cc.hidden = !html;
    if (this.cache.center !== html) {
      this.cache.center = html;
      cc.innerHTML = html;
    }
  }

  // Standard game-over card. `extra(st)` adds a column per player.
  overCard(standings, unit, extra = () => '') {
    const w = this.playerRow(standings[0].id);
    return `<div class="card over"><div class="kicker">Victory</div><h1 style="color:${w.color}">${w.name} wins!</h1><table>
      ${standings.map((st, i) => { const p = this.playerRow(st.id); return `<tr><td class="place">#${i + 1}</td><td style="color:${p.color}">${p.name}</td><td><b>${st.score}</b> ${unit}</td>${extra(st)}</tr>`; }).join('')}
      </table>${this.isHost() ? '<button class="btn primary" id="to-lobby">Back to lobby</button>' : '<div class="sub">Waiting for the host…</div>'}</div>`;
  }

  // Keep the card's nodes while cooldowns and charges change.
  setCommands(abilities) {
    const key = JSON.stringify(abilities.map((a) => [a.icon, a.key, a.name, a.desc]));
    if (this.commandKey !== key) {
      this.commandKey = key;
      const cells = abilities.map((a, slot) => {
        const icon = a.icon || '🔨';
        const tip = `text:${encodeURIComponent(`<div class="tt-title">${icon} ${a.name}</div><div class="tt-desc">${escapeHtml(a.desc || '')}</div>`)}`;
        return `<div class="cmd" data-slot="${slot}" data-tip="${tip}">
          <span class="icon">${icon}</span><span class="hk">${a.key || 'QWER'[slot]}</span><span class="pips" hidden></span>
          <span class="cdsweep" hidden></span><span class="cdnum" hidden></span></div>`;
      });
      while (cells.length < 8) cells.push('<div class="cmd empty"></div>');
      this.set('cmdcard', cells.join(''));
      this.commandCells = [...$('cmdcard').querySelectorAll('[data-slot]')].map((el) => ({
        el, pips: el.querySelector('.pips'), sweep: el.querySelector('.cdsweep'), num: el.querySelector('.cdnum'),
      }));
    }
    abilities.forEach((a, i) => {
      const c = this.commandCells[i];
      const cd = a.empty ? 1 : a.cd || 0;
      const pct = cd > 0 ? Math.min(100, cd / (a.empty ? 1 : a.max || 1) * 100) : 0;
      const pips = a.left != null ? (a.left > 3 ? `×${a.left}` : '●'.repeat(a.left) || '○') : '';
      setText(c.pips, pips);
      setHidden(c.pips, !pips);
      setText(c.num, cd > 0 ? String(Math.ceil(cd)) : '');
      setHidden(c.sweep, cd <= 0);
      setHidden(c.num, cd <= 0);
      if (c.pct !== pct) { c.sweep.style.setProperty('--p', `${pct}%`); c.pct = pct; }
      for (const [name, value] of [['cooling', cd > 0], ['disabled', !!a.empty], ['active', !!a.active]]) {
        if (c[name] !== value) { c.el.classList.toggle(name, value); c[name] = value; }
      }
    });
  }
}

export function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

export function setHidden(el, hidden) {
  if (el.hidden !== hidden) el.hidden = hidden;
}
