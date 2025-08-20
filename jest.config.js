module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    'scripts/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  testTimeout: 300000, // 5 minutes for Docker tests
  setupFilesAfterEnv: [],
  verbose: true,
  forceExit: true, // Exit after tests complete (important for Docker tests)
  detectOpenHandles: true
};
