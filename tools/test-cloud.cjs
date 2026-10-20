const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const root = path.join(__dirname, '..');
const authSource = fs.readFileSync(path.join(root, 'casual-cloud.js'), 'utf8');
const config = { enabled: true, url: 'https://demo.supabase.co', publishableKey: 'sb_publishable_test' };
const storedKey = 'sb-casualpass-https://demo.supabase.co';
const makeSession = (id = 'user-a', expires_at = Date.now() / 1000 + 3600) => ({ access_token: 'access-private', refresh_token: 'refresh-private', expires_at, user: { id, email: `${id}@example.com` } });
function boot({ initial, handler = async () => ({}), settings = config, brokenStorage = false, hash = '' } = {}) {
    const storage = new Map(initial ? [[storedKey, JSON.stringify(initial)]] : []), calls = [], listeners = {};
    const context = {
        console, URL, URLSearchParams, TextEncoder, AbortController, setTimeout, clearTimeout, Date, navigator: {},
        atob: v => Buffer.from(v, 'base64').toString('binary'), CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
        localStorage: { getItem: k => storage.get(k) || null, setItem(k, v) { if (brokenStorage) throw Error('denied'); storage.set(k, v); }, removeItem: k => storage.delete(k) },
        fetch: async (url, options) => { const call = { url, ...options, json: options.body ? JSON.parse(options.body) : undefined }; calls.push(call); const result = await handler(call); return { ok: (result.status || 200) < 400, status: result.status || 200, text: async () => result.raw ?? JSON.stringify(result.body ?? result) }; }
    };
    context.window = { CASUALPASS_CLOUD: settings, location: { href: 'https://casualpass.github.io/', hash, pathname: '/', search: '' }, history: { replaceState(...args) { context.cleanedUrl = args[2]; } }, dispatchEvent(event) { (listeners[event.type] || []).forEach(f => f(event)); }, addEventListener(type, fn) { (listeners[type] ||= []).push(fn); }, CasualSave: { build: async () => ({ format: 'casualpass-save', created: '2026-10-20', cookies: { cp_profile: 'local' } }), inspect: async () => ({ ok: true, save: { cookies: {} }, count: 1 }), apply() { context.applied = true; } } };
    vm.createContext(context); vm.runInContext(authSource, context);
    return { context, cloud: context.window.CasualCloud, storage, calls, listeners };
}
test('disabled or secret config never sends a request and exposes no auth session', async () => {
    for (const settings of [{ ...config, enabled: false }, { ...config, publishableKey: 'sb_secret_do-not-use' }, { ...config, url: 'http://demo.supabase.co' }]) {
        const b = boot({ settings }); await b.cloud.ready;
        await assert.rejects(b.cloud.requestOtp('a@example.com')); assert.equal(b.calls.length, 0);
        assert.equal(b.cloud.getState().configured, false);
    }
});
test('OTP request/verification use public apikey, verified session persists, UI state omits tokens', async () => {
    const b = boot({ handler: async c => c.url.endsWith('/verify') ? makeSession() : {} }); await b.cloud.ready;
    await assert.rejects(b.cloud.requestOtp('bad')); await assert.rejects(b.cloud.verifyOtp('a@example.com', 'abc'));
    await b.cloud.requestOtp(' a@example.com '); await b.cloud.verifyOtp('a@example.com', '123456');
    assert.equal(b.calls[0].json.email, 'a@example.com'); assert.equal(b.calls[0].json.create_user, true);
    assert.equal(b.calls[0].headers.apikey, config.publishableKey); assert.equal(b.calls[0].headers.Authorization, undefined);
    assert.equal(b.calls[1].json.type, 'email'); assert.equal(b.cloud.getState().authenticated, true);
    assert.equal(JSON.parse(b.storage.get(storedKey)).refresh_token, 'refresh-private');
    assert.equal(JSON.stringify(b.cloud.getState()).includes('private'), false);
});
test('expired session refreshes before user validation; failed refresh clears invalid session', async () => {
    const b = boot({ initial: makeSession('user-a', 1), handler: async c => c.url.includes('/token?') ? makeSession() : makeSession().user });
    await b.cloud.ready; assert.equal(b.calls[0].json.refresh_token, 'refresh-private');
    assert.ok(b.calls[0].url.includes('grant_type=refresh_token')); assert.equal(b.calls[1].headers.Authorization, 'Bearer access-private');
    const bad = boot({ initial: makeSession('user-a', 1), handler: async () => ({ status: 400 }) }); await bad.cloud.ready;
    assert.equal(bad.cloud.getState().authenticated, false); assert.equal(bad.storage.has(storedKey), false);
});
test('network failure preserves offline session and local save, explicit logout clears it even offline', async () => {
    const b = boot({ initial: makeSession(), handler: async () => { throw new TypeError('offline'); } }); await b.cloud.ready;
    assert.equal(b.cloud.getState().status, 'offline'); assert.equal(b.cloud.getState().authenticated, true);
    await b.cloud.signOut(); assert.equal(b.cloud.getState().authenticated, false); assert.equal(b.storage.has(storedKey), false); assert.equal(b.context.applied, undefined);
});
test('late verification cannot revive a signed-out session', async () => {
    let resolve; const b = boot({ handler: c => new Promise(r => { resolve = r; }) }); await b.cloud.ready;
    const verification = b.cloud.verifyOtp('a@example.com', '123456'); await b.cloud.signOut(); resolve(makeSession());
    await assert.rejects(verification, /Oturum değişti/); assert.equal(b.cloud.getState().authenticated, false);
});
test('manual save transfer uses verified user ID and blocks cheat/oversized upload', async () => {
    const b = boot({ initial: makeSession(), handler: async c => c.url.includes('/auth/') ? makeSession().user : c.method === 'GET' ? [{ profile: {}, updated_at: '' }] : { raw: '' } }); await b.cloud.ready;
    await b.cloud.uploadSave(); const upload = b.calls.at(-1);
    assert.equal(upload.json.user_id, 'user-a'); assert.equal(upload.headers.Authorization, 'Bearer access-private');
    assert.equal(upload.json.profile.cookies.cp_profile, 'local');
    const result = await b.cloud.downloadSave(); assert.match(b.calls.at(-1).url, /user_id=eq.user-a/);
    b.cloud.applySave(result); assert.equal(b.context.applied, true);
    await b.cloud.signOut(); assert.throws(() => b.cloud.applySave(result));
    const c = boot({ initial: makeSession(), handler: async () => makeSession().user }); await c.cloud.ready;
    c.context.window.CasualCheats = { active: () => true }; await assert.rejects(c.cloud.uploadSave(), /Hile/);
    c.context.window.CasualCheats.active = () => false;
    c.context.window.CasualSave.build = async () => ({ cookies: { cp_big: 'x'.repeat(31000) } });
    await assert.rejects(c.cloud.uploadSave(), /sınırından/); assert.equal(c.calls.length, 1);
});
test('cross-tab signout invalidates loaded save; server errors leave save untouched', async () => {
    const b = boot({ initial: makeSession(), handler: async c => c.url.includes('/auth/') ? makeSession().user : ({ status: 403 }) }); await b.cloud.ready;
    await assert.rejects(b.cloud.downloadSave()); assert.equal(b.context.applied, undefined);
    b.storage.delete(storedKey); b.listeners.storage[0]({ key: storedKey }); assert.equal(b.cloud.getState().authenticated, false);
});
test('actual save builder excludes auth localStorage and includes only game cookies', async () => {
    const context = { document: { cookie: 'cp_profile=%7B%7D; casualpass_session=guest; unrelated=no' }, window: { crypto: webcrypto }, crypto: webcrypto, TextEncoder, Date, localStorage: { getItem: () => JSON.stringify(makeSession()) } };
    vm.createContext(context); vm.runInContext(fs.readFileSync(path.join(root, 'casual-save.js'), 'utf8'), context);
    const save = await context.window.CasualSave.build(); assert.equal(save.cookies.cp_profile, '%7B%7D');
    assert.equal(save.cookies.unrelated, undefined); assert.equal(JSON.stringify(save).includes('private'), false);
    const inspected = await context.window.CasualSave.inspect({ text: async () => JSON.stringify(save) }); assert.equal(inspected.ok, true);
});
test('storage denied allows current-page login and reports it is not remembered', async () => {
    const b = boot({ brokenStorage: true, handler: async () => makeSession() }); await b.cloud.ready;
    await b.cloud.verifyOtp('a@example.com', '123456');
    assert.equal(b.cloud.getState().authenticated, true); assert.equal(b.cloud.getState().persistent, false);
});
test('concurrent refresh operations share one refresh request', async () => {
    const b = boot({ initial: makeSession(), handler: async c => c.url.includes('/auth/') ? makeSession().user : { raw: '' } }); await b.cloud.ready;
    // Simulate expiry in storage followed by another-tab session update.
    b.storage.set(storedKey, JSON.stringify(makeSession('user-a', 1))); b.listeners.storage[0]({ key: storedKey });
    b.context.fetch = async (url, options) => {
        b.calls.push({url});
        const data = url.includes('/token?') ? makeSession() : {};
        return { ok: true, status: 200, text: async () => JSON.stringify(data) };
    };
    await Promise.all([b.cloud.uploadSave(), b.cloud.uploadSave()]);
    assert.equal(b.calls.filter(c => c.url.includes('/token?')).length, 1);
});

