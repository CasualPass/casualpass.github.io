(() => {
    const KEY = 'casualpass_cheats_v1';
    const MODE_KEY = 'casualpass_cheat_mode_v1';
    const catalog = [
        { id: 'plus', name: 'Skor artışı', price: 60, code: 'score plus 1', hint: 'score plus 0.2: saniyede +0.2. score plus second 2: iki saniyede +1.' },
        { id: 'set', name: 'Skor yaz', price: 35, code: 'score set 255', hint: 'Skoru 0–255 arası yazar.' },
        { id: 'immortal', name: 'Ölümsüzlük', price: 160, code: 'immortal', hint: 'Hat, yılan ve taşlar düşmez.' },
        { id: 'all', name: 'Her şey açık', price: 800, code: 'allopen', hint: 'Tema, boya, ofis ve bölgeler açılır.' }
    ];
    let state = load();

    function load() {
        try {
            const prefix = `${encodeURIComponent(KEY)}=`;
            const row = document.cookie.split('; ').find((item) => item.startsWith(prefix));
            const data = row ? JSON.parse(decodeURIComponent(row.slice(prefix.length))) : {};
            const modePrefix = `${encodeURIComponent(MODE_KEY)}=`;
            const modeRow = document.cookie.split('; ').find((item) => item.startsWith(modePrefix));
            const mode = modeRow ? JSON.parse(decodeURIComponent(modeRow.slice(modePrefix.length))) : data;
            return {
                owned: Array.isArray(data.owned) ? data.owned : [],
                plus: clampRate(mode.plus),
                interval: clampInterval(mode.interval),
                immortal: Boolean(mode.immortal),
                features: Boolean(mode.features),
                setActive: Boolean(mode.setActive),
                tickCount: 0
            };
        } catch (_) {
            return { owned: [], plus: 0, interval: 0, immortal: false, features: false, setActive: false, tickCount: 0 };
        }
    }

    function save() {
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        const attributes = `; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
        document.cookie = `${encodeURIComponent(KEY)}=${encodeURIComponent(JSON.stringify({ owned: state.owned }))}${attributes}`;
        document.cookie = `${encodeURIComponent(MODE_KEY)}=${encodeURIComponent(JSON.stringify({ plus: state.plus, interval: state.interval, immortal: state.immortal, features: state.features, setActive: state.setActive }))}${attributes}`;
        window.dispatchEvent(new CustomEvent('casual-cheat', { detail: snapshot() }));
    }

    function clamp(value, fallback = 0) {
        const n = Math.floor(Number(value));
        if (!Number.isFinite(n)) return fallback;
        return Math.max(0, Math.min(255, n));
    }

    function snapshot() {
        return { plus: state.plus, interval: state.interval, immortal: state.immortal, features: state.features, setActive: state.setActive, owned: state.owned.slice() };
    }

    function pay(id) {
        const item = catalog.find((entry) => entry.id === id);
        if (!item) return false;
        if (state.owned.includes(id)) return true;
        if (!window.CasualProfile) throw new Error('Profil yok.');
        CasualProfile.spend(item.price, item.name);
        state.owned.push(id);
        return true;
    }

    function apply(parsed) {
        if (parsed.id === 'plus') {
            state.plus = parsed.n;
            state.interval = parsed.interval || 0;
            state.tickCount = 0;
            return state.interval ? `Her ${state.interval} saniyede +1 puan.` : parsed.n ? `Skor saniyede +${parsed.n}.` : 'Skor artışı kapalı.';
        }
        if (parsed.id === 'set') {
            state.setActive = true;
            window.dispatchEvent(new CustomEvent('casual-cheat-set', { detail: { n: parsed.n } }));
            return `Skor ${parsed.n} yazıldı.`;
        }
        if (parsed.id === 'immortal') {
            state.immortal = !state.immortal;
            return state.immortal ? 'Ölümsüzlük açık.' : 'Ölümsüzlük kapalı.';
        }
        state.features = true;
        return 'Tema, boya, ofis ve kilitler açıldı.';
    }

    function parse(raw) {
        const text = String(raw || '').trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
        let match = text.match(/^score plus (\d+(?:\.\d+)?)$/);
        if (match) {
            const n = Number(match[1]);
            if (!Number.isFinite(n) || n < 0 || n > 255) return null;
            return { id: 'plus', n };
        }
        match = text.match(/^score plus second (\d+(?:\.\d+)?)$/);
        if (match) {
            const interval = Number(match[1]);
            if (interval <= 0 || interval > 255 || !Number.isFinite(interval)) return null;
            return { id: 'plus', n: 1 / interval, interval };
        }
        match = text.match(/^score set (\d+)$/);
        if (match && Number(match[1]) <= 255) return { id: 'set', n: Number(match[1]) };
        if (text === 'immortal' || text === 'olumsuz' || text === 'ölümsüz') return { id: 'immortal' };
        if (text === 'allopen' || text === 'all') return { id: 'all' };
        return null;
    }

    function run(raw) {
        const parsed = parse(raw);
        if (!parsed) return { ok: false, message: 'Kod geçersiz. Örnek: score plus 0.2, score plus second 2' };
        try {
            pay(parsed.id);
        } catch (error) {
            return { ok: false, message: error.message || 'CasualMoney yetmedi.' };
        }
        const wasActive = isActive();
        const message = apply(parsed);
        save();
        if (wasActive && !isActive()) location.reload();
        return { ok: true, message };
    }

    function buy(id) {
        const item = catalog.find((entry) => entry.id === id);
        if (!item) return { ok: false, message: 'Kod yok.' };
        if (id === 'set') {
            try { pay('set'); } catch (error) { return { ok: false, message: error.message }; }
            save();
            return { ok: true, message: 'Kod açıldı: score set 255' };
        }
        if (id === 'plus') return run('score plus 1');
        return run(item.code);
    }

    function clampRate(value) {
        const n = Number(value);
        return Number.isFinite(n) ? Math.max(0, Math.min(255, n)) : 0;
    }

    function clampInterval(value) {
        const n = Number(value);
        return Number.isFinite(n) && n > 0 && n <= 255 ? n : 0;
    }

    function isActive() {
        return state.setActive || state.plus > 0 || state.immortal || state.features;
    }

    function disableAll() {
        state.plus = 0;
        state.interval = 0;
        state.immortal = false;
        state.features = false;
        state.setActive = false;
        state.tickCount = 0;
        save();
        location.reload();
    }

    const style = document.createElement('style');
    style.textContent = `
        .cp-cheat { position: fixed; right: max(16px, env(safe-area-inset-right)); bottom: max(16px, env(safe-area-inset-bottom)); z-index: 1000; color: #f3f7f4; font-family: Outfit, system-ui, sans-serif; }
        .cp-cheat * { box-sizing: border-box; }
        .cp-cheat button, .cp-cheat input { font: inherit; }
        .cp-cheat-open { min-height: 48px; padding: 0 18px; display: flex; align-items: center; gap: 9px; margin-left: auto; border: 1px solid rgba(255,255,255,.55); border-radius: 999px; background: #f3c657; color: #1c291f; box-shadow: 0 8px 28px rgba(0,0,0,.3); font-size: 14px; font-weight: 800; cursor: pointer; }
        .cp-cheat-open::before { content: '⌘'; font-size: 19px; line-height: 1; }
        .cp-cheat-box { display: none; width: min(380px, calc(100vw - 32px)); max-height: min(70dvh, 480px); overflow: auto; margin-bottom: 12px; padding: 20px; border: 1px solid #4b6756; border-radius: 20px; background: #18251e; box-shadow: 0 22px 65px rgba(0,0,0,.48); }
        .cp-cheat.open .cp-cheat-box { display: block; }
        .cp-cheat-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .cp-cheat-top strong { font-size: 19px; letter-spacing: -.03em; }
        .cp-cheat-close { width: 40px; height: 40px; flex: none; border: 1px solid #576e5e; border-radius: 10px; background: #2b4033; color: #f3f7f4; font-size: 21px !important; cursor: pointer; }
        .cp-cheat-help { margin: 9px 0 18px; color: #c7d5cb; font-size: 13px; line-height: 1.5; }
        .cp-cheat-status { margin: 0 0 12px; color: #f3c657; font-size: 12px; font-weight: 800; }
        .cp-cheat-disable { width: 100%; min-height: 40px; margin-top: 10px; border: 1px solid #a56a5c; border-radius: 10px; background: #492d29; color: #fff; font-weight: 800; cursor: pointer; }
        .cp-cheat-box label { display: block; margin: 0 0 7px; font-size: 12px; font-weight: 800; }
        .cp-cheat-row { display: flex; gap: 8px; }
        .cp-cheat-row input { min-width: 0; flex: 1; min-height: 46px; padding: 0 12px; border: 1px solid #76927d; border-radius: 11px; outline: none; background: #101a14; color: #fff; font-family: ui-monospace, monospace; font-size: 13px; }
        .cp-cheat-row input:focus-visible { border-color: #f3c657; box-shadow: 0 0 0 3px rgba(243,198,87,.24); }
        .cp-cheat-run { min-height: 46px; padding: 0 15px; border: none; border-radius: 11px; background: #f3c657; color: #18251e; font-size: 13px; font-weight: 800; cursor: pointer; }
        .cp-cheat-examples { margin: 15px 0 0; color: #c7d5cb; font-size: 12px; line-height: 1.65; }
        .cp-cheat-examples code { color: #ffe3a0; font-family: ui-monospace, monospace; }
        .cp-cheat-feedback { min-height: 20px; margin: 12px 0 0; color: #d6eacc; font-size: 12px; line-height: 1.5; }
        .cp-cheat-feedback.error { color: #ffb6a8; }
        .cp-cheat :is(button, input):focus-visible { outline: 3px solid #f3c657; outline-offset: 3px; }
        @media (max-height: 480px) { .cp-cheat-box { max-height: calc(100dvh - 80px); padding: 14px; } .cp-cheat-help { margin: 5px 0 10px; } }
        @media (prefers-reduced-motion: reduce) { .cp-cheat * { scroll-behavior: auto; } }
    `;
    document.head.append(style);
    const root = document.createElement('div');
    root.className = 'cp-cheat';
    root.innerHTML = `<form class="cp-cheat-box" id="cp-cheat-box">
        <div class="cp-cheat-top"><strong>Kod konsolu</strong><button type="button" class="cp-cheat-close" aria-label="Kod konsolunu kapat">×</button></div>
        <p class="cp-cheat-help">İlk satın alımda CM kesilir. Hile açıkken oyun ilerlemesi ve CM kazanımı kaydedilmez.</p>
        <p class="cp-cheat-status" id="cp-cheat-status" aria-live="polite"></p>
        <label for="cp-cheat-input">Komut</label>
        <div class="cp-cheat-row"><input id="cp-cheat-input" maxlength="32" placeholder="score plus 0.2" autocomplete="off" spellcheck="false"><button class="cp-cheat-run" type="submit">Uygula</button></div>
        <p class="cp-cheat-examples">Örnekler: <code>score plus 0.2</code> · <code>score plus second 2</code> · <code>score set 255</code> · <code>immortal</code></p>
        <button type="button" class="cp-cheat-disable">Tüm hileleri kapat</button>
        <p class="cp-cheat-feedback" id="cp-cheat-note" role="status" aria-live="polite"></p>
    </form><button type="button" class="cp-cheat-open" aria-expanded="false" aria-controls="cp-cheat-box">Kod gir</button>`;
    document.addEventListener('DOMContentLoaded', () => {
        document.body.append(root);
        const trigger = root.querySelector('.cp-cheat-open');
        const input = root.querySelector('#cp-cheat-input');
        const note = root.querySelector('#cp-cheat-note');
        const status = root.querySelector('#cp-cheat-status');
        const refreshStatus = () => { status.textContent = isActive() ? 'Hile açık · kayıt ve CM kazanımı durdu' : 'Hileler kapalı · kayıt açık'; };
        refreshStatus();
        const toggle = (open) => {
            root.classList.toggle('open', open);
            trigger.setAttribute('aria-expanded', String(open));
            if (open) input.focus();
            else trigger.focus();
        };
        trigger.addEventListener('click', () => toggle(!root.classList.contains('open')));
        root.querySelector('.cp-cheat-close').addEventListener('click', () => toggle(false));
        root.querySelector('.cp-cheat-disable').addEventListener('click', () => { disableAll(); refreshStatus(); note.textContent = 'Tüm hileler kapatıldı.'; });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && root.classList.contains('open')) { event.preventDefault(); toggle(false); }
        });
        document.addEventListener('pointerdown', (event) => {
            if (root.classList.contains('open') && !root.contains(event.target)) toggle(false);
        });
        root.querySelector('form').addEventListener('submit', (event) => {
            event.preventDefault();
            const result = run(input.value);
            note.textContent = result.message;
            note.classList.toggle('error', !result.ok);
            if (result.ok) input.value = '';
            refreshStatus();
        });
        window.addEventListener('casual-cheat', refreshStatus);
    });

    window.CasualCheats = Object.freeze({
        catalog: () => catalog.map((item) => ({ ...item, owned: state.owned.includes(item.id) })),
        plus: () => state.plus,
        active: isActive,
        tick: () => {
            if (!isActive() || state.plus <= 0) return 0;
            if (!state.interval) return state.plus;
            state.tickCount += 1;
            if (state.tickCount + 1e-10 < state.interval) return 0;
            state.tickCount -= state.interval;
            return 1;
        },
        immortal: () => state.immortal,
        features: () => state.features,
        owned: (id) => state.owned.includes(id),
        run,
        buy,
        disableAll
    });
})();
