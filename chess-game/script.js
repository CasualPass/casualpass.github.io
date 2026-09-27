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
const resetBtn = document.getElementById('reset-btn');
const resignBtn = document.getElementById('resign-btn');
const lobbyMenu = document.getElementById('lobby-menu');
const startGameBtn = document.getElementById('start-game-btn');
const diffWrapper = document.getElementById('difficulty-wrapper');

// State Variables
let selectedSquare = null;      // "e2" etc.
let isVersusBot = true;
let botDifficulty = 2; // 1: Kolay, 2: Orta, 3: Zor
let gameActive = false;

// Object mapping to unicode chess pieces for beautiful rendering without images
const piecesMap = {
    'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚',
    'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔'
};

/**
 * Initialize the 8x8 Board Structure
 */
function createBoard() {
    boardElement.innerHTML = '';

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const squareDiv = document.createElement('div');

            const rank = 8 - row;
            const file = files[col];
            const squareId = file + rank;

            squareDiv.id = squareId;
            squareDiv.className = 'square';

            if ((row + col) % 2 === 0) {
                squareDiv.classList.add('light');
            } else {
                squareDiv.classList.add('dark');
            }

            squareDiv.addEventListener('click', () => handleSquareClick(squareId));

            boardElement.appendChild(squareDiv);
        }
    }
}

/**
 * Renders the pieces onto the board based on chess.js internal state
 */
function renderPieces() {
    const boardState = gameEngine.board();
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    document.querySelectorAll('.square').forEach(sq => {
        sq.innerHTML = '';
        sq.classList.remove('selected', 'highlight', 'in-check');
    });

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece) {
                const squareId = files[col] + (8 - row);
                const squareEl = document.getElementById(squareId);

                const pieceEl = document.createElement('div');
                pieceEl.className = `chess-piece ${piece.color === 'w' ? 'white' : 'black'}`;
                const charType = piece.color === 'w' ? piece.type.toUpperCase() : piece.type;
                pieceEl.textContent = piecesMap[charType];

                // Bind Drag & Drop event seamlessly!
                setupDragEvents(pieceEl, squareId);

                squareEl.appendChild(pieceEl);
            }
        }
    }

    if (gameEngine.in_check()) {
        const turnColor = gameEngine.turn();
        const checkBoard = gameEngine.board();
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = checkBoard[r][c];
                if (p && p.type === 'k' && p.color === turnColor) {
                    const kingSquareId = files[c] + (8 - r);
                    document.getElementById(kingSquareId).classList.add('in-check');
                }
            }
        }
    }
}

/**
 * =========================================================
 * DRAG AND DROP MECHANICS & ANIMATION
 * =========================================================
 */
let activePiece = null;
let startSquare = null;
let wasSelected = false;

function setupDragEvents(pieceEl, squareId) {
    pieceEl.addEventListener('mousedown', (e) => startDrag(e, pieceEl, squareId));
    pieceEl.addEventListener('touchstart', (e) => startDrag(e, pieceEl, squareId), { passive: false });
}

function startDrag(e, pieceEl, squareId) {
    if (gameEngine.game_over() || !gameActive) return;

    const pieceObj = gameEngine.get(squareId);
    if (!pieceObj || pieceObj.color !== gameEngine.turn()) {
        return; // Let the normal square click handler manage enemy pieces
    }

    // Prevent default touch actions and NATIVE image drag ghosting
    e.preventDefault();
    if (typeof playClickSound === 'function') playClickSound();

    wasSelected = (selectedSquare === squareId);

    activePiece = pieceEl;
    startSquare = squareId;

    selectedSquare = squareId;
    renderPiecesWithoutRebuilding();
    highlightValidMoves(squareId);

    document.body.appendChild(activePiece);
    activePiece.classList.add('dragging');
    activePiece.classList.remove('snap-back');

    movePieceWithCursor(e);

    document.addEventListener('mousemove', dragMove);
    document.addEventListener('touchmove', dragMove, { passive: false });
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);
}

function dragMove(e) {
    if (!activePiece) return;
    if (e.type === 'touchmove') e.preventDefault();
    movePieceWithCursor(e);
}

