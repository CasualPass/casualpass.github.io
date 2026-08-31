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

    const SIZE = 4;
    const GAP = 8;
    const ANIM_MS = 110;

    let cells = [];   // 4x4 grid of tile objects or null
    let score = 0;
    let bestScore = parseInt(getCookieValue('cp_2048_best') || '0', 10);
    let gameOver = false;
    let won = false;
    let moving = false;

    bestScoreEl.textContent = bestScore;

    /* ── helpers ─────────────────────────────────── */

    function cellSize() {
        return (gridEl.offsetWidth - GAP * (SIZE - 1)) / SIZE;
    }

    function tileOffset(idx) {
        return idx * (cellSize() + GAP);
    }

    function positionTile(el, r, c, animate) {
        const x = tileOffset(c);
        const y = tileOffset(r);
        const sz = cellSize();
        el.style.width  = sz + 'px';
        el.style.height = sz + 'px';
        el.style.transition = animate ? `transform ${ANIM_MS}ms ease-in-out` : 'none';
        el.style.transform  = `translate(${x}px, ${y}px)`;
    }

    function makeTileEl(value, r, c, appear) {
        const el = document.createElement('div');
        el.className = 'tile';
        el.dataset.value = Math.min(value, 2048);
        el.textContent   = value;
        if (value > 2048) el.classList.add('super');

        const sz = cellSize();
        const x  = tileOffset(c);
        const y  = tileOffset(r);
        el.style.width  = sz + 'px';
        el.style.height = sz + 'px';

        if (appear) {
            // Başlangıç: doğru konumda ama scale(0)
            el.style.transition = 'none';
            el.style.transform  = `translate(${x}px, ${y}px) scale(0)`;
            el.style.opacity    = '0';
            gridEl.appendChild(el);

            // Reflow zorla — tarayıcı scale:0 halini görüp işlemeli
            void el.offsetWidth;

            // Animasyonu başlat
            el.style.transition = `transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275),
                                   opacity 0.12s ease`;
            el.style.transform  = `translate(${x}px, ${y}px) scale(1)`;
            el.style.opacity    = '1';

            // Animasyon bitince transform'u normalize et (slide için)
            setTimeout(() => {
                if (el.isConnected) {
                    el.style.transition = 'none';
                    el.style.transform  = `translate(${x}px, ${y}px)`;
                }
            }, 240);
        } else {
            positionTile(el, r, c, false);
            gridEl.appendChild(el);
        }

        return el;
    }

    /* ── init ────────────────────────────────────── */

    function init() {
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
        moving   = false;
        scoreEl.textContent = '0';
        overlay.classList.add('hidden');

        spawnTile();
        spawnTile();
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
        if (gameOver || moving) return;

        // traversal order: process tiles in the direction of movement first
        const rows = dir === 'down'  ? [3,2,1,0] : [0,1,2,3];
        const cols = dir === 'right' ? [3,2,1,0] : [0,1,2,3];

        const dr = dir === 'down' ? 1 : dir === 'up'    ? -1 : 0;
        const dc = dir === 'right'? 1 : dir === 'left'  ? -1 : 0;

        let moved    = false;
        let anyMerge = false;
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

        if (!moved) return;
        moving = true;

        setTimeout(() => {
            toRemove.forEach(t => t.el.remove());

            scoreEl.textContent = score;
            if (score > bestScore) {
                bestScore = score;
                setCookieValue('cp_2048_best', String(bestScore));
                bestScoreEl.textContent = bestScore;
            }

            spawnTile();
            moving = false;

            if (anyMerge && typeof playPopSound   === 'function') playPopSound();
            else if        (typeof playClickSound === 'function') playClickSound();

            if (won && !gameOver) {
                endGame(true);
            } else if (isGameOver()) {
                endGame(false);
            }
        }, ANIM_MS + 10);
    }

    function endGame(didWin) {
        gameOver = true;
        setTimeout(() => {
            gameOverText.textContent = didWin ? 'Tebrikler! 2048!' : 'Oyun Bitti!';
            gameOverText.style.color = didWin ? '#ffcd75' : '#ff3366';
            finalScoreEl.textContent = score;
            overlay.classList.remove('hidden');
            if (typeof recordGameResult === 'function')
                recordGameResult('2048', { won: didWin, score });
        }, 300);
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

    restartBtn.addEventListener('click', () => {
        if (typeof playClickSound === 'function') playClickSound();
        init();
    });
    newGameBtn.addEventListener('click', () => {
        if (typeof playClickSound === 'function') playClickSound();
        init();
    });
    backToMenuBtn.addEventListener('click', () => {
        window.location.href = '../index.html';
    });

    init();
});
