/*
 * CasualFish — CasualPass'in kendi satranç motoru. chess.js kuralları ve ekranı yönetir; arama için
 * motorun kendi hızlı tahtası vardır (chess.js her hamle için notasyon ürettiğinden saniyede ancak
 * birkaç bin pozisyona bakabiliyordu).
 *
 * Tahta: 0x88 dizisi, Zobrist anahtarı, yap/geri al. Arama: kademeli derinleşen negamax, alfa-beta,
 * PVS, dönüşüm tablosu, boş hamle budaması, geç hamle azaltması (LMR), şah çekince uzatma, katil ve
 * geçmiş sezgileri, aramanın ucunda taş almaları izleyen sakinlik araması. Tekrar ve 50 hamle beraberlik
 * sayılır. Değerlendirme: taş değerleri + kare tabloları (şah için orta oyun/oyun sonu karışımı),
 * fil çifti, geçer piyon, ikili/yalnız piyon, açık hatta kale.
 */
(function (root) {
    'use strict';

    const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
    const WHITE = 0, BLACK = 8;
    const VALUE = [0, 100, 320, 330, 500, 900, 0];
    const PHASE = [0, 0, 1, 1, 2, 4, 0];
    const MATE = 100000;
    const INF = 1e9;
    const CHARS = { p: P, n: N, b: B, r: R, q: Q, k: K };
    const NAMES = ' pnbrqk';

    // Square tables from White's side, rank 8 first.
    const PST = [null, [
        0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
        0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0
    ], [
        -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
        -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50
    ], [
        -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
        -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20
    ], [
        0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0
    ], [
        -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
        0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20
    ], [
        -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
        -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20
    ]];
    const KING_END = [
        -50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
        -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50
    ];
    const PASSED = [0, 120, 80, 50, 30, 15, 10, 0]; // by rows from promotion (White's view, row 1 = 7th rank)

    const KNIGHT = [-33, -31, -18, -14, 14, 18, 31, 33];
    const KING_D = [-17, -16, -15, -1, 1, 15, 16, 17];
    const DIAG = [-17, -15, 15, 17];
    const ORTHO = [-16, -1, 1, 16];

    // Zobrist keys as two 32-bit halves.
    let seed = 0x9e3779b9;
    const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
    const ZP = Array.from({ length: 16 * 128 * 2 }, rnd);
    const ZC = Array.from({ length: 16 * 2 }, rnd);
    const ZE = Array.from({ length: 128 * 2 }, rnd);
    const ZS = [rnd(), rnd()];

    // Castling rights cleared when a piece moves from or to these squares.
    const CASTLE_MASK = new Array(128).fill(15);
    CASTLE_MASK[116] = 15 & ~3; CASTLE_MASK[119] = 15 & ~1; CASTLE_MASK[112] = 15 & ~2;
    CASTLE_MASK[4] = 15 & ~12; CASTLE_MASK[7] = 15 & ~4; CASTLE_MASK[0] = 15 & ~8;

    const sqName = (s) => 'abcdefgh'[s & 7] + (8 - (s >> 4));
    const sqIndex = (n) => (8 - Number(n[1])) * 16 + (n.charCodeAt(0) - 97);
    const idx64 = (s) => (s >> 4) * 8 + (s & 7);

    // Move: from | to << 7 | promo << 14 | flag << 17   (flag 1 en passant, 2 castle, 4 double push)
    const mFrom = (m) => m & 127;
    const mTo = (m) => (m >> 7) & 127;
    const mPromo = (m) => (m >> 14) & 7;
    const mFlag = (m) => (m >> 17) & 7;

    class Board {
        constructor(fen) {
            this.sq = new Int8Array(128);
            this.kings = [0, 0];
            this.stack = [];
            this.hashes = [];
            this.load(fen);
        }

        load(fen) {
            const [placement, turn, castle, ep, half] = fen.split(' ');
            this.sq.fill(0);
            let s = 0;
            for (const ch of placement) {
                if (ch === '/') s += 8;
                else if (ch >= '1' && ch <= '8') s += Number(ch);
                else {
                    const piece = CHARS[ch.toLowerCase()] | (ch === ch.toLowerCase() ? BLACK : WHITE);
                    this.sq[s] = piece;
                    if ((piece & 7) === K) this.kings[piece >> 3] = s;
                    s++;
                }
            }
            this.side = turn === 'b' ? BLACK : WHITE;
            this.castle = (castle.includes('K') ? 1 : 0) | (castle.includes('Q') ? 2 : 0) | (castle.includes('k') ? 4 : 0) | (castle.includes('q') ? 8 : 0);
            this.ep = ep && ep !== '-' ? sqIndex(ep) : -1;
            this.half = Number(half) || 0;
            this.computeHash();
            this.stack.length = 0;
            this.hashes.length = 0;
        }

        computeHash() {
            let h1 = 0, h2 = 0;
            for (let s = 0; s < 128; s++) {
                if (s & 0x88 || !this.sq[s]) continue;
                const i = (this.sq[s] * 128 + s) * 2;
                h1 ^= ZP[i]; h2 ^= ZP[i + 1];
            }
            h1 ^= ZC[this.castle * 2]; h2 ^= ZC[this.castle * 2 + 1];
            if (this.ep >= 0) { h1 ^= ZE[this.ep * 2]; h2 ^= ZE[this.ep * 2 + 1]; }
            if (this.side) { h1 ^= ZS[0]; h2 ^= ZS[1]; }
            this.h1 = h1 >>> 0; this.h2 = h2 >>> 0;
        }
        key() { return this.h1 * 2097152 + (this.h2 & 0x1fffff); }

        toggle(piece, s) {
            const i = (piece * 128 + s) * 2;
            this.h1 = (this.h1 ^ ZP[i]) >>> 0; this.h2 = (this.h2 ^ ZP[i + 1]) >>> 0;
        }

        attacked(s, by) {
            const sq = this.sq;
            // pawns
            const pd = by === WHITE ? 16 : -16;
            for (const d of [pd - 1, pd + 1]) { const t = s + d; if (!(t & 0x88) && sq[t] === (P | by)) return true; }
            for (const d of KNIGHT) { const t = s + d; if (!(t & 0x88) && sq[t] === (N | by)) return true; }
            for (const d of KING_D) { const t = s + d; if (!(t & 0x88) && sq[t] === (K | by)) return true; }
            for (const d of DIAG) {
                for (let t = s + d; !(t & 0x88); t += d) {
                    const p = sq[t];
                    if (p) { if (p === (B | by) || p === (Q | by)) return true; break; }
                }
            }
            for (const d of ORTHO) {
                for (let t = s + d; !(t & 0x88); t += d) {
                    const p = sq[t];
                    if (p) { if (p === (R | by) || p === (Q | by)) return true; break; }
                }
            }
            return false;
        }
        inCheck() { return this.attacked(this.kings[this.side >> 3], this.side ^ BLACK); }

        // Pseudo-legal moves (captures only when `noisy`).
        generate(noisy) {
            const out = [];
            const sq = this.sq;
            const us = this.side;
            const them = us ^ BLACK;
            const fwd = us === WHITE ? -16 : 16;
            const startRow = us === WHITE ? 6 : 1;
            const promoRow = us === WHITE ? 0 : 7;
            const add = (f, t, flag) => {
                if ((sq[f] & 7) === P && (t >> 4) === promoRow) {
                    for (const pr of noisy ? [Q] : [Q, N, R, B]) out.push(f | t << 7 | pr << 14 | flag << 17);
                } else out.push(f | t << 7 | flag << 17);
            };
            for (let s = 0; s < 128; s++) {
                if (s & 0x88) { s += 7; continue; }
                const p = sq[s];
                if (!p || (p & 8) !== us) continue;
                const type = p & 7;
                if (type === P) {
                    const t = s + fwd;
                    if (!(t & 0x88) && !sq[t]) {
                        if (!noisy || (t >> 4) === promoRow) add(s, t, 0);
                        if (!noisy && (s >> 4) === startRow && !sq[t + fwd]) add(s, t + fwd, 4);
                    }
                    for (const c of [t - 1, t + 1]) {
                        if (c & 0x88) continue;
                        if (sq[c] && (sq[c] & 8) === them) add(s, c, 0);
                        else if (c === this.ep) add(s, c, 1);
                    }
                } else if (type === N || type === K) {
                    for (const d of type === N ? KNIGHT : KING_D) {
                        const t = s + d;
                        if (t & 0x88) continue;
                        const q = sq[t];
                        if (q ? (q & 8) === them : !noisy) out.push(s | t << 7);
                    }
                    if (type === K && !noisy) this.castles(s, out);
                } else {
                    const dirs = type === B ? DIAG : type === R ? ORTHO : KING_D;
                    for (const d of dirs) {
                        for (let t = s + d; !(t & 0x88); t += d) {
                            const q = sq[t];
                            if (q) { if ((q & 8) === them) out.push(s | t << 7); break; }
                            if (!noisy) out.push(s | t << 7);
                        }
                    }
                }
            }
            return out;
        }

        castles(s, out) {
            const sq = this.sq;
            const them = this.side ^ BLACK;
            const [kBit, qBit, home] = this.side === WHITE ? [1, 2, 116] : [4, 8, 4];
            if (s !== home || this.attacked(s, them)) return;
            if (this.castle & kBit && !sq[s + 1] && !sq[s + 2] && !this.attacked(s + 1, them) && !this.attacked(s + 2, them)) out.push(s | (s + 2) << 7 | 2 << 17);
            if (this.castle & qBit && !sq[s - 1] && !sq[s - 2] && !sq[s - 3] && !this.attacked(s - 1, them) && !this.attacked(s - 2, them)) out.push(s | (s - 2) << 7 | 2 << 17);
        }

        // Makes a move; returns false (and takes it back) if it leaves the mover's king in check.
        make(m) {
            const sq = this.sq;
            const f = mFrom(m), t = mTo(m), promo = mPromo(m), flag = mFlag(m);
            const piece = sq[f];
            const us = this.side;
            let captured = sq[t];
            let capSq = t;
            if (flag === 1) { capSq = t + (us === WHITE ? 16 : -16); captured = sq[capSq]; }
            this.stack.push([m, captured, this.castle, this.ep, this.half, this.h1, this.h2]);
            this.hashes.push(this.key());

            if (captured) { this.toggle(captured, capSq); sq[capSq] = 0; }
            this.toggle(piece, f);
            sq[f] = 0;
            const placed = promo ? promo | us : piece;
            sq[t] = placed;
            this.toggle(placed, t);
            if ((piece & 7) === K) this.kings[us >> 3] = t;
            if (flag === 2) {
                const [rf, rt] = t > f ? [f + 3, f + 1] : [f - 4, f - 1];
                const rook = sq[rf];
                sq[rf] = 0; sq[rt] = rook;
                this.toggle(rook, rf); this.toggle(rook, rt);
            }
            this.h1 = (this.h1 ^ ZC[this.castle * 2]) >>> 0; this.h2 = (this.h2 ^ ZC[this.castle * 2 + 1]) >>> 0;
            this.castle &= CASTLE_MASK[f] & CASTLE_MASK[t];
            this.h1 = (this.h1 ^ ZC[this.castle * 2]) >>> 0; this.h2 = (this.h2 ^ ZC[this.castle * 2 + 1]) >>> 0;
            if (this.ep >= 0) { this.h1 = (this.h1 ^ ZE[this.ep * 2]) >>> 0; this.h2 = (this.h2 ^ ZE[this.ep * 2 + 1]) >>> 0; }
            this.ep = flag === 4 ? (f + t) >> 1 : -1;
            if (this.ep >= 0) { this.h1 = (this.h1 ^ ZE[this.ep * 2]) >>> 0; this.h2 = (this.h2 ^ ZE[this.ep * 2 + 1]) >>> 0; }
            this.half = (piece & 7) === P || captured ? 0 : this.half + 1;
            this.side ^= BLACK;
            this.h1 = (this.h1 ^ ZS[0]) >>> 0; this.h2 = (this.h2 ^ ZS[1]) >>> 0;
            if (this.attacked(this.kings[us >> 3], this.side)) { this.unmake(); return false; }
            return true;
        }

        unmake() {
            const sq = this.sq;
            const [m, captured, castle, ep, half, h1, h2] = this.stack.pop();
            this.hashes.pop();
            this.side ^= BLACK;
            const us = this.side;
            const f = mFrom(m), t = mTo(m), promo = mPromo(m), flag = mFlag(m);
            const piece = promo ? P | us : sq[t];
            sq[f] = piece;
            sq[t] = 0;
            if (flag === 1) sq[t + (us === WHITE ? 16 : -16)] = captured;
            else sq[t] = captured;
            if ((piece & 7) === K) this.kings[us >> 3] = f;
            if (flag === 2) {
                const [rf, rt] = t > f ? [f + 3, f + 1] : [f - 4, f - 1];
                sq[rf] = sq[rt]; sq[rt] = 0;
            }
            this.castle = castle; this.ep = ep; this.half = half; this.h1 = h1; this.h2 = h2;
        }

        makeNull() {
            this.stack.push([0, 0, this.castle, this.ep, this.half, this.h1, this.h2]);
            this.hashes.push(this.key());
            if (this.ep >= 0) { this.h1 = (this.h1 ^ ZE[this.ep * 2]) >>> 0; this.h2 = (this.h2 ^ ZE[this.ep * 2 + 1]) >>> 0; }
            this.ep = -1;
            this.side ^= BLACK;
            this.h1 = (this.h1 ^ ZS[0]) >>> 0; this.h2 = (this.h2 ^ ZS[1]) >>> 0;
        }
        unmakeNull() {
            const [, , castle, ep, half, h1, h2] = this.stack.pop();
            this.hashes.pop();
            this.side ^= BLACK;
            this.castle = castle; this.ep = ep; this.half = half; this.h1 = h1; this.h2 = h2;
        }

        // Has this position occurred before (since the last capture or pawn move)?
        repeated() {
            const key = this.key();
            const n = this.hashes.length;
            for (let i = n - 2; i >= 0 && i >= n - this.half; i -= 2) if (this.hashes[i] === key) return true;
            return false;
        }

        legalMoves() {
            return this.generate(false).filter((m) => { if (!this.make(m)) return false; this.unmake(); return true; });
        }

        // Static evaluation from White's side.
        evaluate() {
            const sq = this.sq;
            let score = 0, phase = 0, wb = 0, bb = 0;
            const wPawnFiles = new Int8Array(8), bPawnFiles = new Int8Array(8);
            // Per file: the White pawn furthest back for Black's passers, the Black pawn furthest up for White's.
            const wMax = new Int8Array(8).fill(-1), bMin = new Int8Array(8).fill(8);
            for (let s = 0; s < 128; s++) {
                if (s & 0x88) { s += 7; continue; }
                const p = sq[s];
                if (!p || (p & 7) !== P) continue;
                const f = s & 7, r = s >> 4;
                if (p & 8) { bPawnFiles[f]++; if (r < bMin[f]) bMin[f] = r; } else { wPawnFiles[f]++; if (r > wMax[f]) wMax[f] = r; }
            }
            for (let s = 0; s < 128; s++) {
                if (s & 0x88) { s += 7; continue; }
                const p = sq[s];
                if (!p) continue;
                const type = p & 7, black = p & 8, f = s & 7, r = s >> 4;
                const i = black ? idx64((7 - r) * 16 + f) : idx64(s);
                if (type === K) continue;
                phase += PHASE[type];
                let v = VALUE[type] + PST[type][i];
                if (type === P) {
                    const own = black ? bPawnFiles : wPawnFiles;
                    if (own[f] > 1) v -= 12;
                    if ((f === 0 || !own[f - 1]) && (f === 7 || !own[f + 1])) v -= 15;
                    // Passed: no enemy pawn ahead on this or an adjacent file.
                    let passed = true;
                    for (let df = -1; df <= 1 && passed; df++) {
                        const ff = f + df;
                        if (ff < 0 || ff > 7) continue;
                        if (black ? wMax[ff] > r : bMin[ff] < r) passed = false;
                    }
                    if (passed) v += PASSED[black ? 7 - r : r];
                } else if (type === R) {
                    if (!wPawnFiles[f] && !bPawnFiles[f]) v += 20;
                    else if (!(black ? bPawnFiles : wPawnFiles)[f]) v += 10;
                } else if (type === B) { if (black) bb++; else wb++; }
                score += black ? -v : v;
            }
            const mg = Math.min(phase, 24) / 24;
            const king = (s, black) => {
                const i = black ? idx64((7 - (s >> 4)) * 16 + (s & 7)) : idx64(s);
                return Math.round(PST[K][i] * mg + KING_END[i] * (1 - mg));
            };
            score += king(this.kings[0], false) - king(this.kings[1], true);
            if (wb >= 2) score += 30;
            if (bb >= 2) score -= 30;
            return score;
        }

        hasPieces(color) {
            for (let s = 0; s < 128; s++) {
                if (s & 0x88) { s += 7; continue; }
                const p = this.sq[s];
                if (p && (p & 8) === color && (p & 7) !== P && (p & 7) !== K) return true;
            }
            return false;
        }
    }

    const ABORT = { abort: true };

    class Search {
        constructor(board, opts) {
            this.b = board;
            this.deadline = Date.now() + opts.timeMs;
            this.qLimit = opts.qLimit ?? 10;
            this.nodes = 0;
            this.tt = new Map();
            this.killers = [];
            this.history = new Int32Array(128 * 128);
        }

        tick() { if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) throw ABORT; }

        score(m, ttMove, ply) {
            if (m === ttMove) return 1e7;
            const sq = this.b.sq;
            const victim = mFlag(m) === 1 ? P : sq[mTo(m)] & 7;
            let s = 0;
            if (victim) s = 1e6 + VALUE[victim] * 10 - VALUE[sq[mFrom(m)] & 7];
            if (mPromo(m)) s += 9e5 + VALUE[mPromo(m)];
            if (s) return s;
            const k = this.killers[ply];
            if (k && (k[0] === m || k[1] === m)) return 8e5;
            return this.history[mFrom(m) * 128 + mTo(m)];
        }
        order(moves, ttMove, ply) {
            const scored = moves.map((m) => [this.score(m, ttMove, ply), m]);
            scored.sort((a, c) => c[0] - a[0]);
            return scored.map((x) => x[1]);
        }

        quiesce(alpha, beta, qd) {
            this.tick();
            const b = this.b;
            const stand = (b.side ? -1 : 1) * b.evaluate();
            if (stand >= beta) return stand;
            if (stand > alpha) alpha = stand;
            if (qd >= this.qLimit) return stand;
            for (const m of this.order(b.generate(true), 0, 0)) {
                const victim = mFlag(m) === 1 ? P : b.sq[mTo(m)] & 7;
                if (!mPromo(m) && stand + VALUE[victim] + 200 < alpha) continue;
                if (!b.make(m)) continue;
                const score = -this.quiesce(-beta, -alpha, qd + 1);
                b.unmake();
                if (score >= beta) return score;
                if (score > alpha) alpha = score;
            }
            return alpha;
        }

        negamax(depth, alpha, beta, ply, allowNull) {
            this.tick();
            const b = this.b;
            if (ply > 0 && (b.half >= 100 || b.repeated())) return 0;
            const inCheck = b.inCheck();
            if (inCheck && ply < 30) depth++;
            if (depth <= 0) return this.quiesce(alpha, beta, 0);

            const key = b.key();
            const hit = this.tt.get(key);
            let ttMove = 0;
            if (hit) {
                ttMove = hit.move;
                if (hit.depth >= depth && ply > 0) {
                    let s = hit.score;
                    if (s > MATE - 1000) s -= ply; else if (s < -MATE + 1000) s += ply;
                    if (hit.flag === 0 || (hit.flag === 1 && s >= beta) || (hit.flag === -1 && s <= alpha)) return s;
                }
            }

            // Null move: if passing still fails high, the position is good enough to cut.
            if (allowNull && !inCheck && depth >= 3 && beta < MATE - 1000 && b.hasPieces(b.side)) {
                b.makeNull();
                const s = -this.negamax(depth - 3, -beta, -beta + 1, ply + 1, false);
                b.unmakeNull();
                if (s >= beta) return beta;
            }

            const alpha0 = alpha;
            let best = -INF;
            let bestMove = 0;
            let legal = 0;
            const moves = this.order(b.generate(false), ttMove, ply);
            for (const m of moves) {
                const quiet = !(b.sq[mTo(m)] || mFlag(m) === 1 || mPromo(m));
                if (!b.make(m)) continue;
                legal++;
                let score;
                if (legal === 1) score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
                else {
                    // Late quiet moves are searched shallower first; PVS null window for the rest.
                    const reduce = depth >= 3 && legal > 4 && quiet && !inCheck ? 1 : 0;
                    score = -this.negamax(depth - 1 - reduce, -alpha - 1, -alpha, ply + 1, true);
                    if (score > alpha && (reduce || score < beta)) score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
                }
                b.unmake();
                if (score > best) { best = score; bestMove = m; }
                if (score > alpha) alpha = score;
                if (alpha >= beta) {
                    if (quiet) {
                        const k = this.killers[ply] || (this.killers[ply] = [0, 0]);
                        if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
                        this.history[mFrom(m) * 128 + mTo(m)] += depth * depth;
                    }
                    break;
                }
            }
            if (!legal) return inCheck ? -MATE + ply : 0;
            let stored = best;
            if (stored > MATE - 1000) stored += ply; else if (stored < -MATE + 1000) stored -= ply;
            if (this.tt.size > 400000) this.tt.clear();
            this.tt.set(key, { depth, score: stored, flag: best <= alpha0 ? -1 : best >= beta ? 1 : 0, move: bestMove });
            return best;
        }
    }

    const moveText = (m) => sqName(mFrom(m)) + sqName(mTo(m)) + (mPromo(m) ? NAMES[mPromo(m)] : '');

    /**
     * opts: { fen (start position), moves (['e2e4', ...] played since), timeMs, maxDepth,
     *         noise (centipawns of random jitter at the root), blunder (chance of a random move),
     *         qLimit (capture-search depth), allowed (['e7e5', ...]) }
     * Returns { move: 'e7e5', from, to, promotion, score, depth, nodes } or null.
     */
    function search(opts) {
        const b = new Board(opts.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
        for (const text of opts.moves || []) {
            const m = b.legalMoves().find((x) => moveText(x) === text);
            if (!m) break;
            b.make(m);
        }
        let root = b.legalMoves();
        if (opts.allowed) root = root.filter((m) => opts.allowed.includes(moveText(m)));
        if (!root.length) return null;
        // Easy level: now and then it simply plays something, like a beginner who did not look.
        if (opts.blunder && Math.random() < opts.blunder) {
            const text = moveText(root[Math.floor(Math.random() * root.length)]);
            return { move: text, from: text.slice(0, 2), to: text.slice(2, 4), promotion: text[4], score: 0, depth: 0, nodes: 0 };
        }
        if (opts.mode === 'fail') return failSearch(b, root, opts);
        const s = new Search(b, opts);
        const noise = opts.noise || 0;
        const jitter = new Map(root.map((m) => [m, noise ? Math.round((Math.random() * 2 - 1) * noise) : 0]));
        let best = root[0];
        let bestScore = -INF;
        let reached = 0;
        for (let depth = 1; depth <= opts.maxDepth; depth++) {
            try {
                let alpha = -INF;
                let iterBest = 0;
                let iterScore = -INF;
                for (const m of s.order(root, best, 0)) {
                    b.make(m);
                    let score;
                    try {
                        if (b.half >= 100 || b.repeated()) score = 0;
                        // With noise every root move needs an exact score; otherwise a null window will do.
                        else if (noise || iterBest === 0) score = -s.negamax(depth - 1, -INF, noise ? INF : -alpha, 1, true);
                        else {
                            score = -s.negamax(depth - 1, -alpha - 1, -alpha, 1, true);
                            if (score > alpha) score = -s.negamax(depth - 1, -INF, -alpha, 1, true);
                        }
                    } finally { b.unmake(); }
                    score += jitter.get(m);
                    if (score > iterScore) { iterScore = score; iterBest = m; }
                    if (score > alpha) alpha = score;
                }
                best = iterBest;
                bestScore = iterScore;
                reached = depth;
                if (Math.abs(bestScore) > MATE - 1000) break;
            } catch (e) {
                if (e !== ABORT) throw e;
                break;
            }
        }
        const text = moveText(best);
        return { move: text, from: text.slice(0, 2), to: text.slice(2, 4), promotion: text[4], score: bestScore, depth: reached, nodes: s.nodes };
    }

    /*
     * FailFish: plays to lose. Each root move is searched normally (the opponent is assumed to play
     * well) and the move with the WORST outcome for FailFish is chosen, so it walks into mates and
     * hands over material. It never mates or stalemates the opponent and avoids repetition and
     * 50-move draws whenever another move exists.
     */
    function failSearch(b, root, opts) {
        const s = new Search(b, opts);
        const penalty = new Map();
        for (const m of root) {
            b.make(m);
            const replies = b.legalMoves().length;
            let p = 0;
            if (!replies) p = b.inCheck() ? 4 * MATE : 3 * MATE; // would win or stalemate: never
            else if (b.half >= 100 || b.repeated()) p = 2 * MATE;
            b.unmake();
            penalty.set(m, p);
        }
        let best = root[0];
        let reached = 0;
        let bestScore = INF;
        for (let depth = 1; depth <= opts.maxDepth; depth++) {
            try {
                let iterBest = 0;
                let iterScore = INF;
                for (const m of s.order(root, best, 0)) {
                    let score = penalty.get(m);
                    if (score < MATE) {
                        b.make(m);
                        try { score = -s.negamax(depth - 1, -INF, INF, 1, true); } finally { b.unmake(); }
                        score += Math.round(Math.random() * 6); // a little variety between equally bad moves
                    }
                    if (score < iterScore) { iterScore = score; iterBest = m; }
                }
                best = iterBest;
                bestScore = iterScore;
                reached = depth;
                if (bestScore < -MATE + 1000) break; // found a way to get mated
            } catch (e) {
                if (e !== ABORT) throw e;
                break;
            }
        }
        const text = moveText(best);
        return { move: text, from: text.slice(0, 2), to: text.slice(2, 4), promotion: text[4], score: bestScore, depth: reached, nodes: s.nodes };
    }

    function perft(fen, depth) {
        const b = new Board(fen);
        const go = (d) => {
            if (!d) return 1;
            let n = 0;
            for (const m of b.generate(false)) { if (!b.make(m)) continue; n += go(d - 1); b.unmake(); }
            return n;
        };
        return go(depth);
    }

    const LEVELS = {
        1: { timeMs: 300, maxDepth: 1, noise: 220, qLimit: 0, blunder: 0.3 },
        2: { timeMs: 600, maxDepth: 3, noise: 35, qLimit: 6 },
        3: { timeMs: 1500, maxDepth: 64, noise: 0 },
        4: { timeMs: 3000, maxDepth: 64, noise: 0 },
        fail: { timeMs: 900, maxDepth: 4, noise: 0, mode: 'fail' }
    };

    const api = { search, perft, LEVELS, Board };
    root.CasualFishEngine = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
