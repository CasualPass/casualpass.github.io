(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NutsEngine = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const capacity = 4;

  function colorsForLevel(level) {
    if (!Number.isInteger(level) || level < 1 || level > 30) {
      throw new RangeError('Level must be an integer from 1 to 30.');
    }
    return Math.min(8, 3 + Math.floor((level - 1) / 5));
  }

  function hasShape(bolts) {
    return Array.isArray(bolts) && bolts.length > 0 && Array.from(bolts).every(function (bolt) {
      return Array.isArray(bolt) && bolt.length <= capacity &&
        Array.from(bolt).every(function (color) {
          return Number.isInteger(color) && color >= 0 && color < 8;
        });
    });
  }

  function validateBoard(bolts, level) {
    let colors;
    try { colors = colorsForLevel(level); } catch (_) { return false; }
    if (!hasShape(bolts) || bolts.length !== colors + 2) return false;
    const counts = Array(colors).fill(0);
    for (const bolt of bolts) {
      for (const color of bolt) {
        if (color >= colors) return false;
        counts[color] += 1;
      }
    }
    return counts.every(function (count) { return count === capacity; });
  }

  function canMove(bolts, from, to) {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to ||
        from < 0 || to < 0 || from >= bolts.length || to >= bolts.length) return false;
    const source = bolts[from];
    const target = bolts[to];
    return source.length > 0 && target.length < capacity &&
      (target.length === 0 || target[target.length - 1] === source[source.length - 1]);
  }

  function move(bolts, from, to) {
    if (!hasShape(bolts) || !canMove(bolts, from, to)) return null;
    const next = bolts.map(function (bolt) { return bolt.slice(); });
    next[to].push(next[from].pop());
    return next;
  }

  function legalMoves(bolts) {
    if (!hasShape(bolts)) return [];
    const moves = [];
    for (let from = 0; from < bolts.length; from += 1) {
      for (let to = 0; to < bolts.length; to += 1) {
        if (canMove(bolts, from, to)) moves.push([from, to]);
      }
    }
    return moves;
  }

  function isSolved(bolts) {
    return hasShape(bolts) && bolts.some(function (bolt) { return bolt.length > 0; }) &&
      bolts.every(function (bolt) {
        return bolt.length === 0 || (bolt.length === capacity && bolt.every(function (color) {
          return color === bolt[0];
        }));
      });
  }

  function createLevel(level) {
    const colors = colorsForLevel(level);
    let seed = (0x6d2b79f5 ^ (level * 2654435761)) >>> 0;
    function random() {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    }
    let best = null;
    let bestScore = -1;
    // Each reverse step is the exact inverse of a legal player move. In
    // particular, the exposed source top must match the nut we remove.
    // Never shuffle full stacks: that would lose the solvability guarantee.
    const steps = 24 + level * 4;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const bolts = Array.from({ length: colors }, function (_, color) {
        return Array(capacity).fill(color);
      }).concat([[], []]);
      const path = [];
      const seen = new Set([JSON.stringify(bolts)]);
      for (let step = 0; step < steps; step += 1) {
        const choices = [];
        for (let from = 0; from < bolts.length; from += 1) {
          const source = bolts[from];
          if (!source.length || (source.length > 1 &&
              source[source.length - 2] !== source[source.length - 1])) continue;
          for (let to = 0; to < bolts.length; to += 1) {
            if (to === from || bolts[to].length === capacity) continue;
            const next = bolts.map(function (bolt) { return bolt.slice(); });
            next[to].push(next[from].pop());
            const key = JSON.stringify(next);
            if (!seen.has(key)) choices.push({ from: from, to: to, next: next, key: key });
          }
        }
        if (!choices.length) break;
        const choice = choices[Math.floor(random() * choices.length)];
        bolts.splice(0, bolts.length, ...choice.next);
        seen.add(choice.key);
        path.push([choice.to, choice.from]);
        let boundaries = 0;
        let mixed = 0;
        for (const bolt of bolts) {
          let local = 0;
          for (let i = 1; i < bolt.length; i += 1) {
            if (bolt[i] !== bolt[i - 1]) local += 1;
          }
          boundaries += local;
          if (local) mixed += 1;
        }
        const score = boundaries * 10 + mixed * 4 + path.length / (steps + 1);
        if (mixed >= 2 && score > bestScore) {
          bestScore = score;
          best = {
            bolts: bolts.map(function (bolt) { return bolt.slice(); }),
            solution: path.slice().reverse().map(function (pair) { return pair.slice(); })
          };
        }
      }
    }
    if (!best) throw new Error('Unable to construct a mixed level.');
    return best;
  }


  // Admissible estimate: every nut above a bolt's bottom run must move, and
  // all bottom runs of one colour except the largest must move as well.
  function estimate(bolts) {
    let cost = 0;
    const runTotal = {};
    const runMax = {};
    for (const bolt of bolts) {
      if (!bolt.length) continue;
      let run = 1;
      while (run < bolt.length && bolt[run] === bolt[0]) run += 1;
      cost += bolt.length - run;
      const color = bolt[0];
      runTotal[color] = (runTotal[color] || 0) + run;
      runMax[color] = Math.max(runMax[color] || 0, run);
    }
    for (const color in runTotal) cost += runTotal[color] - runMax[color];
    return cost;
  }

  function stateKey(bolts) {
    return bolts.map(function (bolt) { return bolt.join(''); }).sort().join('|');
  }

  // Weighted A* over bolt-order-independent states. Returns a list of
  // [from, to] moves, [] for a solved board, or null when no solution was
  // found within the node limit (a dead end or a very deep position).
  function solve(bolts, limit) {
    if (!hasShape(bolts)) return null;
    if (isSolved(bolts)) return [];
    const maxNodes = limit || 40000;
    const heap = [];
    function push(node) {
      heap.push(node);
      let i = heap.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (heap[parent].f <= node.f) break;
        heap[i] = heap[parent]; i = parent;
      }
      heap[i] = node;
    }
    function pop() {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        let i = 0;
        for (;;) {
          let child = 2 * i + 1;
          if (child >= heap.length) break;
          if (child + 1 < heap.length && heap[child + 1].f < heap[child].f) child += 1;
          if (heap[child].f >= last.f) break;
          heap[i] = heap[child]; i = child;
        }
        heap[i] = last;
      }
      return top;
    }
    const start = bolts.map(function (bolt) { return bolt.slice(); });
    const best = new Map([[stateKey(start), 0]]);
    push({ bolts: start, g: 0, f: 2 * estimate(start), parent: null, move: null });
    let expanded = 0;
    while (heap.length && expanded < maxNodes) {
      const node = pop();
      if (best.get(stateKey(node.bolts)) < node.g) continue;
      if (isSolved(node.bolts)) {
        const path = [];
        for (let at = node; at.parent; at = at.parent) path.push(at.move);
        return path.reverse();
      }
      expanded += 1;
      const current = node.bolts;
      for (let from = 0; from < current.length; from += 1) {
        let emptyTried = false;
        const source = current[from];
        if (!source.length) continue;
        const top = source[source.length - 1];
        const mono = source.every(function (color) { return color === top; });
        if (mono && source.length === capacity) continue;
        for (let to = 0; to < current.length; to += 1) {
          if (to === from) continue;
          const target = current[to];
          if (target.length === capacity) continue;
          if (!target.length) {
            // Moving a pure stack onto an empty bolt only relabels it, and
            // all empty bolts are interchangeable.
            if (mono || emptyTried) continue;
          } else if (target[target.length - 1] !== top) continue;
          if (!target.length) emptyTried = true;
          const next = current.map(function (bolt) { return bolt.slice(); });
          next[to].push(next[from].pop());
          const key = stateKey(next);
          const g = node.g + 1;
          if (best.has(key) && best.get(key) <= g) continue;
          best.set(key, g);
          push({ bolts: next, g: g, f: g + 2 * estimate(next), parent: node, move: [from, to] });
        }
      }
    }
    return null;
  }

  return { capacity: capacity, colorsForLevel: colorsForLevel, createLevel: createLevel,
    move: move, legalMoves: legalMoves, isSolved: isSolved, validateBoard: validateBoard, solve: solve };
}));
