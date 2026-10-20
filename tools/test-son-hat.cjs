const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../son-hat/script.js'), 'utf8');
function boot() {
    const nodes = new Map(), writes = [];
    function node() { return { value: '', textContent: '', innerHTML: '', hidden: false, style: { setProperty() {} }, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, focus() {}, addEventListener() {}, setAttribute() {}, appendChild() {}, querySelector: () => node(), getContext: () => ({}) }; }
    const document = { cookie: '', getElementById: id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); }, createElement: node, querySelectorAll: () => [] };
    Object.defineProperty(document, 'cookie', { get: () => '', set: value => writes.push(value) });
    const window = { matchMedia: () => ({ matches: false }), CasualProfile: {}, CasualCheats: { active: () => false, immortal: () => false } };
    const context = { document, window, location: { protocol: 'http:' }, performance: { now: () => 0 }, setTimeout() {}, clearTimeout() {}, requestAnimationFrame() {}, cancelAnimationFrame() {}, Math, Date, Set, Map, console };
    const cut = source.slice(0, source.indexOf('    // Production keeps ticking'));
    vm.runInNewContext(cut + '\nwindow.api = { startRun, step, buildStage, airstrike, applyGate, breakCrate, pause, state:()=>run, save:()=>save$, persist }; })();', context);
    return { ...window.api, window, nodes, writes };
}
function advance(b, seconds) { for (let i = 0; i < seconds * 90 && !b.state().over; i++) b.step(1 / 90); }
test('stages are deterministic and the opening offers troops versus a breakable weapon crate', () => {
    const b = boot(); assert.equal(JSON.stringify(b.buildStage(1)), JSON.stringify(b.buildStage(1)));
    const stage = b.buildStage(1);
    assert.equal(stage.ents.filter(e => e.kind === 'gate' && e.stream && e.x === .5).length, 9);
    const crate = stage.ents.find(e => e.kind === 'crate');
    assert.equal(crate.hp, 6); assert.equal(crate.loot[0], 'weapon');
    for (const n of [1, 3, 5, 50, 99]) assert.ok(b.buildStage(n).boss.hp > 0);
});
test('taking the opening troop lane actually grows the squad to ten', () => {
    const b = boot(); b.startRun(1); advance(b, 4);
    assert.equal(b.state().soldiers, 10); assert.ok(b.state().bullets.length > 0);
});
test('shooting the opening crate earns a weapon; colliding without breaking earns none', () => {
    const b = boot(); b.startRun(1); b.state().x = b.state().tx = -.5; advance(b, 2.5);
    assert.equal(b.state().weapon, 1);
    const c = boot(); c.startRun(1); const crate = c.state().ents.find(e => e.kind === 'crate'); c.breakCrate(crate, false);
    assert.equal(c.state().weapon, 0);
});
test('air support needs a target, uses a cooldown, and cannot fire while paused or finished', () => {
    const b = boot(); b.startRun(1); assert.equal(b.airstrike(), false);
    b.state().z = 40; const before = b.state().kills; assert.equal(b.airstrike(), true);
    assert.ok(b.state().kills > before); assert.equal(b.state().airCooldown, 18); assert.equal(b.airstrike(), false);
    b.state().airCooldown = 0; b.state().paused = true; assert.equal(b.airstrike(), false);
    b.state().paused = false; b.state().over = true; assert.equal(b.airstrike(), false);
});
test('boss telegraph damages its marked lane but can be dodged', () => {
    for (const dodge of [false, true]) {
        const b = boot(); b.startRun(1); const r = b.state(); r.z = r.L - 13; r.arena = true; r.ents = [r.boss]; r.boss.hp = r.boss.max = 1e6;
        r.soldiers = 20; r.shield = 0; r.minionT = 100; r.bossAttackT = 0;
        b.step(1 / 90); assert.ok(r.danger); const lane = r.danger.x;
        if (dodge) r.x = r.tx = -lane;
        advance(b, 1.4);
        assert.equal(r.soldiers, dodge ? 20 : 16); assert.equal(r.danger, null);
    }
});
test('gates cap army size and cheats prevent persistent progress', () => {
    const b = boot(); b.startRun(1); b.state().soldiers = 300;
    b.applyGate({ op: '×', v: 2, stream: false }); assert.equal(b.state().soldiers, 400);
    b.persist(); assert.equal(b.writes.length, 1);
    b.window.CasualCheats.active = () => true; b.persist(); assert.equal(b.writes.length, 1);
});
test('the opening stage is winnable with lane choices and timed support without upgrades', () => {
    const b = boot(); b.startRun(1);
    for (let i = 0; i < 90 * 100 && !b.state().over; i++) {
        const r = b.state();
        r.tx = r.danger ? -r.danger.x : r.arena ? 0 : r.z < 26 ? .5 : r.z < 40 ? -.5 : r.z < 70 ? .5 : r.z < 90 ? -.5 : 0;
        if (r.z > 40 && r.airCooldown === 0) b.airstrike();
        b.step(1 / 90);
    }
    assert.equal(b.state().won, true); assert.ok(b.state().peak > 10); assert.ok(b.state().kills > 0);
});
