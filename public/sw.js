const CACHE='chop-city-v7';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/manifest.webmanifest']))));
self.addEventListener('fetch',e=>{if(e.request.method==='GET'&&e.request.url.startsWith(self.location.origin))e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
