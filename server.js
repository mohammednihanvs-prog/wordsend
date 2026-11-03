// Express + Socket.IO Server & Room Orchestrator
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const config = require('./config');
const Room = require('./game/Room');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Serve frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for SPA behavior
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Map of active rooms: code -> Room instance
const rooms = new Map();

// Map of socket.id -> room code for fast disconnect lookups
const socketToRoom = new Map();

/**
 * Generates an uppercase 4-letter room code
 */
function generateRoomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // excluded I, O to avoid confusion with 1, 0
  let code = '';
  for (let attempt = 0; attempt < 1000; attempt++) {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    if (!rooms.has(code)) return code;
  }
  return 'WORD';
}

io.on('connection', (socket) => {
  // 1. Create Room
  socket.on('create_room', ({ nickname }, callback) => {
    const code = generateRoomCode();
    const room = new Room(code, io);
    rooms.set(code, room);

    const result = room.addPlayer(socket.id, nickname);
    if (!result.success) {
      rooms.delete(code);
      if (typeof callback === 'function') callback(result);
      return;
    }

    socket.join(code);
    socketToRoom.set(socket.id, code);

    if (typeof callback === 'function') {
      callback({ success: true, code, player: result.player, state: room.getPublicState() });
    }
    room.broadcastState();
  });

  // 2. Join Room
  socket.on('join_room', ({ code, nickname }, callback) => {
    const cleanCode = (code || '').trim().toUpperCase();
    const room = rooms.get(cleanCode);

    if (!room) {
      if (typeof callback === 'function') {
        callback({ success: false, reason: `Room "${cleanCode}" does not exist!` });
      }
      return;
    }

    const result = room.addPlayer(socket.id, nickname);
    if (!result.success) {
      if (typeof callback === 'function') callback(result);
      return;
    }

    socket.join(cleanCode);
    socketToRoom.set(socket.id, cleanCode);

    if (typeof callback === 'function') {
      callback({ success: true, code: cleanCode, player: result.player, state: room.getPublicState() });
    }
    room.broadcastState(`${result.player.nickname} joined the room!`);
  });

  // 3. Update Settings (Host Only)
  socket.on('update_settings', ({ code, settings }, callback) => {
    const room = rooms.get(code);
    if (!room) return;
    const result = room.updateSettings(socket.id, settings);
    if (typeof callback === 'function') callback(result);
  });

  // 4. Start Game (Host Only)
  socket.on('start_game', ({ code }, callback) => {
    const room = rooms.get(code);
    if (!room) return;
    const result = room.startGame(socket.id);
    if (typeof callback === 'function') callback(result);
  });

  // 5. Submit Word
  socket.on('submit_word', ({ code, word }, callback) => {
    const room = rooms.get(code);
    if (!room) return;
    const result = room.submitWord(socket.id, word);
    if (typeof callback === 'function') callback(result);
  });

  // 6. Skip Turn
  socket.on('skip_turn', ({ code }, callback) => {
    const room = rooms.get(code);
    if (!room) return;
    room.handleSkip(socket.id, false);
    if (typeof callback === 'function') callback({ success: true });
  });

  // 7. Play Again (Return to Lobby)
  socket.on('play_again', ({ code }, callback) => {
    const room = rooms.get(code);
    if (!room) return;
    const result = room.playAgain(socket.id);
    if (typeof callback === 'function') callback(result);
  });

  // 8. Typing Indicator for active player
  socket.on('typing_indicator', ({ code, isTyping }) => {
    const room = rooms.get(code);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;

    socket.to(code).emit('player_typing', {
      playerId: socket.id,
      playerNickname: player.nickname,
      isTyping
    });
  });

  // 9. Quick Emoji Reactions (🔥 😂 😱 👏)
  socket.on('send_reaction', ({ code, emoji }) => {
    const room = rooms.get(code);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;

    io.to(code).emit('reaction_received', {
      playerId: socket.id,
      playerNickname: player.nickname,
      emoji: emoji || '🔥',
      id: Date.now() + Math.random()
    });
  });

  // 10. Handle Disconnection
  socket.on('disconnect', () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    socketToRoom.delete(socket.id);

    const room = rooms.get(code);
    if (!room) return;

    room.removePlayer(socket.id);

    // Delete empty rooms to prevent memory leaks
    if (room.players.size === 0) {
      room.destroy();
      rooms.delete(code);
    }
  });
});

// Helper to determine local network IP for easy multi-device LAN play
function getLocalNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalNetworkIp();
server.listen(config.PORT, () => {
  console.log(`===============================================`);
  console.log(` Wordsend Word Chain Game is running!`);
  console.log(` Local:   http://localhost:${config.PORT}`);
  console.log(` Network: http://${localIp}:${config.PORT}`);
  console.log(`===============================================`);
});
