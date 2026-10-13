import { setTHREE } from './T.js';

async function boot() {
  let THREE = null, renderer = null, name = '';
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        THREE = await import('three/webgpu');
        renderer = new THREE.WebGPURenderer({ antialias: true });
        await renderer.init();
        name = renderer.backend && renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGPURenderer (WebGL2 backend)';
      }
    } catch (e) { console.warn('WebGPU unavailable, falling back to WebGL:', e); renderer = null; }
  }
  if (!renderer) {
    THREE = await import('three');
    renderer = new THREE.WebGLRenderer({ antialias: true });
    name = 'WebGL';
  }
  setTHREE(THREE);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.getElementById('view').appendChild(renderer.domElement);
  const { Game } = await import('./game.js');
  const game = new Game(renderer, name);
  window.game = game;
  document.getElementById('loading').remove();
  renderer.setAnimationLoop(() => game.frame());
}
boot().catch(e => { console.error(e); document.getElementById('loading').textContent = 'Failed: ' + e.message; });
