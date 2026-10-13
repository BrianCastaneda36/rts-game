import { THREE } from './T.js';
import { Terrain, heightAt, rayGround, BASES, ORE_FIELDS } from './terrain.js';
import { BUILD, UNIT, MULT } from './defs.js';
import { makeMesh, makeGhost, setGhostValid, makeOre, geo, mat } from './models.js';
import { FX } from './fx.js';
import { skyEnv } from './textures.js';
import { Commander } from './ai/commander.js';
import { makeTraits, decideUnit } from './ai/personality.js';
import { UI } from './ui.js';

let NEXT_ID = 1;
const tmp = new THREE.Vector3();
const PROJ = { bullet: { speed: 70, size: 0.15, color: 0xffee88, boom: 0.6 }, rocket: { speed: 28, size: 0.3, color: 0xff8833, boom: 1.6 }, shell: { speed: 45, size: 0.3, color: 0xffcc55, boom: 1.4 } };
export const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class Game {
  constructor(renderer, rendererName) {
    this.renderer = renderer; this.rendererName = rendererName;
    const scene = this.scene = new THREE.Scene();
    // renderer: ACES tone mapping, sRGB output, soft shadows (works for WebGL and WebGPURenderer)
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const fogCol = new THREE.Color(0xb7cde0);
    scene.background = fogCol; scene.fog = new THREE.Fog(fogCol, 140, 330);
    scene.environment = skyEnv(); if ('environmentIntensity' in scene) scene.environmentIntensity = 0.45;
    scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x5a5a40, 0.9));
    const sun = this.sun = new THREE.DirectionalLight(0xfff1dc, 3.0); sun.position.set(60, 110, 40);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
    Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 320 }); sun.shadow.camera.updateProjectionMatrix();
    scene.add(sun); scene.add(sun.target);
    this.fx = new FX(scene);
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 1200);
    this.camTarget = new THREE.Vector3(BASES[0].x + 12, 0, BASES[0].z - 12); this.camDist = 65;
    this.terrain = new Terrain(scene);
    this.entities = []; this.ore = []; this.projectiles = []; this.effects = [];
    this.teams = [0, 1].map(() => ({ credits: 2500, dealt: 0, taken: 0, earned: 0, queues: { barracks: [], factory: [] } }));
    this.time = 0; this.selected = new Set(); this.placing = null; this.ghost = null; this.over = false;
    this.keys = {}; this.mouse = { x: 0, y: 0, inside: false }; this.drag = null;
    this.raycaster = new THREE.Raycaster(); this.last = performance.now(); this.winT = 0;
    this.spawnOre(); this.setupBases();
    this.commander = new Commander(this, 1);
    this.ui = new UI(this);
    this.bindInput();
    window.addEventListener('resize', () => this.resize()); this.resize();
  }

  // ---------- setup ----------
  spawnOre() {
    const g = geo();
    for (const f of ORE_FIELDS) for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 8;
      const x = f.x + Math.cos(a) * rr, z = f.z + Math.sin(a) * rr;
      const m = makeOre(this.ore.length); m.position.set(x, heightAt(x, z) - 0.05, z);
      m.rotation.set(0, Math.random() * 6.28, 0); this.scene.add(m);
      this.ore.push({ pos: m.position, amount: 500, max: 500, mesh: m });
    }
  }
  setupBases() {
    BASES.forEach((b, t) => {
      this.createBuilding(t, 'cy', b.x, b.z, false);
      const dx = -Math.sign(b.x), dz = -Math.sign(b.z);
      for (let i = 0; i < 3; i++) this.createUnit(t, 'rifle', b.x + dx * 9 + i * 1.5, b.z + dz * 7);
      for (let i = 0; i < 2; i++) this.createUnit(t, 'tank', b.x + dx * 12 + i * 3, b.z + dz * 11);
    });
  }
  createBuilding(team, type, x, z, constructing) {
    const def = BUILD[type], mesh = makeMesh(type, team, def.r);
    mesh.position.set(x, heightAt(x, z), z); this.scene.add(mesh);
    const e = { id: NEXT_ID++, team, type, def, isBuilding: true, pos: mesh.position, hp: constructing ? def.hp * 0.2 : def.hp, maxHp: def.hp, r: def.r, mesh, constructing, progress: constructing ? 0 : 1, dead: false };
    if (constructing) mesh.scale.y = 0.1;
    this.entities.push(e); return e;
  }
  createUnit(team, type, x, z) {
    const def = UNIT[type], mesh = makeMesh(type, team, def.r);
    mesh.position.set(x, heightAt(x, z), z); this.scene.add(mesh);
    const e = { id: NEXT_ID++, team, type, def, isBuilding: false, pos: mesh.position, hp: def.hp, maxHp: def.hp, r: def.r, mesh, dead: false,
      target: null, moveTo: null, moveSet: 0, attackMove: false, chase: false, cd: Math.random(), traits: makeTraits(),
      nextThink: this.time + 1 + Math.random() * 2, orderTime: -99, mood: 'idle', cargo: 0, hstate: 'toOre', wave: null, oreTarget: null };
    this.entities.push(e); return e;
  }

  // ---------- queries ----------
  edist(u, t) { return d2(u.pos, t.pos) - (t.r || 0); }
  getCY(t) { return this.entities.find(e => !e.dead && e.team === t && e.type === 'cy'); }
  basePos(t) { const c = this.getCY(t); return c ? c.pos : new THREE.Vector3(BASES[t].x, 0, BASES[t].z); }
  has(t, type) { return this.entities.some(e => !e.dead && e.team === t && e.type === type && !e.constructing); }
  producer(t, kind) { return this.entities.find(e => !e.dead && e.team === t && e.type === kind && !e.constructing); }
  units(t) { return this.entities.filter(e => !e.dead && !e.isBuilding && e.team === t); }
  buildings(t) { return this.entities.filter(e => !e.dead && e.isBuilding && e.team === t); }
  countType(t, type) { return this.entities.filter(e => !e.dead && e.team === t && e.type === type).length; }
  power(t) { let prod = 0, use = 0; for (const e of this.entities) if (!e.dead && e.isBuilding && e.team === t && !e.constructing) { if (e.def.power > 0) prod += e.def.power; else use -= e.def.power; } return { prod, use }; }
  armyValue(t) { let v = 0; for (const e of this.entities) if (!e.dead && !e.isBuilding && e.team === t && e.type !== 'harvester') v += e.def.cost * e.hp / e.maxHp; return v; }
  countNear(p, rad, team, bld = false) { let n = 0; for (const e of this.entities) if (!e.dead && e.team === team && (bld || !e.isBuilding) && e.type !== 'harvester' && d2(e.pos, p) < rad) n++; return n; }
  threatNear(t) { return this.countNear(this.basePos(t), 35, 1 - t); }
  nearestEnemy(u, range) {
    let best = null, bd = 1e9;
    for (const e of this.entities) {
      if (e.dead || e.team === u.team) continue;
      const d = this.edist(u, e) + (e.isBuilding ? 4 : 0);
      if (d < range + (e.isBuilding ? 4 : 0) && d < bd) { bd = d; best = e; }
    }
    return best;
  }
  nearestOre(p, maxD = 1e9) { let best = null, bd = maxD; for (const o of this.ore) if (o.amount > 0) { const d = d2(o.pos, p); if (d < bd) { bd = d; best = o; } } return best; }
  nearestRefinery(u) { let best = null, bd = 1e9; for (const e of this.entities) if (!e.dead && e.team === u.team && e.type === 'refinery' && !e.constructing) { const d = d2(e.pos, u.pos); if (d < bd) { bd = d; best = e; } } return best; }

  // ---------- economy / production ----------
  reqMet(t, type) { const r = BUILD[type].req; return !r || this.has(t, r); }
  canPlace(team, type, x, z) {
    const r = BUILD[type].r;
    if (Math.abs(x) > 84 || Math.abs(z) > 84 || !this.getCY(team)) return false;
    let near = false;
    for (const e of this.entities) {
      if (e.dead) continue;
      const d = Math.hypot(e.pos.x - x, e.pos.z - z);
      if (d < e.r + r + (e.isBuilding ? 1.2 : 0.2)) return false;
      if (e.isBuilding && e.team === team && d - e.r - r < 14) near = true;
    }
    if (!near) return false;
    for (const o of this.ore) if (o.amount > 0 && Math.hypot(o.pos.x - x, o.pos.z - z) < r + 1.5) return false;
    const h0 = heightAt(x, z);
    for (const [ax, az] of [[r, r], [-r, r], [r, -r], [-r, -r]]) if (Math.abs(heightAt(x + ax, z + az) - h0) > 1.8) return false;
    return true;
  }
  placeBuilding(team, type, x, z) {
    const def = BUILD[type], tm = this.teams[team];
    if (tm.credits < def.cost || !this.reqMet(team, type) || !this.canPlace(team, type, x, z)) return null;
    tm.credits -= def.cost; return this.createBuilding(team, type, x, z, true);
  }
  enqueue(team, type) {
    const def = UNIT[type], tm = this.teams[team];
    if (tm.credits < def.cost || !this.producer(team, def.from) || tm.queues[def.from].length >= 8) return false;
    tm.credits -= def.cost; tm.queues[def.from].push({ type, t: 0 }); return true;
  }
  cancel(team, type) {
    const q = this.teams[team].queues[UNIT[type].from];
    for (let i = q.length - 1; i >= 0; i--) if (q[i].type === type) { q.splice(i, 1); this.teams[team].credits += UNIT[type].cost; return; }
  }
  spawnFrom(b, type) {
    let dx = -b.pos.x, dz = -b.pos.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const sx = b.pos.x + dx * (b.r + 1.6), sz = b.pos.z + dz * (b.r + 1.6);
    const u = this.createUnit(b.team, type, sx, sz);
    if (type !== 'harvester') { u.moveTo = new THREE.Vector3(sx + dx * 6 + (Math.random() - 0.5) * 6, 0, sz + dz * 6 + (Math.random() - 0.5) * 6); u.moveSet = this.time; }
    return u;
  }
  updateProduction(dt) {
    for (let t = 0; t < 2; t++) {
      const pw = this.power(t), mult = pw.prod >= pw.use ? 1 : 0.5;
      for (const k of ['barracks', 'factory']) {
        const q = this.teams[t].queues[k]; if (!q.length) continue;
        const b = this.producer(t, k); if (!b) continue;
        q[0].t += dt * mult;
        if (q[0].t >= UNIT[q[0].type].time) this.spawnFrom(b, q.shift().type);
      }
    }
  }

  // ---------- simulation ----------
  updateBuilding(b, dt) {
    if (!b.constructing) return;
    b.progress += dt / b.def.time; b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.8 * dt / b.def.time);
    b.mesh.scale.y = 0.1 + 0.9 * Math.min(1, b.progress);
    if (b.progress >= 1) { b.constructing = false; b.mesh.scale.y = 1; if (b.type === 'refinery') this.spawnFrom(b, 'harvester'); }
  }
  moveToward(u, p, dt, ignore) {
    let dx = p.x - u.pos.x, dz = p.z - u.pos.z; let L = Math.hypot(dx, dz); if (L < 0.01) return; dx /= L; dz /= L;
    for (const b of this.entities) {
      if (!b.isBuilding || b.dead || b === ignore || b === u.target) continue;
      const bx = b.pos.x - u.pos.x, bz = b.pos.z - u.pos.z, bd = Math.hypot(bx, bz), R = b.r + u.r + 2;
      if (bd < R && bd > 0.01 && (bx * dx + bz * dz) / bd > 0.2) {
        let px = -bz / bd, pz = bx / bd; if (px * dx + pz * dz < 0) { px = -px; pz = -pz; }
        const w = 2 * (R - bd) / R + 0.5; dx += px * w; dz += pz * w;
      }
    }
    L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const sp = u.def.speed * dt;
    u.pos.x = Math.max(-92, Math.min(92, u.pos.x + dx * sp)); u.pos.z = Math.max(-92, Math.min(92, u.pos.z + dz * sp));
    this.faceDir(u, dx, dz, dt);
  }
  faceDir(u, dx, dz, dt) {
    const want = Math.atan2(dx, dz); let cur = u.mesh.rotation.y, diff = want - cur;
    while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    u.mesh.rotation.y = cur + diff * Math.min(1, dt * 8);
  }
  updateUnit(u, dt) {
    if (u.type === 'harvester') return this.updateHarvester(u, dt);
    const d = u.def; u.cd -= dt;
    if (u.target && u.target.dead) u.target = null;
    if (!u.target && (!u.moveTo || u.attackMove)) { const e = this.nearestEnemy(u, d.range + 3); if (e) { u.target = e; u.chase = false; } }
    if (u.target) {
      const ed = this.edist(u, u.target);
      if (!u.chase && ed > d.range + 8) u.target = null;
      else if (ed > d.range) this.moveToward(u, u.target.pos, dt);
      else {
        this.faceDir(u, u.target.pos.x - u.pos.x, u.target.pos.z - u.pos.z, dt);
        if (u.cd <= 0) { this.fire(u, u.target); u.cd = d.rof * (0.85 + Math.random() * 0.3); }
      }
    } else if (u.moveTo) {
      if (d2(u.pos, u.moveTo) < 1.2 || this.time - u.moveSet > 40) { u.moveTo = null; u.attackMove = false; }
      else this.moveToward(u, u.moveTo, dt);
    }
  }
  updateHarvester(u, dt) {
    if (u.moveTo) { if (d2(u.pos, u.moveTo) < 1.5 || this.time - u.moveSet > 40) u.moveTo = null; else { this.moveToward(u, u.moveTo, dt); return; } }
    const cap = u.def.cap, tm = this.teams[u.team];
    switch (u.hstate) {
      case 'toOre': {
        if (u.cargo >= cap) { u.hstate = 'toRef'; break; }
        let n = u.oreTarget; if (!n || n.amount <= 0) n = u.oreTarget = this.nearestOre(u.pos);
        if (!n) { u.mood = 'no ore left'; if (u.cargo > 0) u.hstate = 'toRef'; return; }
        u.mood = 'to ore';
        if (d2(u.pos, n.pos) > 2.2) this.moveToward(u, n.pos, dt); else u.hstate = 'harvest';
        break;
      }
      case 'harvest': {
        const n = u.oreTarget; u.mood = 'harvesting';
        if (!n || n.amount <= 0) { u.hstate = 'toOre'; break; }
        const take = Math.min(35 * dt, n.amount, cap - u.cargo); n.amount -= take; u.cargo += take;
        n.mesh.scale.setScalar(0.4 + 0.6 * n.amount / n.max); n.mesh.rotation.y += dt;
        if (n.amount <= 0) { this.scene.remove(n.mesh); this.ore = this.ore.filter(o => o !== n); }
        if (u.cargo >= cap - 0.01) u.hstate = 'toRef';
        break;
      }
      case 'toRef': {
        const r = this.nearestRefinery(u); if (!r) { u.mood = 'no refinery'; return; }
        u.mood = 'returning';
        if (this.edist(u, r) > 1.8) this.moveToward(u, r.pos, dt, r); else u.hstate = 'unload';
        break;
      }
      case 'unload': {
        u.mood = 'unloading';
        const a = Math.min(u.cargo, 150 * dt); u.cargo -= a; tm.credits += a; tm.earned += a;
        if (u.cargo <= 0.01) { u.cargo = 0; u.hstate = 'toOre'; }
        break;
      }
    }
  }
  separate() {
    const us = this.entities.filter(e => !e.dead && !e.isBuilding), bs = this.entities.filter(e => !e.dead && e.isBuilding);
    for (let i = 0; i < us.length; i++) {
      const a = us[i];
      for (let j = i + 1; j < us.length; j++) {
        const b = us[j], dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, dd = Math.hypot(dx, dz), m = a.r + b.r;
        if (dd < m && dd > 0.001) { const p = (m - dd) / dd * 0.5; a.pos.x -= dx * p; a.pos.z -= dz * p; b.pos.x += dx * p; b.pos.z += dz * p; }
      }
      for (const b of bs) {
        const dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z, dd = Math.hypot(dx, dz), m = a.r + b.r;
        if (dd < m && dd > 0.001) { a.pos.x = b.pos.x + dx / dd * m; a.pos.z = b.pos.z + dz / dd * m; }
      }
      a.pos.y = heightAt(a.pos.x, a.pos.z);
    }
  }
  fire(u, t) {
    const P = PROJ[u.def.weapon];
    const m = this.makeProjectile(u.def.weapon);
    const f = u.def.muzzle || 1; m.position.set(u.pos.x, u.pos.y + f, u.pos.z);
    const ud = u.mesh.userData;
    if (ud.muzzle) { u.mesh.updateMatrixWorld(true); ud.muzzle.getWorldPosition(m.position); }
    ud.recoil = 1; this.scene.add(m);
    this.projectiles.push({ mesh: m, target: t, attacker: u, team: u.team, dmg: u.def.dmg, weapon: u.def.weapon, P, aim: t.pos.clone() });
    const dir = new THREE.Vector3(t.pos.x - u.pos.x, 0, t.pos.z - u.pos.z).normalize();
    this.fx.muzzle(m.position, dir, u.def.weapon !== 'bullet');
  }
  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (!p.target.dead) p.aim.set(p.target.pos.x, p.target.pos.y + (p.target.isBuilding ? 1.5 : 0.6), p.target.pos.z);
      const pos = p.mesh.position; tmp.subVectors(p.aim, pos); const L = tmp.length(), step = p.P.speed * dt;
      if (p.weapon === 'rocket') p.mesh.position.y += Math.sin(this.time * 30) * 0.05;
      if (L > 0.01) p.mesh.lookAt(p.aim);
      if (p.weapon !== 'bullet') { p.tr = (p.tr || 0) + dt; if (p.tr > 0.025) { p.tr = 0; this.fx.trail(pos, p.weapon === 'rocket'); } }
      if (L <= step) {
        p.done = true; this.scene.remove(p.mesh);
        if (p.weapon === 'bullet') this.fx.explosion(p.aim, 0.25, { scorch: false }); else this.fx.explosion(p.aim, p.P.boom * 0.7, { debris: 2 });
        if (!p.target.dead) {
          const arm = p.target.isBuilding ? 'bld' : p.target.def.armor;
          this.damage(p.target, p.dmg * MULT[p.weapon][arm] * (0.8 + Math.random() * 0.4), p.attacker, p.team);
        }
      } else pos.addScaledVector(tmp, step / L);
    }
    this.projectiles = this.projectiles.filter(p => !p.done);
  }
  damage(t, amt, attacker, team) {
    if (t.dead) return;
    t.hp -= amt; this.teams[team].dealt += amt; this.teams[t.team].taken += amt; t.lastHit = this.time;
    if (!t.isBuilding && t.type !== 'harvester' && !t.target && attacker && !attacker.dead && (t.team === 1 || this.time - t.orderTime > 3)) { t.target = attacker; t.chase = false; }
    if (t.hp <= 0) this.kill(t);
  }
  kill(e) {
    e.dead = true; this.scene.remove(e.mesh); this.selected.delete(e);
    const veh = !e.isBuilding && e.def.armor === 'veh';
    this.fx.explosion(e.pos, e.isBuilding ? e.r * 0.9 : (veh ? 1.8 : 0.6), { debris: e.isBuilding ? 24 : veh ? 12 : 0 });
    if (e.isBuilding) for (let i = 0; i < 5; i++) this.fx.explosion(new THREE.Vector3(e.pos.x + (Math.random() - .5) * e.r * 2, e.pos.y + 1, e.pos.z + (Math.random() - .5) * e.r * 2), 1.6, { debris: 3 });
    if (e.wave) this.commander.removeFromWave(e);
  }
  makeProjectile(w) {
    if (!this.projGeo) {
      const g = geo();
      this.projGeo = {
        bullet: [new THREE.BoxGeometry(0.06, 0.06, 1.6), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })],
        shell: [g.sph, new THREE.MeshBasicMaterial({ color: 0xffd27a })],
        rocket: [new THREE.CylinderGeometry(0.07, 0.07, 0.7, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6b6f5a, roughness: 0.5, metalness: 0.5 })],
      };
    }
    const [gg, mm] = this.projGeo[w], m = new THREE.Mesh(gg, mm);
    if (w === 'shell') m.scale.set(0.22, 0.22, 0.6);
    return m;
  }
  effect(p, size, color, life) {
    const m = new THREE.Mesh(geo().ring, mat(color, true, 0.75)); m.rotation.x = -Math.PI / 2; m.position.set(p.x, heightAt(p.x, p.z) + 0.25, p.z); m.scale.setScalar(0.01); this.scene.add(m);
    this.effects.push({ mesh: m, size, life, t: 0 });
  }
  updateEffects(dt) {
    for (const f of this.effects) { f.t += dt; const k = f.t / f.life; f.mesh.scale.setScalar(Math.max(0.01, f.size * (0.3 + 0.7 * k))); if (k >= 1) { f.done = true; this.scene.remove(f.mesh); } }
    this.effects = this.effects.filter(f => !f.done);
  }
  checkWin() {
    for (let t = 0; t < 2; t++) {
      if (!this.getCY(t) && !this.entities.some(e => !e.dead && !e.isBuilding && e.team === t)) {
        this.over = true; this.commander.brain.save(); this.ui.showEnd(t === 1); return;
      }
    }
  }
  update(dt) {
    this.time += dt;
    for (const e of this.entities) if (!e.dead) { if (e.isBuilding) this.updateBuilding(e, dt); else this.updateUnit(e, dt); }
    this.separate();
    this.updateProduction(dt); this.updateProjectiles(dt); this.updateEffects(dt);
    for (const e of this.entities) if (!e.dead && !e.isBuilding && this.time >= e.nextThink) { decideUnit(this, e); e.nextThink = this.time + 1.5 + Math.random() * 1.5; }
    this.commander.update(dt);
    this.entities = this.entities.filter(e => !e.dead);
    if ((this.winT += dt) > 1) { this.winT = 0; this.checkWin(); }
  }
  frame() {
    const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (!this.over) this.update(dt); else this.updateEffects(dt);
    this.updateCamera(dt); this.updateGhost(); this.updateVisuals(dt);
    this.renderer.render(this.scene, this.camera);
    this.ui.update(dt); this.ui.drawOverlay();
  }

  // ---------- visuals only (no gameplay state is touched here) ----------
  updateVisuals(dt) {
    const vt = (this.vt = (this.vt || 0) + dt), fx = this.fx;
    for (const e of this.entities) {
      if (e.dead) continue;
      const ud = e.mesh.userData, lp = ud.lp || (ud.lp = e.pos.clone());
      const sp = dt > 0 ? Math.hypot(e.pos.x - lp.x, e.pos.z - lp.z) / dt : 0; lp.copy(e.pos);
      ud.spd = (ud.spd || 0) + (sp - (ud.spd || 0)) * Math.min(1, dt * 10);
      if (ud.animate) ud.animate(dt, { t: vt, speed: ud.spd, e });
      if (e.isBuilding && e.constructing) { if (Math.random() < dt * 10) fx.dust(e.pos, e.r); if (Math.random() < dt * 8) fx.spark(e.pos, e.r * 0.8); }
      else if (ud.smoke && ud.smoke.length) fx.emit(e.mesh, ud.smoke, dt, e.type === 'harvester' ? 0.4 + Math.min(1, ud.spd / 3) : 1);
      if (!e.isBuilding && e.def.armor === 'veh' && ud.spd > 1 && Math.random() < dt * 6) fx.dust(e.pos, 0.6);
      // damaged things smoke & burn
      if (e.hp < e.maxHp * 0.5 && !e.constructing && Math.random() < dt * (e.isBuilding ? 6 : 3)) {
        const p = new THREE.Vector3(e.pos.x + (Math.random() - .5) * e.r, e.pos.y + (e.isBuilding ? 2.5 : 1), e.pos.z + (Math.random() - .5) * e.r);
        fx.spawn(false, p, { vel: new THREE.Vector3(0.3, 2, 0.2), life: 2.5, s0: 0.6, s1: 2.6, a: 0.6, c0: 0x222222, c1: 0x555555, drag: 0.3 });
        if (e.hp < e.maxHp * 0.25) fx.spawn(true, p, { vel: new THREE.Vector3(0, 1.5, 0), life: 0.5, s0: 0.8, s1: 0.3, c0: 0xffc060, c1: 0xff3000 });
      }
    }
    for (const o of this.ore) o.mesh.children[1] && (o.mesh.children[1].material.opacity = 0.45 + 0.15 * Math.sin(vt * 2));
    this.terrain.update(dt, vt);
    fx.update(dt, this.camera);
    // keep the shadow frustum centred on the view
    const t = this.camTarget; this.sun.position.set(t.x + 60, 110, t.z + 40); this.sun.target.position.set(t.x, 0, t.z);
    const ext = Math.min(110, 30 + this.camDist * 0.9); const sc = this.sun.shadow.camera;
    if (sc.right !== ext) { sc.left = sc.bottom = -ext; sc.right = sc.top = ext; sc.updateProjectionMatrix(); }
  }

  // ---------- camera & input ----------
  updateCamera(dt) {
    let px = 0, pz = 0; const k = this.keys, m = this.mouse;
    if (k.KeyA || k.ArrowLeft) px--; if (k.KeyD || k.ArrowRight) px++; if (k.KeyW || k.ArrowUp) pz--; if (k.KeyS || k.ArrowDown) pz++;
    if (m.inside && !this.drag) { if (m.x < 10) px--; if (m.x > innerWidth - 10) px++; if (m.y < 10) pz--; if (m.y > innerHeight - 10) pz++; }
    const sp = this.camDist * 0.9 * dt, t = this.camTarget;
    t.x = Math.max(-95, Math.min(95, t.x + px * sp)); t.z = Math.max(-95, Math.min(95, t.z + pz * sp));
    const pitch = 0.95; this.camera.position.set(t.x, 1 + this.camDist * Math.sin(pitch), t.z + this.camDist * Math.cos(pitch));
    this.camera.lookAt(t.x, 1, t.z);
  }
  resize() { this.renderer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.ui.resize(); }
  groundAt(sx, sy) { this.raycaster.setFromCamera(new THREE.Vector2(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1), this.camera); return rayGround(this.raycaster.ray); }
  project(v, yOff = 0) { tmp.set(v.x, v.y + yOff, v.z).project(this.camera); return { x: (tmp.x + 1) / 2 * innerWidth, y: (1 - tmp.y) / 2 * innerHeight, z: tmp.z }; }
  pick(sx, sy) {
    const g = this.groundAt(sx, sy); let best = null, bd = 1e9;
    for (const e of this.entities) {
      if (e.dead) continue;
      if (e.isBuilding) { if (g && d2(g, e.pos) < e.r && 10 < bd) { bd = 10; best = e; } }
      else { const p = this.project(e.pos, 0.8), d = Math.hypot(p.x - sx, p.y - sy); if (d < 16 + e.r * 6 && d < bd) { bd = d; best = e; } }
    }
    return best;
  }
  setSel(list, add) {
    if (!add) { for (const e of this.selected) e.mesh.userData.ring.visible = false; this.selected.clear(); }
    for (const e of list) { this.selected.add(e); e.mesh.userData.ring.visible = true; }
  }
  startPlacing(type) {
    if (this.teams[0].credits < BUILD[type].cost || !this.reqMet(0, type) || !this.getCY(0)) return;
    this.cancelPlacing(); this.placing = type; this.ghost = makeGhost(type); this.scene.add(this.ghost);
  }
  cancelPlacing() { if (this.ghost) this.scene.remove(this.ghost); this.ghost = null; this.placing = null; }
  updateGhost() {
    if (!this.ghost) return;
    const g = this.groundAt(this.mouse.x, this.mouse.y); if (!g) return;
    g.x = Math.round(g.x * 2) / 2; g.z = Math.round(g.z * 2) / 2;
    this.ghost.position.set(g.x, heightAt(g.x, g.z), g.z);
    this.ghostOk = this.canPlace(0, this.placing, g.x, g.z) && this.teams[0].credits >= BUILD[this.placing].cost;
    setGhostValid(this.ghost, this.ghostOk);
  }
  tryPlace() {
    const p = this.ghost.position;
    if (this.placeBuilding(0, this.placing, p.x, p.z)) this.cancelPlacing();
  }
  orderAt(sx, sy, groundOverride) {
    const sel = [...this.selected].filter(e => !e.dead && !e.isBuilding && e.team === 0); if (!sel.length) return;
    const ent = groundOverride ? null : this.pick(sx, sy), g = groundOverride || this.groundAt(sx, sy);
    if (ent && ent.team === 1) {
      for (const u of sel) if (u.type !== 'harvester') { u.target = ent; u.chase = true; u.moveTo = null; u.orderTime = this.time; u.mood = 'ordered: attack'; }
      this.effect(ent.pos, 1.5, 0xff2222, 0.3); return;
    }
    if (!g) return;
    const ore = this.nearestOre(g, 4); let movers = sel;
    if (ore) { movers = sel.filter(u => u.type !== 'harvester'); for (const u of sel) if (u.type === 'harvester') { u.oreTarget = ore; u.hstate = 'toOre'; u.moveTo = null; } }
    const n = movers.length, cols = Math.ceil(Math.sqrt(n));
    movers.forEach((u, i) => {
      const ox = (i % cols - (cols - 1) / 2) * 2.4, oz = (Math.floor(i / cols) - (cols - 1) / 2) * 2.4;
      u.moveTo = new THREE.Vector3(g.x + ox, 0, g.z + oz); u.moveSet = this.time; u.target = null; u.attackMove = false; u.chase = false;
      u.orderTime = this.time; u.mood = 'ordered: move';
    });
    this.effect(g, 1, 0x33ff66, 0.3);
  }
  bindInput() {
    const c = this.renderer.domElement;
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('mousedown', e => {
      if (this.over) return;
      if (e.button === 0) { if (this.placing) { this.tryPlace(); return; } this.drag = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, shift: e.shiftKey }; }
      else if (e.button === 2) { if (this.placing) this.cancelPlacing(); else this.orderAt(e.clientX, e.clientY); }
    });
    window.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true; if (this.drag) { this.drag.x1 = e.clientX; this.drag.y1 = e.clientY; } });
    document.documentElement.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    window.addEventListener('mouseup', e => {
      if (e.button !== 0 || !this.drag) return;
      const d = this.drag; this.drag = null;
      if (Math.abs(d.x1 - d.x0) < 6 && Math.abs(d.y1 - d.y0) < 6) {
        const ent = this.pick(d.x1, d.y1);
        this.setSel(ent && ent.team === 0 ? [ent] : [], d.shift);
      } else {
        const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
        this.setSel(this.units(0).filter(u => { const p = this.project(u.pos, 0.5); return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1; }), d.shift);
      }
    });
    c.addEventListener('wheel', e => { e.preventDefault(); this.camDist = Math.max(22, Math.min(140, this.camDist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code.startsWith('Arrow')) e.preventDefault();
      if (e.code === 'Escape') { this.cancelPlacing(); this.setSel([], false); }
      if (e.code === 'KeyH') { const b = this.basePos(0); this.camTarget.set(b.x, 0, b.z); }
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
  }
}
