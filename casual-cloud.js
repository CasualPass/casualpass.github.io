(function () {
    'use strict';

    const config = window.CASUALPASS_CLOUD || {};
    const configured = Boolean(
        config.enabled &&
        /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(String(config.supabaseUrl || '')) &&
        config.supabasePublishableKey &&
        !String(config.supabasePublishableKey).includes('YOUR_')
    );

    let client = null;
    let session = null;
    let applyingRemote = false;
    let pushTimer = null;
    let syncPromise = null;

    const cloudState = {
        configured,
        authenticated: false,
        status: configured ? 'starting' : 'local-only',
        email: '',
        lastSyncedAt: '',
        error: ''
    };

    function publicState() {
        return { ...cloudState };
    }

    function emitState(patch) {
        Object.assign(cloudState, patch);
        window.dispatchEvent(new CustomEvent('casualcloudchange', { detail: publicState() }));
    }

    function requireConfigured() {
        if (!configured || !client) throw new Error('Bulut senkronu henüz yapılandırılmadı.');
    }

    function requireSession() {
        requireConfigured();
        if (!session) throw new Error('Önce e-posta OTP ile giriş yapmalısın.');
    }

    function normalizeEmail(value) {
        const email = String(value || '').normalize('NFKC').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Geçerli bir e-posta adresi gir.');
        return email;
    }

    async function fetchRemote() {
        requireSession();
        const { data, error } = await client
            .from(config.table || 'casual_profiles')
            .select('profile, revision, updated_at')
            .eq('user_id', session.user.id)
            .maybeSingle();
        if (error) throw error;
        return data || null;
    }

    function applyRemote(row) {
        if (!row?.profile) return null;
        applyingRemote = true;
        try {
            return CasualProfile.replaceFromCloud(row.profile);
        } finally {
            applyingRemote = false;
        }
    }

    async function pushRemote(profile = CasualProfile.current()) {
        requireSession();
        if (!profile) throw new Error('Senkronlanacak yerel profil bulunamadı.');

        clearTimeout(pushTimer);
        emitState({ status: 'syncing', error: '' });
        const { error } = await client
            .from(config.table || 'casual_profiles')
            .upsert({ user_id: session.user.id, profile }, { onConflict: 'user_id' });
        if (error) throw error;

        const timestamp = new Date().toISOString();
        emitState({ status: 'synced', lastSyncedAt: timestamp, error: '' });
        return profile;
    }

    async function hydrateAfterAuth(username) {
        const remote = await fetchRemote();
        if (remote?.profile) {
            const local = CasualProfile.current();
            const sameProfile = local && local.id === remote.profile.id;
            const localTime = Date.parse(local?.updatedAt || 0) || 0;
            const remoteTime = Date.parse(remote.profile.updatedAt || remote.updated_at || 0) || 0;
            const localHasNewProgress = sameProfile && (
                (local.woodTurning?.jobs || 0) > (remote.profile.woodTurning?.jobs || 0) ||
                (local.officeLevel || 1) > (remote.profile.officeLevel || 1) ||
                (local.ownedPaints || []).some((paintId) => !(remote.profile.ownedPaints || []).includes(paintId))
            );
            if (localHasNewProgress && localTime > remoteTime) await pushRemote(local);
            else applyRemote(remote);
            emitState({ status: 'synced', lastSyncedAt: remote.updated_at || new Date().toISOString(), error: '' });
            return CasualProfile.current();
        }

        let local = CasualProfile.current();
        if (!local) {
            const validation = CasualProfile.validateUsername(username);
            if (!validation.valid) throw new Error(validation.message);
            local = CasualProfile.login(validation.displayName);
        }
        await pushRemote(local);
        return local;
    }

    async function syncNow() {
        await ready;
        requireSession();
        if (syncPromise) return syncPromise;

        clearTimeout(pushTimer);
        syncPromise = (async () => {
            emitState({ status: 'syncing', error: '' });
            const remote = await fetchRemote();
            const local = CasualProfile.current();

            if (!remote?.profile) return pushRemote(local);
            if (!local) {
                applyRemote(remote);
            } else {
                const localTime = Date.parse(local.updatedAt || 0) || 0;
                const remoteTime = Date.parse(remote.profile.updatedAt || remote.updated_at || 0) || 0;
                if (localTime > remoteTime) await pushRemote(local);
                else applyRemote(remote);
            }

            const timestamp = remote.updated_at || new Date().toISOString();
            emitState({ status: 'synced', lastSyncedAt: timestamp, error: '' });
            return CasualProfile.current();
        })();

        try {
            return await syncPromise;
        } catch (error) {
            emitState({ status: 'error', error: error.message || 'Senkron başarısız.' });
            throw error;
        } finally {
            syncPromise = null;
        }
    }

    function schedulePush() {
        if (!session || applyingRemote) return;
        clearTimeout(pushTimer);
        pushTimer = setTimeout(() => {
            pushRemote().catch((error) => emitState({ status: 'error', error: error.message || 'Senkron başarısız.' }));
        }, 550);
    }

    async function requestOtp(emailValue) {
        await ready;
        requireConfigured();
        const email = normalizeEmail(emailValue);
        emitState({ status: 'sending-otp', error: '' });
        const { error } = await client.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: true }
        });
        if (error) {
            emitState({ status: 'error', error: error.message });
            throw error;
        }
        emitState({ status: 'otp-sent', email, error: '' });
        return email;
    }

    async function verifyOtp(emailValue, tokenValue, username) {
        await ready;
        requireConfigured();
        const email = normalizeEmail(emailValue);
        const token = String(tokenValue || '').replace(/\s+/g, '');
        if (!/^\d{6,8}$/.test(token)) throw new Error('E-postadaki OTP kodunu eksiksiz gir.');

        emitState({ status: 'verifying', error: '' });
        const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
        if (error) {
            emitState({ status: 'error', error: error.message });
            throw error;
        }
        session = data.session;
        emitState({ authenticated: true, status: 'syncing', email: data.user?.email || email, error: '' });
        const profile = await hydrateAfterAuth(username);
        emitState({ authenticated: true, status: 'synced', email: data.user?.email || email, error: '' });
        return profile;
    }

    async function signOut() {
        await ready;
        requireConfigured();
        clearTimeout(pushTimer);
        if (session) await client.auth.signOut({ scope: 'local' });
        session = null;
        emitState({ authenticated: false, status: 'local-only', email: '', lastSyncedAt: '', error: '' });
    }

    async function initialize() {
        if (!configured) {
            emitState({ status: 'local-only' });
            return publicState();
        }

        try {
            const sdk = await import(config.sdkUrl || 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm');
            client = sdk.createClient(config.supabaseUrl, config.supabasePublishableKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    storageKey: 'casualpass-cloud-auth'
                }
            });

            const { data, error } = await client.auth.getSession();
            if (error) throw error;
            session = data.session;

            client.auth.onAuthStateChange((event, nextSession) => {
                session = nextSession;
                if (event === 'SIGNED_OUT') {
                    emitState({ authenticated: false, status: 'local-only', email: '', lastSyncedAt: '' });
                }
            });

            window.addEventListener('casualprofilechange', schedulePush);
            window.addEventListener('online', () => {
                if (session) syncNow().catch(() => {});
            });
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && session) syncNow().catch(() => {});
            });

            if (session) {
                emitState({ authenticated: true, status: 'syncing', email: session.user?.email || '', error: '' });
                await hydrateAfterAuth('');
                emitState({ authenticated: true, status: 'synced', email: session.user?.email || '', error: '' });
            } else {
                emitState({ authenticated: false, status: 'ready', error: '' });
            }
            return publicState();
        } catch (error) {
            emitState({ status: 'error', error: error.message || 'Bulut bağlantısı başlatılamadı.' });
            return publicState();
        }
    }

    const ready = initialize();

    window.CasualCloud = Object.freeze({
        ready,
        getState: publicState,
        requestOtp,
        verifyOtp,
        syncNow,
        signOut
    });
})();
