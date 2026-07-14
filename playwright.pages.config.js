const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/pages',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173/GhP-WebEditor/',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run build:pages && BASE_PATH=/GhP-WebEditor/ npm run serve:pages',
    url: 'http://127.0.0.1:4173/GhP-WebEditor/',
    reuseExistingServer: false,
    timeout: 120_000
  },
  reporter: [['list']]
});
