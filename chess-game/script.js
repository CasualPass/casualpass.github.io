/**
 * Chess Game Controller for CasualPass
 * Utilizes generic chess.js minified library for moves & validation.
 * UI and rendering is completely custom using DOM manipulation.
 */

// Initialize Chess engine
const gameEngine = new Chess();

// DOM Elements
const boardElement = document.getElementById('chessboard');
const statusDisplay = document.getElementById('status-display');
const overlay = document.getElementById('game-over-overlay');
const gameOverText = document.getElementById('game-over-text');
const gameOverDetail = document.getElementById('game-over-detail');
const resetBtn = document.getElementById('reset-btn');
const rematchBtn = document.getElementById('rematch-btn');
const resignBtn = document.getElementById('resign-btn');
const lobbyMenu = document.getElementById('lobby-menu');
const gameArea = document.getElementById('game-area');
const startGameBtn = document.getElementById('start-game-btn');
const diffWrapper = document.getElementById('difficulty-wrapper');
const diffSlider = document.getElementById('bot-difficulty');
const promotionOverlay = document.getElementById('promotion-overlay');
const promotionCancel = document.getElementById('promotion-cancel');

// State Variables
let selectedSquare = null;      // "e2" etc.
let isVersusBot = true;
let botDifficulty = 2; // 1: Kolay, 2: Orta, 3: Zor
let gameActive = false;
let isAnimating = false;
let botTimer = null;
let lastMove = null;            // { from, to } of the most recent move
let pendingPromotion = null;    // { from, to } while the promotion picker is open
let focusedSquare = 'e2';       // roving tabindex target for keyboard play
let resignConfirmTimer = null;

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const DIFFICULTY_NAMES = { 1: 'Kolay', 2: 'Orta', 3: 'Zor' };
const PIECE_NAMES = { p: 'piyon', n: 'at', b: 'fil', r: 'kale', q: 'vezir', k: 'şah' };

// Filled glyphs for both colors (colored via CSS) so white pieces stay readable on light squares.
// U+FE0E keeps iOS from drawing the black pawn as an emoji.
const piecesMap = {
    'p': '♟︎', 'r': '♜︎', 'n': '♞︎', 'b': '♝︎', 'q': '♛︎', 'k': '♚︎'
};

/**
 * Initialize the 8x8 Board Structure
 */
function createBoard() {
    boardElement.innerHTML = '';

    for (let row = 0; row < 8; row++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'board-row';
        rowDiv.setAttribute('role', 'row');

        for (let col = 0; col < 8; col++) {
            const squareDiv = document.createElement('div');

            const rank = 8 - row;
            const file = FILES[col];
            const squareId = file + rank;

            squareDiv.id = squareId;
            squareDiv.className = 'square';
            squareDiv.setAttribute('role', 'gridcell');
            squareDiv.tabIndex = squareId === focusedSquare ? 0 : -1;
            squareDiv.classList.add((row + col) % 2 === 0 ? 'light' : 'dark');

            // Board coordinates (rank numbers on the a-file, file letters on rank 1)
            if (col === 0) squareDiv.appendChild(makeCoord('coord-rank', rank));
            if (row === 7) squareDiv.appendChild(makeCoord('coord-file', file));

            squareDiv.addEventListener('click', () => handleSquareClick(squareId));
            squareDiv.addEventListener('keydown', (e) => handleSquareKey(e, squareId));

            rowDiv.appendChild(squareDiv);
        }
        boardElement.appendChild(rowDiv);
    }
}

function makeCoord(className, text) {
    const span = document.createElement('span');
    span.className = `coord ${className}`;
    span.textContent = text;
    span.setAttribute('aria-hidden', 'true');
    return span;
}

/**
 * Renders the pieces onto the board based on chess.js internal state
 */
