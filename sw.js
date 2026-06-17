/* ORDO — офлайн. Оновлюючи додаток, зміни 'ordo-v1' на 'ordo-v2' тощо. */
const CACHE = "ordo-v3";
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

  // Навігації: спершу мережа (щоб бачити оновлення), кеш — як запасний.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r; })
                .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Решта: спершу кеш, інакше мережа (і кешуємо на майбутнє, зокрема шрифти).
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r; }).catch(() => hit)
    )
  );
});
