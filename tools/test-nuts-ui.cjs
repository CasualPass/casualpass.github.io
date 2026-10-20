const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = require('../nuts-bolts/engine.js');

const palette = ['#eb657b', '#60a9f5', '#e9b84c', '#56c7a1', '#ad85ed', '#ef914f', '#5dcddd', '#d986b6'];

function fixture(options = {}) {
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag;
      this.children = [];
      this.listeners = {};
      this.attributes = {};
      this.className = '';
      this.style = { setProperty: (key, value) => { this.style[key] = value; } };
      this.classList = {
        add: name => { this.className += ` ${name}`; },
        contains: name => this.className.split(/\s+/).includes(name)
      };
    }
    append(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
    dispatch(type, extra = {}) {
      for (const listener of this.listeners[type] || []) listener({ target: this, ...extra });
    }
    click() { if (!this.disabled) this.dispatch('click'); }
    focus() { document.activeElement = this; }
  }
  const ids = ['level', 'level-title', 'progress', 'moves', 'completed', 'undo', 'next', 'restart', 'board', 'message'];
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
  const document = new Element('document');
  document.getElementById = id => {
    assert.ok(elements[id], `known fixture element ${id}`);
    return elements[id];
  };
  document.createElement = tag => new Element(tag);
  const window = new Element('window');
  let cookie = options.cookie || '';
  let cheating = !!options.cheating;
  const writes = [];
  const results = [];
  const context = vm.createContext({ window, document,
    getCookieValue: name => { assert.equal(name, 'cp_nuts_v1'); return cookie; },
    setCookieValue: (name, value) => {
      assert.equal(name, 'cp_nuts_v1'); cookie = value; writes.push(value);
    },
    cheatsActive: () => cheating,
    recordGameResult: (game, result) => results.push({ game, result: JSON.parse(JSON.stringify(result)) })
  });
  vm.runInContext(fs.readFileSync(require.resolve('../nuts-bolts/engine.js'), 'utf8'), context);
  window.NutsEngine = context.NutsEngine;
  vm.runInContext(fs.readFileSync(require.resolve('../nuts-bolts/script.js'), 'utf8'), context);
  return {
    elements, writes, results,
    cookie: () => cookie,
    board: () => elements.board.children.map(bolt => bolt.children
      .filter(child => child.className === 'nut')
      .map(nut => palette.indexOf(nut.style['--color']))),
    move: (from, to) => {
      elements.board.children[from].click();
      elements.board.children[to].click();
    },
    cheat: () => { cheating = true; window.dispatch('casual-cheat'); }
  };
}

test('legal bolt clicks transfer one nut, count moves, and undo restores the board', () => {
  const ui = fixture();
  const initial = ui.board();
  const pair = engine.legalMoves(initial)[0];
  ui.move(...pair);
  assert.deepEqual(ui.board(), engine.move(initial, ...pair));
  assert.equal(Number(ui.elements.moves.textContent), 1);
  assert.equal(ui.elements.undo.disabled, false);
  ui.elements.undo.click();
  assert.deepEqual(ui.board(), initial);
  assert.equal(Number(ui.elements.moves.textContent), 0);
  assert.equal(ui.elements.undo.disabled, true);
  assert.deepEqual(JSON.parse(ui.cookie()).board, initial);
});

test('illegal destination clicks leave the board, count and persisted state unchanged', () => {
  const ui = fixture();
  const initial = ui.board();
  let illegal;
  for (let from = 0; from < initial.length; from++) {
    if (!initial[from].length) continue;
    for (let to = 0; to < initial.length; to++) {
      if (from !== to && !engine.move(initial, from, to)) illegal = [from, to];
    }
  }
  assert.ok(illegal, 'level includes an illegal destination');
  const cookie = ui.cookie();
  ui.move(...illegal);
  assert.deepEqual(ui.board(), initial);
  assert.equal(Number(ui.elements.moves.textContent), 0);
  assert.equal(ui.cookie(), cookie);
  assert.match(ui.elements.message.textContent, /dolu|aynı rengin/);
});