function renderPieces() {
    const boardState = gameEngine.board();

    document.querySelectorAll('.square').forEach(sq => {
        sq.querySelectorAll('.chess-piece').forEach(p => p.remove());
        sq.classList.remove('selected', 'highlight', 'capture', 'in-check', 'last-move');
    });

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            const squareId = FILES[col] + (8 - row);
            const squareEl = document.getElementById(squareId);
            if (piece) {
                const pieceEl = document.createElement('div');
                pieceEl.className = `chess-piece ${piece.color === 'w' ? 'white' : 'black'}`;
                pieceEl.textContent = piecesMap[piece.type];
                pieceEl.setAttribute('aria-hidden', 'true');

                // Bind Drag & Drop event seamlessly!
                setupDragEvents(pieceEl, squareId);

                squareEl.appendChild(pieceEl);
            }
            squareEl.setAttribute('aria-label', describeSquare(squareId, piece));
        }
    }

    if (lastMove) {
        document.getElementById(lastMove.from).classList.add('last-move');
        document.getElementById(lastMove.to).classList.add('last-move');
    }

    if (gameEngine.in_check()) {
        const turnColor = gameEngine.turn();
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = boardState[r][c];
                if (p && p.type === 'k' && p.color === turnColor) {
                    document.getElementById(FILES[c] + (8 - r)).classList.add('in-check');
                }
            }
        }
    }
}

function describeSquare(squareId, piece) {
    if (!piece) return `${squareId}, boş`;
    return `${squareId}, ${piece.color === 'w' ? 'beyaz' : 'siyah'} ${PIECE_NAMES[piece.type]}`;
}

/**
 * True when the human may not touch the board right now
 */
function inputLocked() {
    return !gameActive
        || gameEngine.game_over()
        || isAnimating
        || pendingPromotion !== null
        || (isVersusBot && gameEngine.turn() !== 'w');
}

/**
 * =========================================================
 * DRAG AND DROP MECHANICS & ANIMATION
 * =========================================================
 */
let activePiece = null;
let startSquare = null;
let wasSelected = false;
let dragIsTouch = false;

function setupDragEvents(pieceEl, squareId) {
    pieceEl.addEventListener('mousedown', (e) => startDrag(e, pieceEl, squareId));
    pieceEl.addEventListener('touchstart', (e) => startDrag(e, pieceEl, squareId), { passive: false });
}

function startDrag(e, pieceEl, squareId) {
    if (inputLocked()) return;
    if (e.type === 'mousedown' && e.button !== 0) return;

    const pieceObj = gameEngine.get(squareId);
    if (!pieceObj || pieceObj.color !== gameEngine.turn()) {
        return; // Let the normal square click handler manage enemy pieces
    }

    // Prevent default touch actions and NATIVE image drag ghosting
    e.preventDefault();
    if (typeof playClickSound === 'function') playClickSound();

    wasSelected = (selectedSquare === squareId);
    dragIsTouch = e.type === 'touchstart';

    activePiece = pieceEl;
    startSquare = squareId;

    selectedSquare = squareId;
    setFocusedSquare(squareId, false);
    clearSelectionMarks();
    highlightValidMoves(squareId);

    // Lock the dragged glyph to the rendered square size before leaving the board
    activePiece.style.fontSize = getComputedStyle(activePiece).fontSize;
    document.body.appendChild(activePiece);
    activePiece.classList.add('dragging');
    activePiece.classList.remove('snap-back');

    movePieceWithCursor(e);

    document.addEventListener('mousemove', dragMove);
    document.addEventListener('touchmove', dragMove, { passive: false });
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);
    document.addEventListener('touchcancel', endDrag);
}

function dragMove(e) {
    if (!activePiece) return;
    if (e.type === 'touchmove') e.preventDefault();
    movePieceWithCursor(e);
}

function movePieceWithCursor(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // On touch, lift the piece above the finger so the player can see it
    const lift = dragIsTouch ? activePiece.offsetHeight * 0.6 : 0;
    activePiece.style.left = `${clientX - activePiece.offsetWidth / 2}px`;
    activePiece.style.top = `${clientY - activePiece.offsetHeight / 2 - lift}px`;
}

