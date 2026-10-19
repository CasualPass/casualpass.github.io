/*
 * CasualPass service worker — generated from tools/sw.template.js by tools/build-sw.py; do not edit sw.js by hand.
 * Every shipped file is precached on install, so all games open offline. Pages are network-first
 * (fresh when online, cached when offline); other files come from the cache of the current version.
 */
const VERSION = '__VERSION__';
const CACHE = `cp-${VERSION}`;
const RUNTIME = 'cp-runtime';
const PRECACHE = [/*__PRECACHE__*/];
const RUNTIME_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE)
        .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
        .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith('cp-') && k !== CACHE && k !== RUNTIME).map((k) => caches.delete(k))))
        .then(() => self.clients.claim()));
});

function timeout(ms) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function fromCache(request, ignoreSearch) {
    const cache = await caches.open(CACHE);
    return (await cache.match(request, { ignoreSearch })) || (await caches.match(request, { ignoreSearch }));
}

async function page(request) {
    try {
        const response = await Promise.race([fetch(request), timeout(4000)]);
        if (response.ok) (await caches.open(CACHE)).put(request.url.split('?')[0], response.clone());
        return response;
    } catch {
        const url = new URL(request.url);
        const hit = await fromCache(request, true)
            || (url.pathname.endsWith('/') && await fromCache(new Request(`${url.origin}${url.pathname}index.html`), true));
        return hit || (await fromCache(new Request(new URL('./', self.registration.scope)), true)) || Response.error();
    }
}

async function asset(request) {
    const hit = await fromCache(request, false);
    if (hit) return hit;
    try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(RUNTIME)).put(request, response.clone());
        return response;
    } catch {
        return (await fromCache(request, true)) || Response.error();
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(RUNTIME);
    const hit = await cache.match(request);
    const update = fetch(request).then((response) => {
        if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
        return response;
    }).catch(() => hit);
    return hit || update;
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin === self.location.origin) {
        if (url.pathname.endsWith('/version.json') || url.pathname.endsWith('/sw.js')) return;
        event.respondWith(request.mode === 'navigate' ? page(request) : asset(request));
    } else if (RUNTIME_HOSTS.includes(url.hostname)) {
        event.respondWith(staleWhileRevalidate(request));
    }
});
