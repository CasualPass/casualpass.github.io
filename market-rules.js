(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.CasualMarketRules = api;
})(typeof window !== 'undefined' ? window : this, () => {
    'use strict';
    const categories = Object.freeze({ hizli: 'Hızlı', zeka: 'Zekâ', beceri: 'Beceri', aksiyon: 'Aksiyon', coklu: 'Çok oyunculu' });
    function validateGame(input) {
        const title = String(input?.title || '').trim();
        const description = String(input?.description || '').trim();
        const category = String(input?.category || '');
        if (title.length < 3 || title.length > 60) throw new Error('Oyun adı 3–60 karakter olmalı.');
        if (description.length < 10 || description.length > 280) throw new Error('Açıklama 10–280 karakter olmalı.');
        if (!Object.hasOwn(categories, category)) throw new Error('Bir oyun türü seç.');
        let url;
        try { url = new URL(String(input?.url || '').trim()); } catch { throw new Error('Geçerli bir HTTPS oyun bağlantısı gir.'); }
        const host = url.hostname;
        if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || url.href.length > 2048 ||
            !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(host) || /\.(?:local|localhost|invalid|test|internal)$/i.test(host)) {
            throw new Error('Oyunun herkese açık bir HTTPS alan adında olmalı; yerel adres veya kimlik bilgisi içeren bağlantı kullanma.');
        }
        return { title, description, category, url: url.href };
    }
    return Object.freeze({ categories, validateGame });
});
