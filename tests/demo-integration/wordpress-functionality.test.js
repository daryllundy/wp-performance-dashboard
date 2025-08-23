const { execSync } = require('child_process');
const axios = require('axios');
const { beforeAll, afterAll, describe, test, expect, jest } = require('@jest/globals');

describe('WordPress Functionality Tests with Demo Content', () => {
  const DOCKER_COMPOSE_FILE = 'docker-compose.demo.yml';
  const WORDPRESS_URL = 'http://localhost:8080';
  const ADMIN_USERNAME = 'admin';
  const ADMIN_PASSWORD = 'password'; // This should match your demo setup

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

  describe('WordPress Installation', () => {
    test('WordPress should be accessible', async () => {
      const response = await axios.get(WORDPRESS_URL);
      expect(response.status).toBe(200);
      expect(response.data).toContain('WordPress');
    }, 10000);

    test('WordPress login should be accessible', async () => {
      const response = await axios.get(`${WORDPRESS_URL}/wp-login.php`);
      expect(response.status).toBe(200);
      expect(response.data).toContain('WordPress');
      expect(response.data).toContain('Log In');
    }, 10000);
  });

  describe('Content Management', () => {
    let authToken;
    let postId;

    beforeAll(async () => {
      // Get authentication token
      const loginResponse = await axios.post(`${WORDPRESS_URL}/wp-json/jwt-auth/v1/token`, {
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD
      });
      authToken = loginResponse.data.token;
    }, 10000);

    test('Create a new post via REST API', async () => {
      const newPost = {
        title: 'Test Post via API',
        content: 'This is a test post created via the REST API.',
        status: 'publish'
      };

      const response = await axios.post(
        `${WORDPRESS_URL}/wp-json/wp/v2/posts`,
        newPost,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.title.rendered).toBe('Test Post via API');
      expect(response.data.content.rendered).toBe('This is a test post created via the REST API.');
      postId = response.data.id;
    }, 20000);

    test('Update an existing post via REST API', async () => {
      const updatedPost = {
        title: 'Updated Test Post via API',
        content: 'This post has been updated via the REST API.',
        status: 'publish'
      };

      const response = await axios.post(
        `${WORDPRESS_URL}/wp-json/wp/v2/posts/${postId}`,
        updatedPost,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.title.rendered).toBe('Updated Test Post via API');
      expect(response.data.content.rendered).toBe('This post has been updated via the REST API.');
    }, 20000);

    test('Delete a post via REST API', async () => {
      const response = await axios.delete(
        `${WORDPRESS_URL}/wp-json/wp/v2/posts/${postId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('deleted', true);
    }, 20000);
  });

  describe('Theme Functionality', () => {
    test('Active theme should be accessible', async () => {
      const response = await axios.get(`${WORDPRESS_URL}/wp-json/wp/v2/themes`);
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);

      const activeTheme = response.data.find(theme => theme.status === 'active');
      expect(activeTheme).toBeDefined();
      expect(activeTheme).toHaveProperty('name');
      expect(activeTheme).toHaveProperty('stylesheet');
    }, 10000);

    test('Theme templates should be accessible', async () => {
      // Get a page to test theme rendering
      const response = await axios.get(`${WORDPRESS_URL}/`);
      expect(response.status).toBe(200);
      expect(response.data).toContain('<!DOCTYPE html>');
      expect(response.data).toContain('<html');
    }, 10000);
  });

  describe('Plugin Functionality', () => {
    test('Performance simulator plugin should be active', async () => {
      const command = `docker exec $(docker-compose -f ${DOCKER_COMPOSE_FILE} ps -q wordpress) wp plugin list --status=active --field=name --path=/var/www/html`;
      const result = execSync(command, {
        encoding: 'utf8',
        timeout: 30000
      });

      expect(result.trim()).toContain('performance-simulator');
    }, 30000);

    test('Performance simulator should generate metrics', async () => {
      // Access a page to trigger performance simulation
      await axios.get(`${WORDPRESS_URL}/`);

      // Wait for performance data to be generated
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if performance data exists in database
      const command = `docker exec $(docker-compose -f ${DOCKER_COMPOSE_FILE} ps -q mysql) mysql -u wordpress_user -pwordpress_password wordpress_db -e "
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

  describe('User Management', () => {
    let authToken;
    let userId;

    beforeAll(async () => {
      // Get authentication token
      const loginResponse = await axios.post(`${WORDPRESS_URL}/wp-json/jwt-auth/v1/token`, {
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD
      });
      authToken = loginResponse.data.token;
    }, 10000);

    test('Create a new user via REST API', async () => {
      const newUser = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        role: 'editor'
      };

      const response = await axios.post(
        `${WORDPRESS_URL}/wp-json/wp/v2/users`,
        newUser,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.username).toBe('testuser');
      expect(response.data.email).toBe('test@example.com');
      userId = response.data.id;
    }, 20000);

    test('Update user role via REST API', async () => {
      const updatedUser = {
        role: 'author'
      };

      const response = await axios.post(
        `${WORDPRESS_URL}/wp-json/wp/v2/users/${userId}`,
        updatedUser,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.roles).toContain('author');
    }, 20000);

    test('Delete a user via REST API', async () => {
      const response = await axios.delete(
        `${WORDPRESS_URL}/wp-json/wp/v2/users/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('deleted', true);
    }, 20000);
  });

  describe('Media Management', () => {
    let authToken;
    let attachmentId;

    beforeAll(async () => {
      // Get authentication token
      const loginResponse = await axios.post(`${WORDPRESS_URL}/wp-json/jwt-auth/v1/token`, {
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD
      });
      authToken = loginResponse.data.token;
    }, 10000);

    test('Upload media via REST API', async () => {
      // Create a dummy image file for testing
      const imageData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

      const formData = new FormData();
      formData.append('file', new Blob([imageData], { type: 'image/png' }), 'test-image.png');
      formData.append('title', 'Test Image');
      formData.append('caption', 'This is a test image uploaded via API');

      const response = await axios.post(
        `${WORDPRESS_URL}/wp-json/wp/v2/media`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.title.rendered).toBe('Test Image');
      attachmentId = response.data.id;
    }, 30000);

    test('Update media via REST API', async () => {
      const updatedMedia = {
        title: 'Updated Test Image',
        caption: 'This image has been updated via API'
      };

      const response = await axios.post(
        `${WORDPRESS_URL}/wp-json/wp/v2/media/${attachmentId}`,
        updatedMedia,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.title.rendered).toBe('Updated Test Image');
    }, 20000);

    test('Delete media via REST API', async () => {
      const response = await axios.delete(
        `${WORDPRESS_URL}/wp-json/wp/v2/media/${attachmentId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('deleted', true);
    }, 20000);
  });

  describe('Comment Functionality', () => {
    let authToken;
    let postId;
    let commentId;

    beforeAll(async () => {
      // Get authentication token
      const loginResponse = await axios.post(`${WORDPRESS_URL}/wp-json/jwt-auth/v1/token`, {
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD
      });
      authToken = loginResponse.data.token;

      // Create a post to comment on
      const newPost = {
        title: 'Test Post for Comments',
        content: 'This is a test post for comment functionality.',
        status: 'publish'
      };

      const postResponse = await axios.post(
        `${WORDPRESS_URL}/wp-json/wp/v2/posts`,
        newPost,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );
      postId = postResponse.data.id;
    }, 20000);

    test('Create a comment via REST API', async () => {
      const newComment = {
        post: postId,
        author_name: 'Test Commenter',
        content: 'This is a test comment.',
        status: 'approved'
      };

      const response = await axios.post(
        `${WORDPRESS_URL}/wp-json/wp/v2/comments`,
        newComment,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.author_name).toBe('Test Commenter');
      expect(response.data.content.rendered).toBe('This is a test comment.');
      commentId = response.data.id;
    }, 20000);

    test('Update a comment via REST API', async () => {
      const updatedComment = {
        content: 'This comment has been updated via API.'
      };

      const response = await axios.post(
        `${WORDPRESS_URL}/wp-json/wp/v2/comments/${commentId}`,
        updatedComment,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.content.rendered).toBe('This comment has been updated via API.');
    }, 20000);

    test('Delete a comment via REST API', async () => {
      const response = await axios.delete(
        `${WORDPRESS_URL}/wp-json/wp/v2/comments/${commentId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('deleted', true);
    }, 20000);
  });

  describe('Search Functionality', () => {
    test('Search should return relevant results', async () => {
      // First create a post with searchable content
      const newPost = {
        title: 'Searchable Test Post',
        content: 'This post contains searchable content for testing the search functionality.',
        status: 'publish'
      };

      const postResponse = await axios.post(`${WORDPRESS_URL}/wp-json/wp/v2/posts`, newPost);
      const postId = postResponse.data.id;

      // Wait for post to be indexed
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Perform search
      const searchResponse = await axios.get(`${WORDPRESS_URL}/wp-json/wp/v2/search?search=searchable&per_page=10`);
      expect(searchResponse.status).toBe(200);
      expect(searchResponse.data).toBeDefined();
      expect(Array.isArray(searchResponse.data)).toBe(true);

      const searchResults = searchResponse.data;
      const foundPost = searchResults.find(result => result.id === postId);
      expect(foundPost).toBeDefined();
      expect(foundPost.title).toBe('Searchable Test Post');
    }, 30000);
  });

  describe('Performance Under Load', () => {
    test('WordPress should handle multiple requests', async () => {
      const requests = Array(10).fill().map(() => axios.get(`${WORDPRESS_URL}/`));
      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    }, 30000);
  });
});
