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
  const selectChainMode = document.getElementById('select-chain-mode');
  const lobbyNonHostNotice = document.getElementById('lobby-non-host-notice');
  const btnStartGame = document.getElementById('btn-start-game');
  const lobbyStartHint = document.getElementById('lobby-start-hint');
  const btnMuteLobby = document.getElementById('btn-mute-toggle-lobby');

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
  function switchScreen(targetScreen) {
    [screenHome, screenLobby, screenGame, screenGameover].forEach(s => s.classList.remove('active'));
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
      turnTimer: parseInt(sliderTurnTimer.value, 10),
      chainMode: selectChainMode.value
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
  selectChainMode.addEventListener('change', () => {
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

      selectChainMode.value = state.settings.chainMode;

      // Host controls availability
      sliderWinningScore.disabled = !isMeHost;
      sliderTurnTimer.disabled = !isMeHost;
      selectChainMode.disabled = !isMeHost;
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

      // Chain Mode Hint
      if (state.settings.chainMode === 'compound') {
        gameModeHint.textContent = `Pair with "${state.baseWord}": [${state.baseWord}] + [word] OR [word] + [${state.baseWord}]`;
      } else if (state.settings.chainMode === 'shiritori') {
        const lastLetter = state.baseWord.slice(-1).toUpperCase();
        gameModeHint.textContent = `Chain with last letter: Must start with "${lastLetter}"`;
      } else {
        gameModeHint.textContent = `Type any valid unused English word!`;
      }

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

      // Update personal score pill
      const me = state.players.find(p => p.id === socket.id || (myPlayer && p.id === myPlayer.id));
      if (me) {
        if (myAvatarPill) myAvatarPill.textContent = me.emoji;
        if (myNamePill) myNamePill.textContent = `${me.nickname} (You):`;
        if (myScoreNumber) {
          myScoreNumber.textContent = `${me.score} pts`;
          myScoreNumber.style.color = me.score >= 0 ? '#36ab79' : '#ff4757';
        }
      }

      // Update Scoreboard with Progress Bars
      renderScoreboard(state.players, state.currentTurnPlayerId, state.settings.winningScore);

      // Update Word History Feed
      renderWordHistory(state.wordHistory);
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

  // Scoreboard Renderer
  function renderScoreboard(players, activeTurnId, winningScore) {
    scoreboardRows.innerHTML = '';
    players.forEach(p => {
      const isTurn = p.id === activeTurnId;
      const isMe = p.id === socket.id || (myPlayer && p.id === myPlayer.id);
      const progressPercent = Math.min(100, Math.max(0, (p.score / winningScore) * 100));

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
      scoreboardRows.appendChild(row);
    });
  }

  // Word History Renderer
  function renderWordHistory(history) {
    historyFeed.innerHTML = '';
    if (!history || history.length === 0) {
      historyFeed.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 12px;">No words played yet.</div>';
      return;
    }

    history.forEach(item => {
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
      historyFeed.appendChild(el);
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
