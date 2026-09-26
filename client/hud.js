// Hammerguy's Party HUD: game counter, points multiboard, the single ability
// button, and the intro / results cards between minigames.

import { HudBase, fmtTime, escapeHtml } from '../engine/client/ui/hud-base.js';

export class PartyHud extends HudBase {
  update(s) {
    this.snap = s;
    const me = this.myId();
    this.set('topbar', `
      <div class="tb-left">${s.tiebreak ? '<b>Tie-breaker</b>' : `Game <b>${s.index}</b> / ${s.total}`}</div>
      <div class="tb-mid"><span class="phase">${escapeHtml(s.mg.name)}</span> <span class="clock" title="${s.elapsed ? 'No time limit: time played' : 'Time left'}">${s.phase === 'play' ? (s.elapsed ? '⏱ ' : '') + fmtTime(s.timer) : ''}</span></div>
      <div class="tb-right">${s.hud?.fuse != null ? `<span class="fuse">💣 ${s.hud.fuse.toFixed(1)}s</span>` : ''}<span class="gold">⭐ ${s.points[me] ?? 0} pts</span></div>`);
    const rows = Object.entries(s.points).sort((a, b) => b[1] - a[1]);
    const showScore = s.scores && s.phase === 'play';
    this.set('multiboard', `<div class="mb-title">Hammerguy's Party</div><table>
      <tr><th></th><th>Player</th>${showScore ? '<th>Now</th>' : ''}<th>Points</th></tr>
      ${rows.map(([id, pts]) => {
        const r = this.playerRow(id);
        return `<tr class="${s.alive[id] === false && s.phase === 'play' ? 'dead' : ''} ${+id === me ? 'me' : ''}"><td><i class="sw" style="background:${r.color}"></i></td><td style="color:${r.color}">${r.name}${r.connected === false ? ' ⚠' : ''}</td>${showScore ? `<td>${s.scores[id] ?? 0}</td>` : ''}<td><b>${pts}</b></td></tr>`;
      }).join('')}</table>`);

    const cells = [];
    if (s.ability) {
      const a = s.ability;
      const icon = a.icon || '🔨';
      const pips = a.left != null ? (a.left ? '●' : '○') : '';
      cells.push(this.cmdButton({ slot: 0, icon, key: 'Q', cd: a.empty ? 1 : a.cd, max: a.empty ? 1 : a.max, pips, tip: `text:${encodeURIComponent(`<div class="tt-title">${icon} ${a.name}</div><div class="tt-desc">${escapeHtml(a.desc || '')}</div>`)}` }));
    }
    for (let i = cells.length; i < 8; i++) cells.push('<div class="cmd empty"></div>');
    this.set('cmdcard', cells.join(''));
    const r = this.playerRow(me);
    this.set('unitinfo', `<div class="portrait" style="--c:${r.color}">🔨</div>
      <div class="uinfo"><div class="uname2" style="color:${r.color}">${r.name}</div><div class="utitle">Hammerguy</div>
      <div class="ctl">${escapeHtml(s.mg.controls)}</div></div>`);

    let center = '';
    if (s.phase === 'intro') {
      center = `<div class="card intro"><div class="kicker">${s.tiebreak ? 'Tie-breaker: the winner takes the party' : `Minigame ${s.index} of ${s.total}`}</div><h1>${escapeHtml(s.mg.name)}</h1>
        <p>${escapeHtml(s.mg.desc)}</p><p class="ctl">${escapeHtml(s.mg.controls)}</p><div class="count">${Math.ceil(s.timer)}</div></div>`;
    } else if (s.phase === 'results' && s.results) {
      center = `<div class="card results"><h1>${escapeHtml(s.mg.name)} — Results</h1><table>
        ${s.results.map((res) => { const p = this.playerRow(res.id); return `<tr><td class="place">#${res.place}</td><td style="color:${p.color}">${p.name}</td><td>${res.pts ? `+${res.pts} pts` : ''}</td><td><b>${s.points[res.id]}</b></td></tr>`; }).join('')}
        </table><div class="sub">${s.index >= s.total ? 'Final results next…' : `Next minigame in ${Math.ceil(s.timer)}…`}</div></div>`;
    } else if (s.phase === 'over' && s.standings) {
      center = this.overCard(s.standings, 'pts');
    }
    this.setCenter(center);
  }
}