function movePieceWithCursor(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    activePiece.style.left = `${clientX - activePiece.offsetWidth / 2}px`;
    activePiece.style.top = `${clientY - activePiece.offsetHeight / 2}px`;
}

function endDrag(e) {
    if (!activePiece) return;

    activePiece.classList.remove('dragging');

    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

    // Use elementsFromPoint to penetrate the dragging piece if it's over the square
    const elements = document.elementsFromPoint(clientX, clientY);
    let targetSquare = null;
    for (let el of elements) {
        if (el.classList.contains('square')) {
            targetSquare = el;
            break;
        }
    }

    document.removeEventListener('mousemove', dragMove);
    document.removeEventListener('touchmove', dragMove);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchend', endDrag);

    const sq = document.getElementById(startSquare);
    if (sq) sq.appendChild(activePiece);

    activePiece.style.left = '';
    activePiece.style.top = '';

    if (targetSquare && targetSquare.id) {
        if (targetSquare.id === startSquare) {
            // Dropped where it started (interpreted as a click)
            activePiece.classList.add('snap-back');
            activePiece.style.left = '';
            activePiece.style.top = '';

            if (wasSelected) {
                // If it was already selected before the click, deselect it
                selectedSquare = null;
                renderPiecesWithoutRebuilding();
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
    renderPiecesWithoutRebuilding();
}

/**
 * Handle move attempt logic & bot trigger. 
 * 'animate' boolean tells us whether to smoothly transition the move (for click/bot)
 */
function tryMove(from, to, animate = true) {
    const moveAttempt = gameEngine.move({ from, to, promotion: 'q' });
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
            else {
                gameActive = false;
                overlay.classList.remove('hidden');
                gameOverText.textContent = 'BERABERE · Ölümsüzlük mat hamlelerini engelledi';
            }
            return false;
        }
        if (typeof playClickSound === 'function') playClickSound();
        selectedSquare = null;
        renderPiecesWithoutRebuilding(); // Clear selections

        if (animate) {
            animateMoveAndRender(from, to, () => {
                updateStatus();
                checkGameOver();
                triggerBotMove();
            });
        } else {
            updateStatus();
            renderPieces(); // Just render instantly for drag drops
            checkGameOver();
            triggerBotMove();
        }
        return true;
    }
    return false;
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

    boardElement.style.pointerEvents = 'none';
    piece.style.transition = 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)';
    piece.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    piece.style.zIndex = '100';

    setTimeout(() => {
        boardElement.style.pointerEvents = 'auto';
        renderPieces();
        if (onComplete) onComplete();
    }, 250);
}

function triggerBotMove() {
    if (isVersusBot && gameEngine.turn() === 'b' && gameActive && !gameEngine.game_over()) {
        setTimeout(makeCasualFishMove, 600);
    }
}

function renderPiecesWithoutRebuilding() {
    document.querySelectorAll('.square').forEach(sq => {
        sq.classList.remove('selected', 'highlight');
    });
}

/**
 * Handle interaction logic when a player clicks a square
 */
function handleSquareClick(squareId) {
    if (gameEngine.game_over() || !gameActive || (isVersusBot && gameEngine.turn() !== 'w')) return;

    const pieceOnSquare = gameEngine.get(squareId);

    if (!selectedSquare) {
        if (pieceOnSquare && pieceOnSquare.color === gameEngine.turn()) {
            selectedSquare = squareId;
            highlightValidMoves(squareId);
        }
        return;
    }

    if (selectedSquare) {
        if (selectedSquare === squareId) {
            selectedSquare = null;
            renderPieces();
            return;
        }

        const success = tryMove(selectedSquare, squareId, true); // true = animate

        if (!success) {
            if (pieceOnSquare && pieceOnSquare.color === gameEngine.turn()) {
                selectedSquare = squareId;
                renderPieces();
                highlightValidMoves(squareId);
            }
        }
    }
}

/**
 * =========================================================
 * CASUALFISH AI (MiniMax with Alpha-Beta Pruning)
 * =========================================================
 */
