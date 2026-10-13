// Local on-device "brain": a tiny hand-rolled feedforward network (no libraries, no network).
// features -> tanh hidden layer -> two softmax heads (strategy, production).
// Learns online with REINFORCE (policy gradient with a running-average baseline).
export const FEATURES = ['credits', 'strength_ratio', 'threat_near_base', 'harvesters', 'power', 'elapsed'];
export const STRATEGIES = ['economy', 'build_army', 'attack', 'defend', 'harass'];
export const PRODUCTS = ['rifle', 'rocket', 'tank', 'harvester'];
const KEY = 'rts-brain-v1';
const randn = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random());
export function softmax(z, temp = 1) { const m = Math.max(...z); const e = z.map(v => Math.exp((v - m) / temp)); const s = e.reduce((a, b) => a + b, 0); return e.map(v => v / s); }
export function sample(p) { let r = Math.random(), acc = 0; for (let i = 0; i < p.length; i++) { acc += p[i]; if (r <= acc) return i; } return p.length - 1; }

// Prior output weights over the first 6 "feature detector" hidden units.
//                 credits ratio threat harv  power  time
const PRIOR_S = [[-0.5,  0.0, -0.8, -1.8,  0.3, -0.6],  // economy
                 [ 1.2, -1.0,  0.3,  0.4,  0.0,  0.3],  // build_army
                 [ 0.3,  2.2, -1.2,  0.2,  0.0,  0.9],  // attack
                 [ 0.0, -0.6,  2.8,  0.0,  0.0,  0.0],  // defend
                 [ 0.0,  0.6, -0.6,  0.0,  0.0,  0.3]]; // harass
const PRIOR_P = [[-0.6,  0.0,  0.6,  0.0,  0.0, -0.6],  // rifle
                 [ 0.0, -0.3,  0.4,  0.0,  0.0,  0.3],  // rocket
                 [ 1.0,  0.3,  0.0,  0.3,  0.0,  0.7],  // tank
                 [ 0.0,  0.0, -0.6, -2.2,  0.0, -0.3]]; // harvester

export class Brain {
  constructor() {
    this.nIn = FEATURES.length + 1; this.nH = 12; this.lr = 0.04; this.baseline = 0; this.updates = 0; this.lastReward = 0;
    this.W1 = []; for (let i = 0; i < this.nH; i++) { const r = []; for (let j = 0; j < this.nIn; j++) r.push(randn() * 0.3); this.W1.push(r); }
    for (let i = 0; i < FEATURES.length; i++) { this.W1[i].fill(0); this.W1[i][i] = 3; this.W1[i][this.nIn - 1] = -1.5; } // tanh(3x-1.5): centered detectors
    const out = (prior) => prior.map(row => { const r = row.slice(); for (let j = row.length; j < this.nH; j++) r.push(randn() * 0.1); return r; });
    this.Ws = out(PRIOR_S); this.bs = new Array(STRATEGIES.length).fill(0);
    this.Wp = out(PRIOR_P); this.bp = new Array(PRODUCTS.length).fill(0); this.bp[2] = 0.3;
    this.lastS = null; this.lastP = [];
  }
  forward(f) {
    const x = [...f, 1];
    const h = this.W1.map(r => Math.tanh(r.reduce((s, w, j) => s + w * x[j], 0)));
    const lin = (W, b) => W.map((r, i) => r.reduce((s, w, j) => s + w * h[j], b[i]));
    return { x, h, ls: lin(this.Ws, this.bs), lp: lin(this.Wp, this.bp) };
  }
  // bias: arrays added to logits (personality blending); temp: sampling temperature
  decide(f, biasS, biasP, temp) {
    const o = this.forward(f);
    const ps = softmax(o.ls.map((v, i) => v + (biasS[i] || 0)), temp);
    const pp = softmax(o.lp.map((v, i) => v + (biasP[i] || 0)), temp);
    const s = sample(ps);
    this.lastS = { x: o.x, h: o.h, p: ps, a: s };
    return { ps, pp, s, x: o.x, h: o.h };
  }
  noteProduction(d, k) { this.lastP.push({ x: d.x, h: d.h, p: d.pp, a: k }); if (this.lastP.length > 6) this.lastP.shift(); }
  step(rec, W, b, adv) {
    const g = rec.p.map((p, i) => ((i === rec.a ? 1 : 0) - p) * adv);
    const dh = new Array(this.nH).fill(0);
    for (let i = 0; i < W.length; i++) for (let j = 0; j < this.nH; j++) { dh[j] += W[i][j] * g[i]; W[i][j] = clamp(W[i][j] + this.lr * g[i] * rec.h[j]); }
    for (let i = 0; i < b.length; i++) b[i] = clamp(b[i] + this.lr * g[i]);
    for (let j = 0; j < this.nH; j++) { const d = dh[j] * (1 - rec.h[j] * rec.h[j]); for (let k = 0; k < this.nIn; k++) this.W1[j][k] = clamp(this.W1[j][k] + this.lr * 0.5 * d * rec.x[k]); }
  }
  learn(reward) {
    this.lastReward = reward;
    const adv = reward - this.baseline; this.baseline += 0.1 * (reward - this.baseline);
    if (this.lastS) this.step(this.lastS, this.Ws, this.bs, adv);
    for (const r of this.lastP) this.step(r, this.Wp, this.bp, adv * 0.5);
    this.lastP = []; this.updates++;
    if (this.updates % 15 === 0) this.save();
    return adv;
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify({ W1: this.W1, Ws: this.Ws, bs: this.bs, Wp: this.Wp, bp: this.bp, baseline: this.baseline })); } catch (e) { /* storage unavailable */ } }
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d && d.W1.length === this.nH && d.W1[0].length === this.nIn) { Object.assign(this, d); this.loaded = true; }
    } catch (e) { /* ignore */ }
  }
}
function clamp(v) { return Math.max(-6, Math.min(6, v)); }
