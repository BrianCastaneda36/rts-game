import { BUILD, UNIT, TEAM_CSS, TEAM_NAMES } from './defs.js';
import { profile } from './profile.js';
import { renderPortraits, BIO } from './portraits.js';
import { MAP, heightAt, colorAt } from './terrain.js';
const $ = id => document.getElementById(id);

export class UI {
  constructor(g) {
    this.g = g; this.ov = $('overlay'); this.octx = this.ov.getContext('2d');
    this.mm = $('minimap'); this.mctx = this.mm.getContext('2d'); this.t = 0; this.mmT = 0;
    $('renderer').textContent = g.rendererName;
    this.portraits = renderPortraits(g.renderer, g.me, t => t === 'tank' ? (g.tdefs[g.me].unit.tank.tier || 0) : 0);
    this.makeBase(); this.makeButtons(); this.bindMinimap();
  }
  resize() { this.ov.width = innerWidth; this.ov.height = innerHeight; }
  makeBase() {
    const c = document.createElement('canvas'); c.width = c.height = 200; const x = c.getContext('2d'), img = x.createImageData(200, 200);
    for (let j = 0; j < 200; j++) for (let i = 0; i < 200; i++) {
      const wx = i / 200 * MAP - MAP / 2, wz = j / 200 * MAP - MAP / 2, h = heightAt(wx, wz), col = h < -2.2 ? [0.16, 0.36, 0.54] : colorAt(h, wx, wz), k = (j * 200 + i) * 4;
      img.data[k] = col[0] * 255; img.data[k + 1] = col[1] * 255; img.data[k + 2] = col[2] * 255; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0); this.base = c;
  }
  makeButtons() {
    this.btns = {};
    const mk = (parent, type, def, onClick, onRight) => {
      const b = document.createElement('div'); b.className = 'btn pbtn';
      const img = this.portraits[type] ? `<img src="${this.portraits[type]}" alt="">` : '';
      b.innerHTML = `${img}<div class="clock"></div><span class="name">${def.name}</span><span class="cost">$${def.cost}</span><span class="q"></span><div class="prog"></div>`;
      b.onclick = onClick; if (onRight) b.oncontextmenu = e => { e.preventDefault(); onRight(); };
      $(parent).appendChild(b); this.btns[type] = b;
    };
    for (const t of ['power', 'refinery', 'barracks', 'factory']) mk('buildBtns', t, BUILD[t], () => this.g.startPlacing(t));
    for (const t of ['rifle', 'rocket', 'tank', 'harvester']) mk('unitBtns', t, { ...UNIT[t], name: this.g.tdefs[this.g.me].unit[t].name }, () => this.g.command({ c: 'queue', type: t }), () => this.g.command({ c: 'cancel', type: t }));
  }
  bindMinimap() {
    const toWorld = e => { const r = this.mm.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * MAP - MAP / 2, z: (e.clientY - r.top) / r.height * MAP - MAP / 2 }; };
    let down = false;
    this.mm.addEventListener('contextmenu', e => e.preventDefault());
    this.mm.addEventListener('mousedown', e => {
      const p = toWorld(e);
      if (e.button === 0) { down = true; this.g.camTarget.set(p.x, 0, p.z); }
      else if (e.button === 2) this.g.orderAt(0, 0, { x: p.x, y: heightAt(p.x, p.z), z: p.z });
    });
    this.mm.addEventListener('mousemove', e => { if (down) { const p = toWorld(e); this.g.camTarget.set(p.x, 0, p.z); } });
    window.addEventListener('mouseup', () => { down = false; });
  }
  update(dt) {
    const g = this.g; this.t += dt; this.mmT += dt;
    if (this.mmT > 0.25) { this.mmT = 0; this.drawMinimap(); }
    if (this.t < 0.15) return; this.t = 0;
    const me = g.me, tm = g.teams[me], pw = g.power(me);
    $('points').textContent = profile.data.points; $('mpts').textContent = g.matchPoints ? `(+${g.matchPoints})` : '';
    $('credits').textContent = Math.floor(tm.credits);
    $('power').textContent = `${pw.prod - pw.use} (${pw.prod}/${pw.use})`; $('power').style.color = pw.prod >= pw.use ? '#7f7' : '#f66';
    const s = Math.floor(g.time); $('clock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const cy = !!g.getCY(me);
    for (const t of ['power', 'refinery', 'barracks', 'factory']) {
      const b = this.btns[t], ok = cy && tm.credits >= BUILD[t].cost && g.reqMet(me, t);
      b.classList.toggle('dis', !ok); b.classList.toggle('active', g.placing === t);
      b.title = BUILD[t].req && !g.reqMet(me, t) ? `Requires ${BUILD[BUILD[t].req].name}` : '';
    }
    for (const t of ['rifle', 'rocket', 'tank', 'harvester']) {
      const def = UNIT[t], b = this.btns[t], q = tm.queues[def.from];
      b.classList.toggle('dis', !g.producer(me, def.from) || tm.credits < def.cost);
      const n = q.filter(i => i.type === t).length; b.querySelector('.q').textContent = n ? n : '';
      const f = q.length && q[0].type === t ? Math.min(1, q[0].t / def.time) : 0; b.querySelector('.prog').style.width = f * 100 + '%'; b.querySelector('.clock').style.height = f ? (100 - f * 100) + '%' : '0'; b.classList.toggle('building', !!f);
      b.title = g.producer(me, def.from) ? '' : `Requires ${BUILD[def.from].name}`;
    }
    const sel = [...g.selected].filter(e => !e.dead);
    let html = 'Nothing selected';
    if (sel.length === 1) {
      const e = sel[0];
      const bio = BIO[e.type] || {}, d = e.def, pimg = e.team === g.me && this.portraits[e.type] ? `<img class="sel-portrait" src="${this.portraits[e.type]}" alt="">` : `<div class="sel-portrait enemy" style="border-color:${TEAM_CSS[e.team]}">?</div>`;
      const hpF = Math.max(0, e.hp / e.maxHp);
      const stats = e.isBuilding ? `HP ${Math.ceil(e.hp)}/${e.maxHp} · Power ${d.power > 0 ? '+' : ''}${d.power} · $${d.cost}` : `HP ${Math.ceil(e.hp)}/${e.maxHp} · ${d.dmg ? `DMG ${Math.round(d.dmg)} · RNG ${d.range} · ` : ''}SPD ${d.speed.toFixed(1)} · $${d.cost}`;
      html = `<div class="selcard">${pimg}<div><b style="color:${TEAM_CSS[e.team]}">${d.name}</b><div class="role">${bio.role || ''}</div><div class="hpbar"><i style="width:${hpF * 100}%;background:${hpF > 0.6 ? '#3e3' : hpF > 0.3 ? '#ec3' : '#e33'}"></i></div></div></div><div class="stats">${stats}</div><div class="flavor">${bio.text || ''}</div>`;
      if (e.isBuilding) html += e.constructing ? `Building ${Math.floor(e.progress * 100)}%` : 'Operational';
      else html += `Mood: ${e.mood}<br>Traits: agg ${e.traits.aggression.toFixed(2)} / cau ${e.traits.caution.toFixed(2)} / greed ${e.traits.greed.toFixed(2)}` + (e.type === 'harvester' ? `<br>Cargo ${Math.floor(e.cargo)}/${e.def.cap}` : '');
    } else if (sel.length > 1) {
      const c = {}; sel.forEach(e => c[e.def.name] = (c[e.def.name] || 0) + 1);
      html = `${sel.length} selected<br>` + Object.entries(c).map(([k, v]) => `${v}× ${k}`).join('<br>');
    }
    $('selinfo').innerHTML = html;
    $('thoughtBody').innerHTML = (g.slots.length > 2 ? g.slots.map((s, i) => `<span style="color:${TEAM_CSS[i]}">■ ${s.name}${g.teams[i].alive ? '' : ' ✖'}</span>`).join(' ') + '<br>' : '') + (g.commander.thoughtHTML || '');
  }
  drawMinimap() {
    const g = this.g, c = this.mctx, W = 200, s = W / MAP, P = v => [(v.x + MAP / 2) * s, (v.z + MAP / 2) * s];
    c.drawImage(this.base, 0, 0);
    c.fillStyle = '#ffd23a'; for (const o of g.ore) { if (o.amount <= 0) continue; const [x, y] = P(o.pos); c.fillRect(x - 1, y - 1, 2, 2); }
    for (const e of g.entities) {
      if (e.dead) continue; const [x, y] = P(e.pos);
      c.fillStyle = g.selected.has(e) ? '#fff' : TEAM_CSS[e.team];
      const r = e.isBuilding ? e.r * s : 1.5; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = g.camTarget, hw = g.camDist * 0.75 * s, hh = g.camDist * 0.45 * s, [cx, cy] = P(t);
    c.strokeStyle = '#fff'; c.strokeRect(cx - hw, cy - hh * 1.4, hw * 2, hh * 2);
  }
  drawOverlay() {
    const g = this.g, c = this.octx; c.clearRect(0, 0, this.ov.width, this.ov.height);
    for (const e of g.entities) {
      if (e.dead || (!g.selected.has(e) && e.hp >= e.maxHp)) continue;
      const p = g.project(e.pos, e.isBuilding ? 4.5 : 2.2); if (p.z > 1 || p.x < 0 || p.x > innerWidth || p.y < 0 || p.y > innerHeight) continue;
      const w = e.isBuilding ? 44 : 24, f = Math.max(0, e.hp / e.maxHp);
      c.fillStyle = '#000'; c.fillRect(p.x - w / 2 - 1, p.y - 1, w + 2, 5);
      c.fillStyle = f > 0.6 ? '#3e3' : f > 0.3 ? '#ec3' : '#e33'; c.fillRect(p.x - w / 2, p.y, w * f, 3);
      if (e.type === 'harvester' && e.cargo > 0) { c.fillStyle = '#fd3'; c.fillRect(p.x - w / 2, p.y + 4, w * e.cargo / e.def.cap, 2); }
    }
    if (g.drag) { const d = g.drag; c.strokeStyle = '#6f6'; c.lineWidth = 1; c.strokeRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0); }
  }
  showEnd(win, pts = 0) {
    const m = $('msg'); m.style.display = 'block'; m.style.color = win ? '#7f7' : '#f66';
    m.innerHTML = (win ? 'VICTORY' : 'DEFEAT') + `<div class="endpts">+${pts} points earned · ${this.g.kills} kills</div><button onclick="location.reload()">Main menu</button>`;
  }
}
