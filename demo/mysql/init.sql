-- Demo WordPress Database Initialization Script
-- This script sets up the database with performance monitoring extensions

-- Create the demo database if it doesn't exist
CREATE DATABASE IF NOT EXISTS demo_wordpress CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE demo_wordpress;

-- Enable Performance Schema for this session
SET GLOBAL performance_schema = ON;

-- Configure Performance Schema consumers for comprehensive monitoring
UPDATE performance_schema.setup_consumers SET ENABLED = 'YES' WHERE NAME LIKE 'events_statements_%';
UPDATE performance_schema.setup_consumers SET ENABLED = 'YES' WHERE NAME LIKE 'events_stages_%';
UPDATE performance_schema.setup_consumers SET ENABLED = 'YES' WHERE NAME LIKE 'events_waits_%';
UPDATE performance_schema.setup_consumers SET ENABLED = 'YES' WHERE NAME = 'global_instrumentation';
UPDATE performance_schema.setup_consumers SET ENABLED = 'YES' WHERE NAME = 'thread_instrumentation';

-- Enable statement and stage instrumentation
UPDATE performance_schema.setup_instruments SET ENABLED = 'YES', TIMED = 'YES' WHERE NAME LIKE 'statement/%';
UPDATE performance_schema.setup_instruments SET ENABLED = 'YES', TIMED = 'YES' WHERE NAME LIKE 'stage/%';
UPDATE performance_schema.setup_instruments SET ENABLED = 'YES', TIMED = 'YES' WHERE NAME LIKE 'wait/io/%';
UPDATE performance_schema.setup_instruments SET ENABLED = 'YES', TIMED = 'YES' WHERE NAME LIKE 'wait/lock/%';

-- Create performance monitoring tables
CREATE TABLE IF NOT EXISTS wp_performance_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    query_type VARCHAR(50) NOT NULL,
    execution_time DECIMAL(10,6) NOT NULL,
    query_hash VARCHAR(64) NOT NULL,
    affected_rows INT UNSIGNED DEFAULT 0,
    plugin_context VARCHAR(100) DEFAULT NULL,
    user_id BIGINT UNSIGNED DEFAULT NULL,
    INDEX idx_timestamp (timestamp),
    INDEX idx_query_type (query_type),
    INDEX idx_execution_time (execution_time),
    INDEX idx_plugin_context (plugin_context)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create slow query tracking table
