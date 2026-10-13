export const TEAM_COLORS = [0x3a7bd5, 0xc0392b];
export const BUILD = {
  cy:       { name: 'Construction Yard', cost: 0,    hp: 2000, r: 4.2, power: 30,  time: 1 },
  power:    { name: 'Power Plant',       cost: 300,  hp: 600,  r: 2.7, power: 100, time: 6 },
  refinery: { name: 'Refinery',          cost: 1000, hp: 900,  r: 3.3, power: -40, time: 10, req: 'power' },
  barracks: { name: 'Barracks',          cost: 300,  hp: 700,  r: 2.7, power: -20, time: 7,  req: 'power' },
  factory:  { name: 'War Factory',       cost: 1000, hp: 1100, r: 3.6, power: -40, time: 12, req: 'refinery' },
};
export const UNIT = {
  rifle:     { name: 'Rifleman',  cost: 100, hp: 100, speed: 3.6, range: 9,  dmg: 9,  rof: 0.9, weapon: 'bullet', armor: 'inf', r: 0.5, from: 'barracks', time: 4,  muzzle: 0.8 },
  rocket:    { name: 'Rocketeer', cost: 250, hp: 90,  speed: 3.1, range: 11, dmg: 32, rof: 2.2, weapon: 'rocket', armor: 'inf', r: 0.5, from: 'barracks', time: 6,  muzzle: 1.0 },
  tank:      { name: 'Tank',      cost: 700, hp: 450, speed: 5.0, range: 12, dmg: 40, rof: 2.0, weapon: 'shell',  armor: 'veh', r: 1.3, from: 'factory',  time: 10, muzzle: 1.1 },
  harvester: { name: 'Harvester', cost: 700, hp: 750, speed: 4.2, range: 0,  dmg: 0,  rof: 1,   weapon: null,     armor: 'veh', r: 1.4, from: 'factory',  time: 12, cap: 300 },
};
export const MULT = {
  bullet: { inf: 1.0, veh: 0.3, bld: 0.3 },
  rocket: { inf: 0.5, veh: 1.5, bld: 1.2 },
  shell:  { inf: 0.6, veh: 1.0, bld: 1.0 },
};
