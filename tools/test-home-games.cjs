const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const home=require('../home-games.js');
const id='community:11111111-1111-1111-1111-111111111111';
test('home starts with six defaults; explicit empty, corrupt and duplicate selections handled',()=>{
 assert.equal(home.read('').length,6);assert.equal(home.read('bad').length,6);assert.deepEqual(home.read('[]'),[]);
 assert.deepEqual(home.read(JSON.stringify(['dino-game','dino-game','javascript:bad','community:bad',id])),['dino-game',id]);
});
test('home allows all built-ins and up to 30 slots while preserving selections',()=>{
 const added=home.toggle(home.read(''),'xox-game');assert.equal(added.length,7);
 const external=Array.from({length:17},(_,i)=>`community:11111111-1111-1111-1111-${String(i).padStart(12,'0')}`);
 const full=home.catalog.map(g=>g.id).concat(external);assert.equal(full.length,30);assert.equal(home.read(JSON.stringify(full)).length,30);
 assert.throws(()=>home.toggle(full,id),/30/);assert.equal(home.toggle(full,'dino-game').length,29);
 assert.throws(()=>home.toggle([],'https://evil.example/'));
});
test('home page size adapts to narrow and short viewports',()=>{
 assert.equal(home.pageSize(1440,900),6);assert.equal(home.pageSize(1280,600),3);assert.equal(home.pageSize(375,812),4);assert.equal(home.pageSize(667,375),2);
});
test('home cookie model persists selections and notifies observers',()=>{
 let cookie='',events=0;const root={getCookieValue:()=>cookie,setCookieValue:(name,value)=>{assert.equal(name,'cp_home_games_v1');cookie=value;},dispatchEvent(){events++;}};
 const context={window:root,CustomEvent:class{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../home-games.js'),'utf8'),context);
 root.CasualHomeGames.change('dino-game');assert.equal(root.CasualHomeGames.current().length,5);assert.equal(events,1);assert.equal(cookie.includes('https:'),false);
});

test('group preference validates and persists independently from selected games',()=>{
 const cookies={cp_home_games_v1:'["dino-game"]'};
 const root={getCookieValue:key=>cookies[key],setCookieValue:(key,value)=>cookies[key]=value};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../home-games.js'),'utf8'),{window:root});
 const api=root.CasualHomeGames;assert.equal(api.pagePreference(),0);
 api.setPagePreference('4');assert.equal(api.pagePreference(),4);assert.equal(api.pageSize(1280,720,api.pagePreference()),4);
 assert.deepEqual(Array.from(api.current()),['dino-game']);
 api.setPagePreference('999');assert.equal(api.pagePreference(),0);assert.equal(api.pageSize(1280,720,999),6);
});

test('explicit groups larger than six are supported through the full home capacity',()=>{
 for(const size of [8,12,18,30])assert.equal(home.pageSize(1280,720,size),size);
});
