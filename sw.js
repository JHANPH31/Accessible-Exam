// Offline support: app files are cached on install, CDN files (MediaPipe, font) the first time they load.
const V="ae-v1",SHELL=["./","index.html","style.css","script.js","manifest.json","icons/icon-192.png","icons/icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  e.respondWith(caches.match(e.request).then(hit=>{
    const net=fetch(e.request).then(r=>{if(r&&(r.ok||r.type==="opaque"))caches.open(V).then(c=>c.put(e.request,r.clone()));return r}).catch(()=>hit);
    return hit||net; // cached copy first; refreshed in the background for next time
  }));
});