function endDrag(e) {
    if (!activePiece) return;

    activePiece.classList.remove('dragging');

    const point = e.changedTouches ? e.changedTouches[0] : e;
    const clientX = point.clientX;
    const clientY = point.clientY;

    // Use elementsFromPoint to penetrate the dragging piece if it's over the square
    let targetSquare = null;
    if (e.type !== 'touchcancel') {
        const elements = document.elementsFromPoint(clientX, clientY);
        for (let el of elements) {
            if (el.classList.contains('square')) {
                targetSquare = el;
                break;
            }
        }
    }

    document.removeEventListener('mousemove', dragMove);
    document.removeEventListener('touchmove', dragMove);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchend', endDrag);
    document.removeEventListener('touchcancel', endDrag);

    const sq = document.getElementById(startSquare);
    if (sq) sq.appendChild(activePiece);

    activePiece.style.left = '';
    activePiece.style.top = '';
    activePiece.style.fontSize = '';

    if (targetSquare && targetSquare.id) {
        if (targetSquare.id === startSquare) {
            // Dropped where it started (interpreted as a click)
            activePiece.classList.add('snap-back');

            if (wasSelected) {
                // If it was already selected before the click, deselect it
                selectedSquare = null;
                clearSelectionMarks();
            }
        } else {
            const success = tryMove(startSquare, targetSquare.id, false); // false = no animation
            if (!success) snapPieceBack();
        }
    } else {
        snapPieceBack();
    }

    activePiece = null;
    startSquare = null;
}

function snapPieceBack() {
    if (!activePiece) return;
    activePiece.classList.add('snap-back');
    activePiece.style.left = '';
    activePiece.style.top = '';

    selectedSquare = null;
    clearSelectionMarks();
}

/**
 * Handle move attempt logic & bot trigger.
 * 'animate' boolean tells us whether to smoothly transition the move (for click/bot)
 * Returns true when the move was played or is waiting on the promotion picker.
 */
function tryMove(from, to, animate = true, promotion = null) {
    const candidates = gameEngine.moves({ square: from, verbose: true }).filter(m => m.to === to);
    if (candidates.length === 0) return false;

    if (!promotion && candidates.some(m => m.promotion)) {
        openPromotionPicker(from, to, animate);
        return true;
    }

    const moveAttempt = gameEngine.move({ from, to, promotion: promotion || 'q' });
    if (moveAttempt) {
        if (isImmortalEnabled() && gameEngine.in_checkmate() && (!isVersusBot || matesWhite())) {
            gameEngine.undo();
            selectedSquare = null;
            renderPieces();
            const hasNonMatingMove = gameEngine.moves({ verbose: true }).some((candidate) => {
                gameEngine.move(candidate);
                const mate = gameEngine.in_checkmate();
                gameEngine.undo();
                return !mate;
            });
            if (hasNonMatingMove) updateImmortalStatus();
            else showGameOver('BERABERE', 'Ölümsüzlük mat hamlelerini engelledi.');
            return false;
        }
        if (typeof playClickSound === 'function') playClickSound();
        selectedSquare = null;
        clearSelectionMarks();
        lastMove = { from, to };

        if (animate) {
            animateMoveAndRender(from, to, afterMove);
        } else {
            renderPieces(); // Just render instantly for drag drops
            afterMove();
        }
        return true;
    }
    return false;
}

function afterMove() {
    updateStatus();
    checkGameOver();
    triggerBotMove();
}

/**
 * Pawn promotion picker
 */
function openPromotionPicker(from, to, animate) {
    pendingPromotion = { from, to, animate };
    promotionOverlay.classList.remove('hidden');
    promotionOverlay.querySelector('.promotion-btn').focus();
}

function closePromotionPicker() {
    pendingPromotion = null;
    promotionOverlay.classList.add('hidden');
}

function choosePromotion(pieceType) {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    closePromotionPicker();
    tryMove(from, to, true, pieceType);
    focusSquareElement(to);
}

function cancelPromotion() {
    if (!pendingPromotion) return;
    const { from } = pendingPromotion;
    closePromotionPicker();
    selectedSquare = null;
    renderPieces();
    focusSquareElement(from);
}

