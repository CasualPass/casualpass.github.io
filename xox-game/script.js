document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const cells = document.querySelectorAll('.cell');
    const statusDisplay = document.getElementById('status');
    const resetBtn = document.getElementById('reset-btn');
    const backToLobbyBtn = document.getElementById('back-to-lobby-btn');
    const scoreXElem = document.getElementById('score-x');
    const scoreOElem = document.getElementById('score-o');
    const labelX = document.getElementById('label-x');
    const labelO = document.getElementById('label-o');
    const cardX = document.querySelector('.x-score');
    const cardO = document.querySelector('.o-score');

    // Lobby Elements
    const configMenu = document.getElementById('config-menu');
    const gameArea = document.getElementById('game-area');
    const startGameBtn = document.getElementById('start-game-btn');

    // Player name (prefilled from the cookie profile when a session is open)
    const playerNameInput = document.getElementById('player-name-input');
    const profileHint = document.getElementById('profile-hint');
    const boardElem = document.getElementById('board');
    const resetBtnText = resetBtn.querySelector('.btn-text');

    // Settings Elements
    const modeBotBtn = document.getElementById('mode-bot');
    const modeLocalBtn = document.getElementById('mode-local');
    const localPlayer2Row = document.getElementById('local-player2-row');
    const botDifficultyRow = document.getElementById('bot-difficulty-row');
    const diffBtns = document.querySelectorAll('[data-difficulty]');
    const player2NameInput = document.getElementById('player2-name-input');

    // Leaderboard
    const showLeaderboardBtn = document.getElementById('show-leaderboard-btn');
    const leaderboardModal = document.getElementById('leaderboard-modal');
    const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
    const leaderboardContent = document.getElementById('leaderboard-content');

    // State Variables
    let mode = "bot"; // "bot" or "local"
    let botDifficulty = "easy"; // "easy", "medium", "impossible"
    let player1Name = "Oyuncu 1";
    let player2Name = "Bot";
    const difficultyLabels = { easy: 'Kolay', medium: 'Orta', impossible: 'İmkansız' };

    let board = ['', '', '', '', '', '', '', '', ''];
    let currentPlayer = 'X';
    let gameActive = false;
    let scoreX = 0;
    let scoreO = 0;

    const winningConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    const winningMessage = () => `${currentPlayer === 'X' ? player1Name : player2Name} Kazandı!`;
    const drawMessage = () => `Berabere!`;
    const currentPlayerTurn = () => `Sıra: ${currentPlayer === 'X' ? player1Name : player2Name}`;

    function handleCellClick(clickedCellEvent) {
        const clickedCell = clickedCellEvent.currentTarget;
        const clickedCellIndex = parseInt(clickedCell.getAttribute('data-index'));

        if (board[clickedCellIndex] !== '' || !gameActive) {
            return;
        }

        // Prevent human clicking when it's bot's turn
        if (mode === "bot" && currentPlayer === 'O') {
            return;
        }

        if (isImmortalEnabled() && (mode === 'local' || currentPlayer === 'O') && wouldWin(clickedCellIndex, currentPlayer)) {
            if (getAvailableCells(board).every((index) => wouldWin(index, currentPlayer))) {
                finishRound('draw', 'Berabere! Kazandıran kutular engellendi.');
            } else {
                statusDisplay.textContent = 'Ölümsüzlük: kazandıran kutu engellendi. Başka kutu seç.';
            }
            return;
        }

        handleCellPlayed(clickedCell, clickedCellIndex);
        handleResultValidation();
    }

    function handleCellPlayed(clickedCell, clickedCellIndex) {
        board[clickedCellIndex] = currentPlayer;
        clickedCell.classList.add('occupied');
        clickedCell.classList.add(currentPlayer.toLowerCase());
        updateCellLabel(clickedCellIndex);

        if (typeof playClickSound === 'function') playClickSound();
    }

    function handleResultValidation() {
        let roundWon = false;
        let winningCells = [];

        for (let i = 0; i < winningConditions.length; i++) {
            const winCondition = winningConditions[i];
            const a = board[winCondition[0]];
            const b = board[winCondition[1]];
            const c = board[winCondition[2]];

            if (a === '' || b === '' || c === '') {
                continue;
            }

            if (a === b && b === c) {
                roundWon = true;
                winningCells = winCondition;
                break;
            }
        }

        if (roundWon) {
            finishRound(currentPlayer === 'X' ? 'win-x' : 'win-o', winningMessage());

            winningCells.forEach(index => {
                cells[index].classList.add('winning-cell');
            });

            if (typeof playPopSound === 'function') playPopSound();

            let winnerName = "";
            if (currentPlayer === 'X') {
                scoreX++;
                scoreXElem.textContent = scoreX;
                winnerName = player1Name;
            } else {
                scoreO++;
                scoreOElem.textContent = scoreO;
                winnerName = player2Name;
            }

            // Bot wins are never ranked; only human names reach the leaderboard.
            if (mode === 'local' || currentPlayer === 'X') saveToLeaderboard(winnerName);

            // Record stats
            if (typeof recordGameResult === 'function') {
                const isPlayer1Win = currentPlayer === 'X';
                recordGameResult('XOX', { won: isPlayer1Win, score: 0 });
            }
            return;
        }

        const roundDraw = !board.includes('');
        if (roundDraw) {
            finishRound('draw', drawMessage());

            // Record draw as played
            if (typeof recordGameResult === 'function') {
                recordGameResult('XOX', { won: false, score: 0 });
            }
            return;
        }

        handlePlayerChange();
    }

    function handlePlayerChange() {
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        statusDisplay.textContent = currentPlayerTurn();
        updateActiveCard();
        setStatusTone('');
        updateBoardLock();

        // Trigger Bot Move
        if (gameActive && mode === "bot" && currentPlayer === 'O') {
            setTimeout(makeBotMove, 500);
        }
    }

    /** Ends the round: shows the result, locks the board and offers a new round. */
    function finishRound(tone, message) {
        gameActive = false;
        statusDisplay.textContent = message;
        setStatusTone(tone);
        updateBoardLock();
        resetBtnText.textContent = 'Tekrar Oyna';
        resetBtn.classList.add('primary');
    }

    function setStatusTone(tone) {
        statusDisplay.classList.remove('win-x', 'win-o', 'draw');
        if (tone) statusDisplay.classList.add(tone);
    }

    // The board is locked after the round ends and while the bot is thinking.
    function updateBoardLock() {
        const botTurn = mode === 'bot' && currentPlayer === 'O';
        boardElem.classList.toggle('locked', !gameActive || botTurn);
        boardElem.setAttribute('aria-busy', String(gameActive && botTurn));
    }

    function updateCellLabel(index) {
        const row = Math.floor(index / 3) + 1;
        const col = (index % 3) + 1;
        const value = board[index] || 'boş';
        cells[index].setAttribute('aria-label', `Satır ${row}, sütun ${col}: ${value}`);
    }

    function updateActiveCard() {
        if (currentPlayer === 'X') {
            cardX.classList.add('active');
            cardO.classList.remove('active');
        } else {
            cardO.classList.add('active');
            cardX.classList.remove('active');
        }
    }

    function handleRestartGame() {
        // Only restart if game actually started
        gameActive = true;
        currentPlayer = 'X';
        board = ['', '', '', '', '', '', '', '', ''];

        statusDisplay.textContent = currentPlayerTurn();
        setStatusTone('');
        resetBtnText.textContent = 'Yeniden Başlat';
        resetBtn.classList.remove('primary');

        updateActiveCard();

        cells.forEach((cell, index) => {
            cell.className = 'cell'; // reset classes
            updateCellLabel(index);
        });
        updateBoardLock();

        if (typeof playClickSound === 'function') playClickSound();
    }

    /* --- LOBBY LOGIC --- */
    function prefillPlayerName() {
        const profile = window.CasualProfile?.current?.();
        if (profile?.displayName && !playerNameInput.value.trim()) {
            playerNameInput.value = profile.displayName;
            profileHint.classList.remove('hidden');
        }
    }

    function setPressed(activeBtn, group) {
        group.forEach(b => {
            const on = b === activeBtn;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', String(on));
        });
    }

    modeBotBtn.addEventListener('click', () => {
        mode = "bot";
        setPressed(modeBotBtn, [modeBotBtn, modeLocalBtn]);
        botDifficultyRow.classList.remove('hidden');
        localPlayer2Row.classList.add('hidden');
    });

    modeLocalBtn.addEventListener('click', () => {
        mode = "local";
        setPressed(modeLocalBtn, [modeBotBtn, modeLocalBtn]);
        botDifficultyRow.classList.add('hidden');
        localPlayer2Row.classList.remove('hidden');
    });

    diffBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setPressed(btn, [...diffBtns]);
            botDifficulty = btn.getAttribute('data-difficulty');
        });
    });

    startGameBtn.addEventListener('click', () => {
        if (typeof playClickSound === 'function') playClickSound();

        // Setup Players
        player1Name = playerNameInput.value.trim() || "Misafir";

        if (mode === "bot") {
            player2Name = `Bot · ${difficultyLabels[botDifficulty]}`;
        } else {
            player2Name = player2NameInput.value.trim() || "Oyuncu 2";
        }

        labelX.textContent = player1Name;
        labelO.textContent = player2Name;
        labelX.title = player1Name;
        labelO.title = player2Name;

        // Reset scores
        scoreX = 0; scoreO = 0;
        scoreXElem.textContent = scoreX;
        scoreOElem.textContent = scoreO;

        configMenu.classList.add('hidden');
        gameArea.classList.remove('hidden');

        handleRestartGame();
    });

    backToLobbyBtn.addEventListener('click', () => {
        if (typeof playClickSound === 'function') playClickSound();
        gameActive = false;
        gameArea.classList.add('hidden');
        configMenu.classList.remove('hidden');
        startGameBtn.focus();
    });

    /* --- LEADERBOARD LOGIC --- */
    function getLeaderboard() {
        try {
            const leaderboard = JSON.parse(getCookieValue('cp_xox_leaderboard') || '{}');
            return leaderboard && typeof leaderboard === 'object' && !Array.isArray(leaderboard) ? leaderboard : {};
        } catch {
            return {};
        }
    }

    function saveToLeaderboard(winnerName) {
        if (window.CasualCheats?.active()) return;

        const lb = getLeaderboard();
        if (!lb[winnerName]) lb[winnerName] = 0;
        lb[winnerName] += 1;

        setCookieValue('cp_xox_leaderboard', JSON.stringify(lb));
    }

    function renderLeaderboard() {
        const lb = getLeaderboard();
        leaderboardContent.innerHTML = '';

        const sorted = Object.entries(lb).sort((a, b) => b[1] - a[1]);

        if (sorted.length === 0) {
            leaderboardContent.innerHTML = '<p class="lb-empty">Henüz hiç galibiyet yok. İlk galibiyeti sen al!</p>';
            return;
        }

        sorted.forEach(([name, wins], index) => {
            const row = document.createElement('div');
            row.className = 'lb-row';
            const player = document.createElement('span');
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
            player.textContent = `${medal} ${name}`;
            const total = document.createElement('span');
            total.className = 'lb-wins';
            total.textContent = `${wins} galibiyet`;
            row.append(player, total);
            leaderboardContent.appendChild(row);
        });
    }

    function closeLeaderboard() {
        if (leaderboardModal.classList.contains('hidden')) return;
        leaderboardModal.classList.add('hidden');
        showLeaderboardBtn.focus();
    }

    showLeaderboardBtn.addEventListener('click', () => {
        renderLeaderboard();
        leaderboardModal.classList.remove('hidden');
        closeLeaderboardBtn.focus();
    });

    closeLeaderboardBtn.addEventListener('click', closeLeaderboard);
    leaderboardModal.addEventListener('click', (event) => {
        if (event.target === leaderboardModal) closeLeaderboard();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeLeaderboard();
    });

    /* --- AI BOT LOGIC --- */
    function getAvailableCells(currentBoard) {
        return currentBoard.map((c, i) => c === '' ? i : null).filter(val => val !== null);
    }

    function checkWinCondition(currentBoard, player) {
        let plays = currentBoard.reduce((a, e, i) => (e === player) ? a.concat(i) : a, []);
        let gameWon = null;
        for (let [index, win] of winningConditions.entries()) {
            if (win.every(elem => plays.indexOf(elem) > -1)) {
                gameWon = { index: index, player: player };
                break;
            }
        }
        return gameWon;
    }

    function isImmortalEnabled() {
        return Boolean(window.CasualCheats && CasualCheats.immortal());
    }

    function wouldWin(index, player) {
        const candidate = [...board];
        candidate[index] = player;
        return Boolean(checkWinCondition(candidate, player));
    }

    function makeBotMove() {
        if (!gameActive || currentPlayer !== 'O') return;

        let available = getAvailableCells(board);
        if (available.length === 0) return;

        if (isImmortalEnabled()) {
            available = available.filter(index => !wouldWin(index, 'O'));
            if (available.length === 0) {
                finishRound('draw', 'Berabere! Kazandıran kutular engellendi.');
                return;
            }
        }

        let moveIndex;

        if (botDifficulty === "easy") {
            // Random move
            moveIndex = available[Math.floor(Math.random() * available.length)];
        }
        else if (botDifficulty === "medium") {
            // Try to block/win, otherwise random
            moveIndex = findBestMoveMedium(available);
        }
        else if (botDifficulty === "impossible") {
            // Minimax algorithm
            moveIndex = minimax(board, "O").index;
            if (!available.includes(moveIndex)) moveIndex = available[Math.floor(Math.random() * available.length)];
        }

        const cellToClick = cells[moveIndex];
        handleCellPlayed(cellToClick, moveIndex);
        handleResultValidation();
    }

    // Medium: Block X or Win O, else random
    function findBestMoveMedium(available) {
        // Can O win?
        for (let i = 0; i < available.length; i++) {
            let tempBoard = [...board];
            tempBoard[available[i]] = "O";
            if (checkWinCondition(tempBoard, "O")) return available[i];
        }
        // Can X win? (Block)
        for (let i = 0; i < available.length; i++) {
            let tempBoard = [...board];
            tempBoard[available[i]] = "X";
            if (checkWinCondition(tempBoard, "X")) return available[i];
        }
        // Random fallback
        return available[Math.floor(Math.random() * available.length)];
    }

    // Impossible: Minimax
    function minimax(newBoard, player) {
        const availSpots = getAvailableCells(newBoard);

        if (checkWinCondition(newBoard, "X")) {
            return { score: -10 };
        } else if (checkWinCondition(newBoard, "O")) {
            return { score: 10 };
        } else if (availSpots.length === 0) {
            return { score: 0 };
        }

        const moves = [];
        for (let i = 0; i < availSpots.length; i++) {
            const move = {};
            move.index = availSpots[i];
            newBoard[availSpots[i]] = player;

            if (player === "O") {
                const result = minimax(newBoard, "X");
                move.score = result.score;
            } else {
                const result = minimax(newBoard, "O");
                move.score = result.score;
            }

            newBoard[availSpots[i]] = ''; // Reset spot
            moves.push(move);
        }

        let bestMove;
        if (player === "O") {
            let bestScore = -10000;
            for (let i = 0; i < moves.length; i++) {
                if (moves[i].score > bestScore) {
                    bestScore = moves[i].score;
                    bestMove = i;
                }
            }
        } else {
            let bestScore = 10000;
            for (let i = 0; i < moves.length; i++) {
                if (moves[i].score < bestScore) {
                    bestScore = moves[i].score;
                    bestMove = i;
                }
            }
        }

        return moves[bestMove];
    }

    // Bind Event Listeners
    cells.forEach(cell => cell.addEventListener('click', handleCellClick));
    prefillPlayerName();
    resetBtn.addEventListener('click', () => {
        if (typeof playClickSound === 'function') playClickSound();
        handleRestartGame();
    });
});
