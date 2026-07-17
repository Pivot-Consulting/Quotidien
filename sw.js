/* Mon Quotidien v5 — service worker */
const VERSION = "v5.0.0";
const STATIC_CACHE = `mon-quotidien-static-${VERSION}`;
const RUNTIME_CACHE = `mon-quotidien-runtime-${VERSION}`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./app.css",
  "./app-core.js",
  "./app-modules.js",
  "./enhancements.css",
  "./enhancements.js",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(async () => (await caches.match(event.request)) || caches.match("./index.html"))
    );
    return;
  }

  if (url.origin === self.location.origin && /\.(?:css|js|png|json)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const network = fetch(event.request).then(response => {
          if (response.ok) caches.open(STATIC_CACHE).then(cache => cache.put(event.request, response.clone()));
          return response;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, response.clone()));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data?.json() || {}; }
  catch (_) { data = { body: event.data?.text() || "Tu as un rappel." }; }
  event.waitUntil(
    self.registration.showNotification(data.title || "Mon Quotidien", {
      body: data.body || "Tu as un rappel.",
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      tag: data.tag || "mon-quotidien",
      data: { url: data.url || "./index.html" },
      actions: data.actions || [{ action: "open", title: "Ouvrir" }]
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "./index.html", self.location.href).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      const existing = list.find(client => new URL(client.url).origin === new URL(target).origin);
      if (existing) {
        existing.navigate(target);
        return existing.focus();
      }
      return clients.openWindow(target);
    })
  );
});
