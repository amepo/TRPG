/* Service worker: precache the whole app so the game keeps working with no
   network at all (installed to the home screen, on a train, on a plane).
   Everything is static — there is no API to talk to, ever. */

const VERSION = 'tomoshibi-v1';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/trpg.css',
  './js/main.js',
  './js/core/rng.js',
  './js/core/dice.js',
  './js/core/rules.js',
  './js/core/content.js',
  './js/core/character.js',
  './js/core/combat.js',
  './js/core/scenario.js',
  './js/core/engine.js',
  './js/core/store.js',
  './js/ui/dom.js',
  './js/ui/sheet.js',
  './js/ui/home.js',
  './js/ui/builder.js',
  './js/ui/solo.js',
  './js/ui/table.js',
  './js/ui/editor.js',
  './js/scenarios/index.js',
  './js/scenarios/first-job.js',
  './js/scenarios/silent-bell.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // addAll fails the whole install if any single file 404s; be forgiving.
    await Promise.all(SHELL.map(url => cache.add(url).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: serve the app shell so a deep link (#table, #editor) works
  // offline too — the router reads the hash once the shell has booted.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Static assets: cache first, then network (and remember what we fetched).
  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(VERSION);
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
