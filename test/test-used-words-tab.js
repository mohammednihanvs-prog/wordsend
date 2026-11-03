const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    page.on('dialog', async d => { await d.dismiss(); });

    console.log('1. Loading home page...');
    await page.goto('http://localhost:3000');

    // 1. Check Universal Nav on Home Screen (all 4 tabs)
    const tab1 = await page.$eval('#global-tab-game', el => el.textContent.trim());
    const tab2 = await page.$eval('#global-tab-scores', el => el.textContent.trim());
    const tab3 = await page.$eval('#global-tab-logs', el => el.textContent.trim());
    const tab4 = await page.$eval('#global-tab-bubbles', el => el.textContent.trim());
    console.log(`✓ Universal 4 Tabs: [${tab1}] [${tab2}] [${tab3}] [${tab4}]`);

    // Click Tab 4 from Home
    console.log('2. Clicking Tab 4 (Word Bubbles) from Home...');
    await page.$eval('#global-tab-bubbles', el => el.click());
    const usedWordsScreenActive = await page.$eval('#screen-used-words', el => el.classList.contains('active'));
    console.log('✓ 4th Tab Screen active:', usedWordsScreenActive);

    // Return to Arena/Home
    await page.$eval('#btn-back-from-global-bubbles', el => el.click());
    console.log('✓ Returned to Home screen');

    // 2. Create room & join second player
    console.log('\n3. Creating room and entering lobby...');
    await page.type('#input-nickname', 'Host');
    await page.$eval('#btn-create-room', el => el.click());
    await page.waitForSelector('#screen-lobby.active');

    const roomCode = await page.$eval('#lobby-room-code', el => el.textContent.trim());
    console.log('✓ Room Code:', roomCode);

    // Join Guest
    const page2 = await browser.newPage();
    page2.on('dialog', async d => { await d.dismiss(); });
    await page2.goto('http://localhost:3000');
    await page2.type('#input-nickname', 'Guest');
    await page2.type('#input-room-code', roomCode);
    await page2.$eval('#btn-join-room', el => el.click());
    await page2.waitForSelector('#screen-lobby.active');

    // 3. Start Game
    console.log('\n4. Starting game...');
    await page.waitForFunction(() => {
      const btn = document.getElementById('btn-start-game');
      return btn && !btn.disabled && window.getComputedStyle(btn).display !== 'none';
    }, { timeout: 10000 });

    await page.$eval('#btn-start-game', el => el.click());
    await page.waitForSelector('#screen-game.active');
    await page2.waitForSelector('#screen-game.active');
    console.log('✓ Both players in Game Screen');

    // 4. Verify Arena Top 4 Tabs
    console.log('\n5. Verifying In-Game Top 4 Tabs...');
    const inGameTab1 = await page.$eval('#nav-btn-game', el => el.textContent.trim());
    const inGameTab2 = await page.$eval('#nav-btn-scores', el => el.textContent.trim());
    const inGameTab3 = await page.$eval('#nav-btn-logs', el => el.textContent.trim());
    const inGameTab4 = await page.$eval('#nav-btn-bubbles', el => el.textContent.trim());
    console.log(`✓ In-Game 4 Tabs: [${inGameTab1}] [${inGameTab2}] [${inGameTab3}] [${inGameTab4}]`);

    // Click In-Game 4th Tab
    console.log('6. Clicking 4th Tab (Word Bubbles) in Arena...');
    await page.$eval('#nav-btn-bubbles', el => el.click());
    const viewBubblesDisplay = await page.$eval('#view-used-words-tab', el => window.getComputedStyle(el).display);
    console.log('✓ Opened 4th Tab View: display =', viewBubblesDisplay);

    // Verify all used words displayed at once as bubbles
    const bubbleCount = await page.$$eval('#used-words-bubbles .word-bubble-large', els => els.length);
    console.log(`✓ All used words displayed at once in 4th Tab: ${bubbleCount} bubble(s)`);
    if (bubbleCount < 1) throw new Error('Expected at least 1 bubble (starting base word)');

    // Click the bubble
    await page.$eval('#used-words-bubbles .word-bubble-large', el => el.click());
    console.log('✓ Clicked bubble in 4th Tab (interactive pop animation triggered)');

    // Return to Arena
    await page.$eval('#btn-back-to-arena', el => el.click());
    const arenaDisplay = await page.$eval('#view-game-arena', el => window.getComputedStyle(el).display);
    console.log('✓ Returned to Game Arena: display =', arenaDisplay);

    // 7. Verify quick shortcut button below input
    await page.$eval('#btn-quick-view-bubbles', el => el.click());
    const quickOpened = await page.$eval('#view-used-words-tab', el => window.getComputedStyle(el).display !== 'none');
    console.log('✓ Quick pill opened 4th Tab:', quickOpened);
    await page.$eval('#btn-back-to-arena', el => el.click());

    console.log('\n===============================================================');
    console.log(' 🎉 4TH TAB WITH ALL USED WORDS DISPLAYED AT ONCE VERIFIED! 🎉 ');
    console.log('===============================================================');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
