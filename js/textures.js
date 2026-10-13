// Procedural canvas textures (no external assets). All cached.
import { THREE } from './T.js';
const C = {};
function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function hash2(i, j, s = 0) { let h = (i * 374761393 + j * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
// tileable value noise (period p)
function tnoise(x, y, p, s) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const m = k => ((k % p) + p) % p;
  const a = hash2(m(i), m(j), s), b = hash2(m(i + 1), m(j), s), c = hash2(m(i), m(j + 1), s), d = hash2(m(i + 1), m(j + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function tfbm(x, y, p, oct = 4, s = 0) { let t = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { t += a * tnoise(x * f, y * f, p * f, s + o); n += a; a *= 0.5; f *= 2; } return t / n; }
function tex(c, srgb = true, rep = 1) {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep);
  t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}
// height field (0..1) -> tangent-space normal map canvas
export function normalFromHeight(hf, w, h, strength = 2) {
  const c = canvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const l = hf[j * w + (i - 1 + w) % w], r = hf[j * w + (i + 1) % w], u = hf[((j - 1 + h) % h) * w + i], d = hf[((j + 1) % h) * w + i];
    let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1; const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
    const k = (j * w + i) * 4; img.data[k] = (nx * 0.5 + 0.5) * 255; img.data[k + 1] = (ny * 0.5 + 0.5) * 255; img.data[k + 2] = (nz * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); return c;
}
function heightCanvasTex(key, size, fn, strength, rep) {
  if (C[key]) return C[key];
  const hf = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) hf[j * size + i] = fn(i, j);
  return (C[key] = tex(normalFromHeight(hf, size, size, strength), false, rep));
}
// Fine ground detail normal (pebbles + grass streaks), tiled across terrain
export function groundNormal() {
  return heightCanvasTex('gN', 512, (i, j) => tfbm(i / 16, j / 16, 32, 5, 3) * 0.7 + hash2(i, j, 9) * 0.3, 6, 40);
}
export function waterNormal() {
  return heightCanvasTex('wN', 256, (i, j) => tfbm(i / 32, j / 32, 8, 4, 11) * 0.6 + 0.4 * (0.5 + 0.5 * Math.sin((i + tfbm(i / 20, j / 20, 13, 2, 4) * 40) / 256 * Math.PI * 12)), 3, 14);
}
// Painted metal panels (greyscale - tinted by material colour)
export function metalTex() {
  if (C.metal) return C.metal;
  const S = 256, c = canvas(S), x = c.getContext('2d'), img = x.createImageData(S, S), hf = new Float32Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const n = tfbm(i / 32, j / 32, 8, 4, 21), scr = hash2(i >> 1, j * 3, 5) > 0.997 ? -0.25 : 0;
    const seam = (i % 64 < 2 || j % 85 < 2) ? -0.28 : 0, rivet = ((i % 64 - 6) ** 2 + (j % 85 - 6) ** 2 < 5) ? 0.2 : 0;
    const g = 0.78 + (n - 0.5) * 0.25 + seam + scr + rivet, k = (j * S + i) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.max(0, Math.min(255, g * 255)); img.data[k + 3] = 255;
    hf[j * S + i] = (seam < 0 ? 0 : 1) + rivet * 2 + n * 0.2;
  }
  x.putImageData(img, 0, 0);
  C.metal = { map: tex(c, true), normal: tex(normalFromHeight(hf, S, S, 1.5), false) };
  return C.metal;
}
export function concreteTex() {
  if (C.conc) return C.conc;
  const S = 256, c = canvas(S), x = c.getContext('2d'), img = x.createImageData(S, S), hf = new Float32Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const n = tfbm(i / 24, j / 24, 10.6667, 5, 31), sp = hash2(i, j, 7), joint = (i % 128 < 2 || j % 128 < 2) ? -0.2 : 0, stain = Math.max(0, tfbm(i / 64, j / 64, 4, 3, 2) - 0.55) * -0.8;
    const g = 0.72 + (n - 0.5) * 0.3 + (sp - 0.5) * 0.08 + joint + stain, k = (j * S + i) * 4;
    img.data[k] = g * 250; img.data[k + 1] = g * 246; img.data[k + 2] = g * 238; img.data[k + 3] = 255; hf[j * S + i] = n * 0.5 + sp * 0.2 + (joint ? -0.5 : 0);
  }
  x.putImageData(img, 0, 0);
  C.conc = { map: tex(c, true), normal: tex(normalFromHeight(hf, S, S, 2), false) };
  return C.conc;
}
// corrugated roofing
export function corrugTex() {
  if (C.corr) return C.corr;
  const S = 128, c = canvas(S), x = c.getContext('2d'), img = x.createImageData(S, S), hf = new Float32Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const w = Math.sin(i / S * Math.PI * 16), rust = Math.max(0, tfbm(i / 16, j / 16, 8, 4, 41) - 0.55) * 2.2, k = (j * S + i) * 4, g = 0.7 + w * 0.08;
    img.data[k] = (g + rust * 0.3) * 230; img.data[k + 1] = (g - rust * 0.1) * 230; img.data[k + 2] = (g - rust * 0.35) * 230; img.data[k + 3] = 255; hf[j * S + i] = w * 0.5 + 0.5;
  }
  x.putImageData(img, 0, 0);
  C.corr = { map: tex(c, true), normal: tex(normalFromHeight(hf, S, S, 3), false) };
  return C.corr;
}
// window strip: dark glass panes with frames, emissive lit panes
export function windowTex() {
  if (C.win) return C.win;
  const c = canvas(128, 64), x = c.getContext('2d'), e = canvas(128, 64), ex = e.getContext('2d');
  x.fillStyle = '#5a5f66'; x.fillRect(0, 0, 128, 64); ex.fillStyle = '#000'; ex.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 4; i++) {
    const g = x.createLinearGradient(0, 8, 0, 56); g.addColorStop(0, '#9fc3dd'); g.addColorStop(1, '#1d2a35');
    x.fillStyle = g; x.fillRect(i * 32 + 4, 8, 24, 48);
    if (hash2(i, 3, 1) > 0.4) { ex.fillStyle = '#ffd890'; ex.fillRect(i * 32 + 4, 8, 24, 48); }
  }
  C.win = { map: tex(c, true), emissive: tex(e, true) };
  return C.win;
}
export function hazardTex() {
  if (C.haz) return C.haz;
  const c = canvas(128, 32), x = c.getContext('2d'); x.fillStyle = '#e8b923'; x.fillRect(0, 0, 128, 32); x.fillStyle = '#1a1a1a';
  for (let i = -2; i < 10; i++) { x.beginPath(); x.moveTo(i * 16, 32); x.lineTo(i * 16 + 8, 32); x.lineTo(i * 16 + 16, 0); x.lineTo(i * 16 + 8, 0); x.fill(); }
  return (C.haz = tex(c, true));
}
// radial soft sprite (smoke / glow)
export function softTex() {
  if (C.soft) return C.soft;
  const S = 128, c = canvas(S), x = c.getContext('2d'), img = x.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = i / S * 2 - 1, dy = j / S * 2 - 1, r = Math.hypot(dx, dy), n = tfbm(i / 16, j / 16, 8, 4, 51);
    const a = Math.max(0, 1 - r) ** 1.5 * (0.55 + n * 0.9), k = (j * S + i) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.min(255, a * 255);
  }
  x.putImageData(img, 0, 0); const t = tex(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return (C.soft = t);
}
export function flareTex() {
  if (C.flare) return C.flare;
  const S = 128, c = canvas(S), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.2, 'rgba(255,220,140,0.9)'); g.addColorStop(0.5, 'rgba(255,130,40,0.35)'); g.addColorStop(1, 'rgba(255,80,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(255,240,200,0.5)'; x.lineWidth = 3;
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(a) * 60, 64 + Math.sin(a) * 60); x.stroke(); }
  const t = tex(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return (C.flare = t);
}
export function scorchTex() {
  if (C.scorch) return C.scorch;
  const S = 128, c = canvas(S), x = c.getContext('2d'), img = x.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = i / S * 2 - 1, dy = j / S * 2 - 1, ang = Math.atan2(dy, dx), r = Math.hypot(dx, dy) * (0.8 + 0.4 * tfbm(ang * 3 + 10, 1, 64, 3, 61));
    const n = tfbm(i / 12, j / 12, 10.6667, 4, 62), a = Math.max(0, 1 - r) ** 0.7 * (0.6 + n * 0.5), k = (j * S + i) * 4;
    img.data[k] = 18; img.data[k + 1] = 14; img.data[k + 2] = 10; img.data[k + 3] = Math.min(255, a * 235);
  }
  x.putImageData(img, 0, 0); const t = tex(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return (C.scorch = t);
}
export function grassBladeTex() {
  if (C.blade) return C.blade;
  const c = canvas(64, 64), x = c.getContext('2d');
  for (let i = 0; i < 22; i++) {
    const bx = 6 + hash2(i, 1, 70) * 52, lean = (hash2(i, 2, 70) - 0.5) * 18, h = 30 + hash2(i, 3, 70) * 32, g = 90 + hash2(i, 4, 70) * 70;
    x.fillStyle = `rgb(${g * 0.55 | 0},${g | 0},${g * 0.3 | 0})`; x.beginPath(); x.moveTo(bx - 2, 64); x.quadraticCurveTo(bx + lean * 0.3, 64 - h * 0.6, bx + lean, 64 - h); x.lineTo(bx + 2, 64); x.fill();
  }
  const t = tex(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return (C.blade = t);
}
export function barkTex() {
  if (C.bark) return C.bark;
  const S = 64, c = canvas(S), x = c.getContext('2d'), img = x.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const n = tfbm(i / 4, j / 32, 16, 3, 81), g = 0.5 + n * 0.5, k = (j * S + i) * 4; img.data[k] = g * 120; img.data[k + 1] = g * 88; img.data[k + 2] = g * 62; img.data[k + 3] = 255; }
  x.putImageData(img, 0, 0); return (C.bark = tex(c, true));
}
export function foliageTex() {
  if (C.fol) return C.fol;
  const S = 128, c = canvas(S), x = c.getContext('2d'), img = x.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const n = tfbm(i / 8, j / 8, 16, 4, 91), sp = hash2(i, j, 92), g = 0.55 + n * 0.6 + (sp > 0.93 ? 0.25 : 0), k = (j * S + i) * 4; img.data[k] = g * 105; img.data[k + 1] = g * 140; img.data[k + 2] = g * 90; img.data[k + 3] = 255; }
  x.putImageData(img, 0, 0); return (C.fol = tex(c, true));
}
export function camoTex() {
  if (C.camo) return C.camo;
  const S = 128, c = canvas(S), x = c.getContext('2d'), img = x.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const n = tfbm(i / 20, j / 20, 6.4, 3, 101), g = n > 0.55 ? 0.72 : n > 0.42 ? 0.87 : 1, k = (j * S + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = g * 255; img.data[k + 3] = 255; }
  x.putImageData(img, 0, 0); return (C.camo = tex(c, true));
}
// equirect sky used as environment (reflections / IBL) for PBR materials
export function skyEnv() {
  if (C.sky) return C.sky;
  const W = 512, H = 256, c = canvas(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3d6fa8'); g.addColorStop(0.42, '#9cc3e6'); g.addColorStop(0.5, '#dfe8ee'); g.addColorStop(0.53, '#7d8a72'); g.addColorStop(1, '#3b4232');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { const cx = hash2(i, 0, 111) * W, cy = 40 + hash2(i, 1, 111) * 70, r = 15 + hash2(i, 2, 111) * 40, rg = x.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, 'rgba(255,255,255,0.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = rg; x.fillRect(cx - r, cy - r, r * 2, r * 2); }
  const sg = x.createRadialGradient(W * 0.62, H * 0.18, 0, W * 0.62, H * 0.18, 40); sg.addColorStop(0, 'rgba(255,250,230,1)'); sg.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = sg; x.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return (C.sky = t);
}
