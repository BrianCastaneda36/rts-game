// Natural disasters: earthquake, storm, flood, meteor. Host/single-player is authoritative for damage;
// multiplayer clients replay the same visual timeline from network events.
import { THREE } from './T.js';
import { heightAt, MAP } from './terrain.js';
import { softTex } from './textures.js';

export const DISASTERS = ['earthquake', 'storm', 'flood', 'meteor'];
const rr = a => (Math.random() - 0.5) * 2 * a;

export class Disasters {
  constructor(g, auto = true) {
    this.g = g; this.auto = auto; this.active = []; this.next = 110 + Math.random() * 60; this.waterLevel = -2.2; this.stormK = 0;
    this.base = { sun: g.sun.intensity, hemi: g.hemi.intensity, fog: g.scene.fog.color.clone(), far: g.scene.fog.far, near: g.scene.fog.near, water: g.terrain.waterMat.color.clone() };
    this.alertEl = document.getElementById('alert'); this.flashEl = document.getElementById('flash');
  }
  // ----- triggering -----
  trigger(type, params) {
    if (!this.g.authority) return;
    type = type || DISASTERS[Math.floor(Math.random() * DISASTERS.length)];
    params = params || this.makeParams(type);
    if (this.g.net) this.g.netEvents.push(['d', type, params]);
    this.start(type, params);
  }
  makeParams(type) {
    const g = this.g;
    // aim near the action: random player base or map centre
    const pickSpot = (spread) => { const t = Math.floor(Math.random() * g.teams.length), b = Math.random() < 0.7 ? g.basePos(t) : { x: 0, z: 0 }; return { x: Math.max(-85, Math.min(85, b.x + rr(spread))), z: Math.max(-85, Math.min(85, b.z + rr(spread))) }; };
    switch (type) {
      case 'earthquake': return { ...pickSpot(30), dur: 7, rad: 55 };
      case 'storm': return { dur: 32 };
      case 'flood': return { dur: 34, peak: 0.6 + Math.random() * 0.8 };
      case 'meteor': return { ...pickSpot(25), warn: 4.5 };
    }
  }
  start(type, p) {
    const d = { type, p, t: 0, dur: p.dur || 7 };
    const names = { earthquake: '⚠ EARTHQUAKE', storm: '⛈ LIGHTNING STORM', flood: '🌊 FLASH FLOOD', meteor: '☄ METEOR INBOUND' };
    this.alert(names[type]);
    if (type === 'meteor') { d.dur = p.warn + 9; this.meteorSetup(d); }
    if (type === 'earthquake') { d.cracks = []; }
    this.active.push(d);
  }
  alert(txt) { const el = this.alertEl; if (!el) return; el.textContent = txt; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
  screenFlash(a = 0.8) { const el = this.flashEl; if (!el) return; el.style.transition = 'none'; el.style.opacity = a; void el.offsetWidth; el.style.transition = 'opacity .35s'; el.style.opacity = 0; clearTimeout(this.ft); this.ft = setTimeout(() => { el.style.transition = 'none'; el.style.opacity = 0; }, 450); }
  slowAt(pos) { return heightAt(pos.x, pos.z) < this.waterLevel - 0.15 ? 0.45 : 1; }
  // network replay helpers (client)
  onEvent(ev) { if (ev[0] === 'd') this.start(ev[1], ev[2]); else if (ev[0] === 'bolt') this.bolt(ev[1], ev[2], false); }

  update(dt) { // gameplay tick (authority) - visuals run in visual()
    if (this.auto && this.g.authority && this.g.time > this.next) { this.next = this.g.time + 100 + Math.random() * 70; this.trigger(); }
  }
  visual(dt) {
    const g = this.g, fx = g.fx; let storm = 0, flood = -2.2;
    for (const d of this.active) {
      d.t += dt; const k = d.t / d.dur, env = Math.min(1, d.t / 3, (d.dur - d.t) / 4);
      switch (d.type) {
        case 'earthquake': {
          g.addShake(dt * 6 * Math.max(0, env));
          if (Math.random() < dt * 30) fx.dust(new THREE.Vector3(d.p.x + rr(d.p.rad * 0.7), heightAt(d.p.x, d.p.z), d.p.z + rr(d.p.rad * 0.7)), 2);
          if (Math.random() < dt * 4) fx.chunk(new THREE.Vector3(g.camTarget.x + rr(25), heightAt(g.camTarget.x, g.camTarget.z), g.camTarget.z + rr(25)), 1);
          if (d.cracks.length < 7 && Math.random() < dt * 2.5) d.cracks.push(this.crack(d.p.x + rr(10), d.p.z + rr(10)));
          if (g.authority && Math.floor(d.t) !== Math.floor(d.t - dt) && d.t < d.dur - 1) for (const e of g.entities) {
            const dist = Math.hypot(e.pos.x - d.p.x, e.pos.z - d.p.z); if (dist > d.p.rad) continue;
            const f = 1 - dist / d.p.rad; g.envDamage(e, e.isBuilding ? e.maxHp * 0.045 * f : 7 * f);
          }
          break; }
        case 'storm': {
          storm = Math.max(storm, env);
          if (g.authority && env > 0.6) { d.bt = (d.bt ?? 2) - dt; if (d.bt <= 0) { d.bt = 0.6 + Math.random() * 1.6; const t = g.entities.length && Math.random() < 0.45 ? g.entities[Math.floor(Math.random() * g.entities.length)].pos : { x: rr(90), z: rr(90) }; this.bolt(t.x + rr(3), t.z + rr(3), true); } }
          break; }
        case 'flood': {
          const lv = -2.2 + (d.p.peak + 2.2) * Math.max(0, env) ** 0.7; flood = Math.max(flood, lv);
          if (g.authority && Math.floor(d.t * 2) !== Math.floor((d.t - dt) * 2)) for (const e of g.entities) {
            const depth = this.waterLevel - heightAt(e.pos.x, e.pos.z); if (depth <= 0) continue;
            g.envDamage(e, e.isBuilding ? e.maxHp * 0.006 * Math.min(2, depth) : 2.5 * Math.min(2, depth));
          }
          for (const e of g.entities) if (!e.isBuilding && heightAt(e.pos.x, e.pos.z) < this.waterLevel && Math.random() < dt * 4) fx.spawn(false, new THREE.Vector3(e.pos.x, this.waterLevel + 0.1, e.pos.z), { vel: new THREE.Vector3(rr(1), 1.5, rr(1)), life: 0.6, s0: 0.4, s1: 1.2, a: 0.6, c0: 0xffffff, c1: 0xcfe6ff, grav: 3 });
          break; }
        case 'meteor': this.meteorTick(d, dt); break;
      }
    }
    for (const d of this.active) if (d.t >= d.dur) this.finish(d);
    this.active = this.active.filter(d => d.t < d.dur);
    // global storm / flood state
    this.stormK += (storm - this.stormK) * Math.min(1, dt * 1.5);
    const s = this.stormK, B = this.base;
    g.sun.intensity = B.sun * (1 - 0.72 * s); g.hemi.intensity = B.hemi * (1 - 0.5 * s);
    g.scene.fog.color.copy(B.fog).lerp(STORMC, s); g.scene.fog.far = B.far - (B.far - 120) * s; g.scene.fog.near = B.near - (B.near - 30) * s;
    if (g.scene.background && g.scene.background.isColor) g.scene.background.copy(g.scene.fog.color);
    this.rain(dt, s);
    this.waterLevel = flood; g.terrain.water.position.y = flood; g.terrain.waterMat.color.copy(B.water).lerp(MUD, Math.min(1, (flood + 2.2) / 2));
  }
  finish(d) {
    if (d.cracks) for (const c of d.cracks) { const m = c; setTimeout(() => this.g.scene.remove(m), 40000); }
    if (d.marker) { this.g.scene.remove(d.marker); this.g.scene.remove(d.rock); }
  }
  rain(dt, s) {
    const g = this.g;
    if (!this.rainMesh) {
      if (s < 0.01) return;
      const N = 3000, pos = new Float32Array(N * 6); this.rainV = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { const x = rr(55), y = Math.random() * 45, z = rr(55); pos.set([x, y, z, x + 0.15, y + 1.1, z + 0.1], i * 6); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rainMesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xb8c8dc, transparent: true, opacity: 0, depthWrite: false }));
      this.rainMesh.frustumCulled = false; g.scene.add(this.rainMesh);
    }
    const m = this.rainMesh; m.visible = s > 0.01; m.material.opacity = 0.45 * s; if (!m.visible) return;
    m.position.set(g.camTarget.x, heightAt(g.camTarget.x, g.camTarget.z), g.camTarget.z);
    const p = m.geometry.attributes.position, a = p.array;
    for (let i = 0; i < a.length; i += 6) { a[i + 1] -= 40 * dt; a[i + 4] -= 40 * dt; if (a[i + 1] < 0) { a[i + 1] += 45; a[i + 4] += 45; } }
    p.needsUpdate = true;
    if (Math.random() < dt * 60 * s) g.fx.spawn(false, new THREE.Vector3(g.camTarget.x + rr(30), heightAt(g.camTarget.x, g.camTarget.z) + 0.1, g.camTarget.z + rr(30)), { life: 0.3, s0: 0.2, s1: 0.6, a: 0.5, c0: 0xdde8ff });
  }
  bolt(x, z, authoritative) {
    const g = this.g, y = heightAt(x, z);
    if (authoritative && g.net) g.netEvents.push(['bolt', +x.toFixed(1), +z.toFixed(1)]);
    // jagged main channel + branches
    const pts = [], seg = 14; let cx = x + rr(8), cz = z + rr(8);
    for (let i = 0; i <= seg; i++) { const k = i / seg; pts.push(new THREE.Vector3(cx + (x - cx) * k + rr(2.5) * (1 - k), y + 70 * (1 - k), cz + (z - cz) * k + rr(2.5) * (1 - k))); }
    pts[seg].set(x, y, z);
    const group = new THREE.Group(), mat = new THREE.LineBasicMaterial({ color: 0xeef4ff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let o = 0; o < 3; o++) group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => p.clone().add(new THREE.Vector3(rr(0.15), 0, rr(0.15))))), mat));
    for (let b = 0; b < 3; b++) { const i0 = 3 + Math.floor(Math.random() * 8), bp = [pts[i0].clone()]; for (let j = 1; j < 5; j++) bp.push(bp[j - 1].clone().add(new THREE.Vector3(rr(3), -3 - Math.random() * 3, rr(3)))); group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bp), mat)); }
    g.scene.add(group);
    let t = 0; const fade = () => { t += 0.05; mat.opacity = Math.max(0, 1 - t * 2.5) * (Math.random() < 0.3 ? 0.3 : 1); if (t < 0.45) setTimeout(fade, 50); else { g.scene.remove(group); group.traverse(o => o.geometry && o.geometry.dispose()); } };
    fade();
    g.fx.flash(new THREE.Vector3(x, y + 6, z), 9, 0.35, 0xbfd8ff); g.fx.explosion(new THREE.Vector3(x, y, z), 1.1, { debris: 3 }); this.screenFlash(0.55);
    if (authoritative) for (const e of g.entities) { const dd = Math.hypot(e.pos.x - x, e.pos.z - z); if (dd < 5 + e.r) g.envDamage(e, e.isBuilding ? 70 : 85 * (1 - dd / (6 + e.r))); }
  }
  crack(x, z) {
    // jagged dark ribbon draped over the terrain
    const g = this.g, pts = []; let a = Math.random() * 6.28, px = x, pz = z; const n = 18 + Math.floor(Math.random() * 14);
    for (let i = 0; i < n; i++) { pts.push([px, pz]); a += rr(0.6); px += Math.cos(a) * 1.6; pz += Math.sin(a) * 1.6; }
    const pos = [], idx = [];
    pts.forEach(([px, pz], i) => { const w = 0.55 * (1 - i / n) + 0.1, nx = -Math.sin(a), nz = Math.cos(a); const k = i + 1 < n ? i + 1 : i - 1, dx = pts[k][0] - px, dz = pts[k][1] - pz, L = Math.hypot(dx, dz) || 1, ox = -dz / L * w, oz = dx / L * w; pos.push(px + ox, heightAt(px + ox, pz + oz) + 0.07, pz + oz, px - ox, heightAt(px - ox, pz - oz) + 0.07, pz - oz); if (i) { const b = i * 2; idx.push(b - 2, b - 1, b, b - 1, b + 1, b); } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, CRACKM || (CRACKM = new THREE.MeshBasicMaterial({ color: 0x0d0a08, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 })));
    g.scene.add(m); g.fx.dust(new THREE.Vector3(x, heightAt(x, z), z), 3); return m;
  }
  meteorSetup(d) {
    const g = this.g, y = heightAt(d.p.x, d.p.z);
    const marker = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(8.2, 9, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff2a10, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    const inner = new THREE.Mesh(new THREE.CircleGeometry(9, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff2a10, transparent: true, opacity: 0.15, depthWrite: false }));
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xff4020, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.y = 30; marker.add(ring, inner, beam); marker.position.set(d.p.x, y + 0.3, d.p.z); g.scene.add(marker); d.marker = marker; d.ring = ring;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), new THREE.MeshStandardMaterial({ color: 0x3a2a20, emissive: 0xff5a10, emissiveIntensity: 1.6, roughness: 0.8, flatShading: true }));
    rock.visible = false; g.scene.add(rock); d.rock = rock; d.from = new THREE.Vector3(d.p.x + 70, y + 140, d.p.z - 40); d.to = new THREE.Vector3(d.p.x, y, d.p.z);
  }
  meteorTick(d, dt) {
    const g = this.g, fx = g.fx, W = d.p.warn, fall = 1.3;
    if (d.marker.visible) { const pulse = 0.5 + 0.5 * Math.sin(d.t * (6 + d.t * 3)); d.ring.material.opacity = 0.4 + 0.5 * pulse; d.ring.scale.setScalar(1 + 0.05 * pulse); }
    if (d.t > W && d.t < W + fall) {
      const k = (d.t - W) / fall; d.rock.visible = true; d.rock.position.lerpVectors(d.from, d.to, k * k); d.rock.rotation.x += dt * 5;
      for (let i = 0; i < 4; i++) fx.spawn(true, d.rock.position.clone().add(new THREE.Vector3(rr(0.8), rr(0.8), rr(0.8))), { life: 0.5, s0: 3, s1: 1, c0: 0xffe0a0, c1: 0xff3000, vr: 2 });
      fx.spawn(false, d.rock.position.clone(), { life: 3, s0: 2, s1: 5, a: 0.6, c0: 0x2a2420, c1: 0x6a625a, drag: 0.5 });
      g.addShake(dt * 2 * k);
    }
    if (!d.hit && d.t >= W + fall) {
      d.hit = true; d.rock.visible = false; d.marker.visible = false;
      const p = d.to; fx.explosion(p, 5.5, { debris: 40 }); fx.explosion(p.clone().add(new THREE.Vector3(3, 1, 2)), 3, { debris: 10 }); fx.ring(p, 45, 1.2, 0xffd0a0);
      g.fx.flash(p, 12, 0.8, 0xffa040); this.screenFlash(0.9); g.addShake(2.5);
      if (g.authority) for (const e of [...g.entities]) { const dd = Math.hypot(e.pos.x - p.x, e.pos.z - p.z); if (dd < 13 + e.r) g.envDamage(e, (e.isBuilding ? 0.9 : 1) * 420 * Math.max(0.15, 1 - dd / (13 + e.r))); }
      g.terrain.addCrater(p.x, p.z, 7.5, 3.2);
      for (const e of g.entities) e.pos.y = heightAt(e.pos.x, e.pos.z);
      for (const o of g.ore) o.pos.y = heightAt(o.pos.x, o.pos.z) - 0.05;
      for (let i = 0; i < 3; i++) fx.decal(p.clone().add(new THREE.Vector3(rr(3), 0, rr(3))), 16 + i * 3);
    }
    if (d.hit && Math.random() < dt * 8) fx.spawn(false, d.to.clone().add(new THREE.Vector3(rr(4), 0.5, rr(4))), { vel: new THREE.Vector3(0.3, 2, 0.2), life: 4, s0: 1.2, s1: 4, a: 0.6, c0: 0x1d1a17, c1: 0x5d5850, drag: 0.3 });
  }
}
let CRACKM = null;
const STORMC = new THREE.Color(0x3c434c), MUD = new THREE.Color(0x4a4a30);
