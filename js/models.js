import { THREE } from './T.js';
import { TEAM_COLORS } from './defs.js';
import { metalTex, concreteTex, corrugTex, windowTex, hazardTex, camoTex, flareTex } from './textures.js';
import { merge } from './geom.js';
let G = null; const M = {}, P = {};
export function geo() {
  if (G) return G;
  G = {
    box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 16), cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8), cone: new THREE.ConeGeometry(0.7, 1, 4),
    sph: new THREE.SphereGeometry(0.5, 14, 10), hemi: new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), ring: new THREE.RingGeometry(0.85, 1, 32), oct: new THREE.OctahedronGeometry(0.7),
    torus: new THREE.TorusGeometry(0.5, 0.08, 6, 20), wheel: new THREE.CylinderGeometry(0.5, 0.5, 1, 14).rotateZ(Math.PI / 2),
    prism: new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 1).rotateZ(Math.PI / 2).rotateX(Math.PI / 2),
    cooling: (() => { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.5 - 0.17 * Math.sin(t * Math.PI * 0.9) + (t > 0.85 ? (t - 0.85) * 0.5 : 0), t)); } return new THREE.LatheGeometry(pts, 24); })(),
    dish: new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.32),
    track: (() => { const s = new THREE.Shape(); const L = 1.35, R = 0.3; s.absarc(L, 0, R, -Math.PI / 2, Math.PI / 2); s.absarc(-L, 0, R, Math.PI / 2, Math.PI * 1.5); const g = new THREE.ExtrudeGeometry(s, { depth: 0.38, bevelEnabled: false, curveSegments: 8 }); g.translate(0, 0, -0.19); g.rotateY(Math.PI / 2); return g; })(),
    crystal: [0, 1, 2, 3, 4, 5].map(v => crystalCluster(v)),
  };
  return G;
}
function crystalCluster(v) {
  const parts = []; const n = 4 + (v % 3);
  for (let i = 0; i < n; i++) {
    const r = 0.13 + ((i * 37 + v * 11) % 10) / 70, h = 0.5 + ((i * 53 + v * 7) % 10) / 9;
    const c = new THREE.CylinderGeometry(0, r, h * 0.3, 6); c.translate(0, h * 0.85, 0);
    const b = new THREE.CylinderGeometry(r, r * 0.8, h * 0.7, 6); b.translate(0, h * 0.35, 0);
    const g = merge([b, c]); const a = i / n * Math.PI * 2 + v, tilt = i === 0 ? 0 : 0.35 + ((i * 13) % 5) / 12;
    g.rotateZ(tilt); g.rotateY(a); g.translate(Math.cos(a) * (i ? 0.22 : 0), 0, Math.sin(a) * (i ? 0.22 : 0)); parts.push(g);
  }
  return merge(parts);
}
// legacy flat material (used for selection rings, ghosts, markers)
export function mat(c, basic = false, opacity = 1) {
  const k = c + ':' + basic + ':' + opacity;
  if (!M[k]) {
    const o = { color: c }; if (opacity < 1) { o.transparent = true; o.opacity = opacity; o.depthWrite = false; }
    if (basic) o.side = THREE.DoubleSide;
    M[k] = basic ? new THREE.MeshBasicMaterial(o) : new THREE.MeshLambertMaterial(o);
  }
  return M[k];
}
// shared PBR materials
export function pbr(key) {
  if (P[key]) return P[key];
  const mt = metalTex(), cc = concreteTex(), co = corrugTex(), w = windowTex();
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const team = /^team(\d)(c?)$/.exec(key);
  if (team) {
    const t = +team[1];
    return (P[key] = S({ color: TEAM_COLORS[t], map: team[2] ? camoTex() : mt.map, normalMap: mt.normal, roughness: 0.5, metalness: 0.45 }));
  }
  const defs = {
    steel: { color: 0x7d838a, map: mt.map, normalMap: mt.normal, roughness: 0.42, metalness: 0.8 },
    dark: { color: 0x34383d, map: mt.map, normalMap: mt.normal, roughness: 0.6, metalness: 0.6 },
    rubber: { color: 0x1c1d1f, roughness: 0.92, metalness: 0 },
    gun: { color: 0x2a2c2e, roughness: 0.35, metalness: 0.9 },
    concrete: { color: 0xbab5ab, map: cc.map, normalMap: cc.normal, roughness: 0.92, metalness: 0 },
    concreteD: { color: 0x8b877f, map: cc.map, normalMap: cc.normal, roughness: 0.95, metalness: 0 },
    roof: { color: 0x8d9296, map: co.map, normalMap: co.normal, roughness: 0.55, metalness: 0.65 },
    window: { map: w.map, emissiveMap: w.emissive, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.4 },
    glass: { color: 0x1a2a35, roughness: 0.05, metalness: 0.9 },
    hazard: { map: hazardTex(), roughness: 0.6, metalness: 0.2 },
    skin: { color: 0xd9a782, roughness: 0.7 },
    fatigue: { color: 0x59603f, roughness: 0.9 },
    boot: { color: 0x2a221c, roughness: 0.8 },
    gold: { color: 0xd4a32a, roughness: 0.35, metalness: 1 },
    yellow: { color: 0xd8a51d, map: mt.map, normalMap: mt.normal, roughness: 0.5, metalness: 0.4 },
    copper: { color: 0xb5713d, roughness: 0.4, metalness: 1 },
    red: { color: 0xff2a10, emissive: 0xff2010, emissiveIntensity: 2, roughness: 0.4 },
    greenL: { color: 0x30ff60, emissive: 0x30ff60, emissiveIntensity: 2, roughness: 0.4 },
    sand: { color: 0xa89466, roughness: 1 },
    ore: { color: 0xffc23a, emissive: 0xff9a10, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.3, flatShading: true },
  };
  if (key === 'glow') return (P[key] = new THREE.MeshBasicMaterial({ map: flareTex(), color: 0xffb030, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
  return (P[key] = S(defs[key]));
}
function part(g, m, sx, sy, sz, x, y, z, parent, rx = 0, ry = 0, rz = 0) {
  const me = new THREE.Mesh(g, m); me.scale.set(sx, sy, sz); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me;
}
function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

// ---------- units ----------
function tank(g, root, T, tier = 0) {
  const D = pbr('dark'), S = pbr('steel'), R = pbr('rubber'), K = pbr('gun');
  const body = grp(root); root.userData.body = body;
  const wheels = [];
  for (const sx of [-1, 1]) {
    part(g.track, R, 1, 1, 1, sx * 0.92, 0.36, 0, body);
    for (let i = 0; i < 5; i++) wheels.push(part(g.wheel, S, 0.42, 0.5, 0.5, sx * 0.92, 0.32, -1.08 + i * 0.54, body));
    part(g.box, T, 0.5, 0.06, 2.9, sx * 0.92, 0.7, 0, body);
    part(g.box, D, 0.06, 0.28, 2.7, sx * 1.16, 0.55, 0, body);
  }
  part(g.box, T, 1.5, 0.5, 2.5, 0, 0.72, -0.05, body);
  part(g.box, T, 1.5, 0.12, 0.9, 0, 0.9, 1.25, body, -0.45);
  part(g.box, D, 1.2, 0.08, 0.8, 0, 0.99, -0.9, body);
  for (let i = 0; i < 4; i++) part(g.box, K, 1.1, 0.04, 0.06, 0, 1.04, -1.2 + i * 0.18, body);
  for (const sx of [-0.55, 0.55]) { part(g.sph, pbr('window'), 0.16, 0.12, 0.08, sx, 0.8, 1.62, body); part(g.cyl8, D, 0.14, 0.4, 0.14, sx * 0.9, 0.95, -1.3, body, Math.PI / 2); }
  const tur = grp(body, 0, 1.0, -0.1); root.userData.turret = tur;
  part(g.cyl8, T, 1.3, 0.42, 1.5, 0, 0.21, 0, tur);
  part(g.box, T, 1.0, 0.36, 0.7, 0, 0.2, -0.75, tur);
  part(g.box, D, 0.5, 0.34, 0.3, 0, 0.21, 0.72, tur);
  part(g.cyl, D, 0.36, 0.14, 0.36, -0.32, 0.48, -0.15, tur);
  part(g.cyl, K, 0.4, 0.05, 0.4, -0.32, 0.56, -0.15, tur);
  part(g.cyl8, K, 0.02, 1.0, 0.02, 0.45, 0.9, -0.85, tur);
  part(g.box, D, 0.18, 0.12, 0.3, 0.42, 0.48, 0.1, tur);
  for (const sx of [-0.7, 0.7]) part(g.box, K, 0.12, 0.14, 0.3, sx, 0.25, 0.35, tur);
  const barrel = grp(tur, 0, 0.23, 0.8); root.userData.barrel = barrel;
  part(g.cyl, K, 0.16, 1.7, 0.16, 0, 0, 0.85, barrel, Math.PI / 2);
  part(g.cyl, K, 0.24, 0.35, 0.24, 0, 0, 0.75, barrel, Math.PI / 2);
  part(g.cyl8, D, 0.24, 0.22, 0.24, 0, 0, 1.75, barrel, Math.PI / 2);
  root.userData.muzzle = grp(barrel, 0, 0, 1.95);
  if (tier >= 1) { // Mk II: reactive armour blocks on turret and skirts, side bins
    for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) part(g.box, D, 0.1, 0.22, 0.3, sx * 0.68, 0.24, 0.45 - i * 0.32, tur, 0, sx * 0.25);
    for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) part(g.box, T, 0.08, 0.24, 0.42, sx * 1.22, 0.58, -1.1 + i * 0.44, body);
    part(g.box, D, 0.9, 0.3, 0.35, 0, 0.22, -1.2, tur);
  }
  if (tier >= 2) { // Mk III: heavier gun, roof machine gun, bigger stance
    barrel.children[0].scale.set(0.21, 2.0, 0.21); barrel.children[0].position.z = 1.0; barrel.children[2].position.z = 2.05; root.userData.muzzle.position.z = 2.25;
    const mg = grp(tur, -0.32, 0.62, -0.15); part(g.box, K, 0.08, 0.1, 0.55, 0, 0.05, 0.25, mg); part(g.box, D, 0.2, 0.16, 0.06, 0, 0.06, 0.05, mg);
    part(g.box, pbr('red'), 0.06, 0.06, 0.06, 0.45, 1.4, -0.85, tur);
    body.scale.setScalar(1.1);
  }
  root.userData.animate = (dt, st) => {
    for (const w of wheels) w.rotation.x += st.speed * dt * 2.2;
    const ud = root.userData; ud.recoil = Math.max(0, (ud.recoil || 0) - dt * 3);
    barrel.position.z = 0.8 - Math.sin(Math.min(1, ud.recoil) * Math.PI * 0.5) * 0.4;
    body.rotation.x = -ud.recoil * 0.06 + Math.sin(st.t * 18) * 0.008 * st.speed;
  };
}
function soldier(g, root, T, rocket) {
  const F = pbr('fatigue'), Sk = pbr('skin'), B = pbr('boot'), K = pbr('gun'), D = pbr('dark');
  const body = grp(root);
  const legs = [], knees = [];
  for (const sx of [-0.13, 0.13]) {
    const hip = grp(body, sx, 0.62, 0); legs.push(hip);
    part(g.box, F, 0.16, 0.34, 0.18, 0, -0.17, 0, hip);
    const knee = grp(hip, 0, -0.34, 0); knees.push(knee); part(g.box, F, 0.14, 0.3, 0.16, 0, -0.14, 0, knee); part(g.box, B, 0.15, 0.1, 0.24, 0, -0.29, 0.04, knee);
  }
  part(g.box, F, 0.42, 0.42, 0.24, 0, 0.84, 0, body);
  part(g.box, T, 0.44, 0.24, 0.27, 0, 0.88, 0.01, body);
  part(g.box, D, 0.3, 0.32, 0.14, 0, 0.86, -0.19, body);
  part(g.box, B, 0.44, 0.06, 0.26, 0, 0.64, 0, body);
  part(g.cyl8, Sk, 0.1, 0.08, 0.1, 0, 1.08, 0, body);
  part(g.sph, Sk, 0.22, 0.25, 0.23, 0, 1.2, 0.01, body);
  part(g.hemi, T, 0.29, 0.26, 0.31, 0, 1.24, 0, body);
  part(g.box, K, 0.16, 0.03, 0.04, 0, 1.2, 0.12, body);
  const arms = [];
  for (const sx of [-0.27, 0.27]) {
    const sh = grp(body, sx, 1.0, 0); arms.push(sh);
    part(g.box, F, 0.12, 0.38, 0.13, 0, -0.17, 0, sh); part(g.sph, Sk, 0.1, 0.1, 0.1, 0, -0.37, 0, sh);
  }
  arms[0].rotation.x = -0.9; arms[1].rotation.x = -1.2; arms[1].rotation.z = 0.35;
  let muzzle;
  if (rocket) {
    const tube = grp(body, 0.22, 1.15, -0.05);
    part(g.cyl, F, 0.16, 1.1, 0.16, 0, 0, 0.1, tube, Math.PI / 2); part(g.cyl, D, 0.2, 0.12, 0.2, 0, 0, 0.62, tube, Math.PI / 2);
    part(g.box, D, 0.06, 0.12, 0.08, 0, -0.1, 0.25, tube); part(g.box, K, 0.1, 0.06, 0.12, -0.08, 0.08, 0.3, tube);
    muzzle = grp(tube, 0, 0, 0.7);
  } else {
    const gun = grp(body, 0.08, 0.86, 0.26);
    part(g.box, K, 0.05, 0.08, 0.62, 0, 0, 0.05, gun); part(g.box, B, 0.05, 0.12, 0.16, 0, -0.04, -0.26, gun); part(g.box, K, 0.04, 0.14, 0.05, 0, -0.08, 0.08, gun);
    muzzle = grp(gun, 0, 0.01, 0.38);
  }
  root.userData.muzzle = muzzle;
  root.userData.animate = (dt, st) => {
    const ud = root.userData, w = st.speed > 0.2 ? 1 : 0; ud.phase = (ud.phase ?? Math.random() * 6) + dt * st.speed * 3.2;
    const ph = ud.phase, sw = Math.sin(ph) * 0.65 * w;
    legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
    knees[0].rotation.x = Math.max(0, -Math.cos(ph)) * 0.9 * w; knees[1].rotation.x = Math.max(0, Math.cos(ph)) * 0.9 * w;
    body.position.y = Math.abs(Math.cos(ph)) * 0.05 * w;
    ud.recoil = Math.max(0, (ud.recoil || 0) - dt * 6);
    body.rotation.x = 0.08 * w - ud.recoil * 0.12;
  };
}
function harvester(g, root, T) {
  const Y = pbr('yellow'), D = pbr('dark'), R = pbr('rubber'), S = pbr('steel'), K = pbr('gun');
  const body = grp(root);
  const wheels = [];
  for (const sx of [-1.02, 1.02]) for (const z of [-1.0, 0, 1.0]) { wheels.push(part(g.wheel, R, 0.42, 0.78, 0.78, sx, 0.4, z, body)); wheels.push(part(g.wheel, S, 0.44, 0.4, 0.4, sx, 0.4, z, body)); }
  part(g.box, D, 1.7, 0.35, 3.2, 0, 0.62, 0, body);
  part(g.box, Y, 2.0, 0.08, 3.25, 0, 0.84, 0, body);
  part(g.box, T, 1.85, 1.0, 1.9, 0, 1.38, -0.55, body);
  for (let i = 0; i < 4; i++) part(g.box, D, 1.9, 0.07, 0.07, 0, 1.0 + i * 0.25, 0.42, body);
  part(g.box, pbr('hazard'), 1.86, 0.12, 0.05, 0, 0.95, -1.51, body);
  const load = part(g.box, pbr('ore'), 1.6, 0.3, 1.6, 0, 1.75, -0.55, body);
  part(g.box, Y, 1.1, 0.75, 0.85, -0.38, 1.25, 0.95, body);
  part(g.box, pbr('glass'), 1.12, 0.32, 0.6, -0.38, 1.38, 1.0, body);
  part(g.box, pbr('glass'), 0.9, 0.32, 0.05, -0.38, 1.38, 1.39, body);
  part(g.box, D, 1.15, 0.06, 0.9, -0.38, 1.65, 0.95, body);
  part(g.cyl8, D, 0.12, 0.9, 0.12, 0.55, 1.6, 0.75, body);
  part(g.cyl8, K, 0.14, 0.08, 0.14, 0.55, 2.06, 0.75, body);
  part(g.box, pbr('red'), 0.1, 0.06, 0.1, -0.38, 1.72, 0.95, body);
  for (const sx of [-0.7, 0.4]) part(g.box, pbr('window'), 0.2, 0.1, 0.04, sx, 0.85, 1.62, body);
  const scoop = grp(body, 0, 0.45, 1.7);
  part(g.box, S, 2.0, 0.08, 0.6, 0, -0.2, 0.15, scoop, 0.25);
  part(g.box, S, 0.08, 0.5, 0.6, -0.98, 0, 0.1, scoop); part(g.box, S, 0.08, 0.5, 0.6, 0.98, 0, 0.1, scoop);
  for (let i = 0; i < 7; i++) part(g.cone, K, 0.08, 0.2, 0.08, -0.84 + i * 0.28, -0.3, 0.48, scoop, Math.PI / 2);
  const drum = grp(scoop, 0, 0.05, 0.1); part(g.wheel, D, 1.8, 0.38, 0.38, 0, 0, 0, drum);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; part(g.box, S, 1.7, 0.05, 0.12, 0, Math.sin(a) * 0.2, Math.cos(a) * 0.2, drum, a); }
  root.userData.smoke = [{ p: new THREE.Vector3(0.55, 2.15, 0.75), rate: 3, col: 0x333333, size: 0.5, life: 1.6, up: 1.5 }];
  root.userData.animate = (dt, st) => {
    for (const w of wheels) w.rotation.x += st.speed * dt * 2.6;
    const e = st.e, digging = e && e.hstate === 'harvest';
    drum.rotation.x += dt * (digging ? 12 : 0.5);
    scoop.rotation.x += ((digging ? 0.25 : -0.1) - scoop.rotation.x) * Math.min(1, dt * 4);
    if (e) { const f = e.cargo / e.def.cap; load.visible = f > 0.02; load.scale.y = 0.3 * Math.max(0.05, f); load.position.y = 1.62 + 0.15 * f; }
  };
}

