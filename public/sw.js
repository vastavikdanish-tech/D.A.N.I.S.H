const CACHE_VERSION = "v1";
const STATIC_CACHE = `danish-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `danish-dynamic-${CACHE_VERSION}`;
const API_CACHE = `danish-api-${CACHE_VERSION}`;
const ASSET_CACHE = `danish-asset-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/login",
  "/signup",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon.svg",
  "/apple-touch-icon.png",
  "/favicon.ico",
];

const API_ROUTES = [
  "/api/briefing",
  "/api/health",
  "/api/memories",
  "/api/reminders",
  "/api/devices",
  "/api/profile",
];

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isNavigation(url) {
  return url.pathname === url.pathname.split("/").pop() || url.pathname === "/";
}

function isAsset(url) {
  return /\.(js|css|png|svg|ico|woff2?|ttf|json|webmanifest)$/i.test(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        console.log("Some static assets could not be pre-cached");
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== API_CACHE && key !== ASSET_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  if (isApiRequest(url)) {
    event.respondWith(networkFirstApi(event.request, url));
    return;
  }

  if (isAsset(event.request)) {
    event.respondWith(cacheFirst(event.request, ASSET_CACHE));
    return;
  }

  if (isNavigation(url)) {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }

  event.respondWith(networkFirst(event.request));
});

async function networkFirstApi(request, url) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      cache.put(request, clone);
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ ok: false, error: "You are offline. This data will update when you reconnect." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offlinePage = await caches.match("/offline");
    if (offlinePage) return offlinePage;
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response("Offline", { status: 503 });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const matchingClient = windowClients.find((c) => c.url === urlToOpen);
      if (matchingClient) return matchingClient.focus();
      return clients.openWindow(urlToOpen);
    })
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    self.registration.showNotification(data.title || "D.A.N.I.S.H", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-96.png",
      data: { url: data.url || "/" },
      vibrate: [200, 100, 200],
      tag: data.tag || "danish-push",
      renotify: true,
    });
  } catch {
    self.registration.showNotification("D.A.N.I.S.H", {
      body: event.data.text(),
      icon: "/icons/icon-192.png",
    });
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
