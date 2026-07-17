/* =====================================================
   Service worker — Mon Quotidien
   Rend l'app disponible 100 % hors connexion.
   ⚠️ À chaque mise à jour de l'app, incrémente VERSION
   (v3 -> v4 -> v5…) pour que les téléphones reçoivent
   la nouvelle version.
===================================================== */
const VERSION = "v4";
const CACHE = "mon-quotidien-" + VERSION;

const FICHIERS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

// Installation : on met tous les fichiers en cache
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting())
  );
});

// Activation : on supprime les anciens caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((cles) =>
      Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Requêtes : réseau d'abord (pour recevoir les mises à jour),
// et si pas de réseau (métro !) -> version en cache.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((reponse) => {
        const copie = reponse.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copie));
        return reponse;
      })
      .catch(() =>
        caches.match(e.request).then((r) => r || caches.match("./index.html"))
      )
  );
});
