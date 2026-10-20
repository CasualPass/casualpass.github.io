document.addEventListener('DOMContentLoaded', () => {
    const gridEl = document.getElementById('grid');
    const scoreEl = document.getElementById('score');
    const bestScoreEl = document.getElementById('best-score');
    const overlay = document.getElementById('game-over-overlay');
    const gameOverText = document.getElementById('game-over-text');
    const finalScoreEl = document.getElementById('final-score');
    const restartBtn = document.getElementById('restart-btn');
    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    const newGameBtn = document.getElementById('new-game-btn');
    const continueBtn = document.getElementById('continue-btn');
    const undoBtn = document.getElementById('undo-btn');
    let undoState = null;

    const SIZE = 4;
    const ANIM_MS = 110;

    let cells = [];   // 4x4 grid of tile objects or null
    let score = 0;
    let bestScore = parseInt(getCookieValue('cp_2048_best') || '0', 10);
    let gameOver = false;
    let won = false;
    let keepPlaying = false;   // player chose "Devam Et" after reaching 2048
    let recorded = false;      // this run's result is already in the stats
    let recordedScore = 0;     // score stored when the run was recorded
    let moving = false;
    let runId = 0, moves = 0;
    const RUN_COOKIE = 'cp_2048_run';
    let queuedDir = null;      // one move typed during the slide animation

    bestScoreEl.textContent = bestScore;

    /* ── helpers ─────────────────────────────────── */

    function cheatImmortal() {
        const cheats = window.CasualCheats;
        return Boolean(cheats && typeof cheats.immortal === 'function' && cheats.immortal());
    }

    function makeRoomForImmortal() {
        let smallest = null;
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                const tile = cells[r][c];
                if (tile && (!smallest || tile.value < smallest.tile.value)) smallest = { r, c, tile };
            }
        }
        if (smallest) {
            smallest.tile.el.remove();
            cells[smallest.r][smallest.c] = null;
        }
    }

    // Tile size and gap come from CSS, so positions stay correct when the board resizes.
    function tileTransform(r, c, scale) {
        const pos = i => `calc(${i} * (100% + var(--gap)))`;
        return `translate(${pos(c)}, ${pos(r)})` + (scale === undefined ? '' : ` scale(${scale})`);
    }

    function positionTile(el, r, c, animate) {
        el.appearing = false;
        el.style.transition = animate ? `transform ${ANIM_MS}ms ease-in-out` : 'none';
        el.style.transform  = tileTransform(r, c);
    }

    function makeTileEl(value, r, c, appear) {
        const el = document.createElement('div');
        el.className = 'tile';
        el.dataset.value = Math.min(value, 2048);
        el.textContent   = value;
        if (value > 2048) el.classList.add('super');

        if (appear) {
            // Başlangıç: doğru konumda ama scale(0)
            el.style.transition = 'none';
            el.style.transform  = tileTransform(r, c, 0);
            el.style.opacity    = '0';
            el.appearing        = true;
            gridEl.appendChild(el);

            // Reflow zorla — tarayıcı scale:0 halini görüp işlemeli
            void el.offsetWidth;

            // Animasyonu başlat
            el.style.transition = `transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275),
                                   opacity 0.12s ease`;
            el.style.transform  = tileTransform(r, c, 1);
            el.style.opacity    = '1';

            // Animasyon bitince transform'u normalize et (slide için).
            // Taş bu sürede kaydırıldıysa eski konuma geri çekilmez.
            setTimeout(() => {
                if (el.isConnected && el.appearing) {
                    el.appearing = false;
                    el.style.transition = 'none';
                    el.style.transform  = tileTransform(r, c);
                }
            }, 240);
        } else {
            positionTile(el, r, c, false);
            gridEl.appendChild(el);
        }

        return el;
    }

    function showScoreGain(gain) {
        const card = scoreEl.parentElement;
        const bubble = document.createElement('span');
        bubble.className = 'score-add';
        bubble.textContent = '+' + gain;
        card.appendChild(bubble);
        setTimeout(() => bubble.remove(), 750);
    }

    /* ── init ────────────────────────────────────── */

    function init() {
        runId += 1;
        moves = 0;
        undoState = null;
        document.getElementById('move-feedback').textContent = 'Bir köşe seç. Büyük taşını orada büyüt.';
        // A run continued after 2048 keeps its stats up to date when abandoned.
        if (won) recordResult(true);

        gridEl.querySelectorAll('.tile').forEach(t => t.remove());

        // background cells (once)
        if (!gridEl.querySelector('.cell')) {
            for (let i = 0; i < SIZE * SIZE; i++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                gridEl.appendChild(cell);
            }
        }

        cells   = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
        score   = 0;
        gameOver = false;
        won      = false;
        keepPlaying = false;
        recorded = false;
        recordedScore = 0;
        moving   = false;
        queuedDir = null;
        scoreEl.textContent = '0';
        hideOverlay();

        spawnTile();
        spawnTile();
        saveRun();
    }

    function updateProgress() {
        const values = cells.flat().map(t => t ? t.value : 0);
        const highest = Math.max(2, ...values);
        document.getElementById('run-progress').textContent = `${won ? '2048 tamamlandı!' : 'Hedef 2048'} · En büyük taş ${highest} · ${moves} hamle · ${values.filter(v => !v).length} boş`;
        const level = Math.min(11, Math.log2(highest));
        document.getElementById('goal-track').setAttribute('aria-valuenow', level);
        document.getElementById('goal-fill').style.width = `${level / 11 * 100}%`;
        undoBtn.disabled = !undoState || moving || gameOver || recorded;
        gridEl.setAttribute('aria-label', '2048 tahtası. ' + cells.map(row => row.map(t => t ? t.value : 'boş').join(', ')).join('; '));
    }

    function saveRun() {
        updateProgress();
        if (cheatsActive()) return;
        setCookieValue(RUN_COOKIE, JSON.stringify({ grid: cells.map(row => row.map(t => t ? t.value : 0)), score, moves, won, keepPlaying, recorded, recordedScore }));
    }

    function restoreRun(raw) {
        try {
            const saved = JSON.parse(raw || 'null');
            if (!saved || !Array.isArray(saved.grid) || saved.grid.length !== SIZE ||
                !saved.grid.every(row => Array.isArray(row) && row.length === SIZE && row.every(v => Number.isInteger(v) && (v === 0 || (v >= 2 && v <= 131072 && Number.isInteger(Math.log2(v)))))) ||
                !Number.isFinite(saved.score) || saved.score < 0 || !Number.isInteger(saved.moves) || saved.moves < 0) return;
            gridEl.querySelectorAll('.tile').forEach(t => t.remove());
            cells = saved.grid.map((row, r) => row.map((value, c) => value ? { value, r, c, el: makeTileEl(value, r, c, false) } : null));
            score = saved.score; moves = saved.moves;
            won = cells.flat().some(t => t && t.value >= 2048);
            keepPlaying = Boolean(saved.keepPlaying);
            recorded = Boolean(saved.recorded); recordedScore = Number(saved.recordedScore) || 0;
            scoreEl.textContent = score;
            saveRun();
            if (isGameOver()) endGame(false);
            else if (won && !keepPlaying) endGame(true);
        } catch { /* A malformed cookie starts a fresh board. */ }
    }

    function spawnTile() {
        const empty = [];
        for (let r = 0; r < SIZE; r++)
            for (let c = 0; c < SIZE; c++)
                if (!cells[r][c]) empty.push({ r, c });
        if (!empty.length) return;

        const { r, c } = empty[Math.floor(Math.random() * empty.length)];
        const value = Math.random() < 0.9 ? 2 : 4;
        const el = makeTileEl(value, r, c, true);
        cells[r][c] = { value, r, c, el };
    }

    /* ── move engine ─────────────────────────────── */

    function move(dir) {
        if (!['left', 'right', 'up', 'down'].includes(dir)) return;
        if (gameOver) return;
        if (moving) { queuedDir = dir; return; }

        const beforeMove = { grid: cells.map(row => row.map(t => t ? t.value : 0)), score, moves, won, keepPlaying, recorded, recordedScore };

        // traversal order: process tiles in the direction of movement first
        const rows = dir === 'down'  ? [3,2,1,0] : [0,1,2,3];
        const cols = dir === 'right' ? [3,2,1,0] : [0,1,2,3];

        const dr = dir === 'down' ? 1 : dir === 'up'    ? -1 : 0;
        const dc = dir === 'right'? 1 : dir === 'left'  ? -1 : 0;

        let moved    = false;
        let anyMerge = false;
        let gained   = 0;
        const toRemove  = [];          // tiles consumed by merge
        const mergedAt  = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));

        rows.forEach(r => {
            cols.forEach(c => {
                const tile = cells[r][c];
                if (!tile) return;

                let nr = r, nc = c;

                // slide as far as possible
                while (true) {
                    const tr = nr + dr, tc = nc + dc;
                    if (tr < 0 || tr >= SIZE || tc < 0 || tc >= SIZE) break;

                    if (!cells[tr][tc]) {
                        nr = tr; nc = tc;
                    } else if (
                        cells[tr][tc].value === tile.value &&
                        !mergedAt[tr][tc]
                    ) {
                        nr = tr; nc = tc;
                        break;
                    } else {
                        break;
                    }
                }

                if (nr === r && nc === c) return;

                moved = true;
                cells[r][c] = null;

                if (cells[nr][nc]) {
                    // merge
                    const newVal = tile.value * 2;
                    score += newVal;
                    gained += newVal;
                    if (newVal === 2048 && !won) won = true;
                    anyMerge     = true;
                    mergedAt[nr][nc] = true;

                    toRemove.push(cells[nr][nc]);

                    tile.value = newVal;
                    tile.el.dataset.value = Math.min(newVal, 2048);
                    tile.el.textContent   = newVal;
                    if (newVal > 2048) tile.el.classList.add('super');

                    // pop effect after slide finishes
                    setTimeout(() => {
                        tile.el.classList.add('pop');
                        setTimeout(() => tile.el.classList.remove('pop'), 200);
                    }, ANIM_MS);
                }

                cells[nr][nc] = tile;
                tile.r = nr;
                tile.c = nc;
                positionTile(tile.el, nr, nc, true);
            });
        });

        if (!moved) {
            document.getElementById('move-feedback').textContent = 'Bu yönde yer yok. Başka bir yön dene.';
            if (cheatImmortal() && isGameOver()) makeRoomForImmortal();
            return;
        }
        moving = true;
        undoState = recorded ? null : beforeMove;
        undoBtn.disabled = true;
        moves += 1;
        const thisRun = runId;

        setTimeout(() => {
            if (thisRun !== runId) return;
            toRemove.forEach(t => t.el.remove());

            scoreEl.textContent = score;
            if (gained) showScoreGain(gained);
            document.getElementById('move-feedback').textContent = gained ? `+${gained} puan · Taşlar birleşti!` : 'Taşlar kaydı · Yeni fırsatları ara.';
            if (score > bestScore) {
                bestScore = score;
                // A cheat score is display only; the stored best stays untouched.
                if (!cheatsActive()) setCookieValue('cp_2048_best', String(bestScore));
                bestScoreEl.textContent = bestScore;
            }

            spawnTile();
            moving = false;
            saveRun();

            if (anyMerge && typeof playPopSound   === 'function') playPopSound();
            else if        (typeof playClickSound === 'function') playClickSound();
            if (typeof playHaptic === 'function') playHaptic(anyMerge ? 'move' : 'tap');

            if (cheatImmortal() && isGameOver()) makeRoomForImmortal();
            if (won && !keepPlaying && !cheatImmortal()) {
                endGame(true);
            } else if (isGameOver() && !cheatImmortal()) {
                endGame(false);
            } else if (queuedDir) {
                const next = queuedDir;
                queuedDir = null;
                move(next);
            }
        }, ANIM_MS + 10);
    }

    function undoMove() {
        if (!undoState || moving || gameOver || recorded) return;
        const previous = undoState;
        undoState = null; queuedDir = null; runId += 1;
        restoreRun(JSON.stringify(previous));
        document.getElementById('move-feedback').textContent = 'Son hamle geri alındı. Yeni bir yön dene.';
        if (typeof playHaptic === 'function') playHaptic('tap');
    }
    undoBtn.addEventListener('click', undoMove);

    function recordResult(didWin) {
        if (recorded) {
            // Played on after 2048: raise the stored score instead of counting a second game.
            const extra = score - recordedScore;
            if (extra > 0 && !cheatsActive() && typeof getGameStats === 'function') {
                const stats = getGameStats();
                const game = stats['2048'];
                if (game) {
                    game.totalScore += extra;
                    game.highScore = Math.max(game.highScore, score);
                    saveGameStats(stats);
                }
            }
        } else if (typeof recordGameResult === 'function') {
            recordGameResult('2048', { won: didWin, score });
        }
        recorded = true;
        recordedScore = score;
    }

    function hideOverlay() {
        // Keep keyboard focus on something visible once the overlay fades out.
        if (overlay.contains(document.activeElement)) newGameBtn.focus({ preventScroll: true });
        overlay.classList.add('hidden');
        overlay.inert = true;
    }

    function endGame(didWin) {
        gameOver = true;
        queuedDir = null;
        if (typeof playHaptic === 'function') playHaptic(didWin ? 'win' : 'fail');
        // The win is stored right away; playing on only raises its score later.
        recordResult(won);
        const thisRun = runId;
        saveRun();
        setTimeout(() => {
            if (thisRun !== runId) return;
            gameOverText.textContent = didWin ? 'Tebrikler! 2048!' : 'Oyun Bitti!';
            gameOverText.classList.toggle('win', didWin);
            finalScoreEl.textContent = score;
            continueBtn.classList.toggle('hidden', !didWin);
            restartBtn.textContent = didWin ? 'Yeni Oyun' : 'Tekrar Oyna';
            overlay.inert = false;
            overlay.classList.remove('hidden');
            (didWin ? continueBtn : restartBtn).focus({ preventScroll: true });
        }, 300);
    }

    function continueGame() {
        keepPlaying = true;
        gameOver = false;
        hideOverlay();
        saveRun();
        if (isGameOver()) endGame(false);
    }

    function isGameOver() {
        for (let r = 0; r < SIZE; r++)
            for (let c = 0; c < SIZE; c++) {
                if (!cells[r][c]) return false;
                const v = cells[r][c].value;
                if (c < SIZE - 1 && cells[r][c+1] && cells[r][c+1].value === v) return false;
                if (r < SIZE - 1 && cells[r+1][c] && cells[r+1][c].value === v) return false;
            }
        return true;
    }

    /* ── input ───────────────────────────────────── */

    document.addEventListener('keydown', e => {
        // Leave typing fields (e.g. the cheat code box) and browser shortcuts alone.
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        if (e.key.toLowerCase() === 'u') { e.preventDefault(); undoMove(); return; }
        const map = {
            ArrowLeft: 'left', a: 'left', A: 'left',
            ArrowRight:'right',d: 'right',D: 'right',
            ArrowUp:   'up',   w: 'up',   W: 'up',
            ArrowDown: 'down', s: 'down', S: 'down',
        };
        if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
    });

    let touchX = 0, touchY = 0;
    const bw = document.getElementById('board-wrapper');
    bw.addEventListener('touchstart', e => {
        touchX = e.touches[0].clientX;
        touchY = e.touches[0].clientY;
    }, { passive: true });
    bw.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - touchX;
        const dy = e.changedTouches[0].clientY - touchY;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
        if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
        else                              move(dy > 0 ? 'down'  : 'up');
    }, { passive: true });

    document.querySelectorAll('.d-pad').forEach(btn =>
        btn.addEventListener('click', () => move(btn.dataset.dir))
    );

    window.addEventListener('casual-cheat-set', (event) => {
        score = event.detail.n;
        scoreEl.textContent = score;
    });
    setInterval(() => {
        if (!window.CasualCheats || gameOver) return;
        // Fractional rates and one-point interval modes share the same tick API.
        const gain = window.CasualCheats.tick();
        if (!gain) return;
        score = Number((score + gain).toFixed(3));
        scoreEl.textContent = score;
    }, 1000);

    restartBtn.addEventListener('click', () => {
        if (typeof playClickSound === 'function') playClickSound();
        init();
    });
    newGameBtn.addEventListener('click', () => {
        if (typeof playClickSound === 'function') playClickSound();
        init();
    });
    continueBtn.addEventListener('click', () => {
        if (typeof playClickSound === 'function') playClickSound();
        continueGame();
    });
    backToMenuBtn.addEventListener('click', () => {
        if (won) recordResult(true);
        window.location.href = '../index.html';
    });

    const savedRun = getCookieValue(RUN_COOKIE);
    init();
    restoreRun(savedRun);
});
