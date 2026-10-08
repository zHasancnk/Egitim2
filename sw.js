/* Güneşim Öğreniyor PWA — servis çalışanı (çevrimdışı kabuk) */
const SURUM = 'gunesim-v1';
const KABUK = [
  './', 'index.html', 'manifest.webmanifest',
  'css/stiller.css',
  'js/icerik.js', 'js/db.js', 'js/ses.js', 'js/zip.js', 'js/app.js', 'js/panel.js',
  'ikon/ikon-192.svg', 'ikon/ikon-512.svg'
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
