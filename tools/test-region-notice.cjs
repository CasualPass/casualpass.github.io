const test=require('node:test'),assert=require('node:assert/strict');
const notice=require('../casual-region-notice.js');
const memory=()=>{const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};};
test('Region notice maps censored-country timezones and ignores others',()=>{
 for(const [zone,country] of [['Europe/Istanbul','TR'],['Europe/Moscow','RU'],['Asia/Vladivostok','RU'],['Asia/Baku','AZ'],['Asia/Tehran','IR'],['Asia/Shanghai','CN'],['Europe/Minsk','BY']]) assert.equal(notice.countryForTimeZone(zone),country,zone);
 for(const zone of ['Europe/Berlin','America/New_York','Asia/Tokyo','UTC','',null,undefined,'__proto__','constructor']) assert.equal(notice.countryForTimeZone(zone),null,String(zone));
});
test('Region notice hides for 30 days after dismissal, then returns',()=>{
 const s=memory(),now=Date.UTC(2026,9,24);
 assert.equal(notice.shouldShow('Europe/Istanbul',s,now),true);
 notice.dismiss(s,now);
 assert.equal(notice.shouldShow('Europe/Istanbul',s,now+1000),false);
 assert.equal(notice.shouldShow('Europe/Istanbul',s,now+notice.DISMISS_MS+1),true);
 assert.equal(notice.shouldShow('Europe/Berlin',memory(),now),false);
});
test('Region notice survives blocked storage and links to the help page',()=>{
 const broken={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
 assert.equal(notice.shouldShow('Asia/Baku',broken,Date.now()),true);
 assert.doesNotThrow(()=>notice.dismiss(broken,Date.now()));
 assert.equal(notice.HELP_URL,'https://surfshark.com/blog/unblock-websites');
 assert.match(notice.MESSAGE,/VPN, PROXY, GoodbyeDPI veya farklı bir DNS/);
 assert.match(notice.MESSAGE,/Halihazırda bu yöntemleri kullanıyorsanız bu uyarıyı önemsemeyin\.$/);
});
