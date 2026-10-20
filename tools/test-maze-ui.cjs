const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../maze-paint/engine');
function fixture(cookie='',cheating=false){
 const elements={},writes=[],results=[];
 class Element{
  constructor(){this.listeners={};this.children=[];this.style={setProperty:(k,v)=>this.style[k]=v};this.classList={add:n=>this.className+=' '+n,contains:n=>(this.className||'').split(' ').includes(n)};}
  append(child){this.children.push(child);}replaceChildren(){this.children=[];}setAttribute(k,v){this[k]=v;}
  addEventListener(k,f){(this.listeners[k]||=[]).push(f);}emit(k,e={}){for(const f of this.listeners[k]||[])f({target:this,...e});}
  click(){if(!this.disabled)this.emit('click');}focus(){}closest(){return null;}setPointerCapture(){}
 }
 for(const id of ['board','coverage','fill','level-title','progress','moves','completed','level','undo','next','restart','message'])elements[id]=new Element();
 const buttons=Object.keys(E.directions).map(dir=>{const b=new Element();b.dataset={dir};return b;});
 const document=new Element(),window=new Element();document.body=new Element();document.createElement=()=>new Element();document.getElementById=id=>{assert.ok(elements[id],id);return elements[id];};document.querySelectorAll=()=>buttons;
 const context=vm.createContext({window,document,matchMedia:()=>({matches:false}),cheatsActive:()=>cheating,getCookieValue:()=>cookie,setCookieValue:(n,v)=>{assert.equal(n,'cp_maze_v1');cookie=v;writes.push(v);},recordGameResult:(name,result)=>results.push({name,...result})});
 vm.runInContext(fs.readFileSync(require.resolve('../maze-paint/engine'),'utf8'),context);window.MazeEngine=context.MazeEngine;
 vm.runInContext(fs.readFileSync(require.resolve('../maze-paint/script'),'utf8'),context);
 return {elements,document,window,writes,results,cookie:()=>cookie,press:dir=>buttons.find(b=>b.dataset.dir===dir).click(),cheat:()=>{cheating=true;window.emit('casual-cheat');}};
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
