// Minimal geometry merge (positions/normals/uvs), no addons needed.
import { THREE } from './T.js';
export function merge(list) {
  const parts = list.map(g => (g.index ? g.toNonIndexed() : g));
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
  for (const g of parts) {
    if (!g.attributes.normal) g.computeVertexNormals();
    P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) U.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  out.computeBoundingSphere(); return out;
}
