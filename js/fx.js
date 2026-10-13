// Particle effects: fire/smoke billboards, debris, tracers, scorch decals. Pooled + shared geometry.
import { THREE } from './T.js';
import { softTex, flareTex, scorchTex } from './textures.js';
import { heightAt } from './terrain.js';

const MAXP = 700, MAXD = 160, MAXS = 70;
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
    // muzzle / explosion light (single pooled point light keeps cost bounded)
    this.flashLight = new THREE.PointLight(0xffaa55, 0, 18, 2); scene.add(this.flashLight); this.flashT = 0;
    this.emitAcc = new WeakMap();
  }
  spawn(add, pos, o) {
    const pool = add ? this.freeAdd : this.freeNorm; const p = pool.pop(); if (!p) return null;
    p.me.position.copy(pos); p.vel.copy(o.vel || ZERO); p.life = o.life; p.t = 0; p.s0 = o.s0; p.s1 = o.s1 ?? o.s0; p.a0 = o.a ?? 1;
    p.drag = o.drag ?? 1; p.grav = o.grav ?? 0; p.rot = Math.random() * 6.28; p.vr = (Math.random() - 0.5) * (o.vr ?? 1);
    p.c0.set(o.c0 ?? 0xffffff); p.c1.set(o.c1 ?? o.c0 ?? 0xffffff); p.me.visible = true; p.me.scale.setScalar(p.s0);
    this.live.push(p); return p;
  }
  muzzle(pos, dir, big) {
    const k = big ? 1 : 0.45;
    this.spawn(true, pos, { life: 0.08, s0: 1.4 * k, s1: 2.0 * k, c0: 0xfff1c0, c1: 0xff8a30 });
    for (let i = 0; i < (big ? 6 : 2); i++) this.spawn(false, pos, { vel: v3(dir.x * 3 + rr(1.5), 1 + rr(0.8), dir.z * 3 + rr(1.5)), life: 1.0 + Math.random(), s0: 0.4 * k, s1: 2.2 * k, a: 0.45, c0: 0xbbbbbb, c1: 0x888888, drag: 2 });
    this.flash(pos, big ? 3 : 1.2);
  }
  flash(pos, power) { this.flashLight.position.copy(pos); this.flashLight.position.y += 1; this.flashLight.intensity = Math.max(this.flashLight.intensity, power * 25); this.flashT = 0.12; }
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
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flashLight.intensity = 0; else this.flashLight.intensity *= Math.max(0, 1 - dt * 14); }
  }
}
let TMP_ = null; const ZERO = { x: 0, y: 0, z: 0 };
function v3(x, y, z) { return new THREE.Vector3(x, y, z); }
function rr(a) { return (Math.random() - 0.5) * 2 * a; }
