/* Service worker · Comedor Torre Vrick (N3 Labs)
   Red primero para siempre tener la versión más reciente; caché como respaldo sin conexión. */
const CACHE = 'comedor-tv-v5';
const SHELL = ['./', 'index.html', 'app.js', 'core.js', 'seed.js', 'config.js', 'manifest.webmanifest',
  'assets/torre-vrick.png', 'assets/n3-labs.png', 'assets/icon-192.png', 'assets/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // Supabase y fuentes: directo a red
  e.respondWith(fetch(req).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
  }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
});
