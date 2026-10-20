document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const N = 200;
    const MIN_R = .06;
    const BASE_CUT_RATE = 3.4;
    const TOUCH_OFFSET = 58;
    const SPIN_SPEED = 8.5;
    const TAU = Math.PI * 2;

    const canvas = document.getElementById('lathe-canvas');
    const ctx = canvas.getContext('2d');
    const wrap = document.getElementById('canvas-wrap');
    const targetCanvas = document.getElementById('target-canvas');
    const compareCanvas = document.getElementById('compare-canvas');
    const shelfCanvas = document.getElementById('shelf-canvas');

    const $ = (id) => document.getElementById(id);
    const el = {
        levelNumber: $('level-number'), levelTag: $('level-tag'), topBalance: $('top-balance'), wallet: $('wallet-button'),
        orderNumber: $('order-number'), targetName: $('target-name'), targetClient: $('target-client'),
        liveScore: $('live-score-value'), matchFill: $('match-fill'), matchLabel: document.querySelector('.match-chip small'),
        hint: $('gesture-hint'), banner: $('stage-banner'),
        carveTools: $('carve-tools'), sandTools: $('sand-tools'), paintTools: $('paint-tools'),
        sandFill: $('sand-fill'), sandCoverage: $('sand-coverage'), palette: $('paint-palette'),
        next: $('next-stage'), reset: $('reset-stage'),
        compactAvatar: $('compact-avatar'), compactName: $('compact-name'), compactStatus: $('compact-status'), profileAction: $('profile-action'),
        shopList: $('shop-list'), shelfCount: $('shelf-count'),
        jobs: $('jobs-count'), stars: $('stars-count'), best: $('best-score'), earned: $('total-earned'),
        loginModal: $('login-modal'), loginForm: $('login-form'), loginError: $('login-error'), username: $('game-username'),
        resultModal: $('result-modal'), resultKicker: $('result-kicker'), resultTitle: $('result-title'), resultStars: $('result-stars'),
        resultScore: $('result-score'), resultShape: $('result-shape'), resultSand: $('result-sand'), resultPaint: $('result-paint'),
        rewardValue: $('reward-value'), rewardMultiplier: $('reward-multiplier'), guestWarning: $('guest-warning'),
        retry: $('retry-level'), newOrder: $('new-order'), confetti: $('confetti'), toast: $('game-toast')
    };

    // ---------- Catalog data ----------

    // Profiles are authored as [t, radius] points, t from the headstock (0) to the tailstock (1),
    // radius as a fraction of the blank. Pieces that stand upright on the shelf have their base at t = 0.
    const SHAPES = [
        { id: 'halter', name: 'Halter', client: 'Spor Salonu Ece', pts: [[0, .7], [.08, .72], [.18, .72], [.23, .62], [.27, .3], [.73, .3], [.77, .62], [.82, .72], [.92, .72], [1, .7]] },
        { id: 'oklava', name: 'Oklava', client: 'Fırıncı Nesrin', pts: [[0, .2], [.06, .26], [.1, .22], [.15, .3], [.18, .6], [.22, .64], [.78, .64], [.82, .6], [.85, .3], [.9, .22], [.94, .26], [1, .2]] },
        { id: 'kalem', name: 'Kurşun Kalem', client: 'Öğretmen Deniz', pts: [[0, .36], [.04, .4], [.08, .4], [.1, .34], [.72, .34], [.8, .26], [.9, .14], [.97, .07], [1, .06]] },
        { id: 'sopa', name: 'Beyzbol Sopası', client: 'Koç Baran', pts: [[0, .3], [.03, .4], [.07, .38], [.1, .22], [.32, .22], [.52, .3], [.72, .46], [.88, .58], [.96, .58], [1, .44]] },
        { id: 'roket', name: 'Oyuncak Roket', client: 'Minik Ada', pts: [[0, .55], [.06, .66], [.1, .66], [.13, .42], [.2, .46], [.62, .46], [.76, .4], [.88, .26], [.96, .12], [1, .07]] },
        { id: 'lobut', name: 'Bowling Lobutu', client: 'Salon Sahibi Can', pts: [[0, .42], [.08, .52], [.2, .6], [.34, .54], [.5, .3], [.58, .22], [.68, .24], [.8, .34], [.9, .32], [.97, .2], [1, .12]] },
        { id: 'topac', name: 'Topaç', client: 'Dede Hüsnü', pts: [[0, .08], [.1, .16], [.3, .46], [.5, .8], [.6, .82], [.65, .62], [.7, .3], [.76, .22], [.86, .24], [.94, .22], [1, .16]] },
        { id: 'mantar', name: 'Mantar', client: 'Bahçıvan Selin', pts: [[0, .4], [.08, .36], [.36, .3], [.52, .34], [.58, .52], [.66, .8], [.78, .86], [.88, .78], [.95, .55], [1, .22]] },
        { id: 'kase', name: 'Kâse Profili', client: 'Çömlekçi Elif', pts: [[0, .3], [.08, .32], [.12, .25], [.18, .33], [.36, .56], [.56, .74], [.76, .84], [.92, .88], [1, .86]] },
        { id: 'vazo', name: 'Nordik Vazo', client: 'Mina Kaya', pts: [[0, .5], [.05, .55], [.1, .44], [.2, .62], [.38, .8], [.54, .72], [.68, .4], [.8, .3], [.9, .36], [.96, .48], [1, .45]] },
        { id: 'tokmak', name: 'Marangoz Tokmağı', client: 'Usta Rıza', pts: [[0, .18], [.04, .22], [.08, .18], [.48, .2], [.53, .26], [.58, .2], [.62, .66], [.68, .76], [.92, .76], [.97, .68], [1, .58]] },
        { id: 'can', name: 'Masa Çanı', client: 'Otel Resepsiyonu', pts: [[0, .2], [.07, .26], [.12, .18], [.2, .22], [.25, .32], [.42, .4], [.6, .5], [.78, .66], [.9, .84], [.96, .88], [1, .8]] },
        { id: 'matruska', name: 'Matruşka', client: 'Koleksiyoncu Vera', pts: [[0, .58], [.06, .62], [.3, .8], [.48, .74], [.6, .54], [.65, .52], [.78, .6], [.9, .52], [.97, .34], [1, .2]] },
        { id: 'kadeh', name: 'Kadeh', client: 'Şef Arda', pts: [[0, .62], [.06, .64], [.1, .22], [.38, .15], [.43, .24], [.48, .17], [.55, .3], [.72, .6], [.9, .68], [1, .64]] },
        { id: 'piyon', name: 'Satranç Piyonu', client: 'Satranç Kulübü', pts: [[0, .7], [.07, .72], [.11, .6], [.15, .66], [.2, .48], [.44, .3], [.54, .28], [.59, .44], [.64, .3], [.72, .46], [.82, .52], [.92, .44], [1, .14]] },
        { id: 'ayak', name: 'Masa Ayağı', client: 'Mobilyacı Kerem', pts: [[0, .5], [.08, .5], [.12, .64], [.17, .4], [.26, .56], [.34, .36], [.68, .3], [.84, .44], [.89, .6], [.95, .6], [1, .5]] },
        { id: 'fener', name: 'Deniz Feneri', client: 'Kaptan Murat', pts: [[0, .76], [.06, .76], [.09, .6], [.54, .42], [.57, .6], [.62, .6], [.65, .36], [.78, .36], [.81, .5], [.9, .4], [1, .12]] },
        { id: 'samdan', name: 'Masa Şamdanı', client: 'Lara Demir', pts: [[0, .76], [.08, .76], [.12, .4], [.2, .3], [.27, .44], [.33, .3], [.5, .24], [.6, .36], [.66, .24], [.8, .26], [.87, .52], [.95, .56], [1, .5]] },
        { id: 'vezir', name: 'Satranç Veziri', client: 'Satranç Kulübü', pts: [[0, .72], [.07, .72], [.1, .6], [.14, .66], [.18, .46], [.5, .28], [.6, .32], [.65, .5], [.7, .34], [.82, .56], [.88, .58], [.92, .42], [.96, .3], [1, .2]] },
        { id: 'sah', name: 'Satranç Şahı', client: 'Büyükusta Kaan', pts: [[0, .72], [.07, .72], [.1, .6], [.13, .66], [.17, .46], [.45, .3], [.55, .36], [.6, .5], [.64, .34], [.75, .46], [.82, .5], [.86, .32], [.9, .22], [.94, .34], [.97, .3], [1, .12]] }
    ];

    const WOOD_LOOK = {
        beech: { light: [232, 192, 146], dark: [198, 146, 98], freq: 9, ring: .38, fiber: .28 },
        oak: { light: [220, 176, 116], dark: [142, 98, 54], freq: 7, ring: .72, fiber: .36 },
        walnut: { light: [148, 102, 68], dark: [72, 45, 29], freq: 8, ring: .58, fiber: .32 },
        cherry: { light: [204, 118, 76], dark: [138, 66, 38], freq: 8, ring: .46, fiber: .26 },
        zebrano: { light: [228, 202, 146], dark: [66, 46, 28], freq: 15, ring: 1, fiber: .2, stripe: true },
        ebony: { light: [62, 51, 46], dark: [20, 16, 15], freq: 10, ring: .5, fiber: .45 }
    };

    const CHISEL_LOOK = {
        steel: { blade: ['#e6ebef', '#8a959e'], ferrule: '#c9a14a', handle: ['#b4713c', '#6f3e1d'] },
        carbide: { blade: ['#9aa3ab', '#3b4148'], ferrule: '#e2bc54', handle: ['#2f3338', '#141618'] },
        damascus: { blade: ['#c9ced3', '#5b6168'], ferrule: '#b87333', handle: ['#7a2f22', '#3d150f'], wave: true },
        diamond: { blade: ['#e8fbff', '#7bc7e0'], ferrule: '#f2f6f8', handle: ['#3a5f8c', '#1b2d47'], sparkle: true }
    };

    const TOOLS = {
        rough: { half: 15, lift: (d) => (Math.abs(d) < 12 ? 0 : (Math.abs(d) - 12) * 2.2) },
        round: { half: 13, lift: (d) => 13 - Math.sqrt(Math.max(0, 169 - d * d)) },
        detail: { half: 9, lift: (d) => Math.abs(d) * 1.35 }
    };

    const STAGES = {
        carve: { label: 'Şekillendir', next: 'Zımparaya geç', hint: 'Basılı tut, keskiyi kütüğe sür', chip: 'ŞEKİL' },
        sand: { label: 'Zımparala', next: 'Boyaya geç', hint: 'Zımparayı parça boyunca gezdir', chip: 'ŞEKİL' },
        paint: { label: 'Boya', next: 'Teslim et', hint: 'Renk seç, bantları boya', chip: 'BOYA' }
    };

    const paintIds = Object.keys(CasualProfile.paints);
    const paintRgb = paintIds.map((id) => hexRgb(CasualProfile.paints[id].color));

    // ---------- Helpers ----------

    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function hexRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function rng(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function formatMultiplier(v) { return `x${Number(v).toFixed(2).replace('.', ',')}`; }
    function initials(name) {
        return String(name || '?').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toLocaleUpperCase('tr-TR');
    }
    function cheatsOpen() { return Boolean(window.CasualCheats?.features()); }
    function cheatsOn() { return Boolean(window.CasualCheats?.active()); }

    let toastTimer;
    function showToast(message) {
        el.toast.textContent = message;
        el.toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2400);
    }

    function playSound(name) {
        // Haptics follow their own setting, so they run even when sound is muted.
        if (typeof playHaptic === 'function') playHaptic(name === 'pop' ? 'success' : 'tap');
        if (typeof cpSettings === 'undefined' || !cpSettings.sound) return;
        const audio = document.getElementById(name === 'pop' ? 'global-pop-sound' : 'global-click-sound');
        if (!audio) return;
        audio.currentTime = 0;
        audio.volume = name === 'pop' ? .35 : .24;
        audio.play().catch(() => {});
    }
    function effectsOn() { return typeof cpSettings === 'undefined' || cpSettings.effects; }

    // Smooth Catmull-Rom through the authored points, sampled to N radii.
    function sampleShape(pts) {
        const out = new Float32Array(N);
        for (let i = 0; i < N; i += 1) {
            const t = i / (N - 1);
            let k = 0;
            while (k < pts.length - 2 && pts[k + 1][0] < t) k += 1;
            const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(pts.length - 1, k + 2)];
            const u = clamp((t - p1[0]) / Math.max(1e-6, p2[0] - p1[0]), 0, 1);
            const u2 = u * u, u3 = u2 * u;
            const r = .5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3);
            out[i] = clamp(r, MIN_R + .02, .9);
        }
        return out;
    }
    const shapeProfiles = SHAPES.map((s) => sampleShape(s.pts));

    // A level fixes the shape, the requested colour bands and how strict the scoring is.
    const levelCache = new Map();
    function levelSpec(level) {
        if (levelCache.has(level)) return levelCache.get(level);
        const random = rng(level * 7919 + 17);
        const shapeIndex = level <= SHAPES.length ? level - 1 : 3 + Math.floor(random() * (SHAPES.length - 3));
        const profile = shapeProfiles[shapeIndex];
        const free = level >= 5 && level % 5 === 0;
        const bandCount = level <= 2 ? 1 : level <= 6 ? 2 : level <= 12 ? 3 : 3 + Math.floor(random() * 2);

        const grooves = [];
        for (let i = 16; i < N - 16; i += 1) {
            let lowest = true;
            for (let d = -6; d <= 6; d += 1) if (profile[i + d] < profile[i]) lowest = false;
            const rise = Math.min(Math.max(...profile.slice(i - 14, i)), Math.max(...profile.slice(i + 1, i + 15))) - profile[i];
            if (lowest && rise > .04 && (!grooves.length || i - grooves[grooves.length - 1] > 10)) grooves.push(i);
        }
        let cuts = [];
        if (grooves.length >= bandCount - 1) {
            const pool = grooves.slice();
            while (cuts.length < bandCount - 1) cuts.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
        } else {
            for (let b = 1; b < bandCount; b += 1) cuts.push(Math.round((b / bandCount + (random() - .5) * .08) * (N - 1)));
        }
        cuts = cuts.sort((a, b) => a - b);

        const pool = paintIds.filter((id) => id !== 'natural');
        const colors = [];
        for (let b = 0; b < bandCount; b += 1) {
            let pick;
            do pick = pool[Math.floor(random() * pool.length)];
            while (pick === colors[b - 1] || (bandCount <= pool.length && colors.includes(pick) && random() < .8));
            colors.push(pick);
        }
        const bands = new Int8Array(N);
        let band = 0;
        for (let i = 0; i < N; i += 1) {
            while (band < cuts.length && i >= cuts[band]) band += 1;
            bands[i] = paintIds.indexOf(colors[band]);
        }
        const spec = { level, shape: SHAPES[shapeIndex], profile, free, colors: [...new Set(colors)], bands, strict: 230 + Math.min(level, 40) * 3 };
        levelCache.set(level, spec);
        return spec;
    }

    // ---------- State ----------

    const state = {
        stage: 'carve',
        spec: null,
        level: 1,
        guestLevel: 1,
        current: new Float32Array(N),
        rough: new Float32Array(N),
        sand: new Float32Array(N),
        paintIdx: new Int8Array(N),
        paintCov: new Float32Array(N),
        snapshot: null,
        tool: 'rough',
        brush: -1,
        cheatLog: null,
        cheatChisel: null,
        cheatPaint: null,
        pointer: { down: false, inside: false, touch: false, x: 0, y: 0, id: null },
        tip: { x: 0, y: 0, side: 1 },
        spin: 0,
        spinSpeed: SPIN_SPEED,
        particles: [],
        curlMeter: 0,
        cutLevel: 0,
        completed: false,
        pending: null,
        returnToResult: false,
        gestureUsed: false,
        shop: 'chisels',
        last: performance.now()
    };

    function profile() { return CasualProfile.current(); }
    function activeLevel() {
        const p = profile();
        return p && !cheatsOn() ? p.woodTurning.level : state.guestLevel;
    }
    function selectedLog() {
        const p = profile();
        return (cheatsOpen() && state.cheatLog) || p?.selectedLog || 'beech';
    }
    function selectedChisel() {
        const p = profile();
        return (cheatsOpen() && state.cheatChisel) || p?.selectedChisel || 'steel';
    }
    function ownedPaints() {
        if (cheatsOpen()) return paintIds.slice();
        return profile()?.ownedPaints || ['natural', 'honey'];
    }

    // ---------- Layout ----------

    // Geometry lives in "lathe space": the axis runs along x. On tall portrait screens the whole
    // scene is drawn rotated a quarter turn (headstock at the bottom) so the piece can be bigger.
    const L = { W: 0, H: 0, dpr: 1, rot: false, LW: 0, LH: 0, ps: 0, pe: 0, len: 0, cy: 0, R: 0, restY: 0, bedY: 0, hs: 0 };
    const bgCanvas = document.createElement('canvas');
    const bgCtx = bgCanvas.getContext('2d');
    const floorCanvas = document.createElement('canvas');
    const floorCtx = floorCanvas.getContext('2d');
    let floorMarks = 0;

    function layout() {
        const rect = wrap.getBoundingClientRect();
        const W = Math.max(280, Math.round(rect.width));
        const H = Math.max(220, Math.round(rect.height));
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        if (W === L.W && H === L.H && dpr === L.dpr) return;
        const rot = H > W * 1.15;
        const LW = rot ? H : W, LH = rot ? W : H;
        Object.assign(L, { W, H, dpr, rot, LW, LH });
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        L.hs = clamp(LW * .075, 26, 84);
        L.ps = L.hs + 8;
        L.pe = LW - L.hs - 8;
        L.len = L.pe - L.ps;
        L.R = Math.min(LH * (rot ? .3 : .29), L.len * .19);
        L.cy = Math.max(L.R + 14, LH * (rot ? .4 : .42));
        L.restY = L.cy + L.R + 16;
        L.bedY = Math.min(LH - 22, L.restY + 34);
        for (const c of [bgCanvas, floorCanvas]) { c.width = canvas.width; c.height = canvas.height; }
        floorMarks = 0;
        drawBackground();
        state.tip.x = state.tip.x || (L.ps + L.len * .5);
        state.tip.y = L.restY + 4;
    }

    function baseTransform(g) {
        if (L.rot) g.setTransform(0, -L.dpr, L.dpr, 0, 0, L.H * L.dpr);
        else g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    }

    function isPaper() { return document.body.classList.contains('theme-paper'); }

    function drawBackground() {
        const g = bgCtx;
        const { LW: W, LH: H, cy, R } = L;
        baseTransform(g);
        const paper = isPaper();
        const wall = g.createLinearGradient(0, 0, 0, H);
        wall.addColorStop(0, paper ? '#efe5d6' : '#2b1e15');
        wall.addColorStop(1, paper ? '#d8c8b1' : '#120c08');
        g.fillStyle = wall;
        g.fillRect(0, 0, W, H);

        // Pegboard
        g.fillStyle = paper ? 'rgba(90,60,30,.12)' : 'rgba(0,0,0,.28)';
        for (let y = 14; y < cy - R - 8; y += 18) for (let x = 12 + ((y / 18) % 2) * 9; x < W; x += 18) {
            g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill();
        }
        const lamp = g.createRadialGradient(W * .5, cy - R * 1.4, 10, W * .5, cy, Math.max(W, H) * .7);
        lamp.addColorStop(0, paper ? 'rgba(255,240,210,.55)' : 'rgba(255,190,110,.2)');
        lamp.addColorStop(1, 'rgba(255,190,110,0)');
        g.fillStyle = lamp;
        g.fillRect(0, 0, W, H);

        // Bed and legs
        const bedTop = L.bedY;
        const bed = g.createLinearGradient(0, bedTop, 0, bedTop + 22);
        bed.addColorStop(0, '#59646a'); bed.addColorStop(.25, '#8f9aa0'); bed.addColorStop(1, '#2c3337');
        g.fillStyle = 'rgba(0,0,0,.25)';
        g.fillRect(L.hs * .4, bedTop + 20, W - L.hs * .8, 8);
        g.fillStyle = bed;
        g.fillRect(L.hs * .3, bedTop, W - L.hs * .6, 22);
        g.fillStyle = '#1d2326';
        g.fillRect(L.hs * .6, bedTop + 22, 16, H - bedTop - 22);
        g.fillRect(W - L.hs * .6 - 16, bedTop + 22, 16, H - bedTop - 22);

        // Tool rest with its post
        const restMid = L.ps + L.len * .5;
        g.fillStyle = '#262c30';
        g.fillRect(restMid - 7, L.restY, 14, bedTop - L.restY);
        const rest = g.createLinearGradient(0, L.restY - 4, 0, L.restY + 6);
        rest.addColorStop(0, '#c7d0d5'); rest.addColorStop(1, '#4b5459');
        g.fillStyle = rest;
        roundRect(g, L.ps - 6, L.restY - 4, L.len + 12, 9, 4);
        g.fill();

        // Headstock
        const hsW = L.hs;
        const head = g.createLinearGradient(0, cy - R * 1.2, 0, bedTop);
        head.addColorStop(0, '#3f7a6e'); head.addColorStop(.5, '#2c5b52'); head.addColorStop(1, '#1b3b35');
        g.fillStyle = head;
        roundRect(g, 0, cy - Math.max(R * 1.05, 40), hsW, bedTop - (cy - Math.max(R * 1.05, 40)), 10);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,.12)';
        g.fillRect(4, cy - Math.max(R * 1.05, 40) + 4, hsW - 8, 4);
        // Tailstock
        g.fillStyle = head;
        const tsTop = cy - Math.max(R * .7, 30);
        roundRect(g, W - hsW, tsTop, hsW, bedTop - tsTop, 10);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,.12)';
        g.fillRect(W - hsW + 4, tsTop + 4, hsW - 8, 4);
        // Quill
        const quill = g.createLinearGradient(0, cy - 9, 0, cy + 9);
        quill.addColorStop(0, '#dfe5e8'); quill.addColorStop(1, '#5d676c');
        g.fillStyle = quill;
        g.fillRect(L.pe + 6, cy - 8, W - hsW - L.pe - 4, 16);
    }

    function roundRect(g, x, y, w, h, r) {
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
    }

    // ---------- Wood renderer ----------
    // Each visible pixel of the turned piece is shaded as a point on a surface of revolution:
    // a 3D ring texture (offset pith, so rings sweep as it spins), fibre noise, tool ridges
    // until sanded, paint, and Blinn-Phong light.

    const ANG = 1024;
    const COS = new Float32Array(ANG), SIN = new Float32Array(ANG);
    for (let i = 0; i < ANG; i += 1) { COS[i] = Math.cos(i / ANG * TAU); SIN[i] = Math.sin(i / ANG * TAU); }
    const VL = 1024;
    const ASIN = new Float32Array(VL), SQ = new Float32Array(VL);
    for (let i = 0; i < VL; i += 1) { const v = i / (VL - 1) * 2 - 1; ASIN[i] = Math.asin(v); SQ[i] = Math.sqrt(1 - v * v); }
    const FW = 1024, FH = 256;
    const FIB = new Float32Array(FW * FH);
    (function buildFibres() {
        const r = rng(99);
        const grid = new Float32Array(32 * 32).map(() => r());
        const grid2 = new Float32Array(64 * 64).map(() => r());
        const smooth = (t) => t * t * (3 - 2 * t);
        const sample = (g, n, x, y) => {
            const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
            const a = g[(yi % n) * n + (xi % n)], b = g[(yi % n) * n + ((xi + 1) % n)];
            const c = g[((yi + 1) % n) * n + (xi % n)], d = g[((yi + 1) % n) * n + ((xi + 1) % n)];
            return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
        };
        // Tileable both ways; long along x (the grain direction), fine across the circumference.
        for (let y = 0; y < FH; y += 1) for (let x = 0; x < FW; x += 1) {
            FIB[y * FW + x] = sample(grid, 32, x / 32, y / 8) * .6 + sample(grid2, 64, x / 16, y / 4) * .4;
        }
    })();
    const WARP = new Float32Array(N);
    (function buildWarp() {
        const r = rng(7);
        const a = r() * 6, b = r() * 6;
        for (let i = 0; i < N; i += 1) { const t = i / N; WARP[i] = Math.sin(t * 7.3 + a) * .9 + Math.sin(t * 17.1 + b) * .35; }
    })();

    const pieceCanvas = document.createElement('canvas');
    const pieceCtx = pieceCanvas.getContext('2d');
    let pieceImage = null, pieceData = null;

    // Key light from the screen's upper left, expressed in lathe space for both orientations.
    function lightFor(rotated) {
        const [x, y, z] = rotated ? [.72, -.36, .6] : [-.36, -.72, .6];
        const n = Math.hypot(x, y, z);
        const l = [x / n, y / n, z / n];
        const h = [l[0], l[1], l[2] + 1];
        const hn = Math.hypot(...h);
        return { l, h: h.map((c) => c / hn) };
    }
    const LIGHTS = [lightFor(false), lightFor(true)];

    function renderPiece(target, o) {
        const bw = Math.max(8, Math.round(o.len * o.q));
        const bh = Math.max(8, Math.round(o.R * 2 * o.q) + 2);
        if (!pieceImage || pieceImage.width !== bw || pieceImage.height !== bh) {
            pieceCanvas.width = bw; pieceCanvas.height = bh;
            pieceImage = pieceCtx.createImageData(bw, bh);
            pieceData = new Uint32Array(pieceImage.data.buffer);
        }
        const data = pieceData;
        data.fill(0);
        const look = WOOD_LOOK[o.log] || WOOD_LOOK.beech;
        const prof = o.profile;
        const Rq = o.R * o.q;
        const cyq = bh / 2;
        const colStep = (N - 1) / Math.max(1, bw - 1);
        const spinIdx = o.spin / TAU * ANG;
        const pithX = .16, pithZ = .05;
        const lr = look.light[0], lg = look.light[1], lb = look.light[2];
        const dr = look.dark[0] - lr, dg = look.dark[1] - lg, db = look.dark[2] - lb;
        const ringK = look.ring, fibK = look.fiber, freq = look.freq;
        const ridgeFreq = .9 / o.q;
        const light = LIGHTS[o.rot ? 1 : 0];
        const [lx, ly, lz] = light.l, [hx, hy, hz] = light.h;

        for (let col = 0; col < bw; col += 1) {
            const s = col * colStep;
            const i = Math.min(N - 2, s | 0);
            const f = s - i;
            const r = prof[i] + (prof[i + 1] - prof[i]) * f;
            const rpx = r * Rq;
            if (rpx < .5) continue;
            // Normals come from a wider window so tiny depth differences don't strobe the light.
            const ia = Math.max(0, i - 2), ib = Math.min(N - 1, i + 3);
            const slope = (prof[ib] - prof[ia]) / ((ib - ia) / colStep) * Rq * -1;
            const inv = 1 / Math.sqrt(slope * slope + 1);
            const warp = WARP[i] + (WARP[i + 1] - WARP[i]) * f;
            const xIdx = (col / o.q * .5) & (FW - 1);
            const rough = o.rough ? o.rough[i] : 0;
            const sanded = o.sand ? o.sand[i] : 1;
            const ridge = rough * (1 - sanded) * .06 * Math.sin(col * ridgeFreq);
            const pIdx = o.paintIdx ? o.paintIdx[i] : -1;
            const pCov = pIdx >= 0 ? (o.paintCov ? o.paintCov[i] : 1) : 0;
            const pc = pIdx >= 0 ? paintRgb[pIdx] : null;
            const gloss = pCov > .5 ? 2 : sanded > .5 ? 1 : 0;
            const specK = gloss === 2 ? .55 : gloss === 1 ? .22 : .1;
            const y0 = Math.max(0, Math.floor(cyq - rpx - 1));
            const y1 = Math.min(bh - 1, Math.ceil(cyq + rpx + 1));
            for (let y = y0; y <= y1; y += 1) {
                const dy = y + .5 - cyq;
                const ady = dy < 0 ? -dy : dy;
                let a = rpx - ady + .5;
                if (a <= 0) continue;
                if (a > 1) a = 1;
                let v = dy / rpx;
                if (v > 1) v = 1; else if (v < -1) v = -1;
                const vi = ((v + 1) * .5 * (VL - 1)) | 0;
                const cz = SQ[vi];
                const ai = ((ASIN[vi] / TAU * ANG + spinIdx) | 0) & (ANG - 1);
                const px = r * COS[ai] - pithX, pz = r * SIN[ai] - pithZ;
                const ring = Math.sqrt(px * px + pz * pz) * freq + warp;
                let fr = ring - Math.floor(ring);
                let w;
                if (look.stripe) w = fr > .55 ? (fr > .62 ? 1 : (fr - .55) / .07) : 0;
                else { w = fr * fr; w *= w; }
                const fib = FIB[((ai >> 2) & (FH - 1)) * FW + xIdx] - .5;
                let tone = ringK * w + fibK * fib + ridge;
                if (tone < -.3) tone = -.3; else if (tone > 1.2) tone = 1.2;
                let cr = lr + dr * tone, cg = lg + dg * tone, cb = lb + db * tone;
                if (pc) {
                    const k = pCov * (.92 + fib * .1);
                    cr += (pc[0] * (1 + fib * .08) - cr) * k; cg += (pc[1] * (1 + fib * .08) - cg) * k; cb += (pc[2] * (1 + fib * .08) - cb) * k;
                }
                const nx = slope * inv, ny = v * inv, nz = cz * inv;
                let diff = nx * lx + ny * ly + nz * lz;
                if (diff < 0) diff = 0;
                let sp = nx * hx + ny * hy + nz * hz;
                if (sp < 0) sp = 0;
                sp *= sp; sp *= sp; sp *= sp;
                if (gloss) { sp *= sp; if (gloss === 2) sp *= sp; }
                const shade = .34 + diff * .8;
                const spec = sp * specK * 255;
                let R8 = cr * shade + spec, G8 = cg * shade + spec, B8 = cb * shade + spec;
                if (R8 > 255) R8 = 255; if (G8 > 255) G8 = 255; if (B8 > 255) B8 = 255;
                data[y * bw + col] = ((a * 255) << 24) | ((B8 | 0) << 16) | ((G8 | 0) << 8) | (R8 | 0);
            }
        }
        pieceCtx.putImageData(pieceImage, 0, 0);
        target.drawImage(pieceCanvas, 0, 0, bw, bh, o.x, o.cy - bh / o.q / 2, o.len, bh / o.q);
    }

    function pieceQuality(len, R) {
        const want = effectsOn() ? Math.min(2, window.devicePixelRatio || 1) : 1;
        return clamp(Math.min(want, Math.sqrt(240000 / Math.max(1, len * R * 2))), .6, 2);
    }

    // ---------- Level flow ----------

    function freshBlank() {
        state.current.fill(1);
        state.rough.fill(0);
        state.sand.fill(0);
        state.paintIdx.fill(-1);
        state.paintCov.fill(0);
    }

    function beginLevel(level) {
        state.level = level;
        state.spec = levelSpec(level);
        freshBlank();
        state.snapshot = null;
        state.particles.length = 0;
        state.completed = false;
        state.pending = null;
        state.spinSpeed = SPIN_SPEED;
        floorCtx.clearRect(0, 0, floorCanvas.width, floorCanvas.height);
        floorMarks = 0;
        const p = profile();
        el.levelNumber.textContent = level;
        el.levelTag.hidden = !state.spec.free;
        el.orderNumber.textContent = `#${String((p?.woodTurning.jobs || 0) + 1).padStart(3, '0')}`;
        el.targetName.textContent = state.spec.shape.name;
        el.targetClient.textContent = state.spec.free ? 'Serbest tasarım · renkler senin' : state.spec.shape.client;
        state.brush = paintIds.indexOf(state.spec.free ? (ownedPaints()[1] || 'honey') : state.spec.colors[0]);
        setStage('carve', true);
        drawTargetCard();
        updateMetrics();
    }

    function setStage(stage, quiet) {
        state.stage = stage;
        clearResetConfirm();
        document.body.dataset.stage = stage;
        const copy = STAGES[stage];
        el.next.querySelector('span').textContent = copy.next;
        el.hint.querySelector('p').textContent = copy.hint;
        el.hint.classList.remove('hidden');
        state.gestureUsed = false;
        el.carveTools.hidden = stage !== 'carve';
        el.sandTools.hidden = stage !== 'sand';
        el.paintTools.hidden = stage !== 'paint';
        el.matchLabel.textContent = copy.chip;
        const order = ['carve', 'sand', 'paint'];
        document.querySelectorAll('.stage-track li').forEach((item, index) => {
            item.classList.toggle('active', item.dataset.step === stage);
            item.classList.toggle('done', index < order.indexOf(stage));
        });
        renderPalette();
        if (!quiet) {
            el.banner.textContent = copy.label;
            el.banner.classList.remove('show');
            void el.banner.offsetWidth;
            el.banner.classList.add('show');
            playSound('click');
        }
        updateMetrics();
    }

    // ---------- Scoring ----------

    function shapeScore() {
        const target = state.spec.profile;
        let err = 0, over = 0;
        for (let i = 0; i < N; i += 1) {
            const d = state.current[i] - target[i];
            err += Math.abs(d);
            if (d < 0) over -= d;
        }
        return clamp(Math.round(100 - (err / N) * state.spec.strict - (over / N) * 140), 0, 100);
    }
    function sandScore() {
        let s = 0;
        for (let i = 0; i < N; i += 1) s += Math.min(1, state.sand[i]);
        return clamp(Math.round(s / N * 100), 0, 100);
    }
    function paintScore() {
        let s = 0;
        for (let i = 0; i < N; i += 1) {
            if (state.paintIdx[i] < 0) continue;
            if (state.spec.free || state.paintIdx[i] === state.spec.bands[i]) s += state.paintCov[i];
        }
        return clamp(Math.round(s / N * 100), 0, 100);
    }
    function overallScore(shape, sand, paint) {
        return clamp(Math.round(shape * .7 + paint * .25 + sand * .05), 0, 100);
    }

    let metricsQueued = false;
    function updateMetrics() {
        if (metricsQueued) return;
        metricsQueued = true;
        requestAnimationFrame(() => {
            metricsQueued = false;
            const value = state.stage === 'paint' ? paintScore() : shapeScore();
            el.liveScore.textContent = `${value}%`;
            el.matchFill.style.width = `${value}%`;
            el.matchFill.dataset.good = value >= 85 ? 'yes' : 'no';
            const sand = sandScore();
            el.sandCoverage.textContent = `${sand}%`;
            el.sandFill.style.width = `${sand}%`;
            el.next.classList.toggle('ready', (state.stage === 'carve' && value >= 88) || (state.stage === 'sand' && sand >= 90) || (state.stage === 'paint' && value >= 90));
        });
    }

    // ---------- Tools ----------

    function sampleAtX(x) { return (x - L.ps) / L.len * (N - 1); }
    function xAtSample(i) { return L.ps + i / (N - 1) * L.len; }
    function radiusAtX(x) {
        const s = clamp(sampleAtX(x), 0, N - 1);
        const i = Math.min(N - 2, s | 0);
        return state.current[i] + (state.current[i + 1] - state.current[i]) * (s - i);
    }

    function updateTip(dt) {
        const p = state.pointer;
        const tx = clamp(p.x, L.ps - 4, L.pe + 4);
        let ty;
        if (state.stage === 'carve' && p.down) {
            const side = p.y < L.cy ? -1 : 1;
            state.tip.side = side;
            ty = p.touch ? p.y - TOUCH_OFFSET * side : p.y;
            if (side === 1) ty = Math.max(ty, L.cy + MIN_R * L.R);
            else ty = Math.min(ty, L.cy - MIN_R * L.R);
        } else {
            state.tip.side = 1;
            ty = L.restY - 2;
        }
        const k = 1 - Math.exp(-dt * 28);
        state.tip.x += (tx - state.tip.x) * k;
        state.tip.y += (ty - state.tip.y) * k;
    }

    function carve(dt) {
        const tool = TOOLS[state.tool];
        const tipR = Math.abs(state.tip.y - L.cy) / L.R;
        if (tipR >= 1.02) { state.cutLevel = 0; return; }
        const rate = BASE_CUT_RATE * (CasualProfile.chisels[selectedChisel()]?.speed || 1) * dt;
        const pxPerSample = L.len / (N - 1);
        const center = sampleAtX(state.tip.x);
        const reach = Math.ceil(tool.half / pxPerSample);
        let removed = 0;
        for (let s = Math.floor(center - reach); s <= Math.ceil(center + reach); s += 1) {
            if (s < 0 || s >= N) continue;
            const d = (s - center) * pxPerSample;
            if (Math.abs(d) > tool.half) continue;
            const desired = Math.max(MIN_R, tipR + tool.lift(d) / L.R);
            const now = state.current[s];
            if (now <= desired) continue;
            const next = Math.max(desired, now - rate);
            state.current[s] = next;
            state.rough[s] = 1;
            state.sand[s] = 0;
            state.paintCov[s] = 0;
            removed += now - next;
        }
        // A real gouge leaves a continuous surface: knock down single-sample peaks it skipped over.
        if (removed > 0) {
            for (let s = Math.max(1, Math.floor(center - reach)); s <= Math.min(N - 2, Math.ceil(center + reach)); s += 1) {
                const avg = (state.current[s - 1] + state.current[s + 1]) * .5;
                if (state.current[s] > avg + .004) {
                    const next = Math.max(avg, MIN_R);
                    removed += state.current[s] - next;
                    state.current[s] = next;
                }
            }
        }
        const px = removed * L.R;
        state.cutLevel = Math.min(1, px / (dt * 260));
        if (px > .05) {
            markGestureUsed();
            updateMetrics();
            const contactY = L.cy + state.tip.side * radiusAtX(state.tip.x) * L.R;
            emitChips(state.tip.x, contactY, px);
        }
    }

    function sandStep(dt) {
        const half = 22;
        const pxPerSample = L.len / (N - 1);
        const center = sampleAtX(state.pointer.x);
        const reach = Math.ceil(half / pxPerSample);
        const copy = state.current.slice();
        let touched = 0;
        for (let s = Math.floor(center - reach); s <= Math.ceil(center + reach); s += 1) {
            if (s < 1 || s >= N - 1) continue;
            const d = Math.abs(s - center) * pxPerSample / half;
            if (d > 1) continue;
            const w = Math.cos(d * Math.PI * .5);
            const avg = (copy[s - 1] + copy[s] * 2 + copy[s + 1]) / 4;
            state.current[s] += (avg - state.current[s]) * Math.min(1, dt * 3 * w);
            state.sand[s] = Math.min(1, state.sand[s] + dt * 3.6 * w);
            touched += w;
        }
        if (touched) {
            markGestureUsed();
            updateMetrics();
            state.cutLevel = .5;
            const y = L.cy + radiusAtX(state.pointer.x) * L.R;
            if (Math.random() < dt * 40) emitDust(state.pointer.x, y, '#f0d9ae');
        }
    }

    function paintStep(dt) {
        if (state.brush < 0) return;
        const half = 16;
        const pxPerSample = L.len / (N - 1);
        const center = sampleAtX(state.pointer.x);
        const reach = Math.ceil((half + 3) / pxPerSample);
        for (let s = Math.floor(center - reach); s <= Math.ceil(center + reach); s += 1) {
            if (s < 0 || s >= N) continue;
            const d = Math.abs(s - center) * pxPerSample;
            const w = d <= half ? 1 : d <= half + 3 ? 1 - (d - half) / 3 : 0;
            if (!w) continue;
            if (state.paintIdx[s] !== state.brush) {
                state.paintIdx[s] = state.brush;
                state.paintCov[s] = Math.min(state.paintCov[s] * .25, .2);
            }
            state.paintCov[s] = Math.min(1, state.paintCov[s] + dt * 7 * w);
        }
        markGestureUsed();
        updateMetrics();
        state.cutLevel = .4;
        const y = L.cy + radiusAtX(state.pointer.x) * L.R;
        if (Math.random() < dt * 50) emitDust(state.pointer.x, y + 4, CasualProfile.paints[paintIds[state.brush]].color, true);
    }

    function markGestureUsed() {
        if (state.gestureUsed) return;
        state.gestureUsed = true;
        el.hint.classList.add('hidden');
    }

    // ---------- Particles ----------

    function woodChipColor() {
        const look = WOOD_LOOK[selectedLog()] || WOOD_LOOK.beech;
        return `rgb(${look.light.map((c) => Math.min(255, c + 12)).join(',')})`;
    }

    function emitChips(x, y, amount) {
        if (!effectsOn()) return;
        const color = woodChipColor();
        const side = state.tip.side;
        const count = Math.min(4, Math.round(amount * .5 + Math.random()));
        for (let i = 0; i < count; i += 1) {
            state.particles.push({
                kind: 'chip', x: x + (Math.random() - .5) * 10, y,
                vx: (Math.random() - .5) * 160 - 60, vy: side * (40 + Math.random() * 120) - 140,
                rot: Math.random() * TAU, vr: (Math.random() - .5) * 20, size: 2 + Math.random() * 4, life: 1.6, color
            });
        }
        state.curlMeter += amount * (state.tool === 'detail' ? .3 : 1);
        if (state.curlMeter > 26) {
            state.curlMeter = 0;
            state.particles.push({
                kind: 'curl', x, y, vx: -80 - Math.random() * 120, vy: side * 30 - 170 - Math.random() * 80,
                rot: Math.random() * TAU, vr: (Math.random() - .5) * 9, size: 5 + Math.random() * 6, grow: 0, life: 2.2, color
            });
        }
        if (state.particles.length > 260) state.particles.splice(0, state.particles.length - 260);
    }

    function emitDust(x, y, color, mist) {
        if (!effectsOn()) return;
        state.particles.push({
            kind: 'dust', x: x + (Math.random() - .5) * 26, y, vx: (Math.random() - .5) * 60, vy: mist ? -20 - Math.random() * 40 : 10 + Math.random() * 30,
            size: 1.5 + Math.random() * 2.5, life: .9, color
        });
    }

    function stepParticles(dt) {
        const list = state.particles;
        for (let i = list.length - 1; i >= 0; i -= 1) {
            const p = list[i];
            p.life -= dt;
            const gravity = p.kind === 'dust' ? 40 : 620;
            if (L.rot) p.vx -= gravity * dt; else p.vy += gravity * dt;
            p.vx *= 1 - dt * (p.kind === 'curl' ? 1.2 : .4);
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.vr) p.rot += p.vr * dt;
            if (p.kind === 'curl') p.grow = Math.min(1, p.grow + dt * 3);
            if (!L.rot && p.kind !== 'dust' && p.y > L.bedY - 1 && p.vy > 0) {
                landParticle(p);
                list.splice(i, 1);
                continue;
            }
            if (p.life <= 0 || p.y > L.LH + 20 || p.x < -20) list.splice(i, 1);
        }
    }

    function landParticle(p) {
        if (floorMarks > 1400) return;
        floorMarks += 1;
        const g = floorCtx;
        baseTransform(g);
        g.save();
        g.translate(p.x, L.bedY - 1 + Math.random() * 2);
        g.rotate(p.rot);
        g.fillStyle = p.color;
        g.globalAlpha = .9;
        if (p.kind === 'curl') {
            drawCurl(g, p.size * .8, 1);
        } else {
            g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        g.restore();
    }

    function drawCurl(g, size, grow) {
        g.strokeStyle = g.fillStyle;
        g.lineWidth = Math.max(1.4, size * .28);
        g.lineCap = 'round';
        g.beginPath();
        const turns = 2.6 * grow + .4;
        const steps = Math.ceil(turns * 10);
        for (let k = 0; k <= steps; k += 1) {
            const a = k / 10 * TAU * .5;
            const rr = size * (.25 + k / steps * .75);
            const px = Math.cos(a) * rr, py = Math.sin(a) * rr * .7;
            if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.stroke();
    }

    function drawParticles() {
        for (const p of state.particles) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, p.life * 1.5);
            ctx.fillStyle = p.color;
            ctx.translate(p.x, p.y);
            if (p.kind === 'curl') {
                ctx.rotate(p.rot);
                drawCurl(ctx, p.size, p.grow);
            } else if (p.kind === 'chip') {
                ctx.rotate(p.rot);
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size, 0, TAU);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    // ---------- Scene drawing ----------

    function drawSpinners() {
        const { cy, ps, pe } = L;
        // Spur drive
        ctx.save();
        ctx.translate(ps - 4, cy);
        const hub = ctx.createLinearGradient(0, -14, 0, 14);
        hub.addColorStop(0, '#e2e7ea'); hub.addColorStop(1, '#4e585e');
        ctx.fillStyle = hub;
        ctx.fillRect(-L.hs + 12, -12, L.hs - 8, 24);
        for (let k = 0; k < 4; k += 1) {
            const a = state.spin + k * Math.PI / 2;
            const yy = Math.sin(a) * 10;
            ctx.fillStyle = Math.cos(a) > 0 ? '#c3cbd0' : '#6d777d';
            ctx.fillRect(-2, yy - 2, 8, 4);
        }
        ctx.restore();
        // Live centre cone
        ctx.save();
        ctx.translate(pe + 4, cy);
        ctx.fillStyle = '#b9c2c7';
        ctx.beginPath();
        ctx.moveTo(-6, 0); ctx.lineTo(6, -8); ctx.lineTo(6, 8); ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function drawShadow() {
        let sum = 0;
        for (let i = 0; i < N; i += 4) sum += state.current[i];
        const avg = sum / (N / 4);
        ctx.save();
        ctx.translate(L.ps + L.len / 2, L.bedY + 2);
        ctx.scale(L.len * .55, 6 + avg * 8);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, 'rgba(0,0,0,.42)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, TAU);
        ctx.fill();
        ctx.restore();
    }

    function drawGuide() {
        if (state.stage === 'paint') { drawBandGuide(); return; }
        const target = state.spec.profile;
        const pts = (sign) => {
            ctx.beginPath();
            for (let i = 0; i < N; i += 1) {
                const x = xAtSample(i), y = L.cy + sign * target[i] * L.R;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
        };
        ctx.save();
        ctx.lineJoin = 'round';
        for (const sign of [-1, 1]) {
            pts(sign);
            ctx.strokeStyle = 'rgba(10,8,6,.55)';
            ctx.lineWidth = 5;
            ctx.stroke();
            pts(sign);
            ctx.strokeStyle = '#fffbe8';
            ctx.lineWidth = 2.2;
            ctx.setLineDash([7, 6]);
            ctx.lineDashOffset = -state.spin * 2;
            ctx.stroke();
            ctx.setLineDash([]);
        }
        // Overcut warnings
        ctx.strokeStyle = '#ff4d3d';
        ctx.lineWidth = 3;
        for (const sign of [-1, 1]) {
            let open = false;
            ctx.beginPath();
            for (let i = 0; i < N; i += 1) {
                const bad = state.current[i] < target[i] - .025;
                const x = xAtSample(i), y = L.cy + sign * state.current[i] * L.R;
                if (bad && !open) { ctx.moveTo(x, y); open = true; } else if (bad) ctx.lineTo(x, y); else open = false;
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawBandGuide() {
        if (state.spec.free) return;
        // Thin colour ticks above the piece show where each requested band goes.
        const bands = state.spec.bands;
        const y = L.cy - L.R - 12;
        ctx.save();
        let start = 0;
        for (let i = 1; i <= N; i += 1) {
            if (i === N || bands[i] !== bands[start]) {
                ctx.fillStyle = CasualProfile.paints[paintIds[bands[start]]].color;
                const x0 = xAtSample(start), x1 = xAtSample(i - 1);
                roundRect(ctx, x0 + 1, y - 4, Math.max(2, x1 - x0 - 2), 8, 4);
                ctx.fill();
                if (i < N) {
                    ctx.strokeStyle = 'rgba(255,255,255,.55)';
                    ctx.setLineDash([3, 4]);
                    ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    const bx = (x1 + xAtSample(i)) / 2;
                    ctx.moveTo(bx, y + 6);
                    ctx.lineTo(bx, L.cy + L.R + 6);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
                start = i;
            }
        }
        ctx.restore();
    }

    function drawChisel() {
        const look = CHISEL_LOOK[selectedChisel()] || CHISEL_LOOK.steel;
        const { x, y, side } = state.tip;
        const jitter = state.cutLevel > .1 ? (Math.random() - .5) * 1.2 : 0;
        ctx.save();
        ctx.translate(x + jitter, y);
        if (side < 0) ctx.scale(1, -1);
        ctx.rotate(-.18);
        const scale = clamp(L.R / 120, .62, 1.15);
        ctx.scale(scale, scale);
        const bladeLen = 92, w = state.tool === 'detail' ? 9 : state.tool === 'round' ? 12 : 14;
        const blade = ctx.createLinearGradient(-w, 0, w, 0);
        blade.addColorStop(0, look.blade[1]); blade.addColorStop(.45, look.blade[0]); blade.addColorStop(1, look.blade[1]);
        ctx.fillStyle = blade;
        ctx.strokeStyle = 'rgba(0,0,0,.5)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        if (state.tool === 'detail') {
            ctx.moveTo(0, 0); ctx.lineTo(w, 18);
        } else if (state.tool === 'round') {
            ctx.moveTo(-w, 10); ctx.quadraticCurveTo(0, -8, w, 10);
        } else {
            ctx.moveTo(-w, 2); ctx.lineTo(w, 0); ctx.lineTo(w, 6);
        }
        ctx.lineTo(w * .7, bladeLen); ctx.lineTo(-w * .7, bladeLen);
        if (state.tool === 'detail') ctx.lineTo(-w, 18);
        else if (state.tool === 'rough') ctx.lineTo(-w, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (look.wave) {
            ctx.strokeStyle = 'rgba(40,44,50,.45)';
            ctx.lineWidth = 1;
            for (let k = 14; k < bladeLen; k += 7) {
                ctx.beginPath();
                ctx.moveTo(-w * .7, k);
                ctx.quadraticCurveTo(0, k - 5, w * .7, k + 2);
                ctx.stroke();
            }
        }
        if (look.sparkle) {
            ctx.fillStyle = `rgba(255,255,255,${.5 + .5 * Math.sin(performance.now() / 120)})`;
            ctx.fillRect(-2, 20, 4, 4);
            ctx.fillRect(3, 46, 3, 3);
        }
        ctx.fillStyle = look.ferrule;
        ctx.fillRect(-w * .85, bladeLen - 2, w * 1.7, 12);
        const handle = ctx.createLinearGradient(-12, 0, 12, 0);
        handle.addColorStop(0, look.handle[1]); handle.addColorStop(.4, look.handle[0]); handle.addColorStop(1, look.handle[1]);
        ctx.fillStyle = handle;
        roundRect(ctx, -11, bladeLen + 10, 22, 120, 10);
        ctx.fill();
        ctx.restore();
    }

    function drawSander() {
        const x = state.pointer.inside || state.pointer.down ? clamp(state.pointer.x, L.ps, L.pe) : L.ps + L.len / 2;
        const r = radiusAtX(x);
        const y = L.cy + r * L.R + (state.pointer.down ? 1 : 10);
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = '#d8b878';
        roundRect(ctx, -26, 0, 52, 14, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(80,50,20,.35)';
        for (let k = 0; k < 18; k += 1) ctx.fillRect(-24 + (k * 37 % 48), 2 + (k * 13 % 10), 1.5, 1.5);
        ctx.fillStyle = '#3c6fb4';
        roundRect(ctx, -22, 14, 44, 20, 6);
        ctx.fill();
        ctx.restore();
    }

    function drawSprayer() {
        const x = state.pointer.inside || state.pointer.down ? clamp(state.pointer.x, L.ps, L.pe) : L.ps + L.len / 2;
        const r = radiusAtX(x);
        const y = L.cy + r * L.R + 26;
        const color = state.brush >= 0 ? CasualProfile.paints[paintIds[state.brush]].color : '#ccc';
        ctx.save();
        if (state.pointer.down) {
            const cone = ctx.createLinearGradient(0, y, 0, y - 26);
            cone.addColorStop(0, `${color}cc`);
            cone.addColorStop(1, `${color}22`);
            ctx.fillStyle = cone;
            ctx.beginPath();
            ctx.moveTo(x - 3, y); ctx.lineTo(x - 15, y - 26); ctx.lineTo(x + 15, y - 26); ctx.lineTo(x + 3, y);
            ctx.closePath();
            ctx.fill();
        }
        ctx.translate(x, y);
        ctx.fillStyle = '#d7dde0';
        ctx.fillRect(-4, 0, 8, 10);
        ctx.fillStyle = color;
        roundRect(ctx, -13, 10, 26, 54, 8);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.fillRect(-9, 16, 4, 40);
        ctx.restore();
    }

    // ---------- Audio ----------

    let audio = null;
    function ensureAudio() {
        if (audio || typeof cpSettings === 'undefined' || !cpSettings.sound) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try {
            const ac = new AC();
            const master = ac.createGain();
            master.gain.value = .5;
            master.connect(ac.destination);
            const hum = ac.createOscillator();
            hum.type = 'sawtooth';
            hum.frequency.value = 52;
            const humFilter = ac.createBiquadFilter();
            humFilter.type = 'lowpass';
            humFilter.frequency.value = 240;
            const humGain = ac.createGain();
            humGain.gain.value = .025;
            hum.connect(humFilter).connect(humGain).connect(master);
            hum.start();
            const buffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
            const ch = buffer.getChannelData(0);
            for (let i = 0; i < ch.length; i += 1) ch[i] = Math.random() * 2 - 1;
            const noise = ac.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;
            const band = ac.createBiquadFilter();
            band.type = 'bandpass';
            band.frequency.value = 1800;
            band.Q.value = .8;
            const cutGain = ac.createGain();
            cutGain.gain.value = 0;
            noise.connect(band).connect(cutGain).connect(master);
            noise.start();
            audio = { ac, band, cutGain, humGain };
        } catch {
            audio = null;
        }
    }

    function updateAudio() {
        if (!audio) return;
        const muted = typeof cpSettings !== 'undefined' && !cpSettings.sound;
        const t = audio.ac.currentTime;
        const freq = state.stage === 'carve' ? 1700 : state.stage === 'sand' ? 3600 : 6500;
        audio.band.frequency.setTargetAtTime(freq, t, .05);
        const level = muted || document.hidden ? 0 : state.cutLevel * (state.stage === 'carve' ? .32 : .12);
        audio.cutGain.gain.setTargetAtTime(level, t, .03);
        audio.humGain.gain.setTargetAtTime(muted || document.hidden ? 0 : .025 * (state.spinSpeed / SPIN_SPEED), t, .1);
    }

    // ---------- Frame ----------

    function frame(now) {
        const dt = Math.min(.05, (now - state.last) / 1000);
        state.last = now;
        layout();
        const spinTarget = state.completed ? 0 : SPIN_SPEED;
        state.spinSpeed += (spinTarget - state.spinSpeed) * Math.min(1, dt * 2);
        state.spin = (state.spin + state.spinSpeed * dt) % TAU;
        state.cutLevel *= Math.max(0, 1 - dt * 10);
        updateTip(dt);
        if (state.pointer.down && !state.completed) {
            if (state.stage === 'carve') carve(dt);
            else if (state.stage === 'sand') sandStep(dt);
            else paintStep(dt);
        }
        stepParticles(dt);
        updateAudio();

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(bgCanvas, 0, 0);
        ctx.drawImage(floorCanvas, 0, 0);
        baseTransform(ctx);
        drawShadow();
        drawSpinners();
        renderPiece(ctx, {
            profile: state.current, rough: state.rough, sand: state.sand, paintIdx: state.paintIdx, paintCov: state.paintCov,
            log: selectedLog(), spin: state.spin, x: L.ps, len: L.len, cy: L.cy, R: L.R, q: pieceQuality(L.len, L.R), rot: L.rot
        });
        drawGuide();
        drawParticles();
        if (state.stage === 'carve') drawChisel();
        else if (state.stage === 'sand') drawSander();
        else drawSprayer();
        requestAnimationFrame(frame);
    }

    // ---------- Static previews ----------

    function drawTargetCard() {
        const c = targetCanvas.getContext('2d');
        const w = targetCanvas.width, h = targetCanvas.height;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, w, h);
        const spec = state.spec;
        const R = h * .4;
        renderPiece(c, {
            profile: spec.profile, paintIdx: spec.free ? null : spec.bands, sand: null, log: selectedLog(),
            spin: .6, x: 12, len: w - 24, cy: h / 2, R, q: 1
        });
        if (spec.free) {
            c.font = '800 13px Outfit, sans-serif';
            c.fillStyle = 'rgba(255,255,255,.9)';
            c.textAlign = 'right';
            c.fillText('★ SERBEST', w - 8, 16);
        }
    }

    function drawCompare() {
        const c = compareCanvas.getContext('2d');
        const w = compareCanvas.width, h = compareCanvas.height;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, w, h);
        const spec = state.spec;
        const R = 46;
        const rows = [
            { label: 'SENİN PARÇAN', cy: 74, opts: { profile: state.current, rough: state.rough, sand: state.sand, paintIdx: state.paintIdx, paintCov: state.paintCov } },
            { label: 'İSTENEN', cy: 192, opts: { profile: spec.profile, paintIdx: spec.free ? null : spec.bands } }
        ];
        c.font = '800 12px Outfit, sans-serif';
        for (const row of rows) {
            c.fillStyle = 'rgba(255,255,255,.55)';
            c.fillText(row.label, 24, row.cy - R - 8);
            renderPiece(c, { ...row.opts, log: selectedLog(), spin: .9, x: 24, len: w - 48, cy: row.cy, R, q: 1 });
        }
        c.save();
        c.strokeStyle = 'rgba(255,251,232,.8)';
        c.setLineDash([5, 5]);
        c.lineWidth = 1.5;
        for (const sign of [-1, 1]) {
            c.beginPath();
            for (let i = 0; i < N; i += 1) {
                const x = 24 + i / (N - 1) * (w - 48), y = 74 + sign * spec.profile[i] * R;
                if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
            }
            c.stroke();
        }
        c.restore();
    }

    function drawShelf() {
        const c = shelfCanvas.getContext('2d');
        const w = shelfCanvas.width, h = shelfCanvas.height;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, w, h);
        const p = profile();
        const items = p?.woodTurning.shelf || [];
        el.shelfCount.textContent = `${items.length}/${CasualProfile.TURN_SHELF_SIZE}`;
        const rows = [h * .47, h * .95];
        for (const y of rows) {
            const plank = c.createLinearGradient(0, y - 10, 0, y + 6);
            plank.addColorStop(0, '#a8703f'); plank.addColorStop(1, '#5e3a1d');
            c.fillStyle = plank;
            c.fillRect(6, y - 12, w - 12, 12);
            c.fillStyle = 'rgba(0,0,0,.25)';
            c.fillRect(6, y, w - 12, 5);
        }
        if (!items.length) {
            c.fillStyle = isPaper() ? 'rgba(58,39,23,.6)' : 'rgba(255,255,255,.55)';
            c.font = '700 20px Outfit, sans-serif';
            c.textAlign = 'center';
            c.fillText(p ? 'İlk yıldızlı parçan buraya gelir' : 'Raf için profil aç', w / 2, rows[0] - 50);
            c.textAlign = 'left';
            return;
        }
        const perRow = 6;
        const slot = (w - 24) / perRow;
        items.forEach(([level, score], index) => {
            const spec = levelSpec(level);
            const row = Math.floor(index / perRow);
            const x = 12 + (index % perRow) * slot + slot / 2;
            const base = rows[row] - 12;
            const len = Math.min(h * .4, 116);
            const R = Math.min(slot * .42, len * .2);
            c.save();
            c.translate(x, base);
            c.rotate(-Math.PI / 2);
            renderPiece(c, { profile: spec.profile, paintIdx: spec.free ? null : spec.bands, log: 'beech', spin: .7 + index, x: 0, len, cy: 0, R, q: 1 });
            c.restore();
            c.fillStyle = '#ffd36a';
            c.font = '800 13px Outfit, sans-serif';
            c.textAlign = 'center';
            c.fillText('★'.repeat(CasualProfile.turnStars(score)), x, base - len - 6);
            c.textAlign = 'left';
        });
    }

    // ---------- Palette and shop ----------

    function renderPalette() {
        el.palette.replaceChildren();
        const spec = state.spec;
        if (!spec) return;
        const ids = new Set(spec.free ? [] : spec.colors);
        ownedPaints().forEach((id) => ids.add(id));
        ids.forEach((id) => {
            const paint = CasualProfile.paints[id];
            const index = paintIds.indexOf(id);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `swatch${index === state.brush ? ' active' : ''}${!spec.free && spec.colors.includes(id) ? ' ordered' : ''}`;
            button.style.setProperty('--swatch', paint.color);
            button.title = paint.name;
            button.setAttribute('aria-label', `${paint.name}${!spec.free && spec.colors.includes(id) ? ' (siparişte)' : ''}`);
            button.setAttribute('aria-pressed', String(index === state.brush));
            button.addEventListener('click', () => {
                state.brush = index;
                renderPalette();
                playSound('click');
            });
            el.palette.appendChild(button);
        });
    }

    const SHOP = {
        chisels: { catalog: () => CasualProfile.chisels, owned: (p) => p?.ownedChisels || ['steel'], selected: selectedChisel, buy: 'buyChisel', select: 'selectChisel', cheat: 'cheatChisel' },
        logs: { catalog: () => CasualProfile.logs, owned: (p) => p?.ownedLogs || ['beech'], selected: selectedLog, buy: 'buyLog', select: 'selectLog', cheat: 'cheatLog' },
        paints: { catalog: () => CasualProfile.paints, owned: (p) => p?.ownedPaints || ['natural', 'honey'], selected: () => (cheatsOpen() && state.cheatPaint) || profile()?.selectedPaint || 'honey', buy: 'buyPaint', select: 'selectPaint', cheat: 'cheatPaint' }
    };

    function shopIcon(kind, item) {
        const icon = document.createElement('i');
        icon.className = `shop-icon shop-icon--${kind}`;
        if (kind === 'paints') icon.style.setProperty('--swatch', item.color);
        if (kind === 'logs') {
            const look = WOOD_LOOK[item.id];
            icon.style.setProperty('--light', `rgb(${look.light.join(',')})`);
            icon.style.setProperty('--dark', `rgb(${look.dark.join(',')})`);
        }
        if (kind === 'chisels') {
            const look = CHISEL_LOOK[item.id];
            icon.style.setProperty('--blade', look.blade[0]);
            icon.style.setProperty('--handle', look.handle[0]);
        }
        return icon;
    }

    function renderShop() {
        const list = el.shopList;
        list.replaceChildren();
        document.querySelectorAll('[data-shop]').forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.shop === state.shop)));
        const p = profile();
        if (state.shop === 'office') {
            const office = CasualProfile.offices[(p?.officeLevel || 1) - 1];
            const card = document.createElement('div');
            card.className = 'office-card';
            const name = document.createElement('strong');
            name.textContent = office.name;
            const mult = document.createElement('span');
            mult.textContent = `Kazanç çarpanı ${formatMultiplier(office.multiplier)}`;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'next-button';
            button.id = 'upgrade-office';
            button.disabled = office.upgradeCost === null;
            button.textContent = office.upgradeCost === null ? 'En üst seviye' : `Geliştir · ${CasualProfile.formatMoney(office.upgradeCost)} CM`;
            button.addEventListener('click', () => {
                if (!profile()) { openLogin(); return; }
                try {
                    CasualProfile.upgradeOffice();
                    showToast('Atölye geliştirildi; kazanç çarpanın yükseldi.');
                    playSound('pop');
                } catch (error) { showToast(error.message); }
            });
            card.append(name, mult, button);
            list.appendChild(card);
            return;
        }
        const def = SHOP[state.shop];
        const allOpen = cheatsOpen();
        const owned = allOpen ? Object.keys(def.catalog()) : def.owned(p);
        const active = def.selected();
        Object.values(def.catalog()).forEach((item) => {
            const isOwned = owned.includes(item.id);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `shop-item${isOwned ? ' owned' : ''}${item.id === active ? ' active' : ''}`;
            const copy = document.createElement('span');
            const name = document.createElement('strong');
            name.textContent = item.name;
            const desc = document.createElement('small');
            desc.textContent = item.description || (isOwned ? 'Koleksiyonda' : 'Kilitli');
            copy.append(name, desc);
            const price = document.createElement('b');
            price.textContent = item.id === active ? 'Seçili' : isOwned ? 'Seç' : `${CasualProfile.formatMoney(item.price)} CM`;
            button.append(shopIcon(state.shop, item), copy, price);
            button.addEventListener('click', () => {
                if (allOpen) {
                    state[def.cheat] = item.id;
                    afterSelection(item.name, false);
                    return;
                }
                if (!profile()) {
                    if (isOwned && state.shop !== 'paints') afterSelection(item.name, false);
                    else openLogin();
                    return;
                }
                try {
                    if (isOwned) CasualProfile[def.select](item.id);
                    else CasualProfile[def.buy](item.id);
                    afterSelection(item.name, !isOwned);
                } catch (error) { showToast(error.message); }
            });
            list.appendChild(button);
        });
    }

    function afterSelection(name, bought) {
        showToast(bought ? `${name} satın alındı.` : `${name} seçildi.`);
        playSound(bought ? 'pop' : 'click');
        renderAll();
    }

    function renderProfile() {
        const p = profile();
        const office = CasualProfile.offices[(p?.officeLevel || 1) - 1];
        el.topBalance.textContent = `${CasualProfile.formatMoney(p?.balance || 0)} CM`;
        el.compactAvatar.textContent = p ? initials(p.displayName) : '?';
        el.compactName.textContent = p ? `@${p.displayName}` : 'Misafir';
        el.compactStatus.textContent = p ? `${office.name} · ${formatMultiplier(office.multiplier)}` : 'Kazanç için profil aç';
        el.profileAction.textContent = p ? 'Çık' : 'Aç';
        el.jobs.textContent = p?.woodTurning.jobs || 0;
        el.stars.textContent = p?.woodTurning.stars || 0;
        el.best.textContent = `${p?.woodTurning.bestScore || 0}%`;
        el.earned.textContent = `${CasualProfile.formatMoney(p?.woodTurning.totalEarned || 0)} CM`;
    }

    function renderAll() {
        renderProfile();
        renderShop();
        renderPalette();
        drawShelf();
        if (state.spec) drawTargetCard();
    }

    // ---------- Finishing ----------

    function finishOrder() {
        if (state.completed) return;
        state.completed = true;
        state.pointer.down = false;
        const shape = shapeScore(), sand = sandScore(), paint = paintScore();
        const overall = overallScore(shape, sand, paint);
        const stars = CasualProfile.turnStars(overall);
        const p = profile();
        const office = CasualProfile.offices[(p?.officeLevel || 1) - 1];
        let reward = Math.round(CasualProfile.rewardForScore(overall, office.level) * (state.spec.free ? 1.5 : 1));
        let awarded = false;
        if (p && !cheatsOn()) {
            const award = CasualProfile.awardWoodTurning({ score: overall, level: state.level, freeDesign: state.spec.free });
            reward = award.reward;
            awarded = true;
            if (typeof recordGameResult === 'function') recordGameResult('Wood Turning', { won: stars > 0, score: overall });
        } else if (stars > 0 && state.level === state.guestLevel) {
            state.guestLevel += 1;
        }
        // Nothing is paid out while cheats are on.
        if (cheatsOn()) reward = 0;
        state.pending = { shape, sand, paint, overall, stars, reward, awarded, level: state.level };
        populateResult();
        openModal(el.resultModal);
        animateScore(overall);
        createConfetti(stars);
        playSound('pop');
        if (navigator.vibrate && stars) navigator.vibrate([20, 40, 20]);
        renderAll();
    }

    function populateResult() {
        const r = state.pending;
        if (!r) return;
        const p = profile();
        const office = CasualProfile.offices[(p?.officeLevel || 1) - 1];
        el.resultKicker.textContent = `SEVİYE ${r.level}${state.spec.free ? ' · SERBEST' : ''}`;
        el.resultTitle.textContent = r.stars === 3 ? 'Mükemmel!' : r.stars === 2 ? 'Harika!' : r.stars === 1 ? 'İyi' : 'Biraz daha!';
        el.resultStars.setAttribute('aria-label', `${r.stars} yıldız`);
        el.resultStars.querySelectorAll('i').forEach((star, index) => star.classList.toggle('on', index < r.stars));
        el.resultShape.textContent = `${r.shape}%`;
        el.resultSand.textContent = `${r.sand}%`;
        el.resultPaint.textContent = `${r.paint}%`;
        el.rewardValue.textContent = CasualProfile.formatMoney(r.reward);
        const rebirth = CasualProfile.earnMultiplier(p);
        const parts = [`${formatMultiplier(office.multiplier)} atölye`];
        if (state.spec.free) parts.push('x1,5 serbest');
        if (rebirth > 1) parts.push(`x${rebirth} yeniden doğuş`);
        el.rewardMultiplier.textContent = parts.join(' · ');
        el.guestWarning.hidden = r.awarded || cheatsOn();
        el.newOrder.querySelector('span').textContent = r.stars ? 'Sonraki seviye' : 'Tekrar dene';
        el.retry.hidden = !r.stars;
        drawCompare();
    }

    let scoreAnim = 0;
    function animateScore(target) {
        cancelAnimationFrame(scoreAnim);
        const start = performance.now();
        const step = (now) => {
            const k = Math.min(1, (now - start) / 900);
            el.resultScore.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
            if (k < 1) scoreAnim = requestAnimationFrame(step);
        };
        scoreAnim = requestAnimationFrame(step);
    }

    function claimPendingReward() {
        const r = state.pending;
        if (!r || r.awarded || !profile() || cheatsOn()) return;
        const award = CasualProfile.awardWoodTurning({ score: r.overall, level: r.level, freeDesign: state.spec.free });
        r.reward = award.reward;
        r.awarded = true;
        if (typeof recordGameResult === 'function') recordGameResult('Wood Turning', { won: r.stars > 0, score: r.overall });
        populateResult();
        renderAll();
    }

    function createConfetti(stars) {
        el.confetti.replaceChildren();
        if (stars < 2 || !effectsOn()) return;
        const colors = ['#ffd36a', '#ff795f', '#7aa7ff', '#9be37a', '#f58bd4'];
        for (let i = 0; i < 34; i += 1) {
            const piece = document.createElement('span');
            piece.style.left = `${Math.random() * 100}%`;
            piece.style.setProperty('--color', colors[i % colors.length]);
            piece.style.setProperty('--delay', `${Math.random() * .45}s`);
            piece.style.setProperty('--drift', `${(Math.random() - .5) * 220}px`);
            el.confetti.appendChild(piece);
        }
    }

    // ---------- Modals ----------

    const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    let lastFocused = null;
    function openModal(modal) {
        lastFocused = document.activeElement;
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        const target = modal.querySelector('[data-initial-focus]')
            || Array.from(modal.querySelectorAll(FOCUSABLE)).find((node) => !node.hidden && !node.disabled && !node.closest('[hidden]'));
        if (target) setTimeout(() => target.focus(), 40);
    }
    function closeModal(modal) {
        if (!modal.classList.contains('active')) return;
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        if (!document.querySelector('.modal-overlay.active')) document.body.style.overflow = '';
        const restore = lastFocused;
        lastFocused = null;
        if (restore && restore !== document.body && document.contains(restore) && !restore.closest('[aria-hidden="true"]')) restore.focus();
        if (modal === el.resultModal && state.completed) beginLevel(activeLevel());
        if (modal === el.loginModal && state.returnToResult && state.pending) {
            state.returnToResult = false;
            populateResult();
            openModal(el.resultModal);
        }
    }
    function openLogin() {
        el.loginError.textContent = '';
        openModal(el.loginModal);
    }

    // ---------- Input ----------

    function canvasPoint(event) {
        const rect = canvas.getBoundingClientRect();
        const sx = event.clientX - rect.left, sy = event.clientY - rect.top;
        return L.rot ? { x: L.H - sy, y: sx } : { x: sx, y: sy };
    }

    canvas.addEventListener('pointerdown', (event) => {
        if (state.pointer.down && state.pointer.id !== event.pointerId) return;
        event.preventDefault();
        ensureAudio();
        if (audio?.ac.state === 'suspended') audio.ac.resume();
        Object.assign(state.pointer, canvasPoint(event), { down: true, inside: true, touch: event.pointerType !== 'mouse', id: event.pointerId });
        canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
        if (state.pointer.down && state.pointer.id !== event.pointerId) return;
        Object.assign(state.pointer, canvasPoint(event), { inside: true });
        if (!state.pointer.down) state.pointer.touch = event.pointerType !== 'mouse';
    });
    const release = (event) => {
        if (state.pointer.id !== event.pointerId) return;
        state.pointer.down = false;
        state.pointer.id = null;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('pointerleave', () => { if (!state.pointer.down) state.pointer.inside = false; });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    document.querySelectorAll('[data-tool]').forEach((button) => {
        button.addEventListener('click', () => {
            state.tool = button.dataset.tool;
            document.querySelectorAll('[data-tool]').forEach((item) => {
                item.classList.toggle('active', item === button);
                item.setAttribute('aria-pressed', String(item === button));
            });
            playSound('click');
        });
    });

    el.next.addEventListener('click', () => {
        if (state.completed) return;
        if (state.stage === 'carve') { state.snapshot = state.current.slice(); setStage('sand'); }
        else if (state.stage === 'sand') { state.snapshot = state.current.slice(); setStage('paint'); }
        else finishOrder();
    });

    let resetTimer;
    function clearResetConfirm() {
        clearTimeout(resetTimer);
        el.reset.classList.remove('confirming');
    }
    el.reset.addEventListener('click', () => {
        // A stray tap must not wipe a stage, so the first tap only arms the reset.
        if (!el.reset.classList.contains('confirming')) {
            el.reset.classList.add('confirming');
            showToast('Bu aşamayı sıfırlamak için tekrar dokun.');
            resetTimer = setTimeout(clearResetConfirm, 2600);
            return;
        }
        clearResetConfirm();
        if (state.stage === 'carve') freshBlank();
        else if (state.stage === 'sand') { if (state.snapshot) state.current.set(state.snapshot); state.sand.fill(0); }
        else { state.paintIdx.fill(-1); state.paintCov.fill(0); }
        updateMetrics();
        showToast('Aşama sıfırlandı.');
        playSound('click');
    });

    document.querySelectorAll('[data-shop]').forEach((tab) => {
        tab.addEventListener('click', () => { state.shop = tab.dataset.shop; renderShop(); playSound('click'); });
    });

    el.profileAction.addEventListener('click', () => {
        if (profile()) {
            CasualProfile.logout();
            renderAll();
            beginLevel(activeLevel());
            showToast('Oturum kapatıldı.');
        } else openLogin();
    });

    el.wallet.addEventListener('click', () => {
        if (!profile()) openLogin();
        else document.querySelector('.shop').scrollIntoView({ behavior: effectsOn() ? 'smooth' : 'auto', block: 'start' });
    });

    el.loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        el.loginError.textContent = '';
        try {
            const p = CasualProfile.login(el.username.value);
            el.username.value = '';
            claimPendingReward();
            renderAll();
            const resuming = state.returnToResult && state.pending;
            closeModal(el.loginModal);
            showToast(`Hoş geldin, @${p.displayName}.`);
            if (!resuming && !state.completed && !state.gestureUsed && state.stage === 'carve') beginLevel(activeLevel());
            playSound('pop');
        } catch (error) {
            el.loginError.textContent = error.message;
        }
    });

    el.guestWarning.addEventListener('click', () => {
        state.returnToResult = true;
        el.resultModal.classList.remove('active');
        el.resultModal.setAttribute('aria-hidden', 'true');
        openLogin();
    });

    document.querySelectorAll('[data-close]').forEach((button) => {
        button.addEventListener('click', () => closeModal(document.getElementById(button.dataset.close)));
    });
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
        overlay.addEventListener('click', (event) => { if (event.target === overlay && overlay !== el.resultModal) closeModal(overlay); });
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') document.querySelectorAll('.modal-overlay.active').forEach(closeModal);
    });

    el.newOrder.addEventListener('click', () => { closeModal(el.resultModal); playSound('click'); });
    el.retry.addEventListener('click', () => {
        const level = state.pending?.level || state.level;
        el.resultModal.classList.remove('active');
        el.resultModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        beginLevel(level);
        playSound('click');
    });

    window.addEventListener('casualprofilechange', renderAll);
    window.addEventListener('casual-cheat', () => {
        if (!cheatsOpen()) { state.cheatLog = null; state.cheatChisel = null; state.cheatPaint = null; }
        if (cheatsOn()) state.guestLevel = Math.max(state.guestLevel, profile()?.woodTurning.level || 1);
        renderAll();
    });
    const themeObserver = new MutationObserver(() => { L.W = 0; drawShelf(); });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('visibilitychange', updateAudio);

    // Debug hooks for automated tests only.
    if (/[?&]debug\b/.test(location.search)) {
        window.WoodTurningDebug = Object.freeze({
            state: () => ({ stage: state.stage, level: state.level, shape: shapeScore(), sand: sandScore(), paint: paintScore(), completed: state.completed, brush: state.brush }),
            layout: () => ({ ...L }),
            target: () => Array.from(state.spec.profile),
            current: () => Array.from(state.current),
            bands: () => Array.from(state.spec.bands),
            spec: () => ({ name: state.spec.shape.name, free: state.spec.free, colors: state.spec.colors.slice() })
        });
    }

    state.guestLevel = profile()?.woodTurning.level || 1;
    layout();
    renderAll();
    beginLevel(activeLevel());
    requestAnimationFrame((now) => { state.last = now; frame(now); });

    if (!profile()) setTimeout(() => showToast('Misafir oynayabilirsin; kazanç ve seviye için profil aç.'), 700);
});
