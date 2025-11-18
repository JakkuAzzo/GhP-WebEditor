const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(3000);
  
  const state = await page.evaluate(() => {
    return {
      hasAppState: typeof window.AppState !== 'undefined',
      hasEditor: window.AppState?.editor !== null,
      appStateKeys: window.AppState ? Object.keys(window.AppState) : [],
      welcomeVisible: document.querySelector('.welcome-screen')?.style.display
    };
  });
  
  console.log('Page state:', JSON.stringify(state, null, 2));
  
  await page.waitForTimeout(5000);
  await browser.close();
})();
