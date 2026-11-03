// Client-Side Real-Time Word Chain Game Application
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // App State
  let currentRoomCode = null;
  let myPlayer = null;
  let currentRoomState = null;
  let isTyping = false;
  let typingTimeout = null;
  let previousBaseWord = '';

  // DOM Elements - Screens
  const screenHome = document.getElementById('screen-home');
  const screenLobby = document.getElementById('screen-lobby');
  const screenGame = document.getElementById('screen-game');
  const screenGameover = document.getElementById('screen-gameover');
  const screenUsedWords = document.getElementById('screen-used-words');
  const screenLogs = document.getElementById('screen-logs');
  const screenScores = document.getElementById('screen-scores');

  // DOM Elements - Universal Global Tabs (4 Tabs)
  const globalTabGame = document.getElementById('global-tab-game');
  const globalTabScores = document.getElementById('global-tab-scores');
  const globalTabLogs = document.getElementById('global-tab-logs');
  const globalTabBubbles = document.getElementById('global-tab-bubbles');
  const btnLobbyViewLogs = document.getElementById('btn-lobby-view-logs');
  const btnLobbyViewBubbles = document.getElementById('btn-lobby-view-bubbles');
  const btnBackFromGlobalScores = document.getElementById('btn-back-from-global-scores');
  const btnBackFromGlobalLogs = document.getElementById('btn-back-from-global-logs');
  const btnBackFromGlobalBubbles = document.getElementById('btn-back-from-global-bubbles');
  const inputGlobalSearchBubbles = document.getElementById('input-global-search-bubbles');
  const globalUsedWordsBubbles = document.getElementById('global-used-words-bubbles');
  const globalBubblesCountText = document.getElementById('global-bubbles-count-text');
  const globalLogsCountText = document.getElementById('global-logs-count-text');
  const globalHistoryFeed = document.getElementById('global-history-feed');
  const globalScoresRows = document.getElementById('global-scores-rows');

  // DOM Elements - Home
  const inputNickname = document.getElementById('input-nickname');
  const inputRoomCode = document.getElementById('input-room-code');
  const btnCreateRoom = document.getElementById('btn-create-room');
  const btnJoinRoom = document.getElementById('btn-join-room');

  // DOM Elements - Lobby
  const lobbyRoomCode = document.getElementById('lobby-room-code');
  const btnCopyCode = document.getElementById('btn-copy-code');
  const lobbyPlayerCount = document.getElementById('lobby-player-count');
  const lobbyPlayersList = document.getElementById('lobby-players-list');
  const sliderWinningScore = document.getElementById('slider-winning-score');
  const labelWinningScore = document.getElementById('label-winning-score');
  const sliderTurnTimer = document.getElementById('slider-turn-timer');
  const labelTurnTimer = document.getElementById('label-turn-timer');
  const lobbyNonHostNotice = document.getElementById('lobby-non-host-notice');
  const btnStartGame = document.getElementById('btn-start-game');
  const lobbyStartHint = document.getElementById('lobby-start-hint');
  const btnMuteLobby = document.getElementById('btn-mute-toggle-lobby');

  // DOM Elements - Primary View Tabs (4 Tabs: Arena, Scores, Logs, Word Bubbles)
  const navBtnGame = document.getElementById('nav-btn-game');
  const navBtnScores = document.getElementById('nav-btn-scores');
  const navBtnLogs = document.getElementById('nav-btn-logs');
  const navBtnBubbles = document.getElementById('nav-btn-bubbles');
  const viewGameArena = document.getElementById('view-game-arena');
  const viewScoresTab = document.getElementById('view-scores-tab');
  const viewLogsTab = document.getElementById('view-logs-tab');
  const viewUsedWordsTab = document.getElementById('view-used-words-tab');
  const btnBackToArena = document.getElementById('btn-back-to-arena');
  const btnBackToArenaFromScores = document.getElementById('btn-back-to-arena-from-scores');
  const btnBackToArenaFromLogs = document.getElementById('btn-back-to-arena-from-logs');
  const btnQuickViewLogs = document.getElementById('btn-quick-view-logs');
  const btnQuickViewBubbles = document.getElementById('btn-quick-view-bubbles');
  const topUsedWordsBadge = document.getElementById('top-used-words-badge');
  const quickUsedWordsBadge = document.getElementById('quick-used-words-badge');
  const arenaHistoryFeed = document.getElementById('arena-history-feed');
  const arenaLogsCountText = document.getElementById('arena-logs-count-text');
  const arenaScoresRows = document.getElementById('arena-scores-rows');
  const arenaScoresTargetHint = document.getElementById('arena-scores-target-hint');

  // DOM Elements - Sidebar Tabs (Scores, Logs, Used Words)
  const tabBtnScores = document.getElementById('tab-btn-scores');
  const tabBtnLogs = document.getElementById('tab-btn-logs');
  const tabBtnBubbles = document.getElementById('tab-btn-bubbles');
  const tabContentScores = document.getElementById('tab-content-scores');
  const tabContentLogs = document.getElementById('tab-content-logs');
  const tabContentBubbles = document.getElementById('tab-content-bubbles');
  const usedWordsBadge = document.getElementById('used-words-badge');
  const bubblesCountText = document.getElementById('bubbles-count-text');
  const sidebarBubblesCount = document.getElementById('sidebar-bubbles-count');
  const sidebarLogsCount = document.getElementById('sidebar-logs-count');
  const inputSearchBubbles = document.getElementById('input-search-bubbles');
  const inputSidebarSearchBubbles = document.getElementById('input-sidebar-search-bubbles');
  const usedWordsBubbles = document.getElementById('used-words-bubbles');
  const sidebarUsedWordsBubbles = document.getElementById('sidebar-used-words-bubbles');
  const targetScoreHint = document.getElementById('target-score-hint');

  // DOM Elements - Game
  const gameRoomCode = document.getElementById('game-room-code');
  const btnMuteGame = document.getElementById('btn-mute-toggle-game');
  const turnBanner = document.getElementById('turn-banner');
  const turnEmoji = document.getElementById('turn-emoji');
  const turnText = document.getElementById('turn-text');
  const typingIndicator = document.getElementById('typing-indicator');
  const baseWordCard = document.getElementById('base-word-card');
  const baseWordText = document.getElementById('base-word-text');
  const timerCircleProgress = document.getElementById('timer-circle-progress');
  const timerNumber = document.getElementById('timer-number');
  const timerContainer = document.getElementById('timer-container');
  const formWordSubmit = document.getElementById('form-word-submit');
  const inputGameWord = document.getElementById('input-game-word');
  const btnSubmitWord = document.getElementById('btn-submit-word');
  const btnSkipTurn = document.getElementById('btn-skip-turn');
  const gameModeHint = document.getElementById('game-mode-hint');
  const scoreboardRows = document.getElementById('scoreboard-rows');
  const historyFeed = document.getElementById('history-feed');
  const floatersContainer = document.getElementById('floaters-container');
  const reactionsContainer = document.getElementById('reactions-container');
  const systemBanner = document.getElementById('system-banner');

  // DOM Elements - Personal Live Score Pill
  const myAvatarPill = document.getElementById('my-avatar-pill');
  const myNamePill = document.getElementById('my-name-pill');
  const myScoreNumber = document.getElementById('my-score-number');
  const arenaMyAvatar = document.getElementById('arena-my-avatar');
  const arenaMyName = document.getElementById('arena-my-name');
  const arenaMyScore = document.getElementById('arena-my-score');

  // DOM Elements - Game Over
  const winnerAvatar = document.getElementById('winner-avatar');
  const winnerName = document.getElementById('winner-name');
  const winnerScore = document.getElementById('winner-score');
  const gameoverLeaderboard = document.getElementById('gameover-leaderboard');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const gameoverWaitHint = document.getElementById('gameover-wait-hint');

  // Initialize stored nickname
  const savedNickname = localStorage.getItem('wordsend_nickname');
  if (savedNickname) {
    inputNickname.value = savedNickname;
  }

  // Audio UI Sync
  function syncAudioUI() {
    const muted = window.soundEngine.isMuted();
    btnMuteLobby.textContent = muted ? '🔇 Sound: OFF' : '🔊 Sound: ON';
    btnMuteGame.textContent = muted ? '🔇' : '🔊';
  }
  btnMuteLobby.addEventListener('click', () => {
    window.soundEngine.toggleMute();
    syncAudioUI();
  });
  btnMuteGame.addEventListener('click', () => {
    window.soundEngine.toggleMute();
    syncAudioUI();
  });
  syncAudioUI();

  // Navigation Helper
  let lastActiveScreen = screenHome;
  function switchScreen(targetScreen) {
    if (!targetScreen) return;
    if (globalTabGame) globalTabGame.classList.remove('active');
    if (globalTabScores) globalTabScores.classList.remove('active');
    if (globalTabLogs) globalTabLogs.classList.remove('active');
    if (globalTabBubbles) globalTabBubbles.classList.remove('active');

    if (targetScreen === screenUsedWords) {
      if (globalTabBubbles) globalTabBubbles.classList.add('active');
    } else if (targetScreen === screenLogs) {
      if (globalTabLogs) globalTabLogs.classList.add('active');
    } else if (targetScreen === screenScores) {
      if (globalTabScores) globalTabScores.classList.add('active');
    } else {
      lastActiveScreen = targetScreen;
      if (globalTabGame) globalTabGame.classList.add('active');
    }
    [screenHome, screenLobby, screenGame, screenGameover, screenUsedWords, screenLogs, screenScores].forEach(s => {
      if (s) s.classList.remove('active');
    });
    targetScreen.classList.add('active');
  }

  // System Notification Toast Banner
  let bannerTimer = null;
  function showBanner(text, duration = 3500) {
    if (!text) return;
    systemBanner.textContent = text;
    systemBanner.style.display = 'block';
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => {
      systemBanner.style.display = 'none';
    }, duration);
  }

  // --- Home Screen Actions ---
  btnCreateRoom.addEventListener('click', () => {
    window.soundEngine.playClick();
    const nickname = (inputNickname.value || 'Player').trim();
    localStorage.setItem('wordsend_nickname', nickname);

    btnCreateRoom.disabled = true;
    socket.emit('create_room', { nickname }, (response) => {
      btnCreateRoom.disabled = false;
      if (response && response.success) {
        currentRoomCode = response.code;
        myPlayer = response.player;
        updateRoomState(response.state);
        switchScreen(screenLobby);
      } else {
        alert(response?.reason || 'Failed to create room.');
      }
    });
  });

  btnJoinRoom.addEventListener('click', () => {
    window.soundEngine.playClick();
    const nickname = (inputNickname.value || 'Player').trim();
    const code = (inputRoomCode.value || '').trim().toUpperCase();

    if (!code || code.length !== 4) {
      alert('Please enter a valid 4-letter room code.');
      inputRoomCode.focus();
      return;
    }
    localStorage.setItem('wordsend_nickname', nickname);

    btnJoinRoom.disabled = true;
    socket.emit('join_room', { code, nickname }, (response) => {
      btnJoinRoom.disabled = false;
      if (response && response.success) {
        currentRoomCode = response.code;
        myPlayer = response.player;
        updateRoomState(response.state);
        switchScreen(screenLobby);
      } else {
        alert(response?.reason || 'Could not join room.');
      }
    });
  });

  inputRoomCode.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') btnJoinRoom.click();
  });

  // --- Lobby Screen Actions ---
  btnCopyCode.addEventListener('click', () => {
    window.soundEngine.playClick();
    if (!currentRoomCode) return;
    navigator.clipboard.writeText(currentRoomCode).then(() => {
      const orig = btnCopyCode.textContent;
      btnCopyCode.textContent = '✅ Copied!';
      setTimeout(() => { btnCopyCode.textContent = orig; }, 1500);
    }).catch(() => {
      prompt('Room Code:', currentRoomCode);
    });
  });

  // Settings change emitters
  function emitSettingsUpdate() {
    if (!currentRoomCode || !isHost()) return;
    const settings = {
      winningScore: parseInt(sliderWinningScore.value, 10),
      turnTimer: parseInt(sliderTurnTimer.value, 10)
    };
    socket.emit('update_settings', { code: currentRoomCode, settings });
  }

  sliderWinningScore.addEventListener('input', () => {
    labelWinningScore.textContent = `${sliderWinningScore.value} pts`;
    emitSettingsUpdate();
  });
  sliderTurnTimer.addEventListener('input', () => {
    labelTurnTimer.textContent = `${sliderTurnTimer.value}s`;
    emitSettingsUpdate();
  });

  btnStartGame.addEventListener('click', () => {
    window.soundEngine.playClick();
    if (!currentRoomCode || !isHost()) return;
    btnStartGame.disabled = true;
    socket.emit('start_game', { code: currentRoomCode }, (response) => {
      btnStartGame.disabled = false;
      if (response && !response.success) {
        alert(response.reason);
      }
    });
  });

  // --- Game Screen Actions ---
  formWordSubmit.addEventListener('submit', (e) => {
    e.preventDefault();
    const word = inputGameWord.value.trim();
    if (!word) return;

    window.soundEngine.playClick();
    btnSubmitWord.disabled = true;
    btnSkipTurn.disabled = true;
    socket.emit('submit_word', { code: currentRoomCode, word });
    inputGameWord.value = '';

    // Clear typing state
    if (isTyping) {
      isTyping = false;
      socket.emit('typing_indicator', { code: currentRoomCode, isTyping: false });
    }
  });

  inputGameWord.addEventListener('input', () => {
    if (!isTyping) {
      isTyping = true;
      socket.emit('typing_indicator', { code: currentRoomCode, isTyping: true });
    }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      if (isTyping) {
        isTyping = false;
        socket.emit('typing_indicator', { code: currentRoomCode, isTyping: false });
      }
    }, 1000);
  });

  btnSkipTurn.addEventListener('click', () => {
    window.soundEngine.playClick();
    if (!currentRoomCode) return;
    btnSkipTurn.disabled = true;
    btnSubmitWord.disabled = true;
    socket.emit('skip_turn', { code: currentRoomCode });
  });

  // Quick Emoji Reactions
  document.querySelectorAll('.btn-reaction').forEach(btn => {
    btn.addEventListener('click', () => {
      window.soundEngine.playClick();
      const emoji = btn.dataset.emoji;
      if (currentRoomCode) {
        socket.emit('send_reaction', { code: currentRoomCode, emoji });
      }
    });
  });

  // --- Game Over Actions ---
  btnPlayAgain.addEventListener('click', () => {
    window.soundEngine.playClick();
    if (!currentRoomCode || !isHost()) return;
    socket.emit('play_again', { code: currentRoomCode });
  });

  // --- Helpers ---
  function isHost() {
    return currentRoomState && currentRoomState.hostId === socket.id;
  }

  // --- Central State Updater ---
  function updateRoomState(state) {
    if (!state) return;
    currentRoomState = state;
    const isMeHost = state.hostId === socket.id;

    if (state.bannerMessage) {
      showBanner(state.bannerMessage);
    }

    // 1. Lobby Update
    if (state.status === 'lobby') {
      switchScreen(screenLobby);
      lobbyRoomCode.textContent = state.code;
      lobbyPlayerCount.textContent = `(${state.players.length}/8)`;

      // Render players
      lobbyPlayersList.innerHTML = '';
      state.players.forEach(p => {
        const isMe = p.id === socket.id;
        const pill = document.createElement('div');
        pill.className = 'player-pill';
        pill.innerHTML = `
          <div class="player-pill-info">
            <div class="player-avatar" style="background-color: ${p.color};">${p.emoji}</div>
            <span class="player-name">${escapeHtml(p.nickname)}</span>
            ${isMe ? '<span class="badge-you">YOU</span>' : ''}
          </div>
          ${p.isHost ? '<span class="badge-host">HOST 👑</span>' : ''}
        `;
        lobbyPlayersList.appendChild(pill);
      });

      // Settings sliders sync
      sliderWinningScore.value = state.settings.winningScore;
      labelWinningScore.textContent = `${state.settings.winningScore} pts`;

      sliderTurnTimer.value = state.settings.turnTimer;
      labelTurnTimer.textContent = `${state.settings.turnTimer}s`;

      // Host controls availability
      sliderWinningScore.disabled = !isMeHost;
      sliderTurnTimer.disabled = !isMeHost;
      lobbyNonHostNotice.style.display = isMeHost ? 'none' : 'block';

      if (isMeHost) {
        btnStartGame.style.display = 'block';
        const canStart = state.players.length >= 2;
        btnStartGame.disabled = !canStart;
        lobbyStartHint.textContent = canStart
          ? 'Ready to start!'
          : `Need at least 2 players to start (${state.players.length}/2 joined).`;
      } else {
        btnStartGame.style.display = 'none';
        lobbyStartHint.textContent = 'Waiting for the host to start the game...';
      }
    }

    // 2. Playing State Update
    if (state.status === 'playing') {
      switchScreen(screenGame);
      gameRoomCode.textContent = state.code;

      // Animate base word card if changed
      if (state.baseWord && state.baseWord !== previousBaseWord) {
        previousBaseWord = state.baseWord;
        baseWordText.textContent = state.baseWord.toUpperCase();
        baseWordCard.classList.remove('animate-card-pop');
        void baseWordCard.offsetWidth; // Force reflow
        baseWordCard.classList.add('animate-card-pop');
      }

      // Compound Word Mode Hint
      gameModeHint.textContent = `Pair with "${state.baseWord}": e.g. [${state.baseWord}] + [word] OR [word] + [${state.baseWord}]`;

      // Active Turn Indicator
      const isMyTurn = state.currentTurnPlayerId === socket.id;
      const activePlayer = state.players.find(p => p.id === state.currentTurnPlayerId);

      if (isMyTurn) {
        turnBanner.className = 'turn-banner my-turn';
        turnEmoji.textContent = '🎯';
        turnText.textContent = "YOUR TURN! Type a word!";
        inputGameWord.disabled = false;
        btnSubmitWord.disabled = false;
        btnSkipTurn.style.display = 'block';
        inputGameWord.placeholder = 'Type your word here...';
        inputGameWord.focus();
      } else {
        turnBanner.className = 'turn-banner';
        turnEmoji.textContent = activePlayer ? activePlayer.emoji : '⏳';
        turnText.textContent = activePlayer
          ? `${activePlayer.nickname}'s turn...`
          : 'Waiting for turn...';
        inputGameWord.disabled = true;
        btnSubmitWord.disabled = true;
        btnSkipTurn.style.display = 'none';
        inputGameWord.placeholder = activePlayer ? `Waiting for ${activePlayer.nickname}...` : 'Waiting...';
      }

      // Update personal score pill & arena score bar
      const me = state.players.find(p => p.id === socket.id || (myPlayer && p.id === myPlayer.id));
      if (me) {
        if (myAvatarPill) myAvatarPill.textContent = me.emoji;
        if (myNamePill) myNamePill.textContent = `${me.nickname} (You):`;
        if (myScoreNumber) {
          myScoreNumber.textContent = `${me.score} pts`;
          myScoreNumber.style.color = me.score >= 0 ? '#36ab79' : '#ff4757';
        }
        if (arenaMyAvatar) arenaMyAvatar.textContent = me.emoji;
        if (arenaMyName) arenaMyName.textContent = `${me.nickname} (You)`;
        if (arenaMyScore) {
          arenaMyScore.textContent = `${me.score} pts`;
          arenaMyScore.style.color = me.score >= 0 ? '#2ed573' : '#ff4757';
        }
      }

      // Update Scoreboard with Progress Bars
      if (targetScoreHint) {
        targetScoreHint.textContent = `Goal: ${state.settings.winningScore} pts`;
      }
      renderScoreboard(state.players, state.currentTurnPlayerId, state.settings.winningScore);

      // Update Word History Feed & Used Words Bubbles
      renderWordHistory(state.wordHistory);
      renderBubbles(state.usedWordsList, inputSearchBubbles ? inputSearchBubbles.value : '');
    }

    // 3. Game Over State Update
    if (state.status === 'gameover') {
      switchScreen(screenGameover);
      if (state.winner) {
        winnerAvatar.textContent = state.winner.emoji;
        winnerAvatar.style.backgroundColor = state.winner.color;
        winnerName.textContent = state.winner.nickname;
        winnerScore.textContent = `Winner with ${state.winner.score} points!`;
      }

      // Render final standings
      gameoverLeaderboard.innerHTML = '';
      state.players.forEach((p, idx) => {
        const row = document.createElement('div');
        row.className = 'score-row';
        row.innerHTML = `
          <div class="score-row-header">
            <div class="score-player-info">
              <span>#${idx + 1}</span>
              <div class="player-avatar" style="width: 32px; height: 32px; font-size: 1.1rem; background: ${p.color};">${p.emoji}</div>
              <span>${escapeHtml(p.nickname)}</span>
            </div>
            <span class="score-value">${p.score} pts</span>
          </div>
        `;
        gameoverLeaderboard.appendChild(row);
      });

      if (isMeHost) {
        btnPlayAgain.style.display = 'block';
        gameoverWaitHint.style.display = 'none';
      } else {
        btnPlayAgain.style.display = 'none';
        gameoverWaitHint.style.display = 'block';
      }
    }
  }

  let cachedPlayersList = [];
  let cachedActiveTurnId = null;
  let cachedWinningScore = 10;

  // Scoreboard Renderer
  function renderScoreboard(players, activeTurnId, winningScore) {
    if (players) cachedPlayersList = players;
    if (activeTurnId !== undefined) cachedActiveTurnId = activeTurnId;
    if (winningScore !== undefined) cachedWinningScore = winningScore;

    const list = cachedPlayersList || [];
    const goalText = `Goal: ${cachedWinningScore} pts`;
    if (targetScoreHint) targetScoreHint.textContent = goalText;
    if (arenaScoresTargetHint) arenaScoresTargetHint.textContent = goalText;

    const populateRows = (container) => {
      if (!container) return;
      container.innerHTML = '';
      if (list.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 12px;">No players yet.</div>';
        return;
      }
      list.forEach(p => {
        const isTurn = p.id === cachedActiveTurnId;
        const isMe = p.id === socket.id || (myPlayer && p.id === myPlayer.id);
        const progressPercent = Math.min(100, Math.max(0, (p.score / cachedWinningScore) * 100));

        const row = document.createElement('div');
        row.className = `score-row ${isTurn ? 'active-turn' : ''} ${isMe ? 'my-row' : ''}`;
        row.innerHTML = `
          <div class="score-row-header">
            <div class="score-player-info">
              <div class="player-avatar" style="width: 28px; height: 28px; font-size: .95rem; background: ${p.color};">${p.emoji}</div>
              <span>${escapeHtml(p.nickname)}</span>
              ${isMe ? '<span class="badge-you" style="font-size: 0.65rem; padding: 2px 6px;">YOU</span>' : ''}
              ${isTurn ? '<span style="font-size: 0.7rem; color: #ffa502; font-weight: 700;">⏳ TURN</span>' : ''}
            </div>
            <span class="score-value" style="color: ${p.score >= 0 ? '#2ed573' : '#ff4757'}; font-weight: 700;">${p.score} pts</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${progressPercent}%; background: ${p.color};"></div>
          </div>
        `;
        container.appendChild(row);
      });
    };

    populateRows(scoreboardRows);
    populateRows(arenaScoresRows);
    populateRows(globalScoresRows);
  }

  // Word History Renderer (Match Logs)
  let cachedHistoryList = [];
  function renderWordHistory(history) {
    if (history) cachedHistoryList = history;
    const items = cachedHistoryList || [];

    const countText = `${items.length} event${items.length === 1 ? '' : 's'}`;
    document.querySelectorAll('.global-logs-badge').forEach(b => {
      b.textContent = items.length;
    });
    if (sidebarLogsCount) sidebarLogsCount.textContent = countText;
    if (arenaLogsCountText) arenaLogsCountText.textContent = countText;
    if (globalLogsCountText) globalLogsCountText.textContent = countText;

    const populateHistory = (feed) => {
      if (!feed) return;
      feed.innerHTML = '';
      if (items.length === 0) {
        feed.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 20px;">No match logs yet.</div>';
        return;
      }
      items.forEach(item => {
        const el = document.createElement('div');
        el.className = `history-item item-${item.type}`;
        let textContent = '';
        let badge = '';

        if (item.type === 'correct') {
          badge = '<span style="color: #2ed573; font-weight: 700;">+1</span>';
          textContent = item.compoundForm ? `<strong>${escapeHtml(item.word)}</strong> (${escapeHtml(item.compoundForm)})` : `<strong>${escapeHtml(item.word)}</strong>`;
        } else if (item.type === 'incorrect') {
          badge = '<span style="color: #a4b0be; font-weight: 700;">0</span>';
          textContent = `<span style="text-decoration: line-through;">${escapeHtml(item.word)}</span> <span style="font-size: 0.75rem; color: #e74c3c;">(${escapeHtml(item.reason || 'Invalid')})</span>`;
        } else {
          badge = '<span style="color: #ff4757; font-weight: 700;">-1</span>';
          textContent = `<em>${item.type === 'timeout' ? "Time's Up" : "Skipped"}</em>`;
        }

        el.innerHTML = `
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>${item.playerEmoji || '👤'}</span>
            <span>${textContent}</span>
          </div>
          <div>${badge}</div>
        `;
        feed.appendChild(el);
      });
    };

    populateHistory(historyFeed);
    populateHistory(arenaHistoryFeed);
    populateHistory(globalHistoryFeed);
  }

  // Primary View Navigation (4 Tabs: Play Arena vs Standings vs Match Logs vs 4th Tab Word Bubbles)
  function showArenaView() {
    if (navBtnGame) navBtnGame.classList.add('active');
    if (navBtnScores) navBtnScores.classList.remove('active');
    if (navBtnLogs) navBtnLogs.classList.remove('active');
    if (navBtnBubbles) navBtnBubbles.classList.remove('active');
    if (viewGameArena) viewGameArena.style.display = 'grid';
    if (viewScoresTab) viewScoresTab.style.display = 'none';
    if (viewLogsTab) viewLogsTab.style.display = 'none';
    if (viewUsedWordsTab) viewUsedWordsTab.style.display = 'none';
  }

  function showScoresTabView() {
    if (navBtnScores) navBtnScores.classList.add('active');
    if (navBtnGame) navBtnGame.classList.remove('active');
    if (navBtnLogs) navBtnLogs.classList.remove('active');
    if (navBtnBubbles) navBtnBubbles.classList.remove('active');
    if (viewGameArena) viewGameArena.style.display = 'none';
    if (viewScoresTab) viewScoresTab.style.display = 'block';
    if (viewLogsTab) viewLogsTab.style.display = 'none';
    if (viewUsedWordsTab) viewUsedWordsTab.style.display = 'none';
    renderScoreboard();
  }

  function showLogsTabView() {
    if (navBtnLogs) navBtnLogs.classList.add('active');
    if (navBtnGame) navBtnGame.classList.remove('active');
    if (navBtnScores) navBtnScores.classList.remove('active');
    if (navBtnBubbles) navBtnBubbles.classList.remove('active');
    if (viewGameArena) viewGameArena.style.display = 'none';
    if (viewScoresTab) viewScoresTab.style.display = 'none';
    if (viewLogsTab) viewLogsTab.style.display = 'block';
    if (viewUsedWordsTab) viewUsedWordsTab.style.display = 'none';
    renderWordHistory();
  }

  function showUsedWordsTabView() {
    if (navBtnBubbles) navBtnBubbles.classList.add('active');
    if (navBtnGame) navBtnGame.classList.remove('active');
    if (navBtnScores) navBtnScores.classList.remove('active');
    if (navBtnLogs) navBtnLogs.classList.remove('active');
    if (viewGameArena) viewGameArena.style.display = 'none';
    if (viewScoresTab) viewScoresTab.style.display = 'none';
    if (viewLogsTab) viewLogsTab.style.display = 'none';
    if (viewUsedWordsTab) viewUsedWordsTab.style.display = 'block';
    renderBubbles(cachedUsedWordsList, inputSearchBubbles ? inputSearchBubbles.value : '');
  }

  if (navBtnGame) navBtnGame.addEventListener('click', () => {
    window.soundEngine.playClick();
    showArenaView();
  });

  if (navBtnScores) navBtnScores.addEventListener('click', () => {
    window.soundEngine.playClick();
    showScoresTabView();
  });

  if (navBtnLogs) navBtnLogs.addEventListener('click', () => {
    window.soundEngine.playClick();
    showLogsTabView();
  });

  if (navBtnBubbles) navBtnBubbles.addEventListener('click', () => {
    window.soundEngine.playClick();
    showUsedWordsTabView();
  });

  if (btnBackToArena) btnBackToArena.addEventListener('click', () => {
    window.soundEngine.playClick();
    showArenaView();
  });

  if (btnBackToArenaFromScores) btnBackToArenaFromScores.addEventListener('click', () => {
    window.soundEngine.playClick();
    showArenaView();
  });

  if (btnBackToArenaFromLogs) btnBackToArenaFromLogs.addEventListener('click', () => {
    window.soundEngine.playClick();
    showArenaView();
  });

  if (btnQuickViewLogs) btnQuickViewLogs.addEventListener('click', () => {
    window.soundEngine.playClick();
    showLogsTabView();
  });

  if (btnQuickViewBubbles) btnQuickViewBubbles.addEventListener('click', () => {
    window.soundEngine.playClick();
    showUsedWordsTabView();
  });

  // Sidebar Tab Switching (Scores vs Logs vs 4th Tab Used Words)
  function showSidebarTab(tabName) {
    if (tabBtnScores) tabBtnScores.classList.toggle('active', tabName === 'scores');
    if (tabBtnLogs) tabBtnLogs.classList.toggle('active', tabName === 'logs');
    if (tabBtnBubbles) tabBtnBubbles.classList.toggle('active', tabName === 'bubbles');

    if (tabContentScores) tabContentScores.style.display = tabName === 'scores' ? 'block' : 'none';
    if (tabContentLogs) tabContentLogs.style.display = tabName === 'logs' ? 'block' : 'none';
    if (tabContentBubbles) tabContentBubbles.style.display = tabName === 'bubbles' ? 'block' : 'none';
  }

  if (tabBtnScores) tabBtnScores.addEventListener('click', () => {
    window.soundEngine.playClick();
    showSidebarTab('scores');
  });

  if (tabBtnLogs) tabBtnLogs.addEventListener('click', () => {
    window.soundEngine.playClick();
    showSidebarTab('logs');
    renderWordHistory();
  });

  if (tabBtnBubbles) tabBtnBubbles.addEventListener('click', () => {
    window.soundEngine.playClick();
    showSidebarTab('bubbles');
    renderBubbles();
  });

  // Global Tabs & Lobby Quick View (4 Tabs: Arena, Scores, Logs, Word Bubbles)
  if (globalTabGame) {
    globalTabGame.addEventListener('click', () => {
      window.soundEngine.playClick();
      switchScreen(lastActiveScreen || screenHome);
      if (lastActiveScreen === screenGame) {
        showArenaView();
      }
    });
  }

  if (globalTabScores) {
    globalTabScores.addEventListener('click', () => {
      window.soundEngine.playClick();
      switchScreen(screenScores);
      renderScoreboard();
    });
  }

  if (globalTabLogs) {
    globalTabLogs.addEventListener('click', () => {
      window.soundEngine.playClick();
      switchScreen(screenLogs);
      renderWordHistory();
    });
  }

  if (globalTabBubbles) {
    globalTabBubbles.addEventListener('click', () => {
      window.soundEngine.playClick();
      switchScreen(screenUsedWords);
      renderBubbles();
    });
  }

  if (btnLobbyViewLogs) {
    btnLobbyViewLogs.addEventListener('click', () => {
      window.soundEngine.playClick();
      switchScreen(screenLogs);
      renderWordHistory();
    });
  }

  if (btnLobbyViewBubbles) {
    btnLobbyViewBubbles.addEventListener('click', () => {
      window.soundEngine.playClick();
      switchScreen(screenUsedWords);
      renderBubbles();
    });
  }

  if (btnBackFromGlobalScores) {
    btnBackFromGlobalScores.addEventListener('click', () => {
      window.soundEngine.playClick();
      switchScreen(lastActiveScreen || screenHome);
    });
  }

  if (btnBackFromGlobalLogs) {
    btnBackFromGlobalLogs.addEventListener('click', () => {
      window.soundEngine.playClick();
      switchScreen(lastActiveScreen || screenHome);
    });
  }

  if (btnBackFromGlobalBubbles) {
    btnBackFromGlobalBubbles.addEventListener('click', () => {
      window.soundEngine.playClick();
      switchScreen(lastActiveScreen || screenHome);
    });
  }

  // Used Words Bubbles Rendering & Search
  let cachedUsedWordsList = [];

  function renderBubbles(usedWordsList, searchTerm = '') {
    if (usedWordsList) cachedUsedWordsList = usedWordsList;
    const list = cachedUsedWordsList || [];

    const countText = `${list.length} word${list.length === 1 ? '' : 's'}`;
    document.querySelectorAll('.global-used-words-badge').forEach(el => {
      el.textContent = list.length;
    });
    if (topUsedWordsBadge) topUsedWordsBadge.textContent = list.length;
    if (quickUsedWordsBadge) quickUsedWordsBadge.textContent = list.length;
    if (usedWordsBadge) usedWordsBadge.textContent = list.length;
    if (bubblesCountText) bubblesCountText.textContent = countText;
    if (globalBubblesCountText) globalBubblesCountText.textContent = countText;
    if (sidebarBubblesCount) sidebarBubblesCount.textContent = countText;

    const term = (searchTerm || '').trim().toLowerCase();
    const sorted = [...new Set(list)].sort();

    const populateContainer = (container) => {
      if (!container) return;
      container.innerHTML = '';
      if (list.length === 0) {
        container.innerHTML = `
          <div class="empty-bubbles-state">
            <span style="font-size: 2.4rem; display: block; margin-bottom: 6px;">🫧</span>
            <p style="margin: 0; font-size: 0.88rem; color: var(--muted); font-weight: 600;">No used words yet!</p>
            <span style="font-size: 0.78rem; color: #a4b0be;">Played words and compounds will appear here.</span>
          </div>
        `;
        return;
      }
      let matchCount = 0;
      const isFullView = container === usedWordsBubbles || container === globalUsedWordsBubbles;
      sorted.forEach((word, idx) => {
        const isMatch = term ? word.toLowerCase().includes(term) : true;
        if (!isMatch) return;
        matchCount++;

        const bubble = document.createElement('div');
        bubble.className = `${isFullView ? 'word-bubble-large' : 'word-bubble'} word-bubble-${idx % 8}`;
        if (term && word.toLowerCase().includes(term)) {
          bubble.classList.add('highlight-match');
        }
        bubble.innerHTML = `<span>🫧</span><span>${escapeHtml(word)}</span>`;
        bubble.title = `Used word: "${word}" (Click to pop)`;
        bubble.addEventListener('click', () => {
          if (window.soundEngine) window.soundEngine.playClick();
          bubble.classList.add('highlight-match');
          setTimeout(() => bubble.classList.remove('highlight-match'), 600);
        });
        container.appendChild(bubble);
      });

      if (matchCount === 0 && list.length > 0) {
        container.innerHTML = `<span style="font-size: 0.85rem; color: var(--muted); padding: 20px;">No bubbles match "${escapeHtml(searchTerm)}"</span>`;
      }
    };

    populateContainer(usedWordsBubbles);
    populateContainer(globalUsedWordsBubbles);
    populateContainer(sidebarUsedWordsBubbles);
  }

  if (inputSearchBubbles) {
    inputSearchBubbles.addEventListener('input', () => {
      renderBubbles(null, inputSearchBubbles.value);
    });
  }
  if (inputGlobalSearchBubbles) {
    inputGlobalSearchBubbles.addEventListener('input', () => {
      renderBubbles(null, inputGlobalSearchBubbles.value);
    });
  }
  if (inputSidebarSearchBubbles) {
    inputSidebarSearchBubbles.addEventListener('input', () => {
      renderBubbles(null, inputSidebarSearchBubbles.value);
    });
  }

  // --- Socket.IO Events ---

  // Room state broadcast
  socket.on('room_state', (state) => {
    updateRoomState(state);
  });

  // Turn Timer tick
  const timerRadius = 42;
  const circumference = 2 * Math.PI * timerRadius; // ~263.89
  socket.on('timer_tick', ({ timeRemaining, totalTime }) => {
    timerNumber.textContent = Math.max(0, timeRemaining);

    const ratio = Math.max(0, timeRemaining / totalTime);
    const offset = circumference * (1 - ratio);
    timerCircleProgress.style.strokeDashoffset = offset;

    // Color transitions: Green -> Yellow -> Red
    if (ratio > 0.5) {
      timerCircleProgress.style.stroke = '#2ed573';
      timerContainer.classList.remove('timer-pulsing');
    } else if (ratio > 0.25) {
      timerCircleProgress.style.stroke = '#ffa502';
      timerContainer.classList.remove('timer-pulsing');
    } else {
      timerCircleProgress.style.stroke = '#ff4757';
      timerContainer.classList.add('timer-pulsing');
    }

    // Audible tick
    if (timeRemaining <= 3 && timeRemaining > 0) {
      window.soundEngine.playTick(true);
    } else if (timeRemaining > 0) {
      window.soundEngine.playTick(false);
    }
  });

  // Word Evaluated / Score Animation Feedback
  socket.on('word_evaluated', (data) => {
    const isMe = (data.playerId === socket.id) || (myPlayer && data.playerId === myPlayer.id);

    spawnScoreToast(data.result, data.delta, isMe, data.playerNickname);

    if (data.result === 'correct') {
      if (isMe) {
        window.soundEngine.playCorrect();
        showBanner(`🎉 You scored +1 point with "${data.word}"!`, 3000);
      } else {
        window.soundEngine.playClick();
        showBanner(`🎯 ${data.playerNickname} scored +1 with "${data.word}"!`, 3000);
      }
    } else if (data.result === 'incorrect') {
      if (isMe) {
        window.soundEngine.playIncorrect();
        showBanner(`❌ Your word "${data.word}" was invalid: ${data.reason}`, 3000);
      } else {
        showBanner(`❌ ${data.playerNickname}'s word "${data.word}" was rejected (0 pts)`, 3000);
      }
    } else if (data.result === 'skip' || data.result === 'timeout') {
      if (isMe) {
        window.soundEngine.playSkip();
        showBanner(data.result === 'timeout' ? `⏰ Your time ran out! (-1 pt)` : `⏩ You skipped your turn (-1 pt)`, 3000);
      } else {
        showBanner(data.result === 'timeout' ? `⏰ Time's up for ${data.playerNickname}! (-1 pt)` : `⏩ ${data.playerNickname} skipped turn (-1 pt)`, 3000);
      }
    }
  });

  // Anti-Stall Reset Notification
  socket.on('anti_stall_reset', (data) => {
    window.soundEngine.playAntiStall();
    showBanner(`🔄 Anti-Stall: Nobody could answer! New base word is "${data.newWord.toUpperCase()}"`, 4000);
  });

  // Game Over Celebration
  socket.on('game_over', (data) => {
    window.soundEngine.playWin();
    window.confettiCannon.burst(160);
    showBanner(`🎉 ${data.winner.nickname} WINS THE GAME!`, 5000);
  });

  // Active player typing status
  socket.on('player_typing', ({ playerId, isTyping }) => {
    if (currentRoomState && currentRoomState.currentTurnPlayerId === playerId) {
      typingIndicator.style.display = isTyping ? 'inline-block' : 'none';
    }
  });

  // Floating emoji reaction
  socket.on('reaction_received', ({ playerNickname, emoji }) => {
    spawnFloatingReaction(playerNickname, emoji);
  });

  // Floating score toast (+1 green sparkle, 0 grey shake, -1 red wobble)
  function spawnScoreToast(result, delta, isMe, playerNickname) {
    const toast = document.createElement('div');
    toast.className = `score-toast score-toast-${result}`;
    const targetLabel = isMe ? 'YOU' : (playerNickname || 'Player');

    if (result === 'correct') {
      toast.classList.add('float-score-correct');
      toast.innerHTML = `+${delta} ✨ <span style="font-size: 1rem; opacity: 0.9;">(${escapeHtml(targetLabel)})</span>`;
    } else if (result === 'incorrect') {
      toast.classList.add('float-score-incorrect');
      toast.innerHTML = `0 💨 <span style="font-size: 1rem; opacity: 0.9;">(${escapeHtml(targetLabel)})</span>`;
    } else {
      toast.classList.add('float-score-skip');
      toast.innerHTML = `${delta} 💔 <span style="font-size: 1rem; opacity: 0.9;">(${escapeHtml(targetLabel)})</span>`;
    }

    floatersContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 1600);
  }

  // Floating emoji reaction bubble
  function spawnFloatingReaction(nickname, emoji) {
    const bubble = document.createElement('div');
    bubble.className = 'floating-reaction';
    bubble.style.fontSize = '2.4rem';
    bubble.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))';
    bubble.textContent = emoji;

    reactionsContainer.appendChild(bubble);
    setTimeout(() => {
      bubble.remove();
    }, 1800);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
});
