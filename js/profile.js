// Persistent player profile: points, daily login streak, upgrades (localStorage).
const KEY = 'irondom.profile.v1';
export const UPGRADES = {
  tankTier:   { name: 'Tank Evolution', icon: '🛡️', max: 2, cost: [400, 1000], desc: l => ['Tank Mk I', 'Tank Mk II: +25% HP, +15% damage, reactive armour', 'Tank Mk III: +50% HP, +30% damage, +10% speed, heavy gun'][l] },
  infantry:   { name: 'Infantry Training', icon: '🎖️', max: 3, cost: [150, 300, 600], desc: l => `+${l * 10}% infantry HP and damage` },
  weapons:    { name: 'Weapon Systems', icon: '💥', max: 3, cost: [200, 450, 900], desc: l => `+${l * 8}% damage, ${l * 5}% faster reload (all units)` },
  harvest:    { name: 'Harvest Rate', icon: '⛏️', max: 3, cost: [150, 350, 700], desc: l => `+${l * 15}% harvesting speed` },
  armor:      { name: 'Building Armor', icon: '🏰', max: 3, cost: [200, 400, 800], desc: l => `-${l * 12}% damage to buildings` },
  credits:    { name: 'War Chest', icon: '💰', max: 3, cost: [100, 250, 500], desc: l => `+${l * 500} starting credits` },
};
const DAILY = [50, 75, 100, 150, 200, 300, 500];
function today(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function dayDiff(a, b) { const pa = a.split('-').map(Number), pb = b.split('-').map(Number); return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000); }
export const profile = {
  data: null,
  load() {
    try { this.data = JSON.parse(localStorage.getItem(KEY)); } catch (e) { this.data = null; }
    this.data = Object.assign({ points: 0, lifetime: 0, streak: 0, lastClaim: null, upgrades: {}, wins: 0, losses: 0, kills: 0, name: 'Commander' }, this.data || {});
    for (const k in UPGRADES) this.data.upgrades[k] = this.data.upgrades[k] || 0;
    return this.data;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* storage full / private mode */ } },
  add(n, reason) { n = Math.round(n); if (!n) return; this.data.points += n; this.data.lifetime += n; this.save(); for (const f of this.listeners) f(n, reason); },
  listeners: [],
  // daily reward state (calendar-day based, local time)
  daily(now = new Date()) {
    const t = today(now), last = this.data.lastClaim;
    if (last === t) return { available: false, streak: this.data.streak, day: ((this.data.streak - 1) % 7) + 1, reward: 0, rewards: DAILY };
    const cont = last && dayDiff(last, t) === 1, streak = cont ? this.data.streak + 1 : 1, day = ((streak - 1) % 7) + 1;
    const reward = DAILY[day - 1] + Math.floor((streak - 1) / 7) * 100;
    return { available: true, streak, day, reward, broken: !!last && !cont, rewards: DAILY };
  },
  claimDaily(now = new Date()) {
    const d = this.daily(now); if (!d.available) return null;
    this.data.streak = d.streak; this.data.lastClaim = today(now); this.add(d.reward, 'Daily reward'); return d;
  },
  buy(key) {
    const u = UPGRADES[key], l = this.data.upgrades[key]; if (l >= u.max) return false;
    const c = u.cost[l]; if (this.data.points < c) return false;
    this.data.points -= c; this.data.upgrades[key] = l + 1; this.save(); return true;
  },
};
// Turn an upgrade set into per-team stat modifiers.
export function modsFrom(up = {}) {
  const t = up.tankTier || 0, inf = up.infantry || 0, w = up.weapons || 0;
  return {
    tankTier: t, tankHp: [1, 1.25, 1.5][t], tankDmg: [1, 1.15, 1.3][t], tankSpeed: t >= 2 ? 1.1 : 1,
    infHp: 1 + inf * 0.1, infDmg: 1 + inf * 0.1, dmg: 1 + w * 0.08, rof: 1 - w * 0.05,
    harvest: 1 + (up.harvest || 0) * 0.15, bldArmor: 1 - (up.armor || 0) * 0.12, credits: (up.credits || 0) * 500,
  };
}
