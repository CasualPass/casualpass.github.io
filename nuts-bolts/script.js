/* Cookie-only progress; the common backup includes cp_nuts_v1 automatically. */
(() => {
    'use strict';
    const E = window.NutsEngine;
    const $ = id => document.getElementById(id);
    const palette = ['#eb657b','#60a9f5','#e9b84c','#56c7a1','#ad85ed','#ef914f','#5dcddd','#d986b6'];
    const symbols = ['●','◆','▲','✚','★','■','✦','♥'];
    const names = ['Mercan','Mavi','Sarı','Yeşil','Mor','Turuncu','Turkuaz','Pembe'];
    let level = 1, board, moves = 0, selected = -1, history = [], completed = [], tainted = false;
    let pendingReset = false, hintPair = null;
    const clone = b => b.map(stack => stack.slice());
    function persist() {
        tainted ||= cheatsActive();
        if (!tainted) setCookieValue('cp_nuts_v1', JSON.stringify({ level, board, moves, completed }));
    }
    function restore() {
        try {
            const saved = JSON.parse(getCookieValue('cp_nuts_v1') || 'null');
            if (!saved || !Number.isInteger(saved.level) || saved.level < 1 || saved.level > 30 || !E.validateBoard(saved.board, saved.level)) return false;
            level = saved.level; board = clone(saved.board);
            moves = Number.isSafeInteger(saved.moves) && saved.moves >= 0 && saved.moves <= 999999 ? saved.moves : 0;
            completed = Array.isArray(saved.completed) ? [...new Set(saved.completed.filter(n => Number.isInteger(n) && n >= 1 && n <= 30))] : [];
            return true;
        } catch { return false; }
    }
    function say(text) { $('message').textContent = text; }
    function start(number) {
        level = number; board = E.createLevel(level).bolts; moves = 0; selected = -1; history = []; pendingReset = false; hintPair = null;
        tainted = cheatsActive();
        persist(); render(); say('Bir cıvata seç, sonra somunu taşıyacağın cıvataya dokun.');
    }
    function render(focusIndex) {
        $('level').value = String(level);
        const sorted=board.filter(stack=>stack.length===4&&stack.every(c=>c===stack[0])).length;
        $('sorted').textContent=`${sorted} / ${E.colorsForLevel(level)} renk tamam · ${E.colorsForLevel(level)<=4?'Renk atölyesi':'Usta atölyesi'}`;
        $('hint').disabled=E.isSolved(board);
        $('level-title').textContent = `${String(level).padStart(2, '0')} · ${level <= 5 ? 'İlk adımlar' : level <= 15 ? 'Renk ustası' : 'Usta atölyesi'}`;
        $('progress').textContent = `${level} / 30`;
        $('moves').textContent = moves;
        $('completed').textContent = `${completed.length} / 30 bölüm tamamlandı`;
        $('undo').disabled = !history.length;
        $('next').hidden = !E.isSolved(board) || level === 30;
        $('restart').textContent = pendingReset ? 'Sıfırlamak için tekrar bas' : '↻ Yeniden başla';
        const container = $('board'); container.replaceChildren();
        board.forEach((stack, i) => {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'bolt';
            if (i === selected) button.classList.add('selected');
            if(hintPair?.[0]===i) button.classList.add('hint-source');
            if(hintPair?.[1]===i) button.classList.add('hint-target');
            if (selected !== -1 && E.move(board, selected, i)) button.classList.add('valid');
            if (stack.length === 4 && stack.every(c => c === stack[0])) button.classList.add('solved');
            button.setAttribute('aria-pressed', String(i === selected));
            button.setAttribute('aria-label', `Cıvata ${i + 1}: ${stack.length ? stack.slice().reverse().map(c => names[c]).join(', ') + ' (üstten alta)' : 'boş'}. ${stack.length}/4 somun`);
            stack.forEach((color, slot) => {
                const nut = document.createElement('span'); nut.className = 'nut'; nut.setAttribute('aria-hidden','true');
                nut.style.setProperty('--color', palette[color]); nut.style.setProperty('--slot', slot);
                const symbol = document.createElement('span'); symbol.textContent = symbols[color]; nut.append(symbol); button.append(nut);
            });
            const number = document.createElement('span'); number.className = 'bolt-number'; number.textContent = `${i + 1}${button.classList.contains('solved') ? ' ✓' : ''}`; number.setAttribute('aria-hidden','true'); button.append(number);
            button.addEventListener('click', () => choose(i)); container.append(button);
        });
        if (focusIndex !== undefined) container.children[focusIndex]?.focus({ preventScroll: true });
    }
    function choose(i) {
        hintPair = null;
        if (E.isSolved(board)) return;
        pendingReset = false;
        if (selected === i) { selected = -1; render(i); say('Seçim kaldırıldı.'); return; }
        if (selected === -1) {
            if (!board[i].length) { say('Bu cıvata boş. Önce somun bulunan bir cıvata seç.'); return; }
            selected = i; render(i); say('Kesik çizgili cıvatalara taşıyabilirsin.'); return;
        }
        const next = E.move(board, selected, i);
        if (!next) { if(typeof playHaptic==='function')playHaptic('fail'); say(board[i].length === 4 ? 'Bu cıvata dolu. Başka bir hedef seç.' : 'Yalnızca aynı rengin üstüne veya boş cıvataya taşıyabilirsin.'); return; }
        history.push({ board: clone(board), moves });
        if (history.length > 500) history.shift();
        board = next; moves += 1; selected = -1;
        if(typeof playHaptic==='function')playHaptic(E.isSolved(board)?'win':'move');
        tainted ||= cheatsActive();
        if (E.isSolved(board)) {
            if (!tainted && !completed.includes(level)) {
                completed.push(level); recordGameResult('Nuts & Bolts', { won: true, score: level });
            }
            say(level === 30 ? 'Harika! Son bölümü de çözdün. İstediğin bölümü yeniden oynayabilirsin.' : `Tertemiz! Bölümü ${moves} hamlede tamamladın.`);
        } else say(E.legalMoves(board).length ? 'Güzel! Sıradaki somunu seç.' : 'Geçerli hamle kalmadı. Geri alabilir veya bölümü yeniden başlatabilirsin.');
        persist(); render(i);
        if (E.isSolved(board) && level < 30) $('next').focus({preventScroll:true});
    }
    for (let n = 1; n <= 30; n++) {
        const option = document.createElement('option'); option.value = n; option.textContent = `Bölüm ${n}`; $('level').append(option);
    }
    $('hint').addEventListener('click',()=>{
        const solution=E.solve(board,3000);
        selected=-1;hintPair=solution?.[0]||null;render();
        say(hintPair?`İpucu: ${hintPair[0]+1}. cıvatadan ${hintPair[1]+1}. cıvataya bir somun taşı.`:'Bu konum için kısa sürede çözüm bulunamadı. Geri al veya yeniden başla.');
    });
    $('level').addEventListener('change', () => start(Number($('level').value)));
    $('next').addEventListener('click', () => { if (E.isSolved(board) && level < 30) start(level + 1); });
    $('restart').addEventListener('click', () => {
        if (moves && !pendingReset && !E.isSolved(board)) { pendingReset = true; render(); say('İlerlemen sıfırlanacak. Onaylamak için yeniden başla düğmesine tekrar bas.'); return; }
        start(level);
    });
    $('undo').addEventListener('click', () => {
        const old = history.pop(); if (!old) return;
        board = old.board; moves = old.moves; selected = -1; pendingReset = false;
        persist(); render(); say('Son hamle geri alındı.');
    });
    document.addEventListener('keydown', event => { if(!event.target?.closest('input,select,textarea')&&!event.ctrlKey&&!event.metaKey&&/^[0-9]$/.test(event.key)){ const i=event.key==='0'?9:Number(event.key)-1;if(i<board.length){event.preventDefault();choose(i);} } if (event.key === 'Escape') { selected = -1; pendingReset = false; render(); say('Seçim kaldırıldı.'); } });
    window.addEventListener('casual-cheat', () => { tainted = true; say('Hile oturumunda ilerleme kaydedilmez.'); });
    if (!restore()) start(1);
    else { tainted = cheatsActive(); render(); if (E.isSolved(board)) say('Bu bölüm tamamlandı. Sıradaki bölüme geçebilirsin.'); }
})();
