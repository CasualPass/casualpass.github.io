(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.CasualHomeGames = api;
})(typeof window !== 'undefined' ? window : {}, root => {
    'use strict';
    const KEY = 'cp_home_games_v1', PAGE_KEY = 'cp_home_page_size_v1', LIMIT = 30;
    /* Kart simgeleri emoji yerine game-icons.js içindeki ortak SVG setinden gelir. */
    const catalog = [
        ['wood-turning','Wood Turning','Şekillendir, zımparala, kazan','wood-card'],
        ['snake-game','Snake','Yemi kap, rekoru uzat','snake-card'],
        ['2048-game','2048','Taşları birleştir','tile-card'],
        ['xox-game','XOX','Üçlüyü ilk sen kur','xox-card'],
        ['chess-game','Chess','CasualFish’e karşı oyna','chess-card'],
        ['son-hat','Son Hat','Şerit seç, birliğini büyüt','line-card'],
        ['owl-game','Minerva Owl','Sütunlardan süzül','owl-card'],
        ['wood-blocks','Wood Blocks','Blokları yerleştir, satırları sil','blocks-card'],
        ['fps-game','Arena FPS','Oda aç, kodla katıl','arena-card'],
        ['vektor','Vektör','Çekirdeği kur ya da çöz','vektor-card'],
        ['nuts-bolts','Nuts & Bolts','Somunları renklerine göre ayır','nuts-card'],
        ['maze-paint','Maze Paint','Kaydır, tüm kareleri boya','maze-card'],
        ['dino-game','Dino','Zıpla, engelleri aş, rekor kır','dino-card']
    ].map(([id,name,description,className]) => Object.freeze({id,name,description,className,url:`${id}/index.html`}));
    const defaults = ['wood-turning','snake-game','2048-game','chess-game','maze-paint','dino-game'];
    const valid = id => catalog.some(game => game.id === id) || /^community:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    function read(raw) {
        if (!raw) return defaults.slice();
        try {
            const saved=JSON.parse(raw);
            if (!Array.isArray(saved)) return defaults.slice();
            return [...new Set(saved.filter(id => typeof id==='string' && valid(id)))].slice(0,LIMIT);
        } catch { return defaults.slice(); }
    }
    function toggle(ids,id) {
        if (!valid(id)) throw new Error('Oyun bulunamadı.');
        const clean=read(JSON.stringify(ids));
        if (clean.includes(id)) return clean.filter(item=>item!==id);
        if (clean.length>=LIMIT) throw new Error('Ana ekranında en fazla 30 oyun olabilir. Önce ekli bir oyunu kaldır.');
        return clean.concat(id);
    }
    function normalizePageSize(value) { return [2,4,6,8,12,18,30].includes(Number(value)) ? Number(value) : 0; }
    function pagePreference() { return normalizePageSize(root.getCookieValue?.(PAGE_KEY)); }
    function setPagePreference(value) {
        const size=normalizePageSize(value);
        root.setCookieValue(PAGE_KEY,String(size));
        return size;
    }
    function pageSize(width,height,preference=0) {
        const selected=normalizePageSize(preference);
        if(selected)return selected;
        return width<=720 ? (height<=520?2:4) : (height<=620?3:6);
    }
    function current() { return read(root.getCookieValue?.(KEY)); }
    function change(id) {
        const ids=toggle(current(),id);
        root.setCookieValue(KEY,JSON.stringify(ids));
        root.dispatchEvent(new CustomEvent('casualhomechange'));
        return ids;
    }
    return Object.freeze({ catalog:Object.freeze(catalog), LIMIT, read, toggle, pageSize, pagePreference, setPagePreference, current, change });
});
