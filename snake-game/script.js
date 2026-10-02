document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById("game-canv");
    const ctx = canvas.getContext("2d");
    const scoreElem = document.getElementById("score");
    const highScoreElem = document.getElementById("high-score");
    const overlay = document.getElementById("game-over-overlay");
    const overlayTitle = document.getElementById("game-over-title");
    const finalScoreElem = document.getElementById("final-score");
    const newRecordElem = document.getElementById("new-record");
    const restartBtn = document.getElementById("restart-btn");
    const startHint = document.getElementById("start-hint");
    const pauseOverlay = document.getElementById("pause-overlay");
    const resumeBtn = document.getElementById("resume-btn");
    const pauseMenuBtn = document.getElementById("pause-menu-btn");
    const pauseBtn = document.getElementById("pause-btn");
    const gameActions = document.getElementById("game-actions");
    const mobileControls = document.getElementById("mobile-controls");

    // Config Elements
    const configMenu = document.getElementById("config-menu");
    const boardWrapper = document.getElementById("board-wrapper");
    const startGameBtn = document.getElementById("start-game-btn");
    const backToMenuBtn = document.getElementById("back-to-menu-btn");
    const gridSizeInput = document.getElementById("grid-size");
    const gridValText = document.getElementById("grid-val");
    const speedInput = document.getElementById("speed-val");
    const speedValText = document.getElementById("speed-display");
    const wallDeathToggle = document.getElementById("wall-death");
    const presetBtns = document.querySelectorAll(".preset-btn");

    // Game logic runs on a fixed 400x400 board; the backing store is scaled for crisp pixels.
    const BOARD = 400;
    const SETTINGS_COOKIE = 'cp_snake_settings';

    // Game Variables
    let tileCount = 20;
    let gridSize = BOARD / tileCount;
    let fps = 12;
    let wallDeath = true;

    // Game State
    let snake = [];
    let velocity = { x: 0, y: 0 };
    // Turns pressed between two ticks wait here so quick double turns never reverse into the body.
    let dirQueue = [];
    let food = { x: 15, y: 15 };
    let tail = 5;
    let score = 0;
    let highScore = Number(getCookieValue('cp_snake_highscore')) || 0;
    let gameLoop;
    let isGameOver = false;
    let gameStarted = false;
    let paused = false;

    let colors = {};

    // Snake colours follow the active CasualPass theme through its CSS variables.
    function readColors() {
        const css = getComputedStyle(document.body);
        const pick = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
        const isPaperTheme = document.body.classList.contains('theme-paper');
        colors = {
            bg: isPaperTheme ? '#f8f9fa' : 'rgba(0, 0, 0, 0.4)',
            grid: isPaperTheme ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)',
            snakeHead: pick('--cp-accent', '#00ffcc'),
            food: pick('--cp-o-color', '#ff00cc'),
            eye: isPaperTheme ? '#ffffff' : '#0f111a'
        };
    }

    // Update Initial High Score
    highScoreElem.textContent = highScore;

    function cheatImmortal() {
        const cheats = window.CasualCheats;
        return Boolean(cheats && typeof cheats.immortal === 'function' && cheats.immortal());
    }

    function cheatPlus() {
        const cheats = window.CasualCheats;
        return Number(cheats && typeof cheats.plus === 'function' ? cheats.plus() : 0) > 0;
    }

    function effectsOn() {
        return typeof cpSettings !== 'undefined' && cpSettings.effects;
    }

    function resizeCanvas() {
        const cssSize = canvas.clientWidth;
        if (!cssSize) return;
        const backing = Math.round(cssSize * (window.devicePixelRatio || 1));
        if (canvas.width !== backing) {
            canvas.width = backing;
            canvas.height = backing;
        }
        const scale = backing / BOARD;
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        draw();
    }

    // Reset & Start Game
    function stopLoop() {
        if (gameLoop) {
            clearInterval(gameLoop);
            gameLoop = null;
        }
    }

    function startLoop() {
        stopLoop();
        gameLoop = setInterval(update, 1000 / fps);
    }

    function setPlaying(on) {
        configMenu.classList.toggle("hidden", on);
        boardWrapper.classList.toggle("hidden", !on);
        gameActions.classList.toggle("hidden", !on);
        mobileControls.classList.toggle("hidden", !on);
        document.body.classList.toggle("is-playing", on);
    }

    function initGame() {
        // Apply Configs
        tileCount = parseInt(gridSizeInput.value);
        gridSize = BOARD / tileCount;
        fps = parseInt(speedInput.value);
        wallDeath = wallDeathToggle.checked;
        boardWrapper.classList.toggle("wrap-walls", !wallDeath);

        snake = [{ x: Math.floor(tileCount / 2), y: Math.floor(tileCount / 2) }];
        tail = 3;
        score = 0;
        velocity = { x: 0, y: 0 };
        dirQueue = [];
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

        readColors();
        spawnFood();
        resizeCanvas();
        startLoop();
    }

    // Main Game Loop Update
    function update() {
        if (isGameOver || paused) return;

        if (dirQueue.length) velocity = dirQueue.shift();

        // Move snake
        let headX = snake[0].x + velocity.x;
        let headY = snake[0].y + velocity.y;

        // Boundary Wrap or Death
        if (headX < 0 || headX > tileCount - 1 || headY < 0 || headY > tileCount - 1) {
            if (wallDeath && !cheatImmortal()) {
                finish(false);
                return;
            } else {
                if (headX < 0) headX = tileCount - 1;
                if (headX > tileCount - 1) headX = 0;
                if (headY < 0) headY = tileCount - 1;
                if (headY > tileCount - 1) headY = 0;
            }
        }

        const newHead = { x: headX, y: headY };

        // Process only if moving
        if (gameStarted) {
            const eating = headX === food.x && headY === food.y;
            // The tail cell frees up on this tick, so it is only solid when the snake grows.
            const solidCount = eating ? snake.length : snake.length - 1;
            // Immortal mode never ends the run, not even while the snake is growing.
            if (!cheatImmortal()) {
                for (let i = 0; i < solidCount; i++) {
                    if (snake[i].x === headX && snake[i].y === headY) {
                        finish(false);
                        return;
                    }
                }
            }

            snake.unshift(newHead);

            // Check food collision
            if (eating) {
                score += 10;
                scoreElem.textContent = score;
                tail = Math.min(tileCount * tileCount - (cheatImmortal() ? 1 : 0), tail + 1);
                playEatSound();
                if (!spawnFood()) {
                    if (!cheatImmortal()) {
                        draw();
                        finish(true);
                        return;
                    }
                    snake.pop();
                    spawnFood();
                }
            } else if (!cheatPlus()) {
                while (snake.length > tail) {
                    snake.pop();
                }
            } else {
                tail = Math.min(tileCount * tileCount - (cheatImmortal() ? 1 : 0), tail + 1);
                while (snake.length > tail) snake.pop();
            }
        }

        draw();
    }

    // Render Graphics
    function draw() {
        if (!snake.length) return;
        // Clear Canvas
        ctx.clearRect(0, 0, BOARD, BOARD);
        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, BOARD, BOARD);

        // Draw Grid Elements (Subtle lines)
        ctx.strokeStyle = colors.grid;
        ctx.lineWidth = 1;
        for (let i = 1; i < tileCount; i++) {
            ctx.beginPath();
            ctx.moveTo(i * gridSize, 0);
            ctx.lineTo(i * gridSize, BOARD);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, i * gridSize);
            ctx.lineTo(BOARD, i * gridSize);
            ctx.stroke();
        }

        // Render Snake, tail first so the head is always on top
        const inset = Math.max(1, gridSize * 0.08);
        for (let index = snake.length - 1; index >= 0; index--) {
            const segment = snake[index];
            ctx.fillStyle = colors.snakeHead;
            // The body fades slightly towards the tail so the head stands out.
            ctx.globalAlpha = index === 0 ? 1 : Math.max(0.45, 0.8 - index * 0.01);

            if (effectsOn()) {
                ctx.shadowBlur = index === 0 ? 15 : 5;
                ctx.shadowColor = colors.snakeHead;
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.fillRect(segment.x * gridSize + inset, segment.y * gridSize + inset, gridSize - inset * 2, gridSize - inset * 2);
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        drawEyes(snake[0]);

        if (effectsOn()) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = colors.food;
        }

        // Render Food
        ctx.fillStyle = colors.food;
        ctx.beginPath();
        ctx.arc(food.x * gridSize + gridSize / 2, food.y * gridSize + gridSize / 2, Math.max(2, gridSize / 2 - 2), 0, 2 * Math.PI);
        ctx.fill();

        ctx.shadowBlur = 0; // cleanup
    }

    // Two eyes on the head show which way the snake is facing.
    function drawEyes(head) {
        const dir = velocity.x || velocity.y ? velocity : { x: 0, y: -1 };
        const cx = head.x * gridSize + gridSize / 2;
        const cy = head.y * gridSize + gridSize / 2;
        const forward = gridSize * 0.18;
        const side = gridSize * 0.2;
        const radius = Math.max(1, gridSize * 0.09);
        ctx.fillStyle = colors.eye;
        [-1, 1].forEach((s) => {
            ctx.beginPath();
            ctx.arc(cx + dir.x * forward - dir.y * side * s, cy + dir.y * forward + dir.x * side * s, radius, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    // Spawn Apple on a random free cell. Returns false only when the board is full.
    function spawnFood() {
        const occupied = new Set(snake.map((segment) => `${segment.x},${segment.y}`));
        const free = [];
        for (let x = 0; x < tileCount; x++) {
            for (let y = 0; y < tileCount; y++) {
                if (!occupied.has(`${x},${y}`)) free.push(x * tileCount + y);
            }
        }
        if (!free.length) return false;
        const cell = free[Math.floor(Math.random() * free.length)];
        food.x = Math.floor(cell / tileCount);
        food.y = cell % tileCount;
        return true;
    }

    function finish(won) {
        if (isGameOver) return;
        isGameOver = true;
        stopLoop();
        const beatRecord = score > highScore;
        if (beatRecord) {
            highScore = score;
            // A cheat score is display only; the stored high score stays untouched.
            if (!cheatsActive()) setCookieValue('cp_snake_highscore', String(highScore));
            highScoreElem.textContent = highScore;
        }
        overlayTitle.textContent = won ? "Tahtayı doldurdun!" : "Oyun Bitti";
        finalScoreElem.textContent = score;
        newRecordElem.textContent = cheatsActive() ? "Hile açık, rekor kaydedilmedi" : "Yeni rekor!";
        newRecordElem.classList.toggle("hidden", !beatRecord);
        overlay.classList.remove("hidden");
        pauseBtn.disabled = true;
        restartBtn.focus({ preventScroll: true });
        if (!won) playDieSound();

        // Record stats
        if (typeof recordGameResult === 'function') {
            recordGameResult('Snake', { won, score: score });
        }
    }

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
            stopLoop();
            resumeBtn.focus({ preventScroll: true });
        } else {
            canvas.focus({ preventScroll: true });
            startLoop();
        }
        updatePauseButton();
    }

    // Sound Helpers
    function playSound(id) {
        if (typeof cpSettings !== 'undefined' && cpSettings.sound) {
            const audio = document.getElementById(id);
            if (audio) { audio.currentTime = 0; audio.volume = 0.5; audio.play().catch(() => { }); }
        }
    }

    function playEatSound() { playSound('global-eat-sound'); }
    function playDieSound() { playSound('global-die-sound'); }
    function playUiClickSound() { playSound('global-click-sound'); }

    // Input Handling
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
        if (!gameStarted) {
            gameStarted = true;
            startHint.classList.add("hidden");
            pauseBtn.disabled = false;
        }

        // Compare with the last turn still waiting, not the current heading, so U-turns stay blocked.
        const last = dirQueue.length ? dirQueue[dirQueue.length - 1] : velocity;
        if (next.x === last.x && next.y === last.y) return;
        if (snake.length > 1 && next.x === -last.x && next.y === -last.y) return;
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
            && (node.isContentEditable || /^(input|select|textarea|option)$/i.test(node.tagName));
    }

    document.addEventListener("keydown", (e) => {
        // Sliders, toggles and the menu itself keep their own arrow/WASD keys.
        if (isFormControl(e.target) || boardWrapper.classList.contains("hidden")) return;

        // Prevent default scrolling for arrows
        if (ARROW_KEYS.includes(e.key)) {
            e.preventDefault();
        }

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
        } else if (e.key === 'Enter' && isGameOver && !onButton) {
            e.preventDefault();
            playUiClickSound();
            initGame();
        }
    });

    // Leaving the tab or window pauses a running game instead of letting the snake crash.
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) setPaused(true);
    });
    window.addEventListener("blur", () => setPaused(true));

    // Touch controls react on press, not on release, so turns feel immediate.
    document.querySelectorAll('.d-pad').forEach(btn => {
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            handleInput(btn.getAttribute('data-dir'));
        });
        // Keyboard users who tab onto a pad button can still press it.
        btn.addEventListener('click', (e) => {
            if (e.detail === 0) handleInput(btn.getAttribute('data-dir'));
        });
    });

    // Swipe on the board; every 24px of travel counts as one turn, so a finger can chain turns.
    let swipeStart = null;
    boardWrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    boardWrapper.addEventListener('touchmove', (e) => {
        if (!swipeStart || e.touches.length !== 1) return;
        if (!e.target.closest('button')) e.preventDefault();
        const dx = e.touches[0].clientX - swipeStart.x;
        const dy = e.touches[0].clientY - swipeStart.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        if (Math.abs(dx) > Math.abs(dy)) handleInput(dx > 0 ? 'RIGHT' : 'LEFT');
        else handleInput(dy > 0 ? 'DOWN' : 'UP');
        swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: false });
    boardWrapper.addEventListener('touchend', () => { swipeStart = null; });

    // Configuration Inputs Handlers
    function showGrid(value) { gridValText.textContent = `${value}x${value}`; }
    function showSpeed(value) { speedValText.textContent = `${value} adım/sn`; }

    function saveConfig(preset) {
        setCookieValue(SETTINGS_COOKIE, JSON.stringify({
            grid: Number(gridSizeInput.value),
            speed: Number(speedInput.value),
            wall: wallDeathToggle.checked,
            preset
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

    wallDeathToggle.addEventListener("change", () => {
        updateActivePreset("custom");
    });

    // Presets
    const presets = {
        "kolay": { grid: 10, speed: 8, wall: false },
        "normal": { grid: 20, speed: 12, wall: true },
        "zor": { grid: 30, speed: 18, wall: true },
        "asiri-zor": { grid: 40, speed: 25, wall: true }
    };

    let activePreset = "normal";

    function updateActivePreset(presetName) {
        activePreset = presetName;
        presetBtns.forEach(b => {
            const isActive = b.getAttribute("data-preset") === presetName;
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

    presetBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            playUiClickSound();
            const presetName = btn.getAttribute("data-preset");
            updateActivePreset(presetName);
            if (presets[presetName]) applyConfig(presets[presetName]);
        });
    });

    // The last used settings come back on the next visit.
    try {
        const saved = JSON.parse(getCookieValue(SETTINGS_COOKIE) || 'null');
        if (saved && Number.isFinite(saved.grid) && Number.isFinite(saved.speed)) {
            applyConfig(saved);
            updateActivePreset(presets[saved.preset] ? saved.preset : "custom");
        }
    } catch { /* defaults stay */ }

    function backToMenu() {
        playUiClickSound();
        stopLoop();
        paused = false;
        overlay.classList.add("hidden");
        pauseOverlay.classList.add("hidden");
        setPlaying(false);
        startGameBtn.focus({ preventScroll: true });
    }

    // Main Menu Buttons
    startGameBtn.addEventListener("click", () => {
        playUiClickSound();
        saveConfig(activePreset);
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
        if (!window.CasualCheats || !gameStarted || isGameOver || paused) return;
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

    // Initially hide overlay, show menu
    overlay.classList.add("hidden");
    setPlaying(false);

});
