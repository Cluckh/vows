/* ORDO — офлайн і миттєві оновлення.
   Стратегія: СПЕРШУ МЕРЕЖА в обхід HTTP-кешу (GitHub Pages тримає файли 10 хв),
   тож нова версія приходить одразу після деплою; кеш — запасний для офлайну.
   Версію бампати при кожній зміні (+1 до номера нижче): так телефон дізнається
   про оновлення й тихо перезавантажить додаток. */
const CACHE = "ordo-v35";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./app.js", "./hall.js", "./boot.js", "./vault.json",
  "./manifest.webmanifest",
  "./icon-180.png", "./icon-192.png", "./icon-512.png",
  "./fonts/CormorantSC-500-cyrillic.woff2",
  "./fonts/CormorantSC-500-latin.woff2",
  "./fonts/CormorantSC-600-cyrillic.woff2",
  "./fonts/CormorantSC-600-latin.woff2",
  "./fonts/CormorantSC-700-cyrillic.woff2",
  "./fonts/CormorantSC-700-latin.woff2",
  "./fonts/EBGaramond-500-cyrillic.woff2",
  "./fonts/EBGaramond-500-latin.woff2",
  "./fonts/EBGaramond-500i-cyrillic.woff2",
  "./fonts/EBGaramond-500i-latin.woff2"
];

self.addEventListener("install", (e) => {
  /* по одному: якщо якийсь файл недоступний, установка все одно не падає */
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(ASSETS.map((a) => c.add(new Request(a, { cache: "reload" })))))
      .then(() => self.skipWaiting())
  );
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
  /* чужі адреси (GitHub API зі сховищем) не чіпаємо й не кешуємо */
  if (new URL(req.url).origin !== self.location.origin) return;
  /* свої файли — завжди свіжі з мережі (з перевіркою, без 10-хв кешу) */
  const net = fetch(req.url, { cache: "no-cache", credentials: "same-origin" });
  e.respondWith(
    net
      .then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req)
        .then((hit) => hit || caches.match(req, { ignoreSearch: true }))
        .then((hit) => hit || caches.match("./index.html")))
  );
});

/* вісті від храмовників: показати сповіщення; тап — відкрити Орден на потрібній сцені */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Орден", {
    body: d.body || "", icon: "./icon-192.png", badge: "./icon-192.png", tag: d.tag || "ordo", data: { url: d.url || "./" }
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if ("focus" in c) { c.postMessage({ type: "ordo-open", url }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
