// Per-unit personality + stochastic utility decisions (weighted sampling, not argmax).
import { THREE } from '../T.js';
export function makeTraits() { const r = () => Math.round(Math.random() * 100) / 100; return { aggression: r(), caution: r(), greed: r() }; }
const ACTIONS = ['attack', 'defend', 'escort', 'retreat'];
const off = (p, a, b) => { const ang = Math.random() * Math.PI * 2, r = a + Math.random() * (b - a); return new THREE.Vector3(p.x + Math.cos(ang) * r, 0, p.z + Math.sin(ang) * r); };

export function scoreActions(g, u) {
  const t = u.traits, hp = u.hp / u.maxHp, enemy = 1 - u.team;
  const friends = g.countNear(u.pos, 16, u.team), enemies = g.countNear(u.pos, 16, enemy);
  const base = g.basePos(u.team), dBase = Math.hypot(u.pos.x - base.x, u.pos.z - base.z);
  const threat = g.threatNear(u.team), credits = g.teams[u.team].credits;
  return {
    ctx: { hp, friends, enemies, dBase, threat, base },
    s: [
      0.4 + t.aggression * 1.4 + (friends - enemies) * 0.12 + hp * 0.6 + (u.wave ? 0.8 : 0),
      0.2 + t.caution * 0.7 + threat * 0.25 + (dBase > 70 ? 0.2 : 0) - (u.wave ? 0.3 : 0),
      0.1 + t.greed * 0.9 + (credits < 600 ? 0.4 : 0),
      Math.max(0, (1 - hp) * (0.5 + t.caution * 2.5) - 0.4) + Math.max(0, enemies - friends - 1) * 0.15 * t.caution,
    ],
  };
}

export function decideUnit(g, u) {
  if (u.type === 'harvester') {
    if (u.hp / u.maxHp < 0.5 && g.time - (u.lastHit || -99) < 3 && Math.random() < u.traits.caution) {
      const b = g.basePos(u.team); u.moveTo = off(b, 6, 10); u.moveSet = g.time; u.mood = 'fleeing to base';
    }
    return;
  }
  if (u.team === 0 && g.time - u.orderTime < 10) return; // respect recent player orders
  const { s, ctx } = scoreActions(g, u);
  const w = s.map(v => Math.max(0.02, v) ** 2), sum = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum, k = 0; while (k < w.length - 1 && (r -= w[k]) > 0) k++;
  const act = ACTIONS[k];
  if (u.team === 0) return applyPlayer(g, u, act, ctx);
  u.mood = act;
  switch (act) {
    case 'attack':
      if (!u.wave && !u.target) { const e = g.nearestEnemy(u, 25); if (e) { u.target = e; u.chase = true; } }
      break;
    case 'defend':
      if (u.wave && ctx.threat < 2) break;
      if (u.wave) g.commander.removeFromWave(u);
      if (ctx.dBase > 18) { u.moveTo = off(ctx.base, 8, 15); u.moveSet = g.time; u.attackMove = true; u.target = null; }
      break;
    case 'escort': {
      if (u.wave) break;
      const hs = g.units(u.team).filter(h => h.type === 'harvester');
      if (hs.length) { const h = hs[Math.floor(Math.random() * hs.length)]; u.moveTo = off(h.pos, 3, 6); u.moveSet = g.time; u.attackMove = true; u.mood = 'escorting harvester'; }
      break;
    }
    case 'retreat':
      if (u.wave) g.commander.removeFromWave(u);
      u.target = null; u.moveTo = off(ctx.base, 6, 12); u.moveSet = g.time; u.attackMove = false;
      break;
  }
}

// Player units only get light autonomy: engage nearby threats or pull back when badly hurt.
function applyPlayer(g, u, act, ctx) {
  if (act === 'attack' && !u.target) { const e = g.nearestEnemy(u, u.def.range + 6); if (e) { u.target = e; u.chase = false; u.mood = 'auto-engage'; return; } }
  if (act === 'retreat' && ctx.hp < 0.35 && ctx.dBase > 20) { u.target = null; u.moveTo = off(ctx.base, 6, 12); u.moveSet = g.time; u.mood = 'retreating (hurt)'; return; }
  u.mood = u.target ? 'fighting' : (u.moveTo ? 'moving' : 'holding');
}
