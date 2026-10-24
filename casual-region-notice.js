// Shows a dismissible notice to visitors whose device timezone points to a country with heavy internet censorship.
// Detection is local only (Intl timezone); nothing is sent to any server.
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.CasualRegionNotice = api;
    if (typeof document !== 'undefined' && typeof window !== 'undefined') api.mount(window, document);
})(typeof window !== 'undefined' ? window : this, () => {
    'use strict';
    const HELP_URL = 'https://surfshark.com/blog/unblock-websites';
    const DISMISS_KEY = 'cp_region_notice_dismissed_v1';
    const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;
    const MESSAGE = 'Sistemlerimiz ülkenizde kısıtlı olan bir hizmeti kullanıyor olabilir. VPN, PROXY, GoodbyeDPI veya farklı bir DNS kullanmanız sistemimizdeki aksaklıkları çözümleyebilir.';

    // IANA timezone -> ISO country, limited to countries with heavy, documented internet blocking.
    const ZONES = Object.freeze({
        TR: ['Europe/Istanbul', 'Asia/Istanbul', 'Turkey'],
        RU: ['Europe/Moscow', 'Europe/Kaliningrad', 'Europe/Samara', 'Europe/Volgograd', 'Europe/Saratov', 'Europe/Ulyanovsk', 'Europe/Astrakhan', 'Europe/Kirov',
            'Asia/Yekaterinburg', 'Asia/Omsk', 'Asia/Novosibirsk', 'Asia/Barnaul', 'Asia/Tomsk', 'Asia/Novokuznetsk', 'Asia/Krasnoyarsk', 'Asia/Irkutsk',
            'Asia/Chita', 'Asia/Yakutsk', 'Asia/Khandyga', 'Asia/Vladivostok', 'Asia/Ust-Nera', 'Asia/Magadan', 'Asia/Sakhalin', 'Asia/Srednekolymsk',
            'Asia/Kamchatka', 'Asia/Anadyr', 'W-SU'],
        AZ: ['Asia/Baku'],
        IR: ['Asia/Tehran', 'Iran'],
        CN: ['Asia/Shanghai', 'Asia/Urumqi', 'Asia/Chongqing', 'Asia/Chungking', 'Asia/Harbin', 'Asia/Kashgar', 'PRC'],
        BY: ['Europe/Minsk'],
        TM: ['Asia/Ashgabat', 'Asia/Ashkhabad'],
        KP: ['Asia/Pyongyang'],
        MM: ['Asia/Yangon', 'Asia/Rangoon'],
        VN: ['Asia/Ho_Chi_Minh', 'Asia/Saigon'],
        UZ: ['Asia/Tashkent', 'Asia/Samarkand'],
        TJ: ['Asia/Dushanbe'],
        SA: ['Asia/Riyadh'],
        AE: ['Asia/Dubai'],
        PK: ['Asia/Karachi'],
        EG: ['Africa/Cairo', 'Egypt'],
        ER: ['Africa/Asmara', 'Africa/Asmera'],
        ET: ['Africa/Addis_Ababa'],
        SY: ['Asia/Damascus'],
        CU: ['America/Havana', 'Cuba'],
        VE: ['America/Caracas']
    });
    const zoneToCountry = new Map();
    for (const [country, zones] of Object.entries(ZONES)) for (const zone of zones) zoneToCountry.set(zone, country);

    function countryForTimeZone(timeZone) {
        return zoneToCountry.get(String(timeZone || '')) || null;
    }

    function detectTimeZone(intl) {
        try { return intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; }
    }

    function isDismissed(storage, now) {
        try {
            const at = Number(storage.getItem(DISMISS_KEY));
            return Number.isFinite(at) && at > 0 && now - at < DISMISS_MS;
        } catch { return false; }
    }

    function dismiss(storage, now) {
        try { storage.setItem(DISMISS_KEY, String(now)); } catch { /* private mode: hide for this page only */ }
    }

    function shouldShow(timeZone, storage, now) {
        return Boolean(countryForTimeZone(timeZone)) && !isDismissed(storage, now);
    }

    const CSS = `
        .cp-region-notice { position: fixed; top: max(8px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); z-index: 1001;
            width: min(640px, calc(100% - 24px)); box-sizing: border-box; display: flex; gap: 10px; align-items: flex-start;
            padding: 10px 12px; border-radius: 12px; background: rgba(28, 22, 10, 0.94); color: #fdf3d8; border: 1px solid rgba(255, 196, 70, 0.55);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35); font: 500 13px/1.45 Outfit, system-ui, sans-serif; }
        .cp-region-notice__icon { flex: none; font-size: 16px; line-height: 1.2; }
        .cp-region-notice__body { flex: 1; min-width: 0; }
        .cp-region-notice__body a { color: #ffd166; font-weight: 700; text-decoration: underline; }
        .cp-region-notice__close { flex: none; width: 28px; height: 28px; margin: -4px -4px 0 0; border: 0; border-radius: 8px; background: transparent;
            color: inherit; font-size: 20px; line-height: 1; cursor: pointer; }
        .cp-region-notice__close:hover, .cp-region-notice__close:focus-visible { background: rgba(255, 255, 255, 0.12); outline: none; }
    `;

    function mount(win, doc) {
        let storage = null;
        try { storage = win.localStorage; } catch { storage = null; }
        const safeStorage = storage || { getItem: () => null, setItem: () => {} };
        if (!shouldShow(detectTimeZone(win.Intl || Intl), safeStorage, Date.now())) return;

        const render = () => {
            if (doc.querySelector('.cp-region-notice')) return;
            const style = doc.createElement('style');
            style.textContent = CSS;
            doc.head.appendChild(style);

            const box = doc.createElement('div');
            box.className = 'cp-region-notice';
            box.setAttribute('role', 'status');

            const icon = doc.createElement('span');
            icon.className = 'cp-region-notice__icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = '⚠️';

            const body = doc.createElement('div');
            body.className = 'cp-region-notice__body';
            body.append(MESSAGE + ' ');
            const link = doc.createElement('a');
            link.href = HELP_URL;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.referrerPolicy = 'no-referrer';
            link.textContent = 'Nasıl yapılır?';
            body.appendChild(link);

            const close = doc.createElement('button');
            close.type = 'button';
            close.className = 'cp-region-notice__close';
            close.setAttribute('aria-label', 'Uyarıyı kapat');
            close.textContent = '×';
            close.addEventListener('click', () => {
                dismiss(safeStorage, Date.now());
                box.remove();
            });

            box.append(icon, body, close);
            doc.body.appendChild(box);
        };
        if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', render, { once: true });
        else render();
    }

    return Object.freeze({ HELP_URL, DISMISS_KEY, DISMISS_MS, MESSAGE, ZONES, countryForTimeZone, shouldShow, dismiss, isDismissed, mount });
});
