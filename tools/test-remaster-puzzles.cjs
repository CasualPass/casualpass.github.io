const test=require('node:test'),assert=require('node:assert/strict'),M=require('../maze-paint/engine'),N=require('../nuts-bolts/engine');
test('original maze levels retain layouts and new chapter has functional stop pads',()=>{
 for(let n=25;n<=36;n++)assert.ok(M.createLevel(n).cells.includes(M.STOP));
 const l={width:5,height:1,cells:[1,1,2,1,1],start:0};const first=M.move(l,M.initial(l),'right');assert.equal(first.position,2);assert.deepEqual(first.painted,[0,1,2]);assert.equal(M.move(l,first,'right').position,4);
});
test('maze hint leads to a new square and completes all 36 levels without looping',()=>{
 for(let n=1;n<=36;n++){
  const l=M.createLevel(n);let state=M.initial(l),steps=0;
  while(!M.isSolved(l,state)&&steps++<500){const hint=M.nextHint(l,state);assert.ok(hint,`hint${n}`);state=M.move(l,state,hint);assert.ok(state);}
  assert.ok(M.isSolved(l,state),`level${n} in${steps}`);assert.equal(M.nextHint(l,state),null);
 }
});
test('nuts bounded solver hints return legal complete solutions without mutating boards',()=>{
 for(let n=1;n<=30;n++){
  const l=N.createLevel(n),original=JSON.stringify(l.bolts),solution=N.solve(l.bolts,3000);assert.ok(solution,`level${n}`);let board=l.bolts;
  for(const pair of solution){board=N.move(board,...pair);assert.ok(board);}
  assert.ok(N.isSolved(board));assert.equal(JSON.stringify(l.bolts),original);
 }
});
