// Renders each real in-game 3D model into a framed portrait (data URL) at startup. No external assets.
import { THREE } from './T.js';
import { makeMesh } from './models.js';
import { skyEnv } from './textures.js';
import { TEAM_CSS } from './defs.js';

export const BIO = {
  cy: { role: 'Command / construction', text: 'Mobile command hub with a rotating radar and crane. Lose it and your empire crumbles.' },
  power: { role: 'Energy', text: 'Twin cooling towers feed the grid. Low power halves production speed.' },
  refinery: { role: 'Economy', text: 'Processes raw ore into credits. Ships with a free harvester.' },
  barracks: { role: 'Infantry production', text: 'Trains riflemen and rocketeers behind a wall of sandbags.' },
  factory: { role: 'Vehicle production', text: 'Heavy assembly hall for tanks and harvesters.' },
  rifle: { role: 'Anti-infantry', text: 'Cheap, fast and plentiful. Shreds soft targets, plinks off armour.' },
  rocket: { role: 'Anti-armour', text: 'Shoulder-launched rockets that punch through tanks and buildings.' },
  tank: { role: 'Main battle tank', text: 'Tracked armour with a high-velocity cannon. Evolves to Mk II / Mk III.' },
  harvester: { role: 'Resource gathering', text: 'Armoured ore scoop. Protect it - it is your income.' },
};

export function renderPortraits(renderer, team, tierOf = () => 0, size = 160) {
  const out = {}, types = ['cy', 'power', 'refinery', 'barracks', 'factory', 'rifle', 'rocket', 'tank', 'harvester'];
  const prevSize = new THREE.Vector2(); renderer.getSize(prevSize); const prevPR = renderer.getPixelRatio();
  const prevClear = new THREE.Color(); renderer.getClearColor(prevClear); const prevAlpha = renderer.getClearAlpha();
  const scene = new THREE.Scene(); scene.environment = skyEnv();
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x30281e, 1.1));
  const key = new THREE.DirectionalLight(0xfff0dc, 3.2); key.position.set(4, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc8ff, 2.2); rim.position.set(-5, 3, -6); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  try {
    renderer.setPixelRatio(1); renderer.setSize(size, size, false); renderer.setClearColor(0x000000, 0);
    for (const type of types) {
      const m = makeMesh(type, team, 1, tierOf(type)); m.remove(m.userData.ring); m.rotation.y = -0.6; scene.add(m);
      const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      const R = Math.max(sz.x, sz.y, sz.z) * 0.62, dist = R / Math.tan(THREE.MathUtils.degToRad(15));
      cam.position.set(c.x + dist * 0.55, c.y + dist * 0.42, c.z + dist * 0.72); cam.lookAt(c.x, c.y - sz.y * 0.05, c.z);
      renderer.render(scene, cam);
      const cv = document.createElement('canvas'); cv.width = cv.height = size; const x = cv.getContext('2d');
      const tc = TEAM_CSS[team] || '#4aa3ff', g = x.createRadialGradient(size * 0.5, size * 0.42, 4, size * 0.5, size * 0.5, size * 0.75);
      g.addColorStop(0, '#3a4c60'); g.addColorStop(0.55, '#16202c'); g.addColorStop(1, '#05080c'); x.fillStyle = g; x.fillRect(0, 0, size, size);
      x.globalAlpha = 0.22; x.fillStyle = tc; x.fillRect(0, 0, size, size); x.globalAlpha = 1;
      x.strokeStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < size; i += 8) { x.beginPath(); x.moveTo(0, i); x.lineTo(size, i); x.stroke(); }
      x.drawImage(renderer.domElement, 0, 0, size, size);
      const v = x.createRadialGradient(size / 2, size / 2, size * 0.35, size / 2, size / 2, size * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.65)'); x.fillStyle = v; x.fillRect(0, 0, size, size);
      x.strokeStyle = tc; x.lineWidth = 3; x.strokeRect(1.5, 1.5, size - 3, size - 3);
      out[type] = cv.toDataURL('image/png');
      scene.remove(m);
    }
  } catch (e) { console.warn('Portrait rendering failed', e); }
  renderer.setPixelRatio(prevPR); renderer.setSize(prevSize.x, prevSize.y, false); renderer.setClearColor(prevClear, prevAlpha);
  return out;
}
