const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('Docker Container Build Tests', () => {
  const dockerComposePath = path.join(__dirname, '..', 'docker-compose.full.yml');

  beforeAll(() => {
    // Verify docker-compose.full.yml exists
    expect(fs.existsSync(dockerComposePath)).toBe(true);
  });

  test('docker-compose.full.yml is valid', () => {
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
    expect(dockerConfig.services.app.ports).toBeDefined();
    expect(dockerConfig.services.wordpress.ports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          published: "8080",
          target: 80
        })
      ])
    );
    expect(dockerConfig.services.db.ports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          published: "3306",
          target: 3306
        })
      ])
    );

    // Verify app service port mapping (should use FREE_PORT or default to 3000)
    const appPort = dockerConfig.services.app.ports[0];
    expect(appPort.target).toBe(3000);
    expect(appPort.published).toMatch(/^(3000|\$\{FREE_PORT\}|\d+)$/);
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
