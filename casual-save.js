/**
 * CasualSave — exports and imports the whole CasualPass save (every first-party cookie) as a file.
 *
 * Integrity: each cookie value gets a 7-3-1 check digit (character codes weighted 7, 3, 1, 7, 3, 1…,
 * sum mod 10), the whole payload gets one more, and a SHA-256 seal covers the payload. A file edited
 * by hand fails these checks and the player is asked before it is loaded. The seal's salt ships with
 * the page, so this shows a file was changed; it cannot stop someone who reads this code.
 */
(() => {
    'use strict';

    const FORMAT = 'casualpass-save';
    const VERSION = 1;
    const SALT = 'CasualPass·731·kayıt-mührü·2026';
    const SKIP = new Set(['cp_site_version']);
    const OURS = (name) => (name.startsWith('cp_') || name.startsWith('casualpass_')) && !SKIP.has(name);
    const UNVERIFIED_COOKIE = 'cp_save_unverified';

    function readCookies() {
        const out = {};
        for (const part of document.cookie.split('; ')) {
            const eq = part.indexOf('=');
            if (eq < 1) continue;
            const name = part.slice(0, eq);
            if (OURS(name)) out[name] = part.slice(eq + 1);
        }
        return out;
    }

    function writeCookie(name, raw, maxAge = 60 * 60 * 24 * 365) {
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${name}=${raw}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
    }

    // 7-3-1 check digit: weights repeat 7, 3, 1 over the character codes; the digit is the sum mod 10.
    function digit731(text) {
        const weights = [7, 3, 1];
        let sum = 0;
        for (let i = 0; i < text.length; i++) sum += text.charCodeAt(i) * weights[i % 3];
        return sum % 10;
    }

    function canonical(save) {
        const names = Object.keys(save.cookies).sort();
        return JSON.stringify({ format: save.format, version: save.version, created: save.created, cookies: names.map((n) => [n, save.cookies[n]]) });
    }
    function checkDigits(save) {
        const names = Object.keys(save.cookies).sort();
        return names.map((n) => digit731(`${n}=${save.cookies[n]}`)).join('') + '-' + digit731(canonical(save));
    }
    async function seal(save) {
        if (!window.crypto || !crypto.subtle) return null;
        const data = new TextEncoder().encode(SALT + canonical(save) + checkDigits(save));
        const hash = await crypto.subtle.digest('SHA-256', data);
        return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    async function build() {
        const save = { format: FORMAT, version: VERSION, created: new Date().toISOString(), cookies: readCookies() };
        save.check731 = checkDigits(save);
        save.seal = await seal(save);
        return save;
    }

    async function exportSave() {
        const save = await build();
        const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
        const name = `casualpass-kayit-${save.created.slice(0, 10)}.json`;
        const file = new File([blob], name, { type: 'application/json' });
        // On phones the share sheet is the natural "save to Files"; elsewhere a download.
        if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
            try { await navigator.share({ files: [file], title: 'CasualPass kaydı' }); return { name, shared: true }; } catch (e) { if (e.name === 'AbortError') return { name, cancelled: true }; }
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return { name };
    }

    // Reads a file and reports whether it is a CasualPass save and whether its checks hold.
    async function inspect(file) {
        let save;
        try { save = JSON.parse(await file.text()); } catch { return { ok: false, fatal: 'Bu dosya okunamadı; bir CasualPass kaydı değil.' }; }
        if (!save || save.format !== FORMAT || typeof save.cookies !== 'object' || !save.cookies) return { ok: false, fatal: 'Bu dosya bir CasualPass kaydı değil.' };
        if (save.version > VERSION) return { ok: false, fatal: 'Bu kayıt daha yeni bir CasualPass sürümünden. Önce sayfayı yenile.' };
        const cookies = {};
        for (const [name, raw] of Object.entries(save.cookies)) {
            if (typeof raw !== 'string' || !OURS(name) || !/^[\w-]+$/.test(name) || /[;\r\n]/.test(raw) || raw.length > 4000) return { ok: false, fatal: 'Kayıttaki veriler bozuk.' };
            cookies[name] = raw;
        }
        const clean = { format: save.format, version: save.version, created: String(save.created || ''), cookies };
        const problems = [];
        if (save.check731 !== checkDigits(clean)) problems.push('7-3-1 kontrol haneleri tutmuyor');
        const expected = await seal(clean);
        if (expected && save.seal !== expected) problems.push('mühür tutmuyor');
        return { ok: problems.length === 0, problems, save: clean, created: clean.created, count: Object.keys(cookies).length };
    }

    // Replaces this browser's save with the file's cookies.
    function apply(save, verified) {
        for (const name of Object.keys(readCookies())) writeCookie(name, '', 0);
        for (const [name, raw] of Object.entries(save.cookies)) writeCookie(name, raw);
        // A file that failed its checks marks this save as unverified (a verified file keeps its own mark).
        if (!verified) writeCookie(UNVERIFIED_COOKIE, encodeURIComponent(save.created || '1'));
    }

    const unverified = () => document.cookie.split('; ').some((c) => c.startsWith(`${UNVERIFIED_COOKIE}=`) && c.length > UNVERIFIED_COOKIE.length + 1);

    window.CasualSave = { build, exportSave, inspect, apply, unverified, digit731 };
})();
