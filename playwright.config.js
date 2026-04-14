const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    headless: true
  },
  webServer: {
    command: 'node tests/browser/mock-server.js',
    url: 'http://127.0.0.1:3100/health',
    reuseExistingServer: true,
    timeout: 30000
  }
});
