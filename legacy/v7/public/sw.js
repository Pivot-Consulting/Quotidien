const VERSION='v7.1.4-no-cache';

self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.map(name=>caches.delete(name)));
  await self.registration.unregister();
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows) client.navigate(client.url);
})()));

self.addEventListener('fetch',()=>{});
