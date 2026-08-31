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
    setCookieValue(CP_STATS_COOKIE, JSON.stringify(stats));
}

function recordGameResult(gameName, result) {
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
