(() => {
    'use strict';
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const scoreLabel = document.getElementById('score');
    const bestLabel = document.getElementById('best');
    const status = document.getElementById('status');
    const startButton = document.getElementById('start');
    const pauseButton = document.getElementById('pause');
    const ground = 258;
    const dino = { x: 80, y: ground - 48, w: 42, h: 48, vy: 0 };
    let state = 'ready';
    let runCheated = false;
    let distance = 0;
    let elapsed = 0;
    let spawnIn = 1.8;
    let obstacles = [];
    let lastTime = null;
    let frameId = null;
    let best = getHighScore('Dino');
    bestLabel.textContent = best;

    function draw() {
        const style = getComputedStyle(document.body);
        const ink = style.getPropertyValue('--cp-text').trim();
        const accent = style.getPropertyValue('--cp-accent').trim();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = ink;
        ctx.globalAlpha = .12;
        for (let i = 0; i < 5; i++) {
            const x = ((i * 230 - distance * .15) % 1150 + 1150) % 1150 - 100;
            ctx.fillRect(x, 65 + i % 3 * 25, 64, 9);
            ctx.fillRect(x + 16, 55 + i % 3 * 25, 30, 10);
        }
        ctx.globalAlpha = .35;
        ctx.fillRect(0, ground, 900, 2);
        for (let i = 0; i < 20; i++) {
            ctx.fillRect(((i * 53 - distance) % 1060 + 1060) % 1060, ground + 15 + i % 3 * 8, 12, 2);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = accent;
        const { x, y } = dino;
        ctx.fillRect(x + 18, y, 24, 21);
        ctx.fillRect(x + 8, y + 17, 25, 22);
        ctx.fillRect(x, y + 13, 10, 19);
        ctx.fillRect(x + 29, y + 27, 12, 5);
        const stride = state === 'running' && dino.y >= ground - dino.h ? Math.floor(elapsed * 12) % 2 * 6 : 0;
        ctx.fillRect(x + 10, y + 36, 8, 12 - stride);
        ctx.fillRect(x + 25, y + 36, 8, 6 + stride);
        ctx.fillStyle = style.getPropertyValue('--cp-bg').trim();
        ctx.fillRect(x + 32, y + 5, 4, 4);
        ctx.fillStyle = ink;
        for (const obstacle of obstacles) {
            ctx.fillRect(obstacle.x + 9, obstacle.y, obstacle.w - 18, obstacle.h);
            ctx.fillRect(obstacle.x, obstacle.y + 13, 7, 21);
            ctx.fillRect(obstacle.x, obstacle.y + 28, obstacle.w, 7);
            ctx.fillRect(obstacle.x + obstacle.w - 7, obstacle.y + 7, 7, 27);
        }
    }

    function finish() {
        if (state !== 'running') return;
        state = 'over';
        const score = Math.floor(distance / 10);
        const cheating = runCheated || Boolean(window.CasualCheats?.active());
        if (!cheating) recordGameResult('Dino', { won: false, score });
        const reward = cheating ? 0 : CasualProfile.awardDinoRun({ score }).reward;
        const note = cheating ? 'Hileli koşuda CM ve rekor kaydedilmez.' : !CasualProfile.current() ? 'CM kazanmak için koşudan önce oturum aç.' : `+${CasualProfile.formatMoney(reward)} CM kazandın.`;
        if (!cheating) best = Math.max(best, score);
        bestLabel.textContent = best;
        status.textContent = `Oyun bitti! Skorun: ${score}. ${note} Tekrar oynamak için Başla veya Boşluk tuşuna bas.`;
        startButton.textContent = 'Tekrar oyna';
        startButton.disabled = false;
        pauseButton.disabled = true;
        renderWallet();
    }

    function update(dt) {
        elapsed += dt;
        const speed = Math.min(580, 300 + elapsed * 5);
        distance += speed * dt;
        dino.vy += 1800 * dt;
        dino.y = Math.min(ground - dino.h, dino.y + dino.vy * dt);
        if (dino.y >= ground - dino.h) dino.vy = 0;
        spawnIn -= dt;
        if (spawnIn <= 0) {
            const h = 34 + Math.random() * 18;
            obstacles.push({ x: 930, y: ground - h, w: 30 + Math.random() * 12, h });
            // At maximum speed, allow landing and another jump between obstacles.
            spawnIn = 1.25 + Math.random() * .65;
        }
        for (const obstacle of obstacles) {
            obstacle.x -= speed * dt;
            if (dino.x + 6 < obstacle.x + obstacle.w - 3 && dino.x + dino.w - 4 > obstacle.x + 3 &&
                dino.y + dino.h - 3 > obstacle.y + 3 && dino.y + 4 < ground) {
                finish();
                break;
            }
        }
        obstacles = obstacles.filter(obstacle => obstacle.x + obstacle.w > 0);
        scoreLabel.textContent = Math.floor(distance / 10);
    }

    function frame(time) {
        frameId = null;
        if (state !== 'running') return;
        let dt = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, .05);
        lastTime = time;
        // Small physics steps keep collision and jump behaviour consistent across frame rates.
        while (dt > 0 && state === 'running') {
            const step = Math.min(dt, 1 / 120);
            update(step);
            dt -= step;
        }
        draw();
        if (state === 'running') frameId = requestAnimationFrame(frame);
    }

    function start() {
        if (state === 'running' || state === 'paused') return;
        runCheated = Boolean(window.CasualCheats?.active());
        distance = 0;
        elapsed = 0;
        spawnIn = 1.8;
        obstacles = [];
        dino.y = ground - dino.h;
        dino.vy = 0;
        lastTime = null;
        state = 'running';
        renderWallet();
        scoreLabel.textContent = '0';
        startButton.disabled = true;
        pauseButton.disabled = false;
        pauseButton.textContent = 'Duraklat';
        status.textContent = 'Kaktüslere dikkat! Boşluk, ↑ veya dokunarak zıpla.';
        canvas.focus({ preventScroll: true });
        frameId = requestAnimationFrame(frame);
    }

    function jump() {
        if (state === 'ready' || state === 'over') start();
        if (state === 'running' && dino.y >= ground - dino.h) dino.vy = -680;
    }

    function togglePause() {
        if (state !== 'running' && state !== 'paused') return;
        if (state === 'running') {
            state = 'paused';
            cancelAnimationFrame(frameId);
            frameId = null;
            pauseButton.textContent = 'Devam et';
            status.textContent = 'Duraklatıldı. Devam et düğmesi veya P ile koşuya dön.';
        } else {
            state = 'running';
            lastTime = null;
            pauseButton.textContent = 'Duraklat';
            status.textContent = 'Koşu devam ediyor. Kaktüslerin üzerinden zıpla!';
            frameId = requestAnimationFrame(frame);
        }
        draw();
    }

    function renderWallet() {
        const profile = CasualProfile.current();
        document.getElementById('balance').textContent = `${CasualProfile.formatMoney(profile?.balance || 0)} CM`;
        const session = document.getElementById('session');
        session.textContent = profile ? `@${profile.displayName}` : 'Oturumu başlat';
        session.disabled = Boolean(profile) || state === 'running' || state === 'paused';
    }
    document.getElementById('session').addEventListener('click', () => {
        const result = CasualProfile.startSession();
        renderWallet();
        status.textContent = result.granted ? `Oturum açıldı. +${result.reward} CM oturum ödülü!` : 'Oturum açık. Koşuya hazırsın!';
    });
    window.addEventListener('casualprofilechange', renderWallet);
    window.addEventListener('casual-cheat', () => {
        if (state === 'running' || state === 'paused') runCheated = runCheated || Boolean(window.CasualCheats?.active());
    });
    renderWallet();
    startButton.addEventListener('click', start);
    document.getElementById('jump').addEventListener('click', jump);
    canvas.addEventListener('pointerdown', event => { if (event.button === 0) jump(); });
    pauseButton.addEventListener('click', togglePause);
    document.addEventListener('keydown', event => {
        if (event.target.closest('button, a, input, select, textarea') || event.ctrlKey || event.metaKey || event.altKey) return;
        if (['Space', 'ArrowUp', 'KeyP'].includes(event.code)) {
            event.preventDefault();
            if (!event.repeat) event.code === 'KeyP' ? togglePause() : jump();
        }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'running') togglePause(); });
    window.addEventListener('blur', () => { if (state === 'running') togglePause(); });
    new MutationObserver(draw).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    draw();
})();
