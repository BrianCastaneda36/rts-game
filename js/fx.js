// Particle effects: fire/smoke billboards, debris, tracers, scorch decals. Pooled + shared geometry.
import { THREE } from './T.js';
import { softTex, flareTex, scorchTex } from './textures.js';
import { heightAt } from './terrain.js';

const MAXP = 1100, MAXD = 220, MAXS = 90, MAXL = 6, MAXR = 24, MAXC = 60;
export class FX {
  constructor(scene) {
    this.scene = scene; this.t = 0;
    this.quad = new THREE.PlaneGeometry(1, 1);
    this.parts = []; this.free = []; this.live = [];
    const soft = softTex(), flare = flareTex();
    for (let i = 0; i < MAXP; i++) {
      const add = i < MAXP * 0.4;
      const m = new THREE.MeshBasicMaterial({ map: add ? flare : soft, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true });
      const me = new THREE.Mesh(this.quad, m); me.visible = false; me.frustumCulled = false; me.renderOrder = add ? 3 : 2; scene.add(me);
      const p = { me, add, vel: new THREE.Vector3(), life: 1, t: 0, s0: 1, s1: 1, a0: 1, drag: 0, grav: 0, rot: 0, vr: 0, c0: new THREE.Color(), c1: new THREE.Color() };
      this.parts.push(p);
    }
    this.freeAdd = this.parts.filter(p => p.add); this.freeNorm = this.parts.filter(p => !p.add);
    // debris chunks
    const dg = new THREE.BoxGeometry(1, 1, 1), dm = new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.8, metalness: 0.4 });
    this.debris = []; for (let i = 0; i < MAXD; i++) { const me = new THREE.Mesh(dg, dm); me.visible = false; me.castShadow = true; scene.add(me); this.debris.push({ me, vel: new THREE.Vector3(), spin: new THREE.Vector3(), t: 0, life: 0, on: false }); }
    // scorch decals
    const sg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.scorch = []; this.si = 0;
    for (let i = 0; i < MAXS; i++) { const m = new THREE.MeshBasicMaterial({ map: scorchTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, opacity: 0 }); const me = new THREE.Mesh(sg, m); me.visible = false; me.renderOrder = 1; scene.add(me); this.scorch.push({ me, t: 0 }); }
    // pooled dynamic point lights (fixed budget so shader permutations never change)
    this.lights = []; for (let i = 0; i < MAXL; i++) { const l = new THREE.PointLight(0xffa050, 0, 30, 2); scene.add(l); this.lights.push({ l, t: 0, life: 1, i0: 0 }); }
    // shockwave rings
    const rg = new THREE.RingGeometry(0.7, 1, 40).rotateX(-Math.PI / 2);
    this.rings = []; for (let i = 0; i < MAXR; i++) { const m = new THREE.MeshBasicMaterial({ map: softTex(), color: 0xffe0b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }); const me = new THREE.Mesh(rg, m); me.visible = false; me.renderOrder = 3; scene.add(me); this.rings.push({ me, t: 0, life: 1, size: 1, on: false }); }
    // brass shell casings
    const cg = new THREE.CylinderGeometry(0.035, 0.035, 0.14, 6).rotateZ(Math.PI / 2), cm = new THREE.MeshStandardMaterial({ color: 0xd8a640, roughness: 0.3, metalness: 1 });
    this.casings = []; for (let i = 0; i < MAXC; i++) { const me = new THREE.Mesh(cg, cm); me.visible = false; scene.add(me); this.casings.push({ me, vel: new THREE.Vector3(), spin: new THREE.Vector3(), t: 0, life: 0, on: false }); }
    this.ci = 0; this.quality = 1; this.mult = 1;
    this.wrecks = []; this.pending = []; this.shake = 0;
    this.charred = new THREE.MeshStandardMaterial({ color: 0x1b1916, roughness: 0.95, metalness: 0.3 });
    this.flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.emitAcc = new WeakMap();
  }
  spawn(add, pos, o) {
    if (this.mult < 1 && Math.random() > this.mult) return null;
    const pool = add ? this.freeAdd : this.freeNorm; const p = pool.pop(); if (!p) return null;
    p.me.position.copy(pos); p.vel.copy(o.vel || ZERO); p.life = o.life; p.t = 0; p.s0 = o.s0; p.s1 = o.s1 ?? o.s0; p.a0 = o.a ?? 1;
    p.drag = o.drag ?? 1; p.grav = o.grav ?? 0; p.rot = Math.random() * 6.28; p.vr = (Math.random() - 0.5) * (o.vr ?? 1);
    p.c0.set(o.c0 ?? 0xffffff); p.c1.set(o.c1 ?? o.c0 ?? 0xffffff); p.me.visible = true; p.me.scale.setScalar(p.s0);
    this.live.push(p); return p;
  }
  muzzle(pos, dir, big) {
    const k = big ? 1 : 0.45;
    this.spawn(true, pos, { life: 0.08, s0: 1.4 * k, s1: 2.0 * k, c0: 0xfff1c0, c1: 0xff8a30 });
    for (let i = 0; i < (big ? 12 : 2); i++) this.spawn(false, pos, { vel: v3(dir.x * 3 + rr(1.5), 1 + rr(0.8), dir.z * 3 + rr(1.5)), life: 1.0 + Math.random(), s0: 0.4 * k, s1: 2.2 * k, a: 0.45, c0: 0xbbbbbb, c1: 0x888888, drag: 2 });
    this.flash(pos, big ? 3 : 1.0, big ? 0.12 : 0.06);
    if (big) this.ring(pos, 2.5, 0.25, 0xfff0d0);
  }
  flash(pos, power, life = 0.15, col = 0xffa050) {
    let L = this.lights.find(l => l.t >= l.life); if (!L) L = this.lights.reduce((a, b) => (a.i0 * (1 - a.t / a.life) < b.i0 * (1 - b.t / b.life) ? a : b));
    if (L.t < L.life && L.i0 * (1 - L.t / L.life) > power * 25) return;
    L.l.position.set(pos.x, pos.y + 1.5, pos.z); L.l.color.set(col); L.l.distance = 8 + power * 6; L.i0 = power * 25; L.t = 0; L.life = life; L.l.intensity = L.i0;
  }
  ring(pos, size, life = 0.5, col = 0xffe0b0) {
    const r = this.rings.find(r => !r.on) || this.rings[0]; r.on = true; r.t = 0; r.life = life; r.size = size; r.me.visible = true;
    r.me.position.set(pos.x, Math.max(pos.y, heightAt(pos.x, pos.z)) + 0.2, pos.z); r.me.material.color.set(col); r.me.scale.setScalar(0.1);
  }
  casing(pos, dirX, dirZ) {
    const c = this.casings[this.ci = (this.ci + 1) % MAXC]; c.on = true; c.t = 0; c.life = 3; c.me.visible = true; c.me.position.copy(pos);
    c.vel.set(-dirZ * 2.5 + rr(0.5), 2.5 + Math.random() * 1.5, dirX * 2.5 + rr(0.5)); c.spin.set(rr(20), rr(20), rr(20));
  }
  // weapon-specific impact: sparks, dust, small decal, armour-penetration flash on vehicles
  impact(pos, weapon, armor) {
    if (weapon === 'bullet') {
      for (let i = 0; i < 4; i++) this.spawn(true, pos, { vel: v3(rr(5), 1 + Math.random() * 4, rr(5)), life: 0.25, s0: 0.12, s1: 0.03, c0: 0xffffd0, c1: 0xffa040, grav: 15, drag: 0.5 });
      if (armor === 'veh' || armor === 'bld') this.spawn(true, pos, { life: 0.05, s0: 0.6, c0: 0xffffff, c1: 0xffd080 });
      else this.spawn(false, pos, { vel: v3(0, 1, 0), life: 0.6, s0: 0.3, s1: 1, a: 0.4, c0: 0x9a8a70, c1: 0xa89878 });
      if (Math.random() < 0.3) this.decal(pos, 0.5);
      return;
    }
    const big = weapon === 'shell' ? 1 : 0.8;
    if (armor === 'veh' || armor === 'bld') { // penetration flash + spray of white-hot sparks
      this.spawn(true, pos, { life: 0.09, s0: 2.6 * big, s1: 3.5 * big, c0: 0xffffff, c1: 0x9fd0ff });
      for (let i = 0; i < 14; i++) this.spawn(true, pos, { vel: v3(rr(10), 2 + Math.random() * 7, rr(10)), life: 0.4 + Math.random() * 0.4, s0: 0.18, s1: 0.04, c0: 0xffffff, c1: 0xffb040, grav: 18, drag: 0.4 });
      this.flash(pos, 2.5 * big, 0.12, 0xdfe8ff);
    }
  }
  // layered explosion: flash, fireball, shockwave ring, smoke column, embers, ground dust, scorch
  explosion(pos, size, opt = {}) {
    const q = this.quality, n = Math.min(40, 8 + size * 8 | 0);
    this.spawn(true, pos, { life: 0.1, s0: size * 3, s1: size * 4.5, c0: 0xffffff, c1: 0xfff0c0 });
    for (let i = 0; i < n; i++) this.spawn(true, v3(pos.x + rr(size * 0.4), pos.y + Math.random() * size * 0.5, pos.z + rr(size * 0.4)), { vel: v3(rr(size * 3.5), size * (1 + Math.random() * 3), rr(size * 3.5)), life: 0.4 + Math.random() * 0.5, s0: size * 0.9, s1: size * 2.4, c0: 0xffe9a0, c1: 0xb02000, drag: 3.5, vr: 3, grav: -1 });
    for (let i = 0; i < n * 0.8; i++) this.spawn(false, pos, { vel: v3(rr(size * 1.5), size * (1.5 + Math.random() * 2.5), rr(size * 1.5)), life: 2.5 + Math.random() * 3 * q, s0: size * 0.8, s1: size * 4, a: 0.75, c0: 0x1d1a17, c1: 0x6d675f, drag: 0.9, grav: -0.4, vr: 0.8 });
    for (let i = 0; i < n * 0.8; i++) this.spawn(true, pos, { vel: v3(rr(size * 9), 3 + Math.random() * size * 8, rr(size * 9)), life: 0.6 + Math.random() * 1.0, s0: 0.18, s1: 0.05, c0: 0xffd070, c1: 0xff4000, drag: 0.4, grav: 13 });
    const gy = heightAt(pos.x, pos.z) + 0.3;
    for (let i = 0; i < n * 0.6; i++) { const a = Math.random() * 6.28; this.spawn(false, v3(pos.x, gy, pos.z), { vel: v3(Math.cos(a) * size * 7, 0.4 + Math.random(), Math.sin(a) * size * 7), life: 1.2 + Math.random(), s0: size * 0.6, s1: size * 2.2, a: 0.5, c0: 0x9a8a6c, c1: 0xb8ab90, drag: 3 }); }
    this.ring(pos, size * 5, 0.45);
    if (size > 1.2) this.ring(pos, size * 8, 0.8, 0xc8b8a0);
    if (opt.debris) for (let i = 0; i < opt.debris * q; i++) this.chunk(pos, size, opt.dcol);
    if (opt.scorch !== false) this.decal(pos, size * 2.6);
    this.flash(pos, size * 2.2, 0.25 + size * 0.08);
    this.shake = Math.max(this.shake, 0);
    if (this.onBoom) this.onBoom(pos, size);
  }
  // remains: infantry fall over, vehicles burn as wrecks, buildings collapse with secondary blasts
  wreck(mesh, kind, e) {
    mesh.userData.ring.visible = false; mesh.userData.animate = null;
    const w = { mesh, kind, t: 0, y0: mesh.position.y, r: e.r, dir: Math.random() < 0.5 ? 1 : -1, ax: Math.random() < 0.6 ? 'x' : 'z' };
    if (kind === 'veh') { mesh.traverse(o => { if (o.isMesh && o !== mesh.userData.ring) o.material = this.charred; }); const tur = mesh.userData.turret; if (tur) { w.tur = tur; w.tv = v3(rr(2), 9 + Math.random() * 4, rr(2)); w.ts = v3(rr(6), rr(6), rr(6)); } }
    if (kind === 'bld') { for (let i = 0; i < 6; i++) this.pending.push({ t: 0.25 + i * 0.35 + Math.random() * 0.2, pos: v3(mesh.position.x + rr(e.r), mesh.position.y + 1 + Math.random() * 2, mesh.position.z + rr(e.r)), size: 1 + Math.random() * 1.2 }); mesh.traverse(o => { if (o.isMesh && Math.random() < 0.5) o.material = this.charred; }); }
    this.wrecks.push(w); if (this.wrecks.length > 40) this.removeWreck(this.wrecks[0]);
  }
  removeWreck(w) { this.scene.remove(w.mesh); this.wrecks.splice(this.wrecks.indexOf(w), 1); }
  hitFlash(mesh) { mesh.userData.flashT = 0.07; }
  explosion(pos, size, opt = {}) {
    const n = Math.min(26, 6 + size * 6 | 0);
    for (let i = 0; i < n; i++) this.spawn(true, pos, { vel: v3(rr(size * 4), Math.random() * size * 3.5, rr(size * 4)), life: 0.35 + Math.random() * 0.35, s0: size * 0.9, s1: size * 2.2, c0: 0xffe9a0, c1: 0xff3a00, drag: 4, vr: 3 });
    for (let i = 0; i < n * 0.7; i++) this.spawn(false, pos, { vel: v3(rr(size * 2), 1 + Math.random() * size * 2, rr(size * 2)), life: 1.6 + Math.random() * 2, s0: size * 0.8, s1: size * 3.2, a: 0.7, c0: 0x2d2a26, c1: 0x7a746c, drag: 1.5, grav: -0.6, vr: 1 });
    for (let i = 0; i < n * 0.6; i++) this.spawn(true, pos, { vel: v3(rr(size * 9), 3 + Math.random() * size * 7, rr(size * 9)), life: 0.5 + Math.random() * 0.6, s0: 0.15, s1: 0.05, c0: 0xffd070, c1: 0xff5000, drag: 0.5, grav: 14 });
    if (opt.debris) for (let i = 0; i < opt.debris; i++) this.chunk(pos, size, opt.dcol);
    if (opt.scorch !== false) this.decal(pos, size * 2.2);
    this.flash(pos, size * 2);
  }
  chunk(pos, size, col) {
    const d = this.debris.find(d => !d.on) || this.debris[(this.di = ((this.di || 0) + 1) % MAXD)];
    d.on = true; d.t = 0; d.life = 2 + Math.random() * 2; d.me.visible = true; d.me.position.copy(pos); d.me.position.y += 0.5;
    const s = 0.12 + Math.random() * 0.3 * Math.min(2, size); d.me.scale.set(s, s * (0.4 + Math.random()), s * (0.6 + Math.random()));
    d.vel.set(rr(6), 5 + Math.random() * 8, rr(6)); d.spin.set(rr(12), rr(12), rr(12));
  }
  decal(pos, size) {
    const s = this.scorch[this.si = (this.si + 1) % MAXS];
    s.me.position.set(pos.x, heightAt(pos.x, pos.z) + 0.06, pos.z); s.me.rotation.y = Math.random() * 6.28; s.me.scale.setScalar(size); s.me.visible = true; s.t = 0; s.me.material.opacity = 0.85;
  }
  trail(pos, rocket) {
    if (rocket) { this.spawn(true, pos, { life: 0.12, s0: 0.6, s1: 0.2, c0: 0xffd080, c1: 0xff6020 }); this.spawn(false, pos, { vel: v3(rr(0.3), 0.4, rr(0.3)), life: 1.2 + Math.random() * 0.6, s0: 0.35, s1: 1.4, a: 0.5, c0: 0xdddddd, c1: 0x999999, drag: 1 }); }
    else this.spawn(false, pos, { life: 0.5, s0: 0.25, s1: 0.7, a: 0.25, c0: 0xcccccc, c1: 0xaaaaaa });
  }
  // continuous emitters (chimneys, steam, harvester exhaust, construction dust)
  emit(obj, list, dt, mult = 1) {
    let acc = this.emitAcc.get(obj); if (!acc) { acc = list.map(() => Math.random()); this.emitAcc.set(obj, acc); }
    list.forEach((e, i) => {
      acc[i] += dt * e.rate * mult;
      while (acc[i] >= 1) { acc[i] -= 1; const w = obj.localToWorld((TMP_ = TMP_ || new THREE.Vector3()).copy(e.p)); this.spawn(false, w, { vel: v3(rr(0.3) + 0.4, e.up * (0.7 + Math.random() * 0.5), rr(0.3) + 0.2), life: e.life * (0.7 + Math.random() * 0.6), s0: e.size * 0.4, s1: e.size * 2.2, a: 0.55, c0: e.col, c1: e.col, drag: 0.3, vr: 0.6 }); }
    });
  }
  dust(pos, r) { this.spawn(false, v3(pos.x + rr(r), pos.y + 0.3, pos.z + rr(r)), { vel: v3(rr(0.6), 0.8 + Math.random(), rr(0.6)), life: 1.5, s0: 0.6, s1: 2.2, a: 0.4, c0: 0xa89878, c1: 0xb8ab90, drag: 1 }); }
  spark(pos, r) { this.spawn(true, v3(pos.x + rr(r), pos.y + Math.random() * 2, pos.z + rr(r)), { vel: v3(rr(3), 3 + Math.random() * 3, rr(3)), life: 0.4, s0: 0.25, s1: 0.05, c0: 0xffffcc, c1: 0x66aaff, grav: 12, drag: 0.5 }); }
  update(dt, camera) {
    this.t += dt; const q = camera.quaternion;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]; p.t += dt; const k = p.t / p.life;
      if (k >= 1) { p.me.visible = false; (p.add ? this.freeAdd : this.freeNorm).push(p); this.live[i] = this.live[this.live.length - 1]; this.live.pop(); continue; }
      p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt)); p.vel.y -= p.grav * dt; p.me.position.addScaledVector(p.vel, dt);
      p.me.quaternion.copy(q); p.rot += p.vr * dt; p.me.rotateZ(p.rot);
      p.me.scale.setScalar(p.s0 + (p.s1 - p.s0) * k);
      const m = p.me.material; m.color.copy(p.c0).lerp(p.c1, k); m.opacity = p.a0 * (p.add ? (1 - k) : Math.min(1, k * 6) * (1 - k));
    }
    for (const d of this.debris) if (d.on) {
      d.t += dt; d.vel.y -= 22 * dt; d.me.position.addScaledVector(d.vel, dt); d.me.rotation.x += d.spin.x * dt; d.me.rotation.y += d.spin.y * dt;
      const g = heightAt(d.me.position.x, d.me.position.z); if (d.me.position.y < g) { d.me.position.y = g; d.vel.multiplyScalar(0.35); d.vel.y = Math.abs(d.vel.y) * 0.4; d.spin.multiplyScalar(0.5); }
      if (d.t > d.life) { d.on = false; d.me.visible = false; }
    }
    for (const s of this.scorch) if (s.me.visible) { s.t += dt; if (s.t > 40) { s.me.material.opacity -= dt * 0.1; if (s.me.material.opacity <= 0) s.me.visible = false; } }
    for (const L of this.lights) if (L.t < L.life) { L.t += dt; L.l.intensity = L.t >= L.life ? 0 : L.i0 * (1 - L.t / L.life) ** 2; }
    for (const r of this.rings) if (r.on) { r.t += dt; const k = r.t / r.life; if (k >= 1) { r.on = false; r.me.visible = false; continue; } r.me.scale.setScalar(0.1 + r.size * (1 - (1 - k) ** 3)); r.me.material.opacity = (1 - k) * 0.8; }
    for (const c of this.casings) if (c.on) { c.t += dt; if (c.vel.lengthSq() > 0.01) { c.vel.y -= 20 * dt; c.me.position.addScaledVector(c.vel, dt); c.me.rotation.x += c.spin.x * dt; c.me.rotation.y += c.spin.y * dt; const g = heightAt(c.me.position.x, c.me.position.z) + 0.03; if (c.me.position.y < g) { c.me.position.y = g; c.vel.multiplyScalar(0.3); c.vel.y = Math.abs(c.vel.y) * 0.3; if (c.vel.lengthSq() < 0.3) c.vel.set(0, 0, 0); } } if (c.t > c.life) { c.on = false; c.me.visible = false; } }
    for (let i = this.pending.length - 1; i >= 0; i--) { const p = this.pending[i]; p.t -= dt; if (p.t <= 0) { this.explosion(p.pos, p.size, { debris: 5 }); this.pending.splice(i, 1); } }
    for (const w of [...this.wrecks]) {
      w.t += dt; const m = w.mesh;
      if (w.kind === 'inf') { const k = Math.min(1, w.t / 0.45); m.rotation[w.ax] = w.dir * (Math.PI / 2) * (k * k); m.position.y = w.y0 + Math.sin(k * Math.PI) * 0.25 - k * 0.15; if (w.t > 7) m.position.y -= (w.t - 7) * 0.4; if (w.t > 9) this.removeWreck(w); }
      else if (w.kind === 'veh') {
        if (w.tur) { w.tv.y -= 20 * dt; w.tur.position.addScaledVector(w.tv, dt); w.tur.rotation.x += w.ts.x * dt; w.tur.rotation.z += w.ts.z * dt; const wp = w.tur.getWorldPosition(TMPW = TMPW || new THREE.Vector3()); if (wp.y < heightAt(wp.x, wp.z) + 0.3 && w.tv.y < 0) { w.tv.set(0, 0, 0); w.ts.set(0, 0, 0); w.tur = null; } }
        const burn = w.t < 9, p = v3(m.position.x + rr(w.r * 0.5), m.position.y + 1, m.position.z + rr(w.r * 0.5));
        if (burn && Math.random() < dt * 14) this.spawn(true, p, { vel: v3(rr(0.3), 2 + Math.random(), rr(0.3)), life: 0.6, s0: 1.1, s1: 0.4, c0: 0xffd070, c1: 0xff2a00, vr: 2 });
        if (Math.random() < dt * (burn ? 8 : 3)) this.spawn(false, p, { vel: v3(0.4, 2.2, 0.2), life: 3.5, s0: 0.7, s1: burn ? 3.2 : 2, a: burn ? 0.7 : 0.35, c0: 0x161412, c1: 0x5d5850, drag: 0.3 });
        if (burn && Math.random() < dt * 2) this.flash(p, 0.6, 0.3, 0xff7020);
        if (w.t > 20) m.position.y -= dt * 0.5; if (w.t > 23) this.removeWreck(w);
      } else {
        const k = Math.min(1, w.t / 2.5); m.position.y = w.y0 - k * k * 3.2; m.rotation.z = w.dir * k * 0.12; m.rotation.x = k * 0.06;
        if (w.t < 2.5 && Math.random() < dt * 25) this.dust(m.position, w.r);
        if (w.t < 2.5 && Math.random() < dt * 10) this.chunk(v3(m.position.x + rr(w.r), w.y0 + 2, m.position.z + rr(w.r)), 1.5);
        if (Math.random() < dt * 5) this.spawn(false, v3(m.position.x + rr(w.r), w.y0 + 0.5, m.position.z + rr(w.r)), { vel: v3(0.4, 2, 0.2), life: 4, s0: 1, s1: 3.5, a: 0.5, c0: 0x1a1816, c1: 0x5d5850, drag: 0.3 });
        if (w.t > 14) this.removeWreck(w);
      }
    }
  }
}
let TMP_ = null; let TMPW = null; const ZERO = { x: 0, y: 0, z: 0 };
function v3(x, y, z) { return new THREE.Vector3(x, y, z); }
function rr(a) { return (Math.random() - 0.5) * 2 * a; }
