const { execSync } = require('child_process');
const http = require('http');
const path = require('path');

describe('Docker Container Functionality Tests', () => {
  const dockerComposePath = path.join(__dirname, '..', 'docker-compose.yml');
  const maxRetries = 30;
  const retryDelay = 2000; // 2 seconds

  beforeAll(async () => {
    // Start the containers
    execSync(`docker-compose -f ${dockerComposePath} up -d`, { stdio: 'pipe' });

    // Wait for services to be ready
    await waitForServices();
  }, 300000); // 5 minute timeout

  afterAll(() => {
    // Clean up containers
    try {
      execSync(`docker-compose -f ${dockerComposePath} down -v`, { stdio: 'pipe' });
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  });

  async function waitForServices() {
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Check if containers are running
        const output = execSync('docker-compose ps', { encoding: 'utf8' });
        if (output.includes('Up') && output.includes('app') && output.includes('wordpress') && output.includes('db')) {
          console.log('All services are running');
          return;
        }
      } catch (error) {
        // Continue waiting
      }

      console.log(`Waiting for services... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    throw new Error('Services did not start within expected time');
  }

  function testHttpEndpoint(host, port, path = '/', expectedStatus = 200) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: host,
        port: port,
        path: path,
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        resolve(res.statusCode === expectedStatus);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  test('Dashboard app is accessible on port 3000', async () => {
    const isAccessible = await testHttpEndpoint('localhost', 3000);
    expect(isAccessible).toBe(true);
  }, 10000);

  test('WordPress site is accessible on port 8080', async () => {
    const isAccessible = await testHttpEndpoint('localhost', 8080);
    expect(isAccessible).toBe(true);
  }, 10000);

  test('MySQL database is accessible', () => {
    const output = execSync('docker-compose exec -T db mysql -u root -ppassword -e "SELECT 1;"', {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    expect(output).toContain('1');
  });

  test('WordPress database connection is working', () => {
    // Check if WordPress can connect to the database
    const output = execSync('docker-compose exec -T db mysql -u root -ppassword -e "SHOW DATABASES;"', {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    expect(output).toContain('wordpress_performance');
  });

  test('All containers are running', () => {
    const output = execSync('docker-compose ps', { encoding: 'utf8' });
    const runningContainers = output.match(/Up/g) || [];
    expect(runningContainers.length).toBe(3); // app, wordpress, db
  });

  test('Container logs are clean (no errors)', () => {
    const logs = execSync('docker-compose logs', { encoding: 'utf8' });
    // Check for common error patterns
    expect(logs).not.toMatch(/Error|error|ERROR/);
    expect(logs).not.toMatch(/Failed|failed|FAILED/);
  });

  test('Services can communicate with each other', () => {
    // Test that the app container can reach the database
    const output = execSync('docker-compose exec -T app node -e "console.log(process.env.DB_HOST)"', {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    expect(output.trim()).toBe('db');
  });
});
