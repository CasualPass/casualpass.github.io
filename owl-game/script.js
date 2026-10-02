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
    const BEST_COOKIE = 'cp_owl_best';
    const FLAP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
    const RESULT_LOCK_MS = 600;

    /* Visual palettes live with the renderer; names and prices come from CasualProfile.owls. */
    const palettes = {
        minerva: { body: '#8a6446', wing: '#6c4c33', belly: '#efe0bf', spot: '#5b3f29', face: '#caa57a', eye: '#f6c945', pupil: '#1c1206', beak: '#e7a33c', sprig: true },
        snowy: { body: '#eef2f6', wing: '#d9dfe6', belly: '#ffffff', spot: '#4d535c', face: '#ffffff', eye: '#f7d23e', pupil: '#141414', beak: '#3c3c3c' },
        barn: { body: '#d49c56', wing: '#b87d3d', belly: '#fbf1dc', spot: '#8a5a2b', face: '#fffaf0', eye: '#1d1712', pupil: '#000000', beak: '#e7c49b', heart: true },
        eagle: { body: '#6b4a2e', wing: '#553920', belly: '#c89a62', spot: '#3e2917', face: '#a8784a', eye: '#ff8a1f', pupil: '#120a02', beak: '#2f2a24', tufts: true },
        cosmic: { body: '#353a8e', wing: '#272b6e', belly: '#6d77d6', spot: '#c3cbff', face: '#4a50b0', eye: '#7ef9ff', pupil: '#0b1033', beak: '#ffd36e', tufts: true, trail: '#9fe8ff' },
        golden: { body: '#d9a62e', wing: '#b8861c', belly: '#ffe89a', spot: '#9c6b12', face: '#f3c94e', eye: '#ffffff', pupil: '#6b3b00', beak: '#8a5200', sprig: true, trail: '#ffe07a' }
    };

    const stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * (GROUND - 220), r: Math.random() * 1.4 + .4, phase: Math.random() * TAU }));

    let mode = 'menu';
    let owlY = H * .42;
    let vy = 0;
    let tilt = 0;
    let flapBoost = 0;
    let columns = [];
    let particles = [];
    let score = 0;
    let best = Number(getCookieValue(BEST_COOKIE)) || 0;
    let speed = 165;
    let scroll = 0;
    let clock = 0;
    let flash = 0;
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

    function cheats() { return window.CasualCheats; }
    function cheatOn(name) { const c = cheats(); return Boolean(c && typeof c[name] === 'function' && c[name]()); }

    function toast(message) {
        const el = $('toast');
        el.textContent = message;
        el.classList.add('show');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => el.classList.remove('show'), 2400);
    }

    function sound(freq, duration = .08, type = 'sine', slide = 0) {
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
            gain.gain.setValueAtTime(.05, now);
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

    function renderOwls() {
        const profile = CasualProfile.current();
        const owned = ownedIds(profile);
        const selected = resolveOwl(profile);
        const balance = profile?.balance || 0;
        const grid = $('owl-grid');
        grid.replaceChildren();
        catalog().forEach((owl) => {
            const isOwned = owned.includes(owl.id);
            const card = document.createElement('article');
            card.className = `owl-card${owl.id === selected ? ' active' : ''}${isOwned ? '' : ' locked'}${!isOwned && balance < owl.price ? ' poor' : ''}`;
            const preview = document.createElement('canvas');
            drawPreview(preview, owl.id);
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

    /* ---------- Drawing ---------- */

    function drawOwl(c, id, x, y, angle, lift, scale = 1, alpha = 1) {
        const p = palettes[id] || palettes.minerva;
        c.save();
        c.globalAlpha = alpha;
        c.translate(x, y);
        c.rotate(angle);
        c.scale(scale, scale);

        // Wings sit behind the body and rotate up from the shoulders.
        c.fillStyle = p.wing;
        [-1, 1].forEach((side) => {
            c.save();
            c.translate(side * 14, -3);
            c.rotate(-side * lift);
            c.beginPath();
            c.ellipse(side * 6, 11, 8, 16, side * -.25, 0, TAU);
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

        const look = Math.max(-1.5, Math.min(1.5, angle * 3));
        [-1, 1].forEach((side) => {
            c.fillStyle = p.eye;
            c.beginPath(); c.arc(side * 8, -7, 7.2, 0, TAU); c.fill();
            c.fillStyle = p.pupil;
            c.beginPath(); c.arc(side * 8 + 1.2, -7 + look, 4, 0, TAU); c.fill();
            c.fillStyle = '#ffffff';
            c.beginPath(); c.arc(side * 8 + 2.6, -9 + look, 1.5, 0, TAU); c.fill();
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

    function drawPreview(target, id) {
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        target.width = 64 * ratio;
        target.height = 64 * ratio;
        const c = target.getContext('2d');
        c.setTransform(ratio, 0, 0, ratio, 0, 0);
        c.clearRect(0, 0, 64, 64);
        c.fillStyle = 'rgba(20, 26, 58, .9)';
        c.beginPath(); c.arc(32, 32, 31, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255, 244, 200, .9)';
        c.beginPath(); c.arc(48, 15, 5, 0, TAU); c.fill();
        drawOwl(c, id, 32, 35, 0, .45, .95);
    }

    function drawBackground() {
        const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
        sky.addColorStop(0, '#0b1030');
        sky.addColorStop(.6, '#1d2556');
        sky.addColorStop(1, '#3a3f78');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, GROUND);

        stars.forEach((star) => {
            ctx.globalAlpha = .45 + .45 * Math.sin(clock * 1.6 + star.phase);
            ctx.fillStyle = '#fff8dc';
            ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, TAU); ctx.fill();
        });
        ctx.globalAlpha = 1;

        const glow = ctx.createRadialGradient(372, 118, 10, 372, 118, 110);
        glow.addColorStop(0, 'rgba(255, 244, 200, .35)');
        glow.addColorStop(1, 'rgba(255, 244, 200, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(250, 0, 230, 240);
        ctx.fillStyle = '#fff4c8';
        ctx.beginPath(); ctx.arc(372, 118, 38, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(214, 200, 150, .45)';
        ctx.beginPath(); ctx.arc(358, 108, 7, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(385, 132, 5, 0, TAU); ctx.fill();

        drawHills(scroll * .12, '#232a5c', GROUND - 150, 60, true);
        drawHills(scroll * .3, '#1a1f45', GROUND - 80, 42, false);
    }

    function drawHills(offset, color, base, height, temple) {
        const span = 480;
        const shift = offset % span;
        ctx.fillStyle = color;
        for (let i = -1; i < 2; i += 1) {
            const ox = i * span - shift;
            ctx.beginPath();
            ctx.moveTo(ox, GROUND);
            ctx.lineTo(ox, base);
            ctx.quadraticCurveTo(ox + 120, base - height, ox + 240, base - 6);
            ctx.quadraticCurveTo(ox + 360, base + height * .4, ox + 480, base);
            ctx.lineTo(ox + 480, GROUND);
            ctx.closePath();
            ctx.fill();
            if (temple) {
                // A tiny temple on the far hill, a nod to Minerva's Athens.
                const tx = ox + 86;
                const ty = base - height * .72;
                ctx.fillRect(tx, ty - 4, 70, 5);
                for (let k = 0; k < 6; k += 1) ctx.fillRect(tx + 4 + k * 12, ty - 26, 5, 22);
                ctx.fillRect(tx - 2, ty - 31, 74, 5);
                ctx.beginPath();
                ctx.moveTo(tx - 4, ty - 31);
                ctx.lineTo(tx + 35, ty - 46);
                ctx.lineTo(tx + 74, ty - 31);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    function drawGround() {
        const floor = ctx.createLinearGradient(0, GROUND, 0, H);
        floor.addColorStop(0, '#d9d2c1');
        floor.addColorStop(1, '#a79d88');
        ctx.fillStyle = floor;
        ctx.fillRect(0, GROUND, W, H - GROUND);
        ctx.fillStyle = '#f2ecdd';
        ctx.fillRect(0, GROUND, W, 6);
        ctx.strokeStyle = 'rgba(96, 86, 68, .35)';
        ctx.lineWidth = 2;
        const shift = scroll % 48;
        for (let x = -shift; x < W + 48; x += 48) {
            ctx.beginPath();
            ctx.moveTo(x, GROUND + 6);
            ctx.lineTo(x - 14, H);
            ctx.stroke();
        }
    }

    function drawColumn(x, top, bottom, capAtBottom) {
        const shaft = ctx.createLinearGradient(x, 0, x + COLUMN_W, 0);
        shaft.addColorStop(0, '#bfb6a1');
        shaft.addColorStop(.35, '#f4efe3');
        shaft.addColorStop(1, '#a89f8a');
        ctx.fillStyle = shaft;
        ctx.fillRect(x + 6, top, COLUMN_W - 12, bottom - top);
        ctx.strokeStyle = 'rgba(110, 100, 80, .35)';
        ctx.lineWidth = 2;
        for (let i = 1; i < 5; i += 1) {
            const fx = x + 6 + i * ((COLUMN_W - 12) / 5);
            ctx.beginPath();
            ctx.moveTo(fx, top);
            ctx.lineTo(fx, bottom);
            ctx.stroke();
        }
        const capY = capAtBottom ? bottom - 22 : top;
        ctx.fillStyle = '#ece5d4';
        ctx.fillRect(x - 4, capAtBottom ? capY + 12 : capY, COLUMN_W + 8, 10);
        ctx.fillStyle = '#d6cdb8';
        ctx.fillRect(x, capAtBottom ? capY : capY + 10, COLUMN_W, 12);
        ctx.fillStyle = 'rgba(80, 70, 50, .25)';
        ctx.fillRect(x - 4, capAtBottom ? capY + 20 : capY + 8, COLUMN_W + 8, 2);
    }

    function drawParticles() {
        particles.forEach((p) => {
            ctx.globalAlpha = Math.max(0, p.life / p.max);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            if (p.leaf) ctx.ellipse(p.x, p.y, p.size * 1.8, p.size * .8, p.spin, 0, TAU);
            else ctx.arc(p.x, p.y, p.size, 0, TAU);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        drawBackground();
        columns.forEach((col) => {
            drawColumn(col.x, -10, col.gapY - col.gap / 2, true);
            drawColumn(col.x, col.gapY + col.gap / 2, GROUND, false);
        });
        drawGround();
        drawParticles();

        const ghost = mode === 'playing' && cheatOn('immortal');
        const lift = mode === 'falling' ? .1 : .55 + .55 * Math.sin(clock * (flapBoost > 0 ? 30 : 10));
        drawOwl(ctx, activeOwlId(), OWL_X, owlY, tilt, lift, 1, ghost ? .72 : 1);

        if (mode === 'playing' || mode === 'paused' || mode === 'falling') {
            ctx.fillStyle = 'rgba(8, 10, 30, .35)';
            ctx.font = '800 64px Outfit, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(formatScore(score), W / 2 + 3, 103);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(formatScore(score), W / 2, 100);
        }
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
        if (flash > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${flash * .55})`;
            ctx.fillRect(0, 0, W, H);
        }
    }

    /* ---------- Game logic ---------- */

    function formatScore(value) {
        return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2))).replace('.', ',');
    }

    function updateHud() {
        $('score').textContent = formatScore(score);
        $('best').textContent = String(best);
    }

    function spawnColumn(x) {
        const gap = Math.max(150, 200 - score * 1.6);
        const minY = 70 + gap / 2;
        const maxY = GROUND - 70 - gap / 2;
        const previous = columns[columns.length - 1];
        let gapY = minY + Math.random() * (maxY - minY);
        if (previous) gapY = Math.max(previous.gapY - 190, Math.min(previous.gapY + 190, gapY));
        columns.push({ x, gapY, gap, passed: false });
    }

    function emit(count, color, options = {}) {
        for (let i = 0; i < count; i += 1) {
            const life = .4 + Math.random() * .5;
            particles.push({
                x: OWL_X + (options.dx || 0),
                y: owlY + (options.dy || 0),
                vx: (options.vx ?? -40) + (Math.random() - .5) * (options.spread ?? 160),
                vy: (options.vy ?? 0) + (Math.random() - .5) * (options.spread ?? 160),
                life,
                max: life,
                size: options.size ?? 2 + Math.random() * 2,
                color,
                leaf: Boolean(options.leaf),
                spin: Math.random() * TAU
            });
        }
    }

    function resetRun() {
        owlY = H * .42;
        vy = 0;
        tilt = 0;
        score = 0;
        speed = 165;
        columns = [];
        particles = [];
        flash = 0;
        spawnColumn(W + 90);
        updateHud();
    }

    function showMenu() {
        mode = 'menu';
        resetRun();
        columns = [];
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
    }

    function flap() {
        if (mode === 'ready') {
            mode = 'playing';
            $('stage-hint').classList.add('hidden');
        } else if (mode === 'paused') {
            mode = 'playing';
        } else if (mode !== 'playing') {
            return;
        }
        vy = FLAP;
        flapBoost = .22;
        sound(520, .09, 'triangle', 260);
        if (palettes[activeOwlId()].trail) emit(4, palettes[activeOwlId()].trail, { dx: -10, dy: 8, vx: -120, vy: 60, spread: 70, size: 2.2 });
    }

    function crash(reason) {
        if (mode !== 'playing') return;
        mode = 'falling';
        flash = 1;
        vy = Math.min(vy, -160);
        const p = palettes[activeOwlId()];
        emit(12, p.body, { spread: 260, size: 3, leaf: true });
        emit(6, p.belly, { spread: 220, size: 2.5, leaf: true });
        sound(190, .3, 'sawtooth', -120);
        crashReason = reason;
    }

    function finish() {
        mode = 'over';
        overAt = performance.now();
        const cheating = cheatOn('active');
        const finalScore = Math.floor(score);
        let reward = 0;
        let note = '';
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
            if (!reward) note += 'CM için en az 2 sütun geç.';
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

    function step(dt) {
        clock += dt;
        flapBoost = Math.max(0, flapBoost - dt);
        flash = Math.max(0, flash - dt * 3);
        particles.forEach((p) => {
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 260 * dt;
            p.spin += dt * 4;
        });
        particles = particles.filter((p) => p.life > 0);

        if (mode === 'menu' || mode === 'ready') {
            scroll += 60 * dt;
            owlY = H * .42 + Math.sin(clock * 3) * 10;
            tilt = Math.sin(clock * 1.5) * .05;
            return;
        }
        if (mode === 'paused' || mode === 'over') return;

        vy = Math.min(MAX_FALL, vy + GRAVITY * dt);
        owlY += vy * dt;
        const targetTilt = Math.max(-.35, Math.min(.9, vy / 850));
        tilt += (targetTilt - tilt) * Math.min(1, dt * 10);

        if (mode === 'falling') {
            if (owlY + OWL_R >= GROUND) {
                owlY = GROUND - OWL_R;
                finish();
            }
            return;
        }

        speed = 165 + Math.min(95, score * 3);
        const move = speed * dt;
        scroll += move;
        columns.forEach((col) => { col.x -= move; });
        columns = columns.filter((col) => col.x + COLUMN_W > -20);
        const last = columns[columns.length - 1];
        if (!last || last.x < W - SPACING) spawnColumn((last ? last.x : W) + SPACING);

        const immortal = cheatOn('immortal');
        if (owlY - OWL_R < 0) { owlY = OWL_R; vy = Math.max(0, vy); }
        if (owlY + OWL_R >= GROUND) {
            if (immortal) { owlY = GROUND - OWL_R; vy = FLAP * .8; }
            else { owlY = GROUND - OWL_R; crash('ground'); return; }
        }

        for (const col of columns) {
            if (!immortal && columnHit(col)) { crash('column'); return; }
            if (!col.passed && col.x + COLUMN_W < OWL_X - OWL_R) {
                col.passed = true;
                score = Number((score + 1).toFixed(3));
                sound(880, .07, 'sine', 220);
                emit(5, '#86ad4c', { dx: 6, vx: -60, vy: -40, spread: 120, size: 2.4, leaf: true });
                updateHud();
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

    function frame(time) {
        // Small fixed sub-steps keep physics identical on slow and fast displays.
        let remaining = Math.min(.1, Math.max(0, (time - lastFrame) / 1000));
        lastFrame = time;
        while (remaining > 0) {
            const dt = Math.min(1 / 120, remaining);
            step(dt);
            remaining -= dt;
        }
        draw();
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

    function togglePause() {
        if (mode === 'playing') mode = 'paused';
        else if (mode === 'paused') flap();
    }

    function fitCanvas() {
        const ratio = Math.min(2, window.devicePixelRatio || 1);
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
        if (event.key === 'Escape' && (mode === 'playing' || mode === 'paused')) { togglePause(); return; }
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
        if (mode === 'playing' && !stage.contains(event.target)) mode = 'paused';
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && mode === 'playing') mode = 'paused';
    });
    window.addEventListener('blur', () => { if (mode === 'playing') mode = 'paused'; });

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
        score = Number((score + gain).toFixed(3));
        updateHud();
    }, 1000);
    window.addEventListener('resize', fitCanvas);

    fitCanvas();
    showMenu();
    requestAnimationFrame((time) => { lastFrame = time; frame(time); });
})();
