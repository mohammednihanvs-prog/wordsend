// Automated Multi-Player End-to-End Test Suite
const { io: ioClient } = require('socket.io-client');
const http = require('http');

const PORT = 3001; // Use test port to isolate test
process.env.PORT = PORT;

// Require server or instantiate fresh app
const express = require('express');
const { Server } = require('socket.io');
const Room = require('../game/Room');
const config = require('../config');

async function runTestSuite() {
  console.log('--- Starting Wordsend Multi-Player Test Suite ---');

  // Setup test server
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  const rooms = new Map();
  const socketToRoom = new Map();

  function generateRoomCode() {
    return 'TEST';
  }

  io.on('connection', (socket) => {
    socket.on('create_room', ({ nickname }, cb) => {
      const code = generateRoomCode();
      const room = new Room(code, io);
      rooms.set(code, room);
      const res = room.addPlayer(socket.id, nickname);
      socket.join(code);
      socketToRoom.set(socket.id, code);
      cb({ success: true, code, player: res.player, state: room.getPublicState() });
      room.broadcastState();
    });

    socket.on('join_room', ({ code, nickname }, cb) => {
      const room = rooms.get(code);
      if (!room) return cb({ success: false, reason: 'Room not found' });
      const res = room.addPlayer(socket.id, nickname);
      if (!res.success) return cb(res);
      socket.join(code);
      socketToRoom.set(socket.id, code);
      cb({ success: true, code, player: res.player, state: room.getPublicState() });
      room.broadcastState();
    });

    socket.on('update_settings', ({ code, settings }, cb) => {
      const room = rooms.get(code);
      if (room) cb(room.updateSettings(socket.id, settings));
    });

    socket.on('start_game', ({ code }, cb) => {
      const room = rooms.get(code);
      if (room) cb(room.startGame(socket.id));
    });

    socket.on('submit_word', ({ code, word }, cb) => {
      const room = rooms.get(code);
      if (room) cb(room.submitWord(socket.id, word));
    });

    socket.on('skip_turn', ({ code }, cb) => {
      const room = rooms.get(code);
      if (room) room.handleSkip(socket.id, false);
      cb({ success: true });
    });

    socket.on('play_again', ({ code }, cb) => {
      const room = rooms.get(code);
      if (room) cb(room.playAgain(socket.id));
    });

    socket.on('disconnect', () => {
      const code = socketToRoom.get(socket.id);
      if (code) {
        const room = rooms.get(code);
        if (room) room.removePlayer(socket.id);
      }
    });
  });

  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`Test server listening on port ${PORT}`);

  const SERVER_URL = `http://localhost:${PORT}`;

  function createClient(name) {
    return new Promise((resolve) => {
      const s = ioClient(SERVER_URL);
      s.on('connect', () => {
        resolve(s);
      });
    });
  }

  try {
    const clientAlice = await createClient('Alice');
    const clientBob = await createClient('Bob');
    const clientCharlie = await createClient('Charlie');

    console.log('✓ 3 client sockets connected');

    // 1. Alice creates room
    let roomCode = '';
    await new Promise((resolve) => {
      clientAlice.emit('create_room', { nickname: 'Alice' }, (res) => {
        if (!res.success) throw new Error('Alice failed to create room');
        roomCode = res.code;
        console.log(`✓ Alice created room "${roomCode}" as Host`);
        resolve();
      });
    });

    // 2. Bob and Charlie join
    await new Promise((resolve) => {
      clientBob.emit('join_room', { code: roomCode, nickname: 'Bob' }, (res) => {
        if (!res.success) throw new Error('Bob failed to join: ' + res.reason);
        console.log('✓ Bob joined room');
        resolve();
      });
    });

    await new Promise((resolve) => {
      clientCharlie.emit('join_room', { code: roomCode, nickname: 'Charlie' }, (res) => {
        if (!res.success) throw new Error('Charlie failed to join: ' + res.reason);
        console.log('✓ Charlie joined room');
        resolve();
      });
    });

    // 3. Test settings customization: winning score = 3, timer = 5s
    await new Promise((resolve) => {
      clientAlice.emit('update_settings', {
        code: roomCode,
        settings: { winningScore: 3, turnTimer: 5, chainMode: 'compound' }
      }, (res) => {
        if (!res.success || res.settings.winningScore !== 3) {
          throw new Error('Host failed to update settings');
        }
        console.log('✓ Host customized settings (winningScore=3, turnTimer=5s, chainMode=compound)');
        resolve();
      });
    });

    // Verify non-host cannot update settings
    await new Promise((resolve) => {
      clientBob.emit('update_settings', {
        code: roomCode,
        settings: { winningScore: 50 }
      }, (res) => {
        if (res.success) throw new Error('Non-host Bob was incorrectly allowed to change settings');
        console.log('✓ Verified: Non-host cannot change settings');
        resolve();
      });
    });

    // 4. Start Game
    let latestState = null;
    const statePromise = new Promise((resolve) => {
      clientAlice.on('room_state', (state) => {
        latestState = state;
        if (state.status === 'playing') resolve();
      });
    });

    await new Promise((resolve) => {
      clientAlice.emit('start_game', { code: roomCode }, (res) => {
        if (!res.success) throw new Error('Failed to start game: ' + res.reason);
        resolve();
      });
    });

    await statePromise;
    console.log(`✓ Game started! Initial base word is: "${latestState.baseWord}"`);

    // Let's set room.baseWord explicitly to 'base' to test deterministic compound word chaining
    const room = rooms.get(roomCode);
    room.baseWord = 'base';
    room.usedWords.add('base');

    // Helper to get active socket
    function getActiveClient() {
      const activeId = room.getCurrentTurnPlayerId();
      if (activeId === clientAlice.id) return { client: clientAlice, name: 'Alice' };
      if (activeId === clientBob.id) return { client: clientBob, name: 'Bob' };
      return { client: clientCharlie, name: 'Charlie' };
    }

    // 5. Test Correct Word: "ball" for base "base" (+1 point, base becomes "ball")
    const p1 = getActiveClient();
    console.log(`-> Turn 1: Active player is ${p1.name}. Base word is "${room.baseWord}". Submitting "ball"...`);

    await new Promise((resolve) => {
      p1.client.emit('submit_word', { code: roomCode, word: 'ball' }, (res) => {
        if (!res.success) throw new Error('Expected "ball" to be valid for base word "base": ' + res.reason);
        resolve();
      });
    });

    const alicePlayer = room.players.get(p1.client.id);
    if (alicePlayer.score !== 1) throw new Error(`Expected score 1, got ${alicePlayer.score}`);
    if (room.baseWord !== 'ball') throw new Error(`Expected base word "ball", got "${room.baseWord}"`);
    console.log(`✓ Correct word: score +1 (score=${alicePlayer.score}), new base word is "${room.baseWord}"`);

    // 6. Test Incorrect Word: submit non-word "zzxx" (0 points, base word stays "ball")
    const p2 = getActiveClient();
    console.log(`-> Turn 2: Active player is ${p2.name}. Submitting invalid word "zzxx"...`);

    await new Promise((resolve) => {
      p2.client.emit('submit_word', { code: roomCode, word: 'zzxx' }, (res) => {
        if (res.success) throw new Error('Expected "zzxx" to be rejected');
        resolve();
      });
    });

    const p2Player = room.players.get(p2.client.id);
    if (p2Player.score !== 0) throw new Error(`Expected score 0, got ${p2Player.score}`);
    if (room.baseWord !== 'ball') throw new Error(`Expected base word to stay "ball", got "${room.baseWord}"`);
    console.log(`✓ Incorrect word: score 0 (score=${p2Player.score}), base word remained "${room.baseWord}"`);

    // 7. Test Skip: active player presses Skip (-1 point, base word stays "ball")
    const p3 = getActiveClient();
    console.log(`-> Turn 3: Active player is ${p3.name}. Pressing Skip...`);

    await new Promise((resolve) => {
      p3.client.emit('skip_turn', { code: roomCode }, (res) => {
        if (!res.success) throw new Error('Failed to skip');
        resolve();
      });
    });

    const p3Player = room.players.get(p3.client.id);
    if (p3Player.score !== -1) throw new Error(`Expected score -1 for skip, got ${p3Player.score}`);
    if (room.baseWord !== 'ball') throw new Error(`Expected base word to stay "ball", got "${room.baseWord}"`);
    console.log(`✓ Skip: score -1 (score=${p3Player.score}), base word remained "${room.baseWord}"`);

    // 8. Test Reused Word rejection: "ball" was already used!
    const p4 = getActiveClient();
    console.log(`-> Turn 4: Active player is ${p4.name}. Trying to reuse already-used word "ball"...`);

    await new Promise((resolve) => {
      p4.client.emit('submit_word', { code: roomCode, word: 'ball' }, (res) => {
        if (res.success) throw new Error('Expected already-used word "ball" to be rejected!');
        console.log(`✓ Reused word rejected: "${res.reason}"`);
        resolve();
      });
    });

    // 9. Test Win Condition: play until a player reaches winning score (3)
    console.log('-> Testing Win Condition: playing valid words to reach winning score (3)...');
    // Current base is "ball". Let's play "room" -> "ballroom"!
    room.baseWord = 'ball';
    const nextPlayer = getActiveClient();
    nextPlayer.client.id === clientAlice.id ? (alicePlayer.score = 2) : (room.players.get(nextPlayer.client.id).score = 2);

    let gameOverReceived = false;
    clientAlice.on('game_over', (data) => {
      gameOverReceived = true;
      console.log(`✓ Received game_over event! Winner: ${data.winner.nickname} with ${data.winner.score} pts`);
    });

    await new Promise((resolve) => {
      nextPlayer.client.emit('submit_word', { code: roomCode, word: 'room' }, (res) => {
        if (!res.success) throw new Error('Expected "room" to be valid with "ball": ' + res.reason);
        resolve();
      });
    });

    if (room.status !== 'gameover') {
      throw new Error(`Expected status to be gameover, got ${room.status}`);
    }
    if (!gameOverReceived) {
      throw new Error('Did not receive game_over event');
    }

    // 10. Test Play Again: host resets to lobby
    await new Promise((resolve) => {
      clientAlice.emit('play_again', { code: roomCode }, (res) => {
        if (!res.success) throw new Error('Failed to play again: ' + res.reason);
        resolve();
      });
    });

    if (room.status !== 'lobby') throw new Error(`Expected lobby status, got ${room.status}`);
    for (const p of room.players.values()) {
      if (p.score !== 0) throw new Error(`Expected score reset to 0, player has ${p.score}`);
    }
    console.log('✓ Play Again: Successfully reset room to lobby with all scores at 0');

    console.log('\n========================================');
    console.log('🎉 ALL MULTI-PLAYER TESTS PASSED! 🎉');
    console.log('========================================\n');

    clientAlice.disconnect();
    clientBob.disconnect();
    clientCharlie.disconnect();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    server.close();
    process.exit(1);
  }
}

runTestSuite();
