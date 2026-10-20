const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(ios=false){
 const calls=[],timers=new Map(),handlers={};let ticks=0;const el=()=>({style:{},classList:{remove(){},add(){},toggle(){}},setAttribute(){},append(){},addEventListener(){},click(){ticks++},replaceChildren(){}});
 const document={cookie:'',body:el(),hidden:false,createElement:el,getElementById:()=>null,addEventListener:(n,cb)=>handlers[n]=cb};
 const window={location:{protocol:'https:'},matchMedia:()=>({matches:ios}),setTimeout:cb=>{const id=timers.size+1;timers.set(id,cb);return id},clearTimeout:id=>timers.delete(id)};
 const context={document,window,navigator:ios?{}:{vibrate:p=>calls.push(p)}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../shared-settings.js'),'utf8').split('// Çevrimdışı oyun ve güncelleme:')[0],context);
 return {window,calls,timers,document,handlers,ticks:()=>ticks};
}
test('native haptics use patterns and disabling cancels subsequent vibration',()=>{
 const f=fixture();f.window.CasualSettings.vibrate('success');assert.deepEqual(Array.from(f.calls[0]),[18,40,28]);
 f.window.CasualSettings.update({vibration:false});assert.equal(f.calls.at(-1),0);const n=f.calls.length;f.window.CasualSettings.vibrate('win');assert.equal(f.calls.length,n);assert.match(f.document.cookie,/vibration/);
});
test('iOS attempt is optional and queued ticks are cancelled when disabled or hidden',()=>{
 const f=fixture(true);f.window.CasualSettings.vibrate('win');assert.equal(f.ticks(),1);assert.equal(f.timers.size,2);
 f.window.CasualSettings.update({vibration:false});assert.equal(f.timers.size,0);
 f.window.CasualSettings.update({vibration:true});f.window.CasualSettings.vibrate('win');f.document.hidden=true;f.handlers.visibilitychange();assert.equal(f.timers.size,0);
});

test('iOS native bridge takes precedence and receives cancellation when disabled',()=>{
 const f=fixture(),native=[];f.window.webkit={messageHandlers:{casualpassHaptic:{postMessage:p=>native.push(p)}}};
 f.window.CasualSettings.vibrate('win');assert.deepEqual(native,['win']);assert.equal(f.calls.length,0);
 f.window.CasualSettings.update({vibration:false});assert.deepEqual(native,['win','cancel']);
 f.window.CasualSettings.vibrate('move');assert.equal(native.length,2);
});
test('Android native bridge receives names; bridge errors fall back to web vibration',()=>{
 const f=fixture(),native=[];f.window.CasualPassHaptics={postMessage:p=>native.push(p)};
 f.window.CasualSettings.vibrate('success');assert.deepEqual(native,['success']);assert.equal(f.calls.length,0);
 f.window.CasualPassHaptics.postMessage=()=>{throw Error('unavailable')};f.window.CasualSettings.vibrate('move');assert.equal(f.calls.at(-1),12);
});
