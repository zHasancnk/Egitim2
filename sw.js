/* Güneşim Öğreniyor PWA — servis çalışanı (çevrimdışı kabuk) */
const SURUM = 'gunesim-v3';
const KABUK = [
  './', 'index.html', 'manifest.webmanifest',
  'stiller.css',
  'icerik.js', 'db.js', 'ses.js', 'zip.js', 'app.js', 'panel.js',
  'ikon-192.svg', 'ikon-512.svg'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SURUM).then((c) => c.addAll(KABUK)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((adlar) =>
    Promise.all(adlar.filter((a) => a !== SURUM).map((a) => caches.delete(a)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((yanit) =>
      yanit || fetch(e.request).then((ag) => {
        const kopya = ag.clone();
        caches.open(SURUM).then((c) => c.put(e.request, kopya)).catch(() => {});
        return ag;
      }).catch(() => caches.match('index.html'))
    )
  );
});
