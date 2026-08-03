const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let localServer;

function startLocalServer() {
  return new Promise((resolve, reject) => {
    localServer = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
      env: { ...process.env, AUTH_REQUIRED: 'false', PORT: '0', NODE_ENV: 'development' },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    const onOutput = chunk => {
      output += chunk.toString();
      const match = output.match(/Buildy running at http:\/\/localhost:(\d+)/);
      if (match) resolve(`http://localhost:${match[1]}`);
    };
    localServer.stdout.on('data', onOutput);
    localServer.stderr.on('data', chunk => {
      output += chunk.toString();
      if (output.includes('EADDRINUSE')) reject(new Error('Buildy could not start its local server.'));
    });
    localServer.once('error', reject);
    localServer.once('exit', code => {
      if (code && !output.match(/Buildy running at/)) reject(new Error(`Buildy local server exited (${code}).`));
    });
  });
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  try {
    const localUrl = await startLocalServer();
    await mainWindow.loadURL(localUrl);
  } catch (error) {
    console.error(error);
    await mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));
  }
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (localServer) localServer.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (localServer) localServer.kill();
});
