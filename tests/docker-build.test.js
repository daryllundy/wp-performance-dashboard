const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('Docker Container Build Tests', () => {
  const dockerComposePath = path.join(__dirname, '..', 'docker-compose.yml');

  beforeAll(() => {
    // Verify docker-compose.yml exists
    expect(fs.existsSync(dockerComposePath)).toBe(true);
  });

  test('docker-compose.yml is valid', () => {
    expect(() => {
      execSync(`docker-compose -f ${dockerComposePath} config`, { stdio: 'pipe' });
    }).not.toThrow();
  });

  test('Docker Compose services are defined correctly', () => {
    const config = execSync(`docker-compose -f ${dockerComposePath} config`, { encoding: 'utf8' });
    const dockerConfig = require('yaml').parse(config);

    // Check that all required services are present
    expect(dockerConfig.services).toHaveProperty('app');
    expect(dockerConfig.services).toHaveProperty('wordpress');
    expect(dockerConfig.services).toHaveProperty('db');

    // Verify service configurations
    expect(dockerConfig.services.app.ports).toContain('${FREE_PORT}:3000');
    expect(dockerConfig.services.wordpress.ports).toContain('8080:80');
    expect(dockerConfig.services.db.ports).toContain('3306:3306');
  });

  test('Docker images can be pulled', () => {
    // Test pulling required images
    expect(() => {
      execSync('docker pull mysql:8.0', { stdio: 'pipe', timeout: 60000 });
    }).not.toThrow();

    expect(() => {
      execSync('docker pull wordpress:latest', { stdio: 'pipe', timeout: 60000 });
    }).not.toThrow();
  }, 120000); // 2 minute timeout for image pulls

  test('Docker Compose build succeeds', () => {
    expect(() => {
      execSync(`docker-compose -f ${dockerComposePath} build`, {
        stdio: 'pipe',
        timeout: 300000 // 5 minute timeout for build
      });
    }).not.toThrow();
  }, 300000);

  afterAll(() => {
    // Clean up any containers that might be running
    try {
      execSync(`docker-compose -f ${dockerComposePath} down -v`, { stdio: 'pipe' });
    } catch (error) {
      // Ignore cleanup errors in tests
      console.warn('Cleanup warning:', error.message);
    }
  });
});
