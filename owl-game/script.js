(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const canvas = $('sky');
    const ctx = canvas.getContext('2d');
    const stage = $('stage');
    const TAU = Math.PI * 2;

    const W = 480;
    const H = 720;
    const GROUND = H - 64;
    const OWL_X = 132;
    const OWL_R = 17;
    const GRAVITY = 1650;
    const FLAP = -480;
    const MAX_FALL = 760;
    const COLUMN_W = 76;
    const SPACING = 255;
    const COIN_R = 13;
    const BEST_COOKIE = 'cp_owl_best';
    const FLAP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
    const RESULT_LOCK_MS = 600;
    /* Every SKY_STEP points the sky moves one phase along night → dawn → day → dusk → night. */
    const SKY_STEP = 12;

    /* Visual palettes live with the renderer; names and prices come from CasualProfile.owls. */
    const palettes = {
        minerva: { body: '#8a6446', wing: '#6c4c33', belly: '#efe0bf', spot: '#5b3f29', face: '#caa57a', eye: '#f6c945', pupil: '#1c1206', beak: '#e7a33c', sprig: true },
        snowy: { body: '#eef2f6', wing: '#d9dfe6', belly: '#ffffff', spot: '#4d535c', face: '#ffffff', eye: '#f7d23e', pupil: '#141414', beak: '#3c3c3c' },
        barn: { body: '#d49c56', wing: '#b87d3d', belly: '#fbf1dc', spot: '#8a5a2b', face: '#fffaf0', eye: '#1d1712', pupil: '#000000', beak: '#e7c49b', heart: true },
        eagle: { body: '#6b4a2e', wing: '#553920', belly: '#c89a62', spot: '#3e2917', face: '#a8784a', eye: '#ff8a1f', pupil: '#120a02', beak: '#2f2a24', tufts: true },
        cosmic: { body: '#353a8e', wing: '#272b6e', belly: '#6d77d6', spot: '#c3cbff', face: '#4a50b0', eye: '#7ef9ff', pupil: '#0b1033', beak: '#ffd36e', tufts: true, trail: '#9fe8ff' },
        golden: { body: '#d9a62e', wing: '#b8861c', belly: '#ffe89a', spot: '#9c6b12', face: '#f3c94e', eye: '#ffffff', pupil: '#6b3b00', beak: '#8a5200', sprig: true, trail: '#ffe07a' }
    };

    const MEDALS = [
        { min: 100, id: 'platinum', name: 'Platin', rim: '#9fb4c8', face: '#e9f3fb', shine: '#ffffff', ribbon: '#3a5a8c' },
        { min: 50, id: 'gold', name: 'Altın', rim: '#b8860b', face: '#ffd84a', shine: '#fff4b0', ribbon: '#b0302a' },
        { min: 25, id: 'silver', name: 'Gümüş', rim: '#8a929c', face: '#d9dee4', shine: '#ffffff', ribbon: '#2d6a9a' },
        { min: 10, id: 'bronze', name: 'Bronz', rim: '#8a4f22', face: '#d38a4e', shine: '#f6c69a', ribbon: '#2f7a4a' }
    ];

    /* Sky phases: colours are interpolated as the score rises. */
    const SKY = [
        { name: 'night', top: '#0b1030', mid: '#1d2556', low: '#3a3f78', far: '#232a5c', hill: '#1a1f45', near: '#141834', cloud: '#5c6496', stars: 1, tint: .2 },
        { name: 'dawn', top: '#2b3a7a', mid: '#b56a8a', low: '#f6b06e', far: '#6b5280', hill: '#43345e', near: '#2e2444', cloud: '#ffc9be', stars: .25, tint: .06 },
        { name: 'day', top: '#3b86d4', mid: '#7cbfec', low: '#d4eef8', far: '#8fb0c8', hill: '#5f8c68', near: '#456c4e', cloud: '#ffffff', stars: 0, tint: 0 },
        { name: 'dusk', top: '#2a2352', mid: '#8a3f6b', low: '#f08a4b', far: '#5a3757', hill: '#352645', near: '#251a33', cloud: '#ffb08c', stars: .4, tint: .08 }
    ].map((phase) => {
        const out = { ...phase };
        ['top', 'mid', 'low', 'far', 'hill', 'near', 'cloud'].forEach((key) => { out[key] = hexToRgb(phase[key]); });
        return out;
    });

    function hexToRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function mixRgb(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
    function rgb(c, alpha = 1) { return alpha >= 1 ? `rgb(${c[0]}, ${c[1]}, ${c[2]})` : `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`; }

    /* Seeded random so the scenery is identical on every visit. */
    function seeded(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const stars = (() => {
        const rand = seeded(7);
        return Array.from({ length: 70 }, () => ({ x: rand() * W, y: rand() * (GROUND - 240), r: rand() * 1.4 + .4, phase: rand() * TAU }));
    })();

    const clouds = (() => {
        const rand = seeded(19);
        return Array.from({ length: 7 }, (_, i) => ({ x: rand() * (W + 240), y: 50 + rand() * 260, s: .6 + rand() * .8, f: .06 + (i % 3) * .05 + rand() * .03 }));
    })();

    /* Parallax silhouettes are built once as paths and filled with the current sky colour. */
    const FAR_SPAN = 960;
    const HILL_SPAN = 720;
    const NEAR_SPAN = 480;
    const farPath = buildFarLayer();
    const hillPath = buildHillLayer();
    const nearPath = buildNearLayer();

    function temple(path, x, base, columnsCount, width) {
        const colW = width / (columnsCount * 2 - 1);
        path.rect(x - 4, base - 6, width + 8, 6);
        path.rect(x - 2, base - 10, width + 4, 4);
        for (let k = 0; k < columnsCount; k += 1) path.rect(x + k * colW * 2, base - 44, colW, 34);
        path.rect(x - 4, base - 52, width + 8, 8);
        path.moveTo(x - 6, base - 52);
        path.lineTo(x + width / 2, base - 70);
        path.lineTo(x + width + 6, base - 52);
        path.closePath();
    }

    function buildFarLayer() {
        const rand = seeded(3);
        const path = new Path2D();
        const base = GROUND - 150;
        path.moveTo(0, GROUND);
        const points = [];
        for (let x = 0; x <= FAR_SPAN; x += 40) {
            const y = x === 0 || x === FAR_SPAN ? base : base - 20 - rand() * 70 - Math.sin(x / FAR_SPAN * TAU * 2) * 24;
            points.push([x, y]);
        }
        path.lineTo(0, points[0][1]);
        for (let i = 1; i < points.length; i += 1) {
            const [px, py] = points[i - 1];
            const [x, y] = points[i];
            path.quadraticCurveTo(px + 20, py, (px + x) / 2, (py + y) / 2);
        }
        path.lineTo(FAR_SPAN, base);
        path.lineTo(FAR_SPAN, GROUND);
        path.closePath();
        // Buildings stand on a plinth that reaches down into the ridge, so they never float.
        const ridgeAt = (x) => {
            const i = Math.min(points.length - 2, Math.floor(x / 40));
            const t = (x - points[i][0]) / 40;
            return points[i][1] + (points[i + 1][1] - points[i][1]) * t;
        };
        const plinth = (x, width) => {
            const top = Math.min(ridgeAt(x), ridgeAt(x + width / 2), ridgeAt(x + width)) - 4;
            path.rect(x - 8, top, width + 16, GROUND - top);
            return top;
        };
        // Two temples crown the ridge, a nod to Minerva's Athens.
        temple(path, 140, plinth(140, 96), 6, 96);
        temple(path, 640, plinth(640, 58), 4, 58);
        // A lone tholos (round temple) between them.
        const tb = plinth(410, 40);
        path.rect(410, tb - 6, 40, 6);
        for (let k = 0; k < 4; k += 1) path.rect(412 + k * 11, tb - 34, 5, 28);
        path.moveTo(406, tb - 34);
        path.quadraticCurveTo(430, tb - 62, 454, tb - 34);
        path.closePath();
        return path;
    }

    function buildHillLayer() {
        const rand = seeded(11);
        const path = new Path2D();
        const base = GROUND - 70;
        path.moveTo(0, GROUND);
        path.lineTo(0, base);
        path.quadraticCurveTo(120, base - 54, 240, base - 10);
        path.quadraticCurveTo(360, base + 22, 480, base - 26);
        path.quadraticCurveTo(600, base - 50, HILL_SPAN, base);
        path.lineTo(HILL_SPAN, GROUND);
        path.closePath();
        // Cypress and olive trees dot the hills.
        for (let i = 0; i < 9; i += 1) {
            const x = 30 + i * 78 + rand() * 30;
            const groundY = base - 18 + Math.sin(x / 70) * 10;
            if (i % 3 === 1) {
                path.rect(x - 2, groundY - 18, 4, 20);
                path.ellipse(x, groundY - 26, 15, 11, 0, 0, TAU);
                path.ellipse(x - 9, groundY - 20, 9, 7, 0, 0, TAU);
                path.ellipse(x + 10, groundY - 21, 9, 7, 0, 0, TAU);
            } else {
                const h = 38 + rand() * 26;
                path.ellipse(x, groundY - h / 2, 6 + rand() * 2, h / 2, 0, 0, TAU);
            }
        }
        return path;
    }

    function buildNearLayer() {
        const rand = seeded(23);
        const path = new Path2D();
        for (let i = 0; i < 7; i += 1) {
            const x = i * 70 + rand() * 40;
            const r = 10 + rand() * 12;
            path.ellipse(x, GROUND, r * 1.6, r, 0, Math.PI, TAU);
            path.ellipse(x + r, GROUND, r * 1.1, r * .8, 0, Math.PI, TAU);
        }
        return path;
    }

    const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    function calm() {
        if (motionQuery && motionQuery.matches) return true;
        return Boolean(window.CasualSettings && CasualSettings.get().effects === false);
    }

    let mode = 'menu';
    let owlY = H * .42;
    let vy = 0;
    let tilt = 0;
    let flapAt = -10;
    let columns = [];
    let coins = [];
    let particles = [];
    let floaters = [];
    let score = 0;
    let coinsRun = 0;
    let best = Number(getCookieValue(BEST_COOKIE)) || 0;
    let speed = 165;
    let scroll = 0;
    let clock = 0;
    let flash = 0;
    let hitFlash = 0;
    let shake = 0;
    let scoreBump = 0;
    let skyPos = 0;
    let lastFrame = performance.now();
    let overAt = 0;
    let previewOwl = null;
    let currentOwl = 'minerva';
    let crashReason = 'column';
    let trailTimer = 0;
    let toastTimer = 0;
    let audio = null;
    let shownMode = '';
    let armTimer = 0;
    let activePreview = null;
    let previewClock = 0;
    let lastAnnounced = 0;

    function cheats() { return window.CasualCheats; }
    function cheatOn(name) { const c = cheats(); return Boolean(c && typeof c[name] === 'function' && c[name]()); }

    function toast(message) {
        const el = $('toast');
        el.textContent = message;
        el.classList.add('show');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => el.classList.remove('show'), 2400);
    }

    function announce(message) {
        const el = $('owl-live');
        if (el) el.textContent = message;
    }

    function sound(freq, duration = .08, type = 'sine', slide = 0, volume = .05) {
        if (window.CasualSettings && !CasualSettings.get().sound) return;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            audio ||= new Ctx();
            if (audio.state === 'suspended') audio.resume();
            const osc = audio.createOscillator();
            const gain = audio.createGain();
            const now = audio.currentTime;
            osc.type = type;
            osc.frequency.setValueAtTime(freq, now);
            if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), now + duration);
            gain.gain.setValueAtTime(volume, now);
            gain.gain.exponentialRampToValueAtTime(.001, now + duration);
            osc.connect(gain);
            gain.connect(audio.destination);
            osc.start(now);
            osc.stop(now + duration);
        } catch (_) { /* audio is optional */ }
    }

    /* ---------- Characters ---------- */

    function catalog() { return Object.values(CasualProfile.owls); }
    function allOpen() { return cheatOn('features'); }

    function ownedIds(profile) {
        if (allOpen()) return catalog().map((owl) => owl.id);
        return profile?.ownedOwls || ['minerva'];
    }

    function activeOwlId() {
        return currentOwl;
    }

    function resolveOwl(profile) {
        const id = previewOwl || profile?.selectedOwl || 'minerva';
        currentOwl = palettes[id] ? id : 'minerva';
        return currentOwl;
    }

    function renderSession(profile) {
        const line = $('session-line');
        line.replaceChildren();
        const text = document.createElement('span');
        if (cheatOn('active')) {
            text.textContent = 'Hile açık · CM kazanımı ve satın alma duraklatıldı.';
            line.append(text);
            return;
        }
        if (profile) {
            text.textContent = `@${profile.displayName} · ${CasualProfile.formatMoney(profile.balance)} CM`;
            line.append(text);
            return;
        }
        text.textContent = 'Oturum kapalı · CM ve karakterler için başlat.';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Oturumu başlat';
        button.addEventListener('click', () => {
            const result = CasualProfile.startSession();
            toast(result.granted ? `Oturum açıldı, +${result.reward} CM kazandın.` : 'Oturumun açık.');
        });
        line.append(text, button);
    }

    function renderMedalLadder() {
        const list = $('medal-ladder');
        if (!list) return;
        list.replaceChildren();
        MEDALS.slice().reverse().forEach((medal) => {
            const item = document.createElement('li');
            const earned = best >= medal.min;
            item.className = `medal-chip ${medal.id}${earned ? ' earned' : ''}`;
            const dot = document.createElement('span');
            dot.className = 'medal-dot';
            dot.setAttribute('aria-hidden', 'true');
            const label = document.createElement('span');
            label.textContent = `${medal.name} ${medal.min}`;
            item.append(dot, label);
            item.title = earned ? `${medal.name} madalya kazanıldı` : `${medal.name} için ${medal.min} puan`;
            item.setAttribute('aria-label', earned ? `${medal.name} madalya kazanıldı, ${medal.min} puan` : `${medal.name} madalya: ${medal.min} puan gerekir`);
            list.append(item);
        });
    }

    function renderOwls() {
        const profile = CasualProfile.current();
        const owned = ownedIds(profile);
        const selected = resolveOwl(profile);
        const balance = profile?.balance || 0;
        const grid = $('owl-grid');
        grid.replaceChildren();
        activePreview = null;
        catalog().forEach((owl) => {
            const isOwned = owned.includes(owl.id);
            const card = document.createElement('article');
            card.className = `owl-card${owl.id === selected ? ' active' : ''}${isOwned ? '' : ' locked'}${!isOwned && balance < owl.price ? ' poor' : ''}`;
            const preview = document.createElement('canvas');
            preview.setAttribute('aria-hidden', 'true');
            drawPreview(preview, owl.id, .45, !isOwned);
            if (owl.id === selected) activePreview = { canvas: preview, id: owl.id };
            const name = document.createElement('strong');
            name.textContent = owl.name;
            const description = document.createElement('small');
            description.textContent = owl.description;
            const button = document.createElement('button');
            button.type = 'button';
            if (owl.id === selected) {
                button.textContent = 'Seçili';
                button.disabled = true;
            } else if (isOwned) {
                button.textContent = allOpen() ? 'Önizle' : 'Seç';
                button.setAttribute('aria-label', `${owl.name} karakterini seç`);
                button.addEventListener('click', () => chooseOwl(owl));
            } else {
                button.textContent = `${CasualProfile.formatMoney(owl.price)} CM`;
                button.setAttribute('aria-label', `${owl.name} karakterini ${CasualProfile.formatMoney(owl.price)} CasualMoney karşılığında aç`);
                button.addEventListener('click', () => purchaseOwl(owl));
            }
            card.append(preview, name, description, button);
            grid.append(card);
        });
        $('owl-count').textContent = `${owned.length} / ${catalog().length}`;
        $('balance').textContent = CasualProfile.formatMoney(balance);
        renderSession(profile);
        renderMedalLadder();
    }

    function chooseOwl(owl) {
        if (allOpen()) {
            previewOwl = owl.id;
            toast(`${owl.name} önizlemesi · kaydedilmez.`);
            renderOwls();
            return;
        }
        try {
            CasualProfile.selectOwl(owl.id);
            sound(740, .08, 'triangle', 120);
            toast(`${owl.name} seçildi.`);
        } catch (error) { toast(error.message); }
    }

    function purchaseOwl(owl) {
        if (!CasualProfile.current()) { toast('Karakter almak için önce oturumu başlat.'); return; }
        try {
            CasualProfile.buyOwl(owl.id);
            sound(660, .18, 'triangle', 440);
            toast(`${owl.name} açıldı ve seçildi.`);
        } catch (error) { toast(error.message); }
    }

    /* ---------- Owl ---------- */

    function drawOwl(c, id, x, y, angle, lift, scale = 1, alpha = 1, look = {}) {
        const p = palettes[id] || palettes.minerva;
        c.save();
        c.globalAlpha = alpha;
        c.translate(x, y);
        c.rotate(angle);
        c.scale(scale * (look.sx || 1), scale * (look.sy || 1));

        // Wings sit behind the body and rotate up from the shoulders.
        [-1, 1].forEach((side) => {
            c.save();
            c.translate(side * 14, -3);
            c.rotate(-side * lift);
            c.fillStyle = p.wing;
            c.beginPath();
            c.ellipse(side * 6, 11, 8, 16, side * -.25, 0, TAU);
            c.fill();
            // Primary feathers fan out at the wing tip.
            c.beginPath();
            c.ellipse(side * 9, 23, 4, 7, side * -.5, 0, TAU);
            c.ellipse(side * 4, 25, 3.5, 6, side * -.15, 0, TAU);
            c.fill();
            c.strokeStyle = p.spot;
            c.globalAlpha = alpha * .5;
            c.lineWidth = 1.4;
            for (let i = 0; i < 3; i += 1) {
                c.beginPath();
                c.moveTo(side * 2, 8 + i * 6);
                c.lineTo(side * 10, 10 + i * 6);
                c.stroke();
            }
            c.restore();
        });

        c.fillStyle = p.beak;
        c.beginPath(); c.ellipse(-6, 24, 4, 2.6, 0, 0, TAU); c.fill();
        c.beginPath(); c.ellipse(6, 24, 4, 2.6, 0, 0, TAU); c.fill();

        if (p.tufts) {
            c.fillStyle = p.body;
            [-1, 1].forEach((side) => {
                c.beginPath();
                c.moveTo(side * 6, -18);
                c.lineTo(side * 17, -34);
                c.lineTo(side * 18, -14);
                c.closePath();
                c.fill();
            });
        }

        c.fillStyle = p.body;
        c.beginPath();
        c.ellipse(0, 2, 21, 24, 0, 0, TAU);
        c.fill();

        c.fillStyle = p.belly;
        c.beginPath();
        c.ellipse(0, 11, 13.5, 14, 0, 0, TAU);
        c.fill();
        c.strokeStyle = p.spot;
        c.lineWidth = 1.5;
        [[-5, 6], [5, 6], [0, 11], [-6, 16], [6, 16], [0, 20]].forEach(([sx, sy]) => {
            c.beginPath();
            c.arc(sx, sy, 2.4, .15 * Math.PI, .85 * Math.PI);
            c.stroke();
        });

        c.fillStyle = p.face;
        if (p.heart) {
            c.beginPath();
            c.moveTo(0, -12);
            c.bezierCurveTo(-6, -22, -21, -18, -18, -6);
            c.bezierCurveTo(-16, 2, -6, 5, 0, 7);
            c.bezierCurveTo(6, 5, 16, 2, 18, -6);
            c.bezierCurveTo(21, -18, 6, -22, 0, -12);
            c.fill();
        } else {
            c.beginPath(); c.arc(-8, -7, 10, 0, TAU); c.fill();
            c.beginPath(); c.arc(8, -7, 10, 0, TAU); c.fill();
        }

        const gaze = Math.max(-1.5, Math.min(1.5, angle * 3));
        [-1, 1].forEach((side) => {
            const ex = side * 8;
            if (look.dazed) {
                // Dizzy X eyes after a crash.
                c.strokeStyle = p.pupil;
                c.lineWidth = 2.4;
                c.lineCap = 'round';
                c.beginPath();
                c.moveTo(ex - 4, -11); c.lineTo(ex + 4, -3);
                c.moveTo(ex + 4, -11); c.lineTo(ex - 4, -3);
                c.stroke();
                return;
            }
            c.fillStyle = p.eye;
            c.beginPath(); c.arc(ex, -7, 7.2, 0, TAU); c.fill();
            if (look.blink) {
                c.fillStyle = p.face;
                c.beginPath(); c.ellipse(ex, -7, 7.6, 7.6, 0, Math.PI, TAU); c.fill();
                c.strokeStyle = p.spot;
                c.lineWidth = 1.6;
                c.beginPath(); c.moveTo(ex - 7, -7); c.lineTo(ex + 7, -7); c.stroke();
                return;
            }
            c.fillStyle = p.pupil;
            c.beginPath(); c.arc(ex + 1.2, -7 + gaze, 4, 0, TAU); c.fill();
            c.fillStyle = '#ffffff';
            c.beginPath(); c.arc(ex + 2.6, -9 + gaze, 1.5, 0, TAU); c.fill();
        });

        c.fillStyle = p.beak;
        c.beginPath();
        c.moveTo(-3.2, -2);
        c.lineTo(3.2, -2);
        c.lineTo(0, 5);
        c.closePath();
        c.fill();

        if (p.sprig) {
            // Minerva's olive sprig crowns the head.
            c.strokeStyle = '#5d7d33';
            c.lineWidth = 1.8;
            c.beginPath();
            c.moveTo(-12, -20);
            c.quadraticCurveTo(0, -29, 13, -21);
            c.stroke();
            c.fillStyle = '#86ad4c';
            [[-9, -23, -.6], [-3, -26, -.2], [3, -26, .2], [9, -24, .6]].forEach(([lx, ly, rot]) => {
                c.beginPath();
                c.ellipse(lx, ly, 3.6, 1.7, rot, 0, TAU);
                c.fill();
            });
            c.fillStyle = '#3f4b2a';
            c.beginPath(); c.arc(14, -21, 2, 0, TAU); c.fill();
        }
        c.restore();
    }

    function drawPreview(target, id, lift = .45, locked = false, bob = 0) {
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        if (target.width !== 64 * ratio) {
            target.width = 64 * ratio;
            target.height = 64 * ratio;
        }
        const c = target.getContext('2d');
        c.setTransform(ratio, 0, 0, ratio, 0, 0);
        c.clearRect(0, 0, 64, 64);
        const bg = c.createLinearGradient(0, 0, 0, 64);
        bg.addColorStop(0, '#141a3a');
        bg.addColorStop(1, '#2f3570');
        c.fillStyle = bg;
        c.beginPath(); c.arc(32, 32, 31, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255, 244, 200, .9)';
        c.beginPath(); c.arc(48, 15, 5, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255, 248, 220, .7)';
        [[14, 14], [22, 8], [10, 26]].forEach(([sx, sy]) => { c.beginPath(); c.arc(sx, sy, .9, 0, TAU); c.fill(); });
        drawOwl(c, id, 32, 35 + bob, 0, lift, .95);
        if (locked) {
            // A small padlock badge marks owls that are not owned yet.
            c.fillStyle = 'rgba(8, 10, 30, .82)';
            c.beginPath(); c.arc(51, 51, 10, 0, TAU); c.fill();
            c.strokeStyle = '#f4efe3';
            c.lineWidth = 1.8;
            c.beginPath(); c.arc(51, 48, 3.4, Math.PI, TAU); c.stroke();
            c.fillStyle = '#f4efe3';
            c.fillRect(46.5, 48, 9, 7);
        }
    }

    function wingLift() {
        if (mode === 'falling' || mode === 'over') return 1 + Math.sin(clock * 24) * .2;
        if (mode !== 'playing' && mode !== 'paused') return .45 + .6 * Math.sin(clock * 9);
        const t = clock - flapAt;
        if (t < .1) return 1.15 - (t / .1) * 1.75;
        if (t < .3) return -.6 + ((t - .1) / .2) * .95;
        if (vy > 420) return .85 + Math.sin(clock * 22) * .18;
        return .35 + Math.sin(clock * 6) * .08;
    }

    function owlLook() {
        const t = clock - flapAt;
        const squash = mode === 'playing' && t < .16 ? 1 - t / .16 : 0;
        return {
            sx: 1 + squash * .08,
            sy: 1 - squash * .08,
            blink: mode !== 'falling' && mode !== 'over' && (clock % 3.7) < .12,
            dazed: mode === 'falling' || mode === 'over'
        };
    }

    /* ---------- Scenery ---------- */

    function skyWeights() {
        const base = Math.floor(skyPos);
        const frac = skyPos - base;
        const a = ((base % 4) + 4) % 4;
        const b = (a + 1) % 4;
        const weights = [0, 0, 0, 0];
        weights[a] += 1 - frac;
        weights[b] += frac;
        return { a: SKY[a], b: SKY[b], t: frac, weights };
    }

    function skyColor(key, mix) { return mixRgb(mix.a[key], mix.b[key], mix.t); }

    function drawLayer(path, span, factor, color) {
        const shift = (scroll * factor) % span;
        ctx.fillStyle = color;
        for (let ox = -shift; ox < W; ox += span) {
            ctx.save();
            ctx.translate(ox, 0);
            ctx.fill(path);
            ctx.restore();
        }
    }

    function drawCloud(x, y, s, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, y, 46 * s, 16 * s, 0, 0, TAU);
        ctx.ellipse(x - 22 * s, y - 6 * s, 22 * s, 16 * s, 0, 0, TAU);
        ctx.ellipse(x + 14 * s, y - 13 * s, 26 * s, 20 * s, 0, 0, TAU);
        ctx.fill();
    }

    function drawBackground(mix) {
        const w = mix.weights;
        const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
        sky.addColorStop(0, rgb(skyColor('top', mix)));
        sky.addColorStop(.6, rgb(skyColor('mid', mix)));
        sky.addColorStop(1, rgb(skyColor('low', mix)));
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, GROUND);

        const starAlpha = mix.a.stars + (mix.b.stars - mix.a.stars) * mix.t;
        if (starAlpha > .02) {
            const still = calm();
            ctx.fillStyle = '#fff8dc';
            stars.forEach((star) => {
                ctx.globalAlpha = starAlpha * (still ? .7 : .45 + .45 * Math.sin(clock * 1.6 + star.phase));
                ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, TAU); ctx.fill();
            });
            ctx.globalAlpha = 1;
        }

        // Moon by night, sun by day; both sink towards the horizon at dawn and dusk.
        const moonAlpha = Math.min(1, w[0] + w[3] * .45 + w[1] * .25);
        const sunAlpha = Math.min(1, w[2] + w[1] * .75 + w[3] * .75);
        const low = w[1] + w[3];
        if (moonAlpha > .02) {
            const my = 118 + low * 40;
            ctx.globalAlpha = moonAlpha;
            const glow = ctx.createRadialGradient(372, my, 10, 372, my, 110);
            glow.addColorStop(0, 'rgba(255, 244, 200, .35)');
            glow.addColorStop(1, 'rgba(255, 244, 200, 0)');
            ctx.fillStyle = glow;
            ctx.fillRect(262, my - 110, 220, 220);
            ctx.fillStyle = '#fff4c8';
            ctx.beginPath(); ctx.arc(372, my, 38, 0, TAU); ctx.fill();
            ctx.fillStyle = 'rgba(214, 200, 150, .45)';
            ctx.beginPath(); ctx.arc(358, my - 10, 7, 0, TAU); ctx.fill();
            ctx.beginPath(); ctx.arc(385, my + 14, 5, 0, TAU); ctx.fill();
            ctx.globalAlpha = 1;
        }
        if (sunAlpha > .02) {
            const sy = 96 + low * 230;
            const sx = 96;
            ctx.globalAlpha = sunAlpha;
            const glow = ctx.createRadialGradient(sx, sy, 16, sx, sy, 150);
            glow.addColorStop(0, low > .5 ? 'rgba(255, 190, 120, .55)' : 'rgba(255, 250, 220, .6)');
            glow.addColorStop(1, 'rgba(255, 220, 160, 0)');
            ctx.fillStyle = glow;
            ctx.fillRect(sx - 150, sy - 150, 300, 300);
            ctx.fillStyle = low > .5 ? '#ffd08a' : '#fff6d0';
            ctx.beginPath(); ctx.arc(sx, sy, 34, 0, TAU); ctx.fill();
            ctx.globalAlpha = 1;
        }

        const cloudColor = skyColor('cloud', mix);
        clouds.forEach((cloud) => {
            const span = W + 240;
            const x = ((cloud.x - scroll * cloud.f) % span + span) % span - 120;
            drawCloud(x, cloud.y, cloud.s, rgb(cloudColor, .55 + w[2] * .3));
        });

        drawLayer(farPath, FAR_SPAN, .1, rgb(skyColor('far', mix)));
        drawLayer(hillPath, HILL_SPAN, .3, rgb(skyColor('hill', mix)));
        drawLayer(nearPath, NEAR_SPAN, .6, rgb(skyColor('near', mix)));
    }

    function drawGround(mix) {
        const floor = ctx.createLinearGradient(0, GROUND, 0, H);
        floor.addColorStop(0, '#d9d2c1');
        floor.addColorStop(1, '#a79d88');
        ctx.fillStyle = floor;
        ctx.fillRect(0, GROUND, W, H - GROUND);
        ctx.fillStyle = '#f2ecdd';
        ctx.fillRect(0, GROUND, W, 6);
        ctx.fillStyle = '#86ad4c';
        ctx.fillRect(0, GROUND - 2, W, 3);
        ctx.strokeStyle = 'rgba(96, 86, 68, .35)';
        ctx.lineWidth = 2;
        const shift = scroll % 48;
        ctx.beginPath();
        for (let x = -shift; x < W + 48; x += 48) {
            ctx.moveTo(x, GROUND + 6);
            ctx.lineTo(x - 14, H);
        }
        ctx.moveTo(0, GROUND + 30);
        ctx.lineTo(W, GROUND + 30);
        ctx.stroke();
        const tint = mix.a.tint + (mix.b.tint - mix.a.tint) * mix.t;
        if (tint > .01) {
            ctx.fillStyle = `rgba(8, 12, 40, ${tint})`;
            ctx.fillRect(0, GROUND, W, H - GROUND);
        }
    }

    function themeName() {
        const list = document.body.classList;
        if (list.contains('theme-neon')) return 'neon';
        if (list.contains('theme-retro')) return 'retro';
        if (list.contains('theme-paper')) return 'paper';
        return 'liquid';
    }

    function drawColumn(x, top, bottom, capAtBottom, tint) {
        const shaft = ctx.createLinearGradient(x, 0, x + COLUMN_W, 0);
        shaft.addColorStop(0, '#bfb6a1');
        shaft.addColorStop(.35, '#f4efe3');
        shaft.addColorStop(1, '#a89f8a');
        ctx.fillStyle = shaft;
        ctx.fillRect(x + 6, top, COLUMN_W - 12, bottom - top);
        ctx.strokeStyle = 'rgba(110, 100, 80, .35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 1; i < 5; i += 1) {
            const fx = x + 6 + i * ((COLUMN_W - 12) / 5);
            ctx.moveTo(fx, top);
            ctx.lineTo(fx, bottom);
        }
        ctx.stroke();
        const capY = capAtBottom ? bottom - 22 : top;
        ctx.fillStyle = '#ece5d4';
        ctx.fillRect(x - 4, capAtBottom ? capY + 12 : capY, COLUMN_W + 8, 10);
        ctx.fillStyle = '#d6cdb8';
        ctx.fillRect(x, capAtBottom ? capY : capY + 10, COLUMN_W, 12);
        ctx.fillStyle = 'rgba(80, 70, 50, .25)';
        ctx.fillRect(x - 4, capAtBottom ? capY + 20 : capY + 8, COLUMN_W + 8, 2);
        // Volutes on the capital, the Ionic order's scrolls.
        const vy = capAtBottom ? capY + 6 : capY + 16;
        ctx.strokeStyle = 'rgba(110, 100, 80, .55)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(x + 4, vy, 4, 0, TAU);
        ctx.moveTo(x + COLUMN_W, vy);
        ctx.arc(x + COLUMN_W - 4, vy, 4, 0, TAU);
        ctx.stroke();
        if (tint > .01) {
            ctx.fillStyle = `rgba(14, 18, 52, ${tint})`;
            ctx.fillRect(x - 4, top, COLUMN_W + 8, bottom - top);
        }
    }

    function drawColumns(mix) {
        const tint = (mix.a.tint + (mix.b.tint - mix.a.tint) * mix.t) * .9;
        const neon = themeName() === 'neon';
        columns.forEach((col) => {
            const top = col.gapY - col.gap / 2;
            const bottom = col.gapY + col.gap / 2;
            drawColumn(col.x, -10, top, true, tint);
            drawColumn(col.x, bottom, GROUND, false, tint);
            if (col.amp) {
                // Moving columns carry a faint glyph so the motion reads as intended.
                ctx.fillStyle = 'rgba(134, 173, 76, .8)';
                ctx.beginPath();
                ctx.arc(col.x + COLUMN_W / 2, top - 40, 4, 0, TAU);
                ctx.arc(col.x + COLUMN_W / 2, bottom + 40, 4, 0, TAU);
                ctx.fill();
            }
            if (neon) {
                ctx.save();
                ctx.strokeStyle = '#00f2fe';
                ctx.shadowColor = '#00f2fe';
                ctx.shadowBlur = 12;
                ctx.lineWidth = 2;
                ctx.strokeRect(col.x - 4, -10, COLUMN_W + 8, top + 10);
                ctx.strokeRect(col.x - 4, bottom, COLUMN_W + 8, GROUND - bottom);
                ctx.restore();
            }
        });
    }

    function drawCoin(coin) {
        const spin = calm() ? 1 : Math.abs(Math.cos(clock * 3 + coin.phase));
        const y = coin.y + (calm() ? 0 : Math.sin(clock * 4 + coin.phase) * 3);
        ctx.save();
        ctx.translate(coin.x, y);
        const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, COIN_R * 2.2);
        glow.addColorStop(0, 'rgba(255, 226, 120, .45)');
        glow.addColorStop(1, 'rgba(255, 226, 120, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(-COIN_R * 2.2, -COIN_R * 2.2, COIN_R * 4.4, COIN_R * 4.4);
        ctx.scale(Math.max(.18, spin), 1);
        ctx.fillStyle = '#b8860b';
        ctx.beginPath(); ctx.arc(0, 0, COIN_R, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffd84a';
        ctx.beginPath(); ctx.arc(0, 0, COIN_R - 2.5, 0, TAU); ctx.fill();
        if (spin > .45) {
            // An Athenian drachma: a tiny owl stamped on the face.
            ctx.fillStyle = '#b8860b';
            ctx.beginPath(); ctx.ellipse(0, 2, 5, 6, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = '#ffe98a';
            ctx.beginPath(); ctx.arc(-2.2, -.5, 1.8, 0, TAU); ctx.arc(2.2, -.5, 1.8, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = 'rgba(255, 255, 255, .6)';
        ctx.beginPath(); ctx.arc(-4, -5, 2.2, 0, TAU); ctx.fill();
        ctx.restore();
    }

    function drawParticles() {
        particles.forEach((p) => {
            ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max * 1.4));
            ctx.fillStyle = p.color;
            if (p.kind === 'feather') {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.spin);
                ctx.beginPath();
                ctx.ellipse(0, 0, p.size * 2.6, p.size, 0, 0, TAU);
                ctx.fill();
                ctx.strokeStyle = 'rgba(0, 0, 0, .25)';
                ctx.lineWidth = .8;
                ctx.beginPath();
                ctx.moveTo(-p.size * 3.2, 0);
                ctx.lineTo(p.size * 2.4, 0);
                ctx.stroke();
                ctx.restore();
            } else if (p.kind === 'spark') {
                const s = p.size * (p.life / p.max);
                ctx.beginPath();
                ctx.moveTo(p.x, p.y - s * 2);
                ctx.lineTo(p.x + s * .5, p.y - s * .5);
                ctx.lineTo(p.x + s * 2, p.y);
                ctx.lineTo(p.x + s * .5, p.y + s * .5);
                ctx.lineTo(p.x, p.y + s * 2);
                ctx.lineTo(p.x - s * .5, p.y + s * .5);
                ctx.lineTo(p.x - s * 2, p.y);
                ctx.lineTo(p.x - s * .5, p.y - s * .5);
                ctx.closePath();
                ctx.fill();
            } else if (p.kind === 'leaf') {
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, p.size * 1.8, p.size * .8, p.spin, 0, TAU);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, TAU);
                ctx.fill();
            }
        });
        ctx.globalAlpha = 1;
    }

    function drawFloaters() {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        floaters.forEach((f) => {
            const t = 1 - f.life / f.max;
            ctx.globalAlpha = Math.max(0, 1 - t * t);
            ctx.font = `800 ${f.size}px Outfit, system-ui, sans-serif`;
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(8, 10, 30, .65)';
            const y = f.y - t * 40;
            ctx.strokeText(f.text, f.x, y);
            ctx.fillStyle = f.color;
            ctx.fillText(f.text, f.x, y);
        });
        ctx.globalAlpha = 1;
        ctx.textBaseline = 'alphabetic';
    }

    function drawReadyGuide() {
        // A dotted arc previews the first flap, and a pulsing ring shows where to tap.
        let x = OWL_X;
        let y = owlY;
        let v = FLAP;
        ctx.fillStyle = 'rgba(255, 236, 160, .8)';
        for (let i = 1; i <= 14; i += 1) {
            const dt = .045;
            v = Math.min(MAX_FALL, v + GRAVITY * dt);
            y += v * dt;
            x += 165 * dt;
            if (i % 2 === 0) { ctx.beginPath(); ctx.arc(x + 20, y, 3.4, 0, TAU); ctx.fill(); }
        }
        const pulse = calm() ? .5 : (clock * 1.3) % 1;
        ctx.strokeStyle = `rgba(255, 255, 255, ${.8 - pulse * .7})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(OWL_X, owlY + 74, 14 + pulse * 18, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, .9)';
        ctx.beginPath(); ctx.arc(OWL_X, owlY + 74, 8, 0, TAU); ctx.fill();

        ctx.textAlign = 'center';
        ctx.font = '800 44px Outfit, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(8, 10, 30, .4)';
        ctx.fillText('Hazır ol!', W / 2 + 3, 175);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Hazır ol!', W / 2, 172);
        ctx.font = '700 17px Outfit, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, .85)';
        ctx.fillText('Sütun ve drahmi başına 1 puan', W / 2, 204);
    }

    function draw() {
        const mix = skyWeights();
        ctx.save();
        if (shake > 0 && !calm()) {
            const m = shake * 18;
            ctx.translate((Math.random() - .5) * m, (Math.random() - .5) * m);
        }
        ctx.clearRect(-20, -20, W + 40, H + 40);
        drawBackground(mix);
        drawColumns(mix);
        coins.forEach(drawCoin);
        drawGround(mix);
        drawParticles();

        const ghost = mode === 'playing' && cheatOn('immortal');
        drawOwl(ctx, activeOwlId(), OWL_X, owlY, tilt, wingLift(), 1, ghost ? .72 : 1, owlLook());
        drawFloaters();

        if (mode === 'ready') drawReadyGuide();
        if (mode === 'playing' || mode === 'paused' || mode === 'falling') {
            const bump = 1 + scoreBump * .25;
            ctx.save();
            ctx.translate(W / 2, 82);
            ctx.scale(bump, bump);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '800 64px Outfit, system-ui, sans-serif';
            ctx.fillStyle = 'rgba(8, 10, 30, .35)';
            ctx.fillText(formatScore(score), 3, 3);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(formatScore(score), 0, 0);
            ctx.restore();
            ctx.textBaseline = 'alphabetic';
        }
        ctx.restore();

        if (mode === 'paused') {
            ctx.fillStyle = 'rgba(8, 10, 30, .45)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#ffffff';
            ctx.font = '800 34px Outfit, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Duraklatıldı', W / 2, H / 2 - 10);
            ctx.font = '600 18px Outfit, system-ui, sans-serif';
            ctx.fillText('Devam etmek için dokun', W / 2, H / 2 + 22);
        }
        if (hitFlash > 0) {
            const edge = ctx.createRadialGradient(W / 2, H / 2, H * .25, W / 2, H / 2, H * .7);
            edge.addColorStop(0, 'rgba(220, 40, 40, 0)');
            edge.addColorStop(1, `rgba(220, 40, 40, ${hitFlash * .55})`);
            ctx.fillStyle = edge;
            ctx.fillRect(0, 0, W, H);
        }
        if (flash > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${flash * (calm() ? .2 : .55)})`;
            ctx.fillRect(0, 0, W, H);
        }
    }

    function drawMedal(target, medal) {
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const size = 72;
        target.width = size * ratio;
        target.height = size * ratio;
        const c = target.getContext('2d');
        c.setTransform(ratio, 0, 0, ratio, 0, 0);
        c.clearRect(0, 0, size, size);
        if (!medal) return;
        c.fillStyle = medal.ribbon;
        c.beginPath();
        c.moveTo(22, 0); c.lineTo(34, 0); c.lineTo(40, 30); c.lineTo(28, 30); c.closePath();
        c.moveTo(50, 0); c.lineTo(38, 0); c.lineTo(32, 30); c.lineTo(44, 30); c.closePath();
        c.fill();
        c.fillStyle = medal.rim;
        c.beginPath(); c.arc(36, 44, 24, 0, TAU); c.fill();
        const face = c.createRadialGradient(30, 38, 2, 36, 44, 22);
        face.addColorStop(0, medal.shine);
        face.addColorStop(1, medal.face);
        c.fillStyle = face;
        c.beginPath(); c.arc(36, 44, 20, 0, TAU); c.fill();
        c.save();
        c.translate(36, 46);
        c.scale(.55, .55);
        c.fillStyle = medal.rim;
        c.beginPath(); c.ellipse(0, 4, 13, 16, 0, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(-10, -8); c.lineTo(-12, -20); c.lineTo(-2, -12); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(10, -8); c.lineTo(12, -20); c.lineTo(2, -12); c.closePath(); c.fill();
        c.fillStyle = medal.shine;
        c.beginPath(); c.arc(-5, -2, 4.4, 0, TAU); c.arc(5, -2, 4.4, 0, TAU); c.fill();
        c.fillStyle = medal.rim;
        c.beginPath(); c.arc(-5, -2, 2, 0, TAU); c.arc(5, -2, 2, 0, TAU); c.fill();
        c.restore();
    }

    /* ---------- Game logic ---------- */

    function formatScore(value) {
        return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2))).replace('.', ',');
    }

    function medalFor(value) { return MEDALS.find((medal) => value >= medal.min) || null; }
    function nextMedal(value) { return MEDALS.slice().reverse().find((medal) => value < medal.min) || null; }

    function updateHud() {
        $('score').textContent = formatScore(score);
        $('best').textContent = String(best);
    }

    /* The gap narrows and the speed rises smoothly, levelling off so long flights stay fair. */
    function gapFor(value) { return 150 + 52 * Math.exp(-value / 22); }
    function speedFor(value) { return 165 + 100 * (1 - Math.exp(-value / 30)); }

    function spawnColumn(x) {
        const gap = gapFor(score);
        let amp = 0;
        if (score >= 15 && Math.random() < Math.min(.55, .2 + (score - 15) / 40)) amp = Math.min(46, 18 + (score - 15) * .8);
        const minY = 70 + gap / 2 + amp;
        const maxY = GROUND - 70 - gap / 2 - amp;
        const previous = columns[columns.length - 1];
        let baseY = minY + Math.random() * (maxY - minY);
        const reach = 190 - amp;
        if (previous) baseY = Math.max(previous.baseY - reach, Math.min(previous.baseY + reach, baseY));
        baseY = Math.max(minY, Math.min(maxY, baseY));
        const column = { x, baseY, gapY: baseY, gap, amp, phase: Math.random() * TAU, freq: 1.1 + Math.random() * .5, passed: false };
        columns.push(column);
        if (previous && Math.random() < .45) {
            const midX = previous.x + COLUMN_W + (x - previous.x - COLUMN_W) / 2;
            const midY = Math.max(90, Math.min(GROUND - 90, (previous.baseY + baseY) / 2 + (Math.random() - .5) * 60));
            coins.push({ x: midX, y: midY, phase: Math.random() * TAU });
        }
    }

    function emit(count, color, options = {}) {
        const n = calm() ? Math.ceil(count / 2) : count;
        for (let i = 0; i < n; i += 1) {
            const life = (options.life ?? .4) + Math.random() * (options.lifeSpread ?? .5);
            particles.push({
                x: options.x ?? OWL_X + (options.dx || 0),
                y: options.y ?? owlY + (options.dy || 0),
                vx: (options.vx ?? -40) + (Math.random() - .5) * (options.spread ?? 160),
                vy: (options.vy ?? 0) + (Math.random() - .5) * (options.spread ?? 160),
                life,
                max: life,
                size: options.size ?? 2 + Math.random() * 2,
                color,
                kind: options.kind || 'dot',
                spin: Math.random() * TAU,
                sway: Math.random() * TAU
            });
        }
    }

    function floater(text, x, y, color = '#ffe07a', size = 24) {
        floaters.push({ text, x, y, color, size, life: .9, max: .9 });
    }

    function resetRun() {
        owlY = H * .42;
        vy = 0;
        tilt = 0;
        score = 0;
        coinsRun = 0;
        speed = 165;
        columns = [];
        coins = [];
        particles = [];
        floaters = [];
        flash = 0;
        hitFlash = 0;
        shake = 0;
        scoreBump = 0;
        lastAnnounced = 0;
        spawnColumn(W + 90);
        updateHud();
    }

    function showMenu() {
        mode = 'menu';
        resetRun();
        columns = [];
        coins = [];
        $('over').classList.add('hidden');
        $('stage-hint').classList.add('hidden');
        $('menu').classList.remove('hidden');
        renderOwls();
    }

    function startRun() {
        resetRun();
        mode = 'ready';
        $('menu').classList.add('hidden');
        $('over').classList.add('hidden');
        $('stage-hint').classList.remove('hidden');
        stage.focus({ preventScroll: true });
        announce('Hazır ol. Kanat çırpmak için dokun ya da Boşluk tuşuna bas.');
    }

    function flap() {
        if (mode === 'ready') {
            mode = 'playing';
            $('stage-hint').classList.add('hidden');
            announce('Uçuş başladı.');
        } else if (mode === 'paused') {
            mode = 'playing';
            announce('Devam ediliyor.');
        } else if (mode !== 'playing') {
            return;
        }
        vy = FLAP;
        flapAt = clock;
        sound(520, .09, 'triangle', 260);
        const p = palettes[activeOwlId()];
        // A feather or two drifts off with each wing beat.
        if (Math.random() < .5) emit(1, p.wing, { dx: -8, dy: 10, vx: -90, vy: 40, spread: 50, size: 2.2, kind: 'feather', life: .8, lifeSpread: .5 });
        if (p.trail) emit(4, p.trail, { dx: -10, dy: 8, vx: -120, vy: 60, spread: 70, size: 2.2 });
    }

    function crash(reason, hitX, hitY) {
        if (mode !== 'playing') return;
        mode = 'falling';
        flash = 1;
        hitFlash = 1;
        shake = .45;
        vy = Math.min(vy, -160);
        const p = palettes[activeOwlId()];
        emit(14, p.body, { spread: 300, size: 2.6, kind: 'feather', vy: -60, life: .9, lifeSpread: .8 });
        emit(8, p.belly, { spread: 240, size: 2.2, kind: 'feather', vy: -40, life: .9, lifeSpread: .6 });
        emit(8, '#fff6d0', { x: hitX ?? OWL_X + OWL_R, y: hitY ?? owlY, spread: 320, size: 3.2, kind: 'spark', vx: 0, life: .25, lifeSpread: .25 });
        sound(190, .3, 'sawtooth', -120);
        sound(90, .25, 'square', -40, .04);
        if (!calm() && navigator.vibrate) { try { navigator.vibrate(40); } catch (_) { /* optional */ } }
        crashReason = reason;
    }

    function finish() {
        mode = 'over';
        overAt = performance.now();
        const cheating = cheatOn('active');
        const finalScore = Math.floor(score);
        let reward = 0;
        let note = '';
        const previousBest = best;
        if (!cheating && finalScore > best) {
            best = finalScore;
            setCookieValue(BEST_COOKIE, String(best));
            note = 'Yeni rekor! ';
        }
        if (cheating) {
            note += 'Hile açık · skor ve CM kaydedilmedi.';
        } else if (!CasualProfile.current()) {
            note += 'Oturum kapalı · CM kazanmak için menüden oturumu başlat.';
        } else {
            reward = CasualProfile.awardOwlFlight({ score: finalScore }).reward;
            if (!reward) note += 'CM için en az 2 puan topla.';
            else if (CasualProfile.owlRewardForScore(finalScore) >= CasualProfile.OWL_REWARD_CAP) note += 'Uçuş başına ödül sınırına ulaştın.';
            else note += 'Kazanç profiline eklendi.';
        }
        if (typeof recordGameResult === 'function') recordGameResult('Minerva Owl', { won: finalScore >= 20, score: finalScore });
        $('over-title').textContent = crashReason === 'ground' ? 'Yere indin' : 'Sütuna çarptın';
        $('over-score').textContent = formatScore(score);
        $('over-best').textContent = String(best);
        const canEarn = !cheating && Boolean(CasualProfile.current());
        $('over-reward').textContent = canEarn ? `+${CasualProfile.formatMoney(reward)} CM` : '—';
        $('over-reward').classList.toggle('none', !reward);
        $('over-note').textContent = note.trim();

        const medal = medalFor(finalScore);
        const next = nextMedal(finalScore);
        const medalBox = $('over-medal');
        medalBox.className = `medal-box${medal ? ` ${medal.id}` : ' none'}${!cheating && finalScore > previousBest && finalScore > 0 ? ' record' : ''}`;
        drawMedal($('medal-canvas'), medal);
        $('medal-name').textContent = medal ? `${medal.name} madalya` : 'Madalya yok';
        const coinText = coinsRun ? ` · ${coinsRun} drahmi` : '';
        $('medal-next').textContent = next ? `${next.name} için ${next.min} puan${coinText}` : `En yüksek madalya!${coinText}`;
        announce(`Uçuş bitti. Skor ${formatScore(score)}. ${medal ? `${medal.name} madalya.` : ''} ${note.trim()}`);

        // Taps and key presses meant for the owl can land on the result sheet; keep its buttons inert for a moment.
        const over = $('over');
        const buttons = over.querySelectorAll('button');
        over.classList.add('arming');
        buttons.forEach((button) => { button.disabled = true; });
        over.classList.remove('hidden');
        window.clearTimeout(armTimer);
        armTimer = window.setTimeout(() => {
            over.classList.remove('arming');
            buttons.forEach((button) => { button.disabled = false; });
            if (mode === 'over') $('retry-btn').focus({ preventScroll: true });
        }, RESULT_LOCK_MS);
        updateHud();
        renderOwls();
    }

    function circleHitsRect(cx, cy, r, x, y, w, h) {
        const nx = Math.max(x, Math.min(cx, x + w));
        const ny = Math.max(y, Math.min(cy, y + h));
        return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
    }

    /* Hit boxes follow the drawn shaft and the wider capital at the gap edge. */
    function columnHit(col) {
        const top = col.gapY - col.gap / 2;
        const bottom = col.gapY + col.gap / 2;
        const shaftX = col.x + 6;
        const shaftW = COLUMN_W - 12;
        return circleHitsRect(OWL_X, owlY, OWL_R, shaftX, -10, shaftW, top + 10)
            || circleHitsRect(OWL_X, owlY, OWL_R, col.x - 4, top - 22, COLUMN_W + 8, 22)
            || circleHitsRect(OWL_X, owlY, OWL_R, shaftX, bottom, shaftW, GROUND - bottom)
            || circleHitsRect(OWL_X, owlY, OWL_R, col.x - 4, bottom, COLUMN_W + 8, 22);
    }

    function addPoint(amount) {
        score = Number((score + amount).toFixed(3));
        scoreBump = 1;
        updateHud();
        const whole = Math.floor(score);
        if (whole >= lastAnnounced + 5) {
            lastAnnounced = whole - (whole % 5);
            announce(`Skor ${whole}`);
        }
    }

    function stepEffects(dt) {
        flash = Math.max(0, flash - dt * 3);
        hitFlash = Math.max(0, hitFlash - dt * 1.6);
        shake = Math.max(0, shake - dt);
        scoreBump = Math.max(0, scoreBump - dt * 5);
        particles.forEach((p) => {
            p.life -= dt;
            if (p.kind === 'feather') {
                // Feathers drift: light gravity, air drag and a side-to-side sway.
                p.vy += 120 * dt;
                p.vx *= 1 - 1.6 * dt;
                p.vy *= 1 - 1.4 * dt;
                p.sway += dt * 5;
                p.x += (p.vx + Math.sin(p.sway) * 30) * dt;
                p.y += p.vy * dt;
                p.spin = Math.sin(p.sway) * .8;
            } else {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vy += (p.kind === 'spark' ? 0 : 260) * dt;
                p.spin += dt * 4;
            }
        });
        particles = particles.filter((p) => p.life > 0);
        floaters.forEach((f) => { f.life -= dt; });
        floaters = floaters.filter((f) => f.life > 0);
    }

    function step(dt) {
        clock += dt;
        stepEffects(dt);
        // The sky follows the score one phase at a time.
        const target = Math.floor(Math.max(0, score) / SKY_STEP);
        if (mode === 'menu') skyPos = 0;
        else skyPos += (target - skyPos) * Math.min(1, dt * .9);

        if (mode === 'menu' || mode === 'ready') {
            scroll += 60 * dt;
            owlY = H * .42 + Math.sin(clock * 3) * 10;
            tilt = Math.sin(clock * 1.5) * .05;
            return;
        }
        if (mode === 'paused' || mode === 'over') return;

        vy = Math.min(MAX_FALL, vy + GRAVITY * dt);
        owlY += vy * dt;
        if (mode === 'falling') {
            tilt += (1.5 - tilt) * Math.min(1, dt * 6);
            if (owlY + OWL_R >= GROUND) {
                owlY = GROUND - OWL_R;
                emit(6, '#d9d2c1', { y: GROUND, vy: -80, spread: 140, size: 2.6, life: .3 });
                finish();
            }
            return;
        }
        const targetTilt = Math.max(-.35, Math.min(.9, vy / 850));
        tilt += (targetTilt - tilt) * Math.min(1, dt * 10);

        speed = speedFor(score);
        const move = speed * dt;
        scroll += move;
        columns.forEach((col) => {
            col.x -= move;
            if (col.amp) col.gapY = col.baseY + Math.sin(clock * col.freq + col.phase) * col.amp;
        });
        coins.forEach((coin) => { coin.x -= move; });
        columns = columns.filter((col) => col.x + COLUMN_W > -20);
        coins = coins.filter((coin) => coin.x > -30 && !coin.taken);
        const last = columns[columns.length - 1];
        if (!last || last.x < W - SPACING) spawnColumn((last ? last.x : W) + SPACING);

        const immortal = cheatOn('immortal');
        if (owlY - OWL_R < 0) { owlY = OWL_R; vy = Math.max(0, vy); }
        if (owlY + OWL_R >= GROUND) {
            if (immortal) { owlY = GROUND - OWL_R; vy = FLAP * .8; }
            else { owlY = GROUND - OWL_R; crash('ground', OWL_X, GROUND); return; }
        }

        for (const col of columns) {
            if (!immortal && columnHit(col)) { crash('column', col.x, owlY); return; }
            if (!col.passed && col.x + COLUMN_W < OWL_X - OWL_R) {
                col.passed = true;
                addPoint(1);
                sound(880, .07, 'sine', 220);
                emit(5, '#86ad4c', { dx: 6, vx: -60, vy: -40, spread: 120, size: 2.4, kind: 'leaf' });
            }
        }
        for (const coin of coins) {
            if (coin.taken) continue;
            if ((coin.x - OWL_X) ** 2 + (coin.y - owlY) ** 2 < (OWL_R + COIN_R) ** 2) {
                coin.taken = true;
                coinsRun += 1;
                addPoint(1);
                sound(1320, .12, 'triangle', 600, .045);
                emit(8, '#ffe07a', { x: coin.x, y: coin.y, vx: 0, spread: 260, size: 2.8, kind: 'spark', life: .3, lifeSpread: .3 });
                floater('+1', coin.x, coin.y - 18);
            }
        }

        const trail = palettes[activeOwlId()].trail;
        if (trail) {
            trailTimer -= dt;
            if (trailTimer <= 0) {
                trailTimer = .05;
                emit(1, trail, { dx: -14, dy: 4, vx: -speed * .6, vy: 20, spread: 40, size: 1.8 });
            }
        }
    }

    function animatePreview(dt) {
        if (mode !== 'menu' || !activePreview || !activePreview.canvas.isConnected) return;
        previewClock += dt;
        if (previewClock < 1 / 30) return;
        previewClock = 0;
        const still = calm();
        drawPreview(activePreview.canvas, activePreview.id, still ? .45 : .45 + .6 * Math.sin(clock * 9), false, still ? 0 : Math.sin(clock * 3) * 2);
    }

    function frame(time) {
        // Small fixed sub-steps keep physics identical on slow and fast displays.
        let remaining = Math.min(.1, Math.max(0, (time - lastFrame) / 1000));
        const elapsed = remaining;
        lastFrame = time;
        while (remaining > 0) {
            const dt = Math.min(1 / 120, remaining);
            step(dt);
            remaining -= dt;
        }
        draw();
        animatePreview(elapsed);
        syncPauseButton();
        requestAnimationFrame(frame);
    }

    function syncPauseButton() {
        if (mode === shownMode) return;
        shownMode = mode;
        const button = $('pause-btn');
        button.classList.toggle('hidden', mode !== 'playing' && mode !== 'paused');
        const paused = mode === 'paused';
        button.setAttribute('aria-label', paused ? 'Devam et' : 'Duraklat');
        button.innerHTML = paused
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"></path></svg>'
            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"></rect><rect x="14" y="5" width="4" height="14" rx="1.2"></rect></svg>';
    }

    function pause() {
        if (mode !== 'playing') return;
        mode = 'paused';
        announce('Duraklatıldı.');
    }

    function togglePause() {
        if (mode === 'playing') pause();
        else if (mode === 'paused') flap();
    }

    function fitCanvas() {
        // Retro renders at half resolution; the theme's pixelated scaling turns it into chunky pixels.
        const ratio = themeName() === 'retro' ? .5 : Math.min(2, window.devicePixelRatio || 1);
        const width = Math.round(W * ratio);
        if (canvas.width !== width) {
            canvas.width = width;
            canvas.height = Math.round(H * ratio);
        }
        ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    }

    /* ---------- Input ---------- */

    stage.addEventListener('pointerdown', (event) => {
        if (event.target !== canvas) return;
        if (event.button !== undefined && event.button > 0) return;
        event.preventDefault();
        flap();
    });

    window.addEventListener('keydown', (event) => {
        const target = event.target;
        if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
        if ((event.key === 'Escape' || event.code === 'KeyP') && (mode === 'playing' || mode === 'paused')) { togglePause(); return; }
        if (!FLAP_KEYS.has(event.code)) return;
        if (mode === 'menu') return;
        if (mode === 'over') {
            if (target instanceof HTMLButtonElement) return;
            event.preventDefault();
            if (performance.now() - overAt > RESULT_LOCK_MS) startRun();
            return;
        }
        event.preventDefault();
        if (event.repeat) return;
        flap();
    });

    document.addEventListener('focusin', (event) => {
        if (mode === 'playing' && !stage.contains(event.target)) pause();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) pause();
    });
    window.addEventListener('blur', pause);

    $('pause-btn').addEventListener('click', () => {
        togglePause();
        stage.focus({ preventScroll: true });
    });
    $('start-btn').addEventListener('click', startRun);
    $('retry-btn').addEventListener('click', startRun);
    $('menu-btn').addEventListener('click', showMenu);

    window.addEventListener('casualprofilechange', () => {
        if (!allOpen()) previewOwl = null;
        renderOwls();
    });
    window.addEventListener('casual-cheat', () => {
        if (!allOpen()) previewOwl = null;
        renderOwls();
    });
    window.addEventListener('casual-cheat-set', (event) => {
        if (mode !== 'playing' && mode !== 'paused') return;
        score = Number(event.detail.n) || 0;
        updateHud();
    });
    window.setInterval(() => {
        if (mode !== 'playing' || !cheats()) return;
        const gain = cheats().tick();
        if (!gain) return;
        addPoint(gain);
    }, 1000);
    window.addEventListener('resize', fitCanvas);

    fitCanvas();
    showMenu();
    requestAnimationFrame((time) => { lastFrame = time; frame(time); });

    /* Read-only view for automated tests. */
    window.MinervaOwlView = Object.freeze({
        state: () => ({
            mode, score, owlY, vy, coinsRun, skyPos,
            columns: columns.map((col) => ({ x: col.x, gapY: col.gapY, gap: col.gap, amp: col.amp })),
            coins: coins.filter((coin) => !coin.taken).map((coin) => ({ x: coin.x, y: coin.y }))
        }),
        layout: { W, H, GROUND, OWL_X, OWL_R, COLUMN_W }
    });
})();
