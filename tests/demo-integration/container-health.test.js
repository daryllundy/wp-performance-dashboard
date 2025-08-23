const { execSync } = require('child_process');
const axios = require('axios');
const { beforeAll, afterAll, describe, test, expect, jest } = require('@jest/globals');

describe('Demo Container Health Tests', () => {
  let demoServices;
  const DOCKER_COMPOSE_FILE = 'docker-compose.demo.yml';

  beforeAll(async () => {
    // Start demo environment
    try {
      execSync(`docker-compose -f ${DOCKER_COMPOSE_FILE} up -d`, {
        stdio: 'inherit',
        timeout: 120000 // 2 minutes timeout
      });
      console.log('Demo environment started successfully');
    } catch (error) {
      console.error('Failed to start demo environment:', error);
      throw error;
    }

    // Get service names
    try {
      const result = execSync(`docker-compose -f ${DOCKER_COMPOSE_FILE} ps --services`, {
        encoding: 'utf8'
      });
      demoServices = result.split('\n').filter(service => service.trim());
      console.log('Demo services:', demoServices);
    } catch (error) {
      console.error('Failed to get demo services:', error);
      throw error;
    }
  }, 180000); // 3 minutes timeout for beforeAll

  afterAll(async () => {
    // Clean up demo environment
    try {
      execSync(`docker-compose -f ${DOCKER_COMPOSE_FILE} down -v`, {
        stdio: 'inherit',
        timeout: 60000 // 1 minute timeout
      });
      console.log('Demo environment cleaned up successfully');
    } catch (error) {
      console.error('Failed to clean up demo environment:', error);
    }
  }, 60000); // 1 minute timeout for afterAll

  describe('Container Startup', () => {
    test('All demo services should be running', () => {
      expect(demoServices).toBeDefined();
      expect(demoServices.length).toBeGreaterThan(0);

      demoServices.forEach(service => {
        const result = execSync(`docker-compose -f ${DOCKER_COMPOSE_FILE} ps -q ${service}`, {
          encoding: 'utf8'
        });
        const containerId = result.trim();
        expect(containerId).not.toBe('');

        const inspectResult = JSON.parse(
          execSync(`docker inspect --format='{{json .State.Health}}' ${containerId}`, {
            encoding: 'utf8'
          })
        );

        if (inspectResult.Status) {
          expect(inspectResult.Status).toBe('healthy');
        }
      });
    }, 120000); // 2 minutes timeout
  });

  describe('Service Health Checks', () => {
    const healthCheckUrls = {
      'nginx': 'http://localhost:8080',
      'wordpress': 'http://localhost:8080/wp-admin/install.php',
      'mysql': 'http://localhost:3306', // MySQL doesn't have HTTP health check, will test differently
      'dashboard': 'http://localhost:3000' // Assuming dashboard runs on port 3000
    };

    Object.entries(healthCheckUrls).forEach(([service, url]) => {
      test(`${service} should be healthy`, async () => {
        try {
          if (service === 'mysql') {
            // MySQL health check via docker exec
            const containerName = execSync(
              `docker-compose -f ${DOCKER_COMPOSE_FILE} ps -q ${service}`,
              { encoding: 'utf8' }
            ).trim();

            const result = execSync(
              `docker exec ${containerName} mysqladmin ping --silent`,
              { encoding: 'utf8' }
            );
            expect(result.trim()).toBe('mysqld is alive');
          } else {
            // HTTP health check
            const response = await axios.get(url, { timeout: 10000 });
            expect(response.status).toBe(200);

            // Additional checks for specific services
            if (service === 'wordpress') {
              expect(response.data).toContain('WordPress');
            }
          }
        } catch (error) {
          console.error(`Health check failed for ${service}:`, error.message);
          throw error;
        }
      }, 30000); // 30 seconds timeout per service
    });
  });

  describe('Container Networking', () => {
    test('Services should be able to communicate with each other', async () => {
      // Test WordPress can connect to MySQL
      const wordpressContainer = execSync(
        `docker-compose -f ${DOCKER_COMPOSE_FILE} ps -q wordpress`,
        { encoding: 'utf8' }
      ).trim();

      const mysqlContainer = execSync(
        `docker-compose -f ${DOCKER_COMPOSE_FILE} ps -q mysql`,
        { encoding: 'utf8' }
      ).trim();

      // Test MySQL connection from WordPress container
      const connectionResult = execSync(
        `docker exec ${wordpressContainer} mysql -h mysql -u wordpress_user -pwordpress_password wordpress_db -e "SELECT 1"`,
        { encoding: 'utf8' }
      );
      expect(connectionResult.trim()).not.toBe('');
    }, 30000);
  });

  describe('Resource Usage', () => {
    test('Containers should not be using excessive resources', () => {
      demoServices.forEach(service => {
        const stats = JSON.parse(
          execSync(`docker stats ${service} --no-stream --format '{{.CPUPerc}} {{.MemUsage}}'`, {
            encoding: 'utf8'
          })
        );

        const cpuPercent = parseFloat(stats.split(' ')[0].replace('%', ''));
        const memUsage = stats.split(' ')[1];

        // CPU should be under 50% for idle demo environment
        expect(cpuPercent).toBeLessThan(50);

        // Memory usage should be reasonable (less than 1GB for demo)
        const memParts = memUsage.split('/');
        const memUsed = parseFloat(memParts[0].replace(/[^0-9.]/g, ''));
        expect(memUsed).toBeLessThan(1); // in GB
      });
    }, 30000);
  });
});
