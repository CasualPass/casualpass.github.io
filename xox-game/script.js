/*
 * XOX — Klasik 3×3, Büyük 4×4 (dörtlü) ve Ultimate (9 küçük tahta).
 * Bot: Kolay (çoğunlukla rastgele), Orta (kazanır/engeller, kısa bakış), Zor (3×3'te kusursuz minimax,
 * diğerlerinde süreli alfa-beta). Durum yalnızca çerezlerde; hile açıkken hiçbir şey kaydedilmez.
 */
document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const container = $('game-container');
    const configMenu = $('config-menu');
    const gameArea = $('game-area');
    const boardElem = $('board');
    const boardFrame = $('board-frame');
    const winLine = $('win-line');
    const statusDisplay = $('status');
    const resetBtn = $('reset-btn');
    const resetBtnText = resetBtn.querySelector('.btn-text');
    const resultOverlay = $('result-overlay');
    const roundHistory = $('round-history');
    const cardX = document.querySelector('.x-score');
    const cardO = document.querySelector('.o-score');
    const playerNameInput = $('player-name-input');
    const player2NameInput = $('player2-name-input');
    const leaderboardModal = $('leaderboard-modal');
    const showLeaderboardBtn = $('show-leaderboard-btn');
    const closeLeaderboardBtn = $('close-leaderboard-btn');

    const PREFS_COOKIE = 'cp_xox_prefs';
    const DIFF_HINTS = {
        easy: 'Kolay: rastgele oynar, ara sıra fırsatı görür.',
        medium: 'Orta: kazanır ve engeller, birkaç hamle ileri bakar.',
        hard: 'Zor: Klasik tahtada yenilmez; diğerlerinde derin düşünür.'
    };
    const DIFF_NAMES = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' };

    const prefs = { mode: 'bot', variant: 'classic', difficulty: 'easy', first: 'x' };
    let player1Name = 'Misafir';
    let player2Name = 'Bot';

    let state = null;         // current position
    let current = 'X';        // side to move
    let gameActive = false;
    let botTimer = null;
    let resultTimer = null;
    let round = 1;
    let score = { X: 0, O: 0, draw: 0 };
    let history = [];         // 'X' | 'O' | 'draw' per finished round
    let focusIndex = 0;
    let cells = [];           // cell buttons by index
    let subBoards = [];       // ultimate sub-board elements

    /* ------------------------------------------------------------------ */
    /* Rules                                                               */
    /* ------------------------------------------------------------------ */
    function linesFor(n) {
        const lines = [];
        for (let r = 0; r < n; r++) lines.push(Array.from({ length: n }, (_, c) => r * n + c));
        for (let c = 0; c < n; c++) lines.push(Array.from({ length: n }, (_, r) => r * n + c));
        lines.push(Array.from({ length: n }, (_, i) => i * n + i));
        lines.push(Array.from({ length: n }, (_, i) => i * n + (n - 1 - i)));
        return lines;
    }
    const L3 = linesFor(3);
    const L4 = linesFor(4);
    const other = (p) => (p === 'X' ? 'O' : 'X');

    function lineWinner(cellsArr, lines, offset = 0) {
        for (const line of lines) {
            const a = cellsArr[offset + line[0]];
            if (a !== 'X' && a !== 'O') continue;
            if (line.every((i) => cellsArr[offset + i] === a)) return { p: a, line };
        }
        return null;
    }

    function newState(variant) {
        const size = variant === 'ultimate' ? 81 : variant === 'four' ? 16 : 9;
        return {
            variant,
            cells: Array(size).fill(''),
            small: variant === 'ultimate' ? Array(9).fill('') : null,
            next: -1,
            winner: null,
            line: null
        };
    }

    function legalMoves(s) {
        if (s.winner) return [];
        const out = [];
        if (s.variant !== 'ultimate') {
            for (let i = 0; i < s.cells.length; i++) if (!s.cells[i]) out.push(i);
            return out;
        }
        for (let b = 0; b < 9; b++) {
            if (s.small[b]) continue;
            if (s.next >= 0 && s.next !== b) continue;
            for (let c = 0; c < 9; c++) if (!s.cells[b * 9 + c]) out.push(b * 9 + c);
        }
        return out;
    }

    function play(s, i, p) {
        const t = { variant: s.variant, cells: s.cells.slice(), small: s.small && s.small.slice(), next: -1, winner: null, line: null };
        t.cells[i] = p;
        if (t.variant !== 'ultimate') {
            const w = lineWinner(t.cells, t.variant === 'four' ? L4 : L3);
            if (w) { t.winner = w.p; t.line = w.line; }
            else if (!t.cells.includes('')) t.winner = 'draw';
            return t;
        }
        const b = Math.floor(i / 9);
        const c = i % 9;
        const w = lineWinner(t.cells, L3, b * 9);
        if (w) t.small[b] = w.p;
        else if (t.cells.slice(b * 9, b * 9 + 9).every(Boolean)) t.small[b] = 'D';
        const meta = lineWinner(t.small, L3);
        if (meta) { t.winner = meta.p; t.line = meta.line; return t; }
        t.next = t.small[c] ? -1 : c;
        if (!t.small.includes('')) t.winner = 'draw';
        return t;
    }

    /* ------------------------------------------------------------------ */
    /* Bot                                                                 */
    /* ------------------------------------------------------------------ */
    const WIN = 1e6;
    const LINE_SCORE = [0, 1, 8, 60, 400];

    function lineEval(cellsArr, lines, p, offset = 0) {
        let total = 0;
        for (const line of lines) {
            let mine = 0, theirs = 0;
            for (const i of line) {
                const v = cellsArr[offset + i];
                if (v === p) mine++;
                else if (v === 'X' || v === 'O') theirs++;
                else if (v === 'D') { mine = -9; break; }
            }
            if (mine < 0) continue;
            if (mine && !theirs) total += LINE_SCORE[mine];
            else if (theirs && !mine) total -= LINE_SCORE[theirs];
        }
        return total;
    }

    const BOARD_WEIGHT = [1.2, 1, 1.2, 1, 1.5, 1, 1.2, 1, 1.2];
    function evaluate(s, p) {
        if (s.variant !== 'ultimate') return lineEval(s.cells, s.variant === 'four' ? L4 : L3, p);
        let total = lineEval(s.small, L3, p) * 120;
        for (let b = 0; b < 9; b++) {
            const v = s.small[b];
            if (v === p) total += 60 * BOARD_WEIGHT[b];
            else if (v && v !== 'D') total -= 60 * BOARD_WEIGHT[b];
            else if (!v) total += lineEval(s.cells, L3, p, b * 9) * BOARD_WEIGHT[b];
        }
        // Sending the opponent to a free choice is a gift.
        if (s.next < 0) total -= 25;
        return total;
    }

    function orderMoves(s, moves) {
        if (s.variant === 'ultimate') return moves;
        const n = s.variant === 'four' ? 4 : 3;
        const mid = (n - 1) / 2;
        return moves.slice().sort((a, b) => {
            const da = Math.abs(a % n - mid) + Math.abs(Math.floor(a / n) - mid);
            const db = Math.abs(b % n - mid) + Math.abs(Math.floor(b / n) - mid);
            return da - db;
        });
    }

    class Timeout extends Error {}

    function negamax(s, p, depth, alpha, beta, ctx) {
        if (s.winner) return s.winner === 'draw' ? 0 : -(WIN + depth); // the previous mover won
        if (depth === 0) return evaluate(s, p);
        if ((++ctx.nodes & 1023) === 0 && performance.now() > ctx.deadline) throw new Timeout();
        const key = ctx.tt && (s.cells.join('') + s.next + p + depth);
        if (key && ctx.tt.has(key)) {
            const e = ctx.tt.get(key);
            if (e.flag === 0) return e.v;
            if (e.flag === 1 && e.v >= beta) return e.v;
            if (e.flag === -1 && e.v <= alpha) return e.v;
        }
        const a0 = alpha;
        let best = -Infinity;
        for (const m of orderMoves(s, legalMoves(s))) {
            const v = -negamax(play(s, m, p), other(p), depth - 1, -beta, -alpha, ctx);
            if (v > best) best = v;
            if (v > alpha) alpha = v;
            if (alpha >= beta) break;
        }
        if (key) ctx.tt.set(key, { v: best, flag: best <= a0 ? -1 : best >= beta ? 1 : 0 });
        return best;
    }

    /** Scores every root move exactly at a fixed depth and returns the best ones. */
    function rootScores(s, p, moves, depth, ctx) {
        return moves.map((m) => ({ m, v: -negamax(play(s, m, p), other(p), depth - 1, -Infinity, Infinity, ctx) }));
    }

    function pickBest(scored) {
        const top = Math.max(...scored.map((x) => x.v));
        const best = scored.filter((x) => x.v === top);
        return best[Math.floor(Math.random() * best.length)].m;
    }

    function immediate(s, moves, p) {
        return moves.find((m) => play(s, m, p).winner === p);
    }

    function chooseBotMove(s, p, moves, level) {
        const random = () => moves[Math.floor(Math.random() * moves.length)];
        const win = immediate(s, moves, p);
        const block = immediate(s, moves, other(p));
        if (level === 'easy') {
            if (win !== undefined && Math.random() < 0.5) return win;
            if (block !== undefined && Math.random() < 0.25) return block;
            return random();
        }
        if (win !== undefined) return win;
        if (block !== undefined && s.variant !== 'ultimate') return block;

        if (s.variant === 'classic') {
            const ctx = { nodes: 0, deadline: Infinity, tt: null };
            if (level === 'medium' && Math.random() < 0.35) return random();
            return pickBest(rootScores(s, p, moves, 9, ctx));
        }

        // 4×4 and Ultimate: iterative deepening against a clock.
        const budget = level === 'hard' ? (s.variant === 'ultimate' ? 900 : 700) : 120;
        const maxDepth = level === 'hard' ? 16 : 2;
        const ctx = { nodes: 0, deadline: performance.now() + budget, tt: new Map() };
        let best = block !== undefined ? block : random();
        for (let depth = 1; depth <= Math.min(maxDepth, moves.length + 1); depth++) {
            try {
                best = pickBest(rootScores(s, p, moves, depth, ctx));
            } catch (e) {
                if (e instanceof Timeout) break;
                throw e;
            }
        }
        return best;
    }

    /* ------------------------------------------------------------------ */
    /* Sound (WebAudio, follows the shared sound setting)                  */
    /* ------------------------------------------------------------------ */
    let audioCtx = null;
    function soundOn() {
        try { return window.CasualSettings ? CasualSettings.get().sound !== false : true; } catch { return true; }
    }
    function tone(freq, start, dur, type = 'sine', gain = 0.12) {
        if (!soundOn()) return;
        try {
            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            const t = audioCtx.currentTime + start;
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            osc.connect(g).connect(audioCtx.destination);
            osc.start(t);
            osc.stop(t + dur + 0.02);
        } catch { /* audio unavailable */ }
    }
    const sfx = {
        place: (p) => tone(p === 'X' ? 520 : 390, 0, 0.12, 'triangle', 0.14),
        win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.12)),
        lose: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.12, 0.25, 'sine', 0.12)),
        draw: () => [440, 440].forEach((f, i) => tone(f, i * 0.14, 0.14, 'sine', 0.1)),
        blocked: () => tone(180, 0, 0.18, 'square', 0.05)
    };

    /* ------------------------------------------------------------------ */
    /* Rendering                                                           */
    /* ------------------------------------------------------------------ */
    const SVG_NS = 'http://www.w3.org/2000/svg';
    function markSvg(p, extraClass = '') {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('class', `mark mark-${p.toLowerCase()} ${extraClass}`);
        svg.setAttribute('aria-hidden', 'true');
        if (p === 'X') {
            for (const d of ['M27 27 L73 73', 'M73 27 L27 73']) {
                const path = document.createElementNS(SVG_NS, 'path');
                path.setAttribute('d', d);
                path.setAttribute('pathLength', '1');
                svg.appendChild(path);
            }
        } else {
            const c = document.createElementNS(SVG_NS, 'circle');
            c.setAttribute('cx', '50');
            c.setAttribute('cy', '50');
            c.setAttribute('r', '24');
            c.setAttribute('pathLength', '1');
            c.setAttribute('transform', 'rotate(-90 50 50)');
            svg.appendChild(c);
        }
        return svg;
    }

    // Visual grid position for keyboard navigation.
    function gridSize() { return state.variant === 'ultimate' ? 9 : state.variant === 'four' ? 4 : 3; }
    function toRC(i) {
        if (state.variant !== 'ultimate') { const n = gridSize(); return [Math.floor(i / n), i % n]; }
        const b = Math.floor(i / 9), c = i % 9;
        return [Math.floor(b / 3) * 3 + Math.floor(c / 3), (b % 3) * 3 + (c % 3)];
    }
    function fromRC(r, c) {
        if (state.variant !== 'ultimate') return r * gridSize() + c;
        return (Math.floor(r / 3) * 3 + Math.floor(c / 3)) * 9 + (r % 3) * 3 + (c % 3);
    }

    function makeCell(i) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.dataset.index = String(i);
        cell.setAttribute('role', 'gridcell');
        cell.tabIndex = -1;
        cell.addEventListener('click', () => handleCellClick(i));
        cell.addEventListener('keydown', (e) => handleCellKey(e, i));
        cells[i] = cell;
        return cell;
    }

    function buildBoard() {
        boardElem.replaceChildren();
        cells = [];
        subBoards = [];
        boardElem.className = `board board--${state.variant}`;
        container.classList.toggle('is-ultimate', state.variant === 'ultimate');
        if (state.variant === 'ultimate') {
            for (let b = 0; b < 9; b++) {
                const sub = document.createElement('div');
                sub.className = 'sub-board';
                sub.setAttribute('role', 'group');
                sub.setAttribute('aria-label', `Küçük tahta ${b + 1}`);
                for (let c = 0; c < 9; c++) sub.appendChild(makeCell(b * 9 + c));
                subBoards.push(sub);
                boardElem.appendChild(sub);
            }
        } else {
            for (let i = 0; i < state.cells.length; i++) boardElem.appendChild(makeCell(i));
        }
        focusIndex = fromRC(Math.floor(gridSize() / 2), Math.floor(gridSize() / 2));
        cells[focusIndex].tabIndex = 0;
        cells.forEach((_, i) => updateCellLabel(i));
    }

    function updateCellLabel(i) {
        const [r, c] = toRC(i);
        const v = state.cells[i] || 'boş';
        cells[i].setAttribute('aria-label', `Satır ${r + 1}, sütun ${c + 1}: ${v}`);
    }

    function renderCell(i) {
        const v = state.cells[i];
        const cell = cells[i];
        cell.classList.toggle('occupied', Boolean(v));
        cell.classList.toggle('x', v === 'X');
        cell.classList.toggle('o', v === 'O');
        if (v && !cell.querySelector('.mark')) cell.appendChild(markSvg(v));
        updateCellLabel(i);
    }

    function renderSubBoards() {
        if (state.variant !== 'ultimate') return;
        const playable = gameActive && !state.winner;
        subBoards.forEach((sub, b) => {
            const v = state.small[b];
            sub.classList.toggle('won-x', v === 'X');
            sub.classList.toggle('won-o', v === 'O');
            sub.classList.toggle('drawn', v === 'D');
            sub.classList.toggle('active', playable && !v && (state.next < 0 || state.next === b));
            if ((v === 'X' || v === 'O') && !sub.querySelector('.big-mark')) sub.appendChild(markSvg(v, 'big-mark'));
        });
    }

    function updateBoardLock() {
        const botTurn = prefs.mode === 'bot' && current === 'O';
        const locked = !gameActive || botTurn;
        boardElem.classList.toggle('locked', locked);
        boardElem.setAttribute('aria-busy', String(gameActive && botTurn));
        const legal = new Set(gameActive ? legalMoves(state) : []);
        cells.forEach((cell, i) => {
            cell.classList.toggle('playable', !locked && legal.has(i));
            cell.setAttribute('aria-disabled', String(locked || !legal.has(i)));
        });
        boardElem.dataset.turn = current.toLowerCase();
    }

    function updateActiveCard() {
        cardX.classList.toggle('active', gameActive && current === 'X');
        cardO.classList.toggle('active', gameActive && current === 'O');
    }

    function nameOf(p) { return p === 'X' ? player1Name : player2Name; }

    function setStatus(text, tone = '') {
        statusDisplay.textContent = text;
        statusDisplay.classList.remove('win-x', 'win-o', 'draw', 'turn-x', 'turn-o', 'warn');
        if (tone) statusDisplay.classList.add(tone);
    }

    function turnStatus() {
        if (prefs.mode === 'bot' && current === 'O') return setStatus(`${player2Name} düşünüyor…`, 'turn-o');
        const who = prefs.mode === 'bot' ? 'Sıra sende' : `Sıra: ${nameOf(current)}`;
        let where = '';
        if (state.variant === 'ultimate') where = state.next >= 0 ? ` · ${state.next + 1}. tahta` : ' · istediğin tahta';
        setStatus(`${who}${where}`, current === 'X' ? 'turn-x' : 'turn-o');
    }

    function renderScores() {
        $('score-x').textContent = score.X;
        $('score-o').textContent = score.O;
        $('score-draw').textContent = score.draw;
        $('round-label').textContent = `${round}. raunt`;
        roundHistory.replaceChildren();
        history.slice(-12).forEach((r, i, arr) => {
            const li = document.createElement('li');
            li.className = `chip chip-${r === 'draw' ? 'draw' : r.toLowerCase()}`;
            li.textContent = r === 'draw' ? '=' : r;
            li.setAttribute('aria-label', `${history.length - arr.length + i + 1}. raunt: ${r === 'draw' ? 'berabere' : nameOf(r)}`);
            roundHistory.appendChild(li);
        });
        roundHistory.classList.toggle('hidden', history.length === 0);
    }

    /* Winning line drawn across the cell (or sub-board) centres. */
    function drawWinLine() {
        const line = state.line;
        if (!line) { winLine.classList.remove('show'); return; }
        const items = state.variant === 'ultimate' ? subBoards : cells;
        const frame = boardFrame.getBoundingClientRect();
        const a = items[line[0]].getBoundingClientRect();
        const b = items[line[line.length - 1]].getBoundingClientRect();
        let x1 = a.left + a.width / 2 - frame.left, y1 = a.top + a.height / 2 - frame.top;
        let x2 = b.left + b.width / 2 - frame.left, y2 = b.top + b.height / 2 - frame.top;
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
        const ext = a.width * 0.32;
        x1 -= dx / len * ext; y1 -= dy / len * ext; x2 += dx / len * ext; y2 += dy / len * ext;
        winLine.setAttribute('viewBox', `0 0 ${frame.width} ${frame.height}`);
        const el = winLine.querySelector('line');
        el.setAttribute('x1', x1); el.setAttribute('y1', y1);
        el.setAttribute('x2', x2); el.setAttribute('y2', y2);
        winLine.classList.remove('x', 'o');
        winLine.classList.add(state.winner.toLowerCase());
        winLine.classList.add('show');
    }
    window.addEventListener('resize', () => { if (state && state.line) drawWinLine(); });

    /* ------------------------------------------------------------------ */
    /* Game flow                                                           */
    /* ------------------------------------------------------------------ */
    function isImmortalEnabled() {
        return Boolean(window.CasualCheats && CasualCheats.immortal());
    }

    // Immortality: the bot never wins; locally no one can complete a winning line.
    function blocksWins(p) {
        return isImmortalEnabled() && (prefs.mode === 'local' || p === 'O');
    }

    function startingPlayer() {
        if (prefs.first === 'x') return 'X';
        if (prefs.first === 'o') return 'O';
        return round % 2 === 1 ? 'X' : 'O';
    }

    function startRound() {
        clearTimeout(botTimer);
        clearTimeout(resultTimer);
        state = newState(prefs.variant);
        current = startingPlayer();
        gameActive = true;
        resultOverlay.classList.add('hidden');
        winLine.classList.remove('show');
        boardFrame.classList.remove('finished');
        resetBtnText.textContent = 'Yeniden Başlat';
        resetBtn.classList.remove('primary');
        buildBoard();
        renderSubBoards();
        renderScores();
        updateActiveCard();
        updateBoardLock();
        turnStatus();
        if (prefs.mode === 'bot' && current === 'O') botTimer = setTimeout(makeBotMove, 600);
    }

    function handleCellClick(i) {
        setFocus(i, false);
        if (!gameActive || state.winner) return;
        if (prefs.mode === 'bot' && current === 'O') return;
        if (!legalMoves(state).includes(i)) {
            if (!state.cells[i] && state.variant === 'ultimate') {
                setStatus(`Bu hamlede ${state.next + 1}. tahtada oynamalısın.`, 'warn');
                sfx.blocked();
            }
            return;
        }
        if (blocksWins(current) && play(state, i, current).winner === current) {
            const moves = legalMoves(state);
            if (moves.every((m) => play(state, m, current).winner === current)) {
                finishRound('draw', 'Kazandıran kareler engellendi.');
            } else {
                setStatus('Ölümsüzlük: kazandıran kare engellendi. Başka kare seç.', 'warn');
                sfx.blocked();
            }
            return;
        }
        makeMove(i);
    }

    function makeMove(i) {
        const p = current;
        state = play(state, i, p);
        renderCell(i);
        cells[i].classList.add('just-played');
        setTimeout(() => cells[i] && cells[i].classList.remove('just-played'), 400);
        renderSubBoards();
        sfx.place(p);

        if (state.winner) {
            finishRound(state.winner);
            return;
        }
        current = other(p);
        updateActiveCard();
        updateBoardLock();
        renderSubBoards();
        turnStatus();
        if (prefs.mode === 'bot' && current === 'O') {
            // Let the thinking status paint before a long search.
            botTimer = setTimeout(makeBotMove, state.variant === 'classic' ? 450 : 350);
        }
    }

    function makeBotMove() {
        botTimer = null;
        if (!gameActive || current !== 'O' || state.winner) return;
        let moves = legalMoves(state);
        if (!moves.length) return;
        if (blocksWins('O')) {
            moves = moves.filter((m) => play(state, m, 'O').winner !== 'O');
            if (!moves.length) {
                finishRound('draw', 'Kazandıran kareler engellendi.');
                return;
            }
        }
        const pick = chooseBotMove(state, 'O', moves, prefs.difficulty);
        makeMove(moves.includes(pick) ? pick : moves[0]);
    }

    function finishRound(result, note = '') {
        gameActive = false;
        clearTimeout(botTimer);
        if (result === 'draw' && !state.winner) state.winner = 'draw';
        score[result === 'draw' ? 'draw' : result] += 1;
        history.push(result);
        updateActiveCard();
        updateBoardLock();
        renderSubBoards();
        boardFrame.classList.add('finished');
        if (state.line) {
            state.line.forEach((idx) => (state.variant === 'ultimate' ? subBoards : cells)[idx].classList.add('winning-cell'));
            drawWinLine();
        }

        const humanLost = prefs.mode === 'bot' && result === 'O';
        let title;
        if (result === 'draw') title = 'Berabere!';
        else if (prefs.mode === 'bot') title = result === 'X' ? 'Kazandın!' : `${player2Name} kazandı`;
        else title = `${nameOf(result)} kazandı!`;
        setStatus(note ? `${title} ${note}` : title, result === 'draw' ? 'draw' : `win-${result.toLowerCase()}`);
        resetBtnText.textContent = 'Sonraki Raunt';
        resetBtn.classList.add('primary');

        if (result === 'draw') sfx.draw(); else if (humanLost) sfx.lose(); else sfx.win();

        if (result !== 'draw' && (prefs.mode === 'local' || result === 'X')) saveToLeaderboard(nameOf(result));
        if (typeof recordGameResult === 'function') recordGameResult('XOX', { won: result === 'X', score: 0 });

        // Result card
        const badge = $('result-badge');
        badge.replaceChildren();
        badge.className = `result-badge ${result === 'draw' ? 'draw' : result.toLowerCase()}`;
        if (result === 'draw') {
            badge.appendChild(markSvg('X', 'mini'));
            badge.appendChild(markSvg('O', 'mini'));
        } else badge.appendChild(markSvg(result));
        $('result-title').textContent = title;
        const detail = note || (result === 'draw' ? 'Kimse üçlüyü tamamlayamadı.' : humanLost ? 'Bir dahaki raunt senin olabilir.' : `${nameOf(result)} hattı tamamladı.`);
        $('result-detail').textContent = detail;
        $('result-series').innerHTML = '';
        const series = $('result-series');
        const mk = (cls, text) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; return s; };
        series.append(mk('rs-x', `${player1Name} ${score.X}`), mk('rs-sep', '–'), mk('rs-o', `${score.O} ${player2Name}`));
        renderScores();
        round += 1;
        resultTimer = setTimeout(() => {
            resultOverlay.classList.remove('hidden');
            $('next-round-btn').focus();
        }, state.line ? 900 : 450);
    }

    /* Keyboard: arrows move across the visual grid, Enter/Space plays. */
    function setFocus(i, move) {
        if (cells[focusIndex]) cells[focusIndex].tabIndex = -1;
        focusIndex = i;
        cells[i].tabIndex = 0;
        if (move) cells[i].focus();
    }

    function handleCellKey(e, i) {
        const steps = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
        if (steps[e.key]) {
            e.preventDefault();
            const n = gridSize();
            const [r, c] = toRC(i);
            const nr = Math.min(n - 1, Math.max(0, r + steps[e.key][0]));
            const nc = Math.min(n - 1, Math.max(0, c + steps[e.key][1]));
            setFocus(fromRC(nr, nc), true);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCellClick(i);
        }
    }

    /* ------------------------------------------------------------------ */
    /* Lobby                                                               */
    /* ------------------------------------------------------------------ */
    function loadPrefs() {
        try {
            const saved = JSON.parse(getCookieValue(PREFS_COOKIE) || '{}');
            if (['bot', 'local'].includes(saved.mode)) prefs.mode = saved.mode;
            if (['classic', 'four', 'ultimate'].includes(saved.variant)) prefs.variant = saved.variant;
            if (['easy', 'medium', 'hard'].includes(saved.difficulty)) prefs.difficulty = saved.difficulty;
            if (['x', 'o', 'alt'].includes(saved.first)) prefs.first = saved.first;
        } catch { /* defaults */ }
    }
    function savePrefs() {
        try { setCookieValue(PREFS_COOKIE, JSON.stringify(prefs)); } catch { /* ignore */ }
    }

    function syncLobby() {
        const press = (selector, attr, value) => document.querySelectorAll(selector).forEach((b) => {
            const on = b.dataset[attr] === value;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', String(on));
        });
        press('[data-mode]', 'mode', prefs.mode);
        press('[data-variant]', 'variant', prefs.variant);
        press('[data-difficulty]', 'difficulty', prefs.difficulty);
        press('[data-first]', 'first', prefs.first);
        $('bot-difficulty-row').classList.toggle('hidden', prefs.mode !== 'bot');
        $('local-player2-row').classList.toggle('hidden', prefs.mode !== 'local');
        $('ultimate-hint').classList.toggle('hidden', prefs.variant !== 'ultimate');
        $('difficulty-hint').textContent = DIFF_HINTS[prefs.difficulty];
        const firstLabels = prefs.mode === 'bot' ? { x: 'Ben', o: 'Bot', alt: 'Sırayla' } : { x: 'X', o: 'O', alt: 'Sırayla' };
        document.querySelectorAll('[data-first]').forEach((b) => { b.textContent = firstLabels[b.dataset.first]; });
    }

    function bindChoice(attr) {
        document.querySelectorAll(`[data-${attr}]`).forEach((btn) => {
            btn.addEventListener('click', () => {
                prefs[attr] = btn.dataset[attr];
                syncLobby();
                savePrefs();
            });
        });
    }
    ['mode', 'variant', 'difficulty', 'first'].forEach(bindChoice);

    function prefillPlayerName() {
        const profile = window.CasualProfile?.current?.();
        if (profile?.displayName && !playerNameInput.value.trim()) {
            playerNameInput.value = profile.displayName;
            $('profile-hint').classList.remove('hidden');
        }
    }

    $('start-game-btn').addEventListener('click', () => {
        if (typeof playClickSound === 'function') playClickSound();
        player1Name = playerNameInput.value.trim() || 'Misafir';
        player2Name = prefs.mode === 'bot' ? `Bot · ${DIFF_NAMES[prefs.difficulty]}` : (player2NameInput.value.trim() || 'Oyuncu 2');
        $('label-x').textContent = player1Name;
        $('label-o').textContent = player2Name;
        $('label-x').title = player1Name;
        $('label-o').title = player2Name;
        score = { X: 0, O: 0, draw: 0 };
        history = [];
        round = 1;
        configMenu.classList.add('hidden');
        gameArea.classList.remove('hidden');
        container.classList.add('playing');
        startRound();
        cells[focusIndex].focus({ preventScroll: true });
    });

    $('back-to-lobby-btn').addEventListener('click', () => {
        if (typeof playClickSound === 'function') playClickSound();
        gameActive = false;
        clearTimeout(botTimer);
        clearTimeout(resultTimer);
        gameArea.classList.add('hidden');
        configMenu.classList.remove('hidden');
        container.classList.remove('playing', 'is-ultimate');
        $('start-game-btn').focus();
    });

    resetBtn.addEventListener('click', () => {
        if (typeof playClickSound === 'function') playClickSound();
        startRound();
    });
    $('next-round-btn').addEventListener('click', () => {
        if (typeof playClickSound === 'function') playClickSound();
        startRound();
        cells[focusIndex].focus({ preventScroll: true });
    });
    $('view-board-btn').addEventListener('click', () => {
        resultOverlay.classList.add('hidden');
        resetBtn.focus();
    });
    resultOverlay.addEventListener('click', (e) => {
        if (e.target === resultOverlay) resultOverlay.classList.add('hidden');
    });

    /* ------------------------------------------------------------------ */
    /* Leaderboard                                                         */
    /* ------------------------------------------------------------------ */
    function getLeaderboard() {
        try {
            const lb = JSON.parse(getCookieValue('cp_xox_leaderboard') || '{}');
            return lb && typeof lb === 'object' && !Array.isArray(lb) ? lb : {};
        } catch {
            return {};
        }
    }

    function saveToLeaderboard(winnerName) {
        if (window.CasualCheats?.active()) return;
        const lb = getLeaderboard();
        lb[winnerName] = (lb[winnerName] || 0) + 1;
        setCookieValue('cp_xox_leaderboard', JSON.stringify(lb));
    }

    function renderLeaderboard() {
        const content = $('leaderboard-content');
        content.replaceChildren();
        const sorted = Object.entries(getLeaderboard()).sort((a, b) => b[1] - a[1]);
        if (!sorted.length) {
            const p = document.createElement('p');
            p.className = 'lb-empty';
            p.textContent = 'Henüz hiç galibiyet yok. İlk galibiyeti sen al!';
            content.appendChild(p);
            return;
        }
        sorted.forEach(([name, wins], index) => {
            const row = document.createElement('div');
            row.className = 'lb-row';
            const player = document.createElement('span');
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
            player.textContent = `${medal} ${name}`;
            const total = document.createElement('span');
            total.className = 'lb-wins';
            total.textContent = `${wins} galibiyet`;
            row.append(player, total);
            content.appendChild(row);
        });
    }

    function closeLeaderboard() {
        if (leaderboardModal.classList.contains('hidden')) return;
        leaderboardModal.classList.add('hidden');
        showLeaderboardBtn.focus();
    }
    showLeaderboardBtn.addEventListener('click', () => {
        renderLeaderboard();
        leaderboardModal.classList.remove('hidden');
        closeLeaderboardBtn.focus();
    });
    closeLeaderboardBtn.addEventListener('click', closeLeaderboard);
    leaderboardModal.addEventListener('click', (event) => {
        if (event.target === leaderboardModal) closeLeaderboard();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        closeLeaderboard();
        if (!resultOverlay.classList.contains('hidden')) resultOverlay.classList.add('hidden');
    });

    loadPrefs();
    syncLobby();
    prefillPlayerName();

    // Read-only hooks for automated tests.
    if (/[?&]debug\b/.test(location.search)) {
        window.XoxDebug = {
            state: () => JSON.parse(JSON.stringify(state)),
            current: () => current,
            active: () => gameActive,
            score: () => ({ ...score }),
            legal: () => (state ? legalMoves(state) : []),
            bestFor: (p, level = 'hard') => chooseBotMove(state, p, legalMoves(state), level)
        };
    }
});
