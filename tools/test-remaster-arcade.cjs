'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the shipped page scripts. Test-only closure access avoids adding debug
// setters to production; DOM/canvas/audio are inert so rules and input are isolated.
function page(folder, expose) {
    const elements = new Map(), timers = new Map(), cookies = new Map(), rewards = [];
    let id = 0;
    const gradient = { addColorStop() {} };
    const context = new Proxy({}, { get: (target, key) => target[key] ?? (key.startsWith('create') ? () => gradient : () => {}), set: (target, key, value) => (target[key] = value, true) });
    class Element {
        constructor() {
            this.listeners = {}; this.style = {}; this.dataset = {}; this.value = ''; this.checked = true; this.width = 540; this.height = 780; this.clientWidth = 400; this.tagName = 'DIV';
            const classes = new Set();
            this.classList = { add: (...v) => v.forEach(x => classes.add(x)), remove: (...v) => v.forEach(x => classes.delete(x)), contains: x => classes.has(x), toggle(x, on = !classes.has(x)) { on ? classes.add(x) : classes.delete(x); } };
        }
        addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
        emit(name, event = {}) { (this.listeners[name] || []).forEach(fn => fn(event)); }
        getContext() { return context; }
        getBoundingClientRect() { return { left: 0, top: 0, width: 540, height: 780 }; }
        setAttribute() {} getAttribute() { return ''; }
        querySelectorAll() { return []; }
        append() {} replaceChildren() {} focus() {} scrollIntoView() {} contains() { return true; }
    }
    const get = key => { if (!elements.has(key)) elements.set(key, new Element()); return elements.get(key); };
    const document = new Element();
    Object.assign(document, { getElementById: get, createElement: () => new Element(), querySelectorAll: () => [], body: new Element() });
    const sandbox = {
        document, console, HTMLElement: Element, HTMLButtonElement: class extends Element {}, HTMLAnchorElement: class extends Element {},
        performance: { now: () => 1000 }, requestAnimationFrame() {},
        setTimeout: fn => (timers.set(++id, fn), id), clearTimeout: n => timers.delete(n), setInterval: () => ++id, clearInterval() {},
        getCookieValue: key => cookies.get(key), setCookieValue: (key, value) => cookies.set(key, value),
        getComputedStyle: () => ({ getPropertyValue: () => '' }), MutationObserver: class { observe() {} },
        cpSettings: { effects: false }, CasualSettings: { get: () => ({ sound: false }) },
        CasualProfile: { current: () => ({ displayName: 'Test', balance: 0 }), owls: {}, woods: {}, formatMoney: String,
            awardOwlFlight: x => (rewards.push(x), { reward: Math.min(40, Math.floor(x.score / 2)) }),
            awardBlocksGame: x => (rewards.push(x), { reward: Math.min(40, Math.floor(x.score / 50)) }),
            owlRewardForScore: x => Math.floor(x / 2), blocksRewardForScore: x => Math.floor(x / 50), OWL_REWARD_CAP: 40, BLOCKS_REWARD_CAP: 40 },
        CasualCheats: { active: () => false, immortal: () => false, features: () => false },
        addEventListener(name, fn) { document.addEventListener(`window:${name}`, fn); }, devicePixelRatio: 1
    };
    sandbox.window = sandbox;
    let source = fs.readFileSync(path.join(__dirname, '..', folder, 'script.js'), 'utf8');
    const close = folder === 'snake-game' ? '\n});' : '\n})();';
    const pos = source.lastIndexOf(close);
    source = source.slice(0, pos) + `\nwindow.testApi = { ${expose} };` + source.slice(pos);
    vm.runInNewContext(source, sandbox, { filename: `${folder}/script.js` });
    document.emit('DOMContentLoaded');
    return { api: sandbox.testApi, sandbox, get, timers, cookies, rewards, context };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('Snake buffered turns block reversal; live gold countdown freezes while paused', () => {
    const p = page('snake-game', `initGame, handleInput, update, draw, setPaused, setPlaying,
        state: () => ({ snake, dirQueue, velocity, ticks, score, paused, isGameOver }),
        setup: () => { snake = [{x:5,y:5},{x:4,y:5},{x:3,y:5}]; velocity = {x:1,y:0}; golden = true; food = {x:9,y:9}; foodUntil = ticks + fps * 7; }`);
    p.get('grid-size').value = '20'; p.get('speed-val').value = '12';
    p.api.setPlaying(true); p.api.initGame(); p.api.setup();
    p.api.handleInput('LEFT'); assert.equal(p.api.state().dirQueue.length, 0);
    p.api.handleInput('UP'); p.api.handleInput('LEFT'); p.api.handleInput('RIGHT');
    assert.deepEqual(plain(p.api.state().dirQueue), [{ x: 0, y: -1 }, { x: -1, y: 0 }]);
    p.api.update(); p.api.draw();
    assert.equal(p.get('run-direction').textContent, '←');
    assert.match(p.get('run-target').textContent, /Altın elma · 6\.9 sn/);
    const before = p.api.state().ticks;
    p.api.setPaused(true); p.api.update(); assert.equal(p.api.state().ticks, before);
    p.api.setPaused(false); p.api.update(); assert.equal(p.api.state().ticks, before + 1);
    assert.equal(p.api.state().isGameOver, false);
});

test('Owl phases ramp bounded difficulty and marked moving gaps stay inside playable edges', () => {
    const p = page('owl-game', `flightPhase, flightDifficulty, spawnColumn, startRun, flap, step, draw,
        setScore: value => { score = value; columns = []; }, state: () => ({ columns, mode, score, owlY, flightTime }),
        safeFlight: () => { mode = 'playing'; owlY = 330; vy = 0; }`);
    assert.equal(p.api.flightPhase(0).name, 'Alacakaranlık');
    assert.equal(p.api.flightPhase(12).name, 'Rüzgâr geçidi');
    assert.equal(p.api.flightPhase(24).name, 'Şafak');
    assert.deepEqual(plain(p.api.flightDifficulty(0)), { gap: 206, speed: 165, delta: 105 });
    assert.equal(p.api.flightDifficulty(10000).gap, 154);
    assert.equal(p.api.flightDifficulty(10000).speed, 245);
    p.api.setScore(24);
    for (let i = 0; i < 200; i++) p.api.spawnColumn(600 + i * 255);
    assert.ok(p.api.state().columns.some(c => c.amp > 0));
    for (const c of p.api.state().columns) {
        assert.ok(c.baseY - c.amp - c.gap / 2 >= 70 - 1e-9);
        assert.ok(c.baseY + c.amp + c.gap / 2 <= 656 - 70 + 1e-9);
    }
    p.api.safeFlight(); p.api.step(1 / 120); p.api.draw();
    assert.ok(p.api.state().columns.some(c => c.amp && c.gapY !== c.baseY));
    const time = p.api.state().flightTime;
    p.sandbox.document.emit('window:blur'); p.api.step(1 / 120);
    assert.equal(p.api.state().flightTime, time, 'moving columns freeze during pause');
});

test('Wood undo restores cleared cells, tray, score and streak exactly once per run', () => {
    const p = page('wood-blocks', `startRun, place, undoMove, render, finish,
        setup: () => { grid = emptyGrid(); for(let c=0;c<8;c++) grid[0][c]=1; tray = [makeShape([[0,0]]),makeShape([[0,0]]),makeShape([[0,0]])]; score=100; streak=2; grace=2; },
        state: () => ({ grid, tray, score, streak, grace, moves, undoUsed, mode })`);
    p.api.startRun(); assert.equal(p.api.undoMove(), false);
    p.api.setup(); const before = plain(p.api.state());
    assert.equal(p.api.place(0, 0, 0), false, 'illegal placement does not consume undo');
    assert.equal(p.api.place(0, 0, 8), true);
    assert.equal(p.api.state().score, 137, '1 placement + 18 × streak multiplier 2');
    assert.equal(p.api.state().grid[0].reduce((a, b) => a + b, 0), 0);
    p.api.render(1000);
    p.get('undo-btn').emit('click');
    const after = plain(p.api.state());
    for (const key of ['grid', 'tray', 'score', 'streak', 'grace', 'moves']) assert.deepEqual(after[key], before[key], key);
    assert.equal(after.undoUsed, true); assert.equal(p.get('undo-btn').disabled, true);
    assert.equal(p.api.undoMove(), false);
    assert.equal(p.api.place(0, 0, 8), true);
    assert.equal(p.api.undoMove(), false, 'another placement cannot replenish undo');
    p.api.startRun(); assert.equal(p.api.state().undoUsed, false);
});

test('Wood undo cancels delayed game over and restores the last dealt tray', () => {
    const p = page('wood-blocks', `startRun, place, undoMove,
        setup: () => { grid = emptyGrid(); tray = [makeShape([[0,0]]),null,null]; },
        forceEnding: () => { mode='ending'; overTimer = window.setTimeout(finish, 700); return overTimer; }, state: () => ({ tray, score, mode, undoUsed })`);
    p.api.startRun(); p.api.setup(); const tray = plain(p.api.state().tray);
    p.api.place(0, 4, 4); assert.equal(p.api.state().tray.filter(Boolean).length, 3);
    const pending = p.api.forceEnding(); assert.equal(p.timers.has(pending), true);
    assert.equal(p.api.undoMove(), true); assert.equal(p.timers.has(pending), false);
    assert.equal(p.api.state().mode, 'playing'); assert.equal(p.api.state().score, 0);
    assert.deepEqual(plain(p.api.state().tray), tray);
});

test('Owl and Wood preserve final reward payloads and suppress cheat rewards', () => {
    for (const folder of ['owl-game', 'wood-blocks']) {
        const p = page(folder, `finish, setScore: n => { score=n; }`);
        p.api.setScore(2100); p.api.finish();
        assert.deepEqual(plain(p.rewards), [{ score: 2100 }]);
        const cookie = folder === 'owl-game' ? 'cp_owl_best' : 'cp_blocks_best';
        assert.equal(p.cookies.get(cookie), '2100');
        p.sandbox.CasualCheats.active = () => true;
        p.api.setScore(9000); p.api.finish();
        assert.equal(p.rewards.length, 1); assert.equal(p.cookies.get(cookie), '2100');
    }
});


test('Owl ignores hidden helper focus but still pauses for real focus leaving the stage',()=>{
    const p=page('owl-game',`startRun, flap, state:()=>({mode})`);
    p.get('stage').contains=()=>false;
    p.sandbox.playHaptic=()=>p.sandbox.document.emit('focusin',{target:{closest:()=>({})}});
    p.api.startRun();p.api.flap();assert.equal(p.api.state().mode,'playing','helper focus must not interrupt flight');
    p.sandbox.document.emit('focusin',{target:{closest:()=>null}});assert.equal(p.api.state().mode,'paused','real focus loss must retain pause protection');
});
