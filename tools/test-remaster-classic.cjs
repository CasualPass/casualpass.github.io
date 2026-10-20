const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

// Small DOM adapter runs the actual page controllers; no engine copy in the tests.
function fixture(folder, expose = '') {
    const elements = new Map(), scheduled = new Map(), writes = new Map(), results = [];
    let nextTimer = 1;
    class Element {
        constructor(tag = 'div') { this.tagName = tag; this.children = []; this.listeners = {}; this.dataset = {}; this.style = {}; this.attributes = {}; this.className = ''; this.textContent = ''; this.value = ''; }
        get classList() { const self = this; return {
            contains: n => self.className.split(/\s+/).includes(n),
            add: (...names) => { self.className = [...new Set([...self.className.split(/\s+/), ...names])].join(' '); },
            remove: (...names) => { self.className = self.className.split(/\s+/).filter(n => !names.includes(n)).join(' '); },
            toggle(n, on) { const value = on === undefined ? !this.contains(n) : on; this[value ? 'add' : 'remove'](n); return value; }
        }; }
        appendChild(el) { el.parentElement = this; this.children.push(el); if (el.id) elements.set(el.id, el); return el; }
        append(...els) { els.forEach(el => this.appendChild(el)); }
        replaceChildren(...els) { this.children = []; this.append(...els); }
        remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(el => el !== this); }
        setAttribute(k, v) { this.attributes[k] = String(v); }
        getAttribute(k) { return this.attributes[k]; }
        addEventListener(k, fn) { (this.listeners[k] ||= []).push(fn); }
        emit(k, event = {}) { for (const fn of this.listeners[k] || []) fn({ target: this, preventDefault() {}, ...event }); }
        click() { if (!this.disabled) this.emit('click'); }
        focus() { document.activeElement = this; }
        closest() { return null; }
        contains(el) { return this === el || this.children.some(c => c.contains(el)); }
        querySelectorAll(selector) {
            const all = this.children.flatMap(c => [c, ...c.querySelectorAll('*')]);
            if (selector === '*') return all;
            const cls = selector.match(/^\.([\w-]+)/)?.[1];
            return all.filter(el => (!cls || el.classList.contains(cls)) && (!selector.includes(':not(:disabled)') || !el.disabled));
        }
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
        set innerHTML(value) { this.children = []; }
    }
    const html = fs.readFileSync(path.join(root, folder, 'index.html'), 'utf8');
    for (const [, id] of html.matchAll(/id="([^"]+)"/g)) { const e = new Element(); e.id = id; elements.set(id, e); }
    const document = new Element(), window = new Element();
    document.getElementById = id => { assert.ok(elements.has(id), `missing #${id}`); return elements.get(id); };
    document.createElement = tag => new Element(tag);
    document.querySelectorAll = selector => {
        if (selector.startsWith('[data-')) return [];
        return [...elements.values()].filter(e => e.classList.contains(selector.slice(1)));
    };
    const x = new Element(); x.className = 'x-score'; elements.set('_x', x);
    const o = new Element(); o.className = 'o-score'; elements.set('_o', o);
    document.querySelector = selector => document.querySelectorAll(selector)[0];
    for (const id of ['reset-btn']) { const child = new Element(); child.className = 'btn-text'; elements.get(id)?.appendChild(child); }
    if (elements.has('score')) { const card = new Element(); card.appendChild(elements.get('score')); }
    if (elements.has('bot-difficulty')) elements.get('bot-difficulty').value = '2';
    const context = vm.createContext({ document, window, console, Math, getCookieValue: name => writes.get(name) || '', setCookieValue: (name, value) => writes.set(name, value), cheatsActive: () => false, recordGameResult: (name, result) => results.push({ name, ...result }), setTimeout: (fn, ms) => { const id = nextTimer++; scheduled.set(id, { fn, ms }); return id; }, clearTimeout: id => scheduled.delete(id), setInterval() {}, requestAnimationFrame: fn => fn() });
    if (folder === 'chess-game') vm.runInContext(fs.readFileSync(path.join(root, folder, 'vendor/chess.js'), 'utf8'), context);
    let source = fs.readFileSync(path.join(root, folder, 'script.js'), 'utf8');
    if (expose) source = source.replace(/\}\);\s*$/, expose + '\n});');
    vm.runInContext(source, context); document.emit('DOMContentLoaded');
    return { context, document, window, elements, scheduled, writes, results, flush(ms) { const run = [...scheduled].filter(([, t]) => t.ms === ms); run.forEach(([id, t]) => { scheduled.delete(id); t.fn(); }); } };
}

