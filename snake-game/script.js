document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const canvas = $("game-canv");
    const ctx = canvas.getContext("2d");
    const scoreElem = $("score");
    const highScoreElem = $("high-score");
    const overlay = $("game-over-overlay");
    const overlayTitle = $("game-over-title");
    const finalScoreElem = $("final-score");
    const finalBestElem = $("final-best");
    const newRecordElem = $("new-record");
    const restartBtn = $("restart-btn");
    const startHint = $("start-hint");
    const pauseOverlay = $("pause-overlay");
    const resumeBtn = $("resume-btn");
    const pauseMenuBtn = $("pause-menu-btn");
    const pauseBtn = $("pause-btn");
    const gameActions = $("game-actions");
    const mobileControls = $("mobile-controls");
    const modeChip = $("mode-chip");
    const srStatus = $("sr-status");

    // Config Elements
    const configMenu = $("config-menu");
    const boardWrapper = $("board-wrapper");
    const startGameBtn = $("start-game-btn");
    const backToMenuBtn = $("back-to-menu-btn");
    const gridSizeInput = $("grid-size");
    const gridValText = $("grid-val");
    const speedInput = $("speed-val");
    const speedValText = $("speed-display");
    const wallDeathToggle = $("wall-death");
    const showPadToggle = $("show-pad");
    const presetBtns = document.querySelectorAll(".preset-btn");
    const modeBtns = document.querySelectorAll(".mode-btn");

    // Game logic runs on a fixed 400x400 board; the backing store is scaled for crisp pixels.
    const BOARD = 400;
    const SETTINGS_COOKIE = 'cp_snake_settings';
    const HIGH_COOKIE = 'cp_snake_highscore';
    const APPLE_POINTS = 10;
    const GOLD_POINTS = 50;
    const COMBO_STEP_POINTS = 5;
    const COMBO_MAX = 5;
    const GOLD_EVERY = 5;          // a golden apple appears after every fifth apple
    const GOLD_LIFE_MS = 6000;
    const reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

    const MODES = {
        classic: { name: 'Klasik' },
        rush: { name: 'Hızlanan' },
        maze: { name: 'Engelli' }
    };

    // Settings
    let tileCount = 20;
    let cell = BOARD / tileCount;
    let baseFps = 12;
    let fps = 12;
    let wallDeath = true;
    let mode = 'classic';

    // Game state
    let snake = [];
    let prevSnake = [];
    let velocity = { x: 0, y: 0 };
    // Turns pressed between two ticks wait here so quick double turns never reverse into the body.
    let dirQueue = [];
    let food = { x: 15, y: 15, born: 0 };
    let bonus = null;              // { x, y, life, born }
    let obstacles = new Set();
    let obstacleList = [];
    let tail = 3;
    let score = 0;
    let highScore = Number(getCookieValue(HIGH_COOKIE)) || 0;
    let isGameOver = false;
    let gameStarted = false;
    let paused = false;
    let eaten = 0;
    let combo = 0;
    let comboLeft = 0;             // steps left to keep the combo going
    let comboWindow = 30;
    let bestCombo = 1;
    let playMs = 0;
    let acc = 0;
    let clock = 0;                 // ms since page load, drives idle animations
    let lastFrame = 0;
    let rafId = 0;
    let overlayTimer = 0;
    let deathAt = 0;
    let shakeLeft = 0;
    let flashLeft = 0;
    let particles = [];
    let floaters = [];
    let colors = {};
    let bgCache = null;
    let retro = false;

    highScoreElem.textContent = highScore;

    /* ── helpers ─────────────────────────────────── */

    function cheatImmortal() {
        const cheats = window.CasualCheats;
        return Boolean(cheats && typeof cheats.immortal === 'function' && cheats.immortal());
    }

    function cheatPlus() {
        const cheats = window.CasualCheats;
        return Number(cheats && typeof cheats.plus === 'function' ? cheats.plus() : 0) > 0;
    }

    function effectsOn() {
        return typeof cpSettings === 'undefined' || cpSettings.effects !== false;
    }

    function calm() {
        return reducedMotion.matches || !effectsOn();
    }

    const key = (x, y) => x * 64 + y;

    function announce(text) {
        srStatus.textContent = '';
        // A fresh text node makes screen readers read the same message twice in a row.
        setTimeout(() => { srStatus.textContent = text; }, 30);
    }

    // Turns any CSS colour into [r, g, b] by letting the canvas parse it.
    const parseCtx = document.createElement('canvas').getContext('2d');
    function rgb(color) {
        parseCtx.fillStyle = '#000';
        parseCtx.fillStyle = color;
        const value = parseCtx.fillStyle;
        if (value[0] === '#') {
            return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
        }
        const nums = value.match(/[\d.]+/g) || [0, 0, 0];
        return nums.slice(0, 3).map(Number);
    }

    function mix(a, b, t) {
        return a.map((v, i) => Math.round(v + (b[i] - v) * t));
    }

    const css = (c, alpha = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;

    // Snake colours follow the active CasualPass theme through its CSS variables.
    function readColors() {
        const style = getComputedStyle(document.body);
        const pick = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
        const theme = ['paper', 'neon', 'retro'].find((t) => document.body.classList.contains(`theme-${t}`)) || 'liquid';
        retro = theme === 'retro';
        const accent = rgb(pick('--cp-accent', '#00ffcc'));
        const palettes = {
            liquid: { base: 'rgba(5, 8, 18, 0.55)', tileA: 'rgba(255,255,255,0.035)', tileB: 'rgba(255,255,255,0.0)', head: accent, tailMix: [10, 40, 60], rock: [92, 104, 132], text: '#ffffff' },
            paper: { base: '#fbfaf6', tileA: 'rgba(44,62,80,0.045)', tileB: 'rgba(44,62,80,0.0)', head: [39, 174, 96], tailMix: [180, 230, 190], rock: [127, 140, 141], text: '#2c3e50' },
            neon: { base: 'rgba(0, 0, 0, 0.7)', tileA: 'rgba(0,242,254,0.05)', tileB: 'rgba(0,0,0,0)', head: accent, tailMix: [120, 0, 200], rock: [254, 0, 161], text: '#f8fafc' },
            retro: { base: '#1a1c2c', tileA: 'rgba(148,176,194,0.07)', tileB: 'rgba(0,0,0,0)', head: rgb(pick('--cp-x-color', '#38b764')), tailMix: [37, 113, 121], rock: [86, 108, 134], text: '#f4f4f4' }
        };
        const p = palettes[theme];
        colors = {
            theme,
            base: p.base,
            tileA: p.tileA,
            tileB: p.tileB,
            head: p.head,
            tail: mix(p.head, p.tailMix, 0.55),
            food: rgb(pick('--cp-o-color', '#ff00cc')),
            gold: [255, 200, 40],
            rock: p.rock,
            text: p.text,
            eyeWhite: '#ffffff',
            pupil: '#10131c',
            glow: theme === 'neon' || theme === 'liquid'
        };
        if (theme === 'paper') colors.food = [231, 76, 60];
        bgCache = null;
    }

    /* ── sizing ──────────────────────────────────── */

    function resizeCanvas() {
        const cssSize = canvas.clientWidth;
        if (!cssSize) return;
        const backing = Math.round(cssSize * Math.min(window.devicePixelRatio || 1, 3));
        if (canvas.width !== backing) {
            canvas.width = backing;
            canvas.height = backing;
            bgCache = null;
        }
        render();
    }

    // The checkerboard and the rocks never move, so they are drawn once per size/theme/game.
    function buildBackground() {
        const size = canvas.width;
        const off = document.createElement('canvas');
        off.width = size;
        off.height = size;
        const g = off.getContext('2d');
        const s = size / BOARD;
        g.setTransform(s, 0, 0, s, 0, 0);
        g.fillStyle = colors.base;
        g.fillRect(0, 0, BOARD, BOARD);
        g.fillStyle = colors.tileA;
        for (let x = 0; x < tileCount; x++) {
            for (let y = 0; y < tileCount; y++) {
                if ((x + y) % 2 === 0) g.fillRect(x * cell, y * cell, cell, cell);
            }
        }
        obstacleList.forEach(({ x, y }) => drawRock(g, x, y));
        bgCache = off;
    }

    function drawRock(g, x, y) {
        const px = x * cell;
        const py = y * cell;
        const pad = cell * 0.06;
        const rock = colors.rock;
        if (retro) {
            g.fillStyle = css(mix(rock, [0, 0, 0], 0.35));
            g.fillRect(px + pad, py + pad, cell - pad * 2, cell - pad * 2);
            g.fillStyle = css(rock);
            g.fillRect(px + pad, py + pad, cell - pad * 2, cell * 0.55);
            return;
        }
        const r = cell * 0.22;
        const w = cell - pad * 2;
        const grad = g.createLinearGradient(px, py, px, py + cell);
        grad.addColorStop(0, css(mix(rock, [255, 255, 255], 0.25)));
        grad.addColorStop(1, css(mix(rock, [0, 0, 0], 0.35)));
        g.fillStyle = grad;
        g.beginPath();
        roundRect(g, px + pad, py + pad, w, w, r);
        g.fill();
        if (colors.theme === 'neon') {
            g.strokeStyle = css(rock, 0.9);
            g.lineWidth = Math.max(1, cell * 0.06);
            g.stroke();
        }
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.beginPath();
        g.ellipse(px + cell * 0.36, py + cell * 0.3, cell * 0.16, cell * 0.08, -0.5, 0, Math.PI * 2);
        g.fill();
    }

    function roundRect(g, x, y, w, h, r) {
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
    }

    /* ── game setup ──────────────────────────────── */

    function setPlaying(on) {
        configMenu.classList.toggle("hidden", on);
        boardWrapper.classList.toggle("hidden", !on);
        gameActions.classList.toggle("hidden", !on);
        modeChip.classList.toggle("hidden", !on);
        mobileControls.classList.toggle("hidden", !on || !showPadToggle.checked);
        document.body.classList.toggle("is-playing", on);
        document.body.classList.toggle("no-pad", !showPadToggle.checked);
        if (on) startFrames(); else stopFrames();
    }

    // Rocks: short pieces away from the start cross, never closing off a cell or a corridor.
    function buildObstacles() {
        obstacles = new Set();
        obstacleList = [];
        if (mode !== 'maze') return;
        const c = Math.floor(tileCount / 2);
        const target = Math.round(tileCount * tileCount * 0.035);
        for (let attempt = 0; attempt < 60; attempt++) {
            const set = new Set();
            const list = [];
            let guard = 0;
            while (list.length < target && guard++ < 500) {
                const len = 1 + Math.floor(Math.random() * 3);
                const horizontal = Math.random() < 0.5;
                const sx = Math.floor(Math.random() * tileCount);
                const sy = Math.floor(Math.random() * tileCount);
                const piece = [];
                for (let i = 0; i < len; i++) {
                    const x = sx + (horizontal ? i : 0);
                    const y = sy + (horizontal ? 0 : i);
                    if (x >= tileCount || y >= tileCount) break;
                    // Keep the start area and its four straight lanes clear.
                    if (Math.abs(x - c) <= 2 && Math.abs(y - c) <= 2) break;
                    if ((x === c && Math.abs(y - c) <= 5) || (y === c && Math.abs(x - c) <= 5)) break;
                    piece.push({ x, y });
                }
                if (!piece.length) continue;
                // Rocks never touch each other, so no pocket can form between two pieces.
                const touches = piece.some(({ x, y }) => {
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            if (set.has(key(x + dx, y + dy)) && !piece.some((p) => p.x === x + dx && p.y === y + dy)) return true;
                        }
                    }
                    return false;
                });
                if (touches) continue;
                piece.forEach((p) => { set.add(key(p.x, p.y)); list.push(p); });
            }
            if (layoutOk(set)) {
                obstacles = set;
                obstacleList = list;
                return;
            }
        }
    }

    // Every free cell must be reachable and have two open sides, so the board has no dead ends.
    function layoutOk(set) {
        const open = (x, y) => x >= 0 && y >= 0 && x < tileCount && y < tileCount && !set.has(key(x, y));
        let free = 0;
        for (let x = 0; x < tileCount; x++) {
            for (let y = 0; y < tileCount; y++) {
                if (!open(x, y)) continue;
                free++;
                const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => open(x + dx, y + dy)).length;
                if (sides < 2) return false;
            }
        }
        const c = Math.floor(tileCount / 2);
        const seen = new Set([key(c, c)]);
        const stack = [[c, c]];
        while (stack.length) {
            const [x, y] = stack.pop();
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
                const nx = x + dx;
                const ny = y + dy;
                if (open(nx, ny) && !seen.has(key(nx, ny))) {
                    seen.add(key(nx, ny));
                    stack.push([nx, ny]);
                }
            });
        }
        return seen.size === free;
    }

    function initGame() {
        clearTimeout(overlayTimer);
        tileCount = parseInt(gridSizeInput.value, 10);
        cell = BOARD / tileCount;
        baseFps = parseInt(speedInput.value, 10);
        fps = baseFps;
        wallDeath = wallDeathToggle.checked;
        boardWrapper.classList.toggle("wrap-walls", !wallDeath);
        boardWrapper.classList.remove("is-dead");

        const c = Math.floor(tileCount / 2);
        snake = [{ x: c, y: c }];
        prevSnake = snake.map((s) => ({ ...s }));
        tail = 3;
        score = 0;
        eaten = 0;
        combo = 0;
        comboLeft = 0;
        bestCombo = 1;
        comboWindow = Math.round(tileCount * 1.6);
        playMs = 0;
        acc = 0;
        velocity = { x: 0, y: 0 };
        dirQueue = [];
        bonus = null;
        particles = [];
        floaters = [];
        shakeLeft = 0;
        flashLeft = 0;
        deathAt = 0;
        scoreElem.textContent = score;
        isGameOver = false;
        gameStarted = false;
        paused = false;
        overlayTitle.textContent = "Oyun Bitti";
        overlay.classList.add("hidden");
        pauseOverlay.classList.add("hidden");
        startHint.classList.remove("hidden");
        pauseBtn.disabled = true;
        updatePauseButton();
        updateModeChip();

        readColors();
        buildObstacles();
        spawnFood();
        resizeCanvas();
    }

    function updateModeChip() {
        const speed = mode === 'rush' ? ` · ${Math.round(fps * 10) / 10} adım/sn` : '';
        modeChip.textContent = `${MODES[mode].name} · ${tileCount}x${tileCount}${speed}${wallDeath ? '' : ' · duvarsız'}`;
    }

    /* ── simulation ──────────────────────────────── */

    function running() {
        return gameStarted && !paused && !isGameOver;
    }

    function tick() {
        prevSnake = snake.map((s) => ({ x: s.x, y: s.y }));
        if (dirQueue.length) velocity = dirQueue.shift();

        let headX = snake[0].x + velocity.x;
        let headY = snake[0].y + velocity.y;

        // Boundary wrap or death
        if (headX < 0 || headX > tileCount - 1 || headY < 0 || headY > tileCount - 1) {
            if (wallDeath && !cheatImmortal()) {
                finish(false, 'Duvara çarptın');
                return;
            }
            headX = (headX + tileCount) % tileCount;
            headY = (headY + tileCount) % tileCount;
        }

        if (obstacles.has(key(headX, headY)) && !cheatImmortal()) {
            finish(false, 'Kayaya çarptın');
            return;
        }

        const eatingApple = headX === food.x && headY === food.y;
        const eatingGold = Boolean(bonus && headX === bonus.x && headY === bonus.y);
        const grows = eatingApple || eatingGold;
        // The tail cell frees up on this tick, so it is only solid when the snake grows.
        const solidCount = grows ? snake.length : snake.length - 1;
        // Immortal mode never ends the run, not even while the snake is growing.
        if (!cheatImmortal()) {
            for (let i = 0; i < solidCount; i++) {
                if (snake[i].x === headX && snake[i].y === headY) {
                    finish(false, 'Kendine çarptın');
                    return;
                }
            }
        }

        snake.unshift({ x: headX, y: headY });
        if (comboLeft > 0) comboLeft -= 1;
        const limit = tileCount * tileCount - obstacles.size - (cheatImmortal() ? 1 : 0);

        if (eatingApple || eatingGold) {
            combo = comboLeft > 0 ? Math.min(COMBO_MAX, combo + 1) : 1;
            comboLeft = comboWindow;
            bestCombo = Math.max(bestCombo, combo);
            const gain = (eatingGold ? GOLD_POINTS : APPLE_POINTS) + COMBO_STEP_POINTS * (combo - 1);
            score += gain;
            scoreElem.textContent = score;
            tail = Math.min(limit, tail + 1);
            const at = eatingGold ? bonus : food;
            burst(at.x, at.y, eatingGold ? colors.gold : colors.food, eatingGold ? 26 : 14);
            floatText(at.x, at.y, `+${gain}`, eatingGold ? colors.gold : colors.head);
            if (combo >= 2) floatText(at.x, at.y - 0.9, `Kombo x${combo}`, [255, 255, 255], 0.75);
            playEatSound();

            if (eatingGold) {
                bonus = null;
            } else {
                eaten += 1;
                if (mode === 'rush') {
                    fps = Math.min(baseFps * 1.8, baseFps + eaten * 0.3, 32);
                    updateModeChip();
                }
                if (!spawnFood()) {
                    if (!cheatImmortal()) {
                        finish(true);
                        return;
                    }
                    snake.pop();
                    spawnFood();
                }
                if (eaten % GOLD_EVERY === 0 && !bonus) spawnBonus();
            }
        } else if (!cheatPlus()) {
            while (snake.length > tail) snake.pop();
        } else {
            tail = Math.min(limit, tail + 1);
            while (snake.length > tail) snake.pop();
        }
        if (comboLeft === 0 && combo > 0) combo = 0;
    }

    function freeCells(extraTaken) {
        const taken = new Set(snake.map((s) => key(s.x, s.y)));
        obstacles.forEach((k) => taken.add(k));
        (extraTaken || []).forEach((p) => p && taken.add(key(p.x, p.y)));
        const free = [];
        for (let x = 0; x < tileCount; x++) {
            for (let y = 0; y < tileCount; y++) {
                if (!taken.has(key(x, y))) free.push({ x, y });
            }
        }
        return free;
    }

    // Spawn an apple on a random free cell. Returns false only when the board is full.
    function spawnFood() {
        const free = freeCells([bonus]);
        if (!free.length) return false;
        const spot = free[Math.floor(Math.random() * free.length)];
        food = { x: spot.x, y: spot.y, born: clock };
        return true;
    }

    function spawnBonus() {
        const head = snake[0];
        // A golden apple right next to the head would be a free gift; keep it a few steps away.
        const free = freeCells([food]).filter((p) => Math.abs(p.x - head.x) + Math.abs(p.y - head.y) >= 4);
        if (!free.length) return;
        const spot = free[Math.floor(Math.random() * free.length)];
        const reach = (Math.abs(spot.x - head.x) + Math.abs(spot.y - head.y)) * (1000 / fps);
        bonus = { x: spot.x, y: spot.y, life: Math.max(GOLD_LIFE_MS, reach + 2500), born: clock };
        bonus.max = bonus.life;
    }

    function finish(won, reason) {
        if (isGameOver) return;
        isGameOver = true;
        deathAt = clock;
        dirQueue = [];
        const cheating = cheatsActive();
        const beatRecord = score > highScore;
        if (beatRecord) {
            highScore = score;
            // A cheat score is display only; the stored high score stays untouched.
            if (!cheating) setCookieValue(HIGH_COOKIE, String(highScore));
            highScoreElem.textContent = highScore;
        }
        pauseBtn.disabled = true;

        if (won) {
            celebrate();
        } else {
            playDieSound();
            if (!calm()) {
                shakeLeft = 380;
                flashLeft = 260;
            }
            boardWrapper.classList.add("is-dead");
            if (navigator.vibrate && !calm()) navigator.vibrate(80);
        }

        overlayTitle.textContent = won ? "Tahtayı doldurdun!" : "Oyun Bitti";
        finalScoreElem.textContent = score;
        finalBestElem.textContent = highScore;
        $("best-line").classList.toggle("hidden", beatRecord);
        newRecordElem.textContent = cheating ? "Hile açık, rekor kaydedilmedi" : "Yeni rekor!";
        newRecordElem.classList.toggle("hidden", !beatRecord);
        $("stat-length").textContent = snake.length;
        $("stat-eaten").textContent = eaten;
        $("stat-combo").textContent = `x${bestCombo}`;
        const secs = Math.floor(playMs / 1000);
        $("stat-time").textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

        // The crash plays out for a moment before the result card covers the board.
        overlayTimer = setTimeout(() => {
            overlay.classList.remove("hidden");
            restartBtn.focus({ preventScroll: true });
        }, calm() ? 0 : 700);

        const recordText = beatRecord && !cheating ? ' Yeni rekor!' : '';
        announce(`${won ? 'Tahtayı doldurdun' : reason || 'Oyun bitti'}. Skor ${score}.${recordText}`);

        // Record stats
        if (typeof recordGameResult === 'function') {
            recordGameResult('Snake', { won, score });
        }
    }

    /* ── effects ─────────────────────────────────── */

    function burst(x, y, color, count) {
        if (calm()) return;
        const cx = (x + 0.5) * cell;
        const cy = (y + 0.5) * cell;
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 40 + Math.random() * 120;
            particles.push({
                x: cx, y: cy,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                life: 0, max: 380 + Math.random() * 320,
                size: Math.max(1.5, cell * (0.08 + Math.random() * 0.12)),
                color
            });
        }
        if (particles.length > 260) particles.splice(0, particles.length - 260);
    }

    function floatText(x, y, text, color, scale = 1) {
        floaters.push({ x: (x + 0.5) * cell, y: (y + 0.5) * cell, text, color, life: 0, max: 900, scale });
        if (floaters.length > 12) floaters.shift();
    }

    function celebrate() {
        for (let i = 0; i < 6; i++) {
            const x = Math.floor(Math.random() * tileCount);
            const y = Math.floor(Math.random() * tileCount);
            burst(x, y, i % 2 ? colors.gold : colors.head, 20);
        }
    }

    function stepEffects(dt) {
        const s = dt / 1000;
        particles = particles.filter((p) => {
            p.life += dt;
            p.x += p.vx * s;
            p.y += p.vy * s;
            p.vx *= 0.94;
            p.vy = p.vy * 0.94 + 60 * s;
            return p.life < p.max;
        });
        floaters = floaters.filter((f) => {
            f.life += dt;
            return f.life < f.max;
        });
        if (shakeLeft > 0) shakeLeft = Math.max(0, shakeLeft - dt);
        if (flashLeft > 0) flashLeft = Math.max(0, flashLeft - dt);
        if (bonus && running()) {
            bonus.life -= dt;
            if (bonus.life <= 0) {
                burst(bonus.x, bonus.y, [200, 200, 200], 8);
                bonus = null;
            }
        }
    }

    /* ── frame loop ──────────────────────────────── */

    function frame(now) {
        rafId = requestAnimationFrame(frame);
        const dt = lastFrame ? Math.min(100, now - lastFrame) : 16;
        lastFrame = now;
        clock += dt;
        if (running()) {
            acc += dt;
            playMs += dt;
            let steps = 0;
            while (acc >= 1000 / fps && steps < 4) {
                acc -= 1000 / fps;
                steps++;
                tick();
                if (!running()) break;
            }
            if (steps >= 4) acc = 0;
        }
        stepEffects(dt);
        render();
    }

    function startFrames() {
        if (rafId) return;
        lastFrame = 0;
        rafId = requestAnimationFrame(frame);
    }

    function stopFrames() {
        cancelAnimationFrame(rafId);
        rafId = 0;
    }

    /* ── drawing ─────────────────────────────────── */

    function render() {
        if (!snake.length || !colors.head) return;
        const scale = canvas.width / BOARD;
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.clearRect(0, 0, BOARD, BOARD);

        if (shakeLeft > 0) {
            const m = (shakeLeft / 380) * 5;
            ctx.translate((Math.random() - 0.5) * m * 2, (Math.random() - 0.5) * m * 2);
        }

        if (!bgCache || bgCache.width !== canvas.width) buildBackground();
        ctx.drawImage(bgCache, 0, 0, BOARD, BOARD);

        drawFood();
        if (bonus) drawBonus();
        drawSnake();
        drawParticles();
        drawCombo();

        if (flashLeft > 0) {
            ctx.fillStyle = `rgba(255, 51, 102, ${0.35 * (flashLeft / 260)})`;
            ctx.fillRect(-10, -10, BOARD + 20, BOARD + 20);
        }
    }

    // Body points from head to tail. Between ticks the head slides forward and the tail end
    // slides after it, so the snake glides cell to cell at any speed.
    function bodyPoints() {
        const alpha = gameStarted && !isGameOver ? Math.min(1, acc / (1000 / fps)) : 1;
        const n = snake.length;
        const pts = [];
        const from = n > 1 ? snake[1] : (prevSnake[0] || snake[0]);
        pts.push(lerpCell(from, snake[0], alpha));
        for (let i = 1; i < n; i++) pts.push({ x: snake[i].x, y: snake[i].y });
        if (n > 1) {
            const oldTail = prevSnake.length >= n ? prevSnake[n - 1] : snake[n - 1];
            const end = lerpCell(oldTail, snake[n - 1], alpha);
            pts.push(end);
        }
        // Unwrap: a body crossing an open edge stays one continuous line outside the board.
        for (let i = 1; i < pts.length; i++) {
            while (pts[i].x - pts[i - 1].x > tileCount / 2) pts[i].x -= tileCount;
            while (pts[i - 1].x - pts[i].x > tileCount / 2) pts[i].x += tileCount;
            while (pts[i].y - pts[i - 1].y > tileCount / 2) pts[i].y -= tileCount;
            while (pts[i - 1].y - pts[i].y > tileCount / 2) pts[i].y += tileCount;
        }
        return pts;
    }

    function lerpCell(a, b, t) {
        let ax = a.x;
        let ay = a.y;
        if (ax - b.x > 1) ax -= tileCount; else if (b.x - ax > 1) ax += tileCount;
        if (ay - b.y > 1) ay -= tileCount; else if (b.y - ay > 1) ay += tileCount;
        return { x: ax + (b.x - ax) * t, y: ay + (b.y - ay) * t };
    }

    function drawSnake() {
        const pts = bodyPoints();
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        pts.forEach((p) => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });
        const xs = [0];
        const ys = [0];
        if (minX < 0.5) xs.push(tileCount);
        if (maxX > tileCount - 1.5) xs.push(-tileCount);
        if (minY < 0.5) ys.push(tileCount);
        if (maxY > tileCount - 1.5) ys.push(-tileCount);

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, BOARD, BOARD);
        ctx.clip();
        xs.forEach((ox) => ys.forEach((oy) => drawSnakeAt(pts, ox, oy)));
        ctx.restore();
    }

    function drawSnakeAt(pts, ox, oy) {
        const dead = isGameOver && deathAt && !calm();
        const deadT = dead ? Math.min(1, (clock - deathAt) / 600) : 0;
        const n = pts.length;
        const P = (p) => [(p.x + ox + 0.5) * cell, (p.y + oy + 0.5) * cell];
        const headColor = dead ? mix(colors.head, [120, 120, 130], deadT * 0.8) : colors.head;
        const tailColor = dead ? mix(colors.tail, [80, 80, 90], deadT * 0.8) : colors.tail;
        const full = cell * 0.82;
        const thin = cell * 0.46;
        const taper = Math.min(10, n);

        const widthAt = (i) => {
            const fromEnd = n - 1 - i;
            return fromEnd >= taper ? full : thin + (full - thin) * (fromEnd / taper);
        };
        const colorAt = (i) => mix(headColor, tailColor, n > 1 ? i / (n - 1) : 0);

        if (retro) {
            // Pixel theme: square blocks that still glide between cells.
            for (let i = n - 1; i >= 0; i--) {
                const [x, y] = P(pts[i]);
                const w = i === 0 ? cell * 0.92 : widthAt(i) * 1.05;
                ctx.fillStyle = css(mix(colorAt(i), [0, 0, 0], 0.3));
                ctx.fillRect(x - w / 2, y - w / 2, w, w);
                ctx.fillStyle = css(colorAt(i));
                ctx.fillRect(x - w / 2, y - w / 2, w, w * 0.78);
            }
            drawFace(P(pts[0]), dead);
            return;
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (n === 1) {
            ctx.fillStyle = css(headColor);
            ctx.beginPath();
            const [x, y] = P(pts[0]);
            ctx.arc(x, y, full / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Darker rim, then the body, tail first so nearer segments sit on top.
        for (let pass = 0; pass < 2; pass++) {
            for (let i = n - 2; i >= 0; i--) {
                const [x1, y1] = P(pts[i]);
                const [x2, y2] = P(pts[i + 1]);
                const w = widthAt(i);
                ctx.strokeStyle = pass === 0 ? css(mix(colorAt(i), [0, 0, 0], 0.35)) : css(colorAt(i));
                ctx.lineWidth = pass === 0 ? w : w * 0.8;
                ctx.beginPath();
                ctx.moveTo(x2, y2);
                ctx.lineTo(x1, y1);
                ctx.stroke();
            }
        }

        // Soft highlight along the back and scale dots give the body some depth.
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = cell * 0.16;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const [x, y] = P(pts[i]);
            if (i === 0) ctx.moveTo(x - cell * 0.1, y - cell * 0.12);
            else if (Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) > 1.5) ctx.moveTo(x - cell * 0.1, y - cell * 0.12);
            else ctx.lineTo(x - cell * 0.1, y - cell * 0.12);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
        for (let i = 2; i < n - 1; i += 2) {
            const [x, y] = P(pts[i]);
            ctx.beginPath();
            ctx.arc(x + cell * 0.08, y + cell * 0.1, cell * 0.12, 0, Math.PI * 2);
            ctx.fill();
        }

        // Head
        const [hx, hy] = P(pts[0]);
        // Only the head glows: a shadow on every body stroke is too slow for long snakes.
        if (colors.glow && effectsOn()) {
            ctx.shadowColor = css(headColor, 0.8);
            ctx.shadowBlur = cell * 0.7;
        }
        ctx.fillStyle = css(headColor);
        ctx.beginPath();
        ctx.arc(hx, hy, cell * 0.47, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        drawFace([hx, hy], dead);
    }

    function heading() {
        if (velocity.x || velocity.y) return velocity;
        if (dirQueue.length) return dirQueue[0];
        return { x: 0, y: -1 };
    }

    function drawFace([cx, cy], dead) {
        const dir = heading();
        const side = cell * 0.22;
        const fwd = cell * 0.14;
        const eyeR = Math.max(1.2, cell * 0.15);
        const lookFood = { x: (food.x + 0.5) * cell - cx, y: (food.y + 0.5) * cell - cy };
        const len = Math.hypot(lookFood.x, lookFood.y) || 1;

        // Tongue flicks now and then while moving.
        if (!dead && running() && !calm() && (clock % 1600) < 180) {
            const tx = cx + dir.x * cell * 0.45;
            const ty = cy + dir.y * cell * 0.45;
            ctx.strokeStyle = '#ff4d6d';
            ctx.lineWidth = Math.max(1, cell * 0.07);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            const ex = tx + dir.x * cell * 0.3;
            const ey = ty + dir.y * cell * 0.3;
            ctx.lineTo(ex, ey);
            ctx.lineTo(ex + dir.x * cell * 0.1 - dir.y * cell * 0.08, ey + dir.y * cell * 0.1 + dir.x * cell * 0.08);
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex + dir.x * cell * 0.1 + dir.y * cell * 0.08, ey + dir.y * cell * 0.1 - dir.x * cell * 0.08);
            ctx.stroke();
        }

        const blink = !dead && !calm() && (clock % 3700) < 120;
        [-1, 1].forEach((s) => {
            const ex = cx + dir.x * fwd - dir.y * side * s;
            const ey = cy + dir.y * fwd + dir.x * side * s;
            if (dead) {
                ctx.strokeStyle = colors.pupil;
                ctx.lineWidth = Math.max(1, cell * 0.07);
                const d = eyeR * 0.7;
                ctx.beginPath();
                ctx.moveTo(ex - d, ey - d); ctx.lineTo(ex + d, ey + d);
                ctx.moveTo(ex + d, ey - d); ctx.lineTo(ex - d, ey + d);
                ctx.stroke();
                return;
            }
            if (blink) {
                ctx.strokeStyle = colors.pupil;
                ctx.lineWidth = Math.max(1, cell * 0.06);
                ctx.beginPath();
                ctx.moveTo(ex - eyeR, ey); ctx.lineTo(ex + eyeR, ey);
                ctx.stroke();
                return;
            }
            ctx.fillStyle = colors.eyeWhite;
            if (retro) ctx.fillRect(ex - eyeR, ey - eyeR, eyeR * 2, eyeR * 2);
            else { ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill(); }
            // Pupils look towards the apple.
            const px = ex + (lookFood.x / len) * eyeR * 0.4;
            const py = ey + (lookFood.y / len) * eyeR * 0.4;
            ctx.fillStyle = colors.pupil;
            if (retro) ctx.fillRect(px - eyeR * 0.5, py - eyeR * 0.5, eyeR, eyeR);
            else { ctx.beginPath(); ctx.arc(px, py, eyeR * 0.55, 0, Math.PI * 2); ctx.fill(); }
        });
    }

    function popScale(born) {
        const t = Math.min(1, (clock - born) / 260);
        if (calm()) return 1;
        // Ease-out-back: a quick overshoot when the fruit appears.
        const c = 1.7;
        return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    }

    function drawApple(x, y, r, body, gold) {
        if (retro) {
            const s = r * 1.7;
            ctx.fillStyle = css(mix(body, [0, 0, 0], 0.3));
            ctx.fillRect(x - s / 2, y - s / 2 + s * 0.1, s, s * 0.9);
            ctx.fillStyle = css(body);
            ctx.fillRect(x - s / 2, y - s / 2 + s * 0.1, s, s * 0.6);
            ctx.fillStyle = '#38b764';
            ctx.fillRect(x, y - s / 2 - s * 0.15, s * 0.3, s * 0.22);
            return;
        }
        if (colors.glow && effectsOn()) {
            ctx.shadowColor = css(body, 0.8);
            ctx.shadowBlur = r * 1.6;
        }
        const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r * 1.1);
        grad.addColorStop(0, css(mix(body, [255, 255, 255], 0.45)));
        grad.addColorStop(0.55, css(body));
        grad.addColorStop(1, css(mix(body, [0, 0, 0], 0.35)));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x - r * 0.28, y + r * 0.05, r * 0.78, 0, Math.PI * 2);
        ctx.arc(x + r * 0.28, y + r * 0.05, r * 0.78, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Stem and leaf
        ctx.strokeStyle = '#6b4226';
        ctx.lineWidth = Math.max(1, r * 0.16);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.55);
        ctx.quadraticCurveTo(x + r * 0.05, y - r * 0.95, x + r * 0.2, y - r * 1.05);
        ctx.stroke();
        ctx.fillStyle = gold ? '#9be15d' : '#4cd964';
        ctx.beginPath();
        ctx.ellipse(x + r * 0.42, y - r * 0.85, r * 0.36, r * 0.17, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.beginPath();
        ctx.ellipse(x - r * 0.42, y - r * 0.22, r * 0.14, r * 0.24, 0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawFood() {
        const bob = calm() ? 0 : Math.sin(clock / 260) * cell * 0.04;
        const r = cell * 0.36 * popScale(food.born);
        drawApple((food.x + 0.5) * cell, (food.y + 0.5) * cell + bob, r, colors.food, false);
    }

    function drawBonus() {
        const x = (bonus.x + 0.5) * cell;
        const y = (bonus.y + 0.5) * cell;
        // Blinks during its last 1.5 seconds.
        if (bonus.life < 1500 && Math.floor(clock / 120) % 2 === 0) return;
        const r = cell * 0.38 * popScale(bonus.born);
        ctx.strokeStyle = css(colors.gold, 0.85);
        ctx.lineWidth = Math.max(1.5, cell * 0.08);
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (bonus.life / bonus.max));
        ctx.stroke();
        drawApple(x, y, r, colors.gold, true);
        if (!calm()) {
            const a = clock / 300;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            for (let i = 0; i < 2; i++) {
                const sx = x + Math.cos(a + i * Math.PI) * cell * 0.5;
                const sy = y + Math.sin(a + i * Math.PI) * cell * 0.5;
                sparkle(sx, sy, cell * 0.12);
            }
        }
    }

    function sparkle(x, y, s) {
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s * 0.3, y);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - s * 0.3, y);
        ctx.closePath();
        ctx.moveTo(x - s, y);
        ctx.lineTo(x, y + s * 0.3);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x, y - s * 0.3);
        ctx.closePath();
        ctx.fill();
    }

    function drawParticles() {
        particles.forEach((p) => {
            const k = 1 - p.life / p.max;
            ctx.fillStyle = css(p.color, k);
            if (retro) ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        floaters.forEach((f) => {
            const t = f.life / f.max;
            const size = Math.max(12, Math.min(22, cell * 0.9)) * f.scale;
            ctx.font = `800 ${size}px Outfit, system-ui, sans-serif`;
            const y = f.y - t * 34;
            ctx.lineWidth = 3;
            ctx.strokeStyle = `rgba(0, 0, 0, ${0.45 * (1 - t)})`;
            ctx.strokeText(f.text, f.x, y);
            ctx.fillStyle = css(f.color, 1 - t * t);
            ctx.fillText(f.text, f.x, y);
        });
    }

    // Combo badge with a shrinking timer bar, top centre of the board.
    function drawCombo() {
        if (combo < 2 || comboLeft <= 0 || isGameOver) return;
        const w = 110;
        const h = 24;
        const x = BOARD / 2 - w / 2;
        const y = 8;
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        roundRect(ctx, x, y, w, h, retro ? 2 : 12);
        ctx.fill();
        ctx.fillStyle = css(colors.gold);
        ctx.fillRect(x + 10, y + h - 5, (w - 20) * (comboLeft / comboWindow), 2.5);
        ctx.font = '800 13px Outfit, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`KOMBO x${combo}`, BOARD / 2, y + h / 2 - 2);
        ctx.globalAlpha = 1;
    }

    /* ── pause ───────────────────────────────────── */

    function updatePauseButton() {
        const label = paused ? "Devam Et" : "Duraklat";
        pauseBtn.textContent = paused ? "▶" : "❚❚";
        pauseBtn.setAttribute("aria-label", label);
        pauseBtn.title = `${label} (Boşluk)`;
        pauseBtn.setAttribute("aria-pressed", String(paused));
    }

    function setPaused(next) {
        if (!gameStarted || isGameOver || paused === next) return;
        paused = next;
        pauseOverlay.classList.toggle("hidden", !paused);
        if (paused) {
            resumeBtn.focus({ preventScroll: true });
        } else {
            canvas.focus({ preventScroll: true });
        }
        updatePauseButton();
    }

    /* ── sound ───────────────────────────────────── */

    function playSound(id) {
        if (typeof cpSettings !== 'undefined' && cpSettings.sound) {
            const audio = document.getElementById(id);
            if (audio) { audio.currentTime = 0; audio.volume = 0.5; audio.play().catch(() => { }); }
        }
    }

    function playEatSound() { playSound('global-eat-sound'); }
    function playDieSound() { playSound('global-die-sound'); }
    function playUiClickSound() { playSound('global-click-sound'); }

    /* ── input ───────────────────────────────────── */

    const DIRS = {
        UP: { x: 0, y: -1 },
        DOWN: { x: 0, y: 1 },
        LEFT: { x: -1, y: 0 },
        RIGHT: { x: 1, y: 0 }
    };

    function handleInput(dir) {
        const next = DIRS[dir];
        if (!next || isGameOver || boardWrapper.classList.contains("hidden")) return;
        if (paused) setPaused(false);

        // Compare with the last turn still waiting, not the current heading, so U-turns stay blocked.
        const last = dirQueue.length ? dirQueue[dirQueue.length - 1] : velocity;
        if (next.x === last.x && next.y === last.y) return;
        if (snake.length > 1 && next.x === -last.x && next.y === -last.y) return;
        if (!gameStarted) {
            gameStarted = true;
            acc = 0;
            startHint.classList.add("hidden");
            pauseBtn.disabled = false;
        }
        if (dirQueue.length < 2) dirQueue.push(next);
    }

    const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    const KEY_DIRS = {
        ArrowLeft: 'LEFT', a: 'LEFT', A: 'LEFT',
        ArrowUp: 'UP', w: 'UP', W: 'UP',
        ArrowRight: 'RIGHT', d: 'RIGHT', D: 'RIGHT',
        ArrowDown: 'DOWN', s: 'DOWN', S: 'DOWN'
    };

    function isFormControl(node) {
        return node instanceof HTMLElement
            && (node.isContentEditable || /^(input|select|textarea|option|summary)$/i.test(node.tagName));
    }

    document.addEventListener("keydown", (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        // Sliders, toggles and the menu itself keep their own arrow/WASD keys.
        if (isFormControl(e.target) || boardWrapper.classList.contains("hidden")) return;

        if (ARROW_KEYS.includes(e.key)) e.preventDefault();

        if (KEY_DIRS[e.key]) {
            handleInput(KEY_DIRS[e.key]);
            return;
        }

        // A focused button already reacts to Space and Enter on its own.
        const onButton = e.target instanceof HTMLButtonElement;
        if (e.key === ' ' || e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
            if (onButton && e.key === ' ') return;
            if (gameStarted && !isGameOver) {
                e.preventDefault();
                setPaused(!paused);
            }
        } else if ((e.key === 'Enter' || e.key === 'r' || e.key === 'R') && isGameOver && !onButton) {
            e.preventDefault();
            playUiClickSound();
            initGame();
            canvas.focus({ preventScroll: true });
        }
    });

    // Leaving the tab or window pauses a running game instead of letting the snake crash.
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) setPaused(true);
    });
    window.addEventListener("blur", () => setPaused(true));

    // Touch controls react on press, not on release, so turns feel immediate.
    document.querySelectorAll('.d-pad').forEach((btn) => {
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            btn.classList.add('pressed');
            handleInput(btn.getAttribute('data-dir'));
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => {
            btn.addEventListener(type, () => btn.classList.remove('pressed'));
        });
        // Keyboard users who tab onto a pad button can still press it.
        btn.addEventListener('click', (e) => {
            if (e.detail === 0) handleInput(btn.getAttribute('data-dir'));
        });
    });

    // Swipe on the board; every 22px of travel counts as one turn, so a finger can chain turns.
    let swipeStart = null;
    boardWrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1 || e.target.closest('button')) return;
        swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    boardWrapper.addEventListener('touchmove', (e) => {
        if (!swipeStart || e.touches.length !== 1) return;
        e.preventDefault();
        const dx = e.touches[0].clientX - swipeStart.x;
        const dy = e.touches[0].clientY - swipeStart.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
        if (Math.abs(dx) > Math.abs(dy)) handleInput(dx > 0 ? 'RIGHT' : 'LEFT');
        else handleInput(dy > 0 ? 'DOWN' : 'UP');
        swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: false });
    boardWrapper.addEventListener('touchend', () => { swipeStart = null; });
    boardWrapper.addEventListener('touchcancel', () => { swipeStart = null; });

    /* ── settings ────────────────────────────────── */

    function showGrid(value) { gridValText.textContent = `${value}x${value}`; }
    function showSpeed(value) { speedValText.textContent = `${value} adım/sn`; }

    function saveConfig() {
        setCookieValue(SETTINGS_COOKIE, JSON.stringify({
            grid: Number(gridSizeInput.value),
            speed: Number(speedInput.value),
            wall: wallDeathToggle.checked,
            preset: activePreset,
            mode,
            pad: showPadToggle.checked
        }));
    }

    gridSizeInput.addEventListener("input", (e) => {
        showGrid(e.target.value);
        updateActivePreset("custom");
    });

    speedInput.addEventListener("input", (e) => {
        showSpeed(e.target.value);
        updateActivePreset("custom");
    });

    wallDeathToggle.addEventListener("change", () => updateActivePreset("custom"));
    showPadToggle.addEventListener("change", saveConfig);

    const presets = {
        "kolay": { grid: 10, speed: 8, wall: false },
        "normal": { grid: 20, speed: 12, wall: true },
        "zor": { grid: 30, speed: 18, wall: true },
        "asiri-zor": { grid: 40, speed: 25, wall: true }
    };

    let activePreset = "normal";

    function updateActivePreset(presetName) {
        activePreset = presetName;
        presetBtns.forEach((b) => {
            const isActive = b.getAttribute("data-preset") === presetName;
            b.classList.toggle("active", isActive);
            b.setAttribute("aria-pressed", String(isActive));
        });
    }

    function updateMode(next) {
        mode = MODES[next] ? next : 'classic';
        modeBtns.forEach((b) => {
            const isActive = b.dataset.mode === mode;
            b.classList.toggle("active", isActive);
            b.setAttribute("aria-pressed", String(isActive));
        });
    }

    function applyConfig(conf) {
        gridSizeInput.value = conf.grid;
        showGrid(gridSizeInput.value);
        speedInput.value = conf.speed;
        showSpeed(speedInput.value);
        wallDeathToggle.checked = Boolean(conf.wall);
    }

    presetBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            playUiClickSound();
            const presetName = btn.getAttribute("data-preset");
            updateActivePreset(presetName);
            if (presets[presetName]) applyConfig(presets[presetName]);
        });
    });

    modeBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            playUiClickSound();
            updateMode(btn.dataset.mode);
        });
    });

    // The last used settings come back on the next visit.
    try {
        const saved = JSON.parse(getCookieValue(SETTINGS_COOKIE) || 'null');
        if (saved && Number.isFinite(saved.grid) && Number.isFinite(saved.speed)) {
            applyConfig(saved);
            updateActivePreset(presets[saved.preset] ? saved.preset : "custom");
            if (saved.preset === 'custom' || !presets[saved.preset]) $("custom-settings").open = true;
        }
        if (saved) {
            updateMode(saved.mode);
            if (typeof saved.pad === 'boolean') showPadToggle.checked = saved.pad;
        }
    } catch { /* defaults stay */ }

    function backToMenu() {
        playUiClickSound();
        clearTimeout(overlayTimer);
        paused = false;
        isGameOver = true;
        overlay.classList.add("hidden");
        pauseOverlay.classList.add("hidden");
        setPlaying(false);
        startGameBtn.focus({ preventScroll: true });
    }

    startGameBtn.addEventListener("click", () => {
        playUiClickSound();
        saveConfig();
        setPlaying(true);
        initGame();
        canvas.focus({ preventScroll: true });
        boardWrapper.scrollIntoView({ block: "nearest" });
    });

    backToMenuBtn.addEventListener("click", backToMenu);
    pauseMenuBtn.addEventListener("click", backToMenu);
    resumeBtn.addEventListener("click", () => setPaused(false));
    pauseBtn.addEventListener("click", () => setPaused(!paused));

    window.addEventListener('casual-cheat-set', (event) => {
        score = event.detail.n;
        scoreElem.textContent = score;
    });
    setInterval(() => {
        if (!window.CasualCheats || !running()) return;
        // Fractional rates and one-point interval modes share the same tick API.
        const gain = window.CasualCheats.tick();
        if (!gain) return;
        score = Number((score + gain).toFixed(3));
        scoreElem.textContent = score;
    }, 1000);

    restartBtn.addEventListener("click", () => {
        playUiClickSound();
        initGame();
        canvas.focus({ preventScroll: true });
    });

    if (typeof ResizeObserver === 'function') new ResizeObserver(resizeCanvas).observe(canvas);
    window.addEventListener('resize', resizeCanvas);

    // Read-only state for automated tests (?debug).
    if (new URLSearchParams(location.search).has('debug')) {
        window.SnakeDebug = Object.freeze({
            state: () => ({
                snake: snake.map((s) => ({ ...s })), food: { x: food.x, y: food.y },
                bonus: bonus && { x: bonus.x, y: bonus.y }, obstacles: obstacleList.map((o) => ({ ...o })),
                score, combo, fps, tileCount, mode, isGameOver, gameStarted, paused, wallDeath,
                velocity: { ...velocity }
            })
        });
    }

    overlay.classList.add("hidden");
    setPlaying(false);
});
