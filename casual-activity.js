/** Active site time; hidden, unfocused and idle pages do not accrue time. */
(() => {
    'use strict';
    const KEY = 'cp_activity_v1';
    let previous = Date.now();
    let lastInput = previous;
    let remainder = 0;
    const clean = value => Number.isFinite(Number(value)) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(Number(value)))) : 0;
    function seconds() {
        try { return clean(JSON.parse(getCookieValue(KEY) || '{}').seconds); } catch { return 0; }
    }
    function totals() {
        const stats = getGameStats();
        const result = { active_seconds: seconds(), total_points: 0, played: 0, wins: 0 };
        for (const game of Object.values(stats)) {
            if (!game || typeof game !== 'object') continue;
            result.total_points = Math.min(Number.MAX_SAFE_INTEGER, result.total_points + clean(game.totalScore));
            result.played = Math.min(Number.MAX_SAFE_INTEGER, result.played + clean(game.played));
            result.wins = Math.min(Number.MAX_SAFE_INTEGER, result.wins + clean(game.won));
        }
        return result;
    }
    function tick() {
        const now = Date.now();
        const end = Math.min(now, lastInput + 60000);
        const delta = Math.max(0, Math.min(5000, end - previous));
        previous = now;
        if (document.hidden || !document.hasFocus() || window.CasualCheats?.active()) return;
        remainder += delta;
        const add = Math.floor(remainder / 1000);
        remainder -= add * 1000;
        if (add) {
            setCookieValue(KEY, JSON.stringify({ seconds: Math.min(Number.MAX_SAFE_INTEGER, seconds() + add) }));
            window.dispatchEvent(new CustomEvent('casualactivitychange'));
        }
    }
    function input() { tick(); lastInput = Date.now(); }
    ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'].forEach(name => document.addEventListener(name, input, { passive: true }));
    window.addEventListener('blur', tick);
    window.addEventListener('focus', () => { previous = lastInput = Date.now(); });
    window.addEventListener('pagehide', tick);
    document.addEventListener('visibilitychange', () => { previous = Date.now(); });
    window.CasualActivity = Object.freeze({ totals, flush: tick });
    setInterval(tick, 5000);
})();
