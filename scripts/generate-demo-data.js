const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'wordpress_performance',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

async function generateDemoData() {
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);

    // Create tables
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        query_type VARCHAR(50),
        avg_execution_time FLOAT,
        total_queries INT,
        slow_queries INT,
        queries_per_second FLOAT,
        avg_response_time FLOAT,
        memory_usage FLOAT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS slow_queries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        query_text TEXT,
        execution_time FLOAT,
        rows_examined INT,
        source_file VARCHAR(255),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admin_ajax_calls (
        id INT AUTO_INCREMENT PRIMARY KEY,
        action_name VARCHAR(100),
        call_count INT,
        avg_response_time FLOAT,
        total_time FLOAT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS plugin_performance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plugin_name VARCHAR(100),
        impact_score INT,
        memory_usage FLOAT,
        query_count INT,
        load_time FLOAT,
        status VARCHAR(20),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS system_health (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cpu_usage FLOAT,
        memory_total FLOAT,
        memory_used FLOAT,
        disk_usage FLOAT,
        active_connections INT,
        cache_hit_ratio FLOAT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert comprehensive demo data with time series
    const performanceData = [];
    const currentTime = new Date();

    // Generate last 24 hours of data
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(currentTime.getTime() - (i * 60 * 60 * 1000));
      const baseResponseTime = 45 + Math.random() * 30;
      const baseMemory = 120 + Math.random() * 50;
      const baseQPS = 80 + Math.random() * 40;

      performanceData.push([
        'SELECT',
        baseResponseTime,
        1200 + Math.floor(Math.random() * 500),
        Math.floor(Math.random() * 30),
        baseQPS,
        baseResponseTime + Math.random() * 10,
        baseMemory,
        timestamp
      ]);
    }

    for (const data of performanceData) {
      await connection.execute(`
        INSERT INTO performance_metrics
        (query_type, avg_execution_time, total_queries, slow_queries, queries_per_second, avg_response_time, memory_usage, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, data);
    }

    const slowQueries = [
      ['SELECT * FROM wp_posts WHERE post_status = "publish" ORDER BY post_date DESC LIMIT 10', 1250.5, 15000, 'wp-includes/query.php'],
      ['SELECT * FROM wp_postmeta WHERE meta_key LIKE "%_transient%" ORDER BY meta_id', 890.3, 8500, 'wp-includes/option.php'],
      ['SELECT * FROM wp_options WHERE autoload = "yes" ORDER BY option_name', 670.8, 2300, 'wp-includes/load.php'],
      ['SELECT COUNT(*) FROM wp_posts p JOIN wp_postmeta pm ON p.ID = pm.post_id WHERE p.post_type = "product"', 1450.2, 25000, 'wp-content/plugins/woocommerce/includes/class-wc-query.php'],
      ['SELECT * FROM wp_users WHERE user_login = "admin" OR user_email = "admin@example.com"', 245.8, 1200, 'wp-includes/user.php'],
      ['SELECT option_value FROM wp_options WHERE option_name = "_site_transient_timeout_theme_roots"', 156.3, 800, 'wp-includes/option.php'],
      ['SELECT * FROM wp_posts WHERE post_type = "attachment" AND post_mime_type LIKE "image%" ORDER BY post_date DESC', 890.7, 12000, 'wp-includes/post.php'],
      ['SELECT meta_value FROM wp_usermeta WHERE user_id = 1 AND meta_key = "wp_capabilities"', 78.9, 500, 'wp-includes/user.php']
    ];

    for (const query of slowQueries) {
      await connection.execute(`
        INSERT INTO slow_queries (query_text, execution_time, rows_examined, source_file)
        VALUES (?, ?, ?, ?)
      `, query);
    }

    const ajaxCalls = [
      ['heartbeat', 450, 125.5, 56475],
      ['fetch_posts', 78, 235.8, 18402],
      ['save_draft', 34, 89.2, 3035],
      ['load_comments', 156, 178.9, 27914],
      ['admin_ajax_action', 234, 67.3, 15756],
      ['wp_ajax_query_attachments', 89, 445.2, 39668],
      ['wp_ajax_save_widget', 45, 234.1, 10534],
      ['wp_ajax_customize_save', 23, 1245.6, 28642]
    ];

    for (const call of ajaxCalls) {
      await connection.execute(`
        INSERT INTO admin_ajax_calls (action_name, call_count, avg_response_time, total_time)
        VALUES (?, ?, ?, ?)
      `, call);
    }

    const plugins = [
      ['WooCommerce', 85, 45.2, 234, 567.8, 'active'],
      ['Yoast SEO', 72, 23.1, 89, 234.5, 'active'],
      ['Elementor', 91, 67.8, 345, 789.2, 'active'],
      ['Contact Form 7', 34, 12.5, 45, 123.4, 'active'],
      ['Akismet Anti-Spam', 28, 8.9, 23, 89.3, 'active'],
      ['Jetpack', 76, 34.7, 156, 445.9, 'active'],
      ['WP Super Cache', 45, 15.2, 67, 178.4, 'active'],
      ['Advanced Custom Fields', 58, 21.8, 98, 267.1, 'active'],
      ['Gravity Forms', 63, 28.4, 134, 356.2, 'active'],
      ['WP Rocket', 39, 18.6, 56, 198.7, 'active']
    ];

    for (const plugin of plugins) {
      await connection.execute(`
        INSERT INTO plugin_performance (plugin_name, impact_score, memory_usage, query_count, load_time, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `, plugin);
    }

    // Insert system health data
    const systemHealthData = [
      [45.2, 8192, 3567, 78.5, 156, 87.3],
      [52.8, 8192, 3890, 82.1, 189, 82.7],
      [38.9, 8192, 3234, 75.9, 134, 91.2]
    ];

    for (const health of systemHealthData) {
      await connection.execute(`
        INSERT INTO system_health (cpu_usage, memory_total, memory_used, disk_usage, active_connections, cache_hit_ratio)
        VALUES (?, ?, ?, ?, ?, ?)
      `, health);
    }

    console.log('✅ Demo data generated successfully!');

  } catch (error) {
    console.error('Error generating demo data:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

generateDemoData();
