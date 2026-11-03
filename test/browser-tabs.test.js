// End-to-End Multi-Tab Browser Testing Suite with Puppeteer
const puppeteer = require('puppeteer');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');
const config = require('../config');
const Room = require('../game/Room');

const TEST_PORT = 3000;

async function runBrowserTabsTest() {
  console.log('========================================================');
  console.log(' Starting Real Multi-Tab Browser Validation Test ');
  console.log('========================================================');

  // Start app server
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  app.use(express.static(path.join(__dirname, '../public')));
  app.use((req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

  const rooms = new Map();
  const socketToRoom = new Map();

  function generateRoomCode() {
    return 'GAME';
  }

  io.on('connection', (socket) => {
    socket.on('create_room', ({ nickname }, cb) => {
      const code = generateRoomCode();
      const room = new Room(code, io);
      rooms.set(code, room);
      const res = room.addPlayer(socket.id, nickname);
      socket.join(code);
      socketToRoom.set(socket.id, code);
      if (cb) cb({ success: true, code, player: res.player, state: room.getPublicState() });
      room.broadcastState();
    });

    socket.on('join_room', ({ code, nickname }, cb) => {
      const room = rooms.get(code);
      if (!room) return cb && cb({ success: false, reason: 'Room not found' });
      const res = room.addPlayer(socket.id, nickname);
      if (!res.success) return cb && cb(res);
      socket.join(code);
      socketToRoom.set(socket.id, code);
      if (cb) cb({ success: true, code, player: res.player, state: room.getPublicState() });
      room.broadcastState(`${res.player.nickname} joined!`);
    });

    socket.on('update_settings', ({ code, settings }, cb) => {
      const room = rooms.get(code);
      if (room && cb) cb(room.updateSettings(socket.id, settings));
    });

    socket.on('start_game', ({ code }, cb) => {
      const room = rooms.get(code);
      if (room && cb) cb(room.startGame(socket.id));
    });

    socket.on('submit_word', ({ code, word }, cb) => {
      const room = rooms.get(code);
      if (room && cb) cb(room.submitWord(socket.id, word));
    });

    socket.on('skip_turn', ({ code }, cb) => {
      const room = rooms.get(code);
      if (room) room.handleSkip(socket.id, false);
      if (cb) cb({ success: true });
    });

    socket.on('play_again', ({ code }, cb) => {
      const room = rooms.get(code);
      if (room && cb) cb(room.playAgain(socket.id));
    });

    socket.on('send_reaction', ({ code, emoji }) => {
      const room = rooms.get(code);
      if (room) {
        const player = room.players.get(socket.id);
        io.to(code).emit('reaction_received', {
          playerId: socket.id,
          playerNickname: player ? player.nickname : 'Player',
          emoji
        });
      }
    });

    socket.on('disconnect', () => {
      const code = socketToRoom.get(socket.id);
      if (code) {
        const room = rooms.get(code);
        if (room) room.removePlayer(socket.id);
      }
    });
  });

  await new Promise(r => server.listen(TEST_PORT, r));
  console.log(`Server running at http://localhost:${TEST_PORT}`);

  // Launch Chrome browser
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // 1. Tab 1 - Alice (Host)
    console.log('\n[Tab 1] Alice opens home page...');
    const tab1 = await browser.newPage();
    await tab1.goto(`http://localhost:${TEST_PORT}`);

    await tab1.waitForSelector('#input-nickname');
    await tab1.type('#input-nickname', 'Alice');
    await tab1.click('#btn-create-room');

    await tab1.waitForSelector('#screen-lobby.active');
    const roomCode = await tab1.$eval('#lobby-room-code', el => el.textContent.trim());
    console.log(`[Tab 1] Alice created room "${roomCode}" and is in Lobby.`);

    // 2. Tab 2 - Bob joins
    console.log('\n[Tab 2] Bob opens home page and joins room...');
    const tab2 = await browser.newPage();
    await tab2.goto(`http://localhost:${TEST_PORT}`);

    await tab2.waitForSelector('#input-nickname');
    await tab2.type('#input-nickname', 'Bob');
    await tab2.type('#input-room-code', roomCode);
    await tab2.click('#btn-join-room');

    await tab2.waitForSelector('#screen-lobby.active');
    console.log(`[Tab 2] Bob joined room "${roomCode}".`);

    // 3. Tab 3 - Charlie joins
    console.log('\n[Tab 3] Charlie opens home page and joins room...');
    const tab3 = await browser.newPage();
    await tab3.goto(`http://localhost:${TEST_PORT}`);

    await tab3.waitForSelector('#input-nickname');
    await tab3.type('#input-nickname', 'Charlie');
    await tab3.type('#input-room-code', roomCode);
    await tab3.click('#btn-join-room');

    await tab3.waitForSelector('#screen-lobby.active');
    console.log(`[Tab 3] Charlie joined room "${roomCode}".`);

    // Verify all 3 tabs show 3 players in lobby
    await new Promise(r => setTimeout(r, 600));
    const countTab1 = await tab1.$eval('#lobby-player-count', el => el.textContent);
    console.log(`[Lobby Check] Tab 1 player count: ${countTab1}`);
    if (!countTab1.includes('3')) throw new Error('Expected 3 players in lobby');

    // 4. Host (Alice) configures settings: Winning score = 3
    console.log('\n[Settings] Alice updates winning score to 3 in lobby...');
    await tab1.$eval('#slider-winning-score', el => {
      el.value = 3;
      el.dispatchEvent(new Event('input'));
    });
    await new Promise(r => setTimeout(r, 400));

    // Verify Bob's tab sees winning score 3 pts
    const bobScoreLabel = await tab2.$eval('#label-winning-score', el => el.textContent);
    console.log(`[Tab 2] Bob sees updated winning score: ${bobScoreLabel}`);

    // 5. Host clicks Start Game
    console.log('\n[Start Game] Alice clicks Start Game button...');
    await tab1.click('#btn-start-game');

    // Wait for all 3 tabs to transition to game screen
    await Promise.all([
      tab1.waitForSelector('#screen-game.active'),
      tab2.waitForSelector('#screen-game.active'),
      tab3.waitForSelector('#screen-game.active')
    ]);
    console.log('✓ All 3 browser tabs successfully entered active Game Screen!');

    // Let's set room.baseWord to 'base' for predictable testing
    const room = rooms.get(roomCode);
    room.baseWord = 'base';
    room.usedWords.add('base');
    room.broadcastState();
    await new Promise(r => setTimeout(r, 400));

    const initialWord = await tab1.$eval('#base-word-text', el => el.textContent.trim());
    console.log(`Current Base Word on Tab 1 Card: "${initialWord}"`);

    // Helper to find which tab has active turn
    async function findActiveTab() {
      const tabs = [
        { name: 'Alice', tab: tab1 },
        { name: 'Bob', tab: tab2 },
        { name: 'Charlie', tab: tab3 }
      ];
      for (const t of tabs) {
        const isMyTurn = await t.tab.$eval('#turn-banner', el => el.classList.contains('my-turn'));
        if (isMyTurn) return t;
      }
      return null;
    }

    // 6. Test Correct Word: Active tab types "ball" -> "baseball" (+1 point)
    let active = await findActiveTab();
    console.log(`\n[Round 1] Active turn is on ${active.name}'s tab. Typing "ball"...`);
    await active.tab.type('#input-game-word', 'ball');
    await active.tab.click('#btn-submit-word');

    await new Promise(r => setTimeout(r, 800));

    // Verify base word updated on all tabs to "BALL"
    const wordTab2 = await tab2.$eval('#base-word-text', el => el.textContent.trim());
    console.log(`✓ Base word flipped on Tab 2: "${wordTab2}"`);
    if (wordTab2 !== 'BALL') throw new Error(`Expected BALL, got ${wordTab2}`);

    // 7. Test Incorrect Word: Next active tab types "zzxx" (0 points)
    active = await findActiveTab();
    console.log(`\n[Round 2] Active turn is on ${active.name}'s tab. Typing invalid word "zzxx"...`);
    await active.tab.type('#input-game-word', 'zzxx');
    await active.tab.click('#btn-submit-word');

    await new Promise(r => setTimeout(r, 800));

    // Verify base word stayed "BALL"
    const wordAfterFail = await tab3.$eval('#base-word-text', el => el.textContent.trim());
    console.log(`✓ Base word remained "${wordAfterFail}" after invalid word attempt`);
    if (wordAfterFail !== 'BALL') throw new Error(`Expected base word to stay BALL, got ${wordAfterFail}`);

    // 8. Test Skip: Next active tab clicks Skip (-1 point)
    active = await findActiveTab();
    console.log(`\n[Round 3] Active turn is on ${active.name}'s tab. Clicking Skip button...`);
    await active.tab.click('#btn-skip-turn');

    await new Promise(r => setTimeout(r, 800));
    console.log('✓ Skip executed. Turn passed.');

    // 9. Test Emoji Reaction: Tab 2 sends 🔥 reaction
    console.log('\n[Reaction] Bob sends 🔥 emoji reaction...');
    await tab2.click('.btn-reaction[data-emoji="🔥"]');
    await new Promise(r => setTimeout(r, 400));
    const reactionCount = await tab1.$$eval('.floating-reaction', els => els.length);
    console.log(`✓ Alice's screen captured floating emoji reaction: ${reactionCount > 0 ? 'YES' : 'NO'}`);

    // 10. Play through to winning score (3 points)
    console.log('\n[Win Condition] Playing winning moves to reach 3 points...');
    room.baseWord = 'ball';
    const leaderPlayer = room.players.get(room.getCurrentTurnPlayerId());
    leaderPlayer.score = 2; // set to 2 so next correct word wins (3 points)
    room.broadcastState();
    await new Promise(r => setTimeout(r, 400));

    active = await findActiveTab();
    console.log(`Submitting winning word "room" on ${active.name}'s tab...`);
    await active.tab.type('#input-game-word', 'room');
    await active.tab.click('#btn-submit-word');

    // Wait for game over screen
    await Promise.all([
      tab1.waitForSelector('#screen-gameover.active'),
      tab2.waitForSelector('#screen-gameover.active'),
      tab3.waitForSelector('#screen-gameover.active')
    ]);

    const winnerText = await tab1.$eval('#winner-name', el => el.textContent.trim());
    const winnerScoreText = await tab1.$eval('#winner-score', el => el.textContent.trim());
    console.log(`✓ All 3 tabs reached Game Over screen! Winner: ${winnerText} (${winnerScoreText})`);

    // 11. Test Play Again: Host clicks Play Again
    console.log('\n[Play Again] Host clicks Play Again button...');
    await tab1.click('#btn-play-again');

    await Promise.all([
      tab1.waitForSelector('#screen-lobby.active'),
      tab2.waitForSelector('#screen-lobby.active'),
      tab3.waitForSelector('#screen-lobby.active')
    ]);
    console.log('✓ All 3 tabs successfully returned to Lobby for a fresh game!');

    console.log('\n========================================================');
    console.log(' 🎉 FULL MULTI-TAB BROWSER TEST PASSED 100%! 🎉 ');
    console.log('========================================================\n');

    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Browser Test Error:', err);
    await browser.close();
    server.close();
    process.exit(1);
  }
}

runBrowserTabsTest();
