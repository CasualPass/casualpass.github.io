'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function functionSource(source, name) {
    const start = source.indexOf(`    function ${name}(`);
    assert(start >= 0, `${name} exists`);
    let open = source.indexOf('{', start), depth = 1, end = open + 1;
    while (depth) { if (source[end] === '{') depth++; if (source[end] === '}') depth--; end++; }
    return source.slice(start, end);
}
for (const game of ['fps-game', 'vektor']) {
    const source = read(`${game}/script.js`);
    let now = 0;
    const calls = [];
    const context = vm.createContext({ performance: { now: () => now }, playHaptic: kind => calls.push(kind) });
    vm.runInContext(`let feedbackAt = -Infinity; ${functionSource(source, 'actionFeedback')}`, context);
    vm.runInContext(`actionFeedback('tap', 110)`, context);
    now = 50; vm.runInContext(`actionFeedback('tap', 110)`, context);
    now = 120; vm.runInContext(`actionFeedback('tap', 110)`, context);
    assert.deepEqual(calls, ['tap', 'tap'], `${game}: automatic fire is throttled`);
    const events = {}, windowEvents = {};
    const classes = new Set(); let captured = null;
    const b = { dataset: { act: 'fire' }, addEventListener: (type, fn) => events[type] = fn,
        classList: { add: c => classes.add(c), remove: c => classes.delete(c) },
        setPointerCapture: id => captured = id, hasPointerCapture: id => captured === id,
        releasePointerCapture: () => { captured = null; } };
    const player = { yaw: 0, pitch: 0, ads: false, weapon: 0 };
    const touch = { fire: false };
    let allowed = true, shots = 0;
    const ctx = vm.createContext({ document: { querySelectorAll: () => [b] }, window: { addEventListener: (type, fn) => windowEvents[type] = fn },
        performance: { now: () => 100 }, canAct: () => allowed, player, touch, prefs: { sens: 1 },
        clamp: (x,a,z) => Math.max(a,Math.min(z,x)), WEAPONS: [{ auto: false }], weaponOf: () => ({ auto: false }), tryShoot: () => shots++ });
    const start = source.indexOf("    document.querySelectorAll('.tbtn').forEach");
    const end = source.indexOf('    /* ---------- Menü olayları', start);
    vm.runInContext(source.slice(start, end), ctx);
    const event = (id, x=10, y=10) => ({ pointerId: id, clientX: x, clientY: y, preventDefault() {} });
    events.pointerdown(event(7));
    assert.equal(touch.fire, true); assert.equal(captured, 7); assert.equal(shots, 1);
    events.pointerdown(event(8)); assert.equal(captured, 7, 'second finger cannot steal fire');
    events.pointermove(event(7, 30, 20)); assert(player.yaw < 0 && player.pitch < 0, 'drag aims while firing');
    events.pointerup(event(8)); assert.equal(touch.fire, true, 'other finger does not release fire');
    events.pointercancel(event(7)); assert.equal(touch.fire, false); assert.equal(classes.has('held'), false);
    events.pointerdown(event(9)); windowEvents.blur(); assert.equal(touch.fire, false, 'blur stops fire');
    allowed = false; events.pointerdown(event(10)); assert.equal(touch.fire, false, 'inactive match cannot fire');
}
const wood = read('wood-turning/script.js');
function cut(precision) {
    const current = Array(200).fill(1);
    const context = vm.createContext({ precision, TOOLS: { rough: { half: 15, lift: () => 0 } }, BASE_CUT_RATE: 3.4, MIN_R: .06, N: 200,
        state: { tool: 'rough', tip: { x: 100, y: 50, side: 1 }, current, rough: [], sand: [], paintCov: [], spec: { profile: Array(200).fill(.5) } },
        L: { cy: 0, R: 100, len: 199 }, CasualProfile: { chisels: { steel: { speed: 1 } } }, selectedChisel: () => 'steel', sampleAtX: x => x,
        clamp: (x,a,z) => Math.max(a,Math.min(z,x)), toolFeedback() {}, $: () => ({ textContent: '' }), markGestureUsed() {}, updateMetrics() {}, radiusAtX: () => .8, emitChips() {} });
    vm.runInContext(functionSource(wood, 'carve') + '\ncarve(.02)', context);
    return 1 - current[100];
}
assert(cut(true) > 0 && cut(true) < cut(false) * .4, 'precision materially slows carving');
const callbacks = []; const nodes = {};
for (const id of ['liveScore','matchFill','sandCoverage','sandFill','next']) nodes[id] = { style: {}, dataset: {}, classList: { toggle() {} } };
let successes = 0;
const metrics = vm.createContext({ state: { stage: 'sand' }, el: nodes, requestAnimationFrame: cb => callbacks.push(cb),
    shapeScore: () => 12, sandScore: () => 95, paintScore: () => 33, toolFeedback: () => successes++, $: () => ({ textContent: '' }) });
vm.runInContext(`let metricsQueued = false, readyStage = ''; ${functionSource(wood, 'updateMetrics')} updateMetrics()`, metrics);
callbacks.shift()(); assert.equal(nodes.liveScore.textContent, '95%', 'sanding meter displays sanding progress');
vm.runInContext('updateMetrics()', metrics); callbacks.shift()(); assert.equal(successes, 1, 'ready feedback occurs once per stage');
console.log('Action remaster: haptic throttle, fire capture/aim/release/blur, precision cutting and sanding readiness passed.');