CREATE TABLE IF NOT EXISTS wp_slow_queries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    query_time DECIMAL(10,6) NOT NULL,
    lock_time DECIMAL(10,6) DEFAULT 0,
    rows_sent INT UNSIGNED DEFAULT 0,
    rows_examined INT UNSIGNED DEFAULT 0,
    query_text TEXT NOT NULL,
    query_hash VARCHAR(64) NOT NULL,
    INDEX idx_timestamp (timestamp),
    INDEX idx_query_time (query_time),
    INDEX idx_query_hash (query_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create plugin performance tracking table
CREATE TABLE IF NOT EXISTS wp_plugin_performance (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    plugin_name VARCHAR(100) NOT NULL,
    hook_name VARCHAR(100) NOT NULL,
    execution_time DECIMAL(10,6) NOT NULL,
    memory_usage BIGINT UNSIGNED DEFAULT 0,
    call_count INT UNSIGNED DEFAULT 1,
    INDEX idx_timestamp (timestamp),
    INDEX idx_plugin_name (plugin_name),
    INDEX idx_hook_name (hook_name),
    INDEX idx_execution_time (execution_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create AJAX call tracking table
CREATE TABLE IF NOT EXISTS wp_ajax_calls (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    action VARCHAR(100) NOT NULL,
    execution_time DECIMAL(10,6) NOT NULL,
    response_size INT UNSIGNED DEFAULT 0,
    user_id BIGINT UNSIGNED DEFAULT NULL,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT DEFAULT NULL,
    INDEX idx_timestamp (timestamp),
    INDEX idx_action (action),
    INDEX idx_execution_time (execution_time),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create real-time performance metrics table
CREATE TABLE IF NOT EXISTS wp_realtime_metrics (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    metric_unit VARCHAR(20) DEFAULT NULL,
    category VARCHAR(50) DEFAULT 'general',
    INDEX idx_timestamp (timestamp),
    INDEX idx_metric_name (metric_name),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create database connection tracking table
CREATE TABLE IF NOT EXISTS wp_connection_stats (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    active_connections INT UNSIGNED NOT NULL,
    max_connections INT UNSIGNED NOT NULL,
    queries_per_second DECIMAL(10,2) DEFAULT 0,
    slow_queries_count INT UNSIGNED DEFAULT 0,
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create memory usage tracking table
CREATE TABLE IF NOT EXISTS wp_memory_usage (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    process_type VARCHAR(50) NOT NULL,
    memory_used BIGINT UNSIGNED NOT NULL,
    memory_peak BIGINT UNSIGNED DEFAULT NULL,
    memory_limit BIGINT UNSIGNED DEFAULT NULL,
    INDEX idx_timestamp (timestamp),
    INDEX idx_process_type (process_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create demo user for WordPress
INSERT IGNORE INTO wp_users (
    user_login, 
    user_pass, 
    user_nicename, 
    user_email, 
    user_registered, 
    user_status, 
    display_name
) VALUES (
    'demo_admin',
    MD5('demo_password'),
    'demo-admin',
    'demo@example.com',
    NOW(),
    0,
    'Demo Administrator'
);

-- Set up demo user capabilities
SET @user_id = (SELECT ID FROM wp_users WHERE user_login = 'demo_admin');
INSERT IGNORE INTO wp_usermeta (user_id, meta_key, meta_value) VALUES 
(@user_id, 'wp_capabilities', 'a:1:{s:13:"administrator";b:1;}'),
(@user_id, 'wp_user_level', '10');

-- Insert some initial performance data for demonstration
INSERT INTO wp_performance_logs (query_type, execution_time, query_hash, affected_rows, plugin_context) VALUES
('SELECT', 0.001234, SHA2('SELECT * FROM wp_posts WHERE post_status = "publish"', 256), 25, 'core'),
('SELECT', 0.002456, SHA2('SELECT * FROM wp_options WHERE autoload = "yes"', 256), 150, 'core'),
('INSERT', 0.000789, SHA2('INSERT INTO wp_postmeta (post_id, meta_key, meta_value)', 256), 1, 'yoast-seo'),
('UPDATE', 0.001567, SHA2('UPDATE wp_posts SET post_modified = NOW()', 256), 1, 'core'),
('SELECT', 0.003234, SHA2('SELECT * FROM wp_posts JOIN wp_postmeta ON wp_posts.ID = wp_postmeta.post_id', 256), 45, 'woocommerce');

-- Insert some slow query examples
INSERT INTO wp_slow_queries (query_time, lock_time, rows_sent, rows_examined, query_text, query_hash) VALUES
(2.345678, 0.001234, 100, 5000, 'SELECT * FROM wp_posts p JOIN wp_postmeta pm ON p.ID = pm.post_id WHERE pm.meta_key = "_price" ORDER BY pm.meta_value', SHA2('slow_query_1', 256)),
(1.876543, 0.000567, 50, 2500, 'SELECT COUNT(*) FROM wp_comments c JOIN wp_posts p ON c.comment_post_ID = p.ID WHERE p.post_status = "publish"', SHA2('slow_query_2', 256)),
(3.123456, 0.002345, 200, 8000, 'SELECT * FROM wp_options WHERE option_name LIKE "%transient%" ORDER BY option_id', SHA2('slow_query_3', 256));

-- Insert plugin performance data
INSERT INTO wp_plugin_performance (plugin_name, hook_name, execution_time, memory_usage, call_count) VALUES
('woocommerce', 'woocommerce_init', 0.045678, 2048576, 1),
('yoast-seo', 'wp_head', 0.023456, 1048576, 1),
('contact-form-7', 'wp_enqueue_scripts', 0.012345, 524288, 1),
('akismet', 'comment_form', 0.008901, 262144, 1),
('demo-performance-plugin', 'admin_init', 0.067890, 3145728, 1);

-- Insert AJAX call data
INSERT INTO wp_ajax_calls (action, execution_time, response_size, user_id, success) VALUES
('heartbeat', 0.123456, 1024, 1, TRUE),
('save_post', 0.456789, 2048, 1, TRUE),
('load_more_posts', 0.234567, 4096, NULL, TRUE),
('contact_form_submit', 0.345678, 512, NULL, TRUE),
('woocommerce_add_to_cart', 0.567890, 1536, 1, TRUE),
('demo_slow_ajax', 2.123456, 8192, 1, FALSE),
('admin_ajax_search', 0.189234, 3072, 1, TRUE),
('wp_ajax_query_attachments', 0.298765, 5120, 1, TRUE),
('wp_ajax_save_widget', 0.156789, 768, 1, TRUE),
('wp_ajax_customize_save', 1.234567, 4096, 1, TRUE);

-- Insert real-time metrics data
INSERT INTO wp_realtime_metrics (metric_name, metric_value, metric_unit, category) VALUES
('queries_per_second', 45.67, 'qps', 'database'),
('avg_query_time', 0.0234, 'seconds', 'database'),
('memory_usage', 67.8, 'percent', 'system'),
('cpu_usage', 23.4, 'percent', 'system'),
('active_connections', 12, 'count', 'database'),
('cache_hit_ratio', 89.5, 'percent', 'cache'),
('page_load_time', 1.234, 'seconds', 'frontend'),
('plugin_load_time', 0.456, 'seconds', 'plugins'),
('theme_load_time', 0.123, 'seconds', 'theme'),
('database_size', 45.6, 'MB', 'storage');

-- Insert connection statistics
INSERT INTO wp_connection_stats (active_connections, max_connections, queries_per_second, slow_queries_count) VALUES
(12, 200, 45.67, 3),
(15, 200, 52.34, 2),
(8, 200, 38.91, 1),
(20, 200, 67.89, 5),
(18, 200, 59.23, 4);

-- Insert memory usage data
INSERT INTO wp_memory_usage (process_type, memory_used, memory_peak, memory_limit) VALUES
('wordpress', 67108864, 83886080, 134217728),
('mysql', 268435456, 301989888, 536870912),
('nginx', 16777216, 20971520, 67108864),
('php-fpm', 134217728, 167772160, 268435456),
('system', 1073741824, 1207959552, 2147483648);

-- Create indexes for better performance monitoring
CREATE INDEX idx_posts_status_date ON wp_posts(post_status, post_date);
CREATE INDEX idx_postmeta_key_value ON wp_postmeta(meta_key, meta_value(191));
CREATE INDEX idx_options_autoload ON wp_options(autoload);

-- Create performance monitoring views for easier data access
CREATE OR REPLACE VIEW v_performance_summary AS
SELECT 
    DATE(timestamp) as date,
    query_type,
    COUNT(*) as query_count,
    AVG(execution_time) as avg_execution_time,
    MAX(execution_time) as max_execution_time,
    SUM(affected_rows) as total_affected_rows
FROM wp_performance_logs 
WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(timestamp), query_type
ORDER BY date DESC, avg_execution_time DESC;

CREATE OR REPLACE VIEW v_slow_query_summary AS
SELECT 
    DATE(timestamp) as date,
    COUNT(*) as slow_query_count,
    AVG(query_time) as avg_query_time,
    MAX(query_time) as max_query_time,
    AVG(rows_examined) as avg_rows_examined
FROM wp_slow_queries 
WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(timestamp)
ORDER BY date DESC;

CREATE OR REPLACE VIEW v_plugin_performance_summary AS
SELECT 
    plugin_name,
    COUNT(*) as call_count,
    AVG(execution_time) as avg_execution_time,
    MAX(execution_time) as max_execution_time,
    AVG(memory_usage) as avg_memory_usage,
    MAX(memory_usage) as max_memory_usage
FROM wp_plugin_performance 
WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY plugin_name
ORDER BY avg_execution_time DESC;

CREATE OR REPLACE VIEW v_realtime_dashboard AS
SELECT 
    rm.metric_name,
    rm.metric_value,
    rm.metric_unit,
    rm.category,
    rm.timestamp
FROM wp_realtime_metrics rm
INNER JOIN (
    SELECT metric_name, MAX(timestamp) as max_timestamp
    FROM wp_realtime_metrics
    GROUP BY metric_name
) latest ON rm.metric_name = latest.metric_name AND rm.timestamp = latest.max_timestamp;

-- Create stored procedure for inserting performance data
DELIMITER //
CREATE PROCEDURE InsertPerformanceLog(
    IN p_query_type VARCHAR(50),
    IN p_execution_time DECIMAL(10,6),
    IN p_query_hash VARCHAR(64),
    IN p_affected_rows INT,
    IN p_plugin_context VARCHAR(100),
    IN p_user_id BIGINT
)
BEGIN
    INSERT INTO wp_performance_logs (
        query_type, execution_time, query_hash, 
        affected_rows, plugin_context, user_id
    ) VALUES (
        p_query_type, p_execution_time, p_query_hash,
        p_affected_rows, p_plugin_context, p_user_id
    );
END //

-- Create stored procedure for updating real-time metrics
CREATE PROCEDURE UpdateRealtimeMetric(
    IN p_metric_name VARCHAR(100),
    IN p_metric_value DECIMAL(15,6),
    IN p_metric_unit VARCHAR(20),
    IN p_category VARCHAR(50)
)
BEGIN
    INSERT INTO wp_realtime_metrics (metric_name, metric_value, metric_unit, category)
    VALUES (p_metric_name, p_metric_value, p_metric_unit, p_category);
    
    -- Clean up old metrics (keep only last 1000 entries per metric)
    DELETE FROM wp_realtime_metrics 
    WHERE metric_name = p_metric_name 
    AND id NOT IN (
        SELECT id FROM (
            SELECT id FROM wp_realtime_metrics 
            WHERE metric_name = p_metric_name 
            ORDER BY timestamp DESC 
            LIMIT 1000
        ) AS keep_records
    );
END //
DELIMITER ;

-- Grant necessary permissions for performance monitoring
GRANT SELECT ON performance_schema.* TO 'demo_user'@'%';
GRANT SELECT ON information_schema.* TO 'demo_user'@'%';
GRANT SELECT, INSERT, UPDATE ON demo_wordpress.* TO 'demo_user'@'%';
GRANT EXECUTE ON PROCEDURE demo_wordpress.InsertPerformanceLog TO 'demo_user'@'%';
GRANT EXECUTE ON PROCEDURE demo_wordpress.UpdateRealtimeMetric TO 'demo_user'@'%';

-- Flush privileges
FLUSH PRIVILEGES;
