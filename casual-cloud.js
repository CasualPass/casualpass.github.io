/* Supabase Auth and explicit save transfer. Auth credentials never enter save cookies. */
(() => {
    'use strict';
    const config = window.CASUALPASS_CLOUD || {};
    let base = '';
    try { const url = new URL(config.url); if (url.protocol === 'https:' && !url.username && !url.password) base = url.origin; } catch { /* Not configured yet. */ }
    const key = String(config.publishableKey || '');
    const configured = Boolean(config.enabled && base && (key.startsWith('sb_publishable_') || isAnon(key)));
    function isAnon(value) {
        try { return JSON.parse(atob(value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'; } catch { return false; }
    }
    const storageKey = `sb-casualpass-${base}`;
    let session = null, epoch = 0, refreshing = null;
    const state = { configured, authenticated: false, status: configured ? 'loading' : 'unconfigured', email: '', lastSyncedAt: '', error: '', persistent: true };
    const snapshot = () => ({ ...state });
    function emit(patch = {}) {
        Object.assign(state, patch);
        window.dispatchEvent(new CustomEvent('casualcloudchange', { detail: snapshot() }));
        return snapshot();
    }
    function readStored() {
        try { const s = JSON.parse(localStorage.getItem(storageKey)); return validSession(s) ? s : null; } catch { return null; }
    }
    function validSession(s) {
        return Boolean(s && typeof s.access_token === 'string' && typeof s.refresh_token === 'string' && s.user?.id && Number.isFinite(s.expires_at));
    }
    function setSession(s) {
        session = s;
        try { if (s) localStorage.setItem(storageKey, JSON.stringify(s)); else localStorage.removeItem(storageKey); }
        catch { state.persistent = false; }
        emit({ authenticated: Boolean(s), email: s?.user?.email || '', status: s ? 'signed-in' : 'signed-out', error: '' });
    }
    function requireConfig() { if (!configured) throw new Error('Hesap bağlantısı henüz hazır değil. Misafir olarak oynayabilirsin.'); }
    async function request(path, body, token, options = {}) {
        requireConfig();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        try {
            const headers = { apikey: key, 'Content-Type': 'application/json', ...options.headers };
            if (token) headers.Authorization = `Bearer ${token}`;
            const response = await fetch(base + path, { method: options.method || 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal, cache: 'no-store', credentials: 'omit' });
            const raw = await response.text();
            let data;
            try { data = raw ? JSON.parse(raw) : null; } catch { throw new Error('Sunucudan geçersiz yanıt geldi.'); }
            if (!response.ok) {
                const messages = { 401: 'Oturum veya doğrulama kodu geçersiz. Yeniden giriş yap.', 403: 'Bu işlem için izin yok.', 429: 'Çok fazla deneme yapıldı. Bir süre bekleyip yeniden dene.' };
                const error = new Error(messages[response.status] || (path.includes('/rest/') ? 'Bulut kaydı işlenemedi. Bağlantıyı ve sunucu kurulumunu kontrol et.' : 'Giriş işlemi tamamlanamadı. E-posta ve kodu kontrol et.'));
                error.status = response.status; throw error;
            }
            return data;
        } catch (error) {
            if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('Bağlantı kurulamadı. İnternetini kontrol edip yeniden dene.');
            throw error;
        } finally { clearTimeout(timer); }
    }
    async function accept(data, version) {
        if (version !== epoch) throw new Error('Oturum değişti; işlemi yeniden başlat.');
        const s = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Number(data.expires_at) || Date.now() / 1000 + Number(data.expires_in), user: data.user };
        if (!validSession(s)) throw new Error('Sunucunun oturum yanıtı geçersiz.');
        setSession(s); return snapshot();
    }
    async function access() {
        requireConfig();
        if (!session) throw new Error('Önce hesabına giriş yap.');
        if (session.expires_at > Date.now() / 1000 + 60) return session;
        if (!refreshing) {
            const refresh = async () => {
                const version = epoch;
                const stored = readStored();
                if (state.persistent && (!stored || stored.user.id !== session?.user.id)) {
                    epoch++; setSession(stored);
                    throw new Error('Oturum başka sekmede değişti; işlemi yeniden başlat.');
                }
                if (stored && stored.user.id === session?.user.id && stored.expires_at > session.expires_at) session = stored;
                if (session.expires_at > Date.now() / 1000 + 60) return session;
                try { await accept(await request('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token }), version); return session; }
                catch (error) { if (version === epoch && (error.status === 400 || error.status === 401)) { epoch++; setSession(null); } throw error; }
            };
            refreshing = (navigator.locks ? navigator.locks.request(storageKey, refresh) : refresh()).finally(() => { refreshing = null; });
        }
        return refreshing;
    }
    async function requestOtp(email) {
        email = String(email).trim();
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Geçerli bir e-posta adresi gir.');
        const redirect = new URL(window.location.href);
        redirect.hash = ''; redirect.search = '';
        await request('/auth/v1/otp?redirect_to=' + encodeURIComponent(redirect.href), { email, create_user: true });
        return { email };
    }
    async function verifyOtp(email, token) {
        token = String(token).trim();
        if (!/^\d{6,10}$/.test(token)) throw new Error('E-postadaki sayısal kodu gir.');
        const version = ++epoch;
        return accept(await request('/auth/v1/verify', { email: String(email).trim(), token, type: 'email' }), version);
    }
    async function signOut() {
        const previous = session; epoch++; setSession(null);
        // Always clear this device even if the revoke request fails offline.
        if (previous) {
            try { await request('/auth/v1/logout?scope=local', {}, previous.access_token); }
            catch { emit({ error: 'Bu cihazdan çıkış yapıldı. Sunucu oturumu internet bağlantısı nedeniyle sonlandırılamadı.' }); }
        }
        return snapshot();
    }
    async function uploadSave() {
        if (window.CasualCheats?.active()) throw new Error('Hile açıkken buluta kayıt yapılamaz.');
        const version = epoch, s = await access();
        const save = await window.CasualSave.build();
        if (new TextEncoder().encode(JSON.stringify(save)).length > 30000) throw new Error('Kayıt bulut sınırından büyük. Dosya olarak dışa aktar.');
        if (version !== epoch) throw new Error('Oturum değişti; işlemi yeniden başlat.');
        await request('/rest/v1/casual_profiles?on_conflict=user_id', { user_id: s.user.id, profile: save }, s.access_token, { headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
        if (version === epoch) emit({ lastSyncedAt: save.created, error: '' });
        return save.created;
    }
    async function downloadSave() {
        const version = epoch, s = await access();
        const rows = await request(`/rest/v1/casual_profiles?user_id=eq.${encodeURIComponent(s.user.id)}&select=profile,updated_at`, undefined, s.access_token, { method: 'GET' });
        if (version !== epoch) throw new Error('Oturum değişti; işlemi yeniden başlat.');
        if (!Array.isArray(rows) || !rows.length) throw new Error('Bu hesapta henüz bulut kaydı yok.');
        const result = await window.CasualSave.inspect({ text: async () => JSON.stringify(rows[0].profile) });
        if (result.fatal) throw new Error(result.fatal);
        return { ...result, userId: s.user.id, epoch: version };
    }
    function applySave(result) {
        if (!session || result.userId !== session.user.id || result.epoch !== epoch) throw new Error('Oturum değişti; bulut kaydını yeniden getir.');
        if (!result.ok) throw new Error('Bulut kaydı doğrulanamadı. Mevcut ilerleme değiştirilmedi.');
        window.CasualSave.apply(result.save, true);
    }
    const ready = (async () => {
        if (!configured) return snapshot();
        const callback = new URLSearchParams(window.location.hash.slice(1));
        if (callback.has('access_token') || callback.has('error')) {
            // Remove bearer credentials before validating or starting other requests.
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
            if (callback.has('error')) return emit({ status: 'signed-out', error: 'Giriş bağlantısı geçersiz veya süresi dolmuş. Yeni bağlantı iste.' });
            const version = ++epoch;
            try {
                const accessToken = callback.get('access_token'), refreshToken = callback.get('refresh_token');
                const expires = Number(callback.get('expires_in'));
                if (!accessToken || !refreshToken || !Number.isFinite(expires) || expires <= 0 || callback.get('token_type') !== 'bearer') throw new Error('Giriş bağlantısı geçersiz.');
                const user = await request('/auth/v1/user', undefined, accessToken, { method: 'GET' });
                await accept({ access_token: accessToken, refresh_token: refreshToken, expires_in: expires, user }, version);
            } catch (error) { emit({ status: 'signed-out', error: error.message }); }
            return snapshot();
        }
        session = readStored();
        if (!session) return emit({ status: 'signed-out' });
        try {
            const version = epoch, s = await access();
            const user = await request('/auth/v1/user', undefined, s.access_token, { method: 'GET' });
            if (version === epoch && session) setSession({ ...session, user });
        } catch (error) {
            if (error.status === 401 || error.status === 403) { epoch++; setSession(null); }
            else emit({ status: 'offline', authenticated: Boolean(session), email: session?.user?.email || '', error: error.message });
        }
        return snapshot();
    })();
    window.addEventListener('storage', event => {
        if (event.key !== storageKey && event.key !== null) return;
        epoch++; session = readStored();
        emit({ authenticated: Boolean(session), email: session?.user?.email || '', status: session ? 'signed-in' : 'signed-out', error: '' });
    });
    window.CasualCloud = Object.freeze({ ready, getState: snapshot, requestOtp, verifyOtp, signOut, uploadSave, downloadSave, applySave });
})();
