/* Что поесть — cache-first shell, runtime cache for hashed assets and meal photos. */
const CACHE = "dishnext-v1.6.0";
const MEALS = "dishnext-meals-v1";
const PRECACHE = ["./", "./index.html", "./manifest.json", "./data/catalog.json", "./data/overrides.json", "./icons/icon-192.svg", "./icons/icon-512.svg", "./icons/icon-maskable.svg"];

function settled(response) {
  if (!response) return response;
  if (response.type === "opaqueredirect" || response.redirected) {
    return response
      .clone()
      .blob()
      .then((blob) => {
        const headers = new Headers(response.headers);
        headers.delete("content-encoding");
        headers.delete("content-length");
        headers.delete("location");
        return new Response(blob, { status: 200, statusText: "OK", headers });
      });
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE.map((url) =>
            fetch(url, { cache: "reload" }).then(async (res) => {
              const clean = await settled(res);
              if (clean && clean.ok) await cache.put(url, clean.clone ? clean.clone() : clean);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE && k !== MEALS).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isNav = req.mode === "navigate";
  const isMealImg = /themealdb\.com\/images\//.test(url.href);

  event.respondWith(
    (async () => {
      const devModule =
        url.origin === self.location.origin &&
        (/^\/(src|@vite|@react-refresh|@fs|node_modules)\//.test(url.pathname) ||
          /\.(tsx?|jsx?|mjs|css)$/.test(url.pathname));
      if (devModule) {
        try {
          return await fetch(req);
        } catch {
          const cached = await caches.match(req);
          if (cached) return cached;
          throw new Error("offline");
        }
      }
      if (isNav) {
        const cached = await caches.match("./index.html");
        if (cached) return cached;
      }
      const mealHit = isMealImg ? await caches.match(req) : null;
      if (mealHit) return mealHit;
      const match = await caches.match(req);
      if (match) return match;
      try {
        const res = await fetch(req);
        if (res && res.ok && isMealImg) {
          const cache = await caches.open(MEALS);
          cache.put(req, res.clone());
          return res;
        }
        if (res && res.ok && url.origin === self.location.origin) {
          const cache = await caches.open(CACHE);
          const clean = await settled(res.clone());
          if (clean) cache.put(req, clean.clone ? clean.clone() : clean);
        }
        return res;
      } catch {
        if (isNav) {
          const fallback = await caches.match("./index.html");
          if (fallback) return fallback;
        }
        const cached = await caches.match(req);
        if (cached) return cached;
        throw new Error("offline");
      }
    })()
  );
});
