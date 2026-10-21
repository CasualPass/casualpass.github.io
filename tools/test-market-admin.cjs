const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const rules=require('../market-rules.js'),home=require('../home-games.js');
const game={id:'11111111-1111-1111-1111-111111111111',author:'builder',title:'Test Game',description:'A tested external browser game',url:'https://games.example.com/play',category:'beceri',status:'pending',revision:2};
class El{
 constructor(){this.children=[];this.events={};this.style={};this.dataset={};this.hidden=false;this.value='';this.textContent='';this.disabled=false;}
 append(...els){this.children.push(...els);}replaceChildren(...els){this.children=els;}setAttribute(){}addEventListener(name,cb){this.events[name]=cb;}async fire(name){return this.events[name]?.();}
}
function adminFixture({admin=false,reviewError=false}={}){
 const ids=['market-admin','review-games','review-more','review-status','review-filter','review-refresh'];const el=Object.fromEntries(ids.map(id=>[id,new El()]));el['market-admin'].hidden=true;el['review-filter'].value='pending';
 let signed=true,listCalls=0;const decisions=[],events={},sent=[];
 const cloud={ready:Promise.resolve(),getState:()=>({authenticated:signed,username:'eymnyld'}),isMarketAdmin:async()=>admin,listMarketReview:async()=>{listCalls++;return [game];},reviewMarketGame:async(...args)=>{if(reviewError)throw Error('stale');decisions.push(args);}};
 const context={document:{getElementById:id=>el[id],createElement:()=>new El()},window:{addEventListener:(n,fn)=>events[n]=fn,dispatchEvent:e=>sent.push(e.type)},CasualCloud:cloud,CasualMarketRules:rules,CustomEvent:class{constructor(type){this.type=type;}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../market-admin.js'),'utf8'),context);
 return {el,decisions,sent,listCalls:()=>listCalls,signOut:()=>{signed=false;return events.casualcloudchange();},settle:()=>new Promise(setImmediate)};
}
test('a user named eymnyld without server role never sees moderation or fetches queue',async()=>{
 const f=adminFixture();await f.settle();assert.equal(f.el['market-admin'].hidden,true);assert.equal(f.listCalls(),0);
});
test('verified admin approves displayed revision and notifies the market',async()=>{
 const f=adminFixture({admin:true});await f.settle();assert.equal(f.el['market-admin'].hidden,false);
 const row=f.el['review-games'].children[0];row.children[4].children[0].value='Kontrol edildi';await row.children[5].children[0].fire('click');
 assert.deepEqual(f.decisions,[[game.id,'approved',2,'Kontrol edildi']]);assert.deepEqual(f.sent,['casualmarketchange']);
});
test('stale/unauthorized review does not claim success or disable retry forever',async()=>{
 const f=adminFixture({admin:true,reviewError:true});await f.settle();const button=f.el['review-games'].children[0].children[5].children[1];await button.fire('click');
 assert.equal(f.decisions.length,0);assert.equal(f.sent.length,0);assert.equal(button.disabled,false);assert.match(f.el['review-status'].textContent,/İlan değişmiş/);
});
test('signing out immediately hides and clears the review queue',async()=>{
 const f=adminFixture({admin:true});await f.settle();await f.signOut();assert.equal(f.el['market-admin'].hidden,true);assert.equal(f.el['review-games'].children.length,0);
});
async function screenFixture(status,options={}){
 const grid=new El(),message=new El(),prev=new El(),next=new El(),label=new El(),size=new El(),calls=[],events={};
 const ids=options.ids || ['dino-game',`community:${game.id}`];
 const elements={'game-grid':grid,'home-games-status':message,'home-page-prev':prev,'home-page-next':next,'home-page-label':label,'home-page-size':size};
 const window={CasualHomeGames:true,innerWidth:options.width||1280,innerHeight:options.height||720,addEventListener:(n,fn)=>events[n]=fn};
 const context={document:{getElementById:id=>elements[id],createElement:()=>new El()},window,CasualHomeGames:{catalog:home.catalog,LIMIT:home.LIMIT,pageSize:home.pageSize,pagePreference:()=>options.preference||0,setPagePreference:value=>Number(value),current:()=>ids},CasualCloud:{getMarketHomeGames:async input=>{calls.push(input);return [{...game,status}];}},CasualMarketRules:rules,getHighScore:()=>0};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../home-screen.js'),'utf8'),context);await new Promise(setImmediate);return {grid,message,calls,prev,next,label,size,window,events};
}
test('home resolves approved community IDs and creates safe outbound links',async()=>{
 const f=await screenFixture('approved');assert.equal(f.grid.children.length,2);assert.equal(f.grid.children[1].href,game.url);assert.equal(f.grid.children[1].rel,'noopener noreferrer');assert.deepEqual(Array.from(f.calls[0]),[game.id]);
});
test('home never opens rejected or pending pinned games',async()=>{
 for(const state of ['pending','rejected']){const f=await screenFixture(state);assert.equal(f.grid.children.length,1);assert.match(f.message.textContent,/artık yayında değil/);}
});

test('home pagination reaches every selected game and clamps after viewport resize',async()=>{
 const f=await screenFixture('approved',{ids:home.catalog.map(g=>g.id)});assert.equal(f.grid.children.length,6);assert.equal(f.label.textContent,'1 / 3');assert.equal(f.prev.disabled,true);
 await f.next.fire('click');assert.equal(f.grid.children.length,6);await f.next.fire('click');assert.equal(f.grid.children.length,1);assert.equal(f.next.disabled,true);
 f.window.innerWidth=667;f.window.innerHeight=375;f.events.resize();assert.equal(f.grid.children.length,2);assert.equal(f.label.textContent,'3 / 7');
});

test('changing group size resets to first page and preserves access to every game',async()=>{
 const f=await screenFixture('approved',{ids:home.catalog.map(g=>g.id)});
 await f.next.fire('click');f.size.value='4';await f.size.fire('change');
 assert.equal(f.grid.children.length,4);assert.equal(f.label.textContent,'1 / 4');
 await f.next.fire('click');await f.next.fire('click');await f.next.fire('click');assert.equal(f.grid.children.length,1);
 f.size.value='0';await f.size.fire('change');assert.equal(f.grid.children.length,6);assert.equal(f.label.textContent,'1 / 3');
});

test('large groups expose all thirteen built-ins without truncating to six',async()=>{
 const f=await screenFixture('approved',{ids:home.catalog.map(g=>g.id),preference:12});
 assert.equal(f.grid.children.length,12);assert.equal(f.label.textContent,'1 / 2');
 await f.next.fire('click');assert.equal(f.grid.children.length,1);
 f.size.value='30';await f.size.fire('change');assert.equal(f.grid.children.length,13);assert.equal(f.label.textContent,'1 / 1');assert.equal(f.next.disabled,true);
});