function isImmortalEnabled() {
    return Boolean(window.CasualCheats && CasualCheats.immortal());
}

function matesWhite() {
    return gameEngine.in_checkmate() && gameEngine.turn() === 'w';
}

function updateImmortalStatus() {
    const turn = gameEngine.turn();
    statusDisplay.className = `status-display ${turn === 'w' ? 'turn-white' : 'turn-black'}`;
    statusDisplay.textContent = `Ölümsüzlük: Beyaz şah mat edilemez. Sıra: ${turn === 'w' ? 'Beyaz' : 'Siyah'}`;
}

/**
 * Slides piece realistically across board before calling renderPieces()
 */
function animateMoveAndRender(from, to, onComplete) {
    const fromSquare = document.getElementById(from);
    const toSquare = document.getElementById(to);

    const piece = fromSquare.querySelector('.chess-piece');
    if (!piece || !toSquare) {
        renderPieces();
        if (onComplete) onComplete();
        return;
    }

    const fromRect = fromSquare.getBoundingClientRect();
    const toRect = toSquare.getBoundingClientRect();

    const deltaX = toRect.left - fromRect.left;
    const deltaY = toRect.top - fromRect.top;

    isAnimating = true;
    piece.style.transition = 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)';
    piece.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    piece.style.zIndex = '100';

    setTimeout(() => {
        isAnimating = false;
        renderPieces();
        if (onComplete) onComplete();
    }, 250);
}

function triggerBotMove() {
    if (isVersusBot && gameEngine.turn() === 'b' && gameActive && !gameEngine.game_over()) {
        statusDisplay.className = 'status-display turn-black thinking';
        statusDisplay.textContent = 'CasualFish düşünüyor…';
        clearTimeout(botTimer);
        // Short delay lets the "thinking" status paint before the search blocks the thread
        botTimer = setTimeout(makeCasualFishMove, 450);
    }
}

function clearSelectionMarks() {
    document.querySelectorAll('.square').forEach(sq => {
        sq.classList.remove('selected', 'highlight', 'capture');
    });
}

/**
 * Handle interaction logic when a player clicks a square
 */
function handleSquareClick(squareId) {
    setFocusedSquare(squareId, false);
    if (inputLocked()) return;

    const pieceOnSquare = gameEngine.get(squareId);

    if (!selectedSquare) {
        if (pieceOnSquare && pieceOnSquare.color === gameEngine.turn()) {
            selectedSquare = squareId;
            highlightValidMoves(squareId);
        }
        return;
    }

    if (selectedSquare === squareId) {
        selectedSquare = null;
        clearSelectionMarks();
        return;
    }

    const success = tryMove(selectedSquare, squareId, true); // true = animate

    if (!success) {
        clearSelectionMarks();
        if (pieceOnSquare && pieceOnSquare.color === gameEngine.turn()) {
            selectedSquare = squareId;
            highlightValidMoves(squareId);
        } else {
            selectedSquare = null;
        }
    }
}

/**
 * Keyboard play: arrows move focus, Enter/Space acts like a click
 */
function handleSquareKey(e, squareId) {
    const fileIdx = FILES.indexOf(squareId[0]);
    const rank = Number(squareId[1]);
    const steps = {
        ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0]
    };

    if (steps[e.key]) {
        e.preventDefault();
        const [df, dr] = steps[e.key];
        const nf = Math.min(7, Math.max(0, fileIdx + df));
        const nr = Math.min(8, Math.max(1, rank + dr));
        focusSquareElement(FILES[nf] + nr);
    } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSquareClick(squareId);
    } else if (e.key === 'Escape' && selectedSquare) {
        selectedSquare = null;
        clearSelectionMarks();
    }
}

function setFocusedSquare(squareId, moveFocus) {
    const prev = document.getElementById(focusedSquare);
    if (prev) prev.tabIndex = -1;
    focusedSquare = squareId;
    const next = document.getElementById(squareId);
    if (next) {
        next.tabIndex = 0;
        if (moveFocus) next.focus();
    }
}

