const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../casual-activity.js'), 'utf8');
function boot() {
    let now = 0, focused = true, cheat = false, interval;
    const cookies = new Map(), handlers = {}, events = {};
    const document = { hidden: false, hasFocus: () => focused, addEventListener: (name, cb) => handlers[name] = cb };
    const window = { CasualCheats: { active: () => cheat }, addEventListener: (name, cb) => events[name] = cb, dispatchEvent() {} };
    let stats = {};
    vm.runInNewContext(source, { window, document, Date: { now: () => now }, CustomEvent: class {}, getCookieValue: key => cookies.get(key) || '', setCookieValue: (key,v) => cookies.set(key,v), getGameStats: () => stats, setInterval: fn => interval = fn });
    return { api: window.CasualActivity, document, cookies, advance(ms) { now += ms; interval(); }, input() { handlers.keydown(); }, focus(value) { focused = value; if (value) events.focus(); }, cheat(value) { cheat = value; }, stats(value) { stats=value; } };
}
test('active time persists, clips at idle cutoff, resumes on input', () => {
    const f = boot();
    for(let i=0;i<12;i++) f.advance(5000);
    assert.equal(f.api.totals().active_seconds,60);
    f.advance(5000); assert.equal(f.api.totals().active_seconds,60);
    f.input(); f.advance(5000); assert.equal(f.api.totals().active_seconds,65);
    assert.equal(JSON.parse(f.cookies.get('cp_activity_v1')).seconds,65);
});
test('hidden/unfocused/cheat time excluded and stale background timer cannot catch up', () => {
    const f=boot(); f.advance(5000);
    f.document.hidden=true; f.advance(20000);
    f.document.hidden=false; f.focus(false); f.advance(5000);
    f.focus(true); f.cheat(true); f.advance(5000);
    assert.equal(f.api.totals().active_seconds,5);
    f.cheat(false);f.input();f.advance(5000);
    assert.equal(f.api.totals().active_seconds,10);
    f.advance(120000);assert.equal(f.api.totals().active_seconds,15);
});
test('aggregate points, plays and wins handle missing and corrupt stats', () => {
    const f=boot();f.stats({ Dino:{totalScore:136,played:1,won:0},Chess:{totalScore:20,played:2,won:1},bad:null,invalid:{totalScore:Infinity,played:-10} });
    assert.equal(f.api.totals().total_points,156);assert.equal(f.api.totals().played,3);assert.equal(f.api.totals().wins,1);
    f.cookies.set('cp_activity_v1','bad-json');assert.equal(f.api.totals().active_seconds,0);
});
