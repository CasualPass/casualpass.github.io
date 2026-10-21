(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.CasualGameIcons = api;
})(typeof window !== 'undefined' ? window : {}, () => {
    'use strict';
    /* Ortak çizgi stili: 24x24 viewBox, currentColor kontur, yuvarlak uç ve birleşim.
       Kart içindeki tüm oyun simgeleri bu tek kaynaktan üretilir. */
    const ROOT = '<svg class="game-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';
    const FALLBACK = 'community';
    const shapes = Object.freeze({
        'wood-turning': '<rect x="3" y="6.6" width="18" height="5.2" rx="2.4"/><rect x="3" y="13" width="18" height="5.2" rx="2.4"/><path d="M7 9.2h5.4M9.6 15.6h6"/>',
        'snake-game': '<circle cx="16.9" cy="6.9" r="3.2"/><path d="M18.1 5.6h.01"/><path d="M20 7.6 22.8 9M20 6.2 22.8 4.8"/><path d="M15.1 9.6c-2.7 1.4-3.7 4.4-2.1 6.5 1.4 1.9.7 4.3-1.6 5.1-1.2.4-2.4.2-3.2-.6"/>',
        '2048-game': '<rect x="3.2" y="3.2" width="7.8" height="7.8" rx="2.2"/><rect x="13" y="3.2" width="7.8" height="7.8" rx="2.2"/><rect x="3.2" y="13" width="7.8" height="7.8" rx="2.2"/><path d="M13.4 16.9h6.4M17.2 13.7l3.2 3.2-3.2 3.2"/>',
        'xox-game': '<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/><path d="m4.5 4.5 3 3M7.5 4.5 4.5 7.5"/><circle cx="18" cy="18" r="2.4"/>',
        'chess-game': '<circle cx="12" cy="5.9" r="2.6"/><path d="M9.6 10.1h4.8c.6 1.7 1.8 2.9 2.8 4.1H6.8c1-1.2 2.2-2.4 2.8-4.1z"/><path d="M8.4 14.2h7.2l1.7 4.6H6.7z"/><path d="M5.6 20.4h12.8"/>',
        'son-hat': '<path d="M6.2 21.4V3.4"/><path d="M6.2 4.6h11.5l-2.3 3.8 2.3 3.8H6.2z"/><path d="M3.8 21.4h4.8"/>',
        'owl-game': '<path d="M12 3.7c4.2 0 7.3 3.2 7.3 7.5 0 4.6-3.2 8.5-7.3 8.5s-7.3-3.9-7.3-8.5c0-4.3 3.1-7.5 7.3-7.5z"/><circle cx="9.4" cy="11.2" r="2.3"/><circle cx="14.6" cy="11.2" r="2.3"/><path d="M12 13.5l-1.2 2.1h2.4z"/><path d="M7.2 7.2 8.7 8.6M16.8 7.2 15.3 8.6"/>',
        'wood-blocks': '<rect x="3.4" y="15" width="6" height="6" rx="1.5"/><rect x="10.4" y="15" width="6" height="6" rx="1.5"/><rect x="10.4" y="9" width="6" height="6" rx="1.5"/><rect x="17.4" y="9" width="6" height="6" rx="1.5"/>',
        'fps-game': '<circle cx="12" cy="12" r="7.2"/><path d="M12 2.6v3.4M12 18v3.4M2.6 12H6M18 12h3.4"/><path d="M12 12h.01"/>',
        'vektor': '<path d="M13.6 2.8 5.4 13.2h5.1L9.4 21.2 18.6 10.6h-5.2z"/>',
        'nuts-bolts': '<path d="M12 3.3 19.6 7.7v8.6L12 20.7 4.4 16.3V7.7z"/><circle cx="12" cy="12" r="3.4"/>',
        'maze-paint': '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="3.8"/><path d="M8.6 3.4v6.2H3.4M20.6 14.4h-5.2V9.6M13.6 20.6v-5"/><circle cx="6.6" cy="17.6" r="2.1"/>',
        'dino-game': '<path d="M2.4 14.6 7.5 10.6l4.1-.8c.8-.9 1.9-2.4 3.3-2.9 1.6-.5 3.4-.3 4.9.5l1.2 1.4-.4 2-3 .8-2 .2-.6 2-1.6 1.8.2 4.4h-2l-.2-4.2-2.4 1-.6 3.8h-2l.2-4-2.2-.8z"/><path d="M17.6 8.7h.01"/>',
        'community': '<path d="M14.2 4.2h5.6v5.6"/><path d="m19.8 4.2-7.6 7.6"/><path d="M18.4 13.6v5.2a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6V7.2a1.6 1.6 0 0 1 1.6-1.6h5.2"/>'
    });
    const ids = Object.freeze(Object.keys(shapes));
    function has(id) { return Object.prototype.hasOwnProperty.call(shapes, id); }
    function shape(id) { return shapes[has(id) ? id : FALLBACK]; }
    function svg(id) { return ROOT + shape(id) + '</svg>'; }
    return Object.freeze({ ROOT, FALLBACK, ids, shapes, has, shape, svg });
});
