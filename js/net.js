// Real-time multiplayer over WebRTC via PeerJS (public PeerJS cloud signalling).
// Host-authoritative: the host simulates everything and broadcasts snapshots ~10x/s; clients send commands.
const PEERJS = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const PREFIX = 'irondom-v1-';
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const makeCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
export const TYPES = ['cy', 'power', 'refinery', 'barracks', 'factory', 'rifle', 'rocket', 'tank', 'harvester'];
const HST = ['toOre', 'harvest', 'toRef', 'unload'];

async function loadPeer() {
  if (window.Peer) return;
  await new Promise((res, rej) => { const s = document.createElement('script'); s.src = PEERJS; s.onload = res; s.onerror = () => rej(new Error('Could not load PeerJS from CDN')); document.head.appendChild(s); });
}
function opened(peer) {
  return new Promise((res, rej) => { peer.on('open', res); peer.on('error', rej); setTimeout(() => rej(new Error('Signalling server timeout')), 15000); });
}

export class Net {
  constructor() { this.conns = []; this.on = {}; this.game = null; this.clients = []; }
  emit(k, ...a) { if (this.on[k]) this.on[k](...a); }
  // ---------- host ----------
  async host() {
    await loadPeer(); this.isHost = true;
    for (let attempt = 0; attempt < 4; attempt++) {
      this.code = makeCode();
      this.peer = new window.Peer(PREFIX + this.code, { debug: 1 });
      try { await opened(this.peer); break; } catch (e) { this.peer.destroy(); if (attempt === 3 || (e.type && e.type !== 'unavailable-id')) throw e; }
    }
    this.peer.on('connection', c => {
      c.on('open', () => {});
      c.on('data', m => this.hostMsg(c, m));
      c.on('close', () => this.dropClient(c));
      c.on('error', () => this.dropClient(c));
    });
    this.peer.on('disconnected', () => { try { this.peer.reconnect(); } catch (e) { /* ignore */ } });
    return this.code;
  }
  hostMsg(c, m) {
    if (m.t === 'hello') {
      if (this.game || this.clients.length >= 3) { c.send({ t: 'full' }); setTimeout(() => c.close(), 500); return; }
      this.clients.push({ conn: c, name: String(m.name || 'Player').slice(0, 16), ups: m.ups || {} });
      this.emit('lobby', this.clients); this.broadcastLobby();
    } else if (m.t === 'cmd' && this.game) {
      const cl = this.clients.find(x => x.conn === c); if (cl && cl.team != null) this.game.execCommand(cl.team, m.c);
    }
  }
  broadcastLobby() { const names = ['Host', ...this.clients.map(c => c.name)]; for (const c of this.clients) c.conn.send({ t: 'lobby', names }); }
  dropClient(c) {
    const i = this.clients.findIndex(x => x.conn === c); if (i < 0) return;
    const cl = this.clients.splice(i, 1)[0];
    if (this.game && cl.team != null) this.emit('drop', cl);
    else { this.emit('lobby', this.clients); this.broadcastLobby(); }
  }
  // slots: [{team, human, name, ups}], host is team 0
  buildSlots(total, hostUps) {
    const slots = [{ team: 0, human: true, name: 'Host', ups: hostUps }];
    this.clients.forEach((c, i) => { c.team = i + 1; slots.push({ team: i + 1, human: true, name: c.name, ups: c.ups }); });
    while (slots.length < Math.max(2, total)) slots.push({ team: slots.length, human: false, name: 'AI' });
    return slots;
  }
  startClients(game) {
    this.game = game;
    for (const c of this.clients) c.conn.send({ t: 'start', me: c.team, slots: game.slots, ore: game.oreList() });
    this.acc = 0;
  }
  tick(dt) { // host: broadcast snapshots at ~10 Hz
    if (!this.game || !this.clients.length) { if (this.game) this.game.netEvents.length = 0; return; }
    const now = performance.now(); if (now - (this.lastSend || 0) < 100) return; this.lastSend = now;
    const snap = this.snapshot(this.game);
    for (const c of this.clients) if (c.conn.open) c.conn.send(snap);
  }
  snapshot(g) {
    const r2 = v => Math.round(v * 100) / 100;
    const e = g.entities.filter(x => !x.dead).map(x => [x.id, TYPES.indexOf(x.type), x.team, r2(x.pos.x), r2(x.pos.z), r2(x.mesh.rotation.y), Math.round(x.hp), x.isBuilding ? (x.constructing ? r2(x.progress) : -1) : Math.round(x.cargo || 0), x.isBuilding ? 0 : HST.indexOf(x.hstate)]);
    const teams = g.teams.map(t => [Math.floor(t.credits), t.alive ? 1 : 0, Math.floor(t.earned), ['barracks', 'factory'].map(k => t.queues[k].map(q => [q.type, r2(q.t)]))]);
    const ev = g.netEvents.splice(0);
    return { t: 's', time: r2(g.time), e, teams, ore: g.ore.map(o => Math.round(o.amount)), ev };
  }
  // ---------- client ----------
  async join(code, hello) {
    await loadPeer(); this.isHost = false;
    this.peer = new window.Peer({ debug: 1 }); await opened(this.peer);
    const c = this.conn = this.peer.connect(PREFIX + code.trim().toUpperCase(), { reliable: true });
    await new Promise((res, rej) => { c.on('open', res); c.on('error', rej); this.peer.on('error', rej); setTimeout(() => rej(new Error('Room not found or host unreachable')), 15000); });
    c.on('data', m => this.clientMsg(m));
    c.on('close', () => this.emit('hostLost'));
    c.send({ t: 'hello', ...hello });
  }
  clientMsg(m) {
    if (m.t === 'lobby') this.emit('lobby', m.names);
    else if (m.t === 'full') this.emit('error', new Error('Room is full or already started'));
    else if (m.t === 'start') this.emit('start', m);
    else if (m.t === 's' && this.game) this.game.applySnapshot(m);
  }
  sendCmd(c) { if (this.conn && this.conn.open) this.conn.send({ t: 'cmd', c }); }
}
export { HST };