function focusSquareElement(squareId) {
    setFocusedSquare(squareId, true);
}

/**
 * =========================================================
 * CASUALFISH AI (MiniMax with Alpha-Beta Pruning)
 * =========================================================
 */
function makeCasualFishMove() {
    botTimer = null;
    if (gameEngine.game_over() || !gameActive || !isVersusBot || gameEngine.turn() !== 'b') return;

    let bestMove = null;
    let possibleMoves = gameEngine.moves({ verbose: true });

    if (isImmortalEnabled()) {
        possibleMoves = possibleMoves.filter(move => {
            gameEngine.move(move);
            const isMate = matesWhite();
            gameEngine.undo();
            return !isMate;
        });
    }

    if (possibleMoves.length === 0) {
        showGameOver('BERABERE', 'Ölümsüzlük mat hamlesini engelledi.');
        return;
    }

    if (botDifficulty === 1) {
        bestMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    } else {
        const depth = botDifficulty === 2 ? 2 : 3;
        bestMove = minimaxRoot(depth, gameEngine, true);
    }

    if (bestMove && isImmortalEnabled()) {
        const bestSan = typeof bestMove === 'string' ? bestMove : bestMove.san;
        if (!possibleMoves.some(move => move.san === bestSan)) bestMove = possibleMoves[0];
    }

    if (bestMove) {
        const moveObj = typeof bestMove === 'string' ? { san: bestMove } : bestMove;
        const moveResult = gameEngine.move(moveObj);

        if (moveResult) {
            if (typeof playPopSound === 'function') playPopSound();
            clearSelectionMarks();
            lastMove = { from: moveResult.from, to: moveResult.to };

            animateMoveAndRender(moveResult.from, moveResult.to, () => {
                updateStatus();
                checkGameOver();
            });
        }
    }
}

const pieceValues = {
    'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000
};

function evaluateBoard(engine) {
    let totalEvaluation = 0;
    const board = engine.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const square = board[r][c];
            if (square) {
                // Bots strategy (Black Maximizing)
                const val = pieceValues[square.type.toLowerCase()];
                totalEvaluation += square.color === 'b' ? val : -val;
            }
        }
    }
    return totalEvaluation;
}

/**
 * Captures (most valuable victim first) and promotions are searched first so
 * alpha-beta can prune more; this keeps "Zor" from freezing the page for seconds.
 */
function moveOrderScore(move) {
    let score = 0;
    if (move.captured) score += pieceValues[move.captured] * 10 - pieceValues[move.piece];
    if (move.promotion) score += pieceValues[move.promotion];
    return score;
}

function orderMoves(moves) {
    return moves.sort((a, b) => moveOrderScore(b) - moveOrderScore(a));
}

function minimaxRoot(depth, engine, isMaximizingPlayer) {
    const newGameMoves = engine.moves({ verbose: true });

    // Randomize the order of moves being evaluated to prevent identical games
    // when multiple moves have the exact same evaluation score.
    newGameMoves.sort(() => Math.random() - 0.5);
    orderMoves(newGameMoves);

    let bestMove = -Infinity;
    let bestMoveFound = newGameMoves[0];

    for (let i = 0; i < newGameMoves.length; i++) {
        const newGameMove = newGameMoves[i];
        engine.move(newGameMove);
        const value = minimax(depth - 1, engine, -Infinity, Infinity, !isMaximizingPlayer);
        engine.undo();
        if (value > bestMove) { // Use strictly greater than to preserve randomized first-best
            bestMove = value;
            bestMoveFound = newGameMove;
        }
    }
    return bestMoveFound;
}

