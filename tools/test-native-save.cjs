const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../casual-save.js'), 'utf8');
function boot({ ios, android } = {}) {
    let downloads = 0;
    const window = { crypto: webcrypto, location: { protocol: 'https:' } };
    if (ios) window.webkit = { messageHandlers: { casualpassSave: { postMessage: ios } } };
    if (android) window.CasualPassNative = android;
    const document = { cookie: 'cp_profile=game-data; sb-casualpass=private-token', body: { append() {} }, createElement: () => ({ click() { downloads++; }, remove() {} }) };
    const context = { window, document, navigator: {}, crypto: webcrypto, TextEncoder, Blob,
        File: class { constructor(parts, name) { this.name = name; } }, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
        matchMedia: () => ({ matches: false }), setTimeout, clearTimeout, Date, console };
    vm.runInNewContext(source, context);
    return { save: window.CasualSave, downloads: () => downloads };
}
test('iOS export waits for the native result and sends game data without auth cookies', async () => {
    let payload;
    const b = boot({ ios: async text => { payload = JSON.parse(text); return { cancelled: false }; } });
    const result = await b.save.exportSave();
    assert.equal(result.native, true); assert.equal(result.cancelled, false);
    assert.equal(payload.format, 'casualpass-save'); assert.equal(payload.cookies.cp_profile, 'game-data');
    assert.equal(JSON.stringify(payload).includes('private-token'), false); assert.equal(b.downloads(), 0);
});
test('iOS cancelled sharing is not reported as a completed download', async () => {
    const b = boot({ ios: async () => ({ cancelled: true }) });
    assert.equal((await b.save.exportSave()).cancelled, true); assert.equal(b.downloads(), 0);
});
test('Android bridge waits for the picker and restores the previous message listener', async () => {
    const previous = () => {};
    const bridge = { onmessage: previous, postMessage(text) { assert.equal(JSON.parse(text).format, 'casualpass-save'); queueMicrotask(() => bridge.onmessage({ data: '{"cancelled":false}' })); } };
    const b = boot({ android: bridge });
    const result = await b.save.exportSave(); assert.equal(result.native, true); assert.equal(result.cancelled, false);
    assert.equal(bridge.onmessage, previous); assert.equal(b.downloads(), 0);
});
test('native failures propagate without also triggering a browser download', async () => {
    const bridge = { postMessage() { queueMicrotask(() => bridge.onmessage({ data: '{"error":"Dosya kaydedilemedi."}' })); } };
    const b = boot({ android: bridge }); await assert.rejects(b.save.exportSave(), /Dosya kaydedilemedi/); assert.equal(b.downloads(), 0);
    const c = boot({ ios: async () => { throw Error('picker failed'); } }); await assert.rejects(c.save.exportSave(), /picker failed/); assert.equal(c.downloads(), 0);
});
test('ordinary browsers retain the existing file download fallback', async () => {
    const b = boot(); const result = await b.save.exportSave(); assert.ok(result.name.endsWith('.json')); assert.equal(b.downloads(), 1);
});
test('a second export cannot replace an in-progress native picker callback', async () => {
    let complete, entered;
    const called = new Promise(resolve => { entered = resolve; });
    const b = boot({ ios: () => new Promise(resolve => { complete = resolve; entered(); }) });
    const first = b.save.exportSave(); await called;
    await assert.rejects(b.save.exportSave(), /zaten açık/);
    complete({ cancelled: false }); assert.equal((await first).cancelled, false);
});
