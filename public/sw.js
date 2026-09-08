// Retirement endpoint for installations left over from V6/V7. Never registered by 2.1.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) {
    if (/^quotidien-v[67][.-]/.test(name)) await caches.delete(name);
  }
  await self.registration.unregister();
})()));