function minimax(depth, engine, alpha, beta, isMaximizingPlayer) {
    if (depth === 0) {
        return evaluateBoard(engine);
    }

    // One move generation answers mate/stalemate too; the full in_draw() check
    // replays the whole game history and was the main cost of the search.
    const newGameMoves = engine.moves({ verbose: true });
    if (newGameMoves.length === 0) {
        if (!engine.in_check()) return 0;
        return engine.turn() === 'w' ? 100000 + depth : -100000 - depth;
    }
    if (engine.insufficient_material()) {
        return 0;
    }
    orderMoves(newGameMoves);

    if (isMaximizingPlayer) {
        let bestMove = -Infinity;
        for (let i = 0; i < newGameMoves.length; i++) {
            engine.move(newGameMoves[i]);
            bestMove = Math.max(bestMove, minimax(depth - 1, engine, alpha, beta, !isMaximizingPlayer));
            engine.undo();
            alpha = Math.max(alpha, bestMove);
            if (beta <= alpha) return bestMove;
        }
        return bestMove;
    } else {
        let bestMove = Infinity;
        for (let i = 0; i < newGameMoves.length; i++) {
            engine.move(newGameMoves[i]);
            bestMove = Math.min(bestMove, minimax(depth - 1, engine, alpha, beta, !isMaximizingPlayer));
            engine.undo();
            beta = Math.min(beta, bestMove);
            if (beta <= alpha) return bestMove;
        }
        return bestMove;
    }
}

/**
 * Illuminates legal moves for a specific piece
 */
function highlightValidMoves(squareId) {
    document.getElementById(squareId).classList.add('selected');
    const moves = gameEngine.moves({ square: squareId, verbose: true });
    moves.forEach(move => {
        const target = document.getElementById(move.to);
        target.classList.add('highlight');
        if (move.captured) target.classList.add('capture');
    });
}

/**
 * Update UI Status Turn Indicator
 */
function updateStatus() {
    const isWhiteTurn = gameEngine.turn() === 'w';

    statusDisplay.className = `status-display ${isWhiteTurn ? 'turn-white' : 'turn-black'}`;
    if (isVersusBot) {
        statusDisplay.textContent = isWhiteTurn ? 'Sıra sende (Beyaz)' : 'Sıra: CasualFish (Siyah)';
    } else {
        statusDisplay.textContent = isWhiteTurn ? 'Sıra: Beyaz' : 'Sıra: Siyah';
    }

    if (gameEngine.in_check() && !gameEngine.game_over()) {
        statusDisplay.classList.add('in-check');
        statusDisplay.textContent = `Şah! ${statusDisplay.textContent}`;
    }
}

/**
 * Verify Endgame conditions via engine
 */
function checkGameOver() {
    if (gameEngine.game_over()) {
        if (gameEngine.in_checkmate()) {
            const winner = gameEngine.turn() === 'w' ? 'Siyah' : 'Beyaz';
            const detail = isVersusBot
                ? (winner === 'Beyaz' ? 'Tebrikler, CasualFish\'i yendin!' : 'CasualFish bu sefer kazandı.')
                : `${winner} kazandı.`;
            showGameOver('ŞAH MAT', detail);
        } else if (gameEngine.in_stalemate()) {
            showGameOver('PAT', 'Hamle yapacak taş kalmadı; oyun berabere.');
        } else if (gameEngine.in_threefold_repetition()) {
            showGameOver('BERABERE', 'Aynı pozisyon üç kez tekrarlandı.');
        } else if (gameEngine.insufficient_material()) {
            showGameOver('BERABERE', 'Mat için yeterli taş kalmadı.');
        } else if (gameEngine.in_draw()) {
            showGameOver('BERABERE', '50 hamle kuralı.');
        } else {
            showGameOver('OYUN BİTTİ', '');
        }

        // Record stats
        if (typeof recordGameResult === 'function') {
            const playerWon = gameEngine.in_checkmate() && gameEngine.turn() === 'b';
            recordGameResult('Chess', { won: playerWon, score: 0 });
        }
    }
}

