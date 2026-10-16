// Dashboard service worker: network first, so new data shows up as soon as it is published;
// the last copy is used when there is no connection (on a plane, abroad without data).
const CACHE = "dash-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png", "./key.enc.json", "./data.enc.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("dash-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url), scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await caches.match("./index.html") : null);
      if (!hit) throw err;
      const headers = new Headers(hit.headers);
      headers.set("x-dash-cache", "1");
      return new Response(await hit.blob(), { status: hit.status, statusText: hit.statusText, headers });
    }
  })());
});
