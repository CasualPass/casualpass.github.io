const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../dashboard.js'),'utf8');
function fixture(hash='') {
 const names=['games','leaderboard','account','themes','progress'],listeners={},events={};
 const tabs=names.map(name=>({dataset:{dashboardTab:name},attrs:{},events:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(n,fn){this.events[n]=fn;},focus(){this.focused=true;}}));
 const panels=names.map(name=>({dataset:{dashboardView:name},hidden:false}));
 const window={location:{hash},history:{replaceState(a,b,value){window.location.hash=value;}},addEventListener:(n,fn)=>events[n]=fn};
 const document={querySelectorAll:selector=>selector==='[data-dashboard-tab]'?tabs:panels,addEventListener:(n,fn)=>listeners[n]=fn};
 vm.runInNewContext(source,{document,window});return {tabs,panels,window,listeners,events};
}
test('dashboard shows one pane and preserves account/save deep links',()=>{
 const f=fixture('#account-title');assert.deepEqual(f.panels.map(p=>p.hidden),[true,true,false,true,true]);
 const saved=fixture('#save');assert.equal(saved.panels[2].hidden,false);assert.equal(saved.panels.filter(p=>!p.hidden).length,1);
});
test('dashboard tab keyboard wraps, focuses and never exposes inactive panes',()=>{
 const f=fixture();let prevented=false;f.tabs[0].events.keydown({key:'ArrowLeft',preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(f.tabs[4].focused,true);assert.equal(f.panels.filter(p=>!p.hidden).length,1);
});
test('legacy section links select their panel without scrolling the document',()=>{
 const f=fixture();let prevented=false;
 f.listeners.click({target:{closest:()=>({getAttribute:()=> '#cheat-title'})},preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(f.panels[4].hidden,false);
 f.window.location.hash='#unknown';f.events.hashchange();assert.equal(f.panels[0].hidden,false);
});
