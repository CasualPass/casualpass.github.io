/*
 * CasualPass service worker — generated from tools/sw.template.js by tools/build-sw.py; do not edit sw.js by hand.
 * Every shipped file is precached on install, so all games open offline. Pages are network-first
 * (fresh when online, cached when offline); other files come from the cache of the current version.
 */
const VERSION = "4daa29dca41d";
const CACHE = `cp-${VERSION}`;
const RUNTIME = 'cp-runtime';
const PRECACHE = [
        "about.html",
        "account-ui.js",
        "account-ui.js?v=3",
        "ai-generated.svg",
        "casual-cheats.js",
        "casual-cheats.js?v=8",
        "casual-cloud.js",
        "casual-cloud.js?v=5",
        "casual-profile.js",
        "casual-profile.js?v=16",
        "casual-save.js",
        "casual-save.js?v=3",
        "cloud-config.js",
        "cloud-config.js?v=3",
        "index.html",
        "manifest.webmanifest",
        "script.js",
        "script.js?v=16",
        "shared-settings.css",
        "shared-settings.css?v=5",
        "shared-settings.css?v=6",
        "shared-settings.js",
        "shared-settings.js?v=10",
        "style.css",
        "style.css?v=22",
        "style.css?v=25",
        "./",
        "2048-game/",
        "2048-game/index.html",
        "2048-game/script.js",
        "2048-game/style.css",
        "chess-game/",
        "chess-game/casualfish-worker.js",
        "chess-game/casualfish.js",
        "chess-game/index.html",
        "chess-game/script.js",
        "chess-game/script.js?v=4",
        "chess-game/style.css",
        "chess-game/style.css?v=3",
        "fps-game/",
        "fps-game/index.html",
        "fps-game/script.js",
        "fps-game/script.js?v=3",
        "fps-game/style.css",
        "fps-game/style.css?v=2",
        "icons/apple-touch-icon.png",
        "icons/favicon-32.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
        "maze-paint/",
        "maze-paint/engine.js",
        "maze-paint/engine.js?v=2",
        "maze-paint/index.html",
        "maze-paint/script.js",
        "maze-paint/script.js?v=3",
        "maze-paint/style.css",
        "maze-paint/style.css?v=3",
        "nuts-bolts/",
        "nuts-bolts/engine.js",
        "nuts-bolts/engine.js?v=2",
        "nuts-bolts/index.html",
        "nuts-bolts/script.js",
        "nuts-bolts/script.js?v=2",
        "nuts-bolts/style.css",
        "nuts-bolts/style.css?v=2",
        "owl-game/",
        "owl-game/index.html",
        "owl-game/script.js",
        "owl-game/script.js?v=4",
        "owl-game/style.css",
        "owl-game/style.css?v=3",
        "snake-game/",
        "snake-game/index.html",
        "snake-game/script.js",
        "snake-game/script.js?v=3",
        "snake-game/style.css",
        "snake-game/style.css?v=3",
        "son-hat/",
        "son-hat/battle-view.js",
        "son-hat/battle-view.js?v=2",
        "son-hat/index.html",
        "son-hat/script.js",
        "son-hat/script.js?v=9",
        "son-hat/style.css",
        "son-hat/style.css?v=8",
        "vektor/",
        "vektor/index.html",
        "vektor/script.js",
        "vektor/script.js?v=3",
        "vektor/style.css",
        "vektor/style.css?v=3",
        "wood-blocks/",
        "wood-blocks/index.html",
        "wood-blocks/script.js",
        "wood-blocks/script.js?v=3",
        "wood-blocks/style.css",
        "wood-blocks/style.css?v=2",
        "wood-turning/",
        "wood-turning/index.html",
        "wood-turning/script.js",
        "wood-turning/script.js?v=13",
        "wood-turning/style.css",
        "wood-turning/style.css?v=8",
        "xox-game/",
        "xox-game/index.html",
        "xox-game/script.js",
        "xox-game/script.js?v=2",
        "xox-game/style.css",
        "xox-game/style.css?v=2",
        "chess-game/vendor/LICENSE-chess.js.txt",
        "chess-game/vendor/chess.js",
        "fps-game/vendor/peerjs.min.js",
        "fps-game/vendor/three.min.js"
    ];
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
