// Server-Authoritative Room and Game State Machine
const config = require('../config');
const { validateWord, getRandomStartingWord } = require('./dictionary');

class Room {
  /**
   * @param {string} code - 4-letter room code
   * @param {import('socket.io').Server} io - Socket.IO instance
   */
  constructor(code, io) {
    this.code = code;
    this.io = io;
    this.status = 'lobby'; // 'lobby' | 'playing' | 'gameover'
    this.hostId = null;

    /** @type {Map<string, { id: string, nickname: string, emoji: string, color: string, score: number, isHost: boolean }>} */
    this.players = new Map();
    this.turnOrder = [];
    this.currentTurnIndex = 0;

    this.baseWord = '';
    this.usedWords = new Set();
    this.wordHistory = [];
    this.winner = null;

    // Anti-stall counter: tracks consecutive failed or skipped turns
    this.failedAttemptsInCycle = 0;

    // Customizable settings
    this.settings = {
      winningScore: config.RULES.DEFAULT_WINNING_SCORE,
      turnTimer: config.RULES.DEFAULT_TURN_TIMER,
      chainMode: config.RULES.DEFAULT_CHAIN_MODE
    };

    // Timer management
    this.turnTimerInterval = null;
    this.timeRemaining = this.settings.turnTimer;
  }

  /**
   * Adds a new player to the room
   */
  addPlayer(socketId, nickname) {
    if (this.players.size >= config.MAX_PLAYERS) {
      return { success: false, reason: 'Room is full (max 8 players).' };
    }
    if (this.status !== 'lobby') {
      return { success: false, reason: 'Game already in progress.' };
    }

    const isFirst = this.players.size === 0;
    if (isFirst) {
      this.hostId = socketId;
    }

    // Assign avatar that isn't currently used, or fallback
    const usedColors = new Set([...this.players.values()].map(p => p.color));
    const avatarChoice = config.AVATARS.find(a => !usedColors.has(a.color)) ||
      config.AVATARS[this.players.size % config.AVATARS.length];

    const cleanNickname = (nickname || 'Player').trim().slice(0, 16) || 'Player';

    const player = {
      id: socketId,
      nickname: cleanNickname,
      emoji: avatarChoice.emoji,
      color: avatarChoice.color,
      score: 0,
      isHost: isFirst
    };

    this.players.set(socketId, player);
    this.turnOrder.push(socketId);

    return { success: true, player };
  }