test('2048 real slide merges once, undo restores pre-spawn board and save, personal best survives undo', () => {
    const f = fixture('2048-game', 'window.test = { move, undoMove, restoreRun, state: () => ({grid: cells.map(r => r.map(t => t ? t.value : 0)), score, moves}) };');
    const initial = { grid: [[2, 2, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], score: 0, moves: 0 };
    f.window.test.restoreRun(JSON.stringify(initial)); f.window.test.move('left');
    assert.equal(f.elements.get('undo-btn').disabled, true);
    f.flush(120);
    const state = f.window.test.state();
    assert.deepEqual(Array.from(state.grid[0]).slice(0, 2), [4, 4]); assert.equal(state.score, 8); assert.equal(state.moves, 1);
    assert.equal(f.elements.get('undo-btn').disabled, false);
    f.window.test.undoMove();
    assert.deepEqual(JSON.parse(JSON.stringify(f.window.test.state())), initial);
    assert.equal(JSON.parse(f.writes.get('cp_2048_run')).moves, 0);
    assert.equal(f.elements.get('undo-btn').disabled, true);
    assert.equal(f.writes.get('cp_2048_best'), '8'); // undo never erases a personal best
});

test('XOX undo cancels pending bot reply and restores legal player turn; terminal results cannot be rewound', () => {
    const f = fixture('xox-game', 'window.test = { play, state: () => ({boards, turn, active}), local: () => { mode = "local"; }, start: () => { names = {X:"Ada", O:"Bot"}; startRound(); } };');
    f.window.test.start(); f.window.test.play(0, 0);
    assert.equal(f.window.test.state().turn, 'O'); assert.equal([...f.scheduled.values()].filter(t => t.ms === 350).length, 1);
    f.elements.get('undo-btn').click(); f.flush(350);
    assert.equal(f.window.test.state().turn, 'X'); assert.equal(f.window.test.state().boards[0].filter(Boolean).length, 0);
    f.window.test.local(); f.window.test.start();
    for (const i of [0, 3, 1, 4, 2]) f.window.test.play(0, i);
    assert.equal(f.window.test.state().active, false); assert.equal(f.results.length, 1);
    assert.equal(f.elements.get('undo-btn').disabled, true);
    assert.equal(f.elements.get('board').querySelectorAll('.winning-cell').length, 3);
    f.elements.get('undo-btn').click(); assert.equal(f.results.length, 1);
});

test('XOX undo after bot answer restores both plies; hard classic bot blocks immediate win', () => {
    const f = fixture('xox-game', 'window.test = { play, state: () => ({boards, turn}), start: () => { names = {X:"Ada", O:"Bot"}; startRound(); }, tactical: () => { difficulty="hard"; boards=[["X","X","","","O","","","",""]]; claims=[""]; turn="O"; return chooseBot(legal()); } };');
    f.window.test.start(); f.window.test.play(0, 0); f.flush(350);
    assert.equal(f.window.test.state().boards[0].filter(Boolean).length, 2);
    f.elements.get('undo-btn').click(); assert.equal(f.window.test.state().boards[0].filter(Boolean).length, 0);
    assert.deepEqual(Array.from(f.window.test.tactical()), [0, 2]);
});

test('chess flip preserves FEN and maps arrow navigation to visual orientation; captures and material update', () => {
    const f = fixture('chess-game');
    vm.runInContext('gameEngine.move("e4"); gameEngine.move("d5"); gameEngine.move("exd5"); renderPieces();', f.context);
    assert.match(f.elements.get('capture-black').textContent, /♟/);
    assert.match(f.elements.get('material-summary').textContent, /Beyaz \+1/);
    const fen = vm.runInContext('gameEngine.fen()', f.context);
    f.elements.get('flip-board-btn').click();
    assert.equal(vm.runInContext('gameEngine.fen()', f.context), fen);
    assert.equal(f.elements.get('chessboard').children[0].children[0].id, 'h1');
    vm.runInContext('handleSquareKey({key:"ArrowRight",preventDefault(){}},"e2")', f.context);
    assert.equal(f.document.activeElement.id, 'd2');
    f.elements.get('flip-board-btn').click();
    assert.equal(f.elements.get('chessboard').children[0].children[0].id, 'a8');
});


test('Ultimate undo restores the forced board and releases the cancelled bot move', () => {
    const f = fixture('xox-game', 'window.test = { play, state: () => ({boards, forced, turn}), start: () => { variant="ultimate"; names={X:"Ada",O:"Bot"}; startRound(); } };');
    f.window.test.start(); f.window.test.play(0, 4);
    assert.equal(f.window.test.state().forced, 4);
    f.window.test.play(3, 0);
    assert.equal(f.window.test.state().boards[3][0], '');
    f.elements.get('undo-btn').click(); f.flush(350);
    assert.equal(f.window.test.state().forced, -1);
    assert.equal(f.window.test.state().turn, 'X');
    assert.equal(f.window.test.state().boards.flat().filter(Boolean).length, 0);
});

test('2048 recorded winning result disables undo and remains a single recorded game', () => {
    const f = fixture('2048-game', 'window.test = { move, restoreRun };');
    f.window.test.restoreRun(JSON.stringify({grid:[[1024,1024,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],score:0,moves:0}));
    f.window.test.move('left'); f.flush(120);
    assert.equal(f.results.length, 1); assert.equal(f.results[0].won, true);
    assert.equal(f.elements.get('undo-btn').disabled, true);
    f.document.emit('keydown', { key:'u' });
    assert.equal(f.results.length, 1);
    assert.equal(JSON.parse(f.writes.get('cp_2048_run')).won, true);
});
