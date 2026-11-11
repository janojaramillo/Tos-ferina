/* Service worker · CDSS Tos Ferina Neonatal
   - Funciona con o sin internet en GitHub Pages y en la pantalla de inicio del iPhone.
   - Para publicar una versión nueva, cambie VERSION: el caché viejo se borra solo. */
const VERSION = 'tosferina-v1.0.0';
const CORE = ['./', './index.html', './sw.js'];
const FONT_CACHE = 'tosferina-fonts-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      // Cada recurso por separado: si uno falla, la instalación no se cae
      Promise.all(CORE.map((url) =>
        fetch(new Request(url, { cache: 'reload' }))
          .then((res) => { if (res && res.ok) return cache.put(url, res); })
          .catch(() => {})
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k !== VERSION && k !== FONT_CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fuentes de Google: caché primero, actualización en segundo plano
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(req).then((hit) => {
          const net = fetch(req).then((res) => {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
          }).catch(() => hit);
          return hit || net;
        })
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navegación (abrir la app): red primero con límite de 3.5 s; si no hay red, la copia guardada
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      Promise.race([fetch(req), timeout(3500)])
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() =>
          caches.match('./index.html').then((hit) => hit || caches.match('./'))
            .then((hit) => hit || new Response(
              '<meta charset="utf-8"><body style="font-family:sans-serif;background:#0d1222;color:#f6efe4;padding:2rem">' +
              '<h2>Sin conexión</h2><p>Abra la app una vez con internet para guardarla en el dispositivo.</p></body>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
        )
    );
    return;
  }

  // Resto de recursos del mismo origen: caché primero
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
