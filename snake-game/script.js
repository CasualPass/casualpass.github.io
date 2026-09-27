document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById("game-canv");
    const ctx = canvas.getContext("2d");
    const scoreElem = document.getElementById("score");
    const highScoreElem = document.getElementById("high-score");
    const overlay = document.getElementById("game-over-overlay");
    const overlayTitle = document.getElementById("game-over-title");
    const restartBtn = document.getElementById("restart-btn");

    // Grid details
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

    // Game Variables
    let gridSize = 20;
    let tileCount = canvas.width / gridSize;
    let fps = 12;
    let wallDeath = true;

    // Game State
    let snake = [];
    let velocity = { x: 0, y: 0 };
    let food = { x: 15, y: 15 };
    let trail = [];
    let tail = 5;
    let score = 0;
    let highScore = Number(getCookieValue('cp_snake_highscore')) || 0;
    let gameLoop;
    let isGameOver = false;
    let gameStarted = false;

    // Determine Theme colors from CP Global Settings (fallback to liquid)
    const isPaperTheme = document.body.classList.contains('theme-paper');

    // Theme Colors
    const colors = {
        bg: isPaperTheme ? '#f8f9fa' : 'rgba(0, 0, 0, 0.4)',
        grid: isPaperTheme ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
        snakeHead: isPaperTheme ? '#2980b9' : '#00ffcc', // accent
        snakeBody: isPaperTheme ? '#3498db' : 'rgba(0, 255, 204, 0.7)',
        food: isPaperTheme ? '#e74c3c' : '#ff00cc' // pop color
    };

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

    // Reset & Start Game
    function stopLoop() {
        if (gameLoop) {
            clearInterval(gameLoop);
            gameLoop = null;
        }
    }

    function initGame() {
        // Apply Configs
        tileCount = parseInt(gridSizeInput.value);
        gridSize = canvas.width / tileCount;
        fps = parseInt(speedInput.value);
        wallDeath = wallDeathToggle.checked;

        snake = [{ x: Math.floor(tileCount / 2), y: Math.floor(tileCount / 2) }];
        tail = 3;
        score = 0;
        velocity = { x: 0, y: 0 };
        scoreElem.textContent = score;
        isGameOver = false;
        gameStarted = false;
        overlayTitle.textContent = "Oyun Bitti";
        overlay.classList.add("hidden");

        spawnFood();
        stopLoop();
        gameLoop = setInterval(update, 1000 / fps);
    }

    // Main Game Loop Update
    function update() {
        if (isGameOver) return;

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
        // Clear Canvas
        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Grid Elements (Subtle lines)
        ctx.strokeStyle = colors.grid;
        ctx.lineWidth = 1;
        for (let i = 0; i < tileCount; i++) {
            ctx.beginPath();
            ctx.moveTo(i * gridSize, 0);
            ctx.lineTo(i * gridSize, canvas.height);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, i * gridSize);
            ctx.lineTo(canvas.width, i * gridSize);
            ctx.stroke();
        }

        // Render Snake
        snake.forEach((segment, index) => {
            // Head is sligtly different color
            ctx.fillStyle = index === 0 ? colors.snakeHead : colors.snakeBody;

            // Add slight rounded corner effect by shrinking rectangle
            // and applying shadow if global effects are enabled
            if (cpSettings && cpSettings.effects) {
                ctx.shadowBlur = index === 0 ? 15 : 5;
                ctx.shadowColor = colors.snakeHead;
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.fillRect(segment.x * gridSize + 1, segment.y * gridSize + 1, gridSize - 2, gridSize - 2);
        });

        // Reset shadow for food
        if (cpSettings && cpSettings.effects) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = colors.food;
        }

        // Render Food
        ctx.fillStyle = colors.food;
        ctx.beginPath();
        ctx.arc(food.x * gridSize + gridSize / 2, food.y * gridSize + gridSize / 2, gridSize / 2 - 2, 0, 2 * Math.PI);
        ctx.fill();

        ctx.shadowBlur = 0; // cleanup
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
        if (score > highScore) {
            highScore = score;
            // A cheat score is display only; the stored high score stays untouched.
            if (!cheatsActive()) setCookieValue('cp_snake_highscore', String(highScore));
            highScoreElem.textContent = highScore;
        }
        overlayTitle.textContent = won ? "Tahtayı doldurdun!" : "Oyun Bitti";
        overlay.classList.remove("hidden");
        if (!won) playDieSound();

        // Record stats
        if (typeof recordGameResult === 'function') {
            recordGameResult('Snake', { won, score: score });
        }
    }

    // Sound Helpers
    function playEatSound() {
        if (typeof cpSettings !== 'undefined' && cpSettings.sound) {
            const audio = document.getElementById('global-eat-sound');
            if (audio) { audio.currentTime = 0; audio.volume = 0.5; audio.play().catch(e => { }); }
        }
    }

    function playDieSound() {
        if (typeof cpSettings !== 'undefined' && cpSettings.sound) {
            const audio = document.getElementById('global-die-sound');
            if (audio) { audio.currentTime = 0; audio.volume = 0.5; audio.play().catch(e => { }); }
        }
    }

    function playUiClickSound() {
        if (typeof cpSettings !== 'undefined' && cpSettings.sound) {
            const audio = document.getElementById('global-click-sound');
            if (audio) { audio.currentTime = 0; audio.volume = 0.5; audio.play().catch(e => { }); }
        }
    }

    // Input Handling
    function handleInput(dir) {
        if (!gameStarted) gameStarted = true;

        if (dir === 'UP' && velocity.y !== 1) { velocity.x = 0; velocity.y = -1; }
        if (dir === 'DOWN' && velocity.y !== -1) { velocity.x = 0; velocity.y = 1; }
        if (dir === 'LEFT' && velocity.x !== 1) { velocity.x = -1; velocity.y = 0; }
        if (dir === 'RIGHT' && velocity.x !== -1) { velocity.x = 1; velocity.y = 0; }
    }

    const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

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

        switch (e.key) {
            case "ArrowLeft":
            case "a":
            case "A":
                handleInput('LEFT'); break;
            case "ArrowUp":
            case "w":
            case "W":
                handleInput('UP'); break;
            case "ArrowRight":
            case "d":
            case "D":
                handleInput('RIGHT'); break;
            case "ArrowDown":
            case "s":
            case "S":
                handleInput('DOWN'); break;
        }
    });

    // Mobile specific controls
    document.querySelectorAll('.d-pad').forEach(btn => {
        btn.addEventListener('click', (e) => {
            handleInput(e.target.getAttribute('data-dir'));
        });
    });

    // Configuration Inputs Handlers
    gridSizeInput.addEventListener("input", (e) => {
        gridValText.textContent = `${e.target.value}x${e.target.value}`;
        updateActivePreset("custom");
    });

    speedInput.addEventListener("input", (e) => {
        speedValText.textContent = e.target.value;
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

    function updateActivePreset(presetName) {
        presetBtns.forEach(b => {
            const isActive = b.getAttribute("data-preset") === presetName;
            b.classList.toggle("active", isActive);
            b.setAttribute("aria-pressed", String(isActive));
        });
    }

    presetBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            playUiClickSound();
            const presetName = btn.getAttribute("data-preset");
            updateActivePreset(presetName);

            if (presets[presetName]) {
                const conf = presets[presetName];
                gridSizeInput.value = conf.grid;
                gridValText.textContent = `${conf.grid}x${conf.grid}`;

                speedInput.value = conf.speed;
                speedValText.textContent = conf.speed;

                wallDeathToggle.checked = conf.wall;
            }
        });
    });

    // Main Menu Buttons
    startGameBtn.addEventListener("click", () => {
        playUiClickSound();
        configMenu.classList.add("hidden");
        boardWrapper.classList.remove("hidden");
        initGame();
        // focus logic just in case
        canvas.focus();
    });

    backToMenuBtn.addEventListener("click", () => {
        playUiClickSound();
        overlay.classList.add("hidden");
        boardWrapper.classList.add("hidden");
        configMenu.classList.remove("hidden");
        stopLoop();
    });

    window.addEventListener('casual-cheat-set', (event) => {
        score = event.detail.n;
        scoreElem.textContent = score;
    });
    setInterval(() => {
        if (!window.CasualCheats || !gameStarted || isGameOver) return;
        // Fractional rates and one-point interval modes share the same tick API.
        const gain = window.CasualCheats.tick();
        if (!gain) return;
        score = Number((score + gain).toFixed(3));
        scoreElem.textContent = score;
    }, 1000);

    restartBtn.addEventListener("click", () => {
        playUiClickSound();
        initGame();
    });

    // Initially hide overlay, show menu
    overlay.classList.add("hidden");
    boardWrapper.classList.add("hidden");

});
