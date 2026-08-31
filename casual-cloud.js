/*
 * CasualPass artık bulut oturumu kullanmaz.
 * Bu boş uyumluluk yüzeyi, eski bir sayfa önbelleği dosyayı istemeye devam ederse
 * ağ isteği veya yerel depolama başlatmadan güvenli biçimde yerel modu bildirir.
 */
(function () {
    'use strict';

    const state = Object.freeze({
        configured: false,
        authenticated: false,
        status: 'cookie-only',
        email: '',
        lastSyncedAt: '',
        error: ''
    });

    const unavailable = async () => {
        throw new Error('Bulut senkronizasyonu kapalı; CasualPass yalnızca çerez kullanır.');
    };

    window.CasualCloud = Object.freeze({
        ready: Promise.resolve(state),
        getState: () => state,
        requestOtp: unavailable,
        verifyOtp: unavailable,
        syncNow: unavailable,
        signOut: async () => state
    });
})();
