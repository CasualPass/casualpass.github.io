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

  return { capacity: capacity, colorsForLevel: colorsForLevel, createLevel: createLevel,
    move: move, legalMoves: legalMoves, isSolved: isSolved, validateBoard: validateBoard };
}));