// ---------- buildings ----------
function windows(g, parent, w, h, x, y, z, ry = 0) { return part(g.box, pbr('window'), w, h, 0.04, x, y, z, parent, 0, ry); }
function pipe(g, parent, x, y, z, len, rx = 0, rz = 0, r = 0.14) { return part(g.cyl, pbr('steel'), r, len, r, x, y, z, parent, rx, 0, rz); }
function pad(g, parent, w, d) {
  part(g.box, pbr('concreteD'), w + 0.6, 0.5, d + 0.6, 0, -0.05, 0, parent);
  part(g.box, pbr('concrete'), w, 0.3, d, 0, 0.3, 0, parent);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) part(g.cyl8, pbr('hazard'), 0.2, 0.6, 0.2, sx * w / 2, 0.5, sz * d / 2, parent);
}
function building(type, g, root, T) {
  const D = pbr('dark'), S = pbr('steel'), C = pbr('concrete'), RF = pbr('roof');
  const ud = root.userData; ud.spin = []; ud.smoke = []; ud.blink = [];
  switch (type) {
    case 'cy': {
      pad(g, root, 8, 8);
      part(g.box, C, 5.6, 2.6, 4.4, -0.6, 1.75, -1.2, root);
      part(g.box, T, 5.7, 0.4, 4.5, -0.6, 2.9, -1.2, root);
      part(g.box, RF, 5.8, 0.15, 4.6, -0.6, 3.15, -1.2, root);
      windows(g, root, 4.6, 0.55, -0.6, 2.2, 1.03); windows(g, root, 3.4, 0.55, -0.6, 2.2, -3.43);
      part(g.box, D, 2.0, 1.7, 0.1, 1.0, 1.3, 1.04, root); part(g.box, pbr('hazard'), 2.1, 0.18, 0.12, 1.0, 2.2, 1.05, root);
      part(g.box, C, 1.6, 2.4, 1.6, 2.7, 2.6, -2.6, root); part(g.box, pbr('glass'), 1.7, 0.6, 1.7, 2.7, 4.0, -2.6, root); part(g.box, T, 1.8, 0.15, 1.8, 2.7, 4.35, -2.6, root);
      const radar = grp(root, 2.7, 4.5, -2.6); part(g.cyl8, S, 0.12, 0.6, 0.12, 0, 0.3, 0, radar);
      const dishG = grp(radar, 0, 0.7, 0); part(g.dish, S, 0.75, 0.75, 0.75, 0, 0, 0.1, dishG, -Math.PI / 2 + 0.4).material = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.3, metalness: 0.7, side: THREE.DoubleSide });
      part(g.cyl8, D, 0.04, 0.6, 0.04, 0, 0, 0.35, dishG, Math.PI / 2 - 0.4);
      ud.spin.push({ o: radar, ax: 'y', s: 1.2 });
      const crane = grp(root, -3.2, 0.4, 2.7);
      for (let i = 0; i < 6; i++) part(g.box, pbr('yellow'), 0.4, 0.8, 0.4, 0, 0.4 + i * 0.8, 0, crane);
      for (let i = 0; i < 6; i++) part(g.box, D, 0.42, 0.06, 0.42, 0, 0.8 + i * 0.8, 0, crane);
      const jib = grp(crane, 0, 5.0, 0); part(g.box, pbr('yellow'), 0.3, 0.3, 5.2, 0, 0, 1.4, jib); part(g.box, D, 0.6, 0.5, 0.8, 0, 0, -1.1, jib);
      part(g.cyl8, D, 0.03, 1.6, 0.03, 0, -0.8, 3.6, jib); part(g.box, S, 0.3, 0.2, 0.3, 0, -1.6, 3.6, jib);
      ud.spin.push({ o: jib, ax: 'y', s: 0.25 });
      pipe(g, root, -3.6, 1.2, -1.2, 4, Math.PI / 2); pipe(g, root, -3.6, 1.6, -1.2, 4, Math.PI / 2, 0, 0.1);
      part(g.cyl8, D, 0.05, 2.2, 0.05, -2.8, 4.3, -2.8, root); ud.blink.push(part(g.sph, pbr('red'), 0.14, 0.14, 0.14, -2.8, 5.45, -2.8, root));
      break; }
    case 'power': {
      pad(g, root, 5, 5);
      part(g.box, C, 2.4, 1.8, 4.2, -1.1, 1.35, 0, root); part(g.box, T, 2.5, 0.3, 4.3, -1.1, 2.3, 0, root); part(g.box, RF, 2.5, 0.1, 4.3, -1.1, 2.5, 0, root);
      windows(g, root, 1.9, 0.4, -1.1, 1.6, 2.12);
      for (const z of [-1.2, 1.2]) {
        part(g.cooling, C, 1.7, 2.8, 1.7, 1.2, 0.45, z, root);
        part(g.torus, T, 1.4, 1.4, 1.0, 1.2, 1.0, z, root, Math.PI / 2);
        ud.smoke.push({ p: new THREE.Vector3(1.2, 3.3, z), rate: 6, col: 0xeeeeee, size: 1.8, life: 3.5, up: 2.2 });
      }
      pipe(g, root, 0.15, 1.1, -1.2, 0.7, 0, Math.PI / 2); pipe(g, root, 0.15, 1.1, 1.2, 0.7, 0, Math.PI / 2);
      part(g.box, D, 0.8, 0.9, 0.8, -1.6, 2.9, -1.3, root); for (let i = 0; i < 3; i++) part(g.cyl8, pbr('copper'), 0.12, 0.6, 0.12, -1.85 + i * 0.25, 3.6, -1.3, root);
      const fan = grp(root, -0.8, 2.6, 1.2); part(g.cyl, D, 0.9, 0.1, 0.9, 0, 0, 0, fan); const bl = grp(fan, 0, 0.08, 0);
      for (let i = 0; i < 2; i++) part(g.box, S, 0.8, 0.02, 0.14, 0, 0, 0, bl, 0, i * Math.PI / 2, 0.3);
      ud.spin.push({ o: bl, ax: 'y', s: 9 });
      ud.blink.push(part(g.sph, pbr('greenL'), 0.12, 0.12, 0.12, -2.3, 2.6, 2.1, root));
      break; }
    case 'refinery': {
      pad(g, root, 6.5, 6);
      part(g.box, C, 3.6, 2.4, 3.0, -1.2, 1.6, -1.2, root); part(g.box, T, 3.7, 0.35, 3.1, -1.2, 2.9, -1.2, root);
      part(g.prism, RF, 3.0, 1.0, 3.7, -1.2, 3.35, -1.2, root, 0, Math.PI / 2);
      windows(g, root, 2.8, 0.45, -1.2, 2.0, 0.32);
      for (const [x, z, r] of [[1.9, -1.6, 0.9], [1.9, 0.3, 0.7]]) {
        part(g.cyl, S, r * 2, 3.2, r * 2, x, 2.0, z, root); part(g.hemi, S, r * 2, r, r * 2, x, 3.6, z, root);
        for (let i = 0; i < 3; i++) part(g.torus, D, r * 2.05, r * 2.05, 1, x, 0.9 + i * 0.9, z, root, Math.PI / 2);
      }
      part(g.box, pbr('gold'), 2.6, 0.12, 2.0, 1.4, 0.5, 2.0, root); part(g.box, pbr('hazard'), 2.8, 0.15, 0.15, 1.4, 0.5, 3.0, root);
      for (const sx of [0.1, 2.7]) part(g.box, D, 0.12, 1.2, 0.12, sx, 1.0, 2.0, root);
      part(g.box, D, 2.8, 0.15, 0.3, 1.4, 1.6, 2.0, root);
      pipe(g, root, 0.6, 2.6, -0.65, 1.8, 0, Math.PI / 2); pipe(g, root, 1.9, 2.2, -0.65, 1.0, Math.PI / 2, 0, 0.12);
      part(g.cyl8, D, 0.4, 2.6, 0.4, -2.6, 4.0, -2.3, root); part(g.torus, T, 0.5, 0.5, 1, -2.6, 5.0, -2.3, root, Math.PI / 2);
      ud.smoke.push({ p: new THREE.Vector3(-2.6, 5.4, -2.3), rate: 4, col: 0x555555, size: 1.1, life: 3, up: 2.5 });
      break; }
    case 'barracks': {
      pad(g, root, 5, 5);
      part(g.box, pbr('concreteD'), 3.8, 1.6, 3.4, 0, 1.25, -0.3, root);
      part(g.box, T, 3.85, 0.25, 3.45, 0, 1.95, -0.3, root);
      part(g.prism, RF, 3.6, 1.3, 4.0, 0, 2.6, -0.3, root, 0, Math.PI / 2);
      part(g.box, D, 0.9, 1.2, 0.1, 0, 1.05, 1.42, root); part(g.box, T, 1.3, 0.12, 0.4, 0, 1.75, 1.6, root);
      windows(g, root, 0.7, 0.4, -1.2, 1.3, 1.42); windows(g, root, 0.7, 0.4, 1.2, 1.3, 1.42);
      for (let i = 0; i < 5; i++) part(g.sph, pbr('sand'), 0.55, 0.3, 0.35, -2.1 + i * 0.5, 0.6, 2.25, root);
      for (let i = 0; i < 4; i++) part(g.sph, pbr('sand'), 0.55, 0.3, 0.35, -1.85 + i * 0.5, 0.85, 2.25, root);
      part(g.cyl8, S, 0.06, 3.6, 0.06, 2.1, 2.2, 1.9, root);
      const flag = grp(root, 2.1, 3.7, 1.9); part(g.box, T, 0.02, 0.5, 0.9, 0, 0, 0.45, flag); ud.flag = flag;
      part(g.cyl8, D, 0.04, 1.4, 0.04, -1.4, 3.4, -1.4, root); ud.blink.push(part(g.sph, pbr('red'), 0.12, 0.12, 0.12, -1.4, 4.1, -1.4, root));
      part(g.cyl8, D, 0.3, 0.8, 0.3, 1.0, 3.2, -1.2, root);
      ud.smoke.push({ p: new THREE.Vector3(1.0, 3.7, -1.2), rate: 1.5, col: 0x777777, size: 0.6, life: 2.5, up: 1.5 });
      break; }
    case 'factory': {
      pad(g, root, 7, 6.5);
      part(g.box, C, 6.2, 2.8, 5.0, 0, 1.85, -0.2, root);
      part(g.box, T, 6.3, 0.5, 5.1, 0, 3.0, -0.2, root);
      for (let i = 0; i < 3; i++) part(g.prism, RF, 1.6, 0.8, 5.0, -2.1 + i * 2.1, 3.65, -0.2, root);
      part(g.box, D, 3.0, 2.0, 0.08, 0, 1.4, 2.32, root); for (let i = 0; i < 8; i++) part(g.box, S, 3.0, 0.03, 0.1, 0, 0.6 + i * 0.24, 2.36, root);
      part(g.box, pbr('hazard'), 3.3, 0.22, 0.12, 0, 2.5, 2.36, root);
      for (const sx of [-1, 1]) { part(g.box, pbr('hazard'), 0.18, 2.2, 0.12, sx * 1.6, 1.4, 2.36, root); windows(g, root, 1.0, 0.5, sx * 2.45, 2.0, 2.33); }
      for (const [x, z] of [[2.4, -2.0], [1.6, -2.0]]) { part(g.cyl8, D, 0.45, 2.4, 0.45, x, 4.4, z, root); ud.smoke.push({ p: new THREE.Vector3(x, 5.6, z), rate: 3, col: 0x444444, size: 1.0, life: 3, up: 2.5 }); }
      for (const x of [-2.2, -0.6]) { const f = grp(root, x, 4.15, -1.5); part(g.cyl, D, 0.8, 0.25, 0.8, 0, 0, 0, f); const b = grp(f, 0, 0.14, 0); for (let i = 0; i < 2; i++) part(g.box, S, 0.7, 0.02, 0.12, 0, 0, 0, b, 0, i * Math.PI / 2, 0.3); ud.spin.push({ o: b, ax: 'y', s: 8 }); }
      pipe(g, root, -3.25, 1.5, -0.2, 4.5, Math.PI / 2); pipe(g, root, -3.25, 2.0, -0.2, 4.5, Math.PI / 2, 0, 0.1);
      part(g.box, D, 0.9, 1.3, 1.2, 3.5, 0.95, -1.5, root);
      ud.blink.push(part(g.sph, pbr('red'), 0.12, 0.12, 0.12, 3.1, 3.4, 2.2, root));
      break; }
  }
  ud.animate = (dt, st) => {
    const e = st.e, on = !e || !e.constructing;
    if (on) for (const s of ud.spin) s.o.rotation[s.ax] += s.s * dt;
    for (const b of ud.blink) b.visible = on && Math.sin(st.t * 4 + b.position.x) > 0;
    if (ud.flag) ud.flag.rotation.y = Math.sin(st.t * 3) * 0.35;
  };
}

