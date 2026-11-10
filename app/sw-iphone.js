/* ARKEN CONTROL · trabajador de la versión para iPhone (lo genera herramientas/preparar-iphone.mjs).
   Guarda todo el programa en el teléfono para que abra sin internet. Cada vez que la app abre,
   Safari revisa si este archivo cambió; si cambió, hay versión nueva: la descarga completa en
   segundo plano y la deja lista. Los datos del usuario (IndexedDB) no se tocan. */
const VERSION = '__VERSION__';
const ARCHIVOS = __ARCHIVOS__;
const CACHE = 'arken-control-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ARCHIVOS.map((a) => new Request(a, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('arken-control-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/version.json')) return; // siempre de internet
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      if (req.mode === 'navigate') {
        const inicio = await c.match('./');
        if (inicio) return inicio;
      }
      const guardado = await c.match(req, { ignoreSearch: true });
      return guardado || fetch(req);
    }),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'version') e.source && e.source.postMessage({ arkenVersion: VERSION });
});
