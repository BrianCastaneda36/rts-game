// Enemy commander: builds a base, manages production via the neural Brain, and launches varied attack waves.
import { THREE } from '../T.js';
import { Brain, STRATEGIES, PRODUCTS, FEATURES, sample } from './brain.js';
import { BUILD, UNIT } from '../defs.js';
const clamp01 = v => Math.max(0, Math.min(1, v));
const BUILD_ORDER = ['power', 'refinery', 'barracks', 'power', 'factory', 'refinery', 'power', 'barracks', 'factory', 'power'];

export class Commander {
  constructor(g, team) {
    this.g = g; this.team = team; this.brain = new Brain(); this.brain.load();
    const r = () => Math.random();
    this.traits = { aggression: 0.3 + r() * 0.6, caution: 0.2 + r() * 0.6, greed: 0.2 + r() * 0.6, chaos: r() };
    this.thinkT = 1.5; this.buildT = 1; this.waveT = 0; this.nextWave = 70 + r() * 50; this.waves = []; this.waveCount = 0;
    this.strategy = 'economy'; this.boIndex = 0; this.prev = { dealt: 0, taken: 0, earned: 0 }; this.thoughtHTML = ''; this.log = [];
  }
  // focus = nearest surviving opposing team (free-for-all with 2-4 players)
  get enemy() { return this.focus ?? ~this.team; }
  pickFocus() {
    const g = this.g, me = g.basePos(this.team); let best = null, bd = 1e9;
    for (let t = 0; t < g.teams.length; t++) { if (t === this.team || !g.teams[t].alive) continue; const b = g.basePos(t), d = Math.hypot(b.x - me.x, b.z - me.z) * (0.7 + Math.random() * 0.6); if (d < bd) { bd = d; best = t; } }
    this.focus = best;
  }
  features() {
    const g = this.g, t = this.team, mine = g.armyValue(t), theirs = g.armyValue(this.enemy), ratio = (mine + 100) / (theirs + 100), pw = g.power(t);
    return [clamp01(g.teams[t].credits / 3000), ratio / (ratio + 1), clamp01(g.threatNear(t) / 8), clamp01(g.countType(t, 'harvester') / 5), clamp01((pw.prod - pw.use + 100) / 200), clamp01(g.time / 900)];
  }
  update(dt) {
    if ((this.thinkT -= dt) <= 0) { this.think(); this.thinkT = 3 + Math.random() * 2.5; }
    if ((this.buildT -= dt) <= 0) { this.buildTick(); this.buildT = 2 + Math.random(); }
    if ((this.waveT -= dt) <= 0) { this.waveTick(); this.waveT = 1; }
  }
  think() {
    const g = this.g, tm = g.teams[this.team];
    if (this.focus == null || !g.teams[this.focus].alive || Math.random() < 0.1) this.pickFocus();
    const reward = Math.max(-3, Math.min(3, ((tm.dealt - this.prev.dealt) - (tm.taken - this.prev.taken)) / 400 + (tm.earned - this.prev.earned) / 1000));
    this.prev = { dealt: tm.dealt, taken: tm.taken, earned: tm.earned };
    const adv = this.brain.learn(reward);
    const f = this.features(), T = this.traits;
    const biasS = [(T.greed - 0.5), 0, (T.aggression - 0.5) * 1.2, (T.caution - 0.5), (T.aggression - 0.5) * 0.5];
    const biasP = [0, 0, (T.aggression - 0.5) * 0.5, (T.greed - 0.5) * 0.5];
    const temp = 0.6 + T.chaos * 0.8;
    const d = this.brain.decide(f, biasS, biasP, temp);
    this.decision = d; this.strategy = STRATEGIES[d.s];
    this.act(d);
    const top = (names, p) => names.map((n, i) => [n, p[i]]).sort((a, b) => b[1] - a[1]);
    const bars = (names, p, k) => top(names, p).slice(0, k).map(([n, v]) => `${n} ${(v * 100).toFixed(0)}%<span class="bar" style="width:${Math.round(v * 80)}px"></span>`).join('<br>');
    this.thoughtHTML = `<b>Thinking: ${this.strategy.toUpperCase()}</b> (T=${temp.toFixed(2)})<br>${bars(STRATEGIES, d.ps, 3)}<br>` +
      `<i>Production:</i> ${top(PRODUCTS, d.pp).map(([n, v]) => `${n} ${(v * 100).toFixed(0)}%`).join(', ')}<br>` +
      `<i>Inputs:</i> ${FEATURES.map((n, i) => `${n.split('_')[0]} ${f[i].toFixed(2)}`).join(' ')}<br>` +
      `reward ${reward.toFixed(2)} adv ${adv.toFixed(2)} · updates ${this.brain.updates}${this.brain.loaded ? ' (resumed)' : ''}<br>` +
      `waves sent ${this.waveCount}, active ${this.waves.length}, next in ${Math.max(0, this.nextWave - g.time).toFixed(0)}s · agg ${T.aggression.toFixed(2)} cau ${T.caution.toFixed(2)}`;
    this.log.push(`${g.time.toFixed(0)}s ${this.strategy}`); if (this.log.length > 50) this.log.shift();
  }
  idleArmy() { return this.g.units(this.team).filter(u => u.type !== 'harvester' && !u.wave); }
  produce(d, n) {
    const g = this.g, t = this.team;
    for (let i = 0; i < n; i++) {
      let k = sample(d.pp), type = PRODUCTS[k];
      const harv = g.countType(t, 'harvester'), refs = g.countType(t, 'refinery');
      if (type === 'harvester' && harv >= refs * 2) { type = 'tank'; k = 2; }
      if (!g.producer(t, UNIT[type].from)) { type = UNIT[type].from === 'factory' ? 'rifle' : 'tank'; k = PRODUCTS.indexOf(type); }
      if (g.teams[t].queues[UNIT[type].from].length >= 3) continue;
      if (g.enqueue(t, type)) this.brain.noteProduction(d, k);
    }
  }
  act(d) {
    const g = this.g, t = this.team, credits = g.teams[t].credits, army = this.idleArmy();
    const minWave = Math.min(14, 3 + Math.floor(g.time / 90));
    switch (this.strategy) {
      case 'economy':
        if (g.countType(t, 'harvester') < g.countType(t, 'refinery') * 2 && g.producer(t, 'factory') && g.enqueue(t, 'harvester')) this.brain.noteProduction(d, 3);
        if (credits > 1500) this.produce(d, 1);
        break;
      case 'build_army': this.produce(d, 1 + (Math.random() < 0.5 ? 1 : 0)); break;
      case 'attack':
        if (army.length >= Math.ceil(minWave * 0.6)) this.launchWave(army, minWave); else this.produce(d, 2);
        break;
      case 'defend': {
        const threat = g.threatNear(t), base = g.basePos(t);
        if (threat > 0) {
          for (const w of this.waves) if (Math.random() < 0.5) this.disband(w);
          for (const u of this.idleArmy()) { u.moveTo = new THREE.Vector3(base.x + (Math.random() - .5) * 20, 0, base.z + (Math.random() - .5) * 20); u.moveSet = g.time; u.attackMove = true; }
        }
        this.produce(d, 1);
        break;
      }
      case 'harass': {
        const raiders = army.filter(u => u.type === 'tank' || Math.random() < 0.3).slice(0, 2 + Math.floor(Math.random() * 2));
        const targets = g.units(this.enemy).filter(u => u.type === 'harvester');
        if (raiders.length >= 2 && targets.length) this.startWave(raiders, targets[Math.floor(Math.random() * targets.length)], false, 'harass');
        else this.produce(d, 1);
        break;
      }
    }
  }
  chooseTarget() {
    const g = this.g, o = this.enemy, all = g.entities.filter(e => !e.dead && g.match(e.team, o));
    const r = Math.random(), pick = arr => arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
    let t = null;
    if (r < 0.3) t = pick(all.filter(e => e.type === 'cy'));
    else if (r < 0.55) t = pick(all.filter(e => e.type === 'refinery'));
    else if (r < 0.75) t = pick(all.filter(e => e.type === 'harvester'));
    else if (r < 0.9) t = pick(all.filter(e => e.type === 'power'));
    return t || pick(all.filter(e => e.isBuilding)) || pick(all);
  }
  launchWave(army, minWave) {
    if (!army.length) return;
    army.sort(() => Math.random() - 0.5);
    const n = Math.min(army.length, minWave + Math.floor(Math.random() * 4));
    const target = this.chooseTarget(); if (!target) return;
    this.startWave(army.slice(0, n), target, n >= 4 && Math.random() < 0.35, 'assault');
    this.nextWave = this.g.time + (60 + Math.random() * 70) * Math.max(0.45, 1 - this.g.time / 1500);
  }
  startWave(units, target, split, kind) {
    const g = this.g, base = g.basePos(this.team);
    const mid = new THREE.Vector3().lerpVectors(base, target.pos, 0.55);
    let px = -(target.pos.z - base.z), pz = target.pos.x - base.x; const L = Math.hypot(px, pz) || 1; px /= L; pz /= L;
    const wp = s => new THREE.Vector3(Math.max(-85, Math.min(85, mid.x + px * 30 * s)), 0, Math.max(-85, Math.min(85, mid.z + pz * 30 * s)));
    const w = { kind, target, units: units.slice(), startN: units.length, state: 'march', groups: [], id: ++this.waveCount };
    if (split) { const h = Math.ceil(units.length / 2); w.groups.push({ units: units.slice(0, h), wp: wp(1) }, { units: units.slice(h), wp: wp(-1) }); w.split = true; }
    else w.groups.push({ units: units.slice(), wp: Math.random() < 0.25 ? wp(Math.random() < 0.5 ? 1 : -1) : null });
    for (const u of units) u.wave = w;
    this.waves.push(w);
    this.issue(w);
  }
  issue(w) {
    const g = this.g;
    for (const grp of w.groups) for (const u of grp.units) {
      if (u.dead) continue;
      const dest = grp.wp || w.target.pos;
      u.moveTo = new THREE.Vector3(dest.x + (Math.random() - .5) * 6, 0, dest.z + (Math.random() - .5) * 6); u.moveSet = g.time; u.attackMove = true;
      if (!grp.wp && d2(u.pos, w.target.pos) < 18) { u.target = w.target; u.chase = true; }
    }
  }
  removeFromWave(u) { const w = u.wave; if (!w) return; u.wave = null; w.units = w.units.filter(x => x !== u); for (const g of w.groups) g.units = g.units.filter(x => x !== u); }
  disband(w) { for (const u of w.units) { u.wave = null; } w.units = []; }
  waveTick() {
    const g = this.g;
    if (g.time >= this.nextWave) { const army = this.idleArmy(); if (army.length >= 3) this.launchWave(army, Math.min(14, 3 + Math.floor(g.time / 90))); else this.nextWave = g.time + 15; }
    for (const w of this.waves) {
      w.units = w.units.filter(u => !u.dead); for (const grp of w.groups) grp.units = grp.units.filter(u => !u.dead);
      if (!w.units.length) continue;
      const c = w.units.reduce((a, u) => (a.x += u.pos.x / w.units.length, a.z += u.pos.z / w.units.length, a), { x: 0, z: 0 });
      if (w.target.dead) {
        let best = null, bd = 1e9;
        for (const e of g.entities) if (!e.dead && e.team !== this.team) { const d = d2(e.pos, c) + (e.isBuilding ? 0 : 15); if (d < bd) { bd = d; best = e; } }
        if (!best) { this.disband(w); continue; }
        w.target = best; this.issue(w);
      }
      if (w.state === 'regroup') {
        if (g.time > w.regroupUntil) { w.state = 'march'; w.target = this.chooseTarget() || w.target; for (const grp of w.groups) grp.wp = null; this.issue(w); }
        continue;
      }
      // waypoint progress
      let reissue = false;
      for (const grp of w.groups) if (grp.wp && grp.units.filter(u => d2(u.pos, grp.wp) < 12).length >= grp.units.length * 0.5) { grp.wp = null; reissue = true; }
      // pull back to regroup when losing badly
      const alive = w.units.length / w.startN, local = g.countNear(c, 20, this.enemy, false) + 1;
      if ((alive < 0.45 || w.units.length / local < 0.5) && Math.random() < 0.3 * (0.5 + this.traits.caution)) {
        const base = g.basePos(this.team), rally = new THREE.Vector3().lerpVectors(base, c, 0.35);
        w.state = 'regroup'; w.regroupUntil = g.time + 12 + Math.random() * 10;
        for (const u of w.units) { u.target = null; u.moveTo = new THREE.Vector3(rally.x + (Math.random() - .5) * 8, 0, rally.z + (Math.random() - .5) * 8); u.moveSet = g.time; u.attackMove = false; }
        // reinforce the regrouping wave with idle units
        for (const u of this.idleArmy().slice(0, 4)) { u.wave = w; w.units.push(u); w.groups[0].units.push(u); u.moveTo = w.units[0].moveTo.clone(); u.moveSet = g.time; }
        continue;
      }
      if (reissue || Math.random() < 0.3) this.issue(w);
    }
    this.waves = this.waves.filter(w => w.units.length);
  }
  buildTick() {
    const g = this.g, t = this.team, cy = g.getCY(t); if (!cy) return;
    if (g.buildings(t).some(b => b.constructing)) return;
    const pw = g.power(t);
    let type = this.boIndex < BUILD_ORDER.length ? BUILD_ORDER[this.boIndex] : null;
    if (pw.prod - pw.use < 0) type = 'power';
    if (!type) {
      if (pw.prod - pw.use < 30) type = 'power';
      else if (Math.random() < 0.15 && g.countType(t, 'refinery') < 3) type = 'refinery';
      else if (Math.random() < 0.1 && g.countType(t, 'factory') < 3) type = 'factory';
      else return;
    }
    const reserve = this.strategy === 'build_army' ? 300 : 0;
    if (g.teams[t].credits < BUILD[type].cost + reserve || !g.reqMet(t, type)) return;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, r = 9 + Math.random() * 16;
      const x = cy.pos.x + Math.cos(a) * r, z = cy.pos.z + Math.sin(a) * r;
      if (g.placeBuilding(t, type, Math.round(x), Math.round(z))) { if (type === BUILD_ORDER[this.boIndex]) this.boIndex++; return; }
    }
  }
}
function d2(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
