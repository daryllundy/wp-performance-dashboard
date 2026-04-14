module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/server/**/*.test.js',
    '<rootDir>/tests/client/**/*.test.js'
  ],
  testTimeout: 30000,
  verbose: true,
  detectOpenHandles: true
};
