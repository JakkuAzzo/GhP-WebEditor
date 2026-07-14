const { app, BrowserWindow, shell } = require('electron');
const { startServer } = require('./server');

let localServer;
let appUrl;

async function ensureServer() {
  if (localServer) return appUrl;
  localServer = startServer(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    localServer.once('listening', resolve);
    localServer.once('error', reject);
  });
  appUrl = `http://127.0.0.1:${localServer.address().port}`;
  return appUrl;
}

async function createWindow() {
  const localUrl = await ensureServer();
  const localOrigin = new URL(localUrl).origin;
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') && process.env.ELECTRON_DISABLE_EXTERNAL_OPEN !== '1') {
      shell.openExternal(url).catch(error => console.error('Unable to open external link:', error.message));
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    let target;
    try {
      target = new URL(targetUrl);
    } catch {
      event.preventDefault();
      return;
    }
    if (target.origin === localOrigin || (target.protocol === 'https:' && target.hostname === 'github.com')) return;
    event.preventDefault();
    if (target.protocol === 'https:' && process.env.ELECTRON_DISABLE_EXTERNAL_OPEN !== '1') {
      shell.openExternal(targetUrl).catch(error => console.error('Unable to open external link:', error.message));
    }
  });

  await mainWindow.loadURL(localUrl);
  if (process.env.ELECTRON_OPEN_DEVTOOLS === '1') mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  localServer?.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
