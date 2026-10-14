const C = 'benimle-ogren-v4';
const FILES = ['./', './index.html', './core.js', './data.js', './passage.js', './voice.js', './qr.js', './app.js', './sync.js', './fx.js', './learn.js', './main.js', './learn.css', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* Yalnızca kendi dosyalarımız önbelleğe alınır. Köprü (başka adres) istekleri hiç önbelleğe girmez. */
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request).then(m => m || caches.match('./index.html')))
  );
});
