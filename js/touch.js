// Touch controls: tap = select / command, long-press + drag = box select, one/two-finger drag = pan, pinch = zoom.
const $ = id => document.getElementById(id);
export class Touch {
  constructor(g) {
    this.g = g; this.state = null; const c = g.renderer.domElement;
    c.addEventListener('touchstart', e => this.start(e), { passive: false });
    c.addEventListener('touchmove', e => this.move(e), { passive: false });
    c.addEventListener('touchend', e => this.end(e), { passive: false });
    c.addEventListener('touchcancel', () => { this.reset(); }, { passive: false });
    const body = document.body;
    if (innerWidth < 900) body.classList.add('sideClosed');
    $('sideToggle').onclick = () => body.classList.toggle('sideClosed');
    $('thoughtToggle').onclick = () => body.classList.toggle('thoughtOpen');
    $('deselect').onclick = () => { g.cancelPlacing(); g.setSel([], false); };
    // on small screens, close the build drawer once a structure is picked for placement
    $('buildBtns').addEventListener('click', () => { if (innerWidth < 900 && g.placing) body.classList.add('sideClosed'); });
  }
  reset() { clearTimeout(this.lp); this.state = null; this.g.drag = null; }
  pt(t) { return { x: t.clientX, y: t.clientY }; }
  start(e) {
    e.preventDefault(); const g = this.g, ts = e.touches;
    if (ts.length === 1) {
      const p = this.pt(ts[0]); this.p0 = p; this.last = p; this.state = 'pending'; g.mouse.x = p.x; g.mouse.y = p.y; g.mouse.inside = false;
      clearTimeout(this.lp);
      this.lp = setTimeout(() => { if (this.state === 'pending' && !g.placing) { this.state = 'box'; g.drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; if (navigator.vibrate) navigator.vibrate(25); } }, 380);
    } else if (ts.length >= 2) {
      clearTimeout(this.lp); g.drag = null; this.state = 'multi';
      const a = this.pt(ts[0]), b = this.pt(ts[1]); this.mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; this.dist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }
  pan(dx, dy) { const g = this.g, k = g.camDist * 0.95 / innerHeight; g.camTarget.x = Math.max(-95, Math.min(95, g.camTarget.x - dx * k)); g.camTarget.z = Math.max(-95, Math.min(95, g.camTarget.z - dy * k * 1.3)); }
  move(e) {
    e.preventDefault(); const g = this.g, ts = e.touches;
    if (this.state === 'multi' && ts.length >= 2) {
      const a = this.pt(ts[0]), b = this.pt(ts[1]), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist = Math.hypot(a.x - b.x, a.y - b.y);
      this.pan(mid.x - this.mid.x, mid.y - this.mid.y);
      if (this.dist > 10) g.camDist = Math.max(22, Math.min(140, g.camDist * this.dist / Math.max(10, dist)));
      this.mid = mid; this.dist = dist; return;
    }
    if (ts.length !== 1) return;
    const p = this.pt(ts[0]);
    if (g.placing) { g.mouse.x = p.x; g.mouse.y = p.y; this.state = 'place'; return; }
    if (this.state === 'pending' && Math.hypot(p.x - this.p0.x, p.y - this.p0.y) > 12) { clearTimeout(this.lp); this.state = 'pan'; }
    if (this.state === 'pan') this.pan(p.x - this.last.x, p.y - this.last.y);
    if (this.state === 'box') { g.drag.x1 = p.x; g.drag.y1 = p.y; }
    this.last = p;
  }
  end(e) {
    e.preventDefault(); const g = this.g;
    if (e.touches.length) { if (this.state === 'multi' && e.touches.length === 1) { this.state = 'pan'; this.last = this.pt(e.touches[0]); } return; }
    clearTimeout(this.lp);
    const p = this.last || this.p0;
    if (g.over) return this.reset();
    if (this.state === 'place' || (this.state === 'pending' && g.placing)) { g.mouse.x = p.x; g.mouse.y = p.y; g.updateGhost(); if (g.ghostOk) g.tryPlace(); }
    else if (this.state === 'pending') this.tap(p);
    else if (this.state === 'box') {
      const d = g.drag, x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
      g.setSel(g.units(g.me).filter(u => { const q = g.project(u.pos, 0.5); return q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1; }), false);
    }
    this.reset();
  }
  tap(p) {
    const g = this.g, ent = g.pick(p.x, p.y);
    if (ent && ent.team === g.me) {
      // tap an own unit: select it; tap it again (already selected) with others -> select only it
      g.setSel([ent], false); return;
    }
    const mine = [...g.selected].filter(e => !e.dead && !e.isBuilding && e.team === g.me);
    if (mine.length) g.orderAt(p.x, p.y);
    else if (!ent) g.setSel([], false);
  }
}
