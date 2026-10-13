import { THREE } from './T.js';
import { groundNormal, waterNormal, barkTex, foliageTex, grassBladeTex, hash2 } from './textures.js';
import { merge } from './geom.js';
export const MAP = 200, HALF = 100;
export const BASES = [{ x: -60, z: 60 }, { x: 60, z: -60 }];
export const ORE_FIELDS = [{ x: -36, z: 36 }, { x: 36, z: -36 }, { x: 0, z: 0 }, { x: -55, z: -30 }, { x: 55, z: 30 }];

export function hash(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
export function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function sstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

export function heightAt(x, z) {
  let h = 3.5 * Math.sin(x * 0.045 + 0.5) * Math.cos(z * 0.05) + 2 * Math.sin(x * 0.1 + 1.3) * Math.sin(z * 0.085 + 0.7);
  h += (vnoise(x * 0.06, z * 0.06) - 0.5) * 6 + (vnoise(x * 0.17 + 50, z * 0.17) - 0.5) * 1.5;
  const e = Math.max(Math.abs(x), Math.abs(z)); h += sstep(82, 100, e) * 14;
  let flat = 0;
  for (const b of BASES) flat = Math.max(flat, 1 - sstep(24, 36, Math.hypot(x - b.x, z - b.z)));
  for (const o of ORE_FIELDS) flat = Math.max(flat, (1 - sstep(8, 16, Math.hypot(x - o.x, z - o.z))) * 0.75);
  return h * (1 - flat) + 1 * flat;
}

export function colorAt(h, x, z) {
  const n = (vnoise(x * 0.3, z * 0.3) - 0.5) * 0.08;
  if (h < -1.5) return [0.72 + n, 0.66 + n, 0.46 + n];
  if (h < 4) return [0.30 + n, 0.48 + n, 0.20 + n];
  if (h < 8) return [0.46 + n, 0.39 + n, 0.26 + n];
  if (h < 12) return [0.52 + n, 0.52 + n, 0.5 + n];
  return [0.9, 0.9, 0.92];
}

export function rayGround(ray) {
  const o = ray.origin, d = ray.direction; let prev = 0;
  for (let t = 0; t < 900; t += 1) {
    if (o.y + d.y * t <= heightAt(o.x + d.x * t, o.z + d.z * t)) {
      let a = prev, b = t;
      for (let k = 0; k < 10; k++) { const m = (a + b) / 2; if (o.y + d.y * m <= heightAt(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; }
      return new THREE.Vector3(o.x + d.x * b, o.y + d.y * b, o.z + d.z * b);
    }
    prev = t;
  }
  return null;
}


const fbm = (x, z, o = 4) => { let t = 0, a = 0.5, f = 1, n = 0; for (let k = 0; k < o; k++) { t += a * vnoise(x * f + k * 17.3, z * f - k * 9.1); n += a; a *= 0.5; f *= 2; } return t / n; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const nearBase = (x, z) => Math.min(...BASES.map(b => Math.hypot(x - b.x, z - b.z)));
const nearOre = (x, z) => Math.min(...ORE_FIELDS.map(o => Math.hypot(x - o.x, z - o.z)));

// Bake a high-resolution albedo map: grass / dirt / rock-on-slopes / sand near water, with noise breakup.
function bakeAlbedo(S = 2048) {
  const G = 512, hg = new Float32Array((G + 1) * (G + 1));
  for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) hg[j * (G + 1) + i] = heightAt(-HALF + i / G * MAP, -HALF + j / G * MAP);
  const H = (gx, gz) => { gx = Math.max(0, Math.min(G - 0.001, gx)); gz = Math.max(0, Math.min(G - 0.001, gz)); const i = gx | 0, j = gz | 0, fx = gx - i, fz = gz - j, k = j * (G + 1) + i;
    return (hg[k] * (1 - fx) + hg[k + 1] * fx) * (1 - fz) + (hg[k + G + 1] * (1 - fx) + hg[k + G + 2] * fx) * fz; };
  const c = document.createElement('canvas'); c.width = c.height = S; const ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
  const cell = MAP / G;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = -HALF + (i + 0.5) / S * MAP, z = -HALF + (j + 0.5) / S * MAP, gx = (i + 0.5) / S * G, gz = (j + 0.5) / S * G;
    const h = H(gx, gz), sx = (H(gx + 1, gz) - H(gx - 1, gz)) / (2 * cell), sz = (H(gx, gz + 1) - H(gx, gz - 1)) / (2 * cell), slope = Math.hypot(sx, sz);
    const n1 = fbm(x * 0.05, z * 0.05), n2 = fbm(x * 0.4, z * 0.4, 3), n3 = vnoise(x * 2.2, z * 2.2), px = hash(i, j);
    // grass: lush/dry variation
    let col = mix([0.20, 0.33, 0.11], [0.38, 0.42, 0.18], Math.min(1, Math.max(0, (n1 - 0.4) * 3)));
    col = mix(col, [0.15, 0.26, 0.09], Math.max(0, n2 - 0.55) * 2);
    col = col.map(v => v * (0.86 + n3 * 0.22 + (px - 0.5) * 0.1));
    // dirt patches + packed earth around bases and ore fields
    const dirtT = Math.min(1, Math.max(0, (fbm(x * 0.09 + 40, z * 0.09) - 0.58) * 6) + Math.max(0, 1 - Math.abs(nearBase(x, z) - 30) / 6) * 0.75 * n2 + (nearBase(x, z) < 27 ? 0.35 + 0.3 * n2 : 0));
    const dirt = [0.40 + n3 * 0.08, 0.31 + n3 * 0.06, 0.20 + n3 * 0.04];
    col = mix(col, dirt, Math.min(1, dirtT));
    const oreT = Math.max(0, 1 - nearOre(x, z) / 13) * (0.5 + n2 * 0.6);
    col = mix(col, [0.48, 0.36, 0.16], Math.min(0.85, oreT));
    // rock on slopes and highlands, layered strata
    const strata = 0.5 + 0.5 * Math.sin(h * 3.1 + n2 * 2.5);
    const rock = mix([0.36, 0.34, 0.32], [0.52, 0.5, 0.46], strata * 0.6 + n3 * 0.4).map(v => v * (0.85 + (px - 0.5) * 0.2));
    const rockT = Math.min(1, Math.max(0, (slope - 0.55 + (n2 - 0.5) * 0.4) * 3.5) + Math.max(0, (h - 9 + n1 * 3) * 0.35));
    col = mix(col, rock, rockT);
    // snow caps on outer peaks
    col = mix(col, [0.88, 0.9, 0.93], Math.min(1, Math.max(0, (h - 13.5 + n2 * 2) * 0.6)) * Math.max(0, 1 - slope * 0.6));
    // sand near water, wet sand at waterline, foam line
    const sandT = Math.min(1, Math.max(0, (-0.4 - h + (n2 - 0.5) * 1.2) * 0.9));
    col = mix(col, [0.74 + n3 * 0.05, 0.66 + n3 * 0.05, 0.47 + n3 * 0.04], sandT);
    if (h < -1.9) col = mix(col, [0.45, 0.42, 0.33], Math.min(1, (-1.9 - h) * 2));
    if (h < -2.2) col = mix(col, [0.22, 0.27, 0.25], Math.min(1, (-2.2 - h) * 0.6));
    // cheap baked AO from local concavity
    const lap = (H(gx + 2, gz) + H(gx - 2, gz) + H(gx, gz + 2) + H(gx, gz - 2)) / 4 - h;
    const ao = Math.max(0.7, Math.min(1.08, 1 - lap * 0.5));
    const k = (j * S + i) * 4;
    d[k] = Math.min(255, col[0] * ao * 255); d[k + 1] = Math.min(255, col[1] * ao * 255); d[k + 2] = Math.min(255, col[2] * ao * 255); d[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function canPlant(x, z, minB = 40, minO = 15) {
  if (Math.abs(x) > 97 || Math.abs(z) > 97) return false;
  if (nearBase(x, z) < minB || nearOre(x, z) < minO) return false;
  return heightAt(x, z) > -1.4;
}
function slopeAt(x, z) { return Math.hypot(heightAt(x + 0.5, z) - heightAt(x - 0.5, z), heightAt(x, z + 0.5) - heightAt(x, z - 0.5)); }

export class Terrain {
  constructor(scene) {
    const seg = 256;
    const geo = new THREE.PlaneGeometry(MAP, MAP, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const gn = groundNormal();
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: bakeAlbedo(), normalMap: gn, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.94, metalness: 0, envMapIntensity: 0.5 }));
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
    // skirt / outer ground so the map edge never shows sky
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(MAP * 6, MAP * 6), new THREE.MeshStandardMaterial({ color: 0x5c6650, roughness: 1 }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = 6; outer.renderOrder = -1;
    const ring = new THREE.RingGeometry(MAP * 0.72, MAP * 3, 64, 1); ring.rotateX(-Math.PI / 2);
    outer.geometry = ring; outer.rotation.x = 0; scene.add(outer);
    // water: glossy PBR with animated normal map and sky reflections
    const wn = waterNormal();
    this.waterMat = new THREE.MeshStandardMaterial({ color: 0x1b4a63, roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.82, normalMap: wn, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.6 });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(MAP * 1.44, MAP * 1.44), this.waterMat);
    water.rotation.x = -Math.PI / 2; water.position.y = -2.2; water.receiveShadow = true; scene.add(water); this.water = water;
    this.scatter(scene);
  }
  scatter(scene) {
    let seed = 1;
    const rnd = () => hash2(seed++, 7, 1234);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    const place = (n, minB, minO, accept) => { const out = []; let tries = 0; while (out.length < n && tries++ < n * 30) { const x = (rnd() - 0.5) * MAP, z = (rnd() - 0.5) * MAP; if (canPlant(x, z, minB, minO) && accept(x, z)) out.push([x, z]); } return out; };
    const inst = (geom, material, pts, fn, shadow = true) => {
      const im = new THREE.InstancedMesh(geom, material, pts.length);
      pts.forEach(([x, z], i) => { fn(x, z, i); m4.compose(p, q, s); im.setMatrixAt(i, m4); if (im.instanceColor !== undefined) im.setColorAt(i, col); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = shadow; im.receiveShadow = true; scene.add(im); return im;
    };
    const bark = new THREE.MeshStandardMaterial({ map: barkTex(), roughness: 0.95 });
    const fol = new THREE.MeshStandardMaterial({ map: foliageTex(), roughness: 0.85, flatShading: true });
    // conifers: trunk + three stacked cones merged
    const pine = merge([0, 1, 2].map(k => { const g = new THREE.ConeGeometry(1.5 - k * 0.38, 2.2, 9, 1); g.translate(0, 1.8 + k * 1.15, 0); jitter(g, 0.12, k); return g; }));
    const trunk = new THREE.CylinderGeometry(0.12, 0.2, 1.6, 6); trunk.translate(0, 0.8, 0);
    const broad = (() => { const g = merge([[0, 2.4, 0, 1.25], [0.6, 2.1, 0.3, 0.9], [-0.5, 2.2, -0.4, 0.95], [0.1, 3.0, -0.1, 0.85]].map(([x, y, z, r], k) => { const b = new THREE.IcosahedronGeometry(r, 1); jitter(b, 0.18, k + 5); b.translate(x, y, z); return b; })); return g; })();
    const forest = (x, z) => fbm(x * 0.03 + 7, z * 0.03) > 0.47 || Math.max(Math.abs(x), Math.abs(z)) > 80;
    const pinePts = place(520, 40, 15, (x, z) => forest(x, z) && slopeAt(x, z) < 1.6);
    const broadPts = place(220, 40, 15, (x, z) => forest(x, z) && heightAt(x, z) < 8);
    const sc = [];
    const treeFn = (pts, sMin, sVar) => (x, z, i) => { const k = sMin + hash2(i, 1, pts.length) * sVar; sc[i] = k; p.set(x, heightAt(x, z) - 0.1, z); e.set((hash2(i, 2, 3) - 0.5) * 0.08, hash2(i, 3, 3) * 6.28, (hash2(i, 4, 3) - 0.5) * 0.08); q.setFromEuler(e); s.set(k, k * (0.9 + hash2(i, 5, 3) * 0.3), k); col.setHSL(0.24 + hash2(i, 6, 3) * 0.08, 0.35 + hash2(i, 7, 3) * 0.2, 0.32 + hash2(i, 8, 3) * 0.12); };
    inst(trunk, bark, pinePts, treeFn(pinePts, 0.7, 0.6)); inst(pine, fol, pinePts, treeFn(pinePts, 0.7, 0.6));
    const bt = trunk.clone(); bt.scale(1.3, 1.25, 1.3);
    inst(bt, bark, broadPts, treeFn(broadPts, 0.7, 0.5)); inst(broad, fol, broadPts, treeFn(broadPts, 0.7, 0.5));
    // rocks / boulders
    const rockG = new THREE.DodecahedronGeometry(1, 1); jitter(rockG, 0.25, 77); rockG.scale(1, 0.62, 1);
    const rockM = new THREE.MeshStandardMaterial({ color: 0x8a857d, roughness: 0.9, flatShading: true, normalMap: groundNormal(), normalScale: new THREE.Vector2(1.5, 1.5) });
    const rockPts = place(380, 34, 12, (x, z) => slopeAt(x, z) > 0.35 || hash2(x * 10 | 0, z * 10 | 0, 5) > 0.75);
    inst(rockG, rockM, rockPts, (x, z, i) => { const k = 0.25 + hash2(i, 1, 9) ** 3 * 1.6; p.set(x, heightAt(x, z) - k * 0.15, z); e.set(hash2(i, 2, 9), hash2(i, 3, 9) * 6.28, hash2(i, 4, 9) * 0.5); q.setFromEuler(e); s.set(k * (0.8 + hash2(i, 5, 9) * 0.6), k, k * (0.8 + hash2(i, 6, 9) * 0.6)); col.setHSL(0.08, 0.06 + hash2(i, 7, 9) * 0.08, 0.38 + hash2(i, 8, 9) * 0.2); });
    // bushes
    const bushG = new THREE.IcosahedronGeometry(0.6, 1); jitter(bushG, 0.15, 33); bushG.scale(1, 0.7, 1);
    const bushPts = place(420, 32, 11, () => true);
    inst(bushG, fol, bushPts, (x, z, i) => { const k = 0.6 + hash2(i, 1, 13) * 0.9; p.set(x, heightAt(x, z) + 0.15 * k, z); q.identity(); s.set(k, k, k); col.setHSL(0.22 + hash2(i, 2, 13) * 0.1, 0.4, 0.26 + hash2(i, 3, 13) * 0.1); });
    // grass tufts (alpha-tested crossed quads; no shadows for speed)
    const blade = new THREE.PlaneGeometry(1.1, 0.75); blade.translate(0, 0.37, 0);
    const b2 = blade.clone(); b2.rotateY(Math.PI / 2); const b3 = blade.clone(); b3.rotateY(Math.PI / 4);
    const tuft = merge([blade, b2, b3]);
    const grassM = new THREE.MeshStandardMaterial({ map: grassBladeTex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 });
    const gPts = place(7000, 6, 7, (x, z) => { const h = heightAt(x, z); return h > -1.0 && h < 8 && slopeAt(x, z) < 0.6 && nearBase(x, z) > 27; });
    inst(tuft, grassM, gPts, (x, z, i) => { const k = 0.6 + hash2(i, 1, 17) * 0.8; p.set(x, heightAt(x, z) - 0.05, z); e.set(0, hash2(i, 2, 17) * 6.28, 0); q.setFromEuler(e); s.set(k, k * (0.7 + hash2(i, 3, 17) * 0.7), k); col.setHSL(0.2 + hash2(i, 4, 17) * 0.07, 0.45, 0.42 + hash2(i, 5, 17) * 0.15); }, false);
  }
  update(dt, t) {
    const n = this.waterMat.normalMap; n.offset.x = t * 0.012; n.offset.y = t * 0.007;
  }
}
function jitter(g, amt, seed) {
  const p = g.attributes.position, map = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!map.has(key)) map.set(key, [(hash2(i, 1, seed) - 0.5) * amt * 2, (hash2(i, 2, seed) - 0.5) * amt * 2, (hash2(i, 3, seed) - 0.5) * amt * 2]);
    const o = map.get(key); p.setXYZ(i, p.getX(i) + o[0], p.getY(i) + o[1], p.getZ(i) + o[2]);
  }
  g.computeVertexNormals();
}
