// Test Anti-Stall and Turn Timer Timeout
const { io: ioClient } = require('socket.io-client');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const Room = require('../game/Room');

const PORT = 3002;
process.env.PORT = PORT;

async function testAntiStallAndTimeout() {
  console.log('--- Testing Anti-Stall & Turn Timeout ---');
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  const rooms = new Map();

  io.on('connection', (socket) => {
    socket.on('create_room', ({ nickname }, cb) => {
      const room = new Room('STAL', io);
      rooms.set('STAL', room);
      const res = room.addPlayer(socket.id, nickname);
      socket.join('STAL');
      cb({ success: true, code: 'STAL', player: res.player, state: room.getPublicState() });
      room.broadcastState();
    });

    socket.on('join_room', ({ code, nickname }, cb) => {
      const room = rooms.get(code);
      const res = room.addPlayer(socket.id, nickname);
      socket.join(code);
      cb({ success: true, code, player: res.player, state: room.getPublicState() });
      room.broadcastState();
    });

    socket.on('update_settings', ({ code, settings }, cb) => {
      const room = rooms.get(code);
      cb(room.updateSettings(socket.id, settings));
    });

    socket.on('start_game', ({ code }, cb) => {
      const room = rooms.get(code);
      cb(room.startGame(socket.id));
    });

    socket.on('skip_turn', ({ code }, cb) => {
      const room = rooms.get(code);
      room.handleSkip(socket.id, false);
      cb({ success: true });
    });
  });

  await new Promise(r => server.listen(PORT, r));

  function createClient() {
    return new Promise((resolve) => {
      const s = ioClient(`http://localhost:${PORT}`, { transports: ['websocket', 'polling'] });
      if (s.connected) return resolve(s);
      s.on('connect', () => resolve(s));
    });
  }

  const client1 = await createClient();
  const client2 = await createClient();

  await new Promise(r => client1.emit('create_room', { nickname: 'P1' }, r));
  await new Promise(r => client2.emit('join_room', { code: 'STAL', nickname: 'P2' }, r));

  // Set short turn timer = 5s
  await new Promise(r => client1.emit('update_settings', {
    code: 'STAL',
    settings: { turnTimer: 5, winningScore: 10 }
  }, r));

  await new Promise(r => client1.emit('start_game', { code: 'STAL' }, r));

  const room = rooms.get('STAL');
  const initialBaseWord = room.baseWord;
  console.log(`✓ Started game with base word "${initialBaseWord}" and 2 players.`);

  // Listen for anti-stall reset
  let antiStallTriggered = false;
  client1.on('anti_stall_reset', (data) => {
    antiStallTriggered = true;
    console.log(`✓ Anti-Stall reset triggered! Old: "${data.oldWord}", New: "${data.newWord}"`);
  });

  // Cycle 1: Player 1 skips (-1)
  console.log('-> Player 1 skips...');
  await new Promise(r => client1.emit('skip_turn', { code: 'STAL' }, r));
  if (antiStallTriggered) throw new Error('Anti-stall should not trigger on first skip of 2-player game');

  // Cycle 1: Player 2 skips (-1) -> Now 2 consecutive fails (equals 2 players * 1 cycle)
  console.log('-> Player 2 skips...');
  await new Promise(r => client2.emit('skip_turn', { code: 'STAL' }, r));

  if (!antiStallTriggered) {
    throw new Error('Anti-stall should have triggered after all players failed in 1 full cycle!');
  }
  if (room.baseWord === initialBaseWord) {
    throw new Error('Base word should have changed after anti-stall reset');
  }

  console.log(`✓ Anti-Stall successfully selected new word "${room.baseWord}"!`);

  // Now test Turn Timer Timeout automatically passing turn
  console.log('-> Testing Turn Timer timeout: waiting 5 seconds for turn timer to expire...');
  const turnBeforeTimeout = room.getCurrentTurnPlayerId();
  const playerBeforeTimeout = room.players.get(turnBeforeTimeout);
  const scoreBeforeTimeout = playerBeforeTimeout.score;

  await new Promise(r => setTimeout(r, 5500));

  const turnAfterTimeout = room.getCurrentTurnPlayerId();
  if (turnAfterTimeout === turnBeforeTimeout) {
    throw new Error('Turn timer did not advance turn upon expiration!');
  }
  if (playerBeforeTimeout.score !== scoreBeforeTimeout - 1) {
    throw new Error(`Expected score to decrease by 1 on timeout, was ${scoreBeforeTimeout} now ${playerBeforeTimeout.score}`);
  }

  console.log('✓ Turn timer correctly timed out, applied -1 penalty, and advanced turn automatically!');

  client1.disconnect();
  client2.disconnect();
  room.destroy();
  server.close();
  console.log('✓ Anti-Stall & Turn Timeout test passed!\n');
  process.exit(0);
}

testAntiStallAndTimeout().catch(err => {
  console.error(err);
  process.exit(1);
});
