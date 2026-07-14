const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/electron',
  timeout: 30_000,
  reporter: 'list'
});