test('restart requires a second confirmation once an unsolved move has been made', () => {
  const ui = fixture();
  const initial = ui.board();
  ui.move(...engine.legalMoves(initial)[0]);
  const changed = ui.board();
  ui.elements.restart.click();
  assert.deepEqual(ui.board(), changed);
  assert.equal(Number(ui.elements.moves.textContent), 1);
  assert.match(ui.elements.restart.textContent, /tekrar bas/);
  ui.elements.restart.click();
  assert.deepEqual(ui.board(), initial);
  assert.equal(Number(ui.elements.moves.textContent), 0);
  assert.equal(ui.elements.undo.disabled, true);
});

test('valid cookie resumes board and count; corrupt cookies fall back to level one', () => {
  const ui = fixture();
  ui.move(...engine.legalMoves(ui.board())[0]);
  const resumed = fixture({ cookie: ui.cookie() });
  assert.deepEqual(resumed.board(), ui.board());
  assert.equal(Number(resumed.elements.moves.textContent), 1);
  assert.equal(resumed.elements.undo.disabled, true, 'reload does not invent undo history');
  assert.equal(resumed.writes.length, 0, 'restoring is read-only');
  for (const cookie of ['{bad json', JSON.stringify({ level: 30, board: [[0]], moves: 99 }),
    JSON.stringify({ level: 31, board: engine.createLevel(1).bolts })]) {
    const fallback = fixture({ cookie });
    assert.deepEqual(fallback.board(), engine.createLevel(1).bolts);
    assert.equal(Number(fallback.elements.moves.textContent), 0);
    assert.equal(fallback.elements.level.value, '1');
    assert.equal(engine.validateBoard(JSON.parse(fallback.cookie()).board, 1), true);
  }
});

test('solving via actual button listeners records one win and replay cannot duplicate it', () => {
  const ui = fixture();
  const { solution } = engine.createLevel(1);
  for (const pair of solution) ui.move(...pair);
  assert.equal(engine.isSolved(ui.board()), true);
  assert.equal(Number(ui.elements.moves.textContent), solution.length);
  assert.deepEqual(ui.results, [{ game: 'Nuts & Bolts', result: { won: true, score: 1 } }]);
  assert.equal(ui.elements.next.hidden, false);
  assert.deepEqual(JSON.parse(ui.cookie()).completed, [1]);
  ui.elements.board.children[0].click();
  assert.equal(ui.results.length, 1, 'clicking a solved board cannot award again');
  ui.elements.restart.click();
  for (const pair of solution) ui.move(...pair);
  assert.equal(engine.isSolved(ui.board()), true);
  assert.equal(ui.results.length, 1, 'replaying a completed level cannot award again');
  const resumed = fixture({ cookie: ui.cookie() });
  assert.equal(engine.isSolved(resumed.board()), true);
  assert.equal(resumed.results.length, 0);
  ui.elements.next.click();
  assert.equal(ui.elements.level.value, '2');
  assert.deepEqual(ui.board(), engine.createLevel(2).bolts);
});

test('cheat activation prevents subsequent progress writes and win awards', () => {
  const ui = fixture();
  const cookie = ui.cookie();
  const writes = ui.writes.length;
  ui.cheat();
  for (const pair of engine.createLevel(1).solution) ui.move(...pair);
  assert.equal(engine.isSolved(ui.board()), true);
  assert.equal(ui.cookie(), cookie);
  assert.equal(ui.writes.length, writes);
  assert.equal(ui.results.length, 0);
  ui.elements.undo.click();
  assert.equal(ui.writes.length, writes);
  const cheatedStart = fixture({ cheating: true });
  assert.equal(cheatedStart.writes.length, 0);
  cheatedStart.move(...engine.legalMoves(cheatedStart.board())[0]);
  assert.equal(cheatedStart.writes.length, 0);
});
