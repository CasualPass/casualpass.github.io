/** Shared settings and game statistics are intentionally persisted in first-party cookies. */
let cpSettings = { sound: true, effects: true, theme: 'liquid' };

const CP_COOKIE_AGE = 60 * 60 * 24 * 365;
const CP_SETTINGS_COOKIE = 'casualpass_settings_v2';
const CP_STATS_COOKIE = 'casualpass_stats_v2';
const CP_THEME_IDS = new Set(['liquid', 'paper', 'neon', 'retro']);

function getCookieValue(name) {
    const prefix = `${encodeURIComponent(name)}=`;
    const item = document.cookie.split('; ').find((cookie) => cookie.startsWith(prefix));
    if (!item) return '';
    try { return decodeURIComponent(item.slice(prefix.length)); } catch { return ''; }
}

function setCookieValue(name, value) {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${CP_COOKIE_AGE}; Path=/; SameSite=Lax${secure}`;
}

/** True while any cheat code is active; persistence is blocked in that case. */
function cheatsActive() {
    const cheats = window.CasualCheats;
    return Boolean(cheats && typeof cheats.active === 'function' && cheats.active());
}

function loadSettings() {
    try {
        const saved = JSON.parse(getCookieValue(CP_SETTINGS_COOKIE) || '{}');
        const theme = CP_THEME_IDS.has(saved.theme) ? saved.theme : cpSettings.theme;
        cpSettings = { ...cpSettings, sound: Boolean(saved.sound ?? cpSettings.sound), effects: Boolean(saved.effects ?? cpSettings.effects), theme };
    } catch { /* default settings are used */ }
}

function saveSettings() {
    setCookieValue(CP_SETTINGS_COOKIE, JSON.stringify(cpSettings));
}

function applySettings() {
    document.body.classList.remove('theme-liquid', 'theme-paper', 'theme-neon', 'theme-retro');
    document.body.classList.add(`theme-${cpSettings.theme}`);
    document.body.classList.toggle('disable-effects', !cpSettings.effects);
    const bgContainer = document.getElementById('global-bg-container');
    if (bgContainer) {
        bgContainer.replaceChildren();
        if (cpSettings.theme === 'liquid' && cpSettings.effects) {
            ['blob blob-1', 'blob blob-2', 'blob blob-3'].forEach((className) => {
                const blob = document.createElement('div');
                blob.className = className;
                bgContainer.append(blob);
            });
        }
    }
}

function playClickSound() {
    if (!cpSettings.sound) return;
    const audio = document.getElementById('global-click-sound');
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = .5;
    audio.play().catch(() => {});
}

function playPopSound() {
    if (!cpSettings.sound) return;
    const audio = document.getElementById('global-pop-sound');
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = .6;
    audio.play().catch(() => {});
}

function getGameStats() {
    try {
        const saved = JSON.parse(getCookieValue(CP_STATS_COOKIE) || '{}');
        return saved && typeof saved === 'object' ? saved : {};
    } catch { return {}; }
}

function saveGameStats(stats) {
    // A cheat session keeps the last legitimate statistics in the cookie.
    if (cheatsActive()) return;
    setCookieValue(CP_STATS_COOKIE, JSON.stringify(stats));
}

function recordGameResult(gameName, result) {
    if (cheatsActive()) return;
    const stats = getGameStats();
    if (!stats[gameName]) stats[gameName] = { played: 0, won: 0, highScore: 0, totalScore: 0 };
    const game = stats[gameName];
    game.played += 1;
    if (result.won) game.won += 1;
    if (typeof result.score === 'number') {
        game.totalScore += result.score;
        game.highScore = Math.max(game.highScore, result.score);
    }
    saveGameStats(stats);
}

function getHighScore(gameName) {
    return Number(getGameStats()[gameName]?.highScore) || 0;
}

window.CasualSettings = Object.freeze({
    get: () => ({ ...cpSettings }),
    setTheme(theme) {
        if (!CP_THEME_IDS.has(theme)) return;
        cpSettings.theme = theme;
        saveSettings();
        applySettings();
    },
    update(patch) {
        cpSettings = { ...cpSettings, ...patch, theme: CP_THEME_IDS.has(patch?.theme) ? patch.theme : cpSettings.theme };
        saveSettings();
        applySettings();
    }
});

loadSettings();
document.addEventListener('DOMContentLoaded', applySettings);

// Çevrimdışı oyun ve güncelleme: sw.js tüm dosyaları önbelleğe alır. Yeni bir sürüm yayınlanınca
// (version.json değişir) service worker güncellenir; sayfa yalnızca oyun ortasında değilse yenilenir:
// Dashboard/Hakkında hesap formu boşken; oyun sayfaları yalnızca açılışın ilk saniyelerinde.
(function siteUpdates() {
    const KEY = 'cp_site_version';
    const base = document.currentScript ? document.currentScript.src : location.href;
    const versionUrl = new URL('version.json', base).href;
    const openedAt = performance.now();
    const hub = () => Boolean(document.querySelector('meta[name="cp-page"][content="hub"]'));
    const editingAccount = () => Boolean(document.activeElement?.closest?.('#account-login-form, #account-setup-form'))
        || Array.from(document.querySelectorAll('#account-login-form input, #account-setup-form input')).some(input => !input.closest('[hidden]') && input.value)
        || Boolean(document.querySelector('#account-login:disabled, #account-setup-submit:disabled'));
    const safeToReload = () => (hub() && !editingAccount()) || (!hub() && performance.now() - openedAt < 6000);
    let registration = null, registrationReady = Promise.resolve();
    let pending = false;

    function reload() {
        if (!safeToReload()) { pending = true; return; }
        pending = false;
        const next = new URL(location.href);
        next.searchParams.delete('v');
        location.replace(next.href);
    }

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
        registrationReady = navigator.serviceWorker.register(new URL('sw.js', base).href, { updateViaCache: 'none' }).then((reg) => { registration = reg; }).catch(() => {});
        let controlled = Boolean(navigator.serviceWorker.controller);
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            // The first install only takes control; a later swap means new files are ready.
            if (controlled) reload();
            controlled = true;
        });
    }

    let busy = false;
    async function check() {
        if (busy || !navigator.onLine || document.visibilityState === 'hidden') return;
        busy = true;
        try {
            const res = await fetch(`${versionUrl}?t=${Date.now()}`, { cache: 'no-store' });
            const { v } = await res.json();
            if (typeof v !== 'string' || !v) return;
            const seen = getCookieValue(KEY);
            await registrationReady;
            // Retry worker updates even if a previous fetch already recorded this version.
            if (registration) await registration.update();
            if (seen !== v) {
                setCookieValue(KEY, v);
                if (seen && !registration) reload();
            }
        } catch { /* çevrimdışı */ }
        finally { busy = false; }
    }
    check();
    setInterval(check, 60000);
    setInterval(() => { if (pending && document.visibilityState === 'visible' && safeToReload()) reload(); }, 5000);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (pending && safeToReload()) { reload(); return; }
        check();
    });
}());
