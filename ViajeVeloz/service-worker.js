/* =========================================================
   ViajeVeloz · Service Worker
   Estrategia:
   - Cachea el "app shell" al instalar.
   - Sirve desde caché primero (rápido y offline).
   - Actualiza el caché en segundo plano cuando hay red.
   ========================================================= */

const CACHE_NAME = 'viajeveloz-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

/* ---------- INSTALL: precachear el app shell ---------- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

/* ---------- ACTIVATE: limpiar cachés antiguas ---------- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ---------- FETCH: cache-first con fallback a red ---------- */
self.addEventListener('fetch', event => {
  const { request } = event;

  // Solo manejamos GET
  if (request.method !== 'GET') return;

  // Ignorar peticiones a otros dominios (APIs externas, etc.)
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegación (abrir la app): intentar caché, luego red, luego index
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Recursos estáticos: caché primero, luego red
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        // Guardar copia en caché si la respuesta es válida
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

/* ---------- Mensajes desde la página (para forzar update) ---------- */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
  }
});