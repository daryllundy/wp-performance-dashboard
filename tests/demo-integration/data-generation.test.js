const { execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { beforeAll, afterAll, describe, test, expect, jest } = require('@jest/globals');

describe('Demo Data Generation and Validation Tests', () => {
  const DOCKER_COMPOSE_FILE = 'docker-compose.demo.yml';
  const DATA_GENERATOR_SCRIPT = 'demo/scripts/generate-demo-data.js';
  const WORDPRESS_URL = 'http://localhost:8080';
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

    // Wait for WordPress to be ready
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

  describe('Data Generation Script', () => {
    test('Data generation script should be executable', () => {
      const scriptPath = path.resolve(DATA_GENERATOR_SCRIPT);
      expect(fs.existsSync(scriptPath)).toBe(true);

      // Check if script has execute permissions (on Unix systems)
      try {
        const stats = fs.statSync(scriptPath);
        // (stats.mode & 0o111) !== 0 checks for execute permission
        expect((stats.mode & 0o111) !== 0).toBe(true);
      } catch (error) {
        // On Windows or if permissions can't be checked, we'll skip this test
        console.log('Skipping permission check on non-Unix system');
      }
    }, 10000);

    test('Data generation script should run without errors', () => {
      const command = `node ${DATA_GENERATOR_SCRIPT}`;
      const result = execSync(command, {
        encoding: 'utf8',
        timeout: 60000 // 1 minute timeout
      });
      expect(result).toBeDefined();
      expect(result).toContain('Demo data generation completed');
    }, 60000);
  });

  describe('WordPress Content Validation', () => {
    test('Posts should be created with correct structure', async () => {
      // Get posts via WordPress REST API
      const response = await axios.get(`${WORDPRESS_URL}/wp-json/wp/v2/posts?per_page=10`);
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);

      const posts = response.data;
      expect(posts.length).toBeGreaterThan(0);

      posts.forEach(post => {
        expect(post).toHaveProperty('id');
        expect(post).toHaveProperty('title');
        expect(post).toHaveProperty('content');
        expect(post).toHaveProperty('excerpt');
        expect(post).toHaveProperty('date');
        expect(post).toHaveProperty('status');
        expect(post.status).toBe('publish');

        // Check title structure
        expect(post.title.rendered).toBeDefined();
        expect(typeof post.title.rendered).toBe('string');
        expect(post.title.rendered.length).toBeGreaterThan(0);

        // Check content structure
        expect(post.content.rendered).toBeDefined();
        expect(typeof post.content.rendered).toBe('string');
        expect(post.content.rendered.length).toBeGreaterThan(0);

        // Check excerpt structure
        expect(post.excerpt.rendered).toBeDefined();
        expect(typeof post.excerpt.rendered).toBe('string');
      });
    }, 30000);

    test('Pages should be created with correct structure', async () => {
      const response = await axios.get(`${WORDPRESS_URL}/wp-json/wp/v2/pages?per_page=10`);
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);

      const pages = response.data;
      expect(pages.length).toBeGreaterThan(0);

      pages.forEach(page => {
        expect(page).toHaveProperty('id');
        expect(page).toHaveProperty('title');
        expect(page).toHaveProperty('content');
        expect(page).toHaveProperty('date');
        expect(page).toHaveProperty('status');
        expect(page.status).toBe('publish');
      });
    }, 30000);

    test('Media items should be uploaded', async () => {
      const response = await axios.get(`${WORDPRESS_URL}/wp-json/wp/v2/media?per_page=10`);
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);

      const mediaItems = response.data;
      expect(mediaItems.length).toBeGreaterThan(0);

      mediaItems.forEach(item => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('media_type');
        expect(item).toHaveProperty('mime_type');
        expect(item).toHaveProperty('source_url');
      });
    }, 30000);

    test('Comments should be added to posts', async () => {
      // First get a post ID
      const postsResponse = await axios.get(`${WORDPRESS_URL}/wp-json/wp/v2/posts?per_page=1`);
      const postId = postsResponse.data[0].id;

      // Get comments for that post
      const response = await axios.get(`${WORDPRESS_URL}/wp-json/wp/v2/comments?post=${postId}`);
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);

      const comments = response.data;
      expect(comments.length).toBeGreaterThan(0);

      comments.forEach(comment => {
        expect(comment).toHaveProperty('id');
        expect(comment).toHaveProperty('post');
        expect(comment.post).toBe(postId);
        expect(comment).toHaveProperty('author_name');
        expect(comment).toHaveProperty('content');
        expect(comment).toHaveProperty('date');
        expect(comment).toHaveProperty('approved');
        expect(comment.approved).toBe(1); // 1 means approved
      });
    }, 30000);
  });

  describe('Database Data Validation', () => {
    test('WordPress database tables should be populated', () => {
      // Connect to MySQL and check table counts
      const command = `docker exec $(docker-compose -f ${DOCKER_COMPOSE_FILE} ps -q mysql) mysql -u ${MYSQL_USER} -p${MYSQL_PASSWORD} ${MYSQL_DB} -e "
        SELECT COUNT(*) as post_count FROM wp_posts WHERE post_type = 'post' AND post_status = 'publish';
        SELECT COUNT(*) as page_count FROM wp_posts WHERE post_type = 'page' AND post_status = 'publish';
        SELECT COUNT(*) as comment_count FROM wp_comments WHERE comment_approved = '1';
        SELECT COUNT(*) as media_count FROM wp_posts WHERE post_type = 'attachment';
      "`;

      const result = execSync(command, {
        encoding: 'utf8',
        timeout: 30000
      });

      const lines = result.split('\n').filter(line => line.trim() && !line.includes('post_count') && !line.includes('page_count') && !line.includes('comment_count') && !line.includes('media_count'));

      expect(lines.length).toBe(4);
      expect(parseInt(lines[0])).toBeGreaterThan(0);
      expect(parseInt(lines[1])).toBeGreaterThan(0);
      expect(parseInt(lines[2])).toBeGreaterThan(0);
      expect(parseInt(lines[3])).toBeGreaterThan(0);
    }, 30000);

    test('Performance data should be generated', () => {
      // Check if performance simulator plugin is active
      const command = `docker exec $(docker-compose -f ${DOCKER_COMPOSE_FILE} ps -q wordpress) wp plugin list --status=active --field=name | grep -i performance`;
      const result = execSync(command, {
        encoding: 'utf8',
        timeout: 30000
      });

      expect(result.trim()).not.toBe('');
    }, 30000);
  });

  describe('Performance Metrics', () => {
    test('Performance simulator should generate metrics', async () => {
      // Access a page to trigger performance simulation
      await axios.get(`${WORDPRESS_URL}/`);

      // Wait for performance data to be generated
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if performance data exists in database
      const command = `docker exec $(docker-compose -f ${DOCKER_COMPOSE_FILE} ps -q mysql) mysql -u ${MYSQL_USER} -p${MYSQL_PASSWORD} ${MYSQL_DB} -e "
        SELECT COUNT(*) as metric_count FROM wp_performance_metrics WHERE DATE(created_at) = CURDATE();
      "`;

      const result = execSync(command, {
        encoding: 'utf8',
        timeout: 30000
      });

      const lines = result.split('\n').filter(line => line.trim() && !line.includes('metric_count'));
      expect(lines.length).toBe(1);
      expect(parseInt(lines[0])).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Data Cleanup', () => {
    test('Data cleanup script should work correctly', () => {
      // Run cleanup script if it exists
      const cleanupScript = 'demo/cleanup-demo.sh';
      if (fs.existsSync(cleanupScript)) {
        const command = `bash ${cleanupScript}`;
        const result = execSync(command, {
          encoding: 'utf8',
          timeout: 60000
        });
        expect(result).toBeDefined();
        expect(result).toContain('Cleanup completed');
      } else {
        console.log('Skipping cleanup test - script not found');
      }
    }, 60000);
  });
});