export function makeMesh(type, team, r = 1, tier = 0) {
  const g = geo(), root = new THREE.Group();
  const T = pbr('team' + team + (type === 'tank' || type === 'cy' || type === 'factory' ? 'c' : ''));
  switch (type) {
    case 'tank': tank(g, root, T, tier); break;
    case 'rifle': case 'rocket': soldier(g, root, pbr('team' + team), type === 'rocket'); break;
    case 'harvester': harvester(g, root, pbr('team' + team)); break;
    default: building(type, g, root, T);
  }
  const ring = new THREE.Mesh(g.ring, mat(0x55ff55, true));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.2; ring.scale.setScalar(r * 1.3); ring.visible = false;
  root.add(ring); root.userData.ring = ring;
  return root;
}
let GLOWG = null;
export function makeOre(i) {
  const g = geo(), o = new THREE.Group();
  const m = new THREE.Mesh(g.crystal[i % g.crystal.length], pbr('ore')); m.castShadow = true; m.scale.setScalar(0.9 + (i % 5) * 0.12); o.add(m);
  GLOWG = GLOWG || new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2);
  const glow = new THREE.Mesh(GLOWG, pbr('glow')); glow.position.y = 0.08; o.add(glow);
  return o;
}
export function makeGhost(type) {
  const o = makeMesh(type, 0);
  o.userData.ring.visible = false; o.userData.animate = null;
  o.traverse(c => { if (c.isMesh) { c.material = mat(0x33ff33, true, 0.45); c.castShadow = false; } });
  return o;
}
export function setGhostValid(o, ok) { const m = mat(ok ? 0x33ff33 : 0xff3333, true, 0.45); o.traverse(c => { if (c.isMesh) c.material = m; }); }
