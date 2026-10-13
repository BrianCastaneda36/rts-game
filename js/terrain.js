import { THREE } from './T.js';
export const MAP = 200, HALF = 100;
export const BASES = [{ x: -60, z: 60 }, { x: 60, z: -60 }];
export const ORE_FIELDS = [{ x: -36, z: 36 }, { x: 36, z: -36 }, { x: 0, z: 0 }, { x: -55, z: -30 }, { x: 55, z: 30 }];

function hash(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, z) {
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

export class Terrain {
  constructor(scene) {
    const seg = 160;
    const geo = new THREE.PlaneGeometry(MAP, MAP, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z);
      pos.setY(i, h);
      const c = colorAt(h, x, z); cols[i * 3] = c[0]; cols[i * 3 + 1] = c[1]; cols[i * 3 + 2] = c[2];
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    scene.add(this.mesh);
    // water plane in low areas
    const water = new THREE.Mesh(new THREE.PlaneGeometry(MAP * 1.6, MAP * 1.6), new THREE.MeshLambertMaterial({ color: 0x2a5d8a, transparent: true, opacity: 0.7 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -2.2; scene.add(water);
  }
}
