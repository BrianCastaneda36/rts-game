import { setTHREE } from './T.js';
import { profile } from './profile.js';
import { Menu } from './menu.js';

async function boot() {
  profile.load();
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
  const coarse = matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
  document.getElementById('view').appendChild(renderer.domElement);
  document.getElementById('loading').remove();
  const startGame = async (opts) => {
    const { Game } = await import('./game.js');
    document.body.classList.add('ingame');
    const game = new Game(renderer, name, opts);
    window.game = game;
    if (coarse) game.setQuality('Low');
    const { Touch } = await import('./touch.js'); game.touch = new Touch(game);
    renderer.setAnimationLoop(() => game.frame());
    return game;
  };
  window.menu = new Menu(startGame);
  // PWA: register the service worker (relative so it works under /rts-game/)
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW registration failed', e));
}
boot().catch(e => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'Failed: ' + e.message; });
