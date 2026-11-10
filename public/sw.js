// public/sw.js
const CACHE_NAME = "brawl-zone-v5";
const ASSETS = [
  "/",
  "/index.html",
  "/css/style.css",
  "/css/joystick.css",
  "/js/main.js",
  "/js/audio.js",
  "/js/input.js",
  "/js/renderer.js",
  "/js/network.js",
  "/js/particles.js",
  "/icons/icon.svg",
  "/manifest.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // Network first, fallback to cache
  if (e.request.url.includes("/socket.io/") || e.request.url.includes("/api/")) {
    return; // Pass through dynamic socket & api calls
  }

  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

