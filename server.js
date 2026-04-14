require('dotenv').config();
const { createApp } = require('./src/server/app');

const runtime = createApp();

runtime.start().then(() => {
  console.log(`WordPress Performance Dashboard running on port ${runtime.config.port}`);
  console.log(`Dashboard available at: http://localhost:${runtime.config.port}`);
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = runtime;
