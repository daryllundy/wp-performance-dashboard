const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
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

    // Insert demo data
    const performanceData = [
      ['SELECT', 45.2, 1250, 23, 85.5, 52.3, 128.5],
      ['INSERT', 12.8, 340, 2, 92.1, 48.1, 132.1],
      ['UPDATE', 67.3, 890, 45, 76.8, 61.2, 145.8],
      ['DELETE', 23.1, 156, 5, 88.9, 35.7, 119.3]
    ];

    for (const data of performanceData) {
      await connection.execute(`
        INSERT INTO performance_metrics 
        (query_type, avg_execution_time, total_queries, slow_queries, queries_per_second, avg_response_time, memory_usage) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, data);
    }

    const slowQueries = [
      ['SELECT * FROM wp_posts WHERE post_status = "publish" ORDER BY post_date DESC', 1250.5, 15000, 'wp-includes/query.php'],
      ['SELECT * FROM wp_postmeta WHERE meta_key LIKE "%_transient%" ORDER BY meta_id', 890.3, 8500, 'wp-includes/option.php'],
      ['SELECT * FROM wp_options WHERE autoload = "yes" ORDER BY option_name', 670.8, 2300, 'wp-includes/load.php']
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
      ['load_comments', 156, 178.9, 27914]
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
      ['Contact Form 7', 34, 12.5, 45, 123.4, 'active']
    ];

    for (const plugin of plugins) {
      await connection.execute(`
        INSERT INTO plugin_performance (plugin_name, impact_score, memory_usage, query_count, load_time, status) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, plugin);
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
