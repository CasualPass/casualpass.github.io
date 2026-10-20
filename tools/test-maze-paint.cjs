const test=require('node:test');const assert=require('node:assert/strict');const E=require('../maze-paint/engine');
test('slides to wall, paints every crossed square and permits painted paths',()=>{
 const l={width:4,height:3,cells:[1,1,1,0,0,0,1,0,1,1,1,1],start:0};
 const s=E.initial(l),n=E.move(l,s,'right');assert.equal(n.position,2);assert.deepEqual(n.painted,[0,1,2]);assert.deepEqual(s,{position:0,painted:[0]});
 assert.equal(E.move(l,n,'right'),null);assert.equal(E.move(l,n,'up'),null);
 const down=E.move(l,n,'down');assert.equal(down.position,10);assert.deepEqual(down.path,[6,10]);
 const back=E.move(l,down,'up');assert.equal(back.position,2);assert.equal(back.painted.length,5);
 assert.equal(E.move(l,s,'diagonal'),null);
});
test('36 deterministic levels have a complete legal solution and preserve walls',()=>{
 let first=0,last=0;
 for(let i=1;i<=36;i++){
  const l=E.createLevel(i);assert.deepEqual(l,E.createLevel(i));assert.ok(l.solution.length>0);assert.equal(l.cells.length,l.width*l.height);
  let s=E.initial(l);assert.equal(E.isSolved(l,s),false);
  for(const dir of l.solution){const next=E.move(l,s,dir);assert.ok(next,`level${i}: ${dir}`);assert.ok(next.painted.every(p=>l.cells[p]>0));assert.ok(next.painted.length>=s.painted.length);s=next;}
  assert.equal(E.isSolved(l,s),true,`level ${i}`);if(i<=6)first+=l.cells.filter(Boolean).length;if(i>18)last+=l.cells.filter(Boolean).length;
 }
 assert.ok(last>first);
 const changed=E.createLevel(1);changed.cells[0]=8;assert.notDeepEqual(changed,E.createLevel(1));
 assert.throws(()=>E.createLevel(0),RangeError);assert.throws(()=>E.createLevel(37),RangeError);
});
test('corrupt progress cannot pass state validation or completion',()=>{
 const l=E.createLevel(1),valid=E.initial(l);assert.equal(E.validateState(l,valid),true);
 const wall=l.cells.indexOf(0);
 for(const state of [null,{position:wall,painted:[wall]},{position:l.start,painted:[l.start,l.start]},{position:l.start,painted:[l.start,undefined]},{position:l.start,painted:[l.start,,]},{position:l.start,painted:[]}]){
 assert.equal(E.validateState(l,state),false);assert.equal(E.isSolved(l,state),false);
 }
 assert.equal(E.isSolved(l,valid),false);
});