  /**
   * Removes a player and handles host migration / turn adjustments
   */
  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player) return;

    const wasCurrentTurn = this.getCurrentTurnPlayerId() === socketId;

    this.players.delete(socketId);
    this.turnOrder = this.turnOrder.filter(id => id !== socketId);

    // Host migration
    if (this.hostId === socketId && this.players.size > 0) {
      const nextHostId = this.players.keys().next().value;
      this.hostId = nextHostId;
      const nextHost = this.players.get(nextHostId);
      if (nextHost) nextHost.isHost = true;
    }

    // If game in progress
    if (this.status === 'playing') {
      if (this.players.size < config.MIN_PLAYERS) {
        // Less than minimum players left, end game or return to lobby
        this.clearTurnTimer();
        this.status = 'lobby';
        this.broadcastState('Not enough players remaining. Returning to lobby.');
        return;
      }

      if (wasCurrentTurn) {
        // Skip disconnected player's turn gracefully without penalty
        this.clearTurnTimer();
        if (this.currentTurnIndex >= this.turnOrder.length) {
          this.currentTurnIndex = 0;
        }
        this.startTurn();
      } else if (this.currentTurnIndex >= this.turnOrder.length) {
        this.currentTurnIndex = 0;
      }
    }

    this.broadcastState();
  }

  /**
   * Updates host-configurable room settings
   */
  updateSettings(socketId, newSettings) {
    if (socketId !== this.hostId) {
      return { success: false, reason: 'Only the host can modify game settings.' };
    }
    if (this.status !== 'lobby') {
      return { success: false, reason: 'Settings can only be changed in the lobby.' };
    }

    if (newSettings.winningScore !== undefined) {
      const score = parseInt(newSettings.winningScore, 10);
      if (!isNaN(score) && score >= config.RULES.MIN_WINNING_SCORE && score <= config.RULES.MAX_WINNING_SCORE) {
        this.settings.winningScore = score;
      }
    }

    if (newSettings.turnTimer !== undefined) {
      const timer = parseInt(newSettings.turnTimer, 10);
      if (!isNaN(timer) && timer >= config.RULES.MIN_TURN_TIMER && timer <= config.RULES.MAX_TURN_TIMER) {
        this.settings.turnTimer = timer;
        this.timeRemaining = timer;
      }
    }

    if (newSettings.chainMode && config.RULES.CHAIN_MODES.includes(newSettings.chainMode)) {
      this.settings.chainMode = newSettings.chainMode;
    }

    this.broadcastState();
    return { success: true, settings: this.settings };
  }

  /**
   * Starts a new match from lobby
   */
  startGame(socketId) {
    if (socketId !== this.hostId) {
      return { success: false, reason: 'Only the host can start the game.' };
    }
    if (this.players.size < config.MIN_PLAYERS) {
      return { success: false, reason: `Need at least ${config.MIN_PLAYERS} players to start.` };
    }
    if (this.players.size > config.MAX_PLAYERS) {
      return { success: false, reason: `Maximum ${config.MAX_PLAYERS} players allowed.` };
    }

    // Reset scores & state
    for (const player of this.players.values()) {
      player.score = 0;
    }
    this.usedWords.clear();
    this.wordHistory = [];
    this.winner = null;
    this.failedAttemptsInCycle = 0;

    // Pick starting word
    this.baseWord = getRandomStartingWord();
    this.usedWords.add(this.baseWord.toLowerCase());

    this.status = 'playing';
    this.currentTurnIndex = 0;

    this.broadcastState('Game started! First word is ready.');
    this.startTurn();

    return { success: true };
  }

  /**
   * Resets game to lobby for another round
   */
  playAgain(socketId) {
    if (socketId !== this.hostId) {
      return { success: false, reason: 'Only the host can trigger play again.' };
    }
    this.clearTurnTimer();
    this.status = 'lobby';
    this.winner = null;
    this.baseWord = '';
    this.usedWords.clear();
    this.wordHistory = [];
    this.failedAttemptsInCycle = 0;
    for (const player of this.players.values()) {
      player.score = 0;
    }

    this.broadcastState('Returned to lobby. Ready for next game!');
    return { success: true };
  }

  /**
   * Submits a word attempt on active player's turn
   */
  submitWord(socketId, word) {
    if (this.status !== 'playing') {
      return { success: false, reason: 'Game is not currently active.' };
    }

    const activePlayerId = this.getCurrentTurnPlayerId();
    if (socketId !== activePlayerId) {
      return { success: false, reason: "It's not your turn!" };
    }

    const player = this.players.get(socketId);
    if (!player) return { success: false, reason: 'Player not found.' };

    const validation = validateWord(word, this.baseWord, this.usedWords, this.settings.chainMode);

    if (validation.valid) {
      // Correct word
      const prevBaseWord = this.baseWord;
      const cleanWord = validation.cleanWord;

      player.score += config.SCORING.CORRECT;
      this.baseWord = cleanWord;
      this.usedWords.add(cleanWord);
      this.failedAttemptsInCycle = 0; // Reset anti-stall

      const historyEntry = {
        id: Date.now() + Math.random(),
        type: 'correct',
        word: cleanWord,
        baseWord: prevBaseWord,
        playerNickname: player.nickname,
        playerColor: player.color,
        playerEmoji: player.emoji,
        compoundForm: validation.compoundForm || null,
        delta: config.SCORING.CORRECT,
        timestamp: Date.now()
      };
      this.wordHistory.unshift(historyEntry);

      // Emit event for juice/animations
      this.io.to(this.code).emit('word_evaluated', {
        result: 'correct',
        playerId: player.id,
        playerNickname: player.nickname,
        delta: config.SCORING.CORRECT,
        word: cleanWord,
        baseWord: prevBaseWord,
        newBaseWord: this.baseWord,
        compoundForm: validation.compoundForm,
        message: validation.compoundForm
          ? `+1! "${cleanWord}" forms ${validation.compoundForm}`
          : `+1! Valid word "${cleanWord}"`
      });

      // Check win condition immediately
      if (player.score >= this.settings.winningScore) {
        this.endGame(player);
        return { success: true, win: true };
      }

      this.advanceTurn();
      return { success: true };
    } else {
      // Incorrect word (0 points, base word unchanged)
      player.score += config.SCORING.INCORRECT;
      this.failedAttemptsInCycle++;

      const historyEntry = {
        id: Date.now() + Math.random(),
        type: 'incorrect',
        word: validation.cleanWord || (word || '').slice(0, 20),
        baseWord: this.baseWord,
        playerNickname: player.nickname,
        playerColor: player.color,
        playerEmoji: player.emoji,
        delta: config.SCORING.INCORRECT,
        reason: validation.reason,
        timestamp: Date.now()
      };
      this.wordHistory.unshift(historyEntry);

      this.io.to(this.code).emit('word_evaluated', {
        result: 'incorrect',
        playerId: player.id,
        playerNickname: player.nickname,
        delta: config.SCORING.INCORRECT,
        word: validation.cleanWord || word,
        reason: validation.reason,
        message: validation.reason
      });

      // Check anti-stall rule
      this.checkAntiStall();

      this.advanceTurn();
      return { success: false, reason: validation.reason };
    }
  }

  /**
   * Handles player clicking Skip or turn timer expiring (-1 point)
   */
  handleSkip(socketId, isTimeout = false) {
    if (this.status !== 'playing') return;

    const activePlayerId = this.getCurrentTurnPlayerId();
    if (socketId !== activePlayerId) return;

    const player = this.players.get(socketId);
    if (!player) return;

    player.score += config.SCORING.SKIP;
    this.failedAttemptsInCycle++;

    const actionType = isTimeout ? 'timeout' : 'skip';
    const message = isTimeout
      ? `Time's up for ${player.nickname}! (-1 point)`
      : `${player.nickname} skipped! (-1 point)`;

    const historyEntry = {
      id: Date.now() + Math.random(),
      type: actionType,
      word: isTimeout ? 'TIME OUT' : 'SKIPPED',
      baseWord: this.baseWord,
      playerNickname: player.nickname,
      playerColor: player.color,
      playerEmoji: player.emoji,
      delta: config.SCORING.SKIP,
      timestamp: Date.now()
    };
    this.wordHistory.unshift(historyEntry);

    this.io.to(this.code).emit('word_evaluated', {
      result: actionType,
      playerId: player.id,
      playerNickname: player.nickname,
      delta: config.SCORING.SKIP,
      message
    });

    // Check anti-stall rule
    this.checkAntiStall();

    this.advanceTurn();
  }

  /**
   * Anti-stall rule: if every player skips or answers wrongly in one full cycle,
   * server automatically picks a new random base word.
   */
  checkAntiStall() {
    const cycleThreshold = this.turnOrder.length * config.RULES.ANTI_STALL_CYCLES;
    if (this.failedAttemptsInCycle >= cycleThreshold && cycleThreshold > 0) {
      const oldWord = this.baseWord;
      const newWord = getRandomStartingWord(this.usedWords);
      this.baseWord = newWord;
      this.usedWords.add(newWord.toLowerCase());
      this.failedAttemptsInCycle = 0;

      this.io.to(this.code).emit('anti_stall_reset', {
        oldWord,
        newWord,
        message: `Everyone got stuck! Server picked a fresh base word: "${newWord.toUpperCase()}"`
      });
    }
  }

  /**
   * Advances turn to next player in turn order
   */
  advanceTurn() {
    this.clearTurnTimer();
    if (this.turnOrder.length === 0) return;

    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
    this.startTurn();
  }

  /**
   * Starts countdown timer for current turn
   */
  startTurn() {
    this.clearTurnTimer();
    this.timeRemaining = this.settings.turnTimer;

    const activePlayerId = this.getCurrentTurnPlayerId();
    this.broadcastState();

    this.turnTimerInterval = setInterval(() => {
      this.timeRemaining -= 1;

      // Broadcast tick update to keep all client countdown rings synchronized
      this.io.to(this.code).emit('timer_tick', {
        timeRemaining: this.timeRemaining,
        totalTime: this.settings.turnTimer
      });

      if (this.timeRemaining <= 0) {
        this.clearTurnTimer();
        this.handleSkip(activePlayerId, true);
      }
    }, 1000);
  }

  clearTurnTimer() {
    if (this.turnTimerInterval) {
      clearInterval(this.turnTimerInterval);
      this.turnTimerInterval = null;
    }
  }

  /**
   * Declares game winner and switches to gameover state
   */
  endGame(winnerPlayer) {
    this.clearTurnTimer();
    this.status = 'gameover';
    this.winner = {
      id: winnerPlayer.id,
      nickname: winnerPlayer.nickname,
      emoji: winnerPlayer.emoji,
      color: winnerPlayer.color,
      score: winnerPlayer.score
    };

    this.io.to(this.code).emit('game_over', {
      winner: this.winner,
      finalScores: this.getSortedLeaderboard()
    });
    this.broadcastState();
  }

  getCurrentTurnPlayerId() {
    if (this.turnOrder.length === 0) return null;
    return this.turnOrder[this.currentTurnIndex % this.turnOrder.length];
  }

  getSortedLeaderboard() {
    return [...this.players.values()].sort((a, b) => b.score - a.score);
  }

  /**
   * Sanitized public state delivered to all clients
   */
  getPublicState(bannerMessage = null) {
    return {
      code: this.code,
      status: this.status,
      hostId: this.hostId,
      settings: this.settings,
      players: this.getSortedLeaderboard(),
      currentTurnPlayerId: this.getCurrentTurnPlayerId(),
      baseWord: this.baseWord,
      timeRemaining: this.timeRemaining,
      wordHistory: this.wordHistory.slice(0, 30),
      winner: this.winner,
      bannerMessage
    };
  }

  broadcastState(bannerMessage = null) {
    this.io.to(this.code).emit('room_state', this.getPublicState(bannerMessage));
  }

  destroy() {
    this.clearTurnTimer();
  }
}

module.exports = Room;
