const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function fixture() {
    const cookies = new Map();
    const document = {};
    Object.defineProperty(document, 'cookie', {
        get: () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        set: value => { const [pair] = value.split(';'); const at = pair.indexOf('='); cookies.set(pair.slice(0, at), pair.slice(at + 1)); }
    });
    let cheating = false;
    const window = { location: { protocol: 'https:' }, dispatchEvent() {}, CasualCheats: { active: () => cheating } };
    const context = { document, window, CustomEvent: class {}, console };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../casual-profile.js'), 'utf8'), context);
    return { api: window.CasualProfile, cookies, cheat: value => { cheating = value; } };
}

test('Dino reward thresholds, cap and invalid scores', () => {
    const { api } = fixture();
    for (const [score, expected] of [[-1,0],[0,0],[99,0],[100,1],[199,1],[200,2],[3999,39],[4000,40],[9000,40],[Infinity,0],[NaN,0],[undefined,0]]) {
        assert.equal(api.dinoRewardForScore(score), expected, String(score));
    }
});
test('Dino rewards require a session and update balance, lifetime and activity', () => {
    const { api } = fixture();
    assert.equal(api.awardDinoRun({ score: 500 }).reward, 0);
    api.login('DinoTest');
    const before = api.current();
    assert.equal(api.awardDinoRun({ score: 250 }).reward, 2);
    const after = api.current();
    assert.equal(after.balance, before.balance + 2);
    assert.equal(after.lifetimeEarned, before.lifetimeEarned + 2);
    assert.equal(after.activities[0].label, 'Dino koşusu');
});
test('Dino blocks cheat rewards and applies rebirth multiplier after cap', () => {
    const f = fixture(); f.api.login('DinoTest');
    const before = f.api.current().balance;
    f.cheat(true);
    assert.equal(f.api.awardDinoRun({ score: 8000 }).reward, 0);
    assert.equal(f.api.current().balance, before);
    f.cheat(false);
    const profile = f.api.current(); profile.rebirths = 2;
    f.cookies.set('casualpass_profile_v2', encodeURIComponent(JSON.stringify(profile)));
    assert.equal(f.api.awardDinoRun({ score: 8000 }).reward, 160);
    assert.equal(f.api.current().balance, before + 160);
});
