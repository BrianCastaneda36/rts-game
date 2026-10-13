import { THREE } from './T.js';
import { TEAM_COLORS } from './defs.js';
let G = null; const M = {};
export function geo() {
  if (G) return G;
  G = {
    box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12), cone: new THREE.ConeGeometry(0.7, 1, 4),
    sph: new THREE.SphereGeometry(0.5, 10, 8), ring: new THREE.RingGeometry(0.85, 1, 32), oct: new THREE.OctahedronGeometry(0.7),
  };
  return G;
}
export function mat(c, basic = false, opacity = 1) {
  const k = c + ':' + basic + ':' + opacity;
  if (!M[k]) {
    const o = { color: c }; if (opacity < 1) { o.transparent = true; o.opacity = opacity; o.depthWrite = false; }
    if (basic) o.side = THREE.DoubleSide;
    M[k] = basic ? new THREE.MeshBasicMaterial(o) : new THREE.MeshLambertMaterial(o);
  }
  return M[k];
}
function part(g, m, sx, sy, sz, x, y, z, parent) { const me = new THREE.Mesh(g, m); me.scale.set(sx, sy, sz); me.position.set(x, y, z); parent.add(me); return me; }

export function makeMesh(type, team, r = 1) {
  const g = geo(), grp = new THREE.Group();
  const T = mat(TEAM_COLORS[team]), D = mat(0x50555c), L = mat(0x9aa0a6), K = mat(0x2b2f33);
  switch (type) {
    case 'cy':
      part(g.box, D, 8, 2, 8, 0, 0, 0, grp); part(g.box, T, 6, 2, 5, 0, 2, -0.5, grp);
      part(g.box, L, 1.5, 3, 1.5, 2.5, 3, 2.5, grp); part(g.box, K, 5, 0.3, 0.3, 0.5, 4.6, 2.5, grp); break;
    case 'power':
      part(g.box, D, 5, 1.6, 5, 0, 0, 0, grp); part(g.box, T, 4, 1.6, 3, 0, 1.4, -0.6, grp);
      part(g.cyl, L, 0.9, 3, 0.9, -1, 2.5, 1.3, grp); part(g.cyl, L, 0.9, 3, 0.9, 1, 2.5, 1.3, grp); break;
    case 'refinery':
      part(g.box, D, 6.5, 1.6, 6, 0, 0, 0, grp); part(g.box, T, 4, 2, 3, -0.8, 1.6, -0.8, grp);
      part(g.cyl, L, 2, 3, 2, 1.8, 2, 1.5, grp); part(g.box, mat(0xd4af37), 2, 0.2, 2, 1.8, 0.9, -1.8, grp); break;
    case 'barracks': {
      part(g.box, D, 5, 1.4, 5, 0, 0, 0, grp); part(g.box, T, 4, 1.6, 4, 0, 1.3, 0, grp);
      const roof = part(g.cone, K, 4, 1.4, 4, 0, 2.8, 0, grp); roof.rotation.y = Math.PI / 4; break; }
    case 'factory':
      part(g.box, D, 7, 1.6, 6.5, 0, 0, 0, grp); part(g.box, T, 6, 2.6, 5, 0, 1.8, 0, grp);
      part(g.box, K, 2.6, 1.8, 0.2, 0, 1.4, 2.55, grp); part(g.box, L, 1, 0.8, 1, 2, 3.5, -1, grp); break;
    case 'rifle': case 'rocket':
      part(g.cyl, T, 0.5, 0.9, 0.5, 0, 0.45, 0, grp); part(g.sph, mat(0xe0c0a0), 0.4, 0.4, 0.4, 0, 1.1, 0, grp);
      part(g.box, K, 0.1, 0.1, 0.6, 0.25, 0.7, 0.3, grp);
      if (type === 'rocket') { const t = part(g.cyl, L, 0.2, 0.9, 0.2, 0.3, 1.0, 0, grp); t.rotation.x = Math.PI / 2; }
      break;
    case 'tank': {
      part(g.box, T, 1.8, 0.7, 2.4, 0, 0.5, 0, grp); part(g.box, K, 0.4, 0.6, 2.6, 1, 0.35, 0, grp); part(g.box, K, 0.4, 0.6, 2.6, -1, 0.35, 0, grp);
      const tur = new THREE.Group(); tur.position.y = 1.05; grp.add(tur);
      part(g.box, T, 1.1, 0.5, 1.2, 0, 0, 0, tur); const b = part(g.cyl, K, 0.18, 1.6, 0.18, 0, 0, 1.1, tur); b.rotation.x = Math.PI / 2; break; }
    case 'harvester':
      part(g.box, mat(0xc9a227), 2, 1.2, 2.8, 0, 0.8, 0, grp); part(g.box, T, 1.4, 0.8, 1, 0, 1.6, 0.9, grp);
      part(g.box, K, 0.4, 0.6, 3, 1.1, 0.3, 0, grp); part(g.box, K, 0.4, 0.6, 3, -1.1, 0.3, 0, grp); part(g.box, L, 1.6, 0.6, 1.4, 0, 1.6, -0.6, grp); break;
  }
  const ring = new THREE.Mesh(g.ring, mat(0x55ff55, true));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.2; ring.scale.setScalar(r * 1.3); ring.visible = false;
  grp.add(ring); grp.userData.ring = ring;
  return grp;
}

export function makeGhost(type) {
  const grp = makeMesh(type, 0);
  grp.userData.ring.visible = false;
  grp.traverse(o => { if (o.isMesh) o.material = mat(0x33ff33, true, 0.45); });
  return grp;
}
export function setGhostValid(grp, ok) { const m = mat(ok ? 0x33ff33 : 0xff3333, true, 0.45); grp.traverse(o => { if (o.isMesh) o.material = m; }); }
