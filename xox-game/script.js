document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    let mode = 'bot', variant = 'classic', difficulty = 'easy', first = 'x';
    let boards, claims, turn, active = false, forced = -1, timer, round = 1;
    let names = {}, scores = { X: 0, O: 0, draw: 0 }, results = [];
    const lines = size => {
        const all = [];
        for (let i = 0; i < size; i++) {
            all.push(Array.from({ length: size }, (_, j) => i * size + j));
            all.push(Array.from({ length: size }, (_, j) => j * size + i));
        }
        all.push(Array.from({ length: size }, (_, i) => i * (size + 1)));
        all.push(Array.from({ length: size }, (_, i) => (i + 1) * (size - 1)));
        return all;
    };
    const winner = (b, n) => lines(n).find(line => b[line[0]] && b[line[0]] !== 'draw' && line.every(i => b[i] === b[line[0]]));
    const size = () => variant === 'four' ? 4 : 3;
    const immortal = () => Boolean(window.CasualCheats?.immortal());
    const cheat = () => Boolean(window.CasualCheats?.active());
    function legal() {
        const moves = [];
        boards.forEach((b, bi) => {
            if (claims[bi] || (forced >= 0 && bi !== forced)) return;
            b.forEach((v, i) => { if (!v) moves.push([bi, i]); });
        });
        return moves;
    }
    function preview(bi, i, player) {
        const b = boards[bi].slice(); b[i] = player;
        const win = winner(b, size());
        if (variant !== 'ultimate') return Boolean(win);
        if (!win) return false;
        const c = claims.slice(); c[bi] = player;
        return Boolean(winner(c, 3));
    }
    function render() {
        const cells = $('board').querySelectorAll('.cell');
        const botTurn = mode === 'bot' && turn === 'O';
        cells.forEach(cell => {
            const bi = Number(cell.dataset.board), i = Number(cell.dataset.index), v = boards[bi][i];
            const unavailable = Boolean(claims[bi]) || (forced >= 0 && forced !== bi);
            cell.className = `cell${v ? ` occupied ${v.toLowerCase()}` : ''}`;
            cell.disabled = !active || botTurn || Boolean(v) || unavailable;
            cell.setAttribute('aria-label', `${variant === 'ultimate' ? `Tahta ${bi + 1}, ` : ''}satır ${Math.floor(i / size()) + 1}, sütun ${i % size() + 1}: ${v || 'boş'}`);
        });
        $('board').querySelectorAll('.mini-board').forEach((el, bi) => {
            el.classList.toggle('available', active && !claims[bi] && (forced < 0 || forced === bi));
            el.dataset.claim = claims[bi] === 'draw' ? '—' : claims[bi] || '';
            el.classList.toggle('claimed', Boolean(claims[bi]));
            el.setAttribute('aria-label', `Küçük tahta ${bi + 1}${claims[bi] ? `: ${claims[bi] === 'draw' ? 'berabere' : claims[bi] + ' kazandı'}` : ''}`);
        });
        $('board').classList.toggle('locked', !active || botTurn);
        $('board').setAttribute('aria-busy', String(active && botTurn));
        document.querySelector('.x-score').classList.toggle('active', active && turn === 'X');
        document.querySelector('.o-score').classList.toggle('active', active && turn === 'O');
        if (active) $('status').textContent = `${botTurn ? 'Bot düşünüyor…' : `Sıra: ${names[turn]}`}${variant === 'ultimate' ? forced < 0 ? ' · Serbest tahta' : ` · ${forced + 1}. tahta` : ''}`;
    }
    function finish(result, note) {
        active = false; clearTimeout(timer);
        scores[result]++; results.push(result);
        ['X', 'O'].forEach(p => $(`score-${p.toLowerCase()}`).textContent = scores[p]);
        $('score-draw').textContent = scores.draw;
        const title = result === 'draw' ? 'Berabere!' : `${names[result]} kazandı!`;
        $('status').textContent = title;
        $('result-title').textContent = title;
        $('result-badge').textContent = result === 'draw' ? '=' : result;
        $('result-detail').textContent = note || `${round}. raunt tamamlandı.`;
        $('result-series').textContent = `${scores.X} — ${scores.O} · ${scores.draw} beraberlik`;
        $('round-history').replaceChildren(...results.slice(-12).map((p, i) => {
            const el = document.createElement('li'); el.textContent = p === 'draw' ? '=' : p;
            el.title = `${Math.max(1, results.length - 11) + i}. raunt: ${p === 'draw' ? 'berabere' : names[p]}`; return el;
        }));
        $('result-overlay').classList.remove('hidden');
        $('reset-btn').querySelector('.btn-text').textContent = 'Sonraki raunt';
        render(); $('next-round-btn').focus();
        if (!cheat()) {
            if (typeof recordGameResult === 'function') recordGameResult('XOX', { won: result === 'X', score: 0 });
            if (result !== 'draw' && (mode === 'local' || result === 'X')) {
                const lb = leaderboard();
                Object.defineProperty(lb, names[result], { value: (Number(Object.prototype.hasOwnProperty.call(lb, names[result]) ? lb[names[result]] : 0) || 0) + 1, enumerable: true, configurable: true, writable: true });
                setCookieValue('cp_xox_leaderboard', JSON.stringify(lb));
            }
        }
    }
    function play(bi, i, fromBot = false) {
        if (!active || (mode === 'bot' && turn === 'O' && !fromBot) || !legal().some(m => m[0] === bi && m[1] === i)) return;
        if (immortal() && (mode === 'local' || turn === 'O') && preview(bi, i, turn)) {
            $('status').textContent = 'Ölümsüzlük: kazandıran kare engellendi. Başka kare seç.';
            if (legal().every(m => preview(...m, turn))) finish('draw', 'Ölümsüzlük: kazandıran kareler engellendi.');
            return;
        }
        boards[bi][i] = turn;
        if (typeof playClickSound === 'function') playClickSound();
        const line = winner(boards[bi], size());
        if (line) claims[bi] = turn;
        else if (boards[bi].every(Boolean)) claims[bi] = 'draw';
        const won = variant === 'ultimate' ? winner(claims, 3) : line;
        if (won) { finish(turn); return; }
        if (claims.every(Boolean)) { finish('draw'); return; }
        forced = variant === 'ultimate' && !claims[i] ? i : -1;
        turn = turn === 'X' ? 'O' : 'X'; render(); scheduleBot();
    }
    // Exact search for classic; larger boards use bounded positional/tactical search.
    function classicScore(b, player) {
        const win = winner(b, 3);
        if (win) return b[win[0]] === 'O' ? 10 : -10;
        if (b.every(Boolean)) return 0;
        const values = [];
        b.forEach((v, i) => { if (!v) { b[i] = player; values.push(classicScore(b, player === 'O' ? 'X' : 'O')); b[i] = ''; } });
        return player === 'O' ? Math.max(...values) : Math.min(...values);
    }
    function chooseBot(moves) {
        const random = () => moves[Math.floor(Math.random() * moves.length)];
        if (difficulty === 'easy') return random();
        for (const p of ['O', 'X']) {
            const win = moves.find(m => preview(...m, p)); if (win) return win;
        }
        if (difficulty === 'hard' && variant === 'classic') {
            return moves.reduce((best, m) => {
                const b = boards[0].slice(); b[m[1]] = 'O'; const score = classicScore(b, 'X');
                return !best || score > best.score ? { move: m, score } : best;
            }, null).move;
        }
        if (difficulty === 'hard') {
            const ranked = moves.map(m => {
                const [bi, i] = m, b = boards[bi].slice(); b[i] = 'O';
                let value = Math.random();
                if (winner(b, size())) value += 40;
                const block = boards[bi].slice(); block[i] = 'X'; if (winner(block, size())) value += 25;
                for (const line of lines(size()).filter(l => l.includes(i))) {
                    if (!line.some(j => b[j] === 'X')) value += line.filter(j => b[j] === 'O').length * 2;
                }
                if (variant === 'ultimate' && claims[i]) value -= 8;
                return { move: m, value };
            });
            ranked.sort((a, b) => b.value - a.value); return ranked[0].move;
        }
        return random();
    }
    function scheduleBot() {
        clearTimeout(timer);
        if (!active || mode !== 'bot' || turn !== 'O') return;
        timer = setTimeout(() => {
            if (!active || mode !== 'bot' || turn !== 'O') return;
            const moves = legal().filter(m => !immortal() || !preview(...m, 'O'));
            if (!moves.length) { finish('draw', 'Kazandıran kareler engellendi.'); return; }
            play(...chooseBot(moves), true);
        }, 350);
    }
    function startRound() {
        clearTimeout(timer); forced = -1; active = true;
        boards = Array.from({ length: variant === 'ultimate' ? 9 : 1 }, () => Array(size() ** 2).fill(''));
        claims = Array(boards.length).fill('');
        turn = first === 'o' || (first === 'alt' && round % 2 === 0) ? 'O' : 'X';
        $('board').replaceChildren(); $('board').className = `board ${variant}`;
        boards.forEach((b, bi) => {
            const parent = variant === 'ultimate' ? document.createElement('div') : $('board');
            if (variant === 'ultimate') { parent.className = 'mini-board'; parent.setAttribute('role', 'group'); $('board').appendChild(parent); }
            b.forEach((_, i) => {
                const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'cell';
                cell.dataset.board = bi; cell.dataset.index = i; cell.setAttribute('role', 'gridcell');
                cell.addEventListener('click', () => play(bi, i)); parent.appendChild(cell);
            });
        });
        $('round-label').textContent = `${round}. raunt`;
        $('result-overlay').classList.add('hidden');
        $('reset-btn').querySelector('.btn-text').textContent = 'Raundu yeniden başlat';
        render(); scheduleBot();
        $('board').querySelector('.cell:not(:disabled)')?.focus();
    }
    for (const [attr, update] of Object.entries({ mode: v => { mode = v; $('local-player2-row').classList.toggle('hidden', v !== 'local'); $('bot-difficulty-row').classList.toggle('hidden', v !== 'bot'); document.querySelector('[data-first="o"]').textContent = v === 'bot' ? 'Bot' : 'Oyuncu 2'; }, variant: v => { variant = v; $('ultimate-hint').classList.toggle('hidden', v !== 'ultimate'); }, difficulty: v => { difficulty = v; $('difficulty-hint').textContent = v === 'easy' ? 'Kolay: rastgele oynar.' : v === 'medium' ? 'Orta: kazanmayı ve engellemeyi dener.' : 'Zor: klasikte kusursuz, büyük tahtalarda taktiksel oynar.'; }, first: v => { first = v; } })) {
        const buttons = document.querySelectorAll(`[data-${attr}]`);
        buttons.forEach(btn => btn.addEventListener('click', () => { buttons.forEach(b => { b.classList.toggle('active', b === btn); b.setAttribute('aria-pressed', String(b === btn)); }); update(btn.dataset[attr]); }));
    }
    $('start-game-btn').addEventListener('click', () => {
        names = { X: $('player-name-input').value.trim() || 'Misafir', O: mode === 'bot' ? 'Bot' : $('player2-name-input').value.trim() || 'Oyuncu 2' };
        scores = { X: 0, O: 0, draw: 0 }; results = []; round = 1;
        ['X', 'O'].forEach(p => { $(`label-${p.toLowerCase()}`).textContent = names[p]; $(`score-${p.toLowerCase()}`).textContent = '0'; });
        $('score-draw').textContent = '0'; $('round-history').replaceChildren();
        $('config-menu').classList.add('hidden'); $('game-area').classList.remove('hidden'); startRound();
    });
    const next = () => { if (!active) round++; startRound(); };
    $('reset-btn').addEventListener('click', next); $('next-round-btn').addEventListener('click', next);
    $('view-board-btn').addEventListener('click', () => { $('result-overlay').classList.add('hidden'); $('reset-btn').focus(); });
    $('back-to-lobby-btn').addEventListener('click', () => { active = false; clearTimeout(timer); $('game-area').classList.add('hidden'); $('config-menu').classList.remove('hidden'); $('start-game-btn').focus(); });
    $('board').addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        const cells = [...$('board').querySelectorAll('.cell')];
        const index = cells.indexOf(document.activeElement), cols = variant === 'four' ? 4 : 3;
        const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
        for (let n = 1; n <= cells.length; n++) { const c = cells[(index + step * n + cells.length * n) % cells.length]; if (!c.disabled) { c.focus(); break; } }
    });
    function leaderboard() {
        try { const lb = JSON.parse(getCookieValue('cp_xox_leaderboard') || '{}'); return lb && typeof lb === 'object' && !Array.isArray(lb) ? lb : {}; } catch { return {}; }
    }
    $('show-leaderboard-btn').addEventListener('click', () => {
        const entries = Object.entries(leaderboard()).filter(([, n]) => Number.isFinite(n) && n > 0).sort((a, b) => b[1] - a[1]);
        $('leaderboard-content').replaceChildren();
        entries.forEach(([name, count], i) => { const row = document.createElement('div'); row.className = 'lb-row'; const label = document.createElement('span'); label.textContent = `${i + 1}. ${name}`; const wins = document.createElement('span'); wins.className = 'lb-wins'; wins.textContent = `${count} galibiyet`; row.append(label, wins); $('leaderboard-content').appendChild(row); });
        if (!entries.length) $('leaderboard-content').textContent = 'Henüz galibiyet yok.';
        $('leaderboard-modal').classList.remove('hidden'); $('close-leaderboard-btn').focus();
    });
    const close = () => { $('leaderboard-modal').classList.add('hidden'); $('show-leaderboard-btn').focus(); };
    $('close-leaderboard-btn').addEventListener('click', close);
    $('leaderboard-modal').addEventListener('click', e => { if (e.target === $('leaderboard-modal')) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('leaderboard-modal').classList.contains('hidden')) close(); });
    const profile = window.CasualProfile?.current?.();
    if (profile?.displayName) { $('player-name-input').value = profile.displayName; $('profile-hint').classList.remove('hidden'); }
});