function makeCasualFishMove() {
    if (gameEngine.game_over() || !gameActive) return;

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
        gameActive = false;
        overlay.classList.remove('hidden');
        gameOverText.textContent = 'BERABERE · Ölümsüzlük mat hamlesini engelledi';
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
            renderPiecesWithoutRebuilding();

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

function minimaxRoot(depth, engine, isMaximizingPlayer) {
    const newGameMoves = engine.moves({ verbose: true });

    // Randomize the order of moves being evaluated to prevent identical games
    // when multiple moves have the exact same evaluation score.
    newGameMoves.sort(() => Math.random() - 0.5);

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
    if (engine.in_checkmate()) {
        return engine.turn() === 'w' ? 100000 + depth : -100000 - depth;
    }
    if (engine.in_draw() || engine.in_stalemate()) {
        return 0;
    }
    if (depth === 0) {
        return evaluateBoard(engine);
    }

    const newGameMoves = engine.moves();

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
        document.getElementById(move.to).classList.add('highlight');
    });
}

/**
 * Update UI Status Turn Indicator
 */
function updateStatus() {
    const isWhiteTurn = gameEngine.turn() === 'w';

    statusDisplay.className = 'status-display';
    if (isWhiteTurn) {
        statusDisplay.textContent = 'Sıra: Beyaz';
        statusDisplay.classList.add('turn-white');
    } else {
        statusDisplay.textContent = 'Sıra: Siyah';
        statusDisplay.classList.add('turn-black');
    }

    if (gameEngine.in_check() && !gameEngine.game_over()) {
        statusDisplay.textContent += ' - ŞAH';
    }
}

/**
 * Verify Endgame conditions via engine
 */
function checkGameOver() {
    if (gameEngine.game_over()) {
        overlay.classList.remove('hidden');
        if (typeof playPopSound === 'function') playPopSound();

        if (gameEngine.in_checkmate()) {
            const winner = gameEngine.turn() === 'w' ? 'Siyah' : 'Beyaz';
            gameOverText.textContent = `ŞAH MAT! ${winner} Kazandı.`;
        } else if (gameEngine.in_draw()) {
            gameOverText.textContent = 'BERABERE';
        } else if (gameEngine.in_stalemate()) {
            gameOverText.textContent = 'PAT';
        } else {
            gameOverText.textContent = 'OYUN BİTTİ';
        }

        // Record stats
        if (typeof recordGameResult === 'function') {
            const playerWon = gameEngine.in_checkmate() && gameEngine.turn() === 'b';
            recordGameResult('Chess', { won: playerWon, score: 0 });
        }
    }
}

/**
 * Handle Reset Game
 */
function resetGame() {
    gameEngine.reset();
    selectedSquare = null;
    overlay.classList.add('hidden');
    lobbyMenu.classList.remove('hidden');
    boardElement.parentElement.classList.add('hidden');
    gameActive = false;
    updateStatus();
    renderPieces();
}

/**
 * Handle resign
 */
function resignGame() {
    if (window.CasualCheats && CasualCheats.immortal()) return;
    if (!gameActive || gameEngine.game_over()) return;
    overlay.classList.remove('hidden');
    gameActive = false;
    const winner = gameEngine.turn() === 'w' ? 'Siyah' : 'Beyaz';
    gameOverText.textContent = `ÇEKİLDİ! ${winner} Kazandı.`;

    if (typeof recordGameResult === 'function') {
        recordGameResult('Chess', { won: false, score: 0 });
    }
}

// Event Listeners
resetBtn.addEventListener('click', () => {
    if (typeof playPopSound === 'function') playPopSound();
    resetGame();
});

resignBtn.addEventListener('click', () => {
    if (typeof playClickSound === 'function') playClickSound();
    resignGame();
});

// Lobby Selection Listeners
document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        isVersusBot = e.target.getAttribute('data-opponent') === 'ai';
        diffWrapper.style.display = isVersusBot ? 'flex' : 'none';
    });
});

startGameBtn.addEventListener('click', () => {
    if (typeof playClickSound === 'function') playClickSound();
    botDifficulty = parseInt(document.getElementById('bot-difficulty').value);

    lobbyMenu.classList.add('hidden');
    boardElement.parentElement.classList.remove('hidden');
    gameActive = true;

    // Fresh game
    gameEngine.reset();
    selectedSquare = null;
    renderPieces();
    updateStatus();
});

// Initialization state
boardElement.parentElement.classList.add('hidden');
createBoard();
