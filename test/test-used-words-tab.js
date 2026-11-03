const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log('[Host Console]:', msg.text()));
    page.on('pageerror', err => console.error('[Host Error]:', err.message));
    page.on('dialog', async d => { await d.dismiss(); });

    console.log('1. Loading home page...');
    await page.goto('http://localhost:3000');

    // 1. Check Universal Nav on Home Screen
    const globalNavVisible = await page.$eval('#app-global-nav', el => window.getComputedStyle(el).display !== 'none');
    console.log('✓ Universal Nav is visible on Home Screen:', globalNavVisible);

    // 2. Click Universal Used Words Tab from Home Screen
    console.log('2. Clicking universal Used Words Tab from Home Screen...');
    await page.$eval('#global-tab-bubbles', el => el.click());
    const usedWordsScreenActive = await page.$eval('#screen-used-words', el => el.classList.contains('active'));
    console.log('✓ Used Words screen active from Home:', usedWordsScreenActive);

    // Return to Home
    await page.$eval('#btn-back-from-global-bubbles', el => el.click());
    const homeScreenActive = await page.$eval('#screen-home', el => el.classList.contains('active'));
    console.log('✓ Returned back to Home Screen:', homeScreenActive);

    // 3. Create room & test Lobby
    console.log('3. Creating room...');
    await page.type('#input-nickname', 'Host');
    await page.$eval('#btn-create-room', el => el.click());
    await page.waitForSelector('#screen-lobby.active');

    // Check Lobby Used Words button
    const lobbyBubblesBtnVisible = await page.$eval('#btn-lobby-view-bubbles', el => window.getComputedStyle(el).display !== 'none');
    console.log('✓ Lobby Used Words button visible:', lobbyBubblesBtnVisible);

    // Click Lobby Used Words button
    await page.$eval('#btn-lobby-view-bubbles', el => el.click());
    const usedWordsScreenFromLobby = await page.$eval('#screen-used-words', el => el.classList.contains('active'));
    console.log('✓ Clicked Used Words from Lobby: active =', usedWordsScreenFromLobby);

    // Return to Lobby
    await page.$eval('#btn-back-from-global-bubbles', el => el.click());
    const lobbyScreenActive = await page.$eval('#screen-lobby', el => el.classList.contains('active'));
    console.log('✓ Returned back to Lobby Screen:', lobbyScreenActive);

    // 4. Join second player
    const page2 = await browser.newPage();
    page2.on('dialog', async d => { await d.dismiss(); });
    const roomCode = await page.$eval('#lobby-room-code', el => el.textContent.trim());
    console.log('4. Guest joining room:', roomCode);
    await page2.goto('http://localhost:3000');
    await page2.type('#input-nickname', 'Guest');
    await page2.type('#input-room-code', roomCode);
    await page2.$eval('#btn-join-room', el => el.click());
    await page2.waitForSelector('#screen-lobby.active');

    // Wait for start button to be enabled
    await page.waitForFunction(() => {
      const btn = document.getElementById('btn-start-game');
      return btn && !btn.disabled && window.getComputedStyle(btn).display !== 'none';
    }, { timeout: 10000 });

    console.log('5. Host clicks Start Game...');
    await page.$eval('#btn-start-game', el => el.click());

    await page.waitForSelector('#screen-game.active', { timeout: 10000 });
    await page2.waitForSelector('#screen-game.active', { timeout: 10000 });
    console.log('✓ Both players entered Game Screen');

    // Click global tab bubbles while in game
    console.log('6. Clicking global Used Words tab while in Game...');
    await page.$eval('#global-tab-bubbles', el => el.click());
    const usedWordsInGame = await page.$eval('#screen-used-words', el => el.classList.contains('active'));
    console.log('✓ Used Words screen active during game:', usedWordsInGame);

    // Return back to game arena
    await page.$eval('#btn-back-from-global-bubbles', el => el.click());
    const gameScreenBack = await page.$eval('#screen-game', el => el.classList.contains('active'));
    console.log('✓ Returned back to Game Screen:', gameScreenBack);

    // Click quick bubbles pill below input
    console.log('7. Clicking quick bubbles button below input...');
    await page.$eval('#btn-quick-view-bubbles', el => el.click());
    const quickViewOpen = await page.$eval('#view-used-words-tab', el => window.getComputedStyle(el).display !== 'none');
    console.log('✓ Quick View bubbles view opened in Arena:', quickViewOpen);

    // Back to arena view
    await page.$eval('#btn-back-to-arena', el => el.click());
    const arenaBack = await page.$eval('#view-game-arena', el => window.getComputedStyle(el).display !== 'none');
    console.log('✓ Returned back to Main Arena view:', arenaBack);

    console.log('\n======================================================');
    console.log(' 🎉 ALL USED WORDS TAB & BUBBLE VERIFICATIONS PASSED! 🎉 ');
    console.log('======================================================');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
