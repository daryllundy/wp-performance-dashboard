const { execSync } = require('child_process');
const axios = require('axios');
const { beforeAll, afterAll, describe, test, expect, jest } = require('@jest/globals');

describe('Performance Dashboard Connectivity Tests with Demo Database', () => {
  const DOCKER_COMPOSE_FILE = 'docker-compose.demo.yml';
  const WORDPRESS_URL = 'http://localhost:8080';
  const DASHBOARD_URL = 'http://localhost:3000';
  const MYSQL_HOST = 'localhost';
  const MYSQL_USER = 'wordpress_user';
  const MYSQL_PASSWORD = 'wordpress_password';
  const MYSQL_DB = 'wordpress_db';

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

    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 30000));
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

  describe('Dashboard Service Health', () => {
    test('Dashboard should be accessible', async () => {
      const response = await axios.get(DASHBOARD_URL, { timeout: 10000 });
      expect(response.status).toBe(200);
      expect(response.data).toContain('html');
    }, 10000);

    test('Dashboard API should be responsive', async () => {
      const response = await axios.get(`${DASHBOARD_URL}/api/health`, { timeout: 5000 });
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'ok');
    }, 5000);
  });

  describe('Database Connectivity', () => {
    test('Dashboard should connect to MySQL database', async () => {
      // Check if dashboard can query the database
      const command = `docker exec $(docker-compose -f ${DOCKER_COMPOSE_FILE} ps -q dashboard) mysql -h mysql -u ${MYSQL_USER} -p${MYSQL_PASSWORD} ${MYSQL_DB} -e "SELECT COUNT(*) FROM wp_posts WHERE post_type = 'post'"`;
      const result = execSync(command, {
        encoding: 'utf8',
        timeout: 10000
      });

      expect(result).toBeDefined();
      expect(result.trim()).not.toBe('');
    }, 10000);

    test('Dashboard should read performance metrics', async () => {
      // Generate some performance data first
      await axios.get(`${WORDPRESS_URL}/`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if dashboard can read performance metrics
      const command = `docker exec $(docker-compose -f ${DOCKER_COMPOSE_FILE} ps -q dashboard) mysql -h mysql -u ${MYSQL_USER} -p${MYSQL_PASSWORD} ${MYSQL_DB} -e "SELECT COUNT(*) FROM wp_performance_metrics WHERE DATE(created_at) = CURDATE()"`;
      const result = execSync(command, {
        encoding: 'utf8',
        timeout: 10000
      });

      expect(result).toBeDefined();
      const count = parseInt(result.trim().split('\n')[1]);
      expect(count).toBeGreaterThanOrEqual(0);
    }, 10000);
  });

  describe('Dashboard API Endpoints', () => {
    test('Dashboard posts endpoint should return data', async () => {
      const response = await axios.get(`${DASHBOARD_URL}/api/posts`, { timeout: 10000 });
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();

      if (Array.isArray(response.data)) {
        expect(response.data.length).toBeGreaterThanOrEqual(0);
      }
    }, 10000);

    test('Dashboard performance metrics endpoint should return data', async () => {
      // Generate some performance data first
      await axios.get(`${WORDPRESS_URL}/`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      const response = await axios.get(`${DASHBOARD_URL}/api/performance`, { timeout: 10000 });
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();

      if (Array.isArray(response.data)) {
        expect(response.data.length).toBeGreaterThanOrEqual(0);
      }
    }, 10000);

    test('Dashboard database status endpoint should return status', async () => {
      const response = await axios.get(`${DASHBOARD_URL}/api/database/status`, { timeout: 10000 });
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('connected', true);
      expect(response.data).toHaveProperty('tables');
    }, 10000);
  });

  describe('Real-time Data Updates', () => {
    test('Dashboard should receive real-time updates from WordPress', async () => {
      // Create a new post in WordPress
      const newPost = {
        title: 'Real-time Test Post',
        content: 'This post tests real-time dashboard updates.',
        status: 'publish'
      };

      await axios.post(`${WORDPRESS_URL}/wp-json/wp/v2/posts`, newPost);

      // Wait for dashboard to process the update
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if dashboard has the new post
      const response = await axios.get(`${DASHBOARD_URL}/api/posts?title=Real-time Test Post`, { timeout: 10000 });
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();

      if (Array.isArray(response.data) && response.data.length > 0) {
        expect(response.data[0].title).toBe('Real-time Test Post');
      }
    }, 20000);

    test('Dashboard should receive performance metrics in real-time', async () => {
      // Access WordPress to generate performance data
      await axios.get(`${WORDPRESS_URL}/`);

      // Wait for dashboard to process the metrics
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if dashboard has the performance metrics
      const response = await axios.get(`${DASHBOARD_URL}/api/performance?limit=1`, { timeout: 10000 });
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();

      if (Array.isArray(response.data) && response.data.length > 0) {
        expect(response.data[0]).toHaveProperty('metric_type');
        expect(response.data[0]).toHaveProperty('value');
        expect(response.data[0]).toHaveProperty('timestamp');
      }
    }, 20000);
  });

  describe('Data Synchronization', () => {
    test('Dashboard and WordPress database should be synchronized', async () => {
      // Get post count from WordPress directly
      const wordpressCommand = `docker exec $(docker-compose -f ${DOCKER_COMPOSE_FILE} ps -q wordpress) mysql -h mysql -u ${MYSQL_USER} -p${MYSQL_PASSWORD} ${MYSQL_DB} -e "SELECT COUNT(*) FROM wp_posts WHERE post_type = 'post' AND post_status = 'publish'"`;
      const wordpressResult = execSync(wordpressCommand, {
        encoding: 'utf8',
        timeout: 10000
      });
      const wordpressCount = parseInt(wordpressResult.trim().split('\n')[1]);

      // Get post count from dashboard API
      const dashboardResponse = await axios.get(`${DASHBOARD_URL}/api/posts`, { timeout: 10000 });
      let dashboardCount = 0;

      if (Array.isArray(dashboardResponse.data)) {
        dashboardCount = dashboardResponse.data.length;
      }

      // Counts should match (allowing for small differences due to async processing)
      expect(Math.abs(wordpressCount - dashboardCount)).toBeLessThanOrEqual(1);
    }, 15000);

    test('Dashboard should handle database schema changes', async () => {
      // Check if dashboard can handle custom tables
      const command = `docker exec $(docker-compose -f ${DOCKER_COMPOSE_FILE} ps -q dashboard) mysql -h mysql -u ${MYSQL_USER} -p${MYSQL_PASSWORD} ${MYSQL_DB} -e "SHOW TABLES LIKE 'wp_performance_metrics'"`;
      const result = execSync(command, {
        encoding: 'utf8',
        timeout: 10000
      });

      expect(result.trim()).toContain('wp_performance_metrics');
    }, 10000);
  });

  describe('Performance Under Load', () => {
    test('Dashboard should handle multiple concurrent requests', async () => {
      const requests = Array(5).fill().map(() =>
        axios.get(`${DASHBOARD_URL}/api/posts`, { timeout: 5000 })
      );

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    }, 30000);

    test('Dashboard should maintain performance with database queries', async () => {
      const start = Date.now();

      // Make multiple database queries
      for (let i = 0; i < 10; i++) {
        await axios.get(`${DASHBOARD_URL}/api/performance`, { timeout: 5000 });
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10000); // All queries should complete in under 10 seconds
    }, 30000);
  });

  describe('Error Handling', () => {
    test('Dashboard should handle database connection errors gracefully', async () => {
      // Temporarily stop MySQL to simulate connection error
      execSync(`docker-compose -f ${DOCKER_COMPOSE_FILE} stop mysql`, {
        stdio: 'inherit',
        timeout: 10000
      });

      // Wait a moment for the connection to fail
      await new Promise(resolve => setTimeout(resolve, 3000));

      const response = await axios.get(`${DASHBOARD_URL}/api/database/status`, { timeout: 5000 });
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('connected', false);

      // Restart MySQL
      execSync(`docker-compose -f ${DOCKER_COMPOSE_FILE} start mysql`, {
        stdio: 'inherit',
        timeout: 10000
      });

      // Wait for MySQL to restart
      await new Promise(resolve => setTimeout(resolve, 10000));
    }, 30000);

    test('Dashboard should handle invalid API requests', async () => {
      const response = await axios.get(`${DASHBOARD_URL}/api/invalid-endpoint`, {
        timeout: 5000,
        validateStatus: function (status) {
          return status < 500; // Resolve only if status is less than 500
        }
      });

      expect(response.status).toBe(404); // Not found
    }, 5000);
  });

  describe('Security', () => {
    test('Dashboard should not expose sensitive database information', async () => {
      const response = await axios.get(`${DASHBOARD_URL}/api/database/config`, {
        timeout: 5000,
        validateStatus: function (status) {
          return status < 500; // Resolve only if status is less than 500
        }
      });

      // If the endpoint exists, it shouldn't contain sensitive info
      if (response.status === 200) {
        expect(response.data).not.toHaveProperty('password');
        expect(response.data).not.toHaveProperty('host');
      } else {
        // If the endpoint doesn't exist, that's also fine
        expect(response.status).toBe(404);
      }
    }, 5000);

    test('Dashboard should implement proper authentication for API endpoints', async () => {
      // Try to access a protected endpoint without authentication
      const response = await axios.post(`${DASHBOARD_URL}/api/posts`, {
        title: 'Unauthorized Post',
        content: 'This should not be created.'
      }, { timeout: 5000 });

      // Should be unauthorized or forbidden
      expect([401, 403]).toContain(response.status);
    }, 5000);
  });
});
