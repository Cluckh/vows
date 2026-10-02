/* ORDO — офлайн.
   Стратегія: СПЕРШУ МЕРЕЖА (щоб оновлення зʼявлялись одразу після заливки),
   кеш — запасний для офлайну. Версію за бажання можна бампати (ordo-v2 → v3…). */
const CACHE = "ordo-v7";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./app.js", "./data.js",
  "./manifest.webmanifest", "./emblem.svg",
  "./icon-180.png", "./icon-192.png", "./icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  e.respondWith(
    fetch(req)
      .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r; })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
