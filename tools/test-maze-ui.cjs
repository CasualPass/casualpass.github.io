const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../maze-paint/engine');
function fixture(cookie='',cheating=false,animated=false){
 const elements={},writes=[],results=[];
 class Element{
  constructor(){this.listeners={};this.children=[];this.style={setProperty:(k,v)=>this.style[k]=v};this.classList={toggle:(n,on)=>{const list=(this.className||'').split(' ').filter(Boolean).filter(x=>x!==n);if(on)list.push(n);this.className=list.join(' ');},add:n=>{if(!this.classList.contains(n))this.className+=' '+n;},contains:n=>(this.className||'').split(' ').includes(n)};}
  append(child){this.children.push(child);}replaceChildren(){this.children=[];}setAttribute(k,v){this[k]=v;}
  addEventListener(k,f){(this.listeners[k]||=[]).push(f);}emit(k,e={}){for(const f of this.listeners[k]||[])f({target:this,...e});}
  click(){if(!this.disabled)this.emit('click');}focus(){}closest(){return null;}setPointerCapture(){}
 }
 for(const id of ['hint','board','coverage','fill','level-title','progress','moves','completed','level','undo','next','restart','message'])elements[id]=new Element();
 const buttons=Object.keys(E.directions).map(dir=>{const b=new Element();b.dataset={dir};return b;});
 const frames=new Map();let frameId=0;
 const document=new Element(),window=new Element();if(animated){window.requestAnimationFrame=cb=>{frames.set(++frameId,cb);return frameId;};window.cancelAnimationFrame=id=>frames.delete(id);}document.body=new Element();document.createElement=()=>new Element();document.getElementById=id=>{assert.ok(elements[id],id);return elements[id];};document.querySelectorAll=()=>buttons;
 const context=vm.createContext({window,document,matchMedia:()=>({matches:false}),cheatsActive:()=>cheating,getCookieValue:()=>cookie,setCookieValue:(n,v)=>{assert.equal(n,'cp_maze_v1');cookie=v;writes.push(v);},recordGameResult:(name,result)=>results.push({name,...result})});
 vm.runInContext(fs.readFileSync(require.resolve('../maze-paint/engine'),'utf8'),context);window.MazeEngine=context.MazeEngine;
 vm.runInContext(fs.readFileSync(require.resolve('../maze-paint/script'),'utf8'),context);
 return {elements,document,window,writes,results,tick:time=>{const batch=[...frames];for(const [id,cb] of batch){frames.delete(id);cb(time);}},cookie:()=>cookie,press:dir=>buttons.find(b=>b.dataset.dir===dir).click(),cheat:()=>{cheating=true;window.emit('casual-cheat');}};
}
test('buttons, undo, reset confirmation and reload preserve the intended state',()=>{
 const ui=fixture(),l=E.createLevel(1),dir=l.solution[0];ui.press(dir);const saved=JSON.parse(ui.cookie());assert.equal(saved.moves,1);assert.deepEqual(saved.state.painted,E.move(l,E.initial(l),dir).painted);
 const reload=fixture(ui.cookie());assert.equal(reload.elements.moves.textContent,1);assert.equal(reload.elements.undo.disabled,true);
 ui.elements.undo.click();assert.equal(JSON.parse(ui.cookie()).moves,0);ui.press(dir);ui.elements.restart.click();assert.equal(JSON.parse(ui.cookie()).moves,1);ui.elements.restart.click();assert.equal(JSON.parse(ui.cookie()).moves,0);
 assert.equal(fixture('{invalid').elements.moves.textContent,0);
 const corrupt={...saved,state:{position:-1,painted:[-1]}};assert.equal(fixture(JSON.stringify(corrupt)).elements.moves.textContent,0);
});
test('swipe and keyboard each issue one full slide; short/cancelled gestures do nothing',()=>{
 const ui=fixture(),l=E.createLevel(1),dir=l.solution[0],vector=E.directions[dir],board=ui.elements.board;
 board.emit('pointerdown',{isPrimary:true,button:0,pointerId:1,clientX:50,clientY:50});board.emit('pointerup',{pointerId:1,clientX:50+vector[0]*70,clientY:50+vector[1]*70});assert.equal(JSON.parse(ui.cookie()).moves,1);
 const before=ui.cookie();board.emit('pointerdown',{button:0,pointerId:2,clientX:0,clientY:0});board.emit('pointerup',{pointerId:2,clientX:3,clientY:3});assert.equal(ui.cookie(),before);
 board.emit('pointerdown',{button:0,pointerId:3,clientX:0,clientY:0});board.emit('pointercancel');board.emit('pointerup',{pointerId:3,clientX:100,clientY:0});assert.equal(ui.cookie(),before);
 const key=fixture();let prevented=false;key.document.emit('keydown',{key:{up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[dir],preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(JSON.parse(key.cookie()).moves,1);
});
test('completion recorded once, next advances, cheats block progress writes',()=>{
 const ui=fixture();for(const dir of E.createLevel(1).solution)ui.press(dir);
 assert.equal(ui.results.length,1);assert.equal(ui.results[0].name,'Maze Paint');assert.equal(ui.elements.next.hidden,false);
 const resumed=fixture(ui.cookie());assert.equal(resumed.results.length,0);assert.equal(resumed.elements.next.hidden,false);
 ui.elements.restart.click();for(const dir of E.createLevel(1).solution)ui.press(dir);assert.equal(ui.results.length,1);
 ui.elements.next.click();assert.equal(JSON.parse(ui.cookie()).number,2);
 const cheated=fixture(),before=cheated.cookie();cheated.cheat();for(const dir of E.createLevel(1).solution)cheated.press(dir);assert.equal(cheated.cookie(),before);assert.equal(cheated.results.length,0);
});

test('hint does not move the ball and the new stop chapter renders a valid saved state',()=>{
 const ui=fixture(),before=ui.cookie();ui.elements.hint.click();assert.equal(ui.cookie(),before);assert.match(ui.elements.message.textContent,/Sıradaki yön:/);
 ui.elements.level.value='25';ui.elements.level.emit('change');assert.equal(JSON.parse(ui.cookie()).number,25);
 assert.ok(ui.elements.board.children.some(tile=>(tile.className||'').includes('stop-pad')));
 for(const dir of E.createLevel(25).solution)ui.press(dir);
 assert.ok(E.isSolved(E.createLevel(25),JSON.parse(ui.cookie()).state));
});


test('one frame clock keeps paint behind the ball and retains DOM nodes',()=>{
 const l=E.createLevel(1),dir=Object.keys(E.directions).find(d=>E.trace(l,l.start,d).length>1),path=E.trace(l,l.start,dir);
 assert.ok(dir);const ui=fixture('',false,true),tiles=ui.elements.board.children.slice(),player=tiles.at(-1);
 ui.press(dir);assert.equal(ui.elements.coverage.textContent,`1 / ${l.cells.filter(Boolean).length}`);
 assert.equal(tiles[path[0]].classList.contains('painted'),false);assert.equal(ui.elements.board.children.at(-1),player);
 ui.tick(0);ui.tick(32.5);assert.equal(tiles[path[0]].classList.contains('painted'),false,'half a tile: next tile stays bare');
 ui.tick(65);assert.equal(tiles[path[0]].classList.contains('painted'),true);assert.equal(tiles[path[1]].classList.contains('painted'),false,'second tile cannot paint early');
 ui.tick(path.length*65);assert.ok(path.every(p=>tiles[p].classList.contains('painted')));assert.equal(ui.elements.board.children.at(-1),player);
 assert.equal(ui.elements.level.disabled,false);
});
test('fast input queues the next slide and reset cancels stale animation frames',()=>{
 const l=E.createLevel(1),dir=Object.keys(E.directions).find(d=>E.trace(l,l.start,d).length>1),path=E.trace(l,l.start,dir),after=E.move(l,E.initial(l),dir);
 const nextDir=Object.keys(E.directions).find(d=>E.trace(l,after.position,d).length);
 const ui=fixture('',false,true);ui.press(dir);ui.press(nextDir);assert.equal(JSON.parse(ui.cookie()).moves,1);
 ui.tick(0);ui.tick(path.length*65);assert.equal(JSON.parse(ui.cookie()).moves,2,'queued slide starts only on arrival');
 ui.elements.restart.click();ui.elements.restart.click();const before=ui.cookie();ui.tick(9999);assert.equal(ui.cookie(),before);assert.equal(JSON.parse(before).moves,0);
});
test('completion controls appear only after the ball reaches the last tile',()=>{
 const l=E.createLevel(1),dir=Object.keys(E.directions).find(d=>E.trace(l,l.start,d).length>1),path=E.trace(l,l.start,dir),last=path.at(-1);
 const saved={number:1,state:{position:l.start,painted:l.cells.map((c,i)=>c?i:-1).filter(i=>i>=0&&i!==last)},moves:4,completed:[]};
 const ui=fixture(JSON.stringify(saved),false,true);ui.press(dir);assert.equal(ui.elements.next.hidden,true);assert.match(ui.elements.message.textContent,/yuvarlanıyor/);
 ui.tick(0);ui.tick(path.length*65);assert.equal(ui.elements.next.hidden,false);assert.match(ui.elements.message.textContent,/Tamamı boyandı/);
});
