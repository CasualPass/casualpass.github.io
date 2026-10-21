const test=require('node:test'),assert=require('node:assert/strict');
const rules=require('../market-rules.js');
const valid={title:'Uzay Koşusu',description:'Kendi yaptığım uzay koşu oyunum.',category:'beceri',url:'https://games.example.com/run'};
test('Market normalizes HTTPS listing text and preserves game query/hash routing',()=>{
 const game=rules.validateGame({...valid,title:' Uzay Koşusu ',url:'https://GAMES.example.com:443/run?level=2#play'});
 assert.equal(game.title,'Uzay Koşusu');assert.equal(game.url,'https://games.example.com/run?level=2#play');
});
test('Market rejects script schemes, credential URLs, IPs, reserved hosts and alternate ports',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,<h1>game</h1>','http://game.example.com/','file:///tmp/game.html','https://user:password@games.example.com','https://localhost/game','https://127.0.0.1/','https://192.168.1.1/game','https://[::1]/','https://game.local/','https://game.invalid/','https://game.example.com:8080/','https://games.example.com@localhost/']) {
  assert.throws(()=>rules.validateGame({...valid,url}),undefined,url);
 }
});
test('Market validates bounded metadata and category before publication',()=>{
 for(const patch of [{title:'ab'},{title:'x'.repeat(61)},{description:'short'},{description:'x'.repeat(281)},{category:'__proto__'},{category:'random'}]) assert.throws(()=>rules.validateGame({...valid,...patch}));
 assert.equal(rules.validateGame({...valid,title:'<img src=x onerror=alert(1)>'}).title,'<img src=x onerror=alert(1)>');
});
