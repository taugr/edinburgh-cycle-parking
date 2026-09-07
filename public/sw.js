const runtimeCachePrefix = 'neuk-bike-';
const cacheName = `${runtimeCachePrefix}v14`;
// Explicit offline-area downloads deliberately use a separate, stable cache.
// It must outlive routine app-shell upgrades so a completed area remains ready
// after a new service worker activates.
const offlineAreaCacheName = 'neuk-bike-offline-areas-v1';
const openFreeMapOrigin = 'https://tiles.openfreemap.org';
const scopePath = new URL(self.registration.scope).pathname;
const appBasePath = scopePath.endsWith('/')
  ? scopePath.slice(0, -1)
  : scopePath;

function appPath(path) {
  return `${appBasePath}${path}`;
}

const coreAssets = [
  appPath('/'),
  appPath('/site.webmanifest'),
  appPath('/favicon.ico'),
  appPath('/favicon.svg'),
  appPath('/icon-192.png'),
  appPath('/icon-512.png'),
  appPath('/icon-maskable-512.png'),
  appPath('/apple-touch-icon.png'),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(cacheName)
      // A new shell must not copy old icons or HTML from the HTTP cache.
      .then((cache) =>
        cache.addAll(
          coreAssets.map((url) => new Request(url, { cache: 'reload' })),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (candidate) =>
                candidate.startsWith(runtimeCachePrefix) &&
                candidate !== cacheName &&
                candidate !== offlineAreaCacheName,
            )
            .map((candidate) => caches.delete(candidate)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function isOpenFreeMapResource(request) {
  const url = new URL(request.url);

  if (url.origin !== openFreeMapOrigin) {
    return false;
  }

  return (
    /^\/styles\/(liberty|dark)(?:\/style\.json)?$/.test(url.pathname) ||
    /^\/sprites\/ofm_f384\/ofm(?:@2x)?\.(?:json|png)$/.test(url.pathname) ||
    /^\/fonts\/[^/]+\/\d+-\d+\.pbf$/.test(url.pathname) ||
    url.pathname === '/planet' ||
    /^\/planet\/\d[\d_]*_pt\/\d+\/\d+\/\d+\.pbf$/.test(url.pathname) ||
    /^\/natural_earth\/ne2sr\/\d+\/\d+\/\d+\.png$/.test(url.pathname)
  );
}

function isStaticAsset(request) {
  if (!isSameOrigin(request)) {
    return false;
  }

  const url = new URL(request.url);

  return (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    url.pathname.startsWith(appPath('/_next/static/')) ||
    url.pathname.startsWith(appPath('/vendor/maplibre-gl/'))
  );
}

function isAppData(request) {
  if (!isSameOrigin(request)) {
    return false;
  }

  const pathname = new URL(request.url).pathname;
  return (
    pathname.startsWith(appPath('/data/parking/')) ||
    pathname.startsWith(appPath('/data/cycling-pois/')) ||
    pathname.startsWith(appPath('/data/cycle-network/'))
  );
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  let response;
  try {
    response = await fetch(request);
  } catch (error) {
    const compatibleOfflineChunk = await matchCompatibleOfflineChunk(request);
    if (compatibleOfflineChunk) {
      return compatibleOfflineChunk;
    }
    throw error;
  }

  if (response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }

  return response;
}

async function matchCompatibleOfflineChunk(request) {
  const pathname = new URL(request.url).pathname;
  const match = pathname.match(
    /\/data\/(parking|cycling-pois|cycle-network)\/chunks\/(\d+\/\d+\/\d+)\.[a-f0-9]+\.json$/,
  );
  if (!match) {
    return undefined;
  }

  const expectedPathPrefix = appPath(`/data/${match[1]}/chunks/${match[2]}.`);
  const cache = await caches.open(offlineAreaCacheName);
  const keys = await cache.keys();
  const compatibleRequest = keys.find((candidate) => {
    const candidatePath = new URL(candidate.url).pathname;
    return (
      candidatePath.startsWith(expectedPathPrefix) &&
      candidatePath.endsWith('.json')
    );
  });
  return compatibleRequest ? cache.match(compatibleRequest) : undefined;
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(appPath('/'), response.clone());
    }

    return response;
  } catch {
    const cachedResponse = await caches.match(appPath('/'));

    if (cachedResponse) {
      return cachedResponse;
    }

    throw new Error('Navigation failed and no cached app shell is available.');
  }
}

async function networkFirstData(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const offlineCache = await caches.open(offlineAreaCacheName);
    const cachedResponse =
      (await offlineCache.match(request)) ?? (await caches.match(request));
    if (cachedResponse) {
      return cachedResponse;
    }
    throw new Error('App data is unavailable and has not been cached.');
  }
}

async function offlineAreaCacheFirst(request) {
  const offlineCache = await caches.open(offlineAreaCacheName);
  const cachedResponse = await offlineCache.match(request);

  // This cache is populated only by an explicit offline-area download. Runtime
  // map use may read it, but must never turn incidental browsing into a trip
  // download.
  return cachedResponse ?? fetch(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  if (isOpenFreeMapResource(request)) {
    event.respondWith(offlineAreaCacheFirst(request));
    return;
  }

  if (!isSameOrigin(request)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isAppData(request)) {
    event.respondWith(
      new URL(request.url).pathname.endsWith('/manifest.json')
        ? networkFirstData(request)
        : cacheFirst(request),
    );
    return;
  }

  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request));
  }
});
