// Service worker: network-first for the app (so deploys show up immediately), cache fallback offline;
// cache-first for versioned CDN libraries (three.js, PeerJS).
const CACHE = 'irondom-v2';
const SHELL = ['./', './index.html', './style.css', './manifest.json', './icons/icon-192.png', './icons/icon-512.png',
  './js/main.js', './js/T.js', './js/game.js', './js/terrain.js', './js/models.js', './js/defs.js', './js/ui.js', './js/fx.js', './js/geom.js',
  './js/textures.js', './js/profile.js', './js/menu.js', './js/net.js', './js/touch.js', './js/disasters.js', './js/portraits.js',
  './js/ai/brain.js', './js/ai/commander.js', './js/ai/personality.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res; })));
  } else if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return res; }).catch(() => caches.match(req, { ignoreSearch: true })));
  }
});
