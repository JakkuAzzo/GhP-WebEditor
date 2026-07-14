const fs = require('fs');
const path = require('path');
const os = require('os');
const { createApp } = require('../server');

const fixture = path.join(__dirname, 'fixtures', 'repo');
const clonesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghp-e2e-clones-'));
const app = createApp({
  clonesDir,
  allowedHosts: new Set(['fixture.test']),
  cloneRepository: async (_url, destination) => {
    fs.cpSync(fixture, destination, { recursive: true });
  }
});

const server = app.listen(3000, '127.0.0.1', () => {
  console.log('Deterministic E2E server running at http://127.0.0.1:3000');
});

function shutdown() {
  server.close(() => {
    fs.rmSync(clonesDir, { recursive: true, force: true });
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
