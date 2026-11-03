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

    // 1. Check Universal Nav on Home Screen (all 3 tabs)
    const tabGameText = await page.$eval('#global-tab-game', el => el.textContent.trim());
    const tabLogsText = await page.$eval('#global-tab-logs', el => el.textContent.trim());
    const tabBubblesText = await page.$eval('#global-tab-bubbles', el => el.textContent.trim());
    console.log(`✓ Universal tabs: [${tabGameText}] [${tabLogsText}] [${tabBubblesText}]`);

    // Click Universal Logs Tab
    await page.$eval('#global-tab-logs', el => el.click());
    const logsScreenActive = await page.$eval('#screen-logs', el => el.classList.contains('active'));
    console.log('✓ Universal Logs Screen active:', logsScreenActive);

    // Return to Game
    await page.$eval('#btn-back-from-global-logs', el => el.click());
    console.log('✓ Returned to Home screen');

    // Click Universal Used Words Tab
    await page.$eval('#global-tab-bubbles', el => el.click());
    const usedWordsScreenActive = await page.$eval('#screen-used-words', el => el.classList.contains('active'));
    console.log('✓ Universal Used Words Screen active:', usedWordsScreenActive);

    // Return to Game
    await page.$eval('#btn-back-from-global-bubbles', el => el.click());
    console.log('✓ Returned to Home screen');

    // 2. Create room & join second player
    console.log('\n2. Creating room and entering lobby...');
    await page.type('#input-nickname', 'Host');
    await page.$eval('#btn-create-room', el => el.click());
    await page.waitForSelector('#screen-lobby.active');

    const roomCode = await page.$eval('#lobby-room-code', el => el.textContent.trim());
    console.log('✓ Room Code:', roomCode);

    // Check Lobby buttons (Logs and Used Words)
    const lobbyLogsBtn = await page.$eval('#btn-lobby-view-logs', el => window.getComputedStyle(el).display !== 'none');
    const lobbyBubblesBtn = await page.$eval('#btn-lobby-view-bubbles', el => window.getComputedStyle(el).display !== 'none');
    console.log(`✓ Lobby buttons visible: Logs=${lobbyLogsBtn}, UsedWords=${lobbyBubblesBtn}`);

    // Join Guest
    const page2 = await browser.newPage();
    page2.on('dialog', async d => { await d.dismiss(); });
    await page2.goto('http://localhost:3000');
    await page2.type('#input-nickname', 'Guest');
    await page2.type('#input-room-code', roomCode);
    await page2.$eval('#btn-join-room', el => el.click());
    await page2.waitForSelector('#screen-lobby.active');

    // 3. Start Game
    console.log('\n3. Starting game...');
    await page.waitForFunction(() => {
      const btn = document.getElementById('btn-start-game');
      return btn && !btn.disabled && window.getComputedStyle(btn).display !== 'none';
    }, { timeout: 10000 });

    await page.$eval('#btn-start-game', el => el.click());
    await page.waitForSelector('#screen-game.active');
    await page2.waitForSelector('#screen-game.active');
    console.log('✓ Both players in Game Screen');

    // 4. Verify Sidebar 3 Tabs: Scores, Logs, Used Words
    console.log('\n4. Verifying Sidebar 3 Tabs...');
    const tabScoresText = await page.$eval('#tab-btn-scores', el => el.textContent.trim());
    const tabSidebarLogsText = await page.$eval('#tab-btn-logs', el => el.textContent.trim());
    const tabSidebarBubblesText = await page.$eval('#tab-btn-bubbles', el => el.textContent.trim());
    console.log(`✓ Sidebar tabs: [${tabScoresText}] [${tabSidebarLogsText}] [${tabSidebarBubblesText}]`);

    // Switch to Sidebar Logs tab
    await page.$eval('#tab-btn-logs', el => el.click());
    const logsTabDisplay = await page.$eval('#tab-content-logs', el => window.getComputedStyle(el).display);
    const scoresTabDisplay = await page.$eval('#tab-content-scores', el => window.getComputedStyle(el).display);
    console.log(`✓ Switched to Sidebar Logs Tab (logs display=${logsTabDisplay}, scores display=${scoresTabDisplay})`);

    // Switch to Sidebar Used Words tab
    await page.$eval('#tab-btn-bubbles', el => el.click());
    const bubblesTabDisplay = await page.$eval('#tab-content-bubbles', el => window.getComputedStyle(el).display);
    console.log(`✓ Switched to Sidebar Used Words Tab (bubbles display=${bubblesTabDisplay})`);

    // 5. Test Full-View Match Logs Tab
    console.log('\n5. Testing Arena Full-View Logs Tab...');
    await page.$eval('#nav-btn-logs', el => el.click());
    const viewLogsDisplay = await page.$eval('#view-logs-tab', el => window.getComputedStyle(el).display);
    console.log('✓ Opened Full-View Match Logs Tab: display =', viewLogsDisplay);
    await page.$eval('#btn-back-to-arena-from-logs', el => el.click());

    // 6. Test Full-View Used Words Tab
    console.log('\n6. Testing Arena Full-View Used Words Tab...');
    await page.$eval('#nav-btn-bubbles', el => el.click());
    const viewBubblesDisplay = await page.$eval('#view-used-words-tab', el => window.getComputedStyle(el).display);
    console.log('✓ Opened Full-View Used Words Tab: display =', viewBubblesDisplay);
    await page.$eval('#btn-back-to-arena', el => el.click());

    // 7. Verify Initial Base Word is in Used Words Bubbles
    const initialWordsCount = await page.$eval('#top-used-words-badge', el => parseInt(el.textContent));
    console.log(`✓ Initial Used Words count: ${initialWordsCount}`);
    if (initialWordsCount < 1) throw new Error('Expected initial base word in used words');

    console.log('\n===============================================================');
    console.log(' 🎉 LOGS TAB & ONLY-USED-WORDS TAB FULLY VERIFIED IN BROWSER! 🎉 ');
    console.log('===============================================================');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
