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

    // Auth Elements
    const authSection = document.getElementById('auth-section');
    const playerInfo = document.getElementById('player-info');
    const playerNameInput = document.getElementById('player-name-input');
    const displayPlayerName = document.getElementById('display-player-name');
    const btnGuest = document.getElementById('btn-guest');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');

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
    let currentUser = "Misafir";
    let isGuest = true;
    let mode = "bot"; // "bot" or "local"
    let botDifficulty = "easy"; // "easy", "medium", "impossible"
    let player1Name = "Oyuncu 1";
    let player2Name = "Bot";

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
        const clickedCell = clickedCellEvent.target;
        const clickedCellIndex = parseInt(clickedCell.getAttribute('data-index'));

        if (board[clickedCellIndex] !== '' || !gameActive) {
            return;
        }

        // Prevent human clicking when it's bot's turn
        if (mode === "bot" && currentPlayer === 'O') {
            return;
        }

        handleCellPlayed(clickedCell, clickedCellIndex);
        handleResultValidation();
    }

    function handleCellPlayed(clickedCell, clickedCellIndex) {
        board[clickedCellIndex] = currentPlayer;
        clickedCell.classList.add('occupied');
        clickedCell.classList.add(currentPlayer.toLowerCase());

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
            statusDisplay.innerHTML = winningMessage();
            gameActive = false;

            winningCells.forEach(index => {
                cells[index].classList.add('winning-cell');
            });

            if (typeof playPopSound === 'function') playPopSound();

            let winnerName = "";
            if (currentPlayer === 'X') {
                scoreX++;
                scoreXElem.textContent = scoreX;
                statusDisplay.style.color = 'var(--color-x)';
                statusDisplay.style.textShadow = '0 0 10px rgba(0, 255, 204, 0.5)';
                winnerName = player1Name;
            } else {
                scoreO++;
                scoreOElem.textContent = scoreO;
                statusDisplay.style.color = 'var(--color-o)';
                statusDisplay.style.textShadow = '0 0 10px rgba(255, 0, 204, 0.5)';
                winnerName = player2Name;
            }

            saveToLeaderboard(winnerName);

            // Record stats
            if (typeof recordGameResult === 'function') {
                const isPlayer1Win = currentPlayer === 'X';
                recordGameResult('Tic Tac Toe', { won: isPlayer1Win, score: 0 });
            }
            return;
        }

        const roundDraw = !board.includes('');
        if (roundDraw) {
            statusDisplay.innerHTML = drawMessage();
            gameActive = false;
            statusDisplay.style.color = 'var(--text-primary)';
            statusDisplay.style.textShadow = 'none';

            // Record draw as played
            if (typeof recordGameResult === 'function') {
                recordGameResult('Tic Tac Toe', { won: false, score: 0 });
            }
            return;
        }

        handlePlayerChange();
    }

    function handlePlayerChange() {
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        statusDisplay.innerHTML = currentPlayerTurn();
        updateActiveCard();

        statusDisplay.style.color = 'var(--text-primary)';
        statusDisplay.style.textShadow = 'none';

        // Trigger Bot Move
        if (gameActive && mode === "bot" && currentPlayer === 'O') {
            setTimeout(makeBotMove, 500);
        }
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

        statusDisplay.innerHTML = currentPlayerTurn();
        statusDisplay.style.color = 'var(--text-primary)';
        statusDisplay.style.textShadow = 'none';

        updateActiveCard();

        cells.forEach(cell => {
            cell.className = 'cell'; // reset classes
        });

        if (typeof playClickSound === 'function') playClickSound();
    }

    /* --- LOBBY & AUTH LOGIC --- */
    function updateAuthUI() {
        if (!isGuest && currentUser) {
            authSection.classList.add('hidden');
            playerInfo.classList.remove('hidden');
            displayPlayerName.textContent = currentUser;
        } else {
            authSection.classList.remove('hidden');
            playerInfo.classList.add('hidden');
            playerNameInput.value = '';
        }
    }

    btnGuest.addEventListener('click', () => {
        isGuest = true;
        currentUser = playerNameInput.value.trim() || "Misafir";
        btnGuest.classList.add('active');
        btnLogin.classList.remove('active');
    });

    btnLogin.addEventListener('click', () => {
        const name = playerNameInput.value.trim();
        if (name.length < 3) {
            alert("Lütfen en az 3 karakterli bir kullanıcı adı girin.");
            return;
        }
        isGuest = false;
        currentUser = name;
        updateAuthUI();
    });

    btnLogout.addEventListener('click', () => {
        isGuest = true;
        currentUser = "Misafir";
        updateAuthUI();
        btnGuest.classList.add('active');
        btnLogin.classList.remove('active');
    });

    modeBotBtn.addEventListener('click', () => {
        mode = "bot";
        modeBotBtn.classList.add('active');
        modeLocalBtn.classList.remove('active');
        botDifficultyRow.classList.remove('hidden');
        localPlayer2Row.classList.add('hidden');
    });

    modeLocalBtn.addEventListener('click', () => {
        mode = "local";
        modeLocalBtn.classList.add('active');
        modeBotBtn.classList.remove('active');
        botDifficultyRow.classList.add('hidden');
        localPlayer2Row.classList.remove('hidden');
    });

    diffBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            diffBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            botDifficulty = btn.getAttribute('data-difficulty');
        });
    });

    startGameBtn.addEventListener('click', () => {
        if (typeof playClickSound === 'function') playClickSound();

        // Setup Players
        player1Name = (isGuest && !playerNameInput.value.trim()) ? "Misafir" : currentUser;

        if (mode === "bot") {
            player2Name = `Bot (${botDifficulty})`;
        } else {
            player2Name = player2NameInput.value.trim() || "Oyuncu 2";
        }

        labelX.textContent = player1Name;
        labelO.textContent = player2Name;

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
    });

    /* --- LEADERBOARD LOGIC --- */
    function getLeaderboard() {
        return JSON.parse(getCookieValue('cp_xox_leaderboard') || '{}');
    }

    function saveToLeaderboard(winnerName) {
        if (winnerName.includes("Bot")) return; // Don't save bot wins

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
            leaderboardContent.innerHTML = '<p style="text-align:center;">Henüz hiç galibiyet yok.</p>';
            return;
        }

        sorted.forEach(([name, wins], index) => {
            const row = document.createElement('div');
            row.className = 'lb-row';
            let medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
            row.innerHTML = `<span>${medal} ${name}</span> <span style="color:var(--cp-accent);font-weight:bold;">${wins} Kazanma</span>`;
            leaderboardContent.appendChild(row);
        });
    }

    showLeaderboardBtn.addEventListener('click', () => {
        renderLeaderboard();
        leaderboardModal.classList.remove('hidden');
    });

    closeLeaderboardBtn.addEventListener('click', () => {
        leaderboardModal.classList.add('hidden');
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

    function makeBotMove() {
        if (!gameActive || currentPlayer !== 'O') return;

        let available = getAvailableCells(board);
        if (available.length === 0) return;

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
    resetBtn.addEventListener('click', () => {
        if (typeof playClickSound === 'function') playClickSound();
        handleRestartGame();
    });
});