function showGameOver(title, detail) {
    gameActive = false;
    clearTimeout(botTimer);
    botTimer = null;
    resetResignConfirm();
    resignBtn.disabled = true;
    gameOverText.textContent = title;
    gameOverDetail.textContent = detail;
    statusDisplay.className = 'status-display game-over';
    statusDisplay.textContent = detail ? `${title} · ${detail}` : title;
    overlay.classList.remove('hidden');
    if (typeof playPopSound === 'function') playPopSound();
    rematchBtn.focus();
}

/**
 * Start a fresh game with the current lobby settings
 */
function startGame() {
    clearTimeout(botTimer);
    botTimer = null;
    closePromotionPicker();
    resetResignConfirm();
    botDifficulty = parseInt(diffSlider.value, 10);

    lobbyMenu.classList.add('hidden');
    gameArea.classList.remove('hidden');
    overlay.classList.add('hidden');
    gameActive = true;
    resignBtn.disabled = isImmortalEnabled();
    resignBtn.title = resignBtn.disabled ? 'Ölümsüzlük açıkken çekilemezsin' : '';

    // Fresh game
    gameEngine.reset();
    selectedSquare = null;
    lastMove = null;
    renderPieces();
    updateStatus();
}

/**
 * Handle Reset Game
 */
function resetGame() {
    clearTimeout(botTimer);
    botTimer = null;
    closePromotionPicker();
    resetResignConfirm();
    gameEngine.reset();
    selectedSquare = null;
    lastMove = null;
    overlay.classList.add('hidden');
    lobbyMenu.classList.remove('hidden');
    gameArea.classList.add('hidden');
    gameActive = false;
    updateStatus();
    renderPieces();
    startGameBtn.focus();
}

/**
 * Handle resign (asks for a second press to avoid accidental taps)
 */
function resignGame() {
    if (isImmortalEnabled()) return;
    if (!gameActive || gameEngine.game_over()) return;

    if (!resignBtn.classList.contains('confirm')) {
        resignBtn.classList.add('confirm');
        resignBtn.textContent = 'Emin misin? Çekilmek için tekrar bas';
        resignConfirmTimer = setTimeout(resetResignConfirm, 4000);
        return;
    }

    // Against the bot the human (White) always resigns; locally the side to move resigns
    const loser = isVersusBot ? 'Beyaz' : (gameEngine.turn() === 'w' ? 'Beyaz' : 'Siyah');
    const winner = loser === 'Beyaz' ? 'Siyah' : 'Beyaz';
    showGameOver('ÇEKİLDİ', isVersusBot ? 'CasualFish kazandı.' : `${loser} çekildi, ${winner} kazandı.`);

    if (typeof recordGameResult === 'function') {
        recordGameResult('Chess', { won: false, score: 0 });
    }
}

function resetResignConfirm() {
    clearTimeout(resignConfirmTimer);
    resignConfirmTimer = null;
    resignBtn.classList.remove('confirm');
    resignBtn.textContent = 'Oyundan Çekil';
}

// Event Listeners
resetBtn.addEventListener('click', () => {
    if (typeof playPopSound === 'function') playPopSound();
    resetGame();
});

rematchBtn.addEventListener('click', () => {
    if (typeof playClickSound === 'function') playClickSound();
    startGame();
});

resignBtn.addEventListener('click', () => {
    if (typeof playClickSound === 'function') playClickSound();
    resignGame();
});

promotionOverlay.querySelectorAll('.promotion-btn').forEach(btn => {
    btn.addEventListener('click', () => choosePromotion(btn.dataset.piece));
});
promotionCancel.addEventListener('click', cancelPromotion);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pendingPromotion) cancelPromotion();
});

// Lobby Selection Listeners
document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.preset-btn').forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        isVersusBot = btn.getAttribute('data-opponent') === 'ai';
        diffWrapper.style.display = isVersusBot ? 'flex' : 'none';
    });
});

diffSlider.addEventListener('input', () => {
    diffSlider.setAttribute('aria-valuetext', DIFFICULTY_NAMES[diffSlider.value]);
});

startGameBtn.addEventListener('click', () => {
    if (typeof playClickSound === 'function') playClickSound();
    startGame();
});

// Initialization state
createBoard();
renderPieces();
