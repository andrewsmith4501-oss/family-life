// Lets the game open without internet after the first visit.
// Bump VERSION whenever files change so phones pick up the update.
const VERSION = "v14";
const FILES = ["./", "index.html", "style.css", "manifest.webmanifest", "js/app.js", "js/characters.js", "js/avatar.js", "js/state.js", "js/sim.js", "js/house.js", "js/house3d.js", "js/models.js", "js/textures.js", "js/life.js", "vendor/three.module.min.js", "vendor/RoomEnvironment.js", "vendor/RoundedBoxGeometry.js",
  "icons/icon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// Network first, so updates show up right away; fall back to the saved copy when offline.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // "no-cache" makes the browser check with the server every time, so a stale copy is never shown after an update.
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => {
    const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request)));
});
