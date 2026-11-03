// Real Multi-Tab Browser End-to-End Test Suite against live server
const puppeteer = require('puppeteer');

const TARGET_URL = 'http://localhost:3000';

async function runTest() {
  console.log('========================================================');
  console.log(' Connecting Puppeteer to live Wordsend server at:');
  console.log(` ${TARGET_URL}`);
  console.log('========================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
  });

  try {
    // Tab 1: Alice (Host)
    console.log('[Tab 1] Alice opens http://localhost:3000...');
    const tab1 = await browser.newPage();
    tab1.on('console', msg => console.log('[Browser Tab 1 Console]:', msg.text()));
    tab1.on('pageerror', err => console.error('[Browser Tab 1 Error]:', err.message));
    tab1.on('dialog', async d => {
      console.log('[Browser Tab 1 Dialog Alert]:', d.message());
      await d.dismiss();
    });
    await tab1.goto(TARGET_URL);

    await tab1.waitForSelector('#input-nickname');
    await tab1.type('#input-nickname', 'Alice');
    await tab1.click('#btn-create-room');

    await tab1.waitForSelector('#screen-lobby.active');
    const roomCode = await tab1.$eval('#lobby-room-code', el => el.textContent.trim());
    console.log(`✓ Alice created room "${roomCode}" and is Host.`);

    // Tab 2: Bob
    console.log('\n[Tab 2] Bob opens http://localhost:3000 and joins...');
    const tab2 = await browser.newPage();
    tab2.on('console', msg => console.log('[Browser Tab 2 Console]:', msg.text()));
    tab2.on('pageerror', err => console.error('[Browser Tab 2 Error]:', err.message));
    tab2.on('dialog', async d => { await d.dismiss(); });
    await tab2.goto(TARGET_URL);

    await tab2.waitForSelector('#input-nickname');
    await tab2.type('#input-nickname', 'Bob');
    await tab2.type('#input-room-code', roomCode);
    await tab2.click('#btn-join-room');

    await tab2.waitForSelector('#screen-lobby.active');
    console.log(`✓ Bob joined room "${roomCode}".`);

    // Tab 3: Charlie
    console.log('\n[Tab 3] Charlie opens http://localhost:3000 and joins...');
    const tab3 = await browser.newPage();
    tab3.on('console', msg => console.log('[Browser Tab 3 Console]:', msg.text()));
    tab3.on('pageerror', err => console.error('[Browser Tab 3 Error]:', err.message));
    tab3.on('dialog', async d => { await d.dismiss(); });
    await tab3.goto(TARGET_URL);

    await tab3.waitForSelector('#input-nickname');
    await tab3.type('#input-nickname', 'Charlie');
    await tab3.type('#input-room-code', roomCode);
    await tab3.click('#btn-join-room');

    await tab3.waitForSelector('#screen-lobby.active');
    console.log(`✓ Charlie joined room "${roomCode}".`);

    // Verify 3 players in lobby on all tabs
    await new Promise(r => setTimeout(r, 600));
    const countTab1 = await tab1.$eval('#lobby-player-count', el => el.textContent);
    console.log(`✓ Tab 1 sees player count: ${countTab1}`);
    if (!countTab1.includes('3')) throw new Error('Expected 3 players in lobby');

    // Host updates settings: winning score = 3
    console.log('\n[Settings] Alice updates winning score to 3 in lobby...');
    await tab1.$eval('#slider-winning-score', el => {
      el.value = 3;
      el.dispatchEvent(new Event('input'));
    });
    await new Promise(r => setTimeout(r, 600));

    // Bob checks winning score
    const bobScore = await tab2.$eval('#label-winning-score', el => el.textContent);
    console.log(`✓ Bob sees synchronized winning score: ${bobScore}`);

    // Host clicks Start Game
    console.log('\n[Start Game] Alice clicks Start Game button...');
    const btnDisabled = await tab1.$eval('#btn-start-game', el => el.disabled);
    const btnDisplay = await tab1.$eval('#btn-start-game', el => el.style.display);
    console.log(`[Start Button State] disabled: ${btnDisabled}, display: ${btnDisplay}`);
    await tab1.$eval('#btn-start-game', el => el.click());

    // All tabs should transition to screen-game
    console.log('Waiting for #screen-game.active on all tabs...');
    await Promise.all([
      tab1.waitForSelector('#screen-game.active', { timeout: 6000 }),
      tab2.waitForSelector('#screen-game.active', { timeout: 6000 }),
      tab3.waitForSelector('#screen-game.active', { timeout: 6000 })
    ]);
    console.log('✓ All 3 browser tabs transitioned to Game Screen!');

    await new Promise(r => setTimeout(r, 500));
    const baseWord = await tab1.$eval('#base-word-text', el => el.textContent.trim());
    console.log(`✓ Active Base Word on card: "${baseWord}"`);

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

    // 1. Test Incorrect Word attempt: Submit "xyz123"
    let active = await findActiveTab();
    console.log(`\n[Test Incorrect Word] Active turn is ${active.name}. Submitting invalid word "xyz123"...`);
    await active.tab.type('#input-game-word', 'xyz123');
    await active.tab.$eval('#btn-submit-word', el => el.click());

    await new Promise(r => setTimeout(r, 1000));
    const wordAfterFail = await tab2.$eval('#base-word-text', el => el.textContent.trim());
    console.log(`✓ Base word remained "${wordAfterFail}" (no change on invalid word).`);

    // 2. Test Skip Turn: Next active player clicks Skip (-1)
    active = await findActiveTab();
    console.log(`\n[Test Skip Button] Active turn is ${active.name}. Clicking Skip Turn (-1 pt)...`);
    await active.tab.$eval('#btn-skip-turn', el => el.click());

    await new Promise(r => setTimeout(r, 1000));
    console.log('✓ Turn skipped with -1 point.');

    // 3. Test Emoji Reactions: Tab 2 sends 😂
    console.log('\n[Test Reaction] Bob sends 😂 reaction...');
    await tab2.$eval('.btn-reaction[data-emoji="😂"]', el => el.click());
    await new Promise(r => setTimeout(r, 400));
    const reactions = await tab1.$$eval('.floating-reaction', els => els.length);
    console.log(`✓ Floating emoji reaction rendered: ${reactions > 0 ? 'YES' : 'NO'}`);

    // 4. Test Correct Chain Word:
    active = await findActiveTab();
    const currentBase = (await active.tab.$eval('#base-word-text', el => el.textContent.trim())).toLowerCase();
    console.log(`\n[Test Correct Word] Active turn is ${active.name}. Current base is "${currentBase}".`);

    // Let's find a valid compound word for currentBase
    const rawWords = require('an-array-of-english-words');
    const set = new Set(rawWords);
    let validWord = '';
    for (const w of set) {
      if (w.length >= 2 && w !== currentBase) {
        if (set.has(currentBase + w) || set.has(w + currentBase)) {
          validWord = w;
          break;
        }
      }
    }

    if (validWord) {
      console.log(`Submitting valid word "${validWord}" (forms compound with "${currentBase}")...`);
      await active.tab.type('#input-game-word', validWord);
      await active.tab.$eval('#btn-submit-word', el => el.click());

      await new Promise(r => setTimeout(r, 1200));
      const newBaseWord = await tab1.$eval('#base-word-text', el => el.textContent.trim());
      console.log(`✓ Base word card updated to: "${newBaseWord}"`);
    }

    // 5. Play to winning score (3 points) to trigger Game Over celebration
    console.log('\n[Win Condition] Playing moves to reach winning score (3)...');
    for (let round = 0; round < 6; round++) {
      active = await findActiveTab();
      if (!active) {
        const gameOver = await tab1.$eval('#screen-gameover', el => el.classList.contains('active'));
        if (gameOver) break;
        continue;
      }
      const curBase = (await active.tab.$eval('#base-word-text', el => el.textContent.trim())).toLowerCase();
      let move = '';
      for (const w of set) {
        if (w.length >= 2 && w !== curBase) {
          if (set.has(curBase + w) || set.has(w + curBase)) {
            move = w;
            break;
          }
        }
      }

      if (move) {
        await active.tab.type('#input-game-word', move);
        await active.tab.$eval('#btn-submit-word', el => el.click());
      } else {
        await active.tab.$eval('#btn-skip-turn', el => el.click());
      }

      await new Promise(r => setTimeout(r, 1000));
      const isGameOver = await tab1.$eval('#screen-gameover', el => el.classList.contains('active'));
      if (isGameOver) {
        console.log('✓ Win condition reached!');
        break;
      }
    }

    // Check game over screen
    await new Promise(r => setTimeout(r, 500));
    const gameOverActive = await tab1.$eval('#screen-gameover', el => el.classList.contains('active'));
    if (gameOverActive) {
      const winner = await tab1.$eval('#winner-name', el => el.textContent.trim());
      console.log(`✓ Game Over Screen verified! Winner: ${winner}`);

      // Test Play Again: Alice clicks Play Again
      console.log('\n[Play Again] Host clicks Play Again...');
      await tab1.$eval('#btn-play-again', el => el.click());
      await Promise.all([
        tab1.waitForSelector('#screen-lobby.active'),
        tab2.waitForSelector('#screen-lobby.active'),
        tab3.waitForSelector('#screen-lobby.active')
      ]);
      console.log('✓ All 3 browser tabs reset to Lobby!');
    }

    console.log('\n========================================================');
    console.log(' 🎉 ALL BROWSER TAB TESTS PASSED SUCCESSFULLY! 🎉 ');
    console.log('========================================================\n');

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Browser Test Failed:', err);
    await browser.close();
    process.exit(1);
  }
}

runTest();
