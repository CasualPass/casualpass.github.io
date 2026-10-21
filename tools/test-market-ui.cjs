const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const rules=require('../market-rules.js');
const source=fs.readFileSync(path.join(__dirname,'../market.js'),'utf8');
const game={id:'11111111-1111-1111-1111-111111111111',author:'tester',title:'Uzay Macerası',description:'Uzayda geçen bir refleks oyunu.',url:'https://games.example.com/play',category:'beceri',is_owner:true,status:'approved',revision:1};
function fixture({authenticated=true,list=async()=>[game],publishError=false}={}) {
 class El {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.events={};this.textContent='';this.value='';this.hidden=false;this.disabled=false;this.attrs={};this.dataset={};}
  addEventListener(n,cb){this.events[n]=cb;}
  append(...els){this.children.push(...els);}
  replaceChildren(...els){this.children=els;}
  setAttribute(k,v){this.attrs[k]=v;}
  async fire(n){return this.events[n]?.({preventDefault(){}});}
  reportValidity(){return true;}
  reset(){this.resetCalled=true;}
  showModal(){this.open=true;}
  close(){this.open=false;}
 }
 const ids=['market-form','submit-dialog','market-search','market-category','market-source','market-account','market-auth-note','market-submit','official-section','official-count','community-games','community-section','market-empty','market-more','community-count','community-status','market-refresh','open-submit','close-submit','submit-status','home-pin-status'];
 const el=Object.fromEntries(ids.map(id=>[id,new El()]));el['market-category'].value='all';el['market-source'].value='all';
 const cards=[Object.assign(new El(),{textContent:'Dino',dataset:{tags:'hizli beceri'}}),Object.assign(new El(),{textContent:'Chess',dataset:{tags:'zeka'}})];
 const document={getElementById:id=>el[id],querySelectorAll:selector=>selector==='#official-games .game-card'?cards:[],createElement:tag=>new El(tag)};
 const published=[],unpublished=[];
 const cloud={getState:()=>({authenticated,username:'tester'}),ready:Promise.resolve(),listMarketGames:list,publishMarketGame:async input=>{if(publishError)throw Error('offline');published.push(input);},unpublishMarketGame:async id=>unpublished.push(id)};
 const window={CasualCloud:cloud,addEventListener(){}};
 const formData={title:game.title,description:game.description,url:game.url,category:game.category};
 const context={document,window,CasualHomeGames:{current:()=>[],change(){}},CasualCloud:cloud,CasualMarketRules:rules,URL,FormData:class{[Symbol.iterator](){return Object.entries(formData)[Symbol.iterator]();}},setTimeout,clearTimeout};
 vm.runInNewContext(source,context);
 return {el,cards,published,unpublished,formData,settle:()=>new Promise(setImmediate)};
}
test('Market displays text-only safe external links and rejects unsafe stored URLs',async()=>{
 const f=fixture({list:async()=>[game,{...game,url:'javascript:alert(1)'}]});await f.settle();
 const cards=f.el['community-games'].children;assert.equal(cards.length,1);
 const link=cards[0].children[0];assert.equal(link.href,game.url);assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');assert.equal(link.referrerPolicy,'no-referrer');assert.equal(link.children[2].textContent,game.title);
 assert.equal(cards[0].children[2].textContent,'Oyunu ana ekrana ekle');await cards[0].children[3].fire('click');assert.deepEqual(f.unpublished,[game.id]);
});
test('Market filters originals, requires auth in dialog and does not auto-publish',async()=>{
 const f=fixture({authenticated:false,list:async()=>[]});await f.settle();
 assert.equal(f.published.length,0);await f.el['open-submit'].fire('click');assert.equal(f.el['market-submit'].disabled,true);assert.equal(f.el['market-auth-note'].hidden,false);
 f.el['market-category'].value='zeka';await f.el['market-category'].fire('change');assert.equal(f.cards[0].hidden,true);assert.equal(f.cards[1].hidden,false);
 f.el['market-source'].value='mine';await f.el['market-source'].fire('change');assert.match(f.el['community-status'].textContent,/giriş yap/);
});
test('Market publishes once, resets on success and preserves form after validation or network errors',async()=>{
 const f=fixture();await f.settle();await f.el['market-form'].fire('submit');assert.equal(f.published.length,1);assert.equal(f.el['market-form'].resetCalled,true);assert.equal(f.el['market-source'].value,'mine');
 const invalid=fixture();await invalid.settle();invalid.formData.url='javascript:alert(1)';await invalid.el['market-form'].fire('submit');assert.equal(invalid.published.length,0);assert.ok(invalid.el['submit-status'].textContent);
 const failed=fixture({publishError:true});await failed.settle();await failed.el['market-form'].fire('submit');assert.notEqual(failed.el['market-form'].resetCalled,true);assert.match(failed.el['submit-status'].textContent,/eklenemedi/);
});
test('Market ignores stale list responses after source changes',async()=>{
 let release;const f=fixture({list:()=>new Promise(resolve=>{release=resolve;})});await f.settle();
 f.el['market-source'].value='official';await f.el['market-source'].fire('change');release([game]);await f.settle();assert.equal(f.el['community-games'].children.length,0);assert.equal(f.el['community-section'].hidden,true);
});

test('Market hides unapproved games publicly and shows own pending/rejected states without pinning',async()=>{
 const pending={...game,status:'pending'}, rejected={...game,status:'rejected',review_note:'Bağlantıyı düzelt'};
 const f=fixture({list:async()=>[pending,rejected]});await f.settle();assert.equal(f.el['community-games'].children.length,0);
 f.el['market-source'].value='mine';await f.el['market-source'].fire('change');await f.settle();
 const cards=f.el['community-games'].children;assert.equal(cards.length,2);assert.equal(cards[0].children[1].textContent,'Onay bekliyor');assert.match(cards[1].children[1].textContent,/Bağlantıyı düzelt/);
 assert.equal(cards[0].children.filter(el=>el.className==='home-pin-button').length,0);
});
