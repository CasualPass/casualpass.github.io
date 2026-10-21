const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../shared-settings.js'), 'utf8').split('(function siteUpdates()')[1];
async function boot({ hub = true, form = false, worker = true, failOnce = false, seen = 'old' } = {}) {
    const events = {}, intervals = new Map(), state = { updates: 0, reloads: 0, requests: 0, form, now: 10000, seen };
    const document = { currentScript: { src: 'https://example.com/shared-settings.js' }, visibilityState: 'visible', activeElement: null,
        querySelector: s => s.startsWith('meta') ? hub : s === '#submit-dialog[open]' ? state.marketForm : null,
        querySelectorAll: () => [{ closest: () => null, get value() { return state.form ? 'editing' : ''; } }],
        addEventListener: (name, fn) => { events[name] = fn; } };
    const registration = { update: async () => { state.updates++; if (failOnce && state.updates === 1) throw Error('offline'); } };
    const navigator = { onLine: true };
    if (worker) navigator.serviceWorker = { controller: {}, register: async () => registration, addEventListener: (name, fn) => { events[name] = fn; } };
    const context = { URL, Date, Array, Promise, navigator, document, performance: { now: () => state.now },
        location: { href: 'https://example.com/index.html', protocol: 'https:', replace: () => { state.reloads++; } },
        getCookieValue: () => state.seen, setCookieValue: (_, v) => { state.seen = v; },
        fetch: async () => { state.requests++; return { json: async () => ({ v: 'new' }) }; },
        setInterval: (fn, ms) => intervals.set(ms, fn), window: { addEventListener: (name, fn) => { events[name] = fn; } } };
    vm.runInNewContext('(function siteUpdates()' + source, context);
    const settle = () => new Promise(resolve => setImmediate(resolve));
    await settle();
    return { state, events, intervals, document, navigator, settle };
}
test('open visible page checks every minute and retries worker updates after failures', async () => {
    const b = await boot({ failOnce: true });
    assert.equal(b.state.updates, 1);
    await b.intervals.get(60000)();
    assert.equal(b.state.updates, 2); assert.equal(b.state.seen, 'new');
    await b.intervals.get(60000)();
    assert.equal(b.state.updates, 3);
});
test('hidden or offline pages skip polling and reconnect checks immediately', async () => {
    const b = await boot();
    b.document.visibilityState = 'hidden'; await b.intervals.get(60000)(); assert.equal(b.state.requests, 1);
    b.document.visibilityState = 'visible'; b.navigator.onLine = false; await b.intervals.get(60000)(); assert.equal(b.state.requests, 1);
    b.navigator.onLine = true; await b.events.online(); assert.equal(b.state.requests, 2);
});
test('account form input delays a ready update until the form is clear', async () => {
    const b = await boot({ form: true }); b.events.controllerchange();
    assert.equal(b.state.reloads, 0); b.state.form = false; b.intervals.get(5000)();
    assert.equal(b.state.reloads, 1);
});
test('ready update never reloads a running game after the startup window', async () => {
    const b = await boot({ hub: false }); b.state.now = 20000; b.events.controllerchange(); b.intervals.get(5000)();
    assert.equal(b.state.reloads, 0);
});
test('without a service worker a changed version reloads the hub', async () => {
    const b = await boot({ worker: false }); assert.equal(b.state.reloads, 1);
});

test('an open Market submission dialog defers update reload until it closes', async () => {
    const b = await boot(); b.state.marketForm = true; b.events.controllerchange();
    assert.equal(b.state.reloads, 0); b.state.marketForm = false; b.intervals.get(5000)();
    assert.equal(b.state.reloads, 1);
});
