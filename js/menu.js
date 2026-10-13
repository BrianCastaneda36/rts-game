// Main menu, daily rewards popup, upgrade shop, multiplayer lobby.
import { profile, UPGRADES } from './profile.js';
import { Net } from './net.js';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Menu {
  constructor(startGame) {
    this.startGame = startGame; this.net = null;
    const d = profile.data;
    $('playerName').value = d.name;
    $('playerName').onchange = e => { d.name = e.target.value.slice(0, 16) || 'Commander'; profile.save(); };
    $('btnSP').onclick = () => this.single();
    $('btnHost').onclick = () => this.host();
    $('btnJoin').onclick = () => this.join();
    $('joinCode').oninput = e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
    $('btnShop').onclick = () => this.shop();
    $('btnDaily').onclick = () => this.daily();
    $('modalClose').onclick = () => this.closeModal();
    let acc = 0, why = '', tmr = null;
    profile.listeners.push((n, reason) => { acc += n; why = reason; clearTimeout(tmr); tmr = setTimeout(() => { toast(`+${acc} ★ ${why}`); acc = 0; }, 350); this.refresh(); });
    $('menu').classList.remove('hidden'); this.refresh();
    if (profile.daily().available) setTimeout(() => this.daily(), 400);
  }
  refresh() {
    const d = profile.data, dl = profile.daily();
    $('menuPoints').textContent = d.points; $('menuStreak').textContent = d.streak + (dl.available ? '' : ' ✓');
    $('menuRecord').textContent = `W ${d.wins} / L ${d.losses}`;
    $('dailyDot').className = dl.available ? 'dot' : '';
  }
  msg(t, err) { const m = $('menuMsg'); m.textContent = t; m.style.color = err ? '#f77' : '#9fd'; }
  hideMenu() { $('menu').classList.add('hidden'); this.closeModal(); }
  async single() {
    const n = +$('aiCount').value, slots = [{ team: 0, human: true, name: profile.data.name, ups: profile.data.upgrades }];
    for (let i = 1; i <= n; i++) slots.push({ team: i, human: false, name: 'AI ' + i });
    this.hideMenu(); await this.startGame({ mode: 'sp', slots, me: 0, disasters: $('disastersOn').checked });
  }
  // ---------- multiplayer ----------
  async host() {
    this.msg('Contacting PeerJS signalling server…');
    const net = this.net = new Net();
    try { await net.host(); } catch (e) { this.msg('Hosting failed: ' + (e.message || e.type || e), true); return; }
    this.msg('');
    const render = () => {
      const players = [`<li>👑 ${esc(profile.data.name)} (you)</li>`, ...net.clients.map(c => `<li>🎮 ${esc(c.name)}</li>`)];
      $('lobbyList').innerHTML = players.join('');
    };
    this.modal(`<h2>Multiplayer lobby</h2><p>Share this room code:</p><div class="code">${net.code}</div>
      <p class="small">Players join from the main menu with this code. Up to 4 players; empty slots are filled by AI.</p>
      <ul id="lobbyList" class="lobby"></ul>
      <label>Total players (with AI) <select id="lobbyTotal"><option>2</option><option>3</option><option selected>4</option></select></label>
      <button class="big" id="lobbyStart">Start match</button>`, () => { if (!net.starting) { net.peer.destroy(); this.net = null; } });
    render(); net.on.lobby = render;
    $('lobbyStart').onclick = async () => {
      const total = Math.max(+$('lobbyTotal').value, net.clients.length + 1);
      const slots = net.buildSlots(total, profile.data.upgrades); slots[0].name = profile.data.name;
      net.starting = true; this.hideMenu();
      const game = await this.startGame({ mode: 'host', net, slots, me: 0, disasters: $('disastersOn').checked });
      net.startClients(game);
      net.on.drop = cl => { game.takeOverByAI(cl.team); toast(`${cl.name} left, AI takes over`); };
    };
  }
  async join() {
    const code = $('joinCode').value.trim(); if (code.length < 4) { this.msg('Enter the 5-character room code', true); return; }
    this.msg('Connecting to room ' + code + '…');
    const net = this.net = new Net();
    net.on.error = e => this.msg(e.message, true);
    net.on.lobby = names => { this.modal(`<h2>Joined room ${esc(code)}</h2><p>Waiting for the host to start…</p><ul class="lobby">${names.map(n => `<li>🎮 ${esc(n)}</li>`).join('')}</ul>`); };
    net.on.start = async m => { this.hideMenu(); const g = await this.startGame({ mode: 'client', net, me: m.me, slots: m.slots, oreInit: m.ore }); net.game = g; };
    net.on.hostLost = () => { toast('Connection to host lost'); const mm = $('msg'); if (!net.game || !net.game.over) { mm.style.display = 'block'; mm.style.color = '#fc6'; mm.innerHTML = 'HOST DISCONNECTED<br><button onclick="location.reload()">Main menu</button>'; } };
    try { await net.join(code, { name: profile.data.name, ups: profile.data.upgrades }); this.msg('Connected! Waiting for host…'); }
    catch (e) { this.msg('Join failed: ' + (e.message || e.type || e), true); }
  }
  // ---------- modals ----------
  modal(html, onClose) { $('modalBody').innerHTML = html; $('modal').classList.remove('hidden'); this.onClose = onClose; }
  closeModal() { $('modal').classList.add('hidden'); if (this.onClose) { const f = this.onClose; this.onClose = null; f(); } }
  daily() {
    const d = profile.daily();
    const days = d.rewards.map((r, i) => {
      const n = i + 1, done = d.available ? n < d.day : n <= d.day, cur = d.available && n === d.day;
      return `<div class="day ${done ? 'done' : ''} ${cur ? 'cur' : ''}"><small>Day ${n}</small><b>★${r}</b>${done ? '✓' : ''}</div>`;
    }).join('');
    this.modal(`<h2>🎁 Daily login reward</h2>
      <p>${d.available ? (d.broken ? 'Your streak was reset - welcome back!' : `Day ${d.day} of your streak!`) : 'Already claimed today. Come back tomorrow!'}</p>
      <div class="days">${days}</div>
      <p class="small">Streak: <b>${d.streak}</b> day${d.streak === 1 ? '' : 's'} · rewards escalate for 7 days, then repeat with +100 bonus per week.</p>
      ${d.available ? `<button class="big glow" id="claim">Claim ★${d.reward}</button>` : ''}`);
    if (d.available) $('claim').onclick = () => {
      const r = profile.claimDaily(); if (!r) return;
      $('claim').outerHTML = `<div class="claimed">+${r.reward} ★</div>`; burst(); this.refresh(); setTimeout(() => this.daily(), 1400);
    };
  }
  shop() {
    const d = profile.data;
    const cards = Object.entries(UPGRADES).map(([k, u]) => {
      const l = d.upgrades[k], maxed = l >= u.max, cost = maxed ? 0 : u.cost[l];
      const segs = Array.from({ length: u.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
      return `<div class="card" data-k="${k}"><div class="ic">${u.icon}</div><div class="info"><b>${u.name}</b> <small>Lv ${l}/${u.max}</small>
        <div class="segs">${segs}</div><div class="small">Now: ${u.desc(l)}</div>${maxed ? '' : `<div class="small next">Next: ${u.desc(l + 1)}</div>`}</div>
        <button class="buy" ${maxed || d.points < cost ? 'disabled' : ''}>${maxed ? 'MAX' : '★' + cost}</button></div>`;
    }).join('');
    this.modal(`<h2>⚙ Evolution & upgrades</h2><p>Points: <b class="gold">★${d.points}</b> · upgrades are permanent and apply at the start of every match.</p><div class="shop">${cards}</div>`);
    for (const el of document.querySelectorAll('.shop .card')) el.querySelector('.buy').onclick = () => {
      if (profile.buy(el.dataset.k)) { this.refresh(); this.shop(); const c = document.querySelector(`.shop .card[data-k="${el.dataset.k}"]`); c.classList.add('pop'); burst(); }
    };
  }
}
export function toast(t) { const el = $('toast'); el.textContent = t; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
function burst() {
  const b = document.createElement('div'); b.className = 'burst';
  for (let i = 0; i < 24; i++) { const s = document.createElement('span'); s.textContent = '★'; const a = i / 24 * Math.PI * 2, r = 80 + Math.random() * 80; s.style.setProperty('--x', Math.cos(a) * r + 'px'); s.style.setProperty('--y', Math.sin(a) * r + 'px'); b.appendChild(s); }
  document.body.appendChild(b); setTimeout(() => b.remove(), 1200);
}
