(() => {
    const $ = id => document.getElementById(id);
    const canvas = $('lane');
    const ctx = canvas.getContext('2d');
    const names = ['İlk Sokak', 'Eski Mahalle', 'Sanayi Yolu', 'Sanayi Bölgesi', 'Son Sokak'];
    const weapons = ['Tabanca', 'Makineli', 'Tüfek', 'Pompalı', 'Fırlatıcı'];
    const defaults = { wood: 8, iron: 4, coin: 12, zone: 0, unlocked: 0, weapon: 0, soldiers: 3, wins: 0, gateHits: 0 };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, Math.floor(Number(v) || 0)));
    function load() {
        try {
            const row = document.cookie.split('; ').find(v => v.startsWith('cp_sonhat_v1='));
            const d = row ? JSON.parse(decodeURIComponent(row.split('=').slice(1).join('='))) : {};
            return { ...defaults, ...d, wood: Math.max(0, +d.wood || 0), iron: Math.max(0, +d.iron || 0), coin: Math.max(0, +d.coin || 0), zone: clamp(d.zone, 0, 4), unlocked: clamp(d.unlocked, 0, 4), weapon: clamp(d.weapon, 0, 4), soldiers: clamp(d.soldiers || 3, 3, 12), wins: clamp(d.wins, 0, 99), gateHits: clamp(d.gateHits, 0, 7) };
        } catch (_) { return { ...defaults }; }
    }
    const state = load();
    const save = () => {
        if (window.CasualCheats?.active()) return;
        document.cookie = `cp_sonhat_v1=${encodeURIComponent(JSON.stringify(state))}; Path=/; SameSite=Lax; Max-Age=31536000`;
    };
    const CENTER = 640, MIN_X = 390, MAX_X = 890, RED_LINE = .91;
    const WEAPON_X = 444, RECRUIT_X = 836, STATION_HALF = 60, GATE_HALF = 100, GATE_HITS = 8, GATE_STEP = .5;
    const weaponNeed = () => Math.max(5, 7 - state.weapon);
    const recruitNeed = 5;
    const gateCost = () => ({ wood: state.zone >= 2 ? 2 : 1, iron: 1, coin: 2 });
    let x = CENTER, y = 594, zombies = [], bullets = [], running = false, paused = false, waveDone = false, kills = 0, gateWarned = false, hintTimer = 0;
    const touchFirst = window.matchMedia('(hover: none)').matches;
    const HINT = touchFirst
        ? 'Sürükleyerek kay · kartlara dokun · zombiler kırmızı çizgiyi geçmesin.'
        : 'A / D ya da ← → ile kay · istasyonda durunca silah ve asker gelir · zombiler kırmızı çizgiyi geçmesin.';
    // World is 1280×720; the view scales it to fill the screen without stretching and keeps the play area (x 340–940) visible.
    const view = { s: 1, ox: 0, oy: 0, w: 1280, h: 720, dpr: 1 };
    function resize() {
        const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
        let s = Math.min(Math.max(w / 1280, h / 720), w / 600, h / 620);
        const spare = Math.max(0, h - 720 * s);
        view.s = s; view.w = w; view.h = h; view.dpr = dpr;
        view.ox = w / 2 - CENTER * s;
        view.oy = h - Math.min(spare * .5, 170) - 720 * s;
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        if (!running) paint(false, false, false);
    }
    let natural = 0, spawned = 0, total = 0, gateHits = 0, gateTimer = 0;
    let spawnTimer = 0, fireTimer = 0, weaponProgress = 0, recruitProgress = 0, lastFrame = 0, lastHud = 0, toastTimer = 0, lastShotSound = 0;
    const keys = new Set();
    let dragging = false, dragClientX = 0, dragStartX = 0, moveTarget = null;
    function toast(text) { $('toast').textContent = text; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 1600); }
    function sound(freq = 180, duration = .05) {
        if (typeof cpSettings !== 'undefined' && cpSettings.sound === false) return;
        try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; sound.context ||= new C(); const ctx2 = sound.context; if (ctx2.state === 'suspended') ctx2.resume(); const o = ctx2.createOscillator(), g = ctx2.createGain(); o.frequency.value = freq; g.gain.setValueAtTime(.025, ctx2.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx2.currentTime + duration); o.connect(g); g.connect(ctx2.destination); o.start(); o.stop(ctx2.currentTime + duration); } catch (_) {}
    }
    function update() {
        const set = (id, n) => { const el = $(id); if (el && el.querySelector('b')) el.querySelector('b').textContent = Math.floor(n).toLocaleString('tr-TR'); };
        set('res-wood', state.wood); set('res-iron', state.iron); set('res-coin', state.coin);
        $('zone-label').textContent = names[state.zone]; $('gun').className = `gun g${state.weapon}`; $('weapon-name').textContent = weapons[state.weapon];
        const gunNeed = weaponNeed();
        $('weapon-fraction').textContent = state.weapon >= 4 ? 'Tamam' : `${Math.floor(weaponProgress)}/${gunNeed} sn`;
        $('weapon-fill').style.setProperty('--p', state.weapon >= 4 ? 100 : weaponProgress / gunNeed * 100);
        $('weapon-cost').textContent = state.weapon >= 4 ? 'En iyi silah' : 'İstasyona git';
        $('squad-label').textContent = `${state.soldiers} kişilik birlik`; $('recruit-fraction').textContent = state.soldiers >= 12 ? 'Dolu' : `${Math.floor(recruitProgress)}/${recruitNeed} sn`;
        $('recruit-fill').style.width = `${Math.min(100, recruitProgress / recruitNeed * 100)}%`; $('recruit-cost').textContent = state.soldiers >= 12 ? 'Birlik dolu' : 'İstasyona git';
        $('pips').innerHTML = Array.from({ length: Math.min(state.soldiers, 8) }, () => '<i></i>').join(''); $('power').textContent = String(state.soldiers * (10 + state.weapon * 8)); $('lv').textContent = String(state.unlocked + 1);
        $('lane-status').textContent = waveDone
            ? (state.zone >= 4 ? 'Beş bölge temizlendi!' : `Yol temiz · geçidi açmak için ortada dur · ${gateHits}/${GATE_HITS}`)
            : `Birlik ${state.soldiers} · ${Number(kills.toFixed(2))} zombi etkisiz · kalan ${Math.max(0, total - natural)}`;
    }
        function endDrag() { dragging = false; }
    canvas.addEventListener('pointerdown', e => {
        if (!running) return;
        dragging = true; moveTarget = null; dragClientX = e.clientX; dragStartX = x;
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    });
    canvas.addEventListener('pointermove', e => {
        if (!dragging) return;
        x = Math.max(MIN_X, Math.min(MAX_X, dragStartX + (e.clientX - dragClientX) / view.s));
    });
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('lostpointercapture', endDrag);
    window.addEventListener('keydown', e => {
        if (e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) return;
        const k = e.key.toLowerCase();
        if ((k === 'escape' || k === 'p') && !e.repeat) {
            if (running) { e.preventDefault(); pause(); } else if (paused) { e.preventDefault(); resume(); }
            return;
        }
        if (['arrowleft', 'arrowright', 'a', 'd'].includes(k)) { e.preventDefault(); moveTarget = null; keys.add(k); }
    });
    window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => keys.clear());
    $('base-toggle').addEventListener('click', () => { moveTarget = CENTER; toast('Birlik merkeze dönüyor.'); });
    $('weapon-btn').addEventListener('click', () => { moveTarget = WEAPON_X; toast('Birlik silah istasyonuna ilerliyor.'); });
    $('recruit-btn').addEventListener('click', () => { moveTarget = RECRUIT_X; toast('Birlik +1 istasyonuna ilerliyor.'); });
    function overlay(html, onPrimary) {
        $('result').innerHTML = `<div>${html}</div>`;
        $('result').classList.remove('hidden');
        const btn = $('again'); btn.onclick = onPrimary;
        try { btn.focus({ preventScroll: true }); } catch (_) {}
    }
    const homeLink = '<a class="home" href="../index.html">Ana sayfa</a>';
    function begin() {
        $('result').classList.add('hidden');
        running = true; paused = false; lastFrame = performance.now();
        clearTimeout(hintTimer); $('hint').classList.remove('faded');
        hintTimer = setTimeout(() => $('hint').classList.add('faded'), 9000);
        requestAnimationFrame(frame);
    }
    function pause() {
        if (!running) return;
        running = false; paused = true; keys.clear(); dragging = false;
        overlay(`<h2>Duraklatıldı</h2><p>${names[state.zone]} · ${Math.floor(kills)} zombi etkisiz. Devam etmek için Esc ya da P.</p><button type="button" id="again">Devam et</button>${homeLink}`, resume);
    }
    function resume() { if (paused) begin(); }
    function intro() {
        paused = true;
        overlay(`<h2>Son Hat <small>Beta</small></h2><p>Zombiler yolun sonundaki kırmızı çizgiye ulaşmadan onları durdur. Birliğin kendiliğinden ateş eder; sen yalnızca sağa sola kaydır.</p><ul><li><b>Silah istasyonu</b> · üstünde bekle, silahın güçlenir.</li><li><b>+1 kişi istasyonu</b> · üstünde bekle, birliğe asker katılır.</li><li><b>Geçit</b> · dalga bitince ortada dur; ganimetle geçidi açıp yeni sokağa geç.</li></ul><p class="keys">${touchFirst ? 'Parmağınla sürükle ya da kartlara dokun.' : 'A / D ya da ← → ile kay · Esc ile duraklat.'}</p><button type="button" id="again">${state.zone ? `${names[state.zone]} · devam et` : 'Başla'}</button>`, begin);
    }
    function startZone(index = state.zone, autoStart = true) {
        if (window.CasualCheats && CasualCheats.features()) { state.unlocked = 4; state.weapon = 4; }
        state.zone = index; waveDone = false; zombies = []; bullets = []; kills = 0; natural = 0; spawned = 0; total = 9 + index * 4;
        spawnTimer = .8; fireTimer = .1; weaponProgress = 0; recruitProgress = 0; gateHits = state.gateHits; gateTimer = 0; gateWarned = false; x = CENTER; y = 594; moveTarget = null; running = false;
        $('hint').textContent = HINT;
        save(); update();
        if (autoStart) begin(); else paint(false, false, false);
    }
    function finish(won) {
        if (!won && window.CasualCheats && CasualCheats.immortal()) return;
        if (!running) return; running = false; keys.clear(); dragging = false;
        if (!won) {
            overlay(`<h2>Hat düştü</h2><p>Bir zombi kırmızı çizgiyi geçti. Bu dalgada ${Math.floor(kills)} zombi etkisiz; silahın, birliğin ve ganimetin duruyor.</p><button type="button" id="again">Yeniden dene</button>${homeLink}`, () => startZone(state.zone)); sound(90, .2);
        } else {
            overlay(`<h2>Beş bölge temiz</h2><p>Hat tutuldu! Silahın, birliğin ve ganimetin korunuyor.</p><button type="button" id="again">Baştan oyna</button>${homeLink}`, () => startZone(0)); sound(660, .25);
        }
        save(); update(); if (typeof window.recordGameResult === 'function') { try { window.recordGameResult('Son Hat', { won, score: kills }); } catch (_) {} }
    }
    function project(depth, lane = 0) { const t = Math.max(0, Math.min(1, depth)); return { x: CENTER + lane * (38 + t * 450), y: 150 + t * 520, scale: .2 + t * 1.05 }; }
    function frame(time) {
        if (!running) return;
        const dt = Math.min(.05, (time - lastFrame) / 1000); lastFrame = time;
        const speed = 250 * dt;
        if (!dragging) {
            if (keys.has('arrowleft') || keys.has('a')) x -= speed;
            else if (keys.has('arrowright') || keys.has('d')) x += speed;
            else if (moveTarget !== null) {
                const delta = moveTarget - x;
                x += Math.sign(delta) * Math.min(Math.abs(delta), speed);
                if (Math.abs(moveTarget - x) < .1) moveTarget = null;
            }
        }
        x = Math.max(MIN_X, Math.min(MAX_X, x)); y = 594;
        if (!waveDone) {
            spawnTimer -= dt; fireTimer -= dt;
            if (spawnTimer <= 0 && spawned < total) {
                const n = spawned, type = n % 7 === 5 ? 'brute' : n % 3 === 1 ? 'runner' : 'walker';
                const hp = (type === 'brute' ? 7 : type === 'runner' ? 3 : 4) + state.zone * 2;
                zombies.push({ lane: (Math.random() - .5) * .12, depth: 0, hp, max: hp, type, speed: (type === 'runner' ? .13 : type === 'brute' ? .052 : .075) + state.zone * .005, phase: Math.random() * 6 });
                spawned++; spawnTimer = Math.max(.48, 1.1 - state.zone * .08);
            }
            if (fireTimer <= 0) {
                const shots = Math.min(state.soldiers, 5);
                for (let i = 0; i < shots; i++) bullets.push({ x: x + (i - (shots - 1) / 2) * 8, y: y - 48, life: 1.2, hit: new Set() });
                fireTimer = Math.max(.08, .22 - state.weapon * .02);
                if (time - lastShotSound > 650) { lastShotSound = time; sound(220 + state.weapon * 30, .015); }
            }
            zombies.forEach(z => { z.depth += z.speed * dt; z.phase += dt * 5; });
            bullets.forEach(b => {
                b.y -= 670 * dt; b.life -= dt;
                zombies.forEach(z => {
                    const p = project(z.depth, z.lane), half = 20 * p.scale + 9;
                    if (!b.hit.has(z) && z.hp > 0 && Math.abs(b.x - p.x) < half && b.y < p.y && b.y > p.y - 64 * p.scale) { z.hp -= 1 + state.weapon * .8; b.hit.add(z); }
                });
            });
            bullets = bullets.filter(b => b.life > 0 && b.y > 125);
            const dead = zombies.filter(z => z.hp <= 0);
            if (dead.length) {
                natural += dead.length; kills += dead.length;
                state.wood += dead.length * (1 + (state.zone > 1 ? 1 : 0)); state.iron += dead.length; state.coin += dead.length * (2 + state.zone);
                zombies = zombies.filter(z => z.hp > 0);
                save();
            }
            const leaker = zombies.find(z => z.depth >= RED_LINE);
            if (leaker) {
                if (window.CasualCheats && CasualCheats.immortal()) { leaker.depth = 0; leaker.hp = leaker.max; leaker.phase = 0; }
                else return finish(false);
            }
            if (spawned >= total && !zombies.length) {
                waveDone = true; gateTimer = 0;
                if (state.zone >= 4) return finish(true);
                toast('Yol temiz. Ortada kalıp geçidi aç.');
            }
        } else {
            fireTimer -= dt;
            if (fireTimer <= 0) {
                const shots = Math.min(state.soldiers, 5);
                for (let i = 0; i < shots; i++) bullets.push({ x: x + (i - (shots - 1) / 2) * 8, y: y - 48, life: 1.2 });
                fireTimer = Math.max(.08, .22 - state.weapon * .02);
            }
            bullets.forEach(b => { b.y -= 670 * dt; b.life -= dt; });
            bullets = bullets.filter(b => b.life > 0 && b.y > 125);
        }
        const weaponStation = Math.abs(x - WEAPON_X) < STATION_HALF, recruitStation = Math.abs(x - RECRUIT_X) < STATION_HALF, gateStation = waveDone && state.zone < 4 && Math.abs(x - CENTER) < GATE_HALF;
        if (weaponStation && state.weapon < 4) {
            const need = weaponNeed(); weaponProgress += dt;
            if (weaponProgress >= need) { weaponProgress = 0; state.weapon++; save(); toast(`${weapons[state.weapon]} hazır.`); sound(480, .12); }
        } else weaponProgress = Math.max(0, weaponProgress - dt * 1.5);
        if (recruitStation && state.soldiers < 12) {
            recruitProgress += dt;
            if (recruitProgress >= recruitNeed) { recruitProgress = 0; state.soldiers++; save(); toast('Birlik güçlendi: +1.'); sound(420, .1); }
        } else recruitProgress = Math.max(0, recruitProgress - dt * 1.5);
        if (gateStation) {
            const cost = gateCost();
            gateTimer += dt;
            while (gateTimer >= GATE_STEP && gateHits < GATE_HITS) {
                if (state.wood < cost.wood || state.iron < cost.iron || state.coin < cost.coin) { gateTimer = 0; if (!gateWarned) toast('Geçit vuruşu için ganimet yetmiyor.'); gateWarned = true; break; }
                state.wood -= cost.wood; state.iron -= cost.iron; state.coin -= cost.coin; gateHits++; state.gateHits = gateHits; gateTimer -= GATE_STEP; save(); sound(300 + gateHits * 26, .05);
            }
            if (gateHits >= GATE_HITS) { state.unlocked = Math.max(state.unlocked, state.zone + 1); state.wins++; state.gateHits = 0; save(); startZone(state.zone + 1); return; }
        } else { gateTimer = Math.max(0, gateTimer - dt * 2); gateWarned = false; }
        if (time - lastHud > 100) { update(); lastHud = time; }
        paint(weaponStation, recruitStation, gateStation); requestAnimationFrame(frame);
    }
    function polygon(points, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); points.slice(1).forEach(p => ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.fill(); }
    function station(xx, label, active, ratio, sub) {
        ctx.fillStyle = active ? 'rgba(255,218,94,.55)' : 'rgba(78,91,63,.88)'; ctx.fillRect(xx - 66, 548, 132, 72);
        ctx.strokeStyle = active ? '#fff2a5' : '#d7de6a'; ctx.lineWidth = 4; ctx.strokeRect(xx - 66, 548, 132, 72);
        ctx.fillStyle = '#fff'; ctx.font = '700 18px Outfit, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, xx, 578);
        ctx.font = '600 14px Outfit, sans-serif'; ctx.fillText(sub, xx, 598);
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(xx - 56, 604, 112, 8);
        ctx.fillStyle = active ? '#ffe98a' : '#8d9a6a'; ctx.fillRect(xx - 56, 604, 112 * Math.max(0, Math.min(1, ratio)), 8);
    }
    function paint(weaponActive, recruitActive, gateActive) {
        ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
        ctx.fillStyle = '#c9e9f4'; ctx.fillRect(0, 0, view.w, view.h);
        ctx.setTransform(view.dpr * view.s, 0, 0, view.dpr * view.s, view.dpr * view.ox, view.dpr * view.oy);
        ctx.fillStyle = '#ffe6a6'; ctx.beginPath(); ctx.arc(1080, 82, 38, 0, Math.PI * 2); ctx.fill();
        for (let s = 0; s < 2; s++) for (let i = -8; i < 6; i++) { const x0 = s ? 875 + (5 - i) * 69 : 14 + i * 70, top = Math.max(0, i) * 7; ctx.fillStyle = ['#d8c5a8', '#becfd0', '#e2b7a8', '#c7d1b4'][i % 4]; ctx.fillRect(x0, 48 + top, 62, 160 - top); ctx.fillStyle = '#64828a'; for (let yy = 64 + top; yy < 178; yy += 31) for (let xx = x0 + 9; xx < x0 + 55; xx += 23) ctx.fillRect(xx, yy, 12, 15); }
        polygon([[-1400, 290], [0, 210], [486, 150], [201, 1100], [-1400, 1100]], '#aaa18a'); polygon([[2680, 290], [1280, 210], [794, 150], [1079, 1100], [2680, 1100]], '#aaa18a');
        polygon([[201, 1100], [486, 150], [794, 150], [1079, 1100]], '#545b5b');
        polygon([[-1400, 302], [0, 222], [486, 150], [500, 167], [0, 267], [-1400, 347]], '#cbc5b3'); polygon([[2680, 302], [1280, 222], [794, 150], [780, 167], [1280, 267], [2680, 347]], '#cbc5b3');
        ctx.strokeStyle = '#f3dfa0'; ctx.lineWidth = 3; for (let i = 0; i < 8; i++) { const t = i / 8, yy = 190 + t * t * 500; ctx.beginPath(); ctx.moveTo(CENTER - 3 - t * 14, yy); ctx.lineTo(CENTER + 3 + t * 14, yy); ctx.stroke(); }
        for (let i = 0; i < 3; i++) { const t = .2 + i * .29, yy = 160 + t * 450, side = i % 2 ? -1 : 1, lx = CENTER + side * (190 + t * 140); ctx.strokeStyle = '#46524a'; ctx.lineWidth = 4 + t * 3; ctx.beginPath(); ctx.moveTo(lx, yy); ctx.lineTo(lx, yy - 56 * t); ctx.stroke(); ctx.fillStyle = '#f5df9b'; ctx.beginPath(); ctx.arc(lx, yy - 58 * t, 5 * t + 2, 0, Math.PI * 2); ctx.fill(); }
        for (let i = 0; i < 2; i++) { const yy = 285 + i * 100, xx = 545 + i * 142; ctx.fillStyle = i ? '#b75c43' : '#d7d5c7'; ctx.fillRect(xx, yy, 48, 20); ctx.fillStyle = '#313f40'; ctx.fillRect(xx + 7, yy - 9, 33, 12); ctx.fillStyle = '#d8ebdd'; ctx.fillRect(xx + 10, yy - 7, 10, 7); ctx.fillRect(xx + 27, yy - 7, 9, 7); }
        const danger = waveDone ? 0 : Math.max(0, ...zombies.map(z => (z.depth - .72) / (RED_LINE - .72)));
        if (danger > 0) { ctx.fillStyle = `rgba(233,78,75,${.16 + danger * .3})`; ctx.fillRect(315, 560, 650, 92); }
        if (waveDone && state.zone < 4) {
            const cost = gateCost();
            ctx.fillStyle = gateActive ? 'rgba(255,218,94,.55)' : '#8b633d'; ctx.fillRect(520, 486, 240, 60);
            ctx.strokeStyle = '#efd59a'; ctx.lineWidth = 4; ctx.strokeRect(520, 486, 240, 60);
            ctx.fillStyle = '#fff'; ctx.font = '700 15px Outfit, sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(`GEÇİT ${gateHits}/${GATE_HITS} · vuruş: ${cost.wood} tahta ${cost.iron} demir ${cost.coin} para`, 640, 506);
            for (let i = 0; i < GATE_HITS; i++) { ctx.fillStyle = i < gateHits ? '#ffe98a' : 'rgba(0,0,0,.3)'; ctx.fillRect(528 + i * 29, 516, 23, 14); }
            ctx.font = '600 12px Outfit, sans-serif'; ctx.fillText('açmak için ortada dur', 640, 543);
        }
        station(WEAPON_X, 'SİLAH', weaponActive, state.weapon >= 4 ? 1 : weaponProgress / weaponNeed(), state.weapon >= 4 ? 'Tamam' : `${Math.floor(weaponProgress)}/${weaponNeed()} sn`);
        station(RECRUIT_X, '+1 KİŞİ', recruitActive, state.soldiers >= 12 ? 1 : recruitProgress / recruitNeed, state.soldiers >= 12 ? 'Dolu' : `${Math.floor(recruitProgress)}/${recruitNeed} sn`);
        ctx.strokeStyle = '#e94e4b'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(370, 636); ctx.lineTo(910, 636); ctx.stroke();
        if (danger > 0) { ctx.strokeStyle = `rgba(255,120,110,${danger})`; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(370, 636); ctx.lineTo(910, 636); ctx.stroke(); }
        ctx.save(); ctx.globalAlpha = .18; ctx.strokeStyle = '#fff6c9'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 52); ctx.lineTo(x, 150); ctx.stroke(); ctx.restore();
        zombies.slice().sort((a, b) => a.depth - b.depth).forEach(drawZombie);
        bullets.forEach(b => { ctx.fillStyle = '#ffe77c'; ctx.shadowColor = '#fff0a0'; ctx.shadowBlur = 12; ctx.fillRect(b.x - 2, b.y - 11, 4, 13); ctx.shadowBlur = 0; });
        drawSquad();
    }
    function drawZombie(z) {
        const p = project(z.depth, z.lane), s = p.scale * (z.type === 'brute' ? 1.35 : z.type === 'runner' ? .86 : 1);
        ctx.save(); ctx.translate(p.x, p.y + Math.sin(z.phase) * 2);
        if (z.depth > .72) { ctx.fillStyle = `rgba(233,78,75,${Math.min(.45, (z.depth - .72) * 1.4)})`; ctx.beginPath(); ctx.ellipse(0, -22 * s, 20 * s, 42 * s, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = z.type === 'brute' ? '#536842' : z.type === 'runner' ? '#78975b' : '#66834f'; ctx.fillRect(-11 * s, -38 * s, 22 * s, 29 * s);
        ctx.fillStyle = '#819765'; ctx.beginPath(); ctx.arc(0, -47 * s, 9 * s, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3b493a'; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(-6 * s, -12 * s); ctx.lineTo(-10 * s, 0); ctx.moveTo(6 * s, -12 * s); ctx.lineTo(11 * s, 0); ctx.stroke();
        ctx.fillStyle = '#222'; ctx.fillRect(-14 * s, -62 * s, 28 * s, 4 * s); ctx.fillStyle = '#50df71'; ctx.fillRect(-13 * s, -61 * s, 26 * s * Math.max(0, z.hp / z.max), 2 * s);
        ctx.restore();
    }
    function drawSquad() {
        const n = Math.min(state.soldiers, 8), cols = Math.min(4, n);
        ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, y + 16, 18 + n * 4, 10, 0, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < n; i++) {
            const col = i % cols, row = Math.floor(i / cols), px = x + (col - (cols - 1) / 2) * 16, py = y + row * 10;
            ctx.strokeStyle = '#243028'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(px - 5, py - 6); ctx.lineTo(px - 7, py + 10); ctx.moveTo(px + 5, py - 6); ctx.lineTo(px + 7, py + 10); ctx.stroke();
            ctx.fillStyle = '#4f6a40'; ctx.fillRect(px - 7, py - 22, 14, 18);
            ctx.fillStyle = '#e4c5a2'; ctx.beginPath(); ctx.arc(px, py - 28, 6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#3c4e34'; ctx.fillRect(px - 7, py - 34, 14, 5);
            ctx.fillStyle = '#1e2624'; ctx.fillRect(px + 2, py - 46, 3, 22);
        }
        ctx.fillStyle = '#ffe98a'; ctx.shadowColor = '#fff1a8'; ctx.shadowBlur = 16; ctx.beginPath(); ctx.moveTo(x, y - 62); ctx.lineTo(x - 7, y - 48); ctx.lineTo(x + 7, y - 48); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    }
    window.addEventListener('casual-cheat-set', (event) => { kills = event.detail.n; update(); });
    setInterval(() => {
        if (!running || !window.CasualCheats) return;
        const plus = CasualCheats.tick();
        if (!plus) return;
        kills = Number((kills + plus).toFixed(3));
        update();
    }, 1000);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    resize(); startZone(Math.min(state.zone, state.unlocked), false); intro();
})();
