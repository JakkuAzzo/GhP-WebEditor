const { test, expect, _electron: electron } = require('@playwright/test');

test('Electron starts the local server and loads the sandboxed application', async () => {
  const electronApp = await electron.launch({
    args: ['.'],
    env: { ...process.env, ELECTRON_DISABLE_EXTERNAL_OPEN: '1' }
  });
  try {
    const window = await electronApp.firstWindow();
    await expect(window.locator('h1')).toContainText('GitHub Pages Web Editor');
    expect(await window.evaluate(() => typeof window.require)).toBe('undefined');
    await expect(window.locator('#previewFrame')).toHaveAttribute('sandbox', 'allow-scripts');
    expect(await electronApp.evaluate(({ BrowserWindow }) => {
      const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
      return {
        contextIsolation: preferences.contextIsolation,
        nodeIntegration: preferences.nodeIntegration,
        sandbox: preferences.sandbox
      };
    })).toEqual({ contextIsolation: true, nodeIntegration: false, sandbox: true });
  } finally {
    await electronApp.close();
  }
});
