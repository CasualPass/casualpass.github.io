const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = require('../nuts-bolts/engine.js');

test('one nut moves to a matching or empty bolt without mutating input', () => {
  const board = [[0, 1, 1], [1], []];
  const before = structuredClone(board);
  const next = engine.move(board, 0, 1);
  assert.deepEqual(next, [[0, 1], [1, 1], []]);
  assert.deepEqual(board, before);
  for (let i = 0; i < board.length; i++) assert.notEqual(next[i], board[i]);
  assert.deepEqual(engine.move(board, 0, 2), [[0, 1], [1], [1]]);
});

test('illegal moves and malformed inputs are rejected', () => {
  const board = [[0], [1, 1, 1, 1], []];
  const before = structuredClone(board);
  for (const pair of [[0, 1], [2, 0], [0, 0], [-1, 0], [0, 3], [0.5, 2]]) {
    assert.equal(engine.move(board, ...pair), null);
  }
  assert.equal(engine.move([[0], [1]], 0, 1), null);
  assert.equal(engine.move(null, 0, 1), null);
  assert.equal(engine.move([[9], []], 0, 1), null);
  assert.deepEqual(board, before);
  assert.deepEqual(engine.legalMoves(board), [[0, 2], [1, 2]]);
});

test('win requires full monochrome stacks, not split partial stacks', () => {
  assert.equal(engine.isSolved([[0, 0], [0, 0], []]), false);
  assert.equal(engine.isSolved([[0, 0, 0, 0], [1, 1, 1, 1], []]), true);
  assert.equal(engine.isSolved([[0, 0, 1, 0], []]), false);
  assert.equal(engine.isSolved([[], []]), false);
  assert.equal(engine.isSolved(null), false);
});

test('all 30 deterministic levels preserve counts and have a legal complete witness', () => {
  let earlyMix = 0;
  let lateMix = 0;
  for (let level = 1; level <= 30; level++) {
    const generated = engine.createLevel(level);
    const original = structuredClone(generated.bolts);
    assert.deepEqual(engine.createLevel(level), generated, `determinism ${level}`);
    assert.equal(engine.validateBoard(generated.bolts, level), true, `counts ${level}`);
    assert.equal(generated.bolts.length, engine.colorsForLevel(level) + 2);
    assert.equal(engine.isSolved(generated.bolts), false);
    const mixed = generated.bolts.filter(bolt => new Set(bolt).size > 1).length;
    assert.ok(mixed >= 2, `mixed level ${level}`);
    if (level <= 5) earlyMix += mixed;
    if (level >= 26) lateMix += mixed;
    let board = generated.bolts;
    for (const pair of generated.solution) {
      const next = engine.move(board, ...pair);
      assert.ok(next, `legal witness ${level}: ${pair}`);
      assert.equal(engine.validateBoard(next, level), true);
      board = next;
    }
    assert.equal(engine.isSolved(board), true, `solved ${level}`);
    assert.deepEqual(generated.bolts, original);
  }
  assert.ok(lateMix > earlyMix, 'later levels mix more bolts');
});

test('board validation rejects wrong counts, capacity, colors and level', () => {
  const board = engine.createLevel(1).bolts;
  const removed = structuredClone(board);
  removed.find(bolt => bolt.length).pop();
  assert.equal(engine.validateBoard(removed, 1), false);
  const wrongColor = structuredClone(board);
  wrongColor.find(bolt => bolt.length)[0] = 7;
  assert.equal(engine.validateBoard(wrongColor, 1), false);
  assert.equal(engine.validateBoard(board.slice(1), 1), false);
  assert.equal(engine.validateBoard([[0, 0, 0, 0, 0], [], [], [], []], 1), false);
  assert.equal(engine.validateBoard(board, 0), false);
  assert.equal(engine.validateBoard(board, 31), false);
  assert.equal(engine.validateBoard([new Array(4), [], [], [], []], 1), false);
  assert.equal(engine.validateBoard(new Array(5), 1), false);
  assert.throws(() => engine.createLevel(0), RangeError);
  assert.throws(() => engine.colorsForLevel(1.5), RangeError);
  assert.equal(engine.colorsForLevel(1), 3);
  assert.equal(engine.colorsForLevel(30), 8);
});

test('the same pure API loads as a browser global without CommonJS', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../nuts-bolts/engine.js'), 'utf8'), context);
  assert.equal(context.NutsEngine.capacity, 4);
  assert.equal(context.NutsEngine.validateBoard(context.NutsEngine.createLevel(1).bolts, 1), true);
});
