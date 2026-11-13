/* Service worker manuel.
   A single VERSION, taken from the registration URL (?v=), is used for
   the cache name, the precache query strings, and the page's
   navigator.serviceWorker.register('./sw.js?v=' + VERSION).
   HTML is network-first. skipWaiting + clients.claim on install/activate.
   Old caches are deleted on activate. */
const VERSION = new URL(self.location.href).searchParams.get('v') || '0';
const VER = 'titor-c204-jeu-v' + VERSION;
const PRECACHE = [
  './',
  './index.html',
  './style.css?v=' + VERSION,
  './main.js?v=' + VERSION,
  './data.js',
  './assets/c204-v2.glb',
  './assets/corvette-v2.glb',
  './assets/ibm5100.glb',
  './vendor/detect-gpu.esm.js',
  './vendor/draco/gltf/draco_decoder.js',
  './vendor/draco/gltf/draco_decoder.wasm',
  './vendor/draco/gltf/draco_wasm_wrapper.js',
  './vendor/basis/basis_transcoder.js',
  './vendor/basis/basis_transcoder.wasm',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VER);
    await Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VER).map((k) => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // only same-origin + the pinned three@0.170.0 CDN
  const threeCdn = url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('three@0.170.0/');
  if (url.origin !== self.location.origin && !threeCdn) return;

  const isDoc = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isDoc) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(VER);
        c.put(req, fresh.clone());
        return fresh;
      } catch {
        return (await caches.match(req)) || (await caches.match('./index.html'));
      }
    })());
    return;
  }

  // versioned / vendor / glb / benchmarks : cache-first
  const path = url.pathname;
  const known = /\/(assets|vendor|detect-gpu-benchmarks)\//.test(path)
    || /[?&]v=/.test(url.search)
    || threeCdn;
  if (!known) {
    // network-first for unversioned modules (data.js, etc.)
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          const c = await caches.open(VER);
          c.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        return caches.match(req);
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      const c = await caches.open(VER);
      c.put(req, fresh.clone());
    }
    return fresh;
  })());
});