test('magic-link callback clears credentials from URL before validating user and saving session', async () => {
    let b;
    b = boot({ hash: '#access_token=link-access&refresh_token=link-refresh&expires_in=3600&token_type=bearer', handler: async c => {
        assert.equal(c.headers.Authorization, 'Bearer link-access'); return makeSession().user;
    } });
    await b.cloud.ready; assert.equal(b.context.cleanedUrl, '/'); assert.equal(b.cloud.getState().authenticated, true);
    assert.equal(JSON.parse(b.storage.get(storedKey)).refresh_token, 'link-refresh');
});
test('invalid or expired callback never persists a session', async () => {
    const b = boot({ hash: '#access_token=bad&refresh_token=bad&expires_in=3600&token_type=bearer', handler: async () => ({ status: 401 }) });
    await b.cloud.ready; assert.equal(b.context.cleanedUrl, '/'); assert.equal(b.cloud.getState().authenticated, false); assert.equal(b.storage.size, 0);
    const expired = boot({ hash: '#error=access_denied&error_description=untrusted' }); await expired.cloud.ready;
    assert.equal(expired.calls.length, 0); assert.equal(expired.cloud.getState().error.includes('untrusted'), false);
});
test('username/password signup and login normalize identifiers and never persist password', async () => {
    const password = 'six-ok';
    const response = { ...makeSession(), user: { id: 'user-a', email: 'player_1@accounts.casualpass.invalid' } };
    const b = boot({ handler: async () => response }); await b.cloud.ready;
    await b.cloud.signUp(' Player_1 ', password);
    assert.equal(b.calls[0].json.email, 'player_1@accounts.casualpass.invalid');
    assert.ok(b.calls[0].url.endsWith('/signup')); assert.equal(b.calls[0].json.password, password);
    assert.equal(b.cloud.getState().username, 'player_1');
    assert.equal(b.storage.get(storedKey).includes(password), false);
    await b.cloud.signIn('PLAYER_1', password);
    assert.ok(b.calls.at(-1).url.endsWith('grant_type=password'));
    assert.equal(JSON.stringify(b.cloud.getState()).includes(password), false);
});
test('username and bcrypt byte-limit validation happens before network calls', async () => {
    const b = boot(); await b.cloud.ready;
    for (const [name, pass] of [['ab','long-test-password'], ['bad@name','long-test-password'], ['user','short'], ['user','a'.repeat(73)], ['user','ş'.repeat(37)]]) await assert.rejects(b.cloud.signUp(name,pass));
    assert.equal(b.calls.length, 0);
});
test('legacy account credential setup preserves authenticated user ID and cloud-save ownership', async () => {
    const user = { id: 'user-a', email: 'player_1@accounts.casualpass.invalid' };
    const b = boot({ initial: makeSession(), handler: async c => c.method === 'PUT' ? user : c.url.includes('/auth/') ? makeSession().user : ({ raw: '' }) }); await b.cloud.ready;
    await b.cloud.setupCredentials('player_1','six-ok');
    assert.equal(b.calls[1].method, 'PUT'); assert.equal(b.calls[1].headers.Authorization,'Bearer access-private');
    assert.equal(b.cloud.getState().username,'player_1');
    assert.equal(JSON.parse(b.storage.get(storedKey)).user.id,'user-a');
    await b.cloud.uploadSave(); assert.equal(b.calls.at(-1).json.user_id,'user-a');
    await assert.rejects(b.cloud.setupCredentials('other_name','test-only-long-password'), /zaten/);
});
test('confirmation-required signup and pending legacy change are not reported as completed', async () => {
    const b=boot({handler:async()=>({user:makeSession().user})});await b.cloud.ready;
    await assert.rejects(b.cloud.signUp('player_1','test-only-long-password'),/Kayıt tamamlanamadı/);
    assert.equal(b.cloud.getState().authenticated,false);
    const c=boot({initial:makeSession(),handler:async()=>makeSession().user});await c.cloud.ready;
    await assert.rejects(c.cloud.setupCredentials('player_1','six-ok'), /geçiş tamamlanmadı/);
    assert.equal(c.cloud.getState().username,'');assert.equal(c.cloud.getState().authenticated,true);
});
