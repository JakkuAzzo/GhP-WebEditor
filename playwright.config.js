const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './demo',
  testMatch: ['tests.spec.js', 'github.spec.js', 'preview-assets.spec.js', 'visual-editor.spec.js', 'export.spec.js'],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'node test/e2e-server.js',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: false,
    timeout: 30_000
  }
});
